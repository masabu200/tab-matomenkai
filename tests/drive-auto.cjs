const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-drive-auto-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  // Mock Google inside the service worker: identity + Drive REST (fetch).
  await worker.evaluate(()=>{
   globalThis.mock={uploads:[],tokenMode:'ok',uploadStatus:200,seq:0};
   chrome.identity.getAuthToken=async({interactive,scopes})=>{if(mock.tokenMode==='deny')throw new Error('denied');return {token:'auto-token',grantedScopes:scopes}};
   chrome.identity.removeCachedAuthToken=async()=>{};
   const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
   globalThis.fetch=async(url,init={})=>{
    const u=new URL(url);const method=(init.method||'GET').toUpperCase();
    if(u.pathname.startsWith('/upload/drive/v3/files')){if(mock.uploadStatus!==200)return json(mock.uploadStatus,{error:{}});mock.uploads.push(String(init.body).length);return json(200,{id:'auto'+(++mock.seq),name:'x.json'})}
    if(u.pathname==='/drive/v3/files'&&method==='GET'&&(u.searchParams.get('q')||'').includes("'folder'"))return json(200,{files:[{id:'folder1'}]});
    if(u.pathname==='/drive/v3/files'&&method==='GET')return json(200,{files:[]});
    if(u.pathname.startsWith('/drive/v3/files/')&&method==='GET')return json(200,{id:'folder1',trashed:false});
    return json(200,{});
   };
  });
  const tick=opts=>worker.evaluate(o=>pwmDriveAutoTick(o).then(r=>({action:r.action,error:r.error||'',state:r.state})),opts||{});
  const state=()=>worker.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_auto')).pwm_drive_auto||{});
  const H=3600000;const t0=await worker.evaluate(()=>Date.now());
  // development install → entitled
  assert.deepEqual(await worker.evaluate(()=>Entitlements.status()),{pro:true,reason:'development'});
  // alarm registered on install
  assert.ok((await worker.evaluate(()=>chrome.alarms.getAll())).some(a=>a.name==='pwm-drive-auto'));
  // off by default
  assert.equal((await tick()).action,'disabled');
  await worker.evaluate(()=>chrome.storage.local.set({pwm_data:{spaces:[{id:'s1',name:'A',tabs:[{url:'https://a.example/',title:'A'}]}],categories:[]}}));
  await worker.evaluate(()=>DriveAuto.setEnabled(true,6));
  assert.equal((await tick()).action,'not-connected');
  await worker.evaluate(()=>chrome.storage.local.set({pwm_drive_connected:true}));
  // just edited → waits for the quiet period, then saves
  assert.equal((await tick({now:t0})).action,'settling');
  let r=await tick({now:t0+6*60000});assert.equal(r.action,'saved',JSON.stringify(r));
  assert.equal(await worker.evaluate(()=>mock.uploads.length),1);
  // nothing changed → no upload even much later
  assert.equal((await tick({now:t0+30*H})).action,'unchanged');
  // change again → too soon within 6h, saves after the interval
  await worker.evaluate(()=>chrome.storage.local.set({pwm_data:{spaces:[{id:'s1',name:'A2',tabs:[]}],categories:[]}}));
  assert.equal((await tick({now:t0+2*H})).action,'too-soon');
  r=await tick({now:t0+7*H});assert.equal(r.action,'saved');assert.equal(await worker.evaluate(()=>mock.uploads.length),2);
  // server error → backoff, retried later, then succeeds
  await worker.evaluate(()=>{chrome.storage.local.set({pwm_data:{spaces:[{id:'s1',name:'A3',tabs:[]}],categories:[]}});mock.uploadStatus=500});
  r=await tick({now:t0+20*H});assert.equal(r.action,'failed');assert.equal(r.state.failures,1);assert.ok(r.state.nextRetryAt>t0+20*H);
  assert.equal((await tick({now:t0+20*H+60000})).action,'backoff');
  await worker.evaluate(()=>{mock.uploadStatus=200});
  r=await tick({now:t0+21*H});assert.equal(r.action,'saved');assert.equal(r.state.failures,0);
  // auth lost → stops retrying, badge shows "!", reconnect clears it
  await worker.evaluate(()=>{chrome.storage.local.set({pwm_data:{spaces:[{id:'s1',name:'A4',tabs:[]}],categories:[]}});mock.tokenMode='deny'});
  r=await tick({now:t0+40*H});assert.equal(r.action,'needs-reconnect');assert.equal(r.state.needsReconnect,true);
  assert.equal(await worker.evaluate(()=>chrome.action.getBadgeText({})),'!');
  assert.equal((await tick({now:t0+60*H})).action,'needs-reconnect','no retry loop while disconnected');
  await worker.evaluate(async()=>{mock.tokenMode='ok';await chrome.storage.local.set({pwm_drive_connected:false});await chrome.storage.local.set({pwm_drive_connected:true})});
  await new Promise(res=>setTimeout(res,300));
  assert.equal((await state()).needsReconnect,false);assert.equal(await worker.evaluate(()=>chrome.action.getBadgeText({})),'');
  r=await tick({now:t0+61*H});assert.equal(r.action,'saved');
  // settings UI: enabled state shown, run-now goes through the worker
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  await page.locator('#openSettings').click();
  assert.equal(await page.locator('#driveAutoEnabled').isChecked(),true);assert.equal(await page.locator('#driveAutoEnabled').isDisabled(),false);
  assert.match(await page.locator('#driveAutoStatus').textContent(),/前回の自動保存/);
  const cb=await page.locator('#driveAutoEnabled').boundingBox();assert.ok(cb.width<40,'checkbox keeps its natural size: '+JSON.stringify(cb));
  // not connected: run-now explains why instead of doing nothing
  await worker.evaluate(()=>chrome.storage.local.set({pwm_drive_connected:false}));
  await page.locator('#driveAutoRunNow').click();await page.waitForFunction(()=>document.getElementById('driveAutoResult').textContent.includes('Googleドライブに接続'));
  await worker.evaluate(()=>chrome.storage.local.set({pwm_drive_connected:true}));await page.waitForTimeout(300);
  const before=await worker.evaluate(()=>mock.uploads.length);
  await page.locator('#driveAutoRunNow').click();await page.waitForFunction(()=>document.getElementById('driveAutoResult').textContent.includes('保存しました'));
  await page.waitForTimeout(500);assert.match(await page.locator('#driveAutoResult').textContent(),/保存しました/,'result is not overwritten by the status refresh');
  assert.equal(await worker.evaluate(()=>mock.uploads.length),before+1,'run now forces a save');
  await page.locator('#driveAutoEnabled').uncheck();await page.waitForFunction(async()=>((await chrome.storage.local.get('pwm_drive_auto')).pwm_drive_auto||{}).enabled===false);
  assert.match(await page.locator('#driveAutoStatus').textContent(),/オフ/);
  // a store install (not development) sees it locked
  const locked=await context.newPage();await locked.addInitScript(()=>{const real=chrome.management.getSelf;chrome.management.getSelf=async()=>({...(await real()),installType:'normal'})});
  await locked.goto(`chrome-extension://${id}/dashboard.html`);await locked.waitForFunction(()=>g_dashboardWindowId!==null);await locked.locator('#openSettings').click();
  await locked.waitForFunction(()=>document.getElementById('driveAutoStatus').textContent.includes('Pro'));
  assert.equal(await locked.locator('#driveAutoEnabled').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS drive auto: dev entitlement, alarm, off by default, needs connection, quiet period, saves only changes, interval, server-error backoff then recovery, auth loss stops retries with badge and reconnect clears, settings status and run-now, store install locked');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
