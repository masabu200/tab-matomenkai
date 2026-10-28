'use strict';
// キーボードショートカット（ダッシュボード / サイドパネル共通）
//   ⌘/Ctrl+S : 現在のタブを選択中のスペースへ保存
//   ⌘/Ctrl+K : スペース検索へフォーカス
//   /        : タブの絞り込み（なければスペース検索）へフォーカス
//   Esc      : 検索欄で入力中なら内容を消す
(() => {
  const isMac=/Mac|iPhone|iPad/.test(navigator.platform);
  const modLabel=isMac?'⌘':'Ctrl+';
  const isEditable=el=>!!el&&(el.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
  const visible=el=>!!el&&el.getClientRects().length>0;
  const dialogOpen=()=>!!document.querySelector('dialog[open]')||[...document.querySelectorAll('.modal-overlay')].some(visible);
  const saveButton=document.getElementById('btnSaveTabs');
  if(saveButton)saveButton.title=t('m_b3afead7ff', [modLabel]);
  const spaceSearch=()=>document.getElementById('spaceSearch');
  const tabFilter=()=>document.getElementById('searchInput');
  function focusField(el){if(!visible(el))return false;el.focus();el.select?.();return true}
  document.addEventListener('keydown',event=>{
    const mod=event.metaKey||event.ctrlKey;
    const key=event.key.toLowerCase();
    if(mod&&!event.shiftKey&&!event.altKey&&key==='s'){
      event.preventDefault();
      if(dialogOpen()||!saveButton||saveButton.disabled||typeof handleSaveTabs!=='function')return;
      navigator.locks.request('pwm-space-switch',()=>handleSaveTabs());
      return;
    }
    if(mod&&!event.shiftKey&&!event.altKey&&key==='k'){
      if(dialogOpen())return;
      if(focusField(spaceSearch()))event.preventDefault();
      return;
    }
    if(event.key==='/'&&!mod&&!event.altKey&&!isEditable(document.activeElement)&&!dialogOpen()){
      if(focusField(tabFilter())||focusField(spaceSearch()))event.preventDefault();
      return;
    }
    if(event.key==='Escape'){
      const el=document.activeElement;
      if(isEditable(el)&&el.type==='search'&&el.value){el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));event.stopPropagation()}
    }
  });
  for(const el of [spaceSearch(),tabFilter()]){if(!el)continue;const hint=el===tabFilter()?'/':`${modLabel}K`;el.title=`${el.getAttribute('aria-label')||el.placeholder||''}（${hint}）`.trim()}
})();
