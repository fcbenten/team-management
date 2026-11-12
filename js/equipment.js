/**
 * ==========================================
 * 備品管理 クライアントロジック (js_equipment.html)
 * ==========================================
 */

window.equipmentState = {
  masterList: [],
  itemsList: [],
  upcomingEquipment: [],
  isAdmin: false,
  isLoaded: false
};

/**
 * 備品品目の標準並び順マッピング
 */
const EQUIPMENT_CODE_ORDER = {
  'BIBS_BLUE': 10,
  'BIBS_YELLOW': 20,
  'BALL_TEAM': 30,
  'BALL_PERSONAL': 40,
  'REF_GEAR': 50,
  'REF_WEAR': 60,
  'TRIPOD': 70,
  'MARKERS': 80,
  'TACTICS_BOARD': 90,
  'CAPTAIN_MARK': 100
};

/**
 * 備品マスタを標準順（ビブス -> ボール -> 審判道具 -> その他）にソート
 * @param {Array<Object>} masters
 * @returns {Array<Object>}
 */
function sortEquipmentMasters(masters) {
  if (!masters || !Array.isArray(masters)) return [];
  return masters.slice().sort(function(a, b) {
    const oA = EQUIPMENT_CODE_ORDER[a.code] !== undefined ? EQUIPMENT_CODE_ORDER[a.code] : 999;
    const oB = EQUIPMENT_CODE_ORDER[b.code] !== undefined ? EQUIPMENT_CODE_ORDER[b.code] : 999;
    return oA - oB;
  });
}

/**
 * 備品現物アイテムを自動ソート（品目定義順 -> 保管者背番号昇順 -> 備考 -> 氏名 -> 管理ID）
 * @param {Array<Object>} items
 * @returns {Array<Object>}
 */
function sortEquipmentItems(items) {
  if (!items || !Array.isArray(items)) return [];
  return items.slice().sort(function(a, b) {
    // 1. 品目コードの優先順位（マスタ順）
    const oA = EQUIPMENT_CODE_ORDER[a.itemCode] !== undefined ? EQUIPMENT_CODE_ORDER[a.itemCode] : 999;
    const oB = EQUIPMENT_CODE_ORDER[b.itemCode] !== undefined ? EQUIPMENT_CODE_ORDER[b.itemCode] : 999;
    if (oA !== oB) return oA - oB;

    // 2. 保管者の背番号（昇順、未割当・番号なしは末尾）
    const numA = (a.memberNumber != null && a.memberNumber !== '' && !isNaN(Number(a.memberNumber))) ? Number(a.memberNumber) : 9999;
    const numB = (b.memberNumber != null && b.memberNumber !== '' && !isNaN(Number(b.memberNumber))) ? Number(b.memberNumber) : 9999;
    if (numA !== numB) return numA - numB;

    // 3. 備考（セット番号 1〜10番、11〜20番など）
    const noteA = String(a.notes || '');
    const noteB = String(b.notes || '');
    if (noteA !== noteB) return noteA.localeCompare(noteB, 'ja');

    // 4. メンバー名
    const nameA = String(a.memberName || '');
    const nameB = String(b.memberName || '');
    if (nameA !== nameB) return nameA.localeCompare(nameB, 'ja');

    // 5. 管理ID (EQ-001, EQ-002...)
    return String(a.itemId || '').localeCompare(String(b.itemId || ''));
  });
}

/**
 * ログイン中ユーザー情報を取得（セッション・ローカルストレージ両対応）
 * @returns {Object|null}
 */
