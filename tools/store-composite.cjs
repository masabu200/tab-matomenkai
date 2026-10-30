// Builds the Chrome Web Store listing images from the raw captures (tools/store-screenshots.cjs).
// Output: store/screenshots/<locale>/NN-*.png (1280x800) and store/promo/<locale>/ (440x280, 1400x560).
const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),url=require('node:url');
const ROOT=path.resolve(__dirname,'..');
const RAW=path.join(ROOT,'store','screenshots','raw');
const fileUrl=p=>url.pathToFileURL(p).href;
const LOGO=fileUrl(path.join(ROOT,'extension','logo.png'));

const COPY={
 ja:{brand:'タブまとめん改',font:'"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif',
  slides:[
   {img:'01-spaces.png',crop:{x:0,y:0,w:920,h:760},label:'案件ごとのスペース',title:'タブ地獄から、<br>ワンクリックで脱出。',sub:'A社のサイト、B社のLP、請求・経理…。案件ごとにタブをまとめて保存。切り替えれば、その案件のタブだけが開きます。',chips:['カテゴリーで整理','タブグループもそのまま','ピン留めタブは残る'],callouts:[{x:236,y:300,text:'← クリックで切り替え'},{x:300,y:504,text:'タブグループも保存'}],tone:'light'},
   {mock:'drive',label:'Googleドライブに自動保存',title:'PCが壊れても、<br>タブは消えない。',sub:'保存したスペースを、あなたのGoogleドライブに日時付きで自動バックアップ。新しいPCでも、選んだ日時のバックアップから元に戻せます。',chips:['自動バックアップは Pro（買い切り300円）','世代を残して選んで復元','開発者のサーバーには送らない'],tone:'dark',drive:{folder:'タブまとめん改 バックアップ',prefix:'タブまとめん改_',status:'自動バックアップ：6時間ごと',last:'最終バックアップ 10/30 12:00',pro:'Pro'}},
   {mock:'context',label:'右クリック保存',title:'見ているページを、<br>右クリックで保存。',sub:'参考サイトも資料も、右クリックして保存先の案件を選ぶだけ。ダッシュボードに戻る必要はありません。',chips:['どのページからでも','保存先を選ぶだけ','重複は自動でスキップ'],tone:'light',menu:{save:'タブまとめん改に保存',items:['コーポレートサイト制作','ECサイト改修','LP 制作（春キャンペーン）','Chrome 拡張の学習'],page:'参考になる記事 - Web制作ブログ',others:['戻る','進む','再読み込み','名前を付けて保存…','印刷…']}},
   {img:'02-bulk-actions.png',crop:{x:236,y:96,w:900,h:640},label:'一括操作',title:'選んで、<br>まとめて片付ける。',sub:'必要なタブを選んで、別の案件へ移動・グループ化・アーカイブ。URL一覧は報告用にそのままコピー。間違えても元に戻せます。',chips:['Shift で範囲選択','URL一覧をコピー','⌘Z / Ctrl+Z で元に戻す'],callouts:[{x:560,y:150,text:'3件をまとめて移動'}],tone:'dark'},
   {img:'06-create-space.png',crop:{x:210,y:80,w:860,h:640},label:'見分けやすく',title:'案件が増えても、<br>色とアイコンで迷わない。',sub:'スペースを作るときに、所属カテゴリー・色・アイコン画像をまとめて設定。クライアントのロゴも使えます。',chips:['カテゴリーは3階層まで','色・画像のアイコン','テーマ5色・ダークモード'],tone:'light'},
  ],
  promo:{tag:'案件ごとに、タブをまるごと切り替え。',sub:'フリーランスの案件管理に。Googleドライブへ自動保存'}},
 en:{brand:'Tab Matomen Kai',font:'"Inter","Helvetica Neue",Arial,system-ui,sans-serif',
  slides:[
   {img:'01-spaces.png',crop:{x:0,y:0,w:920,h:760},label:'One space per project',title:'Escape tab overload<br>in one click.',sub:'Client A\'s website, client B\'s landing page, invoices… Save each project\'s tabs as a space. Switch, and only that project\'s tabs open.',chips:['Organize with categories','Tab groups kept intact','Pinned tabs stay open'],callouts:[{x:236,y:300,text:'← Click to switch'},{x:300,y:504,text:'Tab groups saved too'}],tone:'light'},
   {mock:'drive',label:'Automatic Google Drive backup',title:'Your laptop dies.<br>Your tabs don\'t.',sub:'Spaces are backed up to your own Google Drive with timestamps. On a new computer, restore from any backup you choose.',chips:['Auto backup with Pro (one-time ¥300)','Pick a version to restore','Never sent to our servers'],tone:'dark',drive:{folder:'Tab Matomen Kai Backups',prefix:'TabMatomenKai_',status:'Automatic backup: every 6 hours',last:'Last backup Oct 30, 12:00',pro:'Pro'}},
   {mock:'context',label:'Right-click save',title:'Right-click to save<br>any page.',sub:'References and docs: right-click and pick the project. No trip back to the dashboard.',chips:['Works on any page','Just pick a space','Duplicates skipped'],tone:'light',menu:{save:'Save to Tab Matomen Kai',items:['Corporate website','Online store refresh','Spring campaign landing page','Learning Chrome extensions'],page:'A helpful article - Web design blog',others:['Back','Forward','Reload','Save as…','Print…']}},
   {img:'02-bulk-actions.png',crop:{x:236,y:96,w:900,h:640},label:'Bulk actions',title:'Select, then tidy up<br>in one go.',sub:'Pick tabs and move, group or archive them. Copy the URL list for a report. Made a mistake? Undo it.',chips:['Shift-click ranges','Copy URL lists','Undo with ⌘Z / Ctrl+Z'],callouts:[{x:560,y:150,text:'Move 3 tabs at once'}],tone:'dark'},
   {img:'06-create-space.png',crop:{x:210,y:80,w:860,h:640},label:'Easy to tell apart',title:'More projects,<br>no confusion.',sub:'Set the category, colour and icon image when you create a space. Use your client\'s logo if you like.',chips:['Up to 3 category levels','Colour or image icons','5 themes · dark mode'],tone:'light'},
  ],
  promo:{tag:'Switch whole tab sets per project.',sub:'For freelancers and agencies. Automatic Google Drive backup'}},
};

