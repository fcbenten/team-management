/**
 * ==========================================
 * 👥 js_members.html
 * ==========================================
 * 管理者専用メンバー管理画面のフロントエンドロジック
 */

window.adminMemberList = [];
window.currentEditingMember = null;
window.currentDeletingMember = null;

/**
 * OB・退団メンバーセクションのアコーディオン開閉
 */
function toggleObAccordion() {
  const content = document.getElementById('obAccordionContent');
  const toggleText = document.getElementById('obAccordionToggleText');
  const toggleIcon = document.getElementById('obAccordionToggleIcon');
  if (!content) return;

  const isHidden = content.classList.contains('hidden');
  if (isHidden) {
    content.classList.remove('hidden');
    if (toggleText) toggleText.textContent = '一覧を閉じる';
    if (toggleIcon) toggleIcon.textContent = 'expand_less';
  } else {
    content.classList.add('hidden');
    if (toggleText) toggleText.textContent = '一覧を表示';
    if (toggleIcon) toggleIcon.textContent = 'expand_more';
  }
}

/**
 * 編集モーダルの在籍ステータス変更イベントハンドラー
 * （休部中・OB選択時に注意書きバナーを表示）
 */
function handleMemberStatusSelectChange() {
  const select = document.getElementById('memberEditStatusSelect');
  const val = select ? select.value : 'ACTIVE';
  const hintBox = document.getElementById('memberStatusHintBox');
  const hintText = document.getElementById('memberStatusHintText');
  const hintIcon = document.getElementById('memberStatusHintIcon');

  if (!hintBox || !hintText) return;

  if (val === 'SUSPENDED') {
    hintBox.className = 'member-status-hint-box hint-suspended mb-12';
    if (hintIcon) hintIcon.textContent = 'pause_circle';
    hintText.textContent = '怪我や仕事等による一時的な活動休止です。出欠催促やアナウンス通知の配信対象から除外されます。';
    hintBox.classList.remove('hidden');
  } else if (val === 'OB') {
    hintBox.className = 'member-status-hint-box hint-ob mb-12';
    if (hintIcon) hintIcon.textContent = 'history';
    hintText.textContent = '退団者として記録されます。過去の試合戦績や個人スタッツは維持され、いつでも現役に復帰できます。';
    hintBox.classList.remove('hidden');
  } else {
    hintBox.classList.add('hidden');
  }
}

// ロール階層定義 (代表: 2, 副代表: 1, メンバー: 0)
const ROLE_LEVEL = {
  '代表': 2,
  '副代表': 1,
  'メンバー': 0
};

/**
 * ログイン中ユーザーのロールを取得
 * @returns {string} '代表' | '副代表' | 'メンバー'
 */
function getCurrentActorRole() {
  const u = window.currentUser || {};
  if (u.role) {
    let r = String(u.role).trim();
    if (r === '部員') r = 'メンバー';
    return r;
  }
  const cleanEmail = String(u.email || '').trim().toLowerCase();
  const cleanName = String(u.name || '').replace(/[\s\u3000]+/g, '').toLowerCase();
  const list = window.adminMemberList || [];
  const found = list.find(m => 
    (cleanEmail && m.email && m.email.toLowerCase() === cleanEmail) ||
    (cleanName && String(m.name).replace(/[\s\u3000]+/g, '').toLowerCase() === cleanName)
  );
  if (found && found.role) {
    let r = String(found.role).trim();
    if (r === '部員') r = 'メンバー';
    u.role = r;
    return r;
  }
  return 'メンバー';
}

/**
 * 指定のターゲットロールを編集・削除できるか判定（同等または下位ロールのみ可能）
 * @param {string} targetRole 
 * @returns {boolean}
 */
function canEditTarget(targetRole) {
  const actorRole = getCurrentActorRole();
  let tRole = String(targetRole || 'メンバー').trim();
  if (tRole === '部員') tRole = 'メンバー';

  const actorLevel = ROLE_LEVEL[actorRole] !== undefined ? ROLE_LEVEL[actorRole] : 0;
  const targetLevel = ROLE_LEVEL[tRole] !== undefined ? ROLE_LEVEL[tRole] : 0;

  return actorLevel >= targetLevel;
}

/**
 * メンバー管理画面の初期化
 * @param {Array} [initialRoster] 
 */
function initMembersView(initialRoster) {
  if (initialRoster && Array.isArray(initialRoster) && initialRoster.length > 0) {
    window.adminMemberList = [...initialRoster];
    renderMembersList(window.adminMemberList);
    return;
  }

  const u = window.currentUser || {};
  const actorEmail = u.email || '';
  const actorName = u.name || '';

  const container = document.getElementById('membersListContainer');
  if (container) {
    container.replaceChildren();
    const tplLoading = document.getElementById('tpl-member-loading');
    if (tplLoading) {
      container.appendChild(tplLoading.content.cloneNode(true));
    }
  }

  google.script.run
    .withSuccessHandler(res => {
      if (res && res.success && Array.isArray(res.roster)) {
        window.adminMemberList = res.roster;
        renderMembersList(window.adminMemberList);
      } else {
        if (container) {
          container.replaceChildren();
          const errBox = document.createElement('div');
          errBox.className = 'card-box error-box text-center p-20';
          errBox.textContent = res && res.error ? res.error : 'メンバー情報の取得に失敗しました。';
          container.appendChild(errBox);
        }
      }
    })
    .withFailureHandler(err => {
      if (container) {
        container.replaceChildren();
        const errBox = document.createElement('div');
        errBox.className = 'card-box error-box text-center p-20';
        errBox.textContent = '通信エラー: ' + (err.message || '');
        container.appendChild(errBox);
      }
    })
    .apiGetMemberListForAdmin(actorEmail, actorName);
}

/**
 * メンバー一覧とサマリーの描画
 */
function renderMembersList(members) {
  updateMemberSummaryStats(members || []);
  filterMembersList();
}

/**
 * 統計サマリーの更新
 */
function updateMemberSummaryStats(list) {
  // 特殊枠（助っ人、OG、なし）のみ除外
  const baseList = (list || []).filter(m => {
    const mName = String(m.name || '').trim();
    const mId = String(m.memberId || m.id || '').trim();
    return m.memberType !== 'SPECIAL' && !['助っ人', 'OG', 'なし'].includes(mName) && !mId.includes('SPECIAL');
  });

  let activeCount = 0;   // 現役部員全員（休部中も含む！くくりは現役）
  let suspendedCount = 0; // うち休部中
  let obCount = 0;        // OB選手（退団者）
  let adminCount = 0;
  let fpCount = 0;
  let gkCount = 0;

  baseList.forEach(m => {
    const isOb = !!m.isPast || m.memberType === 'PAST';
    const isSuspended = !isOb && (!!m.isSuspended || m.memberType === 'SUSPENDED');

    if (isOb) {
      obCount++;
    } else {
      activeCount++; // 現役部員としてカウント
      if (isSuspended) {
        suspendedCount++; // うち休部中
      }

      // 役割・ポジション別カウント
      let r = String(m.role || 'メンバー').trim();
      if (r === '部員') r = 'メンバー';
      if (r === '代表' || r === '副代表') adminCount++;
      const p = String(m.position || '').trim().toUpperCase();
      if (p === 'FP') fpCount++;
      else if (p === 'GK') gkCount++;
    }
  });

  // セクション人数バッジ
  const countActiveEl = document.getElementById('sectionCountActive');
  const countSuspendedEl = document.getElementById('sectionCountSuspended');
  const countObEl = document.getElementById('sectionCountOb');

  if (countActiveEl) countActiveEl.textContent = activeCount + '名';
  if (countSuspendedEl) countSuspendedEl.textContent = suspendedCount + '名';
  if (countObEl) countObEl.textContent = obCount + '名';

  // 統計サマリーピルの更新（在籍部員数 = 現役 + 休部中）
  const totalEl = document.getElementById('statTotalMembers');
  const fpEl = document.getElementById('statFpMembers');
  const gkEl = document.getElementById('statGkMembers');

  if (totalEl) totalEl.textContent = activeCount + suspendedCount;
  if (fpEl) fpEl.textContent = fpCount;
  if (gkEl) gkEl.textContent = gkCount;
}

