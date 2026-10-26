const {chromium}=require('/Users/mugikura/node_modules/playwright');const UI=require('./ui.cjs');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 // 外部サイトに依存しないローカルHTTPサーバー
 const server=require('http').createServer((req,res)=>{const delay=/^\/slow/.test(req.url)?3000:0;setTimeout(()=>{res.setHeader('Content-Type','text/html');res.end('<title>Local '+req.url+'</title><p>test</p>')},delay)});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||require('os').tmpdir(),'workspace-tools-'));
 const context=await chromium.launchPersistentContext(dir,{headless:false,args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`chrome-extension://${id}/dashboard.html`);
  await page.waitForFunction(()=>g_dashboardWindowId!==null);
  await page.evaluate(async base=>{
   const data={spaces:[{id:'alpha',name:'案件A',tabs:[],tabGroups:[]},{id:'beta',name:'案件B',tabs:[{url:base+'/beta',title:'B'}],tabGroups:[]}],categories:[],windowActiveSpaces:{}};setActiveSpaceId(data,'alpha');await saveData(data);
   await chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}});
   for(const t of await getWindowTabs())if(isClosableTab(t))await chrome.tabs.remove(t.id);
   await chrome.tabs.create({windowId:g_dashboardWindowId,url:base+'/alpha',active:false});
  },base);
  await page.waitForFunction(()=>document.getElementById('workspaceSaveStatus').textContent.includes('変更あり'));
  await UI.inSettings(page,()=>page.locator('.settings-workspace-actions button').filter({hasText:'現在のタブを保存'}).click());
  await page.waitForFunction(()=>document.getElementById('workspaceSaveStatus').textContent.includes('保存済み'));
  await page.locator('#spaceSearch').fill('案件B');await page.waitForFunction(()=>document.querySelectorAll('.space-search-result').length===1);
  assert.match(await page.locator('#spaceSearchResults').textContent(),/案件B/);
  page.on('dialog',d=>d.accept());await page.locator('.space-search-result').click();await page.locator('[data-choice=skip]').click();
  await page.waitForFunction(async()=>getActiveSpaceId(await loadData())==='beta'&&!g_isSwitching);
  await page.waitForFunction(()=>!document.getElementById('restorePreviousTabs').disabled);
  await UI.inSettings(page,()=>page.locator('#restorePreviousTabs').click());
  await page.waitForFunction(async()=>getActiveSpaceId(await loadData())==='alpha'&&!g_isSwitching);
  const urls=await page.evaluate(async()=>(await getWindowTabs()).filter(isClosableTab).map(t=>t.url||t.pendingUrl));assert.deepEqual(urls,[base+'/alpha']);
  console.log('PASS search, changed/saved states, switch history and real tab restoration');
  // Let the existing 1-second tab-event autosave settle before checking import isolation.
  await page.waitForTimeout(1300);
  const before=await page.evaluate(()=>chrome.storage.local.get('pwm_data'));
  await page.locator('#importFileInput').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({spaces:[{id:'bad',name:'bad',tabs:null}]}))});
  await page.waitForFunction(()=>document.getElementById('message').textContent.includes('失敗'));
  assert.deepEqual(await page.evaluate(()=>chrome.storage.local.get('pwm_data')),before);console.log('PASS invalid import preserves existing data');
  await page.locator('#spaceSearch').fill('');
  // Simulated API error must keep the existing live tabs intact.
  await page.evaluate(()=>{globalThis.originalCreate=chrome.tabs.create;chrome.tabs.create=async()=>{throw Error('simulated create failure')}});
  await UI.inSettings(page,()=>page.locator('#restorePreviousTabs').click());await page.waitForFunction(()=>document.getElementById('message').textContent.includes('復元に失敗'));
  assert.deepEqual(await page.evaluate(async()=>(await getWindowTabs()).filter(isClosableTab).map(t=>t.url||t.pendingUrl)),urls);
  await page.evaluate(()=>{chrome.tabs.create=originalCreate});console.log('PASS restore failure retains current tabs');
  const panel=await context.newPage();await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  await panel.evaluate(()=>{document.documentElement.classList.add('left-layout-verified');document.querySelector('.app').hidden=false;chrome.sidePanel.getLayout=async()=>({side:'left'})});
  for(const width of [280,360,430]){await panel.setViewportSize({width,height:900});await panel.waitForTimeout(250);assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await panel.screenshot({path:`evidence/workspace-tools-${width}.png`});}
  assert.deepEqual(errors,[]);console.log('PASS panel widths 280/360/430 and no page errors');
 }finally{await context.close();server.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
