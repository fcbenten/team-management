/**
 * ==========================================
 * 📅 CalendarService
 * ==========================================
 * Google Calendar API（CalendarApp および Calendar API v3）の操作を担当するクラス。
 */
class CalendarService {
  
  /**
   * チーム共有カレンダーオブジェクトを取得
   * @returns {GoogleAppsScript.Calendar.Calendar}
   */
  static getTeamCalendar() {
    return CalendarApp.getCalendarById(Config.CALENDAR_ID);
  }

  /**
   * ユーザーのプライマリカレンダーオブジェクトを取得
   * @returns {GoogleAppsScript.Calendar.Calendar}
   */
  static getPrimaryCalendar() {
    return CalendarApp.getDefaultCalendar();
  }

  /**
   * 指定したカレンダーの特定期間のイベントを取得する
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {GoogleAppsScript.Calendar.CalendarEvent[]}
   */
  static getEvents(startDate, endDate) {
    const calendar = this.getTeamCalendar();
    if (!calendar) return [];
    return calendar.getEvents(startDate, endDate);
  }

  /**
   * イベントのIDからクリーンなID（@以降を除外したID）を取得する
   * @param {string} rawId 
   * @returns {string}
   */
  static getCleanEventId(rawId) {
    return String(rawId || '').split('@')[0];
  }

  /**
   * Advanced Calendar API (v3) を使って、指定したカレンダーの出席者をパッチ更新する
   * @param {string} calendarId 
   * @param {string} eventId 
   * @param {string} userEmail 
   * @param {string} userName 
   * @param {string} targetResponseStatus 'accepted' | 'declined' | 'tentative'
   */
  static patchEventAttendance(calendarId, eventId, userEmail, userName, targetResponseStatus) {
    try {
      const cleanId = this.getCleanEventId(eventId);
      const calEv = Calendar.Events.get(calendarId, cleanId);
      
      if (!calEv) return false;
      
      let attendees = calEv.attendees ? [...calEv.attendees] : [];
      let found = false;
      
      for (let i = 0; i < attendees.length; i++) {
        if (attendees[i].email && attendees[i].email.toLowerCase() === userEmail.toLowerCase()) {
          attendees[i].responseStatus = targetResponseStatus;
          found = true;
          break;
        }
      }
      
      if (!found && userEmail) {
        attendees.push({
          email: userEmail,
          displayName: userName || userEmail,
          responseStatus: targetResponseStatus
        });
      }
      
      Calendar.Events.patch({ attendees: attendees }, calendarId, cleanId, { sendUpdates: 'none' });
      return true;
    } catch (err) {
      SystemLogger.error(`Calendar patch error for ${calendarId}: ${err.toString()}`);
      return false;
    }
  }

  /**
   * Google OAuth2 認証URLを生成する
   * @param {string} email 部員のメールアドレス
   * @returns {string} 認証URL
   */
  static generateOAuthAuthUrl(email) {
    const clientId = Config.OAUTH.CLIENT_ID;
    const redirectUri = Config.OAUTH.REDIRECT_URI;
    const scopes = Config.OAUTH.SCOPES.join(' ');
    const state = encodeURIComponent(email || '');
    const cleanEmail = String(email || '').trim();

    const params = [
      'client_id=' + encodeURIComponent(clientId),
      'redirect_uri=' + encodeURIComponent(redirectUri),
      'response_type=code',
      'scope=' + encodeURIComponent(scopes),
      'access_type=offline',
      'prompt=select_account consent',
      'state=' + state
    ];

    // 入力されたメールアドレスでGoogleログインを固定（アカウント選択ミスを防止）
    if (cleanEmail) {
      params.push('login_hint=' + encodeURIComponent(cleanEmail));
    }

    return Config.OAUTH.AUTH_URI + '?' + params.join('&');
  }

  /**
   * 認証コード (code) からリフレッシュトークンを取得し、実際のユーザー情報を取得して名簿と照合する
   * @param {string} code 
   * @returns {Object} { success, email, name, error }
   */
  static exchangeCodeForRefreshToken(code, customRedirectUri) {
    try {
      const redirectUri = customRedirectUri || Config.OAUTH.REDIRECT_URI || Config.PWA_URL;
      const payload = {
        code: code,
        client_id: Config.OAUTH.CLIENT_ID,
        client_secret: Config.OAUTH.CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      };

      const response = UrlFetchApp.fetch(Config.OAUTH.TOKEN_URI, {
        method: 'post',
        payload: payload,
        muteHttpExceptions: true
      });

      const resText = response.getContentText();
      const json = JSON.parse(resText);

      if (json.access_token) {
        // 1. Google OAuth2 UserInfo APIを叩いて、認証したユーザーの実際のメールアドレスを取得する
        const userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
        const userResponse = UrlFetchApp.fetch(userInfoUrl, {
          headers: { Authorization: `Bearer ${json.access_token}` },
          muteHttpExceptions: true
        });
        
        const userJson = JSON.parse(userResponse.getContentText());
        const authenticatedEmail = userJson.email;
        
        if (!authenticatedEmail) {
           return { success: false, error: 'Googleアカウント情報の取得に失敗しました。' };
        }
        
        const cleanEmail = authenticatedEmail.toLowerCase();
        
        // 2. Supabase の部員名簿と照合する
        const member = GasSupabaseService.getMemberByEmail(cleanEmail);
        
        if (!member || !member.name) {
          // パターンBエラー：Googleアカウントはあるが部員名簿に登録されていない
          return { success: false, error: 'NOT_IN_ROSTER', email: cleanEmail };
        }

        const memberName = member.name;

        // 3. 名簿に存在する場合、リフレッシュトークンを Supabase に保存
        if (json.refresh_token) {
          try {
            GasSupabaseService.saveMemberToken(cleanEmail, json.refresh_token);
          } catch (supErr) {
            SystemLogger.warn('Supabase token save error: ' + supErr.toString());
          }
        }
        
        const hasPw = Boolean(member.password_hash);
        return {
          success: true,
          email: cleanEmail,
          name: memberName,
          hasPassword: hasPw,
          user: {
            id: member.member_id,
            name: memberName,
            email: cleanEmail,
            role: member.role || '選手',
            number: member.number || '',
            hasCalendarLink: true
          }
        };
      } else {
        SystemLogger.error('Token exchange error response: ' + resText);
        return { success: false, error: json.error_description || json.error || 'トークンの取得に失敗しました' };
      }
    } catch (e) {
      SystemLogger.error('exchangeCodeForRefreshToken error: ' + e.toString());
      return { success: false, error: e.toString() };
    }
  }

