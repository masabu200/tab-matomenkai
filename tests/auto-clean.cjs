const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-autoclean-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const DAY=86400000;const ago=d=>new Date(Date.now()-d*DAY).toISOString();
  const space=(sid,name,extra)=>({id:sid,name,tabs:[{url:'https://x.example/'+sid,title:sid}],categoryId:null,archived:false,color:'',createdAt:ago(200),updatedAt:ago(200),...extra});
  const seed=spaces=>worker.evaluate(s=>chrome.storage.local.set({pwm_data:{spaces:s,categories:[],activeSpaceId:'current',windowActiveSpaces:{}}}),spaces);
  await seed([space('current','使用中',{lastOpenedAt:ago(1)}),space('old1','古い1'),space('old2','古い2'),space('fav','お気に入り',{favorite:true})]);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  await page.locator('#openSettings').click();
  const status=()=>page.locator('#autoCleanStatus').textContent();
  // default off; run now only hints
  assert.equal(await page.locator('#autoCleanDays').inputValue(),'0');
  await page.locator('#autoCleanRun').click();await page.waitForFunction(()=>document.getElementById('autoCleanStatus').textContent.includes('期間を選ぶ'));
  // 30 days + archive: two stale spaces archived; current/favorite untouched; sidebar reflects it
  await page.locator('#autoCleanDays').selectOption('30');await page.locator('#autoCleanAction').selectOption('archive');
  await page.waitForFunction(async()=>((await chrome.storage.local.get('pwm_settings')).pwm_settings||{}).autoCleanDays===30);
  await page.locator('#autoCleanRun').click();await page.waitForFunction(()=>document.getElementById('autoCleanStatus').textContent.includes('アーカイブ 2 件、削除 0 件'));
  let data=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);
  assert.deepEqual(data.spaces.filter(s=>s.archived).map(s=>s.id).sort(),['old1','old2']);assert.equal(data.spaces.length,4);
  assert.ok(data.spaces.find(s=>s.id==='old1').autoArchived);
  // running again does nothing more
  await page.locator('#autoCleanRun').click();await page.waitForFunction(()=>document.getElementById('autoCleanStatus').textContent.includes('アーカイブ 0 件、削除 0 件'));
  // delete mode: a new stale space goes to the trash; the worker entry point works too
  await seed([space('current','使用中',{lastOpenedAt:ago(1)}),space('old3','古い3'),space('fav','お気に入り',{favorite:true})]);
  await page.locator('#autoCleanAction').selectOption('delete');
  await page.waitForFunction(async()=>((await chrome.storage.local.get('pwm_settings')).pwm_settings||{}).autoCleanAction==='delete');
  const result=await worker.evaluate(()=>pwmRunAutoClean());
  assert.equal(result.deleted,1);assert.deepEqual(result.names,['古い3']);
  data=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);assert.deepEqual(data.spaces.map(s=>s.id),['current','fav']);
  const trash=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_trash')).pwm_trash);assert.equal(trash.length,1);assert.equal(trash[0].space.id,'old3');
  // trash list shows it; restore brings it back and empties the trash
  await page.locator('#closeSettings').click();await page.locator('#openSettings').click();
  await page.waitForFunction(()=>document.querySelectorAll('#autoCleanTrash button').length===1);
  assert.match(await page.locator('#autoCleanTrash li').first().textContent(),/古い3（1 タブ）/);
  assert.match(await page.locator('#autoCleanLast').textContent(),/前回の自動整理/);
  await page.locator('#autoCleanTrash button').click();await page.waitForFunction(()=>document.getElementById('autoCleanStatus').textContent.includes('「古い3」をゴミ箱から戻しました'));
  data=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);assert.ok(data.spaces.some(s=>s.id==='old3'&&!s.archived));
  assert.equal((await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_trash')).pwm_trash)).length,0);
  assert.match(await page.locator('#autoCleanTrash').textContent(),/ゴミ箱は空です/);
  // old trash entries are purged on the next run
  await worker.evaluate(ago=>chrome.storage.local.set({pwm_trash:[{deletedAt:ago,reason:'auto',space:{id:'ancient',name:'古代',tabs:[]}}]}),ago(31));
  await worker.evaluate(()=>pwmRunAutoClean());
  assert.equal((await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_trash')).pwm_trash)).length,0,'31-day-old trash purged');
  // alarm registered by the worker
  const alarms=await worker.evaluate(()=>chrome.alarms.getAll());assert.ok(alarms.some(a=>a.name==='pwm-auto-clean'),JSON.stringify(alarms));
  assert.deepEqual(errors,[]);
  console.log('PASS auto clean: off hint; 30d archive skips current/favorite; idempotent; delete→trash via worker; trash list/restore; 30-day purge; alarm registered; no page errors');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