function getAppActorUser() {
  if (window.currentUser && (window.currentUser.email || window.currentUser.name)) {
    return window.currentUser;
  }
  try {
    const raw = localStorage.getItem('fcb_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.email || parsed.name)) {
        window.currentUser = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return window.currentUser || null;
}

/**
 * ログインユーザーが管理者（代表・副代表）であるか判定
 * @returns {boolean}
 */
function isEquipmentAdminUser() {
  if (typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin()) return true;
  const u = getAppActorUser();
  if (u) {
    const role = String(u.role || '').trim();
    if (role === '代表' || role === '副代表' || role === '管理者' || role.toLowerCase() === 'admin') return true;
  }
  return !!window.equipmentState.isAdmin;
}

/**
 * 備品画面の初期化・アクティブ時描画
 */
function initEquipmentView(forceRefresh) {
  const container = document.getElementById('tab-equipment');
  if (!container) return;

  const loadingPlaceholder = container.querySelector('.tab-loading-placeholder');
  const mainContent = container.querySelector('.tab-main-content');

  // 初期データ (getInitialData) から取得済みの備品データがあれば即時反映
  if (!window.equipmentState.isLoaded && window.initialFullData && window.initialFullData.equipmentData) {
    applyEquipmentPayload(window.initialFullData.equipmentData);
  }

  if (window.equipmentState.isLoaded && !forceRefresh) {
    if (loadingPlaceholder) loadingPlaceholder.style.display = 'none';
    if (mainContent) mainContent.classList.remove('hidden');
    renderEquipmentUI();
    return;
  }

  // サーバーから最新備品データを取得
  refreshEquipmentData(forceRefresh);
}

/**
 * サーバーから最新の備品データを再取得
 */
function refreshEquipmentData(forceRefresh, isBackground = false) {
  const container = document.getElementById('tab-equipment');
  const loadingPlaceholder = container ? container.querySelector('.tab-loading-placeholder') : null;
  const mainContent = container ? container.querySelector('.tab-main-content') : null;

  if (!isBackground && !window.equipmentState.isLoaded) {
    if (loadingPlaceholder) loadingPlaceholder.style.display = 'block';
    if (mainContent) mainContent.classList.add('hidden');
  }

  const actor = getAppActorUser();
  const actorEmail = actor ? (actor.email || '') : '';
  const actorName = actor ? (actor.name || '') : '';

  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) {
        console.error('apiGetEquipmentData error:', res ? res.error : 'Unknown error');
        if (loadingPlaceholder) loadingPlaceholder.style.display = 'none';
        if (mainContent) mainContent.classList.remove('hidden');
        return;
      }

      applyEquipmentPayload(res);

      if (loadingPlaceholder) loadingPlaceholder.style.display = 'none';
      if (mainContent) mainContent.classList.remove('hidden');
      renderEquipmentUI();

      // ホーム画面の備品アラート表示も同時に最新化
      if (typeof updateHomeEquipmentNotice === 'function') {
        updateHomeEquipmentNotice();
      }
      // 予定詳細モーダルが開いている場合は備品持参状況も最新化
      if (typeof updateScheduleModalEquipmentStatus === 'function') {
        updateScheduleModalEquipmentStatus();
      }
    })
    .withFailureHandler(function(err) {
      console.error('apiGetEquipmentData failure:', err);
      if (loadingPlaceholder) loadingPlaceholder.style.display = 'none';
      if (mainContent) mainContent.classList.remove('hidden');
    })
    .apiGetEquipmentData(actorEmail, actorName);
}

/**
 * ペイロードをローカルステートに保存
 */
function applyEquipmentPayload(data) {
  if (!data) return;
  window.equipmentState.masterList = sortEquipmentMasters(data.masterList || []);
  window.equipmentState.itemsList = sortEquipmentItems(data.itemsList || []);
  window.equipmentState.upcomingEquipment = data.upcomingEquipment || [];
  window.equipmentState.isAdmin = !!data.isAdmin;
  window.equipmentState.isLoaded = true;

  // グローバルキャッシュにも保持
  if (window.initialFullData) {
    window.initialFullData.equipmentData = data;
  }
  if (window.homeInitialData) {
    window.homeInitialData.equipmentData = data;
  }
}

/**
 * UIの各コンポーネントを描画
 */
function renderEquipmentUI() {
  updateEquipmentAdminControls();
  renderEquipmentSummary();
  filterEquipmentList();
}

/**
 * 代表・副代表の権限に応じたUI制御
 */
function updateEquipmentAdminControls() {
  const isAdmin = isEquipmentAdminUser();
  const btnAdd = document.getElementById('btnAddEquipment');
  if (btnAdd) {
    btnAdd.classList.toggle('hidden', !isAdmin);
  }
}

/**
 * 備品統計サマリーの表示更新
 */
function renderEquipmentSummary() {
  const items = window.equipmentState.itemsList || [];
  const statTotal = document.getElementById('statTotalEquipment');
  const statBalls = document.getElementById('statTotalBalls');
  const statHolders = document.getElementById('statTotalHolders');

  const totalCount = items.length;
  const ballCount = items.filter(it => it.itemCode === 'BALL_TEAM').length;

  const holderSet = new Set();
  items.forEach(it => {
    if (it.memberId) holderSet.add(it.memberId);
  });

  if (statTotal) statTotal.textContent = totalCount + '点';
  if (statBalls) statBalls.textContent = ballCount + '球';
  if (statHolders) statHolders.textContent = holderSet.size + '名';
}

/**
 * 備品一覧の検索絞り込み＆セクションカード描画（左右2カラム構成）
 * 左カラム: ビブス、審判道具、その他（ボール以外を縦積み配置・余白最小化）
 * 右カラム: ボール（最多品目のため単独配置）
 */
