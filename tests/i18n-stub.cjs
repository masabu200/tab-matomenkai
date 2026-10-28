// Japanese message lookup for unit tests that run extension scripts inside vm contexts.
const fs=require('node:fs');
const messages=JSON.parse(fs.readFileSync('extension/_locales/ja/messages.json','utf8'));
const t=(key,subs)=>{const m=messages[key];if(!m)return key;return m.message.replace(/\$(\$|\d)/g,(x,n)=>n==='$'?'$':String(subs?.[Number(n)-1]??''))};
module.exports={t,I18n:{t,ready:async()=>'ja',apply(){},current:()=>'ja'},importScripts:()=>{}};
