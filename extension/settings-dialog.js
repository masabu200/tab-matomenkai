'use strict';
(() => {
  const trigger=document.createElement('button');trigger.id='openSettings';trigger.type='button';trigger.className='sidebar-settings';
  trigger.innerHTML=`<span aria-hidden="true">⚙</span><span class="settings-label">${t('m_6329f21c41')}</span>`;
  trigger.title=t('m_e438ffd26f');trigger.setAttribute('aria-label',t('m_56b6cd2c1a'));trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','settingsDialog');
  const controls=document.querySelector('.sidebar-controls');controls.insertBefore(trigger,controls.querySelector('.sidebar-launcher'));
  const dialog=document.createElement('dialog');dialog.id='settingsDialog';dialog.className='settings-dialog';dialog.setAttribute('aria-labelledby','settingsTitle');
  const header=document.createElement('div');header.className='settings-dialog-header';
  const heading=document.createElement('h2');heading.id='settingsTitle';heading.textContent=t('m_6329f21c41');
  const close=document.createElement('button');close.id='closeSettings';close.type='button';close.textContent=t('m_3da5c18551');close.className='btn btn--ghost';close.setAttribute('aria-label',t('m_00820b1780'));header.append(heading,close);
  const description=document.createElement('p');description.className='settings-description';description.textContent=t('m_bf10ec5ff4');
  const footer=document.querySelector('.sidebar__backup');
  const fileInput=document.getElementById('importFileInput');
  const notice=document.createElement('p');notice.id='settingsNotice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const language=document.createElement('section');language.className='language-settings';
  const languageTitle=document.createElement('h3');languageTitle.textContent=t('languageHeading');
  const languageSelect=document.createElement('select');languageSelect.id='languageSelect';languageSelect.setAttribute('aria-label',t('languageHeading'));
  const languageHelp=document.createElement('p');languageHelp.className='settings-help';languageHelp.textContent=t('languageHelp');
  language.append(languageTitle,languageSelect,languageHelp);
  dialog.append(header,description,language,footer,fileInput,notice);document.body.append(dialog);
  (async()=>{
    let browserCode='en';try{browserCode=I18n.normalize(chrome.i18n.getUILanguage())}catch{}
    const auto=new Option(t('languageAuto',[I18n.NAMES[browserCode]||browserCode]),'auto');languageSelect.append(auto);
    for(const code of I18n.SUPPORTED)languageSelect.append(new Option(I18n.NAMES[code],code));
    let stored='auto';try{stored=((await chrome.storage.local.get('pwm_settings')).pwm_settings||{}).language||'auto'}catch{}
    languageSelect.value=I18n.SUPPORTED.includes(stored)?stored:'auto';
    languageSelect.addEventListener('change',async()=>{languageSelect.disabled=true;try{await I18n.setLanguage(languageSelect.value);location.reload()}catch{languageSelect.disabled=false}});
  })();
  let previousFocus;
  trigger.addEventListener('click',()=>{if(dialog.open)return;previousFocus=document.activeElement;notice.textContent='';dialog.showModal();close.focus()});
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();dialog.close();return}
    if(event.key!=='Tab')return;
    const items=[...dialog.querySelectorAll('summary,button,input,select,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length&&!(el.tagName!=='SUMMARY'&&el.closest('details:not([open])')));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  dialog.addEventListener('close',()=>{if(previousFocus?.isConnected)previousFocus.focus()});
  const message=document.getElementById('message');new MutationObserver(()=>{if(dialog.open && message.textContent)notice.textContent=message.textContent}).observe(message,{subtree:true,childList:true,characterData:true});
})();
