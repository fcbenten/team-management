// ==========================================
// 🛠 共通ユーティリティ関数群 (js_common)
// ==========================================

/**
 * 汎用的なエラーハンドリング（画面へのエラー表示）
 * @param {string} targetId - エラーを表示するDOMのID
 * @param {string} msg - エラーメッセージ
 */
function handleError(targetId, msg) {
  console.error(msg);
  const el = document.getElementById(targetId);
  if (el) {
    if (el.tagName === 'SELECT') {
      el.innerHTML = '<option value="">読み込み失敗</option>';
    } else {
      el.innerHTML = '<div class="card-box error-box text-sm">' + msg + '</div>';
    }
  }
}

/**
 * フィールド単位のエラー表示（インライン赤文字）をセット
 * @param {string} fieldId - 対象input/selectのID
 * @param {string} errorMsg - エラーメッセージ
 */
function setFieldError(fieldId, errorMsg) {
  const inputEl = document.getElementById(fieldId);
  const errEl = document.getElementById('err-' + fieldId);
  if (inputEl) inputEl.classList.add('input-has-error');
  if (errEl) {
    errEl.textContent = errorMsg || '';
    errEl.classList.remove('hidden');
  }
}

/**
 * フィールド単位のエラー表示（インライン赤文字）をクリア
 * @param {string} fieldId - 対象input/selectのID
 */
function clearFieldError(fieldId) {
  const inputEl = document.getElementById(fieldId);
  const errEl = document.getElementById('err-' + fieldId);
  if (inputEl) inputEl.classList.remove('input-has-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
}

let toastTimeoutId = null;
let toastFadeTimeoutId = null;

/**
 * トーストメッセージを非表示にする（廃止対応）
 */
function hideToastMessage() {
  const toast = document.getElementById('app-toast');
  if (toast) {
    toast.style.display = 'none';
    toast.classList.remove('visible', 'show');
  }
}

/**
 * トーストメッセージを表示する（廃止対応）
 * ※モーダルの裏での通知や画面操作妨害を防止するためトースト通知を完全廃止
 * @param {string} message - 表示するメッセージ
 * @param {boolean} isError - エラー用のスタイルにするかどうか
 * @param {number} [duration] - 表示秒数
 */
function showToastMessage(message, isError = false, duration = null) {
  if (isError) {
    console.error('[Error Notification]', message);
  }
  // トースト通知は完全に無効化
  return;
}

window.showToastMessage = showToastMessage;
window.hideToastMessage = hideToastMessage;

/**
 * ローディングスピナーの表示
 */
function showLoadingSpinner() {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = 'flex';
}

/**
 * ローディングスピナーの非表示
 */
function hideLoadingSpinner() {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = 'none';
}

/**
 * 人物の名前を正規化（全角・半角スペースを除去し、小文字化して比較用にする）
 * @param {string} name 
 * @returns {string}
 */
function normalizePersonName(name) {
  return String(name || '').replace(/[\s\u3000]+/g, '').trim().toLowerCase();
}

/**
 * 日付文字列を YYYY/MM/DD フォーマットに変換する
 * @param {string|Date} dateStr 
 * @returns {string}
 */
function normalizeDateStr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return `${d.getFullYear()}/${m}/${day}`;
}

/**
 * 日付を YYYY/MM/DD (曜) の形式にフォーマットする
 * @param {string|Date} dateStr 
 * @returns {string}
 */
function formatDisplayDateWithDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const y = d.getFullYear();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const w = weekDays[d.getDay()];
  return `${y}/${m}/${day} (${w})`;
}

/**
 * 日時を YYYY/MM/DD (曜) HH:mm の形式にフォーマットする（時分まで表示）
 * @param {string|Date} dateVal 
 * @returns {string}
 */
function formatDisplayDateTimeWithDay(dateVal) {
  if (!dateVal) return '';
  let d = null;
  if (dateVal instanceof Date) {
    d = dateVal;
  } else if (typeof dateVal === 'string') {
    const cleanStr = dateVal.trim();
    const match = cleanStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
      const yyyy = parseInt(match[1], 10);
      const mm = parseInt(match[2], 10) - 1;
      const dd = parseInt(match[3], 10);
      const hh = match[4] !== undefined ? parseInt(match[4], 10) : null;
      const min = match[5] !== undefined ? parseInt(match[5], 10) : null;
      const ss = match[6] !== undefined ? parseInt(match[6], 10) : 0;
      const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
      if (hh !== null && min !== null) {
        d = new Date(yyyy, mm, dd, hh, min, ss);
        if (!isNaN(d.getTime())) {
          const w = weekDays[d.getDay()];
          const pad = n => ('0' + n).slice(-2);
          return `${yyyy}/${pad(mm + 1)}/${pad(dd)} (${w}) ${pad(hh)}:${pad(min)}`;
        }
      } else {
        d = new Date(yyyy, mm, dd);
        if (!isNaN(d.getTime())) {
          const w = weekDays[d.getDay()];
          const pad = n => ('0' + n).slice(-2);
          return `${yyyy}/${pad(mm + 1)}/${pad(dd)} (${w})`;
        }
      }
    }
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  if (d && !isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const w = weekDays[d.getDay()];
    const hh = ('0' + d.getHours()).slice(-2);
    const min = ('0' + d.getMinutes()).slice(-2);
    return `${yyyy}/${mm}/${dd} (${w}) ${hh}:${min}`;
  }

  return String(dateVal);
}

