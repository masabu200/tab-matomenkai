'use strict';
(() => {
  const base='http://127.0.0.1:47831';let token='',running=false,timer,proposals=[];
  const settings=document.getElementById('settingsDialog');
  const section=document.createElement('details');section.className='ai-settings';section.id='aiSettings';
  const title=document.createElement('summary');title.textContent=t('m_2ce01f81ad')+' · '+t('advancedLabel');
  const note=document.createElement('p');note.textContent=t('m_a8ce0201c4');
  const label=document.createElement('label');label.htmlFor='aiConnectionToken';label.textContent=t('m_a9356d61c7');
  const input=document.createElement('input');input.id='aiConnectionToken';input.type='password';input.autocomplete='off';input.placeholder=t('m_9dd838b6ab');
  const connect=button(t('m_5119847c00'),'aiConnect'),disconnect=button(t('m_092575584a'),'aiDisconnect'),review=button(t('m_2e845bddec'),'aiReview'),undo=button(t('m_463f7d5d30'),'aiUndo');disconnect.disabled=true;review.disabled=true;
  const status=document.createElement('p');status.id='aiStatus';status.setAttribute('role','status');status.textContent=t('m_7ea46c0315');
  section.append(title,note,label,input,connect,disconnect,review,undo,status);settings.append(section);
  function button(text,id){const el=document.createElement('button');el.type='button';el.className='btn btn--ghost';el.textContent=text;el.id=id;return el}
  async function request(path,body){const res=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});const d=await res.json();if(!res.ok)throw Error(d.error||t('m_fb71a4e085'));return d}
  async function mark(id,value){const stored=(await chrome.storage.session.get('pwm_ai_processed')).pwm_ai_processed||{};stored[id]=value;await chrome.storage.session.set({pwm_ai_processed:stored});try{await request('/proposal-status',{id,status:value})}catch{} }
  async function sync(){
    if(!token||running)return;running=true;
    try{
      const connectedToken=token;
      const data=await loadData();const response=await request('/sync',{snapshot:TabAgentModel.snapshot(data)});
      if(token!==connectedToken)return;
      const known=(await chrome.storage.session.get('pwm_ai_processed')).pwm_ai_processed||{};
      proposals=[];for(const p of response.proposals){if(known[p.id]){try{await request('/proposal-status',{id:p.id,status:known[p.id]})}catch{}}else proposals.push(p)}
      review.disabled=!proposals.length;review.textContent=t('m_9606bdda03', [proposals.length]);status.textContent=t('m_b5e969dec9', [proposals.length]);
    }catch(error){status.textContent=t('m_cda8d46d3f')+error.message}
    finally{running=false;if(token)timer=setTimeout(sync,3000)}
  }
  connect.addEventListener('click',async()=>{
    const value=input.value.trim();if(!/^[0-9a-f]{64}$/.test(value)){status.textContent=t('m_c4e07534d2');return}
    clearTimeout(timer);token=value;input.value='';disconnect.disabled=false;connect.disabled=true;
    await chrome.storage.session.set({pwm_ai_token:token});await sync();
  });
  disconnect.addEventListener('click',async()=>{clearTimeout(timer);try{await request('/disconnect',{})}catch{}token='';await chrome.storage.session.set({pwm_ai_token:''});connect.disabled=false;disconnect.disabled=true;review.disabled=true;status.textContent=t('m_0b9939e1f9');});
  review.addEventListener('click',async()=>{
    if(!proposals.length||document.getElementById('aiProposalDialog'))return;
    const p=proposals[0];const focus=document.activeElement;
    const dialog=document.createElement('dialog');dialog.id='aiProposalDialog';dialog.className='workspace-dialog';
    const heading=document.createElement('h2');heading.id='aiProposalHeading';heading.textContent=t('m_a9b2455ca6');dialog.setAttribute('aria-labelledby',heading.id);
    const summary=document.createElement('p');summary.textContent=p.summary;const changes=document.createElement('div');const notice=document.createElement('p');notice.setAttribute('role','status');
    const apply=button(t('m_1c7d43cb8f'),'aiApply'),reject=button(t('m_16661f1537'),'aiReject'),close=button(t('m_3da5c18551'),'aiClose');const checks=[];
    try{
      const data=await loadData();const result=TabAgentModel.apply(data,p.operations);
      if(await TabAgentModel.revision(TabAgentModel.snapshot(data))!==p.revision)throw Error(t('m_2fbbb892d1'));
      for(const [i,text]of result.descriptions.entries()){const label=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.dataset.operationIndex=i;label.append(cb,document.createTextNode(text));changes.append(label);checks.push(cb)}
    }catch(error){notice.textContent=error.message;apply.disabled=true;await mark(p.id,'stale')}
    dialog.append(heading,summary,changes,notice,apply,reject,close);document.body.append(dialog);
    close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{dialog.remove();if(focus?.isConnected)focus.focus()});
    reject.addEventListener('click',async()=>{await mark(p.id,'rejected');dialog.close();clearTimeout(timer);await sync()});
    apply.addEventListener('click',async()=>{
      apply.disabled=true;
      try{
        await navigator.locks.request('pwm-space-switch',async()=>{
          const data=await loadData();if(await TabAgentModel.revision(TabAgentModel.snapshot(data))!==p.revision)throw Error(t('m_33dc0c7eef'));
          const selected=p.operations.filter((_,i)=>checks[i]?.checked);const result=TabAgentModel.apply(data,selected);
          const revision=await TabAgentModel.revision(TabAgentModel.snapshot(result.data));
          await chrome.storage.session.set({pwm_ai_undo:{data,revision,proposalId:p.id,selectedOperations:selected}});
          await saveData(result.data);await mark(p.id,'applied');await renderAll();reject.disabled=true;notice.textContent=t('m_4e265c1689', [selected.length]);
        });
        clearTimeout(timer);await sync();
      }catch(error){notice.textContent=error.message;apply.disabled=false}
    });dialog.showModal();close.focus();
  });
  undo.addEventListener('click',async()=>{
    try{
      await navigator.locks.request('pwm-space-switch',async()=>{
        const saved=(await chrome.storage.session.get('pwm_ai_undo')).pwm_ai_undo;if(!saved)throw Error(t('m_62157d9463'));
        const data=await loadData();if(await TabAgentModel.revision(TabAgentModel.snapshot(data))!==saved.revision)throw Error(t('m_33b0b3d01c'));
        await saveData(saved.data);await chrome.storage.session.set({pwm_ai_undo:null});await renderAll();status.textContent=t('m_b1c9392214');
      });
    }catch(error){status.textContent=error.message}
  });
  chrome.storage.session.get('pwm_ai_token').then(result=>{if(result.pwm_ai_token){token=result.pwm_ai_token;connect.disabled=true;disconnect.disabled=false;sync()}});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='session'&&changes.pwm_ai_token&&!changes.pwm_ai_token.newValue){
      clearTimeout(timer);token='';connect.disabled=false;disconnect.disabled=true;review.disabled=true;status.textContent=t('m_0b9939e1f9');
    }
  });
  window.addEventListener('pagehide',()=>clearTimeout(timer));
})();
