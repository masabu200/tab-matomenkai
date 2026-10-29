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
  // the card waits for a finished space switch, not page load
  const switched=p=>p.evaluate(()=>window.dispatchEvent(new CustomEvent('pwm-space-switched')));
  await setState({installedAt:now-10*DAY,days:['2026-01-01','2026-01-02','2026-01-03','2026-01-04','2026-01-05'],snoozeUntil:0,shown:0,done:false});
  page=await open();await page.waitForTimeout(2000);
  assert.equal(await page.locator('#reviewPrompt').count(),0,'not shown on plain load');
  await switched(page);await page.locator('#reviewPrompt').waitFor();
  assert.match(await page.locator('#reviewPromptTitle').innerText(),/使い心地/);
  assert.equal(await page.locator('.review-star').count(),5);
  // "Later" snoozes 14 days
  await page.locator('#reviewLater').click();await page.locator('#reviewPrompt').waitFor({state:'detached'});
  s=await state();assert.equal(s.shown,1);assert.ok(s.snoozeUntil>Date.now()+13*DAY&&s.snoozeUntil<Date.now()+15*DAY,'snoozed ~14 days');assert.equal(s.done,false);
  await page.close();
  // snoozed: not shown even after a switch
  page=await open();await switched(page);await page.waitForTimeout(2000);assert.equal(await page.locator('#reviewPrompt').count(),0,'hidden while snoozed');await page.close();
  // snooze over, 5 stars: invited to the store; "Write a review" opens the store reviews page and ends prompting
  await setState({...s,snoozeUntil:Date.now()-1});
  page=await open();await switched(page);await page.locator('#reviewPrompt').waitFor();
  await page.locator('#reviewStar5').click();
  assert.match(await page.locator('#reviewPromptTitle').innerText(),/うれしい/);
  s=await state();assert.equal(s.done,true);assert.equal(s.rating,5);
  await page.locator('#reviewWrite').click();
  await page.waitForFunction(()=>globalThis.createdTabs.length===1);
  assert.equal(await page.evaluate(()=>createdTabs[0]),`https://chromewebstore.google.com/detail/${id}/reviews`);
  assert.match(await page.locator('#reviewPrompt').innerText(),/ありがとうございます/);
  await page.locator('#reviewPrompt').waitFor({state:'detached',timeout:5000});
  s=await state();assert.equal(s.shown,2);
  await page.close();
  // done: never again, even when otherwise eligible
  page=await open();await switched(page);await page.waitForTimeout(2000);assert.equal(await page.locator('#reviewPrompt').count(),0,'never after rating');await page.close();
  // 2 stars: asked for feedback by mail, the store link is still offered (no review gating)
  await setState({installedAt:now-10*DAY,days:['a','b','c','d','e'],snoozeUntil:0,shown:0,done:false});
  page=await open();await switched(page);await page.locator('#reviewPrompt').waitFor();
  await page.locator('#reviewStar2').click();
  const href=await page.locator('#reviewFeedback').getAttribute('href');
  assert.match(href,/^mailto:info@kw-s\.jp\?subject=/);assert.match(decodeURIComponent(href),/\(2\/5\)/);
  assert.equal(await page.locator('#reviewWrite').count(),1,'store review still available');
  s=await state();assert.equal(s.done,true);assert.equal(s.rating,2);
  await page.close();
  // "Don't show again"
  await setState({installedAt:now-10*DAY,days:['a','b','c','d','e'],snoozeUntil:0,shown:0,done:false});
  page=await open();await switched(page);await page.locator('#reviewPrompt').waitFor();await page.locator('#reviewNever').click();await page.locator('#reviewPrompt').waitFor({state:'detached'});
  s=await state();assert.equal(s.done,true);
  // settings always carries the review / feedback card
  await page.locator('#openSettings').click();
  await page.locator('#reviewSettings').waitFor();
  await page.locator('#reviewSettingsWrite').click();
  await page.waitForFunction(()=>globalThis.createdTabs.length===1);
  assert.match(await page.locator('#reviewSettingsFeedback').getAttribute('href'),/^mailto:info@kw-s\.jp/);
  await page.close();
  console.log('PASS review prompt: trigger rules, waits for a space switch, later=14-day snooze, 4-5 stars -> store, 1-3 stars -> feedback mail with store still offered, never, settings card');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
