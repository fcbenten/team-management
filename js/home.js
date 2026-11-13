// =========================================
// ホーム画面（ダッシュボード）制御ロジック
// =========================================

window.homeNextEvent = null;
window.homeInitialData = null;

/**
 * ホーム画面の全要素を初期化・描画
 * @param {Object} [data] - getInitialData から渡されたデータオブジェクト
 */
function initHomeView(data) {
  if (data) {
    window.homeInitialData = data;
  } else {
    data = window.homeInitialData || {};
  }

  renderHomeNoticeArea(data);
  renderHomeEquipmentNotice(data);
  if (typeof renderHomePinnedAnnouncements === 'function') {
    renderHomePinnedAnnouncements();
  }
  if (typeof renderHomeRecentBulletins === 'function') {
    renderHomeRecentBulletins();
  }
  renderHomeSeasonStats(data);
  renderHomeNextEvent(data);
  renderHomeRecentMatch(data);
  refreshHomePushMockState();
}

/**
 * 1. 重要なお知らせエリアを描画
 * - 開催まで1週間以内の未入力予定がある場合は赤色アラートで緊急通知し、即座に出欠登録へ誘導
 * - 1週間より先の未入力予定のみの場合は通常通知
 * - 未入力がない場合は非表示
 * @param {Object} [data]
 */
function renderHomeNoticeArea(data) {
  const events = (data && data.events) || window.eventsData || [];
  const now = new Date();
  const todayStr = (typeof normalizeDateStr === 'function')
    ? normalizeDateStr(now)
    : `${now.getFullYear()}/${('0' + (now.getMonth() + 1)).slice(-2)}/${('0' + now.getDate()).slice(-2)}`;

  const oneWeekLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const oneWeekLaterStr = (typeof normalizeDateStr === 'function')
    ? normalizeDateStr(oneWeekLater)
    : `${oneWeekLater.getFullYear()}/${('0' + (oneWeekLater.getMonth() + 1)).slice(-2)}/${('0' + oneWeekLater.getDate()).slice(-2)}`;

  const urgentUnansweredEvents = [];
  const normalUnansweredEvents = [];

  events.forEach(ev => {
    if (!ev || !ev.date) return;
    const evDateStr = (typeof normalizeDateStr === 'function') ? normalizeDateStr(ev.date) : ev.date;
    if (evDateStr >= todayStr) {
      if (typeof getMyEventStatus === 'function' && getMyEventStatus(ev) === 'unanswered') {
        if (evDateStr <= oneWeekLaterStr) {
          urgentUnansweredEvents.push(ev);
        } else {
          normalUnansweredEvents.push(ev);
        }
      }
    }
  });

  // 直近開催日順（昇順）にソート
  urgentUnansweredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  normalUnansweredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  window.homeUrgentUnansweredEvents = urgentUnansweredEvents;
  window.homeNormalUnansweredEvents = normalUnansweredEvents;

  const noticeEl = document.getElementById('homeNoticeArea');
  const textEl = document.getElementById('homeNoticeText');
  const subtextEl = document.getElementById('homeNoticeSubtext');
  const iconEl = document.getElementById('homeNoticeIcon');
  const actionLink = document.getElementById('homeNoticeAction');

  if (!noticeEl || !textEl) return;

  const totalUnanswered = urgentUnansweredEvents.length + normalUnansweredEvents.length;

  if (urgentUnansweredEvents.length > 0) {
    // 1週間以内の未入力予定がある場合: 赤色アラート表示
    noticeEl.classList.remove('hidden', 'notice-info');
    noticeEl.classList.add('notice-urgent');

    if (iconEl) {
      iconEl.textContent = 'priority_high';
      iconEl.classList.remove('text-muted');
    }

    const nearestEv = urgentUnansweredEvents[0];
    const dateFormatted = (typeof formatDisplayDateWithDay === 'function')
      ? formatDisplayDateWithDay(nearestEv.date)
      : nearestEv.date;
    const cat = (typeof resolveEventCategory === 'function')
      ? resolveEventCategory(nearestEv).category
      : (nearestEv.title || '活動');

    if (urgentUnansweredEvents.length === 1) {
      textEl.textContent = `【至急回答】1週間以内の予定（${dateFormatted} ${cat}）の出欠が未入力です！`;
      if (subtextEl) {
        subtextEl.textContent = (normalUnansweredEvents.length > 0)
          ? `※その他に未回答の予定が ${normalUnansweredEvents.length}件 あります。`
          : '開催直前です。直ちに出欠の登録をお願いします。';
        subtextEl.classList.remove('hidden');
      }
    } else {
      textEl.textContent = `【至急回答】1週間以内の予定で未入力が ${urgentUnansweredEvents.length}件 あります！`;
      if (subtextEl) {
        subtextEl.textContent = `直近: ${dateFormatted}（全未回答: ${totalUnanswered}件）直ちに出欠の登録をお願いします。`;
        subtextEl.classList.remove('hidden');
      }
    }

    if (actionLink) {
      actionLink.textContent = 'スケジュール →';
      actionLink.classList.remove('hidden');
    }

  } else if (normalUnansweredEvents.length > 0) {
    // 1週間以降の未入力のみ存在する場合: 通常の注意喚起（黄色）
    noticeEl.classList.remove('hidden', 'notice-urgent', 'notice-info');

    if (iconEl) {
      iconEl.textContent = 'notifications';
      iconEl.classList.add('text-muted');
    }

    textEl.textContent = `未入力の出欠予定が ${normalUnansweredEvents.length}件 あります。`;
    if (subtextEl) {
      subtextEl.textContent = '';
      subtextEl.classList.add('hidden');
    }

    if (actionLink) {
      actionLink.textContent = 'スケジュール →';
      actionLink.classList.remove('hidden');
    }

  } else {
    // 未入力なし
    noticeEl.classList.add('hidden');
    noticeEl.classList.remove('notice-urgent', 'notice-info');
    textEl.textContent = '';
    if (subtextEl) subtextEl.classList.add('hidden');
  }
}

