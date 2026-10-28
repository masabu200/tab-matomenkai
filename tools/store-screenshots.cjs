// Captures Chrome Web Store screenshots (1280x800) from the real extension with demo data.
// Usage: node tools/store-screenshots.cjs   → store/screenshots/<locale>/NN-*.png
const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'store','screenshots');

const DEMO={
 ja:{cats:[['c1','クライアント案件','#4a7ef8'],['c2','社内・学習','#4aaa5a']],spaces:[
  ['s1','c1','コーポレートサイト制作',[['デザインカンプ - Figma','https://www.figma.com/design/demo'],['WordPress 管理画面','https://example.com/wp-admin/'],['競合サイト調査','https://example.org/'],['お問い合わせフォーム仕様','https://docs.google.com/document/d/demo'],['ステージング環境','https://staging.example.com/']],[['g1','参考サイト','#4a7ef8',[2]],['g2','納品チェック','#e07835',[4]]]],
  ['s2','c1','ECサイト改修',[['商品一覧ページ','https://shop.example.com/products'],['決済設定','https://dashboard.stripe.com/test'],['在庫管理シート','https://docs.google.com/spreadsheets/d/demo']],[]],
  ['s3','c1','LP 制作（春キャンペーン）',[['ワイヤーフレーム','https://www.figma.com/file/lp'],['広告管理画面','https://ads.google.com/']],[]],
  ['s4','c2','Chrome 拡張の学習',[['chrome.tabs API','https://developer.chrome.com/docs/extensions/reference/api/tabs'],['Manifest V3 概要','https://developer.chrome.com/docs/extensions/develop/migrate']],[]],
  ['s5','c2','請求・経理',[['請求書テンプレート','https://docs.google.com/document/d/invoice'],['会計ソフト','https://example.com/accounting']],[]],
  ['s6',null,'あとで読む',[['技術ブログ','https://example.net/blog']],[]]],pinned:'Gmail',q:'案件'},
 en:{cats:[['c1','Client projects','#4a7ef8'],['c2','Learning & admin','#4aaa5a']],spaces:[
  ['s1','c1','Corporate website',[['Design mockups - Figma','https://www.figma.com/design/demo'],['WordPress admin','https://example.com/wp-admin/'],['Competitor research','https://example.org/'],['Contact form spec','https://docs.google.com/document/d/demo'],['Staging site','https://staging.example.com/']],[['g1','References','#4a7ef8',[2]],['g2','Launch checklist','#e07835',[4]]]],
  ['s2','c1','Online store refresh',[['Product listing','https://shop.example.com/products'],['Payment settings','https://dashboard.stripe.com/test'],['Inventory sheet','https://docs.google.com/spreadsheets/d/demo']],[]],
  ['s3','c1','Spring campaign landing page',[['Wireframe','https://www.figma.com/file/lp'],['Ads dashboard','https://ads.google.com/']],[]],
  ['s4','c2','Learning Chrome extensions',[['chrome.tabs API','https://developer.chrome.com/docs/extensions/reference/api/tabs'],['Manifest V3 overview','https://developer.chrome.com/docs/extensions/develop/migrate']],[]],
  ['s5','c2','Invoices & bookkeeping',[['Invoice template','https://docs.google.com/document/d/invoice'],['Accounting app','https://example.com/accounting']],[]],
  ['s6',null,'Read later',[['Engineering blog','https://example.net/blog']],[]]],pinned:'Gmail',q:'project'},
};

function buildData(locale,winId){
 const d=DEMO[locale];const now=Date.now();
 const spaces=d.spaces.map(([id,cat,name,tabs,groups],i)=>({id,name,categoryId:cat,archived:false,color:'',createdAt:new Date(now-86400000*(20+i)).toISOString(),updatedAt:new Date(now-3600000*(i+1)).toISOString(),lastOpenedAt:new Date(now-3600000*(i+1)).toISOString(),favorite:i===0,
  tabGroups:groups.map(([gid,gname,color])=>({id:gid,name:gname,color,collapsed:false})),
  tabs:tabs.map(([title,url],ti)=>{const g=groups.find(x=>x[3].includes(ti));return {title,url,favIconUrl:'',pinned:false,groupId:g?g[0]:null}})}));
 return {categories:d.cats.map(([id,name,color])=>({id,name,color,parentId:null})),spaces,activeSpaceId:'s1',windowActiveSpaces:{[winId]:'s1'}};
}

(async()=>{
 for(const locale of ['ja','en']){
  const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-shots-'));
  const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.join(ROOT,'extension')}`],ignoreDefaultArgs:['--disable-extensions'],viewport:{width:1280,height:800},deviceScaleFactor:1});
  try{
   const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
   const page=await context.newPage();
   await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
   const winId=await page.evaluate(()=>g_dashboardWindowId);
   await worker.evaluate(([data,locale])=>chrome.storage.local.set({pwm_data:data,pwm_settings:{language:locale,viewMode:'list',backupIntervalHours:24},pwm_theme:'light',pwm_review:{installedAt:Date.now(),days:[],done:true}}),[buildData(locale,winId),locale]);
   await page.reload();await page.waitForFunction(()=>typeof g_dashboardWindowId!=='undefined'&&g_dashboardWindowId!==null);
   await page.waitForTimeout(1500);await page.reload();await page.waitForFunction(()=>typeof g_dashboardWindowId!=='undefined'&&g_dashboardWindowId!==null);await page.waitForTimeout(1200);
   const out=path.join(OUT,locale);fs.mkdirSync(out,{recursive:true});
   const shot=async name=>{await page.mouse.move(1270,790);await page.evaluate(()=>{document.activeElement?.blur?.();const p=document.getElementById('navigationFullTitle');if(p)p.hidden=true;const s=document.getElementById('workspaceSaveStatus');if(s)s.style.visibility='hidden';});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,name)});};
   // 1: spaces, categories and tab groups (light, list)
   await shot('01-spaces.png');
   // 2: bulk actions with a few tabs selected
   const boxes=page.locator('.tab-card__checkbox');
   await boxes.nth(0).check();await boxes.nth(1).check({modifiers:[]});await boxes.nth(3).check();
   await shot('02-bulk-actions.png');
   await page.locator('#bulkClear').click().catch(()=>{});
   // 3: card view, dark theme
   await page.locator('#btnToggleTheme').click();
   await page.locator('#btnViewCard').click();
   await shot('03-card-dark.png');
   // 4: settings (wide, multi-column)
   await page.locator('#btnToggleTheme').click();await page.locator('#btnViewList').click();
   await page.locator('#openSettings').click();await page.waitForTimeout(400);
   await shot('04-settings.png');
   await page.locator('#closeSettings').click();
   // 5: space search
   await page.locator('#spaceSearch').fill(DEMO[locale].q).catch(()=>{});
   await shot('05-search.png');
   console.log('saved',out,fs.readdirSync(out).join(', '));
  }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
