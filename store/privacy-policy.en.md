# Tab Matomen Kai Privacy Policy

Effective: October 28, 2026 (last updated: October 29, 2026)

KWS ("we") provides the Chrome extension Tab Matomen Kai (the "extension") and its paid edition (the "Pro edition"). This policy explains what information is handled and how. The Japanese version prevails where the two differ.

## 1. Operator
- Name: KWS (responsible person: 麦倉 優聡 (Mugikura))
- Address: Nishi-Shinjuku Mizuma Bldg. 2F, 3-3-13 Nishi-Shinjuku, Shinjuku-ku, Tokyo 160-0023, Japan
- Contact: info@kw-s.jp (10:00–18:00 JST, weekdays)

## 2. Information kept only in your browser
The extension stores the following only inside your Chrome (`chrome.storage.local`). It is not sent to us or any third-party server.
- Spaces, categories and tabs you save (titles, URLs, favicon URLs, tab group names and colors, order)
- Settings (view mode, language, theme, auto-backup interval, auto-save on switch, etc.)
- Minimal usage records (the dates you used the dashboard and how often the review request was shown, used to time that request; each space's last-used time for automatic tidying)
- Spaces removed by automatic tidying (kept in a trash for 30 days, then deleted)

There is no analytics or advertising measurement.

## 3. Information sent outside your browser

### Backup to Google Drive
- After you press "Connect Google Drive" and allow access, the extension writes your saved data (spaces, categories, tabs) as a JSON file to **your own Google Drive** when you press "Back up now", and — if you turn on the Pro edition's automatic backup — at the interval you choose.
- The only permission requested is `drive.file` (access to files the extension itself created). Other files are never read.
- Sign-in is handled by Chrome and Google; we never receive it. You can disconnect at any time in the settings.

### Buying the Pro edition and checking the purchase
- To check whether the Pro edition has been bought, the extension sends a random string created for each installation (the "purchase ID", 64 hexadecimal characters) to our purchase record server, which runs on Cloudflare Workers (Cloudflare, Inc.). Your name, email address, browsing history and saved tabs are not sent.
- The purchase ID is kept in Chrome's sync storage (`chrome.storage.sync`), so it is shared between your Chrome browsers signed in with the same Google account.
- Checkout and payment take place on pages of Stripe, Inc. and its affiliate Link, LLC, which acts as the seller (the "payment providers"). Your email address and card details go directly to the payment providers and are handled under their privacy policies. **We never receive your card number.**
- The purchase record server keeps, linked to the purchase ID, the payment provider's customer ID, payment ID, the purchase status (purchased or refunded) and its date. In the payment provider's dashboard we can see the buyer's name, email address, country and transaction records.

### Local AI connection (optional, for advanced users)
- Only after you enter a connection key and connect, the extension sends space titles, URLs and group information to a helper running on your own computer (`127.0.0.1`). Page contents are not sent, and nothing is sent to servers on the internet.

### Review request and feedback
- "Write a review" only opens the Chrome Web Store page. "Send feedback" only opens your email app; you decide whether to send anything.

## 4. Purposes
Information we receive (from the purchase record server, from the payment providers, and in your messages) is used only to:
- provide the Pro edition, check purchases, and handle refunds;
- answer questions and provide support;
- keep the accounting records required by law and deal with misuse.

## 5. Sharing
We do not share personal information with third parties without your consent, except where required by law. The payment providers (Stripe, Inc. and Link, LLC) and the server provider (Cloudflare, Inc.) receive information only as needed to provide their services. They may be located outside Japan (mainly in the United States) and handle information under their own policies and the laws of those countries.

## 6. Security
Traffic to the purchase record server is encrypted (HTTPS). Notifications from the payment providers are accepted only after their signature is verified, and the keys used to manage the service are stored where only we can access them.

## 7. Retention and deletion
- Uninstalling the extension deletes all data stored in your browser.
- Delete backup files in your own Google Drive. You can revoke the extension's access to your Google account at any time under Google Account → Security → Third-party apps & services.
- Purchase records and payment records are kept for as long as the law requires (for example, for accounting). To ask for other deletion, contact us with your purchase ID (shown under Settings → Pro edition → Purchase ID).

## 8. Requests about your information
If you ask us to disclose, correct or stop using personal information we hold about you, we will respond as required by law after confirming your identity. Please use the contact below.

## 9. Changes
When this policy changes, we update this page and the Chrome Web Store listing and change the date above. Important changes are also announced in the extension.

## 10. Contact
KWS (responsible person: 麦倉 優聡 (Mugikura))
Nishi-Shinjuku Mizuma Bldg. 2F, 3-3-13 Nishi-Shinjuku, Shinjuku-ku, Tokyo 160-0023, Japan
info@kw-s.jp (10:00–18:00 JST, weekdays)
