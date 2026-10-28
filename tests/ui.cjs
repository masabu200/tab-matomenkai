'use strict';
// 設定ダイアログ集約（compact-navigation.js）後のUI操作ヘルパー。
// 「現在のタブを保存」「前の構成に戻す」「タブを1枚追加」「お気に入りを編集」
// 「左バーをサイドパネルで開く」は設定ダイアログ内にあるため、開いてから操作する。
async function isSettingsOpen(page){return page.evaluate(()=>!!document.getElementById('settingsDialog')?.open)}
async function openSettings(page){if(!(await isSettingsOpen(page)))await page.locator('#openSettings').click();await page.waitForFunction(()=>document.getElementById('settingsDialog')?.open)}
async function closeSettings(page){await page.evaluate(()=>{const d=document.getElementById('settingsDialog');if(d?.open)d.close()})}
// 設定内の操作を実行し、元々閉じていた場合は閉じて戻す。
async function inSettings(page,action){const wasOpen=await isSettingsOpen(page);await openSettings(page);try{return await action()}finally{if(!wasOpen)await closeSettings(page)}}
// Playwright 1.62 の page.waitForFunction は async 関数を渡すと最初の評価結果（Promise）が解決した時点で
// 真偽にかかわらず終了する（tests で実測）。非同期条件は必ずこちらでポーリングする。
async function waitForAsync(page,fn,arg,label,timeoutMs=10000){const end=Date.now()+timeoutMs;let last;while(Date.now()<end){last=await page.evaluate(fn,arg);if(last)return last;await page.waitForTimeout(50)}throw Error('Timeout: '+(label||String(fn).slice(0,100)))}
module.exports={isSettingsOpen,openSettings,closeSettings,inSettings,waitForAsync};