/**
 * 検索・フィルター処理（現役・休部中・OBの3セクションへ振り分け）
 */
function filterMembersList() {
  const searchInput = document.getElementById('memberSearchInput');
  const clearBtn = document.getElementById('memberSearchClearBtn');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const cleanQuery = query.replace(/[\s\u3000]+/g, '');

  if (clearBtn) {
    if (query) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const roleFilter = document.getElementById('memberRoleFilter');
  const selectedRole = roleFilter ? roleFilter.value : 'all';

  const posFilter = document.getElementById('memberPositionFilter');
  const selectedPos = posFilter ? posFilter.value : 'all';

  const all = window.adminMemberList || [];

  const activeList = [];
  const suspendedList = [];
  const obList = [];

  all.forEach(m => {
    // 特殊枠（助っ人、OG、なし）は完全除外
    const mName = String(m.name || '').trim();
    const mId = String(m.memberId || m.id || '').trim();
    if (m.memberType === 'SPECIAL' || ['助っ人', 'OG', 'なし'].includes(mName) || mId.includes('SPECIAL')) {
      return;
    }

    // 検索クエリマッチ（名前、背番号、役割、生年月日、電話番号、メール）
    if (cleanQuery) {
      const name = String(m.name || '').replace(/[\s\u3000]+/g, '').toLowerCase();
      const num = String(m.number !== undefined && m.number !== 999 ? m.number : '');
      let role = String(m.role || 'メンバー').toLowerCase();
      if (role === '部員') role = 'メンバー';
      const email = String(m.email || '').toLowerCase();
      const birthday = String(m.birthday || '').toLowerCase();
      const phone = String(m.phone || '').replace(/[-\s]/g, '').toLowerCase();
      const queryNoHyphen = cleanQuery.replace(/[-\s]/g, '');

      const matched = name.includes(cleanQuery) || 
                      num.includes(cleanQuery) || 
                      role.includes(cleanQuery) || 
                      email.includes(cleanQuery) ||
                      birthday.includes(cleanQuery) ||
                      (phone && (phone.includes(cleanQuery) || (queryNoHyphen && phone.includes(queryNoHyphen))));
      if (!matched) return;
    }

    // 役割フィルター (代表, 副代表, メンバー)
    if (selectedRole !== 'all') {
      let r = String(m.role || 'メンバー').trim();
      if (r === '部員') r = 'メンバー';
      if (r !== selectedRole) return;
    }

    // ポジションフィルター
    if (selectedPos !== 'all') {
      const p = String(m.position || '').trim().toUpperCase();
      if (p !== selectedPos) return;
    }

    const isOb = !!m.isPast || m.memberType === 'PAST';
    const isSuspended = !isOb && (!!m.isSuspended || m.memberType === 'SUSPENDED');

    if (isOb) {
      obList.push(m);
    } else if (isSuspended) {
      suspendedList.push(m);
    } else {
      activeList.push(m);
    }
  });

  // セクション人数バッジ更新
  const countActiveEl = document.getElementById('sectionCountActive');
  const countSuspendedEl = document.getElementById('sectionCountSuspended');
  const countObEl = document.getElementById('sectionCountOb');
  if (countActiveEl) countActiveEl.textContent = activeList.length + '名';
  if (countSuspendedEl) countSuspendedEl.textContent = suspendedList.length + '名';
  if (countObEl) countObEl.textContent = obList.length + '名';

  // 1. 現役メンバーセクション描画
  renderCardsToContainer(activeList, 'membersListActive', 'active');

  // 2. 休部中メンバーセクション描画
  renderCardsToContainer(suspendedList, 'membersListSuspended', 'suspended');
  const suspendedHint = document.getElementById('suspendedEmptyHint');
  if (suspendedHint) {
    if (suspendedList.length === 0) suspendedHint.classList.remove('hidden');
    else suspendedHint.classList.add('hidden');
  }

  // 3. OBメンバーセクション描画
  renderCardsToContainer(obList, 'membersListOb', 'ob');
  const obHint = document.getElementById('obEmptyHint');
  if (obHint) {
    if (obList.length === 0) obHint.classList.remove('hidden');
    else obHint.classList.add('hidden');
  }

  // 全体0件の制御
  const totalEmptyEl = document.getElementById('membersTotalEmpty');
  const secActive = document.getElementById('sectionActiveMembers');
  const secSuspended = document.getElementById('sectionSuspendedMembers');
  const secOb = document.getElementById('sectionObMembers');

  const isTotalEmpty = (activeList.length === 0 && suspendedList.length === 0 && obList.length === 0);
  if (totalEmptyEl) {
    if (isTotalEmpty) {
      totalEmptyEl.classList.remove('hidden');
      if (secActive) secActive.classList.add('hidden');
      if (secSuspended) secSuspended.classList.add('hidden');
      if (secOb) secOb.classList.add('hidden');
    } else {
      totalEmptyEl.classList.add('hidden');
      if (secActive) secActive.classList.remove('hidden');
      if (secSuspended) secSuspended.classList.remove('hidden');
      if (secOb) secOb.classList.remove('hidden');
    }
  }
}

/**
 * 検索クリア
 */
function clearMemberSearch() {
  const searchInput = document.getElementById('memberSearchInput');
  if (searchInput) searchInput.value = '';
  filterMembersList();
}

/**
 * 生年月日文字列から満年齢を計算して "YYYY/MM/DD (XX歳)" 形式で返す
 * @param {string} birthdayStr
 * @returns {string}
 */
function formatBirthdayWithAge(birthdayStr) {
  if (!birthdayStr) return '';
  const cleanStr = String(birthdayStr).trim();
  const parts = cleanStr.split(/[-/.]/);
  if (parts.length !== 3) return cleanStr;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10);
  const birthDay = parseInt(parts[2], 10);
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return cleanStr;

  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const monthDiff = (today.getMonth() + 1) - birthMonth;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
    age--;
  }
  if (age >= 0 && age < 150) {
    return `${cleanStr} (${age}歳)`;
  }
  return cleanStr;
}

/**
 * 指定コンテナへのメンバーカード生成・挿入
 * @param {Array} list 
 * @param {string} containerId 
 * @param {'active'|'suspended'|'ob'} sectionType 
 */
