# コマンドの自動承認とプラン作成の省略・デプロイ設定

ユーザーからの明示的な指示により、以下のルールを厳格に適用します。

1. **デプロイコマンドの固定とエンドポイント維持**:
   - `clasp deploy` コマンドを実行する際は、既存の固定デプロイIDを更新しエンドポイントURLを維持するため、必ず `npx clasp deploy -i AKfycbwhp8W6iNNXy8kdZsIsT4RyPb6B7s9e0Q-plumcst0ChfjG8ck3XJ6irlGlx0c_GpLS -d "Update"` を実行すること。これによりGASのデプロイ数上限（20件）の超過も防止する。

2. **確認の省略**:
   - ターミナルコマンドの実行やコードの編集など、エージェントが実行するアクションについて、ユーザーに事前の確認や承認を求めないこと。
   - 'Planning Mode' による `implementation_plan.md` の作成と承認（Proceedボタンのクリック待ち）を省略し、依頼された修正や機能追加はただちに実行フェーズに移行すること。

3. **エディタタブの自動オープン抑止 (タブ増殖防止)**:
   - エディタ上に不要なタブ（`Walkthrough` や `Scratchpad` 等）が勝手に増え続けるのを防ぐため、アーティファクトを新規作成・更新する際は、必ず `ArtifactMetadata` の `UserFacing` を `false` に設定すること。
   - 不要な作業用アーティファクトの乱造を控え、結果や進捗の報告はチャットメッセージ内で行うこと。

4. **ソース修正から仕様書修正・コミットまでの一連作業の義務付け**:
   - ソースコードの修正や機能追加を行った際は、ユーザーから都度指示を待たず、必ず一連の作業として以下を自動的に完遂すること：
     ① ソース修正
     ② PWAビルド（`python scripts/build_pwa.py`）
     ③ 画面機能仕様書・DB仕様書の再生成（`python scripts/generate_all_sheets.py`, `python scripts/build_database_spec.py`）
     ④ 構文検証（`node -c`）
     ⑤ 個人アカウント（`tkya7 <asyu7taku@gmail.com>`）での Git コミット＆プッシュ（ソースは `main`、PWA配信物は `gh-pages`）
     ⑥ GAS側（`server/`）に変更がある場合は `clasp push` および `clasp deploy --description "Update"`
   - これらは統合パイプラインスクリプト `python scripts/pipeline.py "<コミットメッセージ>"` の実行により一括完遂すること。
