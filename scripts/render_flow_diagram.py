# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
Playwrightを用いて、ユーザー指定の構成図スタイル（実機イラスト、コンテナ境界、ビジネスロジックカード、
赤い通信矢印、下部スペック表）に準拠した高精細システム構成図・相関図（PNG画像）を生成するスクリプト。
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
    background: #E2E8F0;
    color: #1E293B;
    padding: 24px;
    width: 1400px;
    height: 980px;
  }

  /* 最外枠キャンバス */
  .canvas {
    background: #EDF2F7;
    border: 2px solid #CBD5E1;
    border-radius: 12px;
    padding: 20px 24px 16px 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  }

  /* タイトルヘッダー */
  .diagram-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #94A3B8;
    padding-bottom: 10px;
    margin-bottom: 16px;
  }
  .title-group h1 {
    font-size: 24px;
    font-weight: 900;
    color: #0F172A;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .title-group p {
    font-size: 12px;
    color: #475569;
    margin-top: 3px;
    font-weight: 600;
  }
  .version-badge {
    background: #0284C7;
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 6px;
  }

  /* メインエリア: 上段の各ゾーン */
  .zones-container {
    display: grid;
    grid-template-columns: 320px 1fr 340px;
    gap: 18px;
    height: 640px;
    position: relative;
  }

  /* グループコンテナ共通（タブ付きフォルダ風ボックス） */
  .group-box {
    border-radius: 8px;
    position: relative;
    padding: 16px;
    box-shadow: 2px 3px 8px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
  }
  .box-tab {
    position: absolute;
    top: -14px;
    left: 16px;
    padding: 3px 14px;
    font-size: 13px;
    font-weight: 900;
    border-radius: 6px 6px 0 0;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.03em;
  }
  .box-subtitle {
    font-size: 11px;
    font-weight: 700;
    color: #64748B;
    margin-top: -2px;
    margin-bottom: 12px;
  }

  /* 1. Client 側 (Light Green) */
  .box-client {
    background: #F0FDF4;
    border: 2px solid #22C55E;
  }
  .box-client .box-tab {
    background: #22C55E;
    color: #FFFFFF;
  }

  /* 2. Web Hosting 側 (Light Cyan) */
  .box-hosting {
    background: #F0F9FF;
    border: 2px solid #0EA5E9;
  }
  .box-hosting .box-tab {
    background: #0EA5E9;
    color: #FFFFFF;
  }

  /* 3. BaaS / Database 側 (Light Yellow / Amber) */
  .box-server {
    background: #FFFDF0;
    border: 2px solid #F59E0B;
  }
  .box-server .box-tab {
    background: #F59E0B;
    color: #FFFFFF;
  }

  /* 4. 特権代行 ＆ 外部連携 側 (Light Purple / Indigo) */
  .box-external {
    background: #FAF5FF;
    border: 2px solid #A855F7;
  }
  .box-external .box-tab {
    background: #A855F7;
    color: #FFFFFF;
  }

  /* 3Dカード（ビジネスロジック・機能ブロック風） */
  .logic-card {
    background: linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%);
    border: 1px solid #CBD5E1;
    border-radius: 6px;
    padding: 7px 10px;
    margin-bottom: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    font-size: 11.5px;
    font-weight: 700;
    color: #0F172A;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .logic-card-code {
    font-size: 9.5px;
    color: #64748B;
    font-family: monospace;
    font-weight: normal;
  }

  /* 通信矢印（太い赤矢印線 ＆ 赤文字バッジ） */
  .comm-arrow-badge {
    background: #DC2626;
    color: #FFFFFF;
    font-size: 10.5px;
    font-weight: 900;
    padding: 4px 10px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
  }
  .comm-arrow-label {
    font-size: 11px;
    font-weight: 800;
    color: #991B1B;
    background: #FEE2E2;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid #FCA5A5;
  }

  /* イラストコンテナ */
  .illustration-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .device-caption {
    font-size: 11px;
    font-weight: 800;
    color: #1E293B;
    margin-top: 4px;
  }
  .device-sub {
    font-size: 9.5px;
    color: #64748B;
  }

  /* 下部スペック表（ユーザー画像の下部赤見出しスタイルに完全準拠） */
  .specs-footer {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
    border-top: 2px solid #CBD5E1;
    padding-top: 14px;
    margin-top: 8px;
  }
  .spec-col {
    display: flex;
    flex-direction: column;
  }
  .spec-header {
    color: #B91C1C;
    font-size: 12.5px;
    font-weight: 900;
    border-bottom: 2px solid #DC2626;
    padding-bottom: 4px;
    margin-bottom: 6px;
    letter-spacing: 0.02em;
  }
  .spec-content {
    font-size: 10.5px;
    color: #334155;
    line-height: 1.45;
  }
  .spec-content b {
    color: #0F172A;
  }
