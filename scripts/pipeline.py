import os
import sys
import subprocess

def run(cmd, cwd=None, check=True):
    print(f"\n>> Running: {cmd} (cwd: {cwd or '.'})")
    res = subprocess.run(cmd, shell=True, cwd=cwd, text=True, capture_output=True)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(res.stderr.strip())
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed with code {res.returncode}: {cmd}")
    return res

def main():
    commit_msg = sys.argv[1] if len(sys.argv) > 1 else "update: sync source, specs, and pwa build"
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scripts_dir = os.path.join(base_dir, "scripts")
    pwa_dist_dir = os.path.join(base_dir, "pwa-dist")

    print(f"=== Antigravity Full Pipeline Started ===")
    print(f"Target commit message: {commit_msg}")

    # 1. PWA ビルド
    print("\n--- [1/5] Building PWA Bundle ---")
    run(f'python "{os.path.join(scripts_dir, "build_pwa.py")}"', cwd=base_dir)

    # 2. 仕様書・ダイアグラムの再生成
    print("\n--- [2/5] Regenerating Specification Sheets & Flow Diagrams ---")
    run(f'python "{os.path.join(scripts_dir, "build_database_spec.py")}"', cwd=base_dir)
    run(f'python "{os.path.join(scripts_dir, "generate_all_sheets.py")}"', cwd=base_dir)

    # 3. 構文チェック
    print("\n--- [3/5] JavaScript Syntax Check ---")
    pwa_html_path = os.path.join(pwa_dist_dir, "index.html")
    with open(pwa_html_path, "r", encoding="utf-8") as f:
        html = f.read()
    import re
    scripts = re.findall(r'<script>(.*?)</script>', html, re.DOTALL)
    temp_js = os.path.join(pwa_dist_dir, "temp_check.js")
    with open(temp_js, "w", encoding="utf-8") as f:
        f.write("\n;\n".join(scripts))
    try:
        run(f'node -c "{temp_js}"', cwd=base_dir)
        print("JavaScript syntax validated successfully.")
    finally:
        if os.path.exists(temp_js):
            os.remove(temp_js)

    # 4. ソースコードリポジトリ (root -> main) のコミット & プッシュ
    print("\n--- [4/5] Committing & Pushing Source Code (main) ---")
    run('git add .', cwd=base_dir)
    # 差分がある場合のみコミット
    diff_check = run('git status --porcelain', cwd=base_dir, check=False)
    if diff_check.stdout.strip():
        run(f'git commit -m "{commit_msg}"', cwd=base_dir)
        run('git push origin main', cwd=base_dir)
    else:
        print("No source changes to commit in root repository.")

    # 5. PWA 配信リポジトリ (pwa-dist -> gh-pages) のコミット & プッシュ
    print("\n--- [5/5] Committing & Pushing PWA Distribution (gh-pages) ---")
    run('git add .', cwd=pwa_dist_dir)
    pwa_diff_check = run('git status --porcelain', cwd=pwa_dist_dir, check=False)
    if pwa_diff_check.stdout.strip():
        run(f'git commit -m "{commit_msg}"', cwd=pwa_dist_dir)
        run('git push origin gh-pages', cwd=pwa_dist_dir)
    else:
        print("No PWA changes to commit in pwa-dist.")

    print("\n=== Antigravity Full Pipeline Completed Successfully! ===")

if __name__ == "__main__":
    main()

