'use strict';
// Keep everyday navigation visible; occasional actions live in Settings.
(() => {
  const dialog=document.getElementById('settingsDialog');
  const heading=document.createElement('h3');heading.textContent='スペースの操作';heading.className='settings-actions-title';
  const actions=document.createElement('div');actions.className='settings-workspace-actions';
  const tools=document.querySelector('.workspace-tools');
  for(const item of [...tools.querySelectorAll(':scope > button'),document.getElementById('workspaceSaveStatus')])if(item)actions.append(item);
  dialog.append(heading,actions);
  const launcher=document.querySelector('.sidebar-launcher');if(launcher)dialog.append(launcher);
  const status=document.getElementById('workspaceSaveStatus');
  status.setAttribute('aria-live','polite');
  document.body.classList.add('compact-navigation');
})();
