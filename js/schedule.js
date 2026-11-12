// =========================================
// 予定・カレンダー機能 (Schedule View)
// =========================================

// カレンダー表示中の年月を保持
window.calYear = new Date().getFullYear();
window.calMonth = new Date().getMonth(); // 0-indexed (0: 1月, 11: 12月)
window.selectedCalDate = null;
window.currentViewingEvent = null; // 現在詳細モーダルで閲覧中のイベント
window.scheduleCurrentFilter = 'all'; // 予定リストの絞り込み状態 ('all' | 'unanswered' | 'yes' | 'no' | 'maybe')
window.eventsData = window.eventsData || []; // ⚡ 初期状態でも空配列を保証（カレンダー枠の即時描画をブロックしない）

// ⚡ 過去のモック用ローカルストレージを完全消去（実データと同期）
try {
  localStorage.removeItem('fcb_mock_attend');
} catch (e) {}

// セッション中の一時的操作キャッシュ（メモリのみ）
window.sessionAttendance = {};


/**
 * 説明文から出欠メタデータタグを除去
 */
function cleanDescriptionText(description) {
  if (!description) return '';
  return String(description).replace(/\n?\[FCB_ATTEND:[^\]]+\]/g, '').trim();
}

/**
 * 予定の出欠ステータスを取得（Googleカレンダー実データと照合）
 * 戻り値: 'yes' | 'no' | 'maybe' | 'unanswered'
 */
function getMyEventStatus(ev) {
  if (!ev) return 'unanswered';
  const key = String(ev.id || (normalizeDateStr(ev.date) + '_' + (ev.title || ''))).trim();

  // 1. 直前の操作によるセッション中の一時状態があれば反映
  if (window.sessionAttendance && window.sessionAttendance[key]) {
    return window.sessionAttendance[key];
  }

  // 2. ログインユーザー情報を取得
  let userEmail = '';
  let userName = '';

  if (window.currentUser) {
    userEmail = String(window.currentUser.email || '').trim().toLowerCase();
    userName = String(window.currentUser.name || '').trim();
  }

  if (!userName) {
    const headerNameBtn = document.getElementById('headerUserNameBtn');
    if (headerNameBtn && headerNameBtn.textContent) {
      userName = headerNameBtn.textContent.trim();
    }
  }

  if (!userName) {
    try {
      const savedUser = JSON.parse(localStorage.getItem('fcb_current_user') || '{}');
      if (savedUser.name) userName = savedUser.name;
      if (savedUser.email && !userEmail) userEmail = String(savedUser.email).trim().toLowerCase();
    } catch (e) {}
  }

  const details = ev.attendeesDetail || {};

  // ⚡ 2-1. メールアドレスによる完全一致判定（最優先・100% 確実）
  if (userEmail) {
    const yesEmails = Array.isArray(details.yesEmails) ? details.yesEmails.map(e => String(e).toLowerCase().trim()) : [];
    const noEmails = Array.isArray(details.noEmails) ? details.noEmails.map(e => String(e).toLowerCase().trim()) : [];
    const maybeEmails = Array.isArray(details.maybeEmails) ? details.maybeEmails.map(e => String(e).toLowerCase().trim()) : [];
    const unansweredEmails = Array.isArray(details.unansweredEmails) ? details.unansweredEmails.map(e => String(e).toLowerCase().trim()) : [];

    if (yesEmails.includes(userEmail)) return 'yes';
    if (noEmails.includes(userEmail)) return 'no';
    if (maybeEmails.includes(userEmail)) return 'maybe';
    if (unansweredEmails.includes(userEmail)) return 'unanswered';
  }

  // 2-2. 選手名による完全一致判定（フォールバック）
  if (userName) {
    const userNorm = normalizePersonName(userName);

    /**
     * リスト内の選手名と正規化完全一致するか判定する
     * @param {string[]} list - 出欠者名リスト
     * @returns {boolean} 一致するかどうか
     */
    const checkListExact = (list) => {
      if (!Array.isArray(list)) return false;
      return list.some(item => {
        const itemNorm = normalizePersonName(item);
        return userNorm && itemNorm === userNorm;
      });
    };

    if (checkListExact(details.yes)) return 'yes';
    if (checkListExact(details.no)) return 'no';
    if (checkListExact(details.maybe)) return 'maybe';
  }

  return 'unanswered';
}

/**
 * 出欠状態を更新（0秒即時反映 ＋ Googleカレンダー非同期本番同期）
 */
function setMyAttendance(evOrKey, status) {
  if (!evOrKey) return;

  let ev = null;
  let eventKey = '';

  if (typeof evOrKey === 'object') {
    ev = evOrKey;
    eventKey = String(ev.id || (normalizeDateStr(ev.date) + '_' + (ev.title || ''))).trim();
  } else {
    eventKey = String(evOrKey).trim();
    if (window.eventsData) {
      ev = window.eventsData.find(e => String(e.id || (normalizeDateStr(e.date) + '_' + (e.title || ''))).trim() === eventKey);
    }
  }

  const user = window.currentUser || {};
  let myName = user.name || '';
  let myEmail = String(user.email || '').trim().toLowerCase();

  if (!myName) {
    const headerNameBtn = document.getElementById('headerUserNameBtn');
    if (headerNameBtn && headerNameBtn.textContent) {
      myName = headerNameBtn.textContent.trim();
    }
  }

  if (!myName) {
    try {
      const savedUser = JSON.parse(localStorage.getItem('fcb_current_user') || '{}');
      if (savedUser.name) myName = savedUser.name;
      if (savedUser.email && !myEmail) myEmail = String(savedUser.email).trim().toLowerCase();
    } catch (e) {}
  }

  if (!myName && myEmail) {
    myName = myEmail.split('@')[0];
  }

  const myNorm = normalizePersonName(myName);

  // ⚡ 1. 楽観的UI更新（画面上は 0.0 秒で即座にボタン・色・人数・リストを反映！）
  const previousSessionStatus = window.sessionAttendance[eventKey] || null;
  window.sessionAttendance[eventKey] = status;

  let backupEvStr = null;
  if (ev) {
    backupEvStr = JSON.stringify(ev);
    if (!ev.attendeesDetail) {
      ev.attendeesDetail = { yes: [], no: [], maybe: [], unanswered: [], yesEmails: [], noEmails: [], maybeEmails: [], unansweredEmails: [] };
    }
    // 既存リストから自分（名前・メール・「私」）を完全に除去
    ['yes', 'no', 'maybe', 'unanswered'].forEach(k => {
      if (Array.isArray(ev.attendeesDetail[k])) {
        ev.attendeesDetail[k] = ev.attendeesDetail[k].filter(n => {
          const norm = normalizePersonName(n);
          if (norm === '私' || norm === 'me') return false;
          if (myNorm && norm === myNorm) return false;
          if (myEmail && String(n).toLowerCase().includes(myEmail)) return false;
          return true;
        });
      }
      const emailKey = k + 'Emails';
      if (Array.isArray(ev.attendeesDetail[emailKey]) && myEmail) {
        ev.attendeesDetail[emailKey] = ev.attendeesDetail[emailKey].filter(e => String(e).toLowerCase().trim() !== myEmail);
      }
    });

    // 選んだステータスに自分を追加
    if (status && ev.attendeesDetail[status] && myName) {
      if (!ev.attendeesDetail[status].includes(myName)) {
        ev.attendeesDetail[status].push(myName);
      }
      const targetEmailKey = status + 'Emails';
      if (Array.isArray(ev.attendeesDetail[targetEmailKey]) && myEmail) {
        if (!ev.attendeesDetail[targetEmailKey].includes(myEmail)) {
          ev.attendeesDetail[targetEmailKey].push(myEmail);
        }
      }
    }
    ev.calendarAttended = (ev.attendeesDetail.yes || []).join(', ');

    // 詳細モーダルが開いていれば出欠状況の表示を 0 秒で即座に再描画！
    const overlay = document.getElementById('eventDetailModalOverlay');
    if (overlay && overlay.classList.contains('active')) {
      const yesBtn = document.getElementById('edmMockYesBtn');
      const noBtn = document.getElementById('edmMockNoBtn');
      const maybeBtn = document.getElementById('edmMockMaybeBtn');
      if (yesBtn) yesBtn.classList.toggle('active', status === 'yes');
      if (noBtn) noBtn.classList.toggle('active', status === 'no');
      if (maybeBtn) maybeBtn.classList.toggle('active', status === 'maybe');

      const yCount = document.getElementById('edmYesCount');
      const yNames = document.getElementById('edmYesNames');
      const nCount = document.getElementById('edmNoCount');
      const nNames = document.getElementById('edmNoNames');
      const mCount = document.getElementById('edmMaybeCount');
      const mNames = document.getElementById('edmMaybeNames');
      const uCount = document.getElementById('edmUnansweredCount');
      const uNames = document.getElementById('edmUnansweredNames');

      const yList = ev.attendeesDetail.yes || [];
      const nList = ev.attendeesDetail.no || [];
      const mbList = ev.attendeesDetail.maybe || [];
      const uList = ev.attendeesDetail.unanswered || [];

      if (yCount && yNames) {
        yCount.textContent = yList.length;
        yNames.textContent = yList.length > 0 ? yList.join(', ') : 'なし';
      }
      if (nCount && nNames) {
        nCount.textContent = nList.length;
        nNames.textContent = nList.length > 0 ? nList.join(', ') : 'なし';
      }
      if (mCount && mNames) {
        mCount.textContent = mbList.length;
        mNames.textContent = mbList.length > 0 ? mbList.join(', ') : 'なし';
      }
      if (uCount && uNames) {
        uCount.textContent = uList.length;
        uNames.textContent = uList.length > 0 ? uList.join(', ') : 'なし';
      }
    }
  }

  // 画面即時再描画（カレンダーマス・予定リストの色を即時更新）
  renderCalendar(window.calYear, window.calMonth);
  renderAgendaList();
  updateUnansweredBadges();



  // ⚡ 2. バックエンド (GAS) 経由で Google カレンダーを非同期更新
  const myMemberId = user.memberId || user.id || '';
  const payload = {
    eventId: ev ? (ev.id || '') : (eventKey.length > 15 ? eventKey : ''),
    originalDate: ev ? ev.date : '',
    originalTitle: ev ? ev.title : '',
    category: ev ? (ev.category || 'その他') : 'その他',
    status: status,
    memberId: myMemberId,
    userEmail: myEmail || '',
    userName: myName || ''
  };

  google.script.run
    .withSuccessHandler(res => {
      if (res && res.success) {
        if (res.event && window.eventsData) {
          const idx = window.eventsData.findIndex(e => (res.event.id && e.id === res.event.id) || (e.date === res.event.date && e.title === res.event.title));
          if (idx >= 0) {
            window.eventsData[idx] = res.event;
          }
          updateUnansweredBadges();
        }
      } else {
        console.error('Calendar update failed on backend:', res ? res.error : 'Unknown error');
      }
    })
    .withFailureHandler(err => {
      console.error('updateEventAttendance Error:', err);
    })
    .updateEventAttendance(payload);
}