/**
 * 備品不在・持参警告バナーエリアを描画（出欠アラートと同等のカードデザイン）
/**
 * 備品不在・持参警告バナーエリアを描画（1イベントにつき1件のアラートカードを表示）
 * @param {Object} [data]
 */
function renderHomeEquipmentNotice(data) {
  const container = document.getElementById('homeEquipmentNoticeArea');
  if (!container) return;

  const eqUpcoming = (window.equipmentState && window.equipmentState.upcomingEquipment && window.equipmentState.upcomingEquipment.length > 0)
    ? window.equipmentState.upcomingEquipment
    : (data && data.equipmentData && data.equipmentData.upcomingEquipment ? data.equipmentData.upcomingEquipment : []);

  container.replaceChildren();

  if (!eqUpcoming || eqUpcoming.length === 0) {
    return;
  }

  // 1週間以内の活動でアラートがあるイベントを抽出
  const alertEvents = eqUpcoming.filter(ev => {
    if (ev.isWithinOneWeek === false) return false;
    return (ev.equipmentStatus || []).some(st => st.isAlert);
  });

  if (alertEvents.length === 0) {
    return;
  }

  // 直近開催日順（昇順）にソート
  alertEvents.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  alertEvents.forEach(ev => {
    const alertItems = (ev.equipmentStatus || []).filter(st => st.isAlert);
    if (alertItems.length === 0) return;

    const hasRed = alertItems.some(st => st.alertLevel === 'RED');

    const banner = document.createElement('div');
    banner.className = 'app-notice-banner equipment-notice-banner ' + (hasRed ? 'notice-urgent' : '');
    banner.setAttribute('role', 'alert');

    // 左側コンテナ
    const leftWrap = document.createElement('div');
    leftWrap.className = 'notice-banner-left';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined notice-banner-icon' + (hasRed ? '' : ' text-muted');
    iconSpan.textContent = hasRed ? 'priority_high' : 'notifications';
    leftWrap.appendChild(iconSpan);

    const textWrap = document.createElement('div');
    textWrap.className = 'notice-banner-text-wrap';

    const titleEl = document.createElement('div');
    titleEl.className = 'notice-banner-text';

    const formattedDate = (typeof formatDisplayDateWithDay === 'function')
      ? formatDisplayDateWithDay(ev.eventDate)
      : ev.eventDate;
    const catText = ev.eventCategory || '';
    const evTitle = ev.eventTitle ? `（${ev.eventTitle}）` : '';

    titleEl.textContent = `${hasRed ? '【要対応】' : '【確認】'}${formattedDate} ${catText}${evTitle} 備品の担当者不在`;
    textWrap.appendChild(titleEl);

    // 備品項目と解決ボタンの行
    const badgesWrap = document.createElement('div');
    badgesWrap.className = 'notice-gear-badges-wrap';

    alertItems.forEach(st => {
      const pill = document.createElement('div');
      pill.className = 'notice-gear-item-pill';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'notice-gear-item-name';
      if (st.ruleType === 'COUNT') {
        const dName = String(st.name || '').includes('ボール') ? 'ボール' : st.name;
        nameSpan.textContent = `${dName}: ${st.count}球 (要持参)`;
      } else {
        nameSpan.textContent = `${st.name}: 不在`;
      }
      pill.appendChild(nameSpan);

      const resolveBtn = document.createElement('button');
      resolveBtn.type = 'button';
      resolveBtn.className = 'btn-banner-resolve';
      resolveBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 13px; line-height: 1;">task_alt</span><span>解決</span>';
      resolveBtn.title = `${st.name}の持参を「代理」として解決`;
      resolveBtn.onclick = function(e) {
        e.stopPropagation();
        if (typeof openEquipmentResolveModal === 'function') {
          openEquipmentResolveModal(ev.eventId, ev.eventDate, st.code, st.name, ev.eventTitle || (ev.eventDate + ' ' + ev.eventCategory), resolveBtn);
        }
      };
      pill.appendChild(resolveBtn);

      badgesWrap.appendChild(pill);
    });

    textWrap.appendChild(badgesWrap);
    leftWrap.appendChild(textWrap);
    banner.appendChild(leftWrap);

    container.appendChild(banner);
  });
}

window.updateHomeEquipmentNotice = function() {
  renderHomeEquipmentNotice(window.homeInitialData);
};

/**
 * 2. チーム現在年度の成績（KPIダッシュボード）を描画
 * @param {Object} data
 */
