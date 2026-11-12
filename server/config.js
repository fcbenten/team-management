/**
 * ==========================================
 * 共通設定情報 (Config)
 * ==========================================
 * バックエンド API（カレンダー・OAuth・Supabase）で使用する設定値
 */
const Config = {
  // Google カレンダー関連
  CALENDAR_ID: 'fc.benten.tokyo@gmail.com',                      // チーム共有カレンダー
  TEAM_EMAIL: 'fc.benten.tokyo@gmail.com',                       // チーム共有Googleアカウント
  
  // システムログ関連
  LOG_FOLDER_ID: '19cbMnUctqRCfp1ZyJd_d2wM1S6o8i1CM', // チームアカウントの共有フォルダID

  // Google OAuth2 連携設定 (機密情報は GAS Script Properties から安全に取得)
  OAUTH: {
    get CLIENT_ID() {
      return (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties().getProperty('OAUTH_CLIENT_ID')) || '';
    },
    get CLIENT_SECRET() {
      return (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties().getProperty('OAUTH_CLIENT_SECRET')) || '';
    },
    REDIRECT_URI: 'https://fcbenten.github.io/team-management/',
    AUTH_URI: 'https://accounts.google.com/o/oauth2/v2/auth',
    TOKEN_URI: 'https://oauth2.googleapis.com/token',
    SCOPES: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  },

  // 本番PWA (GitHub Pages) URL
  PWA_URL: 'https://fcbenten.github.io/team-management/',

  // Supabase 設定
  SUPABASE: {
    URL: 'https://pkufnywvnuicragvobaq.supabase.co',
    ANON_KEY: 'sb_publishable_Ryi3mETQr8QfgwSGyAcD-A_fiQe_abr'
  }
};
