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

  /**
   * 現役の「代表」メンバー一覧と通知設定を取得する
   * @returns {Array<Object>}
   */
  static getRepresentatives() {
    try {
      const url = `${Config.SUPABASE.URL}/rest/v1/members?role=eq.${encodeURIComponent('代表')}&is_past=eq.false&select=member_id,notification_type,line_user_id,push_subscription`;
      const res = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: this.getHeaders(),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        return JSON.parse(res.getContentText()) || [];
      }
    } catch (e) {
      console.warn('[SupabaseService] Failed to fetch representatives:', e);
    }
    return [];
  }

  /**
   * LINE通知連携済みの「代表」メンバーID一覧を取得する
   * @returns {Array<string>}
   */
  static getRepresentativeMemberIds() {
    return this.getRepresentatives()
      .filter(r => r.line_user_id && String(r.line_user_id).trim() !== '')
      .map(r => r.member_id)
      .filter(Boolean);
  }

  /**
   * GAS 側システムエラーを Supabase (system_error_logs) へ記録し、管理ルールと個人通知設定に従って代表へ通知する
   * @param {string} message
   * @param {Error|null} errObj
   */
  static reportSystemError(message, errObj = null) {
    if (this._isReportingError) return;
    this._isReportingError = true;

    try {
      const rawMsg = String(message || 'GAS システムエラー');
      const stackText = errObj ? `${errObj.toString()}\n${errObj.stack || ''}` : '';

      // 同一エラーの5分間クールダウン（通知連投防止）
      let onCooldown = false;
      try {
        const cache = CacheService.getScriptCache();
        const keySeed = rawMsg.slice(0, 60).replace(/[^a-zA-Z0-9\u3040-\u9faf]/g, '_');
        const cacheKey = `sys_err_cd_${keySeed}`;
        if (cache.get(cacheKey)) {
          onCooldown = true;
        } else {
          cache.put(cacheKey, '1', 300);
        }
      } catch (cacheErr) {}

      let notified = false;
      let ruleAllowsAnnouncement = true;
      let ruleAllowsExternal = true;
      try {
        const ruleUrl = `${Config.SUPABASE.URL}/rest/v1/notification_rules?rule_key=eq.system_error_alert&select=announcement_enabled,external_enabled`;
        const ruleRes = UrlFetchApp.fetch(ruleUrl, {
          method: 'get',
          headers: this.getHeaders(),
          muteHttpExceptions: true
        });
        if (ruleRes.getResponseCode() === 200) {
          const rRows = JSON.parse(ruleRes.getContentText()) || [];
          if (rRows[0]) {
            if (rRows[0].announcement_enabled === false) {
              ruleAllowsAnnouncement = false;
            }
            if (rRows[0].external_enabled === false) {
              ruleAllowsExternal = false;
            }
          }
        }
      } catch (ruleErr) {}

      if (!onCooldown && (ruleAllowsAnnouncement || ruleAllowsExternal)) {
        const reps = this.getRepresentatives();
        if (reps.length > 0) {
          const title = '【システムエラー (GAS)】';
          const body = `内容: ${rawMsg.slice(0, 180)}`;

          if (ruleAllowsAnnouncement) {
            const nowTs = Date.now();
            const annRows = reps
              .filter(r => Boolean(r.member_id))
              .map((r, idx) => ({
                announcement_id: `ANN-GASERR-${nowTs}-${idx}-${Math.floor(100 + Math.random() * 900)}`,
                rule_key: 'system_error_alert',
                title: title,
                body: body,
                target_tab: 'notifications',
                target_member_id: r.member_id,
                actor_member_id: null
              }));
            if (annRows.length > 0) {
              try {
                UrlFetchApp.fetch(`${Config.SUPABASE.URL}/rest/v1/announcements`, {
                  method: 'post',
                  headers: this.getHeaders(),
                  payload: JSON.stringify(annRows),
                  muteHttpExceptions: true
                });
              } catch (annErr) {
                console.warn('[SupabaseService] Announcement insert failed:', annErr);
              }
            }
          }

          if (ruleAllowsAnnouncement && ruleAllowsExternal) {
            const lineTargets = [];
            const pushTargets = [];
            reps.forEach(r => {
              if (!r.member_id) return;
              const nType = String(r.notification_type || 'none').toLowerCase();
              if (nType === 'none') return;
              if ((nType === 'line' || nType === 'both') && r.line_user_id) {
                lineTargets.push(r.member_id);
              }
              if ((nType === 'push' || nType === 'both') && r.push_subscription) {
                pushTargets.push(r.member_id);
              }
            });

            const edgeHeaders = {
              'Content-Type': 'application/json',
              'apikey': Config.SUPABASE.ANON_KEY,
              'Authorization': 'Bearer ' + Config.SUPABASE.ANON_KEY
            };

            if (lineTargets.length > 0) {
              try {
                const basePwaUrl = String(Config.PWA_URL || '');
                const extAppUrl = basePwaUrl.includes('openExternalBrowser=1')
                  ? basePwaUrl
                  : basePwaUrl + (basePwaUrl.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
                const lineRes = UrlFetchApp.fetch(`${Config.SUPABASE.URL}/functions/v1/send-line-push`, {
                  method: 'post',
                  headers: edgeHeaders,
                  payload: JSON.stringify({
                    memberIds: lineTargets,
                    title: title,
                    body: body,
                    appUrl: extAppUrl
                  }),
                  muteHttpExceptions: true
                });
                if (lineRes.getResponseCode() >= 200 && lineRes.getResponseCode() < 300) {
                  notified = true;
                }
              } catch (lineErr) {
                console.warn('[SupabaseService] LINE push failed:', lineErr);
              }
            }

            if (pushTargets.length > 0) {
              try {
                const pushRes = UrlFetchApp.fetch(`${Config.SUPABASE.URL}/functions/v1/send-web-push`, {
                  method: 'post',
                  headers: edgeHeaders,
                  payload: JSON.stringify({
                    memberIds: pushTargets,
                    title: title,
                    body: body,
                    url: './#notifications',
                    tag: 'fcb-system-error-alert'
                  }),
                  muteHttpExceptions: true
                });
                if (pushRes.getResponseCode() >= 200 && pushRes.getResponseCode() < 300) {
                  notified = true;
                }
              } catch (pushErr) {
                console.warn('[SupabaseService] Web push failed:', pushErr);
              }
            }
          }
        }
      }

      const logUrl = `${Config.SUPABASE.URL}/rest/v1/system_error_logs`;
      const logPayload = {
        log_id: `ERR-GAS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        source: 'GAS',
        screen: 'GAS Backend',
        action_name: rawMsg.split(':')[0].slice(0, 100),
        error_message: rawMsg.slice(0, 2000),
        stack_trace: stackText ? stackText.slice(0, 4000) : null,
        line_notified: notified
      };
      UrlFetchApp.fetch(logUrl, {
        method: 'post',
        headers: this.getHeaders(),
        payload: JSON.stringify(logPayload),
        muteHttpExceptions: true
      });
    } catch (reportErr) {
      console.warn('[SupabaseService] reportSystemError failed safely:', reportErr);
    } finally {
      this._isReportingError = false;
    }
  }
}