  /**
   * リフレッシュトークンを使って一時アクセストークンを取得
   * @param {string} refreshToken 
   * @returns {string|null}
   */
  static getAccessTokenFromRefreshToken(refreshToken) {
    if (!refreshToken) return null;
    try {
      const clientId = Config.OAUTH.CLIENT_ID;
      const clientSecret = Config.OAUTH.CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        SystemLogger.info('OAUTH.CLIENT_ID or CLIENT_SECRET is not configured.');
        return null;
      }

      const payload = {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      };

      const response = UrlFetchApp.fetch(Config.OAUTH.TOKEN_URI, {
        method: 'post',
        payload: payload,
        muteHttpExceptions: true
      });

      const resText = response.getContentText();
      const json = JSON.parse(resText);

      if (json.access_token) {
        return json.access_token;
      } else {
        SystemLogger.info('Failed to refresh access token: ' + resText);
        return null;
      }
    } catch (e) {
      SystemLogger.error('getAccessTokenFromRefreshToken error: ' + e.toString());
      return null;
    }
  }

  /**
   * リフレッシュトークンを使って、部員個人のGoogleカレンダー（primary）の出欠ステータスを更新する
   * @param {string} refreshToken 
   * @param {string} eventId 
   * @param {string} userEmail
   * @param {string} status 'yes' | 'no' | 'maybe'
   * @returns {boolean}
   */
  static updateMemberCalendarAttendanceViaToken(refreshToken, eventId, userEmail, status) {
    if (!refreshToken || !eventId || !userEmail) return false;

    try {
      const accessToken = this.getAccessTokenFromRefreshToken(refreshToken);
      if (!accessToken) return false;

      const cleanId = this.getCleanEventId(eventId);
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${cleanId}`;
      
      // 1. GET request to fetch the existing attendees array
      const getOptions = {
        method: 'get',
        headers: { Authorization: `Bearer ${accessToken}` },
        muteHttpExceptions: true
      };
      
      const getResp = UrlFetchApp.fetch(url, getOptions);
      if (getResp.getResponseCode() !== 200) {
        SystemLogger.error(`[CalendarSync] GET Event failed for ${cleanId}. Status: ${getResp.getResponseCode()} Response: ${getResp.getContentText()}`);
        return false;
      }
      
      const eventData = JSON.parse(getResp.getContentText());
      let attendees = eventData.attendees || [];
      let found = false;
      
      SystemLogger.info(`[CalendarSync] GET Event success for ${cleanId}. Found ${attendees.length} attendees.`);
      
      const targetResponse = (status === 'yes' ? 'accepted' : (status === 'no' ? 'declined' : 'tentative'));
      
      for (let i = 0; i < attendees.length; i++) {
        if (attendees[i].self || (attendees[i].email && attendees[i].email.toLowerCase() === userEmail.toLowerCase())) {
          attendees[i].responseStatus = targetResponse;
          found = true;
          break;
        }
      }
      
      if (!found) {
        attendees.push({
          email: userEmail,
          responseStatus: targetResponse
        });
      }

      // 2. PATCH request with the updated attendees array
      const patchBody = {
        attendees: attendees
      };

      const patchOptions = {
        method: 'patch',
        contentType: 'application/json',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        payload: JSON.stringify(patchBody),
        muteHttpExceptions: true
      };

      const patchResp = UrlFetchApp.fetch(url, patchOptions);
      if (patchResp.getResponseCode() >= 200 && patchResp.getResponseCode() < 300) {
        SystemLogger.info(`[CalendarSync] PATCH Event success for ${cleanId}. Updated ${userEmail} to ${targetResponse}.`);
        return true;
      } else {
        SystemLogger.error(`[CalendarSync] PATCH Event failed for ${cleanId}. Status: ${patchResp.getResponseCode()} Response: ${patchResp.getContentText()}`);
        return false;
      }
    } catch (e) {
      SystemLogger.error(`[CalendarSync] Error in updateMemberCalendarAttendanceViaToken`, e);
      return false;
    }
  }
}
