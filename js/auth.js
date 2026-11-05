/**
 * CABSSA Clubdesk — Authentication & RBAC Engine
 * Strict session management and client-side view authorization guard
 */
(() => {
  'use strict';

  const Auth = {
    user: null,

    init() {
      this.user = window.CABSSA_API.user;
      this.bindEvents();
      this.updateUI();
    },

    bindEvents() {
      // 1-Click Fast Profile Login buttons
      document.querySelectorAll('[data-fast-login]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const role = btn.dataset.fastLogin;
          let email = 'admin@cabssa.internal';
          if (role === 'cohead') email = 'cohead@cabssa.internal';
          if (role === 'member') email = 'member@cabssa.internal';

          const emailInput = document.getElementById('loginIdentifier');
          const passInput = document.getElementById('loginPassword');
          if (emailInput) emailInput.value = email;
          if (passInput) passInput.value = 'Cabssa@2026';

          this.handleLoginSubmit();
        });
      });

      // Login form submit
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleLoginSubmit();
        });
      }

      // Logout buttons
      document.querySelectorAll('[data-action="logout"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.logout();
        });
      });
    },

    async handleLoginSubmit() {
      const idInput = document.getElementById('loginIdentifier');
      const passInput = document.getElementById('loginPassword');
      const errorBox = document.getElementById('loginErrorBox');
      const submitBtn = document.getElementById('loginSubmitBtn');

      if (!idInput || !passInput) return;
      const identifier = idInput.value.trim();
      const password = passInput.value.trim();

      if (!identifier || !password) {
        if (errorBox) {
          errorBox.textContent = 'Please provide both Email / PRN and password.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          Authenticating against PostgreSQL...
        `;
      }

      if (errorBox) errorBox.classList.add('hidden');

      try {
        const res = await window.CABSSA_API.login(identifier, password);
        this.user = res.user;
        window.CABSSA_TOAST.show('Signed in successfully as ' + this.user.full_name, 'success');
        this.updateUI();
        this.closeLoginModal();

        // Refresh currently active module
        if (window.CABSSA_ROUTER) {
          window.CABSSA_ROUTER.refreshCurrentView();
        }
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Login failed. Please check credentials.';
          errorBox.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <span>Sign In to Clubdesk</span>
            <svg class="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          `;
        }
      }
    },

    async logout() {
      await window.CABSSA_API.logout();
      this.user = null;
      window.CABSSA_TOAST.show('You have been safely signed out.', 'info');
      this.updateUI();
      this.openLoginModal();
    },

    updateUI() {
      const loggedInElements = document.querySelectorAll('[data-auth-required]');
      const guestElements = document.querySelectorAll('[data-guest-only]');
      const adminElements = document.querySelectorAll('[data-role-admin]');
      const coheadElements = document.querySelectorAll('[data-role-cohead]');

      const isLoggedIn = Boolean(this.user);
      const isAdmin = this.user && this.user.role === 'ADMIN';
      const isCoHeadOrAdmin = this.user && (this.user.role === 'ADMIN' || this.user.role === 'CO_HEAD');

      loggedInElements.forEach(el => el.classList.toggle('hidden', !isLoggedIn));
      guestElements.forEach(el => el.classList.toggle('hidden', isLoggedIn));
      adminElements.forEach(el => el.classList.toggle('hidden', !isAdmin));
      coheadElements.forEach(el => el.classList.toggle('hidden', !isCoHeadOrAdmin));

      // User profile displays
      if (this.user) {
        document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = this.user.full_name);
        document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = this.user.email);
        document.querySelectorAll('[data-user-prn]').forEach(el => el.textContent = this.user.prn_number);
        document.querySelectorAll('[data-user-desig]').forEach(el => el.textContent = this.user.designation);
        document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = this.user.role);

        const roleBadge = document.getElementById('headerRoleBadge');
        if (roleBadge) {
          roleBadge.textContent = this.user.designation || this.user.role;
          if (this.user.role === 'ADMIN') {
            roleBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40';
          } else if (this.user.role === 'CO_HEAD') {
            roleBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
          } else {
            roleBadge.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
          }
        }
      }
    },

    openLoginModal() {
      const modal = document.getElementById('loginModal');
      if (modal) modal.classList.remove('hidden');
    },

    closeLoginModal() {
      const modal = document.getElementById('loginModal');
      if (modal) modal.classList.add('hidden');
    },

    requireAuth() {
      if (!this.user) {
        this.openLoginModal();
        return false;
      }
      return true;
    },

    requireAdmin() {
      if (!this.requireAuth()) return false;
      if (this.user.role !== 'ADMIN') {
        window.CABSSA_TOAST.show('Access Denied: This operation requires Administrator privileges.', 'error');
        return false;
      }
      return true;
    },

    requireCoHead() {
      if (!this.requireAuth()) return false;
      if (this.user.role !== 'ADMIN' && this.user.role !== 'CO_HEAD') {
        window.CABSSA_TOAST.show('Access Denied: This operation requires Co-Head or Admin privileges.', 'error');
        return false;
      }
      return true;
    }
  };

  window.CABSSA_AUTH = Auth;
})();
