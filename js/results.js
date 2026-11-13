// =========================================
// 📊 試合結果一覧・モーダルの制御
// =========================================

/**
 * 試合結果データの初期描画とフィルターの準備
 * 
 * @param {Object} data - サーバーから取得した試合結果オブジェクト
 */
function initMatchHistory(data) {
  if (!data) return;
  
  // 取得した全試合データをグローバル変数に保存
  if (data.matches) window.allMatchResults = data.matches;
  if (data.error) window.matchHistoryError = data.error;
  
  // シーズン（年）のフィルター用プルダウンを構築
  const seasons = data.seasons || [];
  const seasonSelect = document.getElementById('seasonFilter');
  
  if (seasonSelect) {
    seasonSelect.innerHTML = '';
    seasons.forEach(s => { 
      seasonSelect.add(new Option(s + '年シーズン', s)); 
    });
    
    // デフォルトで最新のシーズンを選択状態にする
    if (seasons.length > 0) seasonSelect.value = seasons[0];
  }
  
  // フィルターを適用して一覧を描画
  filterMatchResults();
}

window.resultsPerPage = 5;
window.currentDisplayedCount = 5;
window.filteredMatchResults = [];

/**
 * 試合結果一覧の空状態メッセージをテンプレートから描画する
 */
function setResultsEmptyMessage(container, message) {
  if (!container) return;
  container.innerHTML = '';
  const tpl = document.getElementById('tpl-results-empty');
  if (tpl) {
    const clone = tpl.content.cloneNode(true);
    const msgEl = clone.querySelector('.results-empty-msg');
    if (msgEl) msgEl.textContent = message;
    container.appendChild(clone);
  } else {
    container.textContent = message;
  }
}

/**
 * 選択されたフィルター（シーズン、カテゴリ、検索文字列）に基づいて
 * 試合結果一覧を絞り込み、画面に描画する
 */
function filterMatchResults() {
  const season = document.getElementById('seasonFilter').value;
  const category = document.getElementById('categoryFilter').value;
  const searchInput = document.getElementById('searchFilter');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  
  const container = document.getElementById('resultsList');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  if (!container) return;
  
  // データが存在しない場合
  if (!window.allMatchResults || window.allMatchResults.length === 0) {
    setResultsEmptyMessage(container, '試合結果がありません');
    if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
    return;
  }
  
  // 各試合データがフィルター条件に合致するか判定する
  window.filteredMatchResults = window.allMatchResults.filter(m => {
    const matchYear = m.year || (m.date ? m.date.substring(0, 4) : "");
    if (season && matchYear !== season) return false;
    if (category !== 'all' && m.category !== category) return false;
    if (search && (!m.opponent || !m.opponent.toLowerCase().includes(search))) return false;
    return true;
  });
  
  window.currentDisplayedCount = window.resultsPerPage;
  renderMatchResults();
}

/**
 * 絞り込まれた試合データを一定件数だけ描画する
 */
function renderMatchResults() {
  const container = document.getElementById('resultsList');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  
  // 絞り込んだ結果が0件だった場合
  if (window.filteredMatchResults.length === 0) {
    setResultsEmptyMessage(container, '条件に一致する試合がありません');
    if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
    return;
  }
  
  // 絞り込み結果をもとにテンプレートを使ってカード一覧を生成
  container.replaceChildren();
  const matchesToRender = window.filteredMatchResults.slice(0, window.currentDisplayedCount);
  matchesToRender.forEach(m => {
    container.appendChild(createMatchCardElement(m));
  });

  if (loadMoreContainer) {
    loadMoreContainer.classList.toggle('hidden', !(window.currentDisplayedCount < window.filteredMatchResults.length));
  }
}

/**
 * 試合データから共通の試合結果カードDOMを生成（他画面でも再利用可能）
 * @param {Object} m - 試合オブジェクト
 * @returns {HTMLElement|DocumentFragment}
 */
