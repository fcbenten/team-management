// =========================================
// 📝 入力・編集・保存機能
// =========================================

/**
 * 試合選択プルダウンの初期化
 * 登録済みの試合を除外し、未登録の予定のみを選択肢として表示する
 * 
 * @param {Array} events - サーバーから取得したカレンダーイベントデータ
 */
function initEvents(events) {
  // イベントデータが不正な場合はエラー表示
  if (!events || !Array.isArray(events)) {
    if (typeof handleError === 'function') handleError('eventSelect', 'イベントデータが不正です');
    return;
  }
  
  // 古い日付から昇順（過去〜未来）にソート
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date((a.date || '').replace(/-/g, '/')).getTime() || 0;
    const timeB = new Date((b.date || '').replace(/-/g, '/')).getTime() || 0;
    return timeA - timeB;
  });

  eventsData = sortedEvents;
  const select = document.getElementById('eventSelect');
  if (!select) return;

  let optionsHtml = '<option value="">-- 試合を選択 --</option>';

  // カレンダーの予定をループして選択肢を作成する
  sortedEvents.forEach((e, idx) => {
    const title = (e.title || '').toString().toUpperCase();
    const opp = (e.opponent || '').toString().trim();

    // 練習(TR)や対戦相手が未設定の予定は除外する
    const isTRTitle = title === 'TR' || title.startsWith('TR ') || (title.includes('練習') && !title.includes('練習試合'));
    const isInvalidOpponent = !opp || opp === '未設定' || opp.toUpperCase() === 'TR' || (opp.includes('練習') && !opp.includes('練習試合'));

    if (isTRTitle || isInvalidOpponent) return;

    // すでに登録済みの試合はプルダウンの選択肢に含めない（フロントエンドでのクロスチェック）
    const isRegisteredLocally = (window.allMatchResults || []).some(m => m.date === e.date);
    if (isRegisteredLocally) return;

    optionsHtml += '<option value="' + idx + '">' + e.date + ' vs ' + e.opponent + '</option>';
  });

  select.innerHTML = optionsHtml;
}

/**
 * カレンダーの予定が選択された際の処理
 * フォームを表示し、自動取得された情報をセットする
 */
function onEventSelect() {
  const select = document.getElementById('eventSelect');
  const container = document.getElementById('inputFormContainer');
  if (!select || !container) return;
  
  const idx = select.value;
  
  // 未選択に戻された場合はフォームを隠す
  if (idx === "") {
    container.style.display = 'none';
    return;
  }
  
  const ev = eventsData[idx];
  if (!ev) return;
  
  container.style.display = 'block';

  // 1. 基本情報をセット
  document.getElementById('matchDate').textContent = ev.date || '';
  document.getElementById('matchCategory').textContent = ev.category || '';
  document.getElementById('opponent').textContent = ev.opponent || '';
  
  // 場所のセット（フル住所から施設名だけを抽出する）
  let locationVal = '';
  if (ev.location) {
    locationVal = ev.location.split(/,|，|、| 〒| 住所/)[0].trim();
  }
  const locationInput = document.getElementById('matchLocation');
  if (locationInput) locationInput.value = locationVal;
  
  // 出席者リストをセット
  const attendedList = ev.calendarAttended || '';
  document.getElementById('attended').textContent = attendedList;
  
  // 選手プルダウンを出席者で更新
  updatePlayerDropdowns(attendedList ? attendedList.split(',').map(s => s.trim()) : []);

  // 2. 新規モード用の状態リセット
  currentMatchId = null;
  matchLogs = [];
  
  // ステータスバッジの表示を更新（新規）
  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.className = "status-badge status-new";
    badge.textContent = "未登録（新規入力）";
    badge.style.display = 'block';
  }
  
  // ボタンの文言を「新規保存」にする
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.textContent = "新規保存";
  
  // MOMプルダウンをリセット
  const momSelect = document.getElementById('momSelect');
  if (momSelect) momSelect.value = "なし";
  
  // ログ一覧を再描画
  renderLogs();
}

/**
 * 参加選手一覧に基づいて、選手・アシスト・MOMのプルダウンを生成する
 * 
 * @param {Array} members - 試合に参加した選手名の配列
 */
