# -*- coding: utf-8 -*-
"""
FC Benten チーム管理システム 方眼紙グリッド 表紙生成ビルダー
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from create_grid_spec_builder import (
    GRID_TOTAL_COLS, GRID_COL_WIDTH, set_grid_columns, merge_and_style,
    f_title, f_sec_h1, f_sec_h2, f_th, f_td, f_td_bold, f_td_code,
    fill_navy, fill_blue_med, fill_bg_light, fill_even, fill_odd,
    border_box, border_th, al_center, al_left, al_top_left, al_top_center
)

def build_grid_cover_sheet(wb):
    ws = wb.active
    ws.title = "【表紙・システム概要】"
    ws.views.sheetView[0].showGridLines = True
    set_grid_columns(ws, GRID_TOTAL_COLS, GRID_COL_WIDTH)

    f_main = Font(name="Meiryo UI", size=18, bold=True, color="FFFFFF")
    f_sub = Font(name="Meiryo UI", size=11, color="EFF6FF")

    # 1. 表紙タイトルバー (Row 1, 2)
    merge_and_style(ws, 1, 1, 1, GRID_TOTAL_COLS, value="FC Benten チーム管理システム",
                    font=f_main, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    merge_and_style(ws, 2, 1, 2, GRID_TOTAL_COLS, value="システム全体機能仕様書 兼 画面設計・バリデーション定義書 (Ver 2.0.0 Supabase DB連携版)",
                    font=f_sub, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 20

    # 文書基本情報 (Row 4〜7)
    doc_meta = [
        ("対象システム", "FC Benten チーム管理システム (TeamManagement)", "初版作成日", "2026/11/04"),
        ("システム種別", "SPA Webアプリケーション (PWA対応 / Supabase DB連携)", "最終改定日", "2026/11/12"),
        ("開発・運用基盤", "Supabase (PostgreSQL 17 Tokyo) + GitHub Pages (PWA) + Google Apps Script", "文書バージョン", "Ver 2.1.0 (システム相関図・通信プロトコル仕様刷新版)"),
        ("管理リポジトリ", "d:\\app\\TeamManagement / fcbenten.github.io/team-management", "ステータス", "本番運用中 (Active)")
    ]
    curr_r = 4
    for row in doc_meta:
        merge_and_style(ws, curr_r, 1, curr_r, 16, value=row[0], font=f_sec_h2, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 17, curr_r, 44, value=row[1], font=f_td, fill=fill_odd, alignment=al_left)
        merge_and_style(ws, curr_r, 45, curr_r, 58, value=row[2], font=f_sec_h2, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 59, curr_r, GRID_TOTAL_COLS, value=row[3], font=f_td, fill=fill_odd, alignment=al_left)
        ws.row_dimensions[curr_r].height = 20
        curr_r += 1

    # 2. システム概要・基盤構成 (Row 9〜)
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="1. システム概要と基盤アーキテクチャ",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    arch_rows = [
        ("フロントエンド (UI/UX)", "HTML5 / CSS3 (レスポンシブ設計・CSS変数によるテーマ管理) / Vanilla JavaScript (ES6+)\n単一ページアプリケーション (SPA) 構造を採用し、画面リロードなしで高速なビュー切り替えを実現。"),
        ("ホスティング & PWA", "GitHub Pages (https://fcbenten.github.io/team-management/)\nService Worker (sw.js) により、HTMLフレームは常に最新をネットワーク優先 (Network First) で取得。\n端末のホーム画面に追加してネイティブアプリ感覚でフルスクリーン起動可能。"),
        ("バックエンド API", "Supabase REST API (PostgREST / JSON直接通信)\n東京リージョン (ap-northeast-1) からの超低遅延レスポンス (0.3〜0.5秒) を実現。\nRow Level Security (RLS) によるデータアクセス保護、リアルタイム出欠更新に対応。"),
        ("データベース (永続化)", "Supabase (PostgreSQL 17.11 / Tokyo Region) + Supabase Storage\n全10リレーショナルテーブル＋画像バケットによる高信頼性・爆速データ管理。\n※詳細な各テーブルカラム・型・インデックス・RLS定義は別冊『FC_Benten_データベーステーブル仕様書.xlsx』を参照。\n・members (名簿/OB/認証ハッシュ) / matches (試合サマリー) / score_logs (得点詳細ログ)\n・attendance (予定出欠) / equipment_master・items・event_logs (備品管理)\n・bulletin_posts・reads・comments (活動記録・掲示板) / member-avatars (プロフィール画像CDN)"),
        ("外部サービス連携", "・Google Calendar API (v3): チーム共有カレンダーの予定一括取得、出席者ステータス (Accepted/Declined/Tentative) のリアルタイム更新\n・Google OAuth 2.0: 初回アカウント紐付けとGoogleアカウント本人確認")
    ]
    for comp, desc in arch_rows:
        line_cnt = len(desc.split('\n'))
        ws.row_dimensions[curr_r].height = max(22, line_cnt * 16 + 6)
        merge_and_style(ws, curr_r, 1, curr_r, 18, value=comp, font=f_sec_h2, fill=fill_bg_light, alignment=al_top_left)
        merge_and_style(ws, curr_r, 19, curr_r, GRID_TOTAL_COLS, value=desc, font=f_td, fill=fill_odd, alignment=al_top_left)
        curr_r += 1

    # 3. 権限ロール体系
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="2. 権限ロール体系と機能アクセス制御",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    role_headers = [
        ("ロール名", 1, 8), ("内部コード", 9, 16), ("対象ユーザー", 17, 26), 
        ("スコア入力", 27, 33), ("メンバー管理", 34, 42), ("備品追加/削除", 43, 50), 
        ("備品代理解決", 51, 58), ("活動記録・掲示板", 59, 70), ("概要・権限制限", 71, 80)
    ]
    for h, sc, ec in role_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    roles_data = [
        ("代表", "ADMIN", "チーム代表者", "可能", "全権限", "可能", "可能", "全権限 (ピン留め/編集/削除)", "最上位管理者。全データの閲覧・編集・削除、ロール変更が可能。"),
        ("副代表", "SUB_ADMIN", "副代表・役員", "可能", "編集/追加\n※代表操作不可", "可能", "可能", "全権限 (ピン留め/編集/削除)", "管理業務実行者。メンバー管理・スコア入力・備品登録を担当。上位ロール保護。"),
        ("部員", "MEMBER", "一般選手・メンバー", "可能\n(全部員入力可)", "アクセス不可\n(代表・副代表のみ)", "閲覧のみ", "可能\n(誰でも解決可)", "起票・共同編集可\n(Wikiスタイル)", "一般メンバー。閲覧、出欠回答、予定作成・編集、スコア入力、掲示板投稿・編集、備品代理解決が可能。メンバー管理はアクセス不可。"),
        ("ゲスト/未認証", "GUEST", "未ログイン訪問者", "不可", "不可", "不可", "不可", "不可", "ログイン画面 (SCR01) のみに隔離。認証成功後に部員ロール以上の画面へ遷移。")
    ]
    for r_idx, r in enumerate(roles_data):
        fill_curr = fill_even if r_idx % 2 == 0 else fill_odd
        ws.row_dimensions[curr_r].height = 26
        role_cols = [
            (1, 8, r[0], f_td_bold, al_center),
            (9, 16, r[1], f_td_code, al_center),
            (17, 26, r[2], f_td, al_left),
            (27, 33, r[3], f_td, al_center),
            (34, 42, r[4], f_td, al_center),
            (43, 50, r[5], f_td, al_center),
            (51, 58, r[6], f_td, al_center),
            (59, 70, r[7], f_td, al_center),
            (71, 80, r[8], f_td, al_left)
        ]
        for sc, ec, val, fnt, al in role_cols:
            merge_and_style(ws, curr_r, sc, curr_r, ec, value=val, font=fnt, fill=fill_curr, alignment=al)
        curr_r += 1

    # 4. 画面一覧 (全11画面)
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="3. 画面一覧 (全11画面)",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    scr_headers = [
        ("画面ID", 1, 6), ("シート名", 7, 20), ("画面名称", 21, 34), 
        ("対象ファイル (View / Module)", 35, 48), ("権限", 49, 56), ("主要機能・画面概要", 57, 80)
    ]
    for h, sc, ec in scr_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    screens_list = [
        ("SCR01", "SCR01_ログイン", "ログイン・初期連携画面", "view_login.html\nmain.js", "全ユーザー / ゲスト", "Gmailアドレス・パスワード認証、ログイン保持、初回Google OAuth連携とパスワード設定。"),
        ("SCR02", "SCR02_ホーム", "ホーム画面 (ダッシュボード)", "view_home.html\nhome.js", "全部員", "最上部汎用警告・ピン留めアナウンス、今シーズンチーム戦績KPI、次回活動・公式戦、直近試合結果、最新活動記録、各機能への遷移リンク。"),
        ("SCR03", "SCR03_試合結果", "試合結果画面", "view_results.html\nresults.js", "全部員 (全ユーザー編集可)", "登録済み試合結果の一覧表示、年度・大会別フィルター、詳細モーダル、新規登録遷移、試合結果の編集・削除。"),
        ("SCR04", "SCR04_試合入力", "スコア入力画面", "view_input.html\ninput.js", "全部員 (全ユーザー入力可)", "カレンダー予定からの自動引用 (過去60日〜未来90日)、スコア・得点者・アシスト・警告退場・MOMの新規登録・編集。"),
        ("SCR05", "SCR05_戦績記録", "ランキング画面", "view_ranking.html\nranking.js", "全部員", "年度別および通算の得点王、アシスト王、MOM獲得数、出場試合数ランキングの集計表示。"),
        ("SCR06", "SCR06_個人成績", "個人成績画面", "view_personal.html\npersonal.js", "全部員", "選手ごとの通算スタッツサマリー、年度別成績推移、出場試合一覧タイムラインの表示。初期表示はログイン者自身。"),
        ("SCR07", "SCR07_スケジュール", "スケジュール画面", "view_schedule.html\nschedule.js", "全部員 (全ユーザー作成可)", "月別カレンダーおよびリスト表示、出欠登録 (参加/不参加/未定)、新規予定作成・編集・削除、カレンダーAPI同期。"),
        ("SCR08", "SCR08_備品管理", "備品管理画面", "view_equipment.html\nequipment.js", "全員閲覧/代理解決", "チーム備品現物台帳、活動別要否判定に基づく7日先不在アラート (赤/黄)、誰でも押せる代理解決機能。"),
        ("SCR09", "SCR09_連絡板", "活動記録・掲示板画面", "view_bulletin.html\nbulletin.js", "全部員 (Wikiスタイル)", "チーム連絡・活動振り返りのタイムラインフィード、共同編集、ホームピン留め、既読/未読追跡、コメント機能。"),
        ("SCR10", "SCR10_メンバー管理", "メンバー管理画面", "view_members.html\nmembers.js", "代表・副代表専用", "管理者専用の選手名簿管理 (追加・編集・削除)、背番号・ポジション・メール・ロール設定。一般部員アクセス不可。"),
        ("SCR11", "SCR11_設定", "マイプロフィール・設定画面", "view_personal.html\nmain.js", "全部員", "アバター画像アップロード、通知受信設定、パスワード変更などの個人設定。")
    ]
    for s_idx, s in enumerate(screens_list):
        fill_curr = fill_even if s_idx % 2 == 0 else fill_odd
        ws.row_dimensions[curr_r].height = 26
        s_cols = [
            (1, 6, s[0], f_td_bold, al_center),
            (7, 20, s[1], f_sec_h2, al_left),
            (21, 34, s[2], f_td_bold, al_left),
            (35, 48, s[3], f_td_code, al_left),
            (49, 56, s[4], f_td, al_center),
            (57, 80, s[5], f_td, al_left)
        ]
        for sc, ec, val, fnt, al in s_cols:
            merge_and_style(ws, curr_r, sc, curr_r, ec, value=val, font=fnt, fill=fill_curr, alignment=al)
        curr_r += 1

    # 5. 共通設計規約
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="4. 全体共通設計規約・UI/UXルール",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    rules_data = [
        ("メッセージ表示領域レベル規約\n(info / warning / error)", "全画面のメッセージ表示領域（インラインメッセージ・空状態・汎用バナー）は以下の3段階種別で視覚表現を統一する。\n・info（通常案内・0件表示・完了）: 【無灯】強調色なし（白/通常背景・通常文字色）。年またぎや絞り込み結果0件時はエラーではないため info（無灯）で表示する。\n・warning（注意・事前確認・軽微警告）: 【黄色背景】#FFFBEB（黄枠 #FDE68A / 黄茶文字 #92400E）で注意喚起を表示する。\n・error（エラー・入力不備・緊急警告）: 【赤背景】#FEF2F2（赤枠 #FECACA / 赤文字 #B91C1C）でバリデーションエラー・API/通信失敗・緊急アラートを表示する。"),
        ("トースト通知の完全廃止", "モーダルの裏で消える通知による誤認や操作阻害を防ぐため、アプリ全体でフローティングトースト通知を廃止。\n操作結果は「インラインアラートボックス」または「モーダル内の完了メッセージ」にて確実にユーザーに提示する。"),
        ("画面タイトルの統一", "画面上部に余計なタイトルバーや帯（「メンバー管理 代表・副代表専用 | ...」等）は設置せず、全画面でタイトル部を廃止して表示領域を最大化。不要な罫線も排除。"),
        ("入力チェック・エラー表示の原則", "・単一項目の不備: 各入力フィールドの直下に error 表示（赤文字/赤背景）でインライン表示（フォーカス時に自動消去）。\n・フォーム全体の不備 / サーバー通信エラー: フォーム上部のメッセージ表示領域に error（赤背景）で明示。0件時の正常案内は info（無灯）、注意喚起は warning（黄背景）で区別する。\n・削除などの重要操作: ブラウザ標準の不要な確認アラートを排除し、共通カスタム確認モーダルまたは即時処理で対応。"),
        ("日付・時間の表示形式", "日付は「yyyy/MM/dd」または「MM/DD(曜日)」形式で統一。曜日は必ず日本語1文字（月・火・水・木・金・土・日）を付与。\n時間は24時間表記「HH:mm」とし、「09:00 - 12:00」のようにハイフン区切りで統一。"),
        ("キャッシュ戦略とデータ鮮度", "・試合結果 / 個人スタッツ: スプレッドシート由来の集計データはCacheServiceで6時間キャッシュ（新規登録・更新時に即時クリア）。\n・カレンダー予定 / 出欠データ: Googleカレンダーから常にリアルタイムに最新実データを取得（キャッシュなし）。\n・PWA Service Worker: HTMLフレームは常にネットワーク優先（Network First）とし、古いキャッシュによる先祖返りを防止。"),
        ("アバター画像の形状統一（完全円形）", "サイドバーナビゲーション、ランキング、メンバー名簿、個人スタッツ等、システム全体のアバター画像表示を「丸アイコン（border-radius: 50%）」で完全統一。\n角丸四角などの不揃いを排除し、一貫したUIデザインを徹底する。")
    ]
    for r_title, r_desc in rules_data:
        line_cnt = len(r_desc.split('\n'))
        ws.row_dimensions[curr_r].height = max(24, line_cnt * 16 + 8)
        merge_and_style(ws, curr_r, 1, curr_r, 18, value=r_title, font=f_sec_h2, fill=fill_bg_light, alignment=al_top_left)
        merge_and_style(ws, curr_r, 19, curr_r, GRID_TOTAL_COLS, value=r_desc, font=f_td, fill=fill_odd, alignment=al_top_left)
        curr_r += 1

    ws.freeze_panes = "A4"
    return ws

print("build_grid_cover_sheet ready.")

