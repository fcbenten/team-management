# -*- coding: utf-8 -*-
"""
render_swimlane_generic.py
SCR02〜SCR11 の 5列スイムレーン画面フロー相関図 HTML ビルダー＆レイアウトエンジン。
SCR01（render_swimlane_flow.py）と統一されたデザインシステム・スチールグレーDBシリンダー・
直交ノンオーバーラップ配線を採用し、実装コード（HTML / JS / Supabase Direct / GAS API）に
準拠した相関図を生成する。
"""
import json


COMMON_SWIMLANE_CSS = """
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    background: #FFFFFF;
    color: #0F172A;
    padding: 12px;
    width: 1884px;
  }

  .diagram-container {
    position: relative;
    width: 1860px;
    border: 1.5px solid #CBD5E1;
    border-radius: 12px;
    background: #F8FAFC;
    padding: 18px;
    overflow: hidden;
  }

  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 2px solid #E2E8F0;
  }
  .header-title {
    font-size: 19px;
    font-weight: 800;
    color: #0F172A;
  }
  .legend-group {
    display: flex;
    gap: 18px;
    font-size: 11.5px;
    font-weight: 700;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend-line {
    width: 24px;
    height: 3px;
    border-radius: 2px;
  }

  /* 5列スイムレーングリッド: 345 + 300 + 250 + 295 + 250 + 96*4 = 1824px */
  .lanes-grid {
    display: grid;
    grid-template-columns: 345px 300px 250px 295px 250px;
    gap: 96px;
    position: relative;
    z-index: 2;
  }

  .lane {
    border-radius: 14px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 760px;
    border: 2px solid;
  }
  .lane-screen {
    padding-left: 26px;
    background: #EFF6FF;
    border-color: #3B82F6;
  }
  .lane-screen .lane-header {
    background: #1D4ED8;
    color: #FFFFFF;
  }
  .lane-header {
    font-size: 13.5px;
    font-weight: 800;
    padding: 7px 10px;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 14px;
    letter-spacing: 0.03em;
  }

  .lane-js {
    background: #FFFBEB;
    border-color: #F59E0B;
  }
  .lane-js .lane-header {
    background: #D97706;
    color: #FFFFFF;
  }

  .lane-gas {
    background: #F0FDF4;
    border-color: #22C55E;
  }
  .lane-gas .lane-header {
    background: #15803D;
    color: #FFFFFF;
  }

  .lane-db {
    background: #F1F5F9;
    border-color: #64748B;
  }
  .lane-db .lane-header {
    background: #334155;
    color: #FFFFFF;
  }

  .lane-other {
    background: #F5F3FF;
    border-color: #8B5CF6;
  }
  .lane-other .lane-header {
    background: #6D28D9;
    color: #FFFFFF;
  }

  .lane-body {
    position: relative;
    flex: 1;
  }

  .lane-screen .lane-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sub-card {
    background: #FFFFFF;
    border: 2px solid #60A5FA;
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: 0 2px 6px rgba(59, 130, 246, 0.08);
    position: relative;
  }
  .sub-card-init {
    background: rgba(255, 255, 255, 0.85);
    border: 2px dashed #64748B;
    box-shadow: none;
  }
  .sub-card-title {
    font-size: 10px;
    font-weight: 800;
    color: #1E40AF;
    background: #DBEAFE;
    padding: 2px 8px;
    border-radius: 5px;
    margin-bottom: 6px;
    display: inline-block;
  }
  .sub-card-init .sub-card-title {
    color: #334155;
    background: #E2E8F0;
  }
  .sub-card-note {
    font-size: 9px;
    color: #92400E;
    background: #FFFBEB;
    border: 1px solid #FDE68A;
    border-radius: 5px;
    padding: 3px 7px;
    margin-bottom: 7px;
    line-height: 1.3;
    font-weight: 700;
  }
  .sub-card-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .node-item {
    background: #FFFFFF;
    border: 1.5px solid #94A3B8;
    border-radius: 8px;
    padding: 7px 10px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
    position: relative;
  }
  .node-trigger {
    background: #F8FAFC;
    border-color: #3B82F6;
  }
  .node-trigger-init {
    background: #F1F5F9;
    border: 1.5px dashed #64748B;
  }
  .node-js {
    background: #FFFFFF;
    border-color: #F59E0B;
    position: absolute;
    left: 0;
    right: 0;
  }
  .node-gas {
    background: #FFFFFF;
    border-color: #22C55E;
    position: absolute;
    left: 0;
    right: 0;
  }
  .node-ext {
    background: #FFFFFF;
    border-color: #64748B;
    position: absolute;
    left: 0;
    right: 0;
  }
  .node-other {
    background: #FFFFFF;
    border-color: #8B5CF6;
    position: absolute;
    left: 0;
    right: 0;
  }

  .node-db-cyl {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 214px;
    height: 94px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .node-db-cyl svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    filter: drop-shadow(0 3px 5px rgba(15, 23, 42, 0.12));
  }
  .node-db-cyl .db-label {
    position: relative;
    z-index: 1;
    text-align: center;
    margin-top: 22px;
    padding: 0 12px;
  }
  .node-db-cyl .db-name {
    font-size: 11.5px;
    font-weight: 800;
    color: #0F172A;
    line-height: 1.2;
  }
  .node-db-cyl .db-phys {
    font-size: 9px;
    font-weight: 700;
    color: #334155;
    font-family: Consolas, Monaco, monospace;
    background: #F1F5F9;
    border: 1px solid #64748B;
    border-radius: 4px;
    padding: 1px 6px;
    margin-top: 3px;
    display: inline-block;
    max-width: 192px;
    line-height: 1.25;
  }

  .nbadge {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
    margin-bottom: 3px;
  }
  .nb-blue { background: #DBEAFE; color: #1E40AF; }
  .nb-gray { background: #E2E8F0; color: #334155; }
  .nb-amber { background: #FEF3C7; color: #B45309; }
  .nb-green { background: #DCFCE7; color: #166534; }
  .nb-slate { background: #E2E8F0; color: #1E293B; }
  .nb-purple { background: #EDE9FE; color: #5B21B6; }

  .ntitle {
    font-size: 12px;
    font-weight: 800;
    color: #0F172A;
    line-height: 1.28;
    margin-bottom: 2px;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .ndesc {
    font-size: 10px;
    color: #475569;
    line-height: 1.3;
  }

  #svg-overlay {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 5;
  }

  .edge-label {
    position: absolute;
    z-index: 6;
    font-size: 9.5px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 5px;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
"""


