# -*- coding: utf-8 -*-
"""
render_screen_flow.py
各画面ごとのデータ連携フロー図（PNG画像）を生成するスクリプト
- 参照・取得系（read）: 双方向矢印 (◀──▶) で要求とデータ返却を表現
- 保存・更新系（write）: 片方向矢印 (──▶) でデータの書き込み・永続化を表現
- 矢印上部に処理内容ラベル（要求/返却、書込等）を表示し、データの流れを直感化
"""
import os
from playwright.sync_api import sync_playwright

def generate_flow_html(screen_info):
    flows_html = ""
    for idx, f in enumerate(screen_info["flows"], 1):
        flow_type = f.get("flow_type", "write")
        
        # バッジとラベルのデフォルト
        if flow_type == "read":
            badge_cls = "type-read"
            badge_icon = """<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>"""
            badge_text = f.get("badge_text", "データ参照・取得 (双方向)")
            arrow1_txt = f.get("arrow1_label", "要求 / 返却")
            arrow2_txt = f.get("arrow2_label", "照会 / 抽出")
            arrow_color = "#0284C7"
        else:
            badge_cls = "type-write"
            badge_icon = """<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="12 5 19 12 12 19"></polyline><line x1="5" y1="12" x2="19" y2="12"></line></svg>"""
            badge_text = f.get("badge_text", "データ保存・更新 (片方向)")
            arrow1_txt = f.get("arrow1_label", "呼出送信")
            arrow2_txt = f.get("arrow2_label", "データ書込")
            arrow_color = "#2563EB"

        # 矢印1 (画面 <-> GAS)
        if flow_type == "read":
            arrow1_svg = f"""
            <svg width="65" height="38" viewBox="0 0 65 38" fill="none">
              <text x="32.5" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="{arrow_color}">{arrow1_txt}</text>
              <line x1="12" y1="22" x2="53" y2="22" stroke="{arrow_color}" stroke-width="3.5"/>
              <polygon points="14,16 4,22 14,28" fill="{arrow_color}"/>
              <polygon points="51,16 61,22 51,28" fill="{arrow_color}"/>
            </svg>
            """
        else:
            arrow1_svg = f"""
            <svg width="65" height="38" viewBox="0 0 65 38" fill="none">
              <text x="32.5" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="{arrow_color}">{arrow1_txt}</text>
              <line x1="4" y1="22" x2="53" y2="22" stroke="{arrow_color}" stroke-width="3.5"/>
              <polygon points="51,16 61,22 51,28" fill="{arrow_color}"/>
            </svg>
            """

        # 矢印2 (GAS <-> ストレージ)
        if flow_type == "read":
            arrow2_svg = f"""
            <svg width="65" height="38" viewBox="0 0 65 38" fill="none">
              <text x="32.5" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="{arrow_color}">{arrow2_txt}</text>
              <line x1="12" y1="22" x2="53" y2="22" stroke="{arrow_color}" stroke-width="3.5"/>
              <polygon points="14,16 4,22 14,28" fill="{arrow_color}"/>
              <polygon points="51,16 61,22 51,28" fill="{arrow_color}"/>
            </svg>
            """
        else:
            arrow2_svg = f"""
            <svg width="65" height="38" viewBox="0 0 65 38" fill="none">
              <text x="32.5" y="11" text-anchor="middle" font-size="9" font-weight="bold" fill="{arrow_color}">{arrow2_txt}</text>
              <line x1="4" y1="22" x2="53" y2="22" stroke="{arrow_color}" stroke-width="3.5"/>
              <polygon points="51,16 61,22 51,28" fill="{arrow_color}"/>
            </svg>
            """

        # ストレージアイコン
        if f["storage_type"] == "db":
            storage_icon = """
            <svg class="storage-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="32" cy="14" rx="26" ry="9" stroke="#1E3A8A" stroke-width="3" fill="#DBEAFE"/>
              <path d="M6 14V32C6 37 18 41 32 41C46 41 58 37 58 32V14" stroke="#1E3A8A" stroke-width="3" fill="#EFF6FF"/>
              <ellipse cx="32" cy="32" rx="26" ry="9" stroke="#1E3A8A" stroke-width="2" stroke-dasharray="3 3"/>
              <path d="M6 32V50C6 55 18 59 32 59C46 59 58 55 58 50V32" stroke="#1E3A8A" stroke-width="3" fill="#DBEAFE"/>
            </svg>
            """
            storage_badge_cls = "badge-db"
        elif f["storage_type"] == "calendar":
            storage_icon = """
            <svg class="storage-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="14" width="48" height="42" rx="6" stroke="#047857" stroke-width="3" fill="#D1FAE5"/>
              <line x1="8" y1="26" x2="56" y2="26" stroke="#047857" stroke-width="3"/>
              <line x1="20" y1="8" x2="20" y2="18" stroke="#047857" stroke-width="4" stroke-linecap="round"/>
              <line x1="44" y1="8" x2="44" y2="18" stroke="#047857" stroke-width="4" stroke-linecap="round"/>
              <circle cx="24" cy="36" r="3" fill="#059669"/>
              <circle cx="32" cy="36" r="3" fill="#059669"/>
              <circle cx="40" cy="36" r="3" fill="#059669"/>
              <circle cx="24" cy="46" r="3" fill="#059669"/>
              <circle cx="32" cy="46" r="3" fill="#059669"/>
              <circle cx="40" cy="46" r="3" fill="#059669"/>
            </svg>
            """
            storage_badge_cls = "badge-cal"
        else: # drive
            storage_icon = """
            <svg class="storage-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 12L42 12L58 40L38 40Z" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
              <path d="M6 40L22 12L32 30L16 56Z" fill="#3B82F6" stroke="#1D4ED8" stroke-width="2"/>
              <path d="M16 56L48 56L58 40L26 40Z" fill="#22C55E" stroke="#15803D" stroke-width="2"/>
            </svg>
            """
            storage_badge_cls = "badge-drive"

        # 画面遷移がある場合のHTML
        next_screen_html = ""
        if f.get("next_screen"):
            next_screen_html = f"""
            <div class="next-screen-connector">
              <div class="dashed-arrow">
                <svg width="40" height="28" viewBox="0 0 40 28">
                  <path d="M 0 14 L 30 14 M 22 6 L 30 14 L 22 22" stroke="#059669" stroke-width="3" stroke-dasharray="4 3" fill="none"/>
                </svg>
              </div>
              <div class="next-screen-badge">
                <div class="next-label">保存後 自動遷移</div>
                <div class="next-name">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px; margin-right:4px;">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  {f['next_screen']}
                </div>
              </div>
            </div>
            """

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
            
            <!-- 1. 画面ノード (モニタアイコン + 画面名 + トリガー枠) -->
            <div class="node-box node-screen">
              <div class="node-header">
                <div class="screen-title-text">{screen_info['screen_id']} {screen_info['screen_name']}</div>
              </div>
              <div class="screen-display-icon">
                <svg width="56" height="44" viewBox="0 0 64 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- モニタ外枠 -->
                  <rect x="3" y="3" width="58" height="36" rx="4" fill="#F8FAFC" stroke="#1E293B" stroke-width="3"/>
                  <!-- 画面内側 -->
                  <rect x="8" y="8" width="48" height="26" rx="2" fill="#3B82F6" fill-opacity="0.12" stroke="#94A3B8" stroke-width="1.5"/>
                  <line x1="12" y1="14" x2="30" y2="14" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
                  <line x1="12" y1="21" x2="44" y2="21" stroke="#64748B" stroke-width="2" stroke-linecap="round"/>
                  <line x1="12" y1="27" x2="38" y2="27" stroke="#64748B" stroke-width="2" stroke-linecap="round"/>
                  <!-- スタンド -->
                  <path d="M26 39L24 46H40L38 39" stroke="#1E293B" stroke-width="3" stroke-linejoin="round" fill="#CBD5E1"/>
                  <line x1="18" y1="46" x2="46" y2="46" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="trigger-box">
                <span class="trigger-label">トリガー</span>
                <span class="trigger-name">{f['trigger']}</span>
              </div>
            </div>

            <!-- 矢印 1 (画面 <-> GAS) -->
            <div class="arrow-container">
              {arrow1_svg}
            </div>

            <!-- 2. GAS ノード (大枠: GAS > ファイル枠 > 関数名枠) -->
            <div class="node-box node-gas">
              <div class="gas-main-label">GAS (Google Apps Script)</div>
              <div class="gas-file-box">
                <div class="gas-file-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" style="vertical-align:-2px; margin-right:4px;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {f['gas_file']}
                </div>
                <div class="gas-func-box">
                  <span class="func-icon">fn</span>
                  <span class="func-name">{f['gas_func']}</span>
                </div>
              </div>
            </div>

            <!-- 矢印 2 (GAS <-> ストレージ) -->
            <div class="arrow-container">
              {arrow2_svg}
            </div>

            <!-- 3. ストレージ ノード (DB/カレンダー/ドライブ) -->
            <div class="node-box node-storage {storage_badge_cls}">
              <div class="storage-icon-wrap">
                {storage_icon}
              </div>
              <div class="storage-info">
                <div class="storage-title">{f['storage_name']}</div>
                <div class="storage-desc">{f['storage_detail']}</div>
              </div>
            </div>

            <!-- 4. 画面遷移 (ある場合のみ) -->
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
    font-family: "Meiryo UI", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #FFFFFF;
    color: #0F172A;
    padding: 12px;
    width: 1380px;
  }}
  .diagram-wrapper {{
    border: 1.5px solid #CBD5E1;
    border-radius: 8px;
    background: #FFFFFF;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }}
  .flow-row {{
    background: #F8FAFC;
    border: 1.5px solid #E2E8F0;
    border-radius: 8px;
    padding: 12px 16px;
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
    letter-spacing: 0.05em;
  }}
  .flow-type-badge {{
    font-size: 10px;
    font-weight: bold;
    padding: 2px 8px;
    border-radius: 4px;
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
    color: #4338CA;
    border: 1px solid #C7D2FE;
  }}

  .flow-diagram-track {{
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  /* 各ノード共通 */
  .node-box {{
    background: #FFFFFF;
    border-radius: 8px;
    border: 1.5px solid #CBD5E1;
  }}

  /* 画面ノード */
  .node-screen {{
    width: 215px;
    border-color: #3B82F6;
    padding: 9px 12px;
    text-align: center;
    background: #FFFFFF;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.08);
    flex-shrink: 0;
  }}
  .screen-title-text {{
    font-size: 13px;
    font-weight: bold;
    color: #1E3A8A;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 5px;
  }}
  .screen-display-icon {{
    margin: 3px auto;
    display: flex;
    justify-content: center;
  }}
  .trigger-box {{
    margin-top: 6px;
    border: 1.5px solid #1E293B;
    border-radius: 5px;
    background: #F1F5F9;
    padding: 4px 6px;
    text-align: center;
  }}
  .trigger-label {{
    display: block;
    font-size: 9.5px;
    color: #64748B;
    font-weight: bold;
    line-height: 1.1;
  }}
  .trigger-name {{
    font-size: 12px;
    font-weight: bold;
    color: #0F172A;
    display: block;
    margin-top: 2px;
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
    width: 65px;
    flex-shrink: 0;
  }}

  /* GAS ノード */
  .node-gas {{
    width: 365px;
    border: 2px solid #1E293B;
    padding: 9px 12px;
    background: #FFFFFF;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
  }}
  .gas-main-label {{
    font-size: 13px;
    font-weight: 800;
    color: #0F172A;
    margin-bottom: 6px;
    letter-spacing: 0.04em;
    border-bottom: 1.5px solid #E2E8F0;
    padding-bottom: 3px;
  }}
  .gas-file-box {{
    border: 1.5px solid #64748B;
    border-radius: 5px;
    background: #F8FAFC;
    padding: 6px 9px;
  }}
  .gas-file-header {{
    font-size: 11.5px;
    font-weight: bold;
    color: #334155;
    margin-bottom: 5px;
    font-family: Consolas, monospace;
  }}
  .gas-func-box {{
    border: 1.5px solid #1E293B;
    border-radius: 5px;
    background: #FFFFFF;
    padding: 5px 8px;
    display: flex;
    align-items: center;
    gap: 7px;
  }}
  .func-icon {{
    background: #2563EB;
    color: #FFFFFF;
    font-size: 10px;
    font-weight: bold;
    padding: 1.5px 5px;
    border-radius: 4px;
    font-family: Consolas, monospace;
    flex-shrink: 0;
  }}
  .func-name {{
    font-size: 12px;
    font-weight: bold;
    color: #0F172A;
    font-family: Consolas, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}

  /* ストレージ ノード */
  .node-storage {{
    width: 300px;
    border-radius: 8px;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-width: 1.5px;
    border-style: solid;
    flex-shrink: 0;
  }}
  .badge-db {{
    border-color: #1E3A8A;
    background: #F0F7FF;
  }}
  .badge-cal {{
    border-color: #047857;
    background: #ECFDF5;
  }}
  .badge-drive {{
    border-color: #CA8A04;
    background: #FEFCE8;
  }}
  .storage-icon {{
    width: 48px;
    height: 48px;
    flex-shrink: 0;
  }}
  .storage-info {{
    flex: 1;
    min-width: 0;
  }}
  .storage-title {{
    font-size: 13.5px;
    font-weight: bold;
    color: #0F172A;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .storage-desc {{
    font-size: 10.5px;
    color: #475569;
    line-height: 1.35;
  }}

  /* 画面遷移コネクタ */
  .next-screen-connector {{
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
    flex-shrink: 0;
  }}
  .dashed-arrow {{
    display: flex;
    align-items: center;
  }}
  .next-screen-badge {{
    background: #ECFDF5;
    border: 1.5px dashed #059669;
    border-radius: 8px;
    padding: 6px 12px;
    text-align: center;
    min-width: 140px;
  }}
  .next-label {{
    font-size: 9.5px;
    font-weight: bold;
    color: #047857;
  }}
  .next-name {{
    font-size: 11.5px;
    font-weight: bold;
    color: #065F46;
    margin-top: 2px;
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