function filterEquipmentList() {
  const searchInput = document.getElementById('equipmentSearchInput');
  const colLeft = document.getElementById('equipmentColLeft');
  const colRight = document.getElementById('equipmentColRight');
  const emptyState = document.getElementById('equipmentEmptyState');
  if (!colLeft || !colRight) return;

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const allItems = window.equipmentState.itemsList || [];
  const isAdmin = isEquipmentAdminUser();

  const filtered = allItems.filter(item => {
    if (query) {
      const master = (window.equipmentState.masterList || []).find(m => m.code === item.itemCode);
      const mName = master ? master.name.toLowerCase() : '';
      const holderName = (item.memberName || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      if (!mName.includes(query) && !holderName.includes(query) && !notes.includes(query)) {
        return false;
      }
    }
    return true;
  });

  colLeft.replaceChildren();
  colRight.replaceChildren();

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  // グループ分け（すべて自動ソートを適用）
  const bibsBlue = sortEquipmentItems(filtered.filter(it => it.itemCode === 'BIBS_BLUE'));
  const bibsYellow = sortEquipmentItems(filtered.filter(it => it.itemCode === 'BIBS_YELLOW'));
  const balls = sortEquipmentItems(filtered.filter(it => it.itemCode === 'BALL_TEAM' || it.itemCode === 'BALL_PERSONAL'));
  const referee = sortEquipmentItems(filtered.filter(it => it.itemCode === 'REF_GEAR' || it.itemCode === 'REF_WEAR'));
  const others = sortEquipmentItems(filtered.filter(it => it.itemCode !== 'BIBS_BLUE' && it.itemCode !== 'BIBS_YELLOW' && it.itemCode !== 'BALL_TEAM' && it.itemCode !== 'BALL_PERSONAL' && it.itemCode !== 'REF_GEAR' && it.itemCode !== 'REF_WEAR'));

  // 1. 左カラム: ビブス セクション
  if (bibsBlue.length > 0 || bibsYellow.length > 0) {
    const bibsSection = createBibsSectionElement(bibsBlue, bibsYellow, isAdmin);
    colLeft.appendChild(bibsSection);
  }

  // 2. 左カラム: 審判道具 セクション（ビブスの直下に密着配置）
  if (referee.length > 0) {
    const refSection = createRefereeSectionElement(referee, isAdmin);
    colLeft.appendChild(refSection);
  }

  // 3. 左カラム: その他用具 セクション
  if (others.length > 0) {
    const othersSection = createOthersSectionElement(others, isAdmin);
    colLeft.appendChild(othersSection);
  }

  // 4. 右カラム: ボール セクション（最多アイテム数・単独カラムで美しく収容）
  if (balls.length > 0) {
    const ballsSection = createBallsSectionElement(balls, isAdmin);
    colRight.appendChild(ballsSection);
  }
}

/**
 * ビブス セクションカードの生成（水色・黄色の2列サブボックス、点数バッジなし）
 */
function createBibsSectionElement(blueItems, yellowItems, isAdmin) {
  const card = document.createElement('div');
  card.className = 'equipment-section-card';

  const header = document.createElement('div');
  header.className = 'equipment-section-header';
  header.innerHTML = `
    <div class="equipment-section-title-group">
      <span class="material-symbols-outlined text-primary">checkroom</span>
      <span class="equipment-section-title">ビブス</span>
    </div>
  `;
  card.appendChild(header);

  const subboxGrid = document.createElement('div');
  subboxGrid.className = 'equipment-subbox-grid';

  // 水色サブボックス（点数バッジ不要）
  const blueBox = document.createElement('div');
  blueBox.className = 'equipment-subbox';
  blueBox.innerHTML = `
    <div class="equipment-subbox-header">
      <span class="equipment-subbox-title">水色</span>
    </div>
  `;
  const blueRows = document.createElement('div');
  blueRows.className = 'equipment-item-rows';
  if (blueItems.length > 0) {
    blueItems.forEach(item => {
      blueRows.appendChild(createSectionItemRow(item, isAdmin, { showLabel: false }));
    });
  } else {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'equipment-empty-hint';
    emptyDiv.textContent = '登録なし';
    blueRows.appendChild(emptyDiv);
  }
  blueBox.appendChild(blueRows);
  subboxGrid.appendChild(blueBox);

  // 黄色サブボックス（点数バッジ不要）
  const yellowBox = document.createElement('div');
  yellowBox.className = 'equipment-subbox';
  yellowBox.innerHTML = `
    <div class="equipment-subbox-header">
      <span class="equipment-subbox-title">黄色</span>
    </div>
  `;
  const yellowRows = document.createElement('div');
  yellowRows.className = 'equipment-item-rows';
  if (yellowItems.length > 0) {
    yellowItems.forEach(item => {
      yellowRows.appendChild(createSectionItemRow(item, isAdmin, { showLabel: false }));
    });
  } else {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'equipment-empty-hint';
    emptyDiv.textContent = '登録なし';
    yellowRows.appendChild(emptyDiv);
  }
  yellowBox.appendChild(yellowRows);
  subboxGrid.appendChild(yellowBox);

  card.appendChild(subboxGrid);
  return card;
}

/**
 * ボール セクションカードの生成（チーム所有・個人所有のサブボックス分割表示）
 */
function createBallsSectionElement(ballItems, isAdmin) {
  const card = document.createElement('div');
  card.className = 'equipment-section-card';

  const header = document.createElement('div');
  header.className = 'equipment-section-header';
  header.innerHTML = `
    <div class="equipment-section-title-group">
      <span class="material-symbols-outlined text-primary">sports_soccer</span>
      <span class="equipment-section-title">ボール</span>
    </div>
    <span class="equipment-section-count">${ballItems.length}球</span>
  `;
  card.appendChild(header);

  const teamBalls = sortEquipmentItems(ballItems.filter(it => it.itemCode === 'BALL_TEAM'));
  const personalBalls = sortEquipmentItems(ballItems.filter(it => it.itemCode === 'BALL_PERSONAL'));

  const subboxContainer = document.createElement('div');
  subboxContainer.className = 'equipment-ball-subbox-container';

  // 1. チーム所有サブボックス
  const teamBox = document.createElement('div');
  teamBox.className = 'equipment-subbox';
  teamBox.innerHTML = `
    <div class="equipment-subbox-header">
      <span class="equipment-subbox-title">ボール(チーム所有)</span>
      <span class="equipment-section-count">${teamBalls.length}球</span>
    </div>
  `;
  const teamRows = document.createElement('div');
  teamRows.className = 'equipment-item-rows';
  if (teamBalls.length > 0) {
    teamBalls.forEach(item => {
      teamRows.appendChild(createSectionItemRow(item, isAdmin, { showLabel: false, isBall: true }));
    });
  } else {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'equipment-empty-hint';
    emptyDiv.textContent = '登録なし';
    teamRows.appendChild(emptyDiv);
  }
  teamBox.appendChild(teamRows);
  subboxContainer.appendChild(teamBox);

  // 2. 個人所有サブボックス
  const personalBox = document.createElement('div');
  personalBox.className = 'equipment-subbox';
  personalBox.innerHTML = `
    <div class="equipment-subbox-header">
      <span class="equipment-subbox-title">ボール(個人所有)</span>
      <span class="equipment-section-count">${personalBalls.length}球</span>
    </div>
  `;
  const personalRows = document.createElement('div');
  personalRows.className = 'equipment-item-rows';
  if (personalBalls.length > 0) {
    personalBalls.forEach(item => {
      personalRows.appendChild(createSectionItemRow(item, isAdmin, { showLabel: false, isBall: true }));
    });
  } else {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'equipment-empty-hint';
    emptyDiv.textContent = '登録なし';
    personalRows.appendChild(emptyDiv);
  }
  personalBox.appendChild(personalRows);
  subboxContainer.appendChild(personalBox);

  card.appendChild(subboxContainer);
  return card;
}

/**
 * 審判道具 セクションカードの生成（点数バッジなし）
 */
function createRefereeSectionElement(refItems, isAdmin) {
  const card = document.createElement('div');
  card.className = 'equipment-section-card';

  const header = document.createElement('div');
  header.className = 'equipment-section-header';
  header.innerHTML = `
    <div class="equipment-section-title-group">
      <span class="material-symbols-outlined text-primary">sports</span>
      <span class="equipment-section-title">審判道具</span>
    </div>
  `;
  card.appendChild(header);

  const rows = document.createElement('div');
  rows.className = 'equipment-item-rows';
  refItems.forEach(item => {
    rows.appendChild(createSectionItemRow(item, isAdmin, { showLabel: true }));
  });
  card.appendChild(rows);

  return card;
}

/**
 * その他 セクションカードの生成（点数バッジなし）
 */
function createOthersSectionElement(otherItems, isAdmin) {
  const card = document.createElement('div');
  card.className = 'equipment-section-card';

  const header = document.createElement('div');
  header.className = 'equipment-section-header';
  header.innerHTML = `
    <div class="equipment-section-title-group">
      <span class="material-symbols-outlined text-primary">category</span>
      <span class="equipment-section-title">その他</span>
    </div>
  `;
  card.appendChild(header);

  const rows = document.createElement('div');
  rows.className = 'equipment-item-rows';
  otherItems.forEach(item => {
    rows.appendChild(createSectionItemRow(item, isAdmin, { showLabel: true }));
  });
  card.appendChild(rows);

  return card;
}

/**
 * 備品保管メンバーのアバター画像URLを取得（共通 getMemberAvatarUrl を使用）
 */
function getEquipmentMemberAvatarUrl(item) {
  if (typeof getMemberAvatarUrl === 'function') {
    return getMemberAvatarUrl(item);
  }
  return item ? (item.memberAvatarUrl || '') : '';
}

/**
 * セクション内の共通アイテム行要素の生成
 * 頭文字文字ではなくクリーンな人物アイコンを表示
 */
function createSectionItemRow(item, isAdmin, options) {
  options = options || {};
  const showLabel = options.showLabel !== false;
  const isBall = !!options.isBall;

  const row = document.createElement('div');
  row.className = 'equipment-item-row' + (isBall ? ' equipment-ball-row' : (showLabel ? ' equipment-labeled-row' : ' equipment-bibs-row'));

  const master = (window.equipmentState.masterList || []).find(m => m.code === item.itemCode) || { name: item.itemCode };

  // 1. 品目名（ラベルありセクション: 審判道具・その他など）
  if (showLabel) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'equipment-item-label';
    labelSpan.textContent = master.name;
    row.appendChild(labelSpan);
  }

  // 2. 保管メンバー情報（アバター・背番号・氏名）
  // 品目名の直後に固定幅で配置し、名前の縦ラインを完全に揃える
  const holderEl = document.createElement('div');
  holderEl.className = 'equipment-item-holder';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'holder-avatar-wrap';

  const isAssigned = item.memberName && item.memberName !== '未割当';
  const avatarUrl = isAssigned ? getEquipmentMemberAvatarUrl(item) : '';

  if (avatarUrl) {
    const img = document.createElement('img');
    img.className = 'holder-avatar-img';
    img.src = avatarUrl;
    img.alt = '';
    img.onerror = function() {
      this.style.display = 'none';
      if (!avatarWrap.querySelector('.holder-avatar-icon')) {
        const fallbackIcon = document.createElement('span');
        fallbackIcon.className = 'material-symbols-outlined holder-avatar-icon';
        fallbackIcon.textContent = isAssigned ? 'person' : 'person_off';
        avatarWrap.appendChild(fallbackIcon);
      }
    };
    avatarWrap.appendChild(img);
  } else {
    // 苗字の頭文字ではなく人物アイコンを表示
    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined holder-avatar-icon';
    iconSpan.textContent = isAssigned ? 'person' : 'person_off';
    avatarWrap.appendChild(iconSpan);
  }
  holderEl.appendChild(avatarWrap);

  const infoGroup = document.createElement('div');
  infoGroup.className = 'holder-info-group';

  if (isAssigned && item.memberNumber != null && item.memberNumber !== '') {
    const numText = document.createElement('span');
    numText.className = 'holder-number-text';
    numText.textContent = '#' + item.memberNumber;
    infoGroup.appendChild(numText);
  }

  const holderName = document.createElement('span');
  if (isAssigned) {
    holderName.className = 'holder-name';
    holderName.textContent = item.memberName;
  } else {
    holderName.className = 'holder-name holder-name-unassigned';
    holderName.textContent = '未割当';
  }
  infoGroup.appendChild(holderName);

  holderEl.appendChild(infoGroup);
  row.appendChild(holderEl);

  // 3. 備考: 名前の右側に配置（文字色を薄くし、備考の有無で名前の位置がズレないように設計）
  if (item.notes && item.notes.trim()) {
    const noteSpan = document.createElement('span');
    noteSpan.className = 'equipment-item-note';
    noteSpan.textContent = item.notes.trim();
    noteSpan.title = item.notes.trim();
    row.appendChild(noteSpan);
  }

  // 4. 操作（代表・副代表向け 編集ボタン）
  if (isAdmin) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'equipment-item-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-item-edit';
    editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span><span>編集</span>';
    editBtn.onclick = function() {
      openEditEquipmentModal(item);
    };
    actionsEl.appendChild(editBtn);
    row.appendChild(actionsEl);
  }

  return row;
}