// 後方互換性のためエイリアス
window.setMyAttendanceMock = setMyAttendance;
window.setMyAttendance = setMyAttendance;

/**
 * 未入力バッジの更新（予定リストの未入力ボタン、およびスマホ用予定リストサブタブ）
 */
function updateUnansweredBadges() {
  try {
    // ログイン中のユーザーが休部中の場合は、スケジュール催促バッジを完全に非表示
    const u = window.currentUser || {};
    if (u.isSuspended) {
      const filterBadge = document.getElementById('unansweredCountBadge');
      if (filterBadge) filterBadge.classList.add('hidden');
      const subtabAlertBadge = document.getElementById('subtabListAlertBadge');
      if (subtabAlertBadge) subtabAlertBadge.classList.add('hidden');
      return;
    }

    const allItems = (window.eventsData && Array.isArray(window.eventsData)) ? window.eventsData : [];
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

    let unansweredCount = 0;
    allItems.forEach(ev => {
      if (!ev || !ev.date) return;
      const evDateStr = normalizeDateStr(ev.date);
      if (evDateStr >= todayStr) {
        if (getMyEventStatus(ev) === 'unanswered') {
          unansweredCount++;
        }
      }
    });

    // 1. 予定リストの「未入力」フィルターボタン右上のバッジ（未入力件数を表示）
    const filterBadge = document.getElementById('unansweredCountBadge');
    if (filterBadge) {
      if (unansweredCount > 0) {
        filterBadge.textContent = unansweredCount;
        filterBadge.classList.remove('hidden');
      } else {
        filterBadge.textContent = '0';
        filterBadge.classList.add('hidden');
      }
    }

    // 2. スマホ用サブタブ「予定リスト」の未入力警告バッジ（丸囲み!）
    const subtabAlertBadge = document.getElementById('subtabListAlertBadge');
    if (subtabAlertBadge) {
      if (unansweredCount > 0) {
        subtabAlertBadge.classList.remove('hidden');
      } else {
        subtabAlertBadge.classList.add('hidden');
      }
    }

    // 3. ホーム画面のお知らせバナーおよび次回活動カードもリアルタイム同期更新
    if (typeof renderHomeNoticeArea === 'function') {
      try { renderHomeNoticeArea(); } catch (errNotice) {}
    }
    if (typeof renderHomeNextEvent === 'function') {
      try { renderHomeNextEvent(); } catch (errNext) {}
    }
  } catch (e) {
    console.error('Error updating unanswered badges:', e);
  }
}

/**
 * サブタブ切り替え（カレンダー / 予定リスト）
 */
function switchScheduleSubTab(tabName) {
  const calView = document.getElementById('scheduleCalendarView');
  const listView = document.getElementById('scheduleListView');
  const calTabBtn = document.getElementById('subtab-calendar');
  const listTabBtn = document.getElementById('subtab-list');

  if (tabName === 'calendar') {
    if (calView) calView.classList.add('active');
    if (listView) listView.classList.remove('active');
    if (calTabBtn) calTabBtn.classList.add('active');
    if (listTabBtn) listTabBtn.classList.remove('active');
    updateUnansweredBadges();
  } else {
    if (calView) calView.classList.remove('active');
    if (listView) listView.classList.add('active');
    if (calTabBtn) calTabBtn.classList.remove('active');
    if (listTabBtn) listTabBtn.classList.add('active');
    renderAgendaList();
  }
  if (typeof updateMobileHeaderHeight === 'function') {
    updateMobileHeaderHeight();
  }
}

/**
 * 予定リストの絞り込みフィルター切り替え
 */
function setScheduleFilter(filterType, btnEl) {
  window.scheduleCurrentFilter = filterType;
  document.querySelectorAll('.filter-pill-btn').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderAgendaList();
}

/**
 * 予定カテゴリの安全な判定ヘルパー
 */
function resolveEventCategory(ev) {
  if (!ev) return { category: 'その他', isMatch: false, opponent: '', catClass: 'other' };

  const rawTitle = String(ev.title || '').trim();
  const titleUpper = rawTitle.toUpperCase();

  // 1. 公式戦（都リーグ、リーグ、公式戦、選手権、カップ等）
  if (titleUpper.includes('公式戦') || titleUpper.includes('都リーグ') || titleUpper.includes('リーグ') || titleUpper.includes('選手権') || titleUpper.includes('カップ') || titleUpper.includes('大会')) {
    const opp = ev.opponent || rawTitle.replace(/(公式戦|都リーグ|区民大会|カップ|選手権|大会|リーグ|vs|VS|\/)/gi, '').trim();
    return { category: '公式戦', isMatch: true, opponent: opp, catClass: 'official' };
  }
  
  // 2. TRM・練習試合
  if (titleUpper.includes('TRM') || titleUpper.includes('練習試合') || titleUpper.includes(' VS ') || titleUpper.startsWith('VS ') || titleUpper.includes('VS')) {
    const opp = ev.opponent || rawTitle.replace(/(TRM|練習試合|vs|VS|\/)/gi, '').trim();
    return { category: 'TRM', isMatch: true, opponent: opp, catClass: 'trm' };
  }
  
  // 3. TR・練習・トレーニング
  if (titleUpper === 'TR' || titleUpper.startsWith('TR ') || titleUpper.endsWith(' TR') || titleUpper.includes('トレーニング') || (titleUpper.includes('練習') && !titleUpper.includes('練習試合'))) {
    return { category: 'TR', isMatch: false, opponent: '', catClass: 'tr' };
  }
  
  // 4. イベント・飲み会等
  if (titleUpper.includes('飲み会') || titleUpper.includes('懇親会') || titleUpper.includes('打ち上げ') || titleUpper.includes('総会') || titleUpper.includes('イベント') || titleUpper.includes('ミーティング')) {
    return { category: 'イベント', isMatch: false, opponent: '', catClass: 'event' };
  }

  // 5. その他
  return { category: ev.category || 'その他', isMatch: Boolean(ev.isMatch), opponent: ev.opponent || '', catClass: 'other' };
}

/**
 * カレンダーマス表示用の時間とタイトル情報を分離して取得
 */
function getCalEventDisplayParts(ev, catInfo) {
  let timeStr = '';
  if (ev.timeRange && ev.timeRange !== '終日') {
    const match = String(ev.timeRange).match(/^(\d{1,2}:\d{2})/);
    if (match) {
      timeStr = match[1];
    }
  }

  let titleStr = '';
  if (catInfo.isMatch && catInfo.opponent) {
    titleStr = (catInfo.category ? catInfo.category + ' ' : '') + 'vs ' + catInfo.opponent;
  } else {
    titleStr = ev.title || catInfo.category || '予定';
  }

  return { timeStr, titleStr };
}

/**
 * カレンダーマス表示用のサマリーテキストを生成
 * 例: "17:00 都リーグ vs sala", "19:00 TR"
 */
function formatCalEventSummary(ev, catInfo) {
  const parts = getCalEventDisplayParts(ev, catInfo);
  return (parts.timeStr ? parts.timeStr + ' ' : '') + parts.titleStr;
}