/**
 * バックエンド（GAS）のAPIをPromiseでラップして呼び出す
 * @param {string} functionName - 呼び出すGASの関数名（例：'EventController.getEventsWithMatchData'）
 * @param {...any} args - 関数に渡す引数
 * @returns {Promise<any>}
 */
function callBackendAPI(functionName, ...args) {
  return new Promise((resolve, reject) => {
    // google.script.run を使って動的に関数を呼び出す
    let runner = google.script.run
      .withSuccessHandler((result) => resolve(result))
      .withFailureHandler((error) => reject(error));
    
    // ネストされた関数（例: "EventController.doSomething"）への対応は
    // クライアント側の google.script.run ではドット記法を直接呼べない場合があります。
    // そのため、バックエンド側にルーター関数を用意するか、
    // GAS側は global 空間に展開した関数を直接呼ぶ形にする必要があります。
    // 現状は既存のAPI関数（関数名）を直接呼び出します。
    if (typeof runner[functionName] === 'function') {
      runner[functionName](...args);
    } else {
      reject(new Error('Backend function not found: ' + functionName));
    }
  });
}

/**
 * 選手名の空白正規化
 * 苗字と名前の間の全角空白（\u3000）を半角空白に変換し、連続する空白を1つに集約、前後の空白をトリム
 * @param {string} raw
 * @returns {string}
 */
