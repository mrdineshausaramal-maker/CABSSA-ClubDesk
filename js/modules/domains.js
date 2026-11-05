/**
 * CABSSA Clubdesk — Domains Module
 * 8 Official College Association Domains
 */
(() => {
  'use strict';

  const DomainsModule = {
    async init() {
      await this.renderDomains();
    },

    async renderDomains() {
      const container = document.getElementById('domainsGrid');
      if (!container) return;

      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 font-mono text-xs">
          Loading Domains Architecture...
        </div>
      `;

      try {
        const domains = await window.CABSSA_API.getDomains();
        
        container.innerHTML = domains.map(dom => {
          return `
            <div class="p-6 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-violet-500/40 transition-all space-y-4 group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="p-3 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 font-bold">
                    ${escapeHtml(dom.code)}
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                      ${escapeHtml(dom.name)}
                    </h3>
                    <p class="text-[10px] text-slate-400 font-mono">Domain Code: ${escapeHtml(dom.code)}</p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30">
                  ${dom.member_count || 0} Members
                </span>
              </div>

              <p class="text-xs text-slate-400 leading-relaxed min-h-[48px]">
                ${escapeHtml(dom.description || 'Specialized committee wing responsible for college-level association deliverables.')}
              </p>

              <div class="pt-3 border-t border-white/[0.06] space-y-1.5 text-xs font-mono">
                <div class="flex items-center justify-between text-slate-300">
                  <span class="text-slate-500">Domain Lead:</span>
                  <span class="font-semibold text-white">${escapeHtml(dom.head_name || 'Unassigned')}</span>
                </div>
                <div class="flex items-center justify-between text-slate-300">
                  <span class="text-slate-500">Co-Head:</span>
                  <span class="font-semibold text-white">${escapeHtml(dom.co_head_name || 'Unassigned')}</span>
                </div>
              </div>

              <div class="pt-2">
                <button 
                  onclick="window.CABSSA_DOMAINS.filterMembersByDomain('${dom.id}')"
                  class="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-violet-600/20 text-slate-300 hover:text-violet-300 border border-white/[0.08] hover:border-violet-500/40 transition-all flex items-center justify-center space-x-1.5"
                >
                  <span>View Member Roster</span>
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        container.innerHTML = `<div class="col-span-full py-8 text-center text-rose-400 text-xs">Failed to load domains: ${escapeHtml(err.message)}</div>`;
      }
    },

    filterMembersByDomain(domainId) {
      window.CABSSA_ROUTER.navigate('members');
      setTimeout(() => {
        const sel = document.getElementById('memberFilterDomain');
        if (sel) {
          sel.value = domainId;
          sel.dispatchEvent(new Event('change'));
        }
      }, 100);
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.CABSSA_DOMAINS = DomainsModule;
})();
