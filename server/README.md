# 購入記録サーバー（Pro 版の決済）

Stripe Checkout（Managed Payments）で Pro 版の**買い切り**（¥300・税込）を受け付け、誰が支払ったかを記録して拡張機能に答える小さなサーバーです。Cloudflare Workers で動き、依存パッケージはありません。

## しくみ

1. 拡張機能は、インストールごとにランダムな **購入 ID**（64 桁の英数字）を作り、`chrome.storage.sync` に保存します。名前やメールアドレスは扱いません。
2. 「Pro 版を購入」を押すと、拡張機能が `POST /v1/checkout` を呼びます。サーバーは購入 ID を `client_reference_id` に入れて Stripe Checkout を作り、決済ページの URL を返します。
3. 支払いが終わると、Stripe から Webhook（`/v1/webhook`）が届きます。サーバーは署名を確かめてから、支払い済み（`payment_status: paid`）の購入だけを購入 ID ごとに `paid` として KV に記録します。成功画面に来ただけでは Pro にしません。後から支払いが確定する方法は `checkout.session.async_payment_succeeded` で記録します。
4. 拡張機能は `GET /v1/entitlement` で状態を尋ね、結果を 6 時間保存します。サーバーに届かないときは、購入済み（`paid`）なら期限なく Pro のまま使えます（月額時代の契約は 7 日間だけ）。
5. 全額を返金すると `charge.refunded` が届き、`refunded`（Pro 解除）になります。一部返金では Pro のままです。
6. 「契約の確認・解約」ボタンとカスタマーポータル（`POST /v1/portal`）は、月額時代の契約にだけ表示・使用します。

| 状態 | Pro | 備考 |
|---|---|---|
| paid（買い切り） | 使える | 期限なし |
| refunded | 使えない | 全額返金後。同じ購入 ID で買い直せる |
| （以下は月額時代の契約） | | |
| active / trialing | 使える | |
| past_due | 使える | Stripe が支払いを再試行している間 |
| 解約予約（cancel_at_period_end） | 使える | 支払済み期間の終わりまで |
| canceled（期間終了後）/ unpaid / incomplete | 使えない | 保存データと手動バックアップはそのまま |

Webhook は同じイベントの二重受信（event id で判定）と、古いイベントの後着（`created` で判定）を無視します。

## 現在の設定（2026-10-29、テストモード）

- Worker：`https://tab-matomen-billing.kws-toolskws-toolskws-toolskws-tools.workers.dev`（workers.dev のサブドメインは `kws-toolskws-toolskws-toolskws-tools`。`kws-tools` は使用済みだった）
- Stripe サンドボックスの Webhook：`tab-matomen-billing`（`we_1UVqXXRvCR021e0t6BObkUay`、6イベント：買い切りの3つ＋月額時代の3つ）
- 2026-10-29 に月額から**買い切り（¥300・税込）**に変更。テストの価格は `price_1UVrm8RvCR021e0thuj2pT6t`（1回限り・内税）。
- 秘密鍵 2 つ（`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`）は登録済み。カスタマーポータルは解約・支払い方法の変更を許可済み。
- 月額のときに、テストカードで購入 → Pro、解約予約 → 期間末まで Pro、即時解約 → Pro 解除、まで確認済み。買い切りの通し確認は下の履歴を参照。
- wrangler 4 は Node 22 以上が必要。このマシンの Node は 20 なので、`npx -y -p node@22 -p wrangler@4 -- wrangler <コマンド>` で実行する。

## 公開までに利用者が行う作業

秘密鍵やトークンはチャットに貼らず、下のコマンドで直接登録してください。最初は Stripe の **テストモード** で通しの確認をします。

### 1. Stripe（テストモード）
1. ダッシュボードで Managed Payments が使えるか確認し、有効にする（設定 → Managed Payments）。
2. 商品「Tab Matomen Kai Pro」を作り、Managed Payments の対象になる税コード（電子的に提供されるソフトウェア）を選ぶ。1回限り・内税 ¥300 の価格を作って、価格 ID（`price_...`）を控える。

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
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

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

