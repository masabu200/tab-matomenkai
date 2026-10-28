const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={navigator:{locks:{}},chrome:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('extension/auto-clean.js','utf8'),ctx);
const AC=ctx.AutoClean;const j=x=>JSON.parse(JSON.stringify(x));const DAY=86400000;const now=Date.parse('2026-10-28T00:00:00Z');const ago=d=>new Date(now-d*DAY).toISOString();
const sp=(id,extra)=>({id,name:id,tabs:[],categoryId:null,archived:false,color:'',createdAt:ago(400),updatedAt:ago(400),...extra});
test('plan: off does nothing; period and exclusions respected; newest usage stamp wins',()=>{
 const data={activeSpaceId:'active',windowActiveSpaces:{'7':'win'},spaces:[sp('stale'),sp('fresh',{lastOpenedAt:ago(5)}),sp('fav',{favorite:true}),sp('active'),sp('win'),sp('arch',{archived:true}),sp('saved',{tabsSavedAt:ago(40)}),sp('new',{createdAt:ago(1),updatedAt:ago(1)})]};
 assert.deepEqual(j(AC.plan(data,{autoCleanDays:0},now).ids),[]);
 assert.deepEqual(j(AC.plan(data,{autoCleanDays:60},now).ids),['stale']);
 assert.deepEqual(j(AC.plan(data,{autoCleanDays:30},now).ids),['stale','saved']);
 assert.deepEqual(j(AC.plan(data,{autoCleanDays:999},now).ids),[],'unknown period treated as off');
 assert.equal(AC.plan(data,{autoCleanDays:30,autoCleanAction:'delete'},now).action,'delete');
 assert.equal(AC.plan(data,{autoCleanDays:30,autoCleanAction:'bogus'},now).action,'archive');
});
test('apply: archive flags spaces; delete moves them to trash entries; purge drops old trash',()=>{
 const data={spaces:[sp('a'),sp('b'),sp('keep',{lastOpenedAt:ago(1)})]};
 const r1=AC.apply(data,{action:'archive',ids:['a']},now);assert.deepEqual(j(r1.archived),['a']);assert.equal(data.spaces.find(s=>s.id==='a').archived,true);assert.equal(data.spaces.find(s=>s.id==='a').autoArchived,true);assert.equal(data.spaces.length,3);
 const r2=AC.apply(data,{action:'delete',ids:['b']},now);assert.equal(r2.trashed.length,1);assert.equal(r2.trashed[0].space.id,'b');assert.deepEqual(j(data.spaces.map(s=>s.id)),['a','keep']);
 const trash=[{deletedAt:ago(31),space:sp('old')},{deletedAt:ago(29),space:sp('recent')},{bad:true}];
 assert.deepEqual(j(AC.purgeTrash(trash,now).map(e=>e.space.id)),['recent']);
});
