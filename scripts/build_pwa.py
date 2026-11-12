import os
import re
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html_dir = os.path.join(base_dir, "html")
html_index_path = os.path.join(html_dir, "index.html")
pwa_dist_dir = os.path.join(base_dir, "pwa-dist")
output_path = os.path.join(pwa_dist_dir, "index.html")

print("=== Building FC Benten Static PWA (Pure CSS/JS Modular) ===")

with open(html_index_path, "r", encoding="utf-8") as f:
    content = f.read()

polyfill_code = """
  <!-- =========================================
       GAS Web API Bridge (google.script.run Polyfill)
       ========================================= -->
  <script>
    (function() {
      const GAS_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbwhp8W6iNNXy8kdZsIsT4RyPb6B7s9e0Q-plumcst0ChfjG8ck3XJ6irlGlx0c_GpLS/exec';

      function createProxy(successHandler, failureHandler, userObject) {
        return new Proxy({}, {
          get: function(target, prop) {
            if (prop === 'withSuccessHandler') {
              return function(handler) {
                return createProxy(handler, failureHandler, userObject);
              };
            }
            if (prop === 'withFailureHandler') {
              return function(handler) {
                return createProxy(successHandler, handler, userObject);
              };
            }
            if (prop === 'withUserObject') {
              return function(obj) {
                return createProxy(successHandler, failureHandler, obj);
              };
            }

            // Server function invocation via POST JSON
            return function(...args) {
              fetch(GAS_ENDPOINT_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({
                  functionName: prop,
                  args: args
                })
              })
              .then(function(res) {
                if (!res.ok) {
                  throw new Error('HTTP ' + res.status + ' ' + res.statusText);
                }
                return res.json();
              })
              .then(function(result) {
                if (result && result.success) {
                  if (typeof successHandler === 'function') {
                    successHandler(result.data, userObject);
                  }
                } else {
                  const err = new Error(result && result.error ? result.error : 'サーバー側でエラーが発生しました。');
                  if (typeof failureHandler === 'function') {
                    failureHandler(err, userObject);
                  } else {
                    console.error('GAS API Execution Error [' + prop + ']:', err);
                  }
                }
              })
              .catch(function(err) {
                console.error('GAS Network/Parse Error [' + prop + ']:', err);
                if (typeof failureHandler === 'function') {
                  failureHandler(err, userObject);
                }
              });
            };
          }
        });
      }

      window.google = window.google || {};
      window.google.script = window.google.script || {};
      window.google.script.run = createProxy(null, null, null);
    })();
  </script>
"""

pwa_meta_tags = """
  <!-- PWA Manifest & Icons -->
  <link rel="manifest" href="./manifest.json">
  <link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png">
  <link rel="apple-touch-icon" sizes="192x192" href="./icon-192.png">

  <!-- Apple iOS Standalone Settings -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="FC Benten">

  <!-- Android / Chrome Standalone Settings -->
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#2563eb">
"""

sw_register_code = """
  <!-- PWA Service Worker Registration -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js')
          .then(function(reg) {
            console.log('PWA ServiceWorker registered with scope:', reg.scope);
          })
          .catch(function(err) {
            console.warn('PWA ServiceWorker registration failed:', err);
          });
      });
    }
  </script>
"""

head_pos = content.find("<head>")
if head_pos != -1:
    content = content[:head_pos + 6] + "\n" + pwa_meta_tags + "\n" + polyfill_code + content[head_pos + 6:]

body_close_pos = content.rfind("</body>")
if body_close_pos != -1:
    content = content[:body_close_pos] + "\n" + sw_register_code + "\n" + content[body_close_pos:]

resolved_files = set()

# 1. CSS Link のインライン展開 (<link rel="stylesheet" href="...">)
def replace_css_link(match):
    href = match.group(1)
    if href.startswith("http://") or href.startswith("https://"):
        return match.group(0)  # 外部CSS（Google Fonts等）はそのまま
    css_path = os.path.normpath(os.path.join(html_dir, href))
    if not os.path.exists(css_path):
        print(f"WARNING: CSS file not found: {href} ({css_path})")
        return f"<!-- Missing CSS: {href} -->"
    resolved_files.add(css_path)
    with open(css_path, "r", encoding="utf-8") as f:
        css_text = f.read()
    return f"<style>\n/* {href} */\n{css_text}\n</style>"

content = re.sub(r'<link\s+rel=["\']stylesheet["\']\s+href=["\']([^"\']+)["\']\s*/?>', replace_css_link, content, flags=re.IGNORECASE)

# 2. HTML View インクルード (<!-- #include "..." -->)
def replace_html_include(match):
    rel_path = match.group(1).strip(' "\'')
    inc_path = os.path.normpath(os.path.join(html_dir, rel_path))
    if not os.path.exists(inc_path):
        inc_path = os.path.normpath(os.path.join(base_dir, rel_path))
    if not os.path.exists(inc_path):
        print(f"WARNING: HTML include not found: {rel_path} ({inc_path})")
        return f"<!-- Missing HTML include: {rel_path} -->"
    resolved_files.add(inc_path)
    with open(inc_path, "r", encoding="utf-8") as f:
        inc_text = f.read()
    return inc_text

content = re.sub(r'<!--\s*#include\s+([^\s>]+)\s*-->', replace_html_include, content)

# 互換用: もし <?!= include(...) ?> が残っていれば念のため置換
include_gas_pattern = re.compile(r"<\?!=\s*include\('([^']+)'\);\s*\?>")
def replace_gas_include(match):
    rel_path = match.group(1)
    target_path = os.path.join(base_dir, rel_path)
    if not os.path.exists(target_path):
        if not target_path.endswith('.html'):
            target_path += '.html'
    if not os.path.exists(target_path):
        print(f"WARNING: File not found: {rel_path} ({target_path})")
        return f"<!-- Missing include: {rel_path} -->"
    resolved_files.add(target_path)
    with open(target_path, "r", encoding="utf-8") as f:
        return f.read()

content = include_gas_pattern.sub(replace_gas_include, content)

# 3. JS Script のインライン展開 (<script src="..."></script>)
def replace_js_script(match):
    src = match.group(1)
    if src.startswith("http://") or src.startswith("https://"):
        return match.group(0)  # 外部CDN（Supabase等）はそのまま残す
    js_path = os.path.normpath(os.path.join(html_dir, src))
    if not os.path.exists(js_path):
        print(f"WARNING: JS file not found: {src} ({js_path})")
        return f"<!-- Missing JS: {src} -->"
    resolved_files.add(js_path)
    with open(js_path, "r", encoding="utf-8") as f:
        js_text = f.read()
    return f"<script>\n// {src}\n{js_text}\n</script>"

content = re.sub(r'<script\s+src=["\']([^"\']+)["\']\s*></script>', replace_js_script, content, flags=re.IGNORECASE)

with open(output_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Build complete: {len(resolved_files)} files bundled -> {output_path} ({len(content)} bytes)")
