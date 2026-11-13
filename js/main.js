// =========================================
  // 🌐 アプリケーション全体の状態管理と初期化
  // =========================================

  // グローバル変数の定義
  let eventsData = []; // カレンダーから取得した予定データ
  let matchLogs = []; // 入力中のログデータ（得点・カード）
  let currentMatchId = null; // 編集中の試合ID（新規の場合はnull）
  let teamStatsData = []; // ランキング・スタッツ用の個人成績データ
  let allHistoryMatches = []; // 登録済みの全試合結果データ
  let rankExpanded = { goals: false, assists: false, mom: false, games: false }; // ランキングの展開状態

  /**
   * スマホ時、上部固定ヘッダー（.sidebar-header）の実際の高さを計測してCSS変数にセット
   * サブタブなどのposition: stickyが正確にヘッダー真下に吸着するようにする
   */
  function updateMobileHeaderHeight() {
    if (window.innerWidth <= 767) {
      const header = document.querySelector('.sidebar-header');
      if (header) {
        const h = header.offsetHeight;
        if (h > 0) {
          document.documentElement.style.setProperty('--sidebar-height', h + 'px');
        }
      }
    } else {
      document.documentElement.style.setProperty('--sidebar-height', '0px');
    }
    const subtabs = document.querySelector('.schedule-subtabs-container');
    if (subtabs) {
      const sh = subtabs.offsetHeight;
      if (sh > 0) {
        document.documentElement.style.setProperty('--schedule-subtabs-height', sh + 'px');
      }
    }
    scrollActiveNavItemIntoView(false);
  }

  /**
   * スマホのボトムナビゲーションで横スクロール時、アクティブなタブが中央に見えるようにスクロール
   * @param {boolean} smooth - スムーズスクロールにするかどうか
   */
  function scrollActiveNavItemIntoView(smooth) {
    if (window.innerWidth > 767) return;
    const activeNavItem = document.querySelector('.sidebar-nav .nav-item.active');
    const navBar = document.querySelector('.sidebar-nav');
    if (activeNavItem && navBar && navBar.scrollWidth > navBar.clientWidth) {
      const navRect = navBar.getBoundingClientRect();
      const itemRect = activeNavItem.getBoundingClientRect();
      navBar.scrollTo({
        left: navBar.scrollLeft + (itemRect.left - navRect.left) - (navRect.width / 2 - itemRect.width / 2),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
    setTimeout(updateNavScrollIndicators, smooth ? 300 : 50);
  }
  window.scrollActiveNavItemIntoView = scrollActiveNavItemIntoView;

  /**
   * ボトムナビのスクロール状態を更新（左右の矢印表示/非表示、プログレスバー更新）
   */
  function updateNavScrollIndicators() {
    if (window.innerWidth > 767) return;
    const navBar = document.querySelector('.sidebar-nav');
    const leftBtn = document.getElementById('navScrollLeft');
    const rightBtn = document.getElementById('navScrollRight');
    const track = document.getElementById('navScrollTrack');
    const thumb = document.getElementById('navScrollThumb');
    if (!navBar) return;

    const maxScroll = navBar.scrollWidth - navBar.clientWidth;
    if (maxScroll <= 5) {
      if (leftBtn) leftBtn.classList.add('hidden');
      if (rightBtn) rightBtn.classList.add('hidden');
      if (track) track.style.display = 'none';
      return;
    }

    if (track) track.style.display = 'block';

    const scrollLeft = navBar.scrollLeft;
    if (leftBtn) {
      if (scrollLeft > 6) {
        leftBtn.classList.remove('hidden');
      } else {
        leftBtn.classList.add('hidden');
      }
    }

    if (rightBtn) {
      if (scrollLeft < maxScroll - 6) {
        rightBtn.classList.remove('hidden');
      } else {
        rightBtn.classList.add('hidden');
      }
    }

    if (thumb) {
      const visibleRatio = Math.min(1, navBar.clientWidth / navBar.scrollWidth);
      const thumbWidthPercent = Math.max(18, visibleRatio * 100);
      const scrollRatio = maxScroll > 0 ? (scrollLeft / maxScroll) : 0;
      const maxTranslatePercent = 100 - thumbWidthPercent;
      const translatePercent = scrollRatio * maxTranslatePercent;
      thumb.style.width = thumbWidthPercent + '%';
      thumb.style.transform = `translateX(${translatePercent * (navBar.clientWidth / 100)}px)`;
    }
  }

  function scrollNavBy(delta) {
    const navBar = document.querySelector('.sidebar-nav');
    if (navBar) {
      navBar.scrollBy({ left: delta, behavior: 'smooth' });
      setTimeout(updateNavScrollIndicators, 250);
    }
  }
  window.scrollNavBy = scrollNavBy;
  window.updateNavScrollIndicators = updateNavScrollIndicators;

  window.addEventListener('resize', function() {
    updateMobileHeaderHeight();
    updateNavScrollIndicators();
  });

  /**
   * 保存されているアクティブタブ名を取得（URLハッシュまたはsessionStorage）
   * @returns {string} 有効なタブ名（デフォルト: 'home'）
   */
  function getSavedActiveTab() {
    let tab = '';
    try {
      const hash = (window.location.hash || '').replace(/^#/, '').trim();
      if (hash) tab = hash;
    } catch (e) {}
    if (!tab) {
      try {
        tab = sessionStorage.getItem('fcb_active_tab') || '';
      } catch (e) {}
    }
    const validTabs = ['home', 'schedule', 'results', 'bulletin', 'ranking', 'personal', 'equipment', 'members'];
    if (!validTabs.includes(tab)) {
      return 'home';
    }
    // メンバー管理タブは管理者権限がなければ home に安全フォールバック
    if (tab === 'members' && typeof isCurrentUserAdmin === 'function' && !isCurrentUserAdmin()) {
      return 'home';
    }
    return tab;
  }
  window.getSavedActiveTab = getSavedActiveTab;

  /**
   * ページ初期ロード時（HTMLパース直後やデータ取得中）に前回のタブを即時反映してチラつきを防止
   */
  function applyInitialActiveTab() {
    const savedTab = getSavedActiveTab();
    if (savedTab && savedTab !== 'home') {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        el.classList.remove('active');
        const oc = el.getAttribute('onclick') || '';
        if (oc.indexOf("'" + savedTab + "'") !== -1 || oc.indexOf('"' + savedTab + '"') !== -1) {
          el.classList.add('active');
        }
      });
      document.querySelectorAll('.content-area').forEach(el => {
        el.classList.remove('active');
      });
      const targetTab = document.getElementById('tab-' + savedTab);
      if (targetTab) {
        targetTab.classList.add('active');
      }
      scrollActiveNavItemIntoView(false);
    }
  }
  window.applyInitialActiveTab = applyInitialActiveTab;

  window.addEventListener('DOMContentLoaded', function() {
    // 0. Google OAuth リダイレクトコールバック（?code=...）のチェック（PWAネイティブ完結）
    const isOAuthCallback = checkOAuthCallbackOnLoad();
    if (isOAuthCallback) {
      applyInitialActiveTab();
      updateMobileHeaderHeight();
      updateNavScrollIndicators();
      return;
    }

    let savedUser = null;
    try {
      const raw = localStorage.getItem('fcb_auth_user');
      if (raw) {
        savedUser = JSON.parse(raw);
        if (savedUser && savedUser.name) {
          window.currentUser = savedUser;
          if (typeof updateAdminNavVisibility === 'function') updateAdminNavVisibility();
        }
      }
    } catch (e) {}

    // ログイン判定を DOMContentLoaded で即座に行い、画面更新時のチラ見え（FOUC）を完全防止
    if (savedUser && savedUser.name) {
      hideLoginScreen();
    } else {
      showLoginScreen();
    }

    applyInitialActiveTab();
    updateMobileHeaderHeight();
    updateNavScrollIndicators();
    initLoginFormListeners();
    const navBar = document.querySelector('.sidebar-nav');
    if (navBar) {
      navBar.addEventListener('scroll', updateNavScrollIndicators, { passive: true });
    }
  });
  window.addEventListener('load', function() {
    updateMobileHeaderHeight();
    updateNavScrollIndicators();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() {
      updateMobileHeaderHeight();
      updateNavScrollIndicators();
    });
  }

  // スマホでの入力フォーム・キーボード表示時にボトムナビを一時的に隠す
  window.addEventListener('focusin', function(e) {
    if (window.innerWidth <= 767) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
        document.body.classList.add('keyboard-open');
      }
    }
  });
  window.addEventListener('focusout', function(e) {
    if (window.innerWidth <= 767) {
      document.body.classList.remove('keyboard-open');
    }
  });

  /**
   * すべてのタブのメインコンテンツを表示し、ローディングプレースホルダーを隠す
   */
  function revealAllTabContents() {
    document.querySelectorAll('.tab-loading-placeholder').forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });
    document.querySelectorAll('.tab-main-content').forEach(el => {
      el.style.display = '';
      el.classList.remove('hidden');
    });
    updateMobileHeaderHeight();
  }

  /**
   * 画面ロード時の初期化処理
   */
  window.onload = function () {
    updateMobileHeaderHeight();
    initPullToRefresh();
    initAvatarLightbox();
    initSwipeTabNavigation();
    // 1. ローカルストレージにログインセッションが残っているか確認
    let savedUser = null;
    try {
      const raw = localStorage.getItem('fcb_auth_user');
      if (raw) savedUser = JSON.parse(raw);
    } catch (e) {}

    if (savedUser && savedUser.name) {
      window.currentUser = savedUser;
      if (typeof updateAdminNavVisibility === 'function') {
        updateAdminNavVisibility();
      }
      hideLoginScreen();
      applyInitialActiveTab();
      loadAppInitialData();
    } else {
      showLoginScreen();
    }
  };

  /**
   * ログイン画面用フィールドエラー表示（メンバー管理画面と統一）
   */
  function setLoginFieldError(fieldId, errorMsg) {
    const inputEl = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    if (inputEl) inputEl.classList.add('input-has-error');
    if (errEl) {
      errEl.textContent = errorMsg || '';
      errEl.classList.remove('hidden');
      errEl.style.display = 'block';
    }
  }

  /**
   * ログイン画面用フィールドエラー解除
   */
  function clearLoginFieldError(fieldId) {
    const inputEl = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    if (inputEl) inputEl.classList.remove('input-has-error');
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
      errEl.style.display = 'none';
    }
  }

  /**
   * ログイン画面の全フィールドエラー解除
   */
  function clearAllLoginFieldErrors() {
    [
      'loginEmailInput',
      'loginPasswordInput',
      'oauthPreCheckEmailInput',
      'oauthNewPwInput',
      'oauthConfirmPwInput'
    ].forEach(clearLoginFieldError);
  }

  /**
   * ログイン画面内のアクティブカードを切り替える
   * @param {'loginCard'|'oauthPreCheckCard'|'oauthLoadingOverlay'|'oauthPasswordCard'} activeCardId
   */
  function setLoginCardView(activeCardId) {
    const cardIds = ['loginCard', 'oauthPreCheckCard', 'oauthLoadingOverlay', 'oauthPasswordCard'];
    cardIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === activeCardId) ? 'block' : 'none';
    });
  }

  // 名簿管理画面と共通のメールアドレス形式正規表現
  const LOGIN_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  /**
   * メールアドレス入力欄の共通バリデーション（フォーカスアウト時・送信時）
   */
  function validateEmailFieldById(fieldId, emptyMsg) {
    const input = document.getElementById(fieldId);
    if (!input) return true;
    const val = input.value.trim().toLowerCase();
    input.value = val;

    if (!val) {
      setLoginFieldError(fieldId, emptyMsg);
      return false;
    }

    if (!LOGIN_EMAIL_REGEX.test(val)) {
      setLoginFieldError(fieldId, 'メールアドレスの形式が正しくありません。');
      return false;
    }

    clearLoginFieldError(fieldId);
    return true;
  }

  /**
   * ログインメールアドレスのバリデーション（フォーカスアウト時・送信時）
   */
  function validateLoginEmailField() {
    return validateEmailFieldById('loginEmailInput', 'メールアドレスを入力してください。');
  }

  /**
   * Google連携事前確認 Gmail入力欄のバリデーション（フォーカスアウト時・送信時）
   */
  function validateOAuthPreCheckEmailField() {
    return validateEmailFieldById('oauthPreCheckEmailInput', '登録済みのGmailアドレスを入力してください。');
  }

  /**
   * ログインパスワードのバリデーション（フォーカスアウト時・送信時）
   */
  function validateLoginPasswordField() {
    const input = document.getElementById('loginPasswordInput');
    if (!input) return true;
    const val = input.value.trim();

    if (!val) {
      setLoginFieldError('loginPasswordInput', 'パスワードを入力してください。');
      return false;
    }

    clearLoginFieldError('loginPasswordInput');
    return true;
  }

  /**
   * 初回パスワード設定：設定パスワード入力欄のバリデーション（フォーカスアウト時・送信時）
   */
  function validateOAuthNewPwField() {
    const input = document.getElementById('oauthNewPwInput');
    if (!input) return true;
    const val = input.value.trim();

    if (!val || val.length < 4) {
      setLoginFieldError('oauthNewPwInput', 'パスワードは4文字以上で設定してください。');
      return false;
    }

    clearLoginFieldError('oauthNewPwInput');
    const confirmInput = document.getElementById('oauthConfirmPwInput');
    if (confirmInput && (confirmInput.value.trim() || confirmInput.classList.contains('input-has-error'))) {
      validateOAuthConfirmPwField();
    }
    return true;
  }

  /**
   * 初回パスワード設定：確認用パスワード入力欄のバリデーション（フォーカスアウト時・送信時）
   */
  function validateOAuthConfirmPwField() {
    const pw1El = document.getElementById('oauthNewPwInput');
    const pw2El = document.getElementById('oauthConfirmPwInput');
    if (!pw1El || !pw2El) return true;
    const p1 = pw1El.value.trim();
    const p2 = pw2El.value.trim();

    if (p1 !== p2) {
      setLoginFieldError('oauthConfirmPwInput', '確認用パスワードと一致しません。');
      return false;
    }

    clearLoginFieldError('oauthConfirmPwInput');
    return true;
  }

  /**
   * ログイン画面の入力イベントリスナー初期化（フォーカスアウト時バリデーション）
   */
  function initLoginFormListeners() {
    const fieldValidators = [
      ['loginEmailInput', validateLoginEmailField],
      ['loginPasswordInput', validateLoginPasswordField],
      ['oauthPreCheckEmailInput', validateOAuthPreCheckEmailField],
      ['oauthNewPwInput', validateOAuthNewPwField],
      ['oauthConfirmPwInput', validateOAuthConfirmPwField]
    ];

    fieldValidators.forEach(([fieldId, validator]) => {
      const el = document.getElementById(fieldId);
      if (!el || el.dataset.listenerAttached) return;
      el.dataset.listenerAttached = 'true';
      el.addEventListener('blur', validator);
      el.addEventListener('input', () => {
        if (el.classList.contains('input-has-error')) validator();
      });
    });
  }

  /**
   * 新規登録・Google連携事前確認カードへ切り替え
   */
  function switchToOAuthPreCheckCard(e) {
    if (e && e.preventDefault) e.preventDefault();
    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'flex';
    setLoginCardView('oauthPreCheckCard');

    clearLoginFieldError('oauthPreCheckEmailInput');
    const btn = document.getElementById('oauthPreCheckBtn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Google連携へ進む';
    }
    const input = document.getElementById('oauthPreCheckEmailInput');
    if (input) {
      const loginEmail = (document.getElementById('loginEmailInput') || {}).value || '';
      if (!input.value && loginEmail.includes('@')) {
        input.value = loginEmail.trim().toLowerCase();
      }
      setTimeout(() => input.focus(), 50);
    }
  }
  window.switchToOAuthPreCheckCard = switchToOAuthPreCheckCard;

  /**
   * Google連携前の名簿メールアドレス事前チェック送信処理
   */
  function handleOAuthPreCheckSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('oauthPreCheckEmailInput');
    const btn = document.getElementById('oauthPreCheckBtn');
    if (!input) return;

    const email = input.value.trim().toLowerCase();
    if (!validateOAuthPreCheckEmailField()) {
      input.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = '名簿を確認中...';
    }

    google.script.run
      .withSuccessHandler(res => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Google連携へ進む';
        }
        if (res && res.success && res.registered) {
          startGoogleOAuthFlow(null, res.email || email);
        } else {
          if (!(res && res.success)) console.error('apiCheckMemberEmailForOAuth error:', res);
          setLoginFieldError(
            'oauthPreCheckEmailInput',
            getSafeErrorMessage(res, '名簿に登録されていないメールアドレスです。')
          );
        }
      })
      .withFailureHandler(err => {
        console.error('apiCheckMemberEmailForOAuth failure:', err);
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Google連携へ進む';
        }
        setLoginFieldError(
          'oauthPreCheckEmailInput',
          getSafeErrorMessage(err, '通信エラーが発生しました。通信環境をご確認の上、再度お試しください。')
        );
      })
      .apiCheckMemberEmailForOAuth(email);
  }
  window.handleOAuthPreCheckSubmit = handleOAuthPreCheckSubmit;

  /**
   * Google OAuth 認証を直接起動する (PWAネイティブフロー: GAS画面を完全バイパス)
   * @param {Event|null} e
   * @param {string} [loginHintEmail] - 事前確認済みアカウントのメアド
   */
  function startGoogleOAuthFlow(e, loginHintEmail) {
    if (e && e.preventDefault) e.preventDefault();
    const clientId = '578588983071-s1b4d5t2befflb29laviqfoo5mpdoldf.apps.googleusercontent.com';
    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'select_account consent'
    });

    const cleanHint = String(loginHintEmail || '').trim().toLowerCase();
    if (cleanHint) {
      params.set('login_hint', cleanHint);
    }

    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  }
  window.startGoogleOAuthFlow = startGoogleOAuthFlow;

  let oauthPendingEmail = '';
  let oauthPendingName = '';

  /**
   * 画面ロード時に Google OAuth からの直接リダイレクト（?code=...）があるか検証・自動処理
   */
  function checkOAuthCallbackOnLoad() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const err = urlParams.get('error');

    if (!code) {
      if (err) {
        history.replaceState(null, '', window.location.pathname + window.location.hash);
        console.error('Google OAuth callback error:', err);
        showAppAlert({ title: '認証エラー', message: 'Google認証がキャンセルされたか、認証に失敗しました。再度お試しください。', isError: true });
      }
      return false;
    }

    // URLから認可コードパラメータを即座に消去
    history.replaceState(null, '', window.location.pathname + window.location.hash);

    // ログイン画面のカードをローディング表示に切り替え
    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'flex';
    setLoginCardView('oauthLoadingOverlay');

    const redirectUri = window.location.origin + window.location.pathname;

    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          if (res.hasPassword) {
            // パスワード設定済み部員は即時自動ログイン
            window.currentUser = res.user;
            try {
              localStorage.setItem('fcb_auth_user', JSON.stringify(res.user));
            } catch (e) {}
            hideLoginScreen();
            loadAppInitialData();
            showAppAlert({ title: '連携完了', message: 'Googleカレンダーとの連携を完了しました！', icon: 'check_circle' });
          } else {
            // 新規登録部員はパスワード初期設定カードを表示
            openOAuthPasswordCard(res.email, res.name);
          }
        } else {
          setLoginCardView('loginCard');
          const msg = (res && res.error === 'NOT_IN_ROSTER')
            ? '認証されたGoogleアカウント（' + (res.email || '') + '）は名簿に登録されていません。管理者にメールアドレス登録を依頼してください。'
            : getSafeErrorMessage(res, '連携処理に失敗しました。しばらく経ってから再度お試しください。');
          showAppAlert({ title: '連携エラー', message: msg, isError: true });
        }
      })
      .withFailureHandler(fetchErr => {
        setLoginCardView('loginCard');
        console.error('apiExchangeOAuthCode failure:', fetchErr);
        showAppAlert({ title: '通信エラー', message: getSafeErrorMessage(fetchErr, '連携処理中に通信エラーが発生しました。通信環境をご確認の上、再度お試しください。'), isError: true });
      })
      .apiExchangeOAuthCode(code, redirectUri);

    return true;
  }

  function openOAuthPasswordCard(email, name) {
    oauthPendingEmail = email;
    oauthPendingName = name;

    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'flex';
    setLoginCardView('oauthPasswordCard');

    const nameEl = document.getElementById('oauthTargetName');
    const emailEl = document.getElementById('oauthTargetEmail');
    if (nameEl) nameEl.textContent = name || '登録部員';
    if (emailEl) emailEl.textContent = email;
  }

  function handleOAuthPasswordSubmit(e) {
    if (e) e.preventDefault();
    const pw1El = document.getElementById('oauthNewPwInput');
    const pw2El = document.getElementById('oauthConfirmPwInput');
    const globalMsg = document.getElementById('oauthPwGlobalMsg');
    const submitBtn = document.getElementById('oauthPwSubmitBtn');

    if (!pw1El || !pw2El) return;
    if (globalMsg) { globalMsg.textContent = ''; globalMsg.classList.add('hidden'); }

    const isNewPwValid = validateOAuthNewPwField();
    const isConfirmPwValid = validateOAuthConfirmPwField();
    if (!isNewPwValid || !isConfirmPwValid) {
      if (!isNewPwValid) {
        pw1El.focus();
      } else {
        pw2El.focus();
      }
      return;
    }
    const p1 = pw1El.value.trim();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '登録中...';
    }

    // Supabase Direct (0.1秒) でパスワードを保存
    google.script.run
      .withSuccessHandler(res => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '設定完了してログイン';
        }
        if (res && res.success && res.user) {
          window.currentUser = res.user;
          try {
            localStorage.setItem('fcb_auth_user', JSON.stringify(res.user));
          } catch (e) {}

          // パスワード設定完了カードを非表示＆入力値リセット
          setLoginCardView('loginCard');
          if (pw1El) pw1El.value = '';
          if (pw2El) pw2El.value = '';

          hideLoginScreen();
          loadAppInitialData();
        } else {
          if (globalMsg) {
            console.error('oauth password submit error:', res);
            globalMsg.textContent = getSafeErrorMessage(res, '登録に失敗しました。しばらく経ってから再度お試しください。');
            globalMsg.classList.remove('hidden');
            globalMsg.style.display = 'block';
          }
        }
      })
      .withFailureHandler(err => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '設定完了してログイン';
        }
        if (globalMsg) {
          console.error('oauth password submit failure:', err);
          globalMsg.textContent = getSafeErrorMessage(err, '通信エラーが発生しました。通信環境をご確認の上、再度お試しください。');
          globalMsg.classList.remove('hidden');
          globalMsg.style.display = 'block';
        }
      })
      .apiRegisterMember(oauthPendingEmail, p1);
  }
  window.handleOAuthPasswordSubmit = handleOAuthPasswordSubmit;

  /**
   * ログイン画面を表示
   */
  function showLoginScreen() {
    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'flex';
    switchToLoginCard();
    initLoginFormListeners();
  }

  /**
   * ログインカードを表示
   */
  function switchToLoginCard() {
    setLoginCardView('loginCard');

    const err = document.getElementById('loginErrorMsg');
    if (err) err.style.display = 'none';
    const globalErr = document.getElementById('oauthPwGlobalMsg');
    if (globalErr) {
      globalErr.textContent = '';
      globalErr.classList.add('hidden');
    }
    clearAllLoginFieldErrors();
  }
  window.switchToLoginCard = switchToLoginCard;

  /**
   * ログイン画面を非表示にする
   */
  function hideLoginScreen() {
    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'none';

    setLoginCardView('loginCard');
    clearAllLoginFieldErrors();
  }

  /**
   * ログインフォーム送信処理（メールアドレス照合）
   */
  function handleUserLogin(e) {
    if (e) e.preventDefault();

    const emailInput = document.getElementById('loginEmailInput');
    const pwInput = document.getElementById('loginPasswordInput');
    const rememberCheck = document.getElementById('rememberLoginCheck');
    const errorMsg = document.getElementById('loginErrorMsg');
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!emailInput || !pwInput) return;

    if (errorMsg) errorMsg.style.display = 'none';

    // 1. 各フィールドのバリデーション（フォーカスアウト時と同一ルール）
    const isEmailValid = validateLoginEmailField();
    const isPwValid = validateLoginPasswordField();

    if (!isEmailValid || !isPwValid) {
      if (!isEmailValid) {
        emailInput.focus();
      } else {
        pwInput.focus();
      }
      return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const password = pwInput.value.trim();

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'ログイン中...';
    }

    google.script.run
      .withSuccessHandler(res => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'ログイン';
        }

        if (res && res.success && res.user) {
          window.currentUser = res.user;

          // ログイン状態を保持する場合
          if (rememberCheck && rememberCheck.checked) {
            try {
              localStorage.setItem('fcb_auth_user', JSON.stringify(res.user));
            } catch (err) {}
          } else {
            try {
              localStorage.removeItem('fcb_auth_user');
            } catch (err) {}
          }

          hideLoginScreen();
          loadAppInitialData();
        } else {
          if (errorMsg) {
            console.error('apiLoginUser error:', res);
            errorMsg.textContent = getSafeErrorMessage(res, 'ログインに失敗しました。メールアドレスまたはパスワードをご確認ください。');
            errorMsg.style.display = 'block';
          }
        }
      })
      .withFailureHandler(err => {
        console.error('apiLoginUser failure:', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'ログイン';
        }
        if (errorMsg) {
          errorMsg.textContent = getSafeErrorMessage(err, '通信エラーが発生しました。通信環境をご確認の上、再度お試しください。');
          errorMsg.style.display = 'block';
        }
      })
      .apiLoginUser(email, password);
  }

  /**
   * 名前からポジション（FP/GK）を柔軟に照合するヘルパー
   */
  function findMatchingPosition(name, posMap) {
    if (!name || !posMap) return '';
    if (posMap[name]) return posMap[name];
    const clean = String(name || '').replace(/[\s\u3000]+/g, '');
    for (const k in posMap) {
      if (k.replace(/[\s\u3000]+/g, '') === clean) {
        return posMap[k];
      }
    }
    return '';
  }

  /**
   * アプリの主要データをサーバーから取得して各画面を初期化
   * @param {boolean} [forceRefresh=false] - キャッシュを破棄して最新データを強制取得するか
   * @param {Function} [onComplete] - 完了時コールバック (success, err) => void
   */
  function loadAppInitialData(forceRefresh = false, onComplete = null) {
    renderHeaderUser();

    google.script.run
      .withSuccessHandler(response => {
        if (!response) {
          handleError('eventSelect', 'サーバーからデータが返ってきませんでした。');
          if (typeof onComplete === 'function') onComplete(false, new Error('サーバー応答なし'));
          return;
        }

        let data = null;
        try {
          data = (typeof response === 'string') ? JSON.parse(response) : response;
        } catch (e) {
          handleError('eventSelect', 'データの復元に失敗しました。');
          if (typeof onComplete === 'function') onComplete(false, e);
          return;
        }

        if (!data || typeof data !== 'object') {
          handleError('eventSelect', '一時的なデータ取得エラーが発生しました。時間を置くか、再読み込みしてください。');
          if (typeof onComplete === 'function') onComplete(false, new Error('データ形式エラー'));
          return;
        }

        if (data.playerNumbers) window.playerNumberMap = data.playerNumbers;
        if (data.playerAvatars) {
          window.playerAvatarMap = data.playerAvatars;
          window.playerAvatars = data.playerAvatars;
          if (window.currentUser && window.currentUser.name && data.playerAvatars[window.currentUser.name]) {
            window.currentUser.avatarUrl = data.playerAvatars[window.currentUser.name];
            try { localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser)); } catch (e) {}
            renderHeaderUser();
          }
        }
        if (data.currentUser && data.currentUser.avatarUrl && window.currentUser) {
          window.currentUser.avatarUrl = data.currentUser.avatarUrl;
          try { localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser)); } catch (e) {}
          renderHeaderUser();
        }
        if (data.playerPositions) {
          window.playerPositionsMap = data.playerPositions;
          // 既存ログインセッションの currentUser に position がなければ自動補完
          if (window.currentUser && window.currentUser.name) {
            const pos = findMatchingPosition(window.currentUser.name, data.playerPositions);
            if (pos) {
              window.currentUser.position = pos;
              try {
                localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser));
              } catch (e) {}
            }
          }
        }

        if (data.calendarAttendance) {
          window.calendarAttendanceData = data.calendarAttendance;
          window.calendarAttendanceCache = window.calendarAttendanceCache || {};
          if (data.calendarAttendance.year) {
            window.calendarAttendanceCache[data.calendarAttendance.year] = data.calendarAttendance;
          }
        }

        window.initialFullData = data;
        if (data.adminRoster && Array.isArray(data.adminRoster)) {
          window.adminMemberList = data.adminRoster;
        }

        if (data.roster) {
          window.scheduleRoster = data.roster;
          // ログイン中ユーザーの最新情報（メアド、Google連携状態、ロール等）を名簿と同期
          if (window.currentUser && window.currentUser.name) {
            const currentCleanName = String(window.currentUser.name).replace(/[\s\u3000]+/g, '').toLowerCase();
            const matchedMember = data.roster.find(m => String(m.name).replace(/[\s\u3000]+/g, '').toLowerCase() === currentCleanName);
            if (matchedMember) {
              window.currentUser.memberId = matchedMember.id || matchedMember.memberId || '';
              window.currentUser.id = matchedMember.id || matchedMember.memberId || '';
              window.currentUser.email = matchedMember.email || '';
              window.currentUser.hasCalendarLink = !!matchedMember.hasCalendarLink;
              if (matchedMember.role) window.currentUser.role = matchedMember.role;
              if (matchedMember.number !== undefined && matchedMember.number !== 999) {
                window.currentUser.number = matchedMember.number;
              }
              try {
                localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser));
              } catch (e) {}
            }
          }
        }

        updateAdminNavVisibility();

        if (data.equipmentData) {
          window.initialFullData = window.initialFullData || {};
          window.initialFullData.equipmentData = data.equipmentData;
          if (typeof applyEquipmentPayload === 'function') {
            applyEquipmentPayload(data.equipmentData);
          }
        }

        // 活動記録データを初期化の直前に適用（ホーム画面やカレンダー表示と完全に同期させ、後追い遅延を排除）
        if (data.bulletinData) {
          if (typeof applyBulletinPayload === 'function') {
            applyBulletinPayload(data.bulletinData);
          }
        } else {
          try { if (typeof loadBulletinData === 'function') loadBulletinData(true); } catch (e) { console.error('Bulletin Init Error:', e); }
        }

        // 各機能の初期化処理を呼び出す
        try { if (typeof initHomeView === 'function') initHomeView(data); } catch (e) { console.error('Home Init Error:', e); }
        try { if (data.history) initMatchHistory(data.history); } catch (e) { console.error('History Init Error:', e); }
        try { if (data.stats) initStats(data.stats); } catch (e) { console.error('Stats Init Error:', e); }
        try { if (data.events) initEvents(data.events); } catch (e) { console.error('Events Init Error:', e); }
        try { if (typeof initScheduleView === 'function') initScheduleView(data.events, data.roster); } catch (e) { console.error('Schedule Init Error:', e); }
        try { if (typeof initPersonalView === 'function') initPersonalView(); } catch (e) { console.error('Personal Init Error:', e); }
        try { if (typeof initMembersView === 'function' && isCurrentUserAdmin()) initMembersView(data.adminRoster || data.roster); } catch (e) { console.error('Members Init Error:', e); }
        try { if (typeof initEquipmentView === 'function') initEquipmentView(); } catch (e) { console.error('Equipment Init Error:', e); }

        revealAllTabContents();

        // 画面更新前のタブを復元（描画初期化を含む）
        const restoredTab = getSavedActiveTab();
        if (restoredTab && restoredTab !== 'home') {
          switchTab(restoredTab);
        } else {
          scrollActiveNavItemIntoView(false);
        }

        // Googleアカウント未連携チェック（メールアドレスが登録されているがGoogle未連携の場合、強制モーダルを表示）
        checkForceGoogleAuth();

        if (typeof onComplete === 'function') onComplete(true);
      })
      .withFailureHandler(err => {
        console.error('getInitialData failure:', err);
        const safeErrMsg = getSafeErrorMessage(err, '通信環境をご確認の上、画面を再読み込みしてください。');
        const resultsList = document.getElementById('resultsList');
        if (resultsList) {
          resultsList.innerHTML = '<div class="card-box error-box">データの取得に失敗しました<br><span class="error-sub">' + escapeHtml(safeErrMsg) + '</span></div>';
        }
        handleError('eventSelect', 'データ初期取得エラー: ' + safeErrMsg);
        if (typeof onComplete === 'function') onComplete(false, err);
      })
      .getInitialData(forceRefresh);
  }

  /**
   * パスワード変更メッセージを設定
   */
  function setPwMsg(msg, state) {
    const msgEl = document.getElementById('changePwMsg');
    if (!msgEl) return;
    if (!msg) {
      msgEl.textContent = '';
      msgEl.className = 'pw-msg';
      return;
    }
    msgEl.textContent = msg;
    msgEl.className = 'pw-msg ' + (state === 'success' ? 'pw-msg-success' : 'pw-msg-error');
  }

  /**
   * パスワード変更フォームの表示切り替え
   */
  function togglePwChangeForm() {
    const btn = document.getElementById('showPwChangeBtn');
    const formArea = document.getElementById('pwChangeFormArea');
    if (btn) btn.classList.add('hidden');
    if (formArea) formArea.classList.remove('hidden');
  }

  /**
   * パスワード変更処理
   */
  function handlePasswordChange() {
    const u = window.currentUser;
    if (!u) return;

    const currentPwInput = document.getElementById('currentPwInput');
    const newPwInput = document.getElementById('newPwInput');
    const confirmPwInput = document.getElementById('confirmNewPwInput');

    if (!currentPwInput || !newPwInput || !confirmPwInput) return;

    const currentPw = currentPwInput.value.trim();
    const newPw = newPwInput.value.trim();
    const confirmPw = confirmPwInput.value.trim();

    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg('すべてのパスワード項目を入力してください。', 'error');
      return;
    }

    if (newPw.length < 4) {
      setPwMsg('新しいパスワードは4文字以上で設定してください。', 'error');
      return;
    }

    if (newPw !== confirmPw) {
      setPwMsg('新しいパスワードと確認用パスワードが一致しません。', 'error');
      return;
    }

    setPwMsg('更新中...', 'loading');

    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          setPwMsg('パスワードを更新しました。', 'success');
          currentPwInput.value = '';
          newPwInput.value = '';
          confirmPwInput.value = '';
        } else {
          console.error('apiChangePassword error:', res);
          setPwMsg(getSafeErrorMessage(res, '更新に失敗しました。しばらく経ってから再度お試しください。'), 'error');
        }
      })
      .withFailureHandler(err => {
        console.error('apiChangePassword failure:', err);
        setPwMsg(getSafeErrorMessage(err, '通信エラーが発生しました。通信環境をご確認の上、再度お試しください。'), 'error');
      })
      .apiChangePassword(u.name, currentPw, newPw);
  }

  /**
   * 通知設定の初期化・UI反映
   */
  function initProfileNotificationSettings() {
    const u = window.currentUser || {};
    const notifType = u.notificationType || 'none';
    const notifySettings = u.notifySettings || { emergency: true, attendance: true, bulletin: true };

    // ラジオボタンの選択
    const radios = document.querySelectorAll('input[name="profileNotifType"]');
    radios.forEach(r => {
      r.checked = (r.value === notifType);
      const card = r.closest('.notif-radio-card');
      if (card) {
        if (r.checked) card.classList.add('selected');
        else card.classList.remove('selected');
      }
    });

    // チェックボックスの選択
    const itemEmg = document.getElementById('notifItemEmergency');
    const itemAtt = document.getElementById('notifItemAttendance');
    const itemBul = document.getElementById('notifItemBulletin');
    if (itemEmg) itemEmg.checked = notifySettings.emergency !== false;
    if (itemAtt) itemAtt.checked = notifySettings.attendance !== false;
    if (itemBul) itemBul.checked = notifySettings.bulletin !== false;

    // ステータスバッジの更新
    updateNotificationBadges();

    // アクションエリアの表示切り替え
    handleNotifTypeChange(notifType);

    // メッセージリセット
    const msgEl = document.getElementById('notifSaveMsg');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.className = 'notif-status-msg hidden';
    }
    setProfileLineMsg('');

    // サーバーから最新設定を取得（非同期で同期）
    if (typeof google !== 'undefined' && google.script && google.script.run && (u.name || u.email)) {
      google.script.run
        .withSuccessHandler(res => {
          if (res && res.success && res.settings) {
            const s = res.settings;
            u.notificationType = s.notificationType || 'none';
            u.lineLinked = !!s.lineLinked;
            u.pushLinked = !!s.pushLinked;
            u.lineLinkCode = s.linkCode || '';
            u.notifySettings = s.notifySettings || { emergency: true, attendance: true, bulletin: true };
            try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch(e) {}
            
            radios.forEach(r => {
              r.checked = (r.value === u.notificationType);
              const card = r.closest('.notif-radio-card');
              if (card) {
                if (r.checked) card.classList.add('selected');
                else card.classList.remove('selected');
              }
            });
            if (itemEmg) itemEmg.checked = u.notifySettings.emergency !== false;
            if (itemAtt) itemAtt.checked = u.notifySettings.attendance !== false;
            if (itemBul) itemBul.checked = u.notifySettings.bulletin !== false;
            updateNotificationBadges();
            handleNotifTypeChange(u.notificationType);
            syncProfileLineUi();
          }
        })
        .apiGetNotificationSettings(u.name, u.email);
    }
  }

  /**
   * バッジ（LINE連携・端末通知許可）の表示更新
   */
  function updateNotificationBadges() {
    const u = window.currentUser || {};
    
    // LINEバッジ
    const lineBadge = document.getElementById('notifBadgeLine');
    if (lineBadge) {
      if (u.lineLinked) {
        lineBadge.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>連携済</span>';
        lineBadge.className = 'notif-status-badge badge-verified';
      } else {
        lineBadge.textContent = '未連携';
        lineBadge.className = 'notif-status-badge badge-gray';
      }
    }

    // Pushバッジ
    const pushBadge = document.getElementById('notifBadgePush');
    if (pushBadge) {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          pushBadge.innerHTML = '<span class="material-symbols-outlined">check_circle</span><span>許可済</span>';
          pushBadge.className = 'notif-status-badge badge-verified';
        } else if (Notification.permission === 'denied') {
          pushBadge.textContent = 'ブロック中';
          pushBadge.className = 'notif-status-badge badge-gray';
        } else {
          pushBadge.textContent = '未許可';
          pushBadge.className = 'notif-status-badge badge-gray';
        }
      } else {
        pushBadge.textContent = '非対応端末';
        pushBadge.className = 'notif-status-badge badge-gray';
      }
    }
  }

  function setProfileNotifMsg(msg, isSuccess = true) {
    const msgEl = document.getElementById('notifSaveMsg');
    if (!msgEl) return;
    if (!msg) {
      msgEl.textContent = '';
      msgEl.className = 'notif-status-msg hidden';
      return;
    }
    msgEl.textContent = msg;
    msgEl.className = 'notif-status-msg ' + (isSuccess ? 'success' : 'error');
    msgEl.classList.remove('hidden');
  }

  function setProfileLineMsg(msg, type = 'info') {
    const msgEl = document.getElementById('profileLineStatusMsg');
    if (!msgEl) return;
    if (!msg) {
      msgEl.textContent = '';
      msgEl.className = 'profile-line-msg hidden';
      return;
    }
    msgEl.textContent = msg;
    msgEl.className = 'profile-line-msg ' + (type === 'success' || type === 'error' ? type : 'info');
    msgEl.classList.remove('hidden');
  }

  function isLineMobileEnv() {
    if (window.SupabaseLinePush && typeof window.SupabaseLinePush.isMobileBrowser === 'function') {
      return window.SupabaseLinePush.isMobileBrowser();
    }
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  }

  function syncProfileLineUi() {
    const u = window.currentUser || {};
    const isLinked = !!u.lineLinked;
    const isMobile = isLineMobileEnv();
    const unlinkedArea = document.getElementById('profileLineUnlinkedArea');
    const linkedArea = document.getElementById('profileLineLinkedArea');
    const codeBox = document.getElementById('profileLineCodeBox');
    const codeText = document.getElementById('profileLineCodeText');
    const openOaLink = document.getElementById('btnProfileLineOpenOa');
    const openOaLabel = document.getElementById('btnProfileLineOpenLabel');
    const guideEl = document.getElementById('profileLineGuideText');

    if (unlinkedArea) unlinkedArea.classList.toggle('hidden', isLinked);
    if (linkedArea) linkedArea.classList.toggle('hidden', !isLinked);

    if (guideEl) {
      guideEl.textContent = isMobile
        ? '※ボタンを押して連携コードを発行し、「LINEを開く（入力済み）」からLINEトークへそのまま送信してください。'
        : '※PCからは「LINEを開く（QR表示）」でスマホから友だち追加し、発行した連携コードをコピーしてLINEトークへ送信してください。';
    }

    if (!isLinked && u.lineLinkCode) {
      if (codeText) codeText.textContent = u.lineLinkCode;
      if (openOaLink) {
        openOaLink.href = (window.SupabaseLinePush && window.SupabaseLinePush.getLineOpenUrl)
          ? window.SupabaseLinePush.getLineOpenUrl(u.lineLinkCode)
          : (isMobile
            ? `https://line.me/R/oaMessage/%40377avqrr/?${encodeURIComponent(u.lineLinkCode)}`
            : 'https://line.me/R/ti/p/%40377avqrr');
      }
      if (openOaLabel) {
        openOaLabel.textContent = isMobile ? 'LINEを開く（入力済み）' : 'LINEを開く（QR表示）';
      }
      if (codeBox) codeBox.classList.remove('hidden');
    } else if (codeBox) {
      codeBox.classList.add('hidden');
    }
  }

  /**
   * 通知タイプ変更時のアクション表示制御（選択カード直下に配置）
   */
  function handleNotifTypeChange(val) {
    const u = window.currentUser || {};
    const radios = document.querySelectorAll('input[name="profileNotifType"]');
    radios.forEach(r => {
      const card = r.closest('.notif-radio-card');
      if (card) {
        if (r.value === val) card.classList.add('selected');
        else card.classList.remove('selected');
      }
    });

    const lineWrap = document.getElementById('notifActionLineWrap');
    const pushWrap = document.getElementById('notifActionPushWrap');
    const targetBox = document.getElementById('notifTargetBox');
    const cardLine = document.getElementById('notifCardLine');
    const cardPush = document.getElementById('notifCardPush');
    const cardBoth = document.getElementById('notifCardBoth');

    if (val === 'none') {
      if (lineWrap) lineWrap.classList.add('hidden');
      if (pushWrap) pushWrap.classList.add('hidden');
      if (targetBox) targetBox.classList.add('opacity-50');
      return;
    }

    if (targetBox) targetBox.classList.remove('opacity-50');

    const isPushGranted = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    const showLineAction = (val === 'line' || val === 'both');
    const showPushAction = (val === 'push' || val === 'both') && !isPushGranted;

    if (lineWrap) {
      if (showLineAction) {
        const anchor = (val === 'both' && cardBoth) ? cardBoth : cardLine;
        if (anchor && anchor.nextElementSibling !== lineWrap) {
          anchor.insertAdjacentElement('afterend', lineWrap);
        }
        lineWrap.classList.remove('hidden');
        syncProfileLineUi();
      } else {
        lineWrap.classList.add('hidden');
      }
    }

    if (pushWrap) {
      if (showPushAction) {
        const anchor = (val === 'both' && cardBoth)
          ? (showLineAction && lineWrap ? lineWrap : cardBoth)
          : cardPush;
        if (anchor && anchor.nextElementSibling !== pushWrap) {
          anchor.insertAdjacentElement('afterend', pushWrap);
        }
        pushWrap.classList.remove('hidden');
      } else {
        pushWrap.classList.add('hidden');
      }
    }
  }

  /**
   * 端末のプッシュ通知許可リクエスト＆Web Push購読保存
   */
  async function handlePushPermissionRequest() {
    if (typeof Notification === 'undefined') {
      showAppAlert({ title: '非対応環境', message: 'お使いのブラウザ・端末はプッシュ通知に対応していません。', icon: 'notifications_off' });
      return;
    }

    const currentVal = document.querySelector('input[name="profileNotifType"]:checked')?.value || 'push';

    if (window.SupabaseWebPush && typeof window.SupabaseWebPush.subscribeAndSave === 'function') {
      try {
        await window.SupabaseWebPush.subscribeAndSave(window.currentUser || {});
        if (window.currentUser) {
          window.currentUser.pushLinked = true;
          try { localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser)); } catch (e) {}
        }
        updateNotificationBadges();
        handleNotifTypeChange(currentVal);
        setProfileNotifMsg('この端末のプッシュ通知を有効化しました', true);
        if (typeof window.refreshHomePushMockState === 'function') {
          window.refreshHomePushMockState();
        }
      } catch (err) {
        console.error('Push notification enable error:', err);
        updateNotificationBadges();
        handleNotifTypeChange(currentVal);
        const msg = getSafeErrorMessage(err, 'プッシュ通知の有効化に失敗しました。');
        const isDenied = (typeof Notification !== 'undefined' && Notification.permission === 'denied');
        showAppAlert({
          title: isDenied ? '通知ブロック' : '通知設定エラー',
          message: msg,
          isError: true
        });
      }
      return;
    }

    Notification.requestPermission().then(permission => {
      updateNotificationBadges();
      handleNotifTypeChange(currentVal);

      if (permission === 'denied') {
        showAppAlert({ title: '通知ブロック', message: 'ブラウザの設定で通知がブロックされています。ブラウザの設定から通知を許可してください。', isError: true });
      }
    }).catch(err => {
      console.error('Push permission error:', err);
    });
  }

  /**
   * LINE連携コード発行
   */
  async function handleLineConnectClick() {
    const u = window.currentUser;
    if (!u || !window.SupabaseLinePush) {
      showAppAlert({ title: 'LINE連携エラー', message: 'LINE連携モジュールが読み込まれていません。ページを再読み込みしてください。', isError: true });
      return;
    }

    const btn = document.getElementById('btnProfileLineConnect');
    const prevHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'コード発行中...';
    }

    try {
      const res = await window.SupabaseLinePush.issueLinkCode(u);
      u.lineLinked = false;
      u.lineLinkCode = res.code;
      try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch (e) {}

      syncProfileLineUi();
      const currentVal = document.querySelector('input[name="profileNotifType"]:checked')?.value || 'line';
      handleNotifTypeChange(currentVal);
      const issuedMsg = isLineMobileEnv()
        ? `コード「${res.code}」を発行しました。「LINEを開く（入力済み）」からそのまま送信し、戻ってから「連携確認」を押してください。`
        : `コード「${res.code}」を発行しました。「コピー」してからスマホのLINEトークへ送信し、「連携確認」を押してください。`;
      setProfileLineMsg(issuedMsg, 'success');
      if (typeof window.refreshHomeLineMockState === 'function') {
        window.refreshHomeLineMockState(false);
      }
    } catch (err) {
      console.error('issueLinkCode failure:', err);
      setProfileLineMsg(getSafeErrorMessage(err, '連携コードの発行に失敗しました。しばらく経ってから再度お試しください。'), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
      }
    }
  }

  /**
   * LINE連携コードコピー
   */
  async function handleProfileLineCopyCode() {
    const codeText = document.getElementById('profileLineCodeText');
    const code = codeText ? codeText.textContent.trim() : '';
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setProfileLineMsg(`コード「${code}」をコピーしました。LINEトークに貼り付けて送信してください。`, 'success');
    } catch (e) {
      setProfileLineMsg(`コード「${code}」をLINEトークへ送信してください。`, 'info');
    }
  }

  /**
   * LINE連携状態を再確認
   */
  async function handleProfileLineRefresh() {
    const u = window.currentUser;
    if (!u || !window.SupabaseLinePush) return;

    try {
      const status = await window.SupabaseLinePush.getLineLinkStatus(u);
      u.lineLinked = !!status.linked;
      u.lineLinkCode = status.linked ? '' : (status.linkCode || '');
      try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch (e) {}

      updateNotificationBadges();
      syncProfileLineUi();
      const currentVal = document.querySelector('input[name="profileNotifType"]:checked')?.value || 'line';
      handleNotifTypeChange(currentVal);
      if (typeof window.refreshHomeLineMockState === 'function') {
        window.refreshHomeLineMockState(false);
      }

      if (status.linked) {
        setProfileLineMsg('');
      } else {
        setProfileLineMsg('まだ連携が確認できていません。LINEトークへコード送信後に再度お試しください。', 'error');
      }
    } catch (err) {
      console.error('getLineLinkStatus failure:', err);
      setProfileLineMsg(getSafeErrorMessage(err, '連携状態の確認に失敗しました。しばらく経ってから再度お試しください。'), 'error');
    }
  }

  /**
   * LINE連携解除（テスト用）
   */
  async function handleProfileLineUnlink() {
    const u = window.currentUser;
    if (!u || !window.SupabaseLinePush) return;

    const btn = document.getElementById('btnProfileLineUnlink');
    if (btn) btn.disabled = true;

    try {
      await window.SupabaseLinePush.unlinkLine(u);
      u.lineLinked = false;
      u.lineLinkCode = '';
      try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch (e) {}

      updateNotificationBadges();
      syncProfileLineUi();
      const currentVal = document.querySelector('input[name="profileNotifType"]:checked')?.value || 'line';
      handleNotifTypeChange(currentVal);
      if (typeof window.refreshHomeLineMockState === 'function') {
        window.refreshHomeLineMockState(false);
      }
      setProfileLineMsg('LINEの連携を解除しました。', 'info');
    } catch (err) {
      console.error('unlinkLine failure:', err);
      setProfileLineMsg(getSafeErrorMessage(err, '連携解除に失敗しました。しばらく経ってから再度お試しください。'), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /**
   * 通知設定保存処理
   */
  function handleSaveNotificationSettings() {
    const u = window.currentUser;
    if (!u) return;

    const checkedRadio = document.querySelector('input[name="profileNotifType"]:checked');
    const notifType = checkedRadio ? checkedRadio.value : 'none';

    const itemEmg = document.getElementById('notifItemEmergency');
    const itemAtt = document.getElementById('notifItemAttendance');
    const itemBul = document.getElementById('notifItemBulletin');

    const notifySettings = {
      emergency: itemEmg ? itemEmg.checked : true,
      attendance: itemAtt ? itemAtt.checked : true,
      bulletin: itemBul ? itemBul.checked : true
    };

    const payload = {
      notificationType: notifType,
      notifySettings: notifySettings
    };

    const btn = document.getElementById('btnSaveNotificationSettings');
    const msgEl = document.getElementById('notifSaveMsg');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '保存中...';
    }
    if (msgEl) {
      msgEl.className = 'notif-status-msg hidden';
    }

    const onComplete = (success, msg) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '通知設定を保存';
      }
      if (msgEl) {
        msgEl.textContent = msg;
        msgEl.className = 'notif-status-msg ' + (success ? 'success' : 'error');
        msgEl.classList.remove('hidden');
      }
      if (success) {
        u.notificationType = notifType;
        u.notifySettings = notifySettings;
        try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch(e) {}
      }
    };

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(res => {
          if (res && res.success) {
            onComplete(true, res.message || '通知設定を保存しました');
          } else {
            console.error('apiSaveNotificationSettings error:', res);
            onComplete(false, getSafeErrorMessage(res, '保存に失敗しました。しばらく経ってから再度お試しください。'));
          }
        })
        .withFailureHandler(err => {
          console.error('apiSaveNotificationSettings failure:', err);
          onComplete(false, getSafeErrorMessage(err, '通信エラーが発生しました。通信環境をご確認の上、再度お試しください。'));
        })
        .apiSaveNotificationSettings(payload, u.name, u.email);
    } else {
      setTimeout(() => {
        onComplete(true, 'モック: 通知設定を保存しました');
      }, 400);
    }
  }

  window.openUserSettingsModal = openUserSettingsModal;
  window.backToUserProfileModal = backToUserProfileModal;
  window.closeUserSettingsModal = closeUserSettingsModal;
  window.handleNotifTypeChange = handleNotifTypeChange;
  window.handlePushPermissionRequest = handlePushPermissionRequest;
  window.handleLineConnectClick = handleLineConnectClick;
  window.handleProfileLineCopyCode = handleProfileLineCopyCode;
  window.handleProfileLineRefresh = handleProfileLineRefresh;
  window.handleProfileLineUnlink = handleProfileLineUnlink;
  window.handleSaveNotificationSettings = handleSaveNotificationSettings;

  /**
   * ヘッダーのユーザー情報描画
   */
  function renderHeaderUser() {
    const pcInfo = document.getElementById('headerUserInfo');
    const pcNameText = document.getElementById('headerUserNameText');
    const mobileInfo = document.getElementById('headerUserInfoMobile');

    const u = window.currentUser;
    const avatarUrl = typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(u) : ((u && u.avatarUrl) || (u && window.playerAvatarMap && window.playerAvatarMap[u.name]) || '');

    // スマホヘッダーのアイコン／画像切り替え
    const mobileIcon = document.getElementById('headerUserIcon');
    const mobileImg = document.getElementById('headerUserAvatarImgMobile');
    if (mobileImg && mobileIcon) {
      if (avatarUrl) {
        mobileImg.src = avatarUrl;
        mobileImg.classList.remove('hidden');
        mobileIcon.classList.add('hidden');
      } else {
        mobileImg.classList.add('hidden');
        mobileIcon.classList.remove('hidden');
      }
    }

    // PCサイドバーのアイコン／画像切り替え
    const sidebarIcon = document.getElementById('sidebarUserIcon');
    const sidebarImg = document.getElementById('sidebarUserAvatarImg');
    if (sidebarImg && sidebarIcon) {
      if (avatarUrl) {
        sidebarImg.src = avatarUrl;
        sidebarImg.classList.remove('hidden');
        sidebarIcon.classList.add('hidden');
      } else {
        sidebarImg.classList.add('hidden');
        sidebarIcon.classList.remove('hidden');
      }
    }
    
    if (u && u.name) {
      if (pcNameText) pcNameText.textContent = u.name;
      if (mobileInfo) mobileInfo.classList.remove('hidden');
    } else {
      if (pcNameText) pcNameText.textContent = 'プロフィール';
      if (mobileInfo) mobileInfo.classList.add('hidden');
    }

    try { if (typeof renderHomePlayerHeader === 'function') renderHomePlayerHeader(); } catch (e) {}

    updateAdminNavVisibility();
  }

  /**
   * ログイン中ユーザーが代表または副代表であるかチェック
   * @returns {boolean}
   */
  function isCurrentUserAdmin() {
    const u = window.currentUser;
    if (!u) return false;
    const directRole = String(u.role || '').trim();
    if (directRole === '代表' || directRole === '副代表') return true;

    // rosterリストから最新の役割を逆引き補完
    const roster = window.scheduleRoster || window.adminMemberList;
    if (roster && Array.isArray(roster)) {
      const uEmail = String(u.email || '').trim().toLowerCase();
      const uName = String(u.name || '').trim();
      const match = roster.find(m => 
        (uEmail && m.email && String(m.email).trim().toLowerCase() === uEmail) ||
        (uName && m.name && String(m.name).trim() === uName)
      );
      if (match && match.role) {
        const mRole = String(match.role).trim();
        if (mRole === '代表' || mRole === '副代表') {
          u.role = mRole;
          try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch(e) {}
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 管理者専用ナビゲーション項目の表示・非表示を制御
   */
  function updateAdminNavVisibility() {
    const navItem = document.getElementById('navItemMembers');
    if (!navItem) return;
    if (isCurrentUserAdmin()) {
      navItem.classList.remove('hidden');
    } else {
      navItem.classList.add('hidden');
    }
  }

  /**
   * プロフィールモーダル内のアバター表示更新
   */
  function updateProfileModalAvatar(avatarUrl) {
    const box = document.getElementById('profileAvatarBox');
    const img = document.getElementById('profileAvatarImg');
    const placeholder = document.getElementById('profileAvatarPlaceholder');
    const btnDelete = document.getElementById('btnDeleteAvatar');

    if (avatarUrl) {
      if (img) {
        img.src = avatarUrl;
        img.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnDelete) btnDelete.classList.remove('hidden');
      if (box) {
        box.style.border = '2px solid #cbd5e1';
        box.title = 'タップして写真を拡大';
      }
    } else {
      if (img) {
        img.src = '';
        img.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (btnDelete) btnDelete.classList.add('hidden');
      if (box) {
        box.style.border = '2px dashed #cbd5e1';
        box.title = '写真を選択';
      }
    }
  }

  /**
   * アバターアップロード状態メッセージ表示
   */
  function showAvatarStatus(msg, state) {
    const el = document.getElementById('avatarUploadStatus');
    if (!el) return;
    if (!msg) {
      el.textContent = '';
      el.className = 'avatar-upload-status hidden';
      return;
    }
    el.textContent = msg;
    el.className = 'avatar-upload-status ' + (state || '');
    el.classList.remove('hidden');
  }

  /**
   * プロフィール画像ファイル選択時の処理（正方形クロップ＋リサイズ＋アップロード）
   */
  function handleProfileImageSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!window.currentUser || !window.currentUser.name) {
      showAppAlert({ title: 'エラー', message: 'ログインユーザーが特定できません。', isError: true });
      return;
    }

    if (!file.type.startsWith('image/')) {
      showAppAlert({ title: 'ファイル形式', message: '画像ファイルを選択してください。', icon: 'image' });
      return;
    }

    showAvatarStatus('画像処理中...', 'uploading');

    const reader = new FileReader();
    reader.onload = function (readerEvent) {
      const img = new Image();
      img.onload = function () {
        // 中央を正方形にクロップし、256x256にリサイズ
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        const targetSize = 256;

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

        const base64 = canvas.toDataURL('image/jpeg', 0.85);

        // クライアント側で即時プレビュー表示
        updateProfileModalAvatar(base64);
        showAvatarStatus('ドライブへ保存中...', 'uploading');

        // inputの値をリセットして再選択可能に
        e.target.value = '';

        // Google Driveへ保存
        google.script.run
          .withSuccessHandler(res => {
            if (res && res.success) {
              const newUrl = res.avatarUrl;
              if (window.currentUser) {
                window.currentUser.avatarUrl = newUrl;
                try { localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser)); } catch (err) {}
              }
              window.playerAvatarMap = window.playerAvatarMap || {};
              window.playerAvatarMap[window.currentUser.name] = newUrl;

              updateProfileModalAvatar(newUrl);
              renderHeaderUser();

              // 他の画面（ランキング・スタッツ）の表示も最新化
              try { if (typeof filterAndRenderRanking === 'function') filterAndRenderRanking(); } catch (err) {}
              try { if (typeof renderPersonalTable === 'function') renderPersonalTable(); } catch (err) {}

              showAvatarStatus('プロフィール写真を保存しました', 'success');
              setTimeout(() => { showAvatarStatus('', ''); }, 3500);
            } else {
              console.error('apiSaveProfileImage error:', res);
              showAvatarStatus(getSafeErrorMessage(res, '保存に失敗しました。しばらく経ってから再度お試しください。'), 'error');
            }
          })
          .withFailureHandler(err => {
            console.error('apiSaveProfileImage failure:', err);
            showAvatarStatus(getSafeErrorMessage(err, '通信エラーが発生しました。通信環境をご確認の上、再度お試しください。'), 'error');
          })
          .apiSaveProfileImage(window.currentUser.name, base64);
      };
      img.onerror = function () {
        showAvatarStatus('画像の読み込みに失敗しました。', 'error');
      };
      img.src = readerEvent.target.result;
    };
    reader.onerror = function () {
      showAvatarStatus('ファイルの読み込みに失敗しました。', 'error');
    };
    reader.readAsDataURL(file);
  }

  /**
   * プロフィール画像削除処理
   */
  async function handleProfileImageDelete() {
    if (!window.currentUser || !window.currentUser.name) return;
    const ok = await showAppConfirm({
      title: '写真の削除',
      message: 'プロフィール写真を削除しますか？',
      okText: '削除する',
      cancelText: 'キャンセル',
      isDanger: true,
      icon: 'delete'
    });
    if (!ok) return;

    showAvatarStatus('削除中...', 'uploading');

    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          if (window.currentUser) {
            window.currentUser.avatarUrl = '';
            try { localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser)); } catch (err) {}
          }
          if (window.playerAvatarMap && window.playerAvatarMap[window.currentUser.name]) {
            delete window.playerAvatarMap[window.currentUser.name];
          }

          updateProfileModalAvatar('');
          renderHeaderUser();

          try { if (typeof filterAndRenderRanking === 'function') filterAndRenderRanking(); } catch (err) {}
          try { if (typeof renderPersonalTable === 'function') renderPersonalTable(); } catch (err) {}

          showAvatarStatus('プロフィール写真を削除しました', 'success');
          setTimeout(() => { showAvatarStatus('', ''); }, 3000);
        } else {
          console.error('apiDeleteProfileImage error:', res);
          showAvatarStatus(getSafeErrorMessage(res, '削除に失敗しました。しばらく経ってから再度お試しください。'), 'error');
        }
      })
      .withFailureHandler(err => {
        console.error('apiDeleteProfileImage failure:', err);
        showAvatarStatus(getSafeErrorMessage(err, '通信エラーが発生しました。通信環境をご確認の上、再度お試しください。'), 'error');
      })
      .apiDeleteProfileImage(window.currentUser.name);
  }

  /**
   * プロフィールモーダルを開く
   */
  function openUserProfileModal() {
    const u = window.currentUser;
    if (!u) return;

    const nameEl = document.getElementById('profileName');
    const numEl = document.getElementById('profileNumber');
    const posEl = document.getElementById('profilePosition');
    const emailEl = document.getElementById('profileEmail');

    if (nameEl) nameEl.textContent = u.name || '-';
    if (numEl) numEl.textContent = (u.number && u.number !== 999) ? (String(u.number).startsWith('#') ? u.number : '#' + u.number) : '-';

    // プロフィール写真の表示初期化
    const avatarUrl = typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(u) : ((u && u.avatarUrl) || (u && window.playerAvatarMap && window.playerAvatarMap[u.name]) || '');
    updateProfileModalAvatar(avatarUrl);
    showAvatarStatus('', '');

    // ポジション表示（u.position または window.playerPositionsMap から取得）
    let posVal = u.position || '';
    if (!posVal && window.playerPositionsMap && u.name) {
      posVal = findMatchingPosition(u.name, window.playerPositionsMap);
      if (posVal) {
        u.position = posVal;
        try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch(e) {}
      }
    }
    if (posEl) {
      posEl.textContent = posVal || '-';
      if (posVal === 'GK') {
        posEl.className = 'profile-value font-bold pos-badge pos-badge-gk';
      } else if (posVal === 'FP') {
        posEl.className = 'profile-value font-bold pos-badge pos-badge-fp';
      } else {
        posEl.className = 'profile-value font-bold';
      }
    }

    // まだポジションが取得できていない場合、サーバーから直接最新ポジションを取得して画面を即時更新
    if (!posVal && u.name) {
      google.script.run
        .withSuccessHandler(positions => {
          if (positions) {
            window.playerPositionsMap = positions;
            const p = findMatchingPosition(u.name, positions);
            if (p) {
              u.position = p;
              try { localStorage.setItem('fcb_auth_user', JSON.stringify(u)); } catch(e) {}
              if (posEl) {
                posEl.textContent = p;
                posEl.className = 'profile-value font-bold pos-badge ' + (p === 'GK' ? 'pos-badge-gk' : 'pos-badge-fp');
              }
            }
          }
        })
        .apiGetPlayerPositions();
    }

    if (emailEl) emailEl.textContent = u.email || '-';

    const settingsModal = document.getElementById('userSettingsModal');
    if (settingsModal) settingsModal.classList.remove('active');

    const modal = document.getElementById('userProfileModal');
    if (modal) {
      modal.classList.add('active');
      const bodyEl = modal.querySelector('.profile-modal-body');
      if (bodyEl) bodyEl.scrollTop = 0;
    }
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    else document.body.classList.add('no-scroll');
  }

  /**
   * プロフィールモーダルを閉じる
   */
  function closeUserProfileModal(e) {
    if (e && e.target && e.target.closest('.profile-modal-content') && !e.target.closest('.modal-close') && !e.target.closest('.btn-cancel-action')) {
      return;
    }
    const modal = document.getElementById('userProfileModal');
    if (modal) modal.classList.remove('active');
    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
    else document.body.classList.remove('no-scroll');
  }

  /**
   * 設定モーダルを開く（プロフィールモーダルから遷移）
   */
  function openUserSettingsModal(e) {
    if (e) e.stopPropagation();
    const u = window.currentUser;
    if (!u) return;

    const profileModal = document.getElementById('userProfileModal');
    if (profileModal) profileModal.classList.remove('active');

    setPwMsg('', '');

    // パスワード変更フォームの初期状態をリセット
    const showBtn = document.getElementById('showPwChangeBtn');
    const formArea = document.getElementById('pwChangeFormArea');
    if (showBtn) showBtn.classList.remove('hidden');
    if (formArea) formArea.classList.add('hidden');

    const currentPwInput = document.getElementById('currentPwInput');
    const newPwInput = document.getElementById('newPwInput');
    const confirmPwInput = document.getElementById('confirmNewPwInput');
    if (currentPwInput) currentPwInput.value = '';
    if (newPwInput) newPwInput.value = '';
    if (confirmPwInput) confirmPwInput.value = '';

    // 通知設定の初期状態をセット
    initProfileNotificationSettings();

    const modal = document.getElementById('userSettingsModal');
    if (modal) {
      modal.classList.add('active');
      const bodyEl = modal.querySelector('.settings-modal-body');
      if (bodyEl) bodyEl.scrollTop = 0;
    }
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    else document.body.classList.add('no-scroll');
  }

  /**
   * 設定モーダルからプロフィールモーダルへ戻る
   */
  function backToUserProfileModal(e) {
    if (e) e.stopPropagation();
    const settingsModal = document.getElementById('userSettingsModal');
    if (settingsModal) settingsModal.classList.remove('active');
    openUserProfileModal();
  }

  /**
   * 設定モーダルを閉じる
   */
  function closeUserSettingsModal(e) {
    if (e && e.target && e.target.closest('.settings-modal-content') && !e.target.closest('.modal-close') && !e.target.closest('.btn-cancel-action')) {
      return;
    }
    const modal = document.getElementById('userSettingsModal');
    if (modal) modal.classList.remove('active');
    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
    else document.body.classList.remove('no-scroll');
  }

  /**
   * ログアウトモーダルを開く
   */
  function openLogoutModal(e) {
    if (e) e.stopPropagation();
    const profileModal = document.getElementById('userProfileModal');
    if (profileModal) profileModal.classList.remove('active');
    const settingsModal = document.getElementById('userSettingsModal');
    if (settingsModal) settingsModal.classList.remove('active');
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) modal.classList.add('active');
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    else document.body.classList.add('no-scroll');
  }

  /**
   * ログアウトモーダルを閉じる
   */
  function closeLogoutModal(e) {
    if (e && e.target && e.target.closest('.modal-content') && !e.target.closest('.modal-close') && !e.target.closest('.btn-cancel-action')) {
      return;
    }
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) modal.classList.remove('active');
    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
    else document.body.classList.remove('no-scroll');
  }

  /**
   * ログアウト実行
   */
  function executeLogout() {
    try {
      localStorage.removeItem('fcb_auth_user');
      sessionStorage.clear();
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch (e) {}

    window.currentUser = null;

    // 強制連携モーダルを非表示
    const forceModal = document.getElementById('forceGoogleAuthModal');
    if (forceModal) forceModal.classList.remove('active');

    // ログアウト確認モーダルを閉じる
    closeLogoutModal();

    // ヘッダーを非表示
    renderHeaderUser();

    // ログイン画面を表示
    showLoginScreen();

    // フォームの入力値をリセット
    const pwInput = document.getElementById('loginPasswordInput');
    if (pwInput) pwInput.value = '';
    const errorMsg = document.getElementById('loginErrorMsg');
    if (errorMsg) errorMsg.style.display = 'none';
  }

  /**
   * Googleアカウント強制連携モーダルの表示・非表示判定
   * 個人カレンダー連携用トークン（hasCalendarLink）が未登録の場合のみ表示
   */
  function checkForceGoogleAuth() {
    const modal = document.getElementById('forceGoogleAuthModal');
    if (!modal) return;

    if (window.currentUser && window.currentUser.email && !window.currentUser.hasCalendarLink) {
      const emailEl = document.getElementById('forceAuthEmailDisplay');
      if (emailEl) emailEl.textContent = window.currentUser.email;
      modal.classList.add('active');
      if (typeof lockBodyScroll === 'function') {
        lockBodyScroll();
      } else {
        document.body.classList.add('no-scroll');
      }
    } else {
      modal.classList.remove('active');
      if (typeof unlockBodyScroll === 'function') {
        unlockBodyScroll();
      } else {
        document.body.classList.remove('no-scroll');
      }
    }
  }

  /**
   * 強制連携モーダルの「Googleアカウントで連携する」ボタン押下処理
   */
  function handleForceGoogleAuthClick() {
    const btn = document.getElementById('btnForceGoogleAuth');
    const statusEl = document.getElementById('forceAuthStatus');
    const email = window.currentUser ? window.currentUser.email : '';
    if (!email) {
      if (statusEl) {
        statusEl.textContent = 'メールアドレスが登録されていません。管理者に確認してください。';
        statusEl.className = 'form-status-msg form-status-error mb-12';
        statusEl.classList.remove('hidden');
      }
      return;
    }

    /**
     * Google認証ボタンのローディング状態を解除し、通常表示・活性状態にリセットする
     * @returns {void}
     */
    function resetForceAuthBtn() {
      if (!btn) return;
      btn.disabled = false;
      btn.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.textContent = 'sync_lock';
      btn.appendChild(icon);
      const textSpan = document.createElement('span');
      textSpan.textContent = 'Googleアカウント連携';
      btn.appendChild(textSpan);
    }

    if (btn) {
      btn.disabled = true;
      btn.replaceChildren();
      btn.appendChild(document.createTextNode('認証画面を準備中...'));
    }
    if (statusEl) statusEl.classList.add('hidden');

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(res => {
          resetForceAuthBtn();
          if (res && res.success && res.authUrl) {
            // 別ウィンドウ（ポップアップ）でOAuth認証画面を開く
            const authWindow = window.open(res.authUrl, 'fcb_google_oauth', 'width=500,height=620,menubar=no,toolbar=no');
            if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
              // ポップアップがブロックされた場合は同一タブで遷移
              window.location.href = res.authUrl;
            }
          } else {
            if (statusEl) {
              console.error('apiGetOAuthAuthUrl error:', res);
              statusEl.textContent = getSafeErrorMessage(res, '認証URLの取得に失敗しました。しばらく経ってから再度お試しください。');
              statusEl.className = 'form-status-msg form-status-error mb-12';
              statusEl.classList.remove('hidden');
            }
          }
        })
        .withFailureHandler(err => {
          console.error('apiGetOAuthAuthUrl failure:', err);
          resetForceAuthBtn();
          if (statusEl) {
            statusEl.textContent = getSafeErrorMessage(err, 'エラーが発生しました。通信環境をご確認の上、再度お試しください。');
            statusEl.className = 'form-status-msg form-status-error mb-12';
            statusEl.classList.remove('hidden');
          }
        })
        .apiGetOAuthAuthUrl(email);
    }
  }

  // Google OAuth認証完了（別タブ/ポップアップからのpostMessage）リスナー
  window.addEventListener('message', function(event) {
    if (event && event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS') {
      if (window.currentUser) {
        window.currentUser.hasCalendarLink = true;
        try {
          localStorage.setItem('fcb_auth_user', JSON.stringify(window.currentUser));
        } catch (e) {}
      }
      const modal = document.getElementById('forceGoogleAuthModal');
      if (modal) modal.classList.remove('active');
      if (typeof unlockBodyScroll === 'function') {
        unlockBodyScroll();
      } else {
        document.body.classList.remove('no-scroll');
      }
      // 最新データを再取得して画面を更新
      loadAppInitialData(true);
    }
  });



  /**
   * メインタブの切り替え処理
   * 
   * @param {string} tabName - 切り替え先のタブ名（'results', 'input', 'ranking', 'personal', 'schedule' 等）
   * @param {string} [animationDirection] - スライドアニメーション方向 ('next' | 'prev')
   */
  function switchTab(tabName, animationDirection) {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      try { document.activeElement.blur(); } catch (e) {}
    }

    // メンバー管理タブへの切り替え時：代表・副代表権限を厳格チェック
    if (tabName === 'members') {
      if (!isCurrentUserAdmin()) {
        showAppAlert({ title: 'アクセス制限', message: 'メンバー管理画面は「代表」または「副代表」のみアクセス可能です。', isError: true });
        switchTab('home');
        return;
      }
    }

    // タブ状態を永続化（'input' は復元時に 'results' へ戻す）
    const tabToPersist = (tabName === 'input') ? 'results' : tabName;
    try {
      sessionStorage.setItem('fcb_active_tab', tabToPersist);
      const targetHash = '#' + tabToPersist;
      if (window.location.hash !== targetHash) {
        history.replaceState(null, '', targetHash);
      }
    } catch (e) {}

    // すべてのタブとコンテンツエリアを非アクティブにする
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
      el.classList.remove('active');
      // 入力画面('input')のときは、ナビゲーション上は「試合結果('results')」をアクティブ状態に保つ
      const highlightTab = (tabName === 'input') ? 'results' : tabName;
      const oc = el.getAttribute('onclick') || '';
      if (oc.indexOf("'" + highlightTab + "'") !== -1 || oc.indexOf('"' + highlightTab + '"') !== -1) {
        el.classList.add('active');
      }
    });

    // モバイル用ボトムナビゲーション内のタブが横スクロールできる場合、アクティブなタブが見える位置に自動スクロール
    scrollActiveNavItemIntoView(true);

    document.querySelectorAll('.content-area').forEach(el => {
      el.classList.remove('active');
      el.classList.remove('tab-slide-in-right');
      el.classList.remove('tab-slide-in-left');
      el.style.display = '';
      el.style.transform = '';
      el.style.transition = '';
      el.style.pointerEvents = '';
    });

    // 指定されたタブとコンテンツエリアをアクティブにする
    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) {
      targetTab.style.display = '';
      targetTab.style.transform = '';
      targetTab.style.pointerEvents = '';
      targetTab.classList.add('active');
      if (animationDirection === 'next') {
        targetTab.classList.add('tab-slide-in-right');
        setTimeout(() => targetTab.classList.remove('tab-slide-in-right'), 250);
      } else if (animationDirection === 'prev') {
        targetTab.classList.add('tab-slide-in-left');
        setTimeout(() => targetTab.classList.remove('tab-slide-in-left'), 250);
      }
    }

    // 画面およびスクロールコンテナを確実に最上部（スクロールゼロ）へリセット
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      if (targetTab) targetTab.scrollTop = 0;
    } catch (e) {}
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const mc = document.querySelector('.main-content');
      if (mc) mc.scrollTop = 0;
    });

    // メンバー管理タブへの切り替え時：一覧初期化
    if (tabName === 'members') {
      if (typeof initMembersView === 'function') {
        const list = (window.adminMemberList && window.adminMemberList.length > 0) ? window.adminMemberList : window.scheduleRoster;
        initMembersView(list);
      }
    }

    // 予定タブに切り替えた場合はカレンダー描画を確実に実行
    if (tabName === 'schedule' && typeof window.renderCalendar === 'function') {
      const y = window.calYear || new Date().getFullYear();
      const m = (window.calMonth !== undefined) ? window.calMonth : new Date().getMonth();
      window.renderCalendar(y, m);
      if (typeof window.renderAgendaList === 'function') window.renderAgendaList();
    }

    // ランキングタブに切り替えた場合は描画を確実に実行
    if (tabName === 'ranking') {
      if (typeof populateRankingSeasonFilter === 'function') populateRankingSeasonFilter();
      if (typeof filterAndRenderRankings === 'function') filterAndRenderRankings();
    }

    // スタッツ（個人成績）タブに切り替えた場合は描画を確実に実行
    if (tabName === 'personal') {
      if (typeof populatePersonalSeasonFilter === 'function') populatePersonalSeasonFilter();
      if (typeof filterAndRenderPersonalStats === 'function') filterAndRenderPersonalStats();
    }

    // ホームタブに切り替えた場合は最新描画を実行
    if (tabName === 'home' && typeof initHomeView === 'function') {
      initHomeView();
    }

    // 備品管理タブに切り替えた場合は描画を実行
    if (tabName === 'equipment' && typeof initEquipmentView === 'function') {
      initEquipmentView();
    }

    // 活動記録タブに切り替えた場合は描画を実行
    if (tabName === 'bulletin' && typeof initBulletinTab === 'function') {
      initBulletinTab();
    }

    updateMobileHeaderHeight();
  }
  window.switchTab = switchTab;

  // ブラウザの戻る/進む操作（ハッシュ変更）時のタブ連動
  window.addEventListener('hashchange', function() {
    const target = getSavedActiveTab();
    const current = getCurrentActiveTabName();
    if (target && target !== current) {
      switchTab(target);
    }
  });

  /**
   * スワイプ操作可能なメインタブ一覧を取得（権限に応じて動的構築）
   * @returns {string[]}
   */
  function getSwipeTabList() {
    const tabs = ['home', 'schedule', 'results', 'bulletin', 'ranking', 'personal', 'equipment'];
    if (isCurrentUserAdmin()) {
      tabs.push('members');
    }
    return tabs;
  }

  /**
   * 現在アクティブなメインタブ名を取得
   * @returns {string}
   */
  function getCurrentActiveTabName() {
    const activeEl = document.querySelector('.content-area.active');
    if (!activeEl) return 'home';
    return activeEl.id.replace('tab-', '');
  }

  /**
   * スワイプによる次／前タブへの切り替え
   * @param {'next' | 'prev'} direction 
   */
  function switchTabBySwipe(direction) {
    const currentTab = getCurrentActiveTabName();
    // 試合結果入力画面（input）等の特殊画面では誤破棄防止のためスワイプ切替を抑止
    if (currentTab === 'input') return;

    const tabs = getSwipeTabList();
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (direction === 'next' && currentIndex < tabs.length - 1) {
      targetIndex = currentIndex + 1;
    } else if (direction === 'prev' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    }

    if (targetIndex !== -1 && targetIndex !== currentIndex) {
      const targetTab = tabs[targetIndex];
      switchTab(targetTab, direction);
    }
  }

  window.isTabSwiping = false;

  /**
   * スマホスワイプによるタブ切り替えジェスチャーの初期化
   * 指の動きにリアルタイムに追従するカルーセル風スワイプモーション
   * @returns {void}
   */
  function initSwipeTabNavigation() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isSwiping = false;
    let gestureLocked = null; // null | 'horizontal' | 'vertical'
    let isAnimating = false;

    let activeTabName = null;
    let activeEl = null;
    let tabsList = [];
    let activeTabIdx = -1;
    let currentTargetTabName = null;
    let currentTargetEl = null;
    let currentDirection = null; // 'next' | 'prev' | null
    let dragOffset = 0;
    let windowWidth = window.innerWidth;

    /**
     * モーダルやログイン画面等のオーバーレイが表示中か判定する
     * @returns {boolean} モーダルまたはログイン画面が表示中の場合true
     */
    function isAnyModalActive() {
      const openModals = document.querySelectorAll('.modal-overlay:not(.hidden), .modal-overlay.active, .avatar-lightbox-overlay:not(.hidden)');
      for (let i = 0; i < openModals.length; i++) {
        const style = window.getComputedStyle(openModals[i]);
        if (style.display !== 'none' && style.visibility !== 'hidden') return true;
      }
      const login = document.getElementById('loginScreen');
      if (login && login.style.display !== 'none') return true;
      return false;
    }

    /**
     * 指定要素が横スクロール可能コンテナまたはフォーム入力要素内か判定する
     * @param {Element} el - 判定対象のDOM要素
     * @returns {boolean} 横スクロールまたは入力要素内の場合true
     */
    function isHorizontalScrollableElement(el) {
      let curr = el;
      while (curr && curr !== document.body && curr !== document.documentElement) {
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(curr.tagName)) return true;
        if (curr.classList && (
          curr.classList.contains('sub-tab') ||
          curr.classList.contains('subtabs') ||
          curr.classList.contains('filter-row') ||
          curr.classList.contains('filter-box') ||
          curr.classList.contains('time-inputs-grid') ||
          curr.classList.contains('ranking-subtabs') ||
          curr.classList.contains('calendar-view-toggle') ||
          curr.classList.contains('sidebar') ||
          curr.classList.contains('sidebar-header') ||
          curr.classList.contains('sidebar-nav') ||
          curr.classList.contains('sidebar-nav-wrapper') ||
          curr.classList.contains('member-card-actions')
        )) {
          return true;
        }
        if (curr.scrollWidth > curr.clientWidth + 8) {
          const ox = window.getComputedStyle(curr).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
        curr = curr.parentElement;
      }
      return false;
    }

    /**
     * モバイル表示時のヘッダー高さを取得する
     * @returns {number} ヘッダー高さ（px）
     */
    function getHeaderHeight() {
      if (window.innerWidth <= 767) {
        const header = document.querySelector('.sidebar-header');
        if (header && header.offsetHeight > 0) {
          return header.offsetHeight;
        }
        const rootVal = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-height'), 10);
        return !isNaN(rootVal) && rootVal > 0 ? rootVal : 56;
      }
      return 0;
    }

    /**
     * スワイプ対象タブの初期配置および必要なデータ描画を準備する
     * @param {string} tabName - タブ識別子
     * @returns {void}
     */
    function prepareTabContent(tabName) {
      if (tabName === 'schedule' && typeof window.renderCalendar === 'function') {
        const y = window.calYear || new Date().getFullYear();
        const m = (window.calMonth !== undefined) ? window.calMonth : new Date().getMonth();
        window.renderCalendar(y, m);
        if (typeof window.renderAgendaList === 'function') window.renderAgendaList();
      } else if (tabName === 'ranking') {
        if (typeof populateRankingSeasonFilter === 'function') populateRankingSeasonFilter();
        if (typeof filterAndRenderRankings === 'function') filterAndRenderRankings();
      } else if (tabName === 'personal') {
        if (typeof populatePersonalSeasonFilter === 'function') populatePersonalSeasonFilter();
        if (typeof filterAndRenderPersonalStats === 'function') filterAndRenderPersonalStats();
      } else if (tabName === 'members') {
        if (typeof initMembersView === 'function') {
          const list = (window.adminMemberList && window.adminMemberList.length > 0) ? window.adminMemberList : window.scheduleRoster;
          initMembersView(list);
        }
      }
    }

    /**
     * スワイプ操作時に一時付与したインラインスタイルをリセットする
     * @param {Element} el - リセット対象のDOM要素
     * @returns {void}
     */
    function resetElementStyles(el) {
      if (!el) return;
      el.style.transform = '';
      el.style.transition = '';
      el.style.willChange = '';
      el.style.position = '';
      el.style.top = '';
      el.style.left = '';
      el.style.width = '';
      el.style.height = '';
      el.style.overflow = '';
      el.style.overflowY = '';
      el.style.zIndex = '';
      el.style.backgroundColor = '';
      el.style.boxSizing = '';
      el.style.boxShadow = '';
      el.style.pointerEvents = '';
      el.style.display = '';
    }

    /**
     * スワイプ方向に応じたターゲット要素を探索・設定する
     * @param {string} targetName - 遷移先タブ名
     * @param {string} direction - スワイプ方向 ('next' | 'prev')
     * @returns {void}
     */
    function updateTargetElement(targetName, direction) {
      if (currentTargetTabName === targetName && currentDirection === direction) return;

      // 既存ターゲット要素のリセット
      if (currentTargetEl && currentTargetTabName !== targetName) {
        resetElementStyles(currentTargetEl);
        currentTargetEl = null;
        currentTargetTabName = null;
        currentDirection = null;
      }

      if (!targetName) return;

      const el = document.getElementById('tab-' + targetName);
      if (!el) return;

      prepareTabContent(targetName);

      const headerH = getHeaderHeight();
      el.style.display = 'block';
      el.style.position = 'fixed';
      el.style.top = headerH + 'px';
      el.style.left = '0';
      el.style.width = '100vw';
      el.style.height = (window.innerHeight - headerH) + 'px';
      el.style.overflow = 'visible';
      el.style.zIndex = '15';
      el.style.backgroundColor = 'var(--bg-body, #f8fafc)';
      el.style.boxSizing = 'border-box';
      el.style.pointerEvents = 'none';
      el.style.transition = 'none';
      el.style.willChange = 'transform';

      if (direction === 'next') {
        el.style.boxShadow = '-4px 0 16px rgba(0, 0, 0, 0.08)';
      } else if (direction === 'prev') {
        el.style.boxShadow = '4px 0 16px rgba(0, 0, 0, 0.08)';
      }

      currentTargetTabName = targetName;
      currentTargetEl = el;
      currentDirection = direction;
    }

    const targetContainer = document.querySelector('.main-content') || document.body;

    targetContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      if (window.innerWidth >= 768) return;
      if (isAnimating) return;
      if (isAnyModalActive()) return;
      if (isHorizontalScrollableElement(e.target)) return;

      const ptr = document.getElementById('pullToRefresh');
      if (isPTRRefreshing || (ptr && ptr.classList.contains('pulling'))) return;

      activeTabName = getCurrentActiveTabName();
      if (activeTabName === 'input') return;

      tabsList = getSwipeTabList();
      activeTabIdx = tabsList.indexOf(activeTabName);
      if (activeTabIdx === -1) return;

      activeEl = document.getElementById('tab-' + activeTabName);
      if (!activeEl) return;

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      windowWidth = window.innerWidth;
      isSwiping = true;
      gestureLocked = null;
      dragOffset = 0;
      currentTargetTabName = null;
      currentTargetEl = null;
      currentDirection = null;
    }, { passive: true });

    targetContainer.addEventListener('touchmove', (e) => {
      if (!isSwiping || gestureLocked === 'vertical' || isAnimating) return;
      if (e.touches.length !== 1) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStartX;
      const diffY = currentY - touchStartY;
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);

      // 方向判定（6px以上動いた時点で横か縦かを確定）
      if (gestureLocked === null) {
        if (absX < 6 && absY < 6) return;
        if (absX >= absY) {
          gestureLocked = 'horizontal';
          window.isTabSwiping = true;
        } else {
          gestureLocked = 'vertical';
          isSwiping = false;
          window.isTabSwiping = false;
          return;
        }
      }

      // 横スワイプ確定時：縦スクロール等のデフォルト動作を抑止して滑らかな追従を実現
      if (gestureLocked === 'horizontal') {
        if (e.cancelable) e.preventDefault();

        let targetName = null;
        let direction = null;

        if (diffX < 0) {
          // 左ドラッグ（指が左へ）＝ 次のタブ
          direction = 'next';
          const hasNext = activeTabIdx < tabsList.length - 1;
          if (hasNext) {
            targetName = tabsList[activeTabIdx + 1];
            dragOffset = diffX;
          } else {
            // 端到達時のラバーバンド抵抗
            dragOffset = diffX * 0.28;
          }
        } else if (diffX > 0) {
          // 右ドラッグ（指が右へ）＝ 前のタブ
          direction = 'prev';
          const hasPrev = activeTabIdx > 0;
          if (hasPrev) {
            targetName = tabsList[activeTabIdx - 1];
            dragOffset = diffX;
          } else {
            // 端到達時のラバーバンド抵抗
            dragOffset = diffX * 0.28;
          }
        } else {
          dragOffset = 0;
        }

        // 追従要素の更新とリアルタイム移動
        updateTargetElement(targetName, direction);

        if (activeEl) {
          activeEl.style.transform = 'translate3d(' + dragOffset + 'px, 0, 0)';
          activeEl.style.transition = 'none';
          activeEl.style.willChange = 'transform';
          activeEl.style.backgroundColor = 'var(--bg-body, #f8fafc)';
          activeEl.style.pointerEvents = 'none';
        }

        if (currentTargetEl) {
          if (direction === 'next') {
            currentTargetEl.style.transform = 'translate3d(' + (windowWidth + dragOffset) + 'px, 0, 0)';
          } else if (direction === 'prev') {
            currentTargetEl.style.transform = 'translate3d(' + (-windowWidth + dragOffset) + 'px, 0, 0)';
          }
        }
      }
    }, { passive: false });

    /**
     * タッチ終了またはキャンセル時にスワイプ完了または巻き戻しアニメーションを実行する
     * @param {TouchEvent|MouseEvent} e - タッチ/マウスイベントオブジェクト
     * @returns {void}
     */
    function onTouchEndOrCancel(e) {
      if (!isSwiping || gestureLocked !== 'horizontal' || isAnimating) {
        isSwiping = false;
        window.isTabSwiping = false;
        return;
      }
      isSwiping = false;

      const changedTouch = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      const endX = changedTouch ? changedTouch.clientX : touchStartX + dragOffset;
      const diffX = endX - touchStartX;
      const elapsedTime = Math.max(Date.now() - touchStartTime, 1);
      const velocity = Math.abs(diffX) / elapsedTime; // px/ms

      // 切り替え成立条件：
      // 1. 移動量が画面幅の18%以上
      // 2. または短時間（350ms以内）の素早いフリック（30px以上かつ速度0.25px/ms以上）
      const isQuickFlick = elapsedTime < 350 && Math.abs(diffX) > 30 && velocity > 0.25;
      const isDistanceMet = Math.abs(diffX) > windowWidth * 0.18;
      const shouldSwitch = currentTargetTabName && (isDistanceMet || isQuickFlick) &&
        ((diffX < 0 && currentDirection === 'next') || (diffX > 0 && currentDirection === 'prev'));

      isAnimating = true;
      const animDuration = 220; // ms
      const easeCurve = 'cubic-bezier(0.25, 1, 0.5, 1)';

      if (shouldSwitch) {
        // スイッチ完了アニメーション
        const targetTabToActivate = currentTargetTabName;
        const targetElToActivate = currentTargetEl;
        const oldActiveEl = activeEl;

        if (oldActiveEl) {
          oldActiveEl.style.transition = 'transform ' + animDuration + 'ms ' + easeCurve;
          if (currentDirection === 'next') {
            oldActiveEl.style.transform = 'translate3d(' + (-windowWidth) + 'px, 0, 0)';
          } else {
            oldActiveEl.style.transform = 'translate3d(' + (windowWidth) + 'px, 0, 0)';
          }
        }

        if (targetElToActivate) {
          targetElToActivate.style.transition = 'transform ' + animDuration + 'ms ' + easeCurve;
          targetElToActivate.style.transform = 'translate3d(0, 0, 0)';
        }

        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });

          resetElementStyles(oldActiveEl);

          resetElementStyles(targetElToActivate);
          currentTargetEl = null;
          currentTargetTabName = null;
          currentDirection = null;

          switchTab(targetTabToActivate, null);

          isAnimating = false;
          window.isTabSwiping = false;
        }, animDuration);

      } else {
        // スナップバック（元のタブに戻す）アニメーション
        const targetElToReset = currentTargetEl;
        const currentActiveEl = activeEl;

        if (currentActiveEl) {
          currentActiveEl.style.transition = 'transform ' + animDuration + 'ms ' + easeCurve;
          currentActiveEl.style.transform = 'translate3d(0, 0, 0)';
        }

        if (targetElToReset) {
          targetElToReset.style.transition = 'transform ' + animDuration + 'ms ' + easeCurve;
          if (currentDirection === 'next') {
            targetElToReset.style.transform = 'translate3d(' + windowWidth + 'px, 0, 0)';
          } else {
            targetElToReset.style.transform = 'translate3d(' + (-windowWidth) + 'px, 0, 0)';
          }
        }

        setTimeout(() => {
          resetElementStyles(currentActiveEl);
          if (targetElToReset) {
            resetElementStyles(targetElToReset);
          }
          currentTargetEl = null;
          currentTargetTabName = null;
          currentDirection = null;

          isAnimating = false;
          window.isTabSwiping = false;
        }, animDuration);
      }
    }

    targetContainer.addEventListener('touchend', onTouchEndOrCancel, { passive: true });
    targetContainer.addEventListener('touchcancel', onTouchEndOrCancel, { passive: true });
  }

  /**
   * サブタブの切り替え処理（主にランキング画面で使用）
   * 
   * @param {string} subTabName - 切り替え先のサブタブ名
   */
  function switchSubTab(subTabName) {
    // すべてのサブタブとコンテンツエリアを非アクティブにする
    document.querySelectorAll('.sub-tab').forEach(el => {
      el.classList.remove('active');
      const oc = el.getAttribute('onclick') || '';
      if (oc.indexOf("'" + subTabName + "'") !== -1 || oc.indexOf('"' + subTabName + '"') !== -1) {
        el.classList.add('active');
      }
    });
    document.querySelectorAll('.subtab-content').forEach(el => el.classList.remove('active'));

    // 指定されたサブタブとコンテンツエリアをアクティブにする
    const targetSub = document.getElementById('subtab-' + subTabName);
    if (targetSub) targetSub.classList.add('active');
  }

  // =========================================
  // 引っ張って更新（Pull to Refresh）の実装
  // =========================================
  let isPTRRefreshing = false;

  /**
   * 画面最上部でのPull to Refresh（引っ張って更新）操作を初期化する
   * @returns {void}
   */
  function initPullToRefresh() {
    const ptr = document.getElementById('pullToRefresh');
    if (!ptr) return;
    const ptrBox = ptr.querySelector('.ptr-box');
    const ptrText = document.getElementById('ptrText');
    if (!ptrBox || !ptrText) return;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let pullDistance = 0;
    let isTracking = false;
    let isPTRPulling = false;
    const THRESHOLD = 48; // 更新発火の閾値 (px) - 指で引きやすい距離に調整
    const MAX_PULL = 85;   // 最大引っ張り距離 (px)

    /**
     * PTR操作を抑止すべきモーダルや画面が表示中か判定する
     * @returns {boolean} モーダル表示中の場合true
     */
    function isModalOpen() {
      if (document.body.classList.contains('no-scroll') || document.documentElement.classList.contains('no-scroll')) return true;
      const anyActiveModal = document.querySelector('.modal-overlay.active:not(.hidden), .modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]');
      if (anyActiveModal) return true;
      const pm = document.getElementById('playerModalOverlay');
      if (pm && pm.classList.contains('active')) return true;
      const lb = document.getElementById('avatarLightboxModal');
      if (lb && !lb.classList.contains('hidden')) return true;
      const prof = document.getElementById('userProfileModal');
      if (prof && prof.classList.contains('active')) return true;
      const settings = document.getElementById('userSettingsModal');
      if (settings && settings.classList.contains('active')) return true;
      const login = document.getElementById('loginScreen');
      if (login && login.style.display !== 'none') return true;
      const logout = document.getElementById('logoutConfirmModal');
      if (logout && logout.classList.contains('active')) return true;
      return false;
    }

    /**
     * スクロール位置が画面最上部付近か判定する
     * @returns {boolean} 最上部の場合true
     */
    function isAtTop() {
      const docScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      return docScroll <= 8;
    }

    /**
     * タッチまたはマウスクリック開始時のPTR初期座標を記録する
     * @param {number} clientX - 開始X座標
     * @param {number} clientY - 開始Y座標
     * @param {Event} [event] - トリガーイベント
     * @returns {void}
     */
    function onStart(clientX, clientY, event) {
      if (isPTRRefreshing || isModalOpen() || window.isTabSwiping) return;
      if (event && event.target && event.target.closest && event.target.closest('.modal-overlay, .modal-content, #app-toast')) return;
      if (!isAtTop()) return;
      startX = clientX;
      startY = clientY;
      currentX = startX;
      currentY = startY;
      pullDistance = 0;
      isTracking = true;
    }

    /**
     * PTRの引っ張り状態を中断し、インジケーターを初期位置へ戻す
     * @returns {void}
     */
    function cancelPTR() {
      isTracking = false;
      isPTRPulling = false;
      ptr.classList.remove('pulling', 'ready');
      ptrBox.style.transform = 'translateY(-50px)';
      ptrBox.style.opacity = '0';
      pullDistance = 0;
    }

    /**
     * スワイプ移動距離に応じてPTRインジケーターを追従・表示更新する
     * @param {number} clientX - 移動現在X座標
     * @param {number} clientY - 移動現在Y座標
     * @param {Event} [event] - 移動イベント
     * @returns {void}
     */
    function onMove(clientX, clientY, event) {
      if (!isTracking || isPTRRefreshing || isModalOpen()) return;
      if (event && event.target && event.target.closest && event.target.closest('.modal-overlay, .modal-content, #app-toast')) {
        cancelPTR();
        return;
      }

      // タブスワイプ中、または横移動が優勢な場合は即座にPTRをキャンセルして何もしない
      if (window.isTabSwiping) {
        cancelPTR();
        return;
      }

      currentX = clientX;
      currentY = clientY;
      const diffX = currentX - startX;
      const diffY = currentY - startY;
      const absX = Math.abs(diffX);

      // 横スワイプ意図が検知された場合（横移動が縦移動と同等以上、または横に7px以上動いた場合）
      if (!isPTRPulling && (absX >= 7 || absX > diffY)) {
        cancelPTR();
        return;
      }

      // 明確な下方向への引っ張り かつ 最上部スクロール時のみ発動
      if (diffY > 6 && diffY > absX * 1.3 && isAtTop()) {
        isPTRPulling = true;
        // ラバーバンド減衰計算
        pullDistance = Math.min((diffY - 6) * 0.55, MAX_PULL);

        if (pullDistance > 4) {
          ptr.classList.add('pulling');
          ptrBox.style.transform = 'translateY(' + pullDistance + 'px)';
          ptrBox.style.opacity = Math.min(pullDistance / 20, 1);

          if (pullDistance >= THRESHOLD) {
            ptr.classList.add('ready');
            ptrText.textContent = '離して更新';
          } else {
            ptr.classList.remove('ready');
            ptrText.textContent = '引っ張って更新';
          }

          if (event && event.cancelable) {
            event.preventDefault(); // ネイティブの不要なバウンス・再読み込みを防止
          }
        }
      } else if (diffY < 0) {
        // 上方向への通常スクロール
        cancelPTR();
      }
    }

    /**
     * タッチまたはドラッグ終了時に更新発火またはキャンセルを判定する
     * @returns {void}
     */
    function onEnd() {
      if (!isTracking) return;
      isTracking = false;
      const wasPulling = isPTRPulling;
      isPTRPulling = false;

      if (wasPulling && pullDistance >= THRESHOLD && !isPTRRefreshing) {
        // 更新実行
        isPTRRefreshing = true;
        // インジケーターは即座に上部へ収納（画面側のローディングスピナーと重複させない）
        ptr.classList.remove('pulling', 'ready');
        ptrBox.style.transform = 'translateY(-50px)';
        ptrBox.style.opacity = '0';
        ptrText.textContent = '引っ張って更新';
        pullDistance = 0;

        // 画面側に移植したくるくるアイコンで再描画
        refreshAppData(() => {
          isPTRRefreshing = false;
        });
      } else {
        cancelPTR();
        ptrText.textContent = '引っ張って更新';
      }
    }

    // タッチイベントリスナー（スマホ実機）
    document.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY, e);
      }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY, e);
      }
    }, { passive: false });

    document.addEventListener('touchend', function () {
      onEnd();
    }, { passive: true });

    document.addEventListener('touchcancel', function () {
      onEnd();
    }, { passive: true });

    // マウスドラッグ対応（PCブラウザ・デバッグ用）
    let isMouseDown = false;
    document.addEventListener('mousedown', function (e) {
      if (e.button === 0 && isAtTop()) {
        isMouseDown = true;
        onStart(e.clientX, e.clientY);
      }
    });

    document.addEventListener('mousemove', function (e) {
      if (isMouseDown) {
        onMove(e.clientX, e.clientY, e);
      }
    });

    document.addEventListener('mouseup', function () {
      if (isMouseDown) {
        isMouseDown = false;
        onEnd();
      }
    });
  }

  /**
   * アプリ全体のデータを強制再取得して画面全体を完全再描画
   * @param {Function} [onFinished] - 完了コールバック
   */
  function refreshAppData(onFinished) {
    // 画面側をローディング表示に切り替え、くるくるスピナーを表示
    document.querySelectorAll('.tab-main-content').forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    });
    document.querySelectorAll('.tab-loading-placeholder').forEach(el => {
      el.style.display = '';
      el.classList.remove('hidden');
    });

    let completed = false;
    /**
     * データ再取得完了時の画面切り替えとコールバック呼び出しを行う
     * @param {boolean} success - 取得成否
     * @param {Error} [err] - エラーオブジェクト
     * @returns {void}
     */
    const finish = (success, err) => {
      if (completed) return;
      completed = true;
      if (!success) {
        revealAllTabContents();
      }
      if (typeof onFinished === 'function') onFinished(success);
    };

    // 15秒セーフティタイマー（ネットワーク遮断時）
    const timer = setTimeout(() => {
      finish(false, new Error('タイムアウト'));
    }, 15000);

    loadAppInitialData(true, (success, err) => {
      clearTimeout(timer);
      finish(success, err);
    });
  }

  // =========================================
  // 📸 プロフィール画像拡大（LINE / X 風ライトボックス）
  // =========================================
  /**
   * プロフィール設定モーダル内のアバター枠クリック処理
   * 写真が設定されていれば拡大表示（ライトボックス）、未設定ならファイル選択を開く
   */
  function handleProfileAvatarBoxClick(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const img = document.getElementById('profileAvatarImg');
    const u = window.currentUser;
    const currentUrl = (img && !img.classList.contains('hidden') && img.src)
      ? img.src
      : (typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(u) : ((u && u.avatarUrl) || (u && window.playerAvatarMap && window.playerAvatarMap[u.name]) || ''));

    if (currentUrl && !currentUrl.startsWith('data:image/svg+xml')) {
      const name = (u && u.name) || '';
      openAvatarLightbox(currentUrl, name);
    } else {
      const fileInput = document.getElementById('profileImgInput');
      if (fileInput) fileInput.click();
    }
  }
  window.handleProfileAvatarBoxClick = handleProfileAvatarBoxClick;

  /**
   * アバター画像を全画面ライトボックスで拡大表示する
   * @param {string} imgUrl - 画像URL
   * @param {string} [playerName] - 選手名
   * @returns {void}
   */
  function openAvatarLightbox(imgUrl, playerName) {
    if (!imgUrl || imgUrl.startsWith('data:image/svg+xml')) return;

    const modal = document.getElementById('avatarLightboxModal');
    const img = document.getElementById('avatarLightboxImg');
    const nameEl = document.getElementById('avatarLightboxName');
    if (!modal || !img) return;

    img.src = imgUrl;
    img.alt = playerName || '';
    if (nameEl) {
      nameEl.textContent = playerName || '';
      nameEl.style.display = playerName ? 'block' : 'none';
    }

    modal.classList.remove('hidden');
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
    else document.body.classList.add('no-scroll');
  }
  window.openAvatarLightbox = openAvatarLightbox;

  /**
   * アバター画像拡大ライトボックスを閉じる
   * @returns {void}
   */
  function closeAvatarLightbox() {
    const modal = document.getElementById('avatarLightboxModal');
    if (!modal) return;
    modal.classList.add('hidden');
    const img = document.getElementById('avatarLightboxImg');
    if (img) img.src = '';

    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
    else document.body.classList.remove('no-scroll');
  }
  window.closeAvatarLightbox = closeAvatarLightbox;

  /**
   * アバター画像タップ時にライトボックスを開くイベント監視を初期化する
   * @returns {void}
   */
  function initAvatarLightbox() {
    // キャプチャフェーズでクリックを監視し、アバタータップ時は親カード等のクリックを防止
    document.addEventListener('click', function (e) {
      // ヘッダーやサイドバーのユーザーアイコンはプロフィールモーダルを開くために除外
      const avatarImg = e.target.closest('.player-avatar-img, .rank-avatar-img, .profile-avatar-img, .pm-avatar-img, #profileAvatarImg, #pmAvatarImg, .detail-avatar-img');
      if (avatarImg && avatarImg.tagName === 'IMG') {
        const src = avatarImg.getAttribute('src') || avatarImg.src;
        if (!src || src.startsWith('data:image/svg+xml')) return;

        // 親カードのクリックイベント（選手詳細モーダル等）のバブリングを阻止
        e.preventDefault();
        e.stopPropagation();

        let name = avatarImg.alt || avatarImg.getAttribute('data-name') || '';
        if (!name) {
          const parentCard = avatarImg.closest('tr, .rank-card, .modal-content, .sidebar-user, .user-profile-modal-content');
          if (parentCard) {
            const nameEl = parentCard.querySelector('.player-name, .player-link, .rank-name, .modal-player-name, #profileName, .sidebar-user-name');
            if (nameEl) name = nameEl.textContent.trim();
          }
        }
        if (!name && window.currentUser && avatarImg.id === 'profileAvatarImg') {
          name = window.currentUser.name;
        }

        openAvatarLightbox(src, name);
      }
    }, true);

    // ESCキーで閉じる
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('avatarLightboxModal');
        if (modal && !modal.classList.contains('hidden')) {
          closeAvatarLightbox();
        }
      }
    });
  }
