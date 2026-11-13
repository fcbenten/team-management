# -*- coding: utf-8 -*-
"""
render_swimlane_flow.py
5列スイムレーン構成（1. 画面[カード枠] | 2. JS | 3. GAS | 4. DB・外部API | 5. 他画面など）
による SCR01 ログイン・Google連携 画面フロー相関図の生成スクリプト。

実装準拠:
- html/view_login.html (#loginCard / #oauthPreCheckCard / #oauthLoadingOverlay / #oauthPasswordCard)
- js/main.js (DOMContentLoaded / switchToOAuthPreCheckCard / handleOAuthPreCheckSubmit /
              startGoogleOAuthFlow(login_hint) / checkOAuthCallbackOnLoad / handleOAuthPasswordSubmit /
              switchToLoginCard)
- js/supabase.js (Supabase Direct: apiLoginUser / apiCheckMemberEmailForOAuth / apiRegisterMember)
- server/api_auth.js (GAS: apiExchangeOAuthCode)
"""
import os
from playwright.sync_api import sync_playwright


def build_scr01_swimlane_html():
    return """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    background: #FFFFFF;
    color: #0F172A;
    padding: 12px;
    width: 1884px;
  }

  .diagram-container {
    position: relative;
    width: 1860px;
    border: 1.5px solid #CBD5E1;
    border-radius: 12px;
    background: #F8FAFC;
    padding: 18px;
    overflow: hidden;
  }

  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 2px solid #E2E8F0;
  }
  .header-title {
    font-size: 19px;
    font-weight: 800;
    color: #0F172A;
  }
  .legend-group {
    display: flex;
    gap: 18px;
    font-size: 11.5px;
    font-weight: 700;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend-line {
    width: 24px;
    height: 3px;
    border-radius: 2px;
  }

  /* 5列スイムレーングリッド: 345 + 300 + 250 + 295 + 250 + 96*4 = 1440 + 384 = 1824px */
  .lanes-grid {
    display: grid;
    grid-template-columns: 345px 300px 250px 295px 250px;
    gap: 96px;
    position: relative;
    z-index: 2;
  }

  /* 各縦軸レーン（大箱） - 十分な縦高さ(1025px)と55pxギャップで交差のない直交配線を実現 */
  .lane {
    border-radius: 14px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 1030px;
    border: 2px solid;
  }
  .lane-screen {
    padding-left: 26px; /* 左端にカード戻る用クリーン通路を確保 */
  }
  .lane-header {
    font-size: 13.5px;
    font-weight: 800;
    padding: 7px 10px;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 14px;
    letter-spacing: 0.03em;
  }

  /* レーン別カラーリング */
  .lane-screen {
    background: #EFF6FF;
    border-color: #3B82F6;
  }
  .lane-screen .lane-header {
    background: #1D4ED8;
    color: #FFFFFF;
  }

  .lane-js {
    background: #FFFBEB;
    border-color: #F59E0B;
  }
  .lane-js .lane-header {
    background: #D97706;
    color: #FFFFFF;
  }

  .lane-gas {
    background: #F0FDF4;
    border-color: #22C55E;
  }
  .lane-gas .lane-header {
    background: #15803D;
    color: #FFFFFF;
  }

  .lane-db {
    background: #F1F5F9;
    border-color: #64748B;
  }
  .lane-db .lane-header {
    background: #334155;
    color: #FFFFFF;
  }

  .lane-other {
    background: #F5F3FF;
    border-color: #8B5CF6;
  }
  .lane-other .lane-header {
    background: #6D28D9;
    color: #FFFFFF;
  }

  .lane-body {
    position: relative;
    flex: 1;
  }

  /* 画面内のカード（中箱・青枠） */
  .sub-card {
    background: #FFFFFF;
    border: 2px solid #60A5FA;
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.08);
    position: relative;
  }
  .sub-card-title {
    font-size: 10px;
    font-weight: 800;
    color: #1E40AF;
    background: #DBEAFE;
    padding: 2px 8px;
    border-radius: 5px;
    margin-bottom: 6px;
    display: inline-block;
  }
  .sub-card-note {
    font-size: 9px;
    color: #92400E;
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-radius: 5px;
    padding: 3px 7px;
    margin-bottom: 7px;
    line-height: 1.3;
    font-weight: 700;
  }
  .sub-card-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* 小箱（ボタン・処理・イベント・他画面） */
  .node-item {
    background: #FFFFFF;
    border: 1.5px solid #94A3B8;
    border-radius: 8px;
    padding: 7px 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
    position: relative;
  }
  .node-trigger {
    background: #F8FAFC;
    border-color: #3B82F6;
  }
  .node-trigger-init {
    background: #F1F5F9;
    border: 1.5px dashed #64748B;
  }
  .node-js {
    background: #FFFFFF;
    border-color: #F59E0B;
  }
  .node-gas {
    background: #FFFFFF;
    border-color: #22C55E;
  }
  .node-ext {
    background: #FFFFFF;
    border-color: #64748B;
  }
  .node-other {
    background: #FFFFFF;
    border-color: #8B5CF6;
  }

  /* 洗練されたモノクローム/スチールグレーDBシリンダー */
  .node-db-cyl {
    position: relative;
    width: 196px;
    height: 92px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .node-db-cyl svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.12));
  }
  .node-db-text-wrap {
    position: relative;
    z-index: 2;
    margin-top: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .node-db-logic {
    font-size: 12.5px;
    font-weight: 800;
    color: #0F172A;
    line-height: 1.2;
  }
  .node-db-phys {
    font-size: 10.5px;
    font-weight: 800;
    color: #334155;
    font-family: Consolas, monospace;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #94A3B8;
    border-radius: 4px;
    padding: 0.5px 7px;
    line-height: 1.25;
  }

  .node-tag {
    font-size: 9px;
    font-weight: 800;
    padding: 1.5px 6px;
    border-radius: 4px;
    display: inline-block;
    margin-bottom: 2px;
  }
  .tag-btn { background: #DBEAFE; color: #1D4ED8; }
  .tag-link { background: #E0E7FF; color: #4338CA; }
  .tag-init { background: #E2E8F0; color: #334155; }
  .tag-js { background: #FEF3C7; color: #B45309; font-family: Consolas, monospace; }
  .tag-gas { background: #DCFCE7; color: #15803D; font-family: Consolas, monospace; }
  .tag-ext { background: #E2E8F0; color: #334155; }
  .tag-screen { background: #EDE9FE; color: #5B21B6; }

  .node-title {
    font-size: 11.5px;
    font-weight: 800;
    color: #0F172A;
    line-height: 1.25;
  }
  .node-sub {
    font-size: 9.5px;
    color: #475569;
    margin-top: 2px;
    line-height: 1.3;
    font-family: Consolas, "Meiryo", sans-serif;
  }

  /* SVGオーバーレイ */
  #svg-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }
  .edge-label {
    position: absolute;
    font-size: 9.5px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    color: #334155;
    white-space: nowrap;
    z-index: 15;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
</style>
</head>
<body>

<div class="diagram-container" id="diagram-container">
  <div class="header-bar">
    <div class="header-title">SCR01 ログイン・Google連携：処理・遷移スイムレーン相関図</div>
    <div class="legend-group">
      <div class="legend-item"><div class="legend-line" style="background:#2563EB;"></div><span>通常処理・参照 (JS/GAS)</span></div>
      <div class="legend-item"><div class="legend-line" style="background:#059669;"></div><span>Supabase Direct バイパス (GAS不要)</span></div>
      <div class="legend-item"><div class="legend-line" style="background:#D97706;"></div><span>画面内カード表示・切替 (SPA)</span></div>
      <div class="legend-item"><div class="legend-line" style="background:#7C3AED; border-top: 2px dashed #7C3AED; height:0;"></div><span>他画面・外部遷移 / コールバック復帰</span></div>
      <div class="legend-item"><span style="color:#475569; font-weight:900;">◀─▶</span><span>双方向(参照/同期) / ─▶ 単方向(更新/遷移)</span></div>
    </div>
  </div>

  <div class="lanes-grid">
    <!-- ======================================================
         1列目: 画面（カードごとに箱をくくる）
         ====================================================== -->
    <div class="lane lane-screen" id="lane-screen">
      <div class="lane-header">1. ログイン画面 (view_login.html)</div>
      <div class="lane-body">

        <!-- 起動時ロード共通イベント（枠なし・点線ノード） -->
        <div class="node-item node-trigger-init" id="t-init" style="position:absolute; top: 14px; left: 0; right: 0;">
          <span class="node-tag tag-init">初期表示</span>
          <div class="node-title">画面読み込み (DOMContentLoaded)</div>
          <div class="node-sub">起動時・セッション判定トリガー</div>
        </div>

        <!-- カードA: ログインカード -->
        <div class="sub-card" id="card-login" style="position:absolute; top: 146px; left: 0; right: 0;">
          <div class="sub-card-title">カードA: ログインカード (#loginCard)</div>
          <div class="sub-card-list">
            <div class="node-item node-trigger" id="t-login-btn">
              <span class="node-tag tag-btn">ボタン</span>
              <div class="node-title">「ログイン」ボタン押下</div>
              <div class="node-sub">Gmail / Password 入力後送信</div>
            </div>
            <div class="node-item node-trigger" id="t-oauth-link">
              <span class="node-tag tag-link">リンク</span>
              <div class="node-title">「初めての方はこちら」リンク押下</div>
              <div class="node-sub">新規登録・Googleカレンダー連携案内へ</div>
            </div>
          </div>
        </div>

        <!-- カードB: 連携事前確認カード -->
        <div class="sub-card" id="card-precheck" style="position:absolute; top: 388px; left: 0; right: 0;">
          <div class="sub-card-title">カードB: 連携事前確認 (#oauthPreCheckCard)</div>
          <div class="sub-card-note">注意書き：事前登録済みのGmailで進行</div>
          <div class="sub-card-list">
            <div class="node-item node-trigger" id="t-precheck-btn">
              <span class="node-tag tag-btn">ボタン</span>
              <div class="node-title">「Google連携へ進む」押下</div>
              <div class="node-sub">事前登録済みGmail入力後送信</div>
            </div>
            <div class="node-item node-trigger" id="t-back-login">
              <span class="node-tag tag-link">リンク</span>
              <div class="node-title">「ログイン画面へ戻る」押下</div>
            </div>
          </div>
        </div>

        <!-- リダイレクト復帰イベント（カード枠なし・#oauthLoadingOverlay 自動表示） -->
        <div class="node-item node-trigger-init" id="t-callback" style="position:absolute; top: 696px; left: 0; right: 0;">
          <span class="node-tag tag-init">リダイレクト復帰（自動実行）</span>
          <div class="node-title">認可コールバック (?code=...)</div>
          <div class="node-sub">連携中ローディング (#oauthLoadingOverlay) 自動展開</div>
        </div>

        <!-- カードC: 初期パスワード設定カード -->
        <div class="sub-card" id="card-pw" style="position:absolute; top: 834px; left: 0; right: 0;">
          <div class="sub-card-title">カードC: パスワード設定 (#oauthPasswordCard)</div>
          <div class="sub-card-list">
            <div class="node-item node-trigger" id="t-pw-submit">
              <span class="node-tag tag-btn">ボタン</span>
              <div class="node-title">「設定完了してログイン」押下</div>
              <div class="node-sub">新パスワード設定 ＆ セッション開始</div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ======================================================
         2列目: JS (クライアント処理)
         ※ Y座標はJS側でもトリガー中央に微調整し水平直線を保証
         ====================================================== -->
    <div class="lane lane-js">
      <div class="lane-header">2. JS (クライアント処理)</div>
      <div class="lane-body">
        <div class="node-item node-js" id="j-init" style="position:absolute; top: 14px; left: 0; right: 0;">
          <span class="node-tag tag-js">js/main.js</span>
          <div class="node-title">セッション判定処理</div>
          <div class="node-sub">fcb_auth_user 保持チェック</div>
        </div>

        <div class="node-item node-js" id="j-login" style="position:absolute; top: 180px; left: 0; right: 0;">
          <span class="node-tag tag-js">js/main.js ➔ supabase.js</span>
          <div class="node-title">handleUserLogin()</div>
          <div class="node-sub">Bypass: SupabaseService.loginUser()</div>
        </div>

        <div class="node-item node-js" id="j-to-precheck" style="position:absolute; top: 266px; left: 0; right: 0;">
          <span class="node-tag tag-js">js/main.js</span>
          <div class="node-title">switchToOAuthPreCheckCard()</div>
          <div class="node-sub">カードB表示 ＆ 入力状態初期化</div>
        </div>

        <div class="node-item node-js" id="j-precheck-submit" style="position:absolute; top: 446px; left: 0; right: 0;">
          <span class="node-tag tag-js">js/main.js ➔ supabase.js</span>
          <div class="node-title">handleOAuthPreCheckSubmit()</div>
          <div class="node-sub">名簿照合 ➔ login_hint付きOAuth起動</div>
        </div>

        <div class="node-item node-js" id="j-back-login" style="position:absolute; top: 536px; left: 0; right: 0;">
          <span class="node-tag tag-js">js/main.js</span>
          <div class="node-title">switchToLoginCard()</div>
          <div class="node-sub">エラー解除 ＆ カードA表示切替</div>
        </div>

        <div class="node-item node-js" id="j-callback" style="position:absolute; top: 696px; left: 0; right: 0;">
          <span class="node-tag tag-js">js/main.js</span>
          <div class="node-title">checkOAuthCallbackOnLoad()</div>
          <div class="node-sub">分岐: 設定済➔ホーム / 未設定➔カードC</div>
        </div>

        <div class="node-item node-js" id="j-pw-submit" style="position:absolute; top: 866px; left: 0; right: 0;">
          <span class="node-tag tag-js">js/main.js ➔ supabase.js</span>
          <div class="node-title">handleOAuthPasswordSubmit()</div>
          <div class="node-sub">Bypass: SupabaseService.registerMember()</div>
        </div>
      </div>
    </div>

    <!-- ======================================================
         3列目: GAS (バックエンドAPI)
         ====================================================== -->
    <div class="lane lane-gas" id="lane-gas">
      <div class="lane-header">3. GAS (バックエンドAPI)</div>
      <div class="lane-body">
        <div class="node-item node-gas" id="g-exchange" style="position:absolute; top: 696px; left: 0; right: 0;">
          <span class="node-tag tag-gas">server/api_auth.js</span>
          <div class="node-title">apiExchangeOAuthCode(code)</div>
          <div class="node-sub">秘密鍵を用いて認可コードをトークンへ交換</div>
        </div>
      </div>
    </div>

    <!-- ======================================================
         4列目: DB / 外部API
         ====================================================== -->
    <div class="lane lane-db" id="lane-db">
      <div class="lane-header">4. DB / 外部API</div>
      <div class="lane-body">
        <div class="node-item node-ext" id="d-local" style="position:absolute; top: 14px; left: 0; right: 0;">
          <span class="node-tag tag-ext">Browser Storage</span>
          <div class="node-title">localStorage (fcb_auth_user)</div>
          <div class="node-sub">ログインセッションの読込・保存</div>
        </div>

        <!-- members テーブル (スチールグレー立体DBシリンダー: 論理名/物理名) -->
        <div class="node-db-cyl" id="d-members" style="position:absolute; top: 176px; left: 0; right: 0;">
          <svg viewBox="0 0 196 92" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="dbSteelBody" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#CBD5E1"/>
                <stop offset="26%" stop-color="#FFFFFF"/>
                <stop offset="72%" stop-color="#E2E8F0"/>
                <stop offset="100%" stop-color="#94A3B8"/>
              </linearGradient>
              <linearGradient id="dbSteelTop" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#F8FAFC"/>
                <stop offset="100%" stop-color="#CBD5E1"/>
              </linearGradient>
            </defs>
            <path d="M 2 17 L 2 75 A 96 15 0 0 0 194 75 L 194 17 Z" fill="url(#dbSteelBody)" stroke="#475569" stroke-width="1.9"/>
            <path d="M 2 30 A 96 13 0 0 0 194 30" fill="none" stroke="#94A3B8" stroke-width="1.1"/>
            <ellipse cx="98" cy="17" rx="96" ry="15" fill="url(#dbSteelTop)" stroke="#475569" stroke-width="1.9"/>
            <ellipse cx="98" cy="17" rx="84" ry="10.5" fill="none" stroke="#FFFFFF" stroke-width="1.1" stroke-opacity="0.9"/>
          </svg>
          <div class="node-db-text-wrap">
            <span class="node-db-logic">メンバー名簿</span>
            <span class="node-db-phys">members</span>
          </div>
        </div>

        <div class="node-item node-ext" id="d-google-oauth" style="position:absolute; top: 696px; left: 0; right: 0; border-color:#3B82F6; background:#EFF6FF;">
          <span class="node-tag" style="background:#DBEAFE; color:#1E40AF;">Google API</span>
          <div class="node-title">Google OAuth 2.0 サーバー</div>
          <div class="node-sub">Refresh Token ＆ ユーザー情報取得</div>
        </div>
      </div>
    </div>

    <!-- ======================================================
         5列目: 他画面など
         ====================================================== -->
    <div class="lane lane-other" id="lane-other">
      <div class="lane-header">5. 他画面など</div>
      <div class="lane-body">
        <!-- SCR02 ホーム画面 -->
        <div class="node-item node-other" id="n-home" style="position:absolute; top: 82px; left: 0; right: 0; height: 225px; display:flex; flex-direction:column; justify-content:center;">
          <span class="node-tag tag-screen">遷移先画面</span>
          <div class="node-title" style="font-size:14px; color:#4C1D95;">SCR02 ホーム画面</div>
          <div class="node-sub" style="margin-top:6px;">hideLoginScreen() ＆<br>loadAppInitialData() 実行</div>
        </div>

        <!-- Google認可画面: カードB(handleOAuthPreCheckSubmit)と真横一列 -->
        <div class="node-item node-other" id="n-google-auth" style="position:absolute; top: 448px; left: 0; right: 0;">
          <span class="node-tag" style="background:#E0F2FE; color:#0369A1;">外部画面遷移</span>
          <div class="node-title">Google アカウント認可画面</div>
          <div class="node-sub">accounts.google.com<br>(login_hint指定 ＆ 同意画面)</div>
        </div>
      </div>
    </div>
  </div>

  <!-- SVG 矢印オーバーレイ -->
  <svg id="svg-layer" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arr-blue" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 7.5 4 L 1 7 Z" fill="#2563EB"/>
      </marker>
      <marker id="arr-blue-rev" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 7 1 L 0.5 4 L 7 7 Z" fill="#2563EB"/>
      </marker>
      <marker id="arr-green" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 7.5 4 L 1 7 Z" fill="#059669"/>
      </marker>
      <marker id="arr-green-rev" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 7 1 L 0.5 4 L 7 7 Z" fill="#059669"/>
      </marker>
      <marker id="arr-amber" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 7.5 4 L 1 7 Z" fill="#D97706"/>
      </marker>
      <marker id="arr-purple" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 7.5 4 L 1 7 Z" fill="#7C3AED"/>
      </marker>
    </defs>
  </svg>
</div>

<script>
  window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('diagram-container');
    const svg = document.getElementById('svg-layer');
    const cRect = container.getBoundingClientRect();

    // トリガー要素とJSボックスの縦中心を正確に一致させ、青いトリガー線を完全水平化
    function alignCenterY(targetId, refId) {
      const refEl = document.getElementById(refId);
      const tgtEl = document.getElementById(targetId);
      const parentRect = tgtEl.offsetParent.getBoundingClientRect();
      const refRect = refEl.getBoundingClientRect();
      const tgtRect = tgtEl.getBoundingClientRect();
      const refCy = (refRect.top + refRect.bottom) / 2 - parentRect.top;
      tgtEl.style.top = Math.round(refCy - tgtRect.height / 2) + 'px';
    }

    alignCenterY('j-init', 't-init');
    alignCenterY('d-local', 't-init');
    alignCenterY('j-login', 't-login-btn');
    alignCenterY('j-to-precheck', 't-oauth-link');
    alignCenterY('j-precheck-submit', 't-precheck-btn');
    alignCenterY('n-google-auth', 'j-precheck-submit');
    alignCenterY('j-back-login', 't-back-login');
    alignCenterY('j-callback', 't-callback');
    alignCenterY('g-exchange', 't-callback');
    alignCenterY('d-google-oauth', 't-callback');
    alignCenterY('j-pw-submit', 't-pw-submit');

    function getBox(id) {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return {
        left: r.left - cRect.left,
        right: r.right - cRect.left,
        top: r.top - cRect.top,
        bottom: r.bottom - cRect.top,
        cx: (r.left + r.right) / 2 - cRect.left,
        cy: (r.top + r.bottom) / 2 - cRect.top,
        w: r.width,
        h: r.height
      };
    }

    function addPath(d, color, markerEnd, markerStart = null, dash = null, width = 2.2) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', width);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linejoin', 'round');
      if (markerEnd) path.setAttribute('marker-end', `url(#${markerEnd})`);
      if (markerStart) path.setAttribute('marker-start', `url(#${markerStart})`);
      if (dash) path.setAttribute('stroke-dasharray', dash);
      svg.appendChild(path);
    }

    // 直線・平行な直交折れ線パス（角丸 r=10）
    function orthoPath(pts, r = 10) {
      if (pts.length < 2) return '';
      let d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const dx1 = x1 - x0, dy1 = y1 - y0;
        const dx2 = x2 - x1, dy2 = y2 - y1;
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);
        const cr = Math.min(r, len1 / 2, len2 / 2);
        if (cr < 1) {
          d += ` L ${x1} ${y1}`;
          continue;
        }
        const ax = x1 - (dx1 / len1) * cr;
        const ay = y1 - (dy1 / len1) * cr;
        const bx = x1 + (dx2 / len2) * cr;
        const by = y1 + (dy2 / len2) * cr;
        d += ` L ${ax} ${ay} Q ${x1} ${y1} ${bx} ${by}`;
      }
      const last = pts[pts.length - 1];
      d += ` L ${last[0]} ${last[1]}`;
      return d;
    }

    function addLabel(text, x, y, color = '#334155', borderColor = '#CBD5E1', bg = '#FFFFFF') {
      const div = document.createElement('div');
      div.className = 'edge-label';
      div.textContent = text;
      div.style.left = x + 'px';
      div.style.top = y + 'px';
      div.style.color = color;
      div.style.borderColor = borderColor;
      div.style.background = bg;
      div.style.transform = 'translate(-50%, -50%)';
      container.appendChild(div);
    }

    const laneScreen = getBox('lane-screen');
    const laneGas = getBox('lane-gas');
    const laneDb = getBox('lane-db');
    const laneOther = getBox('lane-other');
    const cardLogin = getBox('card-login');
    const cardPrecheck = getBox('card-precheck');
    const cardPw = getBox('card-pw');

    const tInit = getBox('t-init');
    const tLogin = getBox('t-login-btn');
    const tOAuthLink = getBox('t-oauth-link');
    const tPrecheckBtn = getBox('t-precheck-btn');
    const tBackLogin = getBox('t-back-login');
    const tCallback = getBox('t-callback');
    const tPwSubmit = getBox('t-pw-submit');

    const jInit = getBox('j-init');
    const jLogin = getBox('j-login');
    const jToPrecheck = getBox('j-to-precheck');
    const jPrecheckSubmit = getBox('j-precheck-submit');
    const jBackLogin = getBox('j-back-login');
    const jCallback = getBox('j-callback');
    const jPwSubmit = getBox('j-pw-submit');

    const gExchange = getBox('g-exchange');

    const dLocal = getBox('d-local');
    const dMembers = getBox('d-members');
    const dGoogleOAuth = getBox('d-google-oauth');

    const nHome = getBox('n-home');
    const nGoogleAuth = getBox('n-google-auth');

    const col4Left = dGoogleOAuth.left;
    const col4Right = dGoogleOAuth.right;
    const gutter12MidX = (cardLogin.right + jLogin.left) / 2;

    // =========================================================
    // 1. 画面トリガー ➔ JS (完全水平直線: 中央揃え済み!)
    // =========================================================
    addPath(`M ${tInit.right} ${tInit.cy} L ${jInit.left - 2} ${tInit.cy}`, '#2563EB', 'arr-blue');
    addPath(`M ${tLogin.right} ${tLogin.cy} L ${jLogin.left - 2} ${tLogin.cy}`, '#2563EB', 'arr-blue');
    addPath(`M ${tOAuthLink.right} ${tOAuthLink.cy} L ${jToPrecheck.left - 2} ${tOAuthLink.cy}`, '#2563EB', 'arr-blue');
    addPath(`M ${tPrecheckBtn.right} ${tPrecheckBtn.cy} L ${jPrecheckSubmit.left - 2} ${tPrecheckBtn.cy}`, '#2563EB', 'arr-blue');
    addPath(`M ${tBackLogin.right} ${tBackLogin.cy} L ${jBackLogin.left - 2} ${tBackLogin.cy}`, '#2563EB', 'arr-blue');
    addPath(`M ${tCallback.right} ${tCallback.cy} L ${jCallback.left - 2} ${tCallback.cy}`, '#2563EB', 'arr-blue');
    addPath(`M ${tPwSubmit.right} ${tPwSubmit.cy} L ${jPwSubmit.left - 2} ${tPwSubmit.cy}`, '#2563EB', 'arr-blue');

    // =========================================================
    // 2. 初期表示: セッション保持チェック ＆ 分岐
    // =========================================================
    // 2a. JS(init) ◀──▶ localStorage (上段水平直線)
    const yLocalCheck = dLocal.cy - 6;
    addPath(`M ${jInit.right + 2} ${yLocalCheck} L ${dLocal.left - 2} ${yLocalCheck}`, '#2563EB', 'arr-blue', 'arr-blue-rev');
    addLabel('保持確認', gExchange.cx, yLocalCheck, '#1E40AF', '#93C5FD');

    // 2b. セッション有効時 ➔ SCR02 ホーム画面 (localStorage直下の水平直線トラック)
    const trackHome1Y = dLocal.bottom + 24;
    addPath(orthoPath([
      [jInit.right + 2, jInit.cy + 14],
      [jInit.right + 24, jInit.cy + 14],
      [jInit.right + 24, trackHome1Y],
      [nHome.left - 2, trackHome1Y]
    ], 8), '#7C3AED', 'arr-purple');
    addLabel('セッション有効時', dLocal.cx, trackHome1Y, '#5B21B6', '#DDD6FE', '#F5F3FF');

    // 2c. ★セッション未保持時 ➔ カードA (#loginCard) へ表示 (jInit底辺から出て青い矢印に一切重ならない!)
    const step1DropY = jInit.bottom + 12;
    addPath(orthoPath([
      [jInit.left + 26, jInit.bottom + 1],
      [jInit.left + 26, step1DropY],
      [gutter12MidX, step1DropY],
      [gutter12MidX, cardLogin.top + 14],
      [cardLogin.right + 2, cardLogin.top + 14]
    ], 7), '#D97706', 'arr-amber', null, null, 2.5);
    addLabel('未保持時 カードA表示', gutter12MidX, (step1DropY + cardLogin.top + 14) / 2, '#B45309', '#FDE68A', '#FEF3C7');

    // =========================================================
    // 3. カードA ログイン処理 & 「初めての方はこちら」
    // =========================================================
    // 3a. ログイン認証: JS ◀──▶ members (完全水平直線バイパス)
    const yLoginBypass = jLogin.cy + 8;
    addPath(`M ${jLogin.right + 2} ${yLoginBypass} L ${dMembers.left - 2} ${yLoginBypass}`, '#059669', 'arr-green', 'arr-green-rev', null, 2.5);
    addLabel('Direct認証照合', gExchange.cx, yLoginBypass, '#065F46', '#6EE7B7', '#ECFDF5');

    // 3b. 認証成功 ➔ SCR02 ホーム画面 (trackHome1Y に平行な上側トラック)
    const trackHome2Y = dMembers.top - 22;
    addPath(orthoPath([
      [jLogin.right + 2, jLogin.cy - 14],
      [jLogin.right + 24, jLogin.cy - 14],
      [jLogin.right + 24, trackHome2Y],
      [nHome.left - 2, trackHome2Y]
    ], 8), '#7C3AED', 'arr-purple');
    addLabel('認証成功', dMembers.cx, trackHome2Y, '#5B21B6', '#DDD6FE', '#F5F3FF');

    // 3c. 「初めての方はこちら」 ➔ カードB (#oauthPreCheckCard) へ切替 (底辺から出て青い矢印と完全非接触!)
    const step2DropY = jToPrecheck.bottom + 12;
    addPath(orthoPath([
      [jToPrecheck.left + 26, jToPrecheck.bottom + 1],
      [jToPrecheck.left + 26, step2DropY],
      [gutter12MidX, step2DropY],
      [gutter12MidX, cardPrecheck.top + 16],
      [cardPrecheck.right + 2, cardPrecheck.top + 16]
    ], 7), '#D97706', 'arr-amber', null, null, 2.5);
    addLabel('カードBへ切替', gutter12MidX, (step2DropY + cardPrecheck.top + 16) / 2, '#B45309', '#FDE68A', '#FEF3C7');

    // =========================================================
    // 4. カードB: メアド事前チェック & OAuth遷移 / 戻る
    // =========================================================
    const xMemberBus1 = laneGas.right + 18;                        // 最左: J4 ➔ members上寄り
    const xMemberBus2 = (laneGas.right + laneDb.left) / 2;         // 中央: G1 ➔ members底辺中央
    const xMemberBus3 = laneDb.left - 18;                          // 最右: J7 ➔ members下寄り

    const yMemberEnter1 = dMembers.bottom - 34;
    const yMemberEnter3 = dMembers.bottom - 14;
    const yMemberTokenHoriz = dMembers.bottom + 54;

    // 4a. 事前メアド照合: JS(precheck) ◀──▶ members (完全直交・非交差!)
    const yPrecheckBypass = Math.max(jPrecheckSubmit.top + 14, jPrecheckSubmit.cy - 12);
    addPath(orthoPath([
      [jPrecheckSubmit.right + 2, yPrecheckBypass],
      [xMemberBus1, yPrecheckBypass],
      [xMemberBus1, yMemberEnter1],
      [dMembers.left - 2, yMemberEnter1]
    ], 8), '#059669', 'arr-green', 'arr-green-rev', null, 2.4);
    addLabel('Direct事前名簿照合', gExchange.cx, yPrecheckBypass, '#065F46', '#6EE7B7', '#ECFDF5');

    // 4b. 登録済み確認後 ➔ Googleアカウント認可画面 (真横一線の水平破線!)
    const yGoogleAuthLine = Math.min(jPrecheckSubmit.cy + 12, jPrecheckSubmit.bottom - 14, nGoogleAuth.bottom - 14);
    addPath(`M ${jPrecheckSubmit.right + 2} ${yGoogleAuthLine} L ${nGoogleAuth.left - 2} ${yGoogleAuthLine}`, '#7C3AED', 'arr-purple', null, '6 3');
    addLabel('login_hint指定 外部認可遷移', dGoogleOAuth.cx, yGoogleAuthLine, '#5B21B6', '#DDD6FE', '#F5F3FF');

    // 4c. 「ログイン画面へ戻る」 ➔ カードA (カードB直下の通路を通り1列目左端から戻る)
    const leftReturnX = laneScreen.left + 11;
    const underCardBY = Math.max(cardPrecheck.bottom, jBackLogin.bottom) + 18;
    addPath(orthoPath([
      [jBackLogin.left + 26, jBackLogin.bottom + 1],
      [jBackLogin.left + 26, underCardBY],
      [leftReturnX, underCardBY],
      [leftReturnX, cardLogin.cy],
      [cardLogin.left - 2, cardLogin.cy]
    ], 8), '#D97706', 'arr-amber', null, null, 2.5);
    addLabel('カードAへ戻る', cardPrecheck.cx - 35, underCardBY, '#B45309', '#FDE68A', '#FEF3C7');

    // =========================================================
    // 5. ★Google認可画面 ➔ 認可コールバック (?code=...) リダイレクト復帰線
    // =========================================================
    const callbackReturnY = underCardBY + 44; // カードA戻り線(underCardBY)と完全分離された下の横通路
    addPath(orthoPath([
      [nGoogleAuth.cx, nGoogleAuth.bottom + 2],
      [nGoogleAuth.cx, callbackReturnY],
      [tCallback.cx, callbackReturnY],
      [tCallback.cx, tCallback.top - 2]
    ], 10), '#7C3AED', 'arr-purple', null, '5 3', 2.3);
    addLabel('認可コード (?code=...) 付与でリダイレクト復帰', dGoogleOAuth.cx, callbackReturnY, '#5B21B6', '#DDD6FE', '#F5F3FF');

    // =========================================================
    // 6. コールバック処理: JS ◀──▶ GAS ◀──▶ Google OAuth / members
    // =========================================================
    // 6a. 一直線の横パイプライン
    addPath(`M ${jCallback.right + 2} ${jCallback.cy} L ${gExchange.left - 2} ${jCallback.cy}`, '#2563EB', 'arr-blue', 'arr-blue-rev');
    addPath(`M ${gExchange.right + 2} ${gExchange.cy + 10} L ${dGoogleOAuth.left - 2} ${gExchange.cy + 10}`, '#2563EB', 'arr-blue', 'arr-blue-rev');

    // 6b. GAS ➔ members (d-members下部の空域を通って底辺中央へ入るため縦線と非干渉)
    addPath(orthoPath([
      [gExchange.right + 2, gExchange.cy - 12],
      [xMemberBus2, gExchange.cy - 12],
      [xMemberBus2, yMemberTokenHoriz],
      [dMembers.cx, yMemberTokenHoriz],
      [dMembers.cx, dMembers.bottom - 1]
    ], 8), '#2563EB', 'arr-blue');
    addLabel('token保存 / 名簿照合', (xMemberBus2 + dMembers.cx) / 2, yMemberTokenHoriz, '#1E40AF', '#93C5FD');

    // 6c. 未設定時 ➔ カードC (#oauthPasswordCard) へ切替 (底辺から出て青い矢印と完全非接触!)
    const step3DropY = jCallback.bottom + 12;
    addPath(orthoPath([
      [jCallback.left + 26, jCallback.bottom + 1],
      [jCallback.left + 26, step3DropY],
      [gutter12MidX, step3DropY],
      [gutter12MidX, cardPw.top + 16],
      [cardPw.right + 2, cardPw.top + 16]
    ], 7), '#D97706', 'arr-amber', null, null, 2.5);
    addLabel('未設定時 カードC切替', gutter12MidX, (step3DropY + cardPw.top + 16) / 2, '#B45309', '#FDE68A', '#FEF3C7');

    // 6d. 設定済時 ➔ SCR02 ホーム画面 (4-5列間92px通路の中央を上る)
    const gutter45X = (laneDb.right + laneOther.left) / 2;
    const trackHome3Y = gExchange.bottom + 24;
    addPath(orthoPath([
      [jCallback.right + 2, jCallback.cy + 18],
      [jCallback.right + 24, jCallback.cy + 18],
      [jCallback.right + 24, trackHome3Y],
      [gutter45X, trackHome3Y],
      [gutter45X, nHome.bottom - 20],
      [nHome.left - 2, nHome.bottom - 20]
    ], 10), '#7C3AED', 'arr-purple', null, '5 3');
    addLabel('設定済時 即ログイン', dGoogleOAuth.cx, trackHome3Y, '#5B21B6', '#DDD6FE', '#F5F3FF');

    // =========================================================
    // 7. カードC: 初期パスワード設定
    // =========================================================
    // 7a. JS(pwSubmit) ➔ members (xMemberBus3 をまっすぐ上って yMemberEnter3 へ)
    addPath(orthoPath([
      [jPwSubmit.right + 2, jPwSubmit.cy - 10],
      [xMemberBus3, jPwSubmit.cy - 10],
      [xMemberBus3, yMemberEnter3],
      [dMembers.left - 2, yMemberEnter3]
    ], 8), '#059669', 'arr-green', null, null, 2.5);
    addLabel('Direct PW保存', gExchange.cx, jPwSubmit.cy - 10, '#065F46', '#6EE7B7', '#ECFDF5');

    // 7b. 設定完了 ➔ SCR02 ホーム画面 (最下部から右余白を通ってホーム底辺へ)
    const trackHome4Y = jPwSubmit.bottom + 24;
    const rightMarginX = nGoogleAuth.right + 7;
    addPath(orthoPath([
      [jPwSubmit.right + 2, jPwSubmit.cy + 14],
      [jPwSubmit.right + 24, jPwSubmit.cy + 14],
      [jPwSubmit.right + 24, trackHome4Y],
      [rightMarginX, trackHome4Y],
      [rightMarginX, nHome.bottom + 14],
      [nHome.right - 20, nHome.bottom + 14],
      [nHome.right - 20, nHome.bottom + 2]
    ], 10), '#7C3AED', 'arr-purple');
    addLabel('設定完了 ➔ ホーム遷移', dGoogleOAuth.cx, trackHome4Y, '#5B21B6', '#DDD6FE', '#F5F3FF');
  });
</script>
</body>
</html>
"""


def generate_prototype():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(base_dir, "docs", "flow_images")
    os.makedirs(out_dir, exist_ok=True)
    html_path = os.path.join(out_dir, "proto_swimlane_SCR01.html")
    png_path = os.path.join(out_dir, "proto_swimlane_SCR01.png")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(build_scr01_swimlane_html())

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1200})
        page.goto(f"file:///{html_path.replace(os.sep, '/')}")
        page.wait_for_selector(".edge-label")
        page.wait_for_timeout(200)
        container = page.query_selector("#diagram-container")
        container.screenshot(path=png_path)
        browser.close()

    print(f"Generated prototype: {png_path}")
    return png_path


if __name__ == "__main__":
    generate_prototype()
