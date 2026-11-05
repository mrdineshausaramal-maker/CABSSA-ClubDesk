/**
 * CABSSA Clubdesk — QR Code Attendance System (Reverse QR)
 * Time-limited cryptographically validated attendance recording with duplicate prevention.
 */
(() => {
  'use strict';

  let currentAttendanceList = [];
  let qrExpiryTimer = null;
  let activeQrSession = null;
  let videoStream = null;

  const AttendanceModule = {
    async init() {
      await this.loadEventsDropdown();
      await this.renderAttendanceTable();
      this.bindEvents();
    },

    async loadEventsDropdown() {
      const sel = document.getElementById('attendanceEventFilter');
      if (!sel) return;
      try {
        const events = await window.CABSSA_API.getEvents();
        sel.innerHTML = '<option value="">All Events & Meets</option>';
        events.forEach(ev => {
          sel.innerHTML += `<option value="${ev.id}">${escapeHtml(ev.title)} (${ev.event_date})</option>`;
        });
      } catch (e) {}
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
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isQr ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                  ${isQr ? '⚡ REVERSE QR' : '✍️ MANUAL OVERRIDE'}
                </span>
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ${escapeHtml(a.status)}
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
    // REVERSE QR GENERATION (Admin/Co-Head)
    // ------------------------------------------------------------------------
    async openGenerateQRModal(eventId, eventTitle) {
      if (!window.CABSSA_AUTH.requireCoHead()) return;

      const modal = document.getElementById('qrGeneratorModal');
      const titleEl = document.getElementById('qrModalEventTitle');
      const tokenDisplay = document.getElementById('qrTokenDisplay');
      const timerDisplay = document.getElementById('qrTimerDisplay');

      if (titleEl) titleEl.textContent = eventTitle || 'CABSSA Committee Event';
      if (tokenDisplay) tokenDisplay.textContent = 'Generating cryptographic session...';

      if (modal) modal.classList.remove('hidden');

      try {
        const res = await window.CABSSA_API.createQRSession(eventId, 30);
        activeQrSession = res.data;

        if (tokenDisplay) tokenDisplay.textContent = activeQrSession.token;

        // Render QR Code on canvas
        this.renderQRCodeCanvas(activeQrSession.token);

        // Start countdown timer
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
            tokenDisplay.textContent = 'QR Session Expired';
          }
        }, 1000);

      } catch (err) {
        window.CABSSA_TOAST.show('Failed to create QR session: ' + err.message, 'error');
        this.closeGenerateQRModal();
      }
    },

    renderQRCodeCanvas(token) {
      const canvas = document.getElementById('qrCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const size = canvas.width = canvas.height = 240;

      // Draw stylized SVG/Canvas QR graphic representation with authentic token
      ctx.fillStyle = '#060B1E';
      ctx.fillRect(0, 0, size, size);

      // Border glow
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, size - 8, size - 8);

      // Matrix Grid Pattern derived deterministically from token
      const grid = 12;
      const cellSize = (size - 32) / grid;
      ctx.fillStyle = '#C4B5FD';

      // Fixed 3 Corner Position Markers
      this.drawPositionMarker(ctx, 16, 16, cellSize * 3);
      this.drawPositionMarker(ctx, size - 16 - cellSize * 3, 16, cellSize * 3);
      this.drawPositionMarker(ctx, 16, size - 16 - cellSize * 3, cellSize * 3);

      // Data pseudo-modules
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          if ((r < 3 && c < 3) || (r < 3 && c >= grid - 3) || (r >= grid - 3 && c < 3)) continue;
          const charCode = token.charCodeAt((r * grid + c) % token.length);
          if (charCode % 2 === 0) {
            ctx.fillRect(16 + c * cellSize, 16 + r * cellSize, cellSize - 1.5, cellSize - 1.5);
          }
        }
      }

      // Center Brand Shield
      ctx.fillStyle = '#7C3AED';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CAB', size / 2, size / 2);
    },

    drawPositionMarker(ctx, x, y, s) {
      ctx.fillStyle = '#8B5CF6';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#060B1E';
      ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
      ctx.fillStyle = '#A78BFA';
      ctx.fillRect(x + 8, y + 8, s - 16, s - 16);
    },

    closeGenerateQRModal() {
      clearInterval(qrExpiryTimer);
      const modal = document.getElementById('qrGeneratorModal');
      if (modal) modal.classList.add('hidden');
      activeQrSession = null;
    },

    // ------------------------------------------------------------------------
    // MEMBER SCANNER MODAL (Core Member scans)
    // ------------------------------------------------------------------------
    openScannerModal() {
      if (!window.CABSSA_AUTH.requireAuth()) return;

      const modal = document.getElementById('qrScannerModal');
      const tokenInput = document.getElementById('scannerManualTokenInput');
      const resultBox = document.getElementById('scannerResultBox');

      if (tokenInput) tokenInput.value = '';
      if (resultBox) resultBox.classList.add('hidden');
      if (modal) modal.classList.remove('hidden');

      // Attempt camera activation if available
      this.startCameraStream();
    },

    startCameraStream() {
      const video = document.getElementById('scannerVideo');
      if (!video) return;

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(stream => {
            videoStream = stream;
            video.srcObject = stream;
            video.play();
          })
          .catch(err => {
            console.warn('[CAMERA] Camera unavailable or permission denied:', err);
            // Fallback gracefully to manual token entry
            const note = document.getElementById('scannerCameraNote');
            if (note) note.textContent = 'Camera stream inactive. Use quick token entry below.';
          });
      }
    },

    stopCameraStream() {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
      }
    },

    closeScannerModal() {
      this.stopCameraStream();
      const modal = document.getElementById('qrScannerModal');
      if (modal) modal.classList.add('hidden');
    },

    async handleManualTokenSubmit() {
      const input = document.getElementById('scannerManualTokenInput');
      const resultBox = document.getElementById('scannerResultBox');
      const submitBtn = document.getElementById('submitManualTokenBtn');

      if (!input || !input.value.trim()) {
        window.CABSSA_TOAST.show('Please enter or paste the QR Token.', 'warning');
        return;
      }

      const token = input.value.trim();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Validating on PostgreSQL Backend...';
      }

      try {
        const res = await window.CABSSA_API.scanQR(token);
        if (resultBox) {
          resultBox.className = 'p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono space-y-1';
          resultBox.innerHTML = `
            <p class="font-bold text-white flex items-center gap-1.5">
              <span>✅ Attendance Confirmed!</span>
            </p>
            <p>${escapeHtml(res.message)}</p>
            <p class="text-[10px] text-slate-400">Timestamp: ${new Date().toLocaleTimeString()}</p>
          `;
          resultBox.classList.remove('hidden');
        }

        window.CABSSA_TOAST.show(res.message, 'success');
        await this.renderAttendanceTable();
        setTimeout(() => this.closeScannerModal(), 1800);
      } catch (err) {
        if (resultBox) {
          resultBox.className = 'p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs font-mono space-y-1';
          resultBox.innerHTML = `
            <p class="font-bold text-white">❌ Verification Failed</p>
            <p>${escapeHtml(err.message)}</p>
          `;
          resultBox.classList.remove('hidden');
        }
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
