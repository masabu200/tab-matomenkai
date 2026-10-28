const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-review-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const DAY=86400000;const state=()=>worker.evaluate(async()=>(await chrome.storage.local.get('pwm_review')).pwm_review);
  const setState=s=>worker.evaluate(s=>chrome.storage.local.set({pwm_review:s}),s);
  const open=async()=>{const p=await context.newPage();await p.addInitScript(()=>{globalThis.createdTabs=[];chrome.tabs.create=async o=>{globalThis.createdTabs.push(o.url);return {id:1}};});await p.goto(`chrome-extension://${id}/dashboard.html`);await p.waitForFunction(()=>g_dashboardWindowId!==null);return p;};
  // fresh install: installedAt recorded by the worker, first visit records today, nothing shown
  let page=await open();await page.waitForTimeout(2000);
  let s=await state();assert.ok(s.installedAt>0,'installedAt set on install');assert.equal(s.days.length,1);
  assert.equal(await page.locator('#reviewPrompt').count(),0,'not shown on first day');
  // pure trigger rule
  const now=Date.now();
  assert.equal(await page.evaluate(([now,DAY])=>ReviewPrompt.shouldShow({installedAt:now-10*DAY,days:['a','b','c','d','e'],snoozeUntil:0,shown:0,done:false},now),[now,DAY]),true);
  assert.equal(await page.evaluate(([now,DAY])=>ReviewPrompt.shouldShow({installedAt:now-2*DAY,days:['a','b','c','d','e'],snoozeUntil:0,shown:0,done:false},now),[now,DAY]),false,'too soon after install');
  assert.equal(await page.evaluate(([now,DAY])=>ReviewPrompt.shouldShow({installedAt:now-10*DAY,days:['a','b','c','d'],snoozeUntil:0,shown:0,done:false},now),[now,DAY]),false,'not enough active days');
  assert.equal(await page.evaluate(([now,DAY])=>ReviewPrompt.shouldShow({installedAt:now-10*DAY,days:['a','b','c','d','e'],snoozeUntil:now+DAY,shown:0,done:false},now),[now,DAY]),false,'snoozed');
  assert.equal(await page.evaluate(([now,DAY])=>ReviewPrompt.shouldShow({installedAt:now-10*DAY,days:['a','b','c','d','e'],snoozeUntil:0,shown:3,done:false},now),[now,DAY]),false,'max shown');
  assert.equal(await page.evaluate(([now,DAY])=>ReviewPrompt.shouldShow({installedAt:now-10*DAY,days:['a','b','c','d','e'],snoozeUntil:0,shown:0,done:true},now),[now,DAY]),false,'done');
  await page.close();
  // eligible user: prompt appears, "Later" snoozes 14 days
  await setState({installedAt:now-10*DAY,days:['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05'],snoozeUntil:0,shown:0,done:false});
  page=await open();await page.locator('#reviewPrompt').waitFor();
  assert.match(await page.locator('#reviewPromptTitle').innerText(),/お役に立っていますか/);
  await page.locator('#reviewLater').click();await page.locator('#reviewPrompt').waitFor({state:'detached'});
  s=await state();assert.equal(s.shown,1);assert.ok(s.snoozeUntil>Date.now()+13*DAY&&s.snoozeUntil<Date.now()+15*DAY,'snoozed ~14 days');assert.equal(s.done,false);
  await page.close();
  // snoozed: not shown
  page=await open();await page.waitForTimeout(2000);assert.equal(await page.locator('#reviewPrompt').count(),0,'hidden while snoozed');await page.close();
  // snooze over: shown; "Write a review" opens the store reviews page and ends prompting
  await setState({...s,snoozeUntil:Date.now()-1});
  page=await open();await page.locator('#reviewPrompt').waitFor();
  await page.locator('#reviewWrite').click();
  await page.waitForFunction(()=>globalThis.createdTabs.length===1);
  assert.equal(await page.evaluate(()=>createdTabs[0]),`https://chromewebstore.google.com/detail/${id}/reviews`);
  assert.match(await page.locator('#reviewPrompt').innerText(),/ありがとうございます/);
  await page.locator('#reviewPrompt').waitFor({state:'detached',timeout:5000});
  s=await state();assert.equal(s.done,true);assert.equal(s.shown,2);
  await page.close();
  // done: never again, even when otherwise eligible
  page=await open();await page.waitForTimeout(2000);assert.equal(await page.locator('#reviewPrompt').count(),0,'never after review');await page.close();
  // "Don't show again"
  await setState({installedAt:now-10*DAY,days:['a','b','c','d','e'],snoozeUntil:0,shown:0,done:false});
  page=await open();await page.locator('#reviewPrompt').waitFor();await page.locator('#reviewNever').click();await page.locator('#reviewPrompt').waitFor({state:'detached'});
  s=await state();assert.equal(s.done,true);
  console.log('PASS review prompt: install timestamp, active-day counting, trigger rules, later=14-day snooze, write opens store reviews URL and stops, never, max/done');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
