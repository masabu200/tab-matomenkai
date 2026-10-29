# PAY-01 決済サービスの比較と推奨

調査日：2026-10-29（本文中の手数料・要件はすべてこの日に各URLで確認。確認できなかった項目は「未確認」と書く）
状態：調査結果と推奨案。決済サービスへの登録・契約は未実施（この調査では何も登録していない、個人情報も入力していない）。

前提：
- 販売者は日本の個人事業主（屋号 KWS、住所はバーチャルオフィス）。
- 販売物は Chrome 拡張「タブまとめん改」の Pro サブスクリプション（主機能は Google ドライブへの自動保存、後に PC 間同期）。
- 購入者は世界中（UI は10言語）。Chrome ウェブストアには決済機能がないため、外部の決済サービスを使う。
- 価格は未確定。以下の手数料例では「月額 ¥500 前後（約 $3〜5）」の低単価を想定する。

---

## 1. 推奨（結論）

**本命：Stripe Managed Payments（日本の Stripe アカウント＋Checkout＋Billing）**

- 日本が「Managed Payments を使える事業所在地」に含まれている（[eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)）。Stripe 系の Link, LLC が Merchant of Record（MoR）になり、80か国以上の VAT・GST・売上税の計算・申告・納付を代行する（[how-it-works](https://docs.stripe.com/payments/managed-payments/how-it-works)、[tax-compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)）。EU は国外事業者のデジタル販売に登録の基準額がなく、最初の1件から VAT 登録が必要になる（二次情報：[Avalara](https://www.avalara.com/gb/en-gb/vatlive/eu-vat-rules/eu-vat-digital-services-moss.html)、[EAS](https://help.easproject.com/hc/en-gb/articles/5371372277791-EU-UK-VAT-registration-guide-2026-which-registrations-you-need-scenario-by-scenario)）。個人で各国登録を抱えずに済む MoR は必須に近い。
- **固定手数料がない**。日本アカウントの決済手数料は 3.6%（通貨換算が要る場合は +2%）（[stripe.com/jp/pricing](https://stripe.com/jp/pricing)）に、MoR 料 3.5%（[support](https://support.stripe.com/questions/managed-payments-pricing)）と Billing 0.7% が加わる。合計で約 7.8%（海外の顧客は約 9.8%）。他の MoR は「5% + $0.50」の固定額があり、月額 $3〜5 では手数料率が 15〜20% に膨らむ。低単価のサブスクでは最も安い。
- 購入者は Link のサイトで解約・カード変更・注文履歴の確認を自分でできる。Billing の自動再試行（Smart Retries）も使える（[how-it-works](https://docs.stripe.com/payments/managed-payments/how-it-works)、[smart-retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)）。
- 入金は日本の銀行口座に円で入る。Stripe 本体は事業として安定しており、Lemon Squeezy の顧客も Stripe Managed Payments へ移す方針になっている（[Lemon Squeezy 2026 update](https://www.lemonsqueezy.com/blog/2026-update)）。
- 注意点：
  - ライセンスキーの仕組みがないため、購入状態の確認には小さなサーバー（Webhook を受けて記録する）が必要。
  - **日本国内の顧客への販売は MoR の対象外で、消費税は自分で扱う**（[tax-compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)「国内販売」）。
  - 使える画面は Checkout と Payment Links に限られる。

**次点：Paddle Billing**

- 老舗の MoR。料金は 5% + $0.50 で、税務・サブスク管理・顧客ポータル・支払い失敗時の自動再試行（30日間に最大7回）を含む（[pricing](https://www.paddle.com/pricing)、[dunning 変更履歴](https://developer.paddle.com/changelog/2025/default-dunning-payment-recovery)）。
- 日本は対応外の国に含まれていない（[supported countries](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)）。個人・個人事業主は「事業者確認」の段階が不要と明記されている（二次情報経由の Paddle ヘルプ。下の Paddle の節を参照）。
- Stripe Managed Payments の審査に通らなかった場合や、使える機能に制限があった場合の代替にする。購入状態の確認には、本命と同じくサーバーが必要。
- 「サーバーを一切持ちたくない」を最優先するなら、Paddle の代わりに **Polar.sh**（公開のライセンスキー検証 API あり）を候補にする。ただし固定手数料と入金手数料が重い。

---

## 2. 比較表

| 項目 | Stripe 直接（日本・MoRなし） | **Stripe Managed Payments** | Lemon Squeezy | **Paddle** | Polar.sh | Gumroad | ExtensionPay |
|---|---|---|---|---|---|---|---|
| MoR（各国の税の代行） | なし（Stripe Tax は計算だけ。登録・申告は自分） | あり（Link, LLC）。**日本国内の販売は対象外** | あり（Link, LLC f/k/a Lemon Squeezy LLC） | あり | あり | あり（2025-01-01以降） | なし（Stripe Tax を任意で有効化） |
| 日本の個人事業主の登録 | 可（屋号なしの個人名で登録） | 日本は対象国。個人事業主の可否は審査次第（未確認） | 日本へ銀行振込で入金できる。個人の可否は未確認 | 日本は対象国。個人は事業者確認不要 | 日本へ Stripe Connect Express で入金できる。個人の可否は未確認 | 日本の銀行入金は未確認（PayPal は日本では入金先に使えない） | 日本の Stripe アカウントで使えるか未確認 |
| 決済手数料 | 3.6%（+2% 通貨換算）＋Billing 0.7%（＋Tax 0.5%） | 3.6% ＋ 3.5% ＋ Billing 0.7%（+2% 通貨換算） | 5% + $0.50、海外 +1.5%、サブスク +0.5%、PayPal +1.5% | 5% + $0.50 | 5% + $0.50、海外カード +1.5%（サブスク +0.5% は旧料金の会員のみ） | 10% + $0.50（Discover 経由は 30%） | 5% ＋ Stripe 手数料 |
| 月額 $5 の手数料（概算） | 約 $0.24（税務の負担は別） | 約 $0.39〜0.49 | 約 $0.85 | 約 $0.75 | 約 $0.83 ＋入金手数料 | 約 $1.00 | 約 $0.47〜0.57 ＋税務の負担 |
| 入金 | 日本の銀行に円で。入金手数料は未確認 | 同左 | 米国外の銀行は 1%／回 | 毎月、$100 以上。通貨が違う送金は $15（ヘルプ間で記述に差あり） | $2／月 ＋ 0.25% + $0.25／回 ＋ 通貨換算 1% | 未確認 | Stripe から直接 |
| サブスク（月・年／無料体験） | あり／あり | あり（Billing）／あり（体験開始・終了のメールを Link が送る） | あり／あり | あり／あり | あり／あり（日・週・月・年単位） | あり（会員制）／未確認 | 月・四半期・年／あり |
| 支払い失敗時の再試行 | Smart Retries（推奨は2週間に8回） | 同左 | 未確認 | 30日間に最大7回、その後に解約 | 失敗時にメール。カード更新後に自動で再請求 | 未確認 | Stripe 側の設定 |
| 購入者が自分で解約する画面 | カスタマーポータル（日本語あり） | Link のサイト＋カスタマーポータル | あり（未確認） | Paddle 提供のポータル（標準で有効） | あり（メールのワンタイムコードでログイン） | あり（未確認） | `openPaymentPage()` から管理・解約 |
| 拡張だけで購入状態を確認（サーバー不要） | 不可（Webhook とサーバーが必要） | 不可（同左） | ライセンス API（validate）あり。秘密鍵の要否は未確認 | 不可（ライセンスキー機能なし） | ライセンスキーの公開エンドポイントあり（検証は要確認） | ライセンス検証 API あり（詳細未確認） | **可**（ExtPay.js の `getUser().paid`） |
| 将来性・リスク | 安定 | 安定。比較的新しい製品 | **Stripe MP への移行中。サポートと更新が遅い（本人告知）** | 安定 | 新興 | 安定。手数料が高い | 個人運営に近い。非 MoR |
| 判定 | 税務負担が重く不採用 | **本命** | 新規採用は不可 | **次点** | 「サーバーなし」優先時の代替 | 不採用（手数料） | 不採用（非 MoR・日本対応未確認） |

手数料の概算は、表示の料率を $5 に当てはめた単純計算。3.5% は税込み金額にかかる（[support](https://support.stripe.com/questions/managed-payments-pricing)）。チャージバック手数料・税・為替差は含まない。

---

## 3. サービスごとのメモ（すべて 2026-10-29 確認）

### 3.1 Stripe（日本アカウント、MoR なし）
- 手数料：カード決済 3.6%、通貨換算 +2%、Billing 0.7%、Stripe Tax は登録地域の取引ごとに 0.5%（[stripe.com/jp/pricing](https://stripe.com/jp/pricing)）。料金ページで国内カードと海外カードの差は確認できなかった。入金手数料は料金ページに記載がなく未確認。
- 登録：個人事業主は開業届の有無にかかわらず登録できるが、**屋号ではなく個人名で登録する**。審査には特定商取引法に基づく表記のページが必要で、表記がないことは審査に落ちる主な理由とされる（[Getting started in Japan](https://support.stripe.com/questions/getting-started-in-japan)）。本人確認では政府発行の写真付き身分証の画像を求められる場合がある（[本人確認書類](https://support.stripe.com/questions/documents-for-identity-and-home-address-verification?locale=ja-JP)）。
- 入金：初回は最初の決済から7日後。スケジュールは手動・毎週・毎月から選べる（同上）。
- 税務：Stripe Tax は計算までで、各国への登録・申告・納付は自分で行う。EU は国外事業者に基準額がない（二次情報：[Avalara](https://www.avalara.com/gb/en-gb/vatlive/eu-vat-rules/eu-vat-digital-services-moss.html)）。個人で世界に売るには負担が重すぎる。
- 解約画面：カスタマーポータルで解約（即時または期間終了時）、カード変更、請求書の確認ができる。日本語にも対応（[customer-management](https://docs.stripe.com/customer-management)）。

### 3.2 Stripe Managed Payments（本命）
- 仕組み：Stripe の MoR。購入者には Link が MoR として表示され、「Sold through Link」と出る。明細の表記は `LINK.COM* [自分の表記]`（[how-it-works](https://docs.stripe.com/payments/managed-payments/how-it-works)）。
- 対象：日本は事業所在地として対象。販売物はソフトウェア・SaaS などのデジタル商品で、完全自動で提供するもの。商品ごとに対象の税コード（例 `txcd_10202000` ダウンロード型ソフトウェアの個人利用、`txcd_10103000` SaaS の個人利用）を付ける。プラットフォームやマーケットプレイスを介さず直接売る必要がある（[eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)）。
  - Chrome ウェブストアは無料配布の場所で、決済は自分の Checkout で行う。このため「マーケットプレイス経由の販売」には当たらないと考えるが、**未確認**。審査時に確認する。
- 料金：MoR 料 3.5%（税込み金額に対して）。通常の決済手数料と Billing 料金は別にかかる（[support](https://support.stripe.com/questions/managed-payments-pricing)）。
- 税：80か国以上の国内販売と越境販売について、計算・徴収・登録・申告・納付を Stripe が行う。ただし **事業所在地が日本の場合、日本の顧客への国内販売は自分で計算・徴収・申告・納付する**。対象外の取引の請求書は自分の事業者名と税務情報で発行される（[tax-compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)）。
- 購入後：領収書・請求書・返金の通知は Link から送られる。購入者は link.com で注文履歴の確認、サブスクの解約・更新、カードと住所の変更ができる。自前のカスタマーポータルも併用できる。返金は Stripe が60日以内に行うことがあり、48時間以内に回答しないと Stripe が承認なしで返金する場合がある。チャージバック対応も Stripe が行う（[how-it-works](https://docs.stripe.com/payments/managed-payments/how-it-works)）。
- 制限：Checkout と Payment Links だけで使える。埋め込み型の決済画面、Connect、他社の税計算、独自ドメインの決済画面は使えない（[managed-payments](https://docs.stripe.com/payments/managed-payments)、[how-it-works](https://docs.stripe.com/payments/managed-payments/how-it-works)）。
- 利用開始の状況：2026-01-28 時点では順番待ちで、招待なしの公開登録は「まもなく」とされていた（[Lemon Squeezy 2026 update](https://www.lemonsqueezy.com/blog/2026-update)）。現在のドキュメントには「プレビュー」の表記がない。**今すぐダッシュボードで有効にできるかは未確認**。

### 3.3 Lemon Squeezy
- 手数料：5% + 50¢。米国外の注文 +1.5%、PayPal +1.5%、サブスクの支払い +0.5%。入金は Stripe 経由で米国外の銀行なら 1%／回、PayPal の米国外アカウントなら 3%（上限 $30）（[fees](https://docs.lemonsqueezy.com/help/getting-started/fees)、[pricing](https://www.lemonsqueezy.com/pricing)）。
- MoR：販売者名義は「Sold through Link, LLC f/k/a Lemon Squeezy LLC」（[pricing](https://www.lemonsqueezy.com/pricing)）。日本は銀行振込で入金できる国に含まれる（[supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)）。
- 現状：Stripe に買収された後、Stripe の MoR 製品へ統合中。運営自身が「サポートが遅くなり、製品の更新も減った」と認めており、利用者を Stripe Managed Payments へ移す方針（2026-01-28 [blog](https://www.lemonsqueezy.com/blog/2026-update)）。公式 SDK は2024-11の 4.0.0 以降更新がないとの報告もある（二次情報：[issoh](https://www.issoh.co.jp/tech/details/18599/)）。
- ライセンス API：activate・validate・deactivate の3つで、毎分60回まで。サブスク終了時は `expired` になる（[license-api](https://docs.lemonsqueezy.com/help/licensing/license-api)）。拡張から秘密鍵なしで直接呼べるかは**未確認**（例示の curl には認証ヘッダーがない：[validate](https://docs.lemonsqueezy.com/api/license-api/validate-license-key)）。
- 判定：移行中の製品を新しく採用する理由がないため不採用。

### 3.4 Paddle（次点）
- 手数料：5% + 50¢。MoR、税務、サブスク管理を含む。月額料金なし（[pricing](https://www.paddle.com/pricing)）。
- 入金：毎月1日に残高が設定額（最低 $100）を超えていれば入金にし、15日までに送金する。Paddle 以外の手数料は銀行側が取る。通貨が違う送金は $15 で、ヘルプページ間で条件の書き方に差がある（[when and how do i get paid](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)、[payout fees](https://paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts)）。円での受け取りの可否は**未確認**。
- 登録：日本は対応外の国に入っていない（[supported countries](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)）。審査はドメイン審査・事業者確認（個人と個人事業主は不要）・本人確認の3段階。販売サイトと利用規約に個人事業主の名前か屋号を載せることが求められる（[account verification](https://paddle.com/support/what-is-account-verification/)、[domain approval](https://www.paddle.com/help/start/account-verification/what-is-domain-approval)）。拡張そのものを明示的に許可・禁止する記述はない。禁止品目はシステム最適化系（クリーナー・ウイルス対策）や VPN など（[not allowed](https://www.paddle.com/help/start/account-verification/what-am-i-not-allowed-to-sell-on-paddle)）。
- サブスク：Paddle 提供の顧客ポータルが標準で有効。解約時に引き止めの流れが出る。支払いに失敗すると30日間に最大7回自動で再試行し、その後に解約する。解約したサブスクは再開できず、作り直しになる（[customer portal](https://developer.paddle.com/concepts/customer-portal)、[changelog](https://developer.paddle.com/changelog/2025/default-dunning-payment-recovery)）。Webhook は届く順番が保証されない（同上）。
- ライセンスキー：Paddle Billing には標準のライセンスキー機能がない（ドキュメントで見つからなかった。**未確認**）。Webhook を受けるサーバーが必要。

### 3.5 Polar.sh
- 手数料：Starter は月額なしで 5% + 50¢。米国外のカード +1.5%。サブスク +0.5% は旧料金の会員だけ。入金は Stripe の手数料がそのまま（$2／月、0.25% + $0.25／回、通貨換算 0.25〜1%）。チャージバックは1件 $15（[fees](https://polar.sh/docs/merchant-of-record/fees)）。
- 入金先：日本は Stripe Connect Express で入金できる国に含まれる。個人で使えるかは Stripe Connect Express が日本で「個人」の事業形態に対応しているか次第（[supported countries](https://polar.sh/docs/merchant-of-record/supported-countries)）。**未確認**。
- ライセンスキー：`/v1/customer-portal/license-keys/` の validate と activate は、例示では認証ヘッダーなしで `key` と `organization_id` だけを送る。サブスクのキーはサブスクが有効な間だけ使え、終了すると無効になる（[license-keys](https://polar.sh/docs/features/benefits/license-keys)）。拡張だけで確認できる見込みが高いが、本番での確認は**未確認**。
- 顧客ポータル：購入時のメールにワンタイムコードを送ってログインし、解約・カード変更・請求書の確認ができる（[customer-portal](https://polar.sh/docs/features/customer-portal)）。無料体験は日・週・月・年の単位で設定できる（[trials](https://polar.sh/docs/features/trials)）。
- 判定：サーバーなしで作れるのが利点。ただし低単価では固定額と入金手数料が重い。

### 3.6 Gumroad
- 手数料：直接販売は 10% + 50¢。Discover 経由は 30%。2025-01-01 から世界の売上税を Gumroad が徴収・納付する（[pricing](https://gumroad.com/pricing)）。
- 入金：日本の銀行入金の可否と手数料は**未確認**。PayPal は日本では入金先に使えないとの記載がある（二次情報：[mintlify mirror](https://www.mintlify.com/antiwork/gumroad/payments/paypal)）。
- 判定：手数料が最も高いため不採用。

### 3.7 ExtensionPay
- 手数料：5%。月額・初期費用なし。決済は自分の Stripe アカウントで行い、Stripe の手数料が別にかかる（[extensionpay.com](https://extensionpay.com/)）。
- 税：**MoR ではない**。売上の税は自分の責任で、Stripe Tax を有効にすると決済時に計算できる（同上）。
- 拡張への組み込み：`ExtPay.js` の `getUser()` で `paid`・`subscriptionStatus`（active・past_due・canceled）・`trialStartedAt` などが取れる。`openPaymentPage()` は購入済みの人には管理・解約の画面になる。`openLoginPage()` は別の PC での復元用のメールリンク。`storage` 権限が必要で、`onPaid` を使うには `https://extensionpay.com/*` 向けのコンテンツスクリプトが要る（権限の警告が増える）（[README](https://raw.githubusercontent.com/Glench/ExtPay/main/README.md)）。
- 日本：日本の Stripe アカウントで使えるかは公式に記載がなく**未確認**。
- 判定：サーバーなしで最も簡単に作れるが、非 MoR のため世界の税務を自分で抱える。このため不採用。

---

## 4. Chrome ウェブストアの規約（有料機能）

[Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)「Accepting Payment From Users」ほか。
- 基本機能に支払いが必要なら、説明文にそのことを明記する。今回は基本機能が無料で Pro だけ有料。それでも誤解を避けるため、説明文に「一部機能（Google ドライブ自動保存・PC 間同期）は有料の Pro」と書く。
- 利用者を誤解させない。販売する内容と、返金・返品の条件を明示する。
- 販売者は Google ではなく自分であることを明確にする。
- カード情報などは安全に扱う。決済画面を外部（Stripe など）に任せれば、拡張はカード情報に触れない。
- 説明文・タイトル・スクリーンショットで誤解させない。掲載情報を最新で正確に保つ（価格や有料範囲を変えたら説明文も直す）。

---

## 5. 特定商取引法との関係

- 通信販売の表示事項は、販売価格、支払時期と方法、提供時期、申込みの撤回・解除（返品特約）、事業者の氏名・住所・電話番号、ソフトウェアの動作環境、2回以上の継続契約が必要な場合の条件など（[特定商取引法ガイド 通信販売](https://www.no-trouble.caa.go.jp/what/mailorder/)）。
- **個人情報を出したくない点への対応**：「請求があれば書面または電子メールで遅滞なく提供する」と表示し、実際に遅滞なく出せる体制があれば、事業者の氏名・住所・電話番号は広告から省略できる。一方、返品特約、ソフトウェアの動作環境、継続契約の条件などは省略できない。返品特約は申込みの最終確認画面にも表示が必要（同上）。
- **MoR を使っても日本の顧客に対しては自分が表示義務を負う前提で準備する**。理由は次の3つ。
  1. Stripe Managed Payments では、日本の事業者による日本国内の販売は MoR の税務対象外で、その取引の請求書は自分の事業者名で発行される（[tax-compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)）。
  2. Stripe の日本アカウントの審査には特商法表記のページが必要（[Getting started in Japan](https://support.stripe.com/questions/getting-started-in-japan)）。
  3. Chrome ウェブストアも販売者を自分と明示するよう求めている。
  - 海外の顧客に対して「販売者が MoR（Link, LLC・Paddle）に変わるので特商法の表示は不要になるか」は、公式情報が見つからず**未確認**。弁護士に確認する。
- 定期購入の最終確認画面（令和3年改正）：Checkout は Stripe の画面のため、価格・更新周期・解約方法・無料体験後の自動課金を、Checkout に進む前の自前ページ（拡張の設定画面または販売ページ）にも表示する。Stripe の Checkout 側にどこまで載せられるかは**未確認**。
- バーチャルオフィスの住所を特商法表記に使ってよいか（連絡が確実につくことなど）は**未確認**。
- Stripe の日本アカウントは個人名で登録する（屋号は使えない）。Stripe の内部の登録名は個人名になる。購入者に表示される名前（明細表記・事業者名）をどこまで屋号にできるかは**未確認**。

---

## 6. 本人に確認したいこと

1. **消費税**：課税事業者か免税事業者か、インボイス登録の有無。Stripe Managed Payments では、日本の顧客の消費税は自分の申告になる。免税事業者なら日本の顧客への請求に消費税を上乗せしない設定にするか。
   - **2026-10-29 回答**：適格請求書発行事業者として登録済み（登録番号 T8810336045594、形式とチェック用の数字を確認）。したがって課税事業者。日本の顧客への販売は消費税10%込みの価格で売り、Stripe の領収書・請求書に登録番号を表示できるよう設定する。海外売上の申告区分（次の項目）は引き続き税理士に確認。
2. **海外の売上の消費税上の扱い**：MoR（Link, LLC、Paddle）を通した海外の売上を、国外取引・輸出免税・課税売上のどれとして申告するか。プラットフォーム課税（令和7年4月〜）は国外事業者向けの制度で、国内事業者の取引は対象外とされる（[国税庁 タックスアンサー6568](https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6568.htm)）。それ以外の扱いは**未確認**。税理士に確認する。
3. **特商法表記**：氏名・住所・電話番号を省略し「請求時に開示」にするか。バーチャルオフィスの住所と専用の電話番号を出すか。
4. **価格と通貨**：月額・年額・無料体験の日数。円で決めて Stripe の自動換算（Adaptive Pricing）に任せるか、ドル建てにするか。
5. **返金方針**：Stripe Managed Payments は60日以内なら Stripe の判断で返金することがある。自前の返金条件（例：初回14日以内は全額）をどう定めるか。
6. **サーバーを持つことの可否**：購入状態の確認用に Cloudflare Workers などの小さなサーバーを持ってよいか（費用はほぼ無料枠の見込み。無料枠の条件は未確認）。持たない方針なら次点を Polar.sh に変える。
7. **Stripe アカウント**：既存の Stripe アカウントの有無。Managed Payments を今すぐ有効にできるかをダッシュボードで確認してほしい（順番待ちかどうか）。

---

## 7. 次の段階の提案（Stripe Managed Payments を選んだ場合）

### PAY-02 購入状態の管理サーバー（最小構成）
- 実行環境は Cloudflare Workers と Workers KV（または D1）を想定。秘密鍵は Worker の環境変数に置き、拡張には入れない。
- エンドポイント：
  1. `POST /checkout`：拡張から呼ぶ。購入者の識別子（下記）を `client_reference_id` と `metadata` に入れて、Managed Payments を有効にした Checkout Session（`mode=subscription`、税コード付きの商品）を作り、URL を返す。
  2. `POST /webhook`：Stripe の署名を検証する。`checkout.session.completed`、`customer.subscription.created/updated/deleted`、`invoice.payment_failed` を受けて、`{識別子 → 状態, 期限 current_period_end, customer_id}` を保存する。届く順番の入れ替わりに備え、イベントの時刻で上書きを判定する。
  3. `GET /entitlement`：拡張から呼ぶ。状態と期限を返す。
  4. `POST /portal`：カスタマーポータルのセッション URL を返す（解約・カード変更用。Link のサイトでも解約できる）。
- 購入者の識別子：拡張は既に `chrome.identity` で Google 認証を使っている（[DRIVE-01-OAUTH.md](DRIVE-01-OAUTH.md)）。Google のトークンを Worker で検証して、メールアドレスまたは Google の利用者 ID を識別子にする。これで PC を替えても同じ Google アカウントで Pro が復元でき、SYNC-01 とも相性がよい。

### PAY-03 拡張側の組み込み
- 設定画面に「Pro にする」ボタンを置く（`/checkout` → 新しいタブで Checkout を開く）。「購入を管理」ボタンも置く（`/portal`）。
- Service Worker が起動時と1日1回 `/entitlement` を確認する。結果は `chrome.storage.local` に期限付きで保存する。オフラインのときは期限までの猶予を設ける（例：最後に確認した `current_period_end` から7日）。
- Pro の判定は AUTO-01 の「開発版のみ有効」の条件を置き換える形で入れる。Pro でなくなっても、手動保存・復元・書き出しなどの無料機能とデータは取り上げない（MONETIZATION-PLAN の方針どおり）。
- `host_permissions` に Worker のドメインを追加する。権限の警告が増えるかを確認する。

### PAY-04 公開の準備（法務・掲載）
- 特商法表記のページ（販売ページとともに公開。Stripe の審査にも使う）、利用規約、返金方針、プライバシーポリシーの更新（購入情報とメールアドレスを扱うため）。
- Chrome ウェブストアの説明文（10言語）に、Pro が有料であること・価格・販売者が KWS であることを追記する。
- テストモードで、購入・更新・支払い失敗・解約・返金・別の PC での復元を一通り確認してから、本番の鍵に切り替える。

### 次点（Paddle）に切り替える場合の差分
- `/checkout` は Paddle.js のオーバーレイか Paddle の決済リンクに変え、`/webhook` は Paddle の署名検証と `subscription.*` イベントに変える。`/entitlement` と拡張側はそのまま流用できる設計にしておく。
- 審査に販売サイト（ドメイン）が必要なため、PAY-04 の販売ページを先に用意する。