function updatePlayerDropdowns(members) {
  window.currentMatchMembers = members; 
  
  const assistSel = document.getElementById('logAssist');
  const momSel = document.getElementById('momSelect');
  if (!assistSel || !momSel) return;
  
  const currentMom = momSel.value;
  
  let assistHtml = '<option value="-">なし</option>';
  let momHtml = '<option value="なし">なし</option>';
  
  // メンバー配列をループして選択肢を追加する
  members.forEach(m => {
    if(!m) return;
    assistHtml += '<option value="' + m + '">' + m + '</option>';
    momHtml += '<option value="' + m + '">' + m + '</option>';
  });
  
  // 末尾に「助っ人」を追加する (アシストのみ)
  assistHtml += '<option value="助っ人">助っ人</option>';
  
  assistSel.innerHTML = assistHtml;
  momSel.innerHTML = momHtml;
  
  // 再描画前に選択されていたMOMがいれば維持する
  if (members.includes(currentMom)) momSel.value = currentMom;

  buildPlayerDropdown();
}

/**
 * アクションの種類（得点等）に応じて選手プルダウンの中身を構築する
 */
function buildPlayerDropdown() {
  const playerSel = document.getElementById('logPlayer');
  if (!playerSel) return;
  
  const type = document.getElementById('logType').value;
  const members = window.currentMatchMembers || [];
  const currentPlayer = playerSel.value; 
  
  let playerHtml = '<option value="">-- 選択 --</option>';
  
  // メンバー配列をループして選択肢を追加する
  members.forEach(m => {
    if(!m) return;
    playerHtml += '<option value="' + m + '">' + m + '</option>';
  });
  
  // 得点の場合は「OG（オウンゴール）」を選択肢の末尾に追加する
  if (type === '得点') {
    playerHtml += '<option value="OG">OG (オウンゴール)</option>';
  }
  
  // すべてのアクションの末尾に「助っ人」を追加する
  playerHtml += '<option value="助っ人">助っ人</option>';
  
  playerSel.innerHTML = playerHtml;
  
  // 再描画前に選択されていた選手がいれば維持し、いなければ未選択にする
  if (currentPlayer && playerHtml.indexOf('"' + currentPlayer + '"') !== -1) {
    playerSel.value = currentPlayer;
  } else {
    playerSel.value = "";
  }
}

/**
 * アクション種別変更時に、関連する入力フィールドの表示/非表示を切り替える
 */
function togglePlayerSelect() {
  const type = document.getElementById('logType').value;
  const playerGroup = document.getElementById('playerGroup');
  const assistGroup = document.getElementById('assistGroup');
  if (!playerGroup || !assistGroup) return;
  
  // 相手得点の場合は選手・アシスト選択を隠す
  if (type === '相手得点') { 
    playerGroup.style.display = 'none'; 
    assistGroup.style.display = 'none'; 
  } 
  // カード記録の場合はアシスト選択を隠す
  else if (type === 'イエロー' || type === 'レッド') { 
    playerGroup.style.display = 'block'; 
    assistGroup.style.display = 'none'; 
  } 
  // 味方の得点の場合はすべて表示する
  else { 
    playerGroup.style.display = 'block'; 
    assistGroup.style.display = 'block'; 
  }
  
  buildPlayerDropdown();
}

/**
 * ログを追加し、タイムラインを描画する
 */
function addLog() {
  const type = document.getElementById('logType').value;
  const period = document.getElementById('logPeriod').value;
  const minInput = document.getElementById('logMin').value;
  const player = document.getElementById('logPlayer').value;
  const assist = document.getElementById('logAssist').value;
  
  // 相手得点以外で選手が選ばれていない場合はエラーを出す
  if (type !== '相手得点' && (player === "" || !player)) {
    setFieldError('logPlayer', '選手を選択してください');
    return;
  }
  clearFieldError('logPlayer');
  
  // 分が未入力の場合は0として扱う
  const min = (minInput !== '' && !isNaN(minInput)) ? parseInt(minInput, 10) : 0;
  
  // 配列にログを追加して再描画する
  matchLogs.push({ type, period, min, player, assist });
  renderLogs();
  
  // 連続で入力しやすいようにフォームをリセットする
  document.getElementById('logMin').value = '';
  document.getElementById('logPlayer').value = ''; 
  document.getElementById('logAssist').value = '-';
}

/**
 * ログデータを時系列にソートし、タイムライン形式で画面に描画する
 */
