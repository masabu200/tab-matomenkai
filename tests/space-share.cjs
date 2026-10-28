const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
async function open(seed){
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-share-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions'],acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 context.setDefaultTimeout(10000);
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
 const winId=await page.evaluate(()=>g_dashboardWindowId);
 await worker.evaluate(([seed,winId])=>chrome.storage.local.set({pwm_data:{...seed,windowActiveSpaces:{[winId]:seed.spaces[0]?.id||null}}}),[seed,winId]);
 await page.reload();await page.waitForFunction(()=>g_dashboardWindowId!==null);await page.waitForTimeout(500);
 const data=()=>worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);
 return {context,page,worker,errors,data,close:async()=>{await context.close();fs.rmSync(dir,{recursive:true,force:true})}};
}
(async()=>{
 const sender=await open({categories:[{id:'c1',name:'案件',parentId:null,color:''}],spaces:[
  {id:'a',name:'サイト制作A',categoryId:'c1',color:'',tabGroups:[{id:'g1',name:'参考',color:'#4a7ef8',collapsed:false}],tabs:[{title:'仕様書',url:'https://docs.example.com/spec?token=SECRET',groupId:'g1'},{title:'トップ',url:'https://a.example/',groupId:null}],archived:false},
  {id:'b',name:'サイト制作B',categoryId:null,color:'',tabs:[{title:'B',url:'https://b.example/'}],archived:false},
  {id:'c',name:'非公開',categoryId:null,color:'',tabs:[{title:'C',url:'https://c.example/'}],archived:false}]});
 const receiver=await open({categories:[],spaces:[{id:'x',name:'サイト制作A',categoryId:null,color:'',tabs:[{title:'既存',url:'https://x.example/'}],archived:false}]});
 try{
  const p=sender.page;
  // header share button opens the export dialog with the current space pre-selected
  await p.locator('#btnShareSpace').click();await p.locator('#shareExportDialog').waitFor();
  assert.deepEqual(await p.locator('#shareExportDialog .share-item input:checked').evaluateAll(es=>es.map(e=>e.value)),['a']);
  await p.locator('#shareExportDialog .share-item input[value="b"]').check();
  await p.locator('#shareStripQuery').check();
  // file export
  const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#shareToFile').click()]);
  const filePath=path.join(process.env.TMPDIR||os.tmpdir(),'share-'+Date.now()+'.json');await download.saveAs(filePath);
  assert.match(download.suggestedFilename(),/スペース2件\.tabmatomen\.json$/);
  const pkg=JSON.parse(fs.readFileSync(filePath,'utf8'));
  assert.deepEqual(pkg.spaces.map(s=>s.name),['サイト制作A','サイト制作B']);
  assert.ok(!JSON.stringify(pkg).includes('SECRET'),'query stripped');assert.ok(!JSON.stringify(pkg).includes('非公開'),'unselected space not exported');
  // share code
  await p.locator('#shareCopyCode').click();await p.waitForFunction(()=>document.querySelector('#shareCodeOutput').value.startsWith('TMK1.'));
  const code=await p.locator('#shareCodeOutput').inputValue();
  await p.locator('#shareExportDialog button').filter({hasText:'閉じる'}).click();
  // receiver: settings → receive → paste code → preview → add
  const r=receiver.page;
  await r.locator('#openSettings').click();await r.locator('#settingsShareImport').click();await r.locator('#shareImportDialog').waitFor();
  await r.locator('#shareCodeInput').fill('TMK1.garbage');await r.locator('#shareCheck').click();
  await r.waitForFunction(()=>document.querySelector('#shareImportDialog .share-status').textContent.includes('読み取れませんでした'));
  assert.equal(await r.locator('#shareAdd').isHidden(),true);
  await r.locator('#shareCodeInput').fill(code);await r.locator('#shareCheck').click();
  await r.waitForFunction(()=>document.querySelector('#sharePreview').textContent.includes('スペース 2 件・タブ 3 枚'));
  assert.match(await r.locator('#sharePreview').textContent(),/案件 \/ サイト制作A/);
  await r.locator('#shareAdd').click();await r.locator('#shareImportDialog').waitFor({state:'detached'});
  let d=await receiver.data();
  assert.deepEqual(d.spaces.map(s=>s.name),['サイト制作A','サイト制作A (2)','サイト制作B'],'existing kept, duplicate name suffixed');
  assert.equal(d.spaces[0].tabs[0].title,'既存');
  const added=d.spaces[1];assert.equal(d.categories.find(c=>c.id===added.categoryId).name,'案件','category created');
  assert.equal(added.tabs[0].groupId,added.tabGroups[0].id,'group remapped');assert.equal(added.tabs[0].url,'https://docs.example.com/spec');
  await r.waitForFunction(()=>[...document.querySelectorAll('[data-space-id]')].some(e=>e.textContent.includes('サイト制作A (2)')));
  // file import path
  await r.locator('#openSettings').click();await r.locator('#settingsShareImport').click();await r.locator('#shareImportDialog').waitFor();
  await r.locator('#shareFileInput').setInputFiles(filePath);
  await r.waitForFunction(()=>document.querySelector('#sharePreview').textContent.includes('スペース 2 件'));
  await r.locator('#shareAdd').click();await r.locator('#shareImportDialog').waitFor({state:'detached'});
  d=await receiver.data();assert.ok(d.spaces.some(s=>s.name==='サイト制作A (3)'),'second import suffixed again');assert.equal(d.categories.length,1,'category reused');
  fs.rmSync(filePath,{force:true});
  assert.deepEqual(sender.errors,[]);assert.deepEqual(receiver.errors,[]);
  console.log('PASS space share: header export preselects current; file export with chosen spaces and stripped query; share code; receive rejects garbage, previews, adds without overwriting (suffix, category create/reuse, group remap); file import; no page errors');
 }finally{await sender.close();await receiver.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