/* =========================================
   モーダル制御（備品追加・編集）
   ========================================= */

/**
 * 備品新規追加モーダルを開く
 */
function openEquipmentAddModal() {
  window.currentEditingEquipmentItem = null;
  document.getElementById('equipmentEditModalTitle').textContent = '備品の新規登録';
  document.getElementById('equipmentEditItemId').value = '';
  document.getElementById('equipmentEditNotes').value = '';
  document.getElementById('equipmentEditError').classList.add('hidden');
  document.getElementById('btnDeleteEquipment').classList.add('hidden');

  populateEquipmentMasterSelect('');
  populateEquipmentMemberSelect('');

  openModalById('equipmentEditModal');
}

/**
 * 備品編集モーダルを開く
 */
function openEditEquipmentModal(item) {
  window.currentEditingEquipmentItem = item;
  document.getElementById('equipmentEditModalTitle').textContent = '備品情報の編集';
  document.getElementById('equipmentEditItemId').value = item.itemId || '';
  document.getElementById('equipmentEditNotes').value = item.notes || '';
  document.getElementById('equipmentEditError').classList.add('hidden');
  document.getElementById('btnDeleteEquipment').classList.remove('hidden');

  populateEquipmentMasterSelect(item.itemCode);
  populateEquipmentMemberSelect(item.memberId);

  openModalById('equipmentEditModal');
}

