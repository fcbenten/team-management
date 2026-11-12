/**
 * ==========================================
 * 📝 SystemLogger
 * ==========================================
 * GGC (Google Cloud) の Cloud Logging (旧Stackdriver Logging) へ
 * 出力を集約するための簡易ラッパークラスです。
 * DriveAppやMailAppのスコープを不要にするため、標準のconsoleのみを使用します。
 */
class SystemLogger {

  /**
   * INFOレベルのログ出力
   * @param {string} message 
   */
  static info(message) {
    console.log(`[INFO] ${message}`);
  }

  /**
   * WARNレベルのログ出力
   * @param {string} message 
   */
  static warn(message) {
    console.warn(`[WARN] ${message}`);
  }

  /**
   * ERRORレベルのログ出力
   * @param {string} message 
   * @param {Error|null} errObj 
   */
  static error(message, errObj = null) {
    const fullMessage = errObj 
      ? `[ERROR] ${message} | Error: ${errObj.toString()}\nStack: ${errObj.stack || ''}` 
      : `[ERROR] ${message}`;
    
    console.error(fullMessage);
  }
}