function renderHomeSeasonStats(data) {
  const matches = (data && data.history && data.history.matches) || window.allMatchResults || [];
  const currentYear = new Date().getFullYear().toString();

  // シーズンタイトルの設定
  const titleEl = document.getElementById('homeSeasonTitle');
  if (titleEl) {
    titleEl.textContent = `${currentYear}年度 チーム戦績`;
  }

  // 今シーズンの試合を対象
  const seasonMatches = matches.filter(m => m.year === currentYear || (m.date && m.date.startsWith(currentYear)));
  const targetMatches = seasonMatches.length > 0 ? seasonMatches : matches;

  let wins = 0, draws = 0, losses = 0, totalGoals = 0, totalConceded = 0;
  targetMatches.forEach(m => {
    if (m.result === '勝利') wins++;
    else if (m.result === '敗北') losses++;
    else draws++;
    totalGoals += Number(m.myScore || 0);
    totalConceded += Number(m.oppScore || 0);
  });

  const totalMatches = wins + draws + losses;
  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0';
  const goalDiff = totalGoals - totalConceded;
  const goalDiffStr = (goalDiff > 0) ? `+${goalDiff}` : (goalDiff === 0 ? '±0' : `${goalDiff}`);

  // 1. チーム通算勝率カード
  const winRateEl = document.getElementById('homeSeasonWinRate');
  const recordTextEl = document.getElementById('homeSeasonRecordText');
  if (winRateEl) winRateEl.textContent = `${winRate}%`;
  if (recordTextEl) recordTextEl.textContent = `${totalMatches}戦 ${wins}勝 ${draws}分 ${losses}敗`;

  // 直近5戦フォームの描画（時系列の古い順に並べ、一番右が最新試合）
  const dotsEl = document.getElementById('homeRecentFormDots');
  if (dotsEl) {
    dotsEl.replaceChildren();
    const recent5 = targetMatches.slice(0, 5).reverse();
    recent5.forEach(m => {
      const dot = document.createElement('span');
      dot.className = 'kpi-form-dot';
      if (m.result === '勝利') {
        dot.classList.add('dot-win');
        dot.title = `${m.date} 勝利 (${m.myScore}-${m.oppScore})`;
      } else if (m.result === '敗北') {
        dot.classList.add('dot-loss');
        dot.title = `${m.date} 敗北 (${m.myScore}-${m.oppScore})`;
      } else {
        dot.classList.add('dot-draw');
        dot.title = `${m.date} 引分 (${m.myScore}-${m.oppScore})`;
      }
      dotsEl.appendChild(dot);
    });
  }

  // 2. 得失点差 / 総得点カード
  const goalDiffEl = document.getElementById('homeGoalDiff');
  const avgGoalsEl = document.getElementById('homeAvgGoals');
  const totalGoalsEl = document.getElementById('homeTotalGoals');
  const totalConcededEl = document.getElementById('homeTotalConceded');
  const avgConcededEl = document.getElementById('homeAvgConceded');

  const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0.0';
  const avgConceded = totalMatches > 0 ? (totalConceded / totalMatches).toFixed(1) : '0.0';

  if (goalDiffEl) {
    goalDiffEl.textContent = goalDiffStr;
    goalDiffEl.classList.remove('kpi-diff-positive', 'kpi-diff-negative');
    if (goalDiff > 0) goalDiffEl.classList.add('kpi-diff-positive');
    else if (goalDiff < 0) goalDiffEl.classList.add('kpi-diff-negative');
  }
  if (avgGoalsEl) avgGoalsEl.textContent = `${avgGoals}点`;
  if (totalGoalsEl) totalGoalsEl.textContent = `${totalGoals}得点`;
  if (totalConcededEl) totalConcededEl.textContent = `${totalConceded}失点`;
  if (avgConcededEl) avgConcededEl.textContent = `${avgConceded}点`;

  // 3. チーム出席率（年間・月間・先月分を表示、皆勤選手は不要）
  const attData = (data && data.calendarAttendance) || window.calendarAttendanceData;
  const events = (data && data.events) || window.eventsData || [];
  const now = new Date();
  const curYearNum = now.getFullYear();
  const curMonthNum = now.getMonth() + 1;
  const curMonthPrefix = `${curYearNum}/${('0' + curMonthNum).slice(-2)}`;

  const prevDate = new Date(curYearNum, now.getMonth() - 1, 1);
  const prevYearNum = prevDate.getFullYear();
  const prevMonthNum = prevDate.getMonth() + 1;
  const prevMonthPrefix = `${prevYearNum}/${('0' + prevMonthNum).slice(-2)}`;

  const todayStr = `${curYearNum}/${('0' + curMonthNum).slice(-2)}/${('0' + now.getDate()).slice(-2)}`;

  let annualRate = null;
  let curMonthRate = null;
  let prevMonthRate = null;

  // 日次バッチ集計データ（teamSummary）が存在する場合は最優先で直接使用
  if (attData && attData.teamSummary) {
    const ts = attData.teamSummary;
    if (ts.annual && typeof ts.annual.rate === 'number') {
      annualRate = ts.annual.rate;
    }
    if (ts.currentMonth && typeof ts.currentMonth.rate === 'number') {
      curMonthRate = ts.currentMonth.rate;
    }
    if (ts.prevMonth && typeof ts.prevMonth.rate === 'number') {
      prevMonthRate = ts.prevMonth.rate;
    }
  } else {
    // フォールバック: バッチ未集計時の動的算出
    let annualInvited = 0, annualAttended = 0;
    if (attData && attData.players) {
      Object.values(attData.players).forEach(p => {
        if (p && p.all) {
          annualInvited += Number(p.all.invited || 0);
          annualAttended += Number(p.all.attended || 0);
        }
      });
    }
    annualRate = annualInvited > 0 ? Math.round((annualAttended / annualInvited) * 100) : null;

    // 当月出席率（本日以前のイベント）
    let curInvited = 0, curAttended = 0;
    events.forEach(e => {
      if (!e || !e.date) return;
      const dStr = (typeof normalizeDateStr === 'function') ? normalizeDateStr(e.date) : e.date;
      if (dStr.startsWith(curMonthPrefix) && dStr <= todayStr) {
        const yes = Array.isArray(e.yesList) ? e.yesList.length : 0;
        const no = Array.isArray(e.noList) ? e.noList.length : 0;
        const maybe = Array.isArray(e.maybeList) ? e.maybeList.length : 0;
        const unans = Array.isArray(e.unansweredList) ? e.unansweredList.length : 0;
        curInvited += (yes + no + maybe + unans);
        curAttended += yes;
      }
    });
    curMonthRate = curInvited > 0 ? Math.round((curAttended / curInvited) * 100) : null;

    // 先月出席率
    let prevInvited = 0, prevAttended = 0;
    events.forEach(e => {
      if (!e || !e.date) return;
      const dStr = (typeof normalizeDateStr === 'function') ? normalizeDateStr(e.date) : e.date;
      if (dStr.startsWith(prevMonthPrefix)) {
        const yes = Array.isArray(e.yesList) ? e.yesList.length : 0;
        const no = Array.isArray(e.noList) ? e.noList.length : 0;
        const maybe = Array.isArray(e.maybeList) ? e.maybeList.length : 0;
        const unans = Array.isArray(e.unansweredList) ? e.unansweredList.length : 0;
        prevInvited += (yes + no + maybe + unans);
        prevAttended += yes;
      }
    });
    prevMonthRate = prevInvited > 0 ? Math.round((prevAttended / prevInvited) * 100) : null;
  }

  // 出席率要素の描画
  const monthAttRateEl = document.getElementById('homeMonthAttRate');
  const prevMonthAttTextEl = document.getElementById('homePrevMonthAttText');
  const yearAttRateEl = document.getElementById('homeYearAttRate');
  const attDiffBadgeEl = document.getElementById('homeAttDiffBadge');

  if (monthAttRateEl) {
    monthAttRateEl.textContent = (curMonthRate != null) ? `${curMonthRate}%` : ((annualRate != null) ? `${annualRate}%` : '--%');
  }
  if (prevMonthAttTextEl) {
    prevMonthAttTextEl.textContent = (prevMonthRate != null) ? `前月 ${prevMonthRate}%` : '前月 --%';
  }
  if (yearAttRateEl) {
    yearAttRateEl.textContent = (annualRate != null) ? `${annualRate}%` : '--%';
  }
  if (attDiffBadgeEl) {
    if (curMonthRate != null && prevMonthRate != null) {
      const diff = curMonthRate - prevMonthRate;
      if (diff > 0) {
        attDiffBadgeEl.textContent = `↑ +${diff}%`;
        attDiffBadgeEl.className = 'kpi-card-badge badge-green';
      } else if (diff < 0) {
        attDiffBadgeEl.textContent = `↓ ${diff}%`;
        attDiffBadgeEl.className = 'kpi-card-badge badge-gray';
      } else {
        attDiffBadgeEl.textContent = `±0%`;
        attDiffBadgeEl.className = 'kpi-card-badge badge-gray';
      }
    } else if (annualRate != null) {
      attDiffBadgeEl.textContent = `年間 ${annualRate}%`;
      attDiffBadgeEl.className = 'kpi-card-badge badge-gray';
    } else {
      attDiffBadgeEl.textContent = '--';
      attDiffBadgeEl.className = 'kpi-card-badge badge-gray';
    }
  }

  // 4. 個人タイトル争い（得点王・アシスト王）※OBは集計対象外
  const playerGoalMap = {};
  const playerAssistMap = {};

  targetMatches.forEach(m => {
    if (m.logs && Array.isArray(m.logs)) {
      m.logs.forEach(l => {
        if (l.type === '得点') {
          if (l.player && l.player !== 'OG' && l.player !== '助っ人' && l.player !== '-' && l.player !== '不明') {
            const p = l.player.trim();
            if (typeof isPastMember !== 'function' || !isPastMember(p)) {
              playerGoalMap[p] = (playerGoalMap[p] || 0) + 1;
            }
          }
          if (l.assist && l.assist !== 'OG' && l.assist !== '助っ人' && l.assist !== '-' && l.assist !== 'なし' && l.assist !== '不明') {
            const a = l.assist.trim();
            if (typeof isPastMember !== 'function' || !isPastMember(a)) {
              playerAssistMap[a] = (playerAssistMap[a] || 0) + 1;
            }
          }
        }
      });
    }
  });

  // ログが空の場合のフォールバック: data.stats
  if (Object.keys(playerGoalMap).length === 0 && data && data.stats && Array.isArray(data.stats)) {
    data.stats.forEach(p => {
      if (p.name && p.name !== 'OG' && p.name !== '助っ人' && (typeof isPastMember !== 'function' || !isPastMember(p.name))) {
        if (p.goals > 0) playerGoalMap[p.name] = p.goals;
        if (p.assists > 0) playerAssistMap[p.name] = p.assists;
      }
    });
  }

  let topScorer = { name: '-', goals: 0 };
  const sortedGoals = Object.entries(playerGoalMap).sort((a, b) => b[1] - a[1]);
  if (sortedGoals.length > 0 && sortedGoals[0][1] > 0) {
    topScorer = { name: sortedGoals[0][0], goals: sortedGoals[0][1] };
  }

  let topAssister = { name: '-', assists: 0 };
  const sortedAssists = Object.entries(playerAssistMap).sort((a, b) => b[1] - a[1]);
  if (sortedAssists.length > 0 && sortedAssists[0][1] > 0) {
    topAssister = { name: sortedAssists[0][0], assists: sortedAssists[0][1] };
  }

  const topScorerNameEl = document.getElementById('homeTopScorerName');
  const topScorerValEl = document.getElementById('homeTopScorerVal');
  const topAssisterNameEl = document.getElementById('homeTopAssisterName');
  const topAssisterValEl = document.getElementById('homeTopAssisterVal');

  if (topScorerNameEl) topScorerNameEl.textContent = topScorer.name;
  if (topScorerValEl) topScorerValEl.textContent = `${topScorer.goals} 点`;
  if (topAssisterNameEl) topAssisterNameEl.textContent = topAssister.name;
  if (topAssisterValEl) topAssisterValEl.textContent = `${topAssister.assists} A`;
}

