# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
Playwrightを用いて高精細なシステム構成・通信相関図（PNG画像）を生成するスクリプト
（GitHub Pages PWA + Supabase PostgreSQL 17 Tokyo + Google Apps Script ハイブリッドアーキテクチャ）
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
    background: #0B1120;
    color: #F8FAFC;
    padding: 24px;
    width: 1400px;
    height: 840px;
  }
  
  /* ヘッダー */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #1E293B;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .header-left h1 {
    font-size: 24px;
    font-weight: 800;
    color: #38BDF8;
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-left p {
    font-size: 12.5px;
    color: #94A3B8;
    margin-top: 4px;
  }
  .header-badge {
    background: #0369A1;
    color: #E0F2FE;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 9999px;
    text-transform: uppercase;
  }
  
  /* メイングリッド: 3カラム構成 */
  .diagram-grid {
    display: grid;
    grid-template-columns: 340px 1fr 340px;
    gap: 20px;
    height: 640px;
  }
  
  /* 共通カラム */
  .zone-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  /* カードコンテナ */
  .node-card {
    background: #1E293B;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #334155;
  }
  .node-title {
    font-size: 15px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .node-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
  }
  
  /* クライアント端末 (Sky Blue) */
  .border-client { border-top: 4px solid #0284C7; }
  .text-client { color: #38BDF8; }
  .badge-client { background: #075985; color: #E0F2FE; }
  
  /* GitHub Pages (Emerald Green) */
  .border-gh { border-top: 4px solid #059669; }
  .text-gh { color: #34D399; }
  .badge-gh { background: #064E3B; color: #D1FAE5; }
  
  /* Supabase (Purple / Violet) */
  .border-supabase { border-top: 4px solid #7C3AED; }
  .text-supabase { color: #A78BFA; }
  .badge-supabase { background: #4C1D95; color: #EDE9FE; }
  
  /* Google Apps Script (Amber) */
  .border-gas { border-top: 4px solid #D97706; }
  .text-gas { color: #FBBF24; }
  .badge-gas { background: #78350F; color: #FEF3C7; }

  /* Google Workspace (Blue) */
  .border-google { border-top: 4px solid #2563EB; }
  .text-google { color: #60A5FA; }
  .badge-google { background: #1E3A8A; color: #DBEAFE; }

  /* ノード内リスト */
  .node-item {
    background: #0F172A;
    border-radius: 8px;
    padding: 9px 11px;
    margin-bottom: 8px;
    font-size: 11.5px;
    border-left: 3px solid #64748B;
  }
  .node-item:last-child { margin-bottom: 0; }
  .item-title {
    font-weight: 700;
    color: #F1F5F9;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .item-desc {
    color: #94A3B8;
    font-size: 10.5px;
    line-height: 1.4;
  }

  /* 通信連携カード（中央エリア上部＆各ノード間） */
  .comm-bar {
    background: #0F172A;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .comm-id {
    font-size: 10.5px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
  }
  .comm-name {
    font-size: 11.5px;
    font-weight: 700;
    color: #E2E8F0;
  }
  .comm-speed {
    font-size: 10.5px;
    font-weight: 800;
    color: #10B981;
    background: #064E3B;
    padding: 2px 6px;
    border-radius: 4px;
  }

  /* 矢印コネクタ行 */
  .arrow-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    color: #38BDF8;
    padding: 4px 0;
  }

  /* フッター凡例 */
  .footer-legend {
    margin-top: 14px;
    background: #1E293B;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }
  .legend-pills {
    display: flex;
    gap: 16px;
  }
  .legend-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #CBD5E1;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .dot-fast { background: #10B981; }
  .dot-auth { background: #A78BFA; }
  .dot-gas { background: #FBBF24; }
  .dot-gh { background: #38BDF8; }
</style>
</head>
<body>

<!-- ヘッダー -->
<div class="header">
  <div class="header-left">
    <h1>FC BENTEN チーム管理システム 全体システム構成・通信相関図</h1>
    <p>GitHub Pages (PWA配信) ＋ Supabase (PostgreSQL 17 Tokyo) ＋ Google Apps Script ハイブリッド通信アーキテクチャ</p>
  </div>
  <div class="header-badge">Architecture Ver 2.0.0</div>
</div>

<!-- メイングリッド -->
<div class="diagram-grid">

  <!-- ==================== カラム1: ユーザー端末 (Client) ==================== -->
  <div class="zone-col">
    <div class="node-card border-client" style="height: 100%;">
      <div class="node-header">
        <div class="node-title text-client">
          <span>📱</span> 1. ユーザー端末 (Client)
        </div>
        <div class="node-badge badge-client">SPA / PWA</div>
      </div>

      <div class="node-item" style="border-left-color: #0284C7;">
        <div class="item-title">📱 端末環境 & PWA エンジン</div>
        <div class="item-desc">
          ・iPhone (iOS Safari) / Android (Chrome) / PC<br>
          ・ホーム画面追加でフルスクリーンネイティブ起動<br>
          ・Service Worker (sw.js) による0秒オフライン起動
        </div>
      </div>

      <div class="node-item" style="border-left-color: #38BDF8;">
        <div class="item-title">⚡ 0秒楽観的UIレンダリング (Optimistic UI)</div>
        <div class="item-desc">
          ・出欠ボタンタップ、掲示板ピン留め、削除時など<br>
          ・通信結果を待たずに画面側を0.0秒で先行即時更新<br>
          ・非同期バックグラウンドでサーバーへ自動同期
        </div>
      </div>

      <div class="node-item" style="border-left-color: #0284C7;">
        <div class="item-title">🔐 セキュアローカルストレージ</div>
        <div class="item-desc">
          ・localStorage (Supabase JWT セッションキー)<br>
          ・ログイン認証状態の永続保持 (30日間持続)<br>
          ・オフライン時の一時キャッシュ保持
        </div>
      </div>

      <div class="node-item" style="border-left-color: #38BDF8; margin-top: auto;">
        <div class="item-title">🎯 クライアント直接通信 (Direct Client)</div>
        <div class="item-desc">
          旧来の「GASを経由した直列通信」を完全撤廃し、90%以上のDB読み書きをブラウザからSupabaseへ直接実行。
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== カラム2: ホスティング ＆ BaaS クラウド ==================== -->
  <div class="zone-col">
    <!-- 上段: GitHub Pages -->
    <div class="node-card border-gh" style="flex: 0.85;">
      <div class="node-header">
        <div class="node-title text-gh">
          <span>🌐</span> 2. Webホスティング (GitHub Pages)
        </div>
        <div class="node-badge badge-gh">Global CDN (gh-pages)</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="node-item" style="border-left-color: #059669;">
          <div class="item-title">📦 静的PWAアセット配信</div>
          <div class="item-desc">
            ・index.html (HTML/CSS/JSバンドル)<br>
            ・manifest.json (PWA定義・アイコン)<br>
            ・URL: fcbenten.github.io/team-management
          </div>
        </div>
        <div class="node-item" style="border-left-color: #34D399;">
          <div class="item-title">🚀 高速CDN ＆ 自動キャッシュ</div>
          <div class="item-desc">
            ・HTTPS GET 通信 (所要時間: 0.05〜0.1秒)<br>
            ・Network-First 戦略で最新版を即時配信<br>
            ・GitHub gh-pages ブランチから直接配信
          </div>
        </div>
      </div>
    </div>

    <!-- 下段: Supabase Cloud (Main Data Center) -->
    <div class="node-card border-supabase" style="flex: 1.65;">
      <div class="node-header">
        <div class="node-title text-supabase">
          <span>⚡</span> 3. Supabase Cloud (東京リージョン ap-northeast-1)
        </div>
        <div class="node-badge badge-supabase">BaaS / 0.1〜0.3秒 爆速</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div class="node-item" style="border-left-color: #7C3AED;">
          <div class="item-title">🚀 PostgREST API エンジン</div>
          <div class="item-desc">
            ・RESTful JSON API 自動生成 (/rest/v1/*)<br>
            ・超低遅延レスポンス: 0.1〜0.3秒<br>
            ・JWT Bearer トークンによる瞬時認証
          </div>
        </div>
        <div class="node-item" style="border-left-color: #A78BFA;">
          <div class="item-title">🛡️ Row Level Security (RLS)</div>
          <div class="item-desc">
            ・PostgreSQL層での行レベル認可制御<br>
            ・代表/役員/部員の書き込み権限をDBで物理強制<br>
            ・他者の不正な改ざんをDBレベルで完全遮断
          </div>
        </div>
      </div>

      <div class="node-item" style="border-left-color: #7C3AED;">
        <div class="item-title">🗄️ PostgreSQL 17.11 リレーショナルデータベース (全10テーブル)</div>
        <div class="item-desc" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 4px;">
          <div>・members (部員名簿・認証ハッシュ・役職)<br>・matches / score_logs (試合・得点・警告)<br>・attendance (出欠回答・ステータス)</div>
          <div>・equipment_master / items / event_logs (備品・当番)<br>・bulletin_posts / reads / comments (活動記録・掲示板)<br>・system_user_tokens (Google OAuthトークン)</div>
        </div>
      </div>

      <div class="node-item" style="border-left-color: #A78BFA; margin-top: auto;">
        <div class="item-title">🖼️ Supabase Storage (CDN画像ストレージ)</div>
        <div class="item-desc">
          ・member-avatars バケット: メンバーの顔写真・プロフィールアイコン画像を直接配信・アップロード (HTTPS)
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== カラム3: 特権代行 ＆ 外部連携 ==================== -->
  <div class="zone-col">
    <!-- 上段: Google Apps Script -->
    <div class="node-card border-gas" style="flex: 1.15;">
      <div class="node-header">
        <div class="node-title text-gas">
          <span>⚙️</span> 4. Google Apps Script (GAS)
        </div>
        <div class="node-badge badge-gas">特権代行サーバー</div>
      </div>

      <div class="node-item" style="border-left-color: #D97706;">
        <div class="item-title">🔒 特権操作に特化したAPI代行</div>
        <div class="item-desc">
          ・旧スプレッドシート処理を全撤廃し純API化<br>
          ・ブラウザから直接叩けないGoogle特権APIの代行<br>
          ・固定デプロイID (URL不変) による安定稼働
        </div>
      </div>

      <div class="node-item" style="border-left-color: #FBBF24;">
        <div class="item-title">📅 api_events.js & calendar_service.js</div>
        <div class="item-desc">
          ・Google Calendar API v3 連携<br>
          ・予定の一括取得・更新・出席者同期<br>
          ・PWAからのPOSTリクエストを仲介
        </div>
      </div>

      <div class="node-item" style="border-left-color: #D97706;">
        <div class="item-title">🔑 api_auth.js & GasSupabaseService</div>
        <div class="item-desc">
          ・Google OAuth 2.0 認可コード交換<br>
          ・Script Properties に秘密情報を安全隔離<br>
          ・Supabase DB へOAuthトークンを暗号化保管
        </div>
      </div>
    </div>

    <!-- 下段: Google Workspace / External API -->
    <div class="node-card border-google" style="flex: 0.85;">
      <div class="node-header">
        <div class="node-title text-google">
          <span>☁️</span> 5. Google Workspace / API
        </div>
        <div class="node-badge badge-google">External Cloud</div>
      </div>

      <div class="node-item" style="border-left-color: #2563EB;">
        <div class="item-title">📅 Google カレンダー (チーム共有)</div>
        <div class="item-desc">
          ・公式チームカレンダーの予定データ原本<br>
          ・練習、TRM、公式戦のスケジュール管理<br>
          ・出席者ステータス (Accepted/Declined) 反映
        </div>
      </div>

      <div class="node-item" style="border-left-color: #60A5FA;">
        <div class="item-title">🔐 Google OAuth 2.0 認証基盤</div>
        <div class="item-desc">
          ・初回Googleアカウント連携時の本人確認<br>
          ・カレンダー編集スコープの認可トークン発行
        </div>
      </div>
    </div>
  </div>

</div>

<!-- フッター: 通信プロトコル凡例 -->
<div class="footer-legend">
  <div style="font-weight: 700; color: #F1F5F9;">【サーバー間・クライアント間 通信凡例】</div>
  <div class="legend-pills">
    <div class="legend-pill"><span class="dot dot-fast"></span> <b>①〜③ クライアント直接通信:</b> HTTPS REST / Storage <b>(0.1〜0.3秒 超高速) ★全通信の90%★</b></div>
    <div class="legend-pill"><span class="dot dot-gas"></span> <b>④〜⑤ 特権代行通信:</b> HTTPS POST ➔ Google Calendar API <b>(~0.8〜1.2秒)</b></div>
    <div class="legend-pill"><span class="dot dot-auth"></span> <b>⑥ トークン永続化通信:</b> GAS ➔ Supabase <b>(暗号化保管)</b></div>
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
            page = browser.new_page(viewport={"width": 1400, "height": 840})
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
