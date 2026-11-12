/**
 * ==========================================
 * 🔐 api_auth.js
 * ==========================================
 * Google OAuth2 認証・カレンダー認可コード交換用 API 関数群
 */

/**
 * Google OAuth2 認証URLを取得するAPI
 * @param {string} email
 * @returns {Object} { success, authUrl }
 */
function apiGetOAuthAuthUrl(email) {
  try {
    const authUrl = CalendarService.generateOAuthAuthUrl(email);
    return { success: true, authUrl: authUrl };
  } catch (e) {
    SystemLogger.error('Error in apiGetOAuthAuthUrl: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * PWAからのGoogle OAuth認可コード交換API
 * @param {string} code 認可コード
 * @param {string} [redirectUri] リダイレクトURI
 * @returns {Object} { success, email, name, error }
 */
function apiExchangeOAuthCode(code, redirectUri) {
  try {
    return CalendarService.exchangeCodeForRefreshToken(code, redirectUri);
  } catch (e) {
    SystemLogger.error('Error in apiExchangeOAuthCode: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}
