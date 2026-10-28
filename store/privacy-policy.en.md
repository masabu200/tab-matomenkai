# Tab Matomen Kai Privacy Policy (draft)

Last updated: 2026-10-28.

## Operator
- Name: KWS
- Address: Nishi-Shinjuku Mizuma Bldg. 2F, 3-3-13 Nishi-Shinjuku, Shinjuku-ku, Tokyo 160-0023, Japan
- Contact: info@kw-s.jp

## Information we store
Tab Matomen Kai (the "extension") stores the following only in your browser's local storage (`chrome.storage.local`):
- Spaces, categories and tabs you save (titles, URLs, favicon URLs, tab group names and colors, order)
- Settings (view mode, language, auto-backup interval, auto-save on switch, etc.)
- Minimal usage records (the list of dates you used the dashboard, used to decide when to ask for a review; how many times the request was shown; whether you opted out; each space's last-used time for automatic tidying)
- Spaces removed by automatic tidying (kept in a trash for 30 days, then deleted)

This data is used only to make the extension work. It is not sent to the operator or any third-party server. There is no analytics or advertising measurement.

## Data sent to external services
Only the following features send data, and only when you explicitly trigger them.
- **Backup to Google Drive**: when you press "Connect to Google Drive" and "Back up now", your saved data (spaces, categories, tabs) is written as a JSON file to your own Google Drive. The extension requests the `drive.file` scope only (files the extension itself created). Chrome manages the authentication token; the extension never sends it anywhere. You can disconnect at any time in Settings.
- **Local AI integration (optional, advanced)**: only if you enter a connection key and connect, space titles, URLs and group information are sent to an integration server running on your own computer (`127.0.0.1`). Page contents are never sent. Nothing is sent to servers on the internet.
- **Review request**: "Write a review" only opens the Chrome Web Store page; no data is sent.

## Browser permissions
- `tabs` / `tabGroups`: save and restore open tabs and tab groups.
- `storage` / `unlimitedStorage`: keep the data above locally.
- `alarms`: scheduled automatic backups (local JSON export).
- `downloads`: save JSON backups to your Downloads folder.
- `contextMenus`: save from the right-click menu.
- `identity`: authorize the Google Drive connection.
- Content script on all sites: only detects the configured mouse button to return to the dashboard. It does not read or store page content.

## Deleting your data
- Uninstalling the extension deletes all locally stored data.
- Delete backup files in your Google Drive yourself.
- You can revoke the extension's access to your Google account at any time under Google Account > Security > Third-party apps.

## Changes
If this policy changes, this page and the Chrome Web Store listing will be updated.