/**
 * 予定編集モーダルのゲスト候補datalist要素を名簿データで更新する
 * @param {Array<Object>} roster - 名簿部員一覧
 * @returns {void}
 */
function updateScheduleMemberListOptions(roster) {
  if (!roster || !Array.isArray(roster)) return;
  window.scheduleRoster = roster;
  const dataList = document.getElementById('memberListOptions');
  if (dataList) {
    dataList.replaceChildren();
    roster.forEach(member => {
      if (member.email) {
        const opt = document.createElement('option');
        opt.value = member.email;
        opt.textContent = member.name;
        dataList.appendChild(opt);
      }
    });
  }
}

/**
 * 予定画面の初期化
 */
function initScheduleView(events, initialRoster) {
  try {
    window.eventsData = Array.isArray(events) ? events : (window.eventsData || []);
    const now = new Date();
    window.calYear = now.getFullYear();
    window.calMonth = now.getMonth();
    window.selectedCalDate = formatDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
    
    renderCalendar(window.calYear, window.calMonth);
    renderAgendaList();
    updateUnansweredBadges();

    // スケジュールタブ初期表示時の意図しないスクロールを最上部にリセット
    try {
      const scheduleTab = document.getElementById('tab-schedule');
      if (scheduleTab && scheduleTab.classList.contains('active')) {
        window.scrollTo(0, 0);
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
      }
    } catch (e) {}
    
    const roster = initialRoster || window.scheduleRoster;
    if (roster && Array.isArray(roster) && roster.length > 0) {
      // ⚡ 初期データに同封されている名簿を即座に利用（追加通信ゼロ）
      updateScheduleMemberListOptions(roster);
    } else {
      // フォールバック（初期データに含まれていなかった場合のみサーバー取得）
      google.script.run.withSuccessHandler(r => {
        updateScheduleMemberListOptions(r);
      }).apiGetMemberListForLogin();
    }

  } catch (err) {
    console.error('initScheduleView Error:', err);
  }
}

/**
 * ページ読み込み完了時に即座にカレンダー枠と今後の予定リストを初期描画する
 * @returns {void}
 */
function setupScheduleOnReady() {
  try {
    const now = new Date();
    window.calYear = window.calYear || now.getFullYear();
    window.calMonth = (window.calMonth !== undefined) ? window.calMonth : now.getMonth();
    window.selectedCalDate = formatDateStr(window.calYear, window.calMonth + 1, now.getDate());
    renderCalendar(window.calYear, window.calMonth);
    renderAgendaList();
  } catch (err) {
    console.error('setupScheduleOnReady Error:', err);
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupScheduleOnReady);
} else {
  setupScheduleOnReady();
}

/**
 * 今後の予定リスト（アジェンダ）を描画する
 * 直近の予定が先頭に来るよう昇順ソート
 */

/**
 * 予定リストやモーダルで表示するタイトルを生成
 * カテゴリタグ（バッジ）と同一の内容や重複するプレフィックスを排除し、
 * タイトルとして表示すべき内容がない場合は空文字を返す（タイトル非表示）
 */
function getDisplayTitle(ev, catInfo) {
  let displayTitle = (ev && ev.title ? String(ev.title) : '').trim();
  if (!displayTitle || displayTitle === '予定') {
    return '';
  }

  const categoryName = (catInfo && catInfo.category ? String(catInfo.category) : '').trim();

  // プレフィックス候補（カッコ付き・なし両方）
  const prefixes = [
    '【TRM】', '【TR】', '【都リーグ】', '【公式戦】', '【練習試合】', '【練習】', '【イベント】',
    'TRM', 'TR', '都リーグ', '公式戦', '練習試合', '練習', 'イベント'
  ];

  for (const p of prefixes) {
    if (displayTitle.toUpperCase().startsWith(p.toUpperCase())) {
      displayTitle = displayTitle.substring(p.length).replace(/^[:：\s\-\/]+/, '').trim();
      break;
    }
  }

  // 対戦相手がある試合の場合、vs Opponent を付与
  if (catInfo && catInfo.isMatch && catInfo.opponent) {
    const opp = String(catInfo.opponent).trim();
    if (displayTitle.toLowerCase().includes('vs')) {
      // 既にvsが含まれている
    } else if (displayTitle) {
      displayTitle = displayTitle + ' vs ' + opp;
    } else {
      displayTitle = 'vs ' + opp;
    }
  }

  // カテゴリタグ（バッジ）と完全に同義または空になった場合は重複するためタイトル非表示
  if (categoryName) {
    const normCategory = categoryName.toUpperCase();
    const normTitle = displayTitle.toUpperCase();
    if (!normTitle || normTitle === normCategory || normTitle === '【' + normCategory + '】') {
      return '';
    }
    // 同義語チェック（タグがTRでタイトルが「練習」など）
    if (normCategory === 'TR' && (normTitle === '練習' || normTitle === 'トレーニング')) {
      return '';
    }
    if (normCategory === 'TRM' && (normTitle === '練習試合' || normTitle === 'TRM')) {
      return '';
    }
    if (normCategory === '公式戦' && (normTitle === '都リーグ' || normTitle === '公式戦' || normTitle === 'リーグ戦')) {
      return '';
    }
  }

  if (!displayTitle || displayTitle === '予定') {
    return '';
  }
  return displayTitle;
}

/**
 * 今日以降の予定データ（アジェンダリスト）を生成し、未入力バッジとともに描画する
 * @returns {void}
 */
function renderAgendaList() {
  try {
    updateUnansweredBadges();
    const container = document.getElementById('scheduleAgendaList');
    if (!container) return;

    // カレンダーの予定データのみを使用
    const allItems = (window.eventsData && Array.isArray(window.eventsData)) ? [...window.eventsData] : [];

    // 今日以降の予定（今日を含む未来の予定）のみを抽出
    const now = new Date();
    const todayStr = formatDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const futureItems = allItems.filter(ev => {
      if (!ev || !ev.date) return false;
      const evDateStr = normalizeDateStr(ev.date);
      return evDateStr >= todayStr;
    });

    // 直近の予定から順に昇順ソート（近い日付が先頭）
    futureItems.sort((a, b) => {
      const strA = normalizeDateStr(a.date);
      const strB = normalizeDateStr(b.date);
      if (!strA) return 1;
      if (!strB) return -1;
      return strA.localeCompare(strB);
    });

    // フィルター適用
    const currentFilter = window.scheduleCurrentFilter || 'all';
    const filteredItems = futureItems.filter(ev => {
      const status = getMyEventStatus(ev);
      if (currentFilter === 'unanswered') return status === 'unanswered';
      if (currentFilter === 'yes') return status === 'yes';
      if (currentFilter === 'no') return status === 'no';
      if (currentFilter === 'maybe') return status === 'maybe';
      return true; // 'all'
    });

    if (filteredItems.length === 0) {
      let emptyMsg = '該当する予定はありません';
      if (currentFilter === 'unanswered') emptyMsg = '未入力の予定はありません';
      else if (currentFilter === 'yes') emptyMsg = '出席予定はありません';
      else if (currentFilter === 'no') emptyMsg = '欠席予定はありません';
      else if (currentFilter === 'maybe') emptyMsg = '未定の予定はありません';

      container.replaceChildren();
      const tplEmpty = document.getElementById('tpl-schedule-empty');
      if (tplEmpty) {
        const clone = tplEmpty.content.cloneNode(true);
        const msgEl = clone.querySelector('.schedule-empty-msg');
        if (msgEl) msgEl.textContent = emptyMsg;
        container.appendChild(clone);
      } else {
        container.textContent = emptyMsg;
      }
      return;
    }

    container.replaceChildren();
    filteredItems.forEach(ev => {
      try {
        const cardNode = createScheduleAgendaCardElement(ev, { showAttendanceButtons: true });
        container.appendChild(cardNode);
      } catch (cardErr) {
        console.error('Error rendering schedule card:', cardErr);
      }
    });
  } catch (err) {
    console.error('renderAgendaList Error:', err);
  }
}

/**
 * 予定データから共通のアジェンダカードDOMを生成（他画面でも再利用可能）
 * @param {Object} ev - イベントオブジェクト
 * @param {Object} [options] - オプション（showAttendanceButtons: boolean）
 * @returns {HTMLElement|DocumentFragment}
 */
