# Chrome Web Store listing (English)

Target version: 1.3.0 (live). "Share spaces" ships in 1.4.0, so it is kept under "Add in the next release" below.

## Name (max 45 characters)
Tab Matomen Kai – Tab Spaces

## Summary (max 132 characters) — not editable in the dashboard; it comes from the manifest description (appDescription in `_locales/en/messages.json`) and changes with the next package.
Save and switch whole tab sets per project. Pinned tabs, bulk actions, right-click save and Google Drive backup end tab overload.

## Detailed description (paste into the dashboard "Description" field)
Too many tabs, and you no longer know which belongs to what? Keeping tabs open overnight so you can pick up tomorrow?
Tab Matomen Kai ends tab overload.

Save the tabs of each project or task as a "space", then switch the whole set with one click inside the same Chrome window. Only the tabs for the project at hand are open, and your head stays clear too.

■ Made for
• People juggling several client projects in web design, development or marketing
• Anyone whose research, work and chat tabs keep getting mixed up
• Anyone afraid to close the browser and lose their tabs

■ Features
[Spaces] Save a full set of tabs per project and switch with one click. Optionally auto-save the current tabs when you switch.
[Categories] Organize spaces in a hierarchy, reorder by dragging and tell them apart by color. Open favorites and recent spaces instantly.
[Tab groups] Chrome tab groups are saved and restored with their names and colors.
[Pinned tabs] Pin the tabs you always need, like email or chat. They stay open when you switch spaces and are never saved into a space.
[Bulk actions] Select tabs to open, move to another space, group, archive or delete in one go. Select all and Shift-click ranges.
[Undo] Take back a delete or archive right after it happens with Ctrl/⌘+Z.
[Right-click save] Save the page or link you are looking at into any space from the context menu. No trip back to the dashboard.
[Copy URL lists] Markdown, title + URL, or URLs only, straight to the clipboard for reports and notes.
[Search & shortcuts] Ctrl/⌘+K to search spaces, / to filter tabs, Ctrl/⌘+S to save.
[Backup] Timestamped backups to a dedicated Google Drive folder. Choose how many to keep and restore any of them from a list (your current data is set aside first, and you can undo). JSON export/import and scheduled automatic backups are included too.
[Auto-tidy unused spaces] Spaces unused for 30–365 days are archived or deleted automatically (deleted spaces stay in a 30-day trash). Favorites and the space you are on are never touched.
[Look & language] List and card views, dark mode, and 10 languages: English, Japanese, Simplified and Traditional Chinese, Korean, Spanish, Portuguese, German, French and Italian. Switch anytime in Settings.

■ Your data
Everything you save stays in your own Chrome. Nothing you browse is sent anywhere.
Google Drive backup writes to your own Drive only when you connect and save, and the extension can access only the files it created.

■ Contact
KWS — info@kw-s.jp

## Add in the next release (insert after [Right-click save] when 1.4.0 is live)
[Share spaces] Export only the spaces you choose as a file or a share code; the recipient adds them to their own data. Great for project handovers and sharing with your team. You can strip everything after "?" in URLs before sharing.

## Permission justifications (dashboard "Privacy practices")
- tabs / tabGroups: read the open tabs and tab groups to save and restore them as spaces.
- storage / unlimitedStorage: keep spaces and settings locally.
- alarms: scheduled automatic backups and automatic tidying of unused spaces.
- downloads: write JSON backups to the Downloads folder.
- contextMenus: the "Save to Tab Matomen Kai" right-click menu.
- identity: authorize saving backups to Google Drive (drive.file scope only).
- Host permission googleapis.com: save, list and restore backups through the Google Drive API. 127.0.0.1: talk to the optional local AI integration server on the user's own PC.
- Content script (all sites): only detects the configured mouse button to return to the dashboard. It does not read page content.
