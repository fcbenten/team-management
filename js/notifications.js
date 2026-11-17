// =========================================
// アプリ内お知らせ（ベルアイコン・モーダル）＆ 代表専用「通知管理画面」
// =========================================

(function () {
  'use strict';

  const ANNOUNCEMENT_CATEGORY_META = {
    schedule: { label: 'スケジュール', icon: 'calendar_today' },
    bulletin: { label: '活動記録・掲示板', icon: 'article' },
    bulletin_comment: { label: '活動記録コメント', icon: 'chat_bubble_outline' },
    results: { label: '試合記録', icon: 'sports_soccer' },
    equipment: { label: '備品管理', icon: 'inventory_2' },
    reminder: { label: 'リマインド', icon: 'alarm' },
    system: { label: 'システム管理', icon: 'admin_panel_settings' }
  };

  const TARGET_TAB_ICON_MAP = {
    schedule: 'calendar_today',
    bulletin: 'article',
    results: 'sports_soccer',
    equipment: 'inventory_2',
    notifications: 'admin_panel_settings',
    home: 'notifications'
  };

  let cachedAnnouncementsState = { items: [], unreadCount: 0 };
  let cachedRulesList = [];

  function getCurrentActorMemberId() {
    const u = window.currentUser || {};
    return u.memberId || u.id || '';
  }

  function formatAnnouncementRelativeTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'たった今';
    if (diffMin < 60) return diffMin + '分前';
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return diffHour + '時間前';
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function updateBellBadgeUI(unreadCount) {
    const bellBtn = document.getElementById('headerBellBtn');
    const badge = document.getElementById('headerBellBadge');
    const modalBadge = document.getElementById('announcementsModalBadge');
    const markAllBtn = document.getElementById('btnMarkAllAnnouncementsRead');

    const count = Math.max(0, Number(unreadCount || 0));
    if (bellBtn && window.currentUser) {
      bellBtn.classList.remove('hidden');
    }
    if (badge) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('hidden', count === 0);
    }
    if (modalBadge) {
      modalBadge.textContent = count + '件未読';
      modalBadge.classList.toggle('hidden', count === 0);
    }
    if (markAllBtn) {
      markAllBtn.disabled = (count === 0);
    }
  }

  /**
   * ログイン中ユーザーのアプリ内お知らせと未読件数を最新化し、ベルバッジを更新する
   */
  async function refreshAnnouncementBell() {
    const memberId = getCurrentActorMemberId();
    if (!memberId || !window.SupabaseNotificationService) {
      updateBellBadgeUI(0);
      return cachedAnnouncementsState;
    }
    try {
      const res = await window.SupabaseNotificationService.getMyAnnouncements(memberId, 50);
      cachedAnnouncementsState = res || { items: [], unreadCount: 0 };
      updateBellBadgeUI(cachedAnnouncementsState.unreadCount);
      const modal = document.getElementById('announcementsModal');
      if (modal && modal.classList.contains('active')) {
        renderAnnouncementsList();
      }
      return cachedAnnouncementsState;
    } catch (e) {
      console.warn('refreshAnnouncementBell skipped:', e);
      return cachedAnnouncementsState;
    }
  }
  window.refreshAnnouncementBell = refreshAnnouncementBell;

  function renderAnnouncementsList() {
    const container = document.getElementById('announcementsListContainer');
    if (!container) return;
    container.replaceChildren();

    const items = (cachedAnnouncementsState && cachedAnnouncementsState.items) || [];
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'announcements-empty';
      empty.textContent = 'お知らせはありません。';
      container.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'announcement-item' + (item.isRead ? '' : ' is-unread');
      row.setAttribute('data-announcement-id', item.announcement_id);
      row.onclick = () => handleAnnouncementItemClick(item);

      const iconWrap = document.createElement('div');
      iconWrap.className = 'announcement-item-icon';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-symbols-outlined';
      iconSpan.textContent = TARGET_TAB_ICON_MAP[item.target_tab] || 'notifications';
      iconWrap.appendChild(iconSpan);

      const main = document.createElement('div');
      main.className = 'announcement-item-main';

      const top = document.createElement('div');
      top.className = 'announcement-item-top';

      const titleEl = document.createElement('div');
      titleEl.className = 'announcement-item-title';
      titleEl.textContent = item.title || 'お知らせ';

      const timeEl = document.createElement('div');
      timeEl.className = 'announcement-item-time';
      timeEl.textContent = formatAnnouncementRelativeTime(item.created_at);

      top.appendChild(titleEl);
      top.appendChild(timeEl);
      main.appendChild(top);

      if (item.body) {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'announcement-item-body';
        bodyEl.textContent = item.body;
        main.appendChild(bodyEl);
      }

      row.appendChild(iconWrap);
      row.appendChild(main);

      if (!item.isRead) {
        const dot = document.createElement('span');
        dot.className = 'announcement-unread-dot';
        dot.setAttribute('aria-hidden', 'true');
        row.appendChild(dot);
      }

      container.appendChild(row);
    });
  }

  async function openAnnouncementsModal() {
    const modal = document.getElementById('announcementsModal');
    if (!modal) return;
    renderAnnouncementsList();
    modal.classList.add('active');
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    await refreshAnnouncementBell();
  }
  window.openAnnouncementsModal = openAnnouncementsModal;

  function closeAnnouncementsModal(e) {
    if (e && e.target) {
      const isOverlay = e.target.id === 'announcementsModal';
      const isCloseBtn = Boolean(e.target.closest('.modal-close'));
      if (!isOverlay && !isCloseBtn) return;
    }
    const modal = document.getElementById('announcementsModal');
    if (modal) modal.classList.remove('active');
    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  }
  window.closeAnnouncementsModal = closeAnnouncementsModal;

  async function handleAnnouncementItemClick(item) {
    if (!item) return;
    const memberId = getCurrentActorMemberId();
    if (!item.isRead) {
      item.isRead = true;
      cachedAnnouncementsState.unreadCount = Math.max(0, (cachedAnnouncementsState.unreadCount || 1) - 1);
      updateBellBadgeUI(cachedAnnouncementsState.unreadCount);
      renderAnnouncementsList();
      if (memberId && window.SupabaseNotificationService) {
        window.SupabaseNotificationService.markAnnouncementRead(item.announcement_id, memberId);
      }
    }
    closeAnnouncementsModal();
    if (item.target_tab && typeof window.switchTab === 'function') {
      window.switchTab(item.target_tab);
    }
  }

  async function handleMarkAllAnnouncementsRead() {
    const memberId = getCurrentActorMemberId();
    const items = (cachedAnnouncementsState && cachedAnnouncementsState.items) || [];
    const unreadIds = items.filter(it => !it.isRead).map(it => it.announcement_id);
    if (unreadIds.length === 0) return;

    items.forEach(it => { it.isRead = true; });
    cachedAnnouncementsState.unreadCount = 0;
    updateBellBadgeUI(0);
    renderAnnouncementsList();

    if (memberId && window.SupabaseNotificationService) {
      await window.SupabaseNotificationService.markAllAnnouncementsRead(unreadIds, memberId);
    }
  }
  window.handleMarkAllAnnouncementsRead = handleMarkAllAnnouncementsRead;

  // =========================================
  // 代表専用：通知管理画面（#tab-notifications）
  // =========================================
  function setNotifAdminStatus(msg, type) {
    const el = document.getElementById('notifAdminStatusMsg');
    if (!el) return;
    if (!msg) {
      el.textContent = '';
      el.className = 'notif-admin-status-msg hidden';
      return;
    }
    el.textContent = msg;
    el.className = 'notif-admin-status-msg ' + (type === 'error' ? 'is-error' : type === 'info' ? 'is-info' : 'is-success');
  }

  function buildTimingSelects(rule) {
    const wrap = document.createElement('div');
    wrap.className = 'notif-rule-timing';

    const daySel = document.createElement('select');
    daySel.className = 'notif-timing-select';
    daySel.setAttribute('aria-label', rule.action_label + 'の対象日');
    const dayOptions = [
      { value: 0, label: '当日' },
      { value: 1, label: '前日（1日前）' },
      { value: 2, label: '2日前' },
      { value: 3, label: '3日前' },
      { value: 7, label: '7日前' }
    ];
    const currentDay = Number(rule.days_before !== null && rule.days_before !== undefined ? rule.days_before : 1);
    dayOptions.forEach(opt => {
      const o = document.createElement('option');
      o.value = String(opt.value);
      o.textContent = opt.label;
      if (opt.value === currentDay) o.selected = true;
      daySel.appendChild(o);
    });
    daySel.onchange = () => handleRulePatch(rule.rule_key, { days_before: Number(daySel.value) });

    const hourSel = document.createElement('select');
    hourSel.className = 'notif-timing-select';
    hourSel.setAttribute('aria-label', rule.action_label + 'の通知時刻');
    const currentHour = Number(rule.notify_hour !== null && rule.notify_hour !== undefined ? rule.notify_hour : 9);
    for (let h = 0; h < 24; h++) {
      const o = document.createElement('option');
      o.value = String(h);
      o.textContent = String(h).padStart(2, '0') + ':00';
      if (h === currentHour) o.selected = true;
      hourSel.appendChild(o);
    }
    hourSel.onchange = () => handleRulePatch(rule.rule_key, { notify_hour: Number(hourSel.value) });

    wrap.appendChild(daySel);
    wrap.appendChild(hourSel);
    return wrap;
  }

  function createToggleControl(labelText, checked, disabled, isExternal, onChange) {
    const label = document.createElement('label');
    label.className = 'notif-switch-item' + (disabled ? ' is-disabled' : '');

    const switchSpan = document.createElement('span');
    switchSpan.className = 'notif-toggle-switch' + (isExternal ? ' is-external' : '');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.disabled = Boolean(disabled);
    input.onchange = () => onChange(input.checked);

    const slider = document.createElement('span');
    slider.className = 'notif-toggle-slider';

    switchSpan.appendChild(input);
    switchSpan.appendChild(slider);

    const textSpan = document.createElement('span');
    textSpan.textContent = labelText;

    label.appendChild(switchSpan);
    label.appendChild(textSpan);
    return label;
  }

  function renderNotificationRulesAdmin() {
    const container = document.getElementById('notifAdminRulesContainer');
    if (!container) return;
    container.replaceChildren();

    if (!cachedRulesList || cachedRulesList.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card-box announcements-empty';
      empty.textContent = '通知ルールが見つかりません。';
      container.appendChild(empty);
      return;
    }

    const grouped = {};
    const groupOrder = ['schedule', 'bulletin', 'bulletin_comment', 'results', 'equipment', 'reminder', 'system'];
    cachedRulesList.forEach(rule => {
      const cat = rule.category || 'system';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(rule);
    });

    groupOrder.forEach(cat => {
      const rules = grouped[cat];
      if (!rules || rules.length === 0) return;

      const meta = ANNOUNCEMENT_CATEGORY_META[cat] || { label: cat, icon: 'notifications' };
      const card = document.createElement('div');
      card.className = 'card-box notif-admin-group-card';

      const header = document.createElement('div');
      header.className = 'notif-admin-group-header';
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.textContent = meta.icon;
      const title = document.createElement('span');
      title.textContent = meta.label;
      header.appendChild(icon);
      header.appendChild(title);
      card.appendChild(header);

      rules.forEach(rule => {
        const row = document.createElement('div');
        row.className = 'notif-rule-row';
        row.setAttribute('data-rule-key', rule.rule_key);

        const info = document.createElement('div');
        info.className = 'notif-rule-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'notif-rule-name';
        nameEl.textContent = rule.action_label;
        const descEl = document.createElement('div');
        descEl.className = 'notif-rule-desc';
        descEl.textContent = rule.description || '';
        info.appendChild(nameEl);
        if (rule.description) info.appendChild(descEl);

        const controls = document.createElement('div');
        controls.className = 'notif-rule-controls';

        if (rule.category === 'reminder') {
          controls.appendChild(buildTimingSelects(rule));
        }

        const switchGroup = document.createElement('div');
        switchGroup.className = 'notif-switch-group';

        if (rule.supports_announcement !== false) {
          switchGroup.appendChild(
            createToggleControl('お知らせ', rule.announcement_enabled, false, false, (nextVal) => {
              const patch = { announcement_enabled: nextVal };
              if (!nextVal) patch.external_enabled = false;
              handleRulePatch(rule.rule_key, patch);
            })
          );
          const extDisabled = !rule.announcement_enabled;
          switchGroup.appendChild(
            createToggleControl(
              '通知(LINE/Push)',
              rule.announcement_enabled && rule.external_enabled,
              extDisabled,
              true,
              (nextVal) => handleRulePatch(rule.rule_key, { external_enabled: nextVal })
            )
          );
        } else {
          switchGroup.appendChild(
            createToggleControl('代表LINE通知', rule.external_enabled, false, true, (nextVal) => {
              handleRulePatch(rule.rule_key, { external_enabled: nextVal });
            })
          );
        }

        controls.appendChild(switchGroup);
        row.appendChild(info);
        row.appendChild(controls);
        card.appendChild(row);
      });

      container.appendChild(card);
    });
  }

  async function handleRulePatch(ruleKey, patch) {
    const target = cachedRulesList.find(r => r.rule_key === ruleKey);
    if (!target) return;
    const prevSnapshot = Object.assign({}, target);
    Object.assign(target, patch);
    if (target.supports_announcement !== false && !target.announcement_enabled) {
      target.external_enabled = false;
    }
    renderNotificationRulesAdmin();

    if (!window.SupabaseNotificationService) return;
    try {
      await window.SupabaseNotificationService.saveNotificationRule(ruleKey, patch);
      setNotifAdminStatus('設定を保存しました。', 'success');
    } catch (err) {
      Object.assign(target, prevSnapshot);
      renderNotificationRulesAdmin();
      console.error('saveNotificationRule error:', err);
      const safeMsg = (typeof getSafeErrorMessage === 'function')
        ? getSafeErrorMessage(err, '設定の保存に失敗しました。しばらく経ってから再度お試しください。', '通知管理')
        : '設定の保存に失敗しました。';
      setNotifAdminStatus(safeMsg, 'error');
    }
  }

  async function initNotificationAdminView() {
    if (typeof window.isCurrentUserRepresentative === 'function' && !window.isCurrentUserRepresentative()) {
      return;
    }
    const tab = document.getElementById('tab-notifications');
    if (tab) {
      const ph = tab.querySelector('.tab-loading-placeholder');
      const mc = tab.querySelector('.tab-main-content');
      if (ph) ph.classList.add('hidden');
      if (mc) mc.classList.remove('hidden');
    }
    setNotifAdminStatus('', '');

    if (!window.SupabaseNotificationService) return;
    try {
      cachedRulesList = await window.SupabaseNotificationService.getNotificationRules(true);
      renderNotificationRulesAdmin();
    } catch (err) {
      console.error('initNotificationAdminView error:', err);
      const safeMsg = (typeof getSafeErrorMessage === 'function')
        ? getSafeErrorMessage(err, '通知ルールの取得に失敗しました。しばらく経ってから再度お試しください。', '通知管理')
        : '通知ルールの取得に失敗しました。';
      setNotifAdminStatus(safeMsg, 'error');
    }
  }
  window.initNotificationAdminView = initNotificationAdminView;

  async function handleRunReminderTestSelf() {
    const btn = document.getElementById('btnTestDailyRemindersSelf');
    const memberId = getCurrentActorMemberId();
    if (!memberId || !window.SupabaseNotificationService) return;

    if (btn) btn.disabled = true;
    setNotifAdminStatus('代表の自分のアカウント宛てにテストリマインドを送信しています...', 'info');
    try {
      const res = await window.SupabaseNotificationService.runDailyReminderSelfTest(memberId);
      setNotifAdminStatus(res && res.message ? res.message : 'テスト通知を実行しました。', 'success');
      await refreshAnnouncementBell();
    } catch (err) {
      console.error('handleRunReminderTestSelf error:', err);
      const safeMsg = (typeof getSafeErrorMessage === 'function')
        ? getSafeErrorMessage(err, 'テスト通知の実行に失敗しました。しばらく経ってから再度お試しください。', '通知管理')
        : 'テスト通知の実行に失敗しました。';
      setNotifAdminStatus(safeMsg, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  window.handleRunReminderTestSelf = handleRunReminderTestSelf;
})();

