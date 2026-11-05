/**
 * CABSSA Clubdesk — Activity & Audit Logs Module
 * Immutable administrative activity audit trail
 */
(() => {
  'use strict';

  const ActivityModule = {
    async init() {
      await this.renderLogs();
    },

    async renderLogs() {
      const container = document.getElementById('activityLogsTableBody');
      if (!container) return;

      container.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-10 text-slate-400 font-mono text-xs">
            Querying audit trail from PostgreSQL...
          </td>
        </tr>
      `;

      try {
        const logs = await window.CABSSA_API.getActivityLogs();

        if (logs.length === 0) {
          container.innerHTML = `
            <tr>
              <td colspan="5" class="text-center py-10 text-slate-500 text-xs font-mono">
                No activity records logged.
              </td>
            </tr>
          `;
          return;
        }

        container.innerHTML = logs.map(l => {
          const time = new Date(l.created_at).toLocaleString();
          return `
            <tr class="border-b border-white/[0.04] hover:bg-white/[0.02] text-xs font-mono">
              <td class="py-3 px-4 text-slate-400 text-[11px]">${time}</td>
              <td class="py-3 px-4 font-bold text-white font-sans">${escapeHtml(l.actor_name || 'System')}</td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  ${escapeHtml(l.action)}
                </span>
              </td>
              <td class="py-3 px-4 text-slate-300">${escapeHtml(l.entity_type)}</td>
              <td class="py-3 px-4 text-slate-400 text-[11px]">
                <code>${escapeHtml(JSON.stringify(l.details || {}))}</code>
              </td>
            </tr>
          `;
        }).join('');
      } catch (err) {
        container.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-rose-400 text-xs">Access Restricted: ${escapeHtml(err.message)}</td></tr>`;
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.CABSSA_ACTIVITY = ActivityModule;
})();
