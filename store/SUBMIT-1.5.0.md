# 1.5.0 の提出手順（Chrome ウェブストア デベロッパー ダッシュボード）

Chrome はウェブストアのページを拡張機能や自動操作で触らせない仕様のため、アップロードと入力は手作業で行う。所要 10〜15 分。

## 1. パッケージ
- ファイル: `dist/tab-matomenkai-1.5.0.zip`（`sh tools/build-store-zip.sh` で作成。manifest の `key` は自動で外れる）
- ダッシュボード → タブまとめん改 → 「パッケージ」→「新しいパッケージをアップロード」→ この ZIP。
- 権限は 1.4.0 と同じ（追加の権限警告は出ない）。決済サーバーへの通信は CORS で許可しており、ホスト権限は増やしていない。

## 2. ストアの掲載情報（各言語タブ）
- 「説明」に `store/listing/<言語>.md` の「詳細説明」を貼る。今回は全10言語に「■ 有料版（Pro）」の段落が増えている（買い切り 300円、購入 ID だけを送る、Stripe/Link）。
- 概要（タイトル下の一文）は manifest の description から出るので入力不要。

## 3. プライバシー（「プライバシーへの取り組み」タブ）
- **プライバシーポリシーの URL**：`https://tab-matomen-billing.kws-toolskws-toolskws-toolskws-tools.workers.dev/privacy`
- **単一用途**：開いているタブをスペースごとに保存・復元し、切り替える。
- **権限の理由**：`store/listing/ja.md` の「権限の説明」をそのまま使う（1.4.0 から変更なし）。
- **データの使用**（チェック項目）：
  - 個人を特定できる情報・健康・財務・認証情報・個人的な通信・位置情報・ウェブ履歴・ユーザーのアクティビティ・ウェブサイトのコンテンツ → **どれも収集していない**。
    - 保存したタブはブラウザと利用者自身の Google ドライブにだけ保存し、開発者には届かない。
    - Pro 版の確認で送る購入 ID はインストールごとの乱数で、個人と結び付く情報ではない。支払い情報は Stripe/Link が直接受け取り、開発者は受け取らない。
  - 3つの宣誓（第三者への販売なし／単一用途と無関係な利用なし／信用力判定に使わない）に**すべてチェック**。

## 4. 価格・アプリ内購入
- 「配布」タブ（または掲載情報）の **アプリ内購入：あり** を選ぶ。拡張機能自体は無料、Pro 版（買い切り 300円・税込）を拡張内から購入できる。
- 「公開範囲」は従来どおり。

## 5. 審査に出す
- 「審査のために送信」。審査メモ（任意）に次を書くと通りやすい：
  > 1.5.0 adds an optional one-time Pro purchase (¥300) for automatic Google Drive backup. Payment is handled by Stripe Checkout (Link, LLC as merchant of record). The extension only sends a random per-install purchase ID to our server (Cloudflare Workers) to check the purchase. Terms, commercial disclosure and privacy policy are linked from Settings → Pro. All other features remain free.

## 6. 公開後の確認
- ストア版をインストールし、設定 →「Pro 版」に「現在は無料版です」と出ること、「Pro 版を購入」で本番の決済画面（¥300）が開くこと。
- 開発版（パッケージ化していないもの）は従来どおり常に Pro。
