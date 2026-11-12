/**
 * ==========================================
 * ⚡ SupabaseService (GAS サーバーサイド)
 * ==========================================
 * GAS から Supabase REST API と直接通信し、メンバー情報・OAuthトークン・カレンダー同期を行う
 */
class GasSupabaseService {

  /**
   * Supabase REST API のリクエストヘッダーを取得
   */
  static getHeaders() {
    return {
      'apikey': Config.SUPABASE.ANON_KEY,
      'Authorization': 'Bearer ' + Config.SUPABASE.ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  /**
   * 部員のリフレッシュトークンを Supabase に保存する
   * @param {string} email
   * @param {string} refreshToken
   * @returns {boolean}
   */
  static saveMemberToken(email, refreshToken) {
    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !refreshToken) return false;

      const url = `${Config.SUPABASE.URL}/rest/v1/members?email=eq.${encodeURIComponent(cleanEmail)}`;
      const payload = {
        token: refreshToken,
        linked_at: new Date().toISOString()
      };

      const res = UrlFetchApp.fetch(url, {
        method: 'patch',
        headers: this.getHeaders(),
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const code = res.getResponseCode();
      if (code >= 200 && code < 300) {
        SystemLogger.info(`[SupabaseService] Successfully saved token for ${cleanEmail}`);
        return true;
      } else {
        SystemLogger.error(`[SupabaseService] Failed to save token for ${cleanEmail}: ${res.getContentText()}`);
        return false;
      }
    } catch (e) {
      SystemLogger.error('[SupabaseService] Error in saveMemberToken: ' + e.toString());
      return false;
    }
  }

  /**
   * 部員のリフレッシュトークンを Supabase から取得
   * @param {string} email
   * @returns {string|null}
   */
  static getMemberToken(email) {
    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) return null;

      const url = `${Config.SUPABASE.URL}/rest/v1/members?email=eq.${encodeURIComponent(cleanEmail)}&select=token`;
      const res = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: this.getHeaders(),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() === 200) {
        const rows = JSON.parse(res.getContentText());
        if (rows && rows.length > 0 && rows[0].token) {
          return rows[0].token;
        }
      }
    } catch (e) {
      SystemLogger.error('[SupabaseService] Error in getMemberToken: ' + e.toString());
    }
    return null;
  }

  /**
   * メールアドレスから部員情報を1件取得
   * @param {string} email
   * @returns {Object|null} { member_id, name, email, token, password_hash, role, number }
   */
  static getMemberByEmail(email) {
    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) return null;

      const url = `${Config.SUPABASE.URL}/rest/v1/members?email=eq.${encodeURIComponent(cleanEmail)}&select=member_id,name,number,role,position,email,token,password_hash`;
      const res = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: this.getHeaders(),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() === 200) {
        const rows = JSON.parse(res.getContentText());
        if (rows && rows.length > 0) {
          return rows[0];
        }
      }
    } catch (e) {
      SystemLogger.error('[SupabaseService] Error in getMemberByEmail: ' + e.toString());
    }
    return null;
  }

  /**
   * 全部員の一覧を取得
   * @returns {Array<Object>}
   */
  static getAllMembers() {
    try {
      const url = `${Config.SUPABASE.URL}/rest/v1/members?select=member_id,name,number,role,position,email,token,password_hash&order=number.asc`;
      const res = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: this.getHeaders(),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() === 200) {
        return JSON.parse(res.getContentText()) || [];
      }
    } catch (e) {
      SystemLogger.error('[SupabaseService] Error in getAllMembers: ' + e.toString());
    }
    return [];
  }

  /**
   * Googleカレンダー出欠照合用: { [email]: name } のマッピングマップを取得
   * @returns {Object}
   */
  static getMemberMap() {
    const memberMap = {};
    try {
      const members = this.getAllMembers();
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const email = String(m.email || '').trim().toLowerCase();
        const name = String(m.name || '').trim();
        if (email && name) {
          memberMap[email] = name;
        }
      }
    } catch (e) {
      SystemLogger.error('[SupabaseService] Error in getMemberMap: ' + e.toString());
    }
    return memberMap;
  }
}
