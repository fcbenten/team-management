# -*- coding: utf-8 -*-
"""
FC Benten チーム管理システム データベーステーブル仕様書 生成スクリプト
1ブック内にテーブル単位のシートおよび目次・DB全体設計シートを作成
"""
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# カラーパレット
COLOR_NAVY_DARK = "1E3A8A"   # 表・ヘッダー背景色
COLOR_BLUE_MED = "2563EB"    # セクションバー (カラム定義)
COLOR_GREEN_MED = "059669"   # セクションバー (インデックス / RLS)
COLOR_PURPLE_MED = "7C3AED"  # セクションバー (旧スプシ対照)
COLOR_BORDER = "CBD5E1"      # 通常罫線色
COLOR_ROW_EVEN = "F8FAFC"    # テーブル偶数行
COLOR_ROW_ODD = "FFFFFF"     # テーブル奇数行
COLOR_TEXT_MAIN = "0F172A"   # 主要文字
COLOR_TEXT_MUTED = "475569"  # 補足文字
COLOR_PK_BG = "FEF3C7"       # PK用黄色背景
COLOR_FK_BG = "EFF6FF"       # FK用薄青背景

# フォント定義
f_title = Font(name="Meiryo UI", size=15, bold=True, color="FFFFFF")
f_sub = Font(name="Meiryo UI", size=9.5, color="EFF6FF")
f_sec_h1 = Font(name="Meiryo UI", size=11, bold=True, color="FFFFFF")
f_sec_h2 = Font(name="Meiryo UI", size=9, bold=True, color=COLOR_NAVY_DARK)
f_th = Font(name="Meiryo UI", size=9, bold=True, color="FFFFFF")
f_td = Font(name="Meiryo UI", size=9, color=COLOR_TEXT_MAIN)
f_td_bold = Font(name="Meiryo UI", size=9, bold=True, color=COLOR_TEXT_MAIN)
f_td_code = Font(name="Consolas", size=9, color=COLOR_TEXT_MAIN)
f_td_code_bold = Font(name="Consolas", size=9, bold=True, color=COLOR_TEXT_MAIN)
f_pk = Font(name="Consolas", size=9, bold=True, color="B45309")
f_fk = Font(name="Consolas", size=9, bold=True, color="1D4ED8")
f_meta_k = Font(name="Meiryo UI", size=9, bold=True, color=COLOR_NAVY_DARK)
f_meta_v = Font(name="Meiryo UI", size=9, color=COLOR_TEXT_MAIN)

# 塗りつぶし定義
fill_navy = PatternFill(start_color=COLOR_NAVY_DARK, end_color=COLOR_NAVY_DARK, fill_type="solid")
fill_blue_med = PatternFill(start_color=COLOR_BLUE_MED, end_color=COLOR_BLUE_MED, fill_type="solid")
fill_green_med = PatternFill(start_color=COLOR_GREEN_MED, end_color=COLOR_GREEN_MED, fill_type="solid")
fill_purple_med = PatternFill(start_color=COLOR_PURPLE_MED, end_color=COLOR_PURPLE_MED, fill_type="solid")
fill_bg_light = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
fill_even = PatternFill(start_color=COLOR_ROW_EVEN, end_color=COLOR_ROW_EVEN, fill_type="solid")
fill_odd = PatternFill(start_color=COLOR_ROW_ODD, end_color=COLOR_ROW_ODD, fill_type="solid")
fill_pk = PatternFill(start_color=COLOR_PK_BG, end_color=COLOR_PK_BG, fill_type="solid")
fill_fk = PatternFill(start_color=COLOR_FK_BG, end_color=COLOR_FK_BG, fill_type="solid")

# 罫線定義
side_thin = Side(border_style="thin", color=COLOR_BORDER)
side_med = Side(border_style="medium", color=COLOR_NAVY_DARK)
border_box = Border(left=side_thin, right=side_thin, top=side_thin, bottom=side_thin)
border_th = Border(left=side_thin, right=side_thin, top=side_thin, bottom=side_med)

# 配置
al_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
al_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
al_top_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
al_top_center = Alignment(horizontal="center", vertical="top", wrap_text=True)

GRID_TOTAL_COLS = 80
GRID_COL_WIDTH = 2.75

def set_grid_columns(ws, max_cols=GRID_TOTAL_COLS, width=GRID_COL_WIDTH):
    for col in range(1, max_cols + 1):
        col_letter = get_column_letter(col)
        ws.column_dimensions[col_letter].width = width

def merge_and_style(ws, start_row, start_col, end_row, end_col, value="",
                    font=f_td, fill=fill_odd, alignment=al_left, border=border_box):
    if start_row == end_row and start_col == end_col:
        c = ws.cell(row=start_row, column=start_col)
        c.value = value
        c.font = font
        c.fill = fill
        c.alignment = alignment
        c.border = border
        return c

    ws.merge_cells(start_row=start_row, start_column=start_col, end_row=end_row, end_column=end_col)
    for r in range(start_row, end_row + 1):
        for col in range(start_col, end_col + 1):
            cell = ws.cell(row=r, column=col)
            cell.fill = fill
            top_s = border.top if r == start_row else side_thin
            bottom_s = border.bottom if r == end_row else side_thin
            left_s = border.left if col == start_col else side_thin
            right_s = border.right if col == end_col else side_thin
            cell.border = Border(top=top_s, bottom=bottom_s, left=left_s, right=right_s)

    top_left = ws.cell(row=start_row, column=start_col)
    top_left.value = value
    top_left.font = font
    top_left.alignment = alignment
    return top_left

