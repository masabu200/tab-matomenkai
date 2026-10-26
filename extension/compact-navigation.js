'use strict';
// Keep everyday navigation visible; occasional actions live in Settings.
(() => {
  const dialog=document.getElementById('settingsDialog');
  const heading=document.createElement('h3');heading.textContent='スペースの操作';heading.className='settings-actions-title';
  const actions=document.createElement('div');actions.className='settings-workspace-actions';
  const tools=document.querySelector('.workspace-tools');
  for(const item of tools.querySelectorAll(':scope > button'))actions.append(item);
  dialog.append(heading,actions);
  // 「左バーをサイドパネルで開く」はページ閲覧中の表示への入口なので、設定に隠さず左バー上部に残す。
  // 保存状態（変更あり/保存済み）は設定に隠さず常に見える場所に置く:
  // ダッシュボードはメインヘッダーの保存ボタン横、サイドパネルは検索欄の下にそのまま残す。
  const status=document.getElementById('workspaceSaveStatus');
  status.setAttribute('aria-live','polite');
  const mainControls=document.getElementById('mainControls');
  if(mainControls&&!location.pathname.endsWith('sidepanel.html')){
    status.classList.add('main__save-status');
    const save=document.getElementById('btnSaveTabs');
    if(save)mainControls.insertBefore(status,save);else mainControls.append(status);
  }
  document.body.classList.add('compact-navigation');
})();
