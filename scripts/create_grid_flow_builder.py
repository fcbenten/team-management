# -*- coding: utf-8 -*-
"""
create_grid_flow_builder.py
FC Benten チーム管理システム 方眼紙グリッド (列幅2.0固定) システムデータフロー図シート生成ビルダー
（Supabase PostgreSQL 17 + Supabase Storage + Google Calendar API アーキテクチャ Ver 2.0.0 対応版）
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
    データ保存・連携フロー図シートを生成する。
    """
    ws = wb.create_sheet(title="【データ保存フロー図】", index=1)
    ws.views.sheetView[0].showGridLines = True
    set_grid_columns(ws, GRID_TOTAL_COLS, GRID_COL_WIDTH)

    # 1. タイトルバー
    merge_and_style(ws, 1, 1, 1, GRID_TOTAL_COLS, value="FC Benten チーム管理システム データ保存・連携フロー図 (Ver 2.0.0)",
                     font=f_title, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[1].height = 30

    merge_and_style(ws, 2, 1, 2, GRID_TOTAL_COLS,
                    value="ユーザーの画面操作（SPA）からSupabase PostgREST API (0.3秒応答) を経由し、PostgreSQL 17・Supabase Storage・Googleカレンダーへデータが高速永続化される流れ",
                    font=Font(name="Meiryo UI", size=9.5, color="EFF6FF"), fill=fill_navy,
                    alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[2].height = 20

    curr_r = 4

    # =========================================================================
    # 1. 全体データ保存・連携フロー図（ビジュアルダイアグラム画像）
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="1. 全体データ保存・連携フロー図（画面 ➔ Supabase PostgREST API ➔ PostgreSQL 17 / Storage）",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    # ダイアグラム画像を生成してシートに挿入
    png_path = generate_diagram_image()
    if os.path.exists(png_path):
        img = Image(png_path)
        img.width = 1180
        img.height = 708
        ws.add_image(img, f"A{curr_r}")

    # 画像の高さに合わせて行の高さを確保
    image_rows = 36
    for r in range(curr_r, curr_r + image_rows):
        ws.row_dimensions[r].height = 20
    curr_r += image_rows

    curr_r += 1  # 空白行

    # =========================================================================
    # 2. 主要4大業務のデータ保存ブロック線図（方眼紙セル図解）
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="2. 主要4大業務のデータ保存ブロック線図（PostgREST直接通信による0.3秒超高速永続化）",
                    font=f_sec_h1, fill=fill_green_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    # スタイル定義
    fill_flow_screen = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid") # 薄青
    fill_flow_arrow = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")  # 極薄青
    fill_flow_api = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")    # 薄緑
    fill_flow_db = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")     # 薄黄
    f_flow_box = Font(name="Meiryo UI", size=9, bold=True, color="0F172A")
    f_flow_arr = Font(name="Meiryo UI", size=8.5, bold=True, color="2563EB")
    f_flow_arr2 = Font(name="Meiryo UI", size=8.5, bold=True, color="059669")

    block_flows = [
        (
            "【試合結果の登録・保存】",
            "SCR04: 試合結果入力\n[保存ボタン] クリック時",
            "──(HTTPS POST)──▶\nREST payload: JSON",
            "Supabase PostgREST API\n【/rest/v1/matches】\n【/rest/v1/score_logs】",
            "──(SQL INSERT)──▶\n所要時間: 約0.1〜0.2秒",
            "🗄️ PostgreSQL (Tokyo Region)\n・『matches』テーブル (試合サマリー行)\n・『score_logs』テーブル (得失点・カード詳細ログ)"
        ),
        (
            "【出欠ワンタップ登録 ＆ 集計】",
            "SCR07: スケジュール\n[出欠○/×/△] タップ時",
            "──(0秒楽観UI更新)──▶\n非同期バックグラウンド送信",
            "Supabase PostgREST ＆ CalAPI\n【/rest/v1/attendance】\nGoogle Calendar API v3",
            "──(UPSERT / Patch)──▶\nDB & カレンダー完全同期",
            "🗄️ PostgreSQL『attendance』テーブル\n📅 Google カレンダー (イベント出席者リスト)\n※ 画面上は0秒で即時ボタン反転＆人数更新"
        ),
        (
            "【不在備品持参の代理解決】",
            "SCR08: 備品管理\n[代理解決確定] クリック時",
            "──(HTTPS POST)──▶\n担当者割当ペイロード",
            "Supabase PostgREST API\n【/rest/v1/equipment_event_logs】\nRLSポリシー自動検証",
            "──(SQL INSERT)──▶\n所要時間: 約0.08秒",
            "🗄️ PostgreSQL『equipment_event_logs』\n・持参担当者・ステータスを即時記録\n※ ホーム＆備品画面の不在アラートが即座に消去"
        ),
        (
            "【メンバー更新 ＆ 所持備品引継ぎ】",
            "SCR10: メンバー管理\n[更新 / 退部確定] クリック時",
            "──(HTTPS PATCH)──▶\n部員更新・備品引継ぎJSON",
            "Supabase PostgREST API\n【/rest/v1/members】\n【/rest/v1/equipment_items】",
            "──(SQL UPDATE)──▶\n整合性保証・アトミック更新",
            "🗄️ PostgreSQL (Tokyo Region)\n・『members』(プロフ/役職/OBフラグ)\n・『equipment_items』(新保管者への即時引き継ぎ)"
        )
    ]

    for title, b_screen, arr1, b_api, arr2, b_db in block_flows:
        # タイトル行
        merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value=title,
                        font=Font(name="Meiryo UI", size=9.5, bold=True, color="1E3A8A"),
                        fill=fill_bg_light, alignment=Alignment(horizontal="left", vertical="center", indent=1))
        ws.row_dimensions[curr_r].height = 20
        curr_r += 1

        # ブロック図行 (高さ48px)
        merge_and_style(ws, curr_r, 1, curr_r + 1, 22, value=b_screen, font=f_flow_box, fill=fill_flow_screen, alignment=al_center)
        merge_and_style(ws, curr_r, 23, curr_r + 1, 31, value=arr1, font=f_flow_arr, fill=fill_flow_arrow, alignment=al_center)
        merge_and_style(ws, curr_r, 32, curr_r + 1, 49, value=b_api, font=f_flow_box, fill=fill_flow_api, alignment=al_center)
        merge_and_style(ws, curr_r, 50, curr_r + 1, 58, value=arr2, font=f_flow_arr2, fill=fill_flow_arrow, alignment=al_center)
        merge_and_style(ws, curr_r, 59, curr_r + 1, 80, value=b_db, font=f_flow_box, fill=fill_flow_db, alignment=al_center)

        ws.row_dimensions[curr_r].height = 24
        ws.row_dimensions[curr_r + 1].height = 24
        curr_r += 2

        curr_r += 1  # ブロック間の余白行

    # =========================================================================
    # 3. 機能別データ保存・連携フロー詳細表
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="3. 機能別データ保存・連携フロー詳細一覧表（全画面・全エンドポイント完全網羅）",
                    font=f_sec_h1, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    COLS_FLOW = [
        ("No", 1, 3, al_top_center),
        ("画面ID / 機能名", 4, 15, al_top_left),
        ("保存タイミング / トリガー", 16, 27, al_top_left),
        ("通信API / エンドポイント", 28, 42, al_top_left),
        ("保存先テーブル / ストレージ", 43, 60, al_top_left),
        ("保存データ ＆ 連携動作 (0.3秒応答)", 61, 80, al_top_left)
    ]

    for h_name, start_c, end_c, _ in COLS_FLOW:
        merge_and_style(ws, curr_r, start_c, curr_r, end_c, value=h_name,
                        font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 26
    curr_r += 1

    flow_data = [
        (
            "SCR01: ログイン",
            "ログインボタン クリック時",
            "GET /rest/v1/members?email=eq...",
            "【PostgreSQL】『members』",
            "メールアドレスとSHA-256パスワードハッシュを直接照合。認証成功時にセッション情報をlocalStorageへ保存 (所要時間: 約0.1秒)。"
        ),
        (
            "SCR01: 初回登録",
            "登録完了ボタン クリック時",
            "PATCH /rest/v1/members?member_id=eq...",
            "【PostgreSQL】『members』",
            "初回設定パスワードのSHA-256ハッシュおよびGoogle連携トークン・連携日時を該当部員行へ直接更新保存。"
        ),
        (
            "SCR03: 試合結果",
            "詳細モーダル内 削除ボタン クリック時",
            "DELETE /rest/v1/matches?match_id=eq...",
            "【PostgreSQL】『matches』\n【PostgreSQL】『score_logs』",
            "指定試合IDをmatchesテーブルから削除。外部キー ON DELETE CASCADE により紐付くscore_logsも一括連動削除。"
        ),
        (
            "SCR04: 試合入力",
            "試合結果保存ボタン クリック時",
            "POST /rest/v1/matches\nPOST /rest/v1/score_logs",
            "【PostgreSQL】『matches』\n【PostgreSQL】『score_logs』",
            "1. 試合基本情報（日付・相手・得失点・会場・MOM・出席者）をmatchesテーブルへ登録。\n2. 各得点・カードログを一括でscore_logsへ登録。"
        ),
        (
            "SCR07: スケジュール",
            "出欠（○/×/△）ボタン クリック時",
            "POST /rest/v1/attendance (UPSERT)\nPATCH Google Calendar API",
            "【PostgreSQL】『attendance』\n【外部】Googleカレンダー イベント",
            "0秒楽観的UI更新を行い、PostgreSQL attendanceテーブルへ出欠登録。同時にGoogleカレンダーのイベント参加者ステータスを非同期同期。"
        ),
        (
            "SCR07: 予定作成",
            "予定保存ボタン クリック時",
            "POST Google Calendar API v3",
            "【外部】Googleカレンダー イベント",
            "タイトル、日時、種別（TR/TRM/公式戦）、会場、ゲスト参加者を指定してチーム共有Googleカレンダーへ新規イベント登録/更新。"
        ),
        (
            "SCR07: 予定削除",
            "予定削除ボタン クリック時",
            "DELETE Google Calendar API v3\nDELETE /rest/v1/attendance",
            "【外部】Googleカレンダー イベント\n【PostgreSQL】『attendance』",
            "Googleカレンダーから該当予定を完全削除し、紐付くattendanceレコードも連動クリア。"
        ),
        (
            "SCR08: 備品管理",
            "代理解決確定ボタン クリック時",
            "POST /rest/v1/equipment_event_logs",
            "【PostgreSQL】『equipment_event_logs』",
            "指定活動日・備品に対し、代理持参を引き受けた部員の割当レコードを追記。向こう7日間の不在アラートを即時解消。"
        ),
        (
            "SCR08: 備品台帳",
            "登録保存ボタン クリック時",
            "POST / PATCH /rest/v1/equipment_items",
            "【PostgreSQL】『equipment_items』",
            "現物管理ID（EQP-xxx）、品目コード、現在の保管部員ID、個別備考を台帳テーブルへ新規登録または更新。"
        ),
        (
            "SCR08: 備品削除",
            "備品削除ボタン クリック時",
            "DELETE /rest/v1/equipment_items?item_id=...",
            "【PostgreSQL】『equipment_items』",
            "廃棄・紛失等の対象備品レコードを台帳テーブルから削除。"
        ),
        (
            "SCR09: 活動記録",
            "投稿実行ボタン クリック時",
            "POST / PATCH /rest/v1/bulletin_posts",
            "【PostgreSQL】『bulletin_posts』",
            "記事ID、カテゴリ、タイトル、本文、作成者ID、作成日時、ピン留めフラグを直接保存。ホーム最上部アナウンスと連動。"
        ),
        (
            "SCR09: 既読確認",
            "掲示板カード タップ時",
            "POST /rest/v1/bulletin_reads (ON CONFLICT IGNORE)",
            "【PostgreSQL】『bulletin_reads』",
            "閲覧部員IDと閲覧日時を既読テーブルへサイレント登録。一意制約(post_id, member_id)により二重登録を完全防止。"
        ),
        (
            "SCR09: コメント",
            "コメント送信ボタン クリック時",
            "POST /rest/v1/bulletin_comments",
            "【PostgreSQL】『bulletin_comments』",
            "投稿ID、コメント本文、作成者部員ID、投稿日時を即座に登録。スレッドを即時再描画。"
        ),
        (
            "SCR10: メンバー管理",
            "部員情報更新ボタン クリック時",
            "PATCH /rest/v1/members?member_id=eq...",
            "【PostgreSQL】『members』",
            "部員ID、氏名、背番号、ポジション、役職、生年月日、電話番号、メールアドレスをテーブルへ直接高速更新。"
        ),
        (
            "SCR10: メンバー削除",
            "削除確定ボタン クリック時",
            "PATCH /rest/v1/members (is_past=TRUE)\nPATCH /rest/v1/equipment_items",
            "【PostgreSQL】『members』\n【PostgreSQL】『equipment_items』",
            "1. membersテーブルの該当部員の `is_past` を TRUE に更新（過去戦績を保持しつつ一覧から除外）。\n2. 所持備品がある場合は新保管者へ引き継ぎ更新。"
        ),
        (
            "SCR11: プロフィール",
            "アバター写真 ファイル選択時",
            "POST /storage/v1/object/member-avatars/...\nPATCH /rest/v1/members (avatar_url)",
            "【Supabase Storage】member-avatars\n【PostgreSQL】『members』",
            "画像をSupabase Storageのmember-avatarsバケットへ直接アップロード。取得した公開CDN URLをmembersテーブルのavatar_urlに反映。"
        ),
        (
            "SCR11: 通知設定",
            "通知方法ラジオ 選択変更時",
            "PATCH /rest/v1/members?member_id=eq...",
            "【PostgreSQL】『members』",
            "通知種別（Push/LINE/両方/なし）およびPush購読JSON・項目別通知設定をmembersテーブルへ即時自動保存。"
        )
    ]

    for idx, row in enumerate(flow_data, 1):
        sc_name, timing, api_name, target_db, detail = row
        row_fill = fill_odd if (idx % 2 == 1) else fill_even

        merge_and_style(ws, curr_r, 1, curr_r, 3, value=idx, font=f_td, fill=row_fill, alignment=al_top_center)
        merge_and_style(ws, curr_r, 4, curr_r, 15, value=sc_name, font=f_td_bold, fill=row_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 16, curr_r, 27, value=timing, font=f_td, fill=row_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 28, curr_r, 42, value=api_name, font=f_td_code, fill=row_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 43, curr_r, 60, value=target_db, font=Font(name="Meiryo UI", size=8.5, bold=True, color="1E3A8A"), fill=row_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 61, curr_r, 80, value=detail, font=f_td, fill=row_fill, alignment=al_top_left)

        max_lines = max(len(detail.split("\n")), len(target_db.split("\n")), len(timing.split("\n")), len(api_name.split("\n")))
        ws.row_dimensions[curr_r].height = max(26, max_lines * 18)
        curr_r += 1

    print("Data Flow Sheet successfully built with embedded diagram image & cell block diagrams.")
