'use strict';
(() => {
  const sidebar = document.querySelector('.sidebar');
  const panel = document.body.classList.contains('sidebar-panel');
  const controls = document.createElement('div');
  controls.className = 'sidebar-controls';
  const button = document.createElement('button');
  button.id = 'toggleSidebar';
  button.type = 'button';
  button.className = 'sidebar-toggle';
  button.textContent = panel ? '‹ 閉じる' : '‹ 折りたたむ';
  button.setAttribute('aria-label', panel ? 'サイドバーを閉じる' : 'サイドバーを折りたたむ');
  button.title = panel ? '閉じる（ツールバーの拡張アイコンで再表示）' : 'サイドバーを折りたたむ';
  if (!panel) { sidebar.id = 'dashboardSidebar';button.setAttribute('aria-controls',sidebar.id);button.setAttribute('aria-expanded','true'); }
  controls.append(button);
  const launcher = sidebar.querySelector('.sidebar-launcher');
  if (launcher) controls.append(launcher);
  const header = sidebar.querySelector('.sidebar__header');
  sidebar.insertBefore(controls, header.nextSibling);
  button.addEventListener('click', async () => {
    if (panel) {
      if (g_dashboardWindowId === null) return;
      try { await chrome.sidePanel.close({windowId:g_dashboardWindowId}); }
      catch { showMessage('閉じられませんでした。もう一度お試しください。','error'); }
      return;
    }
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    button.textContent = collapsed ? '›' : '‹ 折りたたむ';
    button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',collapsed ? 'サイドバーを展開する' : 'サイドバーを折りたたむ');
    button.title = button.getAttribute('aria-label');
    button.focus();
  });
})();
