// =========================================
  // 👤 個人スタッツ機能
  // =========================================

  // テーブルの並び順（ソート）状態を管理する変数
  let currentPersonalStats = []; // 現在画面に表示しているスタッツ配列
  let personalSortCol = 'number'; // ソート中の列（初期は背番号）
  let personalSortAsc = true; // 昇順（小さい順）かどうかのフラグ

  /**
   * 個人スタッツ画面の初期化処理
   */
  function initPersonalView() {
    populatePersonalSeasonFilter();
    filterAndRenderPersonalStats();

    // モーダル表示時に背景がスクロールしてしまう問題（スマホ特有）を防ぐ処理
    const overlay = document.getElementById('playerModalOverlay');
    if (overlay && !overlay.dataset.touchFixed) {
      overlay.addEventListener('touchmove', function (e) {
        // ログ一覧エリア以外のスクロールを無効化する
        if (!e.target.closest('#pm-action-history')) {
          e.preventDefault();
        }
      }, { passive: false });
      overlay.dataset.touchFixed = "true";
    }
  }

  /**
   * 全試合結果データからシーズン（年）を抽出し、スタッツ画面のプルダウンにセットする
   */
  function populatePersonalSeasonFilter() {
    const seasonSelect = document.getElementById('personalSeasonFilter');
    if (!seasonSelect || !window.allMatchResults || window.allMatchResults.length === 0) return;

    const seasons = [...new Set(window.allMatchResults.map(m => m.year || (m.date ? m.date.substring(0, 4) : null)).filter(Boolean))].sort((a, b) => b - a);

    seasonSelect.innerHTML = '';
    seasons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s + '年シーズン';
      seasonSelect.appendChild(opt);
    });

    if (seasons.length > 0) seasonSelect.value = seasons[0];
  }

  /**
   * フィルター条件に従ってスタッツを集計し、テーブルを描画する
   */
  function filterAndRenderPersonalStats() {
    const season = document.getElementById('personalSeasonFilter').value;
    const category = document.getElementById('personalCategoryFilter').value;

    // 選択されたシーズンのカレンダー出欠データが未キャッシュなら非同期で先読み
    if (season && (!window.calendarAttendanceCache || !window.calendarAttendanceCache[season])) {
      window.calendarAttendanceCache = window.calendarAttendanceCache || {};
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(res => {
            if (res) {
              window.calendarAttendanceCache[season] = res;
            }
          })
          .apiGetCalendarAttendance(season);
      }
    }

    const statsMap = {};

    // 1. まず名簿データをもとに全選手の枠を用意する（OB・退団選手・特殊枠は除外）
    const rosterList = (window.scheduleRoster && window.scheduleRoster.length > 0)
      ? window.scheduleRoster
      : (window.adminMemberList || []);
    if (Array.isArray(rosterList)) {
      rosterList.forEach(m => {
        if (!m || !m.name) return;
        const trimmed = String(m.name).trim();
        if (trimmed && trimmed !== 'OG' && trimmed !== '助っ人' && trimmed !== '名前') {
          if (typeof isPastMember === 'function' ? !isPastMember(trimmed) : true) {
            statsMap[trimmed] = { name: trimmed, games: 0, goals: 0, assists: 0, mom: 0 };
          }
        }
      });
    }
    if (window.playerNumberMap) {
      Object.keys(window.playerNumberMap).forEach(name => {
        const trimmed = String(name || '').trim();
        // OG、助っ人、CSVのヘッダー行（"名前"等）、OBを除外
        if (trimmed && trimmed !== 'OG' && trimmed !== '助っ人' && trimmed !== '名前') {
          if (typeof isPastMember === 'function' ? !isPastMember(trimmed) : true) {
            if (!statsMap[trimmed]) {
              statsMap[trimmed] = { name: trimmed, games: 0, goals: 0, assists: 0, mom: 0 };
            }
          }
        }
      });
    }

    // 2. 全試合結果をループして、条件に合致する試合の成績を加算する
    if (window.allMatchResults) {
      window.allMatchResults.forEach(match => {
        const matchYear = match.year || (match.date ? match.date.substring(0, 4) : "");

        // 条件アンマッチの場合はスキップ
        if (season && season !== matchYear) return;
        if (category !== 'all' && match.category !== category) return;

        // 出席数の集計
        const attendedList = match.attended ? match.attended.split(',').map(s => s.trim()) : [];
        attendedList.forEach(name => {
          if (!name || name === '-' || name === 'なし' || name === 'OG' || name === '助っ人' || name === '名前' || name === '氏名') return;
          if (typeof isPastMember === 'function' && isPastMember(name)) return;

          if (!statsMap[name]) statsMap[name] = { name: name, games: 0, goals: 0, assists: 0, mom: 0 };
          statsMap[name].games++;
        });

        // MOMの集計
        const momName = String(match.mom || '').trim();
        if (momName && momName !== '-' && momName !== 'なし' && momName !== 'OG' && momName !== '助っ人' && momName !== '名前') {
          if (typeof isPastMember !== 'function' || !isPastMember(momName)) {
            if (!statsMap[momName]) statsMap[momName] = { name: momName, games: 0, goals: 0, assists: 0, mom: 0 };
            statsMap[momName].mom++;
          }
        }

        // 得点・アシストの集計
        if (match.logs && match.logs.length > 0) {
          match.logs.forEach(log => {
            if (log.type === '得点') {
              const p = String(log.player || '').trim();
              if (p && p !== '-' && p !== 'なし' && p !== 'OG' && p !== '助っ人' && p !== '名前') {
                if (typeof isPastMember !== 'function' || !isPastMember(p)) {
                  if (!statsMap[p]) statsMap[p] = { name: p, games: 0, goals: 0, assists: 0, mom: 0 };
                  statsMap[p].goals++;
                }
              }
              const a = String(log.assist || '').trim();
              if (a && a !== '-' && a !== 'なし' && a !== 'OG' && a !== '助っ人' && a !== '名前') {
                if (typeof isPastMember !== 'function' || !isPastMember(a)) {
                  if (!statsMap[a]) statsMap[a] = { name: a, games: 0, goals: 0, assists: 0, mom: 0 };
                  statsMap[a].assists++;
                }
              }
            }
          });
        }
      });
    }

    currentPersonalStats = Object.values(statsMap).filter(p => typeof isPastMember === 'function' ? !isPastMember(p.name) : true);

    // 選択されたシーズンのカレンダー出欠データソース
    const attSource = (window.calendarAttendanceCache && season && window.calendarAttendanceCache[season])
      ? window.calendarAttendanceCache[season]
      : window.calendarAttendanceData;
    const pMap = (attSource && attSource.players) ? attSource.players : {};

    // 3. 背番号・ポジション・参加率をセット
    currentPersonalStats.forEach(p => {
      let num = window.playerNumberMap ? window.playerNumberMap[p.name] : undefined;
      p.number = (num === null || num === "" || num === undefined || isNaN(Number(num))) ? 999 : Number(num);

      // ポジション（FP / GK）の取得
      if (typeof findMatchingPosition === 'function' && window.playerPositionsMap) {
        p.position = findMatchingPosition(p.name, window.playerPositionsMap);
      } else {
        p.position = '';
      }

      // カレンダー出欠実績の取得
      let calPlayerStats = null;
      if (pMap[p.name]) {
        calPlayerStats = pMap[p.name];
      } else {
        const cleanTarget = String(p.name || '').replace(/[\s\u3000]+/g, '').toLowerCase();
        for (const k in pMap) {
          if (String(k).replace(/[\s\u3000]+/g, '').toLowerCase() === cleanTarget) {
            calPlayerStats = pMap[k];
            break;
          }
        }
      }

      if (calPlayerStats) {
        const catKey = (category && category !== 'all' && calPlayerStats[category]) ? category : 'all';
        const catStat = calPlayerStats[catKey];
        if (catStat && catStat.invited > 0) {
          p.rate = catStat.rate;
          p.attended = catStat.attended;
          p.invited = catStat.invited;
          p.rateDetailText = `${catStat.attended}/${catStat.invited}回`;
        } else {
          p.rate = 0;
          p.attended = 0;
          p.invited = 0;
          p.rateDetailText = '0/0回';
        }
      } else {
        p.rate = 0;
        p.attended = 0;
        p.invited = 0;
        p.rateDetailText = '0/0回';
      }
    });

    renderPersonalTable();
  }

  /**
   * テーブルのヘッダーがクリックされた際のソート（並び替え）切り替え処理
   *
   * @param {string} col - ソート対象のカラム名
   */
  function sortPersonalStats(col) {
    if (personalSortCol === col) {
      // 同じカラムがクリックされた場合は昇順・降順を反転
      personalSortAsc = !personalSortAsc;
    } else {
      // 違うカラムの場合はそのカラムを優先し、名前/背番号なら昇順、成績なら降順をデフォルトにする
      personalSortCol = col;
      personalSortAsc = (col === 'number' || col === 'name') ? true : false;
    }
    renderPersonalTable();
  }

  /**
   * currentPersonalStats 配列をソート状態に合わせて並び替え、HTMLテーブルを構築する
   */
  function renderPersonalTable() {
    const tbody = document.getElementById('personalStatsBody');
    if (!tbody) return;

    // 指定されたカラムでソートを実行
    currentPersonalStats.sort((a, b) => {
      // 背番号（number）カラムのソート処理
      if (personalSortCol === 'number') {
        const isNoNumA = (a.number === null || a.number === undefined || a.number === '' || a.number === 999 || isNaN(Number(a.number)));
        const isNoNumB = (b.number === null || b.number === undefined || b.number === '' || b.number === 999 || isNaN(Number(b.number)));

        if (isNoNumA && isNoNumB) {
          // 両方背番号なしの場合は名前順で安定ソート
          return a.name.localeCompare(b.name, 'ja');
        }
        // 昇順時は背番号なしを一番上（先頭）に配置、降順時は末尾に配置
        if (isNoNumA) return personalSortAsc ? -1 : 1;
        if (isNoNumB) return personalSortAsc ? 1 : -1;

        const numA = Number(a.number);
        const numB = Number(b.number);
        if (numA === numB) {
          return a.name.localeCompare(b.name, 'ja');
        }
        return personalSortAsc ? (numA - numB) : (numB - numA);
      }

      let valA = a[personalSortCol];
      let valB = b[personalSortCol];

      if (valA === valB) {
        // 同値の場合は背番号順（背番号なし優先）でタイブレーク
        const isNoNumA = (a.number === null || a.number === undefined || a.number === '' || a.number === 999 || isNaN(Number(a.number)));
        const isNoNumB = (b.number === null || b.number === undefined || b.number === '' || b.number === 999 || isNaN(Number(b.number)));
        if (isNoNumA && isNoNumB) return a.name.localeCompare(b.name, 'ja');
        if (isNoNumA) return -1;
        if (isNoNumB) return 1;
        return Number(a.number) - Number(b.number);
      }

      // 文字列（名前など）の場合は文字コード順、数値の場合は大小で比較
      let result = typeof valA === 'string' ? valA.localeCompare(valB, 'ja') : (valA > valB ? 1 : -1);

      return personalSortAsc ? result : -result;
    });

    // 各項目のトップ（最多かつ1以上）の数値を算出
    let maxGames = 0;
    let maxGoals = 0;
    let maxAssists = 0;
    let maxMom = 0;
    currentPersonalStats.forEach(p => {
      if (p.games > maxGames) maxGames = p.games;
      if (p.goals > maxGoals) maxGoals = p.goals;
      if (p.assists > maxAssists) maxAssists = p.assists;
      if (p.mom > maxMom) maxMom = p.mom;
    });

    // テーブルヘッダーの矢印（▲/▼）アイコンを更新
    document.querySelectorAll('#personalStatsTable th').forEach(th => {
      const icon = th.querySelector('.sort-icon');
      if (icon) {
        const isCurrent = th.getAttribute('data-sort') === personalSortCol;
        th.classList.toggle('sort-active', isCurrent);
        if (isCurrent) {
          icon.textContent = personalSortAsc ? '▲' : '▼';
        } else {
          icon.textContent = '↕';
        }
      }
    });

    // テーブル行を生成
    tbody.innerHTML = '';
    if (currentPersonalStats.length === 0) {
      const emptyTpl = document.getElementById('tpl-personal-empty');
      if (emptyTpl) tbody.appendChild(emptyTpl.content.cloneNode(true));
      return;
    }

    const tpl = document.getElementById('tpl-personal-row');
    currentPersonalStats.forEach(p => {
      const clone = tpl.content.cloneNode(true);
      clone.querySelector('.col-number').textContent = p.number === 999 ? '-' : p.number;

      // 行全体のタップ・クリックで詳細モーダルを開く
      const tr = clone.querySelector('tr');
      if (tr) {
        tr.onclick = () => {
          openPlayerModal(p.name, p.number);
        };
      }

      // プロフィール画像表示
      const avatarIcon = clone.querySelector('.player-avatar-icon');
      const avatarUrl = typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(p) : (window.playerAvatarMap ? window.playerAvatarMap[p.name] : null);
      if (avatarUrl && avatarIcon) {
        avatarIcon.innerHTML = `<img src="${avatarUrl}" class="player-avatar-img" alt="${p.name}">`;
      }

      // 名前表示
      const nameEl = clone.querySelector('.player-name') || clone.querySelector('.player-link');
      if (nameEl) {
        nameEl.textContent = p.name;
      }

      const posBadge = clone.querySelector('.player-pos-badge');
      if (posBadge) {
        if (p.position === 'GK') {
          posBadge.textContent = 'GK';
          posBadge.className = 'player-pos-badge pos-badge-gk';
        } else if (p.position === 'FP') {
          posBadge.textContent = 'FP';
          posBadge.className = 'player-pos-badge pos-badge-fp';
        } else {
          posBadge.style.display = 'none';
        }
      }

      // 参加数（PC専用列）
      setStatCellValue(clone, '.col-games .stat-num-box', p.games, maxGames);

      // 参加率（プログレスバー ＋ ％ ＋ スマホ用サブテキスト）
      const rateBarFill = clone.querySelector('.rate-bar-fill');
      const rateText = clone.querySelector('.rate-text');
      const rateSubMobile = clone.querySelector('.rate-sub-mobile');
      const rateVal = Math.min(100, Math.max(0, p.rate || 0));

      if (rateBarFill) {
        rateBarFill.style.width = rateVal + '%';
        // バー色分け（ユーザー指定：30%以下は赤）
        if (rateVal <= 30) {
          rateBarFill.classList.add('rate-bar-red');
        } else if (rateVal < 70) {
          rateBarFill.classList.add('rate-bar-warn');
        } else {
          rateBarFill.classList.add('rate-bar-good');
        }
      }
      if (rateText) {
        rateText.textContent = rateVal + '%';
      }
      if (rateSubMobile) {
        rateSubMobile.textContent = p.rateDetailText || '';
      }

      // 得点・アシスト・MVP
      setStatCellValue(clone, '.col-goals .stat-num-box', p.goals, maxGoals);
      setStatCellValue(clone, '.col-assists .stat-num-box', p.assists, maxAssists);
      setStatCellValue(clone, '.col-mom .stat-num-box', p.mom, maxMom);

      tbody.appendChild(clone);
    });
  }

  /**
   * 成績セルに数値をセットし、チーム内1位（1以上）には王冠マークを付与する
   *
   * @param {DocumentFragment|Element} container - 対象の行フラグメント
   * @param {string} selector - 対象セルのセレクタ
   * @param {number} value - 選手の数値
   * @param {number} maxValue - チーム内の最大値
   */
  function setStatCellValue(container, selector, value, maxValue) {
    const box = container.querySelector(selector);
    if (!box) return;
    if (value > 0 && value === maxValue) {
      box.classList.add('stat-top-highlight');
      box.innerHTML =
        '<span class="stat-crown-badge" aria-label="1位">' +
          '<svg class="stat-crown-svg" viewBox="5 3 22 14" width="15" height="10" aria-hidden="true">' +
            '<path d="M6.8 6.5 L11.5 10.5 L16 4.8 L20.5 10.5 L25.2 6.5 C24.5 10 23 13 21 15 C19 16 13 16 11 15 C9 13 7.5 10 6.8 6.5 Z" fill="#f2b705" stroke="#d97706" stroke-width="1" stroke-linejoin="round"/>' +
          '</svg>' +
        '</span>' +
        '<span class="stat-top-value"></span>';
      const valSpan = box.querySelector('.stat-top-value');
      if (valSpan) valSpan.textContent = value;
    } else {
      box.textContent = value;
    }
  }

  /**
   * 選手名がクリックされた際に、その選手の詳細情報モーダルを開く
   *
   * @param {string} playerName - 選手名
   * @param {number} playerNumber - 背番号
   */
  function openPlayerModal(playerName, playerNumber) {
    const season = document.getElementById('personalSeasonFilter').value;
    const category = document.getElementById('personalCategoryFilter').value;

    const numPrefix = (playerNumber && playerNumber !== 999 && playerNumber !== '-') ? 'No.' + playerNumber + ' ' : '';
    document.getElementById('pm-header-title').textContent = numPrefix + playerName;

    // アバター表示
    const avatarUrl = typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(playerName) : (window.playerAvatarMap ? window.playerAvatarMap[playerName] : null);
    const avatarImg = document.getElementById('pmAvatarImg');
    const avatarPlaceholder = document.getElementById('pmAvatarPlaceholder');
    if (avatarImg && avatarPlaceholder) {
      if (avatarUrl) {
        avatarImg.src = avatarUrl;
        avatarImg.classList.remove('hidden');
        avatarPlaceholder.classList.add('hidden');
      } else {
        avatarImg.src = '';
        avatarImg.classList.add('hidden');
        avatarPlaceholder.classList.remove('hidden');
      }
    }

    // ヘッダーのバッジ（絞り込みカテゴリ）をセット（年度タグは不要のため非表示）
    const seasonBadge = document.getElementById('pm-badge-season');
    if (seasonBadge) seasonBadge.remove();
    const categoryBadge = document.getElementById('pm-badge-category');
    if (categoryBadge) {
      categoryBadge.textContent = category !== 'all' ? category : '';
      categoryBadge.className = 'category-badge ' + (category === '公式戦' ? 'badge-official' : category === 'TRM' ? 'badge-trm' : 'badge-other');
      categoryBadge.classList.toggle('hidden', category === 'all');
    }

    // モーダル用の集計変数を準備
    let games = 0, goals = 0, assists = 0, mom = 0;
    let wins = 0, draws = 0, losses = 0;
    let totalTeamGames = 0; // チームの総試合数（参加率の計算用）
    let playerMatches = [];

    // 全試合をループし、該当選手の活躍データを抽出する
    if (window.allMatchResults) {
      window.allMatchResults.forEach(match => {
        const matchYear = match.year || (match.date ? match.date.substring(0, 4) : "");
        if (season && season !== matchYear) return;
        if (category !== 'all' && match.category !== category) return;

        totalTeamGames++;

        const attendedList = match.attended ? match.attended.split(',').map(s => s.trim()) : [];
        if (!attendedList.includes(playerName)) return; // 参加していない試合は以降スキップ

        games++;
        if (match.result === '勝利') wins++;
        else if (match.result === '敗北') losses++;
        else draws++;

        // 勝敗集計
        let res = match.result;
        if (!res) {
          const mScore = Number(match.myScore || 0);
          const oScore = Number(match.oppScore || 0);
          if (mScore > oScore) res = '勝利';
          else if (mScore < oScore) res = '敗北';
          else res = '引き分け';
        }

        let personalLogs = [];
        let isMom = false;

        // MVPに選ばれた場合
        if (String(match.mom || '').trim() === playerName) {
          mom++;
          isMom = true;
        }

        // 得点やカードのログを抽出
        if (match.logs && match.logs.length > 0) {
          match.logs.forEach(log => {
            let periodText = log.period || '';
            let minText = (log.min !== undefined && log.min !== null && log.min !== '') ? log.min + '分' : '';
            let timeStr = (periodText + minText) || '-';

            if (log.type === '得点' && String(log.player || '').trim() === playerName) {
              goals++;
              let astText = log.assist && log.assist !== '-' ? '(A: ' + log.assist + ')' : '';
              personalLogs.push({ period: log.period, min: log.min, time: timeStr, action: 'ゴール', type: 'goal', detail: astText });
            }
            if (log.type === '得点' && String(log.assist || '').trim() === playerName) {
              assists++;
              personalLogs.push({ period: log.period, min: log.min, time: timeStr, action: 'アシスト', type: 'assist', detail: '(G: ' + log.player + ')' });
            }
            if (log.type === 'イエロー' && String(log.player || '').trim() === playerName) {
              personalLogs.push({ period: log.period, min: log.min, time: timeStr, action: 'イエロー', type: 'yellow', detail: '' });
            }
            if (log.type === 'レッド' && String(log.player || '').trim() === playerName) {
              personalLogs.push({ period: log.period, min: log.min, time: timeStr, action: 'レッド', type: 'red', detail: '' });
            }
          });
        }

        // ログを時系列（前半 -> 後半 -> 延長, 分昇順）でソート
        const periodWeight = { '前半': 1, '後半': 2, '延長': 3 };
        personalLogs.sort((a, b) => {
          const pA = periodWeight[a.period] || 99;
          const pB = periodWeight[b.period] || 99;
          if (pA !== pB) return pA - pB;
          return (Number(a.min) || 0) - (Number(b.min) || 0);
        });

        // 参加した試合の情報を履歴配列に追加
        playerMatches.push({
          date: match.date,
          category: match.category || 'TRM',
          opponent: match.opponent || '-',
          result: res,
          myScore: match.myScore !== undefined ? match.myScore : 0,
          oppScore: match.oppScore !== undefined ? match.oppScore : 0,
          isMom: isMom,
          logs: personalLogs
        });
      });
    }

    // 集計サマリー（得点など）を流し込む
    document.getElementById('pm-stat-mom').textContent = mom;
    document.getElementById('pm-stat-goals').textContent = goals;
    document.getElementById('pm-stat-assists').textContent = assists;

    // 📅 カレンダー出欠データの参照（当年または選択年の出欠集計）
    let attendanceRate = 0;
    let gamesCountVal = games;
    let calPlayerStats = null;
    let catStat = null;

    // 選択されたシーズンのカレンダー出欠データを検索
    const attSource = (window.calendarAttendanceCache && season && window.calendarAttendanceCache[season])
      ? window.calendarAttendanceCache[season]
      : window.calendarAttendanceData;

    if (attSource && attSource.players) {
      const pMap = attSource.players;
      if (pMap[playerName]) {
        calPlayerStats = pMap[playerName];
      } else {
        const cleanTarget = String(playerName || '').replace(/[\s\u3000]+/g, '').toLowerCase();
        for (const k in pMap) {
          if (String(k).replace(/[\s\u3000]+/g, '').toLowerCase() === cleanTarget) {
            calPlayerStats = pMap[k];
            break;
          }
        }
      }
    }

    if (calPlayerStats) {
      // 選択中のカテゴリ（公式戦 / TRM / all）に対応する集計データを取得
      const catKey = (category && category !== 'all' && calPlayerStats[category]) ? category : 'all';
      catStat = calPlayerStats[catKey];
      if (catStat && catStat.invited > 0) {
        attendanceRate = catStat.rate;
      }
    }

    // 現在のスタッツテーブル上の集計値があれば優先反映して整合性を保つ
    const pData = (currentPersonalStats && currentPersonalStats.length > 0) ? currentPersonalStats.find(p => p.name === playerName) : null;
    if (pData) {
      if (pData.rate !== undefined) attendanceRate = pData.rate;
    }

    document.getElementById('pm-stat-games').textContent = games;
    document.getElementById('pm-stat-rate').textContent = attendanceRate;

    // 勝敗ブロックを流し込む（勝・敗・分）
    document.getElementById('pm-res-wins').textContent = wins;
    document.getElementById('pm-res-losses').textContent = losses;
    document.getElementById('pm-res-draws').textContent = draws;

    // 参加履歴のカードリストを生成する
    const historyContainer = document.getElementById('pm-action-history');
    historyContainer.innerHTML = '';

    if (playerMatches.length === 0) {
      const emptyTpl = document.getElementById('tpl-pm-empty-history');
      if (emptyTpl) historyContainer.appendChild(emptyTpl.content.cloneNode(true));
    } else {
      // 新しい試合が上に来るように降順ソート
      playerMatches.sort((a, b) => new Date(String(b.date).replace(/\//g, '-')) - new Date(String(a.date).replace(/\//g, '-')));

      const tplCard = document.getElementById('tpl-pm-match-card');
      const tplEvent = document.getElementById('tpl-pm-event-row');

      playerMatches.forEach(match => {
        const cardNode = tplCard.content.cloneNode(true);

        // カテゴリバッジ（試合結果画面と全く同じcategory-badgeタグを使用）
        const catBadge = cardNode.querySelector('.category-badge') || cardNode.querySelector('.pm-cat-badge');
        if (catBadge) {
          catBadge.textContent = match.category;
          catBadge.className = 'category-badge card-category ' + (match.category === '公式戦' ? 'badge-official' : 'badge-trm');
        }

        // 日付 (YYYY/MM/DD)
        const dateStr = String(match.date || '').replace(/-/g, '/');
        cardNode.querySelector('.pm-match-date').textContent = dateStr;

        // 対戦相手
        cardNode.querySelector('.pm-match-opp').textContent = match.opponent;

        // スコアピル
        const scorePill = cardNode.querySelector('.pm-score-pill');
        scorePill.textContent = `${match.myScore} - ${match.oppScore}`;
        if (match.result === '勝利') {
          scorePill.classList.add('pm-score-win');
        } else if (match.result === '敗北') {
          scorePill.classList.add('pm-score-lose');
        } else {
          scorePill.classList.add('pm-score-draw');
        }

        // MVPバッジ
        if (match.isMom) {
          const mvpContainer = cardNode.querySelector('.pm-mvp-container');
          if (mvpContainer) mvpContainer.classList.remove('hidden');
        }

        // イベント描画
        const eventsContainer = cardNode.querySelector('.pm-events-container');
        if (match.logs.length === 0) {
          // ゴール・アシスト等の記録がない参加試合
          const eventRow = tplEvent.content.cloneNode(true);
          eventRow.querySelector('.pm-event-time').textContent = '-';
          const pill = eventRow.querySelector('.pm-action-pill');
          pill.textContent = 'ゴール・アシストなし';
          pill.className = 'pm-action-none';
          eventsContainer.appendChild(eventRow);
        } else {
          match.logs.forEach(log => {
            const eventRow = tplEvent.content.cloneNode(true);
            eventRow.querySelector('.pm-event-time').textContent = log.time;
            const pill = eventRow.querySelector('.pm-action-pill');
            pill.textContent = log.action;
            pill.classList.add('pm-action-' + log.type);
            eventRow.querySelector('.pm-event-detail').textContent = log.detail;
            eventsContainer.appendChild(eventRow);
          });
        }

        historyContainer.appendChild(cardNode);
      });
    }

    // モーダルを表示
    document.getElementById('playerModalOverlay').classList.add('active');
    if (typeof lockBodyScroll === 'function') {
      lockBodyScroll();
    } else {
      document.body.classList.add('no-scroll');
    }
    // スクロール位置を一番上に戻す
    setTimeout(() => { historyContainer.scrollTop = 0; }, 10);
  }

  /**
   * 選手詳細モーダルを閉じる
   *
   * @param {Event} [e] - クリックイベント
   */
  function closePlayerModal(e) {
    // モーダルコンテンツ内部をクリックした場合は閉じない（ただし×ボタンは除く）
    if (e && e.target && e.target.closest('.modal-content') && !e.target.closest('.modal-close')) {
      return;
    }
    document.getElementById('playerModalOverlay').classList.remove('active');
    if (typeof unlockBodyScroll === 'function') {
      unlockBodyScroll();
    } else {
      document.body.classList.remove('no-scroll');
    }
  }
