import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {createRequire} from 'node:module';import {Client} from '@modelcontextprotocol/sdk/client/index.js';import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createBridge} from './bridge.js';import {directory} from './config.js';
const require=createRequire(import.meta.url);const {chromium}=require('/Users/mugikura/node_modules/playwright');
test('real MCP → extension proposal approval and undo; auth and stale rejection',{timeout:60000},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tab-ai-test-'));const token=crypto.randomBytes(32).toString('hex');const tokenFile=path.join(temp,'token');fs.writeFileSync(tokenFile,token,{mode:0o600});const bridge=createBridge(token);await new Promise(r=>bridge.listen(47831,'127.0.0.1',r));
 let context,client;
 try{
  assert.equal((await fetch('http://127.0.0.1:47831/snapshot')).status,401);
  assert.equal((await fetch('http://127.0.0.1:47831/snapshot',{headers:{Authorization:`Bearer ${token}`,Origin:'https://evil.example'}})).status,403);
  context=await chromium.launchPersistentContext(path.join(temp,'profile'),{executablePath:chromium.executablePath(),headless:true,args:[`--load-extension=${path.resolve(directory,'../extension')}`],ignoreDefaultArgs:['--disable-extensions']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];const p=await context.newPage();p.setDefaultTimeout(10000);await p.goto(`chrome-extension://${id}/dashboard.html`);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  await p.evaluate(async()=>{await saveData({categories:[{id:'c',name:'テスト分類'}],spaces:[{id:'a',name:'案件A',tabs:[{url:'https://example.com/',title:'資料A'}]},{id:'b',name:'案件B',tabs:[]}],windowActiveSpaces:{}});await renderAll()});
  await p.locator('#openSettings').click();await p.locator('#aiConnectionToken').fill(token);await p.locator('#aiConnect').click();await p.waitForFunction(()=>document.getElementById('aiStatus').textContent.startsWith('接続中'));
  client=new Client({name:'test-codex-compatible-client',version:'1.0'});await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(directory,'mcp.js')],env:{...process.env,TAB_MATOMEN_TOKEN_FILE:tokenFile}}));
  const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),['get_proposal_status','get_space','list_spaces','propose_changes']);
  const call=async(name,args)=>{const r=await client.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));return JSON.parse(r.content[0].text)};
  const list=await call('list_spaces',{});assert.equal(list.spaces.length,2);const detail=await call('get_space',{spaceId:'a'});assert.equal(detail.space.tabs.length,1);
  const proposal=await call('propose_changes',{revision:detail.revision,summary:'案件Aを改名し資料を追加',operations:[{type:'rename_space',spaceId:'a',name:'案件A 整理済み'},{type:'add_tab',spaceId:'a',url:'https://example.org/',title:'追加資料'}]});
  assert.equal((await p.evaluate(()=>loadData())).spaces[0].name,'案件A');const liveBefore=await worker.evaluate(()=>chrome.tabs.query({}).then(ts=>ts.map(t=>t.id)));
  await p.waitForFunction(()=>!document.getElementById('aiReview').disabled);await p.locator('#aiReview').click();await p.locator('#aiProposalDialog input[data-operation-index="1"]').uncheck();await p.locator('#aiApply').click();await p.waitForFunction(()=>document.getElementById('aiProposalDialog').textContent.includes('1件を適用'));
  const after=await p.evaluate(()=>loadData());assert.equal(after.spaces[0].name,'案件A 整理済み');assert.equal(after.spaces[0].tabs.length,1);assert.deepEqual(await worker.evaluate(()=>chrome.tabs.query({}).then(ts=>ts.map(t=>t.id))),liveBefore);
  assert.equal((await call('get_proposal_status',{proposalId:proposal.id})).status,'applied');await p.locator('#aiClose').click();await p.locator('#aiUndo').click();await p.waitForFunction(async()=>(await loadData()).spaces[0].name==='案件A');
  await p.waitForTimeout(3300);const fresh=await call('get_space',{spaceId:'b'});await call('propose_changes',{revision:fresh.revision,summary:'古い案',operations:[{type:'rename_space',spaceId:'b',name:'変更予定'}]});
  await p.evaluate(async()=>{const d=await loadData();d.spaces[1].name='手動変更';await saveData(d)});await p.waitForFunction(()=>!document.getElementById('aiReview').disabled);await p.locator('#aiReview').click();assert.ok(await p.locator('#aiApply').isDisabled());await p.locator('#aiClose').click();
  await p.setViewportSize({width:280,height:700});assert.ok(await p.locator('#settingsDialog').evaluate(el=>el.scrollWidth<=el.clientWidth));await p.screenshot({path:path.resolve(directory,'../evidence/ai-settings-280.png')});
  await p.locator('#aiDisconnect').click();await p.waitForFunction(()=>document.getElementById('aiStatus').textContent.includes('切断'));assert.equal((await fetch('http://127.0.0.1:47831/snapshot',{headers:{Authorization:`Bearer ${token}`}})).status,409);
 }finally{await client?.close();await context?.close();await new Promise(r=>bridge.close(r));fs.rmSync(temp,{recursive:true,force:true})}
});
