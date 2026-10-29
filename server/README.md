# 購入記録サーバー（Pro 版の決済）

Stripe Checkout（Managed Payments）で Pro 版の月額契約を受け付け、誰が支払ったかを記録して拡張機能に答える小さなサーバーです。Cloudflare Workers で動き、依存パッケージはありません。

## しくみ

1. 拡張機能は、インストールごとにランダムな **購入 ID**（64 桁の英数字）を作り、`chrome.storage.sync` に保存します。名前やメールアドレスは扱いません。
2. 「Pro 版を購入」を押すと、拡張機能が `POST /v1/checkout` を呼びます。サーバーは購入 ID を `client_reference_id` に入れて Stripe Checkout を作り、決済ページの URL を返します。
3. 支払いが終わると、Stripe から Webhook（`/v1/webhook`）が届きます。サーバーは署名を確かめてから、購入 ID ごとの契約状態を KV に記録します。成功画面に来ただけでは Pro にしません。
4. 拡張機能は `GET /v1/entitlement` で状態を尋ね、結果を 6 時間保存します。サーバーに届かないときは、前回 Pro だった場合に限り 7 日間は Pro のまま使えます。
5. 「契約の確認・解約」を押すと、`POST /v1/portal` が Stripe のカスタマーポータルを開きます。

| 状態 | Pro | 備考 |
|---|---|---|
| active / trialing | 使える | |
| past_due | 使える | Stripe が支払いを再試行している間 |
| 解約予約（cancel_at_period_end） | 使える | 支払済み期間の終わりまで |
| canceled（期間終了後）/ unpaid / incomplete | 使えない | 保存データと手動バックアップはそのまま |

Webhook は同じイベントの二重受信（event id で判定）と、古いイベントの後着（`created` で判定）を無視します。

## 現在の設定（2026-10-29、テストモード）

- Worker：`https://tab-matomen-billing.kws-toolskws-toolskws-toolskws-tools.workers.dev`（workers.dev のサブドメインは `kws-toolskws-toolskws-toolskws-tools`。`kws-tools` は使用済みだった）
- Stripe サンドボックスの Webhook：`tab-matomen-billing`（`we_1UVqXXRvCR021e0t6BObkUay`、下の4イベント）
- 秘密鍵 2 つ（`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`）は登録済み。カスタマーポータルは解約・支払い方法の変更を許可済み。
- テストカードで購入 → Pro、解約予約 → 期間末まで Pro、即時解約 → Pro 解除、まで本番のテストモードで確認済み。
- wrangler 4 は Node 22 以上が必要。このマシンの Node は 20 なので、`npx -y -p node@22 -p wrangler@4 -- wrangler <コマンド>` で実行する。

## 公開までに利用者が行う作業

秘密鍵やトークンはチャットに貼らず、下のコマンドで直接登録してください。最初は Stripe の **テストモード** で通しの確認をします。

### 1. Stripe（テストモード）
1. ダッシュボードで Managed Payments が使えるか確認し、有効にする（設定 → Managed Payments）。
2. 商品「Tab Matomen Kai Pro」を作り、Managed Payments の対象になる税コード（電子的に提供されるソフトウェア）を選ぶ。月額の価格を作って、価格 ID（`price_...`）を控える。
3. カスタマーポータルを有効にし、解約とお支払い方法の変更を許可する（設定 → Billing → カスタマーポータル）。

### 2. Cloudflare Workers
```bash
cd server
npx wrangler login
npx wrangler kv namespace create BILLING
```
表示された `id` を `wrangler.toml` の `REPLACE_WITH_KV_NAMESPACE_ID` に入れ、`STRIPE_PRICE_ID` に価格 ID を入れて、次を実行します。
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler deploy
```
デプロイ後に表示される URL（`https://tab-matomen-billing.<アカウント>.workers.dev`）を `wrangler.toml` の `PUBLIC_URL` に入れて、もう一度 `npx wrangler deploy` します。

### 3. Stripe の Webhook
送信先を `<Worker の URL>/v1/webhook` にして、次のイベントを選びます。
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

作成後に表示される署名シークレット（`whsec_...`）を登録します。
```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

### 4. 拡張機能
`extension/billing-config.js` の `apiBase` に Worker の URL を入れます。

パッケージ化していない（開発中の）拡張機能は常に Pro なので、本物の購入手続きを試すときは、ダッシュボードの開発者ツールのコンソールで次を実行します。
```js
chrome.storage.local.set({pwm_billing_live_test: true})
```
テスト用カード `4242 4242 4242 4242` で購入し、Pro になること、解約の予約、Pro に戻ることを確かめます。終わったら `chrome.storage.local.remove('pwm_billing_live_test')` で戻します。

### 5. 本番へ切り替える前に
- Stripe を本番モードにして、価格・Webhook・秘密鍵を本番用に入れ直す。
- プライバシーポリシーに「Pro 版の利用時だけ、購入 ID を購入記録サーバーに送る」旨を追記する（`store/privacy-policy.*.md`）。
- 特定商取引法の表記に、価格・支払時期・解約方法を記入する（`store/tokushoho.ja.md`）。
- 国内の消費税の扱いと海外売上の申告区分を税理士に確認する（`planning/PAY-01-PROVIDERS.md`）。

## テスト
```bash
node --test tests/billing-worker.test.mjs   # サーバー（署名・状態の反映・順序・CORS）
node tests/billing.cjs                       # 拡張機能（購入・確認・解約・オフライン猶予・ID の引き継ぎ）
```
