/**
 * 人物の名前を正規化（全角・半角スペースを除去して比較用にする）
 */
function normalizePersonName(name) {
  return String(name || '').replace(/[\s\u3000]+/g, '').trim().toLowerCase();
}

/**
 * イベントの説明文から過去のアプリ出欠メタデータタグを除去して純粋なテキストを返す
 */
function cleanDescriptionText(description) {
  if (!description) return '';
  return String(description)
    .replace(/\[FCB_ATTEND:[^\]]*\]/gi, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
/**
 * Calendar API v3 の予定オブジェクトから画面用イベント情報を構築
 */
function parseEventItemDetails(item, memberMap, teamCalEmail) {
  const title = item.summary || '';
  const isAllDay = !!(item.start && item.start.date && !item.start.dateTime);
  let startTime, endTime, date, timeRange, startH, endH;

  if (isAllDay) {
    date = String(item.start.date).replace(/-/g, '/');
    startTime = new Date(item.start.date + 'T00:00:00+09:00');
    endTime = new Date(item.start.date + 'T23:59:59+09:00');
    timeRange = '終日';
    startH = '09:00';
    endH = '12:00';
  } else {
    startTime = new Date(item.start.dateTime);
    endTime = new Date(item.end.dateTime);
    date = Utilities.formatDate(startTime, 'Asia/Tokyo', 'yyyy/MM/dd');
    startH = Utilities.formatDate(startTime, 'Asia/Tokyo', 'HH:mm');
    endH = Utilities.formatDate(endTime, 'Asia/Tokyo', 'HH:mm');
    timeRange = `${startH} - ${endH}`;
  }

  const location = item.location || '';
  const description = cleanDescriptionText(item.description || '');
  const googleCalendarUrl = item.htmlLink || 'https://calendar.google.com/calendar/u/0/r';

  const yesList = [];
  const noList = [];
  const maybeList = [];
  const unansweredList = [];
  const yesEmails = [];
  const noEmails = [];
  const maybeEmails = [];
  const unansweredEmails = [];

  const attendees = item.attendees || [];
  attendees.forEach(g => {
    const email = String(g.email || '').trim().toLowerCase();
    if (!email || email === teamCalEmail) return;

    let mappedName = memberMap[email] || g.displayName || email;
    if (mappedName === '私' || mappedName === 'me') {
      mappedName = memberMap[email] || (email ? email.split('@')[0] : '');
    }
    if (!mappedName) return;

    const resp = String(g.responseStatus || '').toLowerCase();
    if (resp === 'accepted') {
      if (!yesList.includes(mappedName)) yesList.push(mappedName);
      if (email && !yesEmails.includes(email)) yesEmails.push(email);
    } else if (resp === 'declined') {
      if (!noList.includes(mappedName)) noList.push(mappedName);
      if (email && !noEmails.includes(email)) noEmails.push(email);
    } else if (resp === 'tentative') {
      if (!maybeList.includes(mappedName)) maybeList.push(mappedName);
      if (email && !maybeEmails.includes(email)) maybeEmails.push(email);
    } else {
      if (!unansweredList.includes(mappedName)) unansweredList.push(mappedName);
      if (email && !unansweredEmails.includes(email)) unansweredEmails.push(email);
    }
  });

  const calendarAttended = yesList.join(', ');

  // カテゴリと対戦相手の自動判定
  let category = 'その他';
  let opponent = '';
  let isMatch = false;

  const rawTitle = String(title || '').trim();
  const titleUpper = rawTitle.toUpperCase();

  if (titleUpper.includes('公式戦') || titleUpper.includes('都リーグ') || titleUpper.includes('リーグ') || titleUpper.includes('選手権') || titleUpper.includes('カップ') || titleUpper.includes('大会')) {
    category = '公式戦';
    isMatch = true;
    opponent = rawTitle.replace(/(公式戦|都リーグ|区民大会|カップ|選手権|大会|リーグ|vs|VS|\/)/gi, '').trim();
  } else if (titleUpper.includes('TRM') || titleUpper.includes('練習試合') || titleUpper.includes(' VS ') || titleUpper.startsWith('VS ') || titleUpper.includes('VS')) {
    category = 'TRM';
    isMatch = true;
    opponent = rawTitle.replace(/(TRM|練習試合|vs|VS|\/)/gi, '').trim();
  } else if (titleUpper === 'TR' || titleUpper.startsWith('TR ') || titleUpper.endsWith(' TR') || titleUpper.includes('トレーニング') || (titleUpper.includes('練習') && !titleUpper.includes('練習試合'))) {
    category = 'TR';
    isMatch = false;
    opponent = '';
  } else if (titleUpper.includes('飲み会') || titleUpper.includes('懇親会') || titleUpper.includes('打ち上げ') || titleUpper.includes('総会') || titleUpper.includes('イベント') || titleUpper.includes('ミーティング')) {
    category = 'イベント';
    isMatch = false;
    opponent = '';
  } else {
    category = 'その他';
    isMatch = false;
    opponent = '';
  }

  const googleGuests = [];
  /**
   * ゲストのメール・名前配列と回答ステータスを受け取り、オブジェクト配列に追加する
   * @param {Array<string>} emails - メールアドレス配列
   * @param {Array<string>} names - 表示名配列
   * @param {string} status - 参加ステータス ('YES' | 'NO' | 'MAYBE' | 'UNKNOWN')
   * @returns {void}
   */
  const addGuestData = (emails, names, status) => {
    if (!emails) return;
    for (let i = 0; i < emails.length; i++) {
      googleGuests.push({ email: emails[i], name: names[i] || '', status: status });
    }
  };
  addGuestData(yesEmails, yesList, 'YES');
  addGuestData(noEmails, noList, 'NO');
  addGuestData(maybeEmails, maybeList, 'MAYBE');
  addGuestData(unansweredEmails, unansweredList, 'UNKNOWN');

  return {
    id: item.id,
    title: title,
    date: date,
    timeRange: timeRange,
    isAllDay: isAllDay,
    startTimeStr: isAllDay ? '09:00' : startH,
    endTimeStr: isAllDay ? '12:00' : endH,
    location: location,
    description: description,
    googleCalendarUrl: googleCalendarUrl,
    category: category,
    isMatch: isMatch,
    opponent: opponent,
    calendarAttended: calendarAttended,
    attendeesDetail: {
      yes: yesList,
      no: noList,
      maybe: maybeList,
      unanswered: unansweredList,
      yesEmails: yesEmails,
      noEmails: noEmails,
      maybeEmails: maybeEmails,
      unansweredEmails: unansweredEmails
    },
    googleGuests: googleGuests
  };
}

/**
 * Googleカレンダーから直近のイベントを取得する
 * ⚡ Advanced Calendar API (v3) を優先して一括取得し、同期通信オーバーヘッドを劇的削減！
 *
 * @param {Object} [memberMap] - キャッシュされた名簿の連想配列
 * @returns {Array} カレンダーイベントのリスト
 */
function getCalendarEvents(memberMap) {
  try {
    const now = new Date();
    // ⚡ 初期読み込み高速化: 過去期間を60日→30日（1ヶ月）に短縮、未来期間は90日（3ヶ月）維持
    const startTime = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const endTime = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    memberMap = memberMap || {};
    const teamCalEmail = Config.CALENDAR_ID.toLowerCase();

    // ⚡ 高速化: Calendar API v3 (一括取得) を優先使用
    try {
      if (typeof Calendar !== 'undefined' && Calendar.Events && Calendar.Events.list) {
        const calRes = Calendar.Events.list(Config.CALENDAR_ID, {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250
        });

        if (calRes && Array.isArray(calRes.items)) {
          const result = calRes.items.map(item => parseEventItemDetails(item, memberMap, teamCalEmail));
          return result.reverse();
        }
      }
    } catch (apiErr) {
      SystemLogger.info("Calendar API v3 一括取得スキップ（CalendarAppフォールバック使用）: " + apiErr.toString());
    }

    // フォールバック: 従来の CalendarApp による個別取得
    const calendar = CalendarService.getTeamCalendar();
    const events = calendar ? calendar.getEvents(startTime, endTime) : [];
    const result = [];

    events.forEach(event => {
      const title = event.getTitle();
      const startTime = event.getStartTime();
      const endTime = event.getEndTime();
      const isAllDay = event.isAllDayEvent();
      
      const date = Utilities.formatDate(startTime, 'Asia/Tokyo', 'yyyy/MM/dd');
      const timeRange = isAllDay ? '終日' : `${Utilities.formatDate(startTime, 'Asia/Tokyo', 'HH:mm')} - ${Utilities.formatDate(endTime, 'Asia/Tokyo', 'HH:mm')}`;
      const location = event.getLocation() || '';
      let description = event.getDescription() || '';

      if (description && description.includes('[FCB_ATTEND:')) {
        try {
          const repaired = cleanDescriptionText(description);
          event.setDescription(repaired);
          description = repaired;
        } catch (repErr) {}
      }

      let googleCalendarUrl = 'https://calendar.google.com/calendar/u/0/r';
      try {
        const rawId = String(event.getId() || '').split('@')[0];
        if (rawId) {
          const eid = Utilities.base64Encode(rawId + ' ' + Config.CALENDAR_ID).replace(/=/g, '');
          googleCalendarUrl = `https://calendar.google.com/calendar/r/eventedit/${eid}`;
        }
      } catch (eidErr) {
        SystemLogger.error('eid generation error: ' + eidErr.toString());
      }
      
      const yesList = [];
      const noList = [];
      const maybeList = [];
      const unansweredList = [];
      const yesEmails = [];
      const noEmails = [];
      const maybeEmails = [];
      const unansweredEmails = [];

      try {
        const guests = event.getGuestList(true);
        guests.forEach(g => {
          const status = g.getGuestStatus();
          const email = String(g.getEmail() || '').trim().toLowerCase();
          if (!email || email === teamCalEmail) return;

          let mappedName = memberMap[email] || g.getName() || email;
          if (mappedName === '私' || mappedName === 'me') {
            mappedName = memberMap[email] || (email ? email.split('@')[0] : '');
          }
          if (!mappedName) return;

          if (status === CalendarApp.GuestStatus.YES) {
            if (!yesList.includes(mappedName)) yesList.push(mappedName);
            if (email && !yesEmails.includes(email)) yesEmails.push(email);
          } else if (status === CalendarApp.GuestStatus.NO) {
            if (!noList.includes(mappedName)) noList.push(mappedName);
            if (email && !noEmails.includes(email)) noEmails.push(email);
          } else if (status === CalendarApp.GuestStatus.MAYBE) {
            if (!maybeList.includes(mappedName)) maybeList.push(mappedName);
            if (email && !maybeEmails.includes(email)) maybeEmails.push(email);
          } else {
            if (!unansweredList.includes(mappedName)) unansweredList.push(mappedName);
            if (email && !unansweredEmails.includes(email)) unansweredEmails.push(email);
          }
        });
      } catch (guestErr) {
        SystemLogger.error('Guest list error: ' + guestErr.toString());
      }

      const calendarAttended = yesList.join(', ');

      let category = 'その他';
      let opponent = '';
      let isMatch = false;

      const rawTitle = String(title || '').trim();
      const titleUpper = rawTitle.toUpperCase();

      if (titleUpper.includes('公式戦') || titleUpper.includes('都リーグ') || titleUpper.includes('リーグ') || titleUpper.includes('選手権') || titleUpper.includes('カップ') || titleUpper.includes('大会')) {
        category = '公式戦';
        isMatch = true;
        opponent = rawTitle.replace(/(公式戦|都リーグ|区民大会|カップ|選手権|大会|リーグ|vs|VS|\/)/gi, '').trim();
      } else if (titleUpper.includes('TRM') || titleUpper.includes('練習試合') || titleUpper.includes(' VS ') || titleUpper.startsWith('VS ') || titleUpper.includes('VS')) {
        category = 'TRM';
        isMatch = true;
        opponent = rawTitle.replace(/(TRM|練習試合|vs|VS|\/)/gi, '').trim();
      } else if (titleUpper === 'TR' || titleUpper.startsWith('TR ') || titleUpper.endsWith(' TR') || titleUpper.includes('トレーニング') || (titleUpper.includes('練習') && !titleUpper.includes('練習試合'))) {
        category = 'TR';
        isMatch = false;
        opponent = '';
      } else if (titleUpper.includes('飲み会') || titleUpper.includes('懇親会') || titleUpper.includes('打ち上げ') || titleUpper.includes('総会') || titleUpper.includes('イベント') || titleUpper.includes('ミーティング')) {
        category = 'イベント';
        isMatch = false;
        opponent = '';
      } else {
        category = 'その他';
        isMatch = false;
        opponent = '';
      }

      const startH = Utilities.formatDate(startTime, 'Asia/Tokyo', 'HH:mm');
      const endH = Utilities.formatDate(endTime, 'Asia/Tokyo', 'HH:mm');
      
      const googleGuests = [];
      /**
       * ゲストのメール・名前配列と回答ステータスを受け取り、オブジェクト配列に追加する
       * @param {Array<string>} emails - メールアドレス配列
       * @param {Array<string>} names - 表示名配列
       * @param {string} status - 参加ステータス ('YES' | 'NO' | 'MAYBE' | 'UNKNOWN')
       * @returns {void}
       */
      const addGuestData = (emails, names, status) => {
        if (!emails) return;
        for (let i = 0; i < emails.length; i++) {
          googleGuests.push({ email: emails[i], name: names[i] || '', status: status });
        }
      };
      addGuestData(yesEmails, yesList, 'YES');
      addGuestData(noEmails, noList, 'NO');
      addGuestData(maybeEmails, maybeList, 'MAYBE');
      addGuestData(unansweredEmails, unansweredList, 'UNKNOWN');

      result.push({
        id: event.getId(),
        title: title,
        date: date,
        timeRange: timeRange,
        isAllDay: isAllDay,
        startTimeStr: isAllDay ? '09:00' : startH,
        endTimeStr: isAllDay ? '12:00' : endH,
        location: location,
        description: cleanDescriptionText(description),
        googleCalendarUrl: googleCalendarUrl,
        category: category,
        isMatch: isMatch,
        opponent: opponent,
        calendarAttended: calendarAttended,
        attendeesDetail: {
          yes: yesList,
          no: noList,
          maybe: maybeList,
          unanswered: unansweredList,
          yesEmails: yesEmails,
          noEmails: noEmails,
          maybeEmails: maybeEmails,
          unansweredEmails: unansweredEmails
        },
        googleGuests: googleGuests
      });
    });

    return result.reverse();
  } catch (e) {
    SystemLogger.error("Error in getCalendarEvents: " + e.toString());
    // 権限エラーなどが起きた際、画面に意図的にエラー用の予定を表示させてユーザー（開発者）に気づかせる
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return [{
      id: 'error_debug',
      title: '⚠️カレンダー取得エラー',
      date: `${yyyy}/${mm}/${dd}`,
      timeRange: '終日',
      isAllDay: true,
      startTimeStr: '00:00',
      endTimeStr: '23:59',
      location: '',
      description: '【システムエラー】\nカレンダーの取得に失敗しました。\nエラー詳細: ' + e.toString() + '\n\n【原因】\nデプロイ時のアカウント紐付けバグにより、裏側の実行者が「チームアカウント」ではなく「個人アカウント」にすり替わっている可能性が高いです。\n\n【解決策】\n・シークレットウィンドウで fc.benten.tokyo@gmail.com のみにログインした状態で開き、再度「新バージョン」としてデプロイしてください。\n・または、fc.benten.tokyo@gmail.com のカレンダー設定から個人アカウントへ閲覧権限を付与してください。',
      category: 'その他',
      isMatch: false,
      opponent: '',
      calendarAttended: '',
      attendeesDetail: { yes: [], no: [], maybe: [], unanswered: [], yesEmails: [], noEmails: [], maybeEmails: [], unansweredEmails: [] }
    }];
  }
}

/**
 * Googleカレンダーのイベントを保存（新規作成・複製・編集）する
 * 
 * @param {Object} payload - イベント情報
 * @returns {Object} 処理結果と最新のイベントリスト
 */
function saveCalendarEvent(payload) {
  try {
    const calendar = CalendarService.getTeamCalendar();
    if (!calendar) {
      return { success: false, error: 'Googleカレンダーが見つかりません。Config.CALENDAR_IDを確認してください。' };
    }

    const title = String(payload.title || '').trim();
    if (!title) {
      return { success: false, error: 'タイトルを入力してください。' };
    }

    const dateStr = String(payload.date || '').trim().replace(/-/g, '/'); // YYYY/MM/DD
    if (!dateStr) {
      return { success: false, error: '日付を入力してください。' };
    }

    const isAllDay = Boolean(payload.isAllDay);
    const startTimeStr = payload.startTime || '09:00'; // HH:mm
    const endTimeStr = payload.endTime || '12:00';     // HH:mm
    const location = String(payload.location || '').trim();
    const description = String(payload.description || '').trim();
    const guests = Array.isArray(payload.guests) ? payload.guests : [];

    const isDuplicate = Boolean(payload.isDuplicate);
    const eventId = payload.eventId ? String(payload.eventId).trim() : null;

    let event = null;

    if (!isDuplicate) {
      // 📌 編集モード: 既存の予定を確実に特定して上書き更新する
      if (eventId) {
        event = calendar.getEventById(eventId);
        if (!event && eventId.includes('@')) {
          event = calendar.getEventById(eventId.split('@')[0]);
        }
        if (!event && !eventId.includes('@')) {
          event = calendar.getEventById(eventId + '@google.com');
        }
      }

      // IDで見つからない場合、元の予定の日時とタイトルで検索
      if (!event && payload.originalDate) {
        const origParts = String(payload.originalDate).replace(/-/g, '/').split('/');
        if (origParts.length >= 3) {
          const sDay = new Date(Number(origParts[0]), Number(origParts[1]) - 1, Number(origParts[2]), 0, 0, 0);
          const eDay = new Date(Number(origParts[0]), Number(origParts[1]) - 1, Number(origParts[2]), 23, 59, 59);
          const dayEvs = calendar.getEvents(sDay, eDay);
          event = dayEvs.find(e => e.getTitle() === payload.originalTitle) || (dayEvs.length === 1 ? dayEvs[0] : null);
        }
      }

      if (!event) {
        return { success: false, error: '編集対象の既存予定がカレンダーに見つかりませんでした。画面を再読み込みして最新の予定をご確認ください。' };
      }

      // 既存予定を上書き更新
      event.setTitle(title);
      event.setLocation(location);
      event.setDescription(description);

      const parts = dateStr.split('/');
      if (isAllDay) {
        const allDayDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        event.setAllDayDate(allDayDate);
      } else {
        const sParts = startTimeStr.split(':');
        const eParts = endTimeStr.split(':');
        const startDt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(sParts[0]), Number(sParts[1]));
        const endDt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(eParts[0]), Number(eParts[1]));
        event.setTime(startDt, endDt);
      }
    } else {
      // 📌 複製（新規作成）モード: 新規に予定を作成
      const parts = dateStr.split('/');
      if (isAllDay) {
        const allDayDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        event = calendar.createAllDayEvent(title, allDayDate, {
          location: location,
          description: description
        });
      } else {
        const sParts = startTimeStr.split(':');
        const eParts = endTimeStr.split(':');
        const startDt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(sParts[0]), Number(sParts[1]));
        const endDt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(eParts[0]), Number(eParts[1]));
        event = calendar.createEvent(title, startDt, endDt, {
          location: location,
          description: description
        });
      }
    }

    // ゲスト（参加者）の追加・削除の同期
    if (event) {
      const existingGuests = event.getGuestList().map(g => g.getEmail());
      const submittedGuests = guests.map(g => String(g).trim()).filter(g => g && g.includes('@'));
      
      // 追加すべきゲスト
      const toAdd = submittedGuests.filter(g => !existingGuests.includes(g));
      // 削除すべきゲスト
      const toRemove = existingGuests.filter(g => !submittedGuests.includes(g));

      toAdd.forEach(em => {
        try {
          event.addGuest(em);
        } catch (gErr) {
          SystemLogger.error('Guest add error (' + em + '): ' + gErr.toString());
        }
      });
      
      toRemove.forEach(em => {
        try {
          event.removeGuest(em);
        } catch (gErr) {
          SystemLogger.error('Guest remove error (' + em + '): ' + gErr.toString());
        }
      });
    }

    // 🚀 キャッシュの即時破棄（分割キャッシュも含め完全消去）
    clearAppCache();

    // ⚡ 超高速化: 1件の整形済みイベントデータのみを即座に返却（重い全スキャンを完全撤廃）
    const timeRange = isAllDay ? '終日' : (startTimeStr + ' - ' + endTimeStr);
    const catCheck = String(title).toUpperCase();
    let category = 'その他';
    let isMatch = false;
    let opponent = '';

    if (catCheck.includes('公式戦') || catCheck.includes('都リーグ') || catCheck.includes('リーグ') || catCheck.includes('選手権') || catCheck.includes('カップ') || catCheck.includes('大会')) {
      category = '公式戦';
      isMatch = true;
      opponent = title.replace(/(公式戦|都リーグ|区民大会|カップ|選手権|大会|リーグ|vs|VS|\/)/gi, '').trim();
    } else if (catCheck.includes('TRM') || catCheck.includes('練習試合') || catCheck.includes(' VS ') || catCheck.startsWith('VS ') || catCheck.includes('VS')) {
      category = 'TRM';
      isMatch = true;
      opponent = title.replace(/(TRM|練習試合|vs|VS|\/)/gi, '').trim();
    } else if (catCheck === 'TR' || catCheck.startsWith('TR ') || catCheck.endsWith(' TR') || catCheck.includes('トレーニング') || (catCheck.includes('練習') && !catCheck.includes('練習試合'))) {
      category = 'TR';
    } else if (catCheck.includes('飲み会') || catCheck.includes('懇親会') || catCheck.includes('打ち上げ') || catCheck.includes('総会') || catCheck.includes('イベント')) {
      category = 'イベント';
    }

    const returnGuests = (event ? event.getGuestList() : []).map(g => ({
      email: g.getEmail(),
      name: g.getName() || '',
      status: String(g.getGuestStatus())
    }));

    const eventResult = {
      id: event ? event.getId() : (eventId || ''),
      title: title,
      date: dateStr,
      timeRange: timeRange,
      isAllDay: isAllDay,
      startTimeStr: startTimeStr,
      endTimeStr: endTimeStr,
      location: location,
      description: description,
      category: category,
      isMatch: isMatch,
      opponent: opponent,
      calendarAttended: '',
      attendeesDetail: { yes: [], no: [], maybe: [] },
      googleGuests: returnGuests,
      isRegistered: false
    };

    return {
      success: true,
      event: eventResult,
      isNew: isDuplicate,
      message: isDuplicate ? '予定を作成しました' : '予定を更新しました'
    };

  } catch (e) {
    SystemLogger.error('saveCalendarEvent Error: ' + e.toString());
    return { success: false, error: 'カレンダー保存中にエラーが発生しました: ' + e.toString() };
  }
}

