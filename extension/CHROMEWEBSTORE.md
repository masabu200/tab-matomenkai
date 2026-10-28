# 未公開開発候補：既存左バーのSide Panel表示

sidePanel権限: 既存のカテゴリ/スペース/バックアップ操作を、通常ページ閲覧中にもChrome Side Panelに表示するため。既存のtabs/storage等を使うスペース切替・保存は元の機能を再利用。新規host権限、データ送信、分析処理なし。

最低Chrome116: sidePanel.open対応要件。左右は利用者のChrome設定。上部タブバー非表示、全画面強制表示、再起動自動表示は対象外。

配布v1.2.1独立コピー基準。元Gitには未コミット差分があり正式Proソースとの同一性未確認。正式ソース統合、公開版番号/ID、追加権限通知、×/全画面の手動確認、公開承認は別途必要。提出・公開は未実施。

## 2026-10-28 追記：次回提出時に掲載文へ反映すること

- 権限追加：`contextMenus`（右クリック「タブまとめん改に保存」）、`identity`（Googleドライブへのバックアップ保存、`drive.file` のみ）。説明文は `store/listing/<言語>.md` の「権限の説明」を使う。
- 多言語：manifest の name/description は `__MSG_appName__` / `__MSG_appDescription__`（`_locales/` 10言語、既定 `en`）。ストアの各言語タブにも `store/listing/` の名前・概要・詳細を登録する。
- Drive の組み込み認証を有効にするには manifest に `key` と `oauth2` が必要（`planning/DRIVE-01-OAUTH.md`）。未設定のまま提出すると従来の手動方式で動く。