function renderCardsToContainer(list, containerId, sectionType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.replaceChildren();

  if (!list || list.length === 0) return;

  const tplCard = document.getElementById('tpl-member-card');
  if (!tplCard) return;

  list.forEach(m => {
    const clone = tplCard.content.cloneNode(true);
    const card = clone.querySelector('.member-card');

    const name = String(m.name || '').trim();
    let role = String(m.role || 'メンバー').trim();
    if (role === '部員') role = 'メンバー';
    const position = String(m.position || '').trim().toUpperCase();
    const rawNumber = (m.number !== undefined && m.number !== 999 && m.number !== '') ? m.number : '';
    const email = String(m.email || '').trim();
    const birthday = String(m.birthday || '').trim();
    const phone = String(m.phone || '').trim();

    const isOb = !!m.isPast || m.memberType === 'PAST';
    const isSuspended = !isOb && (!!m.isSuspended || m.memberType === 'SUSPENDED');

    if (isOb) {
      card.classList.add('is-ob');
    } else if (isSuspended) {
      card.classList.add('is-suspended');
    }

    // 役割バッジクラス
    let roleClass = 'badge-role-member';
    if (role === '代表') roleClass = 'badge-role-daihyo';
    else if (role === '副代表') roleClass = 'badge-role-fuku';

    // 選手名
    card.querySelectorAll('.member-card-name').forEach(el => {
      el.textContent = name;
    });

    // 背番号バッジ (#10)
    card.querySelectorAll('.member-number-badge').forEach(el => {
      if (rawNumber !== '') {
        el.textContent = '#' + rawNumber;
        el.classList.remove('hidden');
      } else {
        el.textContent = '';
        el.classList.add('hidden');
      }
    });

    // 役割バッジ: 代表・副代表のみ表示し、一般的な「メンバー」は非表示にして情報過多を解消
    card.querySelectorAll('.badge-role').forEach(el => {
      if (role === '代表' || role === '副代表') {
        el.textContent = role;
        el.className = 'badge-role ' + roleClass;
        el.classList.remove('hidden');
      } else {
        el.textContent = '';
        el.className = 'badge-role hidden';
      }
    });

    // ポジションバッジ (FP / GK)
    card.querySelectorAll('.badge-pos').forEach(el => {
      if (position === 'FP') {
        el.textContent = 'FP';
        el.className = 'badge-pos badge-pos-fp';
        el.classList.remove('hidden');
      } else if (position === 'GK') {
        el.textContent = 'GK';
        el.className = 'badge-pos badge-pos-gk';
        el.classList.remove('hidden');
      } else {
        el.textContent = '';
        el.className = 'badge-pos hidden';
      }
    });

    // Google連携バッジ (メール欄に小さく添える)
    card.querySelectorAll('.badge-google-link').forEach(el => {
      if (email) {
        el.replaceChildren();
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined google-link-icon';
        icon.textContent = m.hasCalendarLink ? 'check_circle' : 'error';
        el.appendChild(icon);
        el.appendChild(document.createTextNode(m.hasCalendarLink ? ' 連携済' : ' 未連携'));
        el.className = 'badge-google-link ' + (m.hasCalendarLink ? 'badge-google-linked' : 'badge-google-unlinked');
        el.title = m.hasCalendarLink ? 'Googleカレンダー連携完了' : 'Googleアカウント未連携（ログイン時に認証が必要です）';
        el.classList.remove('hidden');
      } else {
        el.replaceChildren();
        el.className = 'badge-google-link hidden';
      }
    });

    // アバター画像 (PC & スマホ: 共通ヘルパーで解決)
    const avatarUrl = typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(m) : (m.avatarUrl || m.avatar || '');
    card.querySelectorAll('.member-card-avatar-wrap').forEach(wrap => {
      const img = wrap.querySelector('.member-card-avatar');
      const placeholder = wrap.querySelector('.member-card-avatar-placeholder');
      if (img && placeholder) {
        if (avatarUrl) {
          img.src = avatarUrl;
          img.alt = name;
          img.classList.remove('hidden');
          placeholder.classList.add('hidden');
          img.onerror = function() {
            img.classList.add('hidden');
            placeholder.classList.remove('hidden');
          };
        } else {
          img.src = '';
          img.classList.add('hidden');
          placeholder.classList.remove('hidden');
        }
      }
    });

    // --- PC用メタ情報 ---
    const pcBirthday = card.querySelector('.member-card-pc .member-info-birthday');
    if (pcBirthday) {
      if (birthday) {
        pcBirthday.querySelector('.member-birthday-text').textContent = formatBirthdayWithAge(birthday);
        pcBirthday.classList.remove('hidden');
      } else {
        pcBirthday.classList.add('hidden');
      }
    }

    const pcPhone = card.querySelector('.member-card-pc .member-info-phone');
    if (pcPhone) {
      if (phone) {
        pcPhone.querySelector('.member-phone-text').textContent = phone;
        pcPhone.classList.remove('hidden');
      } else {
        pcPhone.classList.add('hidden');
      }
    }

    const pcEmail = card.querySelector('.member-card-pc .member-info-email');
    if (pcEmail) {
      const emailText = pcEmail.querySelector('.member-email-text');
      if (email) {
        emailText.textContent = email;
        emailText.classList.remove('text-muted');
      } else {
        emailText.textContent = 'メール未登録';
        emailText.classList.add('text-muted');
      }
    }

    // --- スマホ用メタ情報 ---
    const mobBirthday = card.querySelector('.member-card-mobile .member-meta-birthday');
    if (mobBirthday) {
      const textEl = mobBirthday.querySelector('.member-birthday-text');
      if (birthday) {
        textEl.textContent = formatBirthdayWithAge(birthday);
        mobBirthday.classList.remove('text-muted-meta');
      } else {
        textEl.textContent = '未登録';
        mobBirthday.classList.add('text-muted-meta');
      }
    }

    const mobPhone = card.querySelector('.member-card-mobile .member-meta-phone');
    if (mobPhone) {
      const textEl = mobPhone.querySelector('.member-phone-text');
      if (phone) {
        textEl.textContent = phone;
        mobPhone.classList.remove('text-muted-meta');
      } else {
        textEl.textContent = '未登録';
        mobPhone.classList.add('text-muted-meta');
      }
    }

    const mobEmail = card.querySelector('.member-card-mobile .member-meta-email');
    if (mobEmail) {
      const textEl = mobEmail.querySelector('.member-email-text');
      if (email) {
        textEl.textContent = email;
        mobEmail.classList.remove('text-muted-meta');
      } else {
        textEl.textContent = 'メール未登録';
        mobEmail.classList.add('text-muted-meta');
      }
    }

    // --- 操作ボタン / 権限 ---
    const canEdit = canEditTarget(role);
    card.querySelectorAll('.member-card-actions').forEach(actionsArea => {
      const restoreBtn = actionsArea.querySelector('.btn-member-restore');
      const editBtn = actionsArea.querySelector('.btn-member-edit');
      const lockBadge = actionsArea.querySelector('.badge-role-locked');

      if (canEdit) {
        if (editBtn) {
          editBtn.classList.remove('hidden');
          editBtn.onclick = () => openMemberEditModalByName(m.name);
        }
        if (restoreBtn) {
          if (sectionType === 'active') {
            restoreBtn.classList.add('hidden');
          } else {
            restoreBtn.classList.remove('hidden');
            restoreBtn.onclick = () => handleRestoreMember(m.name);
          }
        }
        if (lockBadge) lockBadge.classList.add('hidden');
      } else {
        if (editBtn) editBtn.classList.add('hidden');
        if (restoreBtn) restoreBtn.classList.add('hidden');
        if (lockBadge) lockBadge.classList.remove('hidden');
      }
    });

    container.appendChild(clone);
  });
}