function normalizeMemberName(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * メンバーのアバター画像URLを取得する共通関数
 * メンバーオブジェクト、または選手名（文字列）から最適なアバター画像URLを解決します。
 * @param {Object|string} memberOrName - メンバーオブジェクト（{name, avatarUrl, ...}）または名前文字列
 * @returns {string} 画像URL（未設定の場合は空文字）
 */
function getMemberAvatarUrl(memberOrName) {
  if (!memberOrName) return '';

  let rawName = '';
  let directAvatar = '';

  if (typeof memberOrName === 'object') {
    rawName = memberOrName.name || memberOrName.memberName || '';
    directAvatar = memberOrName.avatarUrl || memberOrName.avatar || memberOrName.memberAvatarUrl || '';
  } else {
    rawName = String(memberOrName);
  }

  rawName = String(rawName || '').trim();
  if (!rawName || rawName === '未割当') return '';

  // 1. オブジェクトに直接 avatarUrl が含まれていればそれを最優先
  if (directAvatar) return directAvatar;

  const normalizedName = normalizeMemberName(rawName);
  const cleanName = rawName.replace(/[\s\u3000]+/g, '');

  // 2. window.playerAvatarMap / window.playerAvatars からの取得
  const map = window.playerAvatarMap || window.playerAvatars;
  if (map) {
    if (map[rawName]) return map[rawName];
    if (map[normalizedName]) return map[normalizedName];
    if (map[cleanName]) return map[cleanName];
    for (const [k, v] of Object.entries(map)) {
      if (k && v && (normalizeMemberName(k) === normalizedName || k.replace(/[\s\u3000]+/g, '') === cleanName)) {
        return v;
      }
    }
  }

  // 3. キャッシュされた名簿リスト（adminMemberList, scheduleRoster）からの取得
  const rosters = [window.adminMemberList, window.scheduleRoster];
  for (const list of rosters) {
    if (Array.isArray(list)) {
      const found = list.find(m => m && (
        m.name === rawName || 
        normalizeMemberName(m.name) === normalizedName || 
        String(m.name).replace(/[\s\u3000]+/g, '') === cleanName
      ));
      if (found && (found.avatarUrl || found.avatar)) {
        return found.avatarUrl || found.avatar;
      }
    }
  }

  // 4. 現在ログイン中のユーザー
  if (window.currentUser && window.currentUser.avatarUrl) {
    const curName = window.currentUser.name || '';
    if (curName === rawName || normalizeMemberName(curName) === normalizedName || curName.replace(/[\s\u3000]+/g, '') === cleanName) {
      return window.currentUser.avatarUrl;
    }
  }

  return '';
}

/**
 * メンバーがOB（退団者）または集計除外対象か判定する共通ヘルパー
 * @param {string} name - 選手名
 * @returns {boolean} OB・過去選手・特殊枠なら true、現役部員なら false
 */
function isPastMember(name) {
  if (!name) return true;
  const clean = String(name).replace(/[\s\u3000]+/g, '').toLowerCase();
  if (!clean || clean === 'og' || clean === '助っ人' || clean === '不明' || clean === '-' || clean === 'なし' || clean === '名前' || clean === '氏名') {
    return true;
  }

  // 1. adminMemberList (または initialFullData.adminRoster) から判定
  const adminList = (window.adminMemberList && window.adminMemberList.length > 0)
    ? window.adminMemberList
    : (window.initialFullData && window.initialFullData.adminRoster);
  if (adminList && Array.isArray(adminList) && adminList.length > 0) {
    const found = adminList.find(m => String(m.name || '').replace(/[\s\u3000]+/g, '').toLowerCase() === clean);
    if (found) {
      return !!found.isPast || found.memberType === 'PAST' || found.role === 'OB';
    }
  }

  // 2. roster (scheduleRoster または initialFullData.roster) から判定
  // roster に登録されている選手は正規の現役部員（休部中も含む）
  const roster = (window.scheduleRoster && window.scheduleRoster.length > 0)
    ? window.scheduleRoster
    : (window.initialFullData && window.initialFullData.roster);
  if (roster && Array.isArray(roster) && roster.length > 0) {
    const inRoster = roster.some(m => String(m.name || '').replace(/[\s\u3000]+/g, '').toLowerCase() === clean);
    if (inRoster) {
      return false; // 現役部員
    }
    // 名簿がロードされているのに roster に存在しない選手は OB または過去の選手
    return true;
  }

  // 3. nameToMember 辞書（Supabase Direct の全メンバー逆引き）
  if (window.nameToMember) {
    for (const [k, v] of Object.entries(window.nameToMember)) {
      if (k && v && String(k).replace(/[\s\u3000]+/g, '').toLowerCase() === clean) {
        return !!v.isPast || v.memberType === 'PAST' || v.role === 'OB';
      }
    }
  }

  return false;
}

window.isPastMember = isPastMember;
window.normalizeMemberName = normalizeMemberName;
window.getMemberAvatarUrl = getMemberAvatarUrl;
window.normalizeDateStr = normalizeDateStr;
window.formatDisplayDateWithDay = formatDisplayDateWithDay;
window.handleError = handleError;
window.setFieldError = setFieldError;
window.clearFieldError = clearFieldError;

/**
 * メンバー情報が変更（追加・更新・復帰・削除）された際に、
 * 全画面のグローバル名簿キャッシュおよびマッピングを即時同期・更新する
 * @param {Array} roster - 最新の管理者用名簿（全部員、OB含む）
 */
function syncUpdatedMemberList(roster) {
  if (!Array.isArray(roster) || roster.length === 0) return;

  // 1. 管理者名簿（全部員、OB含む）
  window.adminMemberList = roster;
  try { localStorage.setItem('fcb_cached_admin_roster', JSON.stringify(roster)); } catch (e) {}

  // 2. 通常名簿（現役・休部中のみ、OBは除外）
  const activeRoster = roster.filter(m => !m.isPast && m.memberType !== 'PAST' && m.role !== 'OB');
  window.scheduleRoster = activeRoster;
  try { localStorage.setItem('fcb_cached_roster', JSON.stringify(activeRoster)); } catch (e) {}

  // 3. 各種マッピング辞書（playerNumberMap, playerPositionsMap, playerAvatarMap, nameToMember）を更新
  window.playerNumberMap = window.playerNumberMap || {};
  window.playerPositionsMap = window.playerPositionsMap || {};
  window.playerAvatarMap = window.playerAvatarMap || {};
  window.playerAvatars = window.playerAvatars || {};
  window.nameToMember = window.nameToMember || {};

  roster.forEach(m => {
    if (!m || !m.name) return;
    const numVal = (m.number !== null && m.number !== '' && !isNaN(m.number)) ? Number(m.number) : null;
    if (numVal !== null) {
      window.playerNumberMap[m.name] = numVal;
    }
    if (m.position) {
      window.playerPositionsMap[m.name] = m.position;
    }
    if (m.avatarUrl) {
      window.playerAvatarMap[m.name] = m.avatarUrl;
      window.playerAvatars[m.name] = m.avatarUrl;
    }
    window.nameToMember[m.name] = m;
  });

  // 4. initialFullData の整合性維持
  if (window.initialFullData) {
    window.initialFullData.adminRoster = roster;
    window.initialFullData.roster = activeRoster;
    if (window.initialFullData.playerNumbers) {
      Object.assign(window.initialFullData.playerNumbers, window.playerNumberMap);
    }
    if (window.initialFullData.playerPositions) {
      Object.assign(window.initialFullData.playerPositions, window.playerPositionsMap);
    }
  }

  // 5. ランキング用の基本選手リスト（window.teamStatsData）も最新の現役部員で同期
  if (Array.isArray(window.teamStatsData)) {
    window.teamStatsData = activeRoster.map(m => ({ name: m.name, number: m.number, position: m.position }));
  }

  // 6. スケジュール出欠候補などの更新
  if (typeof updateScheduleMemberListOptions === 'function') {
    updateScheduleMemberListOptions(activeRoster);
  }

  // 7. メンバー一覧画面の再描画
  if (typeof renderMembersList === 'function') {
    renderMembersList(window.adminMemberList);
  }

  // 8. ランキングとスタッツ（個人成績）の再集計・再描画
  if (typeof filterAndRenderRankings === 'function') {
    filterAndRenderRankings();
  }
  if (typeof filterAndRenderPersonalStats === 'function') {
    filterAndRenderPersonalStats();
  }
}
window.syncUpdatedMemberList = syncUpdatedMemberList;

// ==========================================
// 全画面共通 汎用カスタム確認/通知ダイアログ
// ==========================================
let appConfirmResolver = null;

/**
 * 汎用確認ダイアログ（confirm の完全代替）
 * @param {Object|string} options - { title, message, okText, cancelText, isDanger, icon } または メッセージ文字列
 * @returns {Promise<boolean>} OKなら true、キャンセルなら false
 */
function showAppConfirm(options) {
  return new Promise((resolve) => {
    appConfirmResolver = resolve;
    let title = '確認';
    let message = '';
    let okText = 'OK';
    let cancelText = 'キャンセル';
    let isDanger = false;
    let icon = 'help_outline';

    if (typeof options === 'string') {
      message = options;
    } else if (options && typeof options === 'object') {
      if (options.title) title = options.title;
      if (options.message) message = options.message;
      if (options.okText) okText = options.okText;
      if (options.cancelText) cancelText = options.cancelText;
      if (options.isDanger) isDanger = !!options.isDanger;
      if (options.icon) icon = options.icon;
    }

    const modal = document.getElementById('appConfirmModal');
    const titleEl = document.getElementById('appConfirmTitle');
    const msgEl = document.getElementById('appConfirmMessage');
    const okBtn = document.getElementById('appConfirmBtnOk');
    const cancelBtn = document.getElementById('appConfirmBtnCancel');
    const iconEl = document.getElementById('appConfirmIcon');
    const iconWrap = document.getElementById('appConfirmIconWrap');

    if (!modal) {
      resolve(false);
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
      okBtn.textContent = okText;
      if (isDanger) {
        okBtn.className = 'btn-primary-action logout-btn logout-btn-danger';
      } else {
        okBtn.className = 'btn-primary-action logout-btn';
      }
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;
    if (iconEl) iconEl.textContent = icon;
    if (iconWrap) {
      iconWrap.className = isDanger ? 'app-dialog-icon-wrap is-danger' : 'app-dialog-icon-wrap';
    }

    modal.classList.add('active');
  });
}

function handleAppConfirmResult(result) {
  const modal = document.getElementById('appConfirmModal');
  if (modal) modal.classList.remove('active');
  if (appConfirmResolver) {
    const fn = appConfirmResolver;
    appConfirmResolver = null;
    fn(result);
  }
}

function appConfirmModalCancel(e) {
  if (e && e.target && e.target.id === 'appConfirmModal') {
    handleAppConfirmResult(false);
  }
}

let appAlertResolver = null;

/**
 * 汎用通知ダイアログ（alert の完全代替）
 * @param {Object|string} options - { title, message, okText, isError, icon } または メッセージ文字列
 * @returns {Promise<void>}
 */
function showAppAlert(options) {
  return new Promise((resolve) => {
    appAlertResolver = resolve;
    let title = 'お知らせ';
    let message = '';
    let okText = '閉じる';
    let isError = false;
    let icon = 'info';

    if (typeof options === 'string') {
      message = options;
    } else if (options && typeof options === 'object') {
      if (options.title) title = options.title;
      if (options.message) message = options.message;
      if (options.okText) okText = options.okText;
      if (options.isError) {
        isError = !!options.isError;
        title = options.title || 'エラー';
        icon = 'error_outline';
      }
      if (options.icon) icon = options.icon;
    }

    const modal = document.getElementById('appAlertModal');
    const titleEl = document.getElementById('appAlertTitle');
    const msgEl = document.getElementById('appAlertMessage');
    const okBtn = document.getElementById('appAlertBtnOk');
    const iconEl = document.getElementById('appAlertIcon');
    const iconWrap = document.getElementById('appAlertIconWrap');

    if (!modal) {
      resolve();
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) okBtn.textContent = okText;
    if (iconEl) iconEl.textContent = icon;
    if (iconWrap) {
      iconWrap.className = isError ? 'app-dialog-icon-wrap is-danger' : 'app-dialog-icon-wrap';
    }

    modal.classList.add('active');
  });
}

function closeAppAlertModal() {
  const modal = document.getElementById('appAlertModal');
  if (modal) modal.classList.remove('active');
  if (appAlertResolver) {
    const fn = appAlertResolver;
    appAlertResolver = null;
    fn();
  }
}

function appAlertModalClose(e) {
  if (e && e.target && e.target.id === 'appAlertModal') {
    closeAppAlertModal();
  }
}

window.showAppConfirm = showAppConfirm;
window.handleAppConfirmResult = handleAppConfirmResult;
window.appConfirmModalCancel = appConfirmModalCancel;
window.showAppAlert = showAppAlert;
window.closeAppAlertModal = closeAppAlertModal;
window.appAlertModalClose = appAlertModalClose;

// ブラウザ標準 alert をカスタムモーダルにオーバーライド
if (typeof window !== 'undefined') {
  window.alert = function(msg) {
    showAppAlert(msg);
  };
}

// ==========================================
// モーダル表示時の画面横ズレ・ガタつき完全防止
// ==========================================
let cachedScrollbarWidth = 0;

/**
 * 現在のブラウザのスクロールバー幅を計測し、CSSカスタムプロパティに反映する
 * @returns {void}
 */
function updateScrollbarWidth() {
  if (document.body && document.body.classList && typeof document.body.classList.contains === 'function' && !document.body.classList.contains('no-scroll')) {
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    if (sbWidth > 0) {
      cachedScrollbarWidth = sbWidth;
      document.documentElement.style.setProperty('--scrollbar-width', sbWidth + 'px');
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', updateScrollbarWidth);
}

/**
 * モーダル表示時に背面のスクロールを禁止し、スクロールバー消失による画面の横揺れを防止する
 * @returns {void}
 */
function lockBodyScroll() {
  if (document.body && document.body.classList) {
    document.body.classList.add('no-scroll');
  }
  if (document.documentElement && document.documentElement.classList) {
    document.documentElement.classList.add('no-scroll');
  }
}

/**
 * すべてのモーダルが閉じた際に背面のスクロールロックを解除する
 * @returns {void}
 */
function unlockBodyScroll() {
  const activeModals = document.querySelectorAll('.modal-overlay.active:not(.hidden), .avatar-lightbox-overlay:not(.hidden)');
  if (activeModals.length === 0) {
    if (document.body && document.body.classList) {
      document.body.classList.remove('no-scroll');
    }
    if (document.documentElement && document.documentElement.classList) {
      document.documentElement.classList.remove('no-scroll');
    }
    if (document.body && document.body.style.paddingRight) {
      document.body.style.paddingRight = '';
    }
  }
}

// どのモーダルが直接 classList.add('no-scroll') を呼んでも自動検知
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const setupScrollObserver = () => {
    const observer = new MutationObserver(() => {
      const isLocked = document.body && document.body.classList && typeof document.body.classList.contains === 'function' && document.body.classList.contains('no-scroll');
      if (isLocked) {
        if (document.documentElement && document.documentElement.classList && !document.documentElement.classList.contains('no-scroll')) {
          document.documentElement.classList.add('no-scroll');
        }
      } else {
        if (document.documentElement && document.documentElement.classList && document.documentElement.classList.contains('no-scroll')) {
          document.documentElement.classList.remove('no-scroll');
        }
        if (document.body && document.body.style.paddingRight) {
          document.body.style.paddingRight = '';
        }
      }
    });
    if (document.body) {
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupScrollObserver);
  } else {
    setupScrollObserver();
  }
}

window.lockBodyScroll = lockBodyScroll;
window.unlockBodyScroll = unlockBodyScroll;
window.updateScrollbarWidth = updateScrollbarWidth;
