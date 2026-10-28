# Chrome Web Store listing (English)

## Name (max 45 characters)
Tab Matomen Kai – Tab Spaces

## Summary (max 132 characters)
One "space" per project; switch whole tab sets in one window. Save, restore, bulk actions, undo, right-click save. 10 languages.

## Detailed description
Tab Matomen Kai saves your tabs as "spaces", one per project or task, and lets you switch the whole tab set inside the same Chrome window.

■ What you can do
- Spaces: save a set of tabs per project and switch with one click. Optionally auto-save the current tabs when you switch.
- Categories: organize spaces in a hierarchy. Drag to move, tell them apart by color and icon.
- Tab groups: Chrome tab groups are saved and restored as they are.
- Bulk actions: select tabs to open, move, group, archive or delete. Select all and Shift-click ranges.
- Undo: take back a delete or archive right after it happens (Ctrl/⌘+Z).
- Copy URL lists: Markdown, title + URL, or URLs only, straight to the clipboard.
- Right-click save: save the page or link under your cursor into any space from the context menu.
- Keyboard: Ctrl/⌘+S save, Ctrl/⌘+K search spaces, / filter tabs.
- Backup: JSON export/import, scheduled automatic backups, and manual backup to Google Drive.
- 10 languages: English, Japanese, Simplified Chinese, Traditional Chinese, Korean, Spanish, Portuguese (Brazil), German, French and Italian. Switch in Settings.

■ Your data
Everything is stored in your browser's local storage. Google Drive backup writes to your own Drive only when you press "Connect" and "Back up now". Nothing you browse is sent anywhere.

## Permission justifications (for the developer dashboard)
- tabs / tabGroups: read the open tabs and tab groups to save and restore them as spaces.
- storage / unlimitedStorage: keep spaces and settings locally.
- alarms: scheduled automatic backups.
- downloads: write JSON backups to the Downloads folder.
- contextMenus: the "Save to Tab Matomen Kai" right-click menu.
- identity: authorize saving backups to Google Drive (drive.file scope only).
- Host permission googleapis.com: upload to the Google Drive API. 127.0.0.1: talk to the optional local AI integration server on the user's own PC.
- Content script (all sites): only listens for the configured mouse button to return to the dashboard. It does not read page content.
