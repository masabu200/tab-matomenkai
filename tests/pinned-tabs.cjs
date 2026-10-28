const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os'),http=require('node:http');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Page '+req.url+'</title><p>x</p>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-pinned-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  const winId=await page.evaluate(()=>g_dashboardWindowId);
  await worker.evaluate(({winId,base})=>chrome.storage.local.set({pwm_data:{spaces:[{id:'a',name:'案件A',tabs:[{url:base+'/a1',title:'A1'},{url:base+'/a2',title:'A2'}],tabGroups:[],categoryId:null,archived:false,color:''},{id:'b',name:'案件B',tabs:[{url:base+'/b1',title:'B1'}],tabGroups:[],categoryId:null,archived:false,color:''}],categories:[],windowActiveSpaces:{[winId]:'a'}}}),{winId,base});
  await page.reload();await page.waitForFunction(()=>g_dashboardWindowId!==null);await page.waitForFunction(()=>document.querySelectorAll('.tab-card').length===2);
  const urls=async()=> (await worker.evaluate(w=>chrome.tabs.query({windowId:w}),winId)).map(t=>({url:t.pendingUrl||t.url,pinned:t.pinned}));
  // pin a saved tab from its card: opens pinned, leaves the space, strip shows it
  await page.locator('.tab-card').filter({hasText:'A2'}).hover();
  await page.locator('.tab-card').filter({hasText:'A2'}).locator('.tab-card__pin').click();
  await page.waitForFunction(()=>!document.getElementById('pinnedTabs').hidden);
  let data=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);
  assert.deepEqual(data.spaces.find(s=>s.id==='a').tabs.map(t=>t.title),['A1'],'pinned tab removed from the space');
  assert.ok((await urls()).some(t=>t.url===base+'/a2'&&t.pinned),'opened pinned');
  assert.equal(await page.locator('#pinnedTabs .pinned-tab').count(),1);
  // switching spaces keeps the pinned tab open and does not save it into either space
  await page.locator('[data-space-id="b"]').first().click();
  await page.locator('#panelDialog').waitFor().catch(()=>{});
  if(await page.locator('#panelDialog').count()){await page.locator('#panelDialog button').filter({hasText:'保存せず'}).click().catch(async()=>{await page.locator('#panelDialog button').first().click()});}
  await page.waitForFunction(()=>document.querySelector('#spaceTitle').textContent==='案件B');
  await page.waitForTimeout(800);
  const after=await urls();
  assert.ok(after.some(t=>t.url===base+'/a2'&&t.pinned),'pinned tab survived the switch: '+JSON.stringify(after));
  assert.ok(after.some(t=>t.url===base+'/b1'),'target space restored');
  assert.ok(!after.some(t=>t.url===base+'/a1'),'previous space tabs closed');
  await page.locator('#btnSaveTabs').click();await page.waitForTimeout(500);
  data=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);
  assert.ok(!data.spaces.find(s=>s.id==='b').tabs.some(t=>t.url===base+'/a2'),'pinned tab not saved into space B');
  assert.equal(await page.locator('#pinnedTabs .pinned-tab').count(),1,'strip still shows the pinned tab');
  // unpin from the strip
  await page.locator('#pinnedTabs .pinned-tab__unpin').click();
  await page.waitForFunction(()=>document.getElementById('pinnedTabs').hidden);
  assert.ok((await urls()).some(t=>t.url===base+'/a2'&&!t.pinned),'unpinned but still open');
  // Japanese labels resolved (no raw keys)
  assert.doesNotMatch(await page.locator('body').innerText(),/\bpinnedHeading\b|\bpinTabTitle\b/);
  assert.deepEqual(errors,[]);
  console.log('PASS pinned tabs: pin from card moves tab out of the space and opens it pinned; survives switching; not saved into other spaces; strip lists and unpins; no page errors');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
