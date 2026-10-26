'use strict';
const Productivity = (() => {
  const tools=document.querySelector('.workspace-tools');
  function button(label,id){const el=document.createElement('button');el.type='button';el.className='btn btn--ghost';el.textContent=label;el.id=id;return el}
  const add=button('タブを1枚追加','addSingleTab'),edit=button('お気に入りを編集','editFavorites');tools.append(add,edit);
  const shortcuts=document.createElement('div');shortcuts.className='space-shortcuts';shortcuts.id='spaceShortcuts';document.getElementById('spaceList').before(shortcuts);
  function modal(title){
    if(document.getElementById('productivityDialog'))return null;
    const focus=document.activeElement;const dialog=document.createElement('dialog');dialog.id='productivityDialog';dialog.className='workspace-dialog';
    const heading=document.createElement('h2');heading.id='productivityTitle';heading.textContent=title;dialog.setAttribute('aria-labelledby',heading.id);dialog.append(heading);
    const close=button('閉じる','closeProductivity');close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{dialog.remove();if(focus?.isConnected)focus.focus()});dialog.append(close);document.body.append(dialog);
    return {dialog,close,open:()=>{dialog.showModal();close.focus()}};
  }
  function selectField(dialog,title,id,options,value){
    const label=document.createElement('label');label.textContent=title;label.htmlFor=id;const select=document.createElement('select');select.id=id;select.required=true;
    select.append(new Option('選択してください',''));for(const option of options)select.append(new Option(option.label,option.id));select.value=value||'';dialog.append(label,select);return select;
  }
  add.addEventListener('click',async()=>{
    try{
      const tabs=(await getWindowTabs()).filter(t=>isClosableTab(t)&&isRestorableUrl(t.pendingUrl||t.url));
      const data=await loadData();const spaces=data.spaces.filter(s=>!s.archived);
      if(!tabs.length||!spaces.length){showMessage(!tabs.length?'追加できるWebページがありません。':'先にスペースを作成してください。','error');return}
      const view=modal('タブを1枚追加');if(!view)return;
      const {dialog}=view;
      const tabSelect=selectField(dialog,'追加するタブ','singleTabSource',tabs.map(t=>({id:String(t.id),label:t.title||t.url})),String(tabs.find(t=>t.active)?.id||''));
      const target=selectField(dialog,'追加先のスペース','singleTabTarget',spaces.map(s=>({id:s.id,label:s.name})),getActiveSpaceId(data));
      const submit=button('追加する','confirmSingleTab');const notice=document.createElement('p');notice.setAttribute('role','status');dialog.append(submit,notice);
      submit.addEventListener('click',async()=>{
        if(!tabSelect.reportValidity()||!target.reportValidity())return;submit.disabled=true;
        try{
          await navigator.locks.request('pwm-space-switch',async()=>{
            const tab=await chrome.tabs.get(Number(tabSelect.value));const url=tab.pendingUrl||tab.url;
            if(tab.windowId!==g_dashboardWindowId||!isRestorableUrl(url))throw Error('タブを取得できません');
            const latest=await loadData();const space=latest.spaces.find(s=>s.id===target.value&&!s.archived);if(!space)throw Error('保存先がありません');
            if(space.tabs.some(t=>t.url===url)){notice.textContent='このURLは追加先に保存済みです。';return}
            space.tabs.push({title:tab.title||url,url,favIconUrl:tab.favIconUrl||'',pinned:!!tab.pinned,groupId:null});space.updatedAt=new Date().toISOString();await saveData(latest);
            notice.textContent=`「${space.name}」に1枚追加しました。`;await renderAll();
          });
        }catch(error){notice.textContent='追加できませんでした。タブと追加先を確認してください。';console.error(error)}finally{submit.disabled=false}
      });view.open();tabSelect.focus();
    }catch(error){showMessage('タブを取得できませんでした。','error');console.error(error)}
  });
  edit.addEventListener('click',async()=>{
    try{
      const data=await loadData();const view=modal('お気に入りを編集');if(!view)return;
      const list=document.createElement('div');list.className='favorite-options';view.dialog.append(list);
      for(const space of data.spaces.filter(s=>!s.archived)){
        const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=!!space.favorite;checkbox.dataset.spaceId=space.id;label.append(checkbox,document.createTextNode(space.name));list.append(label);
        checkbox.addEventListener('change',async()=>{
          const checked=checkbox.checked;checkbox.disabled=true;
          try{await navigator.locks.request('pwm-space-switch',async()=>{const latest=await loadData();const s=latest.spaces.find(s=>s.id===space.id);if(!s)throw Error('missing');s.favorite=checked;await saveData(latest)})}
          catch{checkbox.checked=!checked;showMessage('お気に入りを保存できませんでした。','error')}
          finally{checkbox.disabled=false}
        });
      }
      if(!list.children.length)list.textContent='スペースを作成すると登録できます。';view.open();
    }catch{showMessage('お気に入りを読み込めませんでした。','error')}
  });
  let timer,seq=0;
  async function refresh(){
    const run=++seq;
    try{const data=await loadData();if(run!==seq)return;shortcuts.replaceChildren();
      const spaces=data.spaces.filter(s=>!s.archived);
      for(const [title,items] of [['お気に入り',spaces.filter(s=>s.favorite)],['最近使ったスペース',spaces.filter(s=>s.lastOpenedAt).sort((a,b)=>b.lastOpenedAt.localeCompare(a.lastOpenedAt)).slice(0,5)]]){
        if(!items.length)continue;const details=document.createElement('details');details.open=true;const summary=document.createElement('summary');summary.textContent=title;details.append(summary);
        for(const space of items){const row=button(space.name,'');row.dataset.shortcutId=space.id;row.addEventListener('click',()=>handleSwitchSpace(space.id));details.append(row)}shortcuts.append(details);
      }
    }catch{ /* Existing navigation remains available. */ }
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(refresh,100)}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.pwm_data)schedule()});document.addEventListener('DOMContentLoaded',schedule);
  async function recordRecent(id){const data=await loadData();const space=data.spaces.find(s=>s.id===id);if(space){space.lastOpenedAt=new Date().toISOString();await saveData(data)}}
  return {recordRecent};
})();