/**
 * 備品モーダルを閉じる
 */
function closeEquipmentEditModal(event) {
  if (event) event.stopPropagation();
  closeModalById('equipmentEditModal');
}

/**
 * 品目プルダウンを生成（補足説明文を排除しクリーンな品目名のみ表示）
 */
function populateEquipmentMasterSelect(selectedCode) {
  const select = document.getElementById('equipmentEditCode');
  if (!select) return;
  select.replaceChildren();

  const masters = sortEquipmentMasters(window.equipmentState.masterList || []);
  masters.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.code;
    opt.textContent = m.name;
    if (m.code === selectedCode) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * 保管メンバープルダウンを生成
 */
function populateEquipmentMemberSelect(selectedMemberId) {
  const select = document.getElementById('equipmentEditMemberId');
  if (!select) return;
  select.replaceChildren();

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '未割当';
  if (!selectedMemberId) defaultOpt.selected = true;
  select.appendChild(defaultOpt);

  const members = (window.scheduleRoster || window.adminMemberList || []);
  // 背番号順にソート
  const sorted = members.slice().sort((a, b) => {
    const numA = (a.number != null && a.number !== '') ? Number(a.number) : 999;
    const numB = (b.number != null && b.number !== '') ? Number(b.number) : 999;
    return numA - numB;
  });

  sorted.forEach(m => {
    const mId = m.memberId || ('MBR-' + ('000' + m.number).slice(-3));
    const opt = document.createElement('option');
    opt.value = mId;
    opt.textContent = (m.number != null && m.number !== '' ? '#' + m.number + ' ' : '') + m.name;
    if (mId === selectedMemberId) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * 備品保存の送信処理（楽観的UI更新で0秒即時反映）
 */
function handleSaveEquipmentSubmit(e) {
  if (e) e.preventDefault();
  const errEl = document.getElementById('equipmentEditError');

  const itemId = document.getElementById('equipmentEditItemId').value;
  const itemCode = document.getElementById('equipmentEditCode').value;
  const memberId = document.getElementById('equipmentEditMemberId').value;
  const notes = document.getElementById('equipmentEditNotes').value.trim();

  if (!itemCode) {
    if (errEl) {
      errEl.textContent = '品目を選択してください。';
      errEl.classList.remove('hidden');
    }
    return;
  }

  // メンバー情報の解決（名前・背番号・アバターURL）
  const members = (window.scheduleRoster || window.adminMemberList || []);
  const mInfo = members.find(m => {
    const mId = m.memberId || ('MBR-' + ('000' + m.number).slice(-3));
    return mId === memberId;
  }) || null;

  // 1. 楽観的UI更新（モーダルを即時閉じ、画面を0秒で即座に反映）
  const previousItems = JSON.parse(JSON.stringify(window.equipmentState.itemsList || []));
  const isNew = !itemId;
  const tempId = itemId || ('TEMP-' + Date.now());

  if (!isNew) {
    const targetItem = (window.equipmentState.itemsList || []).find(it => it.itemId === itemId);
    if (targetItem) {
      targetItem.itemCode = itemCode;
      targetItem.memberId = memberId;
      targetItem.memberName = mInfo ? mInfo.name : (memberId ? '不明な部員' : '未割当');
      targetItem.memberNumber = mInfo ? mInfo.number : null;
      targetItem.memberAvatarUrl = mInfo ? (mInfo.avatarUrl || '') : '';
      targetItem.notes = notes;
    }
  } else {
    window.equipmentState.itemsList.push({
      itemId: tempId,
      itemCode: itemCode,
      memberId: memberId,
      memberName: mInfo ? mInfo.name : (memberId ? '不明な部員' : '未割当'),
      memberNumber: mInfo ? mInfo.number : null,
      memberAvatarUrl: mInfo ? (mInfo.avatarUrl || '') : '',
      notes: notes,
      updatedAt: 'たった今'
    });
  }

  // 常に自動ソートして保持
  window.equipmentState.itemsList = sortEquipmentItems(window.equipmentState.itemsList);

  // グローバルキャッシュの同期
  if (window.initialFullData && window.initialFullData.equipmentData) {
    window.initialFullData.equipmentData.itemsList = window.equipmentState.itemsList;
  }

  // 画面即時再描画＆モーダルクローズ
  renderEquipmentUI();
  closeModalById('equipmentEditModal');

  // ホームの備品アラート表示等も即時更新
  if (typeof updateHomeEquipmentNotice === 'function') {
    updateHomeEquipmentNotice();
  }

  const actor = getAppActorUser();
  const actorEmail = actor ? (actor.email || '') : '';
  const actorName = actor ? (actor.name || '') : '';

  // 2. バックグラウンドでGASへ非同期保存
  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) {
        console.error('apiSaveEquipmentItem failed:', res ? res.error : 'Unknown');
        // 保存失敗時は元の状態に戻して再描画
        window.equipmentState.itemsList = previousItems;
        if (window.initialFullData && window.initialFullData.equipmentData) {
          window.initialFullData.equipmentData.itemsList = previousItems;
        }
        renderEquipmentUI();
        showAppAlert({ title: '保存失敗', message: '備品の保存に失敗しました: ' + (res ? res.error : '通信エラー'), isError: true });
        return;
      }

      // 新規登録だった場合は生成された正規IDに差し替え
      if (isNew && res.itemId) {
        const tempItem = (window.equipmentState.itemsList || []).find(it => it.itemId === tempId);
        if (tempItem) {
          tempItem.itemId = res.itemId;
        }
      }
    })
    .withFailureHandler(function(err) {
      console.error('apiSaveEquipmentItem error:', err);
      window.equipmentState.itemsList = previousItems;
      if (window.initialFullData && window.initialFullData.equipmentData) {
        window.initialFullData.equipmentData.itemsList = previousItems;
      }
      renderEquipmentUI();
      showAppAlert({ title: '通信エラー', message: '保存通信エラーが発生しました: ' + (err.message || err), isError: true });
    })
    .apiSaveEquipmentItem({ itemId: itemId, itemCode: itemCode, memberId: memberId, notes: notes }, actorEmail, actorName);
}

/**
 * 編集モーダル内の「備品を削除」ボタンから確認モーダルを開く
 */
function openEquipmentDeleteConfirmModal() {
  const itemId = document.getElementById('equipmentEditItemId').value;
  if (!itemId) return;

  const itCode = document.getElementById('equipmentEditCode').value;
  const master = (window.equipmentState.masterList || []).find(m => m.code === itCode);
  const itemName = master ? master.name : 'この備品';

  // 現在選択されている保管メンバー名を取得
  const memberId = document.getElementById('equipmentEditMemberId').value;
  const members = (window.scheduleRoster || window.adminMemberList || []);
  const mInfo = members.find(m => {
    const mId = m.memberId || ('MBR-' + ('000' + m.number).slice(-3));
    return mId === memberId;
  });
  const holderText = mInfo ? `（保管: ${mInfo.name}）` : '';

  const targetNameEl = document.getElementById('equipmentDeleteTargetName');
  if (targetNameEl) {
    targetNameEl.textContent = itemName + holderText;
  }

  const deleteBtn = document.getElementById('btnConfirmDeleteEquipment');
  if (deleteBtn) {
    deleteBtn.disabled = false;
  }

  const statusEl = document.getElementById('equipmentDeleteStatus');
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
  }

  openModalById('equipmentDeleteModal');
}

