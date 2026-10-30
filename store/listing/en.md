# Chrome Web Store listing (English)

Target version: 1.5.0 (submission).

## Name (max 45 characters)
Tab Matomen Kai – Tab Manager & Session Saver (from appStoreName in the manifest; shipped in 1.5.0)

## Summary (max 132 characters) — not editable in the dashboard; it comes from the manifest description (appDescription in `_locales/en/messages.json`) and is included in 1.4.0.
Save and switch whole tab sets per project. Pinned tabs, bulk actions, right-click save and Google Drive backup end tab overload.

## Detailed description (paste into the dashboard "Description" field)
Too many tabs, and you no longer know which belongs to what? Keeping tabs open overnight so you can pick up tomorrow?
Tab Matomen Kai ends tab overload.
Your saved tabs are backed up to your own Google Drive automatically (Pro, one-time ¥300). If your laptop dies, restore everything on the new one.

Save the tabs of each project or task as a "space", then switch the whole set with one click inside the same Chrome window. Only the tabs for the project at hand are open, and your head stays clear too.

■ Made for
• People juggling several client projects in web design, development or marketing
• Anyone whose research, work and chat tabs keep getting mixed up
• Anyone afraid to close the browser and lose their tabs

■ How to use
1. Click the toolbar icon to open the dashboard
2. Click "+ Space" and enter a project name
3. With the tabs you want to keep open, click "Save current tabs"
4. Click a space name on the left, and all of that project's tabs open at once

■ Features
[Spaces] Save a full set of tabs per project and switch with one click. Optionally auto-save the current tabs when you switch. Give each space its own color and icon.
[Categories] Organize spaces up to three levels deep, reorder by dragging and tell them apart by color. Open favorites and recent spaces instantly.
[Tab groups] Chrome tab groups are saved and restored with their names and colors.
[Pinned tabs] Pin the tabs you always need, like email or chat. They stay open when you switch spaces and are never saved into a space.
[Bulk actions] Select tabs to open, move to another space, group, archive or delete in one go. Select all and Shift-click ranges.
[Undo] Take back a delete or archive right after it happens with Ctrl/⌘+Z.
[Right-click save] Save the page or link you are looking at into any space from the context menu. No trip back to the dashboard.
[Share spaces] Export only the spaces you choose as a file or a share code; the recipient adds them to their own data. Great for project handovers and sharing with your team. You can strip everything after "?" in URLs before sharing.
[Copy URL lists] Markdown, title + URL, or URLs only, straight to the clipboard for reports and notes.
[Search & shortcuts] Filter tabs by title or URL. Ctrl/⌘+K to search spaces, / to filter tabs, Ctrl/⌘+S to save. Press your mouse's Forward button to jump back to the dashboard.
[Backup] Timestamped backups to a dedicated Google Drive folder. Choose how many to keep and restore any of them from a list (your current data is set aside first, and you can undo). JSON export/import and scheduled automatic backups (hourly, every 6 hours or daily) are included too.
[Auto-tidy unused spaces] Spaces unused for 30–365 days are archived or deleted automatically (deleted spaces stay in a 30-day trash). Favorites and the space you are on are never touched.
[Look & language] List and card views, dark mode, and 10 languages: English, Japanese, Simplified and Traditional Chinese, Korean, Spanish, Portuguese, German, French and Italian. Switch anytime in Settings.

■ Your data
Everything you save stays in your own Chrome (chrome.storage.local). Nothing you browse is sent anywhere.
Google Drive backup writes to your own Drive only when you connect and save, and the extension can access only the files it created.

■ Pro edition
Most features are free. The Pro edition (one-time purchase, ¥300) adds automatic backup to Google Drive. Buy it under Settings → Pro edition; there is no recurring charge. To check your purchase, only a random purchase ID created for your installation is sent to our purchase record server (no name, email or browsing data). Payment is handled by Stripe, with Link shown as the seller.
Terms of use, commercial disclosure and privacy policy are linked from Settings → Pro edition.

## Permission justifications (dashboard "Privacy practices")
- tabs / tabGroups: read the open tabs and tab groups to save and restore them as spaces.
- storage / unlimitedStorage: keep spaces and settings locally.
- alarms: scheduled automatic backups and automatic tidying of unused spaces.
- downloads: write JSON backups to the Downloads folder.
- contextMenus: the "Save to Tab Matomen Kai" right-click menu.
- identity: authorize saving backups to Google Drive (drive.file scope only).
- Host permission googleapis.com: save, list and restore backups through the Google Drive API. 127.0.0.1: talk to the optional local AI integration server on the user's own PC.
- Content script (all sites): only detects the configured mouse button to return to the dashboard. It does not read page content.
