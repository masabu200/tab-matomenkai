import http from 'node:http';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ensureToken,port} from './config.js';
import '../extension/ai-proposals.js';
export function createBridge(token){
 let snapshot=null,revision=null,seenAt=0,origin=null;const proposals=new Map();
 const server=http.createServer(async(req,res)=>{
  const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  const allowedHost=new Set([`127.0.0.1:${server.address()?.port}`]);
  if(!allowedHost.has(req.headers.host))return reply(403,{error:'Host rejected'});
  const requestOrigin=req.headers.origin;
  if(requestOrigin&&(!/^chrome-extension:\/\/[a-p]{32}$/.test(requestOrigin)||(origin&&origin!==requestOrigin)))return reply(403,{error:'Origin rejected'});
  // No browser CORS grant: only extensions with loopback host permission may connect.
  const auth=req.headers.authorization||'';const expected=`Bearer ${token}`;
  if(Buffer.byteLength(auth)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(auth),Buffer.from(expected)))return reply(401,{error:'接続キーが一致しません'});
  if(requestOrigin)origin=requestOrigin;
  try{
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2_000_000)return reply(413,{error:'Payload too large'})}
   const body=raw?JSON.parse(raw):{};const url=new URL(req.url,'http://127.0.0.1');
   if(req.method==='POST'&&url.pathname==='/sync'){
    if(!Array.isArray(body.snapshot?.spaces)||!Array.isArray(body.snapshot?.categories))throw Error('Invalid snapshot');
    snapshot=TabAgentModel.snapshot(body.snapshot);revision=await TabAgentModel.revision(snapshot);seenAt=Date.now();
    return reply(200,{revision,proposals:[...proposals.values()].filter(p=>p.status==='pending')});
   }
   if(req.method==='POST'&&url.pathname==='/disconnect'){snapshot=null;revision=null;seenAt=0;return reply(200,{ok:true})}
   if(req.method==='POST'&&url.pathname==='/proposal-status'){
    const p=proposals.get(body.id);if(!p)throw Error('Proposal not found');
    if(!['applied','rejected','stale','failed'].includes(body.status))throw Error('Invalid status');
    if(p.status==='pending'){p.status=body.status;p.completedAt=new Date().toISOString()}
    return reply(200,{id:p.id,status:p.status});
   }
   if(req.method==='GET'&&url.pathname.startsWith('/proposals/')){
    const p=proposals.get(url.pathname.split('/')[2]);return p?reply(200,p):reply(404,{error:'Proposal not found'});
   }
   if(!snapshot||Date.now()-seenAt>30000)return reply(409,{error:'拡張の設定でAI連携を接続し、ダッシュボードかサイドパネルを開いてください'});
   if(req.method==='GET'&&url.pathname==='/snapshot')return reply(200,{snapshot,revision,seenAt});
   if(req.method==='POST'&&url.pathname==='/proposals'){
    if(body.revision!==revision)return reply(409,{error:'保存内容が変わりました。get_spaceで再取得してください'});
    if([...proposals.values()].filter(p=>p.status==='pending').length>=20)throw Error('Pending proposal limit');
    TabAgentModel.apply(snapshot,body.operations);
    const p={id:crypto.randomUUID(),revision,status:'pending',createdAt:new Date().toISOString(),summary:String(body.summary||'整理案').slice(0,1000),operations:body.operations};proposals.set(p.id,p);
    if(proposals.size>100){const completed=[...proposals.values()].find(p=>p.status!=='pending');if(completed)proposals.delete(completed.id)}
    return reply(200,{id:p.id,status:p.status});
   }
   return reply(404,{error:'Not found'});
  }catch(error){return reply(400,{error:error.message})}
 });
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const token=ensureToken();createBridge(token).listen(port,'127.0.0.1',()=>console.error(`Tab Matomen bridge listening on 127.0.0.1:${port}`))}
