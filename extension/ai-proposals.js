'use strict';
// Shared pure data model used by the extension and local server.
globalThis.TabAgentModel = {
  snapshot(data) {
    return {
      categories:(data.categories||[]).map(c=>({id:c.id,name:c.name,parentId:c.parentId||null})),
      spaces:(data.spaces||[]).map(s=>({
        id:s.id,name:s.name,categoryId:s.categoryId||null,archived:!!s.archived,
        tabGroups:(s.tabGroups||[]).map(g=>({id:g.id,name:g.name})),
        tabs:(s.tabs||[]).map(t=>({title:t.title||'',url:t.url,groupId:t.groupId||null,pinned:!!t.pinned}))
      }))
    };
  },
  async revision(snapshot) {
    const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  },
  apply(data,operations) {
    if(!Array.isArray(operations)||!operations.length||operations.length>50)throw Error(t('m_6aa1453553'));
    const next=structuredClone(data);const descriptions=[];
    const space=id=>{const s=next.spaces.find(s=>s.id===id&&!s.archived);if(!s)throw Error(t('m_b96d769eac'));return s};
    for(const op of operations){
      if(!op||typeof op!=='object')throw Error(t('m_2b707f3b85'));
      const s=space(op.spaceId);
      if(op.type==='rename_space'){
        if(typeof op.name!=='string'||!op.name.trim()||op.name.length>120)throw Error(t('m_f7c288ba66'));
        descriptions.push(t('m_bd93ad1a6f', [s.name, op.name.trim()]));s.name=op.name.trim();
      }else if(op.type==='move_space'){
        const category=op.categoryId===null?null:next.categories.find(c=>c.id===op.categoryId);if(op.categoryId!==null&&!category)throw Error(t('m_ebeb4c2304'));
        descriptions.push(t('m_42e0c95815', [s.name, category?.name||t('m_f4d781035f')]));s.categoryId=op.categoryId;
      }else if(op.type==='add_tab'){
        const url=new URL(op.url);if(!['http:','https:'].includes(url.protocol))throw Error(t('m_55a535bafa'));
        if(s.tabs.some(t=>t.url===op.url))throw Error(t('m_43c516fa6a'));
        if(op.title!==undefined&&(typeof op.title!=='string'||op.title.length>500))throw Error(t('m_39b67bcaf4'));
        s.tabs.push({url:op.url,title:op.title||op.url,pinned:false,groupId:null,favIconUrl:''});descriptions.push(t('m_03f6623a18', [s.name, op.title||op.url]));
      }else if(op.type==='move_tab'){
        if(!Number.isInteger(op.tabIndex)||op.tabIndex<0||op.tabIndex>=s.tabs.length)throw Error(t('m_6a6f94972c'));
        const dest=space(op.targetSpaceId);if(dest.id===s.id)throw Error(t('m_579a11d917'));
        const tab=s.tabs[op.tabIndex];if(tab.url!==op.expectedUrl)throw Error(t('m_46ba84410f'));
        if(dest.tabs.some(t=>t.url===tab.url))throw Error(t('m_8924020b2a'));
        s.tabs.splice(op.tabIndex,1);dest.tabs.push({...tab,groupId:null});descriptions.push(t('m_11b801d8a2', [tab.title||tab.url, s.name, dest.name]));
      }else throw Error(t('m_42adb155e1'));
    }
    return {data:next,descriptions};
  }
};
