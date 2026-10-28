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
  button.textContent = panel ? t('m_c32d6516f4') : t('m_74f34a1534');
  button.setAttribute('aria-label', panel ? t('m_0a57aeec9d') : t('m_0b845075d6'));
  button.title = panel ? t('m_2c2e1923ea') : t('m_0b845075d6');
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
      catch { showMessage(t('m_6264a3f76a'),'error'); }
      return;
    }
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    button.textContent = collapsed ? '›' : t('m_74f34a1534');
    button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',collapsed ? t('m_91323fe947') : t('m_0b845075d6'));
    button.title = button.getAttribute('aria-label');
    button.focus();
  });
})();
