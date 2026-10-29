// Screenshots of each colour theme (palette × light/dark) of the dashboard at 1280x800.
// Usage: node tools/palette-screenshots.cjs [outDir] [palette:light|dark ...]
const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('fs'),path=require('path'),os=require('os');
const args=process.argv.slice(2);
const outDir=path.resolve(args[0]||'evidence/palettes');
const combos=args.slice(1).length?args.slice(1):['standard','pink','beige','mint','navy'].flatMap(p=>[p+':light',p+':dark']);
(async()=>{
 fs.mkdirSync(outDir,{recursive:true});
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'palette-shots-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const p=await context.newPage();await p.setViewportSize({width:1280,height:800});
  await p.goto(`chrome-extension://${id}/dashboard.html`);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  await p.evaluate(async()=>{const t=(title,url,g)=>({title,url,groupId:g||null});
   const d={categories:[{id:'c1',name:'クライアント',collapsed:false}],windowActiveSpaces:{},spaces:[
    {id:'a',name:'Webサイト制作 A社',categoryId:'c1',tabs:[t('デザインカンプ - Figma','https://www.figma.com/file/abc','g1'),t('要件定義シート','https://docs.google.com/spreadsheets/d/x','g1'),t('GitHub - a-corp/site','https://github.com/a-corp/site'),t('MDN Web Docs: CSS Grid','https://developer.mozilla.org/ja/docs/Web/CSS/CSS_grid_layout'),t('Google Analytics','https://analytics.google.com/'),t('Chatwork - A社','https://www.chatwork.com/')],tabGroups:[{id:'g1',name:'資料',color:'pink',collapsed:false}]},
    {id:'b',name:'ブログ記事の下書き',categoryId:'c1',tabs:[t('note','https://note.com/')],tabGroups:[]},
    {id:'c',name:'旅行の計画',tabs:[t('じゃらん','https://www.jalan.net/')],tabGroups:[]}]};
   setActiveSpaceId(d,'a');await saveData(d);});
  await p.waitForSelector('.tab-card');
  for(const combo of combos){
   const [palette,theme]=combo.split(':');
   await worker.evaluate(async([palette,theme])=>{const cur=(await chrome.storage.local.get('pwm_settings')).pwm_settings||{};await chrome.storage.local.set({pwm_theme:theme,pwm_settings:{...cur,palette,autoSaveOnSwitch:false,backupIntervalHours:0}})},[palette,theme]);
   await p.reload();await p.waitForSelector('.tab-card');await p.waitForTimeout(400);
   await p.locator('.tab-card__checkbox').nth(2).click();
   await p.screenshot({path:path.join(outDir,`${palette}-${theme}.png`)});
   await p.locator('#openSettings').click();await p.waitForTimeout(200);
   await p.screenshot({path:path.join(outDir,`${palette}-${theme}-settings.png`)});
   await p.keyboard.press('Escape');
  }
  console.log('saved',combos.length*2,'screenshots to',outDir);
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
