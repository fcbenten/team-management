// =========================================
// 👑 ランキング機能 & 成績集計の共通ロジック
// =========================================

// ランキング各項目（得点、アシスト等）の「すべて表示 / 折りたたむ」の状態を管理
if (typeof window.rankExpanded === 'undefined') {
  window.rankExpanded = { goals: false, assists: false, mom: false, games: false };
}

/**
 * ランキング画面の初期化処理
 * サーバーから取得した個人成績データを初期設定し、画面を描画する
 *
 * @param {Array} data - サーバーから取得した個人成績データ配列
 */
function initStats(data) {
  if (!data || !Array.isArray(data)) {
    console.warn("成績データが不正です", data);
    return;
  }
  
  // 初期データから「OG」「助っ人」およびOB（退団者）を完全に除外してグローバル変数へ格納
  window.teamStatsData = data.filter(p => p.name !== 'OG' && p.name !== '助っ人' && (typeof isPastMember === 'function' ? !isPastMember(p.name) : true));
  
  // シーズン絞り込み用のプルダウンを生成
  populateRankingSeasonFilter();
  
  // フィルターを適用してランキングを描画
  filterAndRenderRankings();
}

/**
 * 全試合結果データからシーズン（年）を抽出し、ランキング画面のプルダウンにセットする
 */
function populateRankingSeasonFilter() {
  const seasonSelect = document.getElementById('rankingSeasonFilter');
  if (!seasonSelect) return;
  
  let seasons = [];
  if (window.allMatchResults && window.allMatchResults.length > 0) {
    seasons = [...new Set(window.allMatchResults.map(m => {
      return m.year || (m.date ? m.date.substring(0, 4) : null);
    }).filter(Boolean))].sort((a, b) => b - a);
  }
  
  if (seasons.length === 0) {
    const currentYear = new Date().getFullYear().toString();
    seasons = [currentYear];
  }
  
  // 既にオプションが正しくセットされているなら値だけ維持
  if (seasonSelect.options.length > 0 && seasonSelect.value) {
    return;
  }
  
  seasonSelect.innerHTML = '';
  seasons.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s + '年シーズン';
    seasonSelect.appendChild(opt);
  });
  
  if (seasons.length > 0) {
    seasonSelect.value = seasons[0];
  }
}

/**
 * 選択されたフィルター条件に合わせて成績を再集計し、画面に描画する
 */
function filterAndRenderRankings() {
  const seasonSelect = document.getElementById('rankingSeasonFilter');
  const categorySelect = document.getElementById('rankingCategoryFilter');
  
  if (seasonSelect && seasonSelect.options.length === 0) {
    populateRankingSeasonFilter();
  }
  
  let selectedSeason = seasonSelect ? seasonSelect.value : '';
  const selectedCategory = categorySelect ? categorySelect.value : 'all';
  
  if (!selectedSeason && seasonSelect && seasonSelect.options.length > 0) {
    selectedSeason = seasonSelect.options[0].value;
    seasonSelect.value = selectedSeason;
  }
  
  // 選択されたシーズンのカレンダー出欠データが未キャッシュなら非同期で先読み
  if (selectedSeason && (!window.calendarAttendanceCache || !window.calendarAttendanceCache[selectedSeason])) {
    window.calendarAttendanceCache = window.calendarAttendanceCache || {};
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(res => {
          if (res) {
            window.calendarAttendanceCache[selectedSeason] = res;
            filterAndRenderRankings();
          }
        })
        .apiGetCalendarAttendance(selectedSeason);
    }
  }
  
  let currentStats = [];
  if (window.allMatchResults && window.allMatchResults.length > 0) {
    // 試合結果からスタッツ（得点・アシスト・MVP）を集計
    currentStats = aggregateStatsFromMatches(selectedSeason, selectedCategory);
  } else {
    currentStats = window.teamStatsData || [];
  }
  
  // カレンダー出欠バッチから参加数を集計
  const attendanceStats = aggregateAttendanceFromBatch(selectedSeason, selectedCategory);
  renderRankingsWithData(currentStats, attendanceStats);
}

/**
 * カレンダー出欠バッチのデータから、指定された条件で全選手の参加数を抽出する
 *
 * @param {string} season - 対象年（例: "2026"）
 * @param {string} category - 対象カテゴリ ("all", "公式戦", "TRM")
 * @returns {Array} [{ name, attended }]
 */
