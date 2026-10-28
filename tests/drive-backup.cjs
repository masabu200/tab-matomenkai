const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-drive-test-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const status=page=>page.locator('#driveStatus');
  const waitStatus=(page,text)=>page.waitForFunction(t=>document.querySelector('#driveStatus').textContent.includes(t),text);

  // ---------- manual mode (user-supplied client ID): simulate a build without oauth2 ----------
  let page=await context.newPage();
  await page.addInitScript(()=>{const real=chrome.runtime.getManifest.bind(chrome.runtime);chrome.runtime.getManifest=()=>{const m={...real()};delete m.oauth2;return m};});
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  await page.evaluate(()=>{globalThis.authMode='ok';globalThis.authCalls=[];chrome.identity.launchWebAuthFlow=async({url,interactive})=>{const u=new URL(url);globalThis.authCalls.push({interactive,prompt:u.searchParams.get('prompt')});if(globalThis.authMode==='fail')throw new Error('silent failed');const token=globalThis.authMode==='renew'?'renewed-secret':'fixture-secret';return u.searchParams.get('redirect_uri')+'#'+new URLSearchParams({access_token:token,expires_in:'3600',scope:u.searchParams.get('scope'),state:globalThis.authMode==='wrong'?'wrong':u.searchParams.get('state')})};});
  assert.equal(await page.evaluate(()=>DriveBackup.mode()),'manual');
  await page.locator('#openSettings').click();
  assert.equal(await page.locator('#driveBuiltinHelp').isHidden(),true);
  await page.locator('.drive-settings summary').click();await page.locator('#driveClientId').fill('test-client.apps.googleusercontent.com');
  await page.evaluate(()=>authMode='wrong');await page.locator('#driveConnect').click();await waitStatus(page,'認証を確認できません');assert.equal(await page.evaluate(async()=>(await chrome.storage.session.get('pwm_drive_auth')).pwm_drive_auth),undefined);
  await page.evaluate(()=>authMode='ok');await page.locator('#driveConnect').click();await waitStatus(page,'接続しました');
  assert.deepEqual(await page.evaluate(()=>authCalls.at(-1)),{interactive:true,prompt:'select_account consent'});
  let count=0,payload,expectToken='fixture-secret';let httpStatus=200;
  await context.route('https://www.googleapis.com/upload/drive/v3/files?**',async route=>{count++;payload=route.request().postData();assert.equal(route.request().headers().authorization,'Bearer '+expectToken);await route.fulfill({status:httpStatus,contentType:'application/json',body:JSON.stringify(httpStatus===200?{id:'fixture-file'}:{error:{message:'denied'}})});});
  await page.locator('#driveSave').click();await waitStatus(page,'保存しました');
  assert.equal(count,1);assert.ok(!payload.includes('fixture-secret'));assert.match(payload,/"spaces"/);assert.match(payload,/"categories"/);assert.equal(await page.locator('#driveLastBackup a').getAttribute('href'),'https://drive.google.com/file/d/fixture-file/view');
  const before=await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_last_backup')).pwm_drive_last_backup);
  httpStatus=403;await page.locator('#driveSave').click();await waitStatus(page,'403');assert.deepEqual(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_last_backup')).pwm_drive_last_backup),before);
  // silent renewal: expired session token + stored client ID -> prompt=none, non-interactive
  httpStatus=200;await page.evaluate(async()=>{await chrome.storage.session.set({pwm_drive_auth:{token:'stale',expiresAt:Date.now()-1}});authMode='renew';});
  expectToken='renewed-secret';await page.locator('#driveSave').click();await waitStatus(page,'保存しました');
  assert.deepEqual(await page.evaluate(()=>authCalls.at(-1)),{interactive:false,prompt:'none'});
  // 401 clears the session token; a failed silent renewal asks to reconnect without calling Drive
  httpStatus=401;await page.locator('#driveSave').click();await waitStatus(page,'再接続');assert.equal(await page.evaluate(async()=>(await chrome.storage.session.get('pwm_drive_auth')).pwm_drive_auth),undefined);
  await page.evaluate(()=>authMode='fail');const calls=count;await page.locator('#driveSave').click();await waitStatus(page,'接続してください');assert.equal(count,calls);
  for(const width of [280,320,375,768,1024,1440]){
   await page.setViewportSize({width,height:900});await page.locator('.drive-settings summary').click();
   assert.ok(await page.locator('.drive-settings').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`overflow ${width}`);
   await page.locator('.drive-settings summary').click();
  }
  await page.setViewportSize({width:375,height:900});await page.locator('.drive-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/drive-backup-settings.png'});
  await page.close();

  // ---------- builtin mode (the real manifest carries oauth2; identity is mocked) ----------
  await worker.evaluate(()=>chrome.storage.local.remove('pwm_drive_connected'));
  page=await context.newPage();
  await page.addInitScript(()=>{
    globalThis.tokenCalls=[];globalThis.removed=[];globalThis.tokenMode='ok';
    chrome.identity.getAuthToken=async({interactive,scopes})=>{globalThis.tokenCalls.push({interactive,scopes});if(globalThis.tokenMode==='deny')throw new Error('The user did not approve access.');return {token:globalThis.tokenMode==='second'?'builtin-token-2':'builtin-token',grantedScopes:scopes}};
    chrome.identity.removeCachedAuthToken=async({token})=>{globalThis.removed.push(token)};
  });
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  assert.equal(await page.evaluate(()=>DriveBackup.mode()),'builtin');
  await page.locator('#openSettings').click();
  assert.equal(await page.locator('#driveBuiltinHelp').isVisible(),true);assert.equal(await page.locator('#driveManualSetup').isHidden(),true);
  // not connected yet: saving must not call Drive
  const beforeCount=count;await page.locator('#driveSave').click();await waitStatus(page,'接続してください');assert.equal(count,beforeCount);
  await page.evaluate(()=>tokenMode='deny');await page.locator('#driveConnect').click();await waitStatus(page,'許可されませんでした');
  assert.equal(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_connected')).pwm_drive_connected),undefined);
  await page.evaluate(()=>tokenMode='ok');await page.locator('#driveConnect').click();await waitStatus(page,'接続しました');
  assert.deepEqual(await page.evaluate(()=>tokenCalls.at(-1)),{interactive:true,scopes:['https://www.googleapis.com/auth/drive.file']});
  assert.equal(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_connected')).pwm_drive_connected),true);
  httpStatus=200;expectToken='builtin-token';await page.locator('#driveSave').click();await waitStatus(page,'保存しました');
  assert.equal(await page.evaluate(()=>tokenCalls.at(-1).interactive),false);
  assert.equal(await page.evaluate(async()=>(await chrome.storage.session.get('pwm_drive_auth')).pwm_drive_auth),undefined,'builtin mode must not store tokens');
  // 401 -> cached token removed, then the next save gets a fresh token silently
  httpStatus=401;await page.locator('#driveSave').click();await waitStatus(page,'再接続');assert.deepEqual(await page.evaluate(()=>removed),['builtin-token']);
  httpStatus=200;await page.evaluate(()=>tokenMode='second');expectToken='builtin-token-2';await page.locator('#driveSave').click();await waitStatus(page,'保存しました');
  await page.locator('#driveDisconnect').click();await waitStatus(page,'解除しました');
  assert.equal(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_connected')).pwm_drive_connected),undefined);
  assert.ok((await page.evaluate(()=>removed)).includes('builtin-token-2'));
  const afterDisconnect=count;await page.locator('#driveSave').click();await waitStatus(page,'接続してください');assert.equal(count,afterDisconnect);
  console.log('PASS manual: state rejection, upload, no credentials in backup, 403/401, silent prompt=none renewal, failed renewal blocks; builtin: manual setup hidden, deny, connect, non-interactive token, 401 removes cached token, disconnect; widths 280–1440. Real Google login/upload not tested.');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