function createScheduleAgendaCardElement(ev, options = {}) {
  const tpl = document.getElementById('tpl-schedule-card');
  if (!tpl) return document.createElement('div');

  const catInfo = resolveEventCategory(ev);
  const myStatus = getMyEventStatus(ev); // 'unanswered' | 'yes' | 'no' | 'maybe'

  const clone = tpl.content.cloneNode(true);
  const cardEl = clone.querySelector('.schedule-agenda-card');
  
  // 出欠ステータスに応じたカラーリング
  if (cardEl) {
    cardEl.classList.add('card-' + myStatus);
    cardEl.onclick = () => openEventDetailModal(ev);
  }

  // カテゴリバッジ
  const badgeEl = clone.querySelector('.schedule-agenda-badge');
  if (badgeEl) {
    badgeEl.textContent = catInfo.category;
    badgeEl.className = 'schedule-agenda-badge category-badge badge-' + (catInfo.catClass || 'other');
  }

  // 日付（曜日付き）
  const dateEl = clone.querySelector('.schedule-agenda-date');
  if (dateEl) dateEl.textContent = formatDisplayDateWithDay(ev.date);

  // タイトル
  const titleEl = clone.querySelector('.schedule-agenda-title');
  if (titleEl) {
    const finalTitle = getDisplayTitle(ev, catInfo);
    titleEl.textContent = finalTitle || '';
    titleEl.classList.toggle('hidden', !finalTitle);
  }

  // 時間
  const timeEl = clone.querySelector('.schedule-agenda-time');
  if (timeEl) {
    timeEl.textContent = (ev.timeRange && ev.timeRange !== '終日') ? ev.timeRange : '終日';
  }

  // 場所
  const locRow = clone.querySelector('.loc-row');
  const locText = clone.querySelector('.schedule-agenda-loc');
  if (locRow && locText) {
    if (ev.location) {
      locRow.classList.remove('hidden');
      locText.textContent = ev.location;
    } else {
      locRow.classList.add('hidden');
    }
  }

  // 出欠ボタンの表示制御
  const footerEl = clone.querySelector('.schedule-agenda-footer');
  if (options && options.showAttendanceButtons === false) {
    if (footerEl) footerEl.remove();
  } else {
    // 出欠ボタン（インライン）のアクティブ化＆クリックイベント
    const yesBtn = clone.querySelector('.btn-inline-yes');
    const noBtn = clone.querySelector('.btn-inline-no');
    const maybeBtn = clone.querySelector('.btn-inline-maybe');

    if (myStatus === 'yes' && yesBtn) yesBtn.classList.add('active');
    if (myStatus === 'no' && noBtn) noBtn.classList.add('active');
    if (myStatus === 'maybe' && maybeBtn) maybeBtn.classList.add('active');

    if (yesBtn) {
      yesBtn.onclick = (e) => {
        e.stopPropagation();
        setMyAttendance(ev, 'yes');
      };
    }
    if (noBtn) {
      noBtn.onclick = (e) => {
        e.stopPropagation();
        setMyAttendance(ev, 'no');
      };
    }
    if (maybeBtn) {
      maybeBtn.onclick = (e) => {
        e.stopPropagation();
        setMyAttendance(ev, 'maybe');
      };
    }
  }

  return clone;
}

window.createScheduleAgendaCardElement = createScheduleAgendaCardElement;

/**
 * 月間カレンダーを描画する
 * 
 * @param {number} year - 表示する年 (例: 2026)
 * @param {number} month - 表示する月 (0-11)
 */
function renderCalendar(year, month) {
  try {
    const monthTitle = document.getElementById('calMonthTitle');
    const grid = document.getElementById('calGrid');
    if (!monthTitle || !grid) return;

    monthTitle.textContent = year + '年 ' + (month + 1) + '月';
    grid.innerHTML = '';

    const today = new Date();
    const todayStr = formatDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

    // 月初日の曜日 (0: 日曜, 1: 月曜, ..., 6: 土曜)
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    // 当月の日数
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // 前月の日数
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // 1. 前月の日付埋め
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthDate = new Date(year, month - 1, dayNum);
      const dateStr = formatDateStr(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, dayNum);
      
      grid.appendChild(createDayCell(dayNum, dateStr, true, prevMonthDate.getDay()));
    }

    // 2. 当月の日付
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const dateStr = formatDateStr(year, month + 1, d);
      const isToday = (dateStr === todayStr);

      grid.appendChild(createDayCell(d, dateStr, false, curDate.getDay(), isToday));
    }

    // 3. 次月の日付埋め
    const totalCells = firstDayOfWeek + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remainingCells; d++) {
      const nextMonthDate = new Date(year, month + 1, d);
      const dateStr = formatDateStr(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, d);

      grid.appendChild(createDayCell(d, dateStr, true, nextMonthDate.getDay()));
    }
  } catch (err) {
    console.error('renderCalendar Error:', err);
  }
}

/**
 * 1日分のカレンダーマス（セル）を生成（Googleカレンダー風のテキストリスト表示）
 */
function createDayCell(dayNum, dateStr, isOtherMonth, dayOfWeek, isToday = false) {
  const cell = document.createElement('div');
  cell.className = 'cal-day-cell';
  
  if (isOtherMonth) cell.classList.add('other-month');
  if (isToday) cell.classList.add('today');
  if (dayOfWeek === 0) cell.classList.add('sun');
  if (dayOfWeek === 6) cell.classList.add('sat');
  if (window.selectedCalDate === dateStr) cell.classList.add('selected');

  // 日付数字
  const numSpan = document.createElement('span');
  numSpan.className = 'cal-day-num';
  numSpan.textContent = dayNum;
  cell.appendChild(numSpan);

  // その日のイベント（試合・練習）を抽出してテキストリスト表示
  const dayEvents = getEventsForDate(dateStr);
  if (dayEvents.length > 0) {
    const listContainer = document.createElement('div');
    listContainer.className = 'cal-events-list';

    dayEvents.forEach(ev => {
      const catInfo = resolveEventCategory(ev);
      const myStatus = getMyEventStatus(ev); // 'unanswered' | 'yes' | 'no' | 'maybe'

      const itemEl = document.createElement('div');
      itemEl.className = 'cal-event-item status-' + myStatus;

      const { timeStr, titleStr } = getCalEventDisplayParts(ev, catInfo);

      if (timeStr) {
        const timeEl = document.createElement('span');
        timeEl.className = 'cal-event-time';
        timeEl.textContent = timeStr;
        itemEl.appendChild(timeEl);
      }

      const titleEl = document.createElement('span');
      titleEl.className = 'cal-event-title';
      titleEl.textContent = titleStr;
      itemEl.appendChild(titleEl);

      // 📌 既存予定アイテムをクリックしたときは、その予定の詳細・編集モーダルを開く
      itemEl.onclick = (e) => {
        if (e) e.stopPropagation();
        openEventDetailModal(ev);
      };

      listContainer.appendChild(itemEl);
    });

    cell.appendChild(listContainer);
  }

  // 📌 カレンダーのマス（空白部分や日付数字）をクリックしたときは新規予定追加モーダルを開く
  cell.onclick = () => {
    window.selectedCalDate = dateStr;
    document.querySelectorAll('.cal-day-cell').forEach(el => el.classList.remove('selected'));
    cell.classList.add('selected');
    openNewEventModal(dateStr);
  };

  return cell;
}

/**
 * 日付（"YYYY/MM/DD"）に一致するイベント一覧を取得
 */
function getEventsForDate(dateStr) {
  try {
    const normalizedTarget = normalizeDateStr(dateStr);
    const events = [];

    // カレンダーから取得した予定のみを抽出
    if (window.eventsData && Array.isArray(window.eventsData)) {
      window.eventsData.forEach(e => {
        if (e && e.date && normalizeDateStr(e.date) === normalizedTarget) {
          events.push(e);
        }
      });
    }
    
    return events;
  } catch (err) {
    console.error('getEventsForDate Error:', err);
    return [];
  }
}

/**
 * 予定の詳細モーダルを開く
 * 
 * @param {Object} ev - カレンダーイベントオブジェクト
 */
