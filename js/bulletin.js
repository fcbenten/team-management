/**
 * ==========================================
 * 📢 活動記録・チーム掲示板 ロジック (js_bulletin.html)
 * ==========================================
 * タイムライン表示、新規投稿、共同編集、ピン留めアナウンス、既読管理
 */

window.bulletinState = {
  posts: [],
  pinnedPosts: [],
  totalUnreadCount: 0,
  activeMemberCount: 0,
  currentCategory: 'all',
  pinnedOnly: false,
  currentViewingPost: null,
  readersData: null,
  readersActiveSubtab: 'yes',
  isLoading: false,
  isLoaded: false
};

let savedBulletinScrollY = 0;
let isBulletinSubmitting = false;

/**
 * 活動記録タブ初期化（キャッシュがあれば通信なしで即時0秒描画）
 * @param {boolean} [forceRefresh=false]
 */
function initBulletinTab(forceRefresh = false) {
  const tab = document.getElementById('tab-bulletin');
  const placeholder = tab ? tab.querySelector('.tab-loading-placeholder') : null;
  const mainContent = tab ? tab.querySelector('.tab-main-content') : null;

  // すでにデータ取得済みであれば、スピナーを出さず即座にキャッシュデータを表示
  if (window.bulletinState.isLoaded && !forceRefresh) {
    if (placeholder) placeholder.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
    renderBulletinTimeline();
    return;
  }

  // 初回または強制リフレッシュ時のみ通信
  loadBulletinData(false);
}

/**
 * バックエンドから取得した活動記録ペイロードを即座に状態に適用して各画面を描画
 * （初期一括取得時および差分リフレッシュ時の共通適用関数）
 * @param {Object} res
 */
function applyBulletinPayload(res) {
  if (!res || !res.success) return;

  const tab = document.getElementById('tab-bulletin');
  const placeholder = tab ? tab.querySelector('.tab-loading-placeholder') : null;
  const mainContent = tab ? tab.querySelector('.tab-main-content') : null;

  if (placeholder && mainContent) {
    placeholder.classList.add('hidden');
    mainContent.classList.remove('hidden');
  }

  const currentUser = window.currentUser || {};
  const myId = currentUser.memberId || currentUser.id || '';
  const myName = currentUser.name || '';

  const posts = res.posts || [];
  let totalUnreadCount = 0;

  posts.forEach(post => {
    const isSpecial = name => {
      const n = String(name || '').trim();
      return ['助っ人', 'OG', 'なし', '未定', 'メンバー', ''].includes(n) || n.includes('SPECIAL');
    };

    // 既読リストの同一メンバー重複・特殊枠を完全排除
    const uniqueReaders = [];
    const seen = new Set();
    (post.readers || []).forEach(r => {
      if (isSpecial(r.memberName)) return;
      const normN = String(r.memberName || '').replace(/[\s\u3000]+/g, '');
      const key = (r.memberId || '') + '_' + normN;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueReaders.push(r);
      }
    });
    post.readers = uniqueReaders;
    post.readCount = post.readers.length;

    // クライアント側で姓名空白ブレを吸収して確実に isReadByMe を判定
    if (myId || myName) {
      post.isReadByMe = post.readers.some(r => isSameMember(r.memberId, r.memberName, myId, myName));
    }
    if (!post.isReadByMe) {
      totalUnreadCount++;
    }

    if (post.unreadMembers) {
      post.unreadMembers = post.unreadMembers.filter(m => !isSpecial(m.memberName || m.name));
      post.unreadCount = post.unreadMembers.length;
    } else {
      post.unreadCount = Math.max(0, (res.activeMemberCount || 0) - post.readCount);
    }
  });

  // ピン留め優先・作成日時降順でソート
  sortBulletinPosts(posts);

  window.bulletinState.isLoaded = true;
  window.bulletinState.posts = posts;
  window.bulletinState.pinnedPosts = res.pinnedPosts || [];
  window.bulletinState.totalUnreadCount = totalUnreadCount;
  window.bulletinState.activeMemberCount = res.activeMemberCount || 0;

  // 画面描画
  renderBulletinTimeline();
  updateBulletinUnreadBadge();
  renderHomePinnedAnnouncements();
  renderHomeRecentBulletins();

  // スケジュール画面側の活動記録ボタンも更新
  if (typeof updateScheduleEventBulletinButton === 'function') {
    updateScheduleEventBulletinButton();
  }
}

/**
 * 活動記録データをGASバックエンドから取得
 * @param {boolean} [silent=false]
 */
function loadBulletinData(silent = false) {
  if (window.bulletinState.isLoading) return;
  window.bulletinState.isLoading = true;

  const tab = document.getElementById('tab-bulletin');
  const placeholder = tab ? tab.querySelector('.tab-loading-placeholder') : null;
  const mainContent = tab ? tab.querySelector('.tab-main-content') : null;

  if (!silent && placeholder && mainContent && !window.bulletinState.isLoaded) {
    placeholder.classList.remove('hidden');
    mainContent.classList.add('hidden');
  }

  const currentUser = window.currentUser || {};
  const currentId = currentUser.memberId || currentUser.id || '';
  const currentName = currentUser.name || '';

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        window.bulletinState.isLoading = false;
        if (placeholder && mainContent) {
          placeholder.classList.add('hidden');
          mainContent.classList.remove('hidden');
        }

        if (res && res.success) {
          applyBulletinPayload(res);
        } else {
          console.error('loadBulletinData failure:', res ? res.error : 'Unknown');
          renderBulletinEmptyState('データの取得に失敗しました。');
        }
      })
      .withFailureHandler(err => {
        window.bulletinState.isLoading = false;
        if (placeholder && mainContent) {
          placeholder.classList.add('hidden');
          mainContent.classList.remove('hidden');
        }
        console.error('loadBulletinData error:', err);
        renderBulletinEmptyState('通信エラーが発生しました。');
      })
      .apiGetBulletinData(currentId, currentName);
  } else {
    // モック（オフライン・開発時）
    window.bulletinState.isLoading = false;
    if (placeholder && mainContent) {
      placeholder.classList.add('hidden');
      mainContent.classList.remove('hidden');
    }
    renderBulletinTimeline();
  }
}

/**
 * ナビゲーションタブの未読バッジ更新（非表示化）
 */
function updateBulletinUnreadBadge() {
  const badgeId = 'navBulletinUnreadBadge';
  const badgeEl = document.getElementById(badgeId);
  if (badgeEl) {
    badgeEl.remove();
  }
}

/**
 * タイムラインのカテゴリフィルター切り替え
 */
function setBulletinCategoryFilter(category, btnEl) {
  window.bulletinState.currentCategory = category;
  const bar = btnEl ? btnEl.closest('.bulletin-filter-pills') : null;
  if (bar) {
    bar.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
  }
  renderBulletinTimeline();
}

/**
 * ピン留めのみフィルター切り替え
 */
function toggleBulletinPinnedFilter(checked) {
  window.bulletinState.pinnedOnly = Boolean(checked);
  renderBulletinTimeline();
}

