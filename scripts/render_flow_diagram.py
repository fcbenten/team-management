# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
ユーザー指定のモダン・ミニマルなアーキテクチャ図（白背景、すっきりしたカード、
アプリユーザー ➔ PWA ➔ Supabase ➔ Google Cloud の直感的な連携図）を生成するスクリプト。
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
    padding: 36px 48px;
    width: 1280px;
    height: 720px;
  }

  /* タイトル */
  .title {
    font-size: 26px;
    font-weight: 800;
    color: #111827;
    margin-bottom: 30px;
    letter-spacing: -0.02em;
  }

  /* メイングリッドコンテナ */
  .diagram-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 560px;
  }

  /* ユーザーゾーン */
  .user-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 120px;
  }
  .user-label {
    font-size: 14px;
    font-weight: 700;
    color: #374151;
    margin-top: 10px;
  }

  /* 矢印コネクタ */
  .arrow-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9CA3AF;
  }

  /* カード共通 */
  .arch-card {
    background: #FFFFFF;
    border: 1.5px solid #E5E7EB;
    border-radius: 18px;
    padding: 26px 20px;
    height: 540px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    position: relative;
  }

  /* カード1: モバイルアプリ (PWA) */
  .card-pwa {
    width: 280px;
    align-items: center;
    background: #FAFAFA;
  }

  /* カード2: Supabase */
  .card-supabase {
    width: 320px;
    align-items: center;
  }

  /* カード3: Google Cloud */
  .card-google {
    width: 290px;
    align-items: center;
  }

  /* カードヘッダー（ロゴ） */
  .card-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 22px;
    height: 36px;
  }
  .brand-text {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  /* カード内アイテム（機能ブロック） */
  .feature-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 12px;
  }
  .feature-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .icon-green {
    background: #ECFDF5;
    color: #10B981;
    border: 1px solid #A7F3D0;
  }
  .icon-blue {
    background: #EFF6FF;
    color: #3B82F6;
    border: 1px solid #BFDBFE;
  }
  .icon-amber {
    background: #FFFBEB;
    color: #F59E0B;
    border: 1px solid #FDE68A;
  }

  .feature-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
  }
  .feature-sub {
    font-size: 11.5px;
    color: #6B7280;
    margin-top: 1px;
  }
  .feature-desc {
    font-size: 10px;
    color: #9CA3AF;
    margin-top: 2px;
  }

  /* 縦矢印（カード内） */
  .item-down-arrow {
    color: #D1D5DB;
    margin: 4px 0 8px 0;
  }
</style>
</head>
<body>

<div class="title">アーキテクチャ</div>

