# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
ユーザー提示の参考画像（Flutter/Supabase/Firebase）を徹底研究し、
不要な説明文を全廃した極限までシンプル・洗練されたモダンアーキテクチャ図を生成する。
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
    color: #1E293B;
    padding: 30px 40px;
    width: 1200px;
    height: 640px;
  }

  /* タイトル */
  .header {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin-bottom: 24px;
  }
  .header h1 {
    font-size: 26px;
    font-weight: 800;
    color: #0F172A;
    letter-spacing: -0.02em;
  }
  .header .sub {
    font-size: 13px;
    color: #64748B;
    font-weight: 600;
  }

  /* メインキャンバス */
  .canvas {
    position: relative;
    width: 100%;
    height: 520px;
  }

  /* メインカード */
  .card {
    position: absolute;
    top: 0;
    height: 500px;
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* アイテムボックス */
  .item-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 10px 8px;
  }
  .item-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .item-title {
    font-size: 15px;
    font-weight: 800;
    color: #0F172A;
  }
  .item-sub {
    font-size: 11px;
    color: #64748B;
    font-weight: 600;
    margin-top: 3px;
  }

  /* 矢印ラベル */
  .arrow-tag {
    position: absolute;
    font-size: 10.5px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 12px;
    white-space: nowrap;
    z-index: 10;
  }
</style>
</head>
<body>

<div class="header">
  <h1>アーキテクチャ</h1>
  <div class="sub">FC Benten チーム管理システム（全体構成 ＆ 通信フロー）</div>
</div>