/**
 * 3. 活動予定を描画（次回の活動 ＆ 次の公式戦）
 * - 次回の活動: 直近の全予定（練習、TRM、公式戦など）から1件
 * - 次の公式戦: 公式戦カテゴリーの直近1件。未定の場合は「次節未定」を表示
 * @param {Object} [data]
 */
function renderHomeNextEvent(data) {
  const events = (data && data.events) || window.eventsData || [];
  const contentEl = document.getElementById('homeNextEventContent');
  const mountEl = document.getElementById('homeNextEventMount');
  const emptyEl = document.getElementById('homeNoNextEventMsg');

  const offContentEl = document.getElementById('homeNextOfficialContent');
  const offMountEl = document.getElementById('homeNextOfficialMount');
  const offEmptyEl = document.getElementById('homeNoNextOfficialMsg');

  if (!events || events.length === 0) {
    if (contentEl) contentEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (offContentEl) offContentEl.classList.add('hidden');
    if (offEmptyEl) offEmptyEl.classList.remove('hidden');
    return;
  }

  // 今日以降の直近予定を探索（今日を含む未来の予定）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = events.filter(e => {
    if (!e || !e.date) return false;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 1. 次回の活動（直近の全活動）
  const nextEv = upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  window.homeNextEvent = nextEv;

  if (!nextEv) {
    if (contentEl) contentEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
  } else {
    if (contentEl) contentEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (mountEl) {
      mountEl.replaceChildren();
      if (typeof createScheduleAgendaCardElement === 'function') {
        const cardNode = createScheduleAgendaCardElement(nextEv, { showAttendanceButtons: false });
        mountEl.appendChild(cardNode);
      }
    }
  }

  // 2. 次の公式戦（公式戦カテゴリーの直近1件）
  const upcomingOfficialMatches = upcomingEvents.filter(e => {
    const catInfo = (typeof resolveEventCategory === 'function')
      ? resolveEventCategory(e)
      : { category: 'その他' };
    return catInfo.category === '公式戦';
  });

  const nextOfficial = upcomingOfficialMatches.length > 0 ? upcomingOfficialMatches[0] : null;
  window.homeNextOfficialMatch = nextOfficial;

  if (!nextOfficial) {
    if (offContentEl) offContentEl.classList.add('hidden');
    if (offEmptyEl) offEmptyEl.classList.remove('hidden');
  } else {
    if (offContentEl) offContentEl.classList.remove('hidden');
    if (offEmptyEl) offEmptyEl.classList.add('hidden');
    if (offMountEl) {
      offMountEl.replaceChildren();
      if (typeof createScheduleAgendaCardElement === 'function') {
        const offCardNode = createScheduleAgendaCardElement(nextOfficial, { showAttendanceButtons: false });
        offMountEl.appendChild(offCardNode);
      }
    }
  }
}

