/**
 * CABSSA Clubdesk — Authentication & RBAC Engine
 * Strict session management, initial Super Admin bootstrap, and role guards
 */
(() => {
  'use strict';

  const Auth = {
    user: null,
    isInitialized: false,

    async init() {
      this.user = window.CABSSA_API.user;
      await this.checkSetupStatus();
      this.bindEvents();
      this.updateUI();
    },

    async checkSetupStatus() {
      try {
        const res = await window.CABSSA_API.getSetupStatus();
        this.isInitialized = Boolean(res && res.initialized);

        // Toggle visibility between Setup Admin form and Sign-in form
        const setupSection = document.getElementById('initialSetupSection');
        const loginSection = document.getElementById('standardLoginSection');

        if (!this.isInitialized) {
          if (setupSection) setupSection.classList.remove('hidden');
          if (loginSection) loginSection.classList.add('hidden');
        } else {
          if (setupSection) setupSection.classList.add('hidden');
          if (loginSection) loginSection.classList.remove('hidden');
        }
      } catch (err) {
        console.warn('[AUTH] Could not determine setup status:', err);
      }
    },

    bindEvents() {
      // 1. Initial Admin Setup Form
      const setupForm = document.getElementById('setupAdminForm');
      if (setupForm) {
        setupForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSetupAdminSubmit();
        });
      }

      // 2. Standard Login Form
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleLoginSubmit();
        });
      }

      // 3. Switch between forms
      const showSetupBtn = document.getElementById('toggleToSetupBtn');
      if (showSetupBtn) {
        showSetupBtn.addEventListener('click', () => {
          document.getElementById('initialSetupSection')?.classList.remove('hidden');
          document.getElementById('standardLoginSection')?.classList.add('hidden');
        });
      }

      const showLoginBtn = document.getElementById('toggleToLoginBtn');
      if (showLoginBtn) {
        showLoginBtn.addEventListener('click', () => {
          document.getElementById('initialSetupSection')?.classList.add('hidden');
          document.getElementById('standardLoginSection')?.classList.remove('hidden');
        });
      }

      // 4. Logout triggers
      document.querySelectorAll('[data-action="logout"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.logout();
        });
      });
    },

    async handleSetupAdminSubmit() {
      const errorBox = document.getElementById('setupAdminErrorBox');
      const submitBtn = document.getElementById('setupAdminSubmitBtn');
      if (errorBox) errorBox.classList.add('hidden');

      const fullName = document.getElementById('setupFullName')?.value.trim();
      const email = document.getElementById('setupEmail')?.value.trim();
      const password = document.getElementById('setupPassword')?.value.trim();
      const prnNumber = document.getElementById('setupPRN')?.value.trim();
      const rollNumber = document.getElementById('setupRoll')?.value.trim();
      const contactNumber = document.getElementById('setupContact')?.value.trim();
      const academicYear = document.getElementById('setupYear')?.value || 'TY';
      const division = document.getElementById('setupDivision')?.value || 'A';
      const personalVehicle = document.getElementById('setupVehicle')?.checked || false;

      if (!fullName || !email || !password || !prnNumber || !rollNumber || !contactNumber) {
        if (errorBox) {
          errorBox.textContent = 'Please fill out all required fields marked with an asterisk (*).';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      if (password.length < 6) {
        if (errorBox) {
          errorBox.textContent = 'Password must be at least 6 characters.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Administrator in PostgreSQL Database...';
      }

      try {
        const res = await window.CABSSA_API.setupAdmin({
          fullName,
          email,
          password,
          prnNumber,
          rollNumber,
          contactNumber,
          academicYear,
          division,
          personalVehicle
        });

        this.user = res.user;
        this.isInitialized = true;
        window.CABSSA_TOAST.show(`Welcome, ${this.user.full_name}! Administrator account successfully established.`, 'success');
        
        this.updateUI();
        this.closeLoginModal();

        // Refresh views
        if (window.CABSSA_ROUTER) {
          window.CABSSA_ROUTER.refreshCurrentView();
        }
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Setup failed.';
          errorBox.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Establish Association Administrator';
        }
      }
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
        submitBtn.innerHTML = `Signing In...`;
      }

      if (errorBox) errorBox.classList.add('hidden');

      try {
        const res = await window.CABSSA_API.login(identifier, password);
        this.user = res.user;
        window.CABSSA_TOAST.show('Signed in successfully as ' + this.user.full_name, 'success');
        this.updateUI();
        this.closeLoginModal();

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
      window.CABSSA_TOAST.show('You have been signed out.', 'info');
      this.updateUI();
      this.openLoginModal();
    },

    get currentUser() {
      return this.user || (window.CABSSA_API && window.CABSSA_API.user);
    },

    updateUI() {
      this.user = this.currentUser;
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
      this.checkSetupStatus();
      const modal = document.getElementById('loginModal');
      if (modal) modal.classList.remove('hidden');
    },

    closeLoginModal() {
      const modal = document.getElementById('loginModal');
      if (modal) modal.classList.add('hidden');
    },

    requireAuth() {
      const u = this.currentUser;
      if (!u) {
        this.openLoginModal();
        window.CABSSA_TOAST.show('Please sign in to continue.', 'warning');
        return false;
      }
      return true;
    },

    requireAdmin() {
      if (!this.requireAuth()) return false;
      const u = this.currentUser;
      if (u.role !== 'ADMIN') {
        window.CABSSA_TOAST.show('Access Denied: This operation requires Administrator privileges.', 'error');
        return false;
      }
      return true;
    },

    requireCoHead() {
      if (!this.requireAuth()) return false;
      const u = this.currentUser;
      if (u.role !== 'ADMIN' && u.role !== 'CO_HEAD') {
        window.CABSSA_TOAST.show('Access Denied: This operation requires Co-Head or Admin privileges.', 'error');
        return false;
      }
      return true;
    }
  };

  window.CABSSA_AUTH = Auth;
})();
