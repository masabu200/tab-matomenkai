const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),http=require('node:http');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Local '+req.url+'</title><p>test</p>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-onboarding-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  // 1) fresh install: the guide offers the first action directly
  assert.equal(await page.locator('#noSpaceNote').isVisible(),true);
  assert.equal(await page.locator('#guideCreateSpace').isVisible(),true);
  page.once('dialog',d=>d.accept('最初の案件'));
  await page.locator('#guideCreateSpace').click();
  await page.waitForFunction(()=>document.querySelector('#spaceTitle').textContent==='最初の案件');
  assert.equal(await page.locator('#noSpaceNote').isHidden(),true);
  // 2) empty space: save button inside the guide saves the open tabs
  assert.equal(await page.locator('#emptyTabNote').isVisible(),true);
  assert.equal(await page.locator('#guideSaveTabs').isVisible(),true);
  const other=await context.newPage();await other.goto(`http://127.0.0.1:${port}/first`);await page.bringToFront();
  await page.locator('#guideSaveTabs').click();
  await page.waitForFunction(()=>document.querySelectorAll('.tab-card').length>=1);
  assert.equal(await page.locator('#emptyTabNote').isHidden(),true);
  const saved=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data.spaces[0].tabs.map(t=>t.url));
  assert.ok(saved.some(u=>u.includes('/first')),String(saved));
  await other.close();
  // 3) settings order and advanced section collapsed
  await page.locator('#openSettings').click();
  const order=await page.evaluate(()=>[...document.querySelectorAll('#settingsDialog > *')].map(e=>e.id||e.className).join('|'));
  assert.ok(order.indexOf('language-settings')<order.indexOf('sidebar__backup')&&order.indexOf('drive-settings')<order.indexOf('aiSettings'),order);
  assert.equal(await page.evaluate(()=>document.getElementById('aiSettings').open),false,'AI section collapsed by default');
  assert.equal(await page.locator('#aiConnectionToken').isVisible(),false);
  await page.locator('#aiSettings summary').click();assert.equal(await page.locator('#aiConnectionToken').isVisible(),true);
  await page.locator('#closeSettings').click();
  // 4) errors stay visible longer than successes and can be dismissed by click
  await page.evaluate(()=>showMessage('テストエラー','error'));
  assert.equal(await page.evaluate(()=>document.getElementById('message').getAttribute('role')),'alert');
  await page.waitForTimeout(4500);assert.equal(await page.locator('#message').isVisible(),true,'error still visible after 4.5s');
  await page.locator('#message').click();assert.equal(await page.locator('#message').isVisible(),false,'click dismisses');
  await page.evaluate(()=>showMessage('成功','success'));await page.waitForTimeout(4000);assert.equal(await page.locator('#message').isVisible(),false,'success auto-hides');
  // 5) narrow dashboard (stacked layout) keeps the guide and its button inside the viewport
  await worker.evaluate(()=>chrome.storage.local.set({pwm_data:{spaces:[],categories:[]}}));
  await page.setViewportSize({width:320,height:700});
  await page.waitForFunction(()=>document.getElementById('noSpaceNote').style.display!=='none');
  const box=await page.locator('#guideCreateSpace').boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=320,JSON.stringify(box));
  assert.ok(await page.locator('#noSpaceNote').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'guide fits 320px');
  assert.deepEqual(errors,[]);
  console.log('PASS onboarding: guide create button → space; guide save button saves open tabs; settings order language/backup/drive/AI with AI collapsed; error alert persists 4.5s and click-dismisses, success auto-hides; 320px stacked dashboard guide fits; no page errors');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
