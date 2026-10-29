const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const i18n=require('./i18n-stub.cjs');
const ctx={...i18n,crypto:globalThis.crypto,TextEncoder};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('extension/drive-auto.js','utf8'),ctx);
const A=ctx.DriveAuto;const H=3600000;const now=Date.parse('2026-10-29T12:00:00Z');
const base={enabled:true,intervalHours:6,lastHash:'old',lastSuccessAt:now-7*H,failures:0,nextRetryAt:0,needsReconnect:false,dirtyAt:now-10*60000};
const env={now,hash:'new',entitled:true,connected:true};
test('decide: gates in order and saves only changed data after the interval and a quiet period',()=>{
 assert.equal(A.decide({...base,enabled:false},env),'disabled');
 assert.equal(A.decide(base,{...env,entitled:false}),'not-entitled');
 assert.equal(A.decide(base,{...env,connected:false}),'not-connected');
 assert.equal(A.decide({...base,needsReconnect:true},env),'needs-reconnect');
 assert.equal(A.decide({...base,failures:A.MAX_FAILURES},env),'paused');
 assert.equal(A.decide({...base,nextRetryAt:now+1000},env),'backoff');
 assert.equal(A.decide(base,{...env,hash:'old'}),'unchanged');
 assert.equal(A.decide({...base,dirtyAt:now-60000},env),'settling');
 assert.equal(A.decide({...base,lastSuccessAt:now-2*H},env),'too-soon');
 assert.equal(A.decide({...base,intervalHours:1,lastSuccessAt:now-2*H},env),'save');
 assert.equal(A.decide(base,env),'save');
 assert.equal(A.decide({...base,lastSuccessAt:0},env),'save','first backup does not wait for an interval');
 assert.equal(A.decide({...base,intervalHours:99,lastSuccessAt:now-5*H},env),'too-soon','unknown interval falls back to 6h');
});
test('retry delay grows exponentially and is capped at 24h',()=>{
 assert.equal(A.retryDelay(1),15*60000);assert.equal(A.retryDelay(2),30*60000);assert.equal(A.retryDelay(3),60*60000);
 assert.equal(A.retryDelay(20),24*H);
});
test('hash ignores everything but spaces and categories, and changes with them',async()=>{
 const a=await A.hashOf({spaces:[{id:'s'}],categories:[],windowActiveSpaces:{1:'s'}});
 const b=await A.hashOf({spaces:[{id:'s'}],categories:[],windowActiveSpaces:{2:'x'}});
 const c=await A.hashOf({spaces:[{id:'s2'}],categories:[]});
 assert.equal(a,b);assert.notEqual(a,c);assert.match(a,/^[0-9a-f]{64}$/);
});
