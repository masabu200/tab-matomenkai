const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
// Pro purchase flow against a simulated billing worker, as a store (non-development) install.
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-billing-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  // --- service worker: entitlement rules ---
  await worker.evaluate(()=>{
   const real=chrome.management.getSelf;chrome.management.getSelf=async()=>({...(await real()),installType:'normal'});
   globalThis.server={pro:false,status:'none',until:0,down:false,calls:[]};
   globalThis.fetch=async(url,init={})=>{
    const u=new URL(url);server.calls.push(u.pathname+u.search+(init.body?' '+init.body:''));
    if(server.down)throw new TypeError('Failed to fetch');
    const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
    if(u.pathname==='/v1/entitlement')return json(200,{pro:server.pro,status:server.status,until:server.until,cancelAtPeriodEnd:false});
    return json(404,{error:'not found'});
   };
  });
  const st=(o)=>worker.evaluate(o=>Entitlements.status(o).then(s=>({pro:s.pro,reason:s.reason,status:s.status})),o||{});
  // not configured yet → purchases unavailable, Pro off
  await worker.evaluate(()=>{BillingConfig.apiBase='';Entitlements.reset()});
  assert.deepEqual(await st(),{pro:false,reason:'unavailable',status:undefined});
  assert.equal(await worker.evaluate(()=>Entitlements.has('driveAutoSave')),false);
  // configured, not bought
  await worker.evaluate(()=>{BillingConfig.apiBase='https://billing.example/';Entitlements.reset()});
  assert.deepEqual(await st(),{pro:false,reason:'not-purchased',status:'none'});
  const account=await worker.evaluate(()=>Entitlements.accountId());
  assert.match(account,/^[0-9a-f]{64}$/);assert.equal(await worker.evaluate(()=>Entitlements.accountId()),account,'id is stable');
  assert.equal((await worker.evaluate(()=>chrome.storage.sync.get('pwm_account_id'))).pwm_account_id,account,'kept in sync storage');
  assert.ok((await worker.evaluate(()=>server.calls))[0].includes(account));
  // bought → refresh turns Pro on and caches it; a fresh cached answer does not hit the server again
  await worker.evaluate(()=>{server.pro=true;server.status='active';server.until=Date.now()+30*86400000});
  assert.deepEqual(await st({force:true}),{pro:true,reason:'purchased',status:'active'});
  const callsBefore=(await worker.evaluate(()=>server.calls)).length;
  await worker.evaluate(()=>Entitlements.reset());assert.equal((await st()).pro,true);
  assert.equal((await worker.evaluate(()=>server.calls)).length,callsBefore,'served from the 6h cache');
  // server unreachable: Pro is kept for the grace period, then dropped
  await worker.evaluate(()=>{server.down=true});
  assert.deepEqual(await st({force:true}),{pro:true,reason:'offline-grace',status:'active'});
  const late=await worker.evaluate(()=>Entitlements.status({force:true,now:Date.now()+8*86400000}).then(s=>({pro:s.pro,reason:s.reason})));
  assert.deepEqual(late,{pro:false,reason:'offline'});
  // cancelled at the server → Pro off on the next check
  await worker.evaluate(()=>{server.down=false;server.pro=false;server.status='canceled'});
  assert.deepEqual(await st({force:true}),{pro:false,reason:'not-purchased',status:'canceled'});
  // auto backup follows the entitlement
  await worker.evaluate(()=>chrome.storage.local.set({pwm_drive_connected:true,pwm_drive_auto:{enabled:true,intervalHours:6}}));
  assert.equal((await worker.evaluate(()=>pwmDriveAutoTick({force:true}))).action,'not-entitled');
  // carrying an id over: invalid rejected, valid replaces the id and clears the cache
  assert.equal(await worker.evaluate(()=>Entitlements.setAccountId('xyz').then(()=>'ok',()=>'rejected')),'rejected');
  await worker.evaluate(()=>{server.pro=true;server.status='active'});
  await worker.evaluate(id=>Entitlements.setAccountId(id.toUpperCase()),'b'.repeat(64));
  assert.equal(await worker.evaluate(()=>Entitlements.accountId()),'b'.repeat(64));
  assert.deepEqual(await st(),{pro:true,reason:'purchased',status:'active'},'cache cleared by the id change');

  // --- settings page: the Pro card ---
  await worker.evaluate(()=>chrome.storage.local.remove('pwm_entitlement'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
   const real=chrome.management.getSelf;chrome.management.getSelf=async()=>({...(await real()),installType:'normal'});
   window.server={pro:false,status:'none',until:0,opened:[],posts:[]};
   chrome.tabs.create=async({url})=>{server.opened.push(url);return {id:1}};
   window.fetch=async(url,init={})=>{
    const u=new URL(url);const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
    if(u.hostname!=='billing.example')return new Response('',{status:404});
    if(u.pathname==='/v1/entitlement')return json(200,{pro:server.pro,status:server.status,until:server.until,cancelAtPeriodEnd:server.cancel||false});
    if(u.pathname==='/v1/checkout'){server.posts.push(JSON.parse(init.body));return json(200,{url:'https://checkout.stripe.com/c/test'})}
    if(u.pathname==='/v1/portal'){server.posts.push(JSON.parse(init.body));return json(200,{url:'https://billing.stripe.com/p/test'})}
    return json(404,{error:'not found'});
   };
   Object.defineProperty(window,'BillingConfig',{configurable:true,get(){return {apiBase:'https://billing.example'}},set(){}});
  });
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  await page.locator('#openSettings').click();
  await page.waitForFunction(()=>document.getElementById('billingStatus').textContent.includes('無料版'));
  assert.equal(await page.locator('#billingBuy').isVisible(),true);
  assert.equal(await page.locator('#billingManage').isVisible(),false,'nothing to manage before buying');
  assert.equal(await page.locator('#billingLegal').isVisible(),true,'terms / 特商法 / privacy links next to the buy button');
  assert.deepEqual(await page.locator('#billingLegal a').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),['https://billing.example/terms','https://billing.example/tokushoho','https://billing.example/privacy']);
  assert.match(await page.locator('#driveAutoStatus').textContent(),/設定の「Pro 版」から購入/);
  // buy → opens Stripe Checkout with this install's id
  await page.locator('#billingBuy').click();
  await page.waitForFunction(()=>server.opened.length===1);
  assert.equal(await page.evaluate(()=>server.opened[0]),'https://checkout.stripe.com/c/test');
  const pageAccount=await page.evaluate(()=>Entitlements.accountId());
  assert.deepEqual(await page.evaluate(()=>server.posts[0]),{account:pageAccount});
  assert.match(await page.locator('#billingResult').textContent(),/自動で確認/);
  // paid in the other tab, then back → checked automatically, card and auto-backup unlock
  await page.evaluate(()=>{server.pro=true;server.status='active';server.until=Date.UTC(2026,10,29)});
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForFunction(()=>document.getElementById('billingStatus').textContent.includes('ご利用中'));
  assert.match(await page.locator('#billingStatus').textContent(),/2026/);
  assert.equal(await page.locator('#billingBuy').isVisible(),false);
  assert.equal(await page.locator('#billingManage').isVisible(),true);
  await page.waitForFunction(()=>!document.getElementById('driveAutoEnabled').disabled);
  // manage → customer portal
  await page.locator('#billingManage').click();await page.waitForFunction(()=>server.opened.length===2);
  assert.equal(await page.evaluate(()=>server.opened[1]),'https://billing.stripe.com/p/test');
  // canceled at period end
  await page.evaluate(()=>{server.cancel=true});await page.locator('#billingCheck').click();
  await page.waitForFunction(()=>document.getElementById('billingStatus').textContent.includes('解約済み'));
  // purchase id: shown, invalid input rejected
  await page.locator('.billing-id summary').click();
  assert.equal(await page.locator('#billingId').textContent(),pageAccount);
  await page.locator('#billingIdInput').fill('abc');await page.locator('#billingIdApply').click();
  await page.waitForFunction(()=>document.getElementById('billingResult').textContent.includes('正しくありません'));
  const box=await page.locator('.billing-settings').boundingBox();assert.ok(box&&box.width>200,'card is laid out: '+JSON.stringify(box));
  await page.screenshot({path:path.join(process.env.TMPDIR||os.tmpdir(),'billing-settings.png'),fullPage:false});
  // development install keeps Pro without asking the server, and hides the buy buttons
  const dev=await context.newPage();await dev.goto(`chrome-extension://${id}/dashboard.html`);await dev.waitForFunction(()=>g_dashboardWindowId!==null);
  await dev.locator('#openSettings').click();await dev.waitForFunction(()=>document.getElementById('billingStatus').textContent.includes('開発版'));
  assert.equal(await dev.locator('#billingBuy').isVisible(),false);
  // live-test switch: an unpacked build goes through the server check instead
  await worker.evaluate(()=>chrome.storage.local.set({pwm_billing_live_test:true}));
  const viaServer=await worker.evaluate(async()=>{const real=chrome.management.getSelf;chrome.management.getSelf=async()=>({...(await real()),installType:'development'});const s=await Entitlements.status();chrome.management.getSelf=real;return s.reason});
  assert.notEqual(viaServer,'development');
  await worker.evaluate(()=>chrome.storage.local.remove('pwm_billing_live_test'));
  assert.deepEqual(errors,[]);
  console.log('PASS billing: unavailable until configured, stable synced purchase id, purchased → Pro with 6h cache, offline grace then off, cancel turns Pro off, auto backup follows, id transfer, settings card buy/return check/manage/canceling/id, dev install stays Pro');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