function renderLogs() {
  const container = document.getElementById('logList');
  const header = document.getElementById('inputLogHeader');
  const noLogs = document.getElementById('inputNoLogs');
  const oppNameEl = document.getElementById('inputLogOpponentName');
  
  if (!container) return;
  container.innerHTML = ''; // 一度中身をクリアする
  
  // ログが空の場合はメッセージを表示して終了
  if (matchLogs.length === 0) {
    if (header) header.style.display = 'none';
    if (noLogs) noLogs.style.display = 'block';
    return;
  }
  
  if (header) header.style.display = 'flex';
  if (noLogs) noLogs.style.display = 'none';
  if (oppNameEl) oppNameEl.textContent = document.getElementById('opponent').textContent || '相手チーム';
  
  // 前半・後半・延長の順番を定義し、ログを時系列（昇順）に並び替える
  const periodOrder = { '前半': 1, '後半': 2, '延長': 3 };
  matchLogs.sort((a, b) => {
    // ピリオド（前後半）が違う場合はピリオド順
    if (periodOrder[a.period] !== periodOrder[b.period]) {
      return periodOrder[a.period] - periodOrder[b.period];
    }
    // ピリオドが同じなら分の小さい順
    return a.min - b.min;
  });

  // HTMLの<template>タグから骨組みを取得する
  const tplRow = document.getElementById('tpl-input-row');
  const tplLeft = document.getElementById('tpl-input-action-left');
  const tplRight = document.getElementById('tpl-input-action-right');

  // ソート済みのログ配列をループし、画面に要素を追加していく
  matchLogs.forEach((l, idx) => {
    const rowClone = tplRow.content.cloneNode(true);
    
    rowClone.querySelector('.tl-time').textContent = l.period + ' ' + l.min + '分';
    
    // idx を使って削除ボタンに onclick 属性をセットする
    rowClone.querySelector('.btn-del').setAttribute('onclick', 'removeLog(' + idx + ')');
    
    const dot = rowClone.querySelector('.tl-dot');
    const leftContainer = rowClone.querySelector('.tl-left');
    const rightContainer = rowClone.querySelector('.tl-right');
    
    if (l.type === '相手得点') {
      dot.classList.add('dot-opp');
      const rightClone = tplRight.content.cloneNode(true);
      rightClone.querySelector('.tl-action-title').textContent = '相手得点';
      rightContainer.appendChild(rightClone); // 相手チーム側（右）に配置
    } else {
      const leftClone = tplLeft.content.cloneNode(true);
      const titleEl = leftClone.querySelector('.tl-action-title');
      const playerEl = leftClone.querySelector('.tl-player');
      const assistEl = leftClone.querySelector('.tl-assist');
      
      playerEl.textContent = l.player;
      if (l.assist && l.assist !== '-') {
        assistEl.textContent = '(A: ' + l.assist + ')';
      }
      
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
      }
      
      leftContainer.appendChild(leftClone); // 自チーム側（左）に配置
    }
    
    container.appendChild(rowClone);
  });
}

/**
 * 指定されたインデックスのログを削除し、再描画する
 * 
 * @param {number} idx - 削除対象の配列インデックス
 */
function removeLog(idx) { 
  matchLogs.splice(idx, 1); 
  renderLogs(); 
}

/**
 * 入力されたデータをサーバーに送信して保存する
 */
