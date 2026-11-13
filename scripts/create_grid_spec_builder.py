# -*- coding: utf-8 -*-
"""
FC Benten チーム管理システム 方眼紙グリッド (列幅2.0固定) 画面仕様書エンジン (階層インデント＆動的動作仕様対応版)
"""
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# カラーパレット
COLOR_NAVY_DARK = "1E3A8A"   # 表・ヘッダー背景色
COLOR_BLUE_MED = "2563EB"    # セクションバー (表1: 画面構成要素)
COLOR_GREEN_MED = "059669"   # セクションバー (表2: 動的動作仕様)
COLOR_RED_MED = "DC2626"     # セクションバー (表3: エラー一覧)
COLOR_AREA_BG = "EEF2FF"     # エリア枠背景色 (薄紫青)
COLOR_AREA_BORDER = "4338CA" # エリア枠線色 (濃紫)
COLOR_BORDER = "CBD5E1"      # 通常罫線色
COLOR_ROW_EVEN = "F8FAFC"    # テーブル偶数行
COLOR_TEXT_MAIN = "0F172A"   # 主要文字
COLOR_TEXT_MUTED = "475569"  # 補足文字
COLOR_ERR_BG = "FEF2F2"      # error背景 (薄赤)
COLOR_WARN_BG = "FFFBEB"     # warning背景 (薄黄)
COLOR_SLATE_DARK = "334155"  # セクションバー (表3: メッセージ一覧)

# フォント定義
f_title = Font(name="Meiryo UI", size=15, bold=True, color="FFFFFF")
f_sec_h1 = Font(name="Meiryo UI", size=11, bold=True, color="FFFFFF")
f_sec_h2 = Font(name="Meiryo UI", size=9, bold=True, color=COLOR_NAVY_DARK)
f_th = Font(name="Meiryo UI", size=9, bold=True, color="FFFFFF")
f_td = Font(name="Meiryo UI", size=9, color=COLOR_TEXT_MAIN)
f_td_bold = Font(name="Meiryo UI", size=9, bold=True, color=COLOR_TEXT_MAIN)
f_td_code = Font(name="Consolas", size=9, color=COLOR_TEXT_MAIN)
f_area_title = Font(name="Meiryo UI", size=9, bold=True, color="1E1B4B")
f_meta_k = Font(name="Meiryo UI", size=9, bold=True, color=COLOR_NAVY_DARK)
f_meta_v = Font(name="Meiryo UI", size=9, color=COLOR_TEXT_MAIN)
f_err_msg = Font(name="Meiryo UI", size=9, bold=True, color="B91C1C")
f_warn_msg = Font(name="Meiryo UI", size=9, bold=True, color="92400E")
f_info_msg = Font(name="Meiryo UI", size=9, color="334155")
f_info_lvl = Font(name="Meiryo UI", size=9, bold=True, color="475569")
f_req_must = Font(name="Meiryo UI", size=9, bold=True, color="DC2626") # 必須 (赤太字)
f_req_opt = Font(name="Meiryo UI", size=9, color=COLOR_TEXT_MUTED)     # 任意 (通常)

# 塗りつぶし定義
fill_navy = PatternFill(start_color=COLOR_NAVY_DARK, end_color=COLOR_NAVY_DARK, fill_type="solid")
fill_blue_med = PatternFill(start_color=COLOR_BLUE_MED, end_color=COLOR_BLUE_MED, fill_type="solid")
fill_green_med = PatternFill(start_color=COLOR_GREEN_MED, end_color=COLOR_GREEN_MED, fill_type="solid")
fill_red_med = PatternFill(start_color=COLOR_RED_MED, end_color=COLOR_RED_MED, fill_type="solid")
fill_slate_dark = PatternFill(start_color=COLOR_SLATE_DARK, end_color=COLOR_SLATE_DARK, fill_type="solid")
fill_bg_light = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
fill_area = PatternFill(start_color=COLOR_AREA_BG, end_color=COLOR_AREA_BG, fill_type="solid")
fill_area_band = PatternFill(start_color="F5F3FF", end_color="F5F3FF", fill_type="solid")
fill_even = PatternFill(start_color=COLOR_ROW_EVEN, end_color=COLOR_ROW_EVEN, fill_type="solid")
fill_odd = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
fill_err = PatternFill(start_color=COLOR_ERR_BG, end_color=COLOR_ERR_BG, fill_type="solid")
fill_warn = PatternFill(start_color=COLOR_WARN_BG, end_color=COLOR_WARN_BG, fill_type="solid")

