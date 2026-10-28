const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-drive-test-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const waitStatus=(page,text)=>page.waitForFunction(t=>document.querySelector('#driveStatus').textContent.includes(t),text);

  // ---------- in-memory Google Drive ----------
  const drive={files:new Map(),seq:0,uploads:0,deletes:[],lastMetadata:null};let expectToken='fixture-secret';let uploadStatus=200;
  const json=(status,body)=>({status,contentType:'application/json',body:JSON.stringify(body)});
  await context.route('https://www.googleapis.com/upload/drive/v3/files?**',async route=>{
    drive.uploads++;const req=route.request();assert.equal(req.headers().authorization,'Bearer '+expectToken);
    const parts=req.postData().split(/--pwm_[0-9a-f-]+/);const metadata=JSON.parse(parts[1].split('\r\n\r\n')[1].trim());const content=parts[2].split('\r\n\r\n')[1].trim();
    drive.lastMetadata={metadata,content};assert.ok(!content.includes('fixture-secret'));
    if(uploadStatus!==200)return route.fulfill(json(uploadStatus,{error:{message:'denied'}}));
    const fid='bk'+(++drive.seq);drive.files.set(fid,{id:fid,name:metadata.name,createdTime:new Date(Date.now()+drive.seq*1000).toISOString(),appProperties:metadata.appProperties,parents:metadata.parents,content});
    route.fulfill(json(200,{id:fid,name:metadata.name}));
  });
  await context.route('https://www.googleapis.com/drive/v3/**',async route=>{
    const req=route.request();const url=new URL(req.url());assert.equal(req.headers().authorization,'Bearer '+expectToken);
    const m=url.pathname.match(/^\/drive\/v3\/files(?:\/([\w-]+))?$/);const fid=m&&m[1];const qs=url.searchParams.get('q')||'';
    if(req.method()==='GET'&&!fid&&qs.includes("value='folder'")){const f=[...drive.files.values()].find(x=>x.appProperties?.pwm==='folder');return route.fulfill(json(200,{files:f?[{id:f.id}]:[]}));}
    if(req.method()==='GET'&&!fid&&qs.includes("value='backup'")){const list=[...drive.files.values()].filter(x=>x.appProperties?.pwm==='backup').sort((a,b)=>b.createdTime.localeCompare(a.createdTime)).map(({id,name,createdTime,appProperties})=>({id,name,createdTime,appProperties}));return route.fulfill(json(200,{files:list}));}
    if(req.method()==='POST'&&!fid){const body=JSON.parse(req.postData());const nid='folder'+(++drive.seq);drive.files.set(nid,{id:nid,name:body.name,createdTime:new Date().toISOString(),appProperties:body.appProperties});return route.fulfill(json(200,{id:nid}));}
    if(req.method()==='GET'&&fid){const f=drive.files.get(fid);if(!f)return route.fulfill(json(404,{error:{message:'not found'}}));if(url.searchParams.get('alt')==='media')return route.fulfill({status:200,contentType:'application/json',body:f.content});return route.fulfill(json(200,{id:f.id,trashed:false}));}
    if(req.method()==='DELETE'&&fid){drive.deletes.push(fid);drive.files.delete(fid);return route.fulfill({status:204,body:''});}
    route.fulfill(json(400,{error:{message:'unexpected '+req.method()+' '+url.pathname}}));
  });

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
  await page.locator('#driveSave').click();await waitStatus(page,'保存しました');
  assert.equal(drive.uploads,1);assert.match(drive.lastMetadata.content,/"spaces"/);assert.match(drive.lastMetadata.content,/"categories"/);
  // folder created on first save and used as parent; backup tagged with counts
  const folder=[...drive.files.values()].find(f=>f.appProperties?.pwm==='folder');assert.ok(folder,'folder created');assert.equal(folder.name,'タブまとめん改 バックアップ');
  assert.deepEqual(drive.lastMetadata.metadata.parents,[folder.id]);assert.equal(drive.lastMetadata.metadata.appProperties.pwm,'backup');
  const firstBackup=[...drive.files.values()].find(f=>f.appProperties?.pwm==='backup');assert.equal(await page.locator('#driveLastBackup a').getAttribute('href'),`https://drive.google.com/file/d/${firstBackup.id}/view`);
  assert.equal(await page.locator('#driveFolderLink').getAttribute('href'),`https://drive.google.com/drive/folders/${folder.id}`);
  const before=await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_last_backup')).pwm_drive_last_backup);
  uploadStatus=403;await page.locator('#driveSave').click();await waitStatus(page,'403');assert.deepEqual(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_last_backup')).pwm_drive_last_backup),before);
  // silent renewal: expired session token + stored client ID -> prompt=none, non-interactive
  uploadStatus=200;await page.evaluate(async()=>{await chrome.storage.session.set({pwm_drive_auth:{token:'stale',expiresAt:Date.now()-1}});authMode='renew';});
  expectToken='renewed-secret';await page.locator('#driveSave').click();await waitStatus(page,'保存しました');
  assert.deepEqual(await page.evaluate(()=>authCalls.at(-1)),{interactive:false,prompt:'none'});
  // 401 clears the session token; a failed silent renewal asks to reconnect without calling Drive
  uploadStatus=401;await page.locator('#driveSave').click();await waitStatus(page,'再接続');assert.equal(await page.evaluate(async()=>(await chrome.storage.session.get('pwm_drive_auth')).pwm_drive_auth),undefined);
  await page.evaluate(()=>authMode='fail');const calls=drive.uploads;await page.locator('#driveSave').click();await waitStatus(page,'接続してください');assert.equal(drive.uploads,calls);
  for(const width of [280,320,375,768,1024,1440]){
   await page.setViewportSize({width,height:900});await page.locator('.drive-settings summary').click();
   assert.ok(await page.locator('.drive-settings').evaluate(e=>e.scrollWidth<=e.clientWidth+1),`overflow ${width}`);
   await page.locator('.drive-settings summary').click();
  }
  await page.setViewportSize({width:375,height:900});await page.locator('.drive-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'evidence/drive-backup-settings.png'});
  await page.close();

  // ---------- builtin mode (the real manifest carries oauth2; identity is mocked) ----------
  await worker.evaluate(()=>chrome.storage.local.remove(['pwm_drive_connected','pwm_drive_folder_id']));
  drive.files.clear();drive.uploads=0;drive.deletes=[];uploadStatus=200;
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
  const beforeCount=drive.uploads;await page.locator('#driveSave').click();await waitStatus(page,'接続してください');assert.equal(drive.uploads,beforeCount);
  await page.evaluate(()=>tokenMode='deny');await page.locator('#driveConnect').click();await waitStatus(page,'許可されませんでした');
  assert.equal(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_connected')).pwm_drive_connected),undefined);
  await page.evaluate(()=>tokenMode='ok');expectToken='builtin-token';await page.locator('#driveConnect').click();await waitStatus(page,'接続しました');
  assert.deepEqual(await page.evaluate(()=>tokenCalls.at(-1)),{interactive:true,scopes:['https://www.googleapis.com/auth/drive.file']});
  // keep count: default 30; set to 2 -> the third save removes the oldest, newest kept
  assert.equal(await page.locator('#driveKeep').inputValue(),'30');
  await page.evaluate(()=>{const s=document.getElementById('driveKeep');s.append(new Option('2','2'));s.value='2';s.dispatchEvent(new Event('change'))});
  await page.waitForFunction(async()=>await DriveBackup.keepCount()===2).catch(()=>{});
  assert.equal(await page.evaluate(()=>DriveBackup.keepCount()),2);
  await worker.evaluate(()=>chrome.storage.local.set({pwm_data:{spaces:[{id:'s1',name:'現在A',tabs:[{url:'https://a.example/',title:'A'}],categoryId:null,archived:false,color:''},{id:'s2',name:'現在B',tabs:[],categoryId:null,archived:false,color:''}],categories:[],activeSpaceId:'s1',windowActiveSpaces:{}}}));
  await page.waitForTimeout(300);
  for(let i=0;i<3;i++){await page.locator('#driveSave').click();await waitStatus(page,'保存しました');await page.waitForTimeout(50);}
  assert.equal(drive.uploads,3);assert.equal(drive.deletes.length,1,'oldest pruned once keep=2 exceeded');
  assert.equal([...drive.files.values()].filter(f=>f.appProperties?.pwm==='backup').length,2);
  assert.match(await page.locator('#driveStatus').textContent(),/古い 1 件を削除/);
  assert.equal(await page.evaluate(()=>tokenCalls.at(-1).interactive),false);
  assert.equal(await page.evaluate(async()=>(await chrome.storage.session.get('pwm_drive_auth')).pwm_drive_auth),undefined,'builtin mode must not store tokens');
  // list shows the two remaining backups with counts
  await page.locator('#driveRefresh').click();await waitStatus(page,'接続中');await page.waitForFunction(()=>document.querySelectorAll('#driveBackups option').length===2);
  assert.match(await page.locator('#driveBackups option').first().textContent(),/スペース 2 \/ カテゴリー 0/);
  // restore an older backup: confirm dialog, data replaced, undo returns the previous data
  const oldest=[...drive.files.values()].filter(f=>f.appProperties?.pwm==='backup').sort((a,b)=>a.createdTime.localeCompare(b.createdTime))[0];
  oldest.content=JSON.stringify({version:1,exportedAt:'2026-01-01T00:00:00.000Z',activeSpaceId:'r1',categories:[{id:'c1',name:'復元カテゴリ',parentId:null,color:''}],spaces:[{id:'r1',name:'復元スペース',tabs:[{url:'https://r.example/',title:'R'}],categoryId:'c1',archived:false,color:''}]});
  await page.locator('#driveBackups').selectOption(oldest.id);
  await page.locator('#driveRestore').click();await page.locator('#panelDialog').waitFor();
  assert.match(await page.locator('#panelDialog').textContent(),/スペース 1 件、カテゴリー 1 件/);
  await page.locator('#panelDialog button.btn--ghost').click();await page.locator('#panelDialog').waitFor({state:'detached'});
  assert.equal((await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data.spaces.length)),2,'cancel keeps data');
  await page.locator('#driveRestore').click();await page.locator('#panelDialog').waitFor();await page.locator('#panelDialog button[type=submit]').click();
  await waitStatus(page,'復元しました（スペース 1 / カテゴリー 1）');
  let data=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);assert.deepEqual(data.spaces.map(s=>s.name),['復元スペース']);assert.equal(data.categories.length,1);
  assert.equal(await page.locator('#driveRestoreUndo').isVisible(),true);
  await page.locator('#driveRestoreUndo').click();await waitStatus(page,'復元前のデータに戻しました');
  data=await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_data')).pwm_data);assert.deepEqual(data.spaces.map(s=>s.name),['現在A','現在B']);
  assert.equal(await page.locator('#driveRestoreUndo').isHidden(),true);
  // 401 -> cached token removed, then the next save gets a fresh token silently
  uploadStatus=401;await page.locator('#driveSave').click();await waitStatus(page,'再接続');assert.deepEqual(await page.evaluate(()=>removed),['builtin-token']);
  uploadStatus=200;await page.evaluate(()=>tokenMode='second');expectToken='builtin-token-2';await page.locator('#driveSave').click();await waitStatus(page,'保存しました');
  await page.locator('#driveDisconnect').click();await waitStatus(page,'解除しました');
  assert.equal(await page.evaluate(async()=>(await chrome.storage.local.get('pwm_drive_connected')).pwm_drive_connected),undefined);
  assert.ok((await page.evaluate(()=>removed)).includes('builtin-token-2'));
  const afterDisconnect=drive.uploads;await page.locator('#driveSave').click();await waitStatus(page,'接続してください');assert.equal(drive.uploads,afterDisconnect);
  console.log('PASS manual: state rejection, upload into created folder with tags, no credentials in backup, 403/401, silent prompt=none renewal, failed renewal blocks; builtin: manual setup hidden, deny, connect, keep=2 prunes oldest, list with counts, restore cancel/confirm/undo, 401 removes cached token, disconnect; widths 280–1440. Real Google not tested.');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