function openEventDetailModal(ev) {
  if (!ev) return;
  window.currentViewingEvent = ev; // 編集・複製用に保持

  try {
    const catInfo = resolveEventCategory(ev);

    // カテゴリバッジ（色分けクラス適用）
    const catBadge = document.getElementById('edmCategoryBadge');
    if (catBadge) {
      catBadge.textContent = catInfo.category;
      catBadge.className = 'category-badge badge-' + catInfo.catClass;
    }

    // タイトル / 対戦相手の重複排除
      const titleEl = document.getElementById('edmTitle');
      if (titleEl) {
        const finalTitle = getDisplayTitle(ev, catInfo);
        titleEl.textContent = finalTitle || '';
        titleEl.classList.toggle('hidden', !finalTitle);
      }

      // 日付（曜日付き）
    const dateEl = document.getElementById('edmDate');
    if (dateEl) {
      dateEl.textContent = formatDisplayDateWithDay(ev.date);
    }

    // 時間
    const timeEl = document.getElementById('edmTime');
    if (timeEl) {
      timeEl.textContent = ev.timeRange || '終日';
    }

    // 場所 (Google Map連携)
    const locRow = document.getElementById('edmLocationRow');
    const locText = document.getElementById('edmLocationText');
    const mapLink = document.getElementById('edmMapLink');
    if (locRow && locText && mapLink) {
      if (ev.location) {
        locRow.classList.remove('hidden');
        locText.textContent = ev.location;
        mapLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.location);
        mapLink.classList.remove('hidden');
      } else {
        locRow.classList.remove('hidden');
        locText.textContent = '未設定';
        mapLink.classList.add('hidden');
      }
    }

    // 説明
    const descRow = document.getElementById('edmDescriptionRow');
    const descText = document.getElementById('edmDescriptionText');
    if (descRow && descText) {
      const cleanedDesc = cleanDescriptionText(ev.description);
      if (cleanedDesc) {
        descRow.classList.remove('hidden');
        descText.textContent = cleanedDesc;
      } else {
        descRow.classList.add('hidden');
      }
    }

    // 出欠状況
    const attendedStr = String(ev.calendarAttended || '');
    const details = ev.attendeesDetail || {
      yes: attendedStr ? attendedStr.split(',').map(s => s.trim()).filter(Boolean) : [],
      no: [],
      maybe: []
    };

    const yesCount = document.getElementById('edmYesCount');
    const yesNames = document.getElementById('edmYesNames');
    const noCount = document.getElementById('edmNoCount');
    const noNames = document.getElementById('edmNoNames');
    const maybeCount = document.getElementById('edmMaybeCount');
    const maybeNames = document.getElementById('edmMaybeNames');
    const unansweredCount = document.getElementById('edmUnansweredCount');
    const unansweredNames = document.getElementById('edmUnansweredNames');

    if (yesCount && yesNames) {
      const yList = Array.isArray(details.yes) ? details.yes : [];
      yesCount.textContent = yList.length;
      yesNames.textContent = yList.length > 0 ? yList.join(', ') : 'なし';
    }
    if (noCount && noNames) {
      const nList = Array.isArray(details.no) ? details.no : [];
      noCount.textContent = nList.length;
      noNames.textContent = nList.length > 0 ? nList.join(', ') : 'なし';
    }
    if (maybeCount && maybeNames) {
      const mList = Array.isArray(details.maybe) ? details.maybe : [];
      maybeCount.textContent = mList.length;
      maybeNames.textContent = mList.length > 0 ? mList.join(', ') : 'なし';
    }
    if (unansweredCount && unansweredNames) {
      const uList = Array.isArray(details.unanswered) ? details.unanswered : [];
      unansweredCount.textContent = uList.length;
      unansweredNames.textContent = uList.length > 0 ? uList.join(', ') : 'なし';
    }

    // ⚡ モーダル内の「あなたの出欠」ボタン状態をセット
    const myStatus = getMyEventStatus(ev);
    const yesBtn = document.getElementById('edmMockYesBtn');
    const noBtn = document.getElementById('edmMockNoBtn');
    const maybeBtn = document.getElementById('edmMockMaybeBtn');
    if (yesBtn) {
      yesBtn.classList.remove('active');
      if (myStatus === 'yes') yesBtn.classList.add('active');
    }
    if (noBtn) {
      noBtn.classList.remove('active');
      if (myStatus === 'no') noBtn.classList.add('active');
    }
    if (maybeBtn) {
      maybeBtn.classList.remove('active');
      if (myStatus === 'maybe') maybeBtn.classList.add('active');
    }

    // 備品持参状況を描画
    renderModalEquipmentStatus(ev);

    // 活動記録の連携状況を描画
    renderModalBulletinStatus(ev);

    // モーダルを表示
    const overlay = document.getElementById('eventDetailModalOverlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.classList.add('no-scroll');
    }
  } catch (modalErr) {
    console.error('Error opening event detail modal:', modalErr);
  }
}

/**
 * 予定詳細モーダル内の備品持参状況を描画
 * @param {Object} ev
 */
function renderModalEquipmentStatus(ev) {
  const rowEl = document.getElementById('edmEquipmentRow');
  const contentEl = document.getElementById('edmEquipmentContent');
  if (!rowEl || !contentEl) return;

  if (!ev) {
    rowEl.classList.add('hidden');
    return;
  }

  const upcoming = (window.equipmentState && window.equipmentState.upcomingEquipment && window.equipmentState.upcomingEquipment.length > 0)
    ? window.equipmentState.upcomingEquipment
    : (window.initialFullData && window.initialFullData.equipmentData && window.initialFullData.equipmentData.upcomingEquipment ? window.initialFullData.equipmentData.upcomingEquipment : []);

  const cleanEvId = String(ev.id || '').split('@')[0];
  const evDateStr = String(ev.date || '').replace(/-/g, '/');
  const evEq = upcoming.find(item => {
    if (!item) return false;
    const cleanItemId = String(item.eventId || '').split('@')[0];
    const itemDateStr = String(item.eventDate || '').replace(/-/g, '/');
    return (cleanEvId && cleanItemId && cleanEvId === cleanItemId) || (evDateStr && itemDateStr && evDateStr === itemDateStr);
  });

  if (!evEq || !evEq.equipmentStatus || evEq.equipmentStatus.length === 0) {
    rowEl.classList.add('hidden');
    return;
  }

  rowEl.classList.remove('hidden');
  contentEl.replaceChildren();

  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'edm-equipment-chips-container';

  // 備品項目の統合と整理（ボールはチーム所有・個人所有を合算して「ボール: X球」に統一）
  const displayStatusList = [];
  let combinedBallStatus = null;

  (evEq.equipmentStatus || []).forEach(st => {
    const isBall = st.code === 'BALL_TEAM' || st.code === 'BALL_PERSONAL' || (st.ruleType === 'COUNT' && String(st.name || '').includes('ボール'));
    if (isBall) {
      if (!combinedBallStatus) {
        combinedBallStatus = {
          code: 'BALL_TEAM',
          name: 'ボール',
          ruleType: 'COUNT',
          count: st.count || 0,
          isAlert: !!st.isAlert,
          alertLevel: st.alertLevel || 'NONE',
          isResolved: !!st.isResolved,
          assignedMemberId: st.assignedMemberId || null,
          assignedMemberName: st.assignedMemberName || null
        };
      } else {
        if (st.code === 'BALL_PERSONAL' && combinedBallStatus.count === 0) {
          combinedBallStatus.count += (st.count || 0);
        } else if (st.code !== 'BALL_PERSONAL') {
          combinedBallStatus.count = Math.max(combinedBallStatus.count, st.count || 0);
        }
        if (st.isResolved) {
          combinedBallStatus.isResolved = true;
          if (st.assignedMemberName) combinedBallStatus.assignedMemberName = st.assignedMemberName;
        }
        if (st.isAlert && !combinedBallStatus.isResolved) {
          combinedBallStatus.isAlert = true;
          if (st.alertLevel === 'RED') combinedBallStatus.alertLevel = 'RED';
        }
      }
    } else {
      displayStatusList.push(st);
    }
  });

  if (combinedBallStatus) {
    displayStatusList.unshift(combinedBallStatus);
  }

  displayStatusList.forEach(st => {
    const chip = document.createElement('div');

    let chipClass = 'edm-gear-chip';
    if (st.isResolved) {
      chipClass += ' gear-resolved';
    } else if (st.isAlert) {
      chipClass += (st.alertLevel === 'RED' ? ' gear-alert-red' : ' gear-alert-yellow');
    } else {
      chipClass += ' gear-normal';
    }
    chip.className = chipClass;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'gear-chip-title';
    labelSpan.textContent = st.name + ': ';
    chip.appendChild(labelSpan);

    const valSpan = document.createElement('span');
    valSpan.className = 'gear-chip-holder';

    if (st.ruleType === 'COUNT') {
      if (st.isResolved) {
        const proxyText = (st.assignedMemberName && st.assignedMemberName !== '代理' && st.assignedMemberName !== '代理指定済')
          ? `代理: ${st.assignedMemberName}`
          : '代理';
        valSpan.textContent = `${st.count}球 (${proxyText})`;
      } else {
        valSpan.textContent = `${st.count}球` + (st.isAlert ? ' (要持参)' : '');
      }
    } else {
      if (st.isResolved) {
        const proxyText = (st.assignedMemberName && st.assignedMemberName !== '代理' && st.assignedMemberName !== '代理指定済')
          ? `代理: ${st.assignedMemberName}`
          : '代理';
        valSpan.textContent = proxyText;
      } else if (st.assignedMemberName && st.assignedMemberName !== '不在') {
        valSpan.textContent = st.assignedMemberName;
      } else {
        valSpan.textContent = '不在';
      }
    }
    chip.appendChild(valSpan);

    // 不在アラートかつ未解決の場合は「解決」ボタンを表示
    if (st.isAlert && !st.isResolved) {
      const resolveBtn = document.createElement('button');
      resolveBtn.type = 'button';
      resolveBtn.className = 'btn-edm-resolve';
      resolveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 13px; line-height: 1;">task_alt</span><span>解決</span>';
      resolveBtn.title = `${st.name}の持参を「代理」として解決`;
      resolveBtn.onclick = function(e) {
        e.stopPropagation();
        if (typeof openEquipmentResolveModal === 'function') {
          openEquipmentResolveModal(evEq.eventId, evEq.eventDate, st.code, st.name, evEq.eventTitle || (evEq.eventDate + ' ' + evEq.eventCategory), resolveBtn);
        }
      };
      chip.appendChild(resolveBtn);
    }

    chipsContainer.appendChild(chip);
  });

  contentEl.appendChild(chipsContainer);
}

