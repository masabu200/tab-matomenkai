const {chromium}=require('/Users/mugikura/node_modules/playwright');const UI=require('./ui.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('node:assert/strict');
// タブの一括操作: 選択（Shift範囲・全選択・Esc・⌘A）、開く、別スペースへ移動、グループへ、アーカイブ、削除
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Local '+req.url+'</title><p>test</p>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'bulk-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.setViewportSize({width:1280,height:800});
  await p.goto(`chrome-extension://${id}/dashboard.html`);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  const storage=()=>worker.evaluate(()=>chrome.storage.local.get('pwm_data').then(r=>r.pwm_data));
  const tabsOf=async sid=>(await storage()).spaces.find(s=>s.id===sid).tabs;
  await p.evaluate(async base=>{const t=(i,g)=>({title:'T'+i,url:base+'/t'+i,groupId:g||null});
   const d={categories:[],windowActiveSpaces:{},spaces:[{id:'a',name:'案件A',tabs:[t(0,'g1'),t(1,'g1'),t(2),t(3),t(4),t(5)],tabGroups:[{id:'g1',name:'参考',color:'blue',collapsed:false}]},{id:'b',name:'案件B',tabs:[t(3)],tabGroups:[]}]};
   setActiveSpaceId(d,'a');await saveData(d);await chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}})},base);
  await p.waitForSelector('.tab-card[data-tab-index="5"]');await p.waitForTimeout(200);
  const box=i=>p.locator(`.tab-card__checkbox[data-tab-index="${i}"]`);
  const count=()=>p.evaluate(()=>BulkActions.selected.size);
  // バーは表示、未選択なら操作は無効
  assert.equal(await p.locator('#bulkBar').isVisible(),true);assert.equal(await p.locator('#bulkOpen').isDisabled(),true);assert.match(await p.locator('#bulkCount').textContent(),/0件/);
  // 範囲選択: 表示順は グループなし(2,3,4,5) → グループ(0,1)
  await box(2).click();await box(5).click({modifiers:['Shift']});assert.equal(await count(),4);assert.deepEqual(await p.evaluate(()=>[...BulkActions.selected].sort()),[2,3,4,5]);
  assert.equal(await p.locator('.tab-card--selected').count(),4);assert.equal(await p.locator('#bulkSelectAll').evaluate(e=>e.indeterminate),true);
  await p.locator('#bulkSelectAll').click();assert.equal(await count(),6);await p.locator('#bulkClear').click();assert.equal(await count(),0);
  await box(0).click();await p.locator('h2#spaceTitle').click();await p.keyboard.press('Escape');assert.equal(await count(),0);
  await p.keyboard.press('ControlOrMeta+a');assert.equal(await count(),6);await p.keyboard.press('Escape');
  console.log('PASS selection: shift range, select all, clear, Esc, Cmd/Ctrl+A');
  // 開く
  await box(3).click();await box(4).click();await p.locator('#bulkOpen').click();
  await UI.waitForAsync(p,async base=>{const urls=(await getWindowTabs()).map(t=>t.pendingUrl||t.url);return urls.includes(base+'/t3')&&urls.includes(base+'/t4')},base,'tabs opened');
  assert.equal(await count(),0);assert.equal((await tabsOf('a')).length,6,'open does not change saved tabs');
  console.log('PASS open selected tabs in the window');
  // 別スペースへ移動（同じURLは除外）
  await box(2).click();await box(3).click();await p.locator('#bulkMoveTarget').selectOption('b');await p.locator('#bulkMove').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].tabs.length===4,null,'moved');
  assert.deepEqual((await tabsOf('a')).map(t=>t.title),['T0','T1','T4','T5']);assert.deepEqual((await tabsOf('b')).map(t=>t.title),['T3','T2']);
  assert.match(await p.locator('#message').textContent(),/1枚移動/);assert.match(await p.locator('#message').textContent(),/除外/);
  console.log('PASS move to another space with duplicate skipped');
  // グループへ（既存グループ）
  await p.waitForSelector('.tab-card[data-tab-index="3"]');await box(2).click();await box(3).click();await p.locator('#bulkGroupTarget').selectOption('g1');await p.locator('#bulkGroup').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].tabs.every(t=>t.groupId==='g1'),null,'grouped');
  // グループから外す
  await p.waitForSelector('.tab-card[data-tab-index="3"]');await box(3).click();await p.locator('#bulkGroupTarget').selectOption('none');await p.locator('#bulkGroup').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].tabs[3].groupId===null,null,'ungrouped');
  console.log('PASS move selected tabs into a group and out of it');
  // アーカイブ
  await p.waitForSelector('.tab-card[data-tab-index="3"]');await box(3).click();await p.locator('#bulkArchive').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].archivedTabs.length===1,null,'archived');
  assert.equal((await tabsOf('a')).length,3);assert.equal((await storage()).spaces[0].archivedTabs[0].title,'T5');
  console.log('PASS archive selected tabs');
  // 削除（確認ダイアログあり）
  await p.waitForSelector('.tab-card[data-tab-index="2"]');await box(0).click();await box(2).click();await p.locator('#bulkDelete').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].tabs.length===1,null,'deleted');
  assert.deepEqual((await tabsOf('a')).map(t=>t.title),['T1']);assert.equal(await count(),0);
  console.log('PASS delete selected tabs after confirmation');
  // 絞り込み中の全選択は表示中だけ、スペース切替で選択解除
  await p.evaluate(async()=>{const d=await loadData();d.spaces[0].tabs.push({title:'別件',url:'https://example.com/x',groupId:null});await saveData(d);await renderAll()});
  await p.waitForSelector('.tab-card[data-tab-index="1"]');await p.locator('#searchInput').fill('別件');await p.waitForFunction(()=>document.querySelectorAll('.tab-card').length===1);
  await p.locator('#bulkSelectAll').click();assert.equal(await count(),1);await p.locator('#searchInput').fill('');await p.waitForFunction(()=>document.querySelectorAll('.tab-card').length===2);assert.equal(await count(),1);
  await p.locator('#spaceList [data-space-id="b"]').click();await p.locator('[data-choice=skip]').click();await UI.waitForAsync(p,async()=>getActiveSpaceId(await loadData())==='b'&&!g_isSwitching,null,'switched');
  await p.waitForSelector('.tab-card[data-tab-index="1"]');await p.waitForTimeout(200);assert.equal(await count(),0,'selection cleared after switching space');
  const opts=await p.locator('#bulkMoveTarget option').allTextContents();assert.ok(opts.includes('案件A')&&!opts.includes('案件B'),'move targets exclude current space');
  console.log('PASS filtered select-all and selection reset on space switch');
  assert.deepEqual(errors,[]);
 }finally{await context.close();server.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