/**
 * 4. 直近の試合結果を描画（共通 match-card を流用）
 * @param {Object} data
 */
function renderHomeRecentMatch(data) {
  const matches = (data && data.history && data.history.matches) || window.allMatchResults || [];
  const contentEl = document.getElementById('homeRecentMatchContent');
  const mountEl = document.getElementById('homeRecentMatchMount');
  const emptyEl = document.getElementById('homeNoRecentMatchMsg');

  if (!matches || matches.length === 0) {
    if (contentEl) contentEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (contentEl) contentEl.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');

  // 最新の試合（配列先頭）を取得
  const latest = matches[0];
  if (mountEl) {
    mountEl.replaceChildren();
    if (typeof createMatchCardElement === 'function') {
      const cardNode = createMatchCardElement(latest);
      mountEl.appendChild(cardNode);
    }
  }
}

// グローバル公開
window.initHomeView = initHomeView;
window.renderHomeNoticeArea = renderHomeNoticeArea;
window.renderHomeSeasonStats = renderHomeSeasonStats;
window.renderHomeNextEvent = renderHomeNextEvent;
window.renderHomeRecentMatch = renderHomeRecentMatch;
window.renderHomePlayerHeader = function() {};

// =========================================
// Web Push / LINE 個人通知テスト（モックUI制御）
// =========================================
window.homeNotifMockTab = window.homeNotifMockTab || 'webpush';

function setHomeMockFeedback(elId, message, type) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!message) {
    el.textContent = '';
    el.className = 'home-push-feedback hidden';
    return;
  }
  el.textContent = message;
  el.className = 'home-push-feedback ' + (type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : 'is-info');
}