window.updateScheduleModalEquipmentStatus = function() {
  if (window.currentViewingEvent) {
    renderModalEquipmentStatus(window.currentViewingEvent);
  }
};

/**
 * 予定詳細モーダル内の活動記録連携状況を描画
 * @param {Object} ev
 */
function renderModalBulletinStatus(ev) {
  const rowEl = document.getElementById('edmBulletinRow');
  const contentEl = document.getElementById('edmBulletinContent');
  if (!rowEl || !contentEl) return;

  if (!ev) {
    rowEl.classList.add('hidden');
    return;
  }

  const post = (typeof window.getBulletinPostForEvent === 'function')
    ? window.getBulletinPostForEvent(ev.id)
    : null;

  if (post) {
    const updatedBy = post.updatedByName || post.authorName || 'メンバー';
    const postDate = typeof formatDisplayDateWithDay === 'function' ? formatDisplayDateWithDay(post.createdAt) : (post.createdAt ? String(post.createdAt).split(' ')[0] : '');
    contentEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%;">
        <div style="min-width:0; flex:1;">
          <div style="font-size:0.88rem; font-weight:700; color:var(--text-heading); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${typeof escapeHtml === 'function' ? escapeHtml(post.title) : post.title}
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            ${typeof escapeHtml === 'function' ? escapeHtml(updatedBy) : updatedBy} ・ ${postDate}
          </div>
        </div>
        <button type="button" class="map-link-btn" onclick="closeEventDetailModal(); if(typeof openBulletinDetailModal==='function') openBulletinDetailModal('${post.id}')" style="cursor:pointer; padding:4px 10px; font-size:0.78rem; font-weight:700; white-space:nowrap; border-radius:6px; flex-shrink:0;">
          記録を見る
        </button>
      </div>
    `;
    rowEl.classList.remove('hidden');
  } else {
    contentEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%;">
        <span style="font-size:0.82rem; color:var(--text-muted); white-space:nowrap;">まだ記録はありません</span>
        <button type="button" class="map-link-btn" onclick="closeEventDetailModal(); if(typeof openBulletinCreateModalForEvent==='function') { openBulletinCreateModalForEvent('${ev.id}'); } else if(typeof switchTab==='function') { switchTab('bulletin'); }" style="cursor:pointer; padding:4px 10px; font-size:0.78rem; font-weight:700; white-space:nowrap; border-radius:6px; flex-shrink:0;">
          + 記録を書く
        </button>
      </div>
    `;
    rowEl.classList.remove('hidden');
  }
}

window.renderModalBulletinStatus = renderModalBulletinStatus;
window.updateScheduleEventBulletinButton = function() {
  if (window.currentViewingEvent) {
    renderModalBulletinStatus(window.currentViewingEvent);
  }
};

/**
 * 詳細モーダルから直接出欠を変更する
 */
function onModalSetAttendance(status) {
  if (!window.currentViewingEvent) return;
  const ev = window.currentViewingEvent;
  
  setMyAttendance(ev, status);

  const yesBtn = document.getElementById('edmMockYesBtn');
  const noBtn = document.getElementById('edmMockNoBtn');
  const maybeBtn = document.getElementById('edmMockMaybeBtn');
  if (yesBtn) yesBtn.classList.toggle('active', status === 'yes');
  if (noBtn) noBtn.classList.toggle('active', status === 'no');
  if (maybeBtn) maybeBtn.classList.toggle('active', status === 'maybe');
}

/**
 * 予定詳細モーダルを閉じる
 */
function closeEventDetailModal(e) {
  if (e && e.target && e.target.closest('.modal-content') && !e.target.closest('.modal-close')) {
    return;
  }
  closeEventDetailMenu();
  const overlay = document.getElementById('eventDetailModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
  }
}

/**
 * 詳細モーダルの3点メニューの開閉
 */
