const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
// スペース作成モーダル: 名前・所属カテゴリー・カラー・画像を1回で設定して作成できる。
// 空の名前・重複名はモーダル内でエラー表示、キャンセル・Escape では作られない。
// 設定・折りたたみボタンはサイドバーの一番下にある。
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'space-create-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1280,height:800});
  const url=`chrome-extension://${id}/dashboard.html`;
  await p.goto(url);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  await p.evaluate(async()=>{
   const d={categories:[{id:'c1',name:'仕事',color:'#4a7ef8',parentId:null,collapsed:false},{id:'c2',name:'副業',color:'',parentId:'c1',collapsed:false}],windowActiveSpaces:{},spaces:[{id:'a',name:'案件A',tabs:[],tabGroups:[],categoryId:null,archived:false,color:''}]};
   setActiveSpaceId(d,'a');await saveData(d);await chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}});await renderAll()});
  const spaces=()=>worker.evaluate(async()=>{const r=await chrome.storage.local.get(null);const key=Object.keys(r).find(k=>r[k]&&Array.isArray(r[k].spaces));return r[key].spaces});

  // 0) 設定・折りたたみボタンはサイドバーの下端
  const pos=await p.evaluate(()=>{const s=document.querySelector('.sidebar').getBoundingClientRect(),c=document.querySelector('.sidebar-controls').getBoundingClientRect(),list=document.getElementById('spaceList').getBoundingClientRect();return {sideBottom:s.bottom,ctrlBottom:c.bottom,ctrlTop:c.top,listBottom:list.bottom,hasSettings:!!document.querySelector('.sidebar-controls #openSettings'),hasToggle:!!document.querySelector('.sidebar-controls #toggleSidebar')}});
  assert.ok(pos.hasSettings&&pos.hasToggle);
  assert.ok(Math.abs(pos.sideBottom-pos.ctrlBottom)<=1,JSON.stringify(pos));
  assert.ok(pos.ctrlTop>=pos.listBottom-1,JSON.stringify(pos));
  await p.locator('#toggleSidebar').click();
  const collapsed=await p.evaluate(()=>{const s=document.querySelector('.sidebar').getBoundingClientRect(),c=document.querySelector('.sidebar-controls').getBoundingClientRect();return {sideBottom:s.bottom,ctrlBottom:c.bottom}});
  assert.ok(Math.abs(collapsed.sideBottom-collapsed.ctrlBottom)<=1,JSON.stringify(collapsed));
  await p.locator('#toggleSidebar').click();
  console.log('PASS settings and collapse buttons sit at the bottom of the sidebar (expanded and collapsed)');

  // 1) モーダルが開き、名前・カテゴリー・カラー・画像の欄がそろっている
  await p.locator('#btnCreateSpace').click();
  const dialog=p.locator('#spaceCreateDialog');
  await dialog.waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>document.getElementById('spaceCreateDialog').matches(':modal')),true);
  assert.equal(await p.evaluate(()=>document.activeElement.id),'spaceCreateName');
  assert.deepEqual(await p.locator('#spaceCreateCategory option').allTextContents(),['未分類','仕事','　副業']);
  assert.ok(await dialog.locator('.modal__color-swatch').count()>=5);
  await p.screenshot({path:'evidence/space-create-dialog.png'});

  // 2) 空の名前・重複名はモーダル内でエラー（閉じない）
  await p.locator('#spaceCreateOk').click();
  assert.match(await p.locator('#spaceCreateError').innerText(),/入力/);
  assert.equal(await dialog.isVisible(),true);
  await p.locator('#spaceCreateName').fill('案件A');await p.locator('#spaceCreateName').press('Enter');
  assert.match(await p.locator('#spaceCreateError').innerText(),/既に存在/);
  assert.equal(await dialog.isVisible(),true);
  console.log('PASS empty and duplicate names are reported inside the modal');

  // 3) 名前・カテゴリー・カラー・画像を一度に設定して作成
  await p.locator('#spaceCreateName').fill('案件B');
  await p.locator('#spaceCreateCategory').selectOption('c2');
  const color=await dialog.locator('.modal__color-swatch').nth(2).getAttribute('data-color');
  await dialog.locator('.modal__color-swatch').nth(2).click();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEIGBkZGBgYAAAcBgL+QzcMxQAAAABJRU5ErkJggg==','base64');
  await p.locator('#spaceCreateImageFile').setInputFiles({name:'icon.png',mimeType:'image/png',buffer:png});
  await p.waitForFunction(()=>!document.getElementById('spaceCreateImageClear').hidden);
  assert.match(await p.locator('.space-create__preview').evaluate(e=>e.style.backgroundImage),/data:image\/png/);
  await p.locator('#spaceCreateOk').click();
  await dialog.waitFor({state:'hidden'});
  await p.waitForFunction(()=>[...document.querySelectorAll('.space-item__name')].some(e=>e.textContent==='案件B'));
  const b=(await spaces()).find(s=>s.name==='案件B');
  assert.equal(b.categoryId,'c2');assert.equal(b.color,color);assert.match(b.icon,/^data:image\/png/);
  console.log('PASS name, category, colour and image are set in one step');

  // 4) キャンセル・Escape・背景クリックでは作られない
  const before=(await spaces()).length;
  await p.locator('#btnCreateSpace').click();await p.locator('#spaceCreateName').fill('作らない');await p.locator('#spaceCreateCancel').click();
  await dialog.waitFor({state:'hidden'});
  await p.locator('#btnCreateSpace').click();await p.locator('#spaceCreateName').fill('作らない');await p.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(await p.evaluate(()=>document.activeElement.id),'btnCreateSpace','focus returns to the button');
  // 再度開くと前回の入力は残らない
  await p.locator('#btnCreateSpace').click();
  assert.equal(await p.locator('#spaceCreateName').inputValue(),'');
  assert.equal(await p.locator('#spaceCreateCategory').inputValue(),'');
  await p.keyboard.press('Escape');
  assert.equal((await spaces()).length,before);
  console.log('PASS cancel / Escape create nothing, focus returns, fields reset');

  // 5) ダークでもモーダルは読める（タイトル文字と背景）
  await p.locator('#btnToggleTheme').click();await p.waitForTimeout(300);
  await p.locator('#btnCreateSpace').click();
  const colors=await p.evaluate(()=>{const d=document.getElementById('spaceCreateDialog');return {bg:getComputedStyle(d).backgroundColor,fg:getComputedStyle(document.getElementById('spaceCreateTitle')).color}});
  assert.equal(colors.bg,'rgb(28, 31, 33)');assert.equal(colors.fg,'rgb(238, 240, 240)');
  await p.screenshot({path:'evidence/space-create-dialog-dark.png'});
  await p.keyboard.press('Escape');
  console.log('PASS dark mode modal colours');
  assert.deepEqual(errors,[]);
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