function aggregateAttendanceFromBatch(season, category) {
  const attSource = (window.calendarAttendanceCache && season && window.calendarAttendanceCache[season]) 
    ? window.calendarAttendanceCache[season] 
    : window.calendarAttendanceData;
  const pMap = (attSource && attSource.players) ? attSource.players : {};

  // 対象選手一覧（名簿データ、チームスタッツ、カレンダー出欠データ）※OBは完全除外
  const playerNames = new Set();
  const checkAndAdd = (name) => {
    const trimmed = String(name || '').trim();
    if (trimmed && trimmed !== 'OG' && trimmed !== '助っ人' && trimmed !== '名前' && trimmed !== '氏名') {
      if (typeof isPastMember === 'function' ? !isPastMember(trimmed) : true) {
        playerNames.add(trimmed);
      }
    }
  };

  const rosterList = (window.scheduleRoster && window.scheduleRoster.length > 0)
    ? window.scheduleRoster
    : (window.adminMemberList || []);
  if (Array.isArray(rosterList)) {
    rosterList.forEach(m => { if (m && m.name) checkAndAdd(m.name); });
  }
  if (window.playerNumberMap) {
    Object.keys(window.playerNumberMap).forEach(checkAndAdd);
  }
  if (Array.isArray(window.teamStatsData)) {
    window.teamStatsData.forEach(p => checkAndAdd(p.name));
  }
  Object.keys(pMap).forEach(checkAndAdd);

  const resultList = [];
  playerNames.forEach(pName => {
    if (typeof isPastMember === 'function' && isPastMember(pName)) return;

    // カレンダー出欠データから選手データを探索（正規化対応）
    let calPlayerStats = null;
    if (pMap[pName]) {
      calPlayerStats = pMap[pName];
    } else {
      const cleanTarget = String(pName || '').replace(/[\s\u3000]+/g, '').toLowerCase();
      for (const k in pMap) {
        if (String(k).replace(/[\s\u3000]+/g, '').toLowerCase() === cleanTarget) {
          calPlayerStats = pMap[k];
          break;
        }
      }
    }

    let attendedCount = 0;
    if (calPlayerStats) {
      const catKey = (category && category !== 'all' && calPlayerStats[category]) ? category : 'all';
      const catStat = calPlayerStats[catKey];
      attendedCount = (catStat && catStat.attended) ? catStat.attended : 0;
    }

    resultList.push({
      name: pName,
      attended: attendedCount
    });
  });

  return resultList;
}

/**
 * 画面上の「試合結果データ」をもとに、指定された条件で成績を動的集計する
 * （※スタッツ画面からも呼び出される共通の集計エンジン）
 *
 * @param {string} season - 絞り込む年（例: "2026"）
 * @param {string} category - 絞り込むカテゴリ（例: "公式戦"、全件は "all"）
 * @returns {Array} 集計完了後の成績配列
 */
function aggregateStatsFromMatches(season, category) {
  const statsMap = {};
  
  // 1. チームデータ初期化（OG、助っ人、およびOBは枠を作らない）
  if (Array.isArray(window.teamStatsData)) {
    window.teamStatsData.forEach(p => {
      const isPast = typeof isPastMember === 'function' ? isPastMember(p.name) : false;
      if (p.name !== 'OG' && p.name !== '助っ人' && !isPast) { 
        statsMap[p.name] = { name: p.name, goals: 0, assists: 0, mom: 0, games: 0 };
      }
    });
  }
  
  // 2. 指定された条件（シーズン・カテゴリ）に合致する試合だけを抽出
  const filteredMatches = window.allMatchResults.filter(m => {
    const matchYear = m.year || (m.date ? m.date.substring(0, 4) : '');
    if (season && matchYear !== season) return false;
    if (category !== 'all' && m.category !== category) return false;
    return true;
  });
  
  // 3. 抽出した試合データを1件ずつループして、各選手の成績を加算していく
  filteredMatches.forEach(m => {
    
    // 【出場数のカウント】
    if (m.attended) {
      const attendees = m.attended.split(',').map(s => s.trim());
      attendees.forEach(name => {
        // OG、助っ人、OBは参加にカウントしない
        if (!name || name === 'OG' || name === '助っ人') return; 
        if (typeof isPastMember === 'function' && isPastMember(name)) return;
        
        // 名簿にない選手がいた場合は動的に枠を追加
        if (!statsMap[name]) statsMap[name] = { name: name, goals: 0, assists: 0, mom: 0, games: 0 };
        statsMap[name].games++;
      });
    }
    
    // 【MOMのカウント】
    if (m.mom && m.mom !== 'なし' && m.mom !== '-' && m.mom !== 'OG' && m.mom !== '助っ人' && m.mom !== '不明') { 
      const momName = m.mom.trim();
      if (typeof isPastMember !== 'function' || !isPastMember(momName)) {
        if (!statsMap[momName]) statsMap[momName] = { name: momName, goals: 0, assists: 0, mom: 0, games: 0 };
        statsMap[momName].mom++;
      }
    }
    
    // 【得点・アシストのカウント】
    if (m.logs && Array.isArray(m.logs)) {
      m.logs.forEach(l => {
        if (l.type === '得点') {
          // ゴール数を加算（OGや助っ人、OB、削除された不明選手はランキングに加算しない）
          if (l.player && l.player !== 'OG' && l.player !== '助っ人' && l.player !== '不明') {
            const pName = l.player.trim();
            if (typeof isPastMember !== 'function' || !isPastMember(pName)) {
              if (!statsMap[pName]) statsMap[pName] = { name: pName, goals: 0, assists: 0, mom: 0, games: 0 };
              statsMap[pName].goals++;
            }
          }
          // アシスト数を加算
          if (l.assist && l.assist !== '-' && l.assist !== 'なし' && l.assist !== 'OG' && l.assist !== '助っ人' && l.assist !== '不明') {
            const aName = l.assist.trim();
            if (typeof isPastMember !== 'function' || !isPastMember(aName)) {
              if (!statsMap[aName]) statsMap[aName] = { name: aName, goals: 0, assists: 0, mom: 0, games: 0 };
              statsMap[aName].assists++;
            }
          }
        }
      });
    }
  });
  
  // 辞書(Map)形式になっているデータを配列に変換し、OBを除外して返す
  return Object.values(statsMap).filter(p => typeof isPastMember === 'function' ? !isPastMember(p.name) : true);
}