function toggleEventDetailMenu(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const menu = document.getElementById('eventDetailDropdownMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

/**
 * 予定詳細モーダルの3点リーダーメニューを閉じる
 * @returns {void}
 */
function closeEventDetailMenu() {
  const menu = document.getElementById('eventDetailDropdownMenu');
  if (menu) menu.classList.add('hidden');
}

/**
 * 3点リーダーメニューから「複製」を選択した際、メニューを閉じて複製モーダルを開く
 * @param {Event} [e] - イベントオブジェクト
 * @returns {void}
 */
function onDetailMenuDuplicate(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  closeEventDetailMenu();
  onDuplicateEventClick();
}

/**
 * 3点リーダーメニューから「削除」を選択した際、メニューを閉じて削除確認モーダルを開く
 * @param {Event} [e] - イベントオブジェクト
 * @returns {void}
 */
function onDetailMenuDelete(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  closeEventDetailMenu();
  onDeleteEventClick();
}

/**
 * 詳細モーダルから「編集」ボタンをクリックした時の処理
 */
function onEditEventClick() {
  if (!window.currentViewingEvent) return;
  // 詳細モーダルを閉じて編集モーダルを開く
  closeEventDetailModal();
  openEventEditModal(window.currentViewingEvent, false);
}

/**
 * 詳細モーダルから「複製」ボタンをクリックした時の処理
 */
function onDuplicateEventClick() {
  if (!window.currentViewingEvent) return;
  // 詳細モーダルを閉じて複製（新規）モーダルを開く
  closeEventDetailModal();
  openEventEditModal(window.currentViewingEvent, true);
}

window.pendingDeletePayload = null;
window.pendingDeleteIsFromDetail = false;

/**
 * 削除確認モーダルを開く
 */
function openDeleteConfirmModal(payload, isFromDetailModal, displayText) {
  window.pendingDeletePayload = payload;
  window.pendingDeleteIsFromDetail = isFromDetailModal;

  const targetTextEl = document.getElementById('deleteConfirmTargetText');
  if (targetTextEl) {
    targetTextEl.textContent = '「' + displayText + '」を削除しますか？';
  }

  const overlay = document.getElementById('eventDeleteConfirmModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.classList.add('no-scroll');
  }
}

/**
 * 削除確認モーダルを閉じる
 */
function closeDeleteConfirmModal(e) {
  if (e && e.target && e.target.closest('.modal-content') && !e.target.closest('.modal-close')) {
    return;
  }
  window.pendingDeletePayload = null;
  const overlay = document.getElementById('eventDeleteConfirmModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    const editModal = document.getElementById('eventEditModalOverlay');
    const detailModal = document.getElementById('eventDetailModalOverlay');
    if ((!editModal || !editModal.classList.contains('active')) && (!detailModal || !detailModal.classList.contains('active'))) {
      document.body.classList.remove('no-scroll');
    }
  }
}

/**
 * 詳細モーダルから「削除」ボタンをクリックした時の処理
 */
function onDeleteEventClick() {
  if (!window.currentViewingEvent) return;
  const ev = window.currentViewingEvent;
  const title = ev.title || 'この予定';
  const date = ev.date || '';

  openDeleteConfirmModal({
    eventId: ev.id || null,
    originalDate: ev.date || '',
    originalTitle: ev.title || ''
  }, true, date + ' ' + title);
}

/**
 * 編集モーダルから「削除」ボタンをクリックした時の処理
 */
function onDeleteFromEditModal() {
  const eventId = document.getElementById('eeEventId') ? document.getElementById('eeEventId').value : '';
  const originalDate = document.getElementById('eeOriginalDate') ? document.getElementById('eeOriginalDate').value : '';
  const originalTitle = document.getElementById('eeOriginalTitle') ? document.getElementById('eeOriginalTitle').value : '';
  const title = document.getElementById('eeTitle') ? document.getElementById('eeTitle').value : 'この予定';

  openDeleteConfirmModal({
    eventId: eventId || null,
    originalDate: originalDate,
    originalTitle: originalTitle
  }, false, title);
}

/**
 * 確認モーダルで「削除する」ボタンを押したときの処理
 */
function executeConfirmedDelete() {
  if (!window.pendingDeletePayload) return;

  const payload = window.pendingDeletePayload;
  const isFromDetailModal = window.pendingDeleteIsFromDetail;

  const execBtn = document.getElementById('deleteConfirmExecuteBtn');
  if (execBtn) {
    execBtn.disabled = true;
    execBtn.textContent = '削除中...';
  }


  google.script.run
    .withSuccessHandler(res => {
      if (execBtn) {
        execBtn.disabled = false;
        execBtn.textContent = '削除';
      }

      if (res && res.success) {
        if (window.eventsData && Array.isArray(window.eventsData)) {
          // 📌 IDが存在する場合は ID でピンポイントに1件だけ削除
          if (res.deletedId) {
            const targetId = String(res.deletedId).split('@')[0];
            window.eventsData = window.eventsData.filter(cur => {
              const curId = String(cur.id || '').split('@')[0];
              return curId !== targetId;
            });
          } else {
            // IDがない場合のみ、最初に見つかった1件だけを削除（同日同タイトルの全消しを防止）
            const normDelDate = normalizeDateStr(res.originalDate);
            let removed = false;
            window.eventsData = window.eventsData.filter(cur => {
              if (!removed && normDelDate && normalizeDateStr(cur.date) === normDelDate && String(cur.title || '').trim() === String(res.originalTitle || '').trim()) {
                removed = true;
                return false;
              }
              return true;
            });
          }
        }
        renderCalendar(window.calYear, window.calMonth);
        renderAgendaList();

        closeDeleteConfirmModal();
        if (isFromDetailModal) {
          closeEventDetailModal();
        } else {
          closeEventEditModal();
        }
      } else {
        closeDeleteConfirmModal();
        showAppAlert({ title: '削除エラー', message: '削除に失敗しました: ' + (res ? res.error : '不明なエラー'), isError: true });
      }
    })
    .withFailureHandler(err => {
      if (execBtn) {
        execBtn.disabled = false;
        execBtn.textContent = '削除';
      }
      closeDeleteConfirmModal();
      showAppAlert({ title: '通信エラー', message: 'エラーが発生しました: ' + (err.message || ''), isError: true });
    })
    .deleteCalendarEvent(payload);
}

/**
 * 新規予定作成モーダルを開く
 * 
 * @param {string} [defaultDate] - 初期設定する日付 ("YYYY/MM/DD" or "YYYY-MM-DD")
 */
function openNewEventModal(defaultDate) {
  openEventEditModal(null, true, defaultDate);
}

/**
 * 同日予定選択モーダルから新規予定を追加する
 */
function onAddEventFromDaySelectModal() {
  const targetDate = window.currentDaySelectDate;
  closeDayEventsSelectModal();
  openNewEventModal(targetDate);
}

/**
 * 予定編集・新規作成（複製）モーダルを開く
 * 
 * @param {Object|null} ev - カレンダーイベントデータ（nullの場合は完全な新規作成）
 * @param {boolean} isDuplicate - 複製または新規モードかどうか (true: 新規作成, false: 既存上書き)
 * @param {string} [defaultDate] - 新規作成時の初期日付
 */
function openEventEditModal(ev, isDuplicate, defaultDate) {
  const modalTitle = document.getElementById('eventEditModalTitle');
  const eventIdInput = document.getElementById('eeEventId');
  const duplicateInput = document.getElementById('eeIsDuplicate');
  const origDateInput = document.getElementById('eeOriginalDate');
  const origTitleInput = document.getElementById('eeOriginalTitle');
  const titleInput = document.getElementById('eeTitle');
  const dateInput = document.getElementById('eeDate');
  const allDayCheck = document.getElementById('eeIsAllDay');
  const startTimeInput = document.getElementById('eeStartTime');
  const endTimeInput = document.getElementById('eeEndTime');
  const locInput = document.getElementById('eeLocation');
  const descInput = document.getElementById('eeDescription');
  const submitBtn = document.getElementById('eeSubmitBtn');
  const deleteBtn = document.getElementById('eeDeleteBtn');

  if (!modalTitle || !titleInput || !dateInput) return;

  clearFieldError('eeTitle');
  clearFieldError('eeDate');
  clearFieldError('eeGuestInput');

  const isNew = !ev;
  if (duplicateInput) duplicateInput.value = (isDuplicate || isNew) ? '1' : '0';
  if (origDateInput) origDateInput.value = (ev && ev.date) ? ev.date : '';
  if (origTitleInput) origTitleInput.value = (ev && ev.title) ? ev.title : '';

  if (deleteBtn) {
    deleteBtn.classList.toggle('hidden', Boolean(isDuplicate || isNew));
  }

  if (isNew) {
    modalTitle.textContent = '新規予定の作成';
    if (eventIdInput) eventIdInput.value = '';
    if (submitBtn) submitBtn.textContent = '新規予定として作成';
  } else if (isDuplicate) {
    modalTitle.textContent = '予定の複製 (新規作成)';
    if (eventIdInput) eventIdInput.value = '';
    if (submitBtn) submitBtn.textContent = '新規予定として作成';
  } else {
    modalTitle.textContent = '予定の編集';
    if (eventIdInput) eventIdInput.value = ev.id || '';
    if (submitBtn) submitBtn.textContent = 'カレンダーを更新';
  }

  // フォームに値をセット
  titleInput.value = (ev && ev.title) ? ev.title : '';
  
  // 日付の正規化 (YYYY-MM-DD)
  const dateToUse = (ev && ev.date) ? ev.date : (defaultDate || new Date().toISOString().split('T')[0]);
  const dParts = String(dateToUse).replace(/\//g, '-').split('-');
  if (dParts.length >= 3) {
    dateInput.value = dParts[0] + '-' + dParts[1].padStart(2, '0') + '-' + dParts[2].padStart(2, '0');
  } else {
    dateInput.value = dateToUse;
  }

  // 終日・時刻の正確なパース
  const isAllDay = Boolean(ev && (ev.isAllDay || ev.timeRange === '終日'));
  if (allDayCheck) allDayCheck.checked = isAllDay;
  
  let sTime = '09:00';
  let eTime = '12:00';
  if (ev) {
    if (ev.timeRange && ev.timeRange !== '終日') {
      const m = String(ev.timeRange).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (m) {
        sTime = m[1].padStart(5, '0');
        eTime = m[2].padStart(5, '0');
      }
    } else if (ev.startTimeStr && ev.endTimeStr) {
      sTime = ev.startTimeStr;
      eTime = ev.endTimeStr;
    }
  }

  if (startTimeInput) startTimeInput.value = sTime;
  if (endTimeInput) endTimeInput.value = eTime;
  toggleAllDayInputs();

  // 場所・説明
  if (locInput) locInput.value = (ev && ev.location) ? ev.location : '';
  if (descInput) descInput.value = (ev && ev.description) ? ev.description : '';
  
  window.currentEditGuests = [];
  if (ev && ev.googleGuests) {
    window.currentEditGuests = JSON.parse(JSON.stringify(ev.googleGuests));
    if (isDuplicate) {
      window.currentEditGuests.forEach(g => { g.status = 'UNKNOWN'; });
    }
  }
  renderEditGuestList();

  // モーダル表示
  const overlay = document.getElementById('eventEditModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.classList.add('no-scroll');
  }
}

/**
 * 終日チェックボックス切り替え時の入力欄制御
 */
function toggleAllDayInputs() {
  const allDayCheck = document.getElementById('eeIsAllDay');
  const timeGroup = document.getElementById('eeTimeGroup');
  if (allDayCheck && timeGroup) {
    timeGroup.classList.toggle('hidden', allDayCheck.checked);
  }
}

/**
 * 予定編集モーダルを閉じる
 */
function closeEventEditModal(e) {
  if (e && e.target) {
    const isOverlay = e.target.id === 'eventEditModalOverlay';
    const isCloseBtn = Boolean(e.target.closest('.modal-close') || e.target.closest('.btn-cancel-action'));
    if (!isOverlay && !isCloseBtn) {
      return;
    }
  }
  const overlay = document.getElementById('eventEditModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
    clearFieldError('eeTitle');
    clearFieldError('eeDate');
    clearFieldError('eeGuestInput');
  }
}

window.currentEditGuests = [];

  /**
   * 予定編集モーダルで入力された名前またはメールアドレスをゲスト一覧に追加する
   * @returns {void}
   */
  function addGuestToEditList() {
    const input = document.getElementById('eeGuestInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    
    let targetEmail = val;
    let targetName = val;
    
    // 名簿から検索
    if (window.scheduleRoster) {
      const member = window.scheduleRoster.find(m => m.name === val || m.email === val);
      if (member) {
        targetEmail = member.email;
        targetName = member.name;
      } else if (!val.includes('@')) {
        setFieldError('eeGuestInput', '名簿にない名前です。メールアドレスを入力してください。');
        return;
      }
    } else if (!val.includes('@')) {
      setFieldError('eeGuestInput', '有効なメールアドレスを入力してください。');
      return;
    }
    
    if (targetEmail && targetEmail.includes('@')) {
      clearFieldError('eeGuestInput');
      if (!window.currentEditGuests.find(g => g.email === targetEmail)) {
        window.currentEditGuests.push({ email: targetEmail, name: targetName !== targetEmail ? targetName : '', status: 'UNKNOWN' });
        renderEditGuestList();
      }
      input.value = '';
    } else {
      setFieldError('eeGuestInput', '有効なメールアドレスを入力してください。');
    }
  }

  /**
   * 予定編集モーダルのゲスト一覧から指定されたメールアドレスのゲストを除外する
   * @param {string} email - 除外対象のメールアドレス
   * @returns {void}
   */
  function removeGuestFromEditList(email) {
    window.currentEditGuests = window.currentEditGuests.filter(g => g.email !== email);
    renderEditGuestList();
  }

  /**
   * 予定編集モーダル内のゲスト一覧・招待返答ステータスおよび合計サマリーを描画する
   * @returns {void}
   */
  function renderEditGuestList() {
    const container = document.getElementById('eeGuestList');
    const summary = document.getElementById('eeGuestSummary');
    if (!container || !summary) return;
    
    container.replaceChildren();
    
    const count = window.currentEditGuests.length;
    summary.classList.toggle('hidden', count === 0);
    if (count > 0) {
      // ゲストステータスの集計
      const waitingCount = window.currentEditGuests.filter(g => g.status === 'INVITED' || g.status === 'UNKNOWN').length;
      let summaryText = count + '人のゲスト';
      if (waitingCount > 0) summaryText += ' (返答待ち: ' + waitingCount + '人)';
      summary.textContent = summaryText;
    }

    const tplGuest = document.getElementById('tpl-guest-item');
    window.currentEditGuests.forEach(guest => {
      const initial = (guest.name || guest.email).charAt(0).toUpperCase();
      let statusText = '';
      if (guest.status === 'YES') statusText = '出席';
      else if (guest.status === 'NO') statusText = '欠席';
      else if (guest.status === 'MAYBE') statusText = '未定';
      
      const displayName = guest.name ? `${guest.name} (${guest.email})` : guest.email;
      
      if (tplGuest) {
        const clone = tplGuest.content.cloneNode(true);
        const avatarEl = clone.querySelector('.guest-avatar');
        const emailEl = clone.querySelector('.guest-email');
        const statusEl = clone.querySelector('.guest-status');
        const removeBtn = clone.querySelector('.btn-remove-guest');

        if (avatarEl) {
          if (guest.photoUrl) {
            avatarEl.innerHTML = `<img src="${guest.photoUrl}" alt="" class="guest-avatar-img">`;
          } else {
            avatarEl.innerHTML = `<span class="material-symbols-outlined guest-avatar-icon">person</span>`;
          }
        }
        if (emailEl) emailEl.textContent = displayName;
        if (statusEl) {
          if (statusText) {
            statusEl.textContent = statusText;
            statusEl.classList.remove('hidden');
          } else {
            statusEl.classList.add('hidden');
          }
        }
        if (removeBtn) {
          removeBtn.onclick = () => removeGuestFromEditList(guest.email);
        }
        container.appendChild(clone);
      }
    });
  }

  /**
   * 予定編集・作成フォーム送信処理
   */
  function submitEventEditForm(e) {
  if (e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (err) {}
  }

  const eventId = document.getElementById('eeEventId').value;
  const isDuplicate = document.getElementById('eeIsDuplicate') ? document.getElementById('eeIsDuplicate').value === '1' : false;
  const originalDate = document.getElementById('eeOriginalDate') ? document.getElementById('eeOriginalDate').value : '';
  const originalTitle = document.getElementById('eeOriginalTitle') ? document.getElementById('eeOriginalTitle').value : '';
  const title = document.getElementById('eeTitle').value.trim();
  const date = document.getElementById('eeDate').value;
  const isAllDay = document.getElementById('eeIsAllDay').checked;
  const startTime = document.getElementById('eeStartTime').value;
  const endTime = document.getElementById('eeEndTime').value;
  const location = document.getElementById('eeLocation').value.trim();
  const description = document.getElementById('eeDescription').value.trim();
  const guests = window.currentEditGuests ? window.currentEditGuests.map(g => g.email) : [];

  clearFieldError('eeTitle');
  clearFieldError('eeDate');
  let hasScheduleFormError = false;
  if (!title) {
    setFieldError('eeTitle', 'タイトルを入力してください。');
    hasScheduleFormError = true;
  }
  if (!date) {
    setFieldError('eeDate', '日付を選択してください。');
    hasScheduleFormError = true;
  }
  if (hasScheduleFormError) return;

  const payload = {
    eventId: eventId || null,
    isDuplicate: isDuplicate,
    originalDate: originalDate,
    originalTitle: originalTitle,
    title: title,
    date: date,
    isAllDay: isAllDay,
    startTime: startTime,
    endTime: endTime,
    location: location,
    description: description,
    guests: guests
  };

  const submitBtn = document.getElementById('eeSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';
  }

  google.script.run
    .withSuccessHandler(res => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isDuplicate ? '新規予定として作成' : 'カレンダーを更新';
      }

      if (res && res.success) {
        if (!window.eventsData) window.eventsData = [];

        if (res.event) {
          res.event.date = normalizeDateStr(res.event.date);

          if (res.isNew) {
            window.eventsData.unshift(res.event);
          } else {
            const normOrigDate = normalizeDateStr(payload.originalDate);
            let foundIndex = -1;

            for (let i = 0; i < window.eventsData.length; i++) {
              const cur = window.eventsData[i];
              const isIdMatch = (res.event.id && cur.id && cur.id === res.event.id);
              const isInfoMatch = (normOrigDate && normalizeDateStr(cur.date) === normOrigDate && String(cur.title || '').trim() === String(payload.originalTitle || '').trim());
              const isRefMatch = (window.currentViewingEvent && cur === window.currentViewingEvent);

              if (isIdMatch || isInfoMatch || isRefMatch) {
                foundIndex = i;
                break;
              }
            }

            if (foundIndex >= 0) {
              window.eventsData[foundIndex] = Object.assign({}, window.eventsData[foundIndex], res.event);
              window.currentViewingEvent = window.eventsData[foundIndex];
            } else {
              window.eventsData.unshift(res.event);
              window.currentViewingEvent = res.event;
            }
          }
        }
        
        // カレンダーと今後の予定を即時更新
        renderCalendar(window.calYear, window.calMonth);
        renderAgendaList();

        closeEventEditModal();
      } else {
        showAppAlert({ title: '保存エラー', message: '保存に失敗しました: ' + (res ? res.error : '不明なエラー'), isError: true });
      }
    })
    .withFailureHandler(err => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isDuplicate ? '新規予定として作成' : 'カレンダーを更新';
      }
      showAppAlert({ title: '通信エラー', message: 'エラーが発生しました: ' + (err.message || ''), isError: true });
    })
    .saveCalendarEvent(payload);
}