function createMatchCardElement(m) {
  const tplCard = document.getElementById('tpl-match-card');
  if (!tplCard) return document.createElement('div');

  let resultClass = 'draw'; 
  if (m.result === '勝利') { resultClass = 'win'; }
  if (m.result === '敗北') { resultClass = 'lose'; }
  
  const clone = tplCard.content.cloneNode(true);
  const cardEl = clone.querySelector('.match-card');
  if (cardEl) {
    cardEl.classList.add('result-' + resultClass);
    cardEl.onclick = () => openMatchDetail(m.matchId);
  }
  
  const catBadge = clone.querySelector('.card-category');
  if (catBadge) {
    catBadge.textContent = m.category || '試合';
    catBadge.className = 'category-badge card-category ' + (m.category === '公式戦' ? 'badge-official' : 'badge-trm');
  }
  let dateText = m.date || '';
  try {
    if (m.date) {
      const d = new Date(m.date);
      if (!isNaN(d)) {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        dateText = `${m.date} (${days[d.getDay()]})`;
      }
    }
  } catch(e) {}
  const dateEl = clone.querySelector('.card-date');
  if (dateEl) dateEl.textContent = dateText;
  
  const scoreBox = clone.querySelector('.match-card-score-box');
  if (scoreBox) scoreBox.classList.add(resultClass);
  
  const myScoreEl = clone.querySelector('.card-my-score');
  if (myScoreEl) myScoreEl.textContent = (m.myScore !== undefined) ? m.myScore : '-';
  const oppScoreEl = clone.querySelector('.card-opp-score');
  if (oppScoreEl) oppScoreEl.textContent = (m.oppScore !== undefined) ? m.oppScore : '-';
  const oppNameEl = clone.querySelector('.card-opponent');
  if (oppNameEl) oppNameEl.textContent = m.opponent || '未定';
  
  const locRow = clone.querySelector('.match-card-location-row');
  const locSpan = clone.querySelector('.card-location');
  if (locRow && locSpan) {
    if (m.location) {
      locSpan.textContent = m.location;
      locRow.classList.remove('hidden');
    } else {
      locRow.classList.add('hidden');
    }
  }
  
  return clone;
}

window.createMatchCardElement = createMatchCardElement;

/**
 * 「さらに読み込む」ボタン処理
 */
function loadMoreMatches() {
  window.currentDisplayedCount += window.resultsPerPage;
  renderMatchResults();
}

/**
 * 指定された試合の詳細情報モーダルを開く
 * 
 * @param {string} matchId - 表示する試合のユニークID
 */
