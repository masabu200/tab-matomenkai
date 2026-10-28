const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
(async()=>{
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'pwm-i18n-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});
 context.setDefaultTimeout(10000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`chrome-extension://${id}/dashboard.html`);await page.waitForFunction(()=>g_dashboardWindowId!==null);
  // default: browser UI language (ja on this machine), html lang and manifest name localized
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'ja');
  assert.match(await page.locator('#btnCreateSpace').innerText(),/スペース/);
  assert.equal(await page.title(),'タブまとめん改');
  assert.equal(await page.evaluate(()=>chrome.i18n.getMessage('appName')),'タブまとめん改');
  // switch to English from settings -> page reloads in English, including JS-built UI and attributes
  await page.locator('#openSettings').click();
  const options=await page.locator('#languageSelect option').allTextContents();
  assert.ok(options[0].includes('日本語'),'auto option names the browser language');
  assert.ok(options.includes('English')&&options.includes('简体中文')&&options.includes('Español'),'all languages listed');
  await Promise.all([page.waitForNavigation(),page.locator('#languageSelect').selectOption('en')]);
  await page.waitForFunction(()=>g_dashboardWindowId!==null);
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
  assert.equal(await page.title(),'Tab Matomen Kai');
  assert.match(await page.locator('#btnCreateSpace').innerText(),/Space/);
  assert.equal(await page.locator('#openSettings .settings-label').innerText(),'Settings');
  assert.equal(await page.locator('#btnExport').getAttribute('title'),'Export all data to a JSON file');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pwm_i18n_locale')),'en');
  // dynamic messages use the override, with substitutions
  assert.equal(await page.evaluate(()=>t('m_f272b678d1',[3])),'Saved 3 tabs.');
  // a second page in the same profile paints English on first load (no flash of Japanese)
  const other=await context.newPage();await other.goto(`chrome-extension://${id}/dashboard.html`);
  assert.equal(await other.evaluate(()=>document.documentElement.lang),'en');
  assert.equal(await other.evaluate(()=>I18n.current()),'en');await other.close();
  // the service worker follows the setting too
  assert.equal(await worker.evaluate(()=>I18n.ready()),'en');
  assert.equal(await worker.evaluate(()=>t('m_4091966e8a')),'Save to Tab Matomen Kai');
  // other locale: Simplified Chinese
  await page.locator('#openSettings').click();
  await Promise.all([page.waitForNavigation(),page.locator('#languageSelect').selectOption('zh_CN')]);
  await page.waitForFunction(()=>g_dashboardWindowId!==null);
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'zh-CN');
  assert.match(await page.locator('#btnCreateSpace').innerText(),/空间/);
  // back to auto -> Japanese again, override cleared
  await page.locator('#openSettings').click();
  await Promise.all([page.waitForNavigation(),page.locator('#languageSelect').selectOption('auto')]);
  await page.waitForFunction(()=>g_dashboardWindowId!==null);
  assert.equal(await page.evaluate(()=>document.documentElement.lang),'ja');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pwm_i18n_locale')),null);
  assert.equal(await worker.evaluate(()=>I18n.ready()),'ja');
  // stale catalog (e.g. strings added after Chrome loaded the extension): page reloads once and shows them
  await page.evaluate(()=>{localStorage.setItem('pwm_i18n_effective','ja');localStorage.setItem('pwm_i18n_messages','{}');localStorage.setItem('pwm_i18n_signature','stale');sessionStorage.removeItem('pwm_i18n_reloaded');});
  await page.reload();await page.waitForFunction(()=>typeof g_dashboardWindowId!=='undefined'&&g_dashboardWindowId!==null);
  await page.waitForFunction(()=>localStorage.getItem('pwm_i18n_signature')!=='stale');
  await page.waitForFunction(()=>typeof g_dashboardWindowId!=='undefined'&&g_dashboardWindowId!==null);
  await page.locator('#openSettings').click();
  assert.match(await page.locator('.auto-clean-settings h3').innerText(),/使っていないスペース/);
  assert.doesNotMatch(await page.locator('#settingsDialog').innerText(),/\bautoClean[A-Z]|\bm_[0-9a-f]{10}\b/);
  await page.locator('#closeSettings').click();
  assert.deepEqual(errors,[]);
  console.log('PASS i18n: default ja; settings switch to en reloads with localized title/buttons/attributes/dynamic messages; second page and service worker follow; zh_CN; back to auto clears override; no page errors');
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
