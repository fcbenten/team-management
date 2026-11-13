from playwright.sync_api import sync_playwright

def inspect():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1560, 'height': 760})
        page.goto('file:///D:/app/TeamManagement/docs/flow_diagram_fitted.html')
        canvas = page.query_selector('.canvas').bounding_box()
        cx, cy = canvas['x'], canvas['y']
        
        # 主要要素の取得
        selectors = [
            ('.big-box', '大箱'),
            ('.small-box', '小箱'),
            ('.arrow-label', '注記'),
            ('[style*="background: #1E293B"]', 'github pages'),
            ('[style*="border: 2.5px solid #0284C7"]', 'WEB アプリ'),
            ('[style*="border: 2.5px solid #06C755"]', 'LINE アプリ')
        ]
        
        seen = set()
        for sel, label in selectors:
            for el in page.query_selector_all(sel):
                t = el.inner_text().split('\n')[0][:25].strip()
                b = el.bounding_box()
                key = (round(b['x']), round(b['y']))
                if key in seen:
                    continue
                seen.add(key)
                rx, ry = b['x'] - cx, b['y'] - cy
                rr = rx + b['width']
                rb = ry + b['height']
                print(f"{label:10s} | {t:22s} | rx={rx:5.1f}, ry={ry:5.1f}, w={b['width']:5.1f}, h={b['height']:5.1f} | right={rr:5.1f}, bottom={rb:5.1f}")
        
        browser.close()

if __name__ == '__main__':
    inspect()
