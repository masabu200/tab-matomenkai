const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const i18n=require('./i18n-stub.cjs');
// Run the pure part of space-share.js without DOM.
const ctx={...i18n,URL,TextEncoder,TextDecoder,Blob,Response,CompressionStream,DecompressionStream,btoa,atob,document:{getElementById:()=>null,readyState:'complete'},navigator:{},setTimeout};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('extension/backup-validation.js','utf8')+'\n;globalThis.validateBackup=validateBackup;',ctx);
vm.runInContext(fs.readFileSync('extension/space-share.js','utf8'),ctx);
const S=ctx.SpaceShare;const j=x=>JSON.parse(JSON.stringify(x));
let n=0;const makeId=()=>'id'+(++n);
const data=()=>({categories:[{id:'c1',name:'Client',parentId:null,color:''},{id:'c2',name:'Web',parentId:'c1',color:''}],spaces:[
 {id:'a',name:'Site A',categoryId:'c2',color:'#f00',tabGroups:[{id:'g1',name:'Refs',color:'#00f',collapsed:true}],tabs:[{title:'Doc',url:'https://docs.example.com/d?token=SECRET#x',groupId:'g1',favIconUrl:'x'},{title:'Home',url:'https://a.example/',groupId:null}]},
 {id:'b',name:'Site B',categoryId:null,tabs:[{title:'B',url:'https://b.example/'}]}]});
test('pack keeps only chosen spaces, category path, groups; strips query when asked',()=>{
 const p=j(S.pack(data(),['a'],{stripQuery:true}));
 assert.equal(p.format,'tab-matomen-kai/spaces');assert.equal(p.spaces.length,1);
 assert.deepEqual(p.spaces[0].categoryPath,['Client','Web']);
 assert.equal(p.spaces[0].tabs[0].url,'https://docs.example.com/d');assert.equal(p.spaces[0].tabs[0].groupId,'g1');
 assert.ok(!('favIconUrl' in p.spaces[0].tabs[0]),'favicons are not exported');
 assert.equal(j(S.pack(data(),['a'])).spaces[0].tabs[0].url,'https://docs.example.com/d?token=SECRET#x');
});
test('merge adds without overwriting: new ids, (2) suffix, categories matched by path, groups remapped',()=>{
 const target=data();const pkg=S.validatePackage(j(S.pack(data(),['a','b'])));
 const added=S.merge(target,pkg,makeId);
 assert.equal(target.spaces.length,4);assert.deepEqual(j(added.map(s=>s.name)),['Site A (2)','Site B (2)']);
 assert.equal(added[0].categoryId,'c2','existing nested category reused');assert.equal(target.categories.length,2);
 assert.notEqual(added[0].tabGroups[0].id,'g1');assert.equal(added[0].tabs[0].groupId,added[0].tabGroups[0].id);
 assert.ok(added.every(s=>s.id!=='a'&&s.id!=='b'));
 const fresh={spaces:[],categories:[]};S.merge(fresh,pkg,makeId);
 assert.deepEqual(j(fresh.categories.map(c=>c.name)),['Client','Web'],'missing categories created');
 assert.equal(fresh.categories[1].parentId,fresh.categories[0].id);
});
test('validatePackage rejects broken or unsafe input',()=>{
 const good=j(S.pack(data(),['b']));
 for(const bad of [null,{},{...good,format:'x'},{...good,version:2},{...good,spaces:[]},{...good,spaces:[{name:'x',tabs:[{url:'javascript:alert(1)'}]}]},{...good,spaces:[{name:'x',tabs:[{url:'chrome://settings'}]}]},{...good,spaces:[{name:5,tabs:[]}]},{...good,spaces:[{name:'x',tabs:[],categoryPath:['']}]}])
  assert.throws(()=>S.validatePackage(bad));
 assert.ok(S.validatePackage(good));
});
test('share code round-trips and garbage is rejected',async()=>{
 const pkg=S.pack(data(),['a','b']);const code=await S.toCode(pkg);
 assert.match(code,/^TMK1\.[A-Za-z0-9_-]+$/);
 const back=await S.parseInput(code);assert.deepEqual(j(back.spaces.map(s=>s.name)),['Site A','Site B']);
 const viaJson=await S.parseInput(JSON.stringify(pkg));assert.equal(viaJson.spaces.length,2);
 await assert.rejects(S.parseInput('TMK1.notreallybase64!!'));await assert.rejects(S.parseInput('hello'));await assert.rejects(S.parseInput(''));
});
