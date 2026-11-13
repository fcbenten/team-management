(function () {
    'use strict';

    // 1. Supabase 設定
    const SUPABASE_URL = 'https://pkufnywvnuicragvobaq.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_Ryi3mETQr8QfgwSGyAcD-A_fiQe_abr';
    const GAS_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbwhp8W6iNNXy8kdZsIsT4RyPb6B7s9e0Q-plumcst0ChfjG8ck3XJ6irlGlx0c_GpLS/exec';

    let client = null;
    function getClient() {
      if (!client) {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
          client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
          console.error('Supabase JS library is not loaded.');
        }
      }
      return client;
    }

    // 2. ユーティリティ
    function normalizeDateStr(d) {
      if (!d) return '';
      return String(d).replace(/-/g, '/').trim();
    }

    /**
     * カレンダーイベントと Supabase 出欠データを高速マージ
     */
    function mergeEventsWithAttendance(events, rawAttendance, idToMember) {
      idToMember = idToMember || {};
      const attendanceByEvent = {};
      (rawAttendance || []).forEach(att => {
        const eid = String(att.event_id || '').trim();
        if (!attendanceByEvent[eid]) attendanceByEvent[eid] = [];
        attendanceByEvent[eid].push(att);
      });

      return (events || []).map(ev => {
        const cleanEvId = String(ev.id || '').split('@')[0];
        const eventAtts = attendanceByEvent[cleanEvId] || attendanceByEvent[ev.id] || [];

        const yesNames = [];
        const noNames = [];
        const maybeNames = [];
        const yesEmails = [];
        const noEmails = [];
        const maybeEmails = [];

        eventAtts.forEach(att => {
          const mem = idToMember[att.member_id];
          const mName = mem ? mem.name : (att.member_id || '');
          const mEmail = mem ? (mem.email || '').toLowerCase() : '';
          const st = String(att.status || '').toLowerCase();

          if (st === 'yes') {
            yesNames.push(mName);
            if (mEmail) yesEmails.push(mEmail);
          } else if (st === 'no') {
            noNames.push(mName);
            if (mEmail) noEmails.push(mEmail);
          } else if (st === 'maybe') {
            maybeNames.push(mName);
            if (mEmail) maybeEmails.push(mEmail);
          }
        });

        const existingDetail = ev.attendeesDetail || { yes: [], no: [], maybe: [], unanswered: [], yesEmails: [], noEmails: [], maybeEmails: [], unansweredEmails: [] };

        const finalYes = Array.from(new Set([...yesNames, ...(existingDetail.yes || []).filter(n => !eventAtts.some(a => idToMember[a.member_id] && idToMember[a.member_id].name === n))]));
        const finalNo = Array.from(new Set([...noNames, ...(existingDetail.no || []).filter(n => !eventAtts.some(a => idToMember[a.member_id] && idToMember[a.member_id].name === n))]));
        const finalMaybe = Array.from(new Set([...maybeNames, ...(existingDetail.maybe || []).filter(n => !eventAtts.some(a => idToMember[a.member_id] && idToMember[a.member_id].name === n))]));

        return {
          ...ev,
          attendeesDetail: {
            ...existingDetail,
            yes: finalYes,
            no: finalNo,
            maybe: finalMaybe,
            yesEmails: Array.from(new Set([...yesEmails, ...(existingDetail.yesEmails || [])])),
            noEmails: Array.from(new Set([...noEmails, ...(existingDetail.noEmails || [])])),
            maybeEmails: Array.from(new Set([...maybeEmails, ...(existingDetail.maybeEmails || [])]))
          }
        };
      });
    }

    /**
     * バックグラウンドで Google カレンダーの最新イベントを取得し、画面を更新 (初期描画を一切ブロックしない)
     */
    async function fetchLatestEventsInBackground(idToMember, rawAttendance) {
      try {
        const res = await fetch(`${GAS_ENDPOINT_URL}?action=getEvents`).then(r => r.json()).catch(() => null);
        if (res && res.success && Array.isArray(res.events)) {
          try { localStorage.setItem('fcb_cached_events', JSON.stringify(res.events)); } catch (e) { }
          const merged = mergeEventsWithAttendance(res.events, rawAttendance, idToMember);
          window.eventsData = merged;
          if (typeof renderCalendar === 'function') {
            renderCalendar(window.calYear || new Date().getFullYear(), (window.calMonth !== undefined) ? window.calMonth : new Date().getMonth());
          }
          if (typeof renderAgendaList === 'function') {
            renderAgendaList();
          }
          if (typeof updateUnansweredBadges === 'function') {
            updateUnansweredBadges();
          }
          console.log(`⚡ [CalendarBackground] Successfully refreshed ${res.events.length} events in background.`);
        }

        // バックグラウンドでカレンダー出欠バッチ集計（GAS）も非同期取得
        fetch(GAS_ENDPOINT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            functionName: 'apiGetCalendarAttendance',
            args: [String(new Date().getFullYear())]
          })
        }).then(r => r.json()).then(calRes => {
          if (calRes && calRes.success && calRes.data) {
            try { localStorage.setItem('fcb_cached_cal_attendance', JSON.stringify(calRes.data)); } catch (e) { }
            window.calendarAttendanceCache = window.calendarAttendanceCache || {};
            window.calendarAttendanceCache[calRes.data.year || String(new Date().getFullYear())] = calRes.data;
            window.calendarAttendanceData = calRes.data;
            if (typeof filterAndRenderRankings === 'function') {
              filterAndRenderRankings();
            }
          }
        }).catch(e => console.warn('[CalendarBackground] Attendance fetch warning:', e));

      } catch (e) {
        console.warn('[CalendarBackground] Error in background fetch:', e);
      }
    }

    // 3. SupabaseService 本体
    const SupabaseService = {
      getClient: getClient,

      /**
       * アプリ初期データを Supabase から並列一括取得 (0.2〜0.4秒)
       */
      async getInitialData(forceRefresh) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが初期化されていません。');

        const t0 = performance.now();

        // カレンダーイベントおよび出欠バッチ集計はキャッシュから即座に同期展開（GASの3〜5秒ブロックを完全排除し0秒描画）
        let initialEvents = [];
        let initialCalAttendance = null;
        try {
          const cached = localStorage.getItem('fcb_cached_events');
          if (cached) initialEvents = JSON.parse(cached);
          const cachedAtt = localStorage.getItem('fcb_cached_cal_attendance');
          if (cachedAtt) initialCalAttendance = JSON.parse(cachedAtt);
        } catch (e) { }

        // 10テーブル＋ビューを並列一括フェッチ (Supabase のみ: 0.15〜0.25秒で即時完了)
        const [
          resMembers,
          resMatches,
          resScoreLogs,
          resAttendance,
          resMaster,
          resItems,
          resEqLogs,
          resBulletin,
          resComments,
          resReads,
          resAttStats
        ] = await Promise.all([
          sb.from('members').select('*').order('member_id'),
          sb.from('matches').select('*').order('match_date', { ascending: false }),
          sb.from('score_logs').select('*'),
          sb.from('attendance').select('*'),
          sb.from('equipment_master').select('*').order('sort_order'),
          sb.from('equipment_items').select('*').order('item_id'),
          sb.from('equipment_event_logs').select('*').order('created_at', { ascending: false }),
          sb.from('view_bulletin_summary').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
          sb.from('bulletin_comments').select('*').eq('is_deleted', false).order('created_at', { ascending: true }),
          sb.from('bulletin_reads').select('*'),
          sb.from('view_player_attendance_stats').select('*')
        ]);

        const t1 = performance.now();
        console.log(`[Supabase] Parallel fetch completed in ${(t1 - t0).toFixed(1)} ms.`);

        // メンバー辞書の作成
        const rawMembers = resMembers.data || [];
        const idToMember = {};
        const nameToMember = {};
        const memberMap = {}; // email -> name
        const playerNumbers = {};
        const playerPositions = {};
        const playerAvatars = {};

        const roster = [];
        const adminRoster = [];
        rawMembers.forEach(m => {
          const isSpecial = (m.member_type === 'SPECIAL' || ['MBR-SPECIAL-GUEST', 'MBR-SPECIAL-OG', 'MBR-SPECIAL-NONE'].includes(m.member_id) || ['助っ人', 'OG', 'なし'].includes(m.name));
          const isPast = !!m.is_past || m.member_type === 'PAST';
          const isSuspended = !isPast && (!!m.is_suspended || m.member_type === 'SUSPENDED');

          const numVal = (m.number !== null && m.number !== '' && !isNaN(m.number)) ? Number(m.number) : null;
          const formatted = {
            memberId: m.member_id,
            id: m.member_id,
            name: m.name,
            number: numVal !== null ? numVal : 999,
            role: m.role || '選手',
            position: m.position || 'FP',
            email: m.email || '',
            phone: m.phone || '',
            birthday: m.birthday || '',
            avatarUrl: m.avatar_url || '',
            hasCalendarLink: !!m.token,
            hasToken: !!m.token,
            notificationType: m.notification_type || 'none',
            lineUserId: m.line_user_id || '',
            pushSubscription: m.push_subscription || '',
            notifySettings: m.notify_settings ? (typeof m.notify_settings === 'string' ? JSON.parse(m.notify_settings) : m.notify_settings) : { emergency: true, attendance: true, bulletin: true },
            isPast: isPast,
            isSuspended: isSuspended,
            memberType: isSpecial ? 'SPECIAL' : (isPast ? 'PAST' : 'REGULAR')
          };

          // 全レコードを逆引き用辞書には登録（試合ログや過去スタッツの選手名解決用）
          idToMember[m.member_id] = formatted;
          if (m.name) nameToMember[m.name] = formatted;
          if (m.email) memberMap[m.email.toLowerCase()] = m.name;
          if (m.name && numVal !== null) {
            playerNumbers[m.name] = numVal;
            playerPositions[m.name] = m.position || 'FP';
            playerAvatars[m.name] = m.avatar_url || '';
          }

          // 管理者用名簿（現役・休部・OBすべて、特殊枠のみ除外）
          if (!isSpecial) {
            adminRoster.push(formatted);
          }

          // 通常の名簿一覧（roster）には正規の現役メンバー（休部中の部員も含む！くくりは現役）
          if (!isSpecial && !isPast) {
            roster.push(formatted);
          }
        });
        window.nameToMember = nameToMember;

        // 試合記録 & 得点詳細の組み立て
        const rawMatches = resMatches.data || [];
        const rawScoreLogs = resScoreLogs.data || [];

        // ログ辞書
        const logMap = {};
        rawScoreLogs.forEach(l => {
          if (!logMap[l.match_id]) logMap[l.match_id] = [];
          const pMem = idToMember[l.member_id];
          const aMem = idToMember[l.assist_member_id];
          logMap[l.match_id].push({
            logId: l.log_id,
            period: l.period || '',
            min: l.minute || 0,
            type: l.log_type,
            player: pMem ? pMem.name : '不明',
            memberId: l.member_id,
            assist: aMem ? aMem.name : (l.assist_member_id ? '不明' : ''),
            assistMemberId: l.assist_member_id
          });
        });

        const seasonSet = new Set();
        const matches = rawMatches.map(m => {
          const dateStr = normalizeDateStr(m.match_date);
          const matchYear = dateStr.match(/^(\d{4})/);
          const yearStr = matchYear ? matchYear[1] : '';
          if (yearStr) seasonSet.add(yearStr);

          const mLogs = logMap[m.match_id] || [];
          const halfScores = { my1st: 0, opp1st: 0, my2nd: 0, opp2nd: 0, myExt: 0, oppExt: 0 };
          mLogs.forEach(l => {
            if (l.type === '得点') {
              if (l.period === '前半') halfScores.my1st++;
              else if (l.period === '後半') halfScores.my2nd++;
              else if (l.period === '延長') halfScores.myExt++;
            } else if (l.type === '相手得点') {
              if (l.period === '前半') halfScores.opp1st++;
              else if (l.period === '後半') halfScores.opp2nd++;
              else if (l.period === '延長') halfScores.oppExt++;
            }
          });

          const momMem = idToMember[m.mom_member_id];
          return {
            matchId: m.match_id,
            date: dateStr,
            year: yearStr,
            category: m.category || 'TRM',
            opponent: m.opponent || '未設定',
            myScore: m.my_score || 0,
            oppScore: m.opp_score || 0,
            result: m.result || '引き分け',
            attended: m.attended_players || '',
            location: m.location || '',
            mom: momMem ? momMem.name : (m.mom_member_id ? '不明' : 'なし'),
            momMemberId: m.mom_member_id,
            halfScores: halfScores,
            logs: mLogs
          };
        });

        const seasons = Array.from(seasonSet).sort((a, b) => b - a);
        const history = { matches: matches, seasons: seasons };

        // スタッツ計算 (現役部員のみ対象・OB/特殊枠は完全除外)
        const pastMemberNames = new Set(
          rawMembers
            .filter(m => !!m.is_past || m.member_type === 'PAST' || m.member_type === 'SPECIAL' || ['助っ人', 'OG', 'なし'].includes(m.name))
            .map(m => m.name)
        );

        const statsMap = {};
        roster.forEach(mem => {
          if (!mem.isPast && mem.memberType === 'REGULAR') {
            statsMap[mem.name] = { name: mem.name, games: 0, goals: 0, assists: 0, mom: 0, points: 0 };
          }
        });

        matches.forEach(m => {
          const attendedArr = (m.attended || '').split(',').map(s => s.trim()).filter(Boolean);
          attendedArr.forEach(pName => {
            if (pastMemberNames.has(pName)) return;
            if (!statsMap[pName]) statsMap[pName] = { name: pName, games: 0, goals: 0, assists: 0, mom: 0, points: 0 };
            statsMap[pName].games++;
          });

          if (m.mom && m.mom !== 'なし' && m.mom !== '-' && m.mom !== '不明' && !pastMemberNames.has(m.mom)) {
            if (!statsMap[m.mom]) statsMap[m.mom] = { name: m.mom, games: 0, goals: 0, assists: 0, mom: 0, points: 0 };
            statsMap[m.mom].mom++;
          }

          (m.logs || []).forEach(l => {
            if (l.type === '得点' && l.player && l.player !== '不明' && l.player !== 'OG' && l.player !== '助っ人' && !pastMemberNames.has(l.player)) {
              if (!statsMap[l.player]) statsMap[l.player] = { name: l.player, games: 0, goals: 0, assists: 0, mom: 0, points: 0 };
              statsMap[l.player].goals++;
            }
            if (l.assist && l.assist !== '不明' && l.assist !== '-' && l.assist !== 'なし' && l.assist !== 'OG' && l.assist !== '助っ人' && !pastMemberNames.has(l.assist)) {
              if (!statsMap[l.assist]) statsMap[l.assist] = { name: l.assist, games: 0, goals: 0, assists: 0, mom: 0, points: 0 };
              statsMap[l.assist].assists++;
            }
          });
        });

        const stats = Object.values(statsMap)
          .filter(s => !pastMemberNames.has(s.name))
          .map(s => {
            s.points = s.goals + s.assists;
            return s;
          });

        // 出欠データの構造化
        const rawAttendance = resAttendance.data || [];
        const attendanceByEvent = {};
        rawAttendance.forEach(att => {
          if (!attendanceByEvent[att.event_id]) {
            attendanceByEvent[att.event_id] = { yes: [], no: [], maybe: [], unanswered: [], yesEmails: [], noEmails: [], maybeEmails: [], unansweredEmails: [] };
          }
          const mObj = idToMember[att.member_id];
          const mName = mObj ? mObj.name : att.member_id;
          const mEmail = mObj ? mObj.email : '';
          const st = (att.status || '').toLowerCase();
          if (st === 'yes') {
            attendanceByEvent[att.event_id].yes.push(mName);
            if (mEmail) attendanceByEvent[att.event_id].yesEmails.push(mEmail);
          } else if (st === 'no') {
            attendanceByEvent[att.event_id].no.push(mName);
            if (mEmail) attendanceByEvent[att.event_id].noEmails.push(mEmail);
          } else if (st === 'maybe') {
            attendanceByEvent[att.event_id].maybe.push(mName);
            if (mEmail) attendanceByEvent[att.event_id].maybeEmails.push(mEmail);
          }
        });

        // 備品データの構造化
        const rawMaster = resMaster.data || [];
        const rawItems = resItems.data || [];
        const rawEqLogs = resEqLogs.data || [];

        const masterList = rawMaster.map(m => ({
          code: m.equipment_code,
          equipmentCode: m.equipment_code,
          name: m.name,
          ruleType: m.rule_type,
          reqTR: m.req_tr,
          reqTRM: m.req_trm,
          reqOfficial: m.req_official,
          notes: m.notes || '',
          sortOrder: m.sort_order
        }));

        const items = rawItems.map(it => {
          const hMem = idToMember[it.member_id];
          const mName = hMem ? hMem.name : (it.member_id ? '不明な部員' : '未割当');
          const mNum = hMem ? hMem.number : null;
          const mAvatar = hMem ? (hMem.avatarUrl || '') : '';
          return {
            id: it.item_id,
            itemId: it.item_id,
            code: it.equipment_code,
            itemCode: it.equipment_code,
            equipmentCode: it.equipment_code,
            name: it.item_name,
            holderId: it.member_id,
            memberId: it.member_id,
            holderName: mName,
            memberName: mName,
            holderNumber: mNum,
            memberNumber: mNum,
            memberAvatarUrl: mAvatar,
            status: it.status || '保管中',
            notes: it.notes || '',
            updatedAt: it.updated_at ? normalizeDateStr(it.updated_at) : ''
          };
        });

        const equipmentData = {
          success: true,
          masterList: masterList,
          itemsList: items,
          items: items,
          logs: rawEqLogs,
          upcomingEquipment: [],
          isAdmin: true
        };

        // 掲示板データの構造化
        const rawBulletin = resBulletin.data || [];
        const rawComments = resComments.data || [];
        const rawReads = resReads ? (resReads.data || []) : [];

        // 既読データの投稿別マッピング（実在する登録メンバーのみを対象とし、空IDや不正データを完全除外）
        const readersByPost = {};
        rawReads.forEach(r => {
          if (!r.member_id) return;
          const rMember = idToMember[r.member_id];
          if (!rMember || !rMember.name) return;
          if (!readersByPost[r.post_id]) readersByPost[r.post_id] = [];
          readersByPost[r.post_id].push({
            memberId: r.member_id,
            memberName: rMember.name,
            readAt: r.read_at
          });
        });

        const commentsByPost = {};
        rawComments.forEach(c => {
          if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
          const cAuthor = idToMember[c.author_member_id];
          commentsByPost[c.post_id].push({
            id: c.comment_id,
            postId: c.post_id,
            authorId: c.author_member_id,
            authorName: cAuthor ? cAuthor.name : '不明',
            authorAvatar: cAuthor ? cAuthor.avatarUrl : '',
            content: c.content,
            createdAt: c.created_at
          });
        });

        // 正規の現役メンバーのみを対象（特殊枠「助っ人」「OG」「なし」および過去メンバー・休部者を完全排除）
        const activeMembersList = roster.filter(m => {
          const mName = String(m.name || '').trim();
          const mId = String(m.memberId || m.id || '').trim();
          const isSpecial = m.memberType === 'SPECIAL' || ['助っ人', 'OG', 'なし'].includes(mName) || mId.includes('SPECIAL');
          return !isSpecial && !m.isPast && m.memberType !== 'SUSPENDED';
        });

        const bulletinPosts = rawBulletin.map(p => {
          const pAuthor = idToMember[p.author_member_id];
          const postReaders = readersByPost[p.post_id] || [];
          const readMemberIds = new Set(postReaders.map(r => r.memberId));
          const unreadMembers = activeMembersList
            .filter(m => !readMemberIds.has(m.memberId || m.id))
            .map(m => ({
              memberId: m.memberId || m.id,
              memberName: m.name
            }));

          return {
            id: p.post_id,
            category: p.category || '連絡',
            title: p.title,
            content: p.content,
            eventId: p.event_id || '',
            eventTitle: p.event_title || '',
            eventDate: p.event_date || '',
            isPinned: !!p.is_pinned,
            authorId: p.author_member_id,
            authorName: p.author_member_name || (pAuthor ? pAuthor.name : '不明'),
            authorAvatar: p.author_avatar_url || (pAuthor ? pAuthor.avatarUrl : ''),
            createdAt: p.created_at,
            updatedById: p.updated_by_member_id,
            updatedAt: p.updated_at,
            readCount: postReaders.length,
            commentCount: Number(p.comment_count || 0),
            comments: commentsByPost[p.post_id] || [],
            readers: postReaders,
            unreadMembers: unreadMembers
          };
        });

        const pinnedPosts = bulletinPosts.filter(p => p.isPinned);
        const bulletinData = {
          success: true,
          posts: bulletinPosts,
          pinnedPosts: pinnedPosts,
          totalUnreadCount: 0,
          activeMemberCount: activeMembersList.length
        };

        // 7. キャッシュイベントと Supabase 出欠を即時同期マージ (0ms で画面描画を即時解放)
        const mergedEvents = mergeEventsWithAttendance(initialEvents, resAttendance.data || [], idToMember);

        // 8. Supabase 集計ビュー (view_player_attendance_stats) からカレンダー出欠オブジェクトをリアルタイム構築 (0ms)
        const currentYearStr = new Date().getFullYear().toString();
        const calPlayers = {};
        roster.forEach(m => {
          calPlayers[m.name] = {
            name: m.name,
            all: { invited: 0, attended: 0, rate: 0 },
            '公式戦': { invited: 0, attended: 0, rate: 0 },
            'TRM': { invited: 0, attended: 0, rate: 0 },
            'TR': { invited: 0, attended: 0, rate: 0 },
            'その他': { invited: 0, attended: 0, rate: 0 }
          };
        });

        // Supabase view_player_attendance_stats の結果をリアルタイム反映 (深夜バッチ完全不要)
        (resAttStats.data || []).forEach(st => {
          const mName = st.member_name;
          if (!mName) return;
          if (!calPlayers[mName]) {
            calPlayers[mName] = {
              name: mName,
              all: { invited: 0, attended: 0, rate: 0 },
              '公式戦': { invited: 0, attended: 0, rate: 0 },
              'TRM': { invited: 0, attended: 0, rate: 0 },
              'TR': { invited: 0, attended: 0, rate: 0 },
              'その他': { invited: 0, attended: 0, rate: 0 }
            };
          }
          const tot = Number(st.total_events || 0);
          const att = Number(st.attended_events || 0);
          calPlayers[mName].all = {
            invited: tot,
            attended: att,
            rate: tot > 0 ? Math.round((att / tot) * 100) : 0
          };
          const offInv = Number(st.invited_official || 0);
          const offAtt = Number(st.attended_official || 0);
          calPlayers[mName]['公式戦'] = {
            invited: offInv,
            attended: offAtt,
            rate: offInv > 0 ? Math.round((offAtt / offInv) * 100) : 0
          };
          const trmInv = Number(st.invited_trm || 0);
          const trmAtt = Number(st.attended_trm || 0);
          calPlayers[mName]['TRM'] = {
            invited: trmInv,
            attended: trmAtt,
            rate: trmInv > 0 ? Math.round((trmAtt / trmInv) * 100) : 0
          };
          const trInv = Number(st.invited_tr || 0);
          const trAtt = Number(st.attended_tr || 0);
          calPlayers[mName]['TR'] = {
            invited: trInv,
            attended: trAtt,
            rate: trInv > 0 ? Math.round((trAtt / trInv) * 100) : 0
          };
          const othInv = Number(st.invited_other || 0);
          const othAtt = Number(st.attended_other || 0);
          calPlayers[mName]['その他'] = {
            invited: othInv,
            attended: othAtt,
            rate: othInv > 0 ? Math.round((othAtt / othInv) * 100) : 0
          };
        });

        const calendarAttendancePayload = {
          year: currentYearStr,
          updatedAt: new Date().toISOString(),
          players: calPlayers
        };
        window.calendarAttendanceCache = window.calendarAttendanceCache || {};
        window.calendarAttendanceCache[currentYearStr] = calendarAttendancePayload;
        window.calendarAttendanceData = calendarAttendancePayload;

        // バックグラウンドで Google カレンダーの最新イベントを非同期取得 (初期描画を一切ブロックしない)
        setTimeout(() => {
          fetchLatestEventsInBackground(idToMember, resAttendance.data || []);
        }, 50);

        try {
          localStorage.setItem('fcb_cached_admin_roster', JSON.stringify(adminRoster));
        } catch(e) {}

        // 最終返却ペイロード (既存フロントエンドがそのまま受け取れる完全互換構造)
        return {
          success: true,
          roster: roster,
          adminRoster: adminRoster,
          adminMemberList: adminRoster,
          memberMap: memberMap,
          playerNumbers: playerNumbers,
          playerPositions: playerPositions,
          playerAvatars: playerAvatars,
          history: history,
          stats: stats,
          equipmentData: equipmentData,
          bulletinData: bulletinData,
          calendarAttendance: calendarAttendancePayload,
          events: mergedEvents
        };
      },

      /**
       * 出欠ステータスの即時更新 (PWA -> Supabase, 非同期でカレンダー同期)
       */
      async updateEventAttendance(payload) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const eventId = String(payload.eventId || '').trim();
        let memberId = payload.memberId;

        // 1. memberId が未指定の場合、名前またはメールから確実に逆引き解決
        const targetName = payload.userName || (window.currentUser ? window.currentUser.name : '');
        const targetEmail = (payload.userEmail || (window.currentUser ? window.currentUser.email : '')).toLowerCase().trim();

        if (!memberId && window.currentUser) {
          memberId = window.currentUser.memberId || window.currentUser.id;
        }

        if (!memberId) {
          try {
            const cachedRoster = localStorage.getItem('fcb_cached_roster');
            if (cachedRoster) {
              const rList = JSON.parse(cachedRoster);
              const found = (rList || []).find(m => {
                if (targetEmail && m.email && String(m.email).toLowerCase().trim() === targetEmail) return true;
                if (targetName && m.name && String(m.name).replace(/[\s\u3000]+/g, '').toLowerCase() === String(targetName).replace(/[\s\u3000]+/g, '').toLowerCase()) return true;
                return false;
              });
              if (found) {
                memberId = found.id || found.memberId;
              }
            }
          } catch (e) { }
        }

        const status = String(payload.status || 'maybe').toLowerCase();
        const comment = payload.comment || null;
        const category = payload.category || payload.originalCategory || 'その他';

        // 2. Supabase attendance に即時 UPSERT (0.1秒)
        if (eventId && memberId) {
          const { error: attError } = await sb.from('attendance').upsert({
            event_id: eventId,
            member_id: memberId,
            event_date: payload.originalDate || null,
            event_title: payload.originalTitle || null,
            category: category,
            status: status,
            comment: comment,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'event_id,member_id'
          });

          if (attError) {
            console.error('[Supabase] Attendance UPSERT error:', attError);
          } else {
            console.log(`[Supabase] Attendance updated: ${eventId} -> ${memberId}: ${status}`);
          }
        } else {
          console.warn('[Supabase] Missing eventId or memberId for Supabase UPSERT, proceeding to calendar sync:', { eventId, memberId });
        }

        // 3. 出欠変更をローカル集計データへ即時反映し、ランキング・個人成績を 0 秒リアルタイム再描画
        try {
          const pName = targetName || (window.currentUser ? window.currentUser.name : null);
          if (pName && window.calendarAttendanceData && window.calendarAttendanceData.players) {
            const pRec = window.calendarAttendanceData.players[pName];
            if (pRec) {
              const prevAttended = pRec.all.attended;
              if (status === 'yes') {
                pRec.all.attended++;
                if (pRec[category]) pRec[category].attended++;
              } else if (prevAttended > 0) {
                pRec.all.attended = Math.max(0, pRec.all.attended - 1);
                if (pRec[category] && pRec[category].attended > 0) pRec[category].attended--;
              }
              if (typeof filterAndRenderRankings === 'function') {
                filterAndRenderRankings();
              }
              if (typeof filterAndRenderPersonalStats === 'function') {
                filterAndRenderPersonalStats();
              }
            }
          }
        } catch (uiErr) {
          console.warn('[RealtimeUpdate] UI update warning:', uiErr);
        }

        // 4. 裏側で Google カレンダー同期を確実に実行 (ユーザーは待たせない)
        const calPayload = {
          eventId: eventId,
          originalDate: payload.originalDate || '',
          originalTitle: payload.originalTitle || '',
          status: status,
          userEmail: targetEmail,
          userName: targetName
        };

        try {
          fetch(GAS_ENDPOINT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              functionName: 'updateEventAttendance',
              args: [calPayload]
            })
          })
          .then(r => r.json())
          .then(res => {
            console.log('⚡ [CalendarSync] Google Calendar sync response:', res);
          })
          .catch(e => console.warn('[CalendarSync] Non-blocking calendar sync warning:', e));
        } catch (syncErr) {
          console.warn('[CalendarSync] Kick failed:', syncErr);
        }

        return { success: true };
      },

      /**
       * 試合結果・スコア記録の即時保存 (Supabase matches & score_logs, 非同期でGAS同期)
       */
      async saveScoreRecord(payload) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const matchId = payload.matchId || ('M' + Date.now());
        const dateStr = normalizeDateStr(payload.date);
        const logs = Array.isArray(payload.logs) ? payload.logs : [];

        // スコアと勝敗の再計算（安全策）
        let myScore = (payload.myScore !== undefined && payload.myScore !== null) ? Number(payload.myScore) : 0;
        let oppScore = (payload.oppScore !== undefined && payload.oppScore !== null) ? Number(payload.oppScore) : 0;
        if (payload.myScore === undefined || payload.oppScore === undefined) {
          myScore = 0;
          oppScore = 0;
          logs.forEach(l => {
            if (l.type === '得点') myScore++;
            else if (l.type === '相手得点' || l.type === '失点') oppScore++;
          });
        }

        let resultText = payload.result || '引き分け';
        if (!payload.result) {
          if (myScore > oppScore) resultText = '勝利';
          else if (myScore < oppScore) resultText = '敗北';
        }

        // 選手名から member_id を解決するためのマップ
        const nameToId = {};
        try {
          const cachedRoster = localStorage.getItem('fcb_cached_roster');
          if (cachedRoster) {
            const rList = JSON.parse(cachedRoster);
            if (Array.isArray(rList)) {
              rList.forEach(m => {
                if (m.name && m.id) nameToId[m.name.trim()] = m.id;
              });
            }
          }
        } catch (e) { }

        // MOM memberId の解決
        let momMemberId = payload.momMemberId || null;
        if (!momMemberId && payload.mom && payload.mom !== 'なし') {
          momMemberId = nameToId[payload.mom.trim()] || null;
        }

        // 1. matches テーブルの保存 (Supabase Direct: 0.1秒)
        const { error: matchErr } = await sb.from('matches').upsert({
          match_id: matchId,
          match_date: dateStr,
          category: payload.category || 'TRM',
          opponent: payload.opponent || '未設定',
          my_score: myScore,
          opp_score: oppScore,
          result: resultText,
          attended_players: payload.attended || '',
          location: payload.location || '',
          mom_member_id: momMemberId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'match_id'
        });

        if (matchErr) throw matchErr;

        // 2. score_logs の再登録 (既存ログ削除後の一括挿入)
        await sb.from('score_logs').delete().eq('match_id', matchId);

        if (logs.length > 0) {
          const insertLogs = logs.map((l, idx) => {
            let mId = l.memberId;
            if (!mId) {
              if (l.type === '相手得点' || l.type === '失点') {
                mId = 'MBR-SPECIAL-NONE';
              } else if (l.player === 'OG') {
                mId = 'MBR-SPECIAL-OG';
              } else if (l.player === '助っ人') {
                mId = 'MBR-SPECIAL-GUEST';
              } else if (l.player) {
                mId = nameToId[l.player.trim()] || 'MBR-SPECIAL-GUEST';
              } else {
                mId = 'MBR-SPECIAL-NONE';
              }
            }

            let aId = l.assistMemberId || null;
            if (!aId && l.assist && l.assist !== '-' && l.assist !== 'なし') {
              if (l.assist === '助っ人') {
                aId = 'MBR-SPECIAL-GUEST';
              } else {
                aId = nameToId[l.assist.trim()] || null;
              }
            }

            return {
              log_id: `L_${matchId}_${idx + 1}`,
              match_id: matchId,
              period: l.period || '',
              minute: Number(l.min || 0),
              log_type: (l.type === '失点') ? '相手得点' : l.type,
              member_id: mId,
              assist_member_id: aId
            };
          });

          const { error: logErr } = await sb.from('score_logs').insert(insertLogs);
          if (logErr) throw logErr;
        }

        console.log(`[Supabase] Score record saved: ${matchId} (${myScore} - ${oppScore})`);
        return "保存が完了しました！";
      },

      /**
       * 掲示板投稿の保存
       */
      async saveBulletinPost(payload) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const postId = payload.id || ('BUL-' + Date.now());
        const currentMemberId = (window.currentUser && window.currentUser.memberId) ? window.currentUser.memberId : (payload.authorId || null);

        const record = {
          post_id: postId,
          category: payload.category || '連絡',
          title: payload.title,
          content: payload.content || '',
          event_id: payload.eventId || null,
          event_title: payload.eventTitle || null,
          event_date: payload.eventDate || null,
          is_pinned: !!payload.isPinned,
          updated_at: new Date().toISOString()
        };

        if (!payload.id) {
          record.author_member_id = currentMemberId;
        } else {
          record.updated_by_member_id = currentMemberId;
        }

        const { data, error } = await sb.from('bulletin_posts').upsert(record);
        if (error) throw error;
        return { success: true, post: data };
      },

      /**
       * 掲示板ピン留め状態の更新 (0.1s Direct)
       */
      async togglePinBulletinPost(postId, isPinned) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');
        const { error } = await sb.from('bulletin_posts')
          .update({
            is_pinned: !!isPinned,
            updated_at: new Date().toISOString()
          })
          .eq('post_id', postId);
        if (error) throw error;
        return { success: true };
      },

      /**
       * 掲示板投稿の論理削除 (0.1s Direct)
       */
      async deleteBulletinPost(postId) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');
        const { error } = await sb.from('bulletin_posts')
          .update({
            is_deleted: true,
            updated_at: new Date().toISOString()
          })
          .eq('post_id', postId);
        if (error) throw error;
        return { success: true };
      },

      /**
       * 掲示板既読の登録 (0.1s Direct)
       */
      async markBulletinAsRead(postId, memberId, memberName) {
        const sb = getClient();
        if (!sb || !postId) return;

        let targetMemberId = memberId;
        // memberId が未解決または MBR- 形式でない場合は名簿キャッシュから自動解決
        if (!targetMemberId || !String(targetMemberId).startsWith('MBR-')) {
          const u = window.currentUser || {};
          targetMemberId = u.memberId || null;
          if (!targetMemberId && window.membersData && Array.isArray(window.membersData)) {
            const searchName = (memberName || u.name || '').trim();
            const searchEmail = (u.email || '').trim().toLowerCase();
            const hit = window.membersData.find(m => 
              (searchEmail && m.email && m.email.trim().toLowerCase() === searchEmail) ||
              (searchName && m.name && m.name.trim() === searchName)
            );
            if (hit && hit.memberId) targetMemberId = hit.memberId;
          }
        }
        if (!targetMemberId) {
          console.warn('[Supabase] markBulletinAsRead: メンバーIDを解決できませんでした。', memberId, memberName);
          return;
        }

        const readId = `READ_${postId}_${targetMemberId}`;
        const { error } = await sb.from('bulletin_reads').upsert({
          read_id: readId,
          post_id: postId,
          member_id: targetMemberId,
          read_at: new Date().toISOString()
        }, { onConflict: 'post_id,member_id' });
        if (error) {
          console.error('[Supabase] markBulletinAsRead error:', error);
        } else {
          console.log(`⚡ [Supabase] markBulletinAsRead saved: ${readId}`);
        }
      },

      /**
       * 掲示板コメントの投稿・保存 (0.1s Direct)
       */
      async addBulletinComment(postId, content, memberId, memberName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const commentId = 'CMT-' + Date.now();
        let authorId = memberId;
        if (!authorId || !String(authorId).startsWith('MBR-')) {
          const u = window.currentUser || {};
          authorId = u.memberId || null;
          if (!authorId && window.scheduleRoster) {
            const searchN = (memberName || u.name || '').trim();
            const hit = window.scheduleRoster.find(m => m.name && m.name.trim() === searchN);
            if (hit) authorId = hit.memberId || hit.id;
          }
        }

        const { error } = await sb.from('bulletin_comments').insert({
          comment_id: commentId,
          post_id: postId,
          author_member_id: authorId,
          content: content,
          created_at: new Date().toISOString(),
          is_deleted: false
        });

        if (error) throw error;
        return { success: true, commentId: commentId };
      },

      /**
       * 掲示板コメントの削除 (0.1s Direct)
       */
      async deleteBulletinComment(commentId, actorName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const { error } = await sb.from('bulletin_comments')
          .update({ is_deleted: true })
          .eq('comment_id', commentId);

        if (error) throw error;
        return { success: true };
      },

      /**
       * 掲示板コメント一覧の取得 (0.1s Direct)
       */
      async getBulletinComments(postId) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const [resComments, resMembers] = await Promise.all([
          sb.from('bulletin_comments').select('*').eq('post_id', postId).eq('is_deleted', false).order('created_at', { ascending: true }),
          sb.from('members').select('member_id, name, avatar_url')
        ]);

        if (resComments.error) throw resComments.error;

        const idToMember = {};
        (resMembers.data || []).forEach(m => {
          idToMember[m.member_id] = m;
        });

        const comments = (resComments.data || []).map(c => {
          const mem = idToMember[c.author_member_id];
          return {
            id: c.comment_id,
            postId: c.post_id,
            authorId: c.author_member_id,
            authorName: mem ? mem.name : '不明',
            authorAvatarUrl: mem ? (mem.avatar_url || '') : '',
            content: c.content,
            createdAt: c.created_at
          };
        });

        return { success: true, comments: comments };
      },

      /**
       * 掲示板既読者・未読者メンバー一覧の取得 (0.1s Direct)
       */
      async getBulletinPostReaders(postId) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const [resReads, resMembers] = await Promise.all([
          sb.from('bulletin_reads').select('*').eq('post_id', postId),
          sb.from('members').select('member_id, name, is_past, member_type')
        ]);

        if (resReads.error) throw resReads.error;

        const idToMember = {};
        const activeMembers = [];
        (resMembers.data || []).forEach(m => {
          idToMember[m.member_id] = m;
          const isSpecial = m.member_type === 'SPECIAL' || ['助っ人', 'OG', 'なし'].includes(m.name);
          if (!isSpecial && !m.is_past && m.member_type !== 'SUSPENDED') {
            activeMembers.push(m);
          }
        });

        const readers = [];
        const readMemberIds = new Set();
        (resReads.data || []).forEach(r => {
          if (!r.member_id) return;
          const m = idToMember[r.member_id];
          if (m && m.name) {
            readers.push({ memberId: r.member_id, memberName: m.name, readAt: r.read_at });
            readMemberIds.add(r.member_id);
          }
        });

        const unreadMembers = activeMembers
          .filter(m => !readMemberIds.has(m.member_id))
          .map(m => ({ memberId: m.member_id, memberName: m.name }));

        return { success: true, readers: readers, unreadMembers: unreadMembers };
      },

      /**
       * プロフィール写真削除 (0.1s Direct)
       */
      async deleteProfileImage(userName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const u = window.currentUser || {};
        const targetName = (userName || u.name || '').trim();
        const targetEmail = (u.email || '').trim().toLowerCase();

        let query = sb.from('members').update({ avatar_url: null, updated_at: new Date().toISOString() });
        if (targetEmail) {
          query = query.eq('email', targetEmail);
        } else if (targetName) {
          query = query.eq('name', targetName);
        } else {
          throw new Error('対象ユーザーを特定できません。');
        }

        const { error } = await query;
        if (error) throw error;
        return { success: true };
      },

      /**
       * 通知設定取得 (0.1s Direct)
       */
      async getNotificationSettings(userName, userEmail) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const u = window.currentUser || {};
        const memberId = (u.id || u.memberId || '').trim();
        const targetEmail = (userEmail || u.email || '').trim().toLowerCase();
        const targetName = (userName || u.name || '').trim();

        let query = sb.from('members').select('member_id, notification_type, line_user_id, push_subscription, notify_settings');
        if (memberId) {
          query = query.eq('member_id', memberId);
        } else if (targetEmail) {
          query = query.eq('email', targetEmail);
        } else if (targetName) {
          query = query.eq('name', targetName);
        } else {
          throw new Error('対象ユーザーを特定できません。');
        }

        const { data, error } = await query.limit(1);
        if (error) throw error;
        const row = (data && data[0]) || null;
        if (!row) throw new Error('メンバー情報が見つかりません。');

        let parsed = {};
        if (row.notify_settings) {
          try { parsed = JSON.parse(row.notify_settings); } catch (e) {}
        }

        const hasValidCode = !!(parsed.linkCode && Number(parsed.linkCodeExpiresAt || 0) > Date.now());
        return {
          success: true,
          settings: {
            notificationType: row.notification_type || 'none',
            lineLinked: !!(row.line_user_id && String(row.line_user_id).trim()),
            pushLinked: !!(row.push_subscription && String(row.push_subscription).trim()),
            linkCode: hasValidCode ? parsed.linkCode : '',
            linkCodeExpiresAt: hasValidCode ? Number(parsed.linkCodeExpiresAt) : 0,
            notifySettings: {
              emergency: parsed.emergency !== false,
              attendance: parsed.attendance !== false,
              bulletin: parsed.bulletin !== false
            }
          }
        };
      },

      /**
       * 通知設定保存 (0.1s Direct)
       */
      async saveNotificationSettings(payload, userName, userEmail) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const u = window.currentUser || {};
        const targetEmail = (userEmail || u.email || '').trim().toLowerCase();
        const targetName = (userName || u.name || '').trim();

        let existingParsed = {};
        try {
          const curRes = await this.getNotificationSettings(targetName, targetEmail);
          if (curRes && curRes.settings && curRes.settings.linkCode) {
            existingParsed.linkCode = curRes.settings.linkCode;
            existingParsed.linkCodeExpiresAt = curRes.settings.linkCodeExpiresAt;
          }
        } catch (e) {}

        const mergedSettings = {
          ...existingParsed,
          ...(payload.settings || payload.notifySettings || {})
        };

        const updateObj = {
          notification_type: payload.type || payload.notificationType || 'none',
          notify_settings: JSON.stringify(mergedSettings),
          updated_at: new Date().toISOString()
        };
        if (payload.lineUserId !== undefined) updateObj.line_user_id = payload.lineUserId;
        if (payload.pushSubscription !== undefined) updateObj.push_subscription = payload.pushSubscription;

        let query = sb.from('members').update(updateObj);
        if (targetEmail) {
          query = query.eq('email', targetEmail);
        } else if (targetName) {
          query = query.eq('name', targetName);
        } else {
          throw new Error('対象ユーザーを特定できません。');
        }

        const { error } = await query;
        if (error) throw error;
        return { success: true, message: '通知設定を保存しました' };
      },

      /**
       * Push購読情報のみを members.push_subscription に保存（既存設定を保持）
       */
      async savePushSubscription(subscriptionJson, userName, userEmail) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const u = window.currentUser || {};
        const memberId = (u.id || u.memberId || '').trim();
        const targetEmail = (userEmail || u.email || '').trim().toLowerCase();
        const targetName = (userName || u.name || '').trim();

        let query = sb.from('members').update({
          push_subscription: subscriptionJson || null,
          updated_at: new Date().toISOString()
        });

        if (memberId) {
          query = query.eq('member_id', memberId);
        } else if (targetEmail) {
          query = query.eq('email', targetEmail);
        } else if (targetName) {
          query = query.eq('name', targetName);
        } else {
          return { success: false, skipped: true, reason: 'ログイン中のメンバーを特定できません。' };
        }

        const { error } = await query;
        if (error) throw error;
        return { success: true };
      },

      /**
       * 備品保管者の引き継ぎ更新
       */
      async updateItemHolder(itemId, newMemberId) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const { data, error } = await sb.from('equipment_items').update({
          member_id: newMemberId,
          updated_at: new Date().toISOString()
        }).eq('item_id', itemId);

        if (error) throw error;
        return { success: true };
      },

      /**
       * 備品データの最新取得 (Supabase Direct: 0.1秒)
       */
      async getEquipmentData() {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const [resMembers, resMaster, resItems, resEqLogs] = await Promise.all([
          sb.from('members').select('member_id, name, number, avatar_url'),
          sb.from('equipment_master').select('*').order('sort_order', { ascending: true }),
          sb.from('equipment_items').select('*'),
          sb.from('equipment_event_logs').select('*')
        ]);

        const idToMember = {};
        (resMembers.data || []).forEach(m => {
          idToMember[m.member_id] = { name: m.name, number: m.number, avatarUrl: m.avatar_url };
        });

        const masterList = (resMaster.data || []).map(m => ({
          code: m.equipment_code,
          equipmentCode: m.equipment_code,
          name: m.name,
          ruleType: m.rule_type,
          reqTR: m.req_tr,
          reqTRM: m.req_trm,
          reqOfficial: m.req_official,
          notes: m.notes || '',
          sortOrder: m.sort_order
        }));

        const items = (resItems.data || []).map(it => {
          const hMem = idToMember[it.member_id];
          const mName = hMem ? hMem.name : (it.member_id ? '不明な部員' : '未割当');
          const mNum = hMem ? hMem.number : null;
          const mAvatar = hMem ? (hMem.avatarUrl || '') : '';
          return {
            id: it.item_id,
            itemId: it.item_id,
            code: it.equipment_code,
            itemCode: it.equipment_code,
            equipmentCode: it.equipment_code,
            name: it.item_name,
            holderId: it.member_id,
            memberId: it.member_id,
            holderName: mName,
            memberName: mName,
            holderNumber: mNum,
            memberNumber: mNum,
            memberAvatarUrl: mAvatar,
            status: it.status || '保管中',
            notes: it.notes || '',
            updatedAt: it.updated_at ? normalizeDateStr(it.updated_at) : ''
          };
        });

        return {
          success: true,
          masterList: masterList,
          itemsList: items,
          items: items,
          logs: resEqLogs.data || [],
          upcomingEquipment: [],
          isAdmin: true
        };
      },

      /**
       * 備品現物アイテム保存・保管者変更 (Supabase Direct: 0.1秒)
       */
      async saveEquipmentItem(payload, actorEmail, actorName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const itCode = String(payload.itemCode || '').trim();
        const mId = String(payload.memberId || '').trim();
        const notes = String(payload.notes || '').trim();
        let itemId = String(payload.itemId || '').trim();

        if (itemId) {
          // 既存更新
          const updateData = {
            member_id: mId || null,
            notes: notes,
            updated_at: new Date().toISOString()
          };
          if (itCode) updateData.equipment_code = itCode;

          const { error } = await sb.from('equipment_items').update(updateData).eq('item_id', itemId);
          if (error) throw error;
        } else {
          // 新規追加 (EQ-XXX の自動連番採番)
          const { data: allItems, error: fetchErr } = await sb.from('equipment_items').select('item_id');
          if (fetchErr) throw fetchErr;

          let maxNum = 0;
          (allItems || []).forEach(it => {
            const m = String(it.item_id || '').match(/^EQ-(\d+)$/i);
            if (m) {
              const n = parseInt(m[1], 10);
              if (n > maxNum) maxNum = n;
            }
          });
          itemId = 'EQ-' + ('000' + (maxNum + 1)).slice(-3);

          // equipment_master から item_name を取得
          let itemName = '備品';
          if (itCode) {
            const { data: mRows } = await sb.from('equipment_master').select('name').eq('equipment_code', itCode).limit(1);
            if (mRows && mRows.length > 0) itemName = mRows[0].name;
          }

          const insertData = {
            item_id: itemId,
            equipment_code: itCode,
            item_name: itemName,
            member_id: mId || null,
            status: '保管中',
            notes: notes,
            updated_at: new Date().toISOString()
          };
          const { error: insErr } = await sb.from('equipment_items').insert(insertData);
          if (insErr) throw insErr;
        }

        const now = new Date();
        const updatedAtStr = `${now.getFullYear()}/${('0' + (now.getMonth() + 1)).slice(-2)}/${('0' + now.getDate()).slice(-2)} ${('0' + now.getHours()).slice(-2)}:${('0' + now.getMinutes()).slice(-2)}`;

        return {
          success: true,
          message: '備品情報を保存しました。',
          itemId: itemId,
          itemCode: itCode,
          memberId: mId,
          notes: notes,
          updatedAt: updatedAtStr
        };
      },

      /**
       * 備品現物アイテム削除 (Supabase Direct: 0.1秒)
       */
      async deleteEquipmentItem(itemId, actorEmail, actorName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const cleanId = String(itemId || '').trim();
        if (!cleanId) throw new Error('削除対象の備品IDが指定されていません。');

        const { error } = await sb.from('equipment_items').delete().eq('item_id', cleanId);
        if (error) throw error;

        return { success: true, message: '備品を削除しました。' };
      },

      /**
       * 不在アラート解決 (Supabase Direct: 0.1秒)
       */
      async resolveEquipmentAlert(payload, actorEmail, actorName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const evId = String(payload.eventId || '').trim();
        let evDate = String(payload.eventDate || '').replace(/-/g, '/').trim();
        const match = evDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (match) {
          evDate = `${match[1]}/${('0' + match[2]).slice(-2)}/${('0' + match[3]).slice(-2)}`;
        }
        const itCode = String(payload.itemCode || '').trim();
        const mId = String(payload.proxyMemberId || '代理').trim() || '代理';

        if (!itCode) {
          return { success: false, error: 'イベント・品目情報が不足しています。' };
        }

        // item_id を検索（itemCode から取得）
        let targetItemId = null;
        if (itCode) {
          const { data: itRows } = await sb.from('equipment_items').select('item_id').eq('equipment_code', itCode).limit(1);
          if (itRows && itRows.length > 0) targetItemId = itRows[0].item_id;
        }

        const logId = `EQL_${Date.now()}`;
        const logData = {
          log_id: logId,
          event_id: evId,
          event_date: evDate,
          item_id: targetItemId,
          assigned_member_id: mId,
          status: '割当済',
          created_at: new Date().toISOString()
        };

        const { error } = await sb.from('equipment_event_logs').upsert(logData);
        if (error) throw error;

        return { success: true, message: '持参担当の解決を記録しました。' };
      },

      /**
       * 管理者用メンバー一覧の取得 (Supabase Direct: 0.1秒)
       */
      async getAdminMemberList() {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const { data: rawMembers, error } = await sb.from('members').select('*').order('member_id');
        if (error) throw error;

        const adminRoster = (rawMembers || []).filter(m => {
          const isSpecial = (m.member_type === 'SPECIAL' || ['MBR-SPECIAL-GUEST', 'MBR-SPECIAL-OG', 'MBR-SPECIAL-NONE'].includes(m.member_id) || ['助っ人', 'OG', 'なし'].includes(m.name));
          return !isSpecial;
        }).map(m => {
          const numVal = (m.number !== null && m.number !== '' && !isNaN(m.number)) ? Number(m.number) : null;
          const isPast = !!m.is_past || m.member_type === 'PAST';
          const isSuspended = !isPast && (!!m.is_suspended || m.member_type === 'SUSPENDED');
          return {
            memberId: m.member_id,
            id: m.member_id,
            name: m.name,
            number: numVal !== null ? numVal : 999,
            role: m.role || 'メンバー',
            position: m.position || 'FP',
            email: m.email || '',
            phone: m.phone || '',
            birthday: m.birthday || '',
            avatarUrl: m.avatar_url || '',
            hasCalendarLink: !!m.token,
            hasToken: !!m.token,
            notificationType: m.notification_type || 'none',
            isPast: isPast,
            isSuspended: isSuspended,
            memberType: isPast ? 'PAST' : 'REGULAR'
          };
        });

        try { localStorage.setItem('fcb_cached_admin_roster', JSON.stringify(adminRoster)); } catch(e) {}
        return {
          success: true,
          roster: adminRoster
        };
      },

      /**
       * メンバー新規登録・編集 (Supabase Direct: 0.1秒, 非同期GAS同期)
       */
      async saveMember(payload, actorEmail, actorName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const isNew = !!payload.isNew;
        const targetName = String(payload.name || '').trim();
        const origName = String(payload.originalName || '').trim();
        const role = payload.role || 'メンバー';
        const position = payload.position || 'FP';
        const numberVal = (payload.number !== '' && payload.number !== null && !isNaN(payload.number)) ? Number(payload.number) : null;
        const birthday = payload.birthday || null;
        const phone = payload.phone || null;
        const email = payload.email ? String(payload.email).trim().toLowerCase() : null;
        const isPast = !!payload.isPast;
        const isSuspended = !isPast && !!payload.isSuspended;
        const memberType = isPast ? 'PAST' : 'REGULAR';

        let memberId = payload.memberId || null;

        if (isNew) {
          // 新規メンバーID自動採番 (既存最大番号を走査)
          const { data: allMems } = await sb.from('members').select('member_id');
          let maxNum = 0;
          (allMems || []).forEach(m => {
            const match = String(m.member_id || '').match(/^MBR-(\d+)$/);
            if (match) {
              const n = parseInt(match[1], 10);
              if (n > maxNum && n < 900) maxNum = n;
            }
          });
          memberId = 'MBR-' + String(maxNum + 1).padStart(3, '0');

          const { error: insErr } = await sb.from('members').insert({
            member_id: memberId,
            name: targetName,
            number: numberVal !== null ? String(numberVal) : null,
            role: role,
            position: position,
            birthday: birthday,
            phone: phone,
            email: email,
            member_type: memberType,
            is_past: isPast,
            is_suspended: isSuspended,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          if (insErr) throw insErr;
          console.log(`⚡ [Supabase] New member created: ${memberId} (${targetName}) [suspended: ${isSuspended}]`);
        } else {
          // 既存メンバー更新
          if (!memberId) {
            const { data: foundMem } = await sb.from('members').select('member_id').eq('name', origName || targetName).limit(1);
            if (foundMem && foundMem.length > 0) {
              memberId = foundMem[0].member_id;
            }
          }

          const updateRecord = {
            name: targetName,
            number: numberVal !== null ? String(numberVal) : null,
            role: role,
            position: position,
            birthday: birthday,
            phone: phone,
            email: email,
            member_type: memberType,
            is_past: isPast,
            is_suspended: isSuspended,
            updated_at: new Date().toISOString()
          };

          if (memberId) {
            const { error: updErr } = await sb.from('members').update(updateRecord).eq('member_id', memberId);
            if (updErr) throw updErr;
            console.log(`⚡ [Supabase] Member updated: ${memberId} (${targetName}) [suspended: ${isSuspended}]`);
          } else {
            const { error: updErr2 } = await sb.from('members').update(updateRecord).eq('name', origName || targetName);
            if (updErr2) throw updErr2;
            console.log(`⚡ [Supabase] Member updated by name: ${origName || targetName} [suspended: ${isSuspended}]`);
          }
        }

        // 最新の管理者名簿を取得して即返却
        const latestRosterRes = await this.getAdminMemberList();
        return {
          success: true,
          message: isNew ? 'メンバーを追加しました。' : 'メンバー情報を更新しました。',
          roster: latestRosterRes.roster,
          emailChanged: payload.emailChanged,
          savedName: targetName,
          savedEmail: email
        };
      },

      /**
       * メンバー削除 (OB・退団化) (Supabase Direct: 0.1秒)
       */
      async deleteMember(target, actorEmail, actorName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const targetName = String(target.name || '').trim();
        const targetEmail = String(target.email || '').trim().toLowerCase();
        let targetId = target.memberId || target.id || null;

        // member_id を特定して is_past = true, member_type = 'PAST', is_suspended = false に更新
        if (targetId) {
          const { error } = await sb.from('members').update({
            is_past: true,
            member_type: 'PAST',
            is_suspended: false,
            updated_at: new Date().toISOString()
          }).eq('member_id', targetId);
          if (error) throw error;
        } else {
          const { error } = await sb.from('members').update({
            is_past: true,
            member_type: 'PAST',
            is_suspended: false,
            updated_at: new Date().toISOString()
          }).eq('name', targetName);
          if (error) throw error;
        }

        console.log(`⚡ [Supabase] Member marked as PAST/OB: ${targetName}`);

        // 最新の管理者名簿を取得して返却
        const latestRosterRes = await this.getAdminMemberList();
        return {
          success: true,
          message: `${targetName} 選手をOBへ移動しました。`,
          roster: latestRosterRes.roster
        };
      },

      /**
       * メンバー完全データ削除 (個人情報・連絡先等の完全消去) (Supabase Direct: 0.1秒)
       * ※活動記録（試合・得点・MOM等）は外部結合で維持され、選手名は「不明」としてフォールバック表示
       */
      async deleteMemberPermanently(target, actorEmail, actorName) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const targetName = String(target.name || '').trim();
        const targetEmail = String(target.email || '').trim().toLowerCase();
        let targetId = target.memberId || target.id || null;

        if (!targetId && targetName) {
          const { data: mRows } = await sb.from('members').select('member_id').eq('name', targetName).limit(1);
          if (mRows && mRows.length > 0) targetId = mRows[0].member_id;
        }

        // 所持している備品がある場合、所持者を「未割当(NULL)」に安全リセット
        if (targetId) {
          try {
            await sb.from('equipment_items').update({ member_id: null }).eq('member_id', targetId);
          } catch (e) {
            console.warn('[deleteMemberPermanently] equipment unassign error:', e);
          }
        }

        // members テーブルから完全削除 (個人情報・電話番号・メールアドレス等の完全消去)
        // ※ score_logs, matches は ON DELETE SET NULL により得点記録・試合結果は消えずに保持されます
        if (targetId) {
          const { error } = await sb.from('members').delete().eq('member_id', targetId);
          if (error) throw error;
        } else if (targetEmail) {
          const { error } = await sb.from('members').delete().eq('email', targetEmail);
          if (error) throw error;
        } else {
          const { error } = await sb.from('members').delete().eq('name', targetName);
          if (error) throw error;
        }

        const latestRosterRes = await this.getAdminMemberList();
        return {
          success: true,
          message: `${targetName} 選手を完全に削除しました。`,
          roster: latestRosterRes.roster
        };
      },

      /**
       * ログイン画面用の部員リスト取得 (Supabase Direct: 0.1秒)
       * @returns {Promise<Array>}
       */
      async getMemberListForLogin() {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const { data, error } = await sb
          .from('members')
          .select('number, name, email, role, position, token, is_past')
          .eq('is_past', false)
          .order('number', { ascending: true, nullsFirst: false });

        if (error) throw error;

        return (data || []).map(m => ({
          number: m.number ? Number(m.number) : 999,
          name: m.name,
          email: m.email || '',
          role: m.role || 'メンバー',
          position: m.position || 'FP',
          hasCalendarLink: !!m.token
        }));
      },

      /**
       * ログイン認証処理 (Supabase Direct: 0.1秒)
       * @param {string} identifier メールアドレスまたは選手名
       * @param {string} password パスワード
       * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
       */
      async loginUser(identifier, password) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const cleanId = String(identifier || '').trim().toLowerCase();
        const cleanIdNoSpace = cleanId.replace(/[\s\u3000]+/g, '').replace(/^#\d+/, '');
        const inputPw = String(password || '').trim();

        if (!cleanId || !inputPw) {
          return { success: false, error: 'メールアドレスまたは選手名、およびパスワードを入力してください。' };
        }

        // members テーブルから全部員を取得（高々数十名、インメモリで確実かつ柔軟に照合）
        const { data: members, error } = await sb
          .from('members')
          .select('*')
          .eq('is_past', false);

        if (error) throw error;

        let member = null;
        if (members && members.length > 0) {
          member = members.find(m => {
            const mEmail = String(m.email || '').trim().toLowerCase();
            const mNameClean = String(m.name || '').replace(/[\s\u3000]+/g, '').toLowerCase().replace(/^#\d+/, '');
            if (cleanId.includes('@')) {
              return mEmail === cleanId;
            }
            return mNameClean === cleanIdNoSpace || (mEmail && mEmail === cleanId);
          });
        }

        if (!member) {
          return { success: false, error: 'メールアドレスまたはパスワードが正しくありません。' };
        }

        // パスワード照合
        const hashedInput = await (async function(str) {
          try {
            const buf = new TextEncoder().encode(str);
            const hash = await crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
          } catch (e) {
            return str;
          }
        })(inputPw);

        const dbHash = String(member.password_hash || '').trim();
        let isMatch = false;

        if (dbHash) {
          // 平文照合または SHA-256 ハッシュ照合
          if (dbHash === inputPw || dbHash.toLowerCase() === hashedInput.toLowerCase()) {
            isMatch = true;
          }
        } else {
          // Supabase に password_hash が未設定の場合（初期移行時）:
          // GAS の apiLoginUser に照合をフォールバックし、成功したら Supabase へ自動同期
          try {
            const gasRes = await fetch(GAS_ENDPOINT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ functionName: 'apiLoginUser', args: [cleanId, inputPw] })
            }).then(r => r.json());

            if (gasRes && gasRes.success && gasRes.data && gasRes.data.success) {
              isMatch = true;
              // 次回から 0.1s Direct ログインできるようパスワードを Supabase に自動保存
              try {
                await sb.from('members').update({ password_hash: inputPw }).eq('member_id', member.member_id);
                console.log('⚡ [AuthMigration] Successfully migrated password to Supabase Direct for', member.name);
              } catch (migErr) {
                console.warn('[AuthMigration] Password save warning:', migErr);
              }
            }
          } catch (gasErr) {
            console.warn('[apiLoginUser] GAS fallback error:', gasErr);
          }
        }

        if (!isMatch) {
          return { success: false, error: 'メールアドレスまたはパスワードが正しくありません。' };
        }

        const user = {
          name: member.name,
          number: member.number ? Number(member.number) : 999,
          email: member.email || '',
          role: member.role || 'メンバー',
          position: member.position || 'FP',
          avatarUrl: member.avatar_url || '',
          hasCalendarLink: !!member.token
        };

        return {
          success: true,
          user: user
        };
      },

      /**
       * パスワード変更処理 (Supabase Direct: 0.1秒)
       * @param {string} identifier メールアドレスまたは選手名
       * @param {string} oldPassword 現在のパスワード
       * @param {string} newPassword 新しいパスワード
       * @returns {Promise<{success: boolean, message?: string, error?: string}>}
       */
      async changePassword(identifier, oldPassword, newPassword) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const cleanId = String(identifier || '').trim().toLowerCase();
        const cleanIdNoSpace = cleanId.replace(/[\s\u3000]+/g, '').replace(/^#\d+/, '');
        const inputOldPw = String(oldPassword || '').trim();
        const inputNewPw = String(newPassword || '').trim();

        if (!inputNewPw || inputNewPw.length < 4) {
          return { success: false, error: '新しいパスワードは4文字以上で設定してください。' };
        }

        const { data: members, error } = await sb
          .from('members')
          .select('*')
          .eq('is_past', false);

        if (error) throw error;

        let member = null;
        if (members && members.length > 0) {
          member = members.find(m => {
            const mEmail = String(m.email || '').trim().toLowerCase();
            const mNameClean = String(m.name || '').replace(/[\s\u3000]+/g, '').toLowerCase().replace(/^#\d+/, '');
            if (cleanId.includes('@')) {
              return mEmail === cleanId;
            }
            return mNameClean === cleanIdNoSpace || (mEmail && mEmail === cleanId);
          });
        }

        if (!member) {
          return { success: false, error: '部員情報が見つかりませんでした。' };
        }

        // 現在のパスワード照合
        const hashedOld = await (async function(str) {
          try {
            const buf = new TextEncoder().encode(str);
            const hash = await crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
          } catch (e) {
            return str;
          }
        })(inputOldPw);

        const dbHash = String(member.password_hash || '').trim();
        let isOldPwValid = false;

        if (dbHash) {
          if (dbHash === inputOldPw || dbHash.toLowerCase() === hashedOld.toLowerCase()) {
            isOldPwValid = true;
          }
        } else {
          try {
            const gasRes = await fetch(GAS_ENDPOINT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ functionName: 'apiLoginUser', args: [cleanId, inputOldPw] })
            }).then(r => r.json());
            if (gasRes && gasRes.success && gasRes.data && gasRes.data.success) {
              isOldPwValid = true;
            }
          } catch (e) {}
        }

        if (!isOldPwValid) {
          return { success: false, error: '現在のパスワードが正しくありません。' };
        }

        // Supabase members.password_hash を直接更新 (0.1秒)
        const { error: updateErr } = await sb
          .from('members')
          .update({
            password_hash: inputNewPw,
            updated_at: new Date().toISOString()
          })
          .eq('member_id', member.member_id);

        if (updateErr) throw updateErr;

        return {
          success: true,
          message: 'パスワードを更新しました。'
        };
      },

      /**
       * 初回登録・新規パスワード設定処理 (Supabase Direct: 0.1秒)
       * @param {string} email メールアドレス
       * @param {string} newPassword 新しいパスワード
       * @returns {Promise<{success: boolean, user?: Object, message?: string, error?: string}>}
       */
      async registerMember(email, newPassword) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const cleanEmail = String(email || '').trim().toLowerCase();
        const inputPw = String(newPassword || '').trim();

        if (!cleanEmail) {
          return { success: false, error: 'メールアドレスを入力してください。' };
        }
        if (!inputPw || inputPw.length < 4) {
          return { success: false, error: 'パスワードは4文字以上で設定してください。' };
        }

        const { data: members, error } = await sb
          .from('members')
          .select('*')
          .eq('email', cleanEmail)
          .limit(1);

        if (error) throw error;
        if (!members || members.length === 0) {
          return {
            success: false,
            error: '指定されたメールアドレスの部員が見つかりません。名簿に登録されているGmailアドレスを入力してください。'
          };
        }

        const member = members[0];

        // Supabase members.password_hash を直接更新 (0.1秒)
        const { error: updateErr } = await sb
          .from('members')
          .update({
            password_hash: inputPw,
            updated_at: new Date().toISOString()
          })
          .eq('member_id', member.member_id);

        if (updateErr) throw updateErr;

        const user = {
          name: member.name,
          number: member.number ? Number(member.number) : 999,
          email: member.email,
          role: member.role || 'メンバー',
          position: member.position || 'FP',
          avatarUrl: member.avatar_url || '',
          hasCalendarLink: !!member.token
        };

        return {
          success: true,
          user: user,
          message: 'パスワード設定が完了しました。'
        };
      },

      /**
       * Google OAuth連携前のメールアドレス名簿存在チェック（Supabase Direct）
       * @param {string} email 入力されたGmailアドレス
       * @returns {Promise<{success: boolean, registered: boolean, email?: string, name?: string, hasPassword?: boolean, error?: string}>}
       */
      async checkMemberEmailForOAuth(email) {
        const sb = getClient();
        if (!sb) throw new Error('Supabase クライアントが利用できません。');

        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
          return {
            success: false,
            registered: false,
            error: '有効なGmailアドレスを入力してください。'
          };
        }

        const { data: members, error } = await sb
          .from('members')
          .select('member_id, name, email, password_hash, is_past')
          .eq('is_past', false);

        if (error) throw error;

        const hit = (members || []).find(m => String(m.email || '').trim().toLowerCase() === cleanEmail);
        if (!hit) {
          return {
            success: false,
            registered: false,
            error: '入力されたメールアドレスは名簿に登録されていません。管理者にメールアドレスの登録を依頼してください。'
          };
        }

        return {
          success: true,
          registered: true,
          email: String(hit.email || cleanEmail).trim(),
          name: hit.name || '',
          hasPassword: Boolean(hit.password_hash)
        };
      }
    };

    window.SupabaseService = SupabaseService;

    // =========================================
    // 4. google.script.run の透過的バイパスプロキシ
    // =========================================
    // 既存のフロントエンド呼び出しコードを変更することなく、
    // Supabase で即時実行できる関数を自動的にバイパスして爆速化 (0.3秒)
    // =========================================
    function createSupabaseBypassProxy(successHandler, failureHandler, userObject) {
      return new Proxy({}, {
        get: function (target, prop) {
          if (prop === 'withSuccessHandler') {
            return function (h) { return createSupabaseBypassProxy(h, failureHandler, userObject); };
          }
          if (prop === 'withFailureHandler') {
            return function (h) { return createSupabaseBypassProxy(successHandler, h, userObject); };
          }
          if (prop === 'withUserObject') {
            return function (u) { return createSupabaseBypassProxy(successHandler, failureHandler, u); };
          }

          return function (...args) {
            // Supabase 直接処理へのルーティング
            if (prop === 'getInitialData') {
              console.log('⚡ [Bypass] getInitialData routed to Supabase Direct REST API (0.3s)');
              SupabaseService.getInitialData(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'updateEventAttendance') {
              console.log('⚡ [Bypass] updateEventAttendance routed to Supabase Direct UPSERT (0.1s)');
              SupabaseService.updateEventAttendance(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'saveMatchData' || prop === 'saveScoreRecord') {
              console.log('⚡ [Bypass] saveMatchData routed to Supabase Direct (0.2s)');
              SupabaseService.saveScoreRecord(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiSaveBulletinPost') {
              console.log('⚡ [Bypass] apiSaveBulletinPost routed to Supabase Direct (0.1s)');
              SupabaseService.saveBulletinPost(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiTogglePinBulletinPost') {
              console.log('⚡ [Bypass] apiTogglePinBulletinPost routed to Supabase Direct (0.1s)');
              SupabaseService.togglePinBulletinPost(args[0], args[1])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiDeleteBulletinPost') {
              console.log('⚡ [Bypass] apiDeleteBulletinPost routed to Supabase Direct (0.1s)');
              SupabaseService.deleteBulletinPost(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiMarkAsRead' || prop === 'apiMarkBulletinPostRead') {
              console.log('⚡ [Bypass] markBulletinAsRead routed to Supabase Direct (0.1s)');
              SupabaseService.markBulletinAsRead(args[0], args[1], args[2]);
              if (typeof successHandler === 'function') successHandler({ success: true }, userObject);
              return;
            }

            if (prop === 'apiAddBulletinComment' || prop === 'apiSaveComment') {
              console.log('⚡ [Bypass] apiAddBulletinComment routed to Supabase Direct (0.1s)');
              const pId = args[0] && typeof args[0] === 'object' ? args[0].postId : args[0];
              const cContent = args[0] && typeof args[0] === 'object' ? args[0].content : args[1];
              const mId = args[0] && typeof args[0] === 'object' ? args[0].authorId : args[2];
              const mName = args[3];
              SupabaseService.addBulletinComment(pId, cContent, mId, mName)
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiDeleteBulletinComment') {
              console.log('⚡ [Bypass] apiDeleteBulletinComment routed to Supabase Direct (0.1s)');
              SupabaseService.deleteBulletinComment(args[0], args[1])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiGetBulletinComments') {
              console.log('⚡ [Bypass] apiGetBulletinComments routed to Supabase Direct (0.1s)');
              SupabaseService.getBulletinComments(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiGetBulletinPostReaders') {
              console.log('⚡ [Bypass] apiGetBulletinPostReaders routed to Supabase Direct (0.1s)');
              SupabaseService.getBulletinPostReaders(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiDeleteProfileImage') {
              console.log('⚡ [Bypass] apiDeleteProfileImage routed to Supabase Direct (0.1s)');
              SupabaseService.deleteProfileImage(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiGetNotificationSettings') {
              console.log('⚡ [Bypass] apiGetNotificationSettings routed to Supabase Direct (0.1s)');
              SupabaseService.getNotificationSettings(args[0], args[1])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiSaveNotificationSettings') {
              console.log('⚡ [Bypass] apiSaveNotificationSettings routed to Supabase Direct (0.1s)');
              SupabaseService.saveNotificationSettings(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'updateItemHolder') {
              SupabaseService.updateItemHolder(args[0], args[1])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiGetEquipmentData') {
              console.log('⚡ [Bypass] apiGetEquipmentData routed to Supabase Direct (0.1s)');
              SupabaseService.getEquipmentData()
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiSaveEquipmentItem') {
              console.log('⚡ [Bypass] apiSaveEquipmentItem routed to Supabase Direct (0.1s)');
              SupabaseService.saveEquipmentItem(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiDeleteEquipmentItem') {
              console.log('⚡ [Bypass] apiDeleteEquipmentItem routed to Supabase Direct (0.1s)');
              SupabaseService.deleteEquipmentItem(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiResolveEquipmentAlert') {
              console.log('⚡ [Bypass] apiResolveEquipmentAlert routed to Supabase Direct (0.1s)');
              SupabaseService.resolveEquipmentAlert(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiGetMemberListForAdmin') {
              console.log('⚡ [Bypass] apiGetMemberListForAdmin routed to Supabase Direct (0.1s)');
              SupabaseService.getAdminMemberList()
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiSaveMember') {
              console.log('⚡ [Bypass] apiSaveMember routed to Supabase Direct (0.1s)');
              SupabaseService.saveMember(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiDeleteMember') {
              console.log('⚡ [Bypass] apiDeleteMember routed to Supabase Direct (0.1s)');
              SupabaseService.deleteMember(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiDeleteMemberPermanently') {
              console.log('⚡ [Bypass] apiDeleteMemberPermanently routed to Supabase Direct (0.1s)');
              SupabaseService.deleteMemberPermanently(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiLoginUser') {
              console.log('⚡ [Bypass] apiLoginUser routed to Supabase Direct (0.1s)');
              SupabaseService.loginUser(args[0], args[1])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiChangePassword') {
              console.log('⚡ [Bypass] apiChangePassword routed to Supabase Direct (0.1s)');
              SupabaseService.changePassword(args[0], args[1], args[2])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiRegisterMember') {
              console.log('⚡ [Bypass] apiRegisterMember routed to Supabase Direct (0.1s)');
              SupabaseService.registerMember(args[0], args[1])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiGetMemberListForLogin') {
              console.log('⚡ [Bypass] apiGetMemberListForLogin routed to Supabase Direct (0.1s)');
              SupabaseService.getMemberListForLogin()
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            if (prop === 'apiCheckMemberEmailForOAuth') {
              console.log('⚡ [Bypass] apiCheckMemberEmailForOAuth routed to Supabase Direct (0.1s)');
              SupabaseService.checkMemberEmailForOAuth(args[0])
                .then(res => { if (typeof successHandler === 'function') successHandler(res, userObject); })
                .catch(err => { if (typeof failureHandler === 'function') failureHandler(err, userObject); });
              return;
            }

            // その他の関数は従来通り GAS へのフォールバック通信
            fetch(GAS_ENDPOINT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ functionName: prop, args: args })
            })
              .then(res => res.json())
              .then(result => {
                if (result && result.success) {
                  if (typeof successHandler === 'function') successHandler(result.data, userObject);
                } else {
                  const err = new Error(result && result.error ? result.error : 'エラーが発生しました。');
                  if (typeof failureHandler === 'function') failureHandler(err, userObject);
                }
              })
              .catch(err => {
                if (typeof failureHandler === 'function') failureHandler(err, userObject);
              });
          };
        }
      });
    }

    // 既存の google.script.run を Supabase バイパスプロキシでオーバーライド
    window.google = window.google || {};
    window.google.script = window.google.script || {};
    window.google.script.run = createSupabaseBypassProxy(null, null, null);

    // =========================================
    // 5. 画面復帰検知 (Page Visibility API & window.focus)
    // =========================================
    // スマホのアプリ切り替えやPCの別タブ・ウィンドウからの復帰時に
    // Googleカレンダー側の最新出欠をフェッチし、Supabaseとアプリ画面へ即時反映
    // =========================================
    let isResuming = false;
    let lastResumeTime = 0;

    async function refreshOnResume() {
      const now = Date.now();
      if (isResuming || (now - lastResumeTime < 3000)) return;
      isResuming = true;
      lastResumeTime = now;

      try {
        console.log('⚡ [Resume] Screen resumed. Syncing latest Google Calendar & Supabase attendance...');
        const sb = getClient();
        if (!sb) return;

        // 1. Google カレンダーの最新イベントを取得
        const resGCal = await fetch(`${GAS_ENDPOINT_URL}?action=getEvents`).then(r => r.json()).catch(() => null);
        const rawEvents = (resGCal && resGCal.success && Array.isArray(resGCal.events)) ? resGCal.events : null;

        // 2. Supabase の出欠テーブルから最新レコードを取得
        const { data: rawAttendance } = await sb.from('attendance').select('*');

        if (rawEvents) {
          try { localStorage.setItem('fcb_cached_events', JSON.stringify(rawEvents)); } catch (e) { }

          const myEmail = window.currentUser ? String(window.currentUser.email || '').toLowerCase().trim() : '';
          const myName = window.currentUser ? String(window.currentUser.name || '').trim() : '';
          const myId = window.currentUser ? (window.currentUser.memberId || window.currentUser.id || '') : '';

          const attendanceByEvent = {};
          (rawAttendance || []).forEach(att => {
            const eid = String(att.event_id || '').trim();
            if (!attendanceByEvent[eid]) attendanceByEvent[eid] = [];
            attendanceByEvent[eid].push(att);
          });

          // カレンダー側で変更された全メンバーの最新ステータスを Supabase に自動一括同期
          const emailToMember = {};
          try {
            const cachedRoster = localStorage.getItem('fcb_cached_roster');
            if (cachedRoster) {
              const rList = JSON.parse(cachedRoster);
              (rList || []).forEach(m => {
                if (m.email && m.id) emailToMember[String(m.email).trim().toLowerCase()] = m;
              });
            }
          } catch (e) { }

          const upsertBatch = [];
          for (const ev of rawEvents) {
            const cleanEvId = String(ev.id || '').split('@')[0];
            const detail = ev.attendeesDetail || {};
            const eventAtts = attendanceByEvent[cleanEvId] || attendanceByEvent[ev.id] || [];

            const processList = (emails, status) => {
              (emails || []).forEach(em => {
                const cleanEm = String(em).toLowerCase().trim();
                const mem = emailToMember[cleanEm];
                if (!mem) return;
                const mId = mem.id || mem.memberId;
                if (!mId) return;

                const existing = eventAtts.find(a => a.member_id === mId);
                if (!existing || existing.status !== status) {
                  upsertBatch.push({
                    event_id: cleanEvId,
                    member_id: mId,
                    event_date: ev.date || null,
                    event_title: ev.title || null,
                    category: ev.category || 'その他',
                    status: status,
                    updated_at: new Date().toISOString()
                  });
                }
              });
            };

            processList(detail.yesEmails, 'yes');
            processList(detail.noEmails, 'no');
            processList(detail.maybeEmails, 'maybe');
          }

          if (upsertBatch.length > 0) {
            console.log(`⚡ [Resume] Syncing ${upsertBatch.length} calendar attendance changes to Supabase...`);
            await sb.from('attendance').upsert(upsertBatch, { onConflict: 'event_id,member_id' });
          }

          // 最新イベントをアプリのメモリに適用
          window.eventsData = rawEvents;

          // 画面の即時再描画
          if (typeof renderCalendar === 'function') {
            renderCalendar(window.calYear || new Date().getFullYear(), (window.calMonth !== undefined) ? window.calMonth : new Date().getMonth());
          }
          if (typeof renderAgendaList === 'function') {
            renderAgendaList();
          }
          if (typeof updateUnansweredBadges === 'function') {
            updateUnansweredBadges();
          }
        }
      } catch (e) {
        console.warn('[Resume] Quick check error:', e);
      } finally {
        isResuming = false;
      }
    }

    window.refreshOnResume = refreshOnResume;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshOnResume();
      }
    });

    window.addEventListener('focus', () => {
      refreshOnResume();
    });

    // =========================================
    // 6. Web Push ヘルパー (PWA Push購読 & Supabase Edge Function呼び出し)
    // =========================================
    const VAPID_PUBLIC_KEY = 'BNjJdZwtSl-l4FKvrTXeTc5TGv_ceWN_WP56KX3pb_hGJUOzm0SN1rYSifIurMZFueJngr0KKJbHQPWdROn4ews';

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    function uint8ArraysEqual(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    function getEnvironmentStatus() {
      const notificationSupported = typeof Notification !== 'undefined';
      const swSupported = 'serviceWorker' in navigator;
      const pushSupported = 'PushManager' in window;
      const permission = notificationSupported ? Notification.permission : 'unsupported';
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true;

      return {
        supported: notificationSupported && swSupported && pushSupported,
        notificationSupported,
        swSupported,
        pushSupported,
        permission,
        isIOS,
        isStandalone,
        needsIOSHomeScreen: isIOS && !isStandalone
      };
    }

    async function ensureServiceWorkerRegistration() {
      if (!('serviceWorker' in navigator)) {
        throw new Error('このブラウザは Service Worker に対応していません。');
      }
      let reg = await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.getRegistration();
      if (!reg) {
        try {
          reg = await navigator.serviceWorker.register('./sw.js');
        } catch (e) {
          throw new Error('Service Worker (sw.js) が見つかりません。PWA配信URL（GitHub Pages等）からアクセスしてください。');
        }
      }
      if (reg && reg.active) {
        return reg;
      }
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service Worker の起動がタイムアウトしました。ページを再読み込みしてください。')), 5000);
      });
      return await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);
    }

    async function getSubscription() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
      const reg = await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.getRegistration();
      if (!reg || !reg.pushManager) return null;
      return await reg.pushManager.getSubscription();
    }

    async function subscribeAndSave(user) {
      const env = getEnvironmentStatus();
      if (env.needsIOSHomeScreen) {
        throw new Error('iPhone/iPadでは、Safariの共有メニューから「ホーム画面に追加」したPWAから起動すると通知を有効化できます。');
      }
      if (!env.supported) {
        throw new Error('お使いのブラウザ・端末では Web Push を利用できません。');
      }

      const permission = await Notification.requestPermission();
      if (permission === 'denied') {
        throw new Error('通知がブロックされています。ブラウザまたはOSの設定から通知を許可してください。');
      }
      if (permission !== 'granted') {
        throw new Error('通知の許可が承認されませんでした。');
      }

      const reg = await ensureServiceWorkerRegistration();
      const expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      let sub = await reg.pushManager.getSubscription();

      if (sub && sub.options && sub.options.applicationServerKey) {
        const currentKey = new Uint8Array(sub.options.applicationServerKey);
        if (!uint8ArraysEqual(currentKey, expectedKey)) {
          await sub.unsubscribe();
          sub = null;
        }
      }

      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedKey
          });
        } catch (err) {
          if (err && err.name === 'InvalidStateError') {
            const stale = await reg.pushManager.getSubscription();
            if (stale) await stale.unsubscribe();
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: expectedKey
            });
          } else {
            throw err;
          }
        }
      }

      const subJson = sub.toJSON();
      let savedToDb = false;
      let dbError = null;
      try {
        const saveRes = await SupabaseService.savePushSubscription(
          JSON.stringify(subJson),
          user && user.name,
          user && user.email
        );
        savedToDb = !!(saveRes && saveRes.success);
      } catch (e) {
        dbError = e && e.message ? e.message : String(e);
      }

      return { subscription: subJson, savedToDb, dbError };
    }

    async function unsubscribeAndClear(user) {
      const sub = await getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
      try {
        await SupabaseService.savePushSubscription(null, user && user.name, user && user.email);
      } catch (e) {
        console.warn('Failed to clear push_subscription in DB:', e);
      }
      return { success: true };
    }

    async function invokeEdgeFunction(fnName, bodyPayload) {
      const endpoint = `${SUPABASE_URL}/functions/v1/${fnName}`;
      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(bodyPayload || {})
        });
      } catch (networkErr) {
        throw new Error(`Edge Function (${fnName}) へ接続できませんでした（未デプロイまたはネットワークエラーの可能性があります）。`);
      }

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok || !data || !data.success) {
        const msg = (data && data.error) ||
          (data && data.results && data.results[0] && data.results[0].error) ||
          `HTTP ${res.status} エラー`;
        throw new Error(msg);
      }
      return data;
    }

    async function sendTestPush({ subscription, title, body, memberId, targetAll, url, tag }) {
      return await invokeEdgeFunction('send-web-push', {
        subscription,
        memberId,
        targetAll,
        title: title || 'FC Benten テスト通知',
        body: body || 'Web Push 通知の受信テスト成功です！',
        url: url || './',
        tag: tag || 'fcb-webpush-test'
      });
    }

    window.SupabaseWebPush = {
      VAPID_PUBLIC_KEY,
      getEnvironmentStatus,
      getSubscription,
      subscribeAndSave,
      unsubscribeAndClear,
      sendTestPush
    };

    // =========================================
    // 7. LINE 個人通知ヘルパー (連携コード発行 & Edge Function呼び出し)
    // =========================================
    function applyMemberFilter(query, user) {
      const u = user || window.currentUser || {};
      const memberId = (u.id || u.memberId || '').trim();
      const targetEmail = (u.email || '').trim().toLowerCase();
      const targetName = (u.name || '').trim();

      if (memberId) return { query: query.eq('member_id', memberId), memberId };
      if (targetEmail) return { query: query.eq('email', targetEmail), memberId: null };
      if (targetName) return { query: query.eq('name', targetName), memberId: null };
      return { query: null, memberId: null };
    }

    async function getLineLinkStatus(user) {
      const sb = getClient();
      if (!sb) throw new Error('Supabase クライアントが利用できません。');
      const { query } = applyMemberFilter(sb.from('members').select('member_id, name, line_user_id, notify_settings'), user);
      if (!query) throw new Error('ログイン中のメンバーを特定できません。');

      const { data, error } = await query.limit(1);
      if (error) throw error;
      const row = (data && data[0]) || null;
      if (!row) throw new Error('メンバー情報が見つかりません。');

      let parsedSettings = {};
      if (row.notify_settings) {
        try { parsedSettings = JSON.parse(row.notify_settings); } catch (e) {}
      }

      const hasValidCode = !!(parsedSettings.linkCode && Number(parsedSettings.linkCodeExpiresAt || 0) > Date.now());
      return {
        memberId: row.member_id,
        name: row.name,
        linked: !!(row.line_user_id && String(row.line_user_id).trim()),
        lineUserId: row.line_user_id || '',
        linkCode: hasValidCode ? parsedSettings.linkCode : '',
        linkCodeExpiresAt: hasValidCode ? Number(parsedSettings.linkCodeExpiresAt) : 0,
        settings: parsedSettings
      };
    }

    async function issueLinkCode(user) {
      const sb = getClient();
      if (!sb) throw new Error('Supabase クライアントが利用できません。');
      const status = await getLineLinkStatus(user);
      const rand4 = Math.floor(1000 + Math.random() * 9000);
      const code = `FCB-${rand4}`;
      const expiresAt = Date.now() + 15 * 60 * 1000;

      const nextSettings = {
        ...(status.settings || {}),
        linkCode: code,
        linkCodeExpiresAt: expiresAt
      };

      const { error } = await sb
        .from('members')
        .update({
          notify_settings: JSON.stringify(nextSettings),
          updated_at: new Date().toISOString()
        })
        .eq('member_id', status.memberId);

      if (error) throw error;
      return { memberId: status.memberId, code, expiresAt };
    }

    async function unlinkLine(user) {
      const sb = getClient();
      if (!sb) throw new Error('Supabase クライアントが利用できません。');
      const status = await getLineLinkStatus(user);
      const { error } = await sb
        .from('members')
        .update({
          line_user_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('member_id', status.memberId);

      if (error) throw error;
      return { success: true };
    }

    async function sendTestLinePush({ memberId, lineUserId, title, body, appUrl }) {
      const u = window.currentUser || {};
      const resolvedMemberId = memberId || (u.id || u.memberId || '').trim() || undefined;
      const resolvedUrl = appUrl || (window.location && /^https:/i.test(window.location.href) ? window.location.href.split('#')[0] : undefined);

      return await invokeEdgeFunction('send-line-push', {
        memberId: lineUserId ? undefined : resolvedMemberId,
        lineUserId,
        title: title || 'FC Benten LINE テスト通知',
        body: body || '個人トーク宛てのテスト通知です。',
        appUrl: resolvedUrl
      });
    }

    const LINE_BOT_BASIC_ID = '@377avqrr';

    function isMobileBrowser() {
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
      return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    }

    function getLineFriendUrl() {
      return `https://line.me/R/ti/p/${encodeURIComponent(LINE_BOT_BASIC_ID)}`;
    }

    function getLineOaMessageUrl(code) {
      const base = `https://line.me/R/oaMessage/${encodeURIComponent(LINE_BOT_BASIC_ID)}/`;
      return code ? `${base}?${encodeURIComponent(code)}` : base;
    }

    function getLineOpenUrl(code) {
      return isMobileBrowser() ? getLineOaMessageUrl(code) : getLineFriendUrl();
    }

    window.SupabaseLinePush = {
      LINE_BOT_BASIC_ID,
      isMobileBrowser,
      getLineFriendUrl,
      getLineOaMessageUrl,
      getLineOpenUrl,
      getLineLinkStatus,
      issueLinkCode,
      unlinkLine,
      sendTestLinePush
    };

  })();
