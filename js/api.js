/**
 * CABSSA Clubdesk — Unified API Client
 * Centralized data layer with real database persistence and strict validation.
 */
(() => {
  'use strict';

  let currentToken = window.sessionStorage.getItem('cabssa_token') || '';
  let currentUser = null;
  try {
    const rawUser = window.sessionStorage.getItem('cabssa_user');
    if (rawUser) currentUser = JSON.parse(rawUser);
  } catch (e) {}

  let supabaseClient = null;

  function initSupabaseIfConfigured() {
    if (window.CABSSA_CONFIG && window.CABSSA_CONFIG.isSupabaseActive && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(
          window.CABSSA_CONFIG.SUPABASE_URL,
          window.CABSSA_CONFIG.SUPABASE_ANON_KEY
        );
        console.log('[API] Connected to Supabase Cloud instance');
      } catch (err) {
        console.warn('[API] Could not initialize Supabase client:', err);
      }
    }
  }

  async function httpRequest(endpoint, options = {}) {
    const url = `${window.CABSSA_CONFIG.API_BASE_URL}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        cache: 'no-store'
      });
    } catch (networkErr) {
      throw new Error(`Network failure: Unable to reach backend server at ${url}. Please verify the server is running.`);
    }

    let payload;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch (e) {
        payload = null;
      }
    } else {
      payload = await response.text();
    }

    if (!response.ok) {
      const errorMsg = (payload && payload.error && payload.error.message) || 
                       (payload && payload.message) || 
                       (typeof payload === 'string' && payload) || 
                       `Server responded with error status ${response.status} (${response.statusText})`;
      const err = new Error(errorMsg);
      err.statusCode = response.status;
      err.details = payload && payload.error ? payload.error.details : null;
      throw err;
    }

    return payload;
  }

  const API = {
    get token() { return currentToken; },
    get user() { return currentUser; },
    get isSupabaseMode() { return Boolean(supabaseClient); },

    setSession(token, user) {
      currentToken = token || '';
      currentUser = user || null;
      if (token) {
        window.sessionStorage.setItem('cabssa_token', token);
        window.sessionStorage.setItem('cabssa_user', JSON.stringify(user));
      } else {
        window.sessionStorage.removeItem('cabssa_token');
        window.sessionStorage.removeItem('cabssa_user');
      }
    },

    clearSession() {
      this.setSession(null, null);
    },

    // ------------------------------------------------------------------------
    // HEALTH & DIAGNOSTICS
    // ------------------------------------------------------------------------
    async getHealth() {
      return httpRequest('/api/health');
    },

    async getConfig() {
      return httpRequest('/api/config');
    },

    async updateConfig(config) {
      return httpRequest('/api/config', {
        method: 'POST',
        body: JSON.stringify(config)
      });
    },

    // ------------------------------------------------------------------------
    // AUTHENTICATION & SETUP
    // ------------------------------------------------------------------------
    async getSetupStatus() {
      return httpRequest('/api/auth/setup-status');
    },

    async setupAdmin(adminData) {
      const payload = await httpRequest('/api/auth/setup-admin', {
        method: 'POST',
        body: JSON.stringify(adminData)
      });
      if (payload.success && payload.token) {
        this.setSession(payload.token, payload.user);
      }
      return payload;
    },

    async login(emailOrPrn, password) {
      const payload = await httpRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrPrn, password })
      });
      if (payload.success && payload.token) {
        this.setSession(payload.token, payload.user);
      }
      return payload;
    },

    async getCurrentUser() {
      if (!currentToken) return null;
      try {
        const payload = await httpRequest('/api/auth/me');
        if (payload.success && payload.user) {
          currentUser = payload.user;
          window.sessionStorage.setItem('cabssa_user', JSON.stringify(currentUser));
          return currentUser;
        }
      } catch (e) {
        this.clearSession();
      }
      return null;
    },

    async logout() {
      try {
        await httpRequest('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      this.clearSession();
    },

    // ------------------------------------------------------------------------
    // DOMAINS
    // ------------------------------------------------------------------------
    async getDomains() {
      const res = await httpRequest('/api/domains');
      return res.data || [];
    },

    // ------------------------------------------------------------------------
    // MEMBERS (HIGHEST PRIORITY)
    // ------------------------------------------------------------------------
    async getMembers(filters = {}) {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.domain) params.set('domain', filters.domain);
      if (filters.designation) params.set('designation', filters.designation);
      if (filters.academic_year) params.set('academic_year', filters.academic_year);
      if (filters.division) params.set('division', filters.division);
      if (filters.status) params.set('status', filters.status);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await httpRequest(`/api/members${qs}`);
      return res.data || [];
    },

    async getMemberById(id) {
      const res = await httpRequest(`/api/members/${encodeURIComponent(id)}`);
      return res.data;
    },

    async createMember(memberData) {
      return httpRequest('/api/members', {
        method: 'POST',
        body: JSON.stringify(memberData)
      });
    },

    async updateMember(id, patchData) {
      return httpRequest(`/api/members/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patchData)
      });
    },

    async deleteMember(id, permanent = false) {
      return httpRequest(`/api/members/${encodeURIComponent(id)}?permanent=${permanent ? 'true' : 'false'}`, {
        method: 'DELETE'
      });
    },

    async importMembersCSV(csvText) {
      return httpRequest('/api/members/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvText })
      });
    },

    getMemberExportCSVUrl() {
      return `${window.CABSSA_CONFIG.API_BASE_URL}/api/members/export-csv`;
    },

    // ------------------------------------------------------------------------
    // PHOTO UPLOAD
    // ------------------------------------------------------------------------
    async uploadPhoto(base64Data, filename) {
      return httpRequest('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ base64Data, filename })
      });
    },

    // ------------------------------------------------------------------------
    // EVENTS & DUTIES
    // ------------------------------------------------------------------------
    async getEvents() {
      const res = await httpRequest('/api/events');
      return res.data || [];
    },

    async createEvent(eventData) {
      return httpRequest('/api/events', {
        method: 'POST',
        body: JSON.stringify(eventData)
      });
    },

    async updateEvent(id, eventData) {
      return httpRequest(`/api/events/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(eventData)
      });
    },

    async deleteEvent(id) {
      return httpRequest(`/api/events/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    },

    async assignDuty(eventId, memberId, dutyResponsibility) {
      return httpRequest(`/api/events/${encodeURIComponent(eventId)}/duties`, {
        method: 'POST',
        body: JSON.stringify({
          member_id: memberId,
          duty_responsibility: dutyResponsibility
        })
      });
    },

    async removeDuty(eventId, dutyOrMemberId) {
      return httpRequest(`/api/events/${encodeURIComponent(eventId)}/duties/${encodeURIComponent(dutyOrMemberId)}`, {
        method: 'DELETE'
      });
    },

    // ------------------------------------------------------------------------
    // ATTENDANCE & REVERSE QR
    // ------------------------------------------------------------------------
    async getAttendance(eventId = null, memberId = null) {
      const params = new URLSearchParams();
      if (eventId) params.set('event_id', eventId);
      if (memberId) params.set('member_id', memberId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await httpRequest(`/api/attendance${qs}`);
      return res.data || [];
    },

    async createQRSession(eventId, validityMinutes = 60) {
      return httpRequest('/api/attendance/qr/create', {
        method: 'POST',
        body: JSON.stringify({
          event_id: eventId,
          validity_minutes: validityMinutes
        })
      });
    },

    async scanQR(token) {
      return httpRequest('/api/attendance/qr/scan', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
    },

    async manualMarkAttendance(eventId, memberId, status = 'Present') {
      return httpRequest('/api/attendance/manual-mark', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, member_id: memberId, status })
      });
    },

    // ------------------------------------------------------------------------
    // MEETINGS & MoM
    // ------------------------------------------------------------------------
    async getMeetings() {
      const res = await httpRequest('/api/meetings');
      return res.data || [];
    },

    async createMeeting(meetingData) {
      return httpRequest('/api/meetings', {
        method: 'POST',
        body: JSON.stringify(meetingData)
      });
    },

    // ------------------------------------------------------------------------
    // ACTION ITEMS & TASKS
    // ------------------------------------------------------------------------
    async getTasks(filters = {}) {
      const params = new URLSearchParams();
      if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await httpRequest(`/api/tasks${qs}`);
      return res.data || [];
    },

    async createTask(taskData) {
      return httpRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
    },

    async updateTaskStatus(taskId, status) {
      return httpRequest(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },

    // ------------------------------------------------------------------------
    // REPORTS & AUDIT LOGS
    // ------------------------------------------------------------------------
    async getReportsSummary() {
      const res = await httpRequest('/api/reports/summary');
      return res.data || {};
    },

    async getActivityLogs() {
      const res = await httpRequest('/api/activity-logs');
      return res.data || [];
    }
  };

  initSupabaseIfConfigured();
  window.CABSSA_API = API;
})();