</style>
</head>
<body>

<div class="canvas">

  <!-- ヘッダー -->
  <div class="diagram-header">
    <div class="title-group">
      <h1>FC BENTEN チーム管理システム システム構成・通信相関図</h1>
      <p>ユーザー端末 (PWA) ＋ GitHub Pages (CDN) ＋ Supabase (PostgreSQL 17 Tokyo) ＋ Google Apps Script 特権代行</p>
    </div>
    <div class="version-badge">System Architecture Ver 2.1.0</div>
  </div>

  <!-- メイン構成ゾーン (上段) -->
  <div class="zones-container">

    <!-- ========================================================
         1. Client 側 (ユーザー端末)
         ======================================================== -->
    <div class="group-box box-client">
      <div class="box-tab">📱 Client 側</div>
      <div class="box-subtitle">ユーザー端末 (スマートフォン / タブレット / PC)</div>

      <!-- デバイスイラスト (PC + スマートフォン) -->
      <div class="illustration-center" style="margin: 6px 0 12px 0;">
        <svg width="180" height="95" viewBox="0 0 180 95" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- PC Monitor -->
          <rect x="25" y="5" width="85" height="55" rx="4" fill="#0F172A" stroke="#334155" stroke-width="2"/>
          <rect x="29" y="9" width="77" height="47" rx="2" fill="#38BDF8"/>
          <!-- Browser Mockup in Monitor -->
          <rect x="29" y="9" width="77" height="8" fill="#0284C7"/>
          <circle cx="34" cy="13" r="1.5" fill="#EF4444"/>
          <circle cx="39" cy="13" r="1.5" fill="#F59E0B"/>
          <circle cx="44" cy="13" r="1.5" fill="#10B981"/>
          <!-- App content lines -->
          <rect x="33" y="21" width="30" height="5" rx="1" fill="#FFFFFF"/>
          <rect x="33" y="29" width="69" height="18" rx="1" fill="#E0F2FE"/>
          <!-- Monitor Stand -->
          <path d="M60 60 L75 60 L78 72 L57 72 Z" fill="#64748B"/>
          <rect x="50" y="72" width="35" height="4" rx="1" fill="#475569"/>
          <!-- Keyboard -->
          <polygon points="35,80 100,80 105,87 30,87" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1"/>
          <!-- Smartphone (PWA) -->
          <rect x="120" y="16" width="36" height="68" rx="6" fill="#0F172A" stroke="#475569" stroke-width="2"/>
          <rect x="123" y="22" width="30" height="52" rx="2" fill="#0284C7"/>
          <!-- Phone screen app content -->
          <rect x="125" y="26" width="26" height="6" rx="1" fill="#38BDF8"/>
          <rect x="125" y="35" width="26" height="12" rx="1" fill="#E0F2FE"/>
          <rect x="125" y="50" width="12" height="10" rx="1" fill="#34D399"/>
          <rect x="139" y="50" width="12" height="10" rx="1" fill="#FBBF24"/>
          <circle cx="138" cy="19" r="1.2" fill="#94A3B8"/>
          <circle cx="138" cy="79" r="2" fill="#64748B"/>
        </svg>
        <div class="device-caption">FC Benten PWA (Single Page App)</div>
        <div class="device-sub">iPhone (Safari) / Android (Chrome) / PC ブラウザ</div>
      </div>

      <!-- クライアント内部モジュール -->
      <div style="background: #FFFFFF; border-radius: 6px; padding: 10px; border: 1px solid #DCFCE7; margin-bottom: 8px;">
        <div style="font-size: 11px; font-weight: 800; color: #15803D; margin-bottom: 4px;">■ クライアント実行環境・機能</div>
        <div style="font-size: 10.5px; color: #374151; line-height: 1.5;">
          ・<b>HTML5 / CSS3 / Vanilla JS (ES6+)</b> SPA構造<br>
          ・<b>Service Worker (sw.js)</b> によるオフライン保護<br>
          ・<b>0秒楽観的UI更新</b> (出欠・掲示板・削除先行反映)<br>
          ・<b>LocalStorage</b> (Supabase JWT認証セッション保持)
        </div>
      </div>

      <!-- 画面チェック機能・帳票ブロック風 -->
      <div class="logic-card" style="border-left: 4px solid #10B981;">
        <span>ログイン・名簿照合認証</span>
        <span class="logic-card-code">SCR01 / SCR11</span>
      </div>
      <div class="logic-card" style="border-left: 4px solid #10B981;">
        <span>出欠ワンタップ回答 (○/×/△)</span>
        <span class="logic-card-code">SCR07 (0秒更新)</span>
      </div>
      <div class="logic-card" style="border-left: 4px solid #10B981;">
        <span>試合スコア・得点者入力</span>
        <span class="logic-card-code">SCR04 / SCR03</span>
      </div>
      <div class="logic-card" style="border-left: 4px solid #10B981;">
        <span>活動記録・チーム掲示板</span>
        <span class="logic-card-code">SCR09 (Wiki共同編集)</span>
      </div>
      <div class="logic-card" style="border-left: 4px solid #10B981;">
        <span>備品台帳・7日先不在アラート</span>
        <span class="logic-card-code">SCR08 (代理解決)</span>
      </div>
    </div>

    <!-- ========================================================
         2. 中央: Web Hosting ＆ BaaS / Database 側 (Supabase Tokyo)
         ======================================================== -->
    <div style="display: flex; flex-direction: column; gap: 14px;">

      <!-- 上段: GitHub Pages (Web Hosting) -->
      <div class="group-box box-hosting" style="flex: 0.38;">
        <div class="box-tab">🌐 Web Hosting 側</div>
        <div class="box-subtitle">GitHub Pages Global CDN (静的配信サーバー)</div>

        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <!-- Cloud Icon SVG -->
            <svg width="60" height="42" viewBox="0 0 60 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M46 36 H14 C7.37 36 2 30.63 2 24 C2 17.86 6.63 12.8 12.63 12.08 C14.37 5.17 20.61 0 28 0 C36.84 0 44 7.16 44 16 C44 16.68 43.96 17.35 43.88 18.01 C50.72 18.66 56 24.38 56 31.43 C56 38.37 50.37 44 43.43 44" fill="#0284C7" opacity="0.15"/>
              <path d="M44 32 H14 C8.48 32 4 27.52 4 22 C4 16.9 7.82 12.69 12.8 12.07 C14.33 5.92 19.86 1.33 26.4 1.33 C34.2 1.33 40.6 7.4 41 15.15 C46.7 15.7 51 20.5 51 26.33 C51 32.22 46.22 37 40.33 37" stroke="#0284C7" stroke-width="2.5" fill="#E0F2FE"/>
              <path d="M26 15 L26 27 M21 22 L26 27 L31 22" stroke="#0369A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div>
              <div style="font-size: 13px; font-weight: 800; color: #0369A1;">https://fcbenten.github.io/team-management/</div>
              <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">
                ・ホスティング配信ブランチ: <b>gh-pages</b> (ソースコード main と完全分離)<br>
                ・配信資産: <b>index.html</b> (860KB) / <b>sw.js</b> / <b>manifest.json</b> / アイコン画像
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <span class="comm-arrow-badge">HTTPS GET</span>
            <div style="font-size: 9.5px; color: #0284C7; font-weight: bold; margin-top: 3px;">応答速度: 約0.05〜0.1秒</div>
          </div>
        </div>
      </div>

      <!-- 下段: Supabase Cloud (Database & Storage) -->
      <div class="group-box box-server" style="flex: 1;">
        <div class="box-tab">🗄️ Database & BaaS 側 (Supabase Cloud)</div>
        <div class="box-subtitle">東京リージョン (ap-northeast-1) / PostgreSQL 17.11 ＋ PostgREST API ＋ Storage</div>

        <!-- サーバー内部構成 (グリッドレイアウト) -->
        <div style="display: grid; grid-template-columns: 190px 1fr 140px; gap: 14px; height: 100%;">

          <!-- 左列: ビジネスロジック / テーブル群 (ユーザー図の棚卸・入荷・出荷風) -->
          <div style="display: flex; flex-direction: column;">
            <div style="font-size: 11px; font-weight: 800; color: #B45309; margin-bottom: 6px;">■ 業務リレーショナルテーブル</div>
            <div class="logic-card" style="border-left: 4px solid #F59E0B;">
              <span>メンバー名簿</span><span class="logic-card-code">members</span>
            </div>
            <div class="logic-card" style="border-left: 4px solid #F59E0B;">
              <span>予定出欠管理</span><span class="logic-card-code">attendance</span>
            </div>
            <div class="logic-card" style="border-left: 4px solid #F59E0B;">
              <span>試合結果・戦績</span><span class="logic-card-code">matches</span>
            </div>
            <div class="logic-card" style="border-left: 4px solid #F59E0B;">
              <span>得点・警告ログ</span><span class="logic-card-code">score_logs</span>
            </div>
            <div class="logic-card" style="border-left: 4px solid #F59E0B;">
              <span>活動記録・掲示板</span><span class="logic-card-code">bulletin_posts</span>
            </div>
            <div class="logic-card" style="border-left: 4px solid #F59E0B;">
              <span>備品台帳・当番</span><span class="logic-card-code">equipment_*</span>
            </div>
          </div>

          <!-- 中央列: サーバー内部機能 (Framework / RLS / 通信暗号化) -->
          <div style="display: flex; flex-direction: column; justify-content: space-between;">
            <div style="background: #FFFFFF; border-radius: 6px; padding: 10px; border: 1px solid #FDE68A;">
              <div style="font-size: 11px; font-weight: 800; color: #92400E; margin-bottom: 4px;">■ PostgREST API エンジン</div>
              <div style="font-size: 10.5px; color: #451A03; line-height: 1.45;">
                ・<b>Direct HTTPS REST通信</b> (全通信の90%以上)<br>
                ・<b>JWT Bearer Token</b> による0秒認証照合<br>
                ・<b>Row Level Security (RLS)</b> DB物理認可<br>
                ・所要時間: <b>0.1〜0.3秒 (旧GAS比 20倍爆速)</b>
              </div>
            </div>

            <div style="background: #FFFFFF; border-radius: 6px; padding: 10px; border: 1px solid #FDE68A; margin-top: 8px;">
              <div style="font-size: 11px; font-weight: 800; color: #92400E; margin-bottom: 4px;">■ オブジェクトストレージ</div>
              <div style="font-size: 10.5px; color: #451A03; line-height: 1.45;">
                ・バケット名: <b>member-avatars</b><br>
                ・メンバーの顔写真・アイコン画像の直接CDN配信<br>
                ・アップロード時: クライアント直接HTTPS POST
              </div>
            </div>

            <!-- 赤矢印ラベル（端末からの直接通信） -->
            <div style="margin-top: 8px; text-align: center;">
              <span class="comm-arrow-badge" style="background: #DC2626;">
                ◀ Direct HTTPS REST (0.1〜0.3s) ▶
              </span>
              <div style="font-size: 9.5px; color: #991B1B; font-weight: bold; margin-top: 2px;">★ 全業務データ直接読み書き ★</div>
            </div>
          </div>

          <!-- 右列: サーバーラック ＆ DB円柱イラスト -->
          <div class="illustration-center" style="justify-content: space-around;">
            <!-- Server Rack SVG -->
            <svg width="75" height="95" viewBox="0 0 75 95" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="65" height="85" rx="4" fill="#1E293B" stroke="#475569" stroke-width="2"/>
              <!-- Server Trays -->
              <rect x="10" y="12" width="55" height="12" rx="2" fill="#334155"/>
              <circle cx="16" cy="18" r="2" fill="#22C55E"/>
              <circle cx="23" cy="18" r="2" fill="#38BDF8"/>
              <line x1="32" y1="18" x2="60" y2="18" stroke="#64748B" stroke-width="2"/>

              <rect x="10" y="28" width="55" height="12" rx="2" fill="#334155"/>
              <circle cx="16" cy="34" r="2" fill="#22C55E"/>
              <circle cx="23" cy="34" r="2" fill="#22C55E"/>
              <line x1="32" y1="34" x2="60" y2="34" stroke="#64748B" stroke-width="2"/>

              <rect x="10" y="44" width="55" height="12" rx="2" fill="#334155"/>
              <circle cx="16" cy="50" r="2" fill="#22C55E"/>
              <circle cx="23" cy="50" r="2" fill="#F59E0B"/>
              <line x1="32" y1="50" x2="60" y2="50" stroke="#64748B" stroke-width="2"/>

              <rect x="10" y="60" width="55" height="12" rx="2" fill="#334155"/>
              <circle cx="16" cy="66" r="2" fill="#22C55E"/>
              <circle cx="23" cy="66" r="2" fill="#38BDF8"/>
              <line x1="32" y1="66" x2="60" y2="66" stroke="#64748B" stroke-width="2"/>

              <rect x="10" y="76" width="55" height="8" rx="2" fill="#0F172A"/>
            </svg>
            <div class="device-caption" style="font-size: 10px;">Cloud Server</div>

            <!-- Database Cylinder SVG -->
            <svg width="75" height="70" viewBox="0 0 75 70" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Cylinder base layer 3 -->
              <path d="M10 40 C10 48 65 48 65 40 L65 52 C65 60 10 60 10 52 Z" fill="#D97706" stroke="#B45309" stroke-width="1.5"/>
              <!-- Cylinder base layer 2 -->
              <path d="M10 26 C10 34 65 34 65 26 L65 38 C65 46 10 46 10 38 Z" fill="#F59E0B" stroke="#B45309" stroke-width="1.5"/>
              <!-- Cylinder top layer 1 -->
              <path d="M10 12 C10 20 65 20 65 12 L65 24 C65 32 10 32 10 24 Z" fill="#FDE68A" stroke="#B45309" stroke-width="1.5"/>
              <!-- Top ellipse -->
              <ellipse cx="37.5" cy="12" rx="27.5" ry="8" fill="#FEF3C7" stroke="#B45309" stroke-width="1.5"/>
              <text x="37.5" y="15" font-size="8.5" font-weight="bold" fill="#78350F" text-anchor="middle">PostgreSQL</text>
            </svg>
            <div class="device-caption" style="font-size: 10px;">PostgreSQL 17</div>
          </div>

        </div>

      </div>

    </div>

    <!-- ========================================================
         3. 右側: 特権代行 Server ＆ 外部連携 側 (Google Cloud)
         ======================================================== -->
    <div style="display: flex; flex-direction: column; gap: 14px;">

      <!-- 上段: Google Apps Script (特権代行) -->
      <div class="group-box box-external" style="flex: 1.15;">
        <div class="box-tab">⚙️ Application Server 側</div>
        <div class="box-subtitle">Google Apps Script (GAS) サーバーレス特権代行</div>

        <!-- スクリプトアイコン ＆ 説明 -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
          <svg width="45" height="45" viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="45" height="45" rx="8" fill="#7C3AED"/>
            <path d="M12 15 L20 22.5 L12 30" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="22" y1="30" x2="32" y2="30" stroke="#FDE68A" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <div>
            <div style="font-size: 12.5px; font-weight: 800; color: #6D28D9;">GAS Web API (固定デプロイ)</div>
            <div style="font-size: 10px; color: #64748B;">旧スプシ処理を全廃した特権代行API</div>
          </div>
        </div>

        <div class="logic-card" style="border-left: 4px solid #A855F7;">
          <span>カレンダー予定取得・同期</span>
          <span class="logic-card-code">api_events.js</span>
        </div>
        <div class="logic-card" style="border-left: 4px solid #A855F7;">
          <span>Google OAuth 2.0 コード交換</span>
          <span class="logic-card-code">api_auth.js</span>
        </div>
        <div class="logic-card" style="border-left: 4px solid #A855F7;">
          <span>カレンダーAPI仲介</span>
          <span class="logic-card-code">calendar_service.js</span>
        </div>
        <div class="logic-card" style="border-left: 4px solid #A855F7;">
          <span>OAuthトークンDB保管</span>
          <span class="logic-card-code">supabase_service.js</span>
        </div>

        <div style="background: #FFFFFF; border-radius: 6px; padding: 8px; border: 1px solid #E9D5FF; margin-top: auto;">
          <div style="font-size: 10.5px; font-weight: 800; color: #6D28D9;">🔐 Script Properties 安全隔離</div>
          <div style="font-size: 9.5px; color: #4B5563; line-height: 1.4;">
            Google OAuth Client Secret および Supabase Service Key をサーバー環境変数へ隠蔽しコードから完全除去。
          </div>
        </div>
      </div>

      <!-- 下段: Google Workspace (外部カレンダー原本) -->
      <div class="group-box" style="flex: 0.85; background: #EFF6FF; border: 2px solid #3B82F6;">
        <div class="box-tab" style="background: #3B82F6; color: #FFFFFF;">☁️ External Cloud 側</div>
        <div class="box-subtitle">Google Workspace (外部公式サービス)</div>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <!-- Calendar Icon SVG -->
          <svg width="45" height="45" viewBox="0 0 45 45" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="8" width="35" height="32" rx="6" fill="#FFFFFF" stroke="#2563EB" stroke-width="2"/>
            <rect x="5" y="8" width="35" height="10" rx="6" fill="#2563EB"/>
            <line x1="14" y1="4" x2="14" y2="10" stroke="#1E40AF" stroke-width="3" stroke-linecap="round"/>
            <line x1="31" y1="4" x2="31" y2="10" stroke="#1E40AF" stroke-width="3" stroke-linecap="round"/>
            <!-- Grid dots -->
            <rect x="11" y="23" width="5" height="4" rx="1" fill="#93C5FD"/>
            <rect x="20" y="23" width="5" height="4" rx="1" fill="#2563EB"/>
            <rect x="29" y="23" width="5" height="4" rx="1" fill="#93C5FD"/>
            <rect x="11" y="31" width="5" height="4" rx="1" fill="#93C5FD"/>
            <rect x="20" y="31" width="5" height="4" rx="1" fill="#93C5FD"/>
            <rect x="29" y="31" width="5" height="4" rx="1" fill="#10B981"/>
          </svg>
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #1E40AF;">Google カレンダー (原本)</div>
            <div style="font-size: 10px; color: #4B5563;">FC Benten チーム共有カレンダー</div>
          </div>
        </div>

        <div style="font-size: 10px; color: #1E3A8A; line-height: 1.45; background: #FFFFFF; border-radius: 6px; padding: 8px; border: 1px solid #BFDBFE;">
          ・練習、TRM、公式戦の予定原本<br>
          ・出欠状況 (Accepted/Declined) 反映<br>
          ・Google OAuth 2.0 による本人確認
        </div>

        <div style="margin-top: 6px; text-align: right;">
          <span class="comm-arrow-label">Google API v3 (OAuth 2.0)</span>
        </div>
      </div>

    </div>

  </div>

  <!-- 下部スペック一覧表（ユーザー画像の下部赤見出しスタイルに完全準拠） -->
  <div class="specs-footer">
    <div class="spec-col">
      <div class="spec-header">ホスティング基盤</div>
      <div class="spec-content">
        <b>GitHub Pages (Global CDN)</b><br>
        配信ブランチ: gh-pages<br>
        URL: fcbenten.github.io/team-management<br>
        Network-First キャッシュ自動更新
      </div>
    </div>
    <div class="spec-col">
      <div class="spec-header">データベース基盤</div>
      <div class="spec-content">
        <b>Supabase (PostgreSQL 17.11)</b><br>
        リージョン: 東京 (ap-northeast-1)<br>
        PostgREST 直接通信 (0.1〜0.3秒)<br>
        Row Level Security (RLS) 認可保護
      </div>
    </div>
    <div class="spec-col">
      <div class="spec-header">フロントエンド技術</div>
      <div class="spec-content">
        <b>Pure HTML5 / CSS3 / Vanilla JS</b><br>
        Single Page Application (SPA)<br>
        0秒楽観的UIレンダリング<br>
        Service Worker (sw.js) PWA起動
      </div>
    </div>
    <div class="spec-col">
      <div class="spec-header">特権代行サーバー</div>
      <div class="spec-content">
        <b>Google Apps Script (GAS)</b><br>
        固定デプロイID (URL不変運用)<br>
        Google Calendar API v3 連携<br>
        Script Properties 秘密鍵安全隔離
      </div>
    </div>
    <div class="spec-col">
      <div class="spec-header">外部連携クラウド</div>
      <div class="spec-content">
        <b>Google Workspace</b><br>
        チーム共有 Google カレンダー<br>
        Google OAuth 2.0 認証基盤<br>
        iCal 形式予定・出欠ステータス同期
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
            page = browser.new_page(viewport={"width": 1400, "height": 980})
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
