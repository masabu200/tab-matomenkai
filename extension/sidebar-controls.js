'use strict';
(() => {
  const sidebar = document.querySelector('.sidebar');
  const controls = document.createElement('div');
  controls.className = 'sidebar-controls';
  const button = document.createElement('button');
  button.id = 'toggleSidebar';
  button.type = 'button';
  button.className = 'sidebar-toggle';
  button.textContent = t('m_74f34a1534');
  button.setAttribute('aria-label', t('m_0b845075d6'));
  button.title = t('m_0b845075d6');
  sidebar.id = 'dashboardSidebar';button.setAttribute('aria-controls',sidebar.id);button.setAttribute('aria-expanded','true');
  controls.append(button);
  // Settings and collapse sit at the bottom of the rail.
  sidebar.append(controls);
  button.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    button.textContent = collapsed ? '›' : t('m_74f34a1534');
    button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',collapsed ? t('m_91323fe947') : t('m_0b845075d6'));
    button.title = button.getAttribute('aria-label');
    button.focus();
  });
})();
