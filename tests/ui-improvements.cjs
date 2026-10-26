const {chromium}=require('/Users/mugikura/node_modules/playwright');const UI=require('./ui.cjs');
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('node:assert/strict');
// 2026-10-26 UI/UX改善: グループのインライン展開、保存状態の常時表示、キーボードショートカット、狭い幅のレイアウト
(async()=>{
 // 外部サイトに依存しないようローカルHTTPサーバーを使う（回線速度でタブの読み込み完了が遅れると判定が不安定になる）
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Local</title><p>test</p>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'ui-improve-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1280,height:800});
  await p.goto(`chrome-extension://${id}/dashboard.html`);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  await p.evaluate(async()=>{
   const d={categories:[],windowActiveSpaces:{},spaces:[{id:'a',name:'案件A',tabs:[{url:'https://example.com/1',title:'One',groupId:'g1'},{url:'https://example.com/2',title:'Two',groupId:null}],tabGroups:[{id:'g1',name:'展開済み',color:'blue',collapsed:false},{id:'g2',name:'空グループ',color:'',collapsed:true}]},{id:'b',name:'案件B',tabs:[],tabGroups:[]}]};
   setActiveSpaceId(d,'a');await saveData(d);await chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}});
  });
  await p.waitForSelector('[data-group-id="g2"]');
  // 既存の展開状態は保持、折りたたみグループは閉じたまま（起動時にデータを書き換えない）
  assert.equal(await p.locator('[data-group-id="g1"]').evaluate(el=>el.classList.contains('tab-group--expanded')),true);
  assert.equal(await p.locator('[data-group-id="g2"]').evaluate(el=>el.classList.contains('tab-group--expanded')),false);
  assert.equal(await p.locator('[data-group-id="g2"] .tab-group__body').isVisible(),false);
  assert.equal(await p.locator('[data-group-id="g1"] .tab-group__header').getAttribute('aria-expanded'),'true');
  // ヘッダークリックでその場に展開し、空グループは案内を表示。状態は保存される
  await p.locator('[data-group-id="g2"] .tab-group__header').click();
  await p.waitForFunction(()=>document.querySelector('[data-group-id="g2"]').classList.contains('tab-group--expanded'));
  assert.equal(await p.locator('[data-group-id="g2"] .tab-group__empty-hint').isVisible(),true);
  await p.waitForFunction(async()=>(await loadData()).spaces[0].tabGroups.find(g=>g.id==='g2').collapsed===false);
  await p.reload();await p.waitForSelector('[data-group-id="g2"].tab-group--expanded');
  // キーボード（Enter）でも折りたためる
  await p.locator('[data-group-id="g2"] .tab-group__header').focus();await p.keyboard.press('Enter');
  await p.waitForFunction(()=>!document.querySelector('[data-group-id="g2"]').classList.contains('tab-group--expanded'));
  assert.equal(await p.locator('[data-group-id="g2"] .tab-group__header').getAttribute('aria-expanded'),'false');
  // 新規グループは折りたたみで作成される
  await p.evaluate(()=>createTabGroup('a','新規','red'));await p.waitForFunction(async()=>(await loadData()).spaces[0].tabGroups.length===3);
  assert.equal(await p.evaluate(async()=>(await loadData()).spaces[0].tabGroups[2].collapsed),true);
  console.log('PASS tab group inline expand: existing state kept, click/Enter toggle persisted, empty hint, new groups collapsed');
  // 保存状態はメインヘッダーに常時表示（設定の中ではない）
  assert.equal(await p.locator('#mainControls #workspaceSaveStatus').count(),1);
  assert.equal(await p.locator('#settingsDialog #workspaceSaveStatus').count(),0);
  await p.waitForFunction(()=>document.getElementById('workspaceSaveStatus').textContent.includes('案件A'));
  assert.equal(await p.locator('#workspaceSaveStatus').isVisible(),true);
  console.log('PASS save status visible beside the save button');
  // ショートカット: / で絞り込み、Esc で解除、⌘/Ctrl+K でスペース検索
  await p.locator('h2#spaceTitle').click();await p.keyboard.press('/');assert.equal(await p.evaluate(()=>document.activeElement.id),'searchInput');
  await p.keyboard.type('zzz');await p.waitForFunction(()=>document.querySelectorAll('.tab-card').length===0);
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.getElementById('searchInput').value===''&&document.querySelectorAll('.tab-card').length>0);
  await p.keyboard.press('ControlOrMeta+k');assert.equal(await p.evaluate(()=>document.activeElement.id),'spaceSearch');
  // 設定ダイアログが開いている間は / を奪わない
  await UI.openSettings(p);await p.keyboard.press('/');assert.notEqual(await p.evaluate(()=>document.activeElement.id),'searchInput');await UI.closeSettings(p);
  // ⌘/Ctrl+S で現在のタブを保存
  await p.evaluate(async base=>{for(const t of await getWindowTabs())if(isClosableTab(t))await chrome.tabs.remove(t.id);await chrome.tabs.create({windowId:g_dashboardWindowId,url:base+'/saved-by-shortcut',active:false})},base);
  await p.waitForFunction(()=>document.getElementById('workspaceSaveStatus').textContent.includes('変更あり'));
  assert.match(await p.locator('#btnSaveTabs').getAttribute('title'),/S）$/);
  await p.locator('h2#spaceTitle').click();await p.keyboard.press('ControlOrMeta+s');
  await p.waitForFunction(async()=>(await loadData()).spaces[0].tabs.some(t=>t.url.endsWith('/saved-by-shortcut')));
  await p.waitForFunction(()=>document.getElementById('workspaceSaveStatus').textContent.includes('保存済み'));
  console.log('PASS shortcuts: / filter, Esc clear, Cmd/Ctrl+K space search, Cmd/Ctrl+S save, no hijack while settings open');
  // 狭い幅ではサイドバーを上に積み、カードビューは1列（保存でグループが再構成されるので展開済みグループを入れ直す）
  await p.evaluate(async()=>{const d=await loadData();const sp=d.spaces.find(s=>s.id==='a');sp.tabGroups=[{id:'g1',name:'展開済み',color:'blue',collapsed:false}];sp.tabs.forEach((t,i)=>{t.groupId=i===0?'g1':null});await saveData(d)});
  await p.waitForSelector('[data-group-id="g1"].tab-group--expanded');
  await p.setViewportSize({width:600,height:900});await p.waitForTimeout(200);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.app')).flexDirection),'column');
  assert.ok(await p.evaluate(()=>document.querySelector('.sidebar').getBoundingClientRect().width>=590));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.locator('#btnViewCard').click();await p.waitForTimeout(150);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('[data-group-id="g1"] .tab-group__body')).gridTemplateColumns.split(' ').length),1);
  await p.setViewportSize({width:1280,height:800});await p.waitForTimeout(150);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.app')).flexDirection),'row');
  assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('[data-group-id="g1"] .tab-group__body')).gridTemplateColumns.split(' ').length),3);
  await p.locator('#btnViewList').click();
  console.log('PASS narrow layout stacks sidebar, card view 1 column, restores at 1280');
  // サイドパネルでは保存状態を検索欄の下に残す（メインは非表示のため）
  const panel=await context.newPage();await panel.setViewportSize({width:360,height:800});await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  await panel.evaluate(()=>{chrome.sidePanel.getLayout=async()=>({side:'left'});document.documentElement.classList.add('left-layout-verified');document.querySelector('.app').hidden=false});
  await panel.waitForFunction(()=>g_dashboardWindowId!==null);
  assert.equal(await panel.locator('.workspace-tools #workspaceSaveStatus').count(),1);
  await panel.waitForFunction(()=>document.getElementById('workspaceSaveStatus').textContent.includes('案件A'));
  assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await panel.keyboard.press('/');assert.equal(await panel.evaluate(()=>document.activeElement.id),'spaceSearch');
  assert.deepEqual(errors,[]);console.log('PASS panel keeps status under search; / focuses space search; no page errors');
 }finally{await context.close();server.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
