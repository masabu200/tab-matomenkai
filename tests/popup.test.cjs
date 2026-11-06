// PopupModel (extension/popup.js): saving a window, undo, recent list and search.
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const ctx = {structuredClone, console, Date, Math};
vm.runInNewContext(fs.readFileSync('extension/popup.js', 'utf8'), ctx);
const raw = ctx.PopupModel;
// vm の配列は別レルムなので、比較用にこちらの配列へ写す
const M = {...raw, recent: (...a) => [...raw.recent(...a)], search: (...a) => [...raw.search(...a)]};
const tab = (url, extra = {}) => ({url, title: url, favIconUrl: '', pinned: false, groupId: -1, ...extra});
const base = () => ({
  windowActiveSpaces: {7: 'a'}, activeSpaceId: 'a', categories: [],
  spaces: [
    {id: 'a', name: 'Alpha', tabs: [{url: 'https://old.example/', title: 'Old', groupId: 'g1'}], tabGroups: [{id: 'g1', name: 'Work', color: '#1a73e8'}], updatedAt: '2026-11-01T00:00:00Z', tabsSavedAt: '2026-11-01T00:00:00Z'},
    {id: 'b', name: 'Beta', tabs: [{url: 'https://docs.example/guide', title: 'Guide'}], lastOpenedAt: '2026-11-04T00:00:00Z'},
    {id: 'c', name: 'Gamma', archived: true, tabs: [{url: 'https://docs.example/old', title: 'Guide old'}]},
  ],
});

test('saves savable tabs of the window into its active space and can undo it', () => {
  const data = base();
  const tabs = [tab('https://a.example/'), tab('chrome://extensions/'), tab('https://pinned.example/', {pinned: true}), tab('', {pendingUrl: 'https://loading.example/'}), tab('chrome-extension://x/dashboard.html')];
  const r = M.saveWindow(data, {windowId: 7, tabs, newSpaceName: 'New'});
  assert.equal(r.count, 2); assert.equal(r.created, false); assert.equal(r.spaceId, 'a');
  assert.deepEqual(data.spaces[0].tabs.map(t => t.url), ['https://a.example/', 'https://loading.example/']);
  assert.ok(M.undoSave(data, r));
  assert.deepEqual(data.spaces[0].tabs.map(t => t.url), ['https://old.example/']);
  assert.equal(data.spaces[0].tabsSavedAt, '2026-11-01T00:00:00Z');
});

test('creates a uniquely named space when the window has none, and undo removes it', () => {
  const data = base(); data.spaces.push({id: 'd', name: 'Nov 5', tabs: []});
  const r = M.saveWindow(data, {windowId: 9, tabs: [tab('https://x.example/')], newSpaceName: 'Nov 5'});
  assert.equal(r.created, true); assert.equal(r.name, 'Nov 5 (2)');
  assert.equal(data.windowActiveSpaces[9], r.spaceId); assert.equal(data.windowActiveSpaces[7], 'a');
  assert.ok(M.undoSave(data, r));
  assert.equal(data.spaces.some(s => s.id === r.spaceId), false);
  assert.equal(9 in data.windowActiveSpaces, false); assert.equal(data.activeSpaceId, 'a');
});

test('keeps dashboard groups by URL and maps Chrome groups by name', () => {
  const data = base();
  const r = M.saveWindow(data, {windowId: 7, tabs: [tab('https://old.example/'), tab('https://n.example/', {groupId: 55})], chromeGroups: [{id: 55, title: 'Work', color: 'red'}]});
  assert.equal(r.count, 2);
  const s = data.spaces[0];
  assert.equal(s.tabGroups.length, 1);
  assert.deepEqual(s.tabs.map(t => t.groupId), ['g1', 'g1']);
});

test('nothing savable leaves the data untouched', () => {
  const data = base(); const before = JSON.stringify(data);
  assert.equal(M.saveWindow(data, {windowId: 7, tabs: [tab('chrome://newtab/')]}).count, 0);
  assert.equal(JSON.stringify(data), before);
});

test('recent puts this window’s space first and skips archived spaces; search finds spaces and tabs', () => {
  const data = base();
  assert.deepEqual(M.recent(data, 7).map(s => s.id), ['a', 'b']);
  assert.deepEqual(M.recent(data, 1).map(s => s.id), ['b', 'a']);
  const found = M.search(data, 'guide');
  assert.deepEqual(found.map(r => r.kind + ':' + (r.tab ? r.tab.url : r.space.id)), ['tab:https://docs.example/guide']);
  assert.deepEqual(M.search(data, 'alp').map(r => r.space.id), ['a']);
  assert.deepEqual(M.search(data, '  ').length, 0);
});