function setHomePushFeedback(message, type) {
  setHomeMockFeedback('homePushFeedback', message, type);
}

function setHomeLineFeedback(message, type) {
  setHomeMockFeedback('homeLineFeedback', message, type);
}

function switchHomeNotifMockTab(tab) {
  window.homeNotifMockTab = (tab === 'line') ? 'line' : 'webpush';
  const webBtn = document.getElementById('tabBtnMockWebPush');
  const lineBtn = document.getElementById('tabBtnMockLine');
  const webPanel = document.getElementById('homeMockPanelWebPush');
  const linePanel = document.getElementById('homeMockPanelLine');

  if (webBtn) webBtn.classList.toggle('active', window.homeNotifMockTab === 'webpush');
  if (lineBtn) lineBtn.classList.toggle('active', window.homeNotifMockTab === 'line');
  if (webPanel) webPanel.classList.toggle('hidden', window.homeNotifMockTab !== 'webpush');
  if (linePanel) linePanel.classList.toggle('hidden', window.homeNotifMockTab !== 'line');

  if (window.homeNotifMockTab === 'line') {
    refreshHomeLineMockState(false);
  } else {
    refreshHomePushMockState();
  }
}

async function refreshHomePushMockState() {
  const badgeEl = document.getElementById('homePushStatusBadge');
  const iosGuideEl = document.getElementById('homePushIosGuide');
  const enableBtn = document.getElementById('btnHomePushEnable');
  const enableLabel = document.getElementById('btnHomePushEnableLabel');
  const testBtn = document.getElementById('btnHomePushTest');
  const disableBtn = document.getElementById('btnHomePushDisable');
  const endpointEl = document.getElementById('homePushEndpointInfo');

  if (!badgeEl || !window.SupabaseWebPush) return;
  if (window.homeNotifMockTab === 'line') {
    await refreshHomeLineMockState(false);
    return;
  }

  const env = window.SupabaseWebPush.getEnvironmentStatus();
  if (iosGuideEl) {
    iosGuideEl.classList.toggle('hidden', !env.needsIOSHomeScreen);
  }

  if (env.needsIOSHomeScreen) {
    badgeEl.textContent = 'PWA起動が必要';
    badgeEl.className = 'home-push-status-badge status-warn';
    if (enableLabel) enableLabel.textContent = '通知を有効化';
    if (disableBtn) disableBtn.classList.add('hidden');
    if (testBtn) testBtn.disabled = false;
    if (endpointEl) endpointEl.classList.add('hidden');
    return;
  }

  if (!env.supported) {
    badgeEl.textContent = '非対応環境';
    badgeEl.className = 'home-push-status-badge status-error';
    if (enableBtn) enableBtn.disabled = true;
    if (testBtn) testBtn.disabled = true;
    if (disableBtn) disableBtn.classList.add('hidden');
    if (endpointEl) endpointEl.classList.add('hidden');
    return;
  }

  let sub = null;
  try {
    sub = await window.SupabaseWebPush.getSubscription();
  } catch (e) {
    sub = null;
  }

  if (env.permission === 'denied') {
    badgeEl.textContent = 'ブロック中';
    badgeEl.className = 'home-push-status-badge status-error';
  } else if (sub) {
    badgeEl.textContent = '購読済み';
    badgeEl.className = 'home-push-status-badge status-active';
  } else if (env.permission === 'granted') {
    badgeEl.textContent = '許可済み（未購読）';
    badgeEl.className = 'home-push-status-badge status-warn';
  } else {
    badgeEl.textContent = '未有効化';
    badgeEl.className = 'home-push-status-badge status-idle';
  }

  if (enableLabel) {
    enableLabel.textContent = sub ? '購読情報を更新' : '通知を有効化';
  }
  if (disableBtn) {
    disableBtn.classList.toggle('hidden', !sub);
  }
  if (endpointEl) {
    if (sub && sub.endpoint) {
      const ep = sub.endpoint;
      const preview = ep.length > 68 ? ep.slice(0, 42) + '...' + ep.slice(-20) : ep;
      endpointEl.textContent = `登録先 Endpoint: ${preview}`;
      endpointEl.classList.remove('hidden');
    } else {
      endpointEl.textContent = '';
      endpointEl.classList.add('hidden');
    }
  }
}

