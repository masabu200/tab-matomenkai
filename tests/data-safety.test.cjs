const i18n=require('./i18n-stub.cjs');const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('invalid backup entries and category cycles rejected, legacy backup accepted',()=>{
 const ctx={URL,...i18n};vm.createContext(ctx);vm.runInContext(fs.readFileSync('extension/backup-validation.js','utf8'),ctx);
 for(const data of [{spaces:[{id:'x',name:'X',tabs:null}]},{spaces:[null]},{spaces:[],categories:[{id:'a',name:'A',parentId:'a'}]},{spaces:[{id:'x',name:'X',tabs:[{url:'javascript:alert(1)'}]}]}])assert.throws(()=>ctx.validateBackup(data));
 assert.doesNotThrow(()=>ctx.validateBackup({spaces:[{id:'x',name:'X',tabs:[{url:'https://example.com'}]}]}));
});
test('right-layout toolbar creates dashboard and registers session without errors',async()=>{
 let click;const errors=[],stored={};const event={addListener(){}};const chrome={runtime:{getURL:p=>'chrome-extension://test/'+p,onInstalled:event,onStartup:event,onMessage:event},action:{onClicked:{addListener:f=>click=f}},sidePanel:{getLayout:async()=>({side:'right'})},storage:{session:{get:async()=>stored,set:async d=>Object.assign(stored,d)}},windows:{getCurrent:async()=>({id:1})},tabs:{query:async()=>[],create:async()=>({id:8}),update:async()=>{},move:async()=>{},onUpdated:event,onRemoved:event},alarms:{onAlarm:event}};
 vm.runInNewContext(fs.readFileSync('extension/background.js','utf8'),{chrome,console:{error:(...a)=>errors.push(a)},...i18n});await click({windowId:1});assert.equal(errors.length,0);assert.equal(stored.pwm_dashboard_tab_ids[0],8);
});