def _esc(text):
    return (str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


def _render_cylinder_svg(idx):
    top_id = f"cylTop_{idx}"
    body_id = f"cylBody_{idx}"
    return (
        f'<svg viewBox="0 0 214 94" preserveAspectRatio="none">'
        f'  <defs>'
        f'    <linearGradient id="{top_id}" x1="0%" y1="0%" x2="100%" y2="0%">'
        f'      <stop offset="0%" stop-color="#E2E8F0"/>'
        f'      <stop offset="50%" stop-color="#F8FAFC"/>'
        f'      <stop offset="100%" stop-color="#CBD5E1"/>'
        f'    </linearGradient>'
        f'    <linearGradient id="{body_id}" x1="0%" y1="0%" x2="100%" y2="0%">'
        f'      <stop offset="0%" stop-color="#CBD5E1"/>'
        f'      <stop offset="30%" stop-color="#F8FAFC"/>'
        f'      <stop offset="70%" stop-color="#E2E8F0"/>'
        f'      <stop offset="100%" stop-color="#94A3B8"/>'
        f'    </linearGradient>'
        f'  </defs>'
        f'  <path d="M 4 17 L 4 76 A 103 14 0 0 0 210 76 L 210 17 Z" '
        f'fill="url(#{body_id})" stroke="#64748B" stroke-width="2"/>'
        f'  <ellipse cx="107" cy="17" rx="103" ry="14" '
        f'fill="url(#{top_id})" stroke="#64748B" stroke-width="2"/>'
        f'</svg>'
    )


def build_generic_swimlane_html(spec):
    """Build a 5-lane orthogonal swimlane diagram HTML from a structured spec dict."""
    scr_id = spec["scr_id"]
    title = spec["title"]
    lane1_title = spec["lane1_title"]

    cards_html = []
    js_nodes_html = []
    gas_nodes_html = []
    js_list = []
    gas_list = []

    row_global_idx = 0
    for c_idx, card in enumerate(spec["cards"]):
        card_id = f"c-{c_idx}"
        card_cls = "sub-card sub-card-init" if card.get("is_init") else "sub-card"
        note_html = f'<div class="sub-card-note">{_esc(card["note"])}</div>' if card.get("note") else ""
        trig_items_html = []
        for row in card["rows"]:
            t_id = f"t-{row_global_idx}"
            j_id = f"j-{row_global_idx}"
            trig = row["t"]
            t_cls = "node-item node-trigger-init" if trig.get("is_init") else "node-item node-trigger"
            tb_cls = "nb-gray" if trig.get("is_init") else "nb-blue"
            trig_items_html.append(
                f'<div class="{t_cls}" id="{t_id}">'
                f'  <span class="nbadge {tb_cls}">{_esc(trig["badge"])}</span>'
                f'  <div class="ntitle">{_esc(trig["title"])}</div>'
                f'  <div class="ndesc">{_esc(trig["desc"])}</div>'
                f'</div>'
            )

            js = row["j"]
            js_nodes_html.append(
                f'<div class="node-item node-js" id="{j_id}">'
                f'  <span class="nbadge nb-amber">{_esc(js["file"])}</span>'
                f'  <div class="ntitle">{_esc(js["func"])}</div>'
                f'  <div class="ndesc">{_esc(js["desc"])}</div>'
                f'</div>'
            )
            js_list.append({"jId": j_id, "tId": t_id, "rowIdx": row_global_idx})

            if row.get("g"):
                g_id = f"g-{row_global_idx}"
                gas = row["g"]
                gas_nodes_html.append(
                    f'<div class="node-item node-gas" id="{g_id}">'
                    f'  <span class="nbadge nb-green">{_esc(gas["file"])}</span>'
                    f'  <div class="ntitle">{_esc(gas["func"])}</div>'
                    f'  <div class="ndesc">{_esc(gas["desc"])}</div>'
                    f'</div>'
                )
                gas_list.append({"gId": g_id, "jId": j_id, "rowIdx": row_global_idx})
            row_global_idx += 1

        cards_html.append(
            f'<div class="{card_cls}" id="{card_id}">'
            f'  <div class="sub-card-title">{_esc(card["title"])}</div>'
            f'  {note_html}'
            f'  <div class="sub-card-list">{"".join(trig_items_html)}</div>'
            f'</div>'
        )

    lane4_nodes_html = []
    lane4_meta = []
    for idx, d in enumerate(spec["lane4_nodes"]):
        d_id = d["id"]
        if d["kind"] == "db":
            lane4_nodes_html.append(
                f'<div class="node-db-cyl" id="{d_id}">'
                f'  {_render_cylinder_svg(idx)}'
                f'  <div class="db-label">'
                f'    <div class="db-name">{_esc(d["logical"])}</div>'
                f'    <div class="db-phys">{_esc(d["physical"])}</div>'
                f'  </div>'
                f'</div>'
            )
        else:
            b_cls = "nb-slate" if d.get("kind") == "storage" else "nb-blue"
            lane4_nodes_html.append(
                f'<div class="node-item node-ext" id="{d_id}">'
                f'  <span class="nbadge {b_cls}">{_esc(d["badge"])}</span>'
                f'  <div class="ntitle">{_esc(d["title"])}</div>'
                f'  <div class="ndesc">{_esc(d["desc"])}</div>'
                f'</div>'
            )
        lane4_meta.append({"id": d_id, "anchorRows": d.get("anchor_rows", [0])})

    lane5_nodes_html = []
    lane5_meta = []
    for o in spec["lane5_nodes"]:
        o_id = o["id"]
        lane5_nodes_html.append(
            f'<div class="node-item node-other" id="{o_id}">'
            f'  <span class="nbadge nb-purple">{_esc(o["badge"])}</span>'
            f'  <div class="ntitle">{_esc(o["title"])}</div>'
            f'  <div class="ndesc">{_esc(o["desc"])}</div>'
            f'</div>'
        )
        lane5_meta.append({"id": o_id, "anchorRows": o.get("anchor_rows", [0])})

    edges_data = []
    r_idx = 0
    for card in spec["cards"]:
        for row in card["rows"]:
            t_id = f"t-{r_idx}"
            j_id = f"j-{r_idx}"
            g_id = f"g-{r_idx}" if row.get("g") else None
            edges_data.append({
                "rowIdx": r_idx,
                "tId": t_id,
                "jId": j_id,
                "gId": g_id,
                "gasBidir": bool(row["g"].get("bidir")) if row.get("g") else False,
                "tArrowLabel": row.get("t_label"),
                "targets": row.get("targets", [])
            })
            r_idx += 1

    layout_cfg = {
        "jsList": js_list,
        "gasList": gas_list,
        "lane4Meta": lane4_meta,
        "lane5Meta": lane5_meta,
        "edges": edges_data,
    }
    cfg_json = json.dumps(layout_cfg, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>{COMMON_SWIMLANE_CSS}</style>
</head>
<body>
<div class="diagram-container" id="diagram-container">
  <div class="header-bar">
    <div class="header-title">{_esc(title)}</div>
    <div class="legend-group">
      <div class="legend-item" style="white-space:nowrap;"><div class="legend-line" style="background:#2563EB;"></div>通常処理・参照 (JS/GAS)</div>
      <div class="legend-item" style="white-space:nowrap;"><div class="legend-line" style="background:#16A34A;"></div>Supabase Direct (GAS不要)</div>
      <div class="legend-item" style="white-space:nowrap;"><div class="legend-line" style="background:#D97706;"></div>画面内カード・モーダル切替</div>
      <div class="legend-item" style="white-space:nowrap;"><div class="legend-line" style="background:repeating-linear-gradient(to right,#7C3AED 0,#7C3AED 5px,transparent 5px,transparent 8px);"></div>他画面・モーダル遷移</div>
      <div class="legend-item" style="white-space:nowrap;color:#475569;"><strong style="margin-right:3px;">◀─▶</strong>双方向(参照/同期) / <strong style="margin:0 3px;">─▶</strong>単方向(更新/遷移)</div>
    </div>
  </div>

  <div class="lanes-grid" id="lanes-grid">
    <div class="lane lane-screen" id="lane-screen">
      <div class="lane-header">{_esc(lane1_title)}</div>
      <div class="lane-body" id="lane-screen-body">{"".join(cards_html)}</div>
    </div>

    <div class="lane lane-js" id="lane-js">
      <div class="lane-header">2. JS (クライアント処理)</div>
      <div class="lane-body" id="lane-js-body">{"".join(js_nodes_html)}</div>
    </div>

    <div class="lane lane-gas" id="lane-gas">
      <div class="lane-header">3. GAS (バックエンドAPI)</div>
      <div class="lane-body" id="lane-gas-body">{"".join(gas_nodes_html)}</div>
    </div>

    <div class="lane lane-db" id="lane-db">
      <div class="lane-header">4. DB / 外部API</div>
      <div class="lane-body" id="lane-db-body">{"".join(lane4_nodes_html)}</div>
    </div>

    <div class="lane lane-other" id="lane-other">
      <div class="lane-header">5. 他画面など</div>
      <div class="lane-body" id="lane-other-body">{"".join(lane5_nodes_html)}</div>
    </div>
  </div>

  <svg id="svg-overlay" xmlns="http://www.w3.org/2000/svg"></svg>
</div>

<script>
window.addEventListener('load', () => {{
  const cfg = {cfg_json};
  const container = document.getElementById('diagram-container');
  const lane1Body = document.getElementById('lane-screen-body');
  const lane2Body = document.getElementById('lane-js-body');
  const lane3Body = document.getElementById('lane-gas-body');
  const lane4Body = document.getElementById('lane-db-body');
  const lane5Body = document.getElementById('lane-other-body');

  function getBoxRel(el, parent) {{
    const er = el.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    return {{
      left: er.left - pr.left,
      right: er.right - pr.left,
      top: er.top - pr.top,
      bottom: er.bottom - pr.top,
      width: er.width,
      height: er.height,
      cx: (er.left + er.right) / 2 - pr.left,
      cy: (er.top + er.bottom) / 2 - pr.top
    }};
  }}

  // 1 & 2. Synchronize Lane 1 (Triggers), Lane 2 (JS), and Lane 3 (GAS) vertical centers so t->j->g arrows stay straight
  const rowCenterY = {{}};
  const bodyOffset12 = lane1Body.getBoundingClientRect().top - lane2Body.getBoundingClientRect().top;
  let prevJBottom = -16;
  let prevGBottom = -16;
  const gasByRow = {{}};
  cfg.gasList.forEach(item => {{ gasByRow[item.rowIdx] = item; }});

  cfg.jsList.forEach(item => {{
    const tEl = document.getElementById(item.tId);
    const jEl = document.getElementById(item.jId);
    const gasItem = gasByRow[item.rowIdx];
    const gEl = gasItem ? document.getElementById(gasItem.gId) : null;

    let tR = getBoxRel(tEl, lane1Body);
    const jH = jEl.offsetHeight;
    const gH = gEl ? gEl.offsetHeight : 0;

    let desiredCY = tR.cy + bodyOffset12;
    const minJTop = prevJBottom + 18;
    if (desiredCY - jH / 2 < minJTop) {{
      desiredCY = minJTop + jH / 2;
    }}
    if (gEl) {{
      const minGTop = prevGBottom + 20;
      if (desiredCY - gH / 2 < minGTop) {{
        desiredCY = minGTop + gH / 2;
      }}
    }}

    const delta = Math.round(desiredCY - (tR.cy + bodyOffset12));
    if (delta > 0) {{
      const parentCard = tEl.closest('.sub-card');
      const isFirstInCard = parentCard && parentCard.querySelector('.node-item') === tEl;
      if (isFirstInCard) {{
        const curMt = parseFloat(getComputedStyle(parentCard).marginTop) || 0;
        parentCard.style.marginTop = (curMt + delta) + 'px';
      }} else {{
        const curMt = parseFloat(getComputedStyle(tEl).marginTop) || 0;
        tEl.style.marginTop = (curMt + delta) + 'px';
      }}
      tR = getBoxRel(tEl, lane1Body);
    }}

    const alignedCY = tR.cy + bodyOffset12;
    const jTop = Math.round(alignedCY - jH / 2);
    jEl.style.top = jTop + 'px';
    prevJBottom = jTop + jH;
    rowCenterY[item.rowIdx] = alignedCY;

    if (gEl) {{
      const gTop = Math.round(alignedCY - gH / 2);
      gEl.style.top = gTop + 'px';
      prevGBottom = gTop + gH;
    }}
  }});

  // 3. Place Lane 4 (DB / External API) nodes near anchor rows, leaving >=44px clear corridors
  let prevD4Bottom = -20;
  cfg.lane4Meta.forEach(m => {{
    const el = document.getElementById(m.id);
    const h = el.offsetHeight;
    const ys = m.anchorRows.map(idx => rowCenterY[idx] !== undefined ? rowCenterY[idx] : 60);
    const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let top = Math.max(8, Math.round(avgY - h / 2));
    if (top < prevD4Bottom + 44) top = prevD4Bottom + 44;
    el.style.top = top + 'px';
    prevD4Bottom = top + h;
  }});

  // 4. Place Lane 5 (Other screens/modals) nodes near anchor rows with >=30px separation
  let prevD5Bottom = -20;
  cfg.lane5Meta.forEach(m => {{
    const el = document.getElementById(m.id);
    const h = el.offsetHeight;
    const ys = m.anchorRows.map(idx => rowCenterY[idx] !== undefined ? rowCenterY[idx] : 60);
    const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let top = Math.max(8, Math.round(avgY - h / 2));
    if (top < prevD5Bottom + 32) top = prevD5Bottom + 32;
    el.style.top = top + 'px';
    prevD5Bottom = top + h;
  }});

  // 5. Compute unified height across all 5 lanes
  const maxBodyBottom = Math.max(
    lane1Body.scrollHeight,
    prevJBottom,
    prevGBottom,
    prevD4Bottom,
    prevD5Bottom,
    400
  );
  const laneMinHeight = maxBodyBottom + 84;
  document.querySelectorAll('.lane').forEach(l => {{
    l.style.minHeight = laneMinHeight + 'px';
  }});

  // Force synchronous layout after minHeight adjustment
  const cRect = container.getBoundingClientRect();
  const rect = el => getBoxRel(el, container);

  const lane1 = rect(document.getElementById('lane-screen'));
  const lane2 = rect(document.getElementById('lane-js'));
  const lane3 = rect(document.getElementById('lane-gas'));
  const lane4 = rect(document.getElementById('lane-db'));
  const lane5 = rect(document.getElementById('lane-other'));

  const g12MidX = (lane1.right + lane2.left) / 2;
  const g23MidX = (lane2.right + lane3.left) / 2;
  const g34Left = lane3.right + 8;
  const g34Width = lane4.left - lane3.right - 16;
  const g45Left = lane4.right + 8;
  const g45Width = lane5.left - lane4.right - 16;
  const lane1LeftChannelX = lane1.left + 12;

  const svg = document.getElementById('svg-overlay');
  svg.setAttribute('width', cRect.width);
  svg.setAttribute('height', cRect.height);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const markers = [
    {{ id: 'arr-blue', color: '#2563EB' }},
    {{ id: 'arr-green', color: '#059669' }},
    {{ id: 'arr-orange', color: '#D97706' }},
    {{ id: 'arr-purple', color: '#7C3AED' }},
  ];
  markers.forEach(m => {{
    const mk = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    mk.setAttribute('id', m.id);
    mk.setAttribute('viewBox', '0 0 10 10');
    mk.setAttribute('refX', '8');
    mk.setAttribute('refY', '5');
    mk.setAttribute('markerWidth', '6');
    mk.setAttribute('markerHeight', '6');
    mk.setAttribute('orient', 'auto-start-reverse');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M 0 1.5 L 9 5 L 0 8.5 z');
    p.setAttribute('fill', m.color);
    mk.appendChild(p);
    defs.appendChild(mk);
  }});
  svg.appendChild(defs);

  function orthoPath(pts, r = 8) {{
    if (pts.length < 2) return '';
    let d = `M ${{pts[0][0]}} ${{pts[0][1]}}`;
    for (let i = 1; i < pts.length - 1; i++) {{
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      const v1x = p1[0] - p0[0], v1y = p1[1] - p0[1];
      const v2x = p2[0] - p1[0], v2y = p2[1] - p1[1];
      const len1 = Math.hypot(v1x, v1y), len2 = Math.hypot(v2x, v2y);
      if (len1 < 1 || len2 < 1) {{ d += ` L ${{p1[0]}} ${{p1[1]}}`; continue; }}
      const cr = Math.min(r, len1 / 2, len2 / 2);
      const bx = p1[0] - (v1x / len1) * cr, by = p1[1] - (v1y / len1) * cr;
      const ax = p1[0] + (v2x / len2) * cr, ay = p1[1] + (v2y / len2) * cr;
      d += ` L ${{bx}} ${{by}} Q ${{p1[0]}} ${{p1[1]}} ${{ax}} ${{ay}}`;
    }}
    d += ` L ${{pts[pts.length - 1][0]}} ${{pts[pts.length - 1][1]}}`;
    return d;
  }}

  function addPath(d, color, markerEnd, dash = null, width = 2.2, markerStart = null) {{
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', width);
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('stroke-linecap', 'round');
    if (dash) p.setAttribute('stroke-dasharray', dash);
    if (markerEnd) p.setAttribute('marker-end', `url(#${{markerEnd}})`);
    if (markerStart) p.setAttribute('marker-start', `url(#${{markerStart}})`);
    svg.appendChild(p);
  }}

  const placedLabels = [];
  function addLabel(text, x, y, color, borderColor, bgColor) {{
    if (!text) return;
    const lbl = document.createElement('div');
    lbl.className = 'edge-label';
    lbl.textContent = text;
    lbl.style.color = color;
    lbl.style.background = bgColor || '#FFFFFF';
    lbl.style.border = `1.5px solid ${{borderColor || color}}`;
    lbl.style.left = x + 'px';
    lbl.style.top = y + 'px';
    container.appendChild(lbl);

    // Simple anti-collision nudge if it hits an already-placed label
    let r = getBoxRel(lbl, container);
    let tries = 0;
    while (tries < 6) {{
      const hit = placedLabels.find(p => !(r.right + 4 < p.left || r.left - 4 > p.right || r.bottom + 3 < p.top || r.top - 3 > p.bottom));
      if (!hit) break;
      y += (tries % 2 === 0 ? 18 : -36);
      lbl.style.top = y + 'px';
      r = getBoxRel(lbl, container);
      tries++;
    }}
    placedLabels.push(r);
  }}

  // Collect occupied Y boxes in Lane 3 (GAS) and Lane 4 (DB/Ext)
  const gBoxes = cfg.gasList.map(g => rect(document.getElementById(g.gId)));
  const dBoxes = cfg.lane4Meta.map(d => rect(document.getElementById(d.id)));
  const oBoxes = cfg.lane5Meta.map(o => rect(document.getElementById(o.id)));

  function isYClearInLane(y, boxes, pad = 10) {{
    return !boxes.some(b => y >= b.top - pad && y <= b.bottom + pad);
  }}

  function pickClearCorridorY(yPref, checkL3, checkL4, minY = null) {{
    const check = y => (!checkL3 || isYClearInLane(y, gBoxes, 11)) && (!checkL4 || isYClearInLane(y, dBoxes, 11));
    const floorY = minY !== null ? Math.max(lane4.top + 48, minY) : (lane4.top + 48);
    if (yPref >= floorY && check(yPref)) return yPref;
    const candidates = [];
    if (dBoxes.length > 0) {{
      candidates.push(dBoxes[0].top - 22);
      for (let i = 0; i < dBoxes.length - 1; i++) {{
        candidates.push((dBoxes[i].bottom + dBoxes[i + 1].top) / 2);
      }}
      candidates.push(dBoxes[dBoxes.length - 1].bottom + 20);
    }}
    if (gBoxes.length > 0) {{
      candidates.push(gBoxes[0].top - 20);
      for (let i = 0; i < gBoxes.length - 1; i++) {{
        candidates.push((gBoxes[i].bottom + gBoxes[i + 1].top) / 2);
      }}
      candidates.push(gBoxes[gBoxes.length - 1].bottom + 20);
    }}
    for (let dy = 14; dy <= 280; dy += 14) {{
      candidates.push(yPref + dy, yPref - dy);
    }}
    const valid = candidates.filter(y => y >= floorY && y <= lane4.bottom - 12 && check(y));
    if (valid.length === 0) return Math.max(yPref, floorY);
    valid.sort((a, b) => Math.abs(a - yPref) - Math.abs(b - yPref));
    return valid[0];
  }}

  // Collect DB/Ext target wires grouped by destination ID in Lane 4
  const dbWiresByTarget = {{}};
  const otherWires = [];
  const cardSwitches = [];

  // 6. Primary row horizontal flows: t -> j and j -> g
  cfg.edges.forEach(e => {{
    const tR = rect(document.getElementById(e.tId));
    const jR = rect(document.getElementById(e.jId));

    // Lane 1 -> Lane 2 (Blue horizontal/jog)
    if (Math.abs(tR.cy - jR.cy) <= 3) {{
      const y = (tR.cy + jR.cy) / 2;
      addPath(`M ${{tR.right + 2}} ${{y}} L ${{jR.left - 2}} ${{y}}`, '#2563EB', 'arr-blue');
    }} else {{
      addPath(orthoPath([
        [tR.right + 2, tR.cy],
        [g12MidX, tR.cy],
        [g12MidX, jR.cy],
        [jR.left - 2, jR.cy]
      ], 6), '#2563EB', 'arr-blue');
    }}

    // Check if row has both GAS and direct targets on j.right
    const directTargets = e.targets.filter(tg => tg.type === 'direct_db' || tg.type === 'direct_cache');
    const gasTargets = e.targets.filter(tg => tg.type === 'gas_db');
    const cardTargets = e.targets.filter(tg => tg.type === 'card_switch');
    const extTargets = e.targets.filter(tg => tg.type === 'other');

    if (e.gId) {{
      const gR = rect(document.getElementById(e.gId));
      // Check if directTargets aim above or below GAS node so wires never cross in Gutter 2-3
      const firstDirectTargetEl = directTargets.length > 0 ? document.getElementById(directTargets[0].to) : null;
      const firstDirectR = firstDirectTargetEl ? rect(firstDirectTargetEl) : null;
      const directIsBelowGas = firstDirectR ? (firstDirectR.cy > gR.cy + 12) : false;

      const jOutY = directTargets.length > 0 ? (directIsBelowGas ? jR.cy - 11 : jR.cy + 11) : gR.cy;
      const gInY = directTargets.length > 0 ? (directIsBelowGas ? gR.cy - 8 : gR.cy + 8) : gR.cy;
      const gasMarkerStart = e.gasBidir ? 'arr-blue' : null;
      if (Math.abs(jOutY - gInY) <= 3) {{
        addPath(`M ${{jR.right + 2}} ${{gInY}} L ${{gR.left - 2}} ${{gInY}}`, '#2563EB', 'arr-blue', null, 2.2, gasMarkerStart);
      }} else {{
        const xSplit = g23MidX - 10;
        addPath(orthoPath([
          [jR.right + 2, jOutY],
          [xSplit, jOutY],
          [xSplit, gInY],
          [gR.left - 2, gInY]
        ], 6), '#2563EB', 'arr-blue', null, 2.2, gasMarkerStart);
      }}

      gasTargets.forEach((tg, idx) => {{
        const tgR = rect(document.getElementById(tg.to));
        let startY = gR.cy + (gasTargets.length > 1 ? (idx === 0 ? -10 : 10) : 0);
        if (gasTargets.length === 1 && tgR.cy >= gR.top + 14 && tgR.cy <= gR.bottom - 14) {{
          startY = tgR.cy;
        }}
        if (!dbWiresByTarget[tg.to]) dbWiresByTarget[tg.to] = [];
        dbWiresByTarget[tg.to].push({{
          sourceRect: gR,
          startX: gR.right + 2,
          startY,
          color: '#2563EB',
          marker: 'arr-blue',
          markerStart: tg.bidir ? 'arr-blue' : null,
          width: 2.2,
          label: tg.label,
          labelStyle: ['#1E40AF', '#93C5FD', '#EFF6FF'],
          isBypass: false,
          rowIdx: e.rowIdx
        }});
      }});
    }}

    directTargets.forEach((tg, idx) => {{
      const isDirectDb = tg.type === 'direct_db';
      const targetEl = document.getElementById(tg.to);
      const targetR = targetEl ? rect(targetEl) : null;
      const gEl = e.gId ? rect(document.getElementById(e.gId)) : null;
      const directBelow = (gEl && targetR) ? (targetR.cy > gEl.cy + 12) : false;
      let startY = jR.cy + (e.gId ? (directBelow ? 12 : -12) : (directTargets.length > 1 ? (idx === 0 ? -10 : 10) : 0));
      let clearL3Y = startY;
      if (!isYClearInLane(startY, gBoxes, 10)) {{
        clearL3Y = pickClearCorridorY(startY, true, false);
      }}
      if (!dbWiresByTarget[tg.to]) dbWiresByTarget[tg.to] = [];
      const arrowId = isDirectDb ? 'arr-green' : 'arr-blue';
      dbWiresByTarget[tg.to].push({{
        sourceRect: jR,
        startX: jR.right + 2,
        startY,
        clearL3Y,
        color: isDirectDb ? '#059669' : '#2563EB',
        marker: arrowId,
        markerStart: tg.bidir ? arrowId : null,
        width: isDirectDb ? 2.5 : 2.1,
        label: tg.label,
        labelStyle: isDirectDb ? ['#065F46', '#6EE7B7', '#ECFDF5'] : ['#1E40AF', '#93C5FD', '#EFF6FF'],
        isBypass: true,
        rowIdx: e.rowIdx
      }});
    }});

    cardTargets.forEach(tg => {{
      cardSwitches.push({{ jR, cardId: 'c-' + tg.to_card, label: tg.label, rowIdx: e.rowIdx }});
    }});

    extTargets.forEach((tg, idx) => {{
      const srcR = (tg.from === 'gas' && e.gId) ? rect(document.getElementById(e.gId)) : jR;
      const hasRightDb = directTargets.length > 0 || (e.gId && tg.from !== 'gas') || (tg.from === 'gas' && gasTargets.length > 0);
      otherWires.push({{
        srcR,
        hasRightDb,
        offsetIdx: idx,
        targetId: tg.to,
        label: tg.label,
        rowIdx: e.rowIdx
      }});
    }});
  }});

  // 7. Route all DB/Ext incoming wires cleanly with planar monotonic track ordering in Gutter 3-4
  const preparedDbWires = [];
  Object.keys(dbWiresByTarget).forEach((targetId, dIdx) => {{
    const targetEl = document.getElementById(targetId);
    const dR = rect(targetEl);
    const wires = dbWiresByTarget[targetId];
    wires.sort((a, b) => a.startY - b.startY);

    const usableTop = dR.top + 20;
    const usableBot = dR.bottom - 16;
    const stepY = wires.length > 1 ? (usableBot - usableTop) / (wires.length - 1) : 0;

    wires.forEach((w, i) => {{
      w.entryY = wires.length > 1 ? usableTop + i * stepY : dR.cy;
      w.dR = dR;
    }});

    const downWires = wires.filter(w => (w.clearL3Y ?? w.startY) <= w.entryY);
    const upWires = wires.filter(w => (w.clearL3Y ?? w.startY) > w.entryY);

    // Assign monotonic non-crossing vertical tracks in Gutter 3-4
    downWires.forEach((w, k) => {{
      const frac = (downWires.length === 1) ? 0.90 : (0.90 - (k / Math.max(1, downWires.length - 1)) * 0.34);
      w.trackX = g34Left + g34Width * frac;
    }});
    upWires.forEach((w, k) => {{
      const frac = (upWires.length === 1) ? 0.14 : (0.06 + (k / Math.max(1, upWires.length - 1)) * 0.16);
      w.trackX = g34Left + g34Width * frac;
    }});

    wires.forEach((w, i) => {{
      const yCross = w.clearL3Y ?? w.startY;
      w.yCross = yCross;
      const pts = [[w.startX, w.startY]];
      if (w.isBypass && Math.abs(yCross - w.startY) > 2) {{
        const xJog = g23MidX + (i % 2 === 0 ? -6 : 6);
        pts.push([xJog, w.startY], [xJog, yCross]);
      }}
      if (Math.abs(yCross - w.entryY) <= 4) {{
        pts.push([dR.left - 2, yCross]);
        w.hasVSeg = false;
      }} else {{
        pts.push([w.trackX, yCross], [w.trackX, w.entryY], [dR.left - 2, w.entryY]);
        w.hasVSeg = true;
      }}
      addPath(orthoPath(pts, 7), w.color, w.marker, null, w.width, w.markerStart || null);
      preparedDbWires.push(w);
    }});
  }});

  // Pick clear horizontal segments for labels so they never cross Gutter 3-4 vertical tracks
  const g34VTracks = preparedDbWires
    .filter(w => w.hasVSeg)
    .map(w => ({{
      x: w.trackX,
      yMin: Math.min(w.yCross, w.entryY),
      yMax: Math.max(w.yCross, w.entryY),
      w
    }}));

  function bestClearInterval(xMin, xMax, y, excludeW) {{
    const blockers = g34VTracks
      .filter(t => t.w !== excludeW && y >= t.yMin - 13 && y <= t.yMax + 13 && t.x > xMin && t.x < xMax)
      .map(t => t.x)
      .sort((a, b) => a - b);
    const cuts = [xMin, ...blockers, xMax];
    let best = [xMin, xMax];
    let bestLen = -1;
    for (let k = 0; k < cuts.length - 1; k++) {{
      const len = cuts[k + 1] - cuts[k];
      if (len > bestLen) {{
        bestLen = len;
        best = [cuts[k], cuts[k + 1]];
      }}
    }}
    return {{ mid: (best[0] + best[1]) / 2, len: bestLen }};
  }}

  preparedDbWires.forEach(w => {{
    let lblX = lane3.cx;
    let lblY = w.yCross;
    if (!w.isBypass) {{
      const candidates = [];
      if (!w.hasVSeg) {{
        const c = bestClearInterval(w.startX + 4, w.dR.left - 4, w.yCross, w);
        candidates.push({{ x: c.mid, y: w.yCross, score: c.len }});
      }} else {{
        const cStart = bestClearInterval(w.startX + 4, w.trackX - 4, w.yCross, w);
        candidates.push({{ x: cStart.mid, y: w.yCross, score: cStart.len + (isYClearInLane(w.yCross, gBoxes, 6) ? 6 : 0) }});
        const cEntry = bestClearInterval(w.trackX + 4, w.dR.left - 4, w.entryY, w);
        candidates.push({{ x: cEntry.mid, y: w.entryY, score: cEntry.len }});
      }}
      candidates.sort((a, b) => b.score - a.score);
      lblX = candidates[0].x;
      lblY = candidates[0].y;
    }}
    addLabel(w.label, lblX, lblY, w.labelStyle[0], w.labelStyle[1], w.labelStyle[2]);
  }});

  // 8. Route all Orange SPA Card/Modal switches cleanly into Card's right edge (in Gutter 1-2)
  cardSwitches.forEach((cs, idx) => {{
    const cR = rect(document.getElementById(cs.cardId));
    const exitX = cs.jR.left + 26;
    const exitY = cs.jR.bottom + 1;
    const isDownward = cR.bottom > exitY;

    if (isDownward) {{
      const enterY = Math.max(cR.top + 38, exitY + 14);
      addPath(orthoPath([
        [exitX, exitY],
        [exitX, exitY + 10],
        [g12MidX, exitY + 10],
        [g12MidX, enterY],
        [cR.right + 2, enterY]
      ], 8), '#D97706', 'arr-orange', null, 2.3);
      addLabel(cs.label, g12MidX, Math.round((exitY + 10 + enterY) / 2), '#9A3412', '#FDBA74', '#FFFBEB');
    }} else {{
      // Upward return loop via left channel of Lane 1
      const safeX = lane1LeftChannelX + idx * 4;
      const enterY = cR.top + 38 + idx * 14;
      addPath(orthoPath([
        [exitX, exitY],
        [exitX, exitY + 12],
        [safeX, exitY + 12],
        [safeX, enterY],
        [cR.left - 2, enterY]
      ], 8), '#D97706', 'arr-orange', null, 2.3);
      addLabel(cs.label, g12MidX - 18, exitY + 12, '#9A3412', '#FDBA74', '#FFFBEB');
    }}
  }});

  // 9. Route all Purple Other-Screen / External / Modal transitions cleanly
  const preparedOthers = otherWires.map((ow, idx) => {{
    const oR = rect(document.getElementById(ow.targetId));
    const startX = ow.hasRightDb ? (ow.srcR.left + ow.srcR.width * 0.72) : (ow.srcR.right + 2);
    const startY = ow.hasRightDb ? (ow.srcR.bottom + 1) : (ow.srcR.cy + (ow.offsetIdx * 10));
    const exitStubY = ow.hasRightDb ? (ow.srcR.bottom + 13) : startY;
    const minCorridorY = ow.hasRightDb ? (ow.srcR.bottom + 8) : (lane4.top + 48);
    const corridorY = pickClearCorridorY(ow.hasRightDb ? exitStubY : startY, true, true, minCorridorY);
    return {{ ow, idx, oR, startX, startY, corridorY }};
  }});

  const othersByTarget = {{}};
  preparedOthers.forEach(item => {{
    if (!othersByTarget[item.ow.targetId]) othersByTarget[item.ow.targetId] = [];
    othersByTarget[item.ow.targetId].push(item);
  }});
  Object.values(othersByTarget).forEach(list => {{
    list.sort((a, b) => a.corridorY - b.corridorY);
    const n = list.length;
    list.forEach((item, slotIdx) => {{
      const oR = item.oR;
      if (n === 1) {{
        item.enterY = oR.cy;
      }} else {{
        const usableTop = oR.top + 18;
        const usableBot = oR.bottom - 16;
        item.enterY = usableTop + (slotIdx / (n - 1)) * Math.max(12, usableBot - usableTop);
      }}
    }});
  }});

  preparedOthers.forEach(item => {{
    const {{ ow, idx, oR, startX, startY, corridorY, enterY }} = item;
    const x45 = g45Left + 10 + ((idx * 10) % Math.max(18, g45Width - 16));

    const pts = [[startX, startY]];
    if (ow.hasRightDb) {{
      const stubY = ow.srcR.bottom + 10;
      const dropX = lane2.right + 12 + (idx % 3) * 7;
      if (Math.abs(stubY - corridorY) <= 4) {{
        pts.push([startX, corridorY]);
      }} else {{
        pts.push([startX, stubY], [dropX, stubY], [dropX, corridorY]);
      }}
    }} else if (Math.abs(startY - corridorY) > 3) {{
      const xStep23 = lane2.right + 14 + (idx % 3) * 8;
      pts.push([xStep23, startY], [xStep23, corridorY]);
    }}
    if (Math.abs(corridorY - enterY) <= 3) {{
      pts.push([oR.left - 2, corridorY]);
    }} else {{
      pts.push([x45, corridorY], [x45, enterY], [oR.left - 2, enterY]);
    }}

    addPath(orthoPath(pts, 8), '#7C3AED', 'arr-purple', '6 4', 2.2);
    const lblX = isYClearInLane(corridorY, dBoxes, 10) ? lane4.cx : (g45Left + g45Width * 0.5);
    addLabel(ow.label, lblX, corridorY, '#5B21B6', '#DDD6FE', '#F5F3FF');
  }});
}});
</script>
</body>
</html>"""


SWIMLANE_SPECS = {
    "SCR02": {
        "scr_id": "SCR02",
        "title": "SCR02 ホーム（ダッシュボード）：処理・遷移スイムレーン相関図",
        "lane1_title": "1. ホーム画面 (view_home.html)",
        "cards": [
            {
                "title": "起動時・一括ロード",
                "is_init": True,
                "rows": [
                    {
                        "t": {"badge": "初期表示", "title": "ホーム初期ロード / タブ復帰", "desc": "initHomeView(data) 実行トリガー", "is_init": True},
                        "j": {"file": "js/main.js → supabase.js", "func": "getInitialData()", "desc": "Bypass: SupabaseService.getInitialData() (0.3s) ＆ BG同期"},
                        "g": {"file": "server/api_events.js", "func": "apiGetCalendarAttendance()", "desc": "最新カレンダー予定・出席状況のバックグラウンド同期", "bidir": True},
                        "targets": [
                            {"type": "direct_db", "to": "d-core", "label": "Direct一括照会 (0.3s)", "bidir": True},
                            {"type": "gas_db", "to": "d-gcal", "label": "BG予定同期", "bidir": True},
                            {"type": "card_switch", "to_card": 1, "label": "ホーム全カード描画"},
                        ]
                    }
                ]
            },
            {
                "title": "トップ警告 ＆ ポータルカード群 (#view-home)",
                "rows": [
                    {
                        "t": {"badge": "カードタップ", "title": "「次回活動 / 次の公式戦」カード押下", "desc": "#homeNextEventMount / #homeNextOfficialMount"},
                        "j": {"file": "js/home.js → schedule.js", "func": "openEventDetailModal(ev)", "desc": "出欠状況・参加者・持参備品をモーダル展開"},
                        "targets": [{"type": "other", "to": "o-evmodal", "label": "予定詳細モーダル起動"}]
                    },
                    {
                        "t": {"badge": "代理解決", "title": "備品不在「持参する」ボタン押下", "desc": "#homeTopAlertArea 内 備品持参アラート解除"},
                        "j": {"file": "js/equipment.js → supabase.js", "func": "openEquipmentResolveModal() → apiResolveEquipmentAlert()", "desc": "Bypass: 代理持参ログ即時INSERT ＆ トップ警告バナー解除"},
                        "targets": [{"type": "direct_db", "to": "d-eqlog", "label": "Direct代理記録INSERT (0.1s)"}]
                    },
                    {
                        "t": {"badge": "カードタップ", "title": "「直近の試合結果」カード押下", "desc": "#homeRecentMatchMount（スコア・勝敗サマリー）"},
                        "j": {"file": "js/home.js → results.js", "func": "openMatchDetail(matchId)", "desc": "得点推移・出場メンバー詳細をモーダル展開"},
                        "targets": [{"type": "other", "to": "o-mmodal", "label": "試合詳細モーダル起動"}]
                    },
                    {
                        "t": {"badge": "カードタップ", "title": "「活動記録 / お知らせ」投稿押下", "desc": "#homePinnedAnnounceArea / #homeRecentBulletinMount"},
                        "j": {"file": "js/bulletin.js", "func": "openBulletinDetailModal(post)", "desc": "ピン留め記事・最新活動記録を既読記録付きでモーダル展開"},
                        "targets": [{"type": "other", "to": "o-bmod", "label": "掲示板詳細モーダル起動"}]
                    },
                    {
                        "t": {"badge": "リンク押下", "title": "「ランキング →」「スケジュール →」「試合結果 →」「活動記録 →」押下", "desc": "各カードおよび汎用警告エリア内遷移リンク"},
                        "j": {"file": "js/main.js", "func": "switchTab(tabId)", "desc": "対象機能タブ切替 ＆ サブビュー初期化実行"},
                        "targets": [{"type": "other", "to": "o-tabs", "label": "各機能タブへSPA遷移"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "db", "id": "d-core", "logical": "チーム主要データ一式", "physical": "members, matches, score_logs, attendance, equipment_*, bulletin_*", "anchor_rows": [0]},
            {"kind": "ext", "id": "d-gcal", "badge": "Google API", "title": "Google カレンダー API v3", "desc": "活動予定一覧・出席レスポンス原本取得", "anchor_rows": [0]},
            {"kind": "db", "id": "d-eqlog", "logical": "備品代理持参ログ", "physical": "equipment_event_logs", "anchor_rows": [2]}
        ],
        "lane5_nodes": [
            {"id": "o-evmodal", "badge": "共通モーダル (SCR07)", "title": "予定詳細モーダル", "desc": "#eventDetailModal（出欠回答 ○/△/×・掲示板起票）", "anchor_rows": [1]},
            {"id": "o-mmodal", "badge": "共通モーダル (SCR03)", "title": "試合詳細モーダル", "desc": "#matchDetailModal（タイムライン・SCR04編集連携）", "anchor_rows": [3]},
            {"id": "o-bmod", "badge": "共通モーダル (SCR09)", "title": "掲示板詳細モーダル", "desc": "#bulletinDetailModal（本文・コメント・既読一覧）", "anchor_rows": [4]},
            {"id": "o-tabs", "badge": "SPAタブ遷移", "title": "SCR03〜SCR09 各画面", "desc": "結果 / ランキング / 予定 / 備品 / 掲示板へ直接移動", "anchor_rows": [5]}
        ]
    },
    "SCR03": {
        "scr_id": "SCR03",
        "title": "SCR03 試合結果一覧・詳細：処理・遷移スイムレーン相関図",
        "lane1_title": "1. 試合結果画面 (view_results.html)",
        "cards": [
            {
                "title": "絞り込み・試合一覧 (#view-results)",
                "rows": [
                    {
                        "t": {"badge": "初期・絞り込み", "title": "画面表示 / 年度・大会・対戦相手検索", "desc": "seasonFilter / categoryFilter / searchFilter 変更", "is_init": True},
                        "j": {"file": "js/results.js", "func": "initMatchHistory() / filterMatchResults()", "desc": "取得済みメモリ配列から0秒抽出・先頭10件カード生成"},
                        "targets": [{"type": "direct_cache", "to": "d-cache", "label": "メモリ配列高速抽出", "bidir": True}]
                    },
                    {
                        "t": {"badge": "ページング", "title": "「さらに読み込む」ボタン押下", "desc": "#loadMoreContainer 内ボタンタップ"},
                        "j": {"file": "js/results.js", "func": "loadMoreMatches()", "desc": "表示上限を +10件 拡張し過去カードを追加描画"},
                        "targets": [{"type": "direct_cache", "to": "d-cache", "label": "追加10件参照", "bidir": True}]
                    },
                    {
                        "t": {"badge": "カードタップ", "title": "試合結果カードタップ", "desc": ".match-card-clickable（matchId指定）"},
                        "j": {"file": "js/results.js", "func": "openMatchDetail(matchId)", "desc": "前後半スコア・タイムライン・出場選手・MOM注入"},
                        "targets": [
                            {"type": "direct_cache", "to": "d-cache", "label": "詳細タイムライン取得", "bidir": True},
                            {"type": "card_switch", "to_card": 1, "label": "詳細モーダル展開"}
                        ]
                    },
                    {
                        "t": {"badge": "新規ボタン", "title": "「新規試合結果の作成」ボタン押下", "desc": "画面上部の登録ボタン押下"},
                        "j": {"file": "js/results.js", "func": "openNewMatchInput()", "desc": "matchLogs初期化 ＆ カレンダー予定選択モードで切替"},
                        "targets": [{"type": "other", "to": "o-input-new", "label": "SCR04 新規登録へ遷移"}]
                    }
                ]
            },
            {
                "title": "試合結果詳細モーダル (#matchDetailModal)",
                "rows": [
                    {
                        "t": {"badge": "編集ボタン", "title": "「編集する」ボタン押下", "desc": "currentViewingMatchId を保持して編集開始"},
                        "j": {"file": "js/results.js", "func": "goToEditMatch()", "desc": "モーダルを閉じ対象試合データを入力画面フォームへバインド"},
                        "targets": [{"type": "other", "to": "o-input-edit", "label": "SCR04 編集モードへ遷移"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "storage", "id": "d-cache", "badge": "Client Memory Cache", "title": "window.allMatchResults", "desc": "getInitialData() でロード済みの matches ＋ score_logs", "anchor_rows": [0, 1, 2]}
        ],
        "lane5_nodes": [
            {"id": "o-input-new", "badge": "遷移先画面", "title": "SCR04 試合結果入力 (新規)", "desc": "カレンダー予定選択フォームを展開", "anchor_rows": [3]},
            {"id": "o-input-edit", "badge": "遷移先画面", "title": "SCR04 試合結果入力 (編集)", "desc": "対象試合スコア・得点ログ読込済みフォーム", "anchor_rows": [4]}
        ]
    },
    "SCR04": {
        "scr_id": "SCR04",
        "title": "SCR04 試合結果入力・編集：処理・遷移スイムレーン相関図",
        "lane1_title": "1. 試合入力画面 (view_input.html)",
        "cards": [
            {
                "title": "対象試合選択・プレビュー (#eventSelectBox)",
                "rows": [
                    {
                        "t": {"badge": "初期・選択", "title": "対象試合プルダウン選択 / 編集復元", "desc": "#eventSelect 変更（未入力のカレンダー試合予定から引用）", "is_init": True},
                        "j": {"file": "js/input.js", "func": "onEventSelect() / updatePlayerDropdowns()", "desc": "開催日・種別・対戦相手・出席選手ドロップダウンを自動生成"},
                        "targets": [{"type": "direct_cache", "to": "d-calcache", "label": "予定 ＆ 名簿引用", "bidir": True}]
                    }
                ]
            },
            {
                "title": "タイムライン入力・保存領域 (#inputFormContainer)",
                "rows": [
                    {
                        "t": {"badge": "記録追加/削除", "title": "種別切替 / 「追加」「削除」押下", "desc": "得点・相手得点・イエロー・レッド・アシスト入力操作"},
                        "j": {"file": "js/input.js", "func": "togglePlayerSelect() / addLog() / removeLog()", "desc": "選手未選択チェック後 matchLogs 配列更新・タイムライン再描画"},
                        "targets": [{"type": "direct_cache", "to": "d-logs", "label": "一時タイムライン更新"}]
                    },
                    {
                        "t": {"badge": "保存ボタン", "title": "「試合結果を保存する」ボタン押下", "desc": "#submitBtn（二重送信防止ロック実行）"},
                        "j": {"file": "js/input.js → supabase.js", "func": "submitData() → saveMatchData()", "desc": "Bypass: SupabaseService.saveScoreRecord() ＋ 最新再同期"},
                        "targets": [
                            {"type": "direct_db", "to": "d-matches", "label": "Direct一括UPSERT (0.2s)"},
                            {"type": "other", "to": "o-scr03", "label": "保存完了 ➔ SCR03へ自動遷移"}
                        ]
                    },
                    {
                        "t": {"badge": "戻るボタン", "title": "「← スコアに戻る」押下", "desc": "入力中の編集をキャンセルして一覧へ戻る"},
                        "j": {"file": "js/input.js", "func": "handleInputBack()", "desc": "変更確認後スイッチ実行"},
                        "targets": [{"type": "other", "to": "o-scr03", "label": "SCR03 一覧へ戻る"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "storage", "id": "d-calcache", "badge": "Client Memory Cache", "title": "取得済みカレンダー予定 / 名簿", "desc": "Googleカレンダー予定情報 ＆ 出席〇メンバー名簿", "anchor_rows": [0]},
            {"kind": "storage", "id": "d-logs", "badge": "Client State", "title": "matchLogs 一時配列", "desc": "保存前の前半・後半・延長タイムライン配列", "anchor_rows": [1]},
            {"kind": "db", "id": "d-matches", "logical": "試合結果・スタッツログ", "physical": "matches, score_logs", "anchor_rows": [2]}
        ],
        "lane5_nodes": [
            {"id": "o-scr03", "badge": "遷移先画面", "title": "SCR03 試合結果一覧", "desc": "afterSaveSuccess() 再描画自動遷移 ／ switchTab('results') 一覧復帰", "anchor_rows": [2, 3]}
        ]
    },
    "SCR05": {
        "scr_id": "SCR05",
        "title": "SCR05 ランキング・スタッツ：処理・遷移スイムレーン相関図",
        "lane1_title": "1. ランキング画面 (view_ranking.html)",
        "cards": [
            {
                "title": "ランキング抽出条件 ＆ 部門表示 (#view-ranking)",
                "rows": [
                    {
                        "t": {"badge": "初期表示", "title": "タブ表示 ＆ シーズンデータ初期化", "desc": "initStats(data) / populateRankingSeasonFilter()", "is_init": True},
                        "j": {"file": "js/ranking.js", "func": "initStats() → filterAndRenderRankings()", "desc": "OB・退団メンバー除外準備 ＆ 最新シーズン選択肢生成"},
                        "g": {"file": "server/api_events.js", "func": "apiGetCalendarAttendance(season)", "desc": "Googleカレンダー基準のシーズン別出席数バッチ集計", "bidir": True},
                        "targets": [
                            {"type": "direct_cache", "to": "d-mem", "label": "試合・名簿参照", "bidir": True},
                            {"type": "gas_db", "to": "d-gcal", "label": "出席実績取得", "bidir": True}
                        ]
                    },
                    {
                        "t": {"badge": "条件切替", "title": "シーズン / 大会種別フィルター変更", "desc": "得点王・アシスト王・MOM・最多出場を動的集計"},
                        "j": {"file": "js/ranking.js", "func": "aggregateStatsFromMatches() / renderRankingsWithData()", "desc": "isPastMember() 判定でOB完全除外し各TOP3カード生成"},
                        "targets": [{"type": "direct_cache", "to": "d-mem", "label": "クライアント即時集計", "bidir": True}]
                    },
                    {
                        "t": {"badge": "開閉操作", "title": "「もっと見る / 折りたたむ」押下", "desc": "各ランキングカード下部のアコーディオン操作"},
                        "j": {"file": "js/ranking.js", "func": "toggleRankList(type)", "desc": "4位以降の順位リスト表示状態をトグル切替"},
                        "targets": [{"type": "other", "to": "o-ui", "label": "カード内リスト全件展開"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "ext", "id": "d-gcal", "badge": "Google API / GAS", "title": "Google カレンダー出席集計", "desc": "GAS側 apiGetCalendarAttendance による参加日数集計", "anchor_rows": [0]},
            {"kind": "storage", "id": "d-mem", "badge": "Client Memory Cache", "title": "matches / score_logs / members", "desc": "getInitialData() 取得済みの試合結果・現役部員マスタ", "anchor_rows": [1]}
        ],
        "lane5_nodes": [
            {"id": "o-ui", "badge": "画面状態更新", "title": "ランキング一覧カード描画", "desc": "得点 / アシスト / MOM / 参加数TOP3＆全件展開", "anchor_rows": [2]}
        ]
    },
    "SCR06": {
        "scr_id": "SCR06",
        "title": "SCR06 個人成績・選手カルテ：処理・遷移スイムレーン相関図",
        "lane1_title": "1. 個人成績画面 (view_personal.html)",
        "cards": [
            {
                "title": "成績テーブル・ソート領域 (#view-personal)",
                "rows": [
                    {
                        "t": {"badge": "初期・タブ切替", "title": "画面表示 / シーズン・種別切替", "desc": "switchTab('personal') ＆ フィルター変更", "is_init": True},
                        "j": {"file": "js/personal.js", "func": "filterAndRenderPersonalStats()", "desc": "現役部員全員の出場・得点・アシスト・MOM・参加率集計"},
                        "g": {"file": "server/api_events.js", "func": "apiGetCalendarAttendance(season)", "desc": "シーズン別カレンダー出欠実績データの補完取得", "bidir": True},
                        "targets": [
                            {"type": "direct_cache", "to": "d-mem", "label": "名簿・試合ログ参照", "bidir": True},
                            {"type": "gas_db", "to": "d-gcal", "label": "出席分母取得", "bidir": True}
                        ]
                    },
                    {
                        "t": {"badge": "並び替え", "title": "テーブル見出し列タップ", "desc": "背番号 / 出場 / 得点 / アシスト / MOM / 参加率"},
                        "j": {"file": "js/personal.js", "func": "sortPersonalStats() → renderPersonalTable()", "desc": "選択キーで昇順/降順ソートして一覧テーブル即時再描画"},
                        "targets": [{"type": "direct_cache", "to": "d-mem", "label": "クライアント即時ソート", "bidir": True}]
                    },
                    {
                        "t": {"badge": "行タップ", "title": "選手行タップ（カルテ起動）", "desc": "現役選手個人の成績履歴モーダルを表示"},
                        "j": {"file": "js/personal.js", "func": "openPlayerModal(name, number)", "desc": "個人サマリー・出場試合履歴・シーズン推移を注入展開"},
                        "targets": [{"type": "other", "to": "o-pmodal", "label": "個人カルテモーダル起動"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "ext", "id": "d-gcal", "badge": "Google API / GAS", "title": "Google カレンダー出席実績", "desc": "シーズン別カレンダー参加履歴集計結果", "anchor_rows": [0]},
            {"kind": "storage", "id": "d-mem", "badge": "Client Memory Cache", "title": "matches / score_logs / members", "desc": "OB・退団メンバー除外済み個人スタッツ情報", "anchor_rows": [1]}
        ],
        "lane5_nodes": [
            {"id": "o-pmodal", "badge": "画面内モーダル", "title": "選手個人カルテモーダル", "desc": "#playerDetailModal（通算実績 ＆ 試合詳細連携）", "anchor_rows": [2]}
        ]
    },
    "SCR07": {
        "scr_id": "SCR07",
        "title": "SCR07 スケジュール・出欠管理：処理・遷移スイムレーン相関図",
        "lane1_title": "1. スケジュール画面 (view_schedule.html)",
        "cards": [
            {
                "title": "月次カレンダー / リスト一覧 (#view-schedule)",
                "rows": [
                    {
                        "t": {"badge": "初期・切替", "title": "画面表示 / 月移動・サブタブ切替", "desc": "renderCalendar / renderAgendaList / フィルター適用", "is_init": True},
                        "j": {"file": "js/schedule.js → supabase.js", "func": "initScheduleView() / apiGetMemberListForLogin()", "desc": "Bypass: members名簿補完 ＋ 予定・自出欠バッジ描画"},
                        "targets": [{"type": "direct_db", "to": "d-members", "label": "Direct名簿参照", "bidir": True}]
                    },
                    {
                        "t": {"badge": "出欠ボタン", "title": "出欠回答（〇/△/×）タップ", "desc": "リスト上・モーダル内のワンタップ出欠更新"},
                        "j": {"file": "js/schedule.js → supabase.js", "func": "setMyAttendance() → updateEventAttendance()", "desc": "Bypass: 0.1s即時UPSERT ＋ GAS裏側カレンダー同期"},
                        "g": {"file": "server/api_events.js", "func": "updateEventAttendance(payload)", "desc": "Googleカレンダー側ゲスト出席ステータス同期"},
                        "targets": [
                            {"type": "direct_db", "to": "d-att", "label": "Direct出欠UPSERT (0.1s)"},
                            {"type": "gas_db", "to": "d-gcal", "label": "カレンダー同期"}
                        ]
                    },
                    {
                        "t": {"badge": "カードタップ", "title": "予定ブロック・カードタップ", "desc": "イベント詳細モーダル起動 ＋ 備品/掲示板状況照合"},
                        "j": {"file": "js/schedule.js", "func": "openEventDetailModal(ev)", "desc": "参加者一覧（〇/△/×）・持参備品・活動記録ボタン展開"},
                        "targets": [{"type": "card_switch", "to_card": 1, "label": "予定詳細モーダル展開"}]
                    }
                ]
            },
            {
                "title": "予定詳細 / 作成・編集モーダル",
                "rows": [
                    {
                        "t": {"badge": "登録/更新", "title": "予定編集モーダル「保存する」押下", "desc": "#eventEditModal（タイトル/日時/場所/種別/ゲスト）"},
                        "j": {"file": "js/schedule.js", "func": "saveCalendarEvent(payload)", "desc": "バリデーション後 GAS へ新規作成・更新・複製リクエスト"},
                        "g": {"file": "server/api_events.js", "func": "saveCalendarEvent(payload)", "desc": "Google カレンダー予定作成・更新API実行"},
                        "targets": [{"type": "gas_db", "to": "d-gcal", "label": "予定書込"}]
                    },
                    {
                        "t": {"badge": "削除ボタン", "title": "「削除」確認モーダル確定", "desc": "executeConfirmedDelete() 実行"},
                        "j": {"file": "js/schedule.js", "func": "deleteCalendarEvent(payload)", "desc": "GAS へ予定削除リクエスト送信 ＆ 最新再取得"},
                        "g": {"file": "server/api_events.js", "func": "deleteCalendarEvent(payload)", "desc": "Google カレンダー予定削除実行"},
                        "targets": [{"type": "gas_db", "to": "d-gcal", "label": "予定削除"}]
                    },
                    {
                        "t": {"badge": "掲示板連携", "title": "「+ 活動記録を書く」押下", "desc": "予定IDを引き継いで活動振り返りを起票"},
                        "j": {"file": "js/bulletin.js", "func": "openBulletinCreateModalForEvent(eventId)", "desc": "対象予定を事前選択した投稿モーダル起動"},
                        "targets": [{"type": "other", "to": "o-scr09", "label": "SCR09 活動記録起票へ"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "db", "id": "d-members", "logical": "メンバー名簿", "physical": "members", "anchor_rows": [0]},
            {"kind": "db", "id": "d-att", "logical": "出欠管理テーブル", "physical": "attendance", "anchor_rows": [1]},
            {"kind": "ext", "id": "d-gcal", "badge": "Google API", "title": "Google カレンダー API v3", "desc": "予定作成・更新・削除 ＆ 出席ステータスパッチ", "anchor_rows": [1, 3, 4]}
        ],
        "lane5_nodes": [
            {"id": "o-scr09", "badge": "画面・モーダル連携", "title": "SCR09 活動記録・掲示板", "desc": "イベント紐付き済み新規投稿モーダルを展開", "anchor_rows": [5]}
        ]
    },
    "SCR08": {
        "scr_id": "SCR08",
        "title": "SCR08 備品管理・当番アラート：処理・遷移スイムレーン相関図",
        "lane1_title": "1. 備品管理画面 (view_equipment.html)",
        "cards": [
            {
                "title": "アラート検知 ＆ 備品台帳 (#view-equipment)",
                "rows": [
                    {
                        "t": {"badge": "初期・更新", "title": "画面表示 / データリフレッシュ", "desc": "initEquipmentView() → refreshEquipmentData()", "is_init": True},
                        "j": {"file": "js/equipment.js → supabase.js", "func": "apiGetEquipmentData()", "desc": "Bypass: SupabaseService.getEquipmentData() ＋ 7日間不在判定"},
                        "targets": [{"type": "direct_db", "to": "d-eq", "label": "Direct台帳・ログ一括取得", "bidir": True}]
                    },
                    {
                        "t": {"badge": "代理解決", "title": "不在アラート「解決 / 代理引受」押下", "desc": "向こう7日以内の保管者不在イベントを誰でも解消可能"},
                        "j": {"file": "js/equipment.js → supabase.js", "func": "executeEquipmentResolve() → apiResolveEquipmentAlert()", "desc": "Bypass: 代理持参記録をINSERT ＆ 警告バナー即時解除"},
                        "targets": [
                            {"type": "direct_db", "to": "d-eqlog", "label": "Direct代理記録INSERT (0.1s)"},
                            {"type": "other", "to": "o-home", "label": "不在警告解除 ➔ ホーム連動"}
                        ]
                    },
                    {
                        "t": {"badge": "モーダル起動", "title": "「+ 備品追加」/「変更・削除」押下", "desc": "管理者（代表/副代表）のみ編集ボタン表示"},
                        "j": {"file": "js/equipment.js", "func": "openEquipmentAddModal() / openEditEquipmentModal()", "desc": "品目・保管担当者入力フォームモーダル展開"},
                        "targets": [{"type": "card_switch", "to_card": 1, "label": "備品編集モーダル展開"}]
                    }
                ]
            },
            {
                "title": "備品登録・削除モーダル (#equipmentEditModal)",
                "rows": [
                    {
                        "t": {"badge": "保存ボタン", "title": "「保存する」ボタン押下", "desc": "新規備品追加・保管者引継ぎ・備考更新"},
                        "j": {"file": "js/equipment.js → supabase.js", "func": "handleSaveEquipmentSubmit() → apiSaveEquipmentItem()", "desc": "Bypass: 楽観的UI反映 ＋ Supabase Direct UPSERT"},
                        "targets": [{"type": "direct_db", "to": "d-eq", "label": "Direct備品UPSERT (0.1s)"}]
                    },
                    {
                        "t": {"badge": "削除ボタン", "title": "「削除」確認モーダル確定", "desc": "executeDeleteEquipmentPermanently() 実行"},
                        "j": {"file": "js/equipment.js → supabase.js", "func": "apiDeleteEquipmentItem(itemId)", "desc": "Bypass: 備品現物レコードの完全削除"},
                        "targets": [{"type": "direct_db", "to": "d-eq", "label": "Direct備品DELETE (0.1s)"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "db", "id": "d-eqlog", "logical": "備品代理持参ログ", "physical": "equipment_event_logs", "anchor_rows": [1]},
            {"kind": "db", "id": "d-eq", "logical": "備品マスタ ＆ 現物台帳", "physical": "equipment_items, equipment_master", "anchor_rows": [3, 4]}
        ],
        "lane5_nodes": [
            {"id": "o-home", "badge": "連動先画面", "title": "SCR02 ホーム画面", "desc": "トップ画面の備品持参アラートカードを即時解除", "anchor_rows": [1]}
        ]
    },
    "SCR09": {
        "scr_id": "SCR09",
        "title": "SCR09 活動記録・チーム掲示板：処理・遷移スイムレーン相関図",
        "lane1_title": "1. 掲示板画面 (view_bulletin.html)",
        "cards": [
            {
                "title": "タイムライン一覧 ＆ フィルター (#view-bulletin)",
                "rows": [
                    {
                        "t": {"badge": "初期・絞り込み", "title": "画面表示 / カテゴリ・検索切替", "desc": "initBulletinTab() / setBulletinCategoryFilter()", "is_init": True},
                        "j": {"file": "js/bulletin.js → supabase.js", "func": "loadBulletinData() / renderBulletinTimeline()", "desc": "Bypass: 投稿一覧・コメント・既読ログ参照 ＆ 未読数バッジ更新"},
                        "targets": [{"type": "direct_db", "to": "d-posts", "label": "Directフィード一括取得", "bidir": True}]
                    },
                    {
                        "t": {"badge": "カードタップ", "title": "投稿カードタップ（閲覧・既読記録）", "desc": "詳細モーダル展開 ＋ 未読時は自動既読マーキング"},
                        "j": {"file": "js/bulletin.js → supabase.js", "func": "openBulletinDetailModal() → apiMarkBulletinPostRead()", "desc": "Bypass: bulletin_reads 自動記録 ＆ 既読者/コメント読込"},
                        "targets": [
                            {"type": "direct_db", "to": "d-reads", "label": "Direct既読記録 ＆ コメント照会", "bidir": True},
                            {"type": "card_switch", "to_card": 1, "label": "詳細モーダル展開"}
                        ]
                    }
                ]
            },
            {
                "title": "投稿詳細 / 作成・編集モーダル",
                "rows": [
                    {
                        "t": {"badge": "作成・編集", "title": "「投稿 / 更新」ボタン押下", "desc": "新規起票・共同編集・イベント紐付け・ピン設定"},
                        "j": {"file": "js/bulletin.js → supabase.js", "func": "handleBulletinPostSubmit() → apiSaveBulletinPost()", "desc": "Bypass: bulletin_posts へ0.1s即時UPSERT ＆ ホーム連動"},
                        "targets": [
                            {"type": "direct_db", "to": "d-posts", "label": "Direct投稿UPSERT (0.1s)"},
                            {"type": "other", "to": "o-home", "label": "ピン留め記事 ホーム即反映"}
                        ]
                    },
                    {
                        "t": {"badge": "ピン/削除", "title": "ピン留め切替 / 記事削除確定", "desc": "handleBdmTogglePinCheckbox / deleteBulletinPostById"},
                        "j": {"file": "js/bulletin.js → supabase.js", "func": "apiTogglePinBulletinPost() / apiDeleteBulletinPost()", "desc": "Bypass: is_pinned 更新 / is_deleted=true 論理削除"},
                        "targets": [{"type": "direct_db", "to": "d-posts", "label": "Directフラグ更新/論理削除"}]
                    },
                    {
                        "t": {"badge": "コメント", "title": "「コメント送信」/ 削除押下", "desc": "詳細モーダル下部コメントスレッド操作"},
                        "j": {"file": "js/bulletin.js → supabase.js", "func": "apiAddBulletinComment() / apiDeleteBulletinComment()", "desc": "Bypass: bulletin_comments 追記・論理削除"},
                        "targets": [{"type": "direct_db", "to": "d-reads", "label": "DirectコメントINSERT/削除"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "db", "id": "d-posts", "logical": "掲示板投稿マスタ", "physical": "bulletin_posts, view_bulletin_summary", "anchor_rows": [0, 2, 3]},
            {"kind": "db", "id": "d-reads", "logical": "既読ログ ＆ コメント", "physical": "bulletin_reads, bulletin_comments", "anchor_rows": [1, 4]}
        ],
        "lane5_nodes": [
            {"id": "o-home", "badge": "連動先画面", "title": "SCR02 ホーム画面", "desc": "ピン留め記事を最上部アナウンスカードへ連動表示", "anchor_rows": [2]}
        ]
    },
    "SCR10": {
        "scr_id": "SCR10",
        "title": "SCR10 メンバー管理（名簿・役員専用）：処理・遷移スイムレーン相関図",
        "lane1_title": "1. メンバー管理画面 (view_members.html)",
        "cards": [
            {
                "title": "権限チェック ＆ 名簿セクション (#view-members)",
                "rows": [
                    {
                        "t": {"badge": "初期・権限制御", "title": "画面アクセス時 ロール判定 ＆ 一覧取得", "desc": "代表・副代表以外は警告表示しホームへ自動強制リダイレクト", "is_init": True},
                        "j": {"file": "js/members.js → supabase.js", "func": "initMembersView() → apiGetMemberListForAdmin()", "desc": "Bypass: 現役・休部・OB全部員データ一括取得（0.1s）"},
                        "targets": [
                            {"type": "direct_db", "to": "d-members", "label": "Direct全部員照会", "bidir": True},
                            {"type": "other", "to": "o-home", "label": "一般部員はSCR02へ遮断遷移"}
                        ]
                    },
                    {
                        "t": {"badge": "検索/モーダル", "title": "検索絞込 / 「新規追加」「編集」押下", "desc": "現役・休部・OB各カードからのフォーム展開"},
                        "j": {"file": "js/members.js", "func": "filterMembersList() / openMemberEditModalByName()", "desc": "対象部員データバインド ＆ blurリアルタイム検証準備"},
                        "targets": [{"type": "card_switch", "to_card": 1, "label": "編集モーダル展開"}]
                    }
                ]
            },
            {
                "title": "メンバー編集 ＆ 完全削除モーダル",
                "rows": [
                    {
                        "t": {"badge": "保存/復帰", "title": "「保存」押下 / 「現役に復帰」確定", "desc": "全項目blur検証（氏名・背番号重複/メール重複・権限上限）"},
                        "j": {"file": "js/members.js → supabase.js", "func": "handleSaveMemberSubmit() / handleRestoreMember() → apiSaveMember()", "desc": "Bypass: members即時UPSERT ＋ syncUpdatedMemberList()"},
                        "targets": [
                            {"type": "direct_db", "to": "d-members", "label": "Direct名簿UPSERT (0.1s)"},
                            {"type": "other", "to": "o-sync", "label": "全画面キャッシュ即時同期"}
                        ]
                    },
                    {
                        "t": {"badge": "完全削除", "title": "完全削除確認「完全に削除」押下", "desc": "過去戦績保護ガード（出場記録有はOB化を案内）"},
                        "j": {"file": "js/members.js → supabase.js", "func": "executeMemberDeletePermanently() → apiDeleteMemberPermanently()", "desc": "Bypass: 試合実績のない誤登録データのみ物理DELETE"},
                        "targets": [{"type": "direct_db", "to": "d-members", "label": "Direct物理DELETE (0.1s)"}]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "db", "id": "d-members", "logical": "メンバー名簿台帳", "physical": "members (氏名/背番号/役職/在籍)", "anchor_rows": [0, 2, 3]}
        ],
        "lane5_nodes": [
            {"id": "o-home", "badge": "権限遮断遷移", "title": "SCR02 ホーム画面", "desc": "一般部員アクセス時はアラート後自動リダイレクト", "anchor_rows": [0]},
            {"id": "o-sync", "badge": "他画面キャッシュ同期", "title": "ランキング / 個人成績 / 出欠", "desc": "syncUpdatedMemberList() で現役復帰・編集結果を即反映", "anchor_rows": [2]}
        ]
    },
    "SCR11": {
        "scr_id": "SCR11",
        "title": "SCR11 マイプロフィール・通知設定：処理・遷移スイムレーン相関図",
        "lane1_title": "1. プロフィール・設定モーダル (view_common.html)",
        "cards": [
            {
                "title": "プロフィール確認・アバター (#userProfileModal)",
                "rows": [
                    {
                        "t": {"badge": "モーダル起動", "title": "ヘッダーアバタータップ（プロフィール起動）", "desc": "ログイン中ユーザー情報・背番号・アバター描画", "is_init": True},
                        "j": {"file": "js/main.js", "func": "openUserProfileModal()", "desc": "保持中の認証セッション情報からプロフィール項目を描画"},
                        "targets": [{"type": "direct_cache", "to": "d-ls", "label": "セッション情報参照", "bidir": True}]
                    },
                    {
                        "t": {"badge": "画像保存", "title": "アバター画像選択（256x256圧縮送信）", "desc": "Canvasリサイズ後 Base64 画像アップロード"},
                        "j": {"file": "js/main.js", "func": "handleAvatarUpload()", "desc": "GAS へ画像送信後 localStorage・ヘッダーアイコン即時反映"},
                        "g": {"file": "server/api (GAS)", "func": "apiSaveProfileImage(name, base64)", "desc": "Google Drive へ画像保存 ＆ 公開URL発行", "bidir": True},
                        "targets": [
                            {"type": "gas_db", "to": "d-gdrive", "label": "Drive画像保存", "bidir": True},
                            {"type": "direct_cache", "to": "d-ls", "label": "URLセッション更新"}
                        ]
                    },
                    {
                        "t": {"badge": "画像削除", "title": "「写真を削除」確認OK押下", "desc": "handleProfileImageDelete()（showAppConfirm確認）"},
                        "j": {"file": "js/main.js → supabase.js", "func": "apiDeleteProfileImage(name)", "desc": "Bypass: SupabaseService.deleteProfileImage() (avatar_url解除)"},
                        "targets": [{"type": "direct_db", "to": "d-members", "label": "Direct画像URLクリア"}]
                    },
                    {
                        "t": {"badge": "設定遷移", "title": "「設定（歯車）」ボタン押下", "desc": "#btnOpenUserSettings ➔ 通知・PW設定モーダルへ切替"},
                        "j": {"file": "js/main.js → supabase.js", "func": "openUserSettingsModal() → apiGetNotificationSettings()", "desc": "Bypass: 通知手段設定をDirect読込し設定画面を展開"},
                        "targets": [
                            {"type": "direct_db", "to": "d-members", "label": "Direct通知設定取得 (0.1s)", "bidir": True},
                            {"type": "card_switch", "to_card": 1, "label": "設定モーダルへ切替"}
                        ]
                    }
                ]
            },
            {
                "title": "通知設定・PW変更・ログアウト (#userSettingsModal)",
                "rows": [
                    {
                        "t": {"badge": "通知/PW保存", "title": "通知設定変更 / 「PW変更」押下", "desc": "apiSaveNotificationSettings / apiChangePassword"},
                        "j": {"file": "js/main.js → supabase.js", "func": "apiSaveNotificationSettings() / apiChangePassword()", "desc": "Bypass: members.notify_settings / password_hash 直接更新"},
                        "targets": [{"type": "direct_db", "to": "d-members", "label": "Direct設定・PW更新 (0.1s)"}]
                    },
                    {
                        "t": {"badge": "ログアウト", "title": "「ログアウト」ボタン押下 ➔ 確認OK", "desc": "#logoutConfirmModal 確定 ➔ ログイン画面へ復帰"},
                        "j": {"file": "js/main.js", "func": "logout()", "desc": "localStorage (fcb_auth_user) 消去 ＆ 画面初期化"},
                        "targets": [
                            {"type": "direct_cache", "to": "d-ls", "label": "fcb_auth_user 消去"},
                            {"type": "other", "to": "o-scr01", "label": "セッション破棄 ➔ SCR01へ"}
                        ]
                    }
                ]
            }
        ],
        "lane4_nodes": [
            {"kind": "storage", "id": "d-ls", "badge": "Browser Storage", "title": "localStorage (fcb_auth_user)", "desc": "ユーザー情報参照・アバターURL更新・ログアウト時の消去", "anchor_rows": [0]},
            {"kind": "ext", "id": "d-gdrive", "badge": "Google API / Drive", "title": "Google Drive ストレージ", "desc": "プロフィールアバター画像のアップロード保存先", "anchor_rows": [1]},
            {"kind": "db", "id": "d-members", "logical": "メンバー名簿・通知設定", "physical": "members (avatar_url / notify_settings / password_hash)", "anchor_rows": [3, 4]}
        ],
        "lane5_nodes": [
            {"id": "o-scr01", "badge": "遷移先画面", "title": "SCR01 ログイン画面", "desc": "未ログイン状態へ復帰（#loginCard 表示）", "anchor_rows": [5]}
        ]
    }
}