/**
 * 月を変更する (delta: -1 または 1)
 */
function changeCalMonth(delta) {
  window.calMonth = (window.calMonth !== undefined ? window.calMonth : new Date().getMonth()) + delta;
  if (window.calMonth < 0) {
    window.calMonth = 11;
    window.calYear = (window.calYear || new Date().getFullYear()) - 1;
  } else if (window.calMonth > 11) {
    window.calMonth = 0;
    window.calYear = (window.calYear || new Date().getFullYear()) + 1;
  }
  renderCalendar(window.calYear, window.calMonth);
}

/**
 * 今日の月にジャンプする（今日の日付マスを選択＆フォーカス）
 */
function jumpCalToday() {
  const now = new Date();
  window.calYear = now.getFullYear();
  window.calMonth = now.getMonth();
  const todayStr = formatDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
  window.selectedCalDate = todayStr;
  
  renderCalendar(window.calYear, window.calMonth);

  // 今日のマスにハイライトとフォーカスを適用
  setTimeout(() => {
    const todayCell = document.querySelector('.cal-day-cell.today');
    if (todayCell) {
      document.querySelectorAll('.cal-day-cell').forEach(el => el.classList.remove('selected'));
      todayCell.classList.add('selected');
    }
  }, 10);
}

/**
 * 日付フォーマット補助関数 (YYYY/MM/DD)
 */
function formatDateStr(y, m, d) {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return y + '/' + mm + '/' + dd;
}



// グローバル関数として登録
window.initScheduleView = initScheduleView;
window.renderCalendar = renderCalendar;
window.renderAgendaList = renderAgendaList;
window.changeCalMonth = changeCalMonth;
window.jumpCalToday = jumpCalToday;
window.openEventDetailModal = openEventDetailModal;
window.closeEventDetailModal = closeEventDetailModal;
window.onEditEventClick = onEditEventClick;
window.onDuplicateEventClick = onDuplicateEventClick;
window.onDeleteEventClick = onDeleteEventClick;
window.onDeleteFromEditModal = onDeleteFromEditModal;
window.openDeleteConfirmModal = openDeleteConfirmModal;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
window.executeConfirmedDelete = executeConfirmedDelete;
window.openNewEventModal = openNewEventModal;
window.openEventEditModal = openEventEditModal;
window.closeEventEditModal = closeEventEditModal;
window.toggleAllDayInputs = toggleAllDayInputs;
window.submitEventEditForm = submitEventEditForm;
window.switchScheduleSubTab = switchScheduleSubTab;
window.setScheduleFilter = setScheduleFilter;
window.onModalSetAttendance = onModalSetAttendance;
window.getMyEventStatus = getMyEventStatus;
window.toggleEventDetailMenu = toggleEventDetailMenu;
window.closeEventDetailMenu = closeEventDetailMenu;
window.onDetailMenuDuplicate = onDetailMenuDuplicate;
window.onDetailMenuDelete = onDetailMenuDelete;
window.updateUnansweredBadges = updateUnansweredBadges;

document.addEventListener('click', function (e) {
  const menuWrap = document.querySelector('.event-detail-menu-wrap');
  if (menuWrap && !menuWrap.contains(e.target)) {
    closeEventDetailMenu();
  }
});
