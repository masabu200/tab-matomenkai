const {chromium}=require('/Users/mugikura/node_modules/playwright');const UI=require('./ui.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('node:assert/strict');
// 元に戻す／URL一覧コピー／右クリック保存／サイドバーのホバーで高さが変わらないこと
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Local '+req.url+'</title><p>test</p>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'undo-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.setViewportSize({width:1280,height:800});
  await p.goto(`chrome-extension://${id}/dashboard.html`);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  const storage=()=>worker.evaluate(()=>chrome.storage.local.get('pwm_data').then(r=>r.pwm_data));
  const tabsOf=async sid=>(await storage()).spaces.find(s=>s.id===sid).tabs;
  const seed=async()=>{await p.evaluate(async base=>{const t=(i,g)=>({title:'T'+i,url:base+'/t'+i,groupId:g||null});
   const d={categories:[{id:'c1',name:'カテゴリー',collapsed:false,color:'#4a7ef8'}],windowActiveSpaces:{},spaces:[{id:'a',name:'案件A',categoryId:'c1',tabs:[t(0,'g1'),t(1),t(2),t(3)],tabGroups:[{id:'g1',name:'参考',color:'blue',collapsed:false}],archivedTabs:[]},{id:'b',name:'案件B',tabs:[],tabGroups:[]},{id:'z',name:'保管',archived:true,tabs:[]}]};
   setActiveSpaceId(d,'a');await saveData(d);await chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}});await renderAll()},base);await p.waitForSelector('.tab-card[data-tab-index="3"]');await p.waitForTimeout(150)};
  await seed();
  const box=i=>p.locator(`.tab-card__checkbox[data-tab-index="${i}"]`);
  // ---------- サイドバーのホバーで行の高さが変わらない ----------
  const header=p.locator('[data-category-id="c1"] .cat-group__header');
  const before=await header.evaluate(e=>e.getBoundingClientRect().height);await header.hover();await p.waitForTimeout(250);
  const during=await header.evaluate(e=>e.getBoundingClientRect().height);assert.equal(await header.locator('.cat-group__actions').evaluate(e=>getComputedStyle(e).visibility),'visible');
  await p.mouse.move(700,400);await p.waitForTimeout(250);const after=await header.evaluate(e=>e.getBoundingClientRect().height);
  assert.equal(before,during,`category row height changes on hover: ${before} -> ${during}`);assert.equal(during,after);assert.ok(before>=38&&before<=44,'row height '+before);
  const spaceRow=p.locator('#spaceList [data-space-id="a"]');const sh1=await spaceRow.evaluate(e=>e.getBoundingClientRect().height);await spaceRow.hover();await p.waitForTimeout(250);assert.equal(await spaceRow.evaluate(e=>e.getBoundingClientRect().height),sh1);
  console.log('PASS sidebar rows keep their height on hover');
  // ---------- 元に戻す: カード単体の削除 ----------
  await p.locator('.tab-card[data-tab-index="1"] .tab-card__delete').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].tabs.length===3,null,'deleted');
  await p.waitForSelector('#undoToast:not([hidden])');assert.match(await p.locator('#undoToast').textContent(),/削除/);
  await p.locator('#undoButton').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].tabs.length===4,null,'restored');
  assert.deepEqual((await tabsOf('a')).map(t=>[t.title,t.groupId]),[['T0','g1'],['T1',null],['T2',null],['T3',null]]);
  assert.equal(await p.locator('#undoToast').isHidden(),true);await p.waitForFunction(()=>document.getElementById('message').textContent.includes('元に戻しました'));
  console.log('PASS undo single delete restores order and group');
  // ---------- 元に戻す: 一括アーカイブを ⌘/Ctrl+Z で ----------
  await p.waitForSelector('.tab-card[data-tab-index="3"]');await box(2).click();await box(3).click();await p.locator('#bulkArchive').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].archivedTabs.length===2,null,'archived');
  await p.waitForSelector('#undoToast:not([hidden])');await p.locator('h2#spaceTitle').click();await p.keyboard.press('ControlOrMeta+z');
  await UI.waitForAsync(p,async()=>{const s=(await loadData()).spaces[0];return s.tabs.length===4&&s.archivedTabs.length===0},null,'bulk archive undone');
  console.log('PASS undo bulk archive via Cmd/Ctrl+Z');
  // ---------- 元に戻す: その後に変更があれば中止 ----------
  await p.waitForSelector('.tab-card[data-tab-index="3"]');await box(0).click();await p.locator('#bulkDelete').click();
  await UI.waitForAsync(p,async()=>(await loadData()).spaces[0].tabs.length===3,null,'bulk deleted');
  await p.waitForSelector('#undoToast:not([hidden])');
  await p.evaluate(async()=>{const d=await loadData();d.spaces[0].tabs.push({title:'後から',url:'https://example.com/later',groupId:null});d.spaces[0].updatedAt=new Date(Date.now()+1000).toISOString();await saveData(d)});
  await p.locator('#undoButton').click();await p.waitForFunction(()=>document.getElementById('message').textContent.includes('中止'));
  assert.equal((await tabsOf('a')).length,4);assert.ok(!(await tabsOf('a')).some(t=>t.title==='T0'),'deleted tab stays deleted');
  // 閉じるボタン
  await seed();await box(1).click();await p.locator('#bulkDelete').click();await p.waitForSelector('#undoToast:not([hidden])');await p.locator('.undo-toast__close').click();assert.equal(await p.locator('#undoToast').isHidden(),true);
  console.log('PASS undo refuses after later changes; toast can be closed');
  // ---------- URL一覧コピー ----------
  await seed();await p.evaluate(()=>{navigator.clipboard.writeText=t=>{window.__copied=t;return Promise.resolve()}});
  await box(0).click();await box(2).click();await p.locator('#bulkCopyFormat').selectOption('md');await p.locator('#bulkCopy').click();
  await p.waitForFunction(()=>document.getElementById('message').textContent.includes('コピー'));
  assert.equal(await p.evaluate(()=>window.__copied),`- [T0](${base}/t0)\n- [T2](${base}/t2)`);assert.match(await p.locator('#message').textContent(),/2件をMarkdown/);
  await p.locator('#bulkClear').click();await p.locator('#bulkCopyFormat').selectOption('urls');await p.locator('#bulkCopy').click();await p.waitForFunction(()=>document.getElementById('message').textContent.includes('4件'));
  assert.equal(await p.evaluate(()=>window.__copied),[0,1,2,3].map(i=>`${base}/t${i}`).join('\n'));
  await p.locator('#bulkCopyFormat').selectOption('text');await p.locator('#bulkCopy').click();await p.waitForFunction(()=>document.getElementById('message').textContent.includes('タイトルとURL'));
  assert.ok((await p.evaluate(()=>window.__copied)).startsWith(`T0\n${base}/t0\n\nT1\n`));
  console.log('PASS copy selected/all tabs as Markdown, URLs, title+URL');
  // ---------- 右クリック保存（background のハンドラとメニュー再構築） ----------
  assert.equal(await worker.evaluate(()=>typeof chrome.contextMenus),'object','contextMenus permission');
  await worker.evaluate(()=>rebuildContextMenus());
  const r1=await worker.evaluate(base=>pwmSaveTabToSpace('b',{url:base+'/from-menu',title:'Menu page',favIconUrl:''}),base);assert.deepEqual([r1.ok,r1.name,r1.count],[true,'案件B',1]);
  const r2=await worker.evaluate(base=>pwmSaveTabToSpace('b',{url:base+'/from-menu',title:'again'}),base);assert.equal(r2.reason,'duplicate');
  assert.equal((await worker.evaluate(()=>pwmSaveTabToSpace('z',{url:'https://example.com/x',title:'x'}))).reason,'missing');
  assert.equal((await worker.evaluate(()=>pwmSaveTabToSpace('b',{url:'chrome://settings',title:'x'}))).reason,'unsupported');
  assert.deepEqual((await tabsOf('b')).map(t=>[t.title,t.url,t.groupId]),[['Menu page',base+'/from-menu',null]]);assert.equal((await tabsOf('a')).length,4,'other space untouched');
  // ダッシュボード側に反映される（スペースBのバッジ）
  await p.waitForFunction(()=>document.querySelector('#spaceList [data-space-id="b"] .space-item__badge')?.textContent.trim()==='1');
  console.log('PASS context-menu save handler: add, duplicate, archived/missing, unsupported URL; dashboard updates');
  assert.deepEqual(errors,[]);
 }finally{await context.close();server.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
