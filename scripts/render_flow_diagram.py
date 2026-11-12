# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
ユーザーの指摘に基づき、
1. GitHub Pages (ホスティング) ➔ ユーザー端末へのアプリ配信
2. ユーザー端末内の「Webアプリ (PWA)」と「LINEアプリ」の分離
3. Webアプリ ⇄ Supabase (クラウドDB) の直接通信
4. Webアプリ ⇄ Google サービス (カレンダー/GAS) の直接通信
5. LINE通知 ➔ ユーザー端末のLINEアプリ への配信
を完全に正しく図解した、明快かつ美しいシステム構成相関図を生成するスクリプト。
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
    padding: 24px 36px;
    width: 1360px;
    height: 780px;
  }

  /* タイトル */
  .header-group {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid #F3F4F6;
  }
  .title {
    font-size: 24px;
    font-weight: 800;
    color: #111827;
    letter-spacing: -0.02em;
  }
  .sub-title {
    font-size: 13px;
    color: #4B5563;
    font-weight: 600;
  }

  /* 全体キャンバス */
  .canvas {
    position: relative;
    width: 100%;
    height: 680px;
  }

  /* 共通カード */
  .card {
    background: #FFFFFF;
    border: 1.5px solid #E5E7EB;
    border-radius: 16px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
    position: absolute;
  }

  /* 1. GitHub Pages (上段中央) */
  .card-github {
    top: 0;
    left: 40px;
    width: 380px;
    height: 90px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    background: #F8FAFC;
    border-color: #CBD5E1;
  }

  /* 2. ユーザー端末 (中段左〜中央) */
  .card-device {
    top: 140px;
    left: 40px;
    width: 500px;
    height: 250px;
    padding: 16px 20px;
    background: #F9FAFB;
    border: 2px solid #9CA3AF;
  }

  /* 3. Supabase (下段左) */
  .card-supabase {
    bottom: 10px;
    left: 40px;
    width: 500px;
    height: 240px;
    padding: 18px 22px;
    border-color: #3ECF8E;
    background: #FFFFFF;
  }

  /* 4. Google サービス (下段中央〜右) */
  .card-google {
    bottom: 10px;
    left: 580px;
    width: 440px;
    height: 240px;
    padding: 18px 22px;
    border-color: #4285F4;
    background: #FFFFFF;
  }

  /* 5. LINE 通知配信 (中段右) */
  .card-line {
    top: 140px;
    left: 1060px;
    width: 260px;
    height: 250px;
    padding: 20px 18px;
    border-color: #06C755;
    background: #F0FDF4;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    justify-content: space-between;
  }

  /* ラベル・バッジ */
  .badge {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 9999px;
    display: inline-block;
  }
  .badge-gh { background: #0F172A; color: #FFFFFF; }
  .badge-pwa { background: #0284C7; color: #FFFFFF; }
  .badge-sub { background: #10B981; color: #FFFFFF; }
  .badge-g { background: #2563EB; color: #FFFFFF; }
  .badge-line { background: #06C755; color: #FFFFFF; }

  /* 内部アイテム */
  .item-box {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .icon-square {
    width: 36px;
    height: 36px;
    border-radius: 8px;
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
  <div class="sub-title">FC Benten チーム管理システム（ホスティング・DB・Google・LINEの役割と通信フロー）</div>
</div>

<div class="canvas">

  <!-- ========================================================
       1. GitHub Pages (Webホスティング / アプリの配信元)
       ======================================================== -->
  <div class="card card-github">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0F172A"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 4C7.58 4 4 7.58 4 12C4 15.54 6.29 18.53 9.47 19.59C9.87 19.66 10.02 19.42 10.02 19.21C10.02 19.02 10.01 18.39 10.01 17.72C8 18.09 7.46 17.18 7.3 16.73C7.21 16.5 6.82 15.79 6.48 15.6C6.2 15.45 5.8 15.08 6.47 15.07C7.1 15.06 7.55 15.65 7.7 15.89C8.42 17.11 9.57 16.77 10.03 16.56C10.1 16.04 10.31 15.68 10.54 15.48C8.75 15.28 6.87 14.59 6.87 11.51C6.87 10.63 7.18 9.92 7.69 9.36C7.61 9.16 7.33 8.33 7.77 7.23C7.77 7.23 8.44 7.02 9.99 8.06C10.63 7.88 11.32 7.79 12.01 7.79C12.7 7.79 13.39 7.88 14.03 8.06C15.58 7.01 16.25 7.23 16.25 7.23C16.69 8.33 16.41 9.16 16.33 9.36C16.84 9.92 17.15 10.63 17.15 11.51C17.15 14.6 15.26 15.28 13.47 15.48C13.76 15.73 14.01 16.21 14.01 16.96C14.01 18.04 14 18.91 14 19.21C14 19.42 14.15 19.67 14.55 19.59C17.71 18.53 20 15.53 20 12C20 7.58 16.42 4 12 4Z" fill="#FFFFFF"/>
    </svg>
    <div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 15px; font-weight: 800; color: #0F172A;">GitHub Pages</span>
        <span class="badge badge-gh">Webホスティング</span>
      </div>
      <div style="font-size: 11px; color: #0284C7; font-weight: 700; margin-top: 2px;">fcbenten.github.io/team-management</div>
      <div style="font-size: 10px; color: #64748B;">★ここにWebアプリ本体 (HTML/CSS/JS) が載っている★</div>
    </div>
  </div>

  <!-- 矢印①: GitHub Pages ➔ 端末 (PWA配信) -->
  <svg style="position: absolute; top: 90px; left: 160px; width: 60px; height: 50px;" viewBox="0 0 60 50" fill="none">
    <path d="M 30 0 V 42" stroke="#0284C7" stroke-width="2.5" stroke-dasharray="4 3"/>
    <path d="M 24 36 L 30 44 L 36 36" fill="#0284C7"/>
  </svg>
  <div style="position: absolute; top: 102px; left: 195px; font-size: 11px; font-weight: 800; color: #0284C7; background: #E0F2FE; padding: 2px 8px; border-radius: 4px;">
    ① 初回アクセス時にPWAを配信・インストール
  </div>

  <!-- ========================================================
       2. ユーザー端末 (スマートフォン / PC)
       ======================================================== -->
  <div class="card card-device">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 16px;">📱</span>
        <span style="font-size: 15px; font-weight: 800; color: #111827;">部員・役員の端末 (スマートフォン / PC)</span>
      </div>
      <span class="badge" style="background: #4B5563; color: #FFFFFF;">クライアント環境</span>
    </div>

    <!-- 端末内の2つのアプリ -->
    <div style="display: flex; gap: 16px; height: 180px;">

      <!-- 端末内: Webアプリ (PWA) -->
      <div style="flex: 1.2; background: #FFFFFF; border: 1.5px solid #0284C7; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#0284C7"/>
            <path d="M6 12 L12 6 L18 12 M8 10.5 V17 H16 V10.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div>
            <div style="font-size: 13.5px; font-weight: 800; color: #0284C7;">Webアプリ (PWA)</div>
            <div style="font-size: 9.5px; color: #64748B;">Vanilla JS (SPA) / 端末で実行</div>
          </div>
        </div>
        <div style="font-size: 10px; color: #374151; line-height: 1.45; background: #F0F9FF; padding: 6px 8px; border-radius: 6px;">
          ・ホーム画面から0秒で起動<br>
          ・出欠回答、スコア入力、掲示板閲覧<br>
          ・出欠ボタン等は0秒で即時画面反映
        </div>
        <div style="font-size: 9.5px; color: #0369A1; font-weight: 700;">★ブラウザ上で直接各サービスと通信★</div>
      </div>

      <!-- 端末内: LINEアプリ -->
      <div style="flex: 0.8; background: #FFFFFF; border: 1.5px solid #06C755; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#06C755"/>
            <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
          </svg>
          <div>
            <div style="font-size: 13.5px; font-weight: 800; color: #06C755;">LINE アプリ</div>
            <div style="font-size: 9.5px; color: #64748B;">部員個人のスマホアプリ</div>
          </div>
        </div>
        <div style="font-size: 10px; color: #374151; line-height: 1.45; background: #F0FDF4; padding: 6px 8px; border-radius: 6px;">
          ・雨天中止通知を受信<br>
          ・前日出欠リマインドを受信<br>
          ・重要アナウンスの通知
        </div>
        <div style="font-size: 9.5px; color: #15803D; font-weight: 700;">★部員のLINEにプッシュ着信★</div>
      </div>

    </div>
  </div>

  <!-- 矢印②: Webアプリ ⇄ Supabase (DB通信) -->
  <svg style="position: absolute; top: 390px; left: 160px; width: 60px; height: 40px;" viewBox="0 0 60 40" fill="none">
    <path d="M 30 6 V 34" stroke="#10B981" stroke-width="3"/>
    <path d="M 23 12 L 30 4 L 37 12" fill="#10B981"/>
    <path d="M 23 28 L 30 36 L 37 28" fill="#10B981"/>
  </svg>
  <div style="position: absolute; top: 398px; left: 200px; font-size: 11px; font-weight: 800; color: #047857; background: #ECFDF5; padding: 2px 8px; border-radius: 4px; border: 1px solid #A7F3D0;">
    ② 全業務データの直接CRUD通信 (0.1〜0.3秒 爆速)
  </div>

  <!-- ========================================================
       3. Supabase (クラウドデータベース ＆ バックエンド)
       ======================================================== -->
  <div class="card card-supabase">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="24" height="24" viewBox="0 0 109 113" fill="none">
          <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9624 107.314L53.9738 55.5768H99.1026C106.597 55.5768 110.745 64.1956 106.012 70.157L63.7076 110.284Z" fill="#3ECF8E"/>
          <path d="M45.297 2.71607C48.1565 -0.884784 53.9544 1.08779 54.0422 5.68607L54.4093 57.4232H10.268C2.77333 57.4232 -1.37464 48.8044 3.35808 42.843L45.297 2.71607Z" fill="#3ECF8E"/>
        </svg>
        <span style="font-size: 18px; font-weight: 800; color: #111827;">supabase</span>
        <span class="badge badge-sub">クラウドデータベース</span>
      </div>
      <span style="font-size: 10px; color: #64748B; font-weight: 700;">東京リージョン (ap-northeast-1)</span>
    </div>

    <!-- Supabase 内部3要素 -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; height: 160px;">
      <!-- 認証 -->
      <div class="item-box" style="flex-direction: column; justify-content: center; text-align: center;">
        <div class="icon-square" style="background: #ECFDF5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="3" stroke="#10B981" stroke-width="2"/>
            <path d="M8 11 V7 C8 4.79 9.79 3 12 3 C14.21 3 16 4.79 16 7 V11" stroke="#10B981" stroke-width="2"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #111827;">認証 (Auth)</div>
        <div style="font-size: 9.5px; color: #64748B; margin-top: 2px;">パスワード認証<br>JWTセッション管理</div>
      </div>

      <!-- データベース -->
      <div class="item-box" style="flex-direction: column; justify-content: center; text-align: center; border: 1.5px solid #10B981;">
        <div class="icon-square" style="background: #ECFDF5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#10B981" stroke-width="2"/>
            <path d="M4 6 V12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12 V6" stroke="#10B981" stroke-width="2"/>
            <path d="M4 12 V18 C4 19.66 7.58 21 12 21 C16.42 21 20 19.66 20 18 V12" stroke="#10B981" stroke-width="2"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #111827;">データベース</div>
        <div style="font-size: 9.5px; color: #047857; margin-top: 2px; font-weight: 700;">PostgreSQL 17</div>
        <div style="font-size: 9px; color: #64748B;">出欠/試合/掲示板/名簿/備品</div>
      </div>

      <!-- ストレージ -->
      <div class="item-box" style="flex-direction: column; justify-content: center; text-align: center;">
        <div class="icon-square" style="background: #ECFDF5;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 L14 2 Z" stroke="#10B981" stroke-width="2"/>
            <circle cx="10" cy="14" r="2" fill="#10B981"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #111827;">ストレージ</div>
        <div style="font-size: 9.5px; color: #64748B; margin-top: 2px;">member-avatars<br>プロフィール写真 (CDN)</div>
      </div>
    </div>
  </div>

  <!-- 矢印③: Webアプリ ⇄ Google サービス (斜め右下矢印) -->
  <svg style="position: absolute; top: 320px; left: 540px; width: 170px; height: 120px;" viewBox="0 0 170 120" fill="none">
    <path d="M 10 10 C 60 40 90 70 140 100" stroke="#2563EB" stroke-width="2.5"/>
    <path d="M 12 25 L 8 8 L 25 10" fill="#2563EB"/>
    <path d="M 125 100 L 142 102 L 138 85" fill="#2563EB"/>
  </svg>
  <div style="position: absolute; top: 355px; left: 630px; font-size: 11px; font-weight: 800; color: #1D4ED8; background: #EFF6FF; padding: 3px 8px; border-radius: 4px; border: 1px solid #BFDBFE;">
    ③ 予定同期・Google OAuth連携 (特権代行)
  </div>

  <!-- ========================================================
       4. Google サービス (カレンダー ＆ GAS特権代行)
       ======================================================== -->
  <div class="card card-google">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span style="font-size: 17px; font-weight: 800; color: #111827;">Google サービス</span>
        <span class="badge badge-g">特権代行 ＆ カレンダー</span>
      </div>
    </div>

    <!-- Google 内部2要素 -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; height: 160px;">
      <!-- Google Apps Script -->
      <div class="item-box" style="flex-direction: column; justify-content: center; text-align: center;">
        <div class="icon-square" style="background: #EFF6FF;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="6" fill="#2563EB"/>
            <path d="M8 12 L10 10 M8 12 L10 14" stroke="#FFFFFF" stroke-width="1.8"/>
            <path d="M16 12 L14 10 M16 12 L14 14" stroke="#FFFFFF" stroke-width="1.8"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #111827;">Google Apps Script</div>
        <div style="font-size: 9.5px; color: #2563EB; font-weight: 700; margin-top: 2px;">特権代行 サーバーレスAPI</div>
        <div style="font-size: 9px; color: #64748B;">カレンダー仲介 / OAuth交換 / LINE通知送信</div>
      </div>

      <!-- Google カレンダー -->
      <div class="item-box" style="flex-direction: column; justify-content: center; text-align: center;">
        <div class="icon-square" style="background: #EFF6FF;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="3" fill="#FFFFFF" stroke="#EA4335" stroke-width="2"/>
            <rect x="3" y="5" width="18" height="5" rx="2" fill="#EA4335"/>
            <circle cx="8" cy="14" r="1.5" fill="#3B82F6"/>
            <circle cx="12" cy="14" r="1.5" fill="#3B82F6"/>
            <circle cx="16" cy="14" r="1.5" fill="#10B981"/>
          </svg>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #111827;">Google カレンダー</div>
        <div style="font-size: 9.5px; color: #EA4335; font-weight: 700; margin-top: 2px;">チーム公式予定の原本</div>
        <div style="font-size: 9px; color: #64748B;">練習・試合日程 / 出席者同期</div>
      </div>
    </div>
  </div>

  <!-- 矢印④-A: GAS ➔ LINE配信 (横矢印) -->
  <svg style="position: absolute; top: 250px; left: 1020px; width: 40px; height: 30px;" viewBox="0 0 40 30" fill="none">
    <path d="M 0 15 H 32" stroke="#06C755" stroke-width="2.5"/>
    <path d="M 24 8 L 34 15 L 24 22" fill="#06C755"/>
  </svg>

  <!-- ========================================================
       5. LINE 通知配信 (Messaging API)
       ======================================================== -->
  <div class="card card-line">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="8" fill="#06C755"/>
        <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
      </svg>
      <div style="font-size: 15px; font-weight: 800; color: #06C755;">LINE Messaging API</div>
      <span class="badge badge-line">公式アカウント通知</span>
    </div>

    <div style="font-size: 10.5px; color: #374151; line-height: 1.5; background: #FFFFFF; padding: 10px; border-radius: 8px; border: 1px solid #BBF7D0; width: 100%;">
      ・GASのトリガーから自動発信<br>
      ・雨天中止などの緊急一斉通知<br>
      ・前日未回答者への出欠リマインド
    </div>

    <div style="font-size: 10px; font-weight: 800; color: #15803D;">部員のスマホへ自動プッシュ ➔</div>
  </div>

  <!-- 矢印④-B: LINE ➔ スマホ内のLINEアプリ (上向き・左向きループ矢印) -->
  <svg style="position: absolute; top: 110px; left: 450px; width: 620px; height: 100px;" viewBox="0 0 620 100" fill="none">
    <path d="M 610 80 V 30 C 610 15 590 15 570 15 H 40 C 20 15 15 25 15 40" stroke="#06C755" stroke-width="2.5" stroke-dasharray="5 3"/>
    <path d="M 9 32 L 15 42 L 21 32" fill="#06C755"/>
  </svg>
  <div style="position: absolute; top: 88px; left: 680px; font-size: 11px; font-weight: 800; color: #15803D; background: #DCFCE7; padding: 3px 10px; border-radius: 4px; border: 1px solid #86EFAC;">
    ④ LINE通知: 部員のスマートフォン（LINEアプリ）へ自動プッシュ着信！
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
