/**
 * CABSSA Clubdesk — Reports & Certificates Engine
 * Real data aggregation reports, CSV export, and dynamic Certificate of Appreciation generator.
 */
(() => {
  'use strict';

  const ReportsModule = {
    async init() {
      await this.loadSummaryReport();
      this.bindEvents();
    },

    bindEvents() {
      // Tab switcher
      document.querySelectorAll('[data-report-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchTab(btn.dataset.reportTab);
        });
      });

      // Certificate generator form
      const certForm = document.getElementById('certGeneratorForm');
      if (certForm) {
        certForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.generateCertificate();
        });
      }
    },

    switchTab(tabId) {
      document.querySelectorAll('[data-report-tab]').forEach(btn => {
        const isActive = btn.dataset.reportTab === tabId;
        btn.className = isActive
          ? 'py-2.5 px-4 text-xs font-semibold rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/40 transition-all'
          : 'py-2.5 px-4 text-xs font-semibold rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all';
      });

      document.querySelectorAll('[data-report-content]').forEach(view => {
        view.classList.toggle('hidden', view.dataset.reportContent !== tabId);
      });

      if (tabId === 'attendance') this.loadAttendanceReport();
      if (tabId === 'tasks') this.loadTasksReport();
      if (tabId === 'certificates') this.loadCertificateMembersDropdown();
    },

    async loadSummaryReport() {
      const container = document.getElementById('reportSummaryContainer');
      if (!container) return;

      try {
        const summary = await window.CABSSA_API.getReportsSummary();
        const m = summary.members || { total: 0, active: 0, inactive: 0 };
        const e = summary.events || { total: 0, upcoming: 0, completed: 0 };
        const t = summary.tasks || { total: 0, pending: 0, completed: 0 };
        const a = summary.attendance || { total: 0 };

        container.innerHTML = `
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div class="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <p class="text-2xl font-bold text-white">${m.total}</p>
              <p class="text-[10px] font-mono text-slate-400 uppercase mt-1">Total Committee</p>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <p class="text-2xl font-bold text-emerald-400">${e.completed}</p>
              <p class="text-[10px] font-mono text-slate-400 uppercase mt-1">Completed Events</p>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <p class="text-2xl font-bold text-violet-400">${t.completed}</p>
              <p class="text-[10px] font-mono text-slate-400 uppercase mt-1">Completed Tasks</p>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <p class="text-2xl font-bold text-amber-400">${a.total}</p>
              <p class="text-[10px] font-mono text-slate-400 uppercase mt-1">Attendance Marks</p>
            </div>
          </div>
        `;
      } catch (e) {}
    },

    async loadAttendanceReport() {
      const container = document.getElementById('reportAttendanceContainer');
      if (!container) return;

      container.innerHTML = '<p class="text-xs text-slate-400 font-mono py-8 text-center">Computing attendance rates...</p>';

      try {
        const members = await window.CABSSA_API.getMembers();
        const attendance = await window.CABSSA_API.getAttendance();
        const events = await window.CABSSA_API.getEvents();

        const completedEventsCount = events.filter(e => e.status === 'Completed').length || 1;

        container.innerHTML = `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs font-mono">
              <thead class="text-slate-400 border-b border-white/[0.08] bg-white/[0.01]">
                <tr>
                  <th class="py-3 px-4">Member Name</th>
                  <th class="py-3 px-4">PRN Number</th>
                  <th class="py-3 px-4">Domain</th>
                  <th class="py-3 px-4">Attended Events</th>
                  <th class="py-3 px-4">Attendance Rate</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.04]">
                ${members.map(m => {
                  const memberAttended = attendance.filter(a => a.member_id === m.id).length;
                  const rate = Math.round((memberAttended / completedEventsCount) * 100);

                  return `
                    <tr class="hover:bg-white/[0.02]">
                      <td class="py-3 px-4 font-sans font-bold text-white">${escapeHtml(m.full_name)}</td>
                      <td class="py-3 px-4 text-slate-300">${escapeHtml(m.prn_number)}</td>
                      <td class="py-3 px-4 text-violet-300">${escapeHtml(m.domain_name || 'General')}</td>
                      <td class="py-3 px-4 font-bold text-emerald-400">${memberAttended}</td>
                      <td class="py-3 px-4">
                        <div class="flex items-center space-x-2">
                          <span class="w-10 text-right">${rate}%</span>
                          <div class="w-20 h-1.5 rounded-full bg-white/[0.1] overflow-hidden">
                            <div class="h-full bg-emerald-500 rounded-full" style="width: ${Math.min(100, rate)}%"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<p class="text-xs text-rose-400 py-4 text-center">Error: ${escapeHtml(err.message)}</p>`;
      }
    },

    async loadTasksReport() {
      const container = document.getElementById('reportTasksContainer');
      if (!container) return;

      container.innerHTML = '<p class="text-xs text-slate-400 font-mono py-8 text-center">Loading task completion data...</p>';

      try {
        const tasks = await window.CABSSA_API.getTasks();
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'Completed').length;
        const inProgress = tasks.filter(t => t.status === 'In Progress').length;
        const open = tasks.filter(t => t.status === 'Open').length;

        container.innerHTML = `
          <div class="space-y-4">
            <div class="grid grid-cols-3 gap-4 text-center text-xs font-mono">
              <div class="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300">
                <p class="text-xl font-bold">${done}</p>
                <p class="text-[10px] uppercase">Completed</p>
              </div>
              <div class="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300">
                <p class="text-xl font-bold">${inProgress}</p>
                <p class="text-[10px] uppercase">In Progress</p>
              </div>
              <div class="p-3 rounded-xl bg-violet-950/20 border border-violet-500/30 text-violet-300">
                <p class="text-xl font-bold">${open}</p>
                <p class="text-[10px] uppercase">Open</p>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs font-mono">
                <thead class="text-slate-400 border-b border-white/[0.08]">
                  <tr>
                    <th class="py-2.5 px-3">Code</th>
                    <th class="py-2.5 px-3">Task Title</th>
                    <th class="py-2.5 px-3">Assignee</th>
                    <th class="py-2.5 px-3">Priority</th>
                    <th class="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/[0.04]">
                  ${tasks.map(t => `
                    <tr>
                      <td class="py-2.5 px-3 text-violet-400">${t.task_code}</td>
                      <td class="py-2.5 px-3 font-sans font-medium text-white">${escapeHtml(t.title)}</td>
                      <td class="py-2.5 px-3 text-slate-300">${escapeHtml(t.assignee_name)}</td>
                      <td class="py-2.5 px-3">${t.priority}</td>
                      <td class="py-2.5 px-3">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                          ${t.status}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<p class="text-xs text-rose-400 py-4 text-center">Error: ${escapeHtml(err.message)}</p>`;
      }
    },

    // ------------------------------------------------------------------------
    // CERTIFICATES ENGINE
    // ------------------------------------------------------------------------
    async loadCertificateMembersDropdown() {
      const sel = document.getElementById('certMemberSelect');
      if (!sel) return;

      try {
        const members = await window.CABSSA_API.getMembers({ status: 'Active' });
        sel.innerHTML = '<option value="">Select Committee Member for Certificate...</option>';
        members.forEach(m => {
          sel.innerHTML += `<option value="${m.id}" data-name="${escapeHtml(m.full_name)}" data-prn="${m.prn_number}" data-role="${escapeHtml(m.designation)}" data-domain="${escapeHtml(m.domain_name || 'General')}">${escapeHtml(m.full_name)} (${m.prn_number})</option>`;
        });
      } catch (e) {}
    },

    generateCertificate() {
      const sel = document.getElementById('certMemberSelect');
      const customTitle = document.getElementById('certTitleInput')?.value || 'Certificate of Appreciation';
      const year = document.getElementById('certYearInput')?.value || 'Academic Year 2026-2027';

      if (!sel || !sel.value) {
        window.CABSSA_TOAST.show('Please select a member to generate their certificate.', 'warning');
        return;
      }

      const opt = sel.options[sel.selectedIndex];
      const memberName = opt.dataset.name;
      const memberPrn = opt.dataset.prn;
      const memberRole = opt.dataset.role;
      const memberDomain = opt.dataset.domain;

      this.renderCertificateCanvas(memberName, memberPrn, memberRole, memberDomain, customTitle, year);
    },

    renderCertificateCanvas(name, prn, role, domain, title, year) {
      const canvas = document.getElementById('certificateCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // High-res landscape certificate (1600 x 1131 px)
      canvas.width = 1600;
      canvas.height = 1131;

      // Deep rich navy gradient background
      const grad = ctx.createLinearGradient(0, 0, 1600, 1131);
      grad.addColorStop(0, '#060B1E');
      grad.addColorStop(0.5, '#0A0F2B');
      grad.addColorStop(1, '#030712');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1600, 1131);

      // Gold & Violet ornamental border
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 12;
      ctx.strokeRect(40, 40, 1520, 1051);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.strokeRect(60, 60, 1480, 1011);

      // Top college association crest header
      ctx.fillStyle = '#A78BFA';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COMPUTER SCIENCE & BUSINESS SYSTEMS ASSOCIATION', 800, 140);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '16px monospace';
      ctx.fillText('Autonomous Student Association · College of Engineering', 800, 175);

      // Certificate Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 54px Inter, sans-serif';
      ctx.fillText(title.toUpperCase(), 800, 280);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('THIS CERTIFICATE IS PROUDLY PRESENTED TO', 800, 360);

      // Recipient Full Name (Glowing Gold)
      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 64px Inter, sans-serif';
      ctx.fillText(name, 800, 470);

      // Description text
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '24px Inter, sans-serif';
      ctx.fillText(`in grateful recognition of outstanding leadership and dedicated service as`, 800, 560);

      // Designation & Domain
      ctx.fillStyle = '#C4B5FD';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.fillText(`${role} — ${domain} Wing`, 800, 630);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '20px monospace';
      ctx.fillText(`PRN: ${prn} · ${year}`, 800, 700);

      // Signatures
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(300, 930);
      ctx.lineTo(600, 930);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('Prof. Rajesh Kulkarni', 450, 965);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '14px monospace';
      ctx.fillText('Faculty Coordinator, CABSSA', 450, 990);

      ctx.beginPath();
      ctx.moveTo(1000, 930);
      ctx.lineTo(1300, 930);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('Head of Department', 1150, 965);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '14px monospace';
      ctx.fillText('Computer Science & Business Systems', 1150, 990);

      // Official Stamp Seal
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(800, 930, 50, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('CABSSA', 800, 925);
      ctx.fillText('OFFICIAL', 800, 942);

      // Show container
      const container = document.getElementById('certificateCanvasContainer');
      if (container) container.classList.remove('hidden');

      window.CABSSA_TOAST.show(`Appreciation Certificate generated for ${name}!`, 'success');
    },

    downloadCertificate() {
      const canvas = document.getElementById('certificateCanvas');
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `CABSSA_Appreciation_Certificate_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.CABSSA_REPORTS = ReportsModule;
})();
