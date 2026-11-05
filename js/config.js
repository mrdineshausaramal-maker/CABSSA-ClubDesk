/**
 * CABSSA Clubdesk — Client Configuration
 * Supports dual-mode: Real Supabase Cloud or Local Full-Stack Node Engine
 */
window.CABSSA_CONFIG = {
  // Remote Supabase credentials (optional - configure via Settings UI or directly here)
  SUPABASE_URL: window.localStorage.getItem('cabssa_supabase_url') || '',
  SUPABASE_ANON_KEY: window.localStorage.getItem('cabssa_supabase_anon_key') || '',
  
  // Local Backend API base URL (empty string for same-origin)
  API_BASE_URL: '',
  
  // App Metadata
  APP_NAME: 'CABSSA Clubdesk',
  ASSOCIATION_NAME: 'Computer Applications & Business Studies Student Association',
  VERSION: '2.5.0-PROD',
  ACADEMIC_YEAR: '2026-2027',

  get isSupabaseActive() {
    return Boolean(this.SUPABASE_URL && this.SUPABASE_ANON_KEY);
  }
};
