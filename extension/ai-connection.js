'use strict';
(() => {
  const base='http://127.0.0.1:47831';let token='',running=false,timer,proposals=[];
  const settings=document.getElementById('settingsDialog');
  const section=document.createElement('section');section.className='ai-settings';
  const title=document.createElement('h3');title.textContent='ローカルAI連携';
  const note=document.createElement('p');note.textContent='接続中はスペースのタイトル・URL・グループ情報をPC内の連携サーバーに共有します。ページ本文は共有しません。';
  const label=document.createElement('label');label.htmlFor='aiConnectionToken';label.textContent='接続キー';
  const input=document.createElement('input');input.id='aiConnectionToken';input.type='password';input.autocomplete='off';input.placeholder='連携サーバーの .local/token を貼り付け';
  const connect=button('接続','aiConnect'),disconnect=button('切断','aiDisconnect'),review=button('整理案を見る','aiReview'),undo=button('前の整理状態に戻す','aiUndo');disconnect.disabled=true;review.disabled=true;
  const status=document.createElement('p');status.id='aiStatus';status.setAttribute('role','status');status.textContent='未接続';
  section.append(title,note,label,input,connect,disconnect,review,undo,status);settings.append(section);
  function button(text,id){const el=document.createElement('button');el.type='button';el.className='btn btn--ghost';el.textContent=text;el.id=id;return el}
  async function request(path,body){const res=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});const d=await res.json();if(!res.ok)throw Error(d.error||'接続エラー');return d}
  async function mark(id,value){const stored=(await chrome.storage.session.get('pwm_ai_processed')).pwm_ai_processed||{};stored[id]=value;await chrome.storage.session.set({pwm_ai_processed:stored});try{await request('/proposal-status',{id,status:value})}catch{} }
  async function sync(){
    if(!token||running)return;running=true;
    try{
      const connectedToken=token;
      const data=await loadData();const response=await request('/sync',{snapshot:TabAgentModel.snapshot(data)});
      if(token!==connectedToken)return;
      const known=(await chrome.storage.session.get('pwm_ai_processed')).pwm_ai_processed||{};
      proposals=[];for(const p of response.proposals){if(known[p.id]){try{await request('/proposal-status',{id:p.id,status:known[p.id]})}catch{}}else proposals.push(p)}
      review.disabled=!proposals.length;review.textContent=`整理案を見る（${proposals.length}件）`;status.textContent=`接続中 · 整理案 ${proposals.length}件`;
    }catch(error){status.textContent='接続できません：'+error.message}
    finally{running=false;if(token)timer=setTimeout(sync,3000)}
  }
  connect.addEventListener('click',async()=>{
    const value=input.value.trim();if(!/^[0-9a-f]{64}$/.test(value)){status.textContent='64文字の接続キーを貼り付けてください';return}
    clearTimeout(timer);token=value;input.value='';disconnect.disabled=false;connect.disabled=true;
    await chrome.storage.session.set({pwm_ai_token:token});await sync();
  });
  disconnect.addEventListener('click',async()=>{clearTimeout(timer);try{await request('/disconnect',{})}catch{}token='';await chrome.storage.session.set({pwm_ai_token:''});connect.disabled=false;disconnect.disabled=true;review.disabled=true;status.textContent='切断しました';});
  review.addEventListener('click',async()=>{
    if(!proposals.length||document.getElementById('aiProposalDialog'))return;
    const p=proposals[0];const focus=document.activeElement;
    const dialog=document.createElement('dialog');dialog.id='aiProposalDialog';dialog.className='workspace-dialog';
    const heading=document.createElement('h2');heading.id='aiProposalHeading';heading.textContent='AIの整理案';dialog.setAttribute('aria-labelledby',heading.id);
    const summary=document.createElement('p');summary.textContent=p.summary;const changes=document.createElement('div');const notice=document.createElement('p');notice.setAttribute('role','status');
    const apply=button('選んだ変更を適用','aiApply'),reject=button('この案を却下','aiReject'),close=button('閉じる','aiClose');const checks=[];
    try{
      const data=await loadData();const result=TabAgentModel.apply(data,p.operations);
      if(await TabAgentModel.revision(TabAgentModel.snapshot(data))!==p.revision)throw Error('保存内容が変わりました。この案は適用できません。AIへ再提案を依頼してください。');
      for(const [i,text]of result.descriptions.entries()){const label=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.dataset.operationIndex=i;label.append(cb,document.createTextNode(text));changes.append(label);checks.push(cb)}
    }catch(error){notice.textContent=error.message;apply.disabled=true;await mark(p.id,'stale')}
    dialog.append(heading,summary,changes,notice,apply,reject,close);document.body.append(dialog);
    close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{dialog.remove();if(focus?.isConnected)focus.focus()});
    reject.addEventListener('click',async()=>{await mark(p.id,'rejected');dialog.close();clearTimeout(timer);await sync()});
    apply.addEventListener('click',async()=>{
      apply.disabled=true;
      try{
        await navigator.locks.request('pwm-space-switch',async()=>{
          const data=await loadData();if(await TabAgentModel.revision(TabAgentModel.snapshot(data))!==p.revision)throw Error('保存内容が変わりました。再提案してください。');
          const selected=p.operations.filter((_,i)=>checks[i]?.checked);const result=TabAgentModel.apply(data,selected);
          const revision=await TabAgentModel.revision(TabAgentModel.snapshot(result.data));
          await chrome.storage.session.set({pwm_ai_undo:{data,revision,proposalId:p.id,selectedOperations:selected}});
          await saveData(result.data);await mark(p.id,'applied');await renderAll();reject.disabled=true;notice.textContent=`${selected.length}件を適用しました。開いているタブは変更していません。`;
        });
        clearTimeout(timer);await sync();
      }catch(error){notice.textContent=error.message;apply.disabled=false}
    });dialog.showModal();close.focus();
  });
  undo.addEventListener('click',async()=>{
    try{
      await navigator.locks.request('pwm-space-switch',async()=>{
        const saved=(await chrome.storage.session.get('pwm_ai_undo')).pwm_ai_undo;if(!saved)throw Error('戻せる整理履歴がありません');
        const data=await loadData();if(await TabAgentModel.revision(TabAgentModel.snapshot(data))!==saved.revision)throw Error('適用後に変更があるため戻せません');
        await saveData(saved.data);await chrome.storage.session.set({pwm_ai_undo:null});await renderAll();status.textContent='整理前の状態に戻しました';
      });
    }catch(error){status.textContent=error.message}
  });
  chrome.storage.session.get('pwm_ai_token').then(result=>{if(result.pwm_ai_token){token=result.pwm_ai_token;connect.disabled=true;disconnect.disabled=false;sync()}});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='session'&&changes.pwm_ai_token&&!changes.pwm_ai_token.newValue){
      clearTimeout(timer);token='';connect.disabled=false;disconnect.disabled=true;review.disabled=true;status.textContent='切断しました';
    }
  });
  window.addEventListener('pagehide',()=>clearTimeout(timer));
})();
