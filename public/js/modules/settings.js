/**
 * CABSSA Clubdesk — Settings & Backend Configuration Module
 */
(() => {
  'use strict';

  const SettingsModule = {
    async init() {
      this.populateCurrentConfig();
      await this.runDiagnostics();
      this.bindEvents();
    },

    bindEvents() {
      const form = document.getElementById('supabaseConfigForm');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveSupabaseConfig();
        });
      }
    },

    populateCurrentConfig() {
      const urlInput = document.getElementById('settingsSupabaseUrl');
      const keyInput = document.getElementById('settingsSupabaseKey');

      if (urlInput) urlInput.value = window.CABSSA_CONFIG.SUPABASE_URL || '';
      if (keyInput) keyInput.value = window.CABSSA_CONFIG.SUPABASE_ANON_KEY || '';
    },

    async runDiagnostics() {
      const statusEl = document.getElementById('backendStatusPill');
      const diagEl = document.getElementById('settingsDiagnosticsDisplay');

      try {
        const health = await window.CABSSA_API.getHealth();
        if (statusEl) {
          statusEl.textContent = '● Backend Connected';
          statusEl.className = 'px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5';
        }
        if (diagEl) {
          diagEl.textContent = JSON.stringify(health, null, 2);
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = '● Offline / Disconnected';
          statusEl.className = 'px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40';
        }
        if (diagEl) {
          diagEl.textContent = 'Could not establish connection to backend: ' + err.message;
        }
      }
    },

    async saveSupabaseConfig() {
      const url = document.getElementById('settingsSupabaseUrl')?.value.trim();
      const key = document.getElementById('settingsSupabaseKey')?.value.trim();

      window.localStorage.setItem('cabssa_supabase_url', url);
      window.localStorage.setItem('cabssa_supabase_anon_key', key);

      window.CABSSA_CONFIG.SUPABASE_URL = url;
      window.CABSSA_CONFIG.SUPABASE_ANON_KEY = key;

      try {
        await window.CABSSA_API.updateConfig({ supabaseUrl: url, supabaseAnonKey: key });
      } catch (e) {}

      window.CABSSA_TOAST.show('Configuration saved! Reloading application...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    },

    async downloadDatabaseBackup() {
      try {
        const members = await window.CABSSA_API.getMembers();
        const events = await window.CABSSA_API.getEvents();
        const attendance = await window.CABSSA_API.getAttendance();
        const meetings = await window.CABSSA_API.getMeetings();
        const tasks = await window.CABSSA_API.getTasks();

        const dump = {
          exported_at: new Date().toISOString(),
          version: '2.5.0-PROD',
          members,
          events,
          attendance,
          meetings,
          tasks
        };

        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CABSSA_PostgreSQL_Dump_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        window.CABSSA_TOAST.show('Full database dump exported as JSON.', 'success');
      } catch (err) {
        window.CABSSA_TOAST.show('Export failed: ' + err.message, 'error');
      }
    }
  };

  window.CABSSA_SETTINGS = SettingsModule;
})();
