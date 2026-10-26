const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const dir=fs.mkdtempSync('/tmp/pwm-drive-test-');
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];const page=await context.newPage();
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  await page.evaluate(()=>{globalThis.authMode='ok';chrome.identity.launchWebAuthFlow=async({url})=>{const u=new URL(url);return u.searchParams.get('redirect_uri')+'#'+new URLSearchParams({access_token:'fixture-secret',expires_in:'3600',scope:u.searchParams.get('scope'),state:globalThis.authMode==='wrong'?'wrong':u.searchParams.get('state')})};});
  await page.locator('#openSettings').click();await page.locator('.drive-settings summary').click();await page.locator('#driveClientId').fill('test-client.apps.googleusercontent.com');
  await page.evaluate(()=>authMode='wrong');await page.locator('#driveConnect').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('認証を確認できません'));assert.equal(await page.evaluate(async()=>(await chrome.storage.session.get('pwm_drive_auth')).pwm_drive_auth),undefined);
  await page.evaluate(()=>authMode='ok');await page.locator('#driveConnect').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('接続しました'));
  let count=0,payload;let status=200;
  await context.route('https://www.googleapis.com/upload/drive/v3/files?**',async route=>{count++;payload=route.request().postData();assert.equal(route.request().headers().authorization,'Bearer fixture-secret');await route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?{id:'fixture-file'}:{error:{message:'denied'}})});});
  await page.locator('#driveSave').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('保存しました'));
  assert.equal(count,1);assert.ok(!payload.includes('fixture-secret'));assert.match(payload,/"spaces"/);assert.match(payload,/"categories"/);assert.equal(await page.locator('#driveLastBackup a').getAttribute('href'),'https://drive.google.com/file/d/fixture-file/view');
  const before=await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_last_backup')).pwm_drive_last_backup);
  status=403;await page.locator('#driveSave').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('403'));assert.deepEqual(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_last_backup')).pwm_drive_last_backup),before);
  status=401;await page.locator('#driveSave').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('再接続'));assert.equal(await page.evaluate(async()=>(await chrome.storage.session.get('pwm_drive_auth')).pwm_drive_auth),undefined);
  const calls=count;await page.locator('#driveSave').click();await page.waitForFunction(()=>document.querySelector('#driveStatus').textContent.includes('接続してください'));assert.equal(count,calls);
  for(const width of [280,320,375,768,1024,1440]){
   await page.setViewportSize({width,height:900});await page.locator('.drive-settings summary').click();
   assert.ok(await page.locator('.drive-settings').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`overflow ${width}`);
   await page.locator('.drive-settings summary').click();
  }
  await page.setViewportSize({width:375,height:900});await page.locator('.drive-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/drive-backup-settings.png'});
  console.log('PASS browser UI; OAuth state rejection; mocked Drive upload; no credentials in backup; 403/401; disconnected requests blocked; widths 280–1440. Real Google login/upload not tested.');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