/**
 * Googleカレンダーのイベントを削除する
 * 
 * @param {Object} payload - { eventId, originalDate, originalTitle }
 * @returns {Object} 処理結果
 */
function deleteCalendarEvent(payload) {
  try {
    const calendar = CalendarService.getTeamCalendar();
    if (!calendar) {
      return { success: false, error: 'Googleカレンダーが見つかりません。Config.CALENDAR_IDを確認してください。' };
    }

    const eventId = payload.eventId ? String(payload.eventId).trim() : null;
    let event = null;

    if (eventId) {
      event = calendar.getEventById(eventId);
      if (!event && eventId.includes('@')) {
        event = calendar.getEventById(eventId.split('@')[0]);
      }
      if (!event && !eventId.includes('@')) {
        event = calendar.getEventById(eventId + '@google.com');
      }
    }

    // IDで見つからない場合、元の予定の日時とタイトルで検索
    if (!event && payload.originalDate) {
      const origParts = String(payload.originalDate).replace(/-/g, '/').split('/');
      if (origParts.length >= 3) {
        const sDay = new Date(Number(origParts[0]), Number(origParts[1]) - 1, Number(origParts[2]), 0, 0, 0);
        const eDay = new Date(Number(origParts[0]), Number(origParts[1]) - 1, Number(origParts[2]), 23, 59, 59);
        const dayEvs = calendar.getEvents(sDay, eDay);
        event = dayEvs.find(e => e.getTitle() === payload.originalTitle) || (dayEvs.length === 1 ? dayEvs[0] : null);
      }
    }

    if (!event) {
      return { success: false, error: '削除対象の予定がカレンダーに見つかりませんでした。' };
    }

    // Googleカレンダーから削除
    event.deleteEvent();

    // 🚀 キャッシュの即時破棄（分割キャッシュも含め完全消去）
    clearAppCache();

    return {
      success: true,
      deletedId: eventId,
      originalDate: payload.originalDate,
      originalTitle: payload.originalTitle,
      message: '予定を削除しました'
    };

  } catch (e) {
    SystemLogger.error('deleteCalendarEvent Error: ' + e.toString());
    return { success: false, error: 'カレンダー予定の削除中にエラーが発生しました: ' + e.toString() };
  }
}

