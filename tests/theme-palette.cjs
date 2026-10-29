const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
// テーマ（配色）の着せ替え: 設定カードで選ぶ → 背景色・文字色が変わる、再読み込み後も最初の描画から維持、
// ダークとの組み合わせ、全テーマ×ライト/ダークで主要な文字のコントラストが 4.5:1 以上
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'palette-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1280,height:800});
  // 最初の描画の直前（最初の requestAnimationFrame）の配色とダーク指定を記録する
  await p.addInitScript(()=>{requestAnimationFrame(()=>{window.__firstPaint={palette:document.documentElement.getAttribute('data-theme-palette'),dark:!!document.body&&document.body.classList.contains('theme-dark')}})});
  const url=`chrome-extension://${id}/dashboard.html`;
  const load=async()=>{await p.goto(url);await p.waitForFunction(()=>g_dashboardWindowId!==null);await p.waitForSelector('.tab-card');await p.waitForTimeout(150)};
  await p.goto(url);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  await p.evaluate(async()=>{const t=(title,url,g)=>({title,url,groupId:g||null});
   const d={categories:[],windowActiveSpaces:{},spaces:[{id:'a',name:'案件A',tabs:[t('資料','https://example.com/a','g1'),t('GitHub','https://example.com/b'),t('MDN','https://example.com/c')],tabGroups:[{id:'g1',name:'参考',color:'blue',collapsed:false}]},{id:'b',name:'案件B',tabs:[t('note','https://example.com/d')],tabGroups:[]}]};
   setActiveSpaceId(d,'a');await saveData(d);await chrome.storage.local.set({pwm_settings:{autoSaveOnSwitch:false,backupIntervalHours:0}})});
  await p.waitForSelector('.tab-card');
  const style=()=>p.evaluate(()=>({palette:document.documentElement.getAttribute('data-theme-palette'),bg:getComputedStyle(document.body).backgroundColor,title:getComputedStyle(document.getElementById('spaceTitle')).color,rail:getComputedStyle(document.querySelector('.sidebar')).backgroundColor,primary:getComputedStyle(document.getElementById('btnSaveTabs')).backgroundColor,dark:document.body.classList.contains('theme-dark')}));
  const standard=await style();
  assert.equal(standard.palette,'standard');assert.equal(standard.bg,'rgb(245, 246, 246)');assert.equal(standard.rail,'rgb(25, 28, 29)');
  // 1) 設定ダイアログのテーマカード（言語の次）
  await p.locator('#openSettings').click();
  const order=await p.evaluate(()=>[...document.querySelectorAll('#settingsDialog .settings-grid > *')].map(e=>e.className.split(' ')[0]));
  assert.equal(order.indexOf('palette-settings'),order.indexOf('language-settings')+1,order.join('|'));
  const radios=p.locator('.palette-settings input[name="palette"]');
  assert.deepEqual(await radios.evaluateAll(r=>r.map(x=>x.value)),['standard','pink','beige','mint','navy']);
  assert.equal(await p.locator('.palette-settings input[value="standard"]').isChecked(),true);
  assert.equal(await p.locator('.palette-settings [role="radiogroup"]').getAttribute('aria-labelledby'),'paletteHeading');
  assert.equal(await p.locator('.palette-swatch').count(),5);
  // 設定カード同士が重ならない（テーマカードの下端 ≦ 同じ列の次のカードの上端）
  const overlap=await p.evaluate(()=>{const a=document.querySelector('.palette-settings').getBoundingClientRect();return [...document.querySelectorAll('#settingsDialog .settings-card')].filter(c=>!c.classList.contains('palette-settings')).some(c=>{const b=c.getBoundingClientRect();return b.left<a.right&&a.left<b.right&&b.top<a.bottom&&a.top<b.bottom})});
  assert.equal(overlap,false,'theme card overlaps another settings card');
  // 2) ピンクを選ぶ → その場で背景・文字・左バー・ボタンの色が変わり、保存される
  await p.locator('.palette-option',{has:p.locator('input[value="pink"]')}).click();
  await p.waitForFunction(()=>document.documentElement.getAttribute('data-theme-palette')==='pink');
  await p.waitForTimeout(400); // .btn のフェード（transition）が終わるまで
  const pink=await style();
  assert.equal(pink.bg,'rgb(253, 243, 247)');assert.equal(pink.rail,'rgb(122, 42, 76)');assert.equal(pink.primary,'rgb(184, 51, 106)');
  assert.notEqual(pink.title,standard.title);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('settingsDialog')).backgroundColor),'rgb(106, 36, 66)','settings dialog follows the theme');
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('pwm_settings')).pwm_settings.palette),'pink');
  assert.equal(await p.evaluate(()=>localStorage.getItem('pwm_palette')),'pink');
  await p.keyboard.press('Escape');
  console.log('PASS settings theme card: 5 swatches after language, picking pink recolors page/rail/button/dialog and saves pwm_settings.palette');
  // 3) 再読み込み: <body> ができた時点ですでにピンク（ちらつきなし）
  await load();
  assert.deepEqual(await p.evaluate(()=>window.__firstPaint),{palette:'pink',dark:false});
  assert.equal((await style()).bg,'rgb(253, 243, 247)');
  assert.equal(await p.evaluate(()=>document.querySelector('.palette-settings input[value="pink"]').checked),true);
  console.log('PASS reload keeps pink from the first paint');
  // 4) ダークとの組み合わせ（ピンク×ダーク）。再読み込み後も最初からダーク
  await p.locator('#btnToggleTheme').click();
  await p.waitForTimeout(400);
  const pinkDark=await style();assert.equal(pinkDark.dark,true);assert.equal(pinkDark.bg,'rgb(27, 18, 22)');assert.equal(pinkDark.primary,'rgb(247, 163, 196)');
  await p.waitForFunction(()=>localStorage.getItem('pwm_theme_dark')==='1');
  await load();
  assert.deepEqual(await p.evaluate(()=>window.__firstPaint),{palette:'pink',dark:true});
  assert.equal((await style()).bg,'rgb(27, 18, 22)');
  console.log('PASS pink × dark applies and survives reload from the first paint');
  // 5) 別のタブ（他の画面）で変えた設定も反映される
  await worker.evaluate(async()=>{const cur=(await chrome.storage.local.get('pwm_settings')).pwm_settings;await chrome.storage.local.set({pwm_settings:{...cur,palette:'beige'}})});
  await p.waitForFunction(()=>document.documentElement.getAttribute('data-theme-palette')==='beige');
  // 不正な値は標準に戻る
  await worker.evaluate(async()=>{const cur=(await chrome.storage.local.get('pwm_settings')).pwm_settings;await chrome.storage.local.set({pwm_settings:{...cur,palette:'<script>'}})});
  await p.waitForFunction(()=>document.documentElement.getAttribute('data-theme-palette')==='standard');
  console.log('PASS storage changes from elsewhere apply live; unknown value falls back to standard');
  // 6) 全テーマ × ライト/ダークのコントラスト（本文 4.5:1）。グループ名は利用者が選んだグループ色で描くので対象外
  const results=[];
  for(const palette of ['standard','pink','beige','mint','navy'])for(const theme of ['light','dark']){
   await worker.evaluate(async([palette,theme])=>{const cur=(await chrome.storage.local.get('pwm_settings')).pwm_settings;await chrome.storage.local.set({pwm_theme:theme,pwm_settings:{...cur,palette}})},[palette,theme]);
   await p.waitForFunction(([palette,theme])=>document.documentElement.getAttribute('data-theme-palette')===palette&&document.body.classList.contains('theme-dark')===(theme==='dark'),[palette,theme]);
   await p.waitForTimeout(400);
   await p.locator('.tab-card__checkbox').first().check();
   await p.locator('#openSettings').click();
   const pairs=await p.evaluate(()=>{
    const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);const v=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1}};
    const blend=(top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
    const bgOf=el=>{const layers=[];for(let n=el;n;n=n.parentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c.a>0)layers.push(c);if(c.a>=1)break}let acc=layers.length&&layers[layers.length-1].a>=1?layers.pop():{r:255,g:255,b:255,a:1};while(layers.length)acc=blend(layers.pop(),acc);return acc};
    const lum=c=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
    const ratio=el=>{const fg=blend(parse(getComputedStyle(el).color),bgOf(el)),bg=bgOf(el);const [a,b]=[lum(fg),lum(bg)].sort((x,y)=>y-x);return Math.round((a+0.05)/(b+0.05)*100)/100};
    const items={
     'space title':'#spaceTitle','tab title':'.tab-card__title','tab url':'.tab-card__url','save button':'#btnSaveTabs','ghost button':'.main__header .btn--ghost',
     'search box':'.search-input','bulk bar count':'.bulk-bar__count',
     'rail active space':'.sidebar .space-item--active .space-item__name','rail other space':'.sidebar .space-item:not(.space-item--active) .space-item__name','rail brand':'.sidebar__brand-name','rail settings':'.sidebar-settings',
     'settings heading':'#settingsTitle','settings card title':'#paletteHeading','theme option':'.palette-option__name','settings description':'.settings-description'};
    return Object.entries(items).map(([k,sel])=>{const el=document.querySelector(sel);return [k,el?ratio(el):null]});
   });
   await p.keyboard.press('Escape');await p.locator('.tab-card__checkbox').first().uncheck();
   for(const [k,r] of pairs){assert.ok(r!==null,`${palette}/${theme}: ${k} not found`);results.push([palette,theme,k,r])}
  }
  const failing=results.filter(([palette,,,r])=>palette!=='standard'&&r<4.5);
  assert.deepEqual(failing,[],'contrast below 4.5:1: '+JSON.stringify(failing));
  const min=Math.min(...results.filter(r=>r[0]!=='standard').map(r=>r[3]));
  console.log(`PASS contrast: ${results.length} text/background pairs across 5 themes × light/dark; new themes all ≥ 4.5:1 (min ${min})`);
  assert.deepEqual(errors,[]);
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