/**
 * 選手名の空白正規化
 * 苗字と名前の間の全角空白（\u3000）を半角空白に変換し、連続する空白を1つに集約、前後の空白をトリム
 */
function normalizeMemberName(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * フィールド単位のエラー表示を設定
 */
function setFieldError(fieldId, errorMsg) {
  const inputEl = document.getElementById(fieldId);
  const errEl = document.getElementById('err-' + fieldId);
  if (inputEl) inputEl.classList.add('input-has-error');
  if (errEl) {
    errEl.textContent = errorMsg || '';
    errEl.classList.remove('hidden');
  }
}

/**
 * フィールド単位のエラー表示をクリア
 */
function clearFieldError(fieldId) {
  const inputEl = document.getElementById(fieldId);
  const errEl = document.getElementById('err-' + fieldId);
  if (inputEl) inputEl.classList.remove('input-has-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
}

/**
 * 全フィールドのエラー表示をクリア
 */
function clearAllFieldErrors() {
  ['memberEditName', 'memberEditNumber', 'memberEditBirthday', 'memberEditPhone', 'memberEditEmail'].forEach(clearFieldError);
}

/**
 * 選手名のバリデーション
 */
function validateMemberNameField() {
  const input = document.getElementById('memberEditName');
  if (!input) return true;

  // 入力値の全角スペースを自動で半角スペースに変換
  const normalized = normalizeMemberName(input.value);
  if (input.value !== normalized && normalized !== '') {
    input.value = normalized;
  }

  if (!normalized) {
    setFieldError('memberEditName', '選手名を入力してください。');
    return false;
  }
  if (normalized.length > 30) {
    setFieldError('memberEditName', '選手名は30文字以内で入力してください。');
    return false;
  }

  const isNew = document.getElementById('memberEditIsNew').value === 'true';
  const originalName = document.getElementById('memberEditOriginalName').value.trim();
  const list = window.adminMemberList || [];

  const compareName = normalized.replace(/\s+/g, '').toLowerCase();
  const origCompare = originalName.replace(/[\s\u3000]+/g, '').toLowerCase();

  // 新規追加、または名前が変更された場合の重複チェック
  if (isNew || (compareName !== origCompare)) {
    const dup = list.find(m => {
      if (!isNew && m.name === originalName) return false;
      return String(m.name || '').replace(/[\s\u3000]+/g, '').toLowerCase() === compareName;
    });
    if (dup) {
      setFieldError('memberEditName', `選手名「${normalized}」は既に登録されています。`);
      return false;
    }
  }

  clearFieldError('memberEditName');
  return true;
}

/**
 * 背番号のバリデーション（2桁まで: 0〜99、重複チェック）
 */
function validateMemberNumberField() {
  const input = document.getElementById('memberEditNumber');
  if (!input) return true;

  let val = String(input.value || '').trim();
  if (val === '') {
    clearFieldError('memberEditNumber');
    return true; // 任意
  }

  // 全角数字を半角数字に変換
  val = val.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  if (val.length > 2) {
    val = val.slice(0, 2);
  }
  input.value = val;

  const num = Number(val);
  if (isNaN(num) || !Number.isInteger(num) || num < 0 || num > 99) {
    setFieldError('memberEditNumber', '背番号は0〜99の半角数字で入力してください。');
    return false;
  }

  const isNew = document.getElementById('memberEditIsNew').value === 'true';
  const originalName = document.getElementById('memberEditOriginalName').value.trim();
  const list = window.adminMemberList || [];

  const dup = list.find(m => {
    if (!isNew && m.name === originalName) return false;
    return m.number === num;
  });
  if (dup) {
    setFieldError('memberEditNumber', `背番号「${num}」は既に「${dup.name}」選手が使用しています。`);
    return false;
  }

  clearFieldError('memberEditNumber');
  return true;
}

/**
 * 生年月日のバリデーション（YYYY/MM/DD形式のみ許容、実在日チェック、未来日不可）
 */
function validateMemberBirthdayField() {
  const input = document.getElementById('memberEditBirthday');
  if (!input) return true;

  let val = String(input.value || '').trim();
  if (val === '') {
    clearFieldError('memberEditBirthday');
    return true; // 任意
  }

  // 全角数字・スラッシュを半角に変換
  val = val.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
           .replace(/[\uff0f]/g, '/')
           .trim();

  // YYYY-MM-DD や YYYY/M/D 入力時に自動でゼロ埋め YYYY/MM/DD に補正
  const m = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    val = `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
    input.value = val;
  }

  // YYYY/MM/DD 形式のみ許容
  if (!/^\d{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.test(val)) {
    setFieldError('memberEditBirthday', '生年月日は YYYY/MM/DD 形式で入力してください（例: 1995/05/12）。');
    return false;
  }

  const parts = val.split('/').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const dObj = new Date(year, month - 1, day);

  if (dObj.getFullYear() !== year || (dObj.getMonth() + 1) !== month || dObj.getDate() !== day) {
    setFieldError('memberEditBirthday', '実在する生年月日を入力してください。');
    return false;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (dObj > today) {
    setFieldError('memberEditBirthday', '未来の日付は生年月日に指定できません。');
    return false;
  }

  if (year < 1920) {
    setFieldError('memberEditBirthday', '生年月日は1920年以降を入力してください。');
    return false;
  }

  clearFieldError('memberEditBirthday');
  return true;
}

/**
 * 電話番号のバリデーション（10〜11桁、0から開始）
 */
function validateMemberPhoneField() {
  const input = document.getElementById('memberEditPhone');
  if (!input) return true;

  let val = String(input.value || '').trim();
  if (val === '') {
    clearFieldError('memberEditPhone');
    return true; // 任意
  }

  // 全角数字・ハイフンを半角に変換
  val = val.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
           .replace(/[ー−―‐－]/g, '-')
           .trim();

  // ハイフンなし数字のみの場合、自動でハイフン挿入
  if (!val.includes('-')) {
    if (/^(0[5789]0)(\d{4})(\d{4})$/.test(val)) {
      val = val.replace(/^(0[5789]0)(\d{4})(\d{4})$/, '$1-$2-$3');
    } else if (/^(0\d{1,3})(\d{2,4})(\d{4})$/.test(val)) {
      val = val.replace(/^(0\d{1,3})(\d{2,4})(\d{4})$/, '$1-$2-$3');
    }
    input.value = val;
  }

  const digits = val.replace(/\D/g, '');
  if (!/^0\d{9,10}$/.test(digits)) {
    setFieldError('memberEditPhone', '電話番号は正しい形式（例: 090-1234-5678）で入力してください。');
    return false;
  }

  clearFieldError('memberEditPhone');
  return true;
}

let memberEmailCheckTimer = null;
let lastVerifiedEmail = '';
let lastVerifiedEmailResult = null;

/**
 * メールアドレスのバリデーション（Google認証判定・重複チェック）
 */
function validateMemberEmailField() {
  const input = document.getElementById('memberEditEmail');
  if (!input) return true;

  // 編集時で読み取り専用の場合はチェックをパス
  if (input.readOnly) {
    clearFieldError('memberEditEmail');
    return true;
  }

  let val = String(input.value || '').trim().toLowerCase();
  input.value = val;

  if (val === '') {
    clearFieldError('memberEditEmail');
    return true; // 任意項目
  }

  // 基本的なメールアドレス書式チェック
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(val)) {
    setFieldError('memberEditEmail', 'メールアドレスの形式が正しくありません。');
    return false;
  }

  // 重複チェック
  const isNew = document.getElementById('memberEditIsNew').value === 'true';
  const originalName = document.getElementById('memberEditOriginalName').value.trim();
  const list = window.adminMemberList || [];

  const dup = list.find(m => {
    if (!isNew && m.name === originalName) return false;
    return m.email && m.email.toLowerCase() === val;
  });
  if (dup) {
    setFieldError('memberEditEmail', `メールアドレス「${val}」は既に「${dup.name}」選手に登録されています。`);
    return false;
  }

  // 書式・重複ともに問題なし（※DNSチェックは保存実行時に行われます）
  clearFieldError('memberEditEmail');
  return true;
}

/**
 * フォーム全体のバリデーション実行
 * @returns {boolean}
 */
function validateAllMemberFields() {
  clearAllFieldErrors();
  
  const vName = validateMemberNameField();
  const vNumber = validateMemberNumberField();
  const vBirthday = validateMemberBirthdayField();
  const vPhone = validateMemberPhoneField();
  const vEmail = validateMemberEmailField();

  const isValid = vName && vNumber && vBirthday && vPhone && vEmail;

  if (!isValid) {
    // 最初のエラー項目に自動フォーカス
    if (!vName) { document.getElementById('memberEditName')?.focus(); }
    else if (!vNumber) { document.getElementById('memberEditNumber')?.focus(); }
    else if (!vBirthday) { document.getElementById('memberEditBirthday')?.focus(); }
    else if (!vPhone) { document.getElementById('memberEditPhone')?.focus(); }
    else if (!vEmail) { document.getElementById('memberEditEmail')?.focus(); }
  }

  return isValid;
}

/**
 * 入力欄のリアルタイム補正＆エラー解除リスナーを設定
 */
function initMemberFormValidationListeners() {
  const nameInput = document.getElementById('memberEditName');
  if (nameInput && !nameInput.dataset.listenerAttached) {
    nameInput.dataset.listenerAttached = 'true';
    nameInput.addEventListener('blur', () => {
      nameInput.value = normalizeMemberName(nameInput.value);
      validateMemberNameField();
    });
    nameInput.addEventListener('input', () => {
      if (nameInput.value.includes('\u3000')) {
        nameInput.value = nameInput.value.replace(/[\u3000]/g, ' ');
      }
      if (nameInput.classList.contains('input-has-error')) validateMemberNameField();
    });
  }

  const numInput = document.getElementById('memberEditNumber');
  if (numInput && !numInput.dataset.listenerAttached) {
    numInput.dataset.listenerAttached = 'true';
    numInput.addEventListener('input', () => {
      if (numInput.value.length > 2) numInput.value = numInput.value.slice(0, 2);
      if (numInput.classList.contains('input-has-error')) validateMemberNumberField();
    });
    numInput.addEventListener('blur', validateMemberNumberField);
  }

  const bdayInput = document.getElementById('memberEditBirthday');
  if (bdayInput && !bdayInput.dataset.listenerAttached) {
    bdayInput.dataset.listenerAttached = 'true';
    bdayInput.addEventListener('blur', validateMemberBirthdayField);
    bdayInput.addEventListener('input', () => {
      if (bdayInput.classList.contains('input-has-error')) validateMemberBirthdayField();
    });
  }

  const phoneInput = document.getElementById('memberEditPhone');
  if (phoneInput && !phoneInput.dataset.listenerAttached) {
    phoneInput.dataset.listenerAttached = 'true';
    phoneInput.addEventListener('blur', validateMemberPhoneField);
    phoneInput.addEventListener('input', () => {
      if (phoneInput.classList.contains('input-has-error')) validateMemberPhoneField();
    });
  }

  const emailInput = document.getElementById('memberEditEmail');
  if (emailInput && !emailInput.dataset.listenerAttached) {
    emailInput.dataset.listenerAttached = 'true';
    emailInput.addEventListener('blur', validateMemberEmailField);
    emailInput.addEventListener('input', () => {
      if (emailInput.classList.contains('input-has-error')) validateMemberEmailField();
    });
  }
}

/**
 * 新規メンバー追加モーダルを開く
 */
function openMemberAddModal() {
  document.getElementById('memberEditModalTitle').textContent = '新規メンバー追加';
  document.getElementById('memberEditIsNew').value = 'true';
  document.getElementById('memberEditOriginalName').value = '';

  document.getElementById('memberEditName').value = '';
  document.getElementById('memberEditNumber').value = '';
  document.getElementById('memberEditPosition').value = 'FP';
  
  const roleSelect = document.getElementById('memberEditRole');
  if (roleSelect) {
    roleSelect.value = 'メンバー';

    // 副代表の場合は「代表」オプションを選択不可に制限
    const actorRole = getCurrentActorRole();
    const daihyoOption = roleSelect.querySelector('option[value="代表"]');
    if (daihyoOption) {
      const isAllowed = (actorRole === '代表');
      daihyoOption.disabled = !isAllowed;
      daihyoOption.hidden = !isAllowed;
    }
  }

  const statusSelect = document.getElementById('memberEditStatusSelect');
  if (statusSelect) statusSelect.value = 'ACTIVE';
  handleMemberStatusSelectChange();

  const delTrigger = document.getElementById('btnDeleteMemberTrigger');
  if (delTrigger) delTrigger.classList.add('hidden'); // 新規追加時は完全削除不要

  const submitBtn = document.getElementById('btnSaveMemberSubmit');
  if (submitBtn) {
    submitBtn.textContent = '追加';
    submitBtn.disabled = false;
  }

  const emailInput = document.getElementById('memberEditEmail');
  if (emailInput) {
    emailInput.value = '';
    emailInput.readOnly = false;
    emailInput.classList.remove('input-readonly');
    emailInput.placeholder = '例: member@gmail.com';
  }
  lastVerifiedEmail = '';
  lastVerifiedEmailResult = null;

  const birthdayInput = document.getElementById('memberEditBirthday');
  if (birthdayInput) birthdayInput.value = '';
  const phoneInput = document.getElementById('memberEditPhone');
  if (phoneInput) phoneInput.value = '';

  clearAllFieldErrors();
  setMemberFormStatus('', '');
  initMemberFormValidationListeners();

  openModalById('memberEditModal');
  setTimeout(() => {
    const nameInput = document.getElementById('memberEditName');
    if (nameInput) nameInput.focus();
  }, 150);
}

/**
 * 既存メンバー編集モーダルを開く
 */
function openMemberEditModalByName(memberName) {
  const list = window.adminMemberList || [];
  const member = list.find(m => m.name === memberName);
  if (!member) return;

  window.currentEditingMember = member;

  let targetRole = String(member.role || 'メンバー').trim();
  if (targetRole === '部員') targetRole = 'メンバー';

  // 権限チェック: 自分より上位のロール（代表）は編集不可
  if (!canEditTarget(targetRole)) {
    showAppAlert({ title: '権限エラー', message: '上位ロール（代表）のメンバーを編集する権限はありません。', isError: true });
    return;
  }

  document.getElementById('memberEditModalTitle').textContent = 'メンバーの編集';
  document.getElementById('memberEditIsNew').value = 'false';
  document.getElementById('memberEditOriginalName').value = member.name;

  document.getElementById('memberEditName').value = member.name;
  document.getElementById('memberEditNumber').value = (member.number !== undefined && member.number !== 999) ? member.number : '';
  document.getElementById('memberEditPosition').value = member.position || '';

  const roleSelect = document.getElementById('memberEditRole');
  if (roleSelect) {
    const validRoles = ['メンバー', '副代表', '代表'];
    roleSelect.value = validRoles.includes(targetRole) ? targetRole : 'メンバー';

    // 副代表の場合は「代表」オプションを選択不可に制限
    const actorRole = getCurrentActorRole();
    const daihyoOption = roleSelect.querySelector('option[value="代表"]');
    if (daihyoOption) {
      const isAllowed = (actorRole === '代表');
      daihyoOption.disabled = !isAllowed;
      daihyoOption.hidden = !isAllowed;
    }
  }

  const isOb = !!member.isPast || member.memberType === 'PAST';
  const isSuspended = !isOb && (!!member.isSuspended || member.memberType === 'SUSPENDED');
  const statusSelect = document.getElementById('memberEditStatusSelect');
  if (statusSelect) {
    if (isOb) statusSelect.value = 'OB';
    else if (isSuspended) statusSelect.value = 'SUSPENDED';
    else statusSelect.value = 'ACTIVE';
  }
  handleMemberStatusSelectChange();

  // メンバー削除ボタン: 既存メンバー編集時は表示（上位ロールの権限チェックあり）
  const delTrigger = document.getElementById('btnDeleteMemberTrigger');
  if (delTrigger) delTrigger.classList.remove('hidden');

  const birthdayInput = document.getElementById('memberEditBirthday');
  if (birthdayInput) birthdayInput.value = member.birthday || '';
  const phoneInput = document.getElementById('memberEditPhone');
  if (phoneInput) phoneInput.value = member.phone || '';

  const submitBtn = document.getElementById('btnSaveMemberSubmit');
  if (submitBtn) {
    submitBtn.textContent = '更新';
    submitBtn.disabled = false;
  }

  const emailInput = document.getElementById('memberEditEmail');
  if (emailInput) {
    emailInput.value = member.email || '';
    emailInput.readOnly = false;
    emailInput.classList.remove('input-readonly');
    emailInput.placeholder = '例: member@gmail.com';
  }

  clearAllFieldErrors();
  setMemberFormStatus('', '');
  initMemberFormValidationListeners();

  openModalById('memberEditModal');
}

/**
 * メンバー編集モーダルを閉じる
 */
function closeMemberEditModal(e) {
  if (e && e.target && e.target.closest('.member-modal-content') && !e.target.closest('.modal-close') && !e.target.closest('.btn-member-modal-cancel')) {
    return;
  }
  clearAllFieldErrors();
  closeModalById('memberEditModal');
}

/**
 * メンバー保存フォーム送信処理
 */
function handleSaveMemberSubmit(e) {
  if (e) {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch(err) {}
  }

  // 1. 全項目のバリデーションチェック（不備があれば即時ブロック）
  if (!validateAllMemberFields()) {
    setMemberFormStatus('入力内容に不備があります。赤字のエラー項目を確認してください。', 'error');
    return;
  }

  const isNew = document.getElementById('memberEditIsNew').value === 'true';
  const originalName = document.getElementById('memberEditOriginalName').value.trim();
  const name = normalizeMemberName(document.getElementById('memberEditName').value);
  const number = document.getElementById('memberEditNumber').value.trim();
  const position = document.getElementById('memberEditPosition').value.trim();
  
  const roleSelect = document.getElementById('memberEditRole');
  let role = roleSelect ? roleSelect.value : 'メンバー';
  if (role === '部員') role = 'メンバー';

  const birthday = (document.getElementById('memberEditBirthday')?.value || '').trim();
  const phone = (document.getElementById('memberEditPhone')?.value || '').trim();
  const email = document.getElementById('memberEditEmail').value.trim();

  // クライアント側権限二重チェック
  const actorRole = getCurrentActorRole();
  const actorLevel = ROLE_LEVEL[actorRole] !== undefined ? ROLE_LEVEL[actorRole] : 0;
  const newRoleLevel = ROLE_LEVEL[role] !== undefined ? ROLE_LEVEL[role] : 0;

  if (newRoleLevel > actorLevel) {
    setMemberFormStatus(`自身のロール（${actorRole}）を超える役割（${role}）を付与することはできません。`, 'error');
    return;
  }

  if (!isNew && originalName) {
    const list = window.adminMemberList || [];
    const orig = list.find(m => m.name === originalName);
    if (orig && !canEditTarget(orig.role)) {
      setMemberFormStatus('上位ロール（代表）のメンバーを編集する権限はありません。', 'error');
      return;
    }
  }

  const statusVal = document.getElementById('memberEditStatusSelect')?.value || 'ACTIVE';
  const isOb = (statusVal === 'OB');
  const isSuspended = (statusVal === 'SUSPENDED');

  const payload = {
    isNew: isNew,
    originalName: originalName,
    name: name,
    number: number,
    role: role,
    position: position,
    birthday: birthday,
    phone: phone,
    email: email,
    isPast: isOb,
    isSuspended: isSuspended,
    memberType: isOb ? 'PAST' : 'REGULAR'
  };

  const u = window.currentUser || {};
  const actorEmail = u.email || '';
  const actorName = u.name || '';

  const submitBtn = document.getElementById('btnSaveMemberSubmit');
  const origBtnText = submitBtn ? submitBtn.textContent : (isNew ? '追加' : '更新');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = isNew ? '追加中...' : '更新中...';
  }
  // ボタン自体が「更新中...」/「追加中...」に変化するため、ボタン上部のスピナー・ステータス表示は不要
  setMemberFormStatus('', '');

  google.script.run
    .withSuccessHandler(res => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origBtnText;
      }

      if (res && res.success) {
        if (res.roster) {
          if (typeof syncUpdatedMemberList === 'function') {
            syncUpdatedMemberList(res.roster);
          } else {
            window.adminMemberList = res.roster;
            window.scheduleRoster = res.roster;
            if (typeof updateScheduleMemberListOptions === 'function') {
              updateScheduleMemberListOptions(res.roster);
            }
            renderMembersList(window.adminMemberList);
          }
        }
        closeModalById('memberEditModal');
        if (res.emailChanged && res.savedEmail) {
          openAdminOAuthGuidanceModal(res.savedName, res.savedEmail);
        }
      } else {
        if (res && res.error && (res.error.includes('メール') || res.error.includes('Google認証'))) {
          setFieldError('memberEditEmail', res.error);
          setMemberFormStatus('', '');
          document.getElementById('memberEditEmail')?.focus();
        } else {
          setMemberFormStatus(res && res.error ? res.error : '保存処理に失敗しました。', 'error');
        }
      }
    })
    .withFailureHandler(err => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origBtnText;
      }
      setMemberFormStatus('エラーが発生しました: ' + (err.message || ''), 'error');
    })
    .apiSaveMember(payload, actorEmail, actorName);
}

let currentGuidanceEmail = '';
let currentGuidanceName = '';

/**
 * 管理者向け Google OAuth設定案内モーダルを開く
 */
function openAdminOAuthGuidanceModal(name, email) {
  currentGuidanceName = name || '';
  currentGuidanceEmail = email || '';
  const nameEl = document.getElementById('adminGuidanceMemberName');
  const emailEl = document.getElementById('adminGuidanceEmailText');
  if (nameEl) nameEl.textContent = currentGuidanceName;
  if (emailEl) emailEl.textContent = currentGuidanceEmail;
  openModalById('adminOAuthGuidanceModal');
}

/**
 * 管理者向けGoogle OAuth設定案内モーダルを閉じる
 * @param {Event} [e] - イベントオブジェクト
 * @returns {void}
 */
function closeAdminOAuthGuidanceModal(e) {
  if (e && e.target && e.target.closest('.member-modal-content') && !e.target.closest('.modal-close') && !e.target.closest('.btn-member-modal-cancel')) {
    return;
  }
  closeModalById('adminOAuthGuidanceModal');
}

/**
 * 案内モーダル内の登録メールアドレスをクリップボードにコピーする
 * @returns {void}
 */
function copyGuidanceEmail() {
  if (!currentGuidanceEmail) return;
  navigator.clipboard.writeText(currentGuidanceEmail).then(() => {
    const btn = document.getElementById('btnCopyGuidanceEmail');
    if (btn) {
      btn.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined guidance-copy-icon';
      icon.textContent = 'check';
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(' コピー済'));
      setTimeout(() => {
        btn.replaceChildren();
        const copyIcon = document.createElement('span');
        copyIcon.className = 'material-symbols-outlined guidance-copy-icon';
        copyIcon.textContent = 'content_copy';
        btn.appendChild(copyIcon);
        btn.appendChild(document.createTextNode(' コピー'));
      }, 2000);
    }
  }).catch(() => {
    showAppAlert({ title: 'コピー失敗', message: 'コピーに失敗しました: ' + currentGuidanceEmail, isError: true });
  });
}

/**
 * 休部中またはOB選手をワンタップで「現役」へ復帰
 * @param {string} memberName 
 */
async function handleRestoreMember(memberName) {
  const list = window.adminMemberList || [];
  const member = list.find(m => m.name === memberName);
  if (!member) return;

  let targetRole = String(member.role || 'メンバー').trim();
  if (targetRole === '部員') targetRole = 'メンバー';
  if (!canEditTarget(targetRole)) {
    showAppAlert({ title: '権限エラー', message: '上位ロール（代表）のメンバーを操作する権限はありません。', isError: true });
    return;
  }

  const ok = await showAppConfirm({
    title: '現役復帰の確認',
    message: `「${member.name}」選手を現役に復帰させますか？\n（※出欠催促やアナウンス通知の配信対象に復帰します）`,
    okText: '現役に復帰',
    cancelText: 'キャンセル',
    icon: 'restart_alt'
  });
  if (!ok) return;

  const payload = {
    isNew: false,
    originalName: member.name,
    name: member.name,
    number: (member.number !== undefined && member.number !== 999) ? member.number : '',
    role: member.role || 'メンバー',
    position: member.position || '',
    birthday: member.birthday || '',
    phone: member.phone || '',
    email: member.email || '',
    isPast: false,
    isSuspended: false,
    memberType: 'REGULAR'
  };

  const u = window.currentUser || {};
  const actorEmail = u.email || '';
  const actorName = u.name || '';

  // Supabase Direct (バイパス経由で即時更新 0.1s)
  google.script.run
    .withSuccessHandler(res => {
      if (res && res.success) {
        if (res.roster) {
          if (typeof syncUpdatedMemberList === 'function') {
            syncUpdatedMemberList(res.roster);
          } else {
            window.adminMemberList = res.roster;
            window.scheduleRoster = res.roster;
            if (typeof updateScheduleMemberListOptions === 'function') {
              updateScheduleMemberListOptions(res.roster);
            }
            renderMembersList(window.adminMemberList);
          }
        }
      } else {
        showAppAlert({ title: '復帰エラー', message: '復帰処理に失敗しました: ' + (res && res.error ? res.error : ''), isError: true });
      }
    })
    .withFailureHandler(err => {
      showAppAlert({ title: '通信エラー', message: 'エラーが発生しました: ' + (err.message || ''), isError: true });
    })
    .apiSaveMember(payload, actorEmail, actorName);
}

/**
 * 編集モーダル内の「メンバーを削除」ボタンから確認モーダルを開く
 */
function openMemberDeleteConfirmFromModal() {
  const member = window.currentEditingMember;
  if (!member) return;

  let targetRole = String(member.role || 'メンバー').trim();
  if (targetRole === '部員') targetRole = 'メンバー';
  if (!canEditTarget(targetRole)) {
    showAppAlert({ title: '権限エラー', message: '上位ロール（代表）のメンバーを削除する権限はありません。', isError: true });
    return;
  }

  window.currentDeletingMember = member;

  const titleEl = document.getElementById('memberDeleteNameTitle');
  if (titleEl) {
    titleEl.textContent = `「${member.name}」さんの登録を削除しますか？`;
  }

  // アバター表示
  const imgEl = document.getElementById('memberDeleteAvatarImg');
  const placeholderEl = document.getElementById('memberDeleteAvatarPlaceholder');
  if (imgEl && placeholderEl) {
    const avatarUrl = typeof getMemberAvatarUrl === 'function' ? getMemberAvatarUrl(member) : (member.avatarUrl || member.avatar || '');
    if (avatarUrl) {
      imgEl.src = avatarUrl;
      imgEl.alt = member.name;
      imgEl.classList.remove('hidden');
      placeholderEl.classList.add('hidden');
    } else {
      imgEl.src = '';
      imgEl.classList.add('hidden');
      placeholderEl.classList.remove('hidden');
    }
  }

  // 備品を所持しているかチェック（所持している場合は「未割当」になる注意を表示）
  const eqItems = (window.equipmentState && window.equipmentState.itemsList) || (window.initialFullData && window.initialFullData.equipmentData && window.initialFullData.equipmentData.itemsList) || [];
  const mId = member.memberId || member.id || '';
  const mName = member.name || '';
  const isHoldingEquipment = eqItems.some(it => (mId && (it.memberId === mId || it.holderId === mId)) || (mName && (it.memberName === mName || it.holderName === mName)));

  const guardAlert = document.getElementById('memberDeleteGuardAlert');
  if (guardAlert) {
    if (isHoldingEquipment) {
      guardAlert.classList.remove('hidden');
    } else {
      guardAlert.classList.add('hidden');
    }
  }

  const deleteDesc = document.getElementById('memberDeleteDesc');
  if (deleteDesc) deleteDesc.classList.remove('hidden');

  const deleteBtn = document.getElementById('btnConfirmDeleteMember');
  if (deleteBtn) {
    deleteBtn.disabled = false;
    deleteBtn.classList.remove('hidden');
  }

  setDeleteFormStatus('', '');
  openModalById('memberDeleteModal');
}

/**
 * 削除確認モーダルを閉じる
 */
function closeMemberDeleteModal(e) {
  if (e && e.target && e.target.closest('.member-modal-content') && !e.target.closest('.modal-close') && !e.target.closest('.btn-member-modal-cancel')) {
    return;
  }
  closeModalById('memberDeleteModal');
}

/**
 * メンバーの登録削除（個人情報完全消去）を実行
 */
function executeMemberDeletePermanently() {
  const member = window.currentDeletingMember;
  if (!member) return;

  const u = window.currentUser || {};
  const actorEmail = u.email || '';
  const actorName = u.name || '';

  const deleteBtn = document.getElementById('btnConfirmDeleteMember');
  if (deleteBtn) deleteBtn.disabled = true;

  setDeleteFormStatus('登録の削除を実行中...', 'loading');

  google.script.run
    .withSuccessHandler(res => {
      if (deleteBtn) deleteBtn.disabled = false;

      if (res && res.success) {
        setDeleteFormStatus('削除が完了しました。', 'success');
        if (res.roster) {
          if (typeof syncUpdatedMemberList === 'function') {
            syncUpdatedMemberList(res.roster);
          } else {
            window.adminMemberList = res.roster;
            window.scheduleRoster = res.roster;
            if (typeof updateScheduleMemberListOptions === 'function') {
              updateScheduleMemberListOptions(res.roster);
            }
            renderMembersList(window.adminMemberList);
          }
        }
        setTimeout(() => {
          closeModalById('memberDeleteModal');
          closeModalById('memberEditModal');
          window.currentDeletingMember = null;
          window.currentEditingMember = null;
        }, 500);
      } else {
        setDeleteFormStatus(res && res.error ? res.error : '削除処理に失敗しました。', 'error');
      }
    })
    .withFailureHandler(err => {
      if (deleteBtn) deleteBtn.disabled = false;
      setDeleteFormStatus('エラーが発生しました: ' + (err.message || ''), 'error');
    })
    .apiDeleteMemberPermanently({ memberId: member.memberId || member.id, name: member.name, email: member.email }, actorEmail, actorName);
}

/**
 * 編集フォームのステータスメッセージ表示
 */
function setMemberFormStatus(msg, type) {
  const el = document.getElementById('memberEditStatus');
  if (!el) return;
  if (!msg) {
    el.className = 'form-status-msg hidden';
    el.textContent = '';
    return;
  }
  el.className = 'form-status-msg ' + type;
  el.textContent = msg;
}

/**
 * 削除モーダルのステータスメッセージ表示
 */
function setDeleteFormStatus(msg, type) {
  const el = document.getElementById('memberDeleteStatus');
  if (!el) return;
  if (!msg) {
    el.className = 'form-status-msg hidden';
    el.textContent = '';
    return;
  }
  el.className = 'form-status-msg ' + type;
  el.textContent = msg;
}

let savedMemberScrollY = 0;

/**
 * モーダル表示ユーティリティ
 */
function openModalById(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    savedMemberScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    el.classList.add('active');
    if (typeof lockBodyScroll === 'function') {
      lockBodyScroll();
    } else {
      document.body.classList.add('no-scroll');
    }
  }
}

/**
 * 指定されたIDのモーダルを閉じ、背景スクロールロック解除と以前のスクロール位置復元を行う
 * @param {string} modalId - クローズ対象モーダルの要素ID
 * @returns {void}
 */
function closeModalById(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove('active');
    if (typeof unlockBodyScroll === 'function') {
      unlockBodyScroll();
    } else {
      document.body.classList.remove('no-scroll');
    }
    // モーダルを開く前のスクロール位置へ確実に復元（最上部へのリセット防止）
    window.scrollTo(0, savedMemberScrollY);
    requestAnimationFrame(() => {
      window.scrollTo(0, savedMemberScrollY);
    });
  }
}

/**
 * メンバー管理モーダル表示中の背景スクロール（ホイール・スワイプ伝播）および画面更新（PTR）を防止するイベントを初期化する
 * @returns {void}
 */
(function initMemberModalScrollLock() {
  /**
   * 指定モーダルに対してタッチ・ホイールスクロールの背面伝播防止イベントを登録する
   * @param {string} modalId - 対象モーダルの要素ID
   * @param {boolean} isScrollableInside - モーダル内部がスクロール可能かどうか
   * @returns {void}
   */
  function attachScrollLock(modalId, isScrollableInside) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    let touchStartY = 0;

    modal.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    modal.addEventListener('wheel', function(e) {
      if (!isScrollableInside) {
        e.preventDefault();
        return;
      }
      const scrollable = modal.querySelector('.modal-body') || modal.querySelector('.modal-content') || modal;
      const isAtTop = scrollable.scrollTop <= 0;
      const isAtBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
      if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom) || e.target === modal) {
        e.preventDefault();
      }
    }, { passive: false });

    modal.addEventListener('touchmove', function(e) {
      if (!isScrollableInside) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      // モーダル背景（オーバーレイ自体）を触っている場合は即時防止
      if (e.target === modal) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      // 内部スクロール要素を取得
      const scrollable = modal.querySelector('.modal-body') || modal.querySelector('.modal-content');
      if (!scrollable) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      // コンテンツが画面内に収まっていてスクロールが不要な場合
      if (scrollable.scrollHeight <= scrollable.clientHeight) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      // スクロール端でのオーバースクロール・画面更新（Pull-to-refresh）を防止
      if (e.touches && e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const diffY = currentY - touchStartY;
        const isAtTop = scrollable.scrollTop <= 0;
        const isAtBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

        // 最上部で下に引っ張った場合（更新トリガー）を確実に防止
        if (diffY > 0 && isAtTop) {
          if (e.cancelable) e.preventDefault();
        }
        // 最下部で上に引っ張った場合（ラバーバンド）を防止
        else if (diffY < 0 && isAtBottom) {
          if (e.cancelable) e.preventDefault();
        }
      }
    }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      attachScrollLock('memberDeleteModal', false);
      attachScrollLock('memberEditModal', true);
    });
  } else {
    attachScrollLock('memberDeleteModal', false);
    attachScrollLock('memberEditModal', true);
  }
})();

/**
 * 文字列内のHTML特殊文字（& < > " '）を安全にエスケープする
 * @param {string} str - 対象文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 文字列内のJavaScript特殊文字（\ ' "）を安全にエスケープする
 * @param {string} str - 対象文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeJsString(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}