/**
 * 外部からランキング再描画を呼び出すためのラッパー関数
 */
function renderRankings() {
  filterAndRenderRankings();
}

/**
 * ランキング用の空メッセージを表示するヘルパー（CSSクラス集約）
 */
function setRankEmptyMessage(el, text) {
  if (!el) return;
  el.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'rank-empty-msg';
  div.textContent = text;
  el.appendChild(div);
}

/**
 * 渡された集計データをもとに、4つのランキングを描画する
 *
 * @param {Array} matchStats - 試合集計の成績配列
 * @param {Array} attendanceStats - カレンダー出欠バッチ集計の参加数配列
 */
function renderRankingsWithData(matchStats, attendanceStats) {
  const safeMatches = Array.isArray(matchStats) ? matchStats : [];
  const safeAttendance = Array.isArray(attendanceStats) ? attendanceStats : [];
  const isPastCheck = (p) => typeof isPastMember === 'function' ? !isPastMember(p.name) : true;

  // 得点ランキング
  const topGoals = safeMatches.filter(p => p.goals > 0 && isPastCheck(p)).sort((a, b) => b.goals - a.goals);
  renderSingleRanking('goals', topGoals, 'goals', 'GOALS');
  
  // アシストランキング
  const topAssists = safeMatches.filter(p => p.assists > 0 && isPastCheck(p)).sort((a, b) => b.assists - a.assists);
  renderSingleRanking('assists', topAssists, 'assists', 'ASSISTS');
  
  // MVPランキング
  const topMom = safeMatches.filter(p => p.mom > 0 && isPastCheck(p)).sort((a, b) => b.mom - a.mom);
  renderSingleRanking('mom', topMom, 'mom', 'MVP');
  
  // 参加数ランキング（カレンダー出欠バッチの参加実績より描画）
  const topGames = safeAttendance.filter(p => (p.attended || 0) > 0 && isPastCheck(p)).sort((a, b) => b.attended - a.attended);
  renderSingleRanking('games', topGames, 'attended', 'ATTEND');
}

/**
 * 1つのカテゴリ（例：得点ランキング）のHTMLリストを生成し、画面にセットする
 *
 * @param {string} type - ランキングのID名（goals, assists等）
 * @param {Array} list - ソート済みの選手データ配列
 * @param {string} key - 抽出するプロパティ名
 * @param {string} label - 英語表示ラベル（GOALS, ASSISTS, MVP, GAMES）
 */
