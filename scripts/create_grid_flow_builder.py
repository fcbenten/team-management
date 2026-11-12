# -*- coding: utf-8 -*-
"""
create_grid_flow_builder.py
FC Benten チーム管理システム 方眼紙グリッド (列幅2.0固定) システム相関図シート生成ビルダー
（GitHub Pages PWA + Supabase PostgreSQL 17 Tokyo + Google Apps Script アーキテクチャ Ver 2.0.0 対応版）
"""
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.drawing.image import Image
from create_grid_spec_builder import (
    GRID_TOTAL_COLS, GRID_COL_WIDTH, set_grid_columns, merge_and_style,
    f_title, f_sec_h1, f_sec_h2, f_th, f_td, f_td_bold, f_td_code,
    fill_navy, fill_blue_med, fill_green_med, fill_bg_light, fill_even, fill_odd, fill_area,
    border_box, border_th, al_center, al_left, al_top_left, al_top_center
)
from render_flow_diagram import generate_diagram_image

def build_grid_flow_sheet(wb):
    """
    システム相関図（システム構成・通信相関図）シートを生成する。
    """
    ws = wb.create_sheet(title="【システム相関図】", index=1)
    ws.views.sheetView[0].showGridLines = True
    set_grid_columns(ws, GRID_TOTAL_COLS, GRID_COL_WIDTH)

    # 1. タイトルバー
    merge_and_style(ws, 1, 1, 1, GRID_TOTAL_COLS,
                    value="FC Benten チーム管理システム システム構成・通信相関図 (System Architecture & Interactions)",
                    font=f_title, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[1].height = 30

    merge_and_style(ws, 2, 1, 2, GRID_TOTAL_COLS,
                    value="GitHub Pages (PWA静的ホスティング) ＋ Supabase (PostgreSQL 17 Tokyo) ＋ Google Apps Script 特権代行ハイブリッド基盤",
                    font=Font(name="Meiryo UI", size=9.5, color="EFF6FF"), fill=fill_navy,
                    alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[2].height = 20

    curr_r = 4

    # =========================================================================
    # 1. システム全体相関図（ビジュアルダイアグラム画像）
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="1. システム全体相関図（ユーザー端末 ⇄ GitHub Pages ⇄ Supabase Tokyo ⇄ GAS ⇄ Google カレンダー）",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    # ダイアグラム画像を生成してシートに挿入
    png_path = generate_diagram_image()
    if os.path.exists(png_path):
        img = Image(png_path)
        img.width = 1180
        img.height = 607
        ws.add_image(img, f"A{curr_r}")

    # 画像の高さに合わせて行の高さを確保
    image_rows = 31
    for r in range(curr_r, curr_r + image_rows):
        ws.row_dimensions[r].height = 20
    curr_r += image_rows

    curr_r += 1  # 空白行

    # =========================================================================
    # 2. サーバー・ホスティング配置一覧表
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="2. サーバー・ホスティング配置一覧（各サーバーの所在・稼働資産・役割定義）",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    headers_server = [
        ("No", 1, 3, al_center),
        ("サーバー / サービス名", 4, 15, al_center),
        ("ホスティング環境 / リージョン", 16, 28, al_center),
        ("稼働資産 / エンドポイントURL", 29, 45, al_center),
        ("役割・担当機能", 46, 64, al_center),
        ("特徴・技術仕様", 65, 80, al_center)
    ]
    for h, sc, ec, al in headers_server:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    servers_data = [
        ("1", "ユーザー端末\n(Client)", "スマートフォン (iOS / Android)\nPC ブラウザ", "・Webアプリ (PWA / SPA)\n・LINEアプリ (部員のスマホ)",
         "・PWA画面の0秒レンダリング・楽観的UI更新\n・Supabase JWTセッション管理\n・LINEアプリでの雨天中止/リマインド通知受信",
         "・GitHub Pages から配信され端末上で実行\n・WebアプリからSupabaseおよびGoogleへ直接通信\n・部員個人のスマホへLINEプッシュ着信"),
        ("2", "Webホスティング\n(GitHub Pages)", "GitHub Pages Global CDN\n(gh-pages ブランチ)", "https://fcbenten.github.io/team-management/\n・index.html (HTML/CSS/JSバンドル)\n・sw.js / manifest.json",
         "・★Webアプリ本体のホスティング・配信元★\n・ブラウザ初回アクセス時のPWA配信\n・Service Worker キャッシュによる高速ロード",
         "・ソースコード(main)とPWA配信(gh-pages)を完全分離\n・SupabaseではなくGitHub Pagesにアプリが載っている\n・HTTPS GET による超高速配信 (0.05〜0.1秒)"),
        ("3", "クラウドデータベース\n(Supabase)", "Supabase Cloud\n東京リージョン (ap-northeast-1)", "PostgreSQL 17.11 データベース\nPostgREST API (/rest/v1/*)\nSupabase Storage (/storage/v1/*)",
         "・★全業務データの保管・高速永続化 (90%以上)★\n・全10リレーショナルテーブルのCRUD\n・アバター写真のCDN配信・アップロード",
         "・アプリが載る場所ではなく『データ保管庫』\n・端末のWebアプリから直接REST通信 (0.1〜0.3秒)\n・Row Level Security (RLS) によるDB層認可保護"),
        ("4", "特権代行 ＆ 予定管理\n(Google サービス)", "Google Cloud / GAS\n東京 / グローバル サーバーレス", "GAS Web App (固定デプロイID)\n・Google カレンダー API v3\n・Google OAuth 2.0 認証基盤",
         "・ブラウザから直接叩けないGoogle特権APIの代行\n・チーム共有カレンダーの予定一括取得・同期\n・LINE通知・プッシュ通知の自動配信トリガー",
         "・端末のWebアプリと直接通信 (予定同期・OAuth)\n・OAuth Client Secret を Script Properties に安全隔離\n・Supabaseとは通信せずWebアプリの要求を代行"),
        ("5", "通知配信プラットフォーム\n(LINE Platform)", "LINE Corporation\nGlobal Cloud", "LINE Messaging API\n(FC Benten 公式アカウント)",
         "・雨天中止などの緊急一斉通知\n・活動前日の出欠未回答者リマインド配信\n・重要アナウンスのプッシュ着信",
         "・GASからWebhook経由で通知発信\n・部員のスマートフォン(LINEアプリ)へ直接プッシュ着信\n・メールよりも圧倒的に高い即時確認率")
    ]

    for s_idx, s in enumerate(servers_data):
        fill_curr = fill_even if s_idx % 2 == 0 else fill_odd
        line_cnt = max(len(s[1].split('\n')), len(s[3].split('\n')), len(s[4].split('\n')), len(s[5].split('\n')))
        ws.row_dimensions[curr_r].height = max(26, line_cnt * 16 + 6)
        cols = [
            (1, 3, s[0], f_td_bold, al_top_center),
            (4, 15, s[1], f_td_bold, al_top_left),
            (16, 28, s[2], f_td, al_top_left),
            (29, 45, s[3], f_td_code, al_top_left),
            (46, 64, s[4], f_td, al_top_left),
            (65, 80, s[5], f_td, al_top_left)
        ]
        for sc, ec, val, fnt, al in cols:
            merge_and_style(ws, curr_r, sc, curr_r, ec, value=val, font=fnt, fill=fill_curr, alignment=al)
        curr_r += 1

    curr_r += 1  # 空白行

    # =========================================================================
    # 3. サーバー間・クライアント間 通信プロトコル相関表
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="3. サーバー間・クライアント間 通信プロトコル相関表（通信経路・プロトコル・認証・応答速度）",
                    font=f_sec_h1, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    headers_comm = [
        ("通信ID", 1, 5, al_center),
        ("送信元 (From) ➔ 送信先 (To)", 6, 21, al_center),
        ("プロトコル / 方式", 22, 31, al_center),
        ("認証・認可方式", 32, 43, al_center),
        ("主な送受信データ", 44, 58, al_center),
        ("応答速度目安", 59, 68, al_center),
        ("対象画面・機能", 69, 80, al_center)
    ]
    for h, sc, ec, al in headers_comm:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    comms_data = [
        ("COMM-01", "GitHub Pages ➔ ユーザー端末", "HTTPS GET\n(Static CDN)", "認証なし (公開静的配信)",
         "PWAバンドル資産 (index.html, manifest.json, sw.js, アイコン画像)", "0.05〜0.1秒\n(超高速)", "初回アクセス・画面リロード\n(Webアプリの配信)"),
        ("COMM-02\n★主通信★", "ユーザー端末 [Webアプリ] ⇄ Supabase", "HTTPS Direct REST\n(GET/POST/PATCH/DELETE)", "Supabase JWT (Bearer Token)\n＋ Row Level Security (RLS)",
         "全業務データのJSONペイロード (members, matches, score_logs, attendance, equipment, bulletin 等)", "0.1〜0.3秒\n(超高速 爆速化)", "全業務画面 (出欠、試合、掲示板、備品、名簿等 全通信の90%以上)"),
        ("COMM-03", "ユーザー端末 [Webアプリ] ⇄ Supabase Storage", "HTTPS GET (CDN閲覧)\nHTTPS POST (Upload)", "Supabase JWT (アップロード時)\n公開バケット (閲覧時)",
         "アバター画像バイナリ (256x256 クロップド JPEG/PNG 画像データ)", "0.2〜0.4秒\n(高速CDN)", "SCR11: プロフィール画像アップロード\n各画面の顔写真アイコン表示"),
        ("COMM-04", "ユーザー端末 [Webアプリ] ⇄ Google サービス", "HTTPS POST\n(JSON RPC / Bridge)", "なし (関数名＋引数ペイロード)\nOAuth 認可コード",
         "Google カレンダー予定一括取得・同期要求、OAuth 認可コード交換", "0.8〜1.2秒\n(Google基盤依存)", "SCR01: 初回Googleアカウント連携\nSCR07: 予定作成・同期"),
        ("COMM-05", "Google Apps Script ⇄ Google カレンダー", "Google API v3\n(OAuth 2.0)", "OAuth 2.0 Bearer Token\n(カレンダー編集スコープ)",
         "Google カレンダー予定イベント (日時、場所、タイトル、出席者Accepted/Declined)", "0.4〜0.6秒\n(Google内部通信)", "SCR07: チーム公式カレンダーの原本同期"),
        ("COMM-06", "Google Apps Script ➔ LINE Platform", "HTTPS POST\n(Messaging API)", "LINE Channel Access Token\n(Bearer認証)",
         "雨天中止連絡、前日出欠未回答リマインド、重要掲示板アナウンスのプッシュ送信", "0.3〜0.5秒\n(LINEサーバー送信)", "雨天中止時・出欠リマインド時"),
        ("COMM-07", "LINE Platform ➔ ユーザー端末 [LINEアプリ]", "LINE Push\n(APNs / FCM)", "LINE アカウント紐付け",
         "部員個人のスマートフォン（LINEアプリ）へのプッシュ通知着信", "即時着信\n(リアルタイム)", "部員のスマホ通知画面")
    ]

    for c_idx, c in enumerate(comms_data):
        fill_curr = fill_even if c_idx % 2 == 0 else fill_odd
        line_cnt = max(len(c[1].split('\n')), len(c[3].split('\n')), len(c[4].split('\n')), len(c[5].split('\n')), len(c[6].split('\n')))
        ws.row_dimensions[curr_r].height = max(26, line_cnt * 16 + 6)
        cols = [
            (1, 5, c[0], f_td_bold, al_top_center),
            (6, 21, c[1], f_td_bold, al_top_left),
            (22, 31, c[2], f_td_code, al_top_left),
            (33, 43, c[3], f_td, al_top_left),
            (44, 58, c[4], f_td, al_top_left),
            (59, 68, c[5], f_td_bold, al_top_center),
            (69, 80, c[6], f_td, al_top_left)
        ]
        for sc, ec, val, fnt, al in cols:
            merge_and_style(ws, curr_r, sc, curr_r, ec, value=val, font=fnt, fill=fill_curr, alignment=al)
        curr_r += 1

    curr_r += 1  # 空白行

    # =========================================================================
    # 4. 新アーキテクチャの設計思想とセキュリティ・高速化の仕組み
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="4. 新アーキテクチャの設計思想・高速化およびセキュリティ設計",
                    font=f_sec_h1, fill=fill_green_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    design_blocks = [
        (
            "① 0.3秒爆速化のメカニズム (Supabase Direct 通信)",
            "【旧GAS・スプレッドシート時代】\n"
            "ブラウザ ➔ GASサーバー (起動2秒) ➔ Google Drive API ➔ スプレッドシート3ファイル直列読込 (3.4秒) ＝ 合計 6〜7秒 の大きな待機時間が発生していた。\n\n"
            "【新アーキテクチャ (Ver 2.0.0)】\n"
            "東京リージョン (ap-northeast-1) に配置された Supabase PostgREST へ、端末ブラウザから直接 HTTPS 通信を実行。\n"
            "多段中継を完全排除したことで、全CRUD操作（出欠、試合、掲示板、備品、名簿）が 0.1〜0.3 秒で完了する超高速レスポンスを実現。"
        ),
        (
            "② Row Level Security (RLS) によるデータベース層での認可保護",
            "【クライアント直接通信に伴うセキュリティ担保】\n"
            "ブラウザからDBへ直接接続する構成をとるため、認可制御はアプリ層ではなく PostgreSQL の Row Level Security (RLS) で物理強制。\n\n"
            "【厳格なポリシー定義】\n"
            "・members: 代表・副代表のみ編集・追加可能。一般部員は自身のプロフィール情報のみ更新可能。\n"
            "・attendance: ログインユーザー本人の member_id のみ出欠の登録・変更が可能。\n"
            "・bulletin_posts: 全部員が自由に起票・共同編集可能 (Wikiスタイル)。削除は起票者または代表のみ。\n"
            "※ 万が一フロントエンドのコードが改ざんされても、不正な通信は PostgreSQL エンジンが拒否。"
        ),
        (
            "③ 特権操作の局所化とシークレット完全隔離 (GAS特権代行)",
            "【最小特権アーキテクチャ】\n"
            "Google カレンダーの更新や Google OAuth 認可コード交換など、「秘密鍵 (Client Secret) を要する特権処理」のみを Google Apps Script に限定。\n\n"
            "【機密情報の保護】\n"
            "Google OAuth Client Secret や Supabase サービスロールキーは、コード内・Gitリポジトリに一切保持せず、GAS の Script Properties に永続保管。\n"
            "クライアント端末には一切秘密鍵を露出させず、安全な API 仲介を実現。"
        ),
        (
            "④ PWA ＆ Service Worker による二層オフライン保護",
            "【グラウンド・遠征先での安定稼働】\n"
            "GitHub Pages CDN から配信される静的PWAアセットは、Service Worker (sw.js) により端末内にローカルキャッシュ。\n\n"
            "【オフライン・電波微弱環境への対応】\n"
            "電波の届きにくいグラウンドや体育館でも、アプリ自体は 0.0 秒で瞬時に起動。\n"
            "出欠タップや掲示板ピン留めなどは「0秒楽観的UIレンダリング」により画面を即座に更新し、通信復帰後にバックグラウンドで自動同期。"
        ),
        (
            "⑤ WEBアプリの所在と各サービスの明確な役割分担（GitHub Pages・Supabase・Google・LINE）",
            "【Webアプリはどこにあるか？】\n"
            "Webアプリ本体（HTML / CSS / JavaScript / PWAバンドル）がホスティングされているのは『GitHub Pages』です。\n"
            "Supabase にアプリが載っているわけではありません。ユーザーがスマホやPCでアクセスすると、GitHub Pages からアプリが端末へ配信・キャッシュされ、端末のブラウザ上でアプリが実行されます。\n\n"
            "【Supabase の役割（クラウドデータベース）】\n"
            "Supabase はアプリの置き場ではなく、端末で動くWebアプリから直接接続する『クラウドデータベース（PostgreSQL 17 / Auth / Storage）』です。\n"
            "出欠、試合記録、掲示板、名簿、備品などの全データを 0.1〜0.3 秒の超高速で直接読み書きします。\n\n"
            "【Google サービスとの通信（Webアプリ ⇄ Google）】\n"
            "カレンダー予定の同期やGoogleアカウント連携は、端末の『Webアプリ』から直接『Google サービス（GAS ＆ Google カレンダー）』へ通信して実行します。\n"
            "Supabase の認証やストレージがカレンダーと通信することはありません。\n\n"
            "【LINE通知の流れ（LINE ➔ ユーザーのスマホ）】\n"
            "雨天中止や出欠リマインドが発生すると、GAS から LINE Messaging API を経由して、部員のスマートフォン内の『LINE アプリ』へ直接プッシュ通知が届きます。"
        )
    ]

    for title, desc in design_blocks:
        merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value=title,
                        font=f_sec_h2, fill=fill_bg_light, alignment=Alignment(horizontal="left", vertical="center", indent=1))
        ws.row_dimensions[curr_r].height = 22
        curr_r += 1

        line_cnt = len(desc.split('\n'))
        ws.row_dimensions[curr_r].height = max(24, line_cnt * 16 + 8)
        merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value=desc,
                        font=f_td, fill=fill_odd, alignment=al_top_left)
        curr_r += 1
        curr_r += 1  # 余白行

    print("System Architecture & Interaction Sheet successfully built.")
    return ws