const css=(font)=>`
*{box-sizing:border-box;margin:0;padding:0}
body{width:1280px;height:800px;overflow:hidden;font-family:${font};-webkit-font-smoothing:antialiased}
.stage{position:relative;width:1280px;height:800px;overflow:hidden}
.light{background:radial-gradient(1200px 700px at 85% 10%,#e9f6f3 0%,rgba(233,246,243,0) 60%),radial-gradient(900px 600px at 0% 100%,#fff3df 0%,rgba(255,243,223,0) 55%),#f6f7f9;color:#14161c}
.dark{background:radial-gradient(1000px 700px at 90% 0%,rgba(43,179,163,.35) 0%,rgba(43,179,163,0) 60%),radial-gradient(900px 600px at 0% 100%,rgba(255,158,61,.22) 0%,rgba(255,158,61,0) 55%),#121419;color:#f2f4f7}
.copy{position:absolute;left:60px;top:84px;width:430px;z-index:3}
.brand{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;opacity:.85;margin-bottom:34px}
.brand img{width:30px;height:30px}
.label{display:inline-block;font-size:14px;font-weight:700;letter-spacing:.04em;padding:6px 12px;border-radius:999px;margin-bottom:18px}
.light .label{background:#14161c;color:#fff}
.dark .label{background:#2bb3a3;color:#08110f}
h1{font-size:40px;line-height:1.3;font-weight:800;letter-spacing:-.01em;margin-bottom:20px}
.ja h1{white-space:nowrap;font-size:38px}
.en h1{white-space:nowrap;font-size:38px}
.sub{font-size:18px;line-height:1.7;opacity:.78;margin-bottom:26px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font-size:14px;font-weight:600;padding:8px 12px;border-radius:10px;display:flex;align-items:center;gap:6px}
.light .chip{background:#fff;box-shadow:0 1px 0 rgba(20,22,28,.06),0 4px 14px rgba(20,22,28,.06)}
.dark .chip{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.chip::before{content:'';width:16px;height:16px;border-radius:50%;background:#2bb3a3 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5.5' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/16px no-repeat;flex-shrink:0}
.lang .chip::before{display:none}
.frame{position:absolute;left:520px;top:92px;width:860px;border-radius:16px;overflow:hidden;z-index:2;box-shadow:0 30px 80px rgba(10,12,18,.28),0 8px 24px rgba(10,12,18,.18)}
.dark .frame{box-shadow:0 30px 90px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)}
.bar{height:34px;display:flex;align-items:center;gap:7px;padding:0 14px;background:#e9ebef}
.dark .bar{background:#23262e}
.bar i{width:11px;height:11px;border-radius:50%;display:block}
.bar i:nth-child(1){background:#ff5f57}.bar i:nth-child(2){background:#febc2e}.bar i:nth-child(3){background:#28c840}
.bar .url{margin-left:14px;height:20px;flex:1;max-width:460px;border-radius:6px;background:rgba(255,255,255,.75);font-size:11px;line-height:20px;padding:0 10px;color:#5b6170;font-family:system-ui}
.dark .bar .url{background:rgba(255,255,255,.08);color:#a8aebb}
.shot{display:block;width:100%;height:auto}
.crop{width:100%;overflow:hidden;position:relative}
.callout{position:absolute;z-index:4;font-size:15px;font-weight:700;padding:9px 14px;border-radius:12px;background:#ff9e3d;color:#1b1206;box-shadow:0 10px 24px rgba(255,158,61,.35);white-space:nowrap}
.callout::after{content:'';position:absolute;left:18px;bottom:-7px;width:14px;height:14px;background:#ff9e3d;transform:rotate(45deg);border-radius:2px}
/* context menu mock */
.page{position:absolute;left:540px;top:110px;width:690px;height:560px;border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 30px 80px rgba(10,12,18,.22);z-index:2}
.page .bar{background:#e9ebef}
.page .art{padding:30px 34px}
.page .art h2{font-size:24px;margin-bottom:14px;color:#14161c}
.page .art p{height:12px;border-radius:6px;background:#eceef2;margin-bottom:12px}
.page .art .img{height:150px;border-radius:12px;background:linear-gradient(135deg,#dff3ef,#fdeeda);margin:18px 0}
.menu{position:absolute;z-index:5;min-width:240px;background:#fff;border-radius:10px;padding:6px 0;box-shadow:0 18px 50px rgba(10,12,18,.28),0 0 0 1px rgba(10,12,18,.08);font-size:14px;color:#1f232b;font-family:system-ui,-apple-system,"Hiragino Sans",sans-serif}
.menu div{padding:7px 16px;display:flex;align-items:center;gap:10px;white-space:nowrap}
.menu hr{border:0;border-top:1px solid #eceef2;margin:5px 0}
.menu .hi{background:#2bb3a3;color:#fff}
.menu .hi::after{content:'›';margin-left:auto;padding-left:24px}
.menu img{width:16px;height:16px}
.sub-menu .first{background:#e8f6f3;font-weight:700}
.cursor{position:absolute;z-index:6;width:22px;height:22px}
/* drive mock */
.drv{position:absolute;left:530px;top:110px;width:700px;border-radius:16px;overflow:hidden;background:#fff;color:#1f232b;z-index:2;box-shadow:0 30px 90px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08)}
.drv .bar{background:#e9ebef}
.drv .hd{display:flex;align-items:center;gap:12px;padding:22px 28px 14px;font-size:20px;font-weight:700}
.drv .hd svg{width:28px;height:28px}
.drv .row{display:flex;align-items:center;gap:14px;padding:13px 28px;border-top:1px solid #eef0f3;font-size:15px}
.drv .row .ic{width:26px;height:30px;border-radius:4px;background:#e8f0fe;color:#1a73e8;font-size:10px;font-weight:800;display:grid;place-items:center;flex:none}
.drv .row .d{margin-left:auto;color:#6b7280;font-size:13px}
.drv .row.new{background:#e8f6f3}
.toast{position:absolute;left:820px;top:560px;z-index:4;background:#1c1f24;color:#f2f4f7;border-radius:14px;padding:18px 22px;min-width:340px;box-shadow:0 20px 50px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1)}
.toast .t1{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:700}
.toast .t1 b{font-size:12px;background:#ff9e3d;color:#1b1206;border-radius:999px;padding:3px 9px}
.toast .t1 i{width:20px;height:20px;border-radius:50%;background:#2bb3a3;display:inline-block;flex:none}
.toast .t2{font-size:14px;opacity:.7;margin-top:6px;padding-left:30px}
`;
const frameHtml=(locale,img,crop,urlText)=>{
 const src=fileUrl(path.join(RAW,locale,img));
 const body=crop?`<div class="crop" style="height:${Math.round(860/crop.w*crop.h)}px"><img class="shot" style="position:absolute;width:${Math.round(1280*860/crop.w)}px;left:${-Math.round(crop.x*860/crop.w)}px;top:${-Math.round(crop.y*860/crop.w)}px" src="${src}"></div>`:`<img class="shot" src="${src}">`;
 return `<div class="frame"><div class="bar"><i></i><i></i><i></i><div class="url">${urlText}</div></div>${body}</div>`;
};
function slideHtml(locale,s){
 const c=COPY[locale];
 const copy=`<div class="copy"><div class="brand"><img src="${LOGO}">${c.brand}</div><span class="label">${s.label}</span><h1>${s.title}</h1><p class="sub">${s.sub}</p><div class="chips ${s.chips.length>6?'lang':''}">${s.chips.map(x=>`<span class="chip">${x}</span>`).join('')}</div></div>`;
 let visual='';
 if(s.mock==='drive'){
  const d=s.drive;const pad=n=>String(n).padStart(2,'0');
  const rows=[['10-30',12],['10-30',6],['10-30',0],['10-29',18],['10-29',12],['10-29',6]].map(([day,h],i)=>{const name=`${d.prefix}2026-${day}T${pad(h)}-00-00-000Z.json`;return `<div class="row ${i===0?'new':''}"><span class="ic">JSON</span>${name}<span class="d">${day.replace('-','/')} ${pad(h)}:00</span></div>`}).join('');
  visual=`<div class="drv"><div class="bar"><i></i><i></i><i></i><div class="url">drive.google.com</div></div><div class="hd"><svg viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z" fill="#5f6368"/></svg>${d.folder}</div>${rows}</div>
  <div class="toast"><div class="t1"><i></i>${d.status}<b>${d.pro}</b></div><div class="t2">${d.last}</div></div>`;
 } else if(s.mock==='context'){
  const m=s.menu;
  visual=`<div class="page"><div class="bar"><i></i><i></i><i></i><div class="url">https://blog.example.com/article</div></div><div class="art"><h2>${m.page}</h2><p style="width:92%"></p><p style="width:84%"></p><div class="img"></div><p style="width:95%"></p><p style="width:70%"></p><p style="width:88%"></p></div></div>
  <div class="menu" style="left:700px;top:300px">${m.others.slice(0,3).map(x=>`<div>${x}</div>`).join('')}<hr>${m.others.slice(3).map(x=>`<div>${x}</div>`).join('')}<hr><div class="hi"><img src="${LOGO}">${m.save}</div></div>
  <div class="menu sub-menu" style="left:950px;top:420px">${m.items.map((x,i)=>`<div class="${i===0?'first':''}">${x}</div>`).join('')}</div>
  <svg class="cursor" style="left:1160px;top:446px" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.6L20 11z" fill="#14161c" stroke="#fff" stroke-width="1.5"/></svg>`;
 } else {
  visual=frameHtml(locale,s.img,s.crop,'chrome-extension://tab-matomen-kai/dashboard');
 }
 const cr=s.crop||{x:0,y:0,w:1280,h:800};const k=860/cr.w;
 const callouts=(s.callouts||[]).map(o=>`<div class="callout" style="left:${Math.round(520+(o.x-cr.x)*k-18)}px;top:${Math.round(92+34+(o.y-cr.y)*k-52)}px">${o.text}</div>`).join('');
 return `<!doctype html><html><head><meta charset="utf-8"><style>${css(c.font)}</style></head><body class="${locale}"><div class="stage ${s.tone}">${copy}${visual}${callouts}</div></body></html>`;
}
function promoHtml(locale,w,h){
 const c=COPY[locale];const big=w>1000;
 const shot=fileUrl(path.join(RAW,locale,'01-spaces.png'));
 return `<!doctype html><html><head><meta charset="utf-8"><style>${css(c.font)}
 body{width:${w}px;height:${h}px}.stage{width:${w}px;height:${h}px}
 .p{position:absolute;left:${big?80:28}px;top:${big?150:44}px;width:${big?560:384}px;z-index:3}
 .p .logo{width:${big?72:48}px;height:${big?72:48}px;margin-bottom:${big?20:12}px}
 .p h1{font-size:${big?52:30}px;margin-bottom:${big?14:8}px}
 .p .t{font-size:${big?26:17}px;font-weight:700;line-height:1.45;margin-bottom:${big?14:6}px}
 .p .s{font-size:${big?17:12}px;opacity:.7}
 .mini{position:absolute;left:${big?700:0}px;top:${big?70:0}px;width:${big?820:0}px;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);display:${big?'block':'none'}}
 </style></head><body><div class="stage dark"><div class="p"><img class="logo" src="${LOGO}"><h1>${c.brand}</h1><div class="t">${c.promo.tag}</div><div class="s">${c.promo.sub}</div></div><div class="mini"><img class="shot" src="${shot}"></div></div></body></html>`;
}