function openMatchDetail(matchId) {
  const match = window.allMatchResults.find(m => m.matchId === matchId);
  if (!match) return;
  
  // 編集ボタンを押したときのために、現在表示中の試合IDを記憶しておく
  window.currentViewingMatchId = matchId;
  
  // モーダルのヘッダー・基本情報をセット
  const modalCat = document.getElementById('modalCategory');
  if (modalCat) {
    modalCat.textContent = match.category;
    modalCat.className = 'category-badge ' + (match.category === '公式戦' ? 'badge-official' : 'badge-trm');
  }
  document.getElementById('modalDate').textContent = match.date;
  document.getElementById('modalOpponent').textContent = match.opponent;
  
  const locRow = document.getElementById('modalLocationRow');
  const locSpan = document.getElementById('modalLocation');
  if (locRow && locSpan) {
    if (match.location) {
      locSpan.textContent = match.location;
      locRow.classList.remove('hidden');
    } else {
      locRow.classList.add('hidden');
    }
  }
  
  // スコアボックスの色を勝敗に応じて切り替える
  const scoreBox = document.getElementById('modalScoreBox');
  scoreBox.className = 'modal-score-box'; 
  if (match.result === '勝利') { scoreBox.classList.add('win'); }
  else if (match.result === '敗北') { scoreBox.classList.add('lose'); }
  else { scoreBox.classList.add('draw'); }
  
  // スコアをセット
  document.getElementById('modalMyScore').textContent = match.myScore;
  document.getElementById('modalOppScore').textContent = match.oppScore;
  
  // 前半・後半・延長ごとのスコアを流し込む
  const hs = match.halfScores || {my1st:0, opp1st:0, my2nd:0, opp2nd:0, myExt:0, oppExt:0};
  document.getElementById('modalHalf1stVal').textContent = hs.my1st + ' - ' + hs.opp1st;
  document.getElementById('modalHalf2ndVal').textContent = hs.my2nd + ' - ' + hs.opp2nd;
  
  const extRow = document.getElementById('modalHalfExtRow');
  if (extRow) {
    if (hs.myExt > 0 || hs.oppExt > 0) {
      document.getElementById('modalHalfExtVal').textContent = hs.myExt + ' - ' + hs.oppExt;
      extRow.classList.remove('hidden');
    } else {
      extRow.classList.add('hidden');
    }
  }
  
  // MOMをセット
  const momEl = document.getElementById('modalMom');
  if (match.mom && match.mom !== 'なし') {
    momEl.textContent = match.mom;
  } else {
    momEl.textContent = '選出なし';
  }

  // 出場選手リストをセット
  document.getElementById('modalAttended').textContent = match.attended || '記録なし';
  
  // タイムライン（ログ）の描画処理
  const logsContainer = document.getElementById('modalLogs');
  const noLogs = document.getElementById('modalNoLogs');
  
  logsContainer.innerHTML = ''; 

  const hasLogs = match.logs && match.logs.length > 0;
  if (noLogs) noLogs.classList.toggle('hidden', hasLogs);

  if (hasLogs) {
    const tplPeriod = document.getElementById('tpl-period');
    const tplRow = document.getElementById('tpl-log-row');
    const tplActionLeft = document.getElementById('tpl-action-left');
    const tplActionRight = document.getElementById('tpl-action-right');

    const periods = ['前半', '後半', '延長'];
    
    // ピリオド（前半・後半・延長）ごとにループしてログをまとめる
    periods.forEach(p => {
      // 該当するピリオドのログだけを抽出し、時間（min）が早い順にソートする
      const periodLogs = match.logs.filter(l => l.period === p).sort((a, b) => a.min - b.min);
      
      if (periodLogs.length > 0) {
        // ピリオドの見出し（例：「前半」）を配置
        const periodClone = tplPeriod.content.cloneNode(true);
        periodClone.querySelector('.tl-period-label').textContent = p;
        logsContainer.appendChild(periodClone);

        // 各ログの詳細をタイムラインに追加
        periodLogs.forEach(l => {
          const rowClone = tplRow.content.cloneNode(true);
          rowClone.querySelector('.tl-time').textContent = l.min + '分';
          
          const dot = rowClone.querySelector('.tl-dot');
          const leftContainer = rowClone.querySelector('.tl-left');
          const rightContainer = rowClone.querySelector('.tl-right');

          if (l.type === '相手得点') {
            dot.classList.add('dot-opp');
            const rightClone = tplActionRight.content.cloneNode(true);
            rightClone.querySelector('.tl-action-title').textContent = '相手得点';
            rightContainer.appendChild(rightClone);
          } else {
            const leftClone = tplActionLeft.content.cloneNode(true);
            const titleEl = leftClone.querySelector('.tl-action-title');
            const playerEl = leftClone.querySelector('.tl-player');
            const assistEl = leftClone.querySelector('.tl-assist');
            
            playerEl.textContent = l.player;
            
            if (l.type === 'イエロー') {
              dot.classList.add('dot-card');
              titleEl.textContent = 'イエロー';
              titleEl.classList.add('badge-yellow');
            } else if (l.type === 'レッド') {
              dot.classList.add('dot-card');
              titleEl.textContent = 'レッド';
              titleEl.classList.add('badge-red');
            } else { 
              dot.classList.add('dot-goal');
              titleEl.textContent = 'ゴール';
              titleEl.classList.add('badge-goal');
              if (l.assist && l.assist !== '-') {
                assistEl.textContent = '(A: ' + l.assist + ')';
              }
            }
            leftContainer.appendChild(leftClone);
          }
          logsContainer.appendChild(rowClone);
        });
      }
    });
  }
  
  // モーダルを表示して背景のスクロールを無効化する
  const detailModal = document.getElementById('matchDetailModal');
  detailModal.classList.add('active');
  const bodyEl = detailModal.querySelector('.modal-match-body');
  if (bodyEl) bodyEl.scrollTop = 0;
  if (typeof lockBodyScroll === 'function') lockBodyScroll();
  else document.body.classList.add('no-scroll');
}

