# -*- coding: utf-8 -*-
"""
render_screen_flow.py
各画面ごとのデータ連携・画面遷移フロー図（HTML/PNG）を生成するモジュール
- 参照系（read）: 双方向矢印 (◀──▶) で「要求 / データ返却」を表現
- 更新系（write）: 片方向矢印 (──▶) で「呼出送信 / DB書込」を表現
- 遷移系（navigate）: 紫矢印 (──▶) で「ユーザー操作 / 画面遷移・モーダル展開」を表現
- 中間ノード: Supabase Direct (0.1s) / GAS API / Client Router を自動判別して色分け表示
- ストレージノード: Supabase (PostgreSQL 17) / Googleカレンダー / Storage / 遷移先画面カード
"""

def generate_flow_html(screen_info):
    flows_html = ""
    for idx, f in enumerate(screen_info["flows"], 1):
        flow_type = f.get("flow_type", "write")
        engine = f.get("engine", "supabase") # "supabase" | "gas" | "client"
        
        # 1. フロータイプ別の色・バッジ設定
        if flow_type == "read":
            badge_cls = "type-read"
            badge_icon = """<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>"""
            badge_text = f.get("badge_text", "参照・取得 (SELECT)")
            arrow1_txt = f.get("arrow1_label", "要求 / 返却")
            arrow2_txt = f.get("arrow2_label", "照会 / 抽出")
            arrow_color = "#0284C7"
        elif flow_type == "write":
            badge_cls = "type-write"
            badge_icon = """<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="12 5 19 12 12 19"></polyline><line x1="5" y1="12" x2="19" y2="12"></line></svg>"""
            badge_text = f.get("badge_text", "保存・更新 (UPSERT)")
            arrow1_txt = f.get("arrow1_label", "呼出送信")
            arrow2_txt = f.get("arrow2_label", "データ書込")
            arrow_color = "#2563EB"
        elif flow_type == "delete":
            badge_cls = "type-delete"
            badge_icon = """<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>"""
            badge_text = f.get("badge_text", "削除・退団 (DELETE)")
            arrow1_txt = f.get("arrow1_label", "削除要求")
            arrow2_txt = f.get("arrow2_label", "論理削除")
            arrow_color = "#DC2626"
        else: # navigate
            badge_cls = "type-navigate"
            badge_icon = """<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>"""
            badge_text = f.get("badge_text", "画面遷移 / モーダル展開")
            arrow1_txt = f.get("arrow1_label", "操作イベント")
            arrow2_txt = f.get("arrow2_label", "遷移・描画")
            arrow_color = "#7C3AED"

        # 2. 矢印 SVG
        if flow_type == "read":
            arrow1_svg = f"""
            <svg width="68" height="38" viewBox="0 0 68 38" fill="none">
              <text x="34" y="11" text-anchor="middle" font-size="8.5" font-weight="bold" fill="{arrow_color}">{arrow1_txt}</text>
              <line x1="12" y1="22" x2="56" y2="22" stroke="{arrow_color}" stroke-width="3"/>
              <polygon points="14,17 4,22 14,27" fill="{arrow_color}"/>
              <polygon points="54,17 64,22 54,27" fill="{arrow_color}"/>
            </svg>
            """
            arrow2_svg = f"""
            <svg width="68" height="38" viewBox="0 0 68 38" fill="none">
              <text x="34" y="11" text-anchor="middle" font-size="8.5" font-weight="bold" fill="{arrow_color}">{arrow2_txt}</text>
              <line x1="12" y1="22" x2="56" y2="22" stroke="{arrow_color}" stroke-width="3"/>
              <polygon points="14,17 4,22 14,27" fill="{arrow_color}"/>
              <polygon points="54,17 64,22 54,27" fill="{arrow_color}"/>
            </svg>
            """
        else:
            arrow1_svg = f"""
            <svg width="68" height="38" viewBox="0 0 68 38" fill="none">
              <text x="34" y="11" text-anchor="middle" font-size="8.5" font-weight="bold" fill="{arrow_color}">{arrow1_txt}</text>
              <line x1="4" y1="22" x2="56" y2="22" stroke="{arrow_color}" stroke-width="3"/>
              <polygon points="54,17 64,22 54,27" fill="{arrow_color}"/>
            </svg>
            """
            arrow2_svg = f"""
            <svg width="68" height="38" viewBox="0 0 68 38" fill="none">
              <text x="34" y="11" text-anchor="middle" font-size="8.5" font-weight="bold" fill="{arrow_color}">{arrow2_txt}</text>
              <line x1="4" y1="22" x2="56" y2="22" stroke="{arrow_color}" stroke-width="3"/>
              <polygon points="54,17 64,22 54,27" fill="{arrow_color}"/>
            </svg>
            """

        # 3. 中間エンジンノードのスタイル (Supabase / GAS / Client)
        if engine == "supabase":
            engine_cls = "node-engine-supabase"
            engine_title = "Supabase Client (Direct REST)"
            engine_badge = '<span class="engine-badge bg-green">Direct CRUD</span>'
            func_icon_bg = "#10B981"
        elif engine == "gas":
            engine_cls = "node-engine-gas"
            engine_title = "Google Apps Script (GAS)"
            engine_badge = '<span class="engine-badge bg-blue">RPC API</span>'
            func_icon_bg = "#2563EB"
        else: # client
            engine_cls = "node-engine-client"
            engine_title = "Client Router / UI Controller"
            engine_badge = '<span class="engine-badge bg-purple">UI Action</span>'
            func_icon_bg = "#7C3AED"

        file_name = f.get("file_name", "js/supabase.js")
        func_name = f.get("func_name", "fetchData()")

        # 4. ストレージ / 遷移先ノード
        storage_type = f.get("storage_type", "db")
        target_badge = f.get("target_badge", "遷移先画面 / モーダル")
        target_badge_style = 'background:#EDE9FE; color:#6D28D9; border-color:#DDD6FE;'
        if "カード切替" in target_badge or "画面内" in target_badge:
            target_badge_style = 'background:#FEF3C7; color:#B45309; border-color:#FDE68A;'
        elif "外部" in target_badge or "リダイレクト" in target_badge:
            target_badge_style = 'background:#E0F2FE; color:#0369A1; border-color:#BAE6FD;'

        if storage_type == "navigate":
            # 画面遷移専用ノード
            storage_html = f"""
            <div class="node-box node-target-screen">
              <div class="target-screen-header">
                <span class="target-screen-badge" style="{target_badge_style}">{target_badge}</span>
              </div>
              <div class="target-screen-body">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2.2" style="flex-shrink:0;">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <div class="target-screen-info">
                  <div class="target-screen-name">{f['storage_name']}</div>
                  <div class="target-screen-desc">{f['storage_detail']}</div>
                </div>
              </div>
            </div>
            """
        else:
            if storage_type == "db":
                storage_icon = """
                <svg class="storage-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="32" cy="14" rx="26" ry="9" stroke="#065F46" stroke-width="3" fill="#D1FAE5"/>
                  <path d="M6 14V32C6 37 18 41 32 41C46 41 58 37 58 32V14" stroke="#065F46" stroke-width="3" fill="#ECFDF5"/>
                  <ellipse cx="32" cy="32" rx="26" ry="9" stroke="#065F46" stroke-width="2" stroke-dasharray="3 3"/>
                  <path d="M6 32V50C6 55 18 59 32 59C46 59 58 55 58 50V32" stroke="#065F46" stroke-width="3" fill="#D1FAE5"/>
                </svg>
                """
                storage_cls = "badge-db"
            elif storage_type == "calendar":
                storage_icon = """
                <svg class="storage-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="14" width="48" height="42" rx="6" stroke="#1E40AF" stroke-width="3" fill="#DBEAFE"/>
                  <line x1="8" y1="26" x2="56" y2="26" stroke="#1E40AF" stroke-width="3"/>
                  <line x1="20" y1="8" x2="20" y2="18" stroke="#1E40AF" stroke-width="4" stroke-linecap="round"/>
                  <line x1="44" y1="8" x2="44" y2="18" stroke="#1E40AF" stroke-width="4" stroke-linecap="round"/>
                  <circle cx="24" cy="36" r="3" fill="#2563EB"/>
                  <circle cx="32" cy="36" r="3" fill="#2563EB"/>
                  <circle cx="40" cy="36" r="3" fill="#2563EB"/>
                  <circle cx="24" cy="46" r="3" fill="#2563EB"/>
                  <circle cx="32" cy="46" r="3" fill="#2563EB"/>
                  <circle cx="40" cy="46" r="3" fill="#2563EB"/>
                </svg>
                """
                storage_cls = "badge-cal"
            elif storage_type == "storage":
                storage_icon = """
                <svg class="storage-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 8 H50 C53 8 56 11 56 14 V50 C56 53 53 56 50 56 H14 C11 56 8 53 8 50 V14 C8 11 11 8 14 8 Z" stroke="#0891B2" stroke-width="3" fill="#CFFAFE"/>
                  <circle cx="22" cy="24" r="5" fill="#06B6D4"/>
                  <path d="M12 48 L26 34 L38 46 L44 40 L52 48" stroke="#0891B2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                """
                storage_cls = "badge-storage"
            else: # auth / local
                storage_icon = """
                <svg class="storage-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="12" y="24" width="40" height="30" rx="4" stroke="#475569" stroke-width="3" fill="#F1F5F9"/>
                  <path d="M22 24 V18 C22 12.5 26.5 8 32 8 C37.5 8 42 12.5 42 18 V24" stroke="#475569" stroke-width="3"/>
                  <circle cx="32" cy="39" r="4" fill="#334155"/>
                </svg>
                """
                storage_cls = "badge-auth"

            storage_html = f"""
            <div class="node-box node-storage {storage_cls}">
              <div class="storage-icon-wrap">
                {storage_icon}
              </div>
              <div class="storage-info">
                <div class="storage-title">{f['storage_name']}</div>
                <div class="storage-desc">{f['storage_detail']}</div>
              </div>
            </div>
            """

        # 5. 後続の画面遷移バッジ (ある場合)
        next_screen_html = ""
        if f.get("next_screen"):
            next_screen_html = f"""
            <div class="next-screen-connector">
              <div class="dashed-arrow">
                <svg width="34" height="28" viewBox="0 0 34 28">
                  <path d="M 0 14 L 26 14 M 18 7 L 26 14 L 18 21" stroke="#059669" stroke-width="2.8" stroke-dasharray="3 3" fill="none"/>
                </svg>
              </div>
              <div class="next-screen-badge">
                <div class="next-label">完了後 画面遷移</div>
                <div class="next-name">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-1px; margin-right:3px;">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  {f['next_screen']}
                </div>
              </div>
            </div>
            """

        # 画面ノードのカード表示
        sub_card_html = f'<div style="font-size: 10px; color: #2563EB; font-weight: 800; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 4px; padding: 1px 4px; margin-top: 3px; display: inline-block;">{f["screen_sub_card"]}</div>' if f.get("screen_sub_card") else ''

        flows_html += f"""
        <div class="flow-row">
          <div class="flow-header-row">
            <span class="flow-seq-num">フロー #{idx}</span>
            <span class="flow-type-badge {badge_cls}">
              {badge_icon}
              {badge_text}
            </span>
          </div>
          <div class="flow-diagram-track">
            
            <!-- 1. 画面ノード (画面タイトル + トリガー) -->
            <div class="node-box node-screen">
              <div class="node-header">
                <div class="screen-title-text">{screen_info['screen_id']} {screen_info['screen_name']}</div>
                {sub_card_html}
              </div>
              <div class="screen-display-icon">
                <svg width="52" height="40" viewBox="0 0 64 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="58" height="36" rx="4" fill="#F8FAFC" stroke="#1E293B" stroke-width="3"/>
                  <rect x="8" y="8" width="48" height="26" rx="2" fill="#3B82F6" fill-opacity="0.12" stroke="#94A3B8" stroke-width="1.5"/>
                  <line x1="12" y1="14" x2="30" y2="14" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
                  <line x1="12" y1="21" x2="44" y2="21" stroke="#64748B" stroke-width="2" stroke-linecap="round"/>
                  <line x1="12" y1="27" x2="38" y2="27" stroke="#64748B" stroke-width="2" stroke-linecap="round"/>
                  <path d="M26 39L24 46H40L38 39" stroke="#1E293B" stroke-width="3" stroke-linejoin="round" fill="#CBD5E1"/>
                  <line x1="18" y1="46" x2="46" y2="46" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="trigger-box">
                <span class="trigger-label">トリガー / 操作</span>
                <span class="trigger-name">{f['trigger']}</span>
              </div>
            </div>

            <!-- 矢印 1 (画面 ➔ 中間エンジン) -->
            <div class="arrow-container">
              {arrow1_svg}
            </div>

            <!-- 2. 中間エンジンノード (Supabase Client / GAS / Client Router) -->
            <div class="node-box {engine_cls}">
              <div class="engine-main-label">
                <span>{engine_title}</span>
                {engine_badge}
              </div>
              <div class="engine-file-box">
                <div class="engine-file-header">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" style="vertical-align:-1px; margin-right:4px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {file_name}
                </div>
                <div class="engine-func-box">
                  <span class="func-icon" style="background:{func_icon_bg};">fn</span>
                  <span class="func-name">{func_name}</span>
                </div>
              </div>
            </div>

            <!-- 矢印 2 (中間エンジン ➔ ストレージ/遷移先) -->
            <div class="arrow-container">
              {arrow2_svg}
            </div>

            <!-- 3. ストレージ / 遷移先ノード -->
            {storage_html}

            <!-- 4. 後続の画面遷移 (ある場合) -->
            {next_screen_html}

          </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    background: #FFFFFF;
    color: #0F172A;
    padding: 10px;
    width: 1440px;
  }}
  .diagram-wrapper {{
    border: 1.5px solid #CBD5E1;
    border-radius: 10px;
    background: #FFFFFF;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }}
  .flow-row {{
    background: #F8FAFC;
    border: 1.5px solid #E2E8F0;
    border-radius: 8px;
    padding: 10px 14px;
    position: relative;
  }}
  .flow-header-row {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }}
  .flow-seq-num {{
    font-size: 12px;
    font-weight: 800;
    color: #1E3A8A;
    letter-spacing: 0.04em;
  }}
  .flow-type-badge {{
    font-size: 10px;
    font-weight: 800;
    padding: 2.5px 8px;
    border-radius: 5px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }}
  .type-read {{
    background: #E0F2FE;
    color: #0369A1;
    border: 1px solid #BAE6FD;
  }}
  .type-write {{
    background: #EEF2FF;
    color: #3730A3;
    border: 1px solid #C7D2FE;
  }}
  .type-delete {{
    background: #FEF2F2;
    color: #991B1B;
    border: 1px solid #FECACA;
  }}
  .type-navigate {{
    background: #F5F3FF;
    color: #5B21B6;
    border: 1px solid #DDD6FE;
  }}

  .flow-diagram-track {{
    display: flex;
    align-items: center;
    gap: 4px;
  }}

  /* 各ノード共通 */
  .node-box {{
    background: #FFFFFF;
    border-radius: 8px;
  }}

  /* 画面ノード */
  .node-screen {{
    width: 210px;
    border: 1.5px solid #3B82F6;
    padding: 8px 10px;
    text-align: center;
    background: #FFFFFF;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.08);
    flex-shrink: 0;
  }}
  .screen-title-text {{
    font-size: 12.5px;
    font-weight: 800;
    color: #1E3A8A;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 3px;
  }}
  .screen-display-icon {{
    margin: 2px auto;
    display: flex;
    justify-content: center;
  }}
  .trigger-box {{
    margin-top: 5px;
    border: 1.5px solid #334155;
    border-radius: 5px;
    background: #F1F5F9;
    padding: 3px 5px;
    text-align: center;
  }}
  .trigger-label {{
    display: block;
    font-size: 9px;
    color: #64748B;
    font-weight: 700;
    line-height: 1.1;
  }}
  .trigger-name {{
    font-size: 11px;
    font-weight: 800;
    color: #0F172A;
    display: block;
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}

  /* 矢印コンテナ */
  .arrow-container {{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 68px;
    flex-shrink: 0;
  }}

  /* 中間エンジンノード */
  .node-engine-supabase {{
    width: 350px;
    border: 2px solid #10B981;
    padding: 8px 10px;
    background: #FFFFFF;
    box-shadow: 0 2px 5px rgba(16, 185, 129, 0.06);
    flex-shrink: 0;
  }}
  .node-engine-gas {{
    width: 350px;
    border: 2px solid #34A853;
    padding: 8px 10px;
    background: #FFFFFF;
    box-shadow: 0 2px 5px rgba(52, 168, 83, 0.06);
    flex-shrink: 0;
  }}
  .node-engine-client {{
    width: 350px;
    border: 2px solid #6366F1;
    padding: 8px 10px;
    background: #FFFFFF;
    box-shadow: 0 2px 5px rgba(99, 102, 241, 0.06);
    flex-shrink: 0;
  }}

  .engine-main-label {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: 800;
    color: #0F172A;
    margin-bottom: 5px;
    border-bottom: 1.5px solid #F1F5F9;
    padding-bottom: 3px;
  }}
  .engine-badge {{
    font-size: 9px;
    font-weight: 800;
    padding: 1.5px 5px;
    border-radius: 4px;
    color: #FFFFFF;
  }}
  .bg-green {{ background: #10B981; }}
  .bg-blue {{ background: #2563EB; }}
  .bg-purple {{ background: #7C3AED; }}

  .engine-file-box {{
    border: 1px solid #CBD5E1;
    border-radius: 5px;
    background: #F8FAFC;
    padding: 5px 8px;
  }}
  .engine-file-header {{
    font-size: 11px;
    font-weight: 700;
    color: #334155;
    margin-bottom: 4px;
    font-family: Consolas, monospace;
  }}
  .engine-func-box {{
    border: 1px solid #94A3B8;
    border-radius: 4px;
    background: #FFFFFF;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  .func-icon {{
    color: #FFFFFF;
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 4.5px;
    border-radius: 3px;
    font-family: Consolas, monospace;
    flex-shrink: 0;
  }}
  .func-name {{
    font-size: 11px;
    font-weight: 700;
    color: #0F172A;
    font-family: Consolas, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}

  /* ストレージ ノード */
  .node-storage {{
    width: 290px;
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-width: 1.5px;
    border-style: solid;
    flex-shrink: 0;
  }}
  .badge-db {{
    border-color: #10B981;
    background: #F0FDF4;
  }}
  .badge-cal {{
    border-color: #3B82F6;
    background: #EFF6FF;
  }}
  .badge-storage {{
    border-color: #06B6D4;
    background: #ECFEFF;
  }}
  .badge-auth {{
    border-color: #64748B;
    background: #F8FAFC;
  }}
  .storage-icon {{
    width: 42px;
    height: 42px;
    flex-shrink: 0;
  }}
  .storage-info {{
    flex: 1;
    min-width: 0;
  }}
  .storage-title {{
    font-size: 13px;
    font-weight: 800;
    color: #0F172A;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .storage-desc {{
    font-size: 10px;
    color: #475569;
    line-height: 1.35;
  }}

  /* 画面遷移専用ノード (Target Screen) */
  .node-target-screen {{
    width: 290px;
    border: 2px dashed #7C3AED;
    background: #F5F3FF;
    border-radius: 8px;
    padding: 8px 10px;
    flex-shrink: 0;
  }}
  .target-screen-header {{
    margin-bottom: 4px;
  }}
  .target-screen-badge {{
    font-size: 9.5px;
    font-weight: 800;
    color: #6D28D9;
    background: #EDE9FE;
    padding: 1.5px 6px;
    border-radius: 4px;
    border: 1px solid #DDD6FE;
  }}
  .target-screen-body {{
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .target-screen-info {{
    flex: 1;
    min-width: 0;
  }}
  .target-screen-name {{
    font-size: 13px;
    font-weight: 800;
    color: #4C1D95;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .target-screen-desc {{
    font-size: 10px;
    color: #6D28D9;
    margin-top: 2px;
    line-height: 1.3;
  }}

  /* 画面遷移コネクタ (後続の画面遷移バッジ) */
  .next-screen-connector {{
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: 4px;
    flex-shrink: 0;
  }}
  .dashed-arrow {{
    display: flex;
    align-items: center;
  }}
  .next-screen-badge {{
    background: #ECFDF5;
    border: 1.5px dashed #059669;
    border-radius: 7px;
    padding: 5px 9px;
    text-align: center;
    min-width: 130px;
  }}
  .next-label {{
    font-size: 9px;
    font-weight: 800;
    color: #047857;
  }}
  .next-name {{
    font-size: 11px;
    font-weight: 800;
    color: #065F46;
    margin-top: 1px;
    white-space: nowrap;
  }}
</style>
</head>
<body>
  <div class="diagram-wrapper">
    {flows_html}
  </div>
</body>
</html>
"""
    return html
