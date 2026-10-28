// Every locale must cover every key with the same placeholders; sources must contain no stray Japanese.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root='extension/_locales';
const ja=JSON.parse(fs.readFileSync(path.join(root,'ja/messages.json'),'utf8'));
const placeholders=s=>(s.match(/\$\d/g)||[]).sort().join(',');
test('all locales cover the Japanese catalog with matching placeholders and non-empty messages',()=>{
 const locales=fs.readdirSync(root).filter(d=>fs.existsSync(path.join(root,d,'messages.json')));
 assert.ok(locales.length>=10,`locales: ${locales.join(',')}`);
 for(const code of locales){
  const data=JSON.parse(fs.readFileSync(path.join(root,code,'messages.json'),'utf8'));
  const missing=Object.keys(ja).filter(k=>!(k in data));const extra=Object.keys(data).filter(k=>!(k in ja));
  assert.deepEqual(missing,[],`${code} missing`);assert.deepEqual(extra,[],`${code} extra`);
  for(const [k,v] of Object.entries(data)){
   assert.equal(typeof v.message,'string',`${code}/${k}`);assert.ok(v.message.length>0,`${code}/${k} empty`);
   assert.equal(placeholders(v.message),placeholders(ja[k].message),`${code}/${k} placeholders`);
   assert.match(k,/^[A-Za-z0-9_@]+$/,`${code}/${k} key format`);
  }
 }
});
test('manifest uses __MSG__ names and the default locale exists',()=>{
 const manifest=JSON.parse(fs.readFileSync('extension/manifest.json','utf8'));
 assert.ok(fs.existsSync(path.join(root,manifest.default_locale,'messages.json')));
 for(const ref of [manifest.name,manifest.description,manifest.action.default_title]){
  const m=ref.match(/^__MSG_(\w+)__$/);assert.ok(m,ref);assert.ok(ja[m[1]],m[1]);
 }
});
test('every key referenced by sources exists; sources have no untranslated Japanese literals',()=>{
 const files=fs.readdirSync('extension').filter(f=>/\.(js|html)$/.test(f)).map(f=>fs.readFileSync(path.join('extension',f),'utf8')).join('\n');
 const refs=new Set([...files.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map(m=>m[1]).concat([...files.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)].map(m=>m[1])).concat([...files.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap(m=>m[1].split(';').map(p=>p.split(':')[1]))));
 assert.deepEqual([...refs].filter(k=>!ja[k]),[]);
 const out=execFileSync('node',['tools/i18n-extract.mjs','--dry'],{encoding:'utf8'});
 assert.match(out,/messages: 0 /,out);
});
