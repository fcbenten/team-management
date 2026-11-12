# -*- coding: utf-8 -*-
"""
render_flow_diagram.py
Playwrightを用いて高精細なデータ保存フロー図（PNG画像）を生成するスクリプト
（Supabase PostgreSQL 17 + Supabase Storage + Google Calendar API アーキテクチャ対応版）
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
    background: #0F172A;
    color: #F8FAFC;
    padding: 30px;
    width: 1400px;
  }
  .header {
    text-align: center;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 2px solid #334155;
  }
  .header h1 {
    font-size: 26px;
    font-weight: 800;
    color: #38BDF8;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
  .header p {
    font-size: 13px;
    color: #94A3B8;
  }
  
  .diagram-container {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 20px;
    position: relative;
  }
  
  /* カラム共通 */
  .column {
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
  }
  .col-title {
    font-size: 14px;
    font-weight: bold;
    padding: 8px 12px;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 14px;
    letter-spacing: 0.05em;
  }
  
  /* 左カラム: SPAクライアント */
  .col-client {
    flex: 1.1;
    background: #1E293B;
    border: 1px solid #3B82F6;
  }
  .col-client .col-title {
    background: linear-gradient(135deg, #1D4ED8, #3B82F6);
    color: #FFFFFF;
  }
  
  /* 中央カラム: APIレイヤー */
  .col-gas {
    flex: 0.95;
    background: #1E293B;
    border: 1px solid #10B981;
  }
  .col-gas .col-title {
    background: linear-gradient(135deg, #047857, #10B981);
    color: #FFFFFF;
  }
  
  /* 右カラム: Supabase DB & ストレージ */
  .col-storage {
    flex: 1.35;
    background: #1E293B;
    border: 1px solid #8B5CF6;
  }
  .col-storage .col-title {
    background: linear-gradient(135deg, #6D28D9, #8B5CF6);
    color: #FFFFFF;
  }
  
  /* カード・ノードスタイル */
  .flow-card {
    background: #0F172A;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
    border-left: 4px solid #64748B;
    font-size: 11px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .flow-card:last-child { margin-bottom: 0; }
  
  .card-screen { border-left-color: #38BDF8; }
  .card-api { border-left-color: #34D399; }
  .card-db { border-left-color: #F59E0B; }
  .card-storage { border-left-color: #A78BFA; }
  .card-calendar { border-left-color: #60A5FA; }
  
  .flow-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .card-title {
    font-weight: bold;
    font-size: 12px;
    color: #F1F5F9;
  }
  .badge {
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  .badge-trigger { background: #0369A1; color: #E0F2FE; }
  .badge-api { background: #065F46; color: #D1FAE5; }
  .badge-table { background: #B45309; color: #FEF3C7; }
  .badge-storage { background: #6D28D9; color: #EDE9FE; }
  .badge-external { background: #1E40AF; color: #DBEAFE; }
  
  .card-desc {
    color: #94A3B8;
    line-height: 1.4;
    font-size: 10.5px;
  }
  .arrow-inline {
    display: inline-block;
    color: #38BDF8;
    font-weight: bold;
    margin: 0 4px;
  }
  
  /* コネクタ列 */
  .connector {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 48px;
  }
  .connector-text {
    font-size: 10px;
    font-weight: bold;
    color: #38BDF8;
    background: #0F172A;
    padding: 6px 4px;
    border-radius: 6px;
    border: 1px solid #334155;
    text-align: center;
    line-height: 1.3;
    margin: 8px 0;
  }
  .conn-arrow {
    font-size: 20px;
    color: #38BDF8;
    margin: 4px 0;
  }
  
  /* フッター凡例 */
  .legend-box {
    margin-top: 20px;
    padding: 12px 18px;
    background: #1E293B;
    border-radius: 8px;
    border: 1px solid #334155;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }
  .legend-items {
    display: flex;
    gap: 18px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .color-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
</style>
</head>
<body>

<div class="header">
  <h1>FC BENTEN チーム管理システム データ保存・連携フロー図 (Ver 2.0.0)</h1>
  <p>SPA画面からSupabase PostgREST API (0.3秒応答) を経由し、PostgreSQL 17 (Tokyo)・Supabase Storage・Googleカレンダーへデータが高速永続化される流れ</p>
</div>

<div class="diagram-container">
  
  <!-- カラム1: SPA画面 -->
  <div class="column col-client">
    <div class="col-title">1. SPA画面 (操作トリガー)</div>
    
    <div class="flow-card card-screen">
      <div class="flow-card-header">
        <span class="card-title">SCR01: ログイン・初回登録</span>
        <span class="badge badge-trigger">クリック時</span>
      </div>
      <div class="card-desc">
        ・ログインボタン押下 <span class="arrow-inline">➔</span> members照合 (0.1s)<br>
        ・登録完了ボタン押下 <span class="arrow-inline">➔</span> パスワードハッシュ登録
      </div>
    </div>

    <div class="flow-card card-screen">
      <div class="flow-card-header">
        <span class="card-title">SCR04: 試合結果入力</span>
        <span class="badge badge-trigger">クリック時</span>
      </div>
      <div class="card-desc">
        ・試合結果保存ボタン押下<br>
        <span class="arrow-inline">➔</span> matches ＆ score_logs トランザクション保存
      </div>
    </div>

    <div class="flow-card card-screen">
      <div class="flow-card-header">
        <span class="card-title">SCR07: スケジュール・出欠</span>
        <span class="badge badge-trigger">ワンタップ</span>
      </div>
      <div class="card-desc">
        ・出欠（○/×/△）ボタン押下 <span class="arrow-inline">➔</span> 0秒楽観的UI＋attendance保存<br>
        ・予定保存ボタン押下 <span class="arrow-inline">➔</span> Googleカレンダー予定同期
      </div>
    </div>

    <div class="flow-card card-screen">
      <div class="flow-card-header">
        <span class="card-title">SCR08: 備品管理・代理解決</span>
        <span class="badge badge-trigger">クリック時</span>
      </div>
      <div class="card-desc">
        ・代理解決確定ボタン押下 <span class="arrow-inline">➔</span> equipment_event_logs割当<br>
        ・現物登録・保管者変更 <span class="arrow-inline">➔</span> equipment_items即時更新
      </div>
    </div>

    <div class="flow-card card-screen">
      <div class="flow-card-header">
        <span class="card-title">SCR09: 活動記録・掲示板</span>
        <span class="badge badge-trigger">投稿/タップ</span>
      </div>
      <div class="card-desc">
        ・投稿実行ボタン押下 <span class="arrow-inline">➔</span> bulletin_posts保存<br>
        ・記事タップ <span class="arrow-inline">➔</span> bulletin_reads既読 / コメント登録
      </div>
    </div>

    <div class="flow-card card-screen">
      <div class="flow-card-header">
        <span class="card-title">SCR10: メンバー管理</span>
        <span class="badge badge-trigger">クリック時</span>
      </div>
      <div class="card-desc">
        ・部員プロフ更新 <span class="arrow-inline">➔</span> members行直接更新<br>
        ・退部確定 <span class="arrow-inline">➔</span> is_past=true ＆ 所持備品引継ぎ
      </div>
    </div>

    <div class="flow-card card-screen">
      <div class="flow-card-header">
        <span class="card-title">SCR11: 設定 (マイページ)</span>
        <span class="badge badge-trigger">選択変更時</span>
      </div>
      <div class="card-desc">
        ・写真選択時 <span class="arrow-inline">➔</span> member-avatarsバケットアップロード<br>
        ・通知設定変更 <span class="arrow-inline">➔</span> notify_settings即時保存
      </div>
    </div>
  </div>

  <!-- コネクタ 1 -->
  <div class="connector">
    <div class="conn-arrow">➔</div>
    <div class="connector-text">HTTPS<br>REST<br>(JSON)<br>0.3s</div>
    <div class="conn-arrow">➔</div>
  </div>

  <!-- カラム2: 通信・APIレイヤー -->
  <div class="column col-gas">
    <div class="col-title">2. 通信・APIレイヤー</div>

    <div class="flow-card card-api">
      <div class="flow-card-header">
        <span class="card-title">PostgREST REST API</span>
        <span class="badge badge-api">Supabase Engine</span>
      </div>
      <div class="card-desc">
        PostgreSQLテーブルと直結したHTTPS/RESTエンドポイント。0.1〜0.3秒の極小レイテンシでJSONを直接返却。
      </div>
    </div>

    <div class="flow-card card-api">
      <div class="flow-card-header">
        <span class="card-title">Row Level Security (RLS)</span>
        <span class="badge badge-api">アクセス制御</span>
      </div>
      <div class="card-desc">
        anon / authenticated ロールに対する各テーブルごとのアクセス権限制御。
      </div>
    </div>

    <div class="flow-card card-api">
      <div class="flow-card-header">
        <span class="card-title">Supabase Storage API</span>
        <span class="badge badge-api">画像CDN</span>
      </div>
      <div class="card-desc">
        プロフィール写真バイナリのアップロード・署名不要グローバルCDN高速配信。
      </div>
    </div>

    <div class="flow-card card-api">
      <div class="flow-card-header">
        <span class="card-title">Google Calendar API (v3)</span>
        <span class="badge badge-api">外部連携</span>
      </div>
      <div class="card-desc">
        チーム共有カレンダーの予定一括取得、出席者ステータス (Yes/No/Maybe) の双方向同期。
      </div>
    </div>
  </div>

  <!-- コネクタ 2 -->
  <div class="connector">
    <div class="conn-arrow">➔</div>
    <div class="connector-text">Direct<br>SQL /<br>CDN<br>50ms</div>
    <div class="conn-arrow">➔</div>
  </div>

  <!-- カラム3: 永続ストレージ -->
  <div class="column col-storage">
    <div class="col-title">3. データベース & クラウドストレージ (Supabase Tokyo)</div>

    <div class="flow-card card-db">
      <div class="flow-card-header">
        <span class="card-title">【members】 メンバー名簿</span>
        <span class="badge badge-table">PostgreSQL 17</span>
      </div>
      <div class="card-desc">
        選手・役員・スタッフ基本情報、背番号、役職、認証ハッシュ、通知設定、OBアーカイブ
      </div>
    </div>

    <div class="flow-card card-db">
      <div class="flow-card-header">
        <span class="card-title">【matches ＆ score_logs】 試合・詳細ログ</span>
        <span class="badge badge-table">PostgreSQL 17</span>
      </div>
      <div class="card-desc">
        試合サマリー、スコア、勝敗、時系列得失点ログ、アシスト、警告カード、MOM
      </div>
    </div>

    <div class="flow-card card-db">
      <div class="flow-card-header">
        <span class="card-title">【attendance】 予定出欠</span>
        <span class="badge badge-table">PostgreSQL 17</span>
      </div>
      <div class="card-desc">
        活動ごとの部員出欠回答 (yes/no/maybe)、理由コメント、車出し台数管理
      </div>
    </div>

    <div class="flow-card card-db">
      <div class="flow-card-header">
        <span class="card-title">【equipment_master / items / event_logs】 備品管理</span>
        <span class="badge badge-table">PostgreSQL 17</span>
      </div>
      <div class="card-desc">
        品目定義・必須ルールマスタ、現物台帳・保管担当者、活動別当番割当・代理持参記録
      </div>
    </div>

    <div class="flow-card card-db">
      <div class="flow-card-header">
        <span class="card-title">【bulletin_posts / reads / comments】 掲示板</span>
        <span class="badge badge-table">PostgreSQL 17</span>
      </div>
      <div class="card-desc">
        活動記録・Wiki記事、ホームピン留め、部員別既読追跡、コメントスレッド
      </div>
    </div>

    <div class="flow-card card-storage">
      <div class="flow-card-header">
        <span class="card-title">【member-avatars】 プロフィール画像</span>
        <span class="badge badge-storage">Supabase Storage</span>
      </div>
      <div class="card-desc">
        部員アバター画像（PNG/JPEG）。グローバルCDN直結配信で50ms未満の超高速表示。
      </div>
    </div>

    <div class="flow-card card-calendar">
      <div class="flow-card-header">
        <span class="card-title">Google カレンダー (CALENDAR_ID)</span>
        <span class="badge badge-external">外部サービス</span>
      </div>
      <div class="card-desc">
        チーム共有カレンダー: 練習・試合・イベントの日時、会場、Google予定詳細
      </div>
    </div>
  </div>

</div>

<div class="legend-box">
  <span style="font-weight:bold; color:#E2E8F0;">凡例 / データ種別:</span>
  <div class="legend-items">
    <div class="legend-item"><span class="color-dot" style="background:#38BDF8;"></span> SPA画面 (PWA)</div>
    <div class="legend-item"><span class="color-dot" style="background:#34D399;"></span> PostgREST API / Storage API</div>
    <div class="legend-item"><span class="color-dot" style="background:#F59E0B;"></span> PostgreSQL テーブル (全10種)</div>
    <div class="legend-item"><span class="color-dot" style="background:#A78BFA;"></span> Supabase Storage</div>
    <div class="legend-item"><span class="color-dot" style="background:#60A5FA;"></span> Googleカレンダー</div>
  </div>
  <span style="color:#94A3B8;">※詳細は別冊『FC_Benten_データベーステーブル仕様書.xlsx』参照</span>
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