function submitData() {
  const date = document.getElementById('matchDate').textContent;
  if (!date) { 
    setFieldError('eventSelect', '試合を選択してください'); 
    return; 
  }
  clearFieldError('eventSelect');
  
  const categoryValue = document.getElementById('matchCategory').textContent || '未設定';
  
  // スコアと勝敗を自動集計
  let myScore = 0;
  let oppScore = 0;
  matchLogs.forEach(l => {
    if (l.type === '得点') {
      myScore++;
    } else if (l.type === '相手得点' || l.type === '失点') {
      oppScore++;
    }
  });

  let resultText = '引き分け';
  if (myScore > oppScore) resultText = '勝利';
  else if (myScore < oppScore) resultText = '敗北';

  // 送信用のデータオブジェクトを組み立てる
  const payload = {
    matchId: currentMatchId,
    date: date,
    category: categoryValue,
    opponent: document.getElementById('opponent').textContent,
    myScore: myScore,
    oppScore: oppScore,
    result: resultText,
    attended: document.getElementById('attended').textContent,
    location: document.getElementById('matchLocation') ? document.getElementById('matchLocation').value.trim() : '',
    mom: document.getElementById('momSelect') ? document.getElementById('momSelect').value : 'なし',
    logs: matchLogs
  };
  
  const btn = document.getElementById('submitBtn');
  if (btn) {
    btn.textContent = '保存中...'; 
    btn.disabled = true; // 2重送信防止
  }
  
  // サーバーサイド（GAS）の saveMatchData を呼び出す
  google.script.run
    .withSuccessHandler(res => {
      if (btn) {
        btn.textContent = currentMatchId ? '上書き保存' : '新規保存';
        btn.disabled = false;
      }
      
      if (typeof res === 'string' && res.includes('エラー')) {
        showAppAlert({ title: '保存エラー', message: res, isError: true });
      } else {
        
        // --- ローカルでの即時反映（ラグなし）処理 ---
        let myScore = 0;
        let oppScore = 0;
        let halfScores = { my1st: 0, opp1st: 0, my2nd: 0, opp2nd: 0, myExt: 0, oppExt: 0 };
        
        matchLogs.forEach(l => {
          if (l.type === '得点') {
            myScore++;
            if (l.period === '前半') halfScores.my1st++;
            else if (l.period === '後半') halfScores.my2nd++;
            else if (l.period === '延長') halfScores.myExt++;
          } else if (l.type === '相手得点' || l.type === '失点') {
            oppScore++;
            if (l.period === '前半') halfScores.opp1st++;
            else if (l.period === '後半') halfScores.opp2nd++;
            else if (l.period === '延長') halfScores.oppExt++;
          }
        });
        
        let resultText = '引分';
        if (myScore > oppScore) resultText = '勝利';
        else if (myScore < oppScore) resultText = '敗北';

        const updatedMatch = {
          matchId: currentMatchId || 'M_TEMP_' + new Date().getTime(),
          date: date,
          year: date.substring(0, 4),
          category: categoryValue,
          opponent: document.getElementById('opponent').textContent,
          myScore: myScore,
          oppScore: oppScore,
          result: resultText,
          attended: document.getElementById('attended').textContent,
          location: document.getElementById('matchLocation') ? document.getElementById('matchLocation').value.trim() : '',
          mom: document.getElementById('momSelect') ? document.getElementById('momSelect').value : 'なし',
          halfScores: halfScores,
          logs: matchLogs
        };

        if (currentMatchId) {
          const idx = window.allMatchResults.findIndex(m => m.matchId === currentMatchId);
          if (idx !== -1) window.allMatchResults[idx] = updatedMatch;
        } else {
          window.allMatchResults.unshift(updatedMatch);
        }
        
        // 画面を再描画
        if (typeof filterMatchResults === 'function') filterMatchResults();

        afterSaveSuccess(updatedMatch.matchId);
        
        // 裏で静かに最新データを取得して同期させておく
        google.script.run
          .withSuccessHandler(data => { if (typeof initMatchHistory === 'function') initMatchHistory(data); })
          .getMatchHistoryData();
      }
    })
    .withFailureHandler(err => {
      if (btn) {
        btn.textContent = currentMatchId ? '上書き保存' : '新規保存';
        btn.disabled = false;
      }
      showAppAlert({ title: '通信エラー', message: '通信エラーが発生しました: ' + (err.message || err), isError: true });
    })
    .saveMatchData(payload);
}

/**
 * 保存完了後のクリーンアップと画面遷移を行う
 * @param {string} savedMatchId 保存された試合のID
 */
function afterSaveSuccess(savedMatchId) {
  const select = document.getElementById('eventSelect');
  if (select) select.value = "";
  const container = document.getElementById('inputFormContainer');
  if (container) container.style.display = 'none';

  const eventSelectBox = document.getElementById('eventSelectBox');
  if (eventSelectBox) eventSelectBox.style.display = 'block';

  switchTab('results');

  // 即時反映されたデータを使ってすぐにモーダルを開く
  if (window.isEditingFromModal && window.currentViewingMatchId) {
    openMatchDetail(window.currentViewingMatchId);
  }
}

/**
 * 戻るボタンのハンドラー
 */
function handleInputBack() {
  switchTab('results');
  if (window.isEditingFromModal && window.currentViewingMatchId) {
    openMatchDetail(window.currentViewingMatchId);
  }
}
