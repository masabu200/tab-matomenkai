// ツールバーの小窓（popup.html）を実際の拡張機能で確かめる。
// 保存→取り消し、検索→スペース切り替えの依頼、設定でダッシュボード直行に戻す、ライト／ダークの撮影。
const {chromium} = require('/Users/mugikura/node_modules/playwright'); const UI = require('./ui.cjs');
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
(async () => {
  const server = require('http').createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<title>Local ' + req.url + '</title><p>test</p>'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || require('os').tmpdir(), 'popup-'));
  const context = await chromium.launchPersistentContext(dir, {headless: false, args: [`--load-extension=${path.resolve(__dirname, '../extension')}`], ignoreDefaultArgs: ['--disable-extensions']});
  context.setDefaultTimeout(10000);
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'); const id = worker.url().split('/')[2];
    const dash = await context.newPage(); const errors = []; dash.on('pageerror', e => errors.push('dashboard: ' + e.message));
    await dash.goto(`chrome-extension://${id}/dashboard.html`); await dash.waitForFunction(() => g_dashboardWindowId !== null);
    await dash.evaluate(async base => {
      const data = {spaces: [
        {id: 'alpha', name: 'サテライト船橋 サイネージ', color: 'blue', tabs: [{url: base + '/old', title: 'Old'}], tabGroups: [], updatedAt: new Date(Date.now() - 600000).toISOString()},
        {id: 'beta', name: '亀有香取神社 保守', color: 'pink', tabs: [{url: base + '/beta', title: '例大祭のお知らせ'}], tabGroups: [], lastOpenedAt: new Date(Date.now() - 86400000).toISOString()},
        {id: 'gamma', name: 'ストア申請 1.5.0', color: 'green', tabs: [{url: base + '/g1', title: 'g1'}, {url: base + '/g2', title: 'g2'}], tabGroups: [], lastOpenedAt: new Date(Date.now() - 2 * 86400000).toISOString()},
      ], categories: [], windowActiveSpaces: {}};
      setActiveSpaceId(data, 'alpha'); await saveData(data);
      await chrome.storage.local.set({pwm_settings: {autoSaveOnSwitch: false, backupIntervalHours: 0}});
      for (const t of await getWindowTabs()) if (isClosableTab(t)) await chrome.tabs.remove(t.id);
      for (const p of ['/one', '/two', '/three']) await chrome.tabs.create({windowId: g_dashboardWindowId, url: base + p, active: false});
    }, base);

    // 既定は小窓
    await UI.waitForAsync(worker, async () => (await chrome.action.getPopup({})).endsWith('popup.html'), null, 'popup set');

    // データ変更を受けた Drive 監視が状態を書き終えてから、保存済みの状態を入れる
    await dash.waitForTimeout(800);
    await dash.evaluate(async () => { const cur = (await chrome.storage.local.get('pwm_drive_auto')).pwm_drive_auto || {}; await chrome.storage.local.set({pwm_drive_auto: {...cur, enabled: true, lastSuccessAt: Date.now() - 180000}}); });
    const pop = await context.newPage(); pop.on('pageerror', e => errors.push('popup: ' + e.message));
    await pop.setViewportSize({width: 360, height: 640});
    await pop.goto(`chrome-extension://${id}/popup.html`);
    await pop.waitForFunction(() => document.querySelectorAll('#ppList .pp-item').length === 3);
    assert.match(await pop.locator('#ppSaveWindowLabel').textContent(), /サテライト船橋/);
    assert.match(await pop.locator('#ppSaveWindowCount').textContent(), /3/);
    await pop.waitForFunction(() => /Drive/.test(document.getElementById('ppStatus').textContent), null, {timeout: 3000}).catch(async () => { throw Error('status: ' + await pop.locator('#ppStatus').textContent() + ' / ' + JSON.stringify(await pop.evaluate(async () => (await chrome.storage.local.get('pwm_drive_auto')).pwm_drive_auto))); });
    assert.equal(await pop.evaluate(() => document.activeElement.id), 'ppSearch');
    fs.mkdirSync(path.join(__dirname, '../evidence'), {recursive: true});
    await pop.screenshot({path: path.join(__dirname, '../evidence/popup-light.png'), fullPage: true});

    // このウィンドウのスペースへ保存（取り消しは出さない）
    await pop.evaluate(() => { window.close = () => {}; });
    await pop.locator('#ppSaveWindow').click();
    await pop.waitForFunction(() => !document.getElementById('ppDone').hidden);
    assert.equal(await pop.locator('#ppUndo').isVisible(), false);
    let urls = await dash.evaluate(async () => (await loadData()).spaces.find(s => s.id === 'alpha').tabs.map(t => t.url));
    assert.deepEqual(urls, [base + '/one', base + '/two', base + '/three']);

    // スペースの無いウィンドウでは日付名の新しいスペースを作り、取り消せる
    await dash.evaluate(async () => { const d = await loadData(); delete d.windowActiveSpaces[g_dashboardWindowId]; d.activeSpaceId = null; await saveData(d); });
    await pop.reload(); await pop.evaluate(() => { window.close = () => {}; });
    await pop.waitForFunction(() => document.querySelectorAll('#ppList .pp-item').length === 3);
    await pop.locator('#ppSaveWindow').click();
    await pop.waitForFunction(() => !document.getElementById('ppDone').hidden);
    assert.match(await pop.locator('#ppDoneText').textContent(), /新しいスペース/);
    await pop.screenshot({path: path.join(__dirname, '../evidence/popup-saved.png'), fullPage: true});
    assert.equal(await dash.evaluate(async () => (await loadData()).spaces.length), 4);
    await pop.locator('#ppUndo').click();
    await pop.waitForFunction(() => !document.getElementById('ppMain').hidden);
    assert.equal(await dash.evaluate(async () => { const d = await loadData(); return d.spaces.length + ':' + (d.windowActiveSpaces[g_dashboardWindowId] || ''); }), '3:');
    await dash.evaluate(async () => { const d = await loadData(); setActiveSpaceId(d, 'alpha'); await saveData(d); });
    await pop.reload(); await pop.evaluate(() => { window.close = () => {}; });
    await pop.waitForFunction(() => document.querySelectorAll('#ppList .pp-item').length === 3);

    // 検索：保存したタブとスペースが出て、Enter で開く
    await pop.locator('#ppSearch').fill('例大祭');
    await pop.waitForFunction(() => document.querySelectorAll('#ppList .pp-item').length === 1);
    assert.match(await pop.locator('#ppList').textContent(), /亀有香取神社/);
    await pop.locator('#ppSearch').fill('亀有');
    await pop.waitForFunction(() => document.querySelector('#ppList .pp-item')?.textContent.includes('亀有'));
    await pop.locator('#ppSearch').press('Enter');
    // ダッシュボードが依頼を受けて切り替える（確認ダイアログでは「保存しない」）
    await dash.locator('[data-choice=skip]').click();
    await UI.waitForAsync(dash, async () => getActiveSpaceId(await loadData()) === 'beta' && !g_isSwitching, null, 'switched to beta');
    assert.equal(await dash.evaluate(async () => !!(await chrome.storage.local.get('pwm_popup_request')).pwm_popup_request), false);

    // ダーク
    await dash.evaluate(() => chrome.storage.local.set({pwm_theme: 'dark'}));
    // 切り替えでこのウィンドウのタブ（テストでは小窓のタブも）が閉じられるので、開き直す
    const pop2 = await context.newPage(); pop2.on('pageerror', e => errors.push('popup: ' + e.message)); await pop2.setViewportSize({width: 360, height: 640});
    await pop2.goto(`chrome-extension://${id}/popup.html`); await pop2.waitForFunction(() => document.body.classList.contains('theme-dark') && document.querySelectorAll('#ppList .pp-item').length === 3);
    await pop2.screenshot({path: path.join(__dirname, '../evidence/popup-dark.png'), fullPage: true});
    const overflow = await pop2.evaluate(() => document.documentElement.scrollWidth > 360);
    assert.equal(overflow, false, 'no horizontal overflow');

    // 設定でダッシュボード直行に戻す
    await dash.bringToFront();
    await UI.inSettings(dash, async () => { await dash.locator('#toolbarAction').selectOption('dashboard'); });
    await UI.waitForAsync(worker, async () => (await chrome.action.getPopup({})) === '', null, 'popup cleared');

    assert.deepEqual(errors, []);
    console.log('popup: ok');
  } finally { await context.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