# 罫線定義
side_thin = Side(border_style="thin", color=COLOR_BORDER)
side_med = Side(border_style="medium", color=COLOR_NAVY_DARK)
side_area = Side(border_style="medium", color=COLOR_AREA_BORDER)
border_box = Border(left=side_thin, right=side_thin, top=side_thin, bottom=side_thin)
border_th = Border(left=side_thin, right=side_thin, top=side_thin, bottom=side_med)

# 配置
al_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
al_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
al_top_left = Alignment(horizontal="left", vertical="top", wrap_text=True)
al_top_center = Alignment(horizontal="center", vertical="top", wrap_text=True)

GRID_TOTAL_COLS = 80
# Excel「列の幅」ダイアログで「2」にピッタリ表示するためのopenpyxl設定値 (2.75)
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

# =========================================================================
# 表1: 画面構成要素一覧（インデント階層型）
# 列配分（合計80列）:
# No(1-3=3) / 画面構成要素(4-26=23) / 項目ID(27-37=11) / 種別(38-45=8) /
# 必須(46-50=5) / 初期値(51-62=12) / 説明(63-80=18)
# =========================================================================
COLS_T1 = [
    ("No", 1, 3, al_top_center),
    ("画面構成要素 (エリア / 項目階層)", 4, 26, al_top_left),
    ("項目ID / クラス", 27, 37, al_top_left),
    ("要素種別", 38, 45, al_top_center),
    ("必須/任意", 46, 50, al_top_center),
    ("初期値 / 表示内容", 51, 62, al_top_left),
    ("概要・説明", 63, 80, al_top_left)
]

# =========================================================================
# 表2: 動的動作仕様一覧 (JavaScript / 画面イベント動作)
# 列配分（合計80列）:
# No(1-3=3) / 対象エリア(4-15=12) / イベント(16-25=10) /
# 動作仕様・処理内容(26-57=32) / 連携関数API(58-68=11) / 備考(69-80=12)
# =========================================================================
COLS_T2 = [
    ("No", 1, 3, al_top_center),
    ("対象エリア / 要素", 4, 15, al_top_left),
    ("イベント / トリガー", 16, 25, al_top_center),
    ("動作仕様・処理内容 (JavaScript / 画面動作)", 26, 57, al_top_left),
    ("連携関数 / API", 58, 68, al_top_left),
    ("備考・補足", 69, 80, al_top_left)
]

# =========================================================================
# 表3: メッセージ一覧
# 列配分（合計80列）:
# ID(1-5=5) / 種別(6-9=4) / 対象エリア(10-19=10) / トリガー(20-32=13) /
# 表示条件(33-46=14) / 表示形式(47-53=7) / メッセージ文言(54-68=15) / 解除・復帰(69-80=12)
# =========================================================================
COLS_T3 = [
    ("ID", 1, 5, al_top_center),
    ("種別", 6, 9, al_top_center),
    ("対象エリア / 項目", 10, 19, al_top_left),
    ("トリガー", 20, 32, al_top_left),
    ("表示条件 / チェック内容", 33, 46, al_top_left),
    ("表示形式", 47, 53, al_top_center),
    ("メッセージ文言", 54, 68, al_top_left),
    ("解除・復帰 / 補足", 69, 80, al_top_left)
]