/**
 * 備品削除確認モーダルを閉じる
 */
function closeEquipmentDeleteModal(event) {
  if (event && event.target && event.target.closest('.delete-confirm-content') && !event.target.closest('.btn-equipment-modal-cancel')) {
    return;
  }
  closeModalById('equipmentDeleteModal');
}

/**
 * 備品削除の実行（楽観的UI更新で0秒即時反映）
 */
function executeDeleteEquipmentPermanently() {
  const itemId = document.getElementById('equipmentEditItemId').value;
  if (!itemId) return;

  const deleteBtn = document.getElementById('btnConfirmDeleteEquipment');
  if (deleteBtn) deleteBtn.disabled = true;

  // 1. 楽観的UI更新（即時削除・両モーダルクローズ）
  const previousItems = JSON.parse(JSON.stringify(window.equipmentState.itemsList || []));
  window.equipmentState.itemsList = (window.equipmentState.itemsList || []).filter(it => it.itemId !== itemId);

  if (window.initialFullData && window.initialFullData.equipmentData) {
    window.initialFullData.equipmentData.itemsList = window.equipmentState.itemsList;
  }

  renderEquipmentUI();
  closeModalById('equipmentDeleteModal');
  closeModalById('equipmentEditModal');

  if (typeof updateHomeEquipmentNotice === 'function') {
    updateHomeEquipmentNotice();
  }

  const actor = getAppActorUser();
  const actorEmail = actor ? (actor.email || '') : '';
  const actorName = actor ? (actor.name || '') : '';

  // 2. バックグラウンドで削除リクエスト（Supabase Direct / GAS Proxy）
  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) {
        console.error('apiDeleteEquipmentItem failed:', res ? res.error : 'Unknown');
        window.equipmentState.itemsList = previousItems;
        if (window.initialFullData && window.initialFullData.equipmentData) {
          window.initialFullData.equipmentData.itemsList = previousItems;
        }
        renderEquipmentUI();
        showAppAlert({ title: '削除失敗', message: '備品の削除に失敗しました: ' + (res ? res.error : '通信エラー'), isError: true });
      }
    })
    .withFailureHandler(function(err) {
      console.error('apiDeleteEquipmentItem error:', err);
      window.equipmentState.itemsList = previousItems;
      if (window.initialFullData && window.initialFullData.equipmentData) {
        window.initialFullData.equipmentData.itemsList = previousItems;
      }
      renderEquipmentUI();
      showAppAlert({ title: '通信エラー', message: '削除通信エラーが発生しました: ' + (err.message || err), isError: true });
    })
    .apiDeleteEquipmentItem(itemId, actorEmail, actorName);
}

