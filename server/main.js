// ==========================================
// main.js (Entry Point & Utilities)
// ==========================================
// Google カレンダー同期 ＆ OAuth トークン交換用 バックエンド API

/**
 * Web API 初期エンドポイント (GET)
 * APIアクションの処理、またはステータス情報の返却
 */
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    const clearCache = e && e.parameter && e.parameter.clearCache;
    if (clearCache) {
      try { clearAppCache(); } catch(err) {}
    }

    // Google カレンダーのイベント一覧取得アクション
    if (action === 'getEvents') {
      const memberMap = GasSupabaseService.getMemberMap();
      const events = getCalendarEvents(memberMap);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        events: events
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 直接アクセスされた場合は API ステータスおよび PWA 案内を JSON で返却
    return ContentService.createTextOutput(JSON.stringify({
      status: 'active',
      service: 'FC Benten Backend API',
      pwaUrl: Config.PWA_URL,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (fatalErr) {
    SystemLogger.error('Fatal error in doGet: ' + fatalErr.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: fatalErr.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Web API エンドポイント (POST)
 * PWAからの google.script.run 互換 RPC リクエストを処理
 * 
 * @param {Object} e - POSTリクエストイベント
 * @returns {TextOutput} JSONレスポンス
 */
function doPost(e) {
  try {
    let postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }
    const functionName = postData.functionName;
    const args = Array.isArray(postData.args) ? postData.args : [];

    if (!functionName || typeof functionName !== 'string') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: '関数名が指定されていません。'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // グローバルスコープの関数を探して実行
    const targetFunc = (typeof this[functionName] === 'function') ? this[functionName] : (typeof globalThis !== 'undefined' ? globalThis[functionName] : null);
    if (typeof targetFunc === 'function') {
      const result = targetFunc.apply(null, args);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: result
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: `関数 ${functionName} が見つかりません。`
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    SystemLogger.error('Error in doPost: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * キャッシュを完全に破棄する
 * 
 * @param {string} [key] - キャッシュキー
 */
function clearAppCache(key) {
  try {
    const cache = CacheService.getScriptCache();
    const legacyKeys = [
      'appSheetsCache_v1', 'appSheetsCache_v2', 'appSheetsCache_v4',
      'appInitialData', 'appInitialData_v2', 'appInitialData_v3', 'appInitialData_v4', 'appInitialData_v5'
    ];
    if (key) legacyKeys.push(key);
    cache.removeAll(legacyKeys);
  } catch (e) {
    SystemLogger.error('clearAppCache error: ' + e.toString());
  }
}
