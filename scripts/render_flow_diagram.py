# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
ユーザー指定の赤ペン注記に100%完全準拠したアーキテクチャ・システム相関図生成スクリプト。
・GitHub Pages ➔ Webアプリ(PWA) へのアプリ配信
・Webアプリ ➔ 認証 / データベース / ストレージ の3本個別矢印
・Webアプリ ⇄ Google Apps Script ➔ Googleカレンダー の連携
・Webアプリ/GAS ➔ LINE Messaging API ➔ LINEアプリ(部員のスマホ) のプッシュ着信
・不要な説明テキストバナーを全廃し、視覚的な線とアイコンだけで直感的に理解できる構造
"""
import os
from playwright.sync_api import sync_playwright

HTML_CONTENT = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    background: #FFFFFF;
    color: #1F2937;
    padding: 24px 32px;
    width: 1360px;
    height: 780px;
  }

  /* タイトル */
  .header-group {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #F1F5F9;
  }
  .title {
    font-size: 24px;
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.02em;
  }
  .sub-title {
    font-size: 13px;
    color: #64748B;
    font-weight: 600;
  }

  /* キャンバス（絶対配置） */
  .canvas {
    position: relative;
    width: 100%;
    height: 690px;
  }

  /* 共通カード */
  .card {
    background: #FFFFFF;
    border-radius: 14px;
    position: absolute;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
  }

  /* ラベルバッジ */
  .badge {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 6px;
    display: inline-block;
  }

  /* カード内アイテム */
  .sub-item {
    background: #FFFFFF;
    border-radius: 8px;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .icon-box {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
  }

  /* 矢印ラベル */
  .arrow-label {
    position: absolute;
    font-size: 10.5px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 10;
  }
</style>
</head>
<body>

<div class="header-group">
  <div class="title">アーキテクチャ ＆ システム相関図</div>
  <div class="sub-title">FC Benten チーム管理システム（ホスティング・DB・Google・LINEの役割と通信フロー）</div>
</div>

<div class="canvas">

  <!-- SVGレイヤー（矢印・コネクタ線） -->
  <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- 矢印マーカー -->
      <marker id="arr-blue" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 8 4 L 0 7 Z" fill="#0284C7"/>
      </marker>
      <marker id="arr-green" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 8 4 L 0 7 Z" fill="#10B981"/>
      </marker>
      <marker id="arr-red" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 8 4 L 0 7 Z" fill="#DC2626"/>
      </marker>
      <marker id="arr-line" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 8 4 L 0 7 Z" fill="#06C755"/>
      </marker>
      <marker id="arr-google" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 8 4 L 0 7 Z" fill="#2563EB"/>
      </marker>
    </defs>

    <!-- ① GitHub Pages ➔ Webアプリ(PWA) -->
    <path d="M 180 85 V 158" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="4 3" marker-end="url(#arr-red)"/>

    <!-- ②-A Webアプリ ➔ 認証 (Auth) -->
    <path d="M 140 375 C 140 415 140 435 140 472" stroke="#DC2626" stroke-width="2.2" marker-end="url(#arr-red)"/>

    <!-- ②-B Webアプリ ⇄ データベース (PostgreSQL 17) -->
    <path d="M 210 375 C 210 420 315 425 315 472" stroke="#DC2626" stroke-width="2.5" marker-end="url(#arr-red)"/>
    <path d="M 310 475 C 310 425 205 420 205 378" stroke="#DC2626" stroke-width="1.8" marker-end="url(#arr-red)"/>

    <!-- ②-C Webアプリ ➔ ストレージ (Storage) -->
    <path d="M 260 375 C 260 415 490 430 490 472" stroke="#DC2626" stroke-width="2.2" marker-end="url(#arr-red)"/>

    <!-- ③-A Webアプリ ⇄ Google Apps Script -->
    <path d="M 300 375 C 300 420 745 420 745 472" stroke="#2563EB" stroke-width="2.2" marker-end="url(#arr-google)"/>
    <path d="M 740 475 C 740 425 295 425 295 378" stroke="#2563EB" stroke-width="1.5" marker-end="url(#arr-google)"/>

    <!-- ③-B Google Apps Script ➔ Google カレンダー (GAS内部連携) -->
    <path d="M 825 570 H 870" stroke="#DC2626" stroke-width="2.2" marker-end="url(#arr-red)"/>

    <!-- ④-A Webアプリ ➔ LINE Messaging API (通知リクエスト) -->
    <path d="M 300 200 C 450 130 950 130 1085 240" stroke="#DC2626" stroke-width="2.2" fill="none" marker-end="url(#arr-red)"/>

    <!-- ④-B Google Apps Script ➔ LINE Messaging API (バッチ・リマインド発信) -->
    <path d="M 825 520 C 950 520 1020 450 1085 360" stroke="#DC2626" stroke-width="2" stroke-dasharray="4 3" fill="none" marker-end="url(#arr-red)"/>

    <!-- ④-C LINE Messaging API ➔ LINE アプリ (部員のスマホへプッシュ着信！) -->
    <path d="M 1085 285 H 588" stroke="#06C755" stroke-width="2.8" marker-end="url(#arr-line)"/>
  </svg>

  <!-- 矢印ラベル群 -->
  <div class="arrow-label" style="top: 110px; left: 195px; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;">
    ① PWA配信・インストール
  </div>

  <div class="arrow-label" style="top: 415px; left: 95px; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;">
    ② 認証 (Auth)
  </div>

  <div class="arrow-label" style="top: 410px; left: 220px; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;">
    ② DB直接CRUD (0.1〜0.3s)
  </div>

  <div class="arrow-label" style="top: 415px; left: 470px; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;">
    ② 写真保存
  </div>

  <div class="arrow-label" style="top: 415px; left: 630px; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE;">
    ③ 予定同期・OAuth連携
  </div>

  <div class="arrow-label" style="top: 556px; left: 818px; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; font-size: 9.5px;">
    原本同期
  </div>

  <div class="arrow-label" style="top: 135px; left: 660px; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;">
    ④ 通知リクエスト (雨天中止・リマインド)
  </div>

  <div class="arrow-label" style="top: 265px; left: 740px; background: #DCFCE7; color: #15803D; border: 1.5px solid #86EFAC; font-size: 11.5px;">
    ④ LINEプッシュ通知着信！
  </div>

  <!-- ========================================================
       1. GitHub Pages (Webホスティング)
       ======================================================== -->
  <div class="card" style="top: 0; left: 30px; width: 330px; height: 85px; padding: 12px 16px; border: 1.5px solid #CBD5E1; background: #F8FAFC; display: flex; align-items: center; gap: 12px;">
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0F172A"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 4C7.58 4 4 7.58 4 12C4 15.54 6.29 18.53 9.47 19.59C9.87 19.66 10.02 19.42 10.02 19.21C10.02 19.02 10.01 18.39 10.01 17.72C8 18.09 7.46 17.18 7.3 16.73C7.21 16.5 6.82 15.79 6.48 15.6C6.2 15.45 5.8 15.08 6.47 15.07C7.1 15.06 7.55 15.65 7.7 15.89C8.42 17.11 9.57 16.77 10.03 16.56C10.1 16.04 10.31 15.68 10.54 15.48C8.75 15.28 6.87 14.59 6.87 11.51C6.87 10.63 7.18 9.92 7.69 9.36C7.61 9.16 7.33 8.33 7.77 7.23C7.77 7.23 8.44 7.02 9.99 8.06C10.63 7.88 11.32 7.79 12.01 7.79C12.7 7.79 13.39 7.88 14.03 8.06C15.58 7.01 16.25 7.23 16.25 7.23C16.69 8.33 16.41 9.16 16.33 9.36C16.84 9.92 17.15 10.63 17.15 11.51C17.15 14.6 15.26 15.28 13.47 15.48C13.76 15.73 14.01 16.21 14.01 16.96C14.01 18.04 14 18.91 14 19.21C14 19.42 14.15 19.67 14.55 19.59C17.71 18.53 20 15.53 20 12C20 7.58 16.42 4 12 4Z" fill="#FFFFFF"/>
    </svg>
    <div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 14.5px; font-weight: 800; color: #0F172A;">GitHub Pages</span>
        <span class="badge" style="background: #0F172A; color: #FFFFFF;">Webホスティング</span>
      </div>
      <div style="font-size: 10.5px; color: #0284C7; font-weight: 700; margin-top: 1px;">fcbenten.github.io/team-management</div>
      <div style="font-size: 9.5px; color: #64748B;">HTML / CSS / JS / PWAバンドル配信元</div>
    </div>
  </div>

  <!-- ========================================================
       2. ユーザー端末 (スマートフォン / PC)
       ======================================================== -->
  <div class="card" style="top: 160px; left: 30px; width: 560px; height: 215px; padding: 14px 18px; border: 2px solid #94A3B8; background: #F8FAFC;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 15px;">📱</span>
        <span style="font-size: 14px; font-weight: 800; color: #0F172A;">部員・役員の端末 (スマートフォン / PC)</span>
      </div>
      <span class="badge" style="background: #475569; color: #FFFFFF;">クライアント環境</span>
    </div>

    <!-- 端末内の2つのアプリ -->
    <div style="display: flex; gap: 14px; height: 150px;">

      <!-- Webアプリ (PWA) -->
      <div style="flex: 1.15; background: #FFFFFF; border: 2px solid #0284C7; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#0284C7"/>
            <path d="M6 12 L12 6 L18 12 M8 10.5 V17 H16 V10.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div>
            <div style="font-size: 13.5px; font-weight: 800; color: #0284C7;">Webアプリ (PWA)</div>
            <div style="font-size: 9.5px; color: #64748B;">Vanilla JS (SPA) / 端末で実行</div>
          </div>
        </div>
        <div style="font-size: 9.5px; color: #334155; line-height: 1.45; background: #F0F9FF; padding: 6px 8px; border-radius: 6px;">
          ・ホーム画面から0秒で即起動<br>
          ・出欠回答、スコア入力、掲示板<br>
          ・全データを直接Supabaseと読み書き
        </div>
        <div style="font-size: 9px; color: #0369A1; font-weight: 700;">ブラウザ上で直接各サービスと通信</div>
      </div>

      <!-- LINEアプリ -->
      <div style="flex: 0.85; background: #FFFFFF; border: 2px solid #06C755; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#06C755"/>
            <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
          </svg>
          <div>
            <div style="font-size: 13.5px; font-weight: 800; color: #06C755;">LINE アプリ</div>
            <div style="font-size: 9.5px; color: #64748B;">部員個人のスマホ</div>
          </div>
        </div>
        <div style="font-size: 9.5px; color: #334155; line-height: 1.45; background: #F0FDF4; padding: 6px 8px; border-radius: 6px;">
          ・雨天中止通知を受信<br>
          ・前日出欠リマインド受信<br>
          ・重要アナウンスの即時確認
        </div>
        <div style="font-size: 9px; color: #15803D; font-weight: 700;">部員のLINEに自動プッシュ着信</div>
      </div>

    </div>
  </div>

  <!-- ========================================================
       3. Supabase (クラウドデータベース)
       ======================================================== -->
  <div class="card" style="top: 475px; left: 30px; width: 560px; height: 205px; padding: 14px 18px; border: 2px solid #3ECF8E;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="22" height="22" viewBox="0 0 109 113" fill="none">
          <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9624 107.314L53.9738 55.5768H99.1026C106.597 55.5768 110.745 64.1956 106.012 70.157L63.7076 110.284Z" fill="#3ECF8E"/>
          <path d="M45.297 2.71607C48.1565 -0.884784 53.9544 1.08779 54.0422 5.68607L54.4093 57.4232H10.268C2.77333 57.4232 -1.37464 48.8044 3.35808 42.843L45.297 2.71607Z" fill="#3ECF8E"/>
        </svg>
        <span style="font-size: 17px; font-weight: 800; color: #111827;">supabase</span>
        <span class="badge" style="background: #10B981; color: #FFFFFF;">クラウドデータベース (BaaS)</span>
      </div>
      <span style="font-size: 10px; color: #64748B; font-weight: 700;">東京リージョン (ap-northeast-1)</span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; height: 140px;">
      <!-- 認証 -->
      <div class="sub-item" style="border: 1px solid #D1FAE5; background: #F0FDF4;">
        <div class="icon-box" style="background: #ECFDF5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="3" stroke="#10B981" stroke-width="2"/>
            <path d="M8 11 V7 C8 4.79 9.79 3 12 3 C14.21 3 16 4.79 16 7 V11" stroke="#10B981" stroke-width="2"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 800; color: #065F46;">認証 (Auth)</div>
        <div style="font-size: 9.5px; color: #047857; margin-top: 3px;">パスワード認証<br>JWTセッション管理</div>
      </div>

      <!-- データベース -->
      <div class="sub-item" style="border: 2px solid #10B981; background: #ECFDF5;">
        <div class="icon-box" style="background: #D1FAE5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#047857" stroke-width="2"/>
            <path d="M4 6 V12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12 V6" stroke="#047857" stroke-width="2"/>
            <path d="M4 12 V18 C4 19.66 7.58 21 12 21 C16.42 21 20 19.66 20 18 V12" stroke="#047857" stroke-width="2"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 800; color: #065F46;">データベース</div>
        <div style="font-size: 10px; color: #047857; font-weight: 800; margin-top: 2px;">PostgreSQL 17</div>
        <div style="font-size: 9px; color: #065F46;">出欠/試合/掲示板/名簿/備品</div>
      </div>

      <!-- ストレージ -->
      <div class="sub-item" style="border: 1px solid #D1FAE5; background: #F0FDF4;">
        <div class="icon-box" style="background: #ECFDF5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 L14 2 Z" stroke="#10B981" stroke-width="2"/>
            <circle cx="10" cy="14" r="2" fill="#10B981"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 800; color: #065F46;">ストレージ</div>
        <div style="font-size: 9.5px; color: #047857; margin-top: 3px;">member-avatars<br>プロフィール写真 (CDN)</div>
      </div>
    </div>
  </div>

  <!-- ========================================================
       4. Google サービス (カレンダー ＆ GAS特権代行)
       ======================================================== -->
  <div class="card" style="top: 475px; left: 640px; width: 390px; height: 205px; padding: 14px 18px; border: 2px solid #3B82F6;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span style="font-size: 16px; font-weight: 800; color: #111827;">Google サービス</span>
      </div>
      <span class="badge" style="background: #2563EB; color: #FFFFFF;">特権代行 ＆ カレンダー</span>
    </div>

    <div style="display: flex; gap: 10px; height: 140px;">
      <!-- Google Apps Script -->
      <div class="sub-item" style="flex: 1; border: 1.5px solid #93C5FD; background: #EFF6FF;">
        <div class="icon-box" style="background: #DBEAFE;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="6" fill="#2563EB"/>
            <path d="M8 12 L10 10 M8 12 L10 14" stroke="#FFFFFF" stroke-width="1.8"/>
            <path d="M16 12 L14 10 M16 12 L14 14" stroke="#FFFFFF" stroke-width="1.8"/>
          </svg>
        </div>
        <div style="font-size: 12.5px; font-weight: 800; color: #1E40AF;">Google Apps Script</div>
        <div style="font-size: 9.5px; color: #2563EB; font-weight: 700; margin-top: 2px;">特権代行 API</div>
        <div style="font-size: 9px; color: #4B5563; margin-top: 2px;">カレンダー仲介<br>OAuth交換 / 通知発信</div>
      </div>

      <!-- Google カレンダー -->
      <div class="sub-item" style="flex: 1; border: 1.5px solid #FCA5A5; background: #FEF2F2;">
        <div class="icon-box" style="background: #FEE2E2;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="3" fill="#FFFFFF" stroke="#EA4335" stroke-width="2"/>
            <rect x="3" y="5" width="18" height="5" rx="2" fill="#EA4335"/>
            <circle cx="8" cy="14" r="1.5" fill="#3B82F6"/>
            <circle cx="12" cy="14" r="1.5" fill="#3B82F6"/>
            <circle cx="16" cy="14" r="1.5" fill="#10B981"/>
          </svg>
        </div>
        <div style="font-size: 12.5px; font-weight: 800; color: #991B1B;">Google カレンダー</div>
        <div style="font-size: 9.5px; color: #DC2626; font-weight: 700; margin-top: 2px;">チーム公式予定の原本</div>
        <div style="font-size: 9px; color: #4B5563; margin-top: 2px;">練習・試合日程<br>出席者ステータス同期</div>
      </div>
    </div>
  </div>

  <!-- ========================================================
       5. LINE Messaging API (公式アカウント通知)
       ======================================================== -->
  <div class="card" style="top: 160px; left: 1090px; width: 235px; height: 260px; padding: 18px 16px; border: 2px solid #06C755; background: #F0FDF4; display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: space-between;">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="8" fill="#06C755"/>
        <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
      </svg>
      <div style="font-size: 14.5px; font-weight: 800; color: #06C755;">LINE Messaging API</div>
      <span class="badge" style="background: #06C755; color: #FFFFFF;">公式アカウント通知</span>
    </div>

    <div style="font-size: 10px; color: #374151; line-height: 1.5; background: #FFFFFF; padding: 8px 10px; border-radius: 8px; border: 1px solid #BBF7D0; width: 100%;">
      ・雨天中止などの緊急一斉通知<br>
      ・前日未回答者への出欠リマインド<br>
      ・重要アナウンスのプッシュ着信
    </div>

    <div style="font-size: 9.5px; font-weight: 800; color: #15803D;">部員のLINEへ自動プッシュ ➔</div>
  </div>

</div>

</body>
</html>
"""

def generate_diagram_image():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    docs_dir = os.path.join(base_dir, "docs")
    os.makedirs(docs_dir, exist_ok=True)

    html_path = os.path.join(docs_dir, "flow_diagram_fitted.html")
    png_path = os.path.join(docs_dir, "flow_diagram_fitted.png")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(HTML_CONTENT)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1360, "height": 780})
            page.goto(f"file:///{html_path.replace(os.sep, '/')}")
            page.wait_for_timeout(300)
            page.screenshot(path=png_path, full_page=True)
            browser.close()
    finally:
        if os.path.exists(html_path):
            os.remove(html_path)

    print(f"Diagram image generated: {png_path}")
    return png_path

if __name__ == "__main__":
    generate_diagram_image()