/**
 * 互換用エイリアス
 */
function handleDeleteEquipmentClick() {
  openEquipmentDeleteConfirmModal();
}

/* =========================================
   不在アラート代理解決処理（確認ダイアログなし・即時「代理」登録）
   ========================================= */

/**
 * 不在アラートを直接「代理」として解決
 */
function openEquipmentResolveModal(eventId, eventDate, itemCode, itemName, eventTitle, btnEl) {
  executeEquipmentResolve(eventId, eventDate, itemCode, itemName, btnEl);
}

/**
 * ローカル状態の備品アラートを即時解決済みに更新（楽観的UI更新）
 */
function markEquipmentResolvedLocally(eventId, eventDate, itemCode) {
  const updateList = function(list) {
    if (!list || !Array.isArray(list)) return;
    const evDateStr = String(eventDate || '').replace(/-/g, '/').trim();
    const cleanId = String(eventId || '').split('@')[0];
    list.forEach(function(ev) {
      const dStr = String(ev.eventDate || ev.date || '').replace(/-/g, '/').trim();
      const eId = String(ev.eventId || ev.id || '').split('@')[0];
      const matches = (cleanId && eId && cleanId === eId) || (evDateStr && dStr && evDateStr === dStr);
      if (matches && ev.equipmentStatus) {
        ev.equipmentStatus.forEach(function(st) {
          if (st.code === itemCode || (itemCode === 'BALL_TEAM' && (st.code === 'BALL_PERSONAL' || String(st.name || '').includes('ボール')))) {
            st.isAlert = false;
            st.alertLevel = 'NONE';
            st.isResolved = true;
            st.assignedMemberName = '代理';
          }
        });
        ev.hasAlert = ev.equipmentStatus.some(function(s) { return s.isAlert; });
      }
    });
  };

  if (window.equipmentState && window.equipmentState.upcomingEquipment) {
    updateList(window.equipmentState.upcomingEquipment);
  }
  if (window.homeInitialData && window.homeInitialData.equipmentData && window.homeInitialData.equipmentData.upcomingEquipment) {
    updateList(window.homeInitialData.equipmentData.upcomingEquipment);
  }
  if (window.initialFullData && window.initialFullData.equipmentData && window.initialFullData.equipmentData.upcomingEquipment) {
    updateList(window.initialFullData.equipmentData.upcomingEquipment);
  }

  if (typeof updateHomeEquipmentNotice === 'function') {
    updateHomeEquipmentNotice();
  }
  if (typeof updateScheduleModalEquipmentStatus === 'function') {
    updateScheduleModalEquipmentStatus();
  }
}