function renderSingleRanking(type, list, key, label) {
  const isExpanded = window.rankExpanded[type];
  const ul = document.getElementById('rank' + type.charAt(0).toUpperCase() + type.slice(1));
  const wrap = document.getElementById('toggleWrap-' + type);
  const btn = document.getElementById('btn-toggle-' + type);
  
  if (!ul) return;
  
  // 該当者が誰もいない場合
  if (list.length === 0) {
    setRankEmptyMessage(ul, '該当する記録がありません');
    if (wrap) wrap.style.display = 'none';
    return;
  }
  
  // 同率順位の計算（例: 1位が2人の場合は1位・1位・3位の順位付け）
  list.forEach((p, index) => {
    if (index === 0) {
      p._rank = 1;
    } else {
      const prev = list[index - 1];
      if (p[key] === prev[key]) {
        p._rank = prev._rank;
      } else {
        p._rank = index + 1;
      }
    }
  });

  const displayList = isExpanded ? list : list.slice(0, 5); // 折りたたみ時は上位5人のみ

  ul.innerHTML = '';
  const tplRank = document.getElementById('tpl-rank-item');
  displayList.forEach((p) => {
    const clone = tplRank.content.cloneNode(true);
    const card = clone.querySelector('.rank-card');
    const rankNum = p._rank;
    
    // 順位に応じたアクセントクラス付与
    if (rankNum === 1) {
      card.classList.add('rank-1');
    } else if (rankNum === 2) {
      card.classList.add('rank-2');
    } else if (rankNum === 3) {
      card.classList.add('rank-3');
    } else {
      card.classList.add('rank-other');
    }

    const rankNumEl = clone.querySelector('.rank-num');
    if (rankNum === 1 || rankNum === 2 || rankNum === 3) {
      rankNumEl.innerHTML = getRankBadgeSvg(rankNum);
    } else {
      rankNumEl.textContent = rankNum;
    }
    clone.querySelector('.rank-name').textContent = p.name;
    
    // プロフィール画像の表示
    const avatarEl = clone.querySelector('.rank-avatar');
    const avatarUrl = typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(p) : (window.playerAvatarMap ? window.playerAvatarMap[p.name] : null);
    if (avatarUrl && avatarEl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" class="rank-avatar-img" alt="${p.name}">`;
    }

    // 背番号の表示（ポジションは不要、背番号のみ表示）
    let numText = '';
    if (window.playerNumberMap && window.playerNumberMap[p.name] !== undefined && window.playerNumberMap[p.name] !== null && window.playerNumberMap[p.name] !== '' && window.playerNumberMap[p.name] !== 999) {
      numText = '#' + window.playerNumberMap[p.name];
    }
    const numEl = clone.querySelector('.rank-number');
    if (numEl) {
      numEl.textContent = numText;
      if (!numText) numEl.style.display = 'none';
    }

    clone.querySelector('.rank-score-val').textContent = p[key];
    clone.querySelector('.rank-score-label').textContent = label;
    ul.appendChild(clone);
  });
  
  // 6人以上いる場合は「全件を表示 / 折りたたむ」ボタンを出す（試合結果のさらに読み込むと同様の形式）
  if (wrap && btn) {
    if (list.length > 5) {
      wrap.style.display = 'block';
      const icon = btn.querySelector('.material-symbols-outlined');
      const text = btn.querySelector('.btn-toggle-text');
      if (isExpanded) {
        if (icon) icon.textContent = 'expand_less';
        if (text) text.textContent = '折りたたむ';
      } else {
        if (icon) icon.textContent = 'expand_more';
        if (text) text.textContent = '全件を表示';
      }
    } else {
      wrap.style.display = 'none';
    }
  }
}

/**
 * 1〜3位用のクラウン＆円形バッジSVGを生成する
 * 
 * @param {number} rank - 順位 (1, 2, 3)
 * @returns {string} SVG HTML文字列
 */
function getRankBadgeSvg(rank) {
  let color = '#f2b705'; // 1位: ゴールド
  if (rank === 2) color = '#8f98a3'; // 2位: シルバー
  if (rank === 3) color = '#c05621'; // 3位: ブロンズ

  return `<svg class="rank-badge-svg" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="4" r="1.4" fill="${color}"/>
    <circle cx="16" cy="2.2" r="1.5" fill="${color}"/>
    <circle cx="25" cy="4" r="1.4" fill="${color}"/>
    <path d="M6.8 6.5 L11.5 10.5 L16 4.8 L20.5 10.5 L25.2 6.5 C24.5 10 23 13 21 15 C19 16 13 16 11 15 C9 13 7.5 10 6.8 6.5 Z" fill="${color}"/>
    <circle cx="16" cy="23" r="13" fill="${color}"/>
    <circle cx="16" cy="23" r="10.8" stroke="#ffffff" stroke-width="1.3" stroke-dasharray="2.2 1.6" fill="none"/>
    <text x="16" y="23" dy=".35em" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="900" font-family="'Segoe UI', -apple-system, sans-serif">${rank}</text>
  </svg>`;
}

/**
 * 「全件を表示 / 折りたたむ」ボタンが押された際の切り替え処理
 *
 * @param {string} type - 切り替えるランキングの種類
 */
function toggleRankList(type) {
  window.rankExpanded[type] = !window.rankExpanded[type];
  filterAndRenderRankings();
}
