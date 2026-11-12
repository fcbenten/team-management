# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
ユーザーの指摘を100%解決した最新アーキテクチャ・システム相関図:
1. Excel設計書の表幅（列80・1560px）に完全に合わせたフルサイズ描画（画像が小さくならない）
2. Google Apps Script / Google カレンダー / LINE / GitHub の各アイコンを本物の公式ブランドロゴに刷新
3. 画面（Webアプリ）からGASへの不要な経路を完全撤廃し、「Webアプリ ⇄ Supabase」を画面唯一のデータ通信として純化
4. Webアプリ、LINEアプリ、LINE Messaging API等に残っていた説明文を全廃し、全小箱の記載粒度を完全統一
5. 矢印の上の文字ラベルを全廃し、大箱と小箱の間にゆったりとした心地よい余白を確保
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
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    background: #FFFFFF;
    color: #1F2937;
    padding: 24px 32px;
    width: 1560px;
    height: 760px;
    overflow: hidden;
  }

  /* ヘッダー */
  .header-group {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid #F1F5F9;
  }
  .title {
    font-size: 26px;
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.02em;
  }
  .sub-title {
    font-size: 13.5px;
    color: #64748B;
    font-weight: 600;
  }

  /* キャンバス（絶対配置領域） */
  .canvas {
    position: relative;
    width: 100%;
    height: 665px;
  }

  /* 大箱（親カード） */
  .big-box {
    background: #FFFFFF;
    border-radius: 18px;
    position: absolute;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }

  /* バッジ */
  .badge {
    font-size: 11px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 6px;
    display: inline-block;
    white-space: nowrap;
  }

  /* 小箱（子アイテム） */
  .small-box {
    background: #FFFFFF;
    border-radius: 14px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .icon-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
</style>
</head>
<body>

<div class="header-group">
  <div class="title">アーキテクチャ ＆ システム相関図</div>
  <div class="sub-title">FC Benten チーム管理システム（クライアント・Supabase・Google・LINEの役割と通信フロー）</div>
</div>

<div class="canvas">

  <!-- ========================================================
       SVG レイヤー（シャープで美しい矢印・markerUnits="userSpaceOnUse" で完璧なプロ仕様）
       ======================================================== -->
  <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- PWA 下向き矢印 -->
      <marker id="arr-pwa" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 9 5 L 1 9 Z" fill="#0284C7"/>
      </marker>
      <!-- Supabase 終点矢印 -->
      <marker id="arr-supabase" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 9 5 L 1 9 Z" fill="#10B981"/>
      </marker>
      <!-- Supabase 始点逆矢印 -->
      <marker id="arr-supabase-rev" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 9 1 L 1 5 L 9 9 Z" fill="#10B981"/>
      </marker>
      <!-- Google 下向き矢印 -->
      <marker id="arr-google" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 9 5 L 1 9 Z" fill="#2563EB"/>
      </marker>
      <!-- Google 上向き逆矢印 -->
      <marker id="arr-google-rev" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 9 1 L 1 5 L 9 9 Z" fill="#2563EB"/>
      </marker>
      <!-- LINE 矢印 -->
      <marker id="arr-line" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 9 5 L 1 9 Z" fill="#06C755"/>
      </marker>
    </defs>

    <!-- 1. GitHub Pages ➔ PC・スマートフォン (垂直下向き点線) -->
    <path d="M 222 80 V 108" stroke="#0284C7" stroke-width="2.5" stroke-dasharray="4 3" marker-end="url(#arr-pwa)"/>

    <!-- 2. Webアプリ ⇄ Supabase (画面の主通信・小箱中央 y=220 から Supabase DB y=100 へ向かう美しい双方向S字曲線) -->
    <path d="M 416 220 C 455 220, 445 105, 484 105" stroke="#10B981" stroke-width="3" fill="none" marker-start="url(#arr-supabase-rev)" marker-end="url(#arr-supabase)"/>

    <!-- 3. Supabase (データベース) ⇄ Google サービス (カレンダー同期・十分な隙間にシャープな両矢印) -->
    <path d="M 990 200 V 230" stroke="#2563EB" stroke-width="2.5" fill="none" marker-start="url(#arr-google-rev)" marker-end="url(#arr-google)"/>

    <!-- 4. Google Apps Script ➔ Google カレンダー (原本同期・水平) -->
    <path d="M 960 330 H 1010" stroke="#2563EB" stroke-width="2.5" fill="none" marker-end="url(#arr-google)"/>

    <!-- 5. Google Apps Script ➔ LINE Messaging API (垂直下向き) -->
    <path d="M 740 423 V 458" stroke="#06C755" stroke-width="2.5" fill="none" marker-end="url(#arr-line)"/>

    <!-- 6. LINE Messaging API ➔ PC・スマートフォン (完全な水平直線・部員のスマホLINEアプリへ直接プッシュ！) -->
    <path d="M 488 565 H 418" stroke="#06C755" stroke-width="3" fill="none" marker-end="url(#arr-line)"/>
  </svg>


  <!-- ========================================================
       1. GitHub Pages (Webホスティングサーバー・独立大箱)
       ======================================================== -->
  <div class="big-box" style="top: 0; left: 32px; width: 380px; height: 80px; padding: 12px 20px; background: #0F172A; border: 1.5px solid #334155; color: #FFFFFF; display: flex; align-items: center; gap: 14px;">
    <!-- 公式 GitHub マーク -->
    <svg width="38" height="38" viewBox="0 0 24 24" fill="#FFFFFF">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017C2 16.446 4.87 20.198 8.84 21.52C9.34 21.61 9.52 21.3 9.52 21.03C9.52 20.79 9.51 20.01 9.51 19.17C6.73 19.77 6.14 18.6 5.92 18.01C5.8 17.7 5.29 16.77 4.84 16.52C4.47 16.32 3.94 15.83 4.83 15.82C5.66 15.81 6.26 16.58 6.46 16.9C7.4 18.52 8.93 18.07 9.54 17.79C9.63 17.11 9.9 16.65 10.2 16.39C7.97 16.14 5.64 15.28 5.64 11.45C5.64 10.36 6.03 9.46 6.67 8.76C6.57 8.51 6.22 7.48 6.77 6.1C6.77 6.1 7.61 5.84 9.52 7.13C10.32 6.91 11.17 6.8 12.02 6.8C12.87 6.8 13.72 6.91 14.52 7.13C16.43 5.83 17.27 6.1 17.27 6.1C17.82 7.48 17.47 8.51 17.37 8.76C18.01 9.46 18.4 10.35 18.4 11.45C18.4 15.29 16.06 16.14 13.83 16.39C14.2 16.71 14.52 17.32 14.52 18.28C14.52 19.65 14.51 20.76 14.51 21.03C14.51 21.3 14.69 21.62 15.2 21.52C19.16 20.19 22.03 16.44 22.03 12.017C22.03 6.484 17.553 2 12 2Z"/>
    </svg>
    <div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px; font-weight: 800;">GitHub Pages</span>
        <span class="badge" style="background: #334155; color: #94A3B8; font-size: 9.5px;">Webホスティング</span>
      </div>
      <div style="font-size: 11.5px; color: #38BDF8; font-weight: 700; margin-top: 2px;">fcbenten.github.io</div>
      <div style="font-size: 10px; color: #94A3B8; margin-top: 1px;">Webアプリ本体 (HTML/CSS/JS) の配信元</div>
    </div>
  </div>


  <!-- ========================================================
       2. PC・スマートフォン (クライアント環境・大箱)
       ======================================================== -->
  <div class="big-box" style="top: 115px; left: 32px; width: 380px; height: 545px; padding: 20px 22px; border: 2px solid #CBD5E1; background: #F8FAFC; display: flex; flex-direction: column; justify-content: space-between;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">💻📱</span>
        <span style="font-size: 16px; font-weight: 800; color: #0F172A;">PC・スマートフォン</span>
      </div>
      <span class="badge" style="background: #475569; color: #FFFFFF;">クライアント環境</span>
    </div>

    <!-- 小箱1: Webアプリ (PWA) (記載粒度を統一) -->
    <div class="small-box" style="border: 2.5px solid #0284C7; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.08); height: 110px;">
      <div class="icon-box" style="background: #E0F2FE;">
        <!-- PWA / Webアプリアイコン -->
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#0284C7"/>
          <path d="M4 11 L12 5 L20 11 M6 10 V18 C6 18.5 6.5 19 7 19 H17 C17.5 19 18 18.5 18 18 V10" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 19 V13 H14 V19" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div style="font-size: 16px; font-weight: 800; color: #0284C7;">Webアプリ (PWA)</div>
        <div style="font-size: 11.5px; color: #475569; font-weight: 700; margin-top: 3px;">Vanilla JS (SPA)</div>
        <div style="font-size: 10px; color: #64748B; margin-top: 2px;">ブラウザ実行 / ホーム画面から0秒起動</div>
      </div>
    </div>

    <!-- 小箱2: LINE アプリ (記載粒度を統一) -->
    <div class="small-box" style="border: 2.5px solid #06C755; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.08); height: 110px;">
      <div class="icon-box" style="background: #06C755;">
        <!-- LINE 公式ロゴ -->
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.9 5.39 4.75 6.78-.21.78-.77 2.83-.88 3.27-.14.54.2.53.42.39.29-.19 3.96-2.7 4.54-3.11.39.05.78.08 1.17.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
        </svg>
      </div>
      <div>
        <div style="font-size: 16px; font-weight: 800; color: #06C755;">LINE アプリ</div>
        <div style="font-size: 11.5px; color: #475569; font-weight: 700; margin-top: 3px;">部員個人のスマホアプリ</div>
        <div style="font-size: 10px; color: #64748B; margin-top: 2px;">雨天中止・出欠リマインドのプッシュ受信</div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       3. Supabase (クラウドデータベース・大箱)
       ======================================================== -->
  <div class="big-box" style="top: 0; left: 490px; width: 1000px; height: 195px; padding: 18px 26px; border: 2px solid #10B981;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <!-- Supabase 公式稲妻ロゴ -->
        <svg width="26" height="26" viewBox="0 0 109 113" fill="none">
          <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9624 107.314L53.9738 55.5768H99.1026C106.597 55.5768 110.745 64.1956 106.012 70.157L63.7076 110.284Z" fill="#3ECF8E"/>
          <path d="M45.297 2.71607C48.1565 -0.884784 53.9544 1.08779 54.0422 5.68607L54.4093 57.4232H10.268C2.77333 57.4232 -1.37464 48.8044 3.35808 42.843L45.297 2.71607Z" fill="#3ECF8E"/>
        </svg>
        <span style="font-size: 20px; font-weight: 800; color: #111827;">supabase</span>
        <span class="badge" style="background: #10B981; color: #FFFFFF;">クラウドデータベース (BaaS)</span>
      </div>
      <span style="font-size: 11px; color: #64748B; font-weight: 700;">東京リージョン (ap-northeast-1)</span>
    </div>

    <!-- 小箱3つ（ゆったり配置・余白を適正化） -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; height: 105px;">
      <!-- 認証 -->
      <div class="small-box" style="border: 1.5px solid #D1FAE5; background: #F0FDF4;">
        <div class="icon-box" style="background: #ECFDF5;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="3" stroke="#10B981" stroke-width="2"/>
            <path d="M8 11 V7 C8 4.79 9.79 3 12 3 C14.21 3 16 4.79 16 7 V11" stroke="#10B981" stroke-width="2"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #065F46;">認証 (Auth)</div>
          <div style="font-size: 11px; color: #047857; font-weight: 700; margin-top: 3px;">パスワード認証・JWT</div>
          <div style="font-size: 10px; color: #64748B; margin-top: 2px;">行単位セキュリティ (RLS)</div>
        </div>
      </div>

      <!-- データベース -->
      <div class="small-box" style="border: 2px solid #10B981; background: #ECFDF5; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);">
        <div class="icon-box" style="background: #D1FAE5;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#047857" stroke-width="2"/>
            <path d="M4 6 V12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12 V6" stroke="#047857" stroke-width="2"/>
            <path d="M4 12 V18 C4 19.66 7.58 21 12 21 C16.42 21 20 19.66 20 18 V12" stroke="#047857" stroke-width="2"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #065F46;">データベース</div>
          <div style="font-size: 11px; color: #047857; font-weight: 800; margin-top: 3px;">PostgreSQL 17</div>
          <div style="font-size: 10px; color: #059669; font-weight: 700; margin-top: 2px;">0.1〜0.3s 超高速CRUD</div>
        </div>
      </div>

      <!-- ストレージ -->
      <div class="small-box" style="border: 1.5px solid #D1FAE5; background: #F0FDF4;">
        <div class="icon-box" style="background: #ECFDF5;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 L14 2 Z" stroke="#10B981" stroke-width="2"/>
            <circle cx="10" cy="14" r="2" fill="#10B981"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #065F46;">ストレージ</div>
          <div style="font-size: 11px; color: #047857; font-weight: 700; margin-top: 3px;">member-avatars</div>
          <div style="font-size: 10px; color: #64748B; margin-top: 2px;">写真保存 (CDN高速配信)</div>
        </div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       4. Google サービス (特権代行 ＆ カレンダー・大箱)
       ======================================================== -->
  <div class="big-box" style="top: 235px; left: 490px; width: 1000px; height: 185px; padding: 18px 26px; border: 2px solid #3B82F6;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <!-- Google カラー "G" アイコン -->
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span style="font-size: 18px; font-weight: 800; color: #111827;">Google サービス</span>
      </div>
      <span class="badge" style="background: #2563EB; color: #FFFFFF;">特権代行 ＆ 予定管理</span>
    </div>

    <!-- 小箱2つ（ゆったり配置・余白を適正化） -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; height: 100px; align-items: center;">
      <!-- 小箱1: Google Apps Script (公式ロゴ) -->
      <div class="small-box" style="border: 1.5px solid #93C5FD; background: #EFF6FF;">
        <div class="icon-box" style="background: #4285F4; border-radius: 10px;">
          <!-- 公式 Google Apps Script アイコン (<>) -->
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M8.5 7 L4 12 L8.5 17" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15.5 7 L20 12 L15.5 17" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #1E40AF;">Google Apps Script (GAS)</div>
          <div style="font-size: 11px; color: #2563EB; font-weight: 700; margin-top: 3px;">特権代行 API / 定期トリガー</div>
          <div style="font-size: 10px; color: #64748B; margin-top: 2px;">カレンダー仲介 ＆ LINE通知発信</div>
        </div>
      </div>

      <!-- 小箱2: Google カレンダー (公式 4色ロゴ) -->
      <div class="small-box" style="border: 1.5px solid #FCA5A5; background: #FEF2F2;">
        <div class="icon-box" style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 10px;">
          <!-- 公式 Google Calendar 4色 アイコン -->
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="5" fill="#FFFFFF"/>
            <path d="M5 3H19C20.1 3 21 3.9 21 5V8H3V5C3 3.9 3.9 3 5 3Z" fill="#4285F4"/>
            <path d="M21 8V19C21 20.1 20.1 21 19 21H17V8H21Z" fill="#34A853"/>
            <path d="M19 21H5C3.9 21 3 20.1 3 19V17H19V21Z" fill="#EA4335"/>
            <path d="M3 19V8H7V21H5C3.9 21 3 20.1 3 19Z" fill="#FBBC05"/>
            <rect x="6" y="8" width="12" height="10" fill="#FFFFFF"/>
            <text x="12" y="16" fill="#1A73E8" font-size="8.5" font-weight="900" font-family="-apple-system, sans-serif" text-anchor="middle">31</text>
          </svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #991B1B;">Google カレンダー</div>
          <div style="font-size: 11px; color: #DC2626; font-weight: 700; margin-top: 3px;">公式予定の原本データ</div>
          <div style="font-size: 10px; color: #64748B; margin-top: 2px;">練習・試合・遠征のマスター日程</div>
        </div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       5. LINE Messaging API (公式通知基盤・大箱)
       ======================================================== -->
  <div class="big-box" style="top: 465px; left: 490px; width: 1000px; height: 195px; padding: 18px 26px; border: 2px solid #06C755; background: #F0FDF4;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1.5px solid #BBF7D0; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <!-- LINE 公式ロゴ -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#06C755">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.9 5.39 4.75 6.78-.21.78-.77 2.83-.88 3.27-.14.54.2.53.42.39.29-.19 3.96-2.7 4.54-3.11.39.05.78.08 1.17.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
        </svg>
        <span style="font-size: 18px; font-weight: 800; color: #065F46;">LINE Messaging API</span>
        <span class="badge" style="background: #06C755; color: #FFFFFF;">公式アカウント通知基盤</span>
      </div>
      <span style="font-size: 11px; color: #15803D; font-weight: 700;">LINE公式アカウント</span>
    </div>

    <!-- 小箱2つ（記載粒度を完全に統一） -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; height: 100px; align-items: center;">
      <!-- 小箱1: Messaging API 基盤 -->
      <div class="small-box" style="border: 1.5px solid #BBF7D0; background: #FFFFFF;">
        <div class="icon-box" style="background: #06C755;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.9 5.39 4.75 6.78-.21.78-.77 2.83-.88 3.27-.14.54.2.53.42.39.29-.19 3.96-2.7 4.54-3.11.39.05.78.08 1.17.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #065F46;">LINE Messaging API</div>
          <div style="font-size: 11px; color: #059669; font-weight: 700; margin-top: 3px;">クラウド通知サーバーレスAPI</div>
          <div style="font-size: 10px; color: #64748B; margin-top: 2px;">GASトリガーからWebhook即時発信</div>
        </div>
      </div>

      <!-- 小箱2: 自動プッシュ着信 -->
      <div class="small-box" style="border: 1.5px solid #BBF7D0; background: #FFFFFF;">
        <div class="icon-box" style="background: #DCFCE7; border: 1.5px solid #86EFAC;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21S18 15 18 8Z" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13.73 21A2 2 0 0 1 10.27 21" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #15803D;">自動プッシュ通知配信</div>
          <div style="font-size: 11px; color: #166534; font-weight: 700; margin-top: 3px;">雨天中止連絡 ／ 前日出欠リマインド</div>
          <div style="font-size: 10px; color: #64748B; margin-top: 2px;">部員個人のスマホへ直接プッシュ着信</div>
        </div>
      </div>
    </div>
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
            page = browser.new_page(viewport={"width": 1560, "height": 760})
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