def create_grid_screen_sheet(wb, sheet_title, screen_id, screen_name, permission, view_files, overview,
                             components_tree, dynamic_actions, validation_errors, flow_image_path=None):
    """
    画面単位の仕様書シートを生成する。
    """
    ws = wb.create_sheet(title=sheet_title)
    ws.views.sheetView[0].showGridLines = True
    set_grid_columns(ws, GRID_TOTAL_COLS, GRID_COL_WIDTH)

    # 1. 画面タイトルバー
    merge_and_style(ws, 1, 1, 1, GRID_TOTAL_COLS, value=f"【{screen_id}】{screen_name} 仕様書",
                    font=f_title, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[1].height = 30

    # 2. 画面基本情報
    merge_and_style(ws, 2, 1, 2, 8, value="画面ID", font=f_meta_k, fill=fill_bg_light, alignment=al_center)
    merge_and_style(ws, 2, 9, 2, 20, value=screen_id, font=f_meta_v, fill=fill_odd, alignment=al_center)
    merge_and_style(ws, 2, 21, 2, 30, value="アクセス権限", font=f_meta_k, fill=fill_bg_light, alignment=al_center)
    merge_and_style(ws, 2, 31, 2, 44, value=permission, font=f_meta_v, fill=fill_odd, alignment=al_center)
    merge_and_style(ws, 2, 45, 2, 56, value="View / Module", font=f_meta_k, fill=fill_bg_light, alignment=al_center)
    merge_and_style(ws, 2, 57, 2, GRID_TOTAL_COLS, value=view_files, font=f_td_code, fill=fill_odd, alignment=al_left)
    ws.row_dimensions[2].height = 20

    merge_and_style(ws, 3, 1, 3, 8, value="画面概要", font=f_meta_k, fill=fill_bg_light, alignment=al_center)
    merge_and_style(ws, 3, 9, 3, GRID_TOTAL_COLS, value=overview, font=f_meta_v, fill=fill_odd, alignment=al_left)
    ws.row_dimensions[3].height = 20

    # =========================================================================
    # 1. 画面構成要素一覧（インデント階層型）
    # =========================================================================
    curr_r = 5
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="1. 画面構成要素一覧 (エリア・項目階層 ＆ 要素定義)",
                    font=f_sec_h1, fill=fill_blue_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    # 表1 ヘッダー
    for h_name, start_c, end_c, _ in COLS_T1:
        merge_and_style(ws, curr_r, start_c, curr_r, end_c, value=h_name,
                        font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 26
    curr_r += 1

    item_no = 1
    for block in components_tree:
        b_type = block.get("type", "item")

        if b_type == "area":
            area_name = block.get("name", "")
            items = block.get("items", [])

            # 親エリアのヘッダー行を出力
            merge_and_style(ws, curr_r, 1, curr_r, 3, value="", font=f_td, fill=fill_area, alignment=al_center)
            # エリア名（列4〜26をフル幅で結合・太字・薄紫背景）
            merge_and_style(ws, curr_r, 4, curr_r, 26, value=f"▼ {area_name}",
                            font=f_area_title, fill=fill_area, alignment=Alignment(horizontal="left", vertical="center", indent=1))
            merge_and_style(ws, curr_r, 27, curr_r, 37, value="", font=f_td, fill=fill_area)
            merge_and_style(ws, curr_r, 38, curr_r, 45, value="エリア", font=Font(name="Meiryo UI", size=9, bold=True, color="475569"), fill=fill_area, alignment=al_center)
            merge_and_style(ws, curr_r, 46, curr_r, 50, value="-", font=f_td, fill=fill_area, alignment=al_center)
            merge_and_style(ws, curr_r, 51, curr_r, 62, value="", font=f_td, fill=fill_area)
            merge_and_style(ws, curr_r, 63, curr_r, 80, value=block.get("desc", f"{area_name}の表示・操作領域"), font=Font(name="Meiryo UI", size=9, color="475569"), fill=fill_area)
            ws.row_dimensions[curr_r].height = 22
            curr_r += 1

            # 配下の子項目を出力
            for it in items:
                name, i_id, e_type, req, init_val, desc = it
                row_fill = fill_odd if (item_no % 2 == 1) else fill_even

                # No
                merge_and_style(ws, curr_r, 1, curr_r, 3, value=item_no, font=f_td, fill=row_fill, alignment=al_top_center)
                
                # インデント表現: 列4〜5を「インデント帯」として確保、列6〜26を「子項目名」として結合
                merge_and_style(ws, curr_r, 4, curr_r, 5, value="└", font=Font(name="Meiryo UI", size=9, color="94A3B8"), fill=fill_area_band, alignment=al_center)
                merge_and_style(ws, curr_r, 6, curr_r, 26, value=name, font=f_td_bold, fill=row_fill, alignment=Alignment(horizontal="left", vertical="top", indent=1))

                # ID / クラス
                merge_and_style(ws, curr_r, 27, curr_r, 37, value=i_id, font=f_td_code, fill=row_fill, alignment=al_top_left)

                # 要素種別
                merge_and_style(ws, curr_r, 38, curr_r, 45, value=e_type, font=f_td, fill=row_fill, alignment=al_top_center)

                # 必須/任意 (入力欄は必須/任意、ラベル・ボタン等は「-」)
                req_val = req.strip()
                if req_val in ["必須"]:
                    r_font = f_req_must
                elif req_val in ["任意"]:
                    r_font = f_req_opt
                else:
                    req_val = "-"
                    r_font = f_td
                merge_and_style(ws, curr_r, 46, curr_r, 50, value=req_val, font=r_font, fill=row_fill, alignment=al_top_center)

                # 初期値 / 表示内容
                merge_and_style(ws, curr_r, 51, curr_r, 62, value=init_val, font=f_td, fill=row_fill, alignment=al_top_left)

                # 概要・説明
                merge_and_style(ws, curr_r, 63, curr_r, 80, value=desc, font=f_td, fill=row_fill, alignment=al_top_left)

                max_len = max(len(str(name)), len(str(desc)))
                ws.row_dimensions[curr_r].height = 36 if max_len > 40 else 24
                item_no += 1
                curr_r += 1

        else:
            # 単独項目 (親エリアなし、例: 新規作成ボタン、更に読み込むボタン)
            name = block.get("name", "")
            i_id = block.get("id", "")
            e_type = block.get("elem_type", "ボタン")
            req = block.get("req", "-")
            init_val = block.get("init", "")
            desc = block.get("desc", "")
            row_fill = fill_odd if (item_no % 2 == 1) else fill_even

            # No
            merge_and_style(ws, curr_r, 1, curr_r, 3, value=item_no, font=f_td, fill=row_fill, alignment=al_top_center)

            # 単独項目はインデントなしで列4〜26をフル結合
            merge_and_style(ws, curr_r, 4, curr_r, 26, value=name, font=f_td_bold, fill=row_fill, alignment=Alignment(horizontal="left", vertical="top", indent=1))

            # ID / クラス
            merge_and_style(ws, curr_r, 27, curr_r, 37, value=i_id, font=f_td_code, fill=row_fill, alignment=al_top_left)

            # 要素種別
            merge_and_style(ws, curr_r, 38, curr_r, 45, value=e_type, font=f_td, fill=row_fill, alignment=al_top_center)

            # 必須/任意
            req_val = req.strip()
            if req_val in ["必須"]:
                r_font = f_req_must
            elif req_val in ["任意"]:
                r_font = f_req_opt
            else:
                req_val = "-"
                r_font = f_td
            merge_and_style(ws, curr_r, 46, curr_r, 50, value=req_val, font=r_font, fill=row_fill, alignment=al_top_center)

            # 初期値 / 表示内容
            merge_and_style(ws, curr_r, 51, curr_r, 62, value=init_val, font=f_td, fill=row_fill, alignment=al_top_left)

            # 概要・説明
            merge_and_style(ws, curr_r, 63, curr_r, 80, value=desc, font=f_td, fill=row_fill, alignment=al_top_left)

            max_len = max(len(str(name)), len(str(desc)))
            ws.row_dimensions[curr_r].height = 36 if max_len > 40 else 24
            item_no += 1
            curr_r += 1

    curr_r += 1  # セクション間の空白行

    # =========================================================================
    # 2. 動的動作仕様一覧 (JavaScript / 画面イベント動作) 【新規別表】
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS, value="2. 動的動作仕様一覧 (JavaScript / 画面イベント・動的制御仕様)",
                    font=f_sec_h1, fill=fill_green_med, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    # 表2 ヘッダー
    for h_name, start_c, end_c, _ in COLS_T2:
        merge_and_style(ws, curr_r, start_c, curr_r, end_c, value=h_name,
                        font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 26
    curr_r += 1

    act_no = 1
    for act in dynamic_actions:
        target_elem, event_trigger, action_detail, api_func, note = act
        row_fill = fill_odd if (act_no % 2 == 1) else fill_even

        merge_and_style(ws, curr_r, 1, curr_r, 3, value=act_no, font=f_td, fill=row_fill, alignment=al_top_center)
        merge_and_style(ws, curr_r, 4, curr_r, 15, value=target_elem, font=f_td_bold, fill=row_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 16, curr_r, 25, value=event_trigger, font=f_td, fill=row_fill, alignment=al_top_center)
        merge_and_style(ws, curr_r, 26, curr_r, 57, value=action_detail, font=f_td, fill=row_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 58, curr_r, 68, value=api_func, font=f_td_code, fill=row_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 69, curr_r, 80, value=note, font=f_td, fill=row_fill, alignment=al_top_left)

        max_len = max(len(str(action_detail)), len(str(note)))
        ws.row_dimensions[curr_r].height = 42 if max_len > 60 else (28 if max_len > 30 else 22)
        act_no += 1
        curr_r += 1

    curr_r += 1  # セクション間の空白行

    # =========================================================================
    # 3. メッセージ一覧 (種別: info[無灯] / warning[黄背景] / error[赤背景])
    # =========================================================================
    merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                    value="3. メッセージ一覧 (種別: info[無灯] / warning[黄背景] / error[赤背景])",
                    font=f_sec_h1, fill=fill_slate_dark, alignment=Alignment(horizontal="left", vertical="center", indent=1))
    ws.row_dimensions[curr_r].height = 24
    curr_r += 1

    # 表3 ヘッダー
    for h_name, start_c, end_c, _ in COLS_T3:
        merge_and_style(ws, curr_r, start_c, curr_r, end_c, value=h_name,
                        font=f_th, fill=fill_navy, alignment=al_center, border=border_th)
    ws.row_dimensions[curr_r].height = 26
    curr_r += 1

    LEVEL_STYLES = {
        "info": ("info", fill_odd, f_info_lvl, f_info_msg),
        "warning": ("warning", fill_warn, f_warn_msg, f_warn_msg),
        "error": ("error", fill_err, f_err_msg, f_err_msg),
    }

    for err in validation_errors:
        if len(err) == 8:
            err_id, level, target, trigger, rule, disp_type, msg, recovery = err
        else:
            err_id, target, trigger, rule, disp_type, msg, recovery = err
            level = "error"

        lvl_label, lvl_fill, lvl_font, msg_font = LEVEL_STYLES.get(level, LEVEL_STYLES["error"])

        merge_and_style(ws, curr_r, 1, curr_r, 5, value=err_id, font=f_td_bold, fill=lvl_fill, alignment=al_top_center)
        merge_and_style(ws, curr_r, 6, curr_r, 9, value=lvl_label, font=lvl_font, fill=lvl_fill, alignment=al_top_center)
        merge_and_style(ws, curr_r, 10, curr_r, 19, value=target, font=f_td, fill=fill_odd, alignment=al_top_left)
        merge_and_style(ws, curr_r, 20, curr_r, 32, value=trigger, font=f_td, fill=fill_odd, alignment=al_top_left)
        merge_and_style(ws, curr_r, 33, curr_r, 46, value=rule, font=f_td, fill=fill_odd, alignment=al_top_left)
        merge_and_style(ws, curr_r, 47, curr_r, 53, value=disp_type, font=f_td, fill=fill_odd, alignment=al_top_center)
        merge_and_style(ws, curr_r, 54, curr_r, 68, value=msg, font=msg_font, fill=lvl_fill, alignment=al_top_left)
        merge_and_style(ws, curr_r, 69, curr_r, 80, value=recovery, font=f_td, fill=fill_odd, alignment=al_top_left)

        max_len = max(len(str(trigger)), len(str(rule)), len(str(msg)), len(str(recovery)))
        ws.row_dimensions[curr_r].height = 36 if max_len > 36 else 26
        curr_r += 1

    # =========================================================================
    # 4. データフロー図
    # =========================================================================
    if flow_image_path and os.path.exists(flow_image_path):
        curr_r += 1  # セクション間の空白行
        merge_and_style(ws, curr_r, 1, curr_r, GRID_TOTAL_COLS,
                        value="4. データ連携・画面遷移フロー図（初期表示・データ照合/更新・画面遷移）",
                        font=f_sec_h1, fill=fill_navy, alignment=Alignment(horizontal="left", vertical="center", indent=1))
        ws.row_dimensions[curr_r].height = 24
        curr_r += 1

        img = openpyxl.drawing.image.Image(flow_image_path)
        if img.width >= 1450:
            # 5列スイムレーン図などは80列グリッド全幅(約1580px)へフィット
            scale = 1580.0 / img.width
            img.width = int(img.width * scale)
            img.height = int(img.height * scale)
            ws.add_image(img, f"A{curr_r}")
        else:
            # 従来フォーマット(1380px等倍)
            ws.add_image(img, f"B{curr_r}")

        # 画像が覆う行数を確保
        rows_needed = int(img.height / 24) + 2
        for r_offset in range(rows_needed):
            ws.row_dimensions[curr_r + r_offset].height = 24
        curr_r += rows_needed
