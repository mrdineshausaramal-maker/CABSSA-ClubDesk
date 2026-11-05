/**
 * CABSSA Clubdesk — Dashboard Module
 * Real-time metrics querying actual PostgreSQL database records
 */
(() => {
  'use strict';

  const DashboardModule = {
    async init() {
      await this.loadMetrics();
    },

    async loadMetrics() {
      try {
        const summary = await window.CABSSA_API.getReportsSummary();
        const events = await window.CABSSA_API.getEvents();

        // 1. Stat cards
        const m = summary.members || { total: 0, active: 0, inactive: 0 };
        const e = summary.events || { total: 0, upcoming: 0, completed: 0 };
        const t = summary.tasks || { total: 0, pending: 0, completed: 0 };
        const a = summary.attendance || { total: 0 };

        setText('dashTotalMembers', m.total);
        setText('dashActiveMembers', `${m.active} Active · ${m.inactive} Inactive`);
        setText('dashUpcomingEvents', e.upcoming);
        setText('dashTotalEvents', `${e.total} Total Events`);
        setText('dashPendingTasks', t.pending);
        setText('dashCompletedTasks', `${t.completed} Completed Tasks`);
        setText('dashTotalAttendance', a.total);

        // 2. Domain breakdown visual representation
        const domainBarsContainer = document.getElementById('dashDomainBreakdown');
        if (domainBarsContainer && summary.domainBreakdown) {
          const maxCount = Math.max(...summary.domainBreakdown.map(d => d.count), 1);
          domainBarsContainer.innerHTML = summary.domainBreakdown.map(d => {
            const pct = Math.round((d.count / maxCount) * 100);
            return `
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="text-slate-300 font-semibold">${escapeHtml(d.name)}</span>
                  <span class="text-violet-400 font-bold">${d.count} Members</span>
                </div>
                <div class="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-700" style="width: ${pct}%"></div>
                </div>
              </div>
            `;
          }).join('');
        }

        // 3. Upcoming events feed
        const upcomingContainer = document.getElementById('dashUpcomingFeed');
        if (upcomingContainer) {
          const upcomingList = (events || []).filter(ev => ev.status === 'Upcoming').slice(0, 3);
          if (upcomingList.length === 0) {
            upcomingContainer.innerHTML = '<p class="text-xs text-slate-500 p-4">No upcoming events currently scheduled.</p>';
          } else {
            upcomingContainer.innerHTML = upcomingList.map(ev => `
              <div class="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-violet-500/30 transition-all flex items-center justify-between">
                <div class="space-y-1">
                  <h4 class="text-xs font-bold text-white">${escapeHtml(ev.title)}</h4>
                  <p class="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                    <span>Date: ${ev.event_date}</span>
                    <span>Time: ${ev.start_time} - ${ev.end_time}</span>
                  </p>
                  <p class="text-[10px] text-violet-300 font-mono">Venue: ${escapeHtml(ev.location)}</p>
                </div>
                <button 
                  onclick="window.CABSSA_ROUTER.navigate('events')"
                  class="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-violet-600/20 text-violet-300 border border-violet-500/40 hover:bg-violet-600/40 transition-colors"
                >
                  View Duties
                </button>
              </div>
            `).join('');
          }
        }

        // 4. Recent audit activity stream
        const activityContainer = document.getElementById('dashActivityStream');
        if (activityContainer && summary.recentActivity) {
          if (summary.recentActivity.length === 0) {
            activityContainer.innerHTML = '<p class="text-xs text-slate-500 p-4">No activity logged yet.</p>';
          } else {
            activityContainer.innerHTML = summary.recentActivity.slice(0, 6).map(act => {
              const time = new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return `
                <div class="flex items-start space-x-3 text-xs border-b border-white/[0.04] pb-2.5">
                  <div class="w-2 h-2 rounded-full bg-violet-400 mt-1.5 flex-shrink-0"></div>
                  <div class="min-w-0 flex-1 space-y-0.5">
                    <p class="text-slate-200">
                      <span class="font-bold text-white">${escapeHtml(act.actor_name || 'System')}</span>
                      <span class="text-slate-400 font-mono text-[11px]"> performed </span>
                      <span class="text-violet-300 font-mono font-semibold">${escapeHtml(act.action)}</span>
                    </p>
                    <p class="text-[10px] text-slate-500 font-mono">${time} · Entity: ${escapeHtml(act.entity_type)}</p>
                  </div>
                </div>
              `;
            }).join('');
          }
        }

      } catch (err) {
        console.error('[DASHBOARD] Error loading metrics:', err);
      }
    }
  };

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.CABSSA_DASHBOARD = DashboardModule;
})();