/**
 * タイムライン一覧を描画（2段構成: 1段目=バッジ+日付(曜日付き)、2段目=タイトル+既読/編集ボタン）
 */
function renderBulletinTimeline() {
  const container = document.getElementById('bulletinTimelineList');
  if (!container) return;

  const currentCat = window.bulletinState.currentCategory || 'all';

  // フィルタリング（カテゴリ絞り込みのみ）
  const filtered = (window.bulletinState.posts || []).filter(post => {
    if (currentCat !== 'all' && post.category !== currentCat) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    renderBulletinEmptyState('投稿がありません');
    return;
  }

  container.replaceChildren();

  filtered.forEach(post => {
    const card = document.createElement('article');
    card.className = 'bulletin-post-card' + (post.isPinned ? ' is-pinned' : '');
    card.onclick = () => openBulletinDetailModal(post);

    // 1段目: バッジ群（カテゴリ、ピン留め、イベント）と日付（曜日付き）
    const topRow = document.createElement('div');
    topRow.className = 'bulletin-card-top-row';

    const badgesWrap = document.createElement('div');
    badgesWrap.className = 'bulletin-badges-wrap';

    // 元の配色バッジ
    const catBadge = document.createElement('span');
    catBadge.className = 'category-badge ' + getBulletinCategoryBadgeClass(post.category);
    catBadge.textContent = post.category || 'その他';
    badgesWrap.appendChild(catBadge);

    // ピン留め時バッジ
    if (post.isPinned) {
      const pinPill = document.createElement('span');
      pinPill.className = 'bulletin-pinned-pill';
      pinPill.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px;">push_pin</span>ホーム固定';
      badgesWrap.appendChild(pinPill);
    }

    // 紐付けイベントバッジ
    if (post.eventTitle) {
      const eventPill = document.createElement('div');
      eventPill.className = 'bulletin-card-event-pill';
      eventPill.innerHTML = `
        <span class="material-symbols-outlined event-pill-icon" style="font-size:13px;">event</span>
        <span>${escapeHtml(post.eventTitle)}</span>
      `;
      badgesWrap.appendChild(eventPill);
    }

    // 日付（曜日・時分付きフォーマット: YYYY/MM/DD (曜) HH:mm）
    const dateSpan = document.createElement('div');
    dateSpan.className = 'bulletin-card-date';
    dateSpan.textContent = formatBulletinDateTimeWithDay(post.createdAt);

    topRow.appendChild(badgesWrap);
    topRow.appendChild(dateSpan);
    card.appendChild(topRow);

    // 2段目: タイトル（左）と既読・編集ボタン（右）
    const mainRow = document.createElement('div');
    mainRow.className = 'bulletin-card-main-row';

    const titleH3 = document.createElement('h3');
    titleH3.className = 'bulletin-card-title';
    titleH3.textContent = post.title;
    mainRow.appendChild(titleH3);

    const actionsRight = document.createElement('div');
    actionsRight.className = 'bulletin-card-actions-right';

    // 既読サマリーボタン
    const readBtn = document.createElement('button');
    readBtn.type = 'button';
    readBtn.id = 'bulletinReadBtn_' + post.id;
    readBtn.className = 'btn-card-read-summary';
    readBtn.title = '閲覧状況を確認';
    readBtn.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:13px;">visibility</span>
      <span>既読 ${post.readCount || 0}</span>
    `;
    readBtn.onclick = (e) => {
      e.stopPropagation();
      openBulletinDetailModal(post, true); // true: 既読アコーディオンを直接開く
    };

    // 編集ボタン
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-event-icon-action';
    editBtn.title = '編集';
    editBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;">edit</span>';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openBulletinEditModal(post);
    };

    actionsRight.appendChild(readBtn);
    actionsRight.appendChild(editBtn);
    mainRow.appendChild(actionsRight);

    card.appendChild(mainRow);
    container.appendChild(card);
  });
}

/**
 * 空状態表示
 */
function renderBulletinEmptyState(msg) {
  const container = document.getElementById('bulletinTimelineList');
  if (!container) return;
  container.replaceChildren();

  const emptyBox = document.createElement('div');
  emptyBox.className = 'empty-state p-32';
  emptyBox.innerHTML = `
    <span class="material-symbols-outlined text-4xl text-muted mb-8" style="display:block;">chat_bubble_outline</span>
    <div class="font-bold text-muted mb-4">${escapeHtml(msg || '投稿がありません')}</div>
    <div class="text-xs text-muted">「新規投稿」ボタンから練習・試合の振り返りやお知らせを投稿してみましょう。</div>
  `;
  container.appendChild(emptyBox);
}

/**
 * カテゴリごとのバッジクラス解決
 */
function getBulletinCategoryBadgeClass(category) {
  switch (category) {
    case '活動記録': return 'badge-official'; // 青系
    case 'お知らせ': return 'badge-tr';       // オレンジ系
    case '連絡事項': return 'badge-trm';      // 緑系
    case 'ルール共有': return 'badge-event';  // 紫系
    default: return 'badge-other';            // グレー系
  }
}

/**
 * 日時文字列フォーマット（YYYY/MM/DD (曜) HH:mm）
 * 時分まで確実に表示し、日付のみの場合は YYYY/MM/DD (曜) で出力
 */
function formatBulletinDateTimeWithDay(dateVal) {
  if (typeof formatDisplayDateTimeWithDay === 'function') {
    return formatDisplayDateTimeWithDay(dateVal);
  }
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

function formatBulletinDate(dateVal) {
  return formatBulletinDateTimeWithDay(dateVal);
}

/**
 * 新規投稿モーダルを開く
 * @param {Object} [linkedEvent] スケジュール画面等から連携されたイベントオブジェクト { id, title, date }
 */
function openBulletinCreateModal(linkedEvent = null) {
  const modal = document.getElementById('bulletinEditModalOverlay');
  if (!modal) return;

  savedBulletinScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

  document.getElementById('bulletinEditModalTitle').textContent = '活動記録・お知らせを投稿';
  document.getElementById('bulletinEditPostId').value = '';
  document.getElementById('bulletinCategorySelect').value = linkedEvent ? '活動記録' : '連絡事項';
  document.getElementById('bulletinTitleInput').value = linkedEvent ? (linkedEvent.title ? linkedEvent.title + ' の振り返り' : '') : '';
  document.getElementById('bulletinIsPinnedCheck').checked = false;
  document.getElementById('bulletinContentInput').value = '';

  const statusEl = document.getElementById('bulletinFormStatus');
  if (statusEl) statusEl.classList.add('hidden');

  const delBtn = document.getElementById('btnBulletinEditDelete');
  if (delBtn) delBtn.classList.add('hidden');
  const saveBtn = document.getElementById('btnSaveBulletinPost');
  if (saveBtn) saveBtn.textContent = '投稿';

  populateBulletinEventSelect(linkedEvent ? linkedEvent.id : '');

  modal.classList.add('active');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
}

/**
 * 既存投稿の編集モーダルを開く（誰でも編集可能）
 */
function openBulletinEditModal(post) {
  if (!post) return;
  const modal = document.getElementById('bulletinEditModalOverlay');
  if (!modal) return;

  savedBulletinScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

  document.getElementById('bulletinEditModalTitle').textContent = '投稿を編集';
  document.getElementById('bulletinEditPostId').value = post.id || '';
  document.getElementById('bulletinCategorySelect').value = post.category || '活動記録';
  document.getElementById('bulletinTitleInput').value = post.title || '';
  document.getElementById('bulletinIsPinnedCheck').checked = Boolean(post.isPinned);
  document.getElementById('bulletinContentInput').value = post.content || '';

  const statusEl = document.getElementById('bulletinFormStatus');
  if (statusEl) statusEl.classList.add('hidden');

  const delBtn = document.getElementById('btnBulletinEditDelete');
  if (delBtn) delBtn.classList.remove('hidden');
  const saveBtn = document.getElementById('btnSaveBulletinPost');
  if (saveBtn) saveBtn.textContent = '更新';

  populateBulletinEventSelect(post.eventId || '');

  modal.classList.add('active');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
}

/**
 * 詳細モーダルから直接編集モーダルを開く
 */
function openBulletinEditModalFromCurrent() {
  const current = window.bulletinState.currentViewingPost;
  if (!current) return;
  closeBulletinDetailModalForce();
  openBulletinEditModal(current);
}

/**
 * イベント紐付けプルダウンを生成
 * （過去分は2週間前〜本日以降のイベントを表示）
 */
function populateBulletinEventSelect(selectedEventId = '') {
  const select = document.getElementById('bulletinEventSelect');
  if (!select) return;

  select.replaceChildren();

  const defOpt = document.createElement('option');
  defOpt.value = '';
  defOpt.textContent = 'なし';
  select.appendChild(defOpt);

  const events = window.eventsData && Array.isArray(window.eventsData) ? [...window.eventsData] : [];
  if (events.length === 0) return;

  // 日付の新しい順（直近・過去）にソート
  events.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    return db.localeCompare(da);
  });

  // 過去分は本日より14日前（2週間前）以降のみを表示（未来予定はすべて表示）
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = `${twoWeeksAgo.getFullYear()}-${String(twoWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(twoWeeksAgo.getDate()).padStart(2, '0')}`;

  events.forEach(ev => {
    if (!ev || !ev.title) return;
    const evDate = ev.date || '';
    // 過去予定で2週間前より古いものは除外（既に選択されている場合は保持）
    if (evDate && evDate < twoWeeksAgoStr && (!selectedEventId || (ev.id !== selectedEventId && (evDate + '_' + ev.title) !== selectedEventId))) {
      return;
    }

    const opt = document.createElement('option');
    opt.value = ev.id || (ev.date + '_' + ev.title);
    const dateFormatted = ev.date ? formatDisplayDateWithDay(ev.date) : '';
    opt.textContent = `${dateFormatted} ${ev.title}`;
    opt.dataset.title = ev.title;
    opt.dataset.date = ev.date || '';

    if (selectedEventId && (opt.value === selectedEventId || ev.id === selectedEventId)) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

/**
 * 編集モーダルを閉じる
 */
function closeBulletinEditModal(e) {
  if (isBulletinSubmitting) return; // 送信中は誤操作で閉じないように保護
  if (e && e.target && e.target.id === 'bulletinEditModalOverlay') {
    closeBulletinEditModalForce();
  }
}

function closeBulletinEditModalForce() {
  if (isBulletinSubmitting) return;
  const modal = document.getElementById('bulletinEditModalOverlay');
  if (modal) modal.classList.remove('active');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  window.scrollTo(0, savedBulletinScrollY);
}

/**
 * 投稿フォーム送信処理
 */
function handleBulletinPostSubmit(e) {
  if (e) e.preventDefault();
  if (isBulletinSubmitting) return;

  const btn = document.getElementById('btnSaveBulletinPost');
  const form = document.getElementById('bulletinPostForm');
  const statusEl = document.getElementById('bulletinFormStatus');
  const id = document.getElementById('bulletinEditPostId').value.trim();
  const category = document.getElementById('bulletinCategorySelect').value;
  const title = document.getElementById('bulletinTitleInput').value.trim();
  const eventSelect = document.getElementById('bulletinEventSelect');
  const eventId = eventSelect ? eventSelect.value : '';
  const selectedEventOpt = eventSelect ? eventSelect.selectedOptions[0] : null;
  const eventTitle = (selectedEventOpt && selectedEventOpt.dataset.title) ? selectedEventOpt.dataset.title : '';
  const eventDate = (selectedEventOpt && selectedEventOpt.dataset.date) ? selectedEventOpt.dataset.date : '';
  const isPinned = document.getElementById('bulletinIsPinnedCheck').checked;
  const content = document.getElementById('bulletinContentInput').value.trim();

  if (!title) {
    showAppAlert({ title: '入力エラー', message: 'タイトルを入力してください。', isError: true });
    return;
  }
  if (!content) {
    showAppAlert({ title: '入力エラー', message: '本文を入力してください。', isError: true });
    return;
  }

  const currentUser = window.currentUser || {};
  const authorId = currentUser.memberId || currentUser.id || '';
  const authorName = currentUser.name || 'メンバー';

  const payload = {
    id: id || '',
    category,
    title,
    content,
    eventId,
    eventTitle,
    eventDate,
    isPinned,
    authorId,
    authorName
  };

  isBulletinSubmitting = true;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm ptrSpin">sync</span><span>送信中...</span>';
  }
  // 送信中はフォーム全体を無効化し、重複送信や他画面操作をブロック
  if (form) {
    form.querySelectorAll('input, select, textarea, button').forEach(el => {
      if (el !== btn) el.disabled = true;
    });
  }
  if (statusEl) statusEl.classList.add('hidden');

  const enableForm = () => {
    isBulletinSubmitting = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = payload.id ? '更新' : '投稿';
    }
    if (form) {
      form.querySelectorAll('input, select, textarea, button').forEach(el => el.disabled = false);
    }
  };

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        enableForm();
        if (res && res.success) {
          closeBulletinEditModalForce();
          loadBulletinData(true);
        } else {
          if (statusEl) {
            statusEl.textContent = 'エラー: ' + (res ? res.error : '保存に失敗しました。');
            statusEl.className = 'form-status-msg form-status-error mb-12';
            statusEl.classList.remove('hidden');
          }
        }
      })
      .withFailureHandler(err => {
        enableForm();
        if (statusEl) {
          statusEl.textContent = '通信エラーが発生しました: ' + (err.message || '');
          statusEl.className = 'form-status-msg form-status-error mb-12';
          statusEl.classList.remove('hidden');
        }
      })
      .apiSaveBulletinPost(payload);
  } else {
    enableForm();
    closeBulletinEditModalForce();
    showAppAlert({ title: 'モック環境', message: '投稿を保存しました。' });
  }
}

/**
 * イベントIDを指定して新規作成モーダルを開く
 * @param {string} eventId
 */
function openBulletinCreateModalForEvent(eventId) {
  let ev = null;
  if (eventId && window.eventsData && Array.isArray(window.eventsData)) {
    ev = window.eventsData.find(e => e.id === eventId || (e.date + '_' + e.title) === eventId);
  }
  if (!ev && window.currentViewingEvent && (window.currentViewingEvent.id === eventId || (window.currentViewingEvent.date + '_' + window.currentViewingEvent.title) === eventId)) {
    ev = window.currentViewingEvent;
  }
  openBulletinCreateModal(ev || { id: eventId, title: '', date: '' });
}

/**
 * メンバー同一性判定（ID照合または空白を除去した正規化氏名照合）
 */
function isSameMember(mId1, mName1, mId2, mName2) {
  const cleanId1 = String(mId1 || '').trim();
  const cleanId2 = String(mId2 || '').trim();
  if (cleanId1 && cleanId2 && cleanId1 === cleanId2) return true;

  const norm1 = String(mName1 || '').replace(/[\s\u3000]+/g, '');
  const norm2 = String(mName2 || '').replace(/[\s\u3000]+/g, '');
  if (norm1 && norm2 && norm1 === norm2) return true;

  return false;
}

/**
 * コメント入力欄のイベント初期化（文字数カウント・自動リサイズ・ホイールスクロール透過）
 */
function setupBulletinCommentInputEvents() {
  const inputEl = document.getElementById('bdmCommentInput');
  if (!inputEl || inputEl.dataset.initialized === 'true') return;
  inputEl.dataset.initialized = 'true';

  // 1. 文字数カウント＆高さ自動調整
  inputEl.addEventListener('input', () => {
    updateCommentInputState(inputEl);
  });

  // 2. カーソルがあたっている時のホイールスクロールを親モーダルへ透過
  inputEl.addEventListener('wheel', (e) => {
    const isScrollable = inputEl.scrollHeight > inputEl.clientHeight;
    const modalContent = inputEl.closest('.modal-content') || document.querySelector('.bulletin-detail-modal');
    if (!isScrollable && modalContent) {
      modalContent.scrollTop += e.deltaY;
    } else if (modalContent) {
      const atTop = inputEl.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = (inputEl.scrollTop + inputEl.clientHeight >= inputEl.scrollHeight - 1) && e.deltaY > 0;
      if (atTop || atBottom) {
        modalContent.scrollTop += e.deltaY;
      }
    }
  }, { passive: true });

  // 3. Shift + Enter で改行、Enter単体で送信
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSubmitBulletinComment();
    }
  });
}

function updateCommentInputState(inputEl) {
  if (!inputEl) inputEl = document.getElementById('bdmCommentInput');
  if (!inputEl) return;

  const len = inputEl.value.length;
  const countEl = document.getElementById('bdmCommentCharCount');
  if (countEl) {
    countEl.textContent = String(len);
    const wrap = countEl.parentElement;
    if (wrap) {
      wrap.classList.toggle('warning', len >= 450 && len < 500);
      wrap.classList.toggle('limit', len >= 500);
    }
  }

  // 自動リサイズ（1行〜最大120px）。120px以下なら overflow-y: hidden で親へホイール透過
  inputEl.style.height = 'auto';
  const newHeight = Math.min(120, Math.max(44, inputEl.scrollHeight));
  inputEl.style.height = newHeight + 'px';
  inputEl.style.overflowY = inputEl.scrollHeight > 120 ? 'auto' : 'hidden';
}

/**
 * 投稿詳細モーダルを開く
 * @param {Object|string} post 投稿オブジェクトまたは投稿ID
 * @param {boolean} [openReaders=false] 閲覧状況アコーディオンを最初から開くか
 */
function openBulletinDetailModal(post, openReaders = false) {
  if (!post) return;
  if (typeof post === 'string') {
    const found = (window.bulletinState.posts || []).find(p => p.id === post);
    if (found) {
      post = found;
    } else {
      console.warn('Post not found for id:', post);
      return;
    }
  }
  window.bulletinState.currentViewingPost = post;

  const modal = document.getElementById('bulletinDetailModalOverlay');
  if (!modal) return;

  // コメント入力欄のイベント初期化とリセット
  setupBulletinCommentInputEvents();
  const commentInput = document.getElementById('bdmCommentInput');
  if (commentInput) {
    commentInput.value = '';
    updateCommentInputState(commentInput);
  }

  // カテゴリバッジ
  const catBadge = document.getElementById('bdmCategoryBadge');
  if (catBadge) {
    catBadge.className = 'category-badge ' + getBulletinCategoryBadgeClass(post.category);
    catBadge.textContent = post.category || 'その他';
  }

  // ピン留めバッジ
  const isPinned = Boolean(post.isPinned);
  const pinBadge = document.getElementById('bdmPinnedBadge');
  if (pinBadge) {
    pinBadge.classList.toggle('hidden', !isPinned);
    pinBadge.style.display = isPinned ? 'inline-flex' : 'none';
  }

  // タイトル
  const titleEl = document.getElementById('bdmTitle');
  if (titleEl) titleEl.textContent = post.title;

  // 投稿者
  const authorEl = document.getElementById('bdmAuthorName');
  if (authorEl) authorEl.textContent = post.authorName || 'メンバー';

  // 投稿者アバター表示（他画面のアバターデザインと完全統一）
  const avatarImg = document.getElementById('bdmAuthorAvatarImg');
  const avatarPlaceholder = document.getElementById('bdmAuthorAvatarPlaceholder');
  const authorAvatarUrl = post.authorAvatar || post.authorAvatarUrl || (window.playerAvatarMap && post.authorName && window.playerAvatarMap[post.authorName]) || '';
  if (avatarImg && avatarPlaceholder) {
    if (authorAvatarUrl && !authorAvatarUrl.startsWith('data:image/svg+xml')) {
      avatarImg.src = authorAvatarUrl;
      avatarImg.classList.remove('hidden');
      avatarPlaceholder.classList.add('hidden');
    } else {
      avatarImg.src = '';
      avatarImg.classList.add('hidden');
      avatarPlaceholder.classList.remove('hidden');
    }
  }

  // 作成日時（曜日・時分付きフォーマット: YYYY/MM/DD (曜) HH:mm）
  const createdEl = document.getElementById('bdmCreatedAt');
  if (createdEl) {
    createdEl.textContent = formatBulletinDateTimeWithDay(post.createdAt);
  }

  // コメント一覧をローカルメモリから即時描画（SPA同期描画: 0秒）
  if (post.comments) {
    renderBulletinComments(post.comments);
  } else {
    loadBulletinComments(post.id);
  }

  // 紐付けイベント
  const eventBox = document.getElementById('bdmEventBox');
  if (eventBox) {
    if (post.eventTitle) {
      document.getElementById('bdmEventTitle').textContent = post.eventTitle;
      document.getElementById('bdmEventDate').textContent = post.eventDate ? formatDisplayDateWithDay(post.eventDate) : '';
      eventBox.classList.remove('hidden');

      const jumpBtn = document.getElementById('btnBdmJumpEvent');
      if (jumpBtn) {
        jumpBtn.onclick = () => {
          closeBulletinDetailModalForce();
          if (typeof switchTab === 'function') switchTab('schedule');
          if (typeof jumpToEventDetail === 'function' && post.eventId) {
            jumpToEventDetail(post.eventId);
          }
        };
      }
    } else {
      eventBox.classList.add('hidden');
    }
  }

  // 本文
  const contentEl = document.getElementById('bdmContent');
  if (contentEl) {
    contentEl.textContent = post.content || '';
  }

  // ピン留めチェックボックスの初期状態
  const pinCheckbox = document.getElementById('bdmPinCheckbox');
  if (pinCheckbox) {
    pinCheckbox.checked = !!post.isPinned;
  }

  // 閲覧サマリーバッジ（実配列数と完全に統一）
  const currentReadCount = post.readers ? post.readers.length : (post.readCount || 0);
  const currentUnreadCount = post.unreadMembers ? post.unreadMembers.length : (post.unreadCount || 0);

  const readSummary = document.getElementById('bdmReadSummaryBadge');
  if (readSummary) {
    readSummary.textContent = `既読: ${currentReadCount}名 / 未読: ${currentUnreadCount}名`;
  }

  // 閲覧者・未読者データをメモリから同期設定（0秒）
  window.bulletinState.readersData = {
    readers: post.readers || [],
    unreadMembers: post.unreadMembers || []
  };
  const countYesEl = document.getElementById('bdmCountYes');
  const countNoEl = document.getElementById('bdmCountNo');
  if (countYesEl) countYesEl.textContent = currentReadCount;
  if (countNoEl) countNoEl.textContent = currentUnreadCount;

  // 閲覧アコーディオンの初期状態
  const accordion = document.getElementById('bdmReadersAccordion');
  const toggleText = document.getElementById('readersToggleText');
  const toggleIcon = document.getElementById('readersToggleIcon');

  if (openReaders && accordion) {
    accordion.classList.remove('hidden');
    if (toggleText) toggleText.textContent = '一覧を閉じる';
    if (toggleIcon) toggleIcon.textContent = 'expand_less';
    renderReadersChips();
  } else if (accordion) {
    accordion.classList.add('hidden');
    if (toggleText) toggleText.textContent = '一覧を表示';
    if (toggleIcon) toggleIcon.textContent = 'expand_more';
  }

  savedBulletinScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

  // 自動既読記録（自分がまだ未読の場合のみ実行）
  markPostAsReadIfUnread(post);

  modal.classList.add('active');
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
}

/**
 * 投稿を自動的に「既読」として記録
 */
function markPostAsReadIfUnread(post) {
  if (!post) return;

  const currentUser = window.currentUser || {};
  const myId = currentUser.memberId || currentUser.id || '';
  const myName = currentUser.name || '';
  if (!myId && !myName) return;

  if (!post.readers) post.readers = [];

  // 既に既読リストに含まれている場合は再カウント・重複追加を絶対にしない
  const alreadyInReaders = post.readers.some(r => isSameMember(r.memberId, r.memberName, myId, myName));
  if (post.isReadByMe || alreadyInReaders) {
    post.isReadByMe = true;
    post.readCount = post.readers.length;
    if (post.unreadMembers) {
      post.unreadCount = post.unreadMembers.length;
    }
    // バッジ数値の完全同期
    const readSummary = document.getElementById('bdmReadSummaryBadge');
    if (readSummary) {
      readSummary.textContent = `既読: ${post.readCount}名 / 未読: ${post.unreadCount}名`;
    }
    const countYesEl = document.getElementById('bdmCountYes');
    const countNoEl = document.getElementById('bdmCountNo');
    if (countYesEl) countYesEl.textContent = post.readCount;
    if (countNoEl) countNoEl.textContent = post.unreadCount;
    return;
  }

  // 1. ローカルメモリの即時同期更新（楽観的UI）
  post.isReadByMe = true;

  const now = new Date();
  const pad = n => ('0' + n).slice(-2);
  const nowStr = `${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  post.readers.push({
    memberId: myId,
    memberName: myName,
    readAt: nowStr
  });

  if (post.unreadMembers) {
    post.unreadMembers = post.unreadMembers.filter(m => !isSameMember(m.memberId, m.memberName || m.name, myId, myName));
  }

  post.readCount = post.readers.length;
  post.unreadCount = post.unreadMembers ? post.unreadMembers.length : Math.max(0, (post.unreadCount || 1) - 1);
  window.bulletinState.totalUnreadCount = Math.max(0, (window.bulletinState.totalUnreadCount || 1) - 1);

  // 閲覧サマリーバッジ・件数の即時更新（readers.length と完全一致）
  const readSummary = document.getElementById('bdmReadSummaryBadge');
  if (readSummary) {
    readSummary.textContent = `既読: ${post.readCount}名 / 未読: ${post.unreadCount}名`;
  }
  const countYesEl = document.getElementById('bdmCountYes');
  const countNoEl = document.getElementById('bdmCountNo');
  if (countYesEl) countYesEl.textContent = post.readCount;
  if (countNoEl) countNoEl.textContent = post.unreadCount;

  window.bulletinState.readersData = {
    readers: post.readers,
    unreadMembers: post.unreadMembers || []
  };

  const accordion = document.getElementById('bdmReadersAccordion');
  if (accordion && !accordion.classList.contains('hidden')) {
    renderReadersChips();
  }

  updateBulletinUnreadBadge();

  // タイムラインの該当カード既読バッジのみ差分更新
  const readBtn = document.getElementById('bulletinReadBtn_' + post.id);
  if (readBtn) {
    readBtn.className = 'btn-card-read-summary';
    readBtn.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:13px;">visibility</span>
      <span>既読 ${post.readCount}</span>
    `;
  }

  // 2. GASバックエンドへ非同期送信（UIの待機ゼロ）
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {})
      .withFailureHandler(err => {
        console.warn('apiMarkBulletinPostRead error:', err);
      })
      .apiMarkBulletinPostRead(post.id, myId, myName);
  }
}

/**
 * 閲覧状況アコーディオンの開閉
 */
function toggleBulletinReadersAccordion() {
  const accordion = document.getElementById('bdmReadersAccordion');
  const toggleText = document.getElementById('readersToggleText');
  const toggleIcon = document.getElementById('readersToggleIcon');
  if (!accordion) return;

  const isHidden = accordion.classList.contains('hidden');
  if (isHidden) {
    accordion.classList.remove('hidden');
    if (toggleText) toggleText.textContent = '一覧を閉じる';
    if (toggleIcon) toggleIcon.textContent = 'expand_less';

    // メモリ上の閲覧データを即時同期描画（0秒）
    if (window.bulletinState.readersData && (window.bulletinState.readersData.readers || window.bulletinState.readersData.unreadMembers)) {
      renderReadersChips();
    } else {
      const current = window.bulletinState.currentViewingPost;
      if (current && current.id) {
        loadBulletinPostReaders(current.id);
      }
    }
  } else {
    accordion.classList.add('hidden');
    if (toggleText) toggleText.textContent = '一覧を表示';
    if (toggleIcon) toggleIcon.textContent = 'expand_more';
  }
}

/**
 * 該当投稿の既読者・未読者メンバー一覧を読み込み
 */
function loadBulletinPostReaders(postId) {
  const containerYes = document.getElementById('bdmReadersListYes');
  const containerNo = document.getElementById('bdmReadersListNo');

  if (containerYes) containerYes.innerHTML = '<div class="text-xs text-muted p-4">読み込み中...</div>';
  if (containerNo) containerNo.innerHTML = '<div class="text-xs text-muted p-4">読み込み中...</div>';

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          window.bulletinState.readersData = res;
          renderReadersChips();
        } else {
          if (containerYes) containerYes.textContent = '一覧の取得に失敗しました。';
          if (containerNo) containerNo.textContent = '一覧の取得に失敗しました。';
        }
      })
      .withFailureHandler(err => {
        if (containerYes) containerYes.textContent = '通信エラーが発生しました。';
        if (containerNo) containerNo.textContent = '通信エラーが発生しました。';
      })
      .apiGetBulletinPostReaders(postId);
  } else {
    renderReadersChips();
  }
}

/**
 * 既読者・未読者一覧を描画（タブ不要・縦並び・時刻なし・未読赤文字なし）
 */
function renderReadersChips() {
  const containerYes = document.getElementById('bdmReadersListYes');
  const containerNo = document.getElementById('bdmReadersListNo');
  const data = window.bulletinState.readersData;
  if (!data) return;

  const isSpecialName = name => {
    const n = String(name || '').trim();
    return ['助っ人', 'OG', 'なし', '未定', 'メンバー', ''].includes(n) || n.includes('SPECIAL');
  };
  const readers = (data.readers || []).filter(r => !isSpecialName(r.memberName));
  const unreadMembers = (data.unreadMembers || []).filter(m => !isSpecialName(m.memberName || m.name));

  // 件数バッジ更新
  const countYesEl = document.getElementById('bdmCountYes');
  const countNoEl = document.getElementById('bdmCountNo');
  if (countYesEl) countYesEl.textContent = readers.length;
  if (countNoEl) countNoEl.textContent = unreadMembers.length;

  // 既読一覧の描画（時刻表示なし）
  if (containerYes) {
    containerYes.replaceChildren();
    if (readers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-xs text-muted p-4';
      empty.textContent = 'まだ既読者はいません';
      containerYes.appendChild(empty);
    } else {
      readers.forEach(item => {
        const chip = document.createElement('span');
        chip.className = 'reader-chip';
        chip.textContent = item.memberName || item.name || 'メンバー';
        containerYes.appendChild(chip);
      });
    }
  }

  // 未読一覧の描画（時刻表示なし・赤文字なし）
  if (containerNo) {
    containerNo.replaceChildren();
    if (unreadMembers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-xs text-muted p-4';
      empty.textContent = '未読のメンバーはいません（全員既読）';
      containerNo.appendChild(empty);
    } else {
      unreadMembers.forEach(item => {
        const chip = document.createElement('span');
        chip.className = 'reader-chip unread';
        chip.textContent = item.memberName || item.name || 'メンバー';
        containerNo.appendChild(chip);
      });
    }
  }
}

/**
 * 該当投稿のコメント一覧を読み込み
 * @param {string} postId
 */
function loadBulletinComments(postId) {
  const container = document.getElementById('bdmCommentsList');
  const countBadge = document.getElementById('bdmCommentCountBadge');
  const inputEl = document.getElementById('bdmCommentInput');
  const statusMsg = document.getElementById('bdmCommentStatusMsg');

  if (inputEl) inputEl.value = '';
  if (statusMsg) {
    statusMsg.textContent = '';
    statusMsg.className = 'comment-status-msg hidden';
  }

  if (!container) return;

  container.innerHTML = '<div class="comments-loading text-xs text-muted py-8 text-center">コメントを読み込み中...</div>';

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          renderBulletinComments(res.comments || []);
        } else {
          container.innerHTML = '<div class="text-xs text-muted py-8 text-center">コメントの取得に失敗しました</div>';
        }
      })
      .withFailureHandler(err => {
        container.innerHTML = '<div class="text-xs text-muted py-8 text-center">通信エラーが発生しました</div>';
      })
      .apiGetBulletinComments(postId);
  } else {
    // モック
    renderBulletinComments([]);
  }
}

/**
 * コメント一覧を描画
 * @param {Array} comments
 */
function renderBulletinComments(comments) {
  const container = document.getElementById('bdmCommentsList');
  const countBadge = document.getElementById('bdmCommentCountBadge');
  if (countBadge) {
    countBadge.textContent = String(comments.length);
  }

  if (!container) return;

  if (comments.length === 0) {
    container.innerHTML = '<div class="text-xs text-muted py-12 text-center">まだコメントはありません。</div>';
    return;
  }

  container.replaceChildren();

  const currentUser = window.currentUser || {};
  const currentName = currentUser.name || '';
  const isAdmin = (currentUser.role === '代表' || currentUser.role === '副代表' || currentUser.role === '管理者');

  comments.forEach(c => {
    const card = document.createElement('div');
    card.className = 'comment-item-card';

    // ヘッダー（名前、アバター、日時、削除ボタン）
    const header = document.createElement('div');
    header.className = 'comment-header';

    const authorInfo = document.createElement('div');
    authorInfo.className = 'comment-author-info';

    // アバター（他画面と統一された円形アバターラップ）
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'comment-avatar-wrap';
    const cAvatarUrl = c.authorAvatarUrl || (window.playerAvatarMap && c.authorName && window.playerAvatarMap[c.authorName]) || '';
    if (cAvatarUrl && !cAvatarUrl.startsWith('data:image/svg+xml')) {
      const img = document.createElement('img');
      img.src = cAvatarUrl;
      img.className = 'comment-avatar-img';
      img.alt = '';
      avatarWrap.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'comment-avatar-placeholder';
      placeholder.innerHTML = '<span class="material-symbols-outlined">person</span>';
      avatarWrap.appendChild(placeholder);
    }
    authorInfo.appendChild(avatarWrap);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'comment-author-name';
    nameSpan.textContent = c.authorName || 'メンバー';
    authorInfo.appendChild(nameSpan);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'comment-time';
    timeSpan.textContent = formatBulletinDateTimeWithDay(c.createdAt);
    authorInfo.appendChild(timeSpan);

    header.appendChild(authorInfo);

    // 削除ボタン（本人または管理者）
    const isOwner = (currentName && c.authorName && currentName === c.authorName);
    if (isOwner || isAdmin) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-comment-delete';
      delBtn.title = 'コメントを削除';
      delBtn.innerHTML = '<span class="material-symbols-outlined text-sm">delete</span>';
      delBtn.onclick = () => handleDeleteBulletinComment(c.id);
      header.appendChild(delBtn);
    }

    card.appendChild(header);

    // 本文
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.textContent = c.content || '';
    card.appendChild(body);

    container.appendChild(card);
  });
}

/**
 * コメント投稿処理
 */
function handleSubmitBulletinComment() {
  const current = window.bulletinState.currentViewingPost;
  if (!current || !current.id) return;

  const inputEl = document.getElementById('bdmCommentInput');
  const btn = document.getElementById('btnSubmitComment');
  const statusMsg = document.getElementById('bdmCommentStatusMsg');

  if (!inputEl) return;
  const content = inputEl.value.trim();
  if (!content) {
    if (statusMsg) {
      statusMsg.textContent = 'コメントを入力してください';
      statusMsg.className = 'comment-status-msg error';
      statusMsg.classList.remove('hidden');
    }
    inputEl.focus();
    return;
  }

  const currentUser = window.currentUser || {};
  const myId = currentUser.memberId || currentUser.id || '';
  const myName = currentUser.name || 'メンバー';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">hourglass_empty</span>送信中...';
  }
  if (statusMsg) statusMsg.classList.add('hidden');

  const enableBtn = () => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">send</span>投稿';
    }
  };

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        enableBtn();
        if (res && res.success && res.comment) {
          inputEl.value = '';
          updateCommentInputState(inputEl);
          // メモリ上の投稿データに即時追加して0秒同期描画
          if (!current.comments) current.comments = [];
          current.comments.push(res.comment);
          current.commentCount = current.comments.length;
          renderBulletinComments(current.comments);
        } else {
          if (statusMsg) {
            statusMsg.textContent = 'エラー: ' + (res ? res.error : '送信に失敗しました');
            statusMsg.className = 'comment-status-msg error';
            statusMsg.classList.remove('hidden');
          }
        }
      })
      .withFailureHandler(err => {
        enableBtn();
        if (statusMsg) {
          statusMsg.textContent = '通信エラー: ' + (err.message || '');
          statusMsg.className = 'comment-status-msg error';
          statusMsg.classList.remove('hidden');
        }
      })
      .apiAddBulletinComment(current.id, content, myId, myName);
  } else {
    enableBtn();
    inputEl.value = '';
    showAppAlert({ title: 'モック環境', message: 'コメントを送信しました。' });
  }
}

/**
 * コメント削除処理
 * @param {string} commentId
 */
function handleDeleteBulletinComment(commentId) {
  if (!commentId) return;

  const current = window.bulletinState.currentViewingPost;
  const currentUser = window.currentUser || {};
  const actorName = currentUser.name || 'メンバー';

  // アラートやトーストは出さず即座にローカルから削除して同期再描画（0秒）
  if (current) {
    current.comments = (current.comments || []).filter(c => c.id !== commentId);
    current.commentCount = current.comments.length;
    renderBulletinComments(current.comments);
  }

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        if (!res || !res.success) {
          console.error('コメント削除の同期に失敗しました:', res ? res.error : '');
        }
      })
      .withFailureHandler(err => {
        console.error('通信エラーが発生しました:', err);
      })
      .apiDeleteBulletinComment(commentId, actorName);
  }
}

/**
 * 活動記録投稿リストのソート（ピン留めが先頭、その中で作成日時の新しい順）
 * @param {Array} posts
 */
function sortBulletinPosts(posts) {
  if (!Array.isArray(posts)) return;
  posts.sort((a, b) => {
    const aPin = Boolean(a.isPinned);
    const bPin = Boolean(b.isPinned);
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    const timeA = String(a.createdAt || '');
    const timeB = String(b.createdAt || '');
    return timeB.localeCompare(timeA);
  });
}

/**
 * ピン留めチェックボックス操作（詳細モーダル）
 * @param {boolean} isChecked
 */
function handleBdmTogglePinCheckbox(isChecked) {
  const current = window.bulletinState.currentViewingPost;
  if (!current || !current.id) return;

  const nextPinned = Boolean(isChecked);
  current.isPinned = nextPinned;

  // メモリ配列内の投稿オブジェクトも確実に同期更新
  const allPosts = window.bulletinState.posts || [];
  const target = allPosts.find(p => p.id === current.id);
  if (target) {
    target.isPinned = nextPinned;
  }

  // 0秒即時ソート（チェックを入れた瞬間に最上部へ移動）
  sortBulletinPosts(allPosts);
  window.bulletinState.pinnedPosts = allPosts.filter(p => p.isPinned);

  // モーダルヘッダーの「ホーム固定中」バッジ表示を更新
  const pinnedBadge = document.getElementById('bdmPinnedBadge');
  if (pinnedBadge) {
    pinnedBadge.classList.toggle('hidden', !nextPinned);
    pinnedBadge.style.display = nextPinned ? 'inline-flex' : 'none';
  }

  // タイムライン一覧・ホーム画面ピン留めカードを即時再描画（モーダル裏の投稿が0秒で最上部に移動）
  renderBulletinTimeline();
  renderHomePinnedAnnouncements();

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        // バックエンド保存成功（画面は0秒同期済みのため不要なリロード・チラつきは行わない）
      })
      .withFailureHandler(err => {
        console.error('ピン留め保存エラー:', err);
        // エラー時はロールバック
        if (target) {
          target.isPinned = !nextPinned;
          current.isPinned = !nextPinned;
        }
        const pinCheckbox = document.getElementById('bdmPinCheckbox');
        if (pinCheckbox) pinCheckbox.checked = !nextPinned;
        if (pinnedBadge) {
          pinnedBadge.classList.toggle('hidden', nextPinned);
          pinnedBadge.style.display = (!nextPinned) ? 'inline-flex' : 'none';
        }
        sortBulletinPosts(allPosts);
        renderBulletinTimeline();
        renderHomePinnedAnnouncements();
      })
      .apiTogglePinBulletinPost(current.id, nextPinned);
  }
}

/**
 * ピン留めトグル（後方互換）
 */
function handleBdmTogglePin() {
  const pinCheckbox = document.getElementById('bdmPinCheckbox');
  if (pinCheckbox) {
    pinCheckbox.checked = !pinCheckbox.checked;
    handleBdmTogglePinCheckbox(pinCheckbox.checked);
  }
}

/**
 * 投稿削除の共通処理
 * @param {string} postId
 * @param {string} postTitle
 */
async function deleteBulletinPostById(postId, postTitle) {
  if (!postId) return;

  const ok = await showAppConfirm({
    title: '投稿の削除',
    message: `「${postTitle || 'この投稿'}」を削除してもよろしいですか？`,
    okText: '削除する',
    cancelText: 'キャンセル',
    isDanger: true,
    icon: 'delete'
  });
  if (!ok) {
    return;
  }

  const currentUser = window.currentUser || {};
  const actorName = currentUser.name || 'メンバー';

  // モーダルを両方閉じる
  closeBulletinDetailModalForce();
  closeBulletinEditModalForce();

  // 1. メモリ配列から即座に除外（0秒UI更新）
  const allPosts = window.bulletinState.posts || [];
  window.bulletinState.posts = allPosts.filter(p => p.id !== postId);
  window.bulletinState.pinnedPosts = (window.bulletinState.pinnedPosts || []).filter(p => p.id !== postId);
  renderBulletinTimeline();
  renderHomePinnedAnnouncements();
  if (typeof renderHomeRecentBulletins === 'function') {
    renderHomeRecentBulletins();
  }

  // 2. バックエンドへ送信
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          loadBulletinData(true);
        } else {
          showAppAlert({ title: '削除エラー', message: '削除に失敗しました: ' + (res ? res.error : ''), isError: true });
          loadBulletinData(true);
        }
      })
      .withFailureHandler(err => {
        showAppAlert({ title: '通信エラー', message: '削除通信エラーが発生しました: ' + (err.message || ''), isError: true });
        loadBulletinData(true);
      })
      .apiDeleteBulletinPost(postId, actorName);
  } else {
    showAppAlert({ title: 'モック環境', message: '投稿を削除しました。' });
  }
}

/**
 * 詳細モーダルからの投稿削除
 */
function handleBdmDelete() {
  const current = window.bulletinState.currentViewingPost;
  if (!current || !current.id) return;
  deleteBulletinPostById(current.id, current.title);
}

/**
 * 編集モーダルからの投稿削除
 */
function handleBulletinEditDelete() {
  const editPostId = document.getElementById('bulletinEditPostId').value;
  if (!editPostId) return;
  const allPosts = window.bulletinState.posts || [];
  const target = allPosts.find(p => p.id === editPostId);
  deleteBulletinPostById(editPostId, target ? target.title : '');
}

function closeBulletinDetailModal(e) {
  if (e && e.target && e.target.id === 'bulletinDetailModalOverlay') {
    closeBulletinDetailModalForce();
  }
}

function closeBulletinDetailModalForce() {
  const modal = document.getElementById('bulletinDetailModalOverlay');
  if (modal) modal.classList.remove('active');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  window.scrollTo(0, savedBulletinScrollY);
}

/**
 * =========================================
 * 🏠 ホーム画面用 ピン留めアナウンスカード描画
 * =========================================
 */
function renderHomePinnedAnnouncements() {
  const container = document.getElementById('homePinnedAnnounceArea');
  if (!container) return;

  const pinned = window.bulletinState.pinnedPosts || [];
  if (pinned.length === 0) {
    container.classList.add('hidden');
    container.replaceChildren();
    return;
  }

  container.classList.remove('hidden');
  container.replaceChildren();

  pinned.forEach(post => {
    const card = document.createElement('div');
    card.className = 'home-pinned-card';
    card.onclick = () => {
      openBulletinDetailModal(post);
    };

    const header = document.createElement('div');
    header.className = 'home-pinned-header';

    const badges = document.createElement('div');
    badges.className = 'home-pinned-badge-group';
    badges.innerHTML = `
      <span class="category-badge ${getBulletinCategoryBadgeClass(post.category)}">
        ${escapeHtml(post.category || 'その他')}
      </span>
    `;

    const date = document.createElement('span');
    date.className = 'text-muted text-xs';
    date.textContent = formatBulletinDateTimeWithDay(post.createdAt);

    header.appendChild(badges);
    header.appendChild(date);
    card.appendChild(header);

    const titleH4 = document.createElement('h4');
    titleH4.className = 'home-pinned-title';
    titleH4.textContent = post.title;
    card.appendChild(titleH4);

    container.appendChild(card);
  });
}

/**
 * =========================================
 * 🏠 ホーム画面用 最新の活動記録描画（直近の試合結果の下）
 * =========================================
 */
function renderHomeRecentBulletins() {
  const mount = document.getElementById('homeRecentBulletinMount');
  const emptyMsg = document.getElementById('homeNoRecentBulletinMsg');
  if (!mount) return;

  const posts = window.bulletinState.posts || [];
  if (posts.length === 0) {
    mount.replaceChildren();
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('hidden');
  mount.replaceChildren();

  // 最新3件を取得
  const recentPosts = posts.slice(0, 3);
  recentPosts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'home-recent-bulletin-card';
    card.onclick = () => {
      openBulletinDetailModal(post);
    };

    // 1段目: カテゴリバッジと日付（曜日付き）
    const header = document.createElement('div');
    header.className = 'home-recent-bulletin-header';

    const catBadge = document.createElement('span');
    catBadge.className = 'category-badge ' + getBulletinCategoryBadgeClass(post.category);
    catBadge.textContent = post.category || 'その他';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'text-muted text-xs';
    dateSpan.textContent = formatBulletinDateTimeWithDay(post.createdAt);

    header.appendChild(catBadge);
    header.appendChild(dateSpan);
    card.appendChild(header);

    // 2段目: タイトルと既読数
    const mainRow = document.createElement('div');
    mainRow.className = 'home-recent-bulletin-main';

    const titleH4 = document.createElement('h4');
    titleH4.className = 'home-recent-bulletin-title';
    titleH4.textContent = post.title;

    const readSpan = document.createElement('span');
    readSpan.className = 'home-recent-bulletin-read';
    readSpan.textContent = `既読 ${post.readCount || 0}`;

    mainRow.appendChild(titleH4);
    mainRow.appendChild(readSpan);
    card.appendChild(mainRow);

    mount.appendChild(card);
  });
}

/**
 * 指定したイベントIDに紐づく活動記録を取得
 * @param {string} eventId
 * @returns {Object|null}
 */
window.getBulletinPostForEvent = function(eventId) {
  if (!eventId) return null;
  const posts = window.bulletinState.posts || [];
  return posts.find(p => p.eventId === eventId) || null;
};

// グローバル公開
window.initBulletinTab = initBulletinTab;
window.loadBulletinData = loadBulletinData;
window.openBulletinCreateModal = openBulletinCreateModal;
window.openBulletinCreateModalForEvent = openBulletinCreateModalForEvent;
window.openBulletinEditModal = openBulletinEditModal;
window.openBulletinDetailModal = openBulletinDetailModal;
window.closeBulletinEditModalForce = closeBulletinEditModalForce;
window.closeBulletinDetailModalForce = closeBulletinDetailModalForce;
window.setBulletinCategoryFilter = setBulletinCategoryFilter;
window.toggleBulletinPinnedFilter = toggleBulletinPinnedFilter;
window.handleBulletinPostSubmit = handleBulletinPostSubmit;
window.handleBdmTogglePin = handleBdmTogglePin;
window.handleBdmTogglePinCheckbox = handleBdmTogglePinCheckbox;
window.handleBdmDelete = handleBdmDelete;
window.toggleBulletinReadersAccordion = toggleBulletinReadersAccordion;
window.renderHomePinnedAnnouncements = renderHomePinnedAnnouncements;
window.renderHomeRecentBulletins = renderHomeRecentBulletins;
window.applyBulletinPayload = applyBulletinPayload;
window.handleSubmitBulletinComment = handleSubmitBulletinComment;
window.handleDeleteBulletinComment = handleDeleteBulletinComment;