<div class="canvas">

  <!-- ========================================================
       SVG レイヤー（矢印・マーカー）
       ======================================================== -->
  <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arr-gray" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M 0 0.5 L 6 3.5 L 0 6.5 Z" fill="#94A3B8"/>
      </marker>
      <marker id="arr-gray-rev" markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto">
        <path d="M 6 0.5 L 0 3.5 L 6 6.5 Z" fill="#94A3B8"/>
      </marker>
      <marker id="arr-green" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
        <path d="M 0 0.5 L 6 3.5 L 0 6.5 Z" fill="#10B981"/>
      </marker>
    </defs>

    <!-- 1. ユーザー ➔ モバイル端末 (水平直線) -->
    <path d="M 95 87 H 135" stroke="#94A3B8" stroke-width="2" marker-end="url(#arr-gray)"/>

    <!-- 2. Webアプリ ➔ Supabase への3分岐（図2と完全に同一の滑らかなベジェ曲線） -->
    <!-- 認証へ (cy: 131) -->
    <path d="M 390 87 C 420 87, 440 131, 465 131" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr-gray)"/>
    <!-- データベースへ (cy: 270, 双方向) -->
    <path d="M 390 87 C 420 87, 440 270, 465 270" stroke="#94A3B8" stroke-width="2" fill="none" marker-start="url(#arr-gray-rev)" marker-end="url(#arr-gray)"/>
    <!-- ストレージへ (cy: 410) -->
    <path d="M 390 87 C 420 87, 440 410, 465 410" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr-gray)"/>

    <!-- 3. データベース ⇄ Google Apps Script (双方向) -->
    <path d="M 730 270 C 760 270, 780 96, 805 96" stroke="#94A3B8" stroke-width="2" fill="none" marker-start="url(#arr-gray-rev)" marker-end="url(#arr-gray)"/>

    <!-- 4. Google Apps Script ➔ Google カレンダー (垂直下向き) -->
    <path d="M 935 162 V 180" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr-gray)"/>

    <!-- 5. Google Apps Script ➔ LINE Messaging API (垂直下向き) -->
    <path d="M 935 316 V 334" stroke="#94A3B8" stroke-width="2" fill="none" marker-end="url(#arr-gray)"/>

    <!-- 6. LINE Messaging API ➔ 端末内の LINE アプリへプッシュ通知着信 -->
    <path d="M 810 404 C 650 490, 500 450, 395 275" stroke="#10B981" stroke-width="2.5" stroke-dasharray="5 4" fill="none" marker-end="url(#arr-green)"/>
  </svg>

  <!-- 矢印ラベル -->
  <div class="arrow-tag" style="top: 450px; left: 540px; background: #ECFDF5; color: #047857; border: 1.5px solid #A7F3D0;">
    プッシュ通知着信
  </div>


  <!-- ========================================================
       0. アプリユーザー (左端)
       ======================================================== -->
  <div style="position: absolute; top: 40px; left: 10px; width: 85px; display: flex; flex-direction: column; align-items: center; text-align: center;">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="#0F172A">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
    <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 6px;">アプリユーザー</div>
    <div style="font-size: 10px; color: #64748B;">部員・保護者・役員</div>
  </div>


  <!-- ========================================================
       1. クライアント側（部員の端末）
       ======================================================== -->
  <div class="card" style="left: 140px; width: 250px;">
    <!-- 上部: Webアプリ (PWA) -->
    <div class="item-box" style="margin-top: 6px;">
      <!-- スマホ風アイコン -->
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style="margin-bottom: 6px;">
        <rect x="5" y="2" width="14" height="20" rx="3" stroke="#0F172A" stroke-width="2"/>
        <line x1="10" y1="18" x2="14" y2="18" stroke="#0F172A" stroke-width="2" stroke-linecap="round"/>
        <rect x="8" y="5" width="8" height="9" rx="1" fill="#E2E8F0"/>
      </svg>
      <div class="item-title">Webアプリ (PWA)</div>
      <div class="item-sub">Vanilla JS (SPA)</div>
    </div>

    <!-- 中部: LINE アプリ -->
    <div class="item-box" style="background: #F8FAFC; border-radius: 12px; padding: 12px 8px; border: 1px solid #F1F5F9;">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="margin-bottom: 4px;">
        <rect width="24" height="24" rx="6" fill="#06C755"/>
        <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
      </svg>
      <div class="item-title" style="font-size: 13.5px;">LINE アプリ</div>
      <div class="item-sub">部員個人のスマホ</div>
    </div>

    <!-- 下部: 配信プラットフォーム (GitHub Pages) -->
    <div style="border-top: 1px solid #F1F5F9; padding-top: 14px; text-align: center;">
      <div style="font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 8px;">配信プラットフォーム</div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #0F172A; border-radius: 8px; padding: 8px 12px; color: #FFFFFF;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017C2 16.446 4.87 20.198 8.84 21.52C9.34 21.61 9.52 21.3 9.52 21.03C9.52 20.79 9.51 20.01 9.51 19.17C6.73 19.77 6.14 18.6 5.92 18.01C5.8 17.7 5.29 16.77 4.84 16.52C4.47 16.32 3.94 15.83 4.83 15.82C5.66 15.81 6.26 16.58 6.46 16.9C7.4 18.52 8.93 18.07 9.54 17.79C9.63 17.11 9.9 16.65 10.2 16.39C7.97 16.14 5.64 15.28 5.64 11.45C5.64 10.36 6.03 9.46 6.67 8.76C6.57 8.51 6.22 7.48 6.77 6.1C6.77 6.1 7.61 5.84 9.52 7.13C10.32 6.91 11.17 6.8 12.02 6.8C12.87 6.8 13.72 6.91 14.52 7.13C16.43 5.83 17.27 6.1 17.27 6.1C17.82 7.48 17.47 8.51 17.37 8.76C18.01 9.46 18.4 10.35 18.4 11.45C18.4 15.29 16.06 16.14 13.83 16.39C14.2 16.71 14.52 17.32 14.52 18.28C14.52 19.65 14.51 20.76 14.51 21.03C14.51 21.3 14.69 21.62 15.2 21.52C19.16 20.19 22.03 16.44 22.03 12.017C22.03 6.484 17.553 2 12 2Z"/>
        </svg>
        <span style="font-size: 12px; font-weight: 800;">GitHub Pages</span>
      </div>
    </div>
  </div>


  <!-- ========================================================
       2. Supabase (クラウドデータベース)
       ======================================================== -->
  <div class="card" style="left: 470px; width: 260px;">
    <!-- ロゴヘッダー -->
    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
      <svg width="22" height="22" viewBox="0 0 109 113" fill="none">
        <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9624 107.314L53.9738 55.5768H99.1026C106.597 55.5768 110.745 64.1956 106.012 70.157L63.7076 110.284Z" fill="#3ECF8E"/>
        <path d="M45.297 2.71607C48.1565 -0.884784 53.9544 1.08779 54.0422 5.68607L54.4093 57.4232H10.268C2.77333 57.4232 -1.37464 48.8044 3.35808 42.843L45.297 2.71607Z" fill="#3ECF8E"/>
      </svg>
      <span style="font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">supabase</span>
    </div>

    <!-- 1. 認証 -->
    <div class="item-box">
      <div class="item-icon" style="background: #F0FDF4;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
          <rect x="5" y="11" width="14" height="10" rx="3"/>
          <path d="M8 11 V7 C8 4.79 9.79 3 12 3 C14.21 3 16 4.79 16 7 V11"/>
        </svg>
      </div>
      <div class="item-title">認証</div>
      <div class="item-sub">(Auth)<br>パスワード認証 / JWT</div>
    </div>

    <!-- 2. データベース -->
    <div class="item-box">
      <div class="item-icon" style="background: #ECFDF5;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2">
          <ellipse cx="12" cy="6" rx="8" ry="3"/>
          <path d="M4 6 V12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12 V6"/>
          <path d="M4 12 V18 C4 19.66 7.58 21 12 21 C16.42 21 20 19.66 20 18 V12"/>
        </svg>
      </div>
      <div class="item-title">データベース</div>
      <div class="item-sub">(Database)<br>PostgreSQL 17 (高速CRUD)</div>
    </div>

    <!-- 3. ストレージ -->
    <div class="item-box">
      <div class="item-icon" style="background: #F0FDF4;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
          <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 L14 2 Z"/>
          <circle cx="10" cy="14" r="2" fill="#10B981"/>
        </svg>
      </div>
      <div class="item-title">ストレージ</div>
      <div class="item-sub">(Storage)<br>プロフィール画像の保存</div>
    </div>
  </div>


  <!-- ========================================================
       3. 外部連携 ＆ 通知
       ======================================================== -->
  <div class="card" style="left: 810px; width: 250px;">
    <!-- 上部: 実行処理 (Google Apps Script) -->
    <div class="item-box" style="margin-top: 6px;">
      <div class="item-icon" style="background: #EFF6FF;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="6" fill="#2563EB"/>
          <path d="M8 12 L10 10 M8 12 L10 14" stroke="#FFFFFF" stroke-width="2"/>
          <path d="M16 12 L14 10 M16 12 L14 14" stroke="#FFFFFF" stroke-width="2"/>
        </svg>
      </div>
      <div class="item-title">実行処理</div>
      <div class="item-sub">(Google Apps Script)<br>カレンダー仲介 / 通知トリガー</div>
    </div>

    <!-- 中部: Google カレンダー -->
    <div class="item-box">
      <div class="item-icon" style="background: #FEF2F2;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="3" fill="#FFFFFF" stroke="#EA4335" stroke-width="2"/>
          <rect x="3" y="5" width="18" height="5" rx="2" fill="#EA4335"/>
          <circle cx="8" cy="14" r="1.5" fill="#3B82F6"/>
          <circle cx="12" cy="14" r="1.5" fill="#3B82F6"/>
          <circle cx="16" cy="14" r="1.5" fill="#10B981"/>
        </svg>
      </div>
      <div class="item-title">チームカレンダー</div>
      <div class="item-sub">(Google Calendar API)<br>練習・試合予定の原本</div>
    </div>

    <!-- 下部: プッシュ通知 (LINE Messaging API) -->
    <div class="item-box" style="margin-bottom: 6px;">
      <div class="item-icon" style="background: #DCFCE7;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#06C755"/>
          <path d="M12 4C7.03 4 3 7.36 3 11.5C3 13.88 4.48 15.98 6.78 17.29C6.44 18.44 5.72 19.98 5.67 20.1C5.6 20.25 5.8 20.35 5.95 20.24C7.8 18.99 9.9 17.47 10.33 17.2C10.87 17.34 11.43 17.41 12 17.41C16.97 17.41 21 14.05 21 9.91C21 5.77 16.97 4 12 4Z" fill="#FFFFFF"/>
        </svg>
      </div>
      <div class="item-title">プッシュ通知</div>
      <div class="item-sub">(LINE Messaging API)<br>雨天中止 / 出欠リマインド</div>
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
            page = browser.new_page(viewport={"width": 1200, "height": 640})
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