async function handleHomeEnablePush() {
  if (!window.SupabaseWebPush) return;
  const btn = document.getElementById('btnHomePushEnable');
  const label = document.getElementById('btnHomePushEnableLabel');
  const prevText = label ? label.textContent : '通知を有効化';

  if (btn) btn.disabled = true;
  if (label) label.textContent = '登録中...';
  setHomePushFeedback('通知許可と Push 購読を登録しています...', 'info');

  try {
    const res = await window.SupabaseWebPush.subscribeAndSave(window.currentUser);
    await refreshHomePushMockState();
    if (res.savedToDb) {
      setHomePushFeedback('この端末の Web Push 購読を有効化し、Supabase へ保存しました。', 'success');
    } else if (res.dbError) {
      setHomePushFeedback(`端末の購読は完了しました（DB保存警告: ${res.dbError}）。テスト送信は利用できます。`, 'success');
    } else {
      setHomePushFeedback('この端末の Web Push 購読を有効化しました。', 'success');
    }
  } catch (err) {
    await refreshHomePushMockState();
    setHomePushFeedback(err && err.message ? err.message : '通知の有効化に失敗しました。', 'error');
  } finally {
    if (btn) btn.disabled = false;
    await refreshHomePushMockState();
    if (label && !label.textContent) label.textContent = prevText;
  }
}

async function handleHomeSendTestPush() {
  if (!window.SupabaseWebPush) return;
  const btn = document.getElementById('btnHomePushTest');
  const titleEl = document.getElementById('homePushTestTitle');
  const bodyEl = document.getElementById('homePushTestBody');
  const prevHtml = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = '送信中...';
  }

  try {
    let sub = await window.SupabaseWebPush.getSubscription();
    if (!sub) {
      setHomePushFeedback('先にこの端末で通知を有効化します...', 'info');
      await window.SupabaseWebPush.subscribeAndSave(window.currentUser);
      sub = await window.SupabaseWebPush.getSubscription();
    }

    if (!sub) {
      throw new Error('Push 購読情報を取得できませんでした。先に「通知を有効化」を実行してください。');
    }

    setHomePushFeedback('Supabase Edge Function 経由でテスト通知を送信しています...', 'info');
    const title = (titleEl && titleEl.value.trim()) || 'FC Benten テスト通知';
    const body = (bodyEl && bodyEl.value.trim()) || 'ホーム画面からの Web Push 受信テストです。';

    const result = await window.SupabaseWebPush.sendTestPush({
      subscription: sub.toJSON(),
      title,
      body
    });
    setHomePushFeedback(`テスト通知を送信しました（送信成功: ${result.sentCount || 1}件）。OSの通知バナーをご確認ください。`, 'success');
  } catch (err) {
    setHomePushFeedback(err && err.message ? err.message : 'テスト通知の送信に失敗しました。', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prevHtml;
    }
    await refreshHomePushMockState();
  }
}

async function handleHomeDisablePush() {
  if (!window.SupabaseWebPush) return;
  const btn = document.getElementById('btnHomePushDisable');
  if (btn) btn.disabled = true;

  try {
    await window.SupabaseWebPush.unsubscribeAndClear(window.currentUser);
    setHomePushFeedback('この端末の Web Push 購読を解除しました。', 'info');
  } catch (err) {
    setHomePushFeedback(err && err.message ? err.message : '購読解除に失敗しました。', 'error');
  } finally {
    if (btn) btn.disabled = false;
    await refreshHomePushMockState();
  }
}

window.refreshHomePushMockState = refreshHomePushMockState;
window.handleHomeEnablePush = handleHomeEnablePush;
window.handleHomeSendTestPush = handleHomeSendTestPush;
window.handleHomeDisablePush = handleHomeDisablePush;

async function refreshHomeLineMockState(showMessage) {
  const badgeEl = document.getElementById('homePushStatusBadge');
  const codeBox = document.getElementById('homeLineCodeBox');
  const codeText = document.getElementById('homeLineCodeText');
  const unlinkBtn = document.getElementById('btnHomeLineUnlink');
  const infoEl = document.getElementById('homeLineUserIdInfo');

  if (!window.SupabaseLinePush) return;

  try {
    const status = await window.SupabaseLinePush.getLineLinkStatus(window.currentUser);
    if (badgeEl && window.homeNotifMockTab === 'line') {
      badgeEl.textContent = status.linked ? 'LINE連携済み' : 'LINE未連携';
      badgeEl.className = 'home-push-status-badge ' + (status.linked ? 'status-active' : 'status-idle');
    }
    if (unlinkBtn) unlinkBtn.classList.toggle('hidden', !status.linked);
    if (infoEl) {
      if (status.linked && status.lineUserId) {
        const lid = status.lineUserId;
        const masked = lid.length > 12 ? lid.slice(0, 6) + '...' + lid.slice(-4) : lid;
        infoEl.textContent = `連携済み LINE ID: ${masked} (${status.name})`;
        infoEl.classList.remove('hidden');
      } else {
        infoEl.textContent = '';
        infoEl.classList.add('hidden');
      }
    }
    if (codeBox && codeText) {
      if (!status.linked && status.linkCode) {
        codeText.textContent = status.linkCode;
        const openOaLink = document.getElementById('btnHomeLineOpenOa');
        const openOaLabel = document.getElementById('btnHomeLineOpenLabel');
        const isMobile = window.SupabaseLinePush.isMobileBrowser ? window.SupabaseLinePush.isMobileBrowser() : false;
        if (openOaLink && window.SupabaseLinePush.getLineOpenUrl) {
          openOaLink.href = window.SupabaseLinePush.getLineOpenUrl(status.linkCode);
        }
        if (openOaLabel) {
          openOaLabel.textContent = isMobile ? 'LINEを開く（入力済み）' : '公式LINEを開く（QR表示）';
        }
        codeBox.classList.remove('hidden');
      } else {
        codeBox.classList.add('hidden');
      }
    }
    if (showMessage) {
      setHomeLineFeedback(
        status.linked
          ? `${status.name} さんの LINE アカウントと連携済みです。「LINE テスト送信」を試せます。`
          : 'まだ LINE 未連携です。連携コードを発行して公式LINEのトークへ送信してください。',
        status.linked ? 'success' : 'info'
      );
    }
  } catch (err) {
    if (badgeEl && window.homeNotifMockTab === 'line') {
      badgeEl.textContent = 'LINE未確認';
      badgeEl.className = 'home-push-status-badge status-warn';
    }
    if (showMessage) {
      setHomeLineFeedback(err && err.message ? err.message : '連携状態の確認に失敗しました。', 'error');
    }
  }
}

