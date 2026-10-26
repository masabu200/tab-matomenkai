const {chromium}=require('/Users/mugikura/node_modules/playwright');const UI=require('./ui.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('node:assert/strict');
// BASE-02: 旧形式JSON・複数ウィンドウ・タブグループ・壊れたインポートでデータが消えないこと
async function wait(check,label='condition',tries=200){for(let i=0;i<tries;i++){const r=await check();if(r)return r;await new Promise(r=>setTimeout(r,50))}throw Error('Timeout: '+label)}
(async()=>{
 const server=http.createServer((req,res)=>{const delay=/^\/slow/.test(req.url)?3000:0;setTimeout(()=>{res.setHeader('Content-Type','text/html');res.end('<title>Local '+req.url+'</title><p>test</p>')},delay)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'data-safety-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});context.setDefaultTimeout(15000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];const dashboardURL=`chrome-extension://${id}/dashboard.html`;
  const storage=()=>worker.evaluate(()=>chrome.storage.local.get('pwm_data').then(r=>r.pwm_data));
  const errors=[];
  // ---------- 1. 旧形式の保存データ（windowActiveSpaces/tabGroups/archivedTabs/parentId なし）を起動時に書き換えない ----------
  const legacy={activeSpaceId:'s1',categories:[{id:'c1',name:'旧カテゴリー',collapsed:false}],spaces:[
   {id:'s1',name:'旧スペース1',categoryId:'c1',tabs:[{title:'A',url:base+'/a',favIconUrl:'',pinned:true},{title:'B',url:base+'/b'}],createdAt:'2025-01-01',updatedAt:'2025-01-02'},
   {id:'s2',name:'旧スペース2',tabs:[],archived:true},
   {id:'s3',name:'拡張項目つき',tabs:[{title:'C',url:base+'/c',groupId:'g1'}],tabGroups:[{id:'g1',name:'G',color:'blue',collapsed:true}],favorite:true,lastOpenedAt:'2026-01-01T00:00:00.000Z',tabsSavedAt:'2026-01-01T00:00:00.000Z',icon:'data:image/png;base64,AA==',color:'#ff0000',archivedTabs:[{title:'old',url:base+'/old'}]}]};
  await worker.evaluate(d=>chrome.storage.local.set({pwm_data:d,pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}}),legacy);
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1280,height:800});await p.goto(dashboardURL);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  await p.waitForSelector('[data-space-id="s1"]');await p.waitForTimeout(1200);
  assert.deepEqual(await storage(),legacy,'startup must not rewrite legacy data');
  assert.equal(await p.locator('[data-space-id="s3"]').count(),1);assert.equal(await p.locator('[data-space-id="s2"]').count(),1,'archived space listed in the archive section');
  console.log('PASS legacy stored data loads without being rewritten');
  // ---------- 2. エクスポート → 旧/拡張項目を保持したまま再インポート（往復） ----------
  await p.evaluate(()=>{window.__exports=[];URL.createObjectURL=blob=>{window.__exports.push(blob);return 'blob:captured'};HTMLAnchorElement.prototype.click=function(){}});
  await UI.inSettings(p,()=>p.locator('#btnExport').click());
  const exported=JSON.parse(await p.evaluate(()=>window.__exports[0].text()));
  assert.equal(exported.version,1);assert.equal(exported.spaces.length,3);assert.equal(exported.categories.length,1);
  const s3=exported.spaces.find(s=>s.id==='s3');assert.equal(s3.favorite,true);assert.equal(s3.tabGroups[0].collapsed,true);assert.equal(s3.archivedTabs.length,1);assert.equal(s3.tabs[0].groupId,'g1');assert.equal(s3.icon,legacy.spaces[2].icon);
  assert.equal(exported.spaces.find(s=>s.id==='s1').tabs[0].pinned,true);
  // 壊して再インポート前に、今の保存データを控える
  const beforeImport=await storage();
  const importFile=(name,obj)=>p.locator('#importFileInput').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(typeof obj==='string'?obj:JSON.stringify(obj))});
  await importFile('roundtrip.json',exported);await p.waitForSelector('#panelDialog');assert.match(await p.locator('#panelDialog').textContent(),/3 件/);
  await p.locator('#panelDialog button[type=submit]').click();await p.waitForFunction(()=>document.getElementById('message').textContent.includes('インポート完了'));
  const after=await storage();
  assert.deepEqual(after.spaces.map(s=>[s.id,s.name,s.archived,s.tabs.map(t=>t.url),(s.tabGroups||[]).map(g=>g.id),s.favorite,(s.archivedTabs||[]).length]),beforeImport.spaces.map(s=>[s.id,s.name,!!s.archived,s.tabs.map(t=>t.url),(s.tabGroups||[]).map(g=>g.id),s.favorite,(s.archivedTabs||[]).length]));
  assert.equal(after.categories[0].name,'旧カテゴリー');
  console.log('PASS export/import roundtrip keeps spaces, tabs, groups, archived tabs, favorites, icons');
  // ---------- 3. 旧形式のバックアップファイル（最小項目・入れ子カテゴリー）のインポート ----------
  const oldFile={version:1,exportedAt:'2025-06-01T00:00:00.000Z',activeSpaceId:'o1',categories:[{id:'oc',name:'親'},{id:'occ',name:'子',parentId:'oc'}],spaces:[{id:'o1',name:'旧1',categoryId:'occ',tabs:[{title:'X',url:'https://example.com/x'}]},{id:'o2',name:'旧2',tabs:[{url:'https://example.com/y'}]}]};
  await importFile('old.json',oldFile);await p.waitForSelector('#panelDialog');await p.locator('#panelDialog button[type=submit]').click();await p.waitForFunction(()=>document.getElementById('message').textContent.includes('インポート完了: 2 スペース / 2 カテゴリー'));
  const imported=await storage();assert.equal(imported.spaces.length,2);assert.equal(imported.spaces[1].tabs[0].url,'https://example.com/y');assert.equal(imported.categories[1].parentId,'oc');
  await p.waitForSelector('[data-space-id="o1"]');assert.equal(await p.locator('[data-category-id="occ"]').count(),1,'nested category rendered');
  const normalized=await p.evaluate(async()=>{const d=await loadData();const s=d.spaces[1];return [Array.isArray(s.tabGroups),Array.isArray(s.archivedTabs),s.tabs[0].groupId,s.categoryId,s.archived,d.categories[0].parentId]});
  assert.deepEqual(normalized,[true,true,null,null,false,null]);
  console.log('PASS old-format backup imports with nested categories and normalizes missing fields');
  // ---------- 4. 壊れたインポートはすべて拒否し、保存データを変更しない ----------
  const intact=await storage();
  const broken=[
   ['not-json.json','{"spaces": [oops'],
   ['wrong-shape.json',{spaces:'x'}],
   ['version2.json',{version:2,spaces:[]}],
   ['dup-ids.json',{version:1,spaces:[{id:'d',name:'a',tabs:[]},{id:'d',name:'b',tabs:[]}]}],
   ['tabs-null.json',{version:1,spaces:[{id:'n',name:'a',tabs:null}]}],
   ['bad-url.json',{version:1,spaces:[{id:'u',name:'a',tabs:[{url:'javascript:alert(1)'}]}]}],
   ['category-cycle.json',{version:1,spaces:[],categories:[{id:'x',name:'x',parentId:'y'},{id:'y',name:'y',parentId:'x'}]}],
   ['missing-parent.json',{version:1,spaces:[],categories:[{id:'x',name:'x',parentId:'nope'}]}],
   ['group-no-id.json',{version:1,spaces:[{id:'g',name:'a',tabs:[],tabGroups:[{name:'no id'}]}]}],
   ['empty.json',''],
  ];
  for(const [name,content] of broken){
   await p.evaluate(()=>{document.getElementById('message').textContent=''});
   await importFile(name,content);
   await p.waitForFunction(()=>/失敗|不正|正しくありません/.test(document.getElementById('message').textContent));
   assert.equal(await p.locator('#panelDialog').count(),0,name+': no confirmation for invalid file');
   assert.deepEqual(await storage(),intact,name+': storage unchanged');
  }
  // 正しいファイルでもキャンセルすれば変更しない
  await importFile('cancel.json',oldFile);await p.waitForSelector('#panelDialog');await p.locator('#panelDialog button').filter({hasText:'キャンセル'}).click();await p.waitForTimeout(300);
  assert.deepEqual(await storage(),intact,'cancel leaves data unchanged');
  console.log('PASS '+broken.length+' broken imports rejected without touching data; cancel keeps data');
  // ---------- 5. Chromeタブグループの保存・再保存・復元 ----------
  await p.evaluate(async base=>{const d={categories:[],windowActiveSpaces:{},spaces:[{id:'a',name:'グループ案件',tabs:[],tabGroups:[]},{id:'b',name:'別案件',tabs:[{url:base+'/b1',title:'b1'}],tabGroups:[]}]};setActiveSpaceId(d,'a');await saveData(d);
   for(const t of await getWindowTabs())if(isClosableTab(t))await chrome.tabs.remove(t.id);
   const t1=await chrome.tabs.create({windowId:g_dashboardWindowId,url:base+'/g1',active:false});const t2=await chrome.tabs.create({windowId:g_dashboardWindowId,url:base+'/g2',active:false});await chrome.tabs.create({windowId:g_dashboardWindowId,url:base+'/solo',active:false});
   const gid=await chrome.tabs.group({tabIds:[t1.id,t2.id]});await chrome.tabGroups.update(gid,{title:'調査',color:'green',collapsed:false});},base);
  await p.waitForSelector('[data-space-id="a"]');await p.locator('#btnSaveTabs').click();
  await wait(async()=>{const d=await storage();const s=d.spaces.find(s=>s.id==='a');return s.tabs.length===3&&s.tabGroups.length===1},'saved with group');
  let space=(await storage()).spaces.find(s=>s.id==='a');const groupId=space.tabGroups[0].id;
  assert.equal(space.tabGroups[0].name,'調査');assert.deepEqual(space.tabs.filter(t=>t.groupId===groupId).map(t=>t.url).sort(),[base+'/g1',base+'/g2']);assert.equal(space.tabs.find(t=>t.url===base+'/solo').groupId,null);
  // 再保存で同名グループが重複しない・IDが維持される
  await p.locator('#btnSaveTabs').click();await p.waitForTimeout(600);space=(await storage()).spaces.find(s=>s.id==='a');
  assert.equal(space.tabGroups.length,1);assert.equal(space.tabGroups[0].id,groupId);
  // 切り替えて戻すと Chrome のグループが復元される
  await p.locator('#spaceList [data-space-id="b"]').click();await p.locator('[data-choice=skip]').click();await p.waitForFunction(async()=>getActiveSpaceId(await loadData())==='b'&&!g_isSwitching);
  await p.locator('#spaceList [data-space-id="a"]').click();await p.locator('[data-choice=skip]').click();await p.waitForFunction(async()=>getActiveSpaceId(await loadData())==='a'&&!g_isSwitching);
  const restored=await wait(async()=>{const groups=await p.evaluate(async()=>{const gs=await chrome.tabGroups.query({windowId:g_dashboardWindowId});const out=[];for(const g of gs){const tabs=await chrome.tabs.query({groupId:g.id});out.push({title:g.title,color:g.color,urls:tabs.map(t=>t.pendingUrl||t.url).sort()})}return out});return groups.length===1&&groups[0].urls.length===2?groups:null},'chrome group restored');
  assert.equal(restored[0].title,'調査');assert.equal(restored[0].color,'green');assert.deepEqual(restored[0].urls,[base+'/g1',base+'/g2']);
  space=(await storage()).spaces.find(s=>s.id==='a');assert.equal(space.tabGroups.length,1,'switching does not duplicate groups');assert.equal(space.tabs.length,3);
  console.log('PASS Chrome tab group saved, re-saved without duplication, restored after switching');
  // ---------- 6. 自動保存ON: 読み込み中のタブも切り替え時に保存される ----------
  await worker.evaluate(()=>chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:true,backupIntervalHours:0}}));
  await p.evaluate(async base=>{await chrome.tabs.create({windowId:g_dashboardWindowId,url:base+'/slow/loading',active:false});},base);
  await p.waitForTimeout(150);await p.evaluate(()=>handleSwitchSpace('b'));await p.waitForFunction(async()=>getActiveSpaceId(await loadData())==='b'&&!g_isSwitching);
  space=(await storage()).spaces.find(s=>s.id==='a');assert.ok(space.tabs.some(t=>t.url===base+'/slow/loading'),'loading tab kept on auto-save: '+JSON.stringify(space.tabs.map(t=>t.url)));
  assert.equal(space.tabs.length,4);assert.equal(space.tabGroups.length,1);assert.equal(space.tabs.filter(t=>t.groupId===groupId).length,2,'group membership kept through auto-save');
  await worker.evaluate(()=>chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}}));
  console.log('PASS auto-save on switch keeps loading tabs and group membership');
  // ---------- 7. 複数ウィンドウ: それぞれの選択と保存が干渉しない ----------
  const win2=await worker.evaluate(url=>chrome.windows.create({url}),dashboardURL);
  const p2=await wait(async()=>context.pages().find(pg=>pg!==p&&pg.url()===dashboardURL),'second dashboard');p2.on('pageerror',e=>errors.push(e.message));await p2.waitForFunction(()=>g_dashboardWindowId!==null);
  assert.equal(await p2.evaluate(()=>g_dashboardWindowId),win2.id);
  // ウィンドウ2で案件aを選び、独自のタブを保存
  await p2.evaluate(async base=>{await chrome.tabs.create({windowId:g_dashboardWindowId,url:base+'/w2only',active:false})},base);
  await p2.locator('#spaceList [data-space-id="a"]').click();
  // 確認ダイアログが出る場合（現在のスペースがあるとき）は「保存せず切り替える」
  const choice=p2.locator('[data-choice=skip]');try{await choice.waitFor({timeout:1500});await choice.click()}catch{}
  await p2.waitForFunction(async()=>getActiveSpaceId(await loadData())==='a'&&!g_isSwitching);
  // ウィンドウ1の選択は b のまま
  assert.equal(await p.evaluate(async()=>getActiveSpaceId(await loadData())),'b');
  const w1tabsBefore=await p.evaluate(async()=>(await getWindowTabs()).filter(isClosableTab).map(t=>t.pendingUrl||t.url).sort());
  // ウィンドウ2で保存 → aのタブはウィンドウ2の内容になる。bは無傷
  await wait(async()=>(await p2.evaluate(async()=>(await getWindowTabs()).filter(isSavableTab).length))>=4,'window2 tabs opened').catch(async e=>{console.log('DEBUG window2 tabs',JSON.stringify(await p2.evaluate(async()=>(await getWindowTabs()).map(t=>[t.id,t.url,t.pendingUrl,t.status]))),'active',await p2.evaluate(async()=>getActiveSpaceId(await loadData())),'spaceA',JSON.stringify((await storage()).spaces.find(s=>s.id==='a').tabs.map(t=>t.url)));throw e});
  const bBefore=JSON.stringify((await storage()).spaces.find(s=>s.id==='b'));
  await p2.locator('#btnSaveTabs').click();await p2.waitForFunction(()=>document.getElementById('message').textContent.includes('保存'));
  const data2=await storage();assert.equal(JSON.stringify(data2.spaces.find(s=>s.id==='b')),bBefore,'other window space untouched');
  assert.equal(data2.windowActiveSpaces[win2.id],'a');assert.equal(data2.windowActiveSpaces[await p.evaluate(()=>g_dashboardWindowId)],'b');
  // ウィンドウ1のタブはウィンドウ2の操作で変わらない
  assert.deepEqual(await p.evaluate(async()=>(await getWindowTabs()).filter(isClosableTab).map(t=>t.pendingUrl||t.url).sort()),w1tabsBefore);
  // ウィンドウ2を閉じてもデータは残る
  await worker.evaluate(id=>chrome.windows.remove(id),win2.id);await p.waitForTimeout(800);
  const data3=await storage();assert.equal(data3.spaces.length,2);assert.ok(data3.spaces.find(s=>s.id==='a').tabs.length>=4);
  assert.equal(await p.evaluate(async()=>getActiveSpaceId(await loadData())),'b');
  console.log('PASS two windows keep separate selections; saving in one leaves the other intact; closing a window keeps data');
  assert.deepEqual(errors,[],'no page errors');
 }finally{await context.close();server.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
