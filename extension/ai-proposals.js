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
    if(!Array.isArray(operations)||!operations.length||operations.length>50)throw Error('変更は1〜50件にしてください');
    const next=structuredClone(data);const descriptions=[];
    const space=id=>{const s=next.spaces.find(s=>s.id===id&&!s.archived);if(!s)throw Error('対象スペースがありません');return s};
    for(const op of operations){
      if(!op||typeof op!=='object')throw Error('変更形式が不正です');
      const s=space(op.spaceId);
      if(op.type==='rename_space'){
        if(typeof op.name!=='string'||!op.name.trim()||op.name.length>120)throw Error('名前は1〜120文字です');
        descriptions.push(`名前変更：${s.name} → ${op.name.trim()}`);s.name=op.name.trim();
      }else if(op.type==='move_space'){
        const category=op.categoryId===null?null:next.categories.find(c=>c.id===op.categoryId);if(op.categoryId!==null&&!category)throw Error('移動先カテゴリーがありません');
        descriptions.push(`カテゴリー移動：${s.name} → ${category?.name||'未分類'}`);s.categoryId=op.categoryId;
      }else if(op.type==='add_tab'){
        const url=new URL(op.url);if(!['http:','https:'].includes(url.protocol))throw Error('追加できるURLはHTTP/HTTPSです');
        if(s.tabs.some(t=>t.url===op.url))throw Error('同じURLが保存されています');
        if(op.title!==undefined&&(typeof op.title!=='string'||op.title.length>500))throw Error('タイトル形式が不正です');
        s.tabs.push({url:op.url,title:op.title||op.url,pinned:false,groupId:null,favIconUrl:''});descriptions.push(`タブ追加：${s.name} ← ${op.title||op.url}`);
      }else if(op.type==='move_tab'){
        if(!Number.isInteger(op.tabIndex)||op.tabIndex<0||op.tabIndex>=s.tabs.length)throw Error('タブ位置が不正です');
        const dest=space(op.targetSpaceId);if(dest.id===s.id)throw Error('別のスペースを指定してください');
        const tab=s.tabs[op.tabIndex];if(tab.url!==op.expectedUrl)throw Error('対象タブのURLが一致しません');
        if(dest.tabs.some(t=>t.url===tab.url))throw Error('移動先に同じURLがあります');
        s.tabs.splice(op.tabIndex,1);dest.tabs.push({...tab,groupId:null});descriptions.push(`タブ移動：${tab.title||tab.url}（${s.name} → ${dest.name}）`);
      }else throw Error('未対応の操作です');
    }
    return {data:next,descriptions};
  }
};
