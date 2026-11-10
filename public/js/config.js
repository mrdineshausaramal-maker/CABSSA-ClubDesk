/**
 * CABSSA Clubdesk — Client Configuration
 * Connected to live production Supabase PostgreSQL Cloud instance
 */
window.CABSSA_CONFIG = {
  // Remote Supabase credentials (connected to production Supabase database)
  SUPABASE_URL: window.localStorage.getItem('cabssa_supabase_url') || 'https://aymezeqrpsoivyldmbji.supabase.co',
  SUPABASE_ANON_KEY: window.localStorage.getItem('cabssa_supabase_anon_key') || 'sb_publishable_9sO-YXyZccBgNZMmVm7pKA_E8qnLlEQ',
  
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
