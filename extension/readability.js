'use strict';
(() => {
  const preview=document.createElement('section');preview.id='navigationFullTitle';preview.className='nav-tab-preview';preview.hidden=true;preview.setAttribute('aria-label','保存タブのプレビュー');document.body.append(preview);
  let owner=null,openTimer,closeTimer,sequence=0;
  function hide(){clearTimeout(openTimer);clearTimeout(closeTimer);++sequence;if(owner)owner.removeAttribute('aria-describedby');owner=null;preview.hidden=true}
  function position(row){const r=row.getBoundingClientRect();const width=Math.min(340,innerWidth-24);preview.style.width=width+'px';preview.style.maxHeight=Math.max(100,Math.min(360,innerHeight-24))+'px';preview.style.left=Math.max(12,Math.min(r.right+8,innerWidth-width-12))+'px';preview.style.top=Math.max(12,Math.min(r.top,innerHeight-preview.offsetHeight-12))+'px'}
  async function show(row){
    const seq=++sequence;preview.replaceChildren();
    try{
      if(row.dataset.spaceId){
        const data=await loadData();if(seq!==sequence)return;const space=data.spaces.find(s=>s.id===row.dataset.spaceId);if(!space)return;
        const heading=document.createElement('h3');heading.textContent=`${space.name}（${space.tabs?.length||0} タブ）`;preview.append(heading);
        const list=document.createElement('div');list.className='nav-tab-preview-list';
        for(const tab of space.tabs||[]){
          const button=document.createElement('button');button.type='button';button.className='nav-tab-preview-item';
          const title=document.createElement('span');title.textContent=tab.title||tab.url;const site=document.createElement('small');try{site.textContent=new URL(tab.url).hostname||tab.url}catch{site.textContent=tab.url}const icon=document.createElement('img');icon.className='nav-tab-preview-icon';icon.alt='';icon.width=16;icon.height=16;
          const fallback=document.createElement('span');fallback.className='nav-tab-preview-fallback';fallback.textContent='◉';fallback.setAttribute('aria-hidden','true');
          let iconUrl='';try{const parsed=new URL(tab.favIconUrl||'');if(['https:','http:','data:','chrome-extension:'].includes(parsed.protocol))iconUrl=parsed.href}catch{}
          if(iconUrl){icon.src=iconUrl;icon.referrerPolicy='no-referrer';icon.addEventListener('error',()=>icon.replaceWith(fallback),{once:true})}
          const text=document.createElement('div');text.className='nav-tab-preview-text';text.append(title,site);button.append(iconUrl?icon:fallback,text);
          button.disabled=!isRestorableUrl(tab.url);
          button.addEventListener('click',async event=>{event.stopPropagation();try{await chrome.tabs.create({windowId:g_dashboardWindowId,url:tab.url,active:true});hide()}catch{showMessage('タブを開けませんでした。','error')}});list.append(button);
        }
        if(!list.children.length)list.textContent='保存されたタブはありません';preview.append(list);
      }else{preview.textContent=row.dataset.fullTitle||row.title||'';}
      if(seq!==sequence)return;owner=row;preview.hidden=false;row.setAttribute('aria-describedby',preview.id);position(row);
    }catch{hide()}
  }
  function enter(target){const row=target.closest?.('.space-item,.cat-group__name,.tab-card');if(!row)return;if(row===owner){clearTimeout(closeTimer);return}hide();if(row.title){row.dataset.fullTitle=row.title;row.removeAttribute('title')}openTimer=setTimeout(()=>show(row),400)}
  function leave(){clearTimeout(openTimer);closeTimer=setTimeout(hide,180)}
  document.addEventListener('pointerover',event=>{const row=event.target.closest?.('.space-item,.cat-group__name,.tab-card');if(row&&row.contains(event.relatedTarget))return;enter(event.target)});
  document.addEventListener('pointerout',event=>{const row=event.target.closest?.('.space-item,.cat-group__name,.tab-card');if(row&&!row.contains(event.relatedTarget)&&!preview.contains(event.relatedTarget))leave()});
  preview.addEventListener('pointerenter',()=>{clearTimeout(closeTimer)});preview.addEventListener('pointerleave',leave);
  document.addEventListener('focusin',event=>{if(preview.contains(event.target)){clearTimeout(closeTimer);return}enter(event.target)});
  document.addEventListener('focusout',event=>{if(!preview.contains(event.relatedTarget))leave()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();if(event.key==='ArrowRight'&&owner===document.activeElement&&!preview.hidden){const button=preview.querySelector('button:not(:disabled)');if(button){event.preventDefault();button.focus()}}});
  document.addEventListener('dragstart',hide,true);
  document.addEventListener('scroll',event=>{if(!preview.contains(event.target))hide()},true);window.addEventListener('resize',hide);window.addEventListener('blur',hide);
})();