/**
 * 試合詳細モーダルを閉じる
 * 
 * @param {Event} e - マウスクリックイベント
 */
function closeMatchDetailModal(e) {
  // モーダルのコンテンツ部分をクリックした場合は閉じない
  if (e && e.target && e.target.closest('.modal-content') && !e.target.closest('.modal-close')) { 
    return; 
  }
  document.getElementById('matchDetailModal').classList.remove('active');
  if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  else document.body.classList.remove('no-scroll');
}

/**
 * 新規入力画面へ遷移する
 */
function openNewMatchInput() {
  window.isEditingFromModal = false;
  switchTab('input');
  
  // 新規入力用に画面をリセットし、カレンダーのプルダウンを表示する
  const eventSelectBox = document.getElementById('eventSelectBox');
  if (eventSelectBox) eventSelectBox.style.display = 'block';
  
  const select = document.getElementById('eventSelect');
  if (select) select.value = '';
  
  const container = document.getElementById('inputFormContainer');
  if (container) container.style.display = 'none';
  
  currentMatchId = null;
  matchLogs = [];
}

/**
 * 詳細モーダルから編集モードで入力画面へ遷移する
 * カレンダーとの連携に依存せず、直接試合データをフォームに流し込む
 */
function goToEditMatch() {
  const matchId = window.currentViewingMatchId;
  if (!matchId) return;

  // 1. モーダルを閉じて入力タブへ切り替える
  closeMatchDetailModal();
  window.isEditingFromModal = true;
  switchTab('input');
  
  const container = document.getElementById('inputFormContainer');
  const eventSelectBox = document.getElementById('eventSelectBox');
  
  // 編集モードの時は誤操作を防ぐため「試合選択のプルダウン」を隠す
  if (eventSelectBox) eventSelectBox.style.display = 'none';
  
  // 2. 試合結果のデータ群から直接データを引っこ抜く
  const match = window.allMatchResults.find(m => m.matchId === matchId);
  if (!match) {
    showAppAlert({ title: 'データなし', message: '試合データが見つかりません', isError: true });
    return;
  }
  
  if (container) container.style.display = 'block';
  
  // 3. 値を直接セットしていく
  document.getElementById('matchDate').textContent = match.date || '';
  document.getElementById('matchCategory').textContent = match.category || '';
  document.getElementById('opponent').textContent = match.opponent || '';
  
  const locationInput = document.getElementById('matchLocation');
  if (locationInput) locationInput.value = match.location || '';
  
  const attendedList = match.attended || '';
  document.getElementById('attended').textContent = attendedList;
  
  if (typeof updatePlayerDropdowns === 'function') {
    updatePlayerDropdowns(attendedList ? attendedList.split(',').map(s => s.trim()) : []);
  }
  
  // 4. 編集用の変数をグローバルにセット（ログは直接汚染しないようディープコピー）
  currentMatchId = match.matchId;
  matchLogs = match.logs ? JSON.parse(JSON.stringify(match.logs)) : [];
  
  // 5. UIを「直接編集モード」に変更
  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.className = "status-badge status-edit";
    badge.textContent = '登録済み（編集モード）';
    badge.style.display = 'block';
  }
  
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.textContent = "上書き保存";
  
  const momSelect = document.getElementById('momSelect');
  if (momSelect) momSelect.value = match.mom || "なし";
  
  if (typeof renderLogs === 'function') renderLogs();
}
