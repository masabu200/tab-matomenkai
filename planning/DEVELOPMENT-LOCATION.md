# 開発先の整理

更新日：2026-10-26

今後はこの案件フォルダで開発する。新機能の正本は `extension/`。

- `extension/`：Google Driveバックアップ・AI連携・サイドバー改善を含む開発版。
- `tab-matomen-mcp-server/`：ローカルAI連携サーバーと接続設定例。
- `tests/`：開発版の検証コード。案件フォルダをカレントディレクトリとして実行する。
- `planning/GOOGLE-DRIVE-BACKUP.md`：Drive接続手順。
- `planning/DEVELOPMENT-HISTORY.md`：旧開発先のREADMEを保存した履歴資料。古いパスは当時の記録。

案件直下の既存版には未コミットの変更があるため保持した。新機能の修正を直下の旧ファイルへ重ねない。ストアへの配布対象は `extension/` を基に別途確認する。

旧開発先は `/Users/mugikura/Documents/Codex/2026-10-09/task-2`。元ファイルは残しているが、今後は編集しない。個人のバックアップJSON・ブラウザプロファイル・証跡画像は移していない。

Chromeが現在読み込んでいる拡張機能の場所は変更していない。読み込み先の変更による拡張ID・保存データ・OAuthリダイレクトへの影響を確認してから切り替える。

## 検証コマンド

```sh
node --test tests/*.test.cjs
node tests/drive-backup.cjs
cd tab-matomen-mcp-server
npm ci
npm test
```

ブラウザ試験は既存のローカルPlaywright環境を参照する。`import-settings.cjs` は個人の実バックアップファイルを必要とするため、自動の一括実行には含めない。

## 移行後の確認結果

- 開発版28ファイル：移行元とバイト単位で一致。
- 基本テスト：6件成功。
- Driveブラウザ試験：模擬認証・模擬API・エラー処理・画面幅280〜1440pxの確認に成功。実Googleとの通信は未確認。
- MCP統合試験：提案・承認・取り消し・認証拒否・古い提案の拒否に成功。
- MCPサーバーの依存関係：npm ciが脆弱性3件（moderate 1件、high 2件）を報告。今回の移行ではバージョンを変更していない。公開前に原因と更新の影響を確認する。