(async()=>{
 const browser=await chromium.launch({headless:true});
 const tmp=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-comp-'));
 try{
  for(const locale of Object.keys(COPY)){
   const out=path.join(ROOT,'store','screenshots',locale);fs.mkdirSync(out,{recursive:true});
   const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
   const names=['01-spaces','02-drive-backup','03-right-click','04-bulk-actions','05-create-space'];
   for(const [i,s] of COPY[locale].slides.entries()){
    const f=path.join(tmp,`${locale}-${i}.html`);fs.writeFileSync(f,slideHtml(locale,s));
    await page.goto(fileUrl(f));await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(out,names[i]+'.png')});
   }
   await page.close();
   const promoOut=path.join(ROOT,'store','promo',locale);fs.mkdirSync(promoOut,{recursive:true});
   for(const [w,h] of [[440,280],[1400,560]]){
    const p=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
    const f=path.join(tmp,`${locale}-promo-${w}.html`);fs.writeFileSync(f,promoHtml(locale,w,h));
    await p.goto(fileUrl(f));await p.waitForLoadState('networkidle');await p.evaluate(()=>document.fonts.ready);
    await p.screenshot({path:path.join(promoOut,`promo-${w}x${h}.png`)});await p.close();
   }
   console.log('built',locale);
  }
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