/**
 * 解決処理の実行
 */
function executeEquipmentResolve(eventId, eventDate, itemCode, itemName, btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.classList.add('btn-resolving');
    btnEl.textContent = '更新中...';
  }

  // 即時ローカル反映でUIレスポンスを向上
  markEquipmentResolvedLocally(eventId, eventDate, itemCode);

  const actor = getAppActorUser();
  const actorEmail = actor ? (actor.email || '') : '';
  const actorName = actor ? (actor.name || '') : '';

  google.script.run
    .withSuccessHandler(function(res) {
      if (!res || !res.success) {
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.classList.remove('btn-resolving');
          btnEl.textContent = '解決';
        }
        showAppAlert({ title: '解決エラー', message: res ? res.error : '解決の登録に失敗しました。', isError: true });
        refreshEquipmentData(true);
        return;
      }

      refreshEquipmentData(true);
    })
    .withFailureHandler(function(err) {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.classList.remove('btn-resolving');
        btnEl.textContent = '解決';
      }
      showAppAlert({ title: '通信エラー', message: '通信エラー: ' + (err.message || err), isError: true });
      refreshEquipmentData(true);
    })
    .apiResolveEquipmentAlert({ eventId: eventId, eventDate: eventDate, itemCode: itemCode, proxyMemberId: '代理' }, actorEmail, actorName);
}