def build_toc_sheet(wb, tables_meta):
    ws = wb.active
    ws.title = "【目次・DB全体設計】"
    ws.views.sheetView[0].showGridLines = True
    set_grid_columns(ws)

    # 1. タイトル
    merge_and_style(ws, 1, 1, 1, GRID_TOTAL_COLS, value="FC Benten チーム管理システム データベース仕様書",
                    font=f_title, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    merge_and_style(ws, 2, 1, 2, GRID_TOTAL_COLS, value="PostgreSQL 17 (Supabase Tokyo Region) テーブル定義・リレーション・セキュリティ・移行対照仕様書 (Ver 2.0.0)",
                    font=f_sub, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 20

    # 文書情報
    meta = [
        ("対象システム", "FC Benten チーム管理システム (TeamManagement)", "作成日", "2026/11/10"),
        ("データベース基盤", "Supabase (PostgreSQL 17.11 / Tokyo Region ap-northeast-1)", "バージョン", "Ver 2.0.0 (Supabase移行版)"),
        ("ホスティング & 通信", "GitHub Pages (PWA) ➔ PostgREST (HTTPS REST API / JSON 応答: 0.3〜0.5秒)", "ステータス", "テーブル構築完了・本番移行準備中"),
        ("セキュリティ & RLS", "Row Level Security (RLS) 有効 / 各テーブル anon & authenticated 完全制御", "ストレージ", "Supabase Storage (member-avatars)")
    ]
    curr_r = 4
    for row in meta:
        merge_and_style(ws, curr_r, 1, curr_r, 16, value=row[0], font=f_meta_k, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 17, curr_r, 44, value=row[1], font=f_td, fill=fill_odd, alignment=al_left)
        merge_and_style(ws, curr_r, 45, curr_r, 58, value=row[2], font=f_meta_k, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 59, curr_r, GRID_TOTAL_COLS, value=row[3], font=f_td, fill=fill_odd, alignment=al_left)
        ws.row_dimensions[curr_r].height = 20
        curr_r += 1

    # 2. テーブル一覧 (目次)
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="1. テーブル一覧 (Table of Contents)",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    headers = [
        ("No", 1, 3), ("物理テーブル名", 4, 18), ("論理テーブル名 (和名)", 19, 34),
        ("主キー (PK)", 35, 43), ("外部キー (FK)", 44, 53), ("旧スプレッドシート / データ源泉", 54, 70), ("シートリンク", 71, 80)
    ]
    for h, sc, ec in headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    for idx, t in enumerate(tables_meta):
        f_row = fill_even if idx % 2 == 0 else fill_odd
        ws.row_dimensions[curr_r].height = 22
        merge_and_style(ws, curr_r, 1, curr_r, 3, value=idx + 1, font=f_td, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 4, curr_r, 18, value=t["phys_name"], font=f_td_code_bold, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 19, curr_r, 34, value=t["logic_name"], font=f_td_bold, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 35, curr_r, 43, value=t["pk"], font=f_pk, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 44, curr_r, 53, value=t["fk"], font=f_fk, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 54, curr_r, 70, value=t["old_source"], font=f_td, fill=f_row, alignment=al_left)
        
        # ハイパーリンク
        link_cell = merge_and_style(ws, curr_r, 71, curr_r, 80, value=f"#{t['phys_name']}!A1", font=Font(name="Meiryo UI", size=9, color="2563EB", underline="single"), fill=f_row, alignment=al_center)
        link_cell.value = f"定義シートへ ➔"
        link_cell.hyperlink = f"#{t['phys_name']}!A1"
        curr_r += 1

    # 3. データベース共通規約 & 命名規則
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="2. データベース共通設計規約・命名規則",
                    font=f_sec_h1, fill=fill_green_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    rules = [
        ("識別子命名規約", "テーブル名・カラム名はすべて小文字のスネークケース（snake_case）で統一。\n単語の区切りにはアンダースコア（_）を使用し、PostgreSQL標準およびPostgREST API規則に準拠。"),
        ("主キー (PK) 設計", "テーブルごとに明確な主キーを設定。メンバーID (MBR-001) や試合ID (M20261110...) など、既存業務ID体系と合致するVARCHAR(50)またはBIGSERIALを採用。"),
        ("共通監査カラム", "全テーブルに `created_at` (登録日時: TIMESTAMPTZ DEFAULT NOW()) を配備。\n更新が頻発するテーブルには `updated_at` (最終更新日時: TIMESTAMPTZ DEFAULT NOW()) を配備。"),
        ("論理削除方針", "活動記録 (bulletin_posts) やコメント (bulletin_comments) は、ユーザー体験保護のため物理削除ではなく `is_deleted` (BOOLEAN DEFAULT FALSE) による論理削除を採用。"),
        ("外部キー制約 (FK)", "親子関係が強固なテーブル（matches ➔ score_logs、bulletin_posts ➔ comments/reads）は ON DELETE CASCADE を設定し整合性を保証。"),
        ("セキュリティ (RLS)", "全テーブルで Row Level Security (RLS) を有効化。PWAからの高速RESTアクセスをPostgREST経由で安全に仲介。")
    ]
    for r_title, r_desc in rules:
        line_cnt = len(r_desc.split('\n'))
        ws.row_dimensions[curr_r].height = max(22, line_cnt * 16 + 6)
        merge_and_style(ws, curr_r, 1, curr_r, 18, value=r_title, font=f_sec_h2, fill=fill_bg_light, alignment=al_top_left)
        merge_and_style(ws, curr_r, 19, curr_r, GRID_TOTAL_COLS, value=r_desc, font=f_td, fill=fill_odd, alignment=al_top_left)
        curr_r += 1

    # 4. データベース自動化トリガー ＆ 集計ビュー一覧
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="3. データベース最適化トリガー ＆ 集計ビュー一覧 (Automation & Views)",
                    font=f_sec_h1, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    opt_headers = [
        ("No", 1, 3), ("オブジェクト名", 4, 25), ("種別", 26, 34),
        ("関連テーブル", 35, 48), ("自動化・最適化内容", 49, 80)
    ]
    for h, sc, ec in opt_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    opt_items = [
        ("trg_sync_match_scores", "TRIGGER", "score_logs ➔ matches", "score_logsの追加・編集・削除に連動し、matchesのmy_score, opp_score, resultをDB側で完全自動計算・更新。二重更新作業を不要化。"),
        ("update_timestamp", "TRIGGER", "members, matches, items, posts", "全更新系テーブルでレコード更新時に `updated_at = NOW()` を自動打刻。更新日時の記録漏れを完全防止。"),
        ("view_player_attendance_stats", "VIEW", "members + attendance", "全選手の通算活動参加率(%)および種別別（練習・TRM・公式戦・全体）出欠数をSQLでリアルタイム集計。旧GAS深夜バッチ(batch_attendance.js)を完全廃止・不要化。"),
        ("view_bulletin_summary", "VIEW", "posts + members + reads + comments", "掲示板投稿ごとの既読人数・コメント数および投稿者名・アバターを自動集計・結合。アプリ側での集計ループ処理を撤廃し表示を爆速化。")
    ]
    for o_idx, opt in enumerate(opt_items):
        f_row = fill_even if o_idx % 2 == 0 else fill_odd
        lines = len(opt[3].split('\n'))
        ws.row_dimensions[curr_r].height = max(22, lines * 16 + 6)
        merge_and_style(ws, curr_r, 1, curr_r, 3, value=o_idx + 1, font=f_td, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 4, curr_r, 25, value=opt[0], font=f_td_code_bold, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 26, curr_r, 34, value=opt[1], font=f_td_bold, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 35, curr_r, 48, value=opt[2], font=f_td_code, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 49, curr_r, 80, value=opt[3], font=f_td, fill=f_row, alignment=al_left)
        curr_r += 1

def build_table_sheet(wb, t_meta):
    ws = wb.create_sheet(title=t_meta["phys_name"])
    ws.views.sheetView[0].showGridLines = True
    set_grid_columns(ws)

    # 1. シートタイトルバー
    merge_and_style(ws, 1, 1, 1, 60, value=f"テーブル定義書: {t_meta['logic_name']} ({t_meta['phys_name']})",
                    font=f_title, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    back_cell = merge_and_style(ws, 1, 61, 1, GRID_TOTAL_COLS, value="目次へ戻る ➔",
                                font=Font(name="Meiryo UI", size=9.5, bold=True, color="FFFFFF", underline="single"), fill=fill_navy, alignment=al_center)
    back_cell.hyperlink = "#【目次・DB全体設計】!A1"
    ws.row_dimensions[1].height = 28

    merge_and_style(ws, 2, 1, 2, GRID_TOTAL_COLS, value=f"スキーマ: public / テーブル名: {t_meta['phys_name']} / 役割: {t_meta['summary']}",
                    font=f_sub, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[2].height = 20

    # テーブル基本情報 (Row 4〜6)
    t_info = [
        ("論理テーブル名", t_meta["logic_name"], "物理テーブル名", f"public.{t_meta['phys_name']}"),
        ("主キー (PK)", t_meta["pk"], "外部キー (FK)", t_meta["fk"] or "なし"),
        ("旧データ源泉", t_meta["old_source"], "想定データ量", t_meta["volume"])
    ]
    curr_r = 4
    for row in t_info:
        merge_and_style(ws, curr_r, 1, curr_r, 14, value=row[0], font=f_meta_k, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 15, curr_r, 40, value=row[1], font=f_td, fill=fill_odd, alignment=al_left)
        merge_and_style(ws, curr_r, 41, curr_r, 52, value=row[2], font=f_meta_k, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 53, curr_r, GRID_TOTAL_COLS, value=row[3], font=f_td, fill=fill_odd, alignment=al_left)
        ws.row_dimensions[curr_r].height = 20
        curr_r += 1

    # =========================================================================
    # セクション1: カラム定義一覧表
    # 列配分（合計80列）:
    # No(1-3=3) / 論理名(4-17=14) / 物理カラム名(18-32=15) / データ型(33-41=9) /
    # PK(42-44=3) / Null(45-49=5) / 初期値(50-57=8) / FK参照先(58-65=8) / 説明・用途・値制約(66-80=15)
    # =========================================================================
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="1. カラム定義一覧 (Columns)",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    col_headers = [
        ("No", 1, 3), ("論理名 (和名)", 4, 17), ("物理カラム名", 18, 32),
        ("データ型", 33, 41), ("PK", 42, 44), ("Null", 45, 49),
        ("初期値", 50, 57), ("外部キー (FK)", 58, 65), ("説明・用途・許容値・フォーマット例", 66, 80)
    ]
    for h, sc, ec in col_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    for c_idx, col in enumerate(t_meta["columns"]):
        f_row = fill_even if c_idx % 2 == 0 else fill_odd
        desc_lines = len(str(col[8]).split('\n'))
        ws.row_dimensions[curr_r].height = max(22, desc_lines * 16 + 6)

        is_pk = (col[4] == "PK")
        is_fk = bool(col[7] and col[7] != "-")

        merge_and_style(ws, curr_r, 1, curr_r, 3, value=c_idx + 1, font=f_td, fill=f_row, alignment=al_top_center)
        merge_and_style(ws, curr_r, 4, curr_r, 17, value=col[0], font=f_td_bold, fill=f_row, alignment=al_top_left)
        merge_and_style(ws, curr_r, 18, curr_r, 32, value=col[1], font=f_td_code_bold, fill=f_row, alignment=al_top_left)
        merge_and_style(ws, curr_r, 33, curr_r, 41, value=col[2], font=f_td_code, fill=f_row, alignment=al_top_center)
        
        # PK
        pk_fill = fill_pk if is_pk else f_row
        merge_and_style(ws, curr_r, 42, curr_r, 44, value=col[4], font=f_pk if is_pk else f_td, fill=pk_fill, alignment=al_top_center)
        
        # Null許容
        merge_and_style(ws, curr_r, 45, curr_r, 49, value=col[5], font=f_td, fill=f_row, alignment=al_top_center)
        
        # 初期値
        merge_and_style(ws, curr_r, 50, curr_r, 57, value=col[6], font=f_td_code, fill=f_row, alignment=al_top_center)
        
        # FK
        fk_fill = fill_fk if is_fk else f_row
        merge_and_style(ws, curr_r, 58, curr_r, 65, value=col[7], font=f_fk if is_fk else f_td, fill=fk_fill, alignment=al_top_left)
        
        # 説明
        merge_and_style(ws, curr_r, 66, curr_r, 80, value=col[8], font=f_td, fill=f_row, alignment=al_top_left)
        curr_r += 1

    # =========================================================================
    # セクション2: インデックス定義表
    # =========================================================================
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="2. インデックス定義 (Indexes)",
                    font=f_sec_h1, fill=fill_green_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    idx_headers = [
        ("No", 1, 3), ("インデックス名", 4, 25), ("対象カラム", 26, 42),
        ("インデックス種別", 43, 52), ("一意性 (Unique)", 53, 62), ("作成理由・性能効果", 63, 80)
    ]
    for h, sc, ec in idx_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    for i_idx, idx in enumerate(t_meta.get("indexes", [])):
        f_row = fill_even if i_idx % 2 == 0 else fill_odd
        ws.row_dimensions[curr_r].height = 22
        merge_and_style(ws, curr_r, 1, curr_r, 3, value=i_idx + 1, font=f_td, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 4, curr_r, 25, value=idx[0], font=f_td_code_bold, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 26, curr_r, 42, value=idx[1], font=f_td_code, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 43, curr_r, 52, value=idx[2], font=f_td, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 53, curr_r, 62, value=idx[3], font=f_td, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 63, curr_r, 80, value=idx[4], font=f_td, fill=f_row, alignment=al_left)
        curr_r += 1

    # =========================================================================
    # セクション3: セキュリティ & Row Level Security (RLS)
    # =========================================================================
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="3. セキュリティ & Row Level Security (RLS) 設計",
                    font=f_sec_h1, fill=fill_green_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    rls_headers = [
        ("ポリシー名", 1, 20), ("対象ロール", 21, 32), ("許可操作", 33, 42),
        ("USING条件式", 43, 60), ("設計・セキュリティ意図", 61, 80)
    ]
    for h, sc, ec in rls_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    for r_idx, rls in enumerate(t_meta.get("rls", [])):
        f_row = fill_even if r_idx % 2 == 0 else fill_odd
        ws.row_dimensions[curr_r].height = 22
        merge_and_style(ws, curr_r, 1, curr_r, 20, value=rls[0], font=f_td_code_bold, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 21, curr_r, 32, value=rls[1], font=f_td_code, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 33, curr_r, 42, value=rls[2], font=f_td_bold, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 43, curr_r, 60, value=rls[3], font=f_td_code, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 61, curr_r, 80, value=rls[4], font=f_td, fill=f_row, alignment=al_left)
        curr_r += 1

    # =========================================================================
    # セクション4: 旧スプレッドシートとの移行対照仕様
    # =========================================================================
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="4. 旧スプレッドシートからの移行・データ変換仕様",
                    font=f_sec_h1, fill=fill_purple_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    mig_headers = [
        ("旧スプレッドシート", 1, 20), ("旧シート名", 21, 32), ("旧列名 / 列位置", 33, 46),
        ("移行先物理カラム", 47, 62), ("移行・データクレンジング処理内容", 63, 80)
    ]
    for h, sc, ec in mig_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    for m_idx, mig in enumerate(t_meta.get("migration", [])):
        f_row = fill_even if m_idx % 2 == 0 else fill_odd
        lines = len(str(mig[4]).split('\n'))
        ws.row_dimensions[curr_r].height = max(22, lines * 16 + 6)
        merge_and_style(ws, curr_r, 1, curr_r, 20, value=mig[0], font=f_td, fill=f_row, alignment=al_top_left)
        merge_and_style(ws, curr_r, 21, curr_r, 32, value=mig[1], font=f_td_bold, fill=f_row, alignment=al_top_left)
        merge_and_style(ws, curr_r, 33, curr_r, 46, value=mig[2], font=f_td_code, fill=f_row, alignment=al_top_left)
        merge_and_style(ws, curr_r, 47, curr_r, 62, value=mig[3], font=f_td_code_bold, fill=f_row, alignment=al_top_left)
        merge_and_style(ws, curr_r, 63, curr_r, 80, value=mig[4], font=f_td, fill=f_row, alignment=al_top_left)
        curr_r += 1

def build_storage_sheet(wb):
    ws = wb.create_sheet(title="member-avatars")
    ws.views.sheetView[0].showGridLines = True
    set_grid_columns(ws)

    # 1. タイトル
    merge_and_style(ws, 1, 1, 1, 60, value="ストレージバケット仕様書: プロフィール画像 (member-avatars)",
                    font=f_title, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    back_cell = merge_and_style(ws, 1, 61, 1, GRID_TOTAL_COLS, value="目次へ戻る ➔",
                                font=Font(name="Meiryo UI", size=9.5, bold=True, color="FFFFFF", underline="single"), fill=fill_navy, alignment=al_center)
    back_cell.hyperlink = "#【目次・DB全体設計】!A1"
    ws.row_dimensions[1].height = 28

    merge_and_style(ws, 2, 1, 2, GRID_TOTAL_COLS, value="Supabase Storage / バケット名: member-avatars / 役割: 選手プロフィール画像の高速CDN配信",
                    font=f_sub, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[2].height = 20

    # バケット属性情報
    b_info = [
        ("バケットID", "member-avatars", "公開設定", "Public (全ユーザー読み取り許可)"),
        ("最大ファイルサイズ", "5 MB", "許容MIMEタイプ", "image/png, image/jpeg, image/webp"),
        ("格納パス規則", "{member_id}.png (例: MBR-001.png)", "キャッシュ制御", "Cache-Control: public, max-age=3600 (1時間)"),
        ("公開CDN URL形式", "https://pkufnywvnuicragvobaq.supabase.co/storage/v1/object/public/member-avatars/{member_id}.png", "連携先テーブル", "public.members.avatar_url")
    ]
    curr_r = 4
    for row in b_info:
        merge_and_style(ws, curr_r, 1, curr_r, 14, value=row[0], font=f_meta_k, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 15, curr_r, 40, value=row[1], font=f_td, fill=fill_odd, alignment=al_left)
        merge_and_style(ws, curr_r, 41, curr_r, 52, value=row[2], font=f_meta_k, fill=fill_bg_light, alignment=al_left)
        merge_and_style(ws, curr_r, 53, curr_r, GRID_TOTAL_COLS, value=row[3], font=f_td, fill=fill_odd, alignment=al_left)
        ws.row_dimensions[curr_r].height = 20
        curr_r += 1

    # 2. セキュリティ & ポリシー
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="1. ストレージアクセス権限ポリシー",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    pol_headers = [
        ("ポリシー名", 1, 24), ("対象ロール", 25, 36), ("許可コマンド", 37, 48),
        ("条件 (USING/CHECK)", 49, 64), ("用途・動作説明", 65, 80)
    ]
    for h, sc, ec in pol_headers:
        merge_and_style(ws, curr_r, sc, curr_r, ec, value=h, font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    pol_data = [
        ("Allow public avatar access", "public / anon", "SELECT, INSERT, UPDATE", "bucket_id = 'member-avatars'", "PWAアプリからの画像参照および個人プロフィール設定画面からのアイコン画像アップロードを許可。"),
        ("Allow service_role full access", "service_role", "ALL (完全制御)", "true", "管理バッチ・データ移行スクリプトによる一括画像取り込み・最適化処理用。")
    ]
    for idx, p in enumerate(pol_data):
        f_row = fill_even if idx % 2 == 0 else fill_odd
        ws.row_dimensions[curr_r].height = 26
        merge_and_style(ws, curr_r, 1, curr_r, 24, value=p[0], font=f_td_code_bold, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 25, curr_r, 36, value=p[1], font=f_td_code, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 37, curr_r, 48, value=p[2], font=f_td_bold, fill=f_row, alignment=al_center)
        merge_and_style(ws, curr_r, 49, curr_r, 64, value=p[3], font=f_td_code, fill=f_row, alignment=al_left)
        merge_and_style(ws, curr_r, 65, curr_r, 80, value=p[4], font=f_td, fill=f_row, alignment=al_left)
        curr_r += 1

    # 3. 旧Googleドライブからの移行仕様
    curr_r += 1
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="2. 旧Google Drive画像からの移行仕様",
                    font=f_sec_h1, fill=fill_purple_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    trans_rules = [
        ("旧画像保存場所", "Google Drive共有フォルダ (LOG_FOLDER_ID / プロフィール写真フォルダ)"),
        ("旧アクセス方式", "Google Driveの閲覧リンク (drive.google.com/uc?id=...) を名簿シートに保存。\n表示時にGoogleの認証クッキーやリダイレクトが発生し、読み込みに1〜2秒を要していた。"),
        ("Supabase Storage化効果", "グローバルCDN直結の静的オブジェクトとして配信されるため、画像表示が 50ms 未満の爆速応答に進化。\n認証リダイレクト不要でWeb標準の <img> タグで高速レンダリング可能。"),
        ("ファイル移行手順", "旧Drive上の画像ファイルをダウンロードし、`{member_id}.png` としてSupabase Storageにアップロード。\n`members.avatar_url` にSupabase公開URLを登録して切り替え完了。")
    ]
    for t_title, t_desc in trans_rules:
        lines = len(t_desc.split('\n'))
        ws.row_dimensions[curr_r].height = max(22, lines * 16 + 6)
        merge_and_style(ws, curr_r, 1, curr_r, 18, value=t_title, font=f_sec_h2, fill=fill_bg_light, alignment=al_top_left)
        merge_and_style(ws, curr_r, 19, curr_r, GRID_TOTAL_COLS, value=t_desc, font=f_td, fill=fill_odd, alignment=al_top_left)
        curr_r += 1

# ==============================================================================
# 全10テーブルの完全メタデータ定義
# ==============================================================================

TABLES_DATA = [
    {
        "phys_name": "members",
        "logic_name": "メンバー名簿",
        "summary": "選手・役員・スタッフの基本情報、連絡先、認証ハッシュ、通知設定、OB管理、システム予約枠",
        "pk": "member_id",
        "fk": "なし",
        "volume": "約30〜50件（年数名増）",
        "old_source": "選手名簿SS (01.名簿 / 名簿・過去メンバー)",
        "columns": [
            ("メンバーID", "member_id", "VARCHAR(50)", "メンバー一意ID", "PK", "NOT NULL", "なし", "-", "例: MBR-001。助っ人(MBR-SPECIAL-GUEST)、OG(MBR-SPECIAL-OG)を含む。"),
            ("選手氏名", "name", "VARCHAR(100)", "氏名", "-", "NOT NULL", "なし", "-", "選手・スタッフの本名（例: 山田 太郎、助っ人、OG）。出欠や試合記録の表示名。"),
            ("背番号", "number", "VARCHAR(10)", "背番号", "-", "NULL", "なし", "-", "例: 10, GK。空文字の場合は背番号未定。"),
            ("役職・権限", "role", "VARCHAR(50)", "チーム内役職", "-", "NULL", "'選手'", "-", "代表, 副代表, 運営, 選手。画面の表示制御および管理者機能の権限判定に使用。"),
            ("主ポジション", "position", "VARCHAR(20)", "ポジション", "-", "NULL", "'FP'", "-", "FP (フィールドプレイヤー) または GK (ゴールキーパー)。"),
            ("生年月日", "birthday", "VARCHAR(20)", "生年月日", "-", "NULL", "なし", "-", "yyyy/MM/dd 形式。画面側で現在日付から満年齢を動的計算・表示。"),
            ("メールアドレス", "email", "VARCHAR(255)", "メールアドレス", "-", "NULL", "なし", "-", "ログイン認証照合キーおよびGoogleカレンダー招待メール紐付けキー。"),
            ("電話番号", "phone", "VARCHAR(50)", "電話番号", "-", "NULL", "なし", "-", "緊急連絡先電話番号。"),
            ("パスワードハッシュ", "password_hash", "TEXT", "認証ハッシュ", "-", "NULL", "なし", "-", "SHA-256暗号化ハッシュ値。旧システムから完全移行し再設定不要。"),
            ("連携トークン", "token", "TEXT", "セッショントークン", "-", "NULL", "なし", "-", "Google OAuth初回認証トークンおよび長期セッション情報。"),
            ("連携日時", "linked_at", "TIMESTAMPTZ", "Google連携日時", "-", "NULL", "なし", "-", "Googleカレンダー連携が完了したタイムスタンプ。"),
            ("アバター画像URL", "avatar_url", "TEXT", "プロフィール画像", "-", "NULL", "なし", "-", "Supabase Storage (member-avatars) 上のCDN公開画像URL。"),
            ("希望通知種別", "notification_type", "VARCHAR(50)", "通知種別", "-", "NULL", "なし", "-", "LINE, Push, Email 等の優先通知方法。"),
            ("LINEユーザーID", "line_user_id", "VARCHAR(100)", "LINE ID", "-", "NULL", "なし", "-", "LINE Messaging APIによる通知配信先の一意識別子。"),
            ("Push通知購読情報", "push_subscription", "TEXT", "Web Push情報", "-", "NULL", "なし", "-", "ブラウザWeb Push通知購読情報オブジェクト (JSON文字列)。"),
            ("通知項目設定", "notify_settings", "TEXT", "通知項目別ON/OFF", "-", "NULL", "なし", "-", "出欠リマインド、試合前日などの通知可否設定 (JSON文字列)。"),
            ("過去メンバーフラグ", "is_past", "BOOLEAN", "OBフラグ", "-", "NOT NULL", "FALSE", "-", "TRUE: 退団・OB（通常の一覧や出欠対象から除外、過去戦績は保持）。"),
            ("休部中フラグ", "is_suspended", "BOOLEAN", "休部フラグ", "-", "NOT NULL", "FALSE", "-", "TRUE: 休部中（在籍・現役のくくりだが、怪我や多忙により一時活動休止中。出欠催促・全体アナウンス通知の配信対象から一時除外）。"),
            ("会員種別", "member_type", "VARCHAR(20)", "種別区分", "-", "NOT NULL", "'REGULAR'", "-", "'REGULAR' (通常選手・役員), 'PAST' (退団・OB), 'SPECIAL' (助っ人・OG等のシステム予約枠)。ランキングや出欠、未読集計等で除外判定に使用。"),
            ("登録日時", "created_at", "TIMESTAMPTZ", "レコード作成日時", "-", "NOT NULL", "NOW()", "-", "システム登録時の自動タイムスタンプ。"),
            ("最終更新日時", "updated_at", "TIMESTAMPTZ", "レコード更新日時", "-", "NOT NULL", "NOW()", "-", "プロフィールや権限が変更された日時の自動タイムスタンプ。")
        ],
        "indexes": [
            ("idx_members_email", "email", "B-Tree", "No (重複なし推奨)", "ログイン時およびカレンダー連携時のメールアドレス高速検索用。"),
            ("idx_members_is_past", "is_past", "B-Tree", "No", "現役メンバー (is_past = FALSE) の一括絞り込み高速化用。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからの高速直接アクセス（一覧取得・自己プロフィール更新）を許可。")
        ],
        "migration": [
            ("選手名簿SS (01.名簿)", "名簿", "名前(D列)〜通知設定", "membersテーブル各列", "ヘッダー列動的マッピングにより各列を正確に抽出・投入。"),
            ("選手名簿SS (01.名簿)", "過去メンバー", "名前〜各列", "members (is_past = TRUE)", "過去メンバーシートの選手は `is_past = TRUE` として投入し統合管理。")
        ]
    },
    {
        "phys_name": "matches",
        "logic_name": "試合記録",
        "summary": "公式戦・TRM等の試合サマリー、対戦相手、スコア、勝敗、出場選手、MOM",
        "pk": "match_id",
        "fk": "mom_member_id ➔ members",
        "volume": "約100〜300件（年30〜50試合増）",
        "old_source": "試合記録SS (02.活動・試合記録 / 試合記録)",
        "columns": [
            ("試合ID", "match_id", "VARCHAR(50)", "試合一意ID", "PK", "NOT NULL", "なし", "-", "例: M20261110143000。試合を一意に特定するキー。"),
            ("試合開催日", "match_date", "VARCHAR(20)", "開催日", "-", "NOT NULL", "なし", "-", "yyyy/MM/dd 形式。年度別集計・戦績ソートの基準キー。"),
            ("カテゴリ", "category", "VARCHAR(50)", "活動区分", "-", "NULL", "なし", "-", "公式戦, TRM (練習試合), カップ戦, その他。"),
            ("対戦相手", "opponent", "VARCHAR(100)", "相手チーム名", "-", "NULL", "なし", "-", "対戦相手クラブ・チーム名称。"),
            ("自チーム得点", "my_score", "INTEGER", "自チーム得点", "-", "NOT NULL", "0", "-", "FC Bentenの総得点（score_logsの得点数と連動）。"),
            ("相手チーム得点", "opp_score", "INTEGER", "相手得点", "-", "NOT NULL", "0", "-", "対戦相手の総得点（score_logsの相手得点数と連動）。"),
            ("勝敗結果", "result", "VARCHAR(20)", "勝敗", "-", "NULL", "なし", "-", "勝利, 敗北, 引き分け。スコアから自動判定。"),
            ("出場選手一覧", "attended_players", "TEXT", "参加メンバー", "-", "NULL", "なし", "-", "出場選手の氏名カンマ区切りテキスト（例: 山田, 佐藤, 田中）。"),
            ("会場名", "location", "TEXT", "試合会場", "-", "NULL", "なし", "-", "グラウンド名・スタジアム名（例: 弁天小学校G, 新宿中央公園）。"),
            ("MOMメンバーID", "mom_member_id", "VARCHAR(50)", "MOMメンバーID", "-", "NULL", "なし", "members(member_id)", "Man of the Match に選出された選手のmember_id。選手名簿と完全連携。"),
            ("登録日時", "created_at", "TIMESTAMPTZ", "作成日時", "-", "NOT NULL", "NOW()", "-", "試合結果が新規登録された日時。"),
            ("最終更新日時", "updated_at", "TIMESTAMPTZ", "更新日時", "-", "NOT NULL", "NOW()", "-", "試合結果が修正・更新された日時。")
        ],
        "indexes": [
            ("idx_matches_date", "match_date DESC", "B-Tree", "No", "試合結果画面 (SCR03) における直近試合順の超高速ソート・表示用。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからの戦績一覧取得およびスコア入力画面からの即時書き込みを許可。")
        ],
        "migration": [
            ("試合記録SS (02.活動・試合記録)", "試合記録", "A列〜J列 (10列)", "matchesテーブル各列", "全過去試合レコードをPostgreSQLに移行（MOMはmember_idへ紐付け）。")
        ]
    },
    {
        "phys_name": "score_logs",
        "logic_name": "得点・カード詳細ログ",
        "summary": "試合ごとの前後半・分・得点者・アシスト・警告カードの個別詳細ログ（完全正規化）",
        "pk": "log_id",
        "fk": "match_id, member_id, assist_member_id ➔ members/matches",
        "volume": "約500〜1,500件（試合数×数件〜十数件）",
        "old_source": "試合記録SS (02.活動・試合記録 / 得点・カード詳細)",
        "columns": [
            ("ログID", "log_id", "VARCHAR(50)", "ログ一意ID", "PK", "NOT NULL", "なし", "-", "例: L2026111014352101。各イベントの一意識別子。"),
            ("試合ID", "match_id", "VARCHAR(50)", "親試合ID", "-", "NOT NULL", "なし", "matches(match_id)", "該当する試合のID。親試合削除時は CASCADE で連動削除。"),
            ("前後半区分", "period", "VARCHAR(20)", "時間区分", "-", "NULL", "なし", "-", "前半, 後半, 延長前半, 延長後半, PK戦。"),
            ("経過時間 (分)", "minute", "INTEGER", "経過時間", "-", "NOT NULL", "0", "-", "イベント発生分数（例: 15, 35）。"),
            ("ログ種別", "log_type", "VARCHAR(50)", "イベント種別", "-", "NOT NULL", "なし", "-", "得点, 相手得点, アシスト, イエローカード, レッドカード。"),
            ("メンバーID", "member_id", "VARCHAR(50)", "メンバーID", "-", "NOT NULL", "なし", "members(member_id)", "得点者、警告・退場を受けた選手のmember_id（助っ人・OG等のシステム予約枠含む）。"),
            ("アシストメンバーID", "assist_member_id", "VARCHAR(50)", "アシストメンバーID", "-", "NULL", "なし", "members(member_id)", "得点を演出したアシスト選手のmember_id（単独得点・アシストなし時はNULL）。"),
            ("登録日時", "created_at", "TIMESTAMPTZ", "登録日時", "-", "NOT NULL", "NOW()", "-", "ログが作成されたタイムスタンプ。")
        ],
        "indexes": [
            ("idx_score_logs_match", "match_id", "B-Tree", "No", "試合IDによる得点詳細ログの一括JOIN取得用（SCR03/05高速化）。"),
            ("idx_score_logs_member", "member_id", "B-Tree", "No", "個人別得点・ランキング集計の超高速化インデックス。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからのログ読み込み・試合入力画面からのトランザクション保存用。")
        ],
        "migration": [
            ("試合記録SS (02.活動・試合記録)", "得点・カード詳細", "A列〜G列 (7列)", "score_logsテーブル各列", "選手名テキストをmember_idに正規化マッピングして移行。")
        ]
    },
    {
        "phys_name": "attendance",
        "logic_name": "予定出欠",
        "summary": "Googleカレンダー予定に対する部員個別の出欠回答、コメント（完全正規化・複合主キー設計）",
        "pk": "event_id, member_id",
        "fk": "member_id ➔ members",
        "volume": "約1,000〜5,000件（予定数×部員数）",
        "old_source": "Google Calendar API (予定ゲスト出欠) + 新設テーブル",
        "columns": [
            ("予定ID", "event_id", "VARCHAR(255)", "カレンダーID", "PK", "NOT NULL", "なし", "-", "GoogleカレンダーのEvent ID。予定と出欠を一意に同期。"),
            ("メンバーID", "member_id", "VARCHAR(50)", "メンバーID", "PK", "NOT NULL", "なし", "members(member_id)", "回答したメンバーのID。退団時はCASCADE連動。氏名はmembersから取得。"),
            ("予定開催日", "event_date", "VARCHAR(20)", "活動日", "-", "NULL", "なし", "-", "yyyy/MM/dd 形式。出欠一覧の日付フィルタ用。"),
            ("予定タイトル", "event_title", "VARCHAR(255)", "活動名", "-", "NULL", "なし", "-", "カレンダーのサマリー（例: 定例TR, TRM vs FC〇〇）。"),
            ("出欠ステータス", "status", "VARCHAR(20)", "回答状況", "-", "NOT NULL", "なし", "-", "'yes' (出席), 'no' (欠席), 'maybe' (未定)。"),
            ("連絡・備考", "comment", "TEXT", "連絡事項", "-", "NULL", "なし", "-", "遅刻・早退時間、車出し可能人数、体調不良などの自由記述（カレンダーの回答メモと双方向同期）。"),
            ("回答更新日時", "updated_at", "TIMESTAMPTZ", "更新日時", "-", "NOT NULL", "NOW()", "-", "出欠回答・ステータス変更が行われた最新タイムスタンプ。")
        ],
        "indexes": [
            ("idx_attendance_event", "event_id", "B-Tree", "No", "予定ごとの出欠者一覧（yes/no/maybe）を即座に取得するための必須インデックス。"),
            ("idx_attendance_member", "member_id", "B-Tree", "No", "選手ごとの通算出席率集計（ビュー高速化）用インデックス。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからの0秒楽観的UI更新および直接保存用。")
        ],
        "migration": [
            ("Google Calendar API", "カレンダー予定Attendees", "responseStatus, comment", "attendanceテーブル", "カレンダーの既存出欠・メモを初期移行バッチで一括ロード。")
        ]
    },
    {
        "phys_name": "equipment_master",
        "logic_name": "備品マスタ",
        "summary": "ビブス・ボール・審判具等の品目定義、活動種別(TR/TRM/公式戦)ごとの持参必須ルール",
        "pk": "equipment_code",
        "fk": "なし",
        "volume": "約10〜20件（品目数固定）",
        "old_source": "備品管理SS (03.備品管理 / 備品マスタ)",
        "columns": [
            ("備品コード", "equipment_code", "VARCHAR(50)", "備品コード", "PK", "NOT NULL", "なし", "-", "BIBS_BLUE, BIBS_YELLOW, BALL_TEAM, TRIPOD, REF_GEAR 等の一意定数。"),
            ("備品名称", "name", "VARCHAR(100)", "品目正式名", "-", "NOT NULL", "なし", "-", "ビブス(青), ビブス(黄), ボール(チーム所有), 作戦ボード 等の表示名。"),
            ("運用ルール種別", "rule_type", "VARCHAR(20)", "持参ルール区分", "-", "NOT NULL", "'ROTATION'", "-", "ROTATION (出席者持ち回りローテーション) または COUNT (持参数集計)。"),
            ("練習(TR)要否", "req_tr", "VARCHAR(20)", "TR持参規定", "-", "NOT NULL", "'NONE'", "-", "REQUIRED (必須), REQUIRED_EITHER (青黄どちらか必須), OPTIONAL (任意), NONE (不要)。"),
            ("TRM要否", "req_trm", "VARCHAR(20)", "TRM持参規定", "-", "NOT NULL", "'NONE'", "-", "REQUIRED, REQUIRED_EITHER, OPTIONAL, NONE。"),
            ("公式戦要否", "req_official", "VARCHAR(20)", "公式戦規定", "-", "NOT NULL", "'NONE'", "-", "公式戦時の持参義務。審判具・両色ビブス・キャプテンマーク等は REQUIRED。"),
            ("品目運用説明", "notes", "TEXT", "備考・注意", "-", "NULL", "なし", "-", "取り扱い上の注意や保管要領の解説テキスト。"),
            ("表示並び順", "sort_order", "INTEGER", "ソート順", "-", "NOT NULL", "999", "-", "画面表示時の標準並び順（10, 20, 30...）。"),
            ("マスタ登録日時", "created_at", "TIMESTAMPTZ", "登録日時", "-", "NOT NULL", "NOW()", "-", "品目マスタ作成タイムスタンプ。")
        ],
        "indexes": [],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからの備品マスタ読み込みおよび管理者による品目追加用。")
        ],
        "migration": [
            ("備品管理SS (03.備品管理)", "備品マスタ", "A列〜G列 (7列)", "equipment_masterテーブル", "マーカーと作戦ボードの分離補正済みデータを完全移行。")
        ]
    },
    {
        "phys_name": "equipment_items",
        "logic_name": "備品現物アイテム管理",
        "summary": "備品現物個体の台帳、現在の保管担当選手、保管状態（保管中/補修中/紛失）（完全正規化）",
        "pk": "item_id",
        "fk": "equipment_code ➔ equipment_master, member_id ➔ members",
        "volume": "約20〜50件（現物個体台帳）",
        "old_source": "備品管理SS (03.備品管理 / 備品管理テーブル)",
        "columns": [
            ("現物管理ID", "item_id", "VARCHAR(50)", "個体一意ID", "PK", "NOT NULL", "なし", "-", "例: EQP-001, EQP-002。現物個体ごとの固定管理番号。"),
            ("備品コード", "equipment_code", "VARCHAR(50)", "備品コード", "-", "NOT NULL", "なし", "equipment_master(equipment_code)", "マスタの備品コード。品目削除時は CASCADE。"),
            ("現物表示名", "item_name", "VARCHAR(100)", "現物品名", "-", "NOT NULL", "なし", "-", "例: 試合球 #1, ビブス青(10枚組), 審判服(Lサイズ)。"),
            ("保管者メンバーID", "member_id", "VARCHAR(50)", "保管メンバーID", "-", "NULL", "なし", "members(member_id)", "現在この備品を自宅で預かっている部員のメンバーID。氏名・背番号はmembersから取得。"),
            ("保管状態", "status", "VARCHAR(50)", "現物状態", "-", "NOT NULL", "'保管中'", "-", "保管中, 使用中, 補修・点検中, 紛失。"),
            ("個体備考", "notes", "TEXT", "現物備考", "-", "NULL", "なし", "-", "ボールの空気圧、メッシュ袋の汚れ、三脚ネジの緩み等のメモ。"),
            ("最終更新日時", "updated_at", "TIMESTAMPTZ", "更新日時", "-", "NOT NULL", "NOW()", "-", "保管者やステータスが更新されたタイムスタンプ。")
        ],
        "indexes": [
            ("idx_equipment_items_code", "equipment_code", "B-Tree", "No", "品目別の現物検索・在庫数集計の高速化用。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからの備品所持状況一覧取得および保管者引き継ぎ更新用。")
        ],
        "migration": [
            ("備品管理SS (03.備品管理)", "備品管理テーブル", "A列〜G列 (7列)", "equipment_itemsテーブル", "保管者IDとステータスをそのまま投入（氏名・背番号はmembersへ正規化）。")
        ]
    },
    {
        "phys_name": "equipment_event_logs",
        "logic_name": "備品当番割当",
        "summary": "直近および今後の活動における備品持参当番割当、代理依頼、持参完了ステータス（完全正規化）",
        "pk": "log_id",
        "fk": "item_id ➔ equipment_items, assigned_member_id ➔ members",
        "volume": "約100〜500件（活動×持参必須品目）",
        "old_source": "備品管理SS (03.備品管理 / 備品当番割当)",
        "columns": [
            ("割当ログID", "log_id", "VARCHAR(50)", "割当一意ID", "PK", "NOT NULL", "なし", "-", "例: EQL-20261110-001。割当トランザクションの一意識別子。"),
            ("カレンダー予定ID", "event_id", "VARCHAR(255)", "対象予定ID", "-", "NOT NULL", "なし", "-", "持参対象となる活動のGoogleカレンダーEvent ID。"),
            ("活動日", "event_date", "VARCHAR(20)", "開催日", "-", "NOT NULL", "なし", "-", "yyyy/MM/dd 形式。日程順の当番ソート用。"),
            ("割当現物ID", "item_id", "VARCHAR(50)", "対象現物ID", "-", "NULL", "なし", "equipment_items(item_id)", "持参対象の備品現物ID。現物削除時は SET NULL。"),
            ("持参担当メンバーID", "assigned_member_id", "VARCHAR(50)", "担当者ID", "-", "NULL", "なし", "members(member_id)", "持参を担当する部員のメンバーID。氏名はmembersから取得。"),
            ("持参状況", "status", "VARCHAR(50)", "ステータス", "-", "NOT NULL", "'割当済'", "-", "割当済, 代理依頼中, 持参完了。"),
            ("割当日時", "created_at", "TIMESTAMPTZ", "作成日時", "-", "NOT NULL", "NOW()", "-", "当番が自動算出または手動調整されたタイムスタンプ。")
        ],
        "indexes": [
            ("idx_equipment_logs_event", "event_id", "B-Tree", "No", "該当活動における備品当番割当・持参チェックの高速取得用。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからの当番確認および部員による代理解決ボタン押下用。")
        ],
        "migration": [
            ("備品管理SS (03.備品管理)", "備品当番割当", "A列〜G列 (7列)", "equipment_event_logsテーブル", "過去割当履歴および直近の割当ログを投入（担当者名はmembersへ正規化）。")
        ]
    },
    {
        "phys_name": "bulletin_posts",
        "logic_name": "活動記録・掲示板",
        "summary": "チーム活動報告・連絡事項・試合速報・Wiki共有、ホームピン留め、論理削除（完全正規化）",
        "pk": "post_id",
        "fk": "author_member_id, updated_by_member_id ➔ members",
        "volume": "約100〜500件（年数十件増）",
        "old_source": "試合記録SS (02.活動・試合記録 / 活動記録)",
        "columns": [
            ("投稿ID", "post_id", "VARCHAR(50)", "投稿一意ID", "PK", "NOT NULL", "なし", "-", "例: BUL-20261110-001。投稿の一意識別子。"),
            ("カテゴリ", "category", "VARCHAR(50)", "投稿区分", "-", "NOT NULL", "'連絡'", "-", "連絡, 報告, 試合速報, 議事録, お知らせ。"),
            ("件名・タイトル", "title", "VARCHAR(255)", "投稿タイトル", "-", "NOT NULL", "なし", "-", "投稿の見出し。一覧およびホーム通知に表示。"),
            ("投稿本文", "content", "TEXT", "本文", "-", "NULL", "なし", "-", "連絡本文（改行・マークダウン・URLリンク対応）。"),
            ("関連予定ID", "event_id", "VARCHAR(255)", "紐付け活動ID", "-", "NULL", "なし", "-", "紐付け先のGoogleカレンダーEvent ID（任意）。"),
            ("関連予定タイトル", "event_title", "VARCHAR(255)", "紐付け活動名", "-", "NULL", "なし", "-", "紐付け先の活動タイトル。"),
            ("関連予定開催日", "event_date", "VARCHAR(20)", "紐付け活動日", "-", "NULL", "なし", "-", "yyyy/MM/dd 形式。"),
            ("ピン留めフラグ", "is_pinned", "BOOLEAN", "トップ固定", "-", "NOT NULL", "FALSE", "-", "TRUE: ホーム画面最上部に常時ピン留め固定表示。"),
            ("投稿メンバーID", "author_member_id", "VARCHAR(50)", "起票者ID", "-", "NULL", "なし", "members(member_id)", "作成した部員のメンバーID。氏名・アイコンはmembersから取得。"),
            ("投稿作成日時", "created_at", "TIMESTAMPTZ", "作成日時", "-", "NOT NULL", "NOW()", "-", "新規投稿タイムスタンプ。タイムライン順ソートキー。"),
            ("最終更新メンバーID", "updated_by_member_id", "VARCHAR(50)", "編集者ID", "-", "NULL", "なし", "members(member_id)", "直近に本文を共同編集・修正した部員のID。"),
            ("最終更新日時", "updated_at", "TIMESTAMPTZ", "更新日時", "-", "NOT NULL", "NOW()", "-", "本文が更新されたタイムスタンプ。"),
            ("論理削除フラグ", "is_deleted", "BOOLEAN", "削除フラグ", "-", "NOT NULL", "FALSE", "-", "TRUE: 削除済み（通常表示から除外、監査ログとして保持）。")
        ],
        "indexes": [
            ("idx_bulletin_posts_list", "(is_pinned DESC, created_at DESC)", "B-Tree", "No", "掲示板タイムライン (SCR09) およびホーム (SCR02) のピン留め優先・最新順爆速取得用。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからのタイムライン高速取得および部員によるWiki共同編集保存用。")
        ],
        "migration": [
            ("試合記録SS (02.活動・試合記録)", "活動記録", "A列〜O列 (15列)", "bulletin_postsテーブル", "既存の活動記録・お知らせ全件を完全移行（投稿者名はmembersへ正規化）。")
        ]
    },
    {
        "phys_name": "bulletin_reads",
        "logic_name": "掲示板既読",
        "summary": "重要連絡に対する部員ごとの既読追跡ログ、未読バッジ判定、二重登録防止（完全正規化）",
        "pk": "read_id",
        "fk": "post_id ➔ bulletin_posts, member_id ➔ members",
        "volume": "約500〜3,000件（投稿数×部員数）",
        "old_source": "試合記録SS (02.活動・試合記録 / 活動記録_既読)",
        "columns": [
            ("既読ID", "read_id", "VARCHAR(50)", "既読一意ID", "PK", "NOT NULL", "なし", "-", "例: READ-20261110-001。既読トランザクション一意ID。"),
            ("投稿ID", "post_id", "VARCHAR(50)", "対象投稿ID", "-", "NOT NULL", "なし", "bulletin_posts(post_id)", "閲覧された投稿ID。親投稿削除時は CASCADE。"),
            ("閲覧メンバーID", "member_id", "VARCHAR(50)", "閲覧選手ID", "-", "NOT NULL", "なし", "members(member_id)", "閲覧した部員のメンバーID。氏名はmembersから取得。"),
            ("初回閲覧日時", "read_at", "TIMESTAMPTZ", "既読日時", "-", "NOT NULL", "NOW()", "-", "投稿詳細を開いた日時の自動タイムスタンプ。")
        ],
        "indexes": [
            ("idx_bulletin_reads_post", "post_id", "B-Tree", "No", "投稿ごとの「既読者一覧・既読数」の高速集計用。"),
            ("uq_post_member_read", "(post_id, member_id)", "B-Tree", "Yes (一意制約)", "同一部員が同一投稿で重複して既読レコードを作成するのをDBレベルで防止。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからの自動既読登録および未読バッジ判定用。")
        ],
        "migration": [
            ("試合記録SS (02.活動・試合記録)", "活動記録_既読", "A列〜E列 (5列)", "bulletin_readsテーブル", "既存の既読記録を完全移行（閲覧者名はmembersへ正規化）。")
        ]
    },
    {
        "phys_name": "bulletin_comments",
        "logic_name": "掲示板コメント",
        "summary": "掲示板投稿に対する部員の返信・コメントスレッド、論理削除対応（完全正規化）",
        "pk": "comment_id",
        "fk": "post_id ➔ bulletin_posts, author_member_id ➔ members",
        "volume": "約200〜1,000件（投稿スレッドコメント）",
        "old_source": "試合記録SS (02.活動・試合記録 / 活動記録_コメント)",
        "columns": [
            ("コメントID", "comment_id", "VARCHAR(50)", "コメント一意ID", "PK", "NOT NULL", "なし", "-", "例: CMT-20261110-001。コメント一意識別子。"),
            ("投稿ID", "post_id", "VARCHAR(50)", "親投稿ID", "-", "NOT NULL", "なし", "bulletin_posts(post_id)", "返信先となる投稿のID。親投稿削除時は CASCADE。"),
            ("投稿メンバーID", "author_member_id", "VARCHAR(50)", "作成者ID", "-", "NULL", "なし", "members(member_id)", "コメントを投稿した部員のメンバーID。氏名はmembersから取得。"),
            ("コメント本文", "content", "TEXT", "本文", "-", "NOT NULL", "なし", "-", "コメント文章（改行・絵文字・URL対応）。"),
            ("投稿日時", "created_at", "TIMESTAMPTZ", "作成日時", "-", "NOT NULL", "NOW()", "-", "コメント投稿タイムスタンプ。"),
            ("論理削除フラグ", "is_deleted", "BOOLEAN", "削除フラグ", "-", "NOT NULL", "FALSE", "-", "TRUE: 削除済みコメント（「このコメントは削除されました」表示用）。")
        ],
        "indexes": [
            ("idx_bulletin_comments_post", "post_id", "B-Tree", "No", "投稿詳細画面におけるコメントスレッドの時系列順爆速ロード用。")
        ],
        "rls": [
            ("Allow anon full access", "anon, authenticated", "ALL", "true", "PWAアプリからのコメントスレッド取得および書き込み用。")
        ],
        "migration": [
            ("試合記録SS (02.活動・試合記録)", "活動記録_コメント", "A列〜G列 (7列)", "bulletin_commentsテーブル", "既存コメント全件を完全移行。")
        ]
    }
]

def main():
    print("Generating FC Benten Database Specification Workbook...")
    wb = openpyxl.Workbook()

    # 1. 目次・全体設計シート
    print("Building Table of Contents & DB Architecture Sheet...")
    build_toc_sheet(wb, TABLES_DATA)

    # 2. 各テーブル個別シート (10シート)
    for t in TABLES_DATA:
        print(f"Building Table Sheet: {t['phys_name']} ({t['logic_name']})...")
        build_table_sheet(wb, t)

    # 3. ストレージバケット仕様シート
    print("Building Storage Bucket Sheet: member-avatars...")
    build_storage_sheet(wb)

    output_path = r"d:\app\TeamManagement\docs\FC_Benten_データベーステーブル仕様書.xlsx"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        wb.save(output_path)
        print(f"Successfully saved to: {output_path}")
    except PermissionError:
        print(f"WARNING: {output_path} is currently locked (opened in Excel). Skipped overwrite.")

if __name__ == "__main__":
    main()
