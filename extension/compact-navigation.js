'use strict';
// Keep everyday navigation visible; occasional actions live in Settings.
(() => {
  const dialog=document.getElementById('settingsDialog');
  const heading=document.createElement('h3');heading.textContent=t('m_53884810b9');heading.className='settings-actions-title';
  const actions=document.createElement('div');actions.className='settings-workspace-actions';
  const tools=document.querySelector('.workspace-tools');
  for(const item of tools.querySelectorAll(':scope > button'))actions.append(item);
  const card=document.createElement('section');card.className='settings-workspace-card';card.append(heading,actions);dialog.append(card);
  // 保存状態（変更あり/保存済み）は設定に隠さず常に見える場所に置く:
  // メインヘッダーの保存ボタン横に置く。
  const status=document.getElementById('workspaceSaveStatus');
  status.setAttribute('aria-live','polite');
  const mainControls=document.getElementById('mainControls');
  if(mainControls){
    status.classList.add('main__save-status');
    const save=document.getElementById('btnSaveTabs');
    if(save)mainControls.insertBefore(status,save);else mainControls.append(status);
  }
  document.body.classList.add('compact-navigation');
})();