/**
 * ログインユーザー自身の Google カレンダー出欠ステータス（RSVP）を更新
 * （USER_ACCESSING 権限でアクセス中の本人としてカレンダーを更新）
 * 
 * @param {Object} payload - { eventId, originalDate, originalTitle, status: 'yes'|'no'|'maybe', userEmail, userName }
 * @returns {Object} { success: boolean, event: Object, message: string }
 */
function updateEventAttendance(payload) {
  try {
    if (!payload) return { success: false, error: 'リクエストデータがありません' };

    const eventId = String(payload.eventId || '').trim();
    const originalDate = String(payload.originalDate || '').trim();
    const originalTitle = String(payload.originalTitle || '').trim();
    const status = String(payload.status || '').trim().toLowerCase(); // 'yes' | 'no' | 'maybe'

    let userEmail = '';
    try {
      userEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
    } catch (e) {}

    if (!userEmail) {
      userEmail = String(payload.userEmail || '').trim().toLowerCase();
    }

    const memberMap = GasSupabaseService.getMemberMap();
    const userName = payload.userName || memberMap[userEmail] || userEmail.split('@')[0];

    // CalendarApp.GuestStatus のマッピング
    let targetGuestStatus = CalendarApp.GuestStatus.MAYBE;
    if (status === 'yes') targetGuestStatus = CalendarApp.GuestStatus.YES;
    else if (status === 'no') targetGuestStatus = CalendarApp.GuestStatus.NO;

    const calendar = CalendarService.getTeamCalendar();
    if (!calendar) return { success: false, error: 'カレンダーが見つかりませんでした' };

    let targetEvent = null;
    if (eventId) {
      try {
        targetEvent = calendar.getEventById(eventId);
        if (!targetEvent && eventId.includes('@')) {
          targetEvent = calendar.getEventById(eventId.split('@')[0]);
        }
        if (!targetEvent && !eventId.includes('@')) {
          targetEvent = calendar.getEventById(eventId + '@google.com');
        }
      } catch (e) {}
    }

    if (!targetEvent && originalDate) {
      const origParts = originalDate.replace(/-/g, '/').split('/');
      if (origParts.length >= 3) {
        const sDay = new Date(Number(origParts[0]), Number(origParts[1]) - 1, Number(origParts[2]), 0, 0, 0);
        const eDay = new Date(Number(origParts[0]), Number(origParts[1]) - 1, Number(origParts[2]), 23, 59, 59);
        const dayEvs = calendar.getEvents(sDay, eDay);
        targetEvent = dayEvs.find(e => String(e.getTitle() || '').trim() === originalTitle) || (dayEvs.length === 1 ? dayEvs[0] : null);
      }
    }

    if (!targetEvent) {
      return { success: false, error: 'カレンダーの予定が見つかりませんでした' };
    }

    const actualEventId = targetEvent.getId();

    // 1. チームカレンダー上のゲスト確認および追加
    const guests = targetEvent.getGuestList(true);
    let guestObj = null;
    for (let i = 0; i < guests.length; i++) {
      if (String(guests[i].getEmail() || '').trim().toLowerCase() === userEmail) {
        guestObj = guests[i];
        break;
      }
    }

    if (!guestObj && userEmail) {
      try {
        targetEvent.addGuest(userEmail);
        SystemLogger.info(`[CalendarSync] addGuest success for ${userEmail}`);
      } catch (addErr) {
        SystemLogger.error(`[CalendarSync] addGuest error for ${userEmail}: ` + addErr.toString());
      }
    }

    // 2. チームカレンダー自体の出席ステータスを確実にパッチ更新（Advanced Calendar API）
    const targetStatusStr = (status === 'yes' ? 'accepted' : (status === 'no' ? 'declined' : 'tentative'));
    try {
      CalendarService.patchEventAttendance(Config.CALENDAR_ID, actualEventId, userEmail, userName, targetStatusStr);
      SystemLogger.info(`[CalendarSync] patchEventAttendance success for ${userEmail} -> ${targetStatusStr}`);
    } catch (patchErr) {
      SystemLogger.error(`[CalendarSync] patchEventAttendance error: ` + patchErr.toString());
    }

    // 3. ユーザーの個人カレンダーへの非同期同期（トークンがある場合のみ確実に実施）
    try {
      const refreshToken = GasSupabaseService.getMemberToken(userEmail);
      if (refreshToken) {
        CalendarService.updateMemberCalendarAttendanceViaToken(refreshToken, actualEventId, userEmail, status);
      }
    } catch (tokenErr) {
      SystemLogger.warn(`[CalendarSync] Personal calendar sync skipped or failed for ${userEmail}: ` + tokenErr.toString());
    }

    clearAppCache();

    // 3. 最新の出欠状況リストを生成して返却
    const yesList = [];
    const noList = [];
    const maybeList = [];
    const unansweredList = [];
    const yesEmails = [];
    const noEmails = [];
    const maybeEmails = [];
    const unansweredEmails = [];

    const updatedGuests = targetEvent.getGuestList(true);
    let userIncluded = false;
    updatedGuests.forEach(g => {
      const gEmail = String(g.getEmail() || '').trim().toLowerCase();
      if (gEmail === Config.CALENDAR_ID.toLowerCase()) return;

      const name = memberMap[gEmail] || g.getName() || gEmail;
      let gStatus = g.getGuestStatus();

      if (gEmail === userEmail) {
        gStatus = targetGuestStatus;
        userIncluded = true;
      }

      if (gStatus === CalendarApp.GuestStatus.YES) {
        yesList.push(name);
        if (gEmail) yesEmails.push(gEmail);
      } else if (gStatus === CalendarApp.GuestStatus.NO) {
        noList.push(name);
        if (gEmail) noEmails.push(gEmail);
      } else if (gStatus === CalendarApp.GuestStatus.MAYBE) {
        maybeList.push(name);
        if (gEmail) maybeEmails.push(gEmail);
      } else {
        unansweredList.push(name);
        if (gEmail) unansweredEmails.push(gEmail);
      }
    });

    // ⚡ 招待直後で updatedGuests にまだ反映されていない場合でも、自分を確実に適切なリストに追加
    if (!userIncluded && userEmail) {
      if (status === 'yes') {
        yesList.push(userName);
        yesEmails.push(userEmail);
      } else if (status === 'no') {
        noList.push(userName);
        noEmails.push(userEmail);
      } else if (status === 'maybe') {
        maybeList.push(userName);
        maybeEmails.push(userEmail);
      }
    }

    const sTime = targetEvent.getStartTime();
    const eTime = targetEvent.getEndTime();
    const isAllDay = targetEvent.isAllDayEvent();

    const startH = Utilities.formatDate(sTime, 'Asia/Tokyo', 'HH:mm');
    const endH = Utilities.formatDate(eTime, 'Asia/Tokyo', 'HH:mm');

    const updatedEventData = {
      id: targetEvent.getId(),
      title: targetEvent.getTitle(),
      date: Utilities.formatDate(sTime, 'Asia/Tokyo', 'yyyy/MM/dd'),
      timeRange: isAllDay ? '終日' : `${startH} - ${endH}`,
      isAllDay: isAllDay,
      startTimeStr: isAllDay ? '09:00' : startH,
      endTimeStr: isAllDay ? '12:00' : endH,
      location: targetEvent.getLocation() || '',
      description: cleanDescriptionText(targetEvent.getDescription()),
      calendarAttended: yesList.join(', '),
      attendeesDetail: {
        yes: yesList,
        no: noList,
        maybe: maybeList,
        unanswered: unansweredList,
        yesEmails: yesEmails,
        noEmails: noEmails,
        maybeEmails: maybeEmails,
        unansweredEmails: unansweredEmails
      }
    };

    return {
      success: true,
      message: 'Googleカレンダーに出欠を保存しました',
      event: updatedEventData,
      status: status,
      userName: userName,
      userEmail: userEmail
    };

  } catch (err) {
    SystemLogger.error('updateEventAttendance Error: ' + err.toString());
    return { success: false, error: '出欠更新エラー: ' + err.toString() };
  }
}