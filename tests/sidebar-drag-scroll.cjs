const {chromium}=require('/Users/mugikura/node_modules/playwright');const UI=require('./ui.cjs');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync('/tmp/sidebar-drag-');
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  let page=await context.newPage();await page.setViewportSize({width:1100,height:800});await page.goto(`chrome-extension://${id}/dashboard.html`);
  await page.waitForFunction(()=>g_dashboardWindowId!==null);
  await page.evaluate(async()=>{await saveData({categories:Array.from({length:30},(_,i)=>({id:'c'+i,name:'カテゴリー'+i})),spaces:Array.from({length:30},(_,i)=>({id:'s'+i,name:'スペース'+i,categoryId:'c'+i,tabs:[]})),windowActiveSpaces:{}})});
  await page.waitForSelector('[data-space-id="s29"]');
  for(const mode of ['dashboard','panel']){
   if(mode==='panel'){
    page=await context.newPage();
    await page.goto(`chrome-extension://${id}/sidepanel.html`);
    await page.evaluate(()=>{chrome.sidePanel.getLayout=async()=>({side:'left'});document.documentElement.classList.add('left-layout-verified');document.querySelector('.app').hidden=false});
    await page.setViewportSize({width:280,height:800});await page.waitForSelector('[data-space-id="s29"]');
   }
   const source=page.locator('[data-space-id="s20"]');await source.scrollIntoViewIfNeeded();
   const list=page.locator('#spaceList');const rect=await list.boundingBox();const start=await list.evaluate(el=>el.scrollTop);
   await source.evaluate(el=>{globalThis.dragData=new DataTransfer();el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dragData}))});
   const drag=(type,x,y)=>page.evaluate(({type,x,y})=>document.elementFromPoint(x,y).dispatchEvent(new DragEvent(type==='dragEnter'?'dragenter':type==='dragOver'?'dragover':'drop',{bubbles:true,cancelable:true,clientX:x,clientY:y,dataTransfer:dragData})),{type,x,y});
   const x=rect.x+rect.width/2;
   await drag('dragEnter',x,rect.y+8);await drag('dragOver',x,rect.y+8);await page.waitForTimeout(550);
   assert.ok(await list.evaluate(el=>el.scrollTop)<start-70,mode+' upward stationary scroll');
   await drag('dragOver',x,rect.y+rect.height-8);const downStart=await list.evaluate(el=>el.scrollTop);await page.waitForTimeout(550);assert.ok(await list.evaluate(el=>el.scrollTop)>downStart+70,mode+' downward scroll');
   await drag('dragOver',x,rect.y+rect.height/2);await page.waitForTimeout(100);const middle=await list.evaluate(el=>el.scrollTop);await page.waitForTimeout(250);assert.ok(Math.abs(await list.evaluate(el=>el.scrollTop)-middle)<3,mode+' center stop');
   await drag('dragOver',x,rect.y+4);await page.waitForFunction(()=>document.getElementById('spaceList').scrollTop===0,{},{timeout:15000});
   const target=await page.locator('[data-category-id="c0"] > .cat-group__header').boundingBox();await drag('dragOver',target.x+target.width/2,target.y+target.height/2);await drag('drop',target.x+target.width/2,target.y+target.height/2);await page.evaluate(()=>document.dispatchEvent(new DragEvent('dragend',{bubbles:true})));
   await UI.waitForAsync(page,async()=> (await loadData()).spaces.find(s=>s.id==='s20').categoryId==='c0');
   const final=await list.evaluate(el=>el.scrollTop);await page.waitForTimeout(250);assert.equal(await list.evaluate(el=>el.scrollTop),final);
   console.log('PASS '+mode+': browser drag events up/down, stationary scroll, center/drop stop, persisted move to first category');
   await page.evaluate(async()=>{const d=await loadData();d.spaces.find(s=>s.id==='s20').categoryId='c20';await saveData(d)});await page.waitForTimeout(200);
  }
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