async function handleHomeIssueLineCode() {
  if (!window.SupabaseLinePush) return;
  const btn = document.getElementById('btnHomeLineIssueCode');
  const codeBox = document.getElementById('homeLineCodeBox');
  const codeText = document.getElementById('homeLineCodeText');
  if (btn) btn.disabled = true;
  setHomeLineFeedback('連携コードを発行しています...', 'info');

  try {
    const res = await window.SupabaseLinePush.issueLinkCode(window.currentUser);
    if (codeText) codeText.textContent = res.code;
    const openOaLink = document.getElementById('btnHomeLineOpenOa');
    const openOaLabel = document.getElementById('btnHomeLineOpenLabel');
    const isMobile = window.SupabaseLinePush.isMobileBrowser ? window.SupabaseLinePush.isMobileBrowser() : false;
    if (openOaLink && window.SupabaseLinePush.getLineOpenUrl) {
      openOaLink.href = window.SupabaseLinePush.getLineOpenUrl(res.code);
    }
    if (openOaLabel) {
      openOaLabel.textContent = isMobile ? 'LINEを開く（入力済み）' : '公式LINEを開く（QR表示）';
    }
    if (codeBox) codeBox.classList.remove('hidden');
    setHomeLineFeedback(
      isMobile
        ? `コード「${res.code}」を発行しました。「LINEを開く（入力済み）」からそのまま送信し、アプリへ戻って「連携状態を確認」を押してください。`
        : `コード「${res.code}」を発行しました。「コピー」して公式LINEトークへ送信（未追加なら「公式LINEを開く（QR表示）」から追加）後、「連携状態を確認」を押してください。`,
      'success'
    );
  } catch (err) {
    setHomeLineFeedback(err && err.message ? err.message : '連携コードの発行に失敗しました。', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleHomeCopyLineCode() {
  const codeText = document.getElementById('homeLineCodeText');
  const code = codeText ? codeText.textContent.trim() : '';
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    setHomeLineFeedback(`連携コード「${code}」をコピーしました。公式LINEのトークに貼り付けて送信してください。`, 'success');
  } catch (e) {
    setHomeLineFeedback(`コード「${code}」をそのまま公式LINEへ送信してください。`, 'info');
  }
}

async function handleHomeSendTestLinePush() {
  if (!window.SupabaseLinePush) return;
  const btn = document.getElementById('btnHomeLineTest');
  const titleEl = document.getElementById('homeLineTestTitle');
  const bodyEl = document.getElementById('homeLineTestBody');
  const prevHtml = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = '送信中...';
  }
  setHomeLineFeedback('Supabase Edge Function 経由で LINE テスト通知を送信しています...', 'info');

  try {
    const title = (titleEl && titleEl.value.trim()) || 'FC Benten LINE テスト通知';
    const body = (bodyEl && bodyEl.value.trim()) || '個人トーク宛てのテスト通知です。';
    const res = await window.SupabaseLinePush.sendTestLinePush({ title, body });
    setHomeLineFeedback(`LINE 通知を送信しました（送信件数: ${res.sentCount || 1}件）。公式LINEトークをご確認ください。`, 'success');
  } catch (err) {
    setHomeLineFeedback(err && err.message ? err.message : 'LINE テスト送信に失敗しました。', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prevHtml;
    }
    await refreshHomeLineMockState(false);
  }
}

async function handleHomeUnlinkLine() {
  if (!window.SupabaseLinePush) return;
  const btn = document.getElementById('btnHomeLineUnlink');
  if (btn) btn.disabled = true;
  try {
    await window.SupabaseLinePush.unlinkLine(window.currentUser);
    setHomeLineFeedback('LINE 連携を解除しました。', 'info');
  } catch (err) {
    setHomeLineFeedback(err && err.message ? err.message : '連携解除に失敗しました。', 'error');
  } finally {
    if (btn) btn.disabled = false;
    await refreshHomeLineMockState(false);
  }
}

window.switchHomeNotifMockTab = switchHomeNotifMockTab;
window.refreshHomeLineMockState = refreshHomeLineMockState;
window.handleHomeIssueLineCode = handleHomeIssueLineCode;
window.handleHomeCopyLineCode = handleHomeCopyLineCode;
window.handleHomeSendTestLinePush = handleHomeSendTestLinePush;
window.handleHomeUnlinkLine = handleHomeUnlinkLine;
