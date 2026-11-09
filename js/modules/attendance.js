/**
 * CABSSA Clubdesk — QR Code Attendance System (Reverse QR)
 * High-speed automatic camera scanning with Html5Qrcode & standard QRCode generation
 */
(() => {
  'use strict';

  let currentAttendanceList = [];
  let qrExpiryTimer = null;
  let activeQrSession = null;
  let html5QrScanner = null;
  let qrCodeGenerator = null;
  let isScanningActive = false;

  const AttendanceModule = {
    async init() {
      await this.loadEventsDropdown();
      await this.renderAttendanceTable();
      this.bindEvents();
    },

    async loadEventsDropdown() {
      const sel = document.getElementById('attendanceEventFilter');
      const qrSel = document.getElementById('eventSelectForQRDropdown');
      try {
        const events = await window.CABSSA_API.getEvents();
        if (sel) {
          sel.innerHTML = '<option value="">All Events & Meets</option>';
          events.forEach(ev => {
            sel.innerHTML += `<option value="${ev.id}">${escapeHtml(ev.title)} (${ev.event_date})</option>`;
          });
        }
        if (qrSel) {
          qrSel.innerHTML = '<option value="">Select an active event...</option>';
          events.forEach(ev => {
            qrSel.innerHTML += `<option value="${ev.id}">${escapeHtml(ev.title)} (${ev.event_date}) [${ev.status}]</option>`;
          });
        }
      } catch (e) {
        console.warn('Failed to load events for dropdowns:', e);
      }
    },

    bindEvents() {
      const eventFilter = document.getElementById('attendanceEventFilter');
      if (eventFilter) {
        eventFilter.addEventListener('change', () => {
          this.renderAttendanceTable(eventFilter.value);
        });
      }

      // Manual token scan input
      const manualBtn = document.getElementById('submitManualTokenBtn');
      if (manualBtn) {
        manualBtn.addEventListener('click', () => {
          this.handleManualTokenSubmit();
        });
      }
    },

    async renderAttendanceTable(eventId = null) {
      const tbody = document.getElementById('attendanceTableBody');
      const countEl = document.getElementById('attendanceTotalCount');
      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-10 text-slate-400 font-mono text-xs">
            Querying verified attendance logs...
          </td>
        </tr>
      `;

      try {
        currentAttendanceList = await window.CABSSA_API.getAttendance(eventId);
        if (countEl) countEl.textContent = `${currentAttendanceList.length} Verified Attendances`;

        if (currentAttendanceList.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="6" class="text-center py-10 text-slate-500 text-xs">
                No attendance records found for this event.
              </td>
            </tr>
          `;
          return;
        }

        tbody.innerHTML = currentAttendanceList.map(a => {
          const time = new Date(a.marked_at).toLocaleString();
          const isQr = a.verification_method === 'QR_SCAN';

          return `
            <tr class="border-b border-white/[0.04] hover:bg-white/[0.02] text-xs">
              <td class="py-3 px-4">
                <p class="font-bold text-white">${escapeHtml(a.member_name)}</p>
                <p class="text-[10px] text-slate-400 font-mono">${escapeHtml(a.domain_name)}</p>
              </td>
              <td class="py-3 px-4 font-mono">
                <span class="text-slate-300 font-semibold">${escapeHtml(a.member_prn)}</span>
              </td>
              <td class="py-3 px-4">
                <p class="text-slate-300 font-medium">${escapeHtml(a.event_title)}</p>
              </td>
              <td class="py-3 px-4 font-mono text-[11px] text-slate-400">
                ${time}
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isQr ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'}">
                  ${isQr ? 'REVERSE QR' : 'MANUAL'}
                </span>
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ${escapeHtml(a.status || 'Present')}
                </span>
              </td>
            </tr>
          `;
        }).join('');
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-400 text-xs">Error: ${escapeHtml(err.message)}</td></tr>`;
      }
    },

    // ------------------------------------------------------------------------
    // SELECT EVENT MODAL (Host Side - Admin / Co-Head)
    // ------------------------------------------------------------------------
    async openSelectEventForQRModal() {
      if (!window.CABSSA_AUTH.requireCoHead()) return;
      await this.loadEventsDropdown();
      const modal = document.getElementById('eventSelectForQRModal');
      if (modal) modal.classList.remove('hidden');
    },

    closeSelectEventForQRModal() {
      const modal = document.getElementById('eventSelectForQRModal');
      if (modal) modal.classList.add('hidden');
    },

    async startQRFromSelectedEvent() {
      const sel = document.getElementById('eventSelectForQRDropdown');
      if (!sel || !sel.value) {
        window.CABSSA_TOAST.show('Please select an event from the list.', 'warning');
        return;
      }
      const eventId = sel.value;
      const eventTitle = sel.options[sel.selectedIndex].text;
      this.closeSelectEventForQRModal();
      await this.openGenerateQRModal(eventId, eventTitle);
    },

    // ------------------------------------------------------------------------
    // REVERSE QR GENERATION (Host Side - Admin / Co-Head)
    // ------------------------------------------------------------------------
    async openGenerateQRModal(eventId, eventTitle) {
      if (!window.CABSSA_AUTH.requireCoHead()) return;

      const modal = document.getElementById('qrGeneratorModal');
      const titleEl = document.getElementById('qrModalEventTitle');
      const tokenDisplay = document.getElementById('qrTokenDisplay');
      const timerDisplay = document.getElementById('qrTimerDisplay');
      const qrContainer = document.getElementById('qrcodeContainer');

      if (titleEl) titleEl.textContent = eventTitle || 'CABSSA Committee Event';
      if (tokenDisplay) tokenDisplay.textContent = 'Generating cryptographic session...';
      if (qrContainer) qrContainer.innerHTML = '<span class="text-xs text-slate-500 font-mono">Generating QR...</span>';

      if (modal) modal.classList.remove('hidden');

      try {
        const res = await window.CABSSA_API.createQRSession(eventId, 30);
        activeQrSession = res.data;

        if (tokenDisplay) tokenDisplay.textContent = activeQrSession.token;

        // Render genuine high-resolution scannable QR Code
        if (qrContainer) {
          qrContainer.innerHTML = '';
          if (window.QRCode) {
            qrCodeGenerator = new window.QRCode(qrContainer, {
              text: activeQrSession.token,
              width: 200,
              height: 200,
              colorDark: '#000000',
              colorLight: '#ffffff',
              correctLevel: window.QRCode.CorrectLevel.M
            });
          } else {
            qrContainer.innerHTML = `<p class="text-xs text-slate-800 font-mono p-4 text-center">Session Token:<br><strong class="text-sm">${activeQrSession.token}</strong></p>`;
          }
        }

        // Start 30-minute countdown timer
        const expiryTime = new Date(activeQrSession.expires_at).getTime();
        clearInterval(qrExpiryTimer);
        qrExpiryTimer = setInterval(() => {
          const remaining = Math.max(0, expiryTime - Date.now());
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          if (timerDisplay) {
            timerDisplay.textContent = `Valid for: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          }
          if (remaining <= 0) {
            clearInterval(qrExpiryTimer);
            if (timerDisplay) timerDisplay.textContent = 'EXPIRED';
            if (tokenDisplay) tokenDisplay.textContent = 'QR Session Expired';
          }
        }, 1000);

      } catch (err) {
        window.CABSSA_TOAST.show('Failed to create QR session: ' + err.message, 'error');
        this.closeGenerateQRModal();
      }
    },

    closeGenerateQRModal() {
      clearInterval(qrExpiryTimer);
      const modal = document.getElementById('qrGeneratorModal');
      if (modal) modal.classList.add('hidden');
      activeQrSession = null;
      qrCodeGenerator = null;
    },

    // ------------------------------------------------------------------------
    // MEMBER SCANNER MODAL (Automatic Live Camera QR Decoder)
    // ------------------------------------------------------------------------
    openScannerModal() {
      if (!window.CABSSA_AUTH.requireAuth()) return;

      const modal = document.getElementById('qrScannerModal');
      const tokenInput = document.getElementById('scannerManualTokenInput');
      const resultBox = document.getElementById('scannerResultBox');
      const readerEl = document.getElementById('html5qrReader');

      if (tokenInput) tokenInput.value = '';
      if (resultBox) resultBox.classList.add('hidden');
      if (readerEl) readerEl.innerHTML = '';
      if (modal) modal.classList.remove('hidden');

      this.startCameraScanner();
    },

    async startCameraScanner() {
      const readerEl = document.getElementById('html5qrReader');
      const note = document.getElementById('scannerCameraNote');
      if (!readerEl) return;

      if (!window.Html5Qrcode) {
        if (note) note.textContent = 'Scanner engine loading... If camera is unavailable, enter token below.';
        return;
      }

      try {
        if (html5QrScanner) {
          try { await html5QrScanner.stop(); } catch (e) {}
        }

        html5QrScanner = new window.Html5Qrcode("html5qrReader");
        isScanningActive = true;

        const config = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0
        };

        await html5QrScanner.start(
          { facingMode: "environment" },
          config,
          (decodedText, decodedResult) => {
            // QR Code Detected & Decoded!
            console.log('[QR SCAN SUCCESS]', decodedText);
            this.stopCameraScanner();
            this.handleScannedToken(decodedText);
          },
          (errorMessage) => {
            // ongoing scan frames
          }
        );

        if (note) note.textContent = 'Point your camera directly at the Host’s QR Code on screen';
      } catch (err) {
        console.warn('[CAMERA SCAN START ERROR]', err);
        isScanningActive = false;
        if (note) {
          note.innerHTML = `<span class="text-amber-400 font-semibold">Camera unavailable or permission denied.</span> Enter the Session Token manually below.`;
        }
      }
    },

    async stopCameraScanner() {
      if (html5QrScanner && isScanningActive) {
        try {
          await html5QrScanner.stop();
        } catch (e) {}
        isScanningActive = false;
      }
    },

    closeScannerModal() {
      this.stopCameraScanner();
      const modal = document.getElementById('qrScannerModal');
      if (modal) modal.classList.add('hidden');
    },

    async handleScannedToken(token) {
      const input = document.getElementById('scannerManualTokenInput');
      if (input) input.value = token;
      await this.submitToken(token);
    },

    async handleManualTokenSubmit() {
      const input = document.getElementById('scannerManualTokenInput');
      if (!input || !input.value.trim()) {
        window.CABSSA_TOAST.show('Please enter or scan the QR Token.', 'warning');
        return;
      }
      await this.submitToken(input.value.trim());
    },

    async submitToken(token) {
      const resultBox = document.getElementById('scannerResultBox');
      const submitBtn = document.getElementById('submitManualTokenBtn');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying Attendance Token...';
      }

      try {
        const res = await window.CABSSA_API.scanQR(token);
        if (resultBox) {
          resultBox.className = 'p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs font-mono space-y-1';
          resultBox.innerHTML = `
            <div class="flex items-center gap-1.5 font-bold text-white text-sm">
              <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>Attendance Verified!</span>
            </div>
            <p>${escapeHtml(res.message || 'Check-in recorded successfully.')}</p>
            <p class="text-[10px] text-slate-400">Timestamp: ${new Date().toLocaleTimeString()}</p>
          `;
          resultBox.classList.remove('hidden');
        }

        window.CABSSA_TOAST.show(res.message || 'Attendance verified successfully!', 'success');
        await this.renderAttendanceTable();
        setTimeout(() => this.closeScannerModal(), 2000);
      } catch (err) {
        if (resultBox) {
          resultBox.className = 'p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs font-mono space-y-1';
          resultBox.innerHTML = `
            <p class="font-bold text-white flex items-center gap-1.5">
              <span>Verification Failed</span>
            </p>
            <p>${escapeHtml(err.message)}</p>
          `;
          resultBox.classList.remove('hidden');
        }
        window.CABSSA_TOAST.show(err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Attendance Token';
        }
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.CABSSA_ATTENDANCE = AttendanceModule;
})();
