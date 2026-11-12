# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
ユーザーの指摘を全面的に反映した最新システム相関図:
1. LINE大箱の右側の余計な箱（「部員のスマホへ自動着信！」緑枠）を完全削除。
   - ユーザーのサンプル図（画像3）通り、「API」小箱のみのシンプルで正確な構成に。
2. 「0.1s~0.3sの超高速」等の過剰な速度アピール文言を全廃:
   - DB: 「PostgreSQL 17 / 業務データ全般 (CRUD)」
   - WEB アプリ: 「ブラウザ実行 / ホーム画面起動」「Supabase Direct CRUD 通信」
   - ストレージ: 「写真保存 (CDN配信)」
3. ユーザーのサンプル図通りの明確な結線（大箱接続 vs 小箱接続）とロゴ配置を維持。
"""
import os
import base64
from playwright.sync_api import sync_playwright

def get_base64_image(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def build_html():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, "docs", "assets")
    
    line_app_b64 = get_base64_image(os.path.join(assets_dir, "logo_line_app.png"))
    gas_b64 = get_base64_image(os.path.join(assets_dir, "logo_gas.png"))

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    background: #FFFFFF;
    color: #1F2937;
    padding: 18px 24px;
    width: 1560px;
    height: 760px;
    overflow: hidden;
  }}

  /* ヘッダー */
  .header-group {{
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #F1F5F9;
  }}
  .title {{
    font-size: 24px;
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.02em;
  }}
  .sub-title {{
    font-size: 13px;
    color: #64748B;
    font-weight: 600;
  }}

  /* キャンバス（絶対配置領域） */
  .canvas {{
    position: relative;
    width: 100%;
    height: 685px;
  }}

  /* 大箱（親カード） */
  .big-box {{
    background: #FFFFFF;
    border-radius: 16px;
    position: absolute;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }}

  /* バッジ */
  .badge {{
    font-size: 10px;
    font-weight: 800;
    padding: 3px 9px;
    border-radius: 6px;
    display: inline-block;
    white-space: nowrap;
  }}

  /* 小箱（子アイテム） */
  .small-box {{
    background: #FFFFFF;
    border-radius: 12px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .icon-box {{
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}
</style>
</head>
<body>

<div class="header-group">
  <div class="title">アーキテクチャ ＆ システム相関図</div>
  <div class="sub-title">FC Benten チーム管理システム（クライアント・Supabase・Google・LINEの役割と通信フロー）</div>
</div>

<div class="canvas">

  <!-- ========================================================
       SVG レイヤー（シャープで美しいオレンジ矢印・精密配線）
       ======================================================== -->
  <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- オレンジ矢印 (終点) -->
      <marker id="arr-orange" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 1 1 L 8 4.5 L 1 8 Z" fill="#EA580C"/>
      </marker>
      <!-- オレンジ矢印 (始点逆向き) -->
      <marker id="arr-orange-rev" markerWidth="9" markerHeight="9" refX="1.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M 8 1 L 1 4.5 L 8 8 Z" fill="#EA580C"/>
      </marker>
    </defs>

    <!-- 1. GitHub Pages (小箱) ➔ WEB アプリ (小箱) [オレンジ点線] -->
    <path d="M 252 85 C 285 85, 295 125, 334 125" stroke="#EA580C" stroke-width="2.5" stroke-dasharray="4 3" fill="none" marker-end="url(#arr-orange)"/>

    <!-- 2. WEB アプリ (小箱) ⇄ supabase (【大箱】の左外枠に直結！) [太い双方向矢印] -->
    <path d="M 672 135 H 738" stroke="#EA580C" stroke-width="3" fill="none" marker-start="url(#arr-orange-rev)" marker-end="url(#arr-orange)"/>

    <!-- 3. WEB アプリ (小箱) ➔ Google カレンダー (【小箱】) [直線矢印] -->
    <path d="M 672 215 L 752 316" stroke="#EA580C" stroke-width="2.5" fill="none" marker-end="url(#arr-orange)"/>

    <!-- 4. WEB アプリ (小箱) ➔ Google 認証 (【小箱】) [直線矢印] -->
    <path d="M 672 295 L 752 416" stroke="#EA580C" stroke-width="2.5" fill="none" marker-end="url(#arr-orange)"/>

    <!-- 5. GAS (【小箱】) ➔ Google カレンダー (【小箱】) [Google大箱内の左斜め上矢印] -->
    <path d="M 1110 350 L 1084 325" stroke="#EA580C" stroke-width="2.5" fill="none" marker-end="url(#arr-orange)"/>

    <!-- 6. GAS (【小箱】) ➔ LINE Messaging API (【小箱】) [大箱跨ぎの垂直下向き矢印] -->
    <path d="M 1150 435 V 545" stroke="#EA580C" stroke-width="2.5" fill="none" marker-end="url(#arr-orange)"/>

    <!-- 7. WEB アプリ (小箱) ⇄ LINE Messaging API (【小箱】) [双方向直線矢印] -->
    <path d="M 672 355 L 752 570" stroke="#EA580C" stroke-width="2.5" fill="none" marker-start="url(#arr-orange-rev)" marker-end="url(#arr-orange)"/>

    <!-- 8. LINE Messaging API (【小箱】) ➔ LINE アプリ (【小箱】) [水平直線！] -->
    <path d="M 754 615 H 676" stroke="#EA580C" stroke-width="3" fill="none" marker-end="url(#arr-orange)"/>
  </svg>


  <!-- ========================================================
       1. GitHub (大箱・左上)
       ======================================================== -->
  <div class="big-box" style="top: 0; left: 16px; width: 245px; height: 130px; padding: 12px 14px; background: #0F172A; border: 1.5px solid #334155; color: #FFFFFF;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017C2 16.446 4.87 20.198 8.84 21.52C9.34 21.61 9.52 21.3 9.52 21.03C9.52 20.79 9.51 20.01 9.51 19.17C6.73 19.77 6.14 18.6 5.92 18.01C5.8 17.7 5.29 16.77 4.84 16.52C4.47 16.32 3.94 15.83 4.83 15.82C5.66 15.81 6.26 16.58 6.46 16.9C7.4 18.52 8.93 18.07 9.54 17.79C9.63 17.11 9.9 16.65 10.2 16.39C7.97 16.14 5.64 15.28 5.64 11.45C5.64 10.36 6.03 9.46 6.67 8.76C6.57 8.51 6.22 7.48 6.77 6.1C6.77 6.1 7.61 5.84 9.52 7.13C10.32 6.91 11.17 6.8 12.02 6.8C12.87 6.8 13.72 6.91 14.52 7.13C16.43 5.83 17.27 6.1 17.27 6.1C17.82 7.48 17.47 8.51 17.37 8.76C18.01 9.46 18.4 10.35 18.4 11.45C18.4 15.29 16.06 16.14 13.83 16.39C14.2 16.71 14.52 17.32 14.52 18.28C14.52 19.65 14.51 20.76 14.51 21.03C14.51 21.3 14.69 21.62 15.2 21.52C19.16 20.19 22.03 16.44 22.03 12.017C22.03 6.484 17.553 2 12 2Z"/>
        </svg>
        <span style="font-size: 14.5px; font-weight: 800;">GitHub</span>
      </div>
      <span class="badge" style="background: #334155; color: #94A3B8; font-size: 8.5px;">Webホスティング</span>
    </div>

    <!-- 小箱: github pages -->
    <div style="background: #1E293B; border: 1.5px solid #475569; border-radius: 10px; padding: 8px 12px; height: 64px;">
      <div style="font-size: 13px; font-weight: 800; color: #FFFFFF;">github pages</div>
      <div style="font-size: 10.5px; color: #38BDF8; font-weight: 700; margin-top: 1px;">fcbenten.github.io</div>
      <div style="font-size: 9px; color: #94A3B8; margin-top: 1px;">PWAバンドル資産の配信元</div>
    </div>
  </div>


  <!-- ========================================================
       2. PC スマートフォン (大箱・中列)
       ======================================================== -->
  <div class="big-box" style="top: 0; left: 320px; width: 360px; height: 680px; padding: 16px 18px; border: 2px solid #CBD5E1; background: #F8FAFC; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 16px;">💻📱</span>
          <span style="font-size: 15.5px; font-weight: 800; color: #0F172A;">PC スマートフォン</span>
        </div>
        <span class="badge" style="background: #475569; color: #FFFFFF; font-size: 9.5px;">クライアント環境</span>
      </div>

      <!-- 小箱1: WEB アプリ (過剰な速度表記を削除) -->
      <div style="background: #FFFFFF; border: 2.5px solid #0284C7; border-radius: 14px; padding: 16px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.08); height: 285px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div class="icon-box" style="background: #E0F2FE;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#0284C7"/>
                <path d="M4 11 L12 5 L20 11 M6 10 V18 C6 18.5 6.5 19 7 19 H17 C17.5 19 18 18.5 18 18 V10" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 19 V13 H14 V19" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <div style="font-size: 17px; font-weight: 800; color: #0284C7;">WEB アプリ</div>
              <div style="font-size: 11.5px; color: #475569; font-weight: 700;">Vanilla JS (SPA / PWA)</div>
            </div>
          </div>
          <div style="font-size: 11px; color: #64748B; line-height: 1.7; border-top: 1px solid #F1F5F9; padding-top: 10px;">
            <div>・ブラウザ実行 / ホーム画面起動</div>
            <div>・出欠、スコア入力、掲示板、名簿</div>
            <div>・Supabase Direct CRUD 通信</div>
          </div>
        </div>
        <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 6px 10px; text-align: center; font-size: 10px; color: #0369A1; font-weight: 700;">
          各クラウド基盤と直接セキュア通信
        </div>
      </div>
    </div>

    <!-- 小箱2: LINE アプリ (ユーザー提供の公式ロゴ logo_line_app.png) -->
    <div style="background: #FFFFFF; border: 2.5px solid #06C755; border-radius: 14px; padding: 14px 16px; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.08); display: flex; align-items: center; gap: 14px; height: 95px;">
      <img src="data:image/png;base64,{line_app_b64}" style="width: 46px; height: 46px; border-radius: 10px; object-fit: contain;" alt="LINE"/>
      <div>
        <div style="font-size: 16px; font-weight: 800; color: #06C755;">LINE アプリ</div>
        <div style="font-size: 11px; color: #475569; font-weight: 700; margin-top: 2px;">部員個人のスマホアプリ</div>
        <div style="font-size: 10px; color: #64748B; margin-top: 2px;">雨天中止・出欠リマインドを受信</div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       3. supabase (大箱・右上)
       ======================================================== -->
  <div class="big-box" style="top: 0; left: 740px; width: 780px; height: 175px; padding: 16px 20px; border: 2px solid #10B981;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <svg width="24" height="24" viewBox="0 0 109 113" fill="none">
          <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9624 107.314L53.9738 55.5768H99.1026C106.597 55.5768 110.745 64.1956 106.012 70.157L63.7076 110.284Z" fill="#3ECF8E"/>
          <path d="M45.297 2.71607C48.1565 -0.884784 53.9544 1.08779 54.0422 5.68607L54.4093 57.4232H10.268C2.77333 57.4232 -1.37464 48.8044 3.35808 42.843L45.297 2.71607Z" fill="#3ECF8E"/>
        </svg>
        <span style="font-size: 19px; font-weight: 800; color: #111827;">supabase</span>
        <span class="badge" style="background: #10B981; color: #FFFFFF;">クラウドデータベース (BaaS)</span>
      </div>
      <span style="font-size: 11px; color: #64748B; font-weight: 700;">東京リージョン (ap-northeast-1)</span>
    </div>

    <!-- 小箱3つ: 認証 / DB / ストレージ (速度誇張を全廃) -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; height: 90px;">
      <!-- 認証 -->
      <div class="small-box" style="border: 1.5px solid #D1FAE5; background: #F0FDF4;">
        <div class="icon-box" style="background: #ECFDF5;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="3" stroke="#10B981" stroke-width="2"/>
            <path d="M8 11 V7 C8 4.79 9.79 3 12 3 C14.21 3 16 4.79 16 7 V11" stroke="#10B981" stroke-width="2"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #065F46;">認証</div>
          <div style="font-size: 10px; color: #047857; font-weight: 700; margin-top: 1px;">パスワード認証・JWT</div>
          <div style="font-size: 9px; color: #64748B; margin-top: 1px;">行単位セキュリティ (RLS)</div>
        </div>
      </div>

      <!-- DB (速度アピール削除) -->
      <div class="small-box" style="border: 2px solid #10B981; background: #ECFDF5; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.08);">
        <div class="icon-box" style="background: #D1FAE5;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#047857" stroke-width="2"/>
            <path d="M4 6 V12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12 V6" stroke="#047857" stroke-width="2"/>
            <path d="M4 12 V18 C4 19.66 7.58 21 12 21 C16.42 21 20 19.66 20 18 V12" stroke="#047857" stroke-width="2"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #065F46;">DB</div>
          <div style="font-size: 10px; color: #047857; font-weight: 800; margin-top: 1px;">PostgreSQL 17</div>
          <div style="font-size: 9px; color: #64748B; margin-top: 1px;">業務データ全般 (CRUD)</div>
        </div>
      </div>

      <!-- ストレージ (速度誇張削除) -->
      <div class="small-box" style="border: 1.5px solid #D1FAE5; background: #F0FDF4;">
        <div class="icon-box" style="background: #ECFDF5;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 L14 2 Z" stroke="#10B981" stroke-width="2"/>
            <circle cx="10" cy="14" r="2" fill="#10B981"/>
          </svg>
        </div>
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #065F46;">ストレージ</div>
          <div style="font-size: 10px; color: #047857; font-weight: 700; margin-top: 1px;">member-avatars</div>
          <div style="font-size: 9px; color: #64748B; margin-top: 1px;">写真保存 (CDN配信)</div>
        </div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       4. Google (大箱・右中央)
       ======================================================== -->
  <div class="big-box" style="top: 215px; left: 740px; width: 780px; height: 265px; padding: 16px 20px; border: 2px solid #3B82F6;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        <span style="font-size: 17px; font-weight: 800; color: #111827;">Google</span>
      </div>
      <span class="badge" style="background: #2563EB; color: #FFFFFF; font-size: 9.5px;">特権代行 ＆ 外部連携</span>
    </div>

    <!-- 2列レイアウト: 左列(カレンダー / 認証) + 右列(GAS) -->
    <div style="display: flex; gap: 20px; height: 185px;">
      <!-- 左列 (幅 320px): カレンダー + 認証 -->
      <div style="width: 320px; display: flex; flex-direction: column; justify-content: space-between;">
        <!-- カレンダー -->
        <div class="small-box" style="border: 1.5px solid #FCA5A5; background: #FEF2F2; height: 82px;">
          <div class="icon-box" style="background: #FFFFFF; border: 1.5px solid #E2E8F0;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
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
            <div style="font-size: 14.5px; font-weight: 800; color: #991B1B;">カレンダー</div>
            <div style="font-size: 10.5px; color: #DC2626; font-weight: 700; margin-top: 1px;">公式予定の原本データ</div>
            <div style="font-size: 9.5px; color: #64748B; margin-top: 1px;">練習・試合・遠征マスター</div>
          </div>
        </div>

        <!-- 認証 -->
        <div class="small-box" style="border: 1.5px solid #BFDBFE; background: #EFF6FF; height: 82px;">
          <div class="icon-box" style="background: #DBEAFE;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#2563EB" stroke-width="2"/>
              <path d="M12 8 V12 L15 15" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <div style="font-size: 14.5px; font-weight: 800; color: #1E40AF;">認証</div>
            <div style="font-size: 10.5px; color: #2563EB; font-weight: 700; margin-top: 1px;">Google OAuth 2.0</div>
            <div style="font-size: 9.5px; color: #64748B; margin-top: 1px;">アカウント連携・認可</div>
          </div>
        </div>
      </div>

      <!-- 右列 (幅 400px): GAS (ユーザー提供の公式4色扇形ロゴ logo_gas.png) -->
      <div style="flex: 1; display: flex; align-items: center;">
        <div class="small-box" style="width: 100%; height: 130px; border: 2px solid #34A853; background: #F0FDF4; box-shadow: 0 4px 12px rgba(52, 168, 83, 0.08); padding: 14px 18px;">
          <img src="data:image/png;base64,{gas_b64}" style="width: 56px; height: 56px; object-fit: contain; flex-shrink: 0;" alt="GAS"/>
          <div>
            <div style="font-size: 16.5px; font-weight: 800; color: #15803D;">GAS</div>
            <div style="font-size: 11px; color: #166534; font-weight: 700; margin-top: 2px;">Google Apps Script</div>
            <div style="font-size: 9.5px; color: #64748B; margin-top: 3px; line-height: 1.45;">
              カレンダー同期代行<br>＆ LINE通知トリガー発信
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>


  <!-- ========================================================
       5. LINE (大箱・右下)
       ※余計な右側バナーを完全削除し、ユーザーのサンプル図通りAPI小箱のみに純化
       ======================================================== -->
  <div class="big-box" style="top: 505px; left: 740px; width: 780px; height: 165px; padding: 14px 20px; border: 2px solid #06C755; background: #F0FDF4;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1.5px solid #BBF7D0; padding-bottom: 5px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#06C755">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.9 5.39 4.75 6.78-.21.78-.77 2.83-.88 3.27-.14.54.2.53.42.39.29-.19 3.96-2.7 4.54-3.11.39.05.78.08 1.17.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
        </svg>
        <span style="font-size: 17px; font-weight: 800; color: #065F46;">LINE</span>
      </div>
      <span class="badge" style="background: #06C755; color: #FFFFFF; font-size: 9.5px;">公式アカウント通知基盤</span>
    </div>

    <!-- 小箱: API (余計なバナーなし・Messaging API のロゴはそのまま) -->
    <div class="small-box" style="border: 1.5px solid #BBF7D0; background: #FFFFFF; height: 95px; width: 440px; padding: 14px 18px; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.06);">
      <div class="icon-box" style="background: #06C755;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.87 1.9 5.39 4.75 6.78-.21.78-.77 2.83-.88 3.27-.14.54.2.53.42.39.29-.19 3.96-2.7 4.54-3.11.39.05.78.08 1.17.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
        </svg>
      </div>
      <div>
        <div style="font-size: 16px; font-weight: 800; color: #065F46;">API</div>
        <div style="font-size: 11px; color: #059669; font-weight: 700; margin-top: 1px;">LINE Messaging API</div>
        <div style="font-size: 9.5px; color: #64748B; margin-top: 2px;">雨天中止・出欠リマインドの公式通知配信</div>
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

    html_content = build_html()
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

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
