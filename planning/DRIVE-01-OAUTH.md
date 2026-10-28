# DRIVE-01 一般配布用の Google 認証設計

更新日: 2026-10-28

## 決定

Googleドライブ接続は **2つの方式** を持ち、`extension/drive-backup.js` の `DriveBackup.mode()` が manifest を見て自動で選ぶ。

| 方式 | 条件 | 認証 | トークンの保持と更新 | 想定利用者 |
|---|---|---|---|---|
| builtin（本命） | `manifest.json` に `oauth2.client_id` がある | `chrome.identity.getAuthToken` | Chrome が保持・自動更新。拡張側は何も保存しない（接続済みフラグ `pwm_drive_connected` のみ） | ストア配布版の一般利用者 |
| manual（従来・予備） | `oauth2` が無い、または `getAuthToken` が無い | 利用者が自分の Web アプリ用クライアントIDを入力し `launchWebAuthFlow`（暗黙フロー） | `chrome.storage.session` に1時間トークン。期限切れ時は `prompt=none` の非対話フローで無操作更新を試み、失敗したら再接続を案内 | 開発者、Chrome 以外の Chromium 系 |

### なぜ getAuthToken か

- 一般利用者に Google Cloud でクライアントを作らせない、という完了条件を満たす唯一の標準手段。
- クライアントシークレットが不要（配布パッケージに秘密を入れない方針と整合）。
- 非対話呼び出しで Chrome がトークンを更新するため、AUTO-01（バックグラウンド自動保存）で Service Worker からそのまま使える。
- `drive.file` スコープは Google の区分で「非機微」。公開（本番）ステータスにしても追加の審査は不要で、警告画面も出ない（ロゴ表示にはブランド確認が別途必要）。

### 制約

- 拡張IDを固定する必要がある（クライアントが拡張IDに紐づくため）。開発版も `manifest.json` の `key` でストアと同じIDにする。
- Chrome 専用。Brave など `getAuthToken` が無い環境では manual に自動で切り替わる。
- Chrome にGoogleアカウントでログインしていない場合、初回接続時に Chrome がログインを求める。

## 利用者（開発者）がやる手順

1. **拡張IDを固定する**
   1. Chrome Web Store デベロッパーダッシュボードで、公開中アイテム「タブまとめん改」の *パッケージ* タブ → *公開鍵を表示* を開く。
   2. `BEGIN PUBLIC KEY` と `END PUBLIC KEY` の間の文字列を改行を除いて1行にし、`extension/manifest.json` に `"key": "<その文字列>"` を追加する。
   3. `chrome://extensions` で `extension/` を読み直し、IDがダッシュボードの Item ID と一致することを確認する。
   - 注意: IDが変わるので、設定・Drive接続・AI接続は再設定。既存データは `pwm_data` のまま残る（エクスポートしてから入れ替えると安全）。
2. **Google Cloud でクライアントを作る**
   1. 既存プロジェクト（Drive API が有効なもの）で *APIとサービス → 認証情報 → クライアントを作成*。
   2. アプリケーションの種類 **Chrome 拡張機能**、アイテムID に手順1のIDを入力。
   3. 作成されたクライアントIDを控える。
3. **OAuth 同意画面**
   - 対象: 外部。スコープは `.../auth/drive.file` のみ。
   - 公開ステータスを **本番** にする（テスト中だとテストユーザー以外が接続できない）。
   - アプリ名・サポートメール・プライバシーポリシーURL は公開準備（計画書 7節）の連絡先と揃える。
4. **manifest に設定する**
   ```json
   "oauth2": {
     "client_id": "<クライアントID>.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/drive.file"]
   }
   ```
   これだけで設定画面は builtin 表示（クライアントID入力欄が消える）に切り替わる。
5. **実機確認（DRIVE-02）**: 接続 → 今すぐバックアップ → Drive に JSON が出来ることと中身の一致 → 1時間以上置いて再保存（無操作更新）→ 権限取り消し後の再接続案内。

## 実装済み（2026-10-28）

- `extension/drive-backup.js`: `mode()` 追加。builtin は `getAuthToken({interactive, scopes})`、401 で `removeCachedAuthToken` → 次回は新しいトークンを非対話で取得。manual は期限切れ時に `prompt=none` で無操作更新。切断は両方式でフラグとキャッシュを消す。
- `extension/drive-settings.js`: builtin では手順 `<details>` を隠し、説明文 `#driveBuiltinHelp` を出す。
- `tests/drive-backup.cjs`: manual（無操作更新・更新失敗）と builtin（拒否・接続・非対話取得・401・切断）をモックで検証。

## 未完

- manifest の `key` と `oauth2` の追加（公開鍵とクライアントIDは開発者のアカウントでしか取れない）。
- 実 Google での往復確認（DRIVE-02）。
- ストア掲載文の権限説明に `identity` の用途（Googleドライブへのバックアップ保存）を書く。
