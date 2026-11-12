# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
Playwright で各要素の実際のレイアウト座標を取得し、
SVG矢印とラベルをピクセル完全（Pixel Perfect）に自動配置して、
一切の交差・ズレ・重なりのない最高品質の相関図画像を生成する。
"""
import os
import json
from playwright.sync_api import sync_playwright

BASE_HTML = """<!DOCTYPE html>
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
    height: 760px;
  }

  /* ヘッダー */
  .header-group {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 16px;
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

  /* キャンバス */
  .canvas {
    position: relative;
    width: 100%;
    height: 670px;
  }

  /* 共通カード */
  .card {
    background: #FFFFFF;
    border-radius: 16px;
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
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
  }
  .icon-box {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
  }
</style>
</head>
<body>

<div class="header-group">
  <div class="title">アーキテクチャ ＆ システム相関図</div>
  <div class="sub-title">FC Benten チーム管理システム（クライアント・Supabase・Google・LINEの役割と通信フロー）</div>
</div>

<div class="canvas" id="canvas">

  <!-- ========================================================
       左カラム: 部員・役員の利用環境 (スマートフォン / PC)
       ======================================================== -->
  <div class="card" id="client-card" style="top: 0; left: 30px; width: 380px; height: 670px; padding: 16px 18px; border: 2px solid #CBD5E1; background: #F8FAFC; display: flex; flex-direction: column; justify-content: space-between;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 8px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 16px;">📱</span>
        <span style="font-size: 15px; font-weight: 800; color: #0F172A;">部員・役員の端末 (スマホ / PC)</span>
      </div>
      <span class="badge" style="background: #475569; color: #FFFFFF;">クライアント環境</span>
    </div>

    <!-- 1. 配信元: GitHub Pages -->
    <div id="github-card" style="background: #0F172A; border-radius: 10px; padding: 12px 14px; color: #FFFFFF; display: flex; align-items: center; gap: 12px;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017C2 16.446 4.87 20.198 8.84 21.52C9.34 21.61 9.52 21.3 9.52 21.03C9.52 20.79 9.51 20.01 9.51 19.17C6.73 19.77 6.14 18.6 5.92 18.01C5.8 17.7 5.29 16.77 4.84 16.52C4.47 16.32 3.94 15.83 4.83 15.82C5.66 15.81 6.26 16.58 6.46 16.9C7.4 18.52 8.93 18.07 9.54 17.79C9.63 17.11 9.9 16.65 10.2 16.39C7.97 16.14 5.64 15.28 5.64 11.45C5.64 10.36 6.03 9.46 6.67 8.76C6.57 8.51 6.22 7.48 6.77 6.1C6.77 6.1 7.61 5.84 9.52 7.13C10.32 6.91 11.17 6.8 12.02 6.8C12.87 6.8 13.72 6.91 14.52 7.13C16.43 5.83 17.27 6.1 17.27 6.1C17.82 7.48 17.47 8.51 17.37 8.76C18.01 9.46 18.4 10.35 18.4 11.45C18.4 15.29 16.06 16.14 13.83 16.39C14.2 16.71 14.52 17.32 14.52 18.28C14.52 19.65 14.51 20.76 14.51 21.03C14.51 21.3 14.69 21.62 15.2 21.52C19.16 20.19 22.03 16.44 22.03 12.017C22.03 6.484 17.553 2 12 2Z" fill="#FFFFFF"/>
      </svg>
      <div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 14px; font-weight: 800;">GitHub Pages</span>
          <span class="badge" style="background: #334155; color: #94A3B8; font-size: 9px;">Webホスティング</span>
        </div>
        <div style="font-size: 10px; color: #38BDF8; font-weight: 700; margin-top: 1px;">fcbenten.github.io/team-management</div>
        <div style="font-size: 9px; color: #94A3B8;">HTML / CSS / JS (PWAバンドル配信元)</div>
      </div>
    </div>

    <!-- 2. Webアプリ (PWA) -->
    <div id="pwa-card" style="background: #FFFFFF; border: 2.5px solid #0284C7; border-radius: 12px; padding: 14px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.08);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="icon-box" style="background: #E0F2FE; margin-bottom: 0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#0284C7"/>
              <path d="M6 12 L12 6 L18 12 M8 10.5 V17 H16 V10.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <div style="font-size: 15px; font-weight: 800; color: #0284C7;">Webアプリ (PWA)</div>
            <div style="font-size: 10px; color: #64748B;">Vanilla JS (SPA) / ブラウザ実行</div>
          </div>
        </div>
        <span class="badge" style="background: #E0F2FE; color: #0284C7;">クライアント本体</span>
      </div>
      <div style="font-size: 10px; color: #334155; line-height: 1.55; background: #F0F9FF; padding: 10px 12px; border-radius: 8px; border: 1px solid #BAE6FD;">
        ・ホーム画面から0秒で即起動（キャッシュ動作）<br>
        ・出欠回答、スコア入力、掲示板閲覧、名簿管理<br>
        ・ブラウザ上から各クラウドへ直接セキュア通信
      </div>
    </div>

    <!-- 3. LINE アプリ -->
    <div id="line-app-card" style="background: #FFFFFF; border: 2.5px solid #06C755; border-radius: 12px; padding: 14px; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.08);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="icon-box" style="background: #DCFCE7; margin-bottom: 0;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="#06C755"/>
              <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
            </svg>
          </div>
          <div>
            <div style="font-size: 15px; font-weight: 800; color: #06C755;">LINE アプリ</div>
            <div style="font-size: 10px; color: #64748B;">部員個人のスマホアプリ</div>
          </div>
        </div>
        <span class="badge" style="background: #DCFCE7; color: #15803D;">通知受信</span>
      </div>
      <div style="font-size: 10px; color: #334155; line-height: 1.55; background: #F0FDF4; padding: 10px 12px; border-radius: 8px; border: 1px solid #BBF7D0;">
        ・<b>雨天中止などの緊急連絡</b>をプッシュ通知で受信<br>
        ・<b>前日未回答者への出欠リマインド</b>を自動受信<br>
        ・トーク画面からWebアプリへワンタップでアクセス
      </div>
    </div>
  </div>


  <!-- ========================================================
       右側上段: Supabase (クラウドデータベース)
       ======================================================== -->
  <div class="card" id="supabase-card" style="top: 0; left: 530px; width: 770px; height: 285px; padding: 14px 18px; border: 2px solid #10B981;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="24" height="24" viewBox="0 0 109 113" fill="none">
          <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9624 107.314L53.9738 55.5768H99.1026C106.597 55.5768 110.745 64.1956 106.012 70.157L63.7076 110.284Z" fill="#3ECF8E"/>
          <path d="M45.297 2.71607C48.1565 -0.884784 53.9544 1.08779 54.0422 5.68607L54.4093 57.4232H10.268C2.77333 57.4232 -1.37464 48.8044 3.35808 42.843L45.297 2.71607Z" fill="#3ECF8E"/>
        </svg>
        <span style="font-size: 18px; font-weight: 800; color: #111827;">supabase</span>
        <span class="badge" style="background: #10B981; color: #FFFFFF;">クラウドデータベース (BaaS)</span>
      </div>
      <span style="font-size: 11px; color: #64748B; font-weight: 700;">東京リージョン (ap-northeast-1)</span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; height: 215px;">
      <!-- 1. 認証 -->
      <div class="sub-item" id="sub-auth" style="border: 1.5px solid #D1FAE5; background: #F0FDF4; justify-content: space-between;">
        <div>
          <div class="icon-box" style="background: #ECFDF5;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="3" stroke="#10B981" stroke-width="2"/>
              <path d="M8 11 V7 C8 4.79 9.79 3 12 3 C14.21 3 16 4.79 16 7 V11" stroke="#10B981" stroke-width="2"/>
            </svg>
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #065F46;">認証 (Auth)</div>
          <div style="font-size: 10.5px; color: #047857; margin-top: 3px; font-weight: 700;">パスワード認証・JWT</div>
        </div>
        <div style="font-size: 9.5px; color: #374151; line-height: 1.45; background: #FFFFFF; padding: 8px; border-radius: 6px; border: 1px solid #D1FAE5;">
          ・役員/部員の安全なログイン<br>
          ・ブラウザにJWT自動保持<br>
          ・行単位セキュリティ(RLS)適用
        </div>
      </div>

      <!-- 2. データベース -->
      <div class="sub-item" id="sub-db" style="border: 2px solid #10B981; background: #ECFDF5; justify-content: space-between; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.1);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="icon-box" style="background: #D1FAE5;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#047857" stroke-width="2"/>
                <path d="M4 6 V12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12 V6" stroke="#047857" stroke-width="2"/>
                <path d="M4 12 V18 C4 19.66 7.58 21 12 21 C16.42 21 20 19.66 20 18 V12" stroke="#047857" stroke-width="2"/>
              </svg>
            </div>
            <span class="badge" style="background: #10B981; color: #FFFFFF; font-size: 9px;">0.1〜0.3s 高速CRUD</span>
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #065F46;">データベース</div>
          <div style="font-size: 10.5px; color: #047857; margin-top: 2px; font-weight: 800;">PostgreSQL 17 (PostgREST)</div>
        </div>
        <div style="font-size: 9.5px; color: #374151; line-height: 1.45; background: #FFFFFF; padding: 8px; border-radius: 6px; border: 1px solid #A7F3D0;">
          ・出欠回答 / 試合結果・スコア<br>
          ・掲示板コメント / 部員名簿 / 備品<br>
          ・Webアプリから直接超高速読み書き
        </div>
      </div>

      <!-- 3. ストレージ -->
      <div class="sub-item" id="sub-storage" style="border: 1.5px solid #D1FAE5; background: #F0FDF4; justify-content: space-between;">
        <div>
          <div class="icon-box" style="background: #ECFDF5;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 L14 2 Z" stroke="#10B981" stroke-width="2"/>
              <circle cx="10" cy="14" r="2" fill="#10B981"/>
            </svg>
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #065F46;">ストレージ</div>
          <div style="font-size: 10.5px; color: #047857; margin-top: 3px; font-weight: 700;">member-avatars (CDN)</div>
        </div>
        <div style="font-size: 9.5px; color: #374151; line-height: 1.45; background: #FFFFFF; padding: 8px; border-radius: 6px; border: 1px solid #D1FAE5;">
          ・部員プロフィール顔写真<br>
          ・画像ファイルの安全な保管<br>
          ・グローバルCDNによる高速画像配信
        </div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       右側中段: Google サービス (特権代行 ＆ カレンダー原本)
       ======================================================== -->
  <div class="card" id="google-card" style="top: 305px; left: 530px; width: 770px; height: 175px; padding: 12px 18px; border: 2px solid #3B82F6;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span style="font-size: 16px; font-weight: 800; color: #111827;">Google サービス</span>
      </div>
      <span class="badge" style="background: #2563EB; color: #FFFFFF;">特権代行 ＆ 予定管理</span>
    </div>

    <div style="display: flex; gap: 14px; height: 118px;">
      <!-- Google Apps Script -->
      <div class="sub-item" id="gas-sub" style="flex: 1.15; border: 1.5px solid #93C5FD; background: #EFF6FF; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="icon-box" style="background: #DBEAFE; margin-bottom: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="6" fill="#2563EB"/>
              <path d="M8 12 L10 10 M8 12 L10 14" stroke="#FFFFFF" stroke-width="1.8"/>
              <path d="M16 12 L14 10 M16 12 L14 14" stroke="#FFFFFF" stroke-width="1.8"/>
            </svg>
          </div>
          <div>
            <div style="font-size: 13.5px; font-weight: 800; color: #1E40AF;">Google Apps Script (GAS)</div>
            <div style="font-size: 10px; color: #2563EB; font-weight: 700;">特権代行 API / 定期トリガー</div>
          </div>
        </div>
        <div style="font-size: 9.5px; color: #374151; line-height: 1.45; background: #FFFFFF; padding: 7px 10px; border-radius: 6px; border: 1px solid #BFDBFE;">
          ・部員がGoogle未ログインでもカレンダー同期（特権代行）<br>
          ・定期トリガーで前日リマインドや雨天判定を自動実行
        </div>
      </div>

      <!-- Google カレンダー -->
      <div class="sub-item" id="gcal-sub" style="flex: 0.85; border: 1.5px solid #FCA5A5; background: #FEF2F2; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="icon-box" style="background: #FEE2E2; margin-bottom: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="3" fill="#FFFFFF" stroke="#EA4335" stroke-width="2"/>
              <rect x="3" y="5" width="18" height="5" rx="2" fill="#EA4335"/>
              <circle cx="8" cy="14" r="1.5" fill="#3B82F6"/>
              <circle cx="12" cy="14" r="1.5" fill="#3B82F6"/>
              <circle cx="16" cy="14" r="1.5" fill="#10B981"/>
            </svg>
          </div>
          <div>
            <div style="font-size: 13.5px; font-weight: 800; color: #991B1B;">Google カレンダー</div>
            <div style="font-size: 10px; color: #DC2626; font-weight: 700;">公式予定の原本データ</div>
          </div>
        </div>
        <div style="font-size: 9.5px; color: #374151; line-height: 1.45; background: #FFFFFF; padding: 7px 10px; border-radius: 6px; border: 1px solid #FECACA;">
          ・練習・公式戦・遠征のマスター予定<br>
          ・出欠回答ステータスを予定詳細に自動反映
        </div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       右側下段: LINE Messaging API (公式アカウント通知基盤)
       ======================================================== -->
  <div class="card" id="line-api-card" style="top: 500px; left: 530px; width: 770px; height: 170px; padding: 12px 18px; border: 2px solid #06C755; background: #F0FDF4;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #BBF7D0; padding-bottom: 4px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#06C755"/>
          <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
        </svg>
        <span style="font-size: 16px; font-weight: 800; color: #065F46;">LINE Messaging API</span>
        <span class="badge" style="background: #06C755; color: #FFFFFF;">公式アカウント通知基盤</span>
      </div>
      <span style="font-size: 11px; color: #15803D; font-weight: 700;">LINE公式アカウント</span>
    </div>

    <div style="display: flex; gap: 14px; height: 112px; align-items: center;">
      <!-- 説明カード -->
      <div style="flex: 1.25; background: #FFFFFF; border-radius: 10px; padding: 10px 14px; border: 1px solid #BBF7D0; height: 100%; display: flex; flex-direction: column; justify-content: center;">
        <div style="font-size: 12px; font-weight: 800; color: #065F46; margin-bottom: 4px;">【自動配信される通知トリガー】</div>
        <div style="font-size: 10px; color: #374151; line-height: 1.55;">
          ・<b>雨天中止連絡</b>：役員の判断により全登録部員へ即時一斉プッシュ<br>
          ・<b>前日出欠リマインド</b>：18:00時点で未回答の部員へ自動リマインド通知<br>
          ・<b>重要アナウンス</b>：掲示板の緊急お知らせを部員全員へ配信
        </div>
      </div>

      <!-- 送信先バッジ -->
      <div style="flex: 0.75; background: #DCFCE7; border-radius: 10px; padding: 12px; border: 1.5px solid #86EFAC; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
        <div style="font-size: 12.5px; font-weight: 800; color: #15803D; margin-bottom: 4px;">部員のスマホへ自動プッシュ！</div>
        <div style="font-size: 10px; color: #166534; line-height: 1.45;">
          GASからAPI経由で発信され、<br>部員の「LINEアプリ」へ直接届きます ➔
        </div>
      </div>
    </div>
  </div>

</div>

</body>
</html>
"""

INJECT_SCRIPT_TEMPLATE = """
(() => {
    const c = __COORDS__;
    const canvas = document.getElementById('canvas');

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("style", "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;");

    svg.innerHTML = `
    <defs>
      <marker id="arr-pwa" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 7 4 L 0 7 Z" fill="#0284C7"/>
      </marker>
      <marker id="arr-supabase" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 7 4 L 0 7 Z" fill="#10B981"/>
      </marker>
      <marker id="arr-supabase-rev" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
        <path d="M 7 1 L 0 4 L 7 7 Z" fill="#10B981"/>
      </marker>
      <marker id="arr-google" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 7 4 L 0 7 Z" fill="#2563EB"/>
      </marker>
      <marker id="arr-google-rev" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
        <path d="M 7 1 L 0 4 L 7 7 Z" fill="#2563EB"/>
      </marker>
      <marker id="arr-line" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 1 L 7 4 L 0 7 Z" fill="#06C755"/>
      </marker>
    </defs>
    `;

    // ① GitHub Pages -> Webアプリ (垂直下向き・点線)
    const p1 = document.createElementNS(svgNS, "path");
    p1.setAttribute("d", `M ${c.github.cx} ${c.github.bottom} V ${c.pwa.y - 4}`);
    p1.setAttribute("stroke", "#0284C7");
    p1.setAttribute("stroke-width", "2.5");
    p1.setAttribute("stroke-dasharray", "4 3");
    p1.setAttribute("marker-end", "url(#arr-pwa)");
    svg.appendChild(p1);

    // ②-A Webアプリ -> 認証 (Auth)
    const p2a = document.createElementNS(svgNS, "path");
    const y_pwa_top = c.pwa.y + 35;
    p2a.setAttribute("d", `M ${c.pwa.right} ${y_pwa_top} C ${c.pwa.right + 50} ${y_pwa_top}, ${c.supabase.x - 50} ${c.auth.cy}, ${c.supabase.x - 4} ${c.auth.cy}`);
    p2a.setAttribute("stroke", "#10B981");
    p2a.setAttribute("stroke-width", "2");
    p2a.setAttribute("fill", "none");
    p2a.setAttribute("marker-end", "url(#arr-supabase)");
    svg.appendChild(p2a);

    // ②-B Webアプリ <-> データベース (PostgreSQL 17) (水平・双方向太線)
    const p2b = document.createElementNS(svgNS, "path");
    const y_db = c.db.cy;
    p2b.setAttribute("d", `M ${c.pwa.right + 4} ${y_db} H ${c.supabase.x - 4}`);
    p2b.setAttribute("stroke", "#10B981");
    p2b.setAttribute("stroke-width", "3.2");
    p2b.setAttribute("fill", "none");
    p2b.setAttribute("marker-start", "url(#arr-supabase-rev)");
    p2b.setAttribute("marker-end", "url(#arr-supabase)");
    svg.appendChild(p2b);

    // ②-C Webアプリ -> ストレージ (Storage)
    const p2c = document.createElementNS(svgNS, "path");
    const y_pwa_bot = c.pwa.bottom - 35;
    p2c.setAttribute("d", `M ${c.pwa.right} ${y_pwa_bot} C ${c.pwa.right + 50} ${y_pwa_bot}, ${c.supabase.x - 50} ${c.storage.cy}, ${c.supabase.x - 4} ${c.storage.cy}`);
    p2c.setAttribute("stroke", "#10B981");
    p2c.setAttribute("stroke-width", "2");
    p2c.setAttribute("fill", "none");
    p2c.setAttribute("marker-end", "url(#arr-supabase)");
    svg.appendChild(p2c);

    // ③ Webアプリ <-> Google Apps Script (双方向)
    const p3 = document.createElementNS(svgNS, "path");
    p3.setAttribute("d", `M ${c.pwa.right + 4} ${c.gas.cy} H ${c.google.x - 4}`);
    p3.setAttribute("stroke", "#2563EB");
    p3.setAttribute("stroke-width", "2.5");
    p3.setAttribute("fill", "none");
    p3.setAttribute("marker-start", "url(#arr-google-rev)");
    p3.setAttribute("marker-end", "url(#arr-google)");
    svg.appendChild(p3);

    // 原本同期 GAS -> Google カレンダー
    const p_gcal = document.createElementNS(svgNS, "path");
    p_gcal.setAttribute("d", `M ${c.gas.right + 4} ${c.gas.cy} H ${c.gcal.x - 4}`);
    p_gcal.setAttribute("stroke", "#2563EB");
    p_gcal.setAttribute("stroke-width", "2.2");
    p_gcal.setAttribute("fill", "none");
    p_gcal.setAttribute("marker-end", "url(#arr-google)");
    svg.appendChild(p_gcal);

    // ④ Google Apps Script -> LINE Messaging API (垂直下向き)
    const p4 = document.createElementNS(svgNS, "path");
    const x_gas_mid = c.gas.x + 140;
    p4.setAttribute("d", `M ${x_gas_mid} ${c.google.bottom} V ${c.lineApi.y - 4}`);
    p4.setAttribute("stroke", "#06C755");
    p4.setAttribute("stroke-width", "2.5");
    p4.setAttribute("fill", "none");
    p4.setAttribute("marker-end", "url(#arr-line)");
    svg.appendChild(p4);

    // ⑤ LINE Messaging API -> LINE アプリ (まっすぐ水平左・部員のスマホへ！)
    const p5 = document.createElementNS(svgNS, "path");
    p5.setAttribute("d", `M ${c.lineApi.x} ${c.lineApp.cy} H ${c.lineApp.right + 6}`);
    p5.setAttribute("stroke", "#06C755");
    p5.setAttribute("stroke-width", "3.5");
    p5.setAttribute("fill", "none");
    p5.setAttribute("marker-end", "url(#arr-line)");
    svg.appendChild(p5);

    canvas.appendChild(svg);

    const addLabel = (text, top, left, bg, color, border, extraStyle="") => {
        const div = document.createElement("div");
        div.className = "arrow-label";
        div.style = `position: absolute; top: ${top}px; left: ${left}px; background: ${bg}; color: ${color}; border: ${border}; z-index: 10; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.06); ${extraStyle}`;
        div.innerText = text;
        canvas.appendChild(div);
    };

    // ① ラベル
    addLabel("① PWA配信・インストール", (c.github.bottom + c.pwa.y) / 2 - 12, c.github.cx + 10, "#E0F2FE", "#0369A1", "1px solid #BAE6FD");

    // ②-A ラベル
    addLabel("② 認証", c.auth.cy - 12, (c.pwa.right + c.supabase.x) / 2 - 25, "#ECFDF5", "#047857", "1px solid #A7F3D0", "font-size: 10px;");

    // ②-B ラベル
    addLabel("② DB直接CRUD (0.1〜0.3s)", c.db.cy - 24, (c.pwa.right + c.supabase.x) / 2 - 80, "#ECFDF5", "#047857", "1.5px solid #10B981", "font-weight: 900;");

    // ②-C ラベル
    addLabel("② 写真保存", c.storage.cy - 12, (c.pwa.right + c.supabase.x) / 2 - 30, "#ECFDF5", "#047857", "1px solid #A7F3D0", "font-size: 10px;");

    // ③ ラベル
    addLabel("③ 予定同期・OAuth連携", c.gas.cy - 24, (c.pwa.right + c.google.x) / 2 - 75, "#EFF6FF", "#1D4ED8", "1.5px solid #3B82F6");

    // 原本同期ラベル
    addLabel("原本同期", c.gas.cy - 20, (c.gas.right + c.gcal.x) / 2 - 24, "#EFF6FF", "#1D4ED8", "1px solid #BFDBFE", "font-size: 9.5px;");

    // ④ ラベル
    addLabel("④ 通知リクエスト", (c.google.bottom + c.lineApi.y) / 2 - 12, x_gas_mid + 8, "#F0FDF4", "#15803D", "1px solid #86EFAC", "font-size: 10px;");

    // ⑤ ラベル
    addLabel("⑤ LINEプッシュ通知着信！ (雨天中止・リマインド)", c.lineApp.cy - 26, (c.lineApp.right + c.lineApi.x) / 2 - 140, "#DCFCE7", "#15803D", "2px solid #22C55E", "font-size: 11.5px; font-weight: 900;");
})();
"""

def generate_diagram_image():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    docs_dir = os.path.join(base_dir, "docs")
    os.makedirs(docs_dir, exist_ok=True)

    html_path = os.path.join(docs_dir, "flow_diagram_fitted.html")
    png_path = os.path.join(docs_dir, "flow_diagram_fitted.png")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(BASE_HTML)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1360, "height": 760})
            page.goto(f"file:///{html_path.replace(os.sep, '/')}")
            page.wait_for_timeout(300)

            coords = page.evaluate("""() => {
                const canvas = document.getElementById('canvas').getBoundingClientRect();
                const getRel = (id) => {
                    const r = document.getElementById(id).getBoundingClientRect();
                    return {
                        x: r.left - canvas.left,
                        y: r.top - canvas.top,
                        w: r.width,
                        h: r.height,
                        right: r.right - canvas.left,
                        bottom: r.bottom - canvas.top,
                        cx: r.left - canvas.left + r.width / 2,
                        cy: r.top - canvas.top + r.height / 2
                    };
                };
                return {
                    github: getRel('github-card'),
                    pwa: getRel('pwa-card'),
                    lineApp: getRel('line-app-card'),
                    supabase: getRel('supabase-card'),
                    auth: getRel('sub-auth'),
                    db: getRel('sub-db'),
                    storage: getRel('sub-storage'),
                    google: getRel('google-card'),
                    gas: getRel('gas-sub'),
                    gcal: getRel('gcal-sub'),
                    lineApi: getRel('line-api-card')
                };
            }""")

            inject_script = INJECT_SCRIPT_TEMPLATE.replace("__COORDS__", json.dumps(coords))
            page.evaluate(inject_script)
            page.wait_for_timeout(200)
            page.screenshot(path=png_path, full_page=True)
            browser.close()
    finally:
        if os.path.exists(html_path):
            os.remove(html_path)

    print(f"Diagram image generated: {png_path}")
    return png_path

if __name__ == "__main__":
    generate_diagram_image()