### 5. 本番（ライブモード）への切り替え
テストモードと同じ形を本番にもう一度作り、Worker の3つの値を入れ替えます。下の 1〜3 は Stripe の管理画面（右上のテスト環境の切り替えを**オフ**）で行います。

1. **Managed Payments の確認**：設定 → Managed Payments が本番で有効か確認する。テストの決済画面は「Link を通じて販売」と出ていたので、テストでは有効。本番では審査や申込みが別に要る場合がある。
2. **商品と価格**：商品カタログ → 商品を作成。テストと同じにする（Pro は**買い切り**）。
   - 名前 `Tab Matomen Kai Pro`、説明 `Automatic Google Drive backup for Tab Matomen Kai (Chrome extension).`
   - 税コード `txcd_10103000`（Software as a service (SaaS) - personal use）
   - 価格 ¥300・**1回限り**・「価格に税金を含める」は**はい（内税）**。作成後に価格 ID（`price_...`）を控える。
3. **Webhook**：開発者 → Webhook → 送信先を追加。URL は `https://tab-matomen-billing.kws-toolskws-toolskws-toolskws-tools.workers.dev/v1/webhook`、イベントは `checkout.session.completed`・`checkout.session.async_payment_succeeded`・`charge.refunded`（月額時代の `customer.subscription.*` は不要）。
4. **Worker の値を入れ替える**（`server` フォルダで実行。鍵は聞かれたら貼り付け）：
   - `wrangler.toml` の `STRIPE_PRICE_ID` を本番の価格 ID に書き換える。
   ```bash
   npx -y -p node@22 -p wrangler@4 -- wrangler secret put STRIPE_SECRET_KEY
   npx -y -p node@22 -p wrangler@4 -- wrangler secret put STRIPE_WEBHOOK_SECRET
   npx -y -p node@22 -p wrangler@4 -- wrangler deploy
   ```
   本番の秘密鍵は `sk_live_...`（開発者 → API キー）、署名シークレットは 3 で作った送信先の `whsec_...`。
5. **確認**：`node tools/billing-live-check.cjs` で、設定画面から本番の決済画面（`cs_live_`）が開くことを確かめる。実際に1回購入して Pro になること、すぐ解約・返金できることを確かめると確実。
6. **テストのデータ**：KV に残るテストの購入記録は本番の購入 ID と重ならないので消さなくてよい。テストモードの Webhook は止めておく（テストモードの送信先を「無効」に）。

### 6. 公開前の書類
- 利用規約・特定商取引法に基づく表記・プライバシーポリシーは `store/terms.*.md`・`store/tokushoho.ja.md`・`store/privacy-policy.*.md` が正本。編集したら `node tools/build-legal.cjs` で `server/public/` を作り直し、`wrangler deploy` する。公開先は Worker の `/terms`・`/tokushoho`・`/privacy`（英語は `/en/terms`・`/en/privacy`）。拡張機能の設定の「Pro 版」からリンクしている。
- Chrome ウェブストアのダッシュボードで、プライバシーポリシーの URL に `/privacy` を入れ、「アプリ内購入あり」を選ぶ。
- 国内の消費税の扱いと海外売上の申告区分を税理士に確認する（`planning/PAY-01-PROVIDERS.md`）。
- 特商法の表記に、運営統括責任者の氏名と電話番号を出している（Webの相棒の表記と同じ）。省略して「請求があれば遅滞なく開示」とするかは、必要なら専門家に確認する。

## テスト
```bash
node --test tests/billing-worker.test.mjs   # サーバー（署名・状態の反映・順序・CORS）
node tests/billing.cjs                       # 拡張機能（購入・確認・解約・オフライン猶予・ID の引き継ぎ）
node tools/billing-live-check.cjs [購入ID]   # 本物のサーバーと Stripe（テストモード）に対して、設定画面から購入・規約リンク・ポータルを確認（テスト一式には含めない）
```
