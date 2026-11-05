/**
 * CABSSA Clubdesk — Main Application Controller & Router
 */
(() => {
  'use strict';

  // --------------------------------------------------------------------------
  // TOAST NOTIFICATION ENGINE
  // --------------------------------------------------------------------------
  const Toast = {
    show(message, type = 'info', duration = 3500) {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      let colors = 'bg-slate-900 border-white/20 text-white';
      let icon = '<svg class="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

      if (type === 'success') {
        colors = 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200';
        icon = '<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
      } else if (type === 'error') {
        colors = 'bg-rose-950/90 border-rose-500/50 text-rose-200';
        icon = '<svg class="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
      } else if (type === 'warning') {
        colors = 'bg-amber-950/90 border-amber-500/50 text-amber-200';
        icon = '<svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
      }

      toast.className = `p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-center space-x-3 text-xs font-medium transform transition-all duration-300 translate-y-4 opacity-0 ${colors}`;
      toast.innerHTML = `
        <span class="text-base">${icon}</span>
        <span class="flex-1">${escapeHtml(message)}</span>
        <button class="text-slate-400 hover:text-white ml-2 text-sm font-bold" onclick="this.parentElement.remove()">×</button>
      `;

      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
      });

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  };
  window.CABSSA_TOAST = Toast;

  // --------------------------------------------------------------------------
  // SPA ROUTER
  // --------------------------------------------------------------------------
  const Router = {
    currentRoute: 'dashboard',

    init() {
      // Bind navigation clicks
      document.querySelectorAll('[data-nav-target]').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = link.dataset.navTarget;
          this.navigate(target);
          this.closeMobileSidebar();
        });
      });

      // Mobile menu toggle
      const toggleBtn = document.getElementById('mobileMenuToggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          const sidebar = document.getElementById('mainSidebar');
          const backdrop = document.getElementById('sidebarBackdrop');
          if (sidebar) sidebar.classList.toggle('-translate-x-full');
          if (backdrop) backdrop.classList.toggle('hidden');
        });
      }

      // Initial route
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      this.navigate(hash);
    },

    navigate(routeName) {
      const validRoutes = [
        'dashboard', 'members', 'domains', 'events', 
        'attendance', 'meetings', 'tasks', 'reports', 
        'activity', 'settings'
      ];

      const target = validRoutes.includes(routeName) ? routeName : 'dashboard';
      this.currentRoute = target;
      window.location.hash = target;

      // Update Nav highlighting
      document.querySelectorAll('[data-nav-target]').forEach(link => {
        const isActive = link.dataset.navTarget === target;
        link.classList.toggle('nav-active', isActive);
      });

      // Toggle views
      document.querySelectorAll('[data-view]').forEach(view => {
        view.classList.toggle('hidden', view.dataset.view !== target);
      });

      // Refresh target module
      this.refreshCurrentView();
    },

    refreshCurrentView() {
      const view = this.currentRoute;
      if (view === 'dashboard' && window.CABSSA_DASHBOARD) window.CABSSA_DASHBOARD.init();
      if (view === 'members' && window.CABSSA_MEMBERS) window.CABSSA_MEMBERS.init();
      if (view === 'domains' && window.CABSSA_DOMAINS) window.CABSSA_DOMAINS.init();
      if (view === 'events' && window.CABSSA_EVENTS) window.CABSSA_EVENTS.init();
      if (view === 'attendance' && window.CABSSA_ATTENDANCE) window.CABSSA_ATTENDANCE.init();
      if (view === 'meetings' && window.CABSSA_MEETINGS) window.CABSSA_MEETINGS.init();
      if (view === 'tasks' && window.CABSSA_TASKS) window.CABSSA_TASKS.init();
      if (view === 'reports' && window.CABSSA_REPORTS) window.CABSSA_REPORTS.init();
      if (view === 'activity' && window.CABSSA_ACTIVITY) window.CABSSA_ACTIVITY.init();
      if (view === 'settings' && window.CABSSA_SETTINGS) window.CABSSA_SETTINGS.init();
    },

    closeMobileSidebar() {
      const sidebar = document.getElementById('mainSidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (sidebar && window.innerWidth < 1024) {
        sidebar.classList.add('-translate-x-full');
      }
      if (backdrop) {
        backdrop.classList.add('hidden');
      }
    }
  };
  window.CABSSA_ROUTER = Router;

  // --------------------------------------------------------------------------
  // APP BOOTSTRAP
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Auth
    if (window.CABSSA_AUTH) window.CABSSA_AUTH.init();

    // If not authenticated, automatically check current user or open login modal
    const user = await window.CABSSA_API.getCurrentUser();
    if (!user) {
      window.CABSSA_AUTH.openLoginModal();
    } else {
      window.CABSSA_AUTH.updateUI();
    }

    // 2. Initialize Router
    Router.init();

    // 3. Check health status
    try {
      await window.CABSSA_API.getHealth();
      const pill = document.getElementById('backendStatusPill');
      if (pill) {
        pill.textContent = '● Backend Connected';
        pill.className = 'px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      }
    } catch (e) {}
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
