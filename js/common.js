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
 * GASバックエンドの許可済みAPI（Google連携）をPromiseで呼び出す互換ラッパー
 * @param {string} functionName - 呼び出す許可済みGAS関数名
 * @param {...any} args - 関数に渡す引数
 * @returns {Promise<any>}
 */
function callBackendAPI(functionName, ...args) {
  if (window.GasApi && typeof window.GasApi.call === 'function') {
    return window.GasApi.call(functionName, ...args);
  }
  return Promise.reject(new Error('GasApi is not initialized: ' + functionName));
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
    lockBodyScroll();
  });
}

function handleAppConfirmResult(result) {
  const modal = document.getElementById('appConfirmModal');
  if (modal) modal.classList.remove('active');
  unlockBodyScroll();
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
    lockBodyScroll();
  });
}

function closeAppAlertModal() {
  const modal = document.getElementById('appAlertModal');
  if (modal) modal.classList.remove('active');
  unlockBodyScroll();
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

var _isReportingSystemError = false;
var _errorReportCooldownMap = {};
var ERROR_REPORT_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * エラー内容が「ユーザー向けの安全な業務エラー」か「マスク対象の内部/システムエラー」かを判定する。
 */
function classifyErrorSafety(errOrMsg) {
  var raw = '';
  var stack = '';
  if (typeof errOrMsg === 'string') {
    raw = errOrMsg;
  } else if (errOrMsg && typeof errOrMsg === 'object') {
    raw = errOrMsg.message || errOrMsg.error || '';
    stack = errOrMsg.stack || '';
  }
  var msg = String(raw || '').trim();
  var isTransientNetwork = /(Failed to fetch|Load failed|Network request failed|NetworkError|AbortError|timeout|ECONNREFUSED)/i.test(msg);

  if (!msg) {
    var hasEmptySystemSignal = (errOrMsg instanceof Error) || errOrMsg == null ||
      (typeof errOrMsg === 'object' && !('registered' in errOrMsg));
    return { isSafe: false, msg: '', stack: stack, isTransientNetwork: false, isEmptySystem: hasEmptySystemSignal };
  }

  // 例外クラス名・PostgRESTコード・DB制約・ネットワーク生文言・[object Object]等をマスク対象とする
  var unsafePatterns = [
    /\b(Exception|Error|TypeError|ReferenceError|SyntaxError|NetworkError|AbortError|PGRST\d+)\b/i,
    /(violates |row-level security|constraint|duplicate key|foreign key|syntax error|relation "|column "|Failed to fetch|Load failed|Network request failed|timeout|ECONNREFUSED|status code \d+)/i,
    /[A-Za-z0-9_]+\.[A-Za-z0-9_]+Error/,
    /^\s*エラー\s*[:：]/,
    /\[object Object\]/i
  ];
  for (var i = 0; i < unsafePatterns.length; i++) {
    if (unsafePatterns[i].test(msg)) {
      return { isSafe: false, msg: msg, stack: stack, isTransientNetwork: isTransientNetwork, isEmptySystem: false };
    }
  }

  // 日本語（ひらがな・カタカナ・漢字）を含まない英語/記号のみのエラーは表示しない
  if (!/[\u3040-\u30ff\u4e00-\u9faf]/.test(msg)) {
    return { isSafe: false, msg: msg, stack: stack, isTransientNetwork: isTransientNetwork, isEmptySystem: false };
  }

  return { isSafe: true, msg: msg, stack: stack, isTransientNetwork: false, isEmptySystem: false };
}

function inferActiveScreenLabel() {
  try {
    var activeNav = document.querySelector('.nav-item.active');
    if (activeNav) {
      if (typeof activeNav.cloneNode === 'function') {
        var cloned = activeNav.cloneNode(true);
        var icons = cloned.querySelectorAll ? cloned.querySelectorAll('.material-symbols-outlined') : [];
        for (var i = 0; i < icons.length; i++) {
          if (icons[i].parentNode) icons[i].parentNode.removeChild(icons[i]);
        }
        var cleaned = String(cloned.textContent || '').replace(/\s+/g, ' ').trim();
        if (cleaned) return cleaned;
      }
      if (activeNav.textContent) {
        return String(activeNav.textContent).replace(/\s+/g, ' ').trim();
      }
    }
  } catch (e) {}
  return 'PWA';
}

/**
 * 想定外システムエラーを Supabase (system_error_logs) に記録し、代表（role='代表'）へ LINE 通知する。
 * 同一内容の連投防止（5分クールダウン）および再帰防止ガード付き。
 */
function reportSystemError(contextName, errOrMsg, opts) {
  opts = opts || {};
  if (_isReportingSystemError) return Promise.resolve({ skipped: true, reason: 'reentrant' });
  if (typeof window === 'undefined' || !window.SupabaseErrorLogger || typeof window.SupabaseErrorLogger.reportAndNotify !== 'function') {
    return Promise.resolve({ skipped: true, reason: 'no_logger' });
  }

  var info = classifyErrorSafety(errOrMsg);
  var rawMessage = info.msg || (errOrMsg && typeof errOrMsg === 'object' ? JSON.stringify(errOrMsg) : String(errOrMsg || 'Unknown error'));
  var screen = contextName || inferActiveScreenLabel();
  var actionName = opts.actionName || screen;
  var dedupKey = 'fcb_err_' + screen + '::' + rawMessage.slice(0, 80);
  var now = Date.now();

  if (_errorReportCooldownMap[dedupKey] && (now - _errorReportCooldownMap[dedupKey] < ERROR_REPORT_COOLDOWN_MS)) {
    return Promise.resolve({ skipped: true, reason: 'cooldown' });
  }
  try {
    var prevTs = Number(sessionStorage.getItem(dedupKey) || 0);
    if (prevTs && (now - prevTs < ERROR_REPORT_COOLDOWN_MS)) {
      _errorReportCooldownMap[dedupKey] = prevTs;
      return Promise.resolve({ skipped: true, reason: 'cooldown' });
    }
    sessionStorage.setItem(dedupKey, String(now));
  } catch (e) {}
  _errorReportCooldownMap[dedupKey] = now;

  var isOffline = (typeof navigator !== 'undefined' && navigator.onLine === false);
  var isTransient = Boolean(opts.isTransientNetwork || info.isTransientNetwork || isOffline);
  var u = (typeof window !== 'undefined' && window.currentUser) ? window.currentUser : {};

  _isReportingSystemError = true;
  return Promise.resolve()
    .then(function () {
      return window.SupabaseErrorLogger.reportAndNotify({
        screen: screen,
        actionName: actionName,
        errorMessage: rawMessage,
        stackTrace: info.stack || opts.stackTrace || '',
        memberId: u.id || u.memberId || null,
        memberName: u.name || '',
        userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '',
        notifyLine: !isTransient,
        forceLineNotify: Boolean(opts.forceLineNotify)
      });
    })
    .catch(function (reportErr) {
      console.warn('reportSystemError failed safely:', reportErr);
      return { logged: false, notified: false };
    })
    .finally(function () {
      _isReportingSystemError = false;
    });
}
window.reportSystemError = reportSystemError;

var ADMIN_CONTACT_NOTE = '※改善しない場合は管理者へお問い合わせください。';

/**
 * 画面全体の未捕捉エラーハンドラで無視すべきブラウザ・拡張機能由来の無害ノイズかを判定する。
 */
function isHarmlessGlobalError(errOrMsg, ev) {
  var msg = '';
  if (typeof errOrMsg === 'string') {
    msg = errOrMsg;
  } else if (errOrMsg && typeof errOrMsg === 'object') {
    msg = errOrMsg.message || errOrMsg.error || String(errOrMsg);
  }
  msg = String(msg || '').trim();

  if (/(ResizeObserver loop|Script error\.?)/i.test(msg)) return true;
  if (errOrMsg && errOrMsg.name === 'AbortError') return true;
  if (/\bAbortError\b/i.test(msg)) return true;

  var filename = (ev && ev.filename) ? String(ev.filename) : '';
  if (/^(chrome-extension|moz-extension|safari-extension):\/\//i.test(filename)) return true;
  if (msg === 'Script error.' && !filename) return true;

  return false;
}

/**
 * 内部例外やDB・ネットワーク生エラーをマスクし、画面表示用の安全な日本語メッセージを返す。
 * 意図した業務エラー（日本語メッセージ）のみをそのまま表示し、不明・例外メッセージは fallbackMsg＋管理者案内へ置き換え裏でシステム通知を行う。
 */
function getSafeErrorMessage(errOrMsg, fallbackMsg, contextName) {
  var fallback = fallbackMsg || '処理に失敗しました。しばらく経ってから再度お試しください。';
  var info = classifyErrorSafety(errOrMsg);
  if (info.isSafe) return info.msg;

  if (info.msg || info.isEmptySystem) {
    reportSystemError(contextName || inferActiveScreenLabel(), errOrMsg, {
      isTransientNetwork: info.isTransientNetwork,
      stackTrace: info.stack
    });
  }
  if (!fallback.includes('管理者へお問い合わせ')) {
    return fallback + '\n' + ADMIN_CONTACT_NOTE;
  }
  return fallback;
}
window.getSafeErrorMessage = getSafeErrorMessage;

/**
 * 未捕捉のJS実行エラー発生時に、既にダイアログが開いていなければメンバー向けの案内ダイアログを表示する。
 */
function showUnexpectedRuntimeAlert() {
  try {
    var modal = document.getElementById('appAlertModal');
    if (modal && modal.classList.contains('active')) return;
    if (typeof showAppAlert === 'function') {
      showAppAlert({
        title: 'エラーが発生しました',
        message: '予期しないエラーが発生しました。画面を再読み込みして再度お試しください。\n' + ADMIN_CONTACT_NOTE,
        isError: true
      });
    }
  } catch (e) {}
}

function handleGlobalRuntimeError(errOrMsg, actionName, ev) {
  if (!errOrMsg || isHarmlessGlobalError(errOrMsg, ev)) return;
  reportSystemError(inferActiveScreenLabel(), errOrMsg, { actionName: actionName })
    .then(function (res) {
      if (!res || res.reason !== 'cooldown') {
        showUnexpectedRuntimeAlert();
      }
    });
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('error', function (ev) {
    var errObj = (ev && ev.error) || (ev && ev.message) || null;
    handleGlobalRuntimeError(errObj, 'window.onerror', ev);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev && ev.reason;
    handleGlobalRuntimeError(reason, 'unhandledrejection', ev);
  });
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

/**
 * 全モーダル共通の背面スクロール伝播（ホイール／タッチ）完全抑止
 */
(function initGlobalModalScrollLock() {
  if (typeof document === 'undefined') return;

  let touchStartY = 0;

  function getActiveModalOverlay() {
    const active = document.querySelectorAll('.modal-overlay.active:not(.hidden), .avatar-lightbox-overlay:not(.hidden)');
    return active.length > 0 ? active[active.length - 1] : null;
  }

  function findScrollableTarget(target, modalOverlay) {
    if (!target || typeof target.closest !== 'function' || !modalOverlay) return null;
    let cur = target;
    while (cur && cur !== modalOverlay && cur !== document.body) {
      if (cur.nodeType === 1) {
        const style = window.getComputedStyle(cur);
        const oy = style ? style.overflowY : '';
        const isScrollStyle = oy === 'auto' || oy === 'scroll';
        if ((isScrollStyle || cur.classList.contains('modal-body')) && cur.scrollHeight > cur.clientHeight + 1) {
          return cur;
        }
      }
      cur = cur.parentElement;
    }
    return null;
  }

  document.addEventListener('touchstart', function(e) {
    if (e.touches && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true, capture: true });

  document.addEventListener('wheel', function(e) {
    const activeModal = getActiveModalOverlay();
    if (!activeModal) return;
    if (!activeModal.contains(e.target)) {
      e.preventDefault();
      return;
    }
    const scrollable = findScrollableTarget(e.target, activeModal);
    if (!scrollable) {
      e.preventDefault();
      return;
    }
    const atTop = scrollable.scrollTop <= 0 && e.deltaY < 0;
    const atBottom = (scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1) && e.deltaY > 0;
    if (atTop || atBottom) {
      e.preventDefault();
    }
  }, { passive: false, capture: true });

  document.addEventListener('touchmove', function(e) {
    const activeModal = getActiveModalOverlay();
    if (!activeModal) return;
    if (!activeModal.contains(e.target) || e.target === activeModal) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    const scrollable = findScrollableTarget(e.target, activeModal);
    if (!scrollable) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (e.touches && e.touches.length === 1) {
      const diffY = e.touches[0].clientY - touchStartY;
      const atTop = scrollable.scrollTop <= 0 && diffY > 0;
      const atBottom = (scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1) && diffY < 0;
      if (atTop || atBottom) {
        if (e.cancelable) e.preventDefault();
      }
    }
  }, { passive: false, capture: true });
})();

(function initGlobalTouchFeedback() {
  if (typeof document === 'undefined' || window.__globalTouchFeedbackInitialized) return;
  window.__globalTouchFeedbackInitialized = true;

  const TOUCH_SELECTOR = [
    '.schedule-agenda-card',
    '.schedule-card-clickable',
    '.result-card',
    '.match-card',
    '.bulletin-post-card',
    '.home-pinned-card',
    '.home-recent-bulletin-card',
    '.stats-table tbody tr',
    '.stats-table th',
    '.cal-day-cell',
    '.cal-event-item',
    '.ob-accordion-header',
    '.profile-settings-nav-btn',
    '.notif-radio-card',
    '.modal-back-btn',
    '.modal-close',
    '.header-user-icon-btn',
    '.profile-avatar-preview-box',
    '.btn-avatar-select',
    '.btn-avatar-delete',
    '.nav-item',
    '.sidebar-user-btn',
    '.logout-icon-btn',
    '.sub-tab',
    '.filter-pill-btn',
    '.same-day-tab-btn',
    '.home-section-link',
    '.btn',
    '.btn-primary-action',
    '.btn-cancel-action',
    '.btn-outline',
    '.btn-add',
    '.btn-del',
    '.btn-create-post',
    '.btn-load-more',
    '.btn-refresh-equipment',
    '.btn-add-equipment',
    '.btn-item-edit',
    '.btn-banner-resolve',
    '.btn-gcp-header-link',
    '.btn-add-member',
    '.btn-member-edit',
    '.btn-member-restore',
    '.cal-nav-btn',
    '.cal-today-btn',
    '.btn-cal-add-event',
    '.btn-primary-sm',
    '.btn-attend-choice',
    '.btn-inline-attend',
    '.btn-card-read-summary',
    '.btn-linked-event-action',
    '.bdm-action-btn',
    '.notice-banner-action-link',
    '.notice-banner-dismiss-btn',
    '#btnSaveNotificationSettings'
  ].join(', ');

  let activeEl = null;
  let clearTimer = null;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let cancelledByMove = false;
  let touchEnded = false;

  function clearActiveImmediate() {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    if (activeEl) {
      activeEl.classList.remove('is-touch-active');
      activeEl = null;
    }
    touchEnded = false;
  }

  document.addEventListener('touchstart', function(e) {
    if (!e.touches || e.touches.length !== 1) {
      clearActiveImmediate();
      return;
    }
    const rawTarget = e.target && e.target.nodeType === 1 ? e.target : (e.target ? e.target.parentElement : null);
    if (!rawTarget || typeof rawTarget.closest !== 'function') return;

    const target = rawTarget.closest(TOUCH_SELECTOR);
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') {
      clearActiveImmediate();
      return;
    }

    clearActiveImmediate();
    activeEl = target;
    cancelledByMove = false;
    touchEnded = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    target.classList.add('is-touch-active');
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', function(e) {
    if (!activeEl || touchEnded || !e.touches || !e.touches.length) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 12 || dy > 12) {
      cancelledByMove = true;
      clearActiveImmediate();
    }
  }, { passive: true, capture: true });

  function handleTouchFinish() {
    if (!activeEl) return;
    if (cancelledByMove) {
      clearActiveImmediate();
      return;
    }
    touchEnded = true;
    const targetRef = activeEl;
    // CSSトランジション(150-200ms)のピークが十分視認できるよう最低380ms＆離脱後200ms維持
    const remaining = Math.max(200, 380 - (Date.now() - startTime));
    clearTimer = setTimeout(function() {
      targetRef.classList.remove('is-touch-active');
      if (activeEl === targetRef) activeEl = null;
      clearTimer = null;
    }, remaining);
  }

  document.addEventListener('touchend', handleTouchFinish, { passive: true, capture: true });
  document.addEventListener('touchcancel', clearActiveImmediate, { passive: true, capture: true });
  document.addEventListener('scroll', function() {
    if (activeEl && !touchEnded) {
      cancelledByMove = true;
      clearActiveImmediate();
    }
  }, { passive: true, capture: true });
})();
