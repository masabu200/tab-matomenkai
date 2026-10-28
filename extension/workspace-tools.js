'use strict';
const WorkspaceTools = (() => {
  const box = document.createElement('section'); box.className = 'workspace-tools';
  const search = document.createElement('input'); search.type = 'search'; search.id = 'spaceSearch'; search.placeholder = t('m_429855c857'); search.setAttribute('aria-label', search.placeholder);
  const results = document.createElement('div'); results.id = 'spaceSearchResults'; results.hidden = true;
  const status = document.createElement('p'); status.id = 'workspaceSaveStatus'; status.setAttribute('role','status');
  const save = document.createElement('button'); save.type = 'button'; save.className = 'btn btn--ghost'; save.textContent = t('m_ccd039eca2');
  const restore = document.createElement('button'); restore.type = 'button'; restore.id = 'restorePreviousTabs'; restore.className = 'btn btn--ghost'; restore.textContent = t('m_2437c7c79c'); restore.disabled = true;
  box.append(search,results,status,save,restore);
  document.querySelector('.sidebar__create').after(box);
  let timer, sequence = 0, failure = false, busy = false;
  const key = () => `pwm_previous_tabs_${g_dashboardWindowId}`;
  const signature = tabs => JSON.stringify(tabs.map(t => [t.url,!!t.pinned]));
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh,150); }
  async function refresh() {
    if (g_dashboardWindowId === null || busy || g_isSwitching) { schedule(); return; }
    const seq = ++sequence;
    try {
      const data = await loadData(); const tabs = (await getWindowTabs()).filter(isSavableTab);
      const history = (await chrome.storage.session.get(key()))[key()];
      if (seq !== sequence) return;
      restore.disabled = !history;
      restore.title = history ? t('restoreHistoryTitle', [new Date(history.createdAt).toLocaleTimeString(I18n.current().replace('_','-'))]) : t('m_d0b101161c');
      const active = data.spaces.find(s=>s.id===getActiveSpaceId(data));
      save.disabled = !active || active.archived;
      const dirty = active && signature(active.tabs || []) !== signature(tabs);
      status.textContent = failure ? t('m_c030b56060') : !active ? t('m_0a14601b8e') : `${active.name}：${dirty ? t('m_aa9e381e6f') : t('m_74e30e9189')}${active.tabsSavedAt ? ' · '+new Date(active.tabsSavedAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}) : ''}`;
      const query = search.value.trim().toLocaleLowerCase();
      results.replaceChildren(); results.hidden = !query;
      document.getElementById('spaceList').hidden = !!query;
      if (query) {
        const categories = new Map(data.categories.map(c=>[c.id,c.name]));
        const matches = data.spaces.filter(s=>`${s.name} ${categories.get(s.categoryId)||''}`.toLocaleLowerCase().includes(query));
        for (const s of matches) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'space-search-result';
          button.textContent = `${s.name}\n${categories.get(s.categoryId)||t('m_f4d781035f')}${s.archived?t('m_3b69257cb0'):''}`;
          button.addEventListener('click',()=>s.archived?handleViewArchivedSpace(s.id):handleSwitchSpace(s.id)); results.append(button);
        }
        if (!matches.length) results.textContent = t('m_d34e19303a');
      }
    } catch { status.textContent = t('m_3881f5d6ed'); }
  }
  async function captureHistory(data) {
    const tabs = (await getWindowTabs()).filter(isClosableTab).map(t=>({url:t.pendingUrl||t.url,pinned:!!t.pinned,active:!!t.active,groupId:t.groupId}));
    const groups = chrome.tabGroups ? await chrome.tabGroups.query({windowId:g_dashboardWindowId}) : [];
    await chrome.storage.session.set({[key()]:{createdAt:new Date().toISOString(),spaceId:getActiveSpaceId(data),tabs,groups}});
    schedule();
  }
  restore.addEventListener('click',async()=>{
    if (busy) return;
    // 確認ダイアログ中の再クリックで復元が二度走らないよう、先に多重実行を止める
    busy=true; restore.disabled=true;
    try {
    if (!await DashboardDialogs.confirm(t('m_97aa22defa'))) return;
    await navigator.locks.request('pwm-space-switch',async()=>{
      busy=true; g_isSwitching=true; restore.disabled=true;
      try {
        const history=(await chrome.storage.session.get(key()))[key()]; if(!history)return;
        const data=await loadData(); const old=(await getWindowTabs()).filter(isClosableTab);
        const created=[];
        try {
          for(const t of history.tabs) {
            if(!t.url)throw Error('Missing URL');
            const tab=await chrome.tabs.create({windowId:g_dashboardWindowId,url:t.url,pinned:t.pinned,active:false}); created.push({id:tab.id,source:t});
          }
          if(!created.length)created.push({id:(await chrome.tabs.create({windowId:g_dashboardWindowId,url:'about:blank',active:false})).id,source:{}});
          for(const group of history.groups||[]) {
            const tabIds=created.filter(t=>t.source.groupId===group.id&&!t.source.pinned).map(t=>t.id);
            if(tabIds.length)await chrome.tabGroups.update(await chrome.tabs.group({tabIds}),{title:group.title,color:group.color,collapsed:group.collapsed});
          }
        } catch(error) { if(created.length)await chrome.tabs.remove(created.map(t=>t.id));throw error; }
        // Capture only the old tabs, before they are closed (new tabs already exist).
        const groups=chrome.tabGroups?await chrome.tabGroups.query({windowId:g_dashboardWindowId}):[];
        await chrome.storage.session.set({[key()]:{createdAt:new Date().toISOString(),spaceId:getActiveSpaceId(data),tabs:old.map(t=>({url:t.pendingUrl||t.url,pinned:!!t.pinned,active:!!t.active,groupId:t.groupId})),groups}});
        if(old.length)await chrome.tabs.remove(old.map(t=>t.id));
        const active=created.find(t=>t.source.active)||created[0]; await chrome.tabs.update(active.id,{active:true});
        setActiveSpaceId(data,data.spaces.some(s=>s.id===history.spaceId)?history.spaceId:null); await saveData(data);
        await renderAll();showMessage(t('m_9ea03093db'),'success');
      }catch(error){console.error(error);showMessage(t('m_9930817c6f'),'error');}
      finally{g_isSwitching=false;}
    });
    } finally { busy=false; schedule(); }
  });
  const originalSave = saveCurrentTabsToSpace;
  saveCurrentTabsToSpace = async function(id) {
    busy=true; status.textContent=t('m_6644f06197');
    try { const result=await originalSave(id); failure=false;return result; }
    catch(error){failure=true;throw error;}
    finally{busy=false;schedule();}
  };
  save.addEventListener('click',()=>navigator.locks.request('pwm-space-switch',()=>handleSaveTabs()));
  search.addEventListener('input',schedule);
  for(const event of [chrome.tabs.onCreated,chrome.tabs.onUpdated,chrome.tabs.onRemoved,chrome.tabs.onMoved,chrome.tabs.onAttached,chrome.tabs.onDetached])event.addListener(schedule);
  chrome.storage.onChanged.addListener(schedule);
  document.addEventListener('DOMContentLoaded',schedule);
  return {captureHistory,refresh};
})();
