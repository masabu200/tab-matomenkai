'use strict';
(() => {
  const trigger=document.createElement('button');trigger.id='openSettings';trigger.type='button';trigger.className='sidebar-settings';
  trigger.innerHTML='<span aria-hidden="true">⚙</span><span class="settings-label">設定</span>';
  trigger.title='設定（入出力・バックアップ・自動保存）';trigger.setAttribute('aria-label','設定を開く');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','settingsDialog');
  const controls=document.querySelector('.sidebar-controls');controls.insertBefore(trigger,controls.querySelector('.sidebar-launcher'));
  const dialog=document.createElement('dialog');dialog.id='settingsDialog';dialog.className='settings-dialog';dialog.setAttribute('aria-labelledby','settingsTitle');
  const header=document.createElement('div');header.className='settings-dialog-header';
  const heading=document.createElement('h2');heading.id='settingsTitle';heading.textContent='設定';
  const close=document.createElement('button');close.id='closeSettings';close.type='button';close.textContent='閉じる';close.className='btn btn--ghost';close.setAttribute('aria-label','設定を閉じる');header.append(heading,close);
  const description=document.createElement('p');description.className='settings-description';description.textContent='変更した設定はその場で保存されます。インポートすると現在の保存データが上書きされます。';
  const footer=document.querySelector('.sidebar__backup');
  const fileInput=document.getElementById('importFileInput');
  const notice=document.createElement('p');notice.id='settingsNotice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  dialog.append(header,description,footer,fileInput,notice);document.body.append(dialog);
  let previousFocus;
  trigger.addEventListener('click',()=>{if(dialog.open)return;previousFocus=document.activeElement;notice.textContent='';dialog.showModal();close.focus()});
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();dialog.close();return}
    if(event.key!=='Tab')return;
    const items=[...dialog.querySelectorAll('button,input,select,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  dialog.addEventListener('close',()=>{if(previousFocus?.isConnected)previousFocus.focus()});
  const message=document.getElementById('message');new MutationObserver(()=>{if(dialog.open && message.textContent)notice.textContent=message.textContent}).observe(message,{subtree:true,childList:true,characterData:true});
})();
