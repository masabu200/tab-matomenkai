'use strict';
(() => {
  const trigger=document.createElement('button');trigger.id='openSettings';trigger.type='button';trigger.className='sidebar-settings';
  trigger.innerHTML=`<span aria-hidden="true">⚙</span><span class="settings-label">${t('m_6329f21c41')}</span>`;
  trigger.title=t('m_e438ffd26f');trigger.setAttribute('aria-label',t('m_56b6cd2c1a'));trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','settingsDialog');
  const controls=document.querySelector('.sidebar-controls');controls.append(trigger);
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
  // Colour theme: one radio per palette with a small preview of rail / page / card / accent.
  const palette=document.createElement('section');palette.className='palette-settings';
  const paletteTitle=document.createElement('h3');paletteTitle.id='paletteHeading';paletteTitle.textContent=t('paletteHeading');
  const paletteOptions=document.createElement('div');paletteOptions.className='palette-options';paletteOptions.setAttribute('role','radiogroup');paletteOptions.setAttribute('aria-labelledby','paletteHeading');
  for(const item of ThemePalette.LIST){
    const option=document.createElement('label');option.className='palette-option';
    const radio=document.createElement('input');radio.type='radio';radio.name='palette';radio.value=item.id;radio.checked=item.id===ThemePalette.get();
    const [rail,bg,card,accent]=item.preview;
    const swatch=document.createElement('span');swatch.className='palette-swatch';swatch.setAttribute('aria-hidden','true');
    swatch.style.cssText=`--sw-rail:${rail};--sw-bg:${bg};--sw-card:${card};--sw-accent:${accent}`;
    swatch.innerHTML='<span class="palette-swatch__rail"></span><span class="palette-swatch__main"><span class="palette-swatch__card"></span><span class="palette-swatch__accent"></span></span>';
    const name=document.createElement('span');name.className='palette-option__name';name.textContent=t(item.label);
    option.append(radio,swatch,name);paletteOptions.append(option);
    radio.addEventListener('change',()=>{if(radio.checked)ThemePalette.set(item.id).catch(()=>{})});
  }
  document.addEventListener('pwm-palette-change',event=>{for(const radio of paletteOptions.querySelectorAll('input'))radio.checked=radio.value===event.detail});
  const paletteHelp=document.createElement('p');paletteHelp.className='settings-help';paletteHelp.textContent=t('paletteHelp');
  palette.append(paletteTitle,paletteOptions,paletteHelp);
  dialog.append(header,description,language,palette,footer,fileInput,notice);document.body.append(dialog);
  (async()=>{
    let browserCode='en';try{browserCode=I18n.normalize(chrome.i18n.getUILanguage())}catch{}
    const auto=new Option(t('languageAuto',[I18n.NAMES[browserCode]||browserCode]),'auto');languageSelect.append(auto);
    for(const code of I18n.SUPPORTED)languageSelect.append(new Option(I18n.NAMES[code],code));
    let stored='auto';try{stored=((await chrome.storage.local.get('pwm_settings')).pwm_settings||{}).language||'auto'}catch{}
    languageSelect.value=I18n.SUPPORTED.includes(stored)?stored:'auto';
    languageSelect.addEventListener('change',async()=>{languageSelect.disabled=true;try{await I18n.setLanguage(languageSelect.value);location.reload()}catch{languageSelect.disabled=false}});
  })();
  let previousFocus;
  // Lay the sections out side by side: every block added by the other settings scripts is moved
  // into a card inside a multi-column grid (idempotent, runs before each open).
  const grid=document.createElement('div');grid.className='settings-grid';description.after(grid);
  const fixed=new Set([header,description,grid,fileInput,notice]);
  function layout(){
    for(const node of [...dialog.children]){
      if(fixed.has(node))continue;
      if(node.classList.contains('settings-actions-title')){const card=document.createElement('section');card.className='settings-card';const next=node.nextElementSibling;card.append(node);if(next&&next.classList.contains('settings-workspace-actions'))card.append(next);grid.append(card);continue}
      node.classList.add('settings-card');grid.append(node);
    }
    dialog.append(notice);
  }
  globalThis.SettingsLayout={layout};
  trigger.addEventListener('click',()=>{if(dialog.open)return;previousFocus=document.activeElement;notice.textContent='';layout();dialog.showModal();close.focus()});
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