<div class="diagram-container">

  <!-- ==================== 1. アプリユーザー ==================== -->
  <div class="user-zone">
    <!-- 3人ユーザーシルエット SVG (参考画像準拠) -->
    <svg width="84" height="84" viewBox="0 0 84 84" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Back Left Person -->
      <circle cx="27" cy="30" r="11" fill="#111827"/>
      <path d="M12 58 C12 48 20 46 27 46 C34 46 42 48 42 58 Z" fill="#111827"/>
      <!-- Back Right Person -->
      <circle cx="57" cy="30" r="11" fill="#111827"/>
      <path d="M42 58 C42 48 50 46 57 46 C64 46 72 48 72 58 Z" fill="#111827"/>
      <!-- Front Center Person -->
      <circle cx="42" cy="36" r="13" fill="#000000"/>
      <path d="M22 68 C22 56 32 54 42 54 C52 54 62 56 62 68 Z" fill="#000000"/>
    </svg>
    <div class="user-label">アプリユーザー</div>
  </div>

  <!-- 矢印: ユーザー ➔ アプリ -->
  <div class="arrow-connector">
    <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
      <path d="M4 12 H34 M26 4 L34 12 L26 20" stroke="#9CA3AF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- ==================== 2. モバイルアプリ (PWA) ==================== -->
  <div class="arch-card card-pwa">
    <!-- スマホアイコン (参考画像準拠) -->
    <div style="margin-top: 10px; margin-bottom: 16px;">
      <svg width="70" height="110" viewBox="0 0 70 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="4" width="60" height="102" rx="12" fill="#000000" stroke="#374151" stroke-width="2"/>
        <rect x="8" y="12" width="54" height="82" rx="4" fill="#FFFFFF"/>
        <rect x="26" y="7" width="18" height="3" rx="1.5" fill="#4B5563"/>
        <circle cx="35" cy="99" r="3" fill="#D1D5DB"/>
        <!-- 画面内UI線 -->
        <rect x="13" y="18" width="22" height="4" rx="1" fill="#0284C7"/>
        <rect x="13" y="26" width="44" height="14" rx="2" fill="#E0F2FE"/>
        <rect x="13" y="44" width="44" height="8" rx="2" fill="#F3F4F6"/>
        <rect x="13" y="55" width="44" height="8" rx="2" fill="#F3F4F6"/>
        <rect x="13" y="66" width="20" height="16" rx="2" fill="#ECFDF5"/>
        <rect x="37" y="66" width="20" height="16" rx="2" fill="#FEF3C7"/>
      </svg>
    </div>

    <div style="font-size: 17px; font-weight: 800; color: #111827; margin-bottom: 12px;">Webアプリ (PWA)</div>

    <!-- 技術スタック (Flutterロゴのポジション) -->
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
      <!-- PWA/HTML5 Icon -->
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2 L3 6 L4.5 17 L12 22 L19.5 17 L21 6 Z" fill="#0284C7"/>
        <path d="M12 4 L18.5 7.5 L17.5 16 L12 19.5 Z" fill="#38BDF8"/>
        <text x="12" y="15" font-size="8" font-weight="900" fill="#FFFFFF" text-anchor="middle">SPA</text>
      </svg>
      <span style="font-size: 15px; font-weight: 700; color: #374151;">Vanilla JS (SPA)</span>
    </div>

    <!-- 配信プラットフォーム (App Store / Google Play のポジション) -->
    <div style="margin-top: auto; width: 100%; border-top: 1px solid #E5E7EB; padding-top: 16px; text-align: center;">
      <div style="font-size: 12px; font-weight: 700; color: #4B5563; margin-bottom: 12px;">配信プラットフォーム</div>
      <div style="display: flex; justify-content: center; align-items: center; gap: 18px;">
        <!-- GitHub Pages Icon & Text -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#0F172A"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 4C7.58 4 4 7.58 4 12C4 15.54 6.29 18.53 9.47 19.59C9.87 19.66 10.02 19.42 10.02 19.21C10.02 19.02 10.01 18.39 10.01 17.72C8 18.09 7.46 17.18 7.3 16.73C7.21 16.5 6.82 15.79 6.48 15.6C6.2 15.45 5.8 15.08 6.47 15.07C7.1 15.06 7.55 15.65 7.7 15.89C8.42 17.11 9.57 16.77 10.03 16.56C10.1 16.04 10.31 15.68 10.54 15.48C8.75 15.28 6.87 14.59 6.87 11.51C6.87 10.63 7.18 9.92 7.69 9.36C7.61 9.16 7.33 8.33 7.77 7.23C7.77 7.23 8.44 7.02 9.99 8.06C10.63 7.88 11.32 7.79 12.01 7.79C12.7 7.79 13.39 7.88 14.03 8.06C15.58 7.01 16.25 7.23 16.25 7.23C16.69 8.33 16.41 9.16 16.33 9.36C16.84 9.92 17.15 10.63 17.15 11.51C17.15 14.6 15.26 15.28 13.47 15.48C13.76 15.73 14.01 16.21 14.01 16.96C14.01 18.04 14 18.91 14 19.21C14 19.42 14.15 19.67 14.55 19.59C17.71 18.53 20 15.53 20 12C20 7.58 16.42 4 12 4Z" fill="#FFFFFF"/>
          </svg>
          <span style="font-size: 10px; font-weight: 700; color: #4B5563;">GitHub Pages</span>
        </div>
        <!-- PWA / Home Screen Icon & Text -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#0284C7"/>
            <path d="M6 12 L12 6 L18 12 M8 10.5 V17 H16 V10.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span style="font-size: 10px; font-weight: 700; color: #4B5563;">ホーム画面 (PWA)</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 分岐矢印: アプリ ⇄ Supabase (3分岐コネクタ) -->
  <div style="width: 50px; height: 380px; display: flex; align-items: center; position: relative;">
    <svg width="50" height="380" viewBox="0 0 50 380" fill="none">
      <!-- 幹（中央） -->
      <path d="M 0 190 H 46" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
      <path d="M 40 185 L 47 190 L 40 195" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- 上ブランチ (認証へ) -->
      <path d="M 18 190 V 65 C 18 55 24 55 34 55 H 46" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
      <path d="M 40 50 L 47 55 L 40 60" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- 下ブランチ (ストレージへ) -->
      <path d="M 18 190 V 315 C 18 325 24 325 34 325 H 46" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"/>
      <path d="M 40 320 L 47 325 L 40 330" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- 左向き矢印 (双方向通信) -->
      <path d="M 7 185 L 0 190 L 7 195" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- ==================== 3. Supabase ==================== -->
  <div class="arch-card card-supabase">
    <!-- Supabase 公式ロゴヘッダー (参考画像準拠) -->
    <div class="card-brand">
      <svg width="28" height="28" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9624 107.314L53.9738 55.5768H99.1026C106.597 55.5768 110.745 64.1956 106.012 70.157L63.7076 110.284Z" fill="#3ECF8E"/>
        <path d="M45.297 2.71607C48.1565 -0.884784 53.9544 1.08779 54.0422 5.68607L54.4093 57.4232H10.268C2.77333 57.4232 -1.37464 48.8044 3.35808 42.843L45.297 2.71607Z" fill="#3ECF8E"/>
      </svg>
      <span class="brand-text" style="color: #111827;">supabase</span>
    </div>

    <!-- 1. 認証 (Auth) -->
    <div class="feature-item">
      <div class="feature-icon-box icon-green">
        <!-- 鍵アイコン -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="10" rx="3" stroke="#10B981" stroke-width="2"/>
          <path d="M8 11 V7 C8 4.79 9.79 3 12 3 C14.21 3 16 4.79 16 7 V11" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1.5" fill="#10B981"/>
        </svg>
      </div>
      <div class="feature-title">認証</div>
      <div class="feature-sub">(Auth)</div>
      <div class="feature-desc">パスワード認証 / JWT保持</div>
    </div>

    <!-- 縦矢印 -->
    <div class="item-down-arrow">
      <svg width="12" height="18" viewBox="0 0 12 18" fill="none">
        <path d="M6 0 V14 M2 10 L6 14 L10 10" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- 2. データベース (Database) -->
    <div class="feature-item">
      <div class="feature-icon-box icon-green">
        <!-- DB円柱アイコン -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#10B981" stroke-width="2"/>
          <path d="M4 6 V12 C4 13.66 7.58 15 12 15 C16.42 15 20 13.66 20 12 V6" stroke="#10B981" stroke-width="2"/>
          <path d="M4 12 V18 C4 19.66 7.58 21 12 21 C16.42 21 20 19.66 20 18 V12" stroke="#10B981" stroke-width="2"/>
        </svg>
      </div>
      <div class="feature-title">データベース</div>
      <div class="feature-sub">(Database)</div>
      <div class="feature-desc">PostgreSQL 17 / PostgREST (0.1〜0.3s)</div>
    </div>

    <!-- 縦矢印 -->
    <div class="item-down-arrow">
      <svg width="12" height="18" viewBox="0 0 12 18" fill="none">
        <path d="M6 0 V14 M2 10 L6 14 L10 10" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- 3. ストレージ (Storage) -->
    <div class="feature-item">
      <div class="feature-icon-box icon-green">
        <!-- ドキュメント/画像アイコン -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M14 2 H6 C4.9 2 4 2.9 4 4 V20 C4 21.1 4.9 22 6 22 H18 C19.1 22 20 21.1 20 20 V8 L14 2 Z" stroke="#10B981" stroke-width="2"/>
          <path d="M14 2 V8 H20" stroke="#10B981" stroke-width="2"/>
          <circle cx="10" cy="14" r="2" fill="#10B981"/>
          <path d="M6 19 L9 15 L12 18 L15 14 L18 18" stroke="#10B981" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="feature-title">ストレージ</div>
      <div class="feature-sub">(Storage)</div>
      <div class="feature-desc">プロフィール画像の保存 (CDN)</div>
    </div>
  </div>

  <!-- 双方向水平矢印: Supabase ⇄ Google Cloud (参考画像準拠) -->
  <div class="arrow-connector">
    <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
      <path d="M6 12 H42 M14 4 L6 12 L14 20 M34 4 L42 12 L34 20" stroke="#9CA3AF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- ==================== 4. Google Cloud / 特権代行 ==================== -->
  <div class="arch-card card-google">
    <!-- Google Cloud ロゴヘッダー (Firebaseロゴのポジション) -->
    <div class="card-brand">
      <!-- Google 4-color Cloud Icon -->
      <svg width="32" height="26" viewBox="0 0 32 26" fill="none">
        <path d="M25 21 H9 C5.13 21 2 17.87 2 14 C2 10.42 4.7 7.48 8.2 7.05 C9.2 3.02 12.8 0 17.2 0 C22.4 0 26.6 4.18 26.6 9.33 C26.6 9.73 26.58 10.12 26.53 10.5 C29.6 11.2 32 13.9 32 17.15 C32 21 28.9 21 25 21 Z" fill="#4285F4"/>
        <path d="M17.2 0 C15.5 0 13.9 0.45 12.5 1.25 L16.8 12.5 H26.6 C26.6 4.18 22.4 0 17.2 0 Z" fill="#EA4335" opacity="0.9"/>
        <path d="M12.5 1.25 C9.8 2.8 8.2 5.7 8.2 7.05 L13 14 L16.8 12.5 L12.5 1.25 Z" fill="#FBBC05"/>
        <path d="M26.6 9.33 C26.6 9.73 26.58 10.12 26.53 10.5 L19 15 L25 21 C28.9 21 32 18.5 32 17.15 C32 13.9 29.6 11.2 26.6 9.33 Z" fill="#34A853"/>
      </svg>
      <span class="brand-text" style="color: #374151; font-size: 19px;">Google Cloud</span>
    </div>

    <!-- 1. 実行処理 (CloudFunctionsのポジション) -->
    <div class="feature-item">
      <div class="feature-icon-box icon-blue">
        <!-- 実行関数 / コードアイコン (Cloud Functions 風) -->
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="6" fill="#2563EB"/>
          <path d="M8 12 L10 10 M8 12 L10 14" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M16 12 L14 10 M16 12 L14 14" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="12" cy="12" r="1" fill="#FFFFFF"/>
        </svg>
      </div>
      <div class="feature-title">実行処理</div>
      <div class="feature-sub">(Google Apps Script)</div>
      <div class="feature-desc">特権代行 / カレンダー同期・OAuth交換</div>
    </div>

    <!-- 縦矢印 -->
    <div class="item-down-arrow">
      <svg width="12" height="18" viewBox="0 0 12 18" fill="none">
        <path d="M6 0 V14 M2 10 L6 14 L10 10" stroke="#9CA3AF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- 2. チームカレンダー (Cloud Messagingのポジション) -->
    <div class="feature-item">
      <div class="feature-icon-box icon-amber">
        <!-- Google カレンダーアイコン -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="3" fill="#FFFFFF" stroke="#EA4335" stroke-width="2"/>
          <rect x="3" y="5" width="18" height="5" rx="2" fill="#EA4335"/>
          <line x1="8" y1="2" x2="8" y2="6" stroke="#4B5563" stroke-width="2" stroke-linecap="round"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke="#4B5563" stroke-width="2" stroke-linecap="round"/>
          <circle cx="8" cy="13" r="1.2" fill="#3B82F6"/>
          <circle cx="12" cy="13" r="1.2" fill="#3B82F6"/>
          <circle cx="16" cy="13" r="1.2" fill="#3B82F6"/>
          <circle cx="8" cy="17" r="1.2" fill="#3B82F6"/>
          <circle cx="12" cy="17" r="1.2" fill="#10B981"/>
        </svg>
      </div>
      <div class="feature-title">チームカレンダー</div>
      <div class="feature-sub">(Google Calendar API)</div>
      <div class="feature-desc">練習・試合予定の原本同期</div>
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
            page = browser.new_page(viewport={"width": 1280, "height": 720})
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
