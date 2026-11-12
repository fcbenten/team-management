/**
   * パスワード設定フォーム送信処理
   */
  function handleRegisterSubmit(e) {
    if (e) e.preventDefault();

    const pw1 = document.getElementById('regNewPasswordInput');
    const pw2 = document.getElementById('regConfirmPasswordInput');
    const alertBox = document.getElementById('regAlertMsg');
    const submitBtn = document.getElementById('regSubmitBtn');
    const form = document.getElementById('registerForm');

    if (!pw1 || !pw2) return;

    const pass1 = pw1.value.trim();
    const pass2 = pw2.value.trim();
    const email = window.registerEmail;

    if (!email) {
      showAlert('エラー：メールアドレスが取得できていません。最初からやり直してください。', true);
      return;
    }

    if (!pass1 || pass1.length < 4) {
      showAlert('パスワードは4文字以上で設定してください。', true);
      return;
    }

    if (pass1 !== pass2) {
      showAlert('パスワードと確認用パスワードが一致しません。', true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '登録処理中...';
    }
    if (alertBox) alertBox.classList.add('hidden');

    google.script.run
      .withSuccessHandler(res => {
        if (res && res.success) {
          // 自動ログイン用に localStorage にユーザー情報を保存（オプトイン）
          if (res.user) {
            try {
              localStorage.setItem('fcb_auth_user', JSON.stringify(res.user));
            } catch(err) {}
          }
          
          // フォームを非表示にして静的成功画面を表示
          const topAlert = document.getElementById('topAlertMsg');
          if (topAlert) topAlert.classList.add('hidden');
          if (form) form.classList.add('hidden');
          const successBox = document.getElementById('regSuccessBox');
          if (successBox) successBox.classList.remove('hidden');
        } else {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '設定完了';
          }
          showAlert((res && res.error) ? res.error : '登録処理に失敗しました。', true);
        }
      })
      .withFailureHandler(err => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '設定完了';
        }
        showAlert('通信エラーが発生しました: ' + (err.message || ''), true);
      })
      .apiRegisterMember(email, pass1);
  }

  /**
   * 登録画面内のアラートメッセージ要素にテキストとスタイルを設定して表示する
   * @param {string} msg - 表示するメッセージ
   * @param {boolean} isError - エラー表示（true）または成功表示（false）
   * @returns {void}
   */
  function showAlert(msg, isError) {
    const alertBox = document.getElementById('regAlertMsg');
    if (!alertBox) return;

    alertBox.textContent = msg;
    alertBox.classList.remove('hidden');

    if (isError) {
      alertBox.className = 'alert-box alert-error mt-16';
    } else {
      alertBox.className = 'alert-box alert-success mt-16';
    }
  }
