'use strict';
// ツールバーのアイコンから開く小窓。
//  - このウィンドウのタブを保存（このウィンドウのスペース、無ければ日付名の新しいスペースへ）
//  - 今のタブだけ保存／ダッシュボードを開く
//  - 続きから（最近使ったスペース）と、スペース・保存したタブの検索
//  - Drive 自動保存と自動整理の状況
// スペースの切り替えはタブを閉じる処理と確認ダイアログを伴うので、ここでは行わず
// ダッシュボードに依頼する（pwm_popup_request）。

// ---- 保存データを扱う純粋な関数（tests/popup.test.cjs から使う） ----
globalThis.PopupModel = (() => {
  const EXCLUDED = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'javascript:', 'data:', 'file://'];
  const GROUP_HEX = {grey: '#5f6368', blue: '#1a73e8', red: '#d93025', yellow: '#f9ab00', green: '#1e8e3e', pink: '#e52592', purple: '#a142f4', cyan: '#129eaf', orange: '#e8710a'};
  const stamp = v => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : 0; };
  const usedAt = s => Math.max(stamp(s.lastOpenedAt), stamp(s.tabsSavedAt), stamp(s.updatedAt), stamp(s.createdAt));
  const colorOf = c => GROUP_HEX[c] || (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : '');
  const urlOf = tab => tab.pendingUrl || tab.url || '';
  function isSavableUrl(url) { return !!url && typeof url === 'string' && !EXCLUDED.some(p => url.startsWith(p)); }
  // ダッシュボードの isSavableTab と同じ条件（ピン留めとダッシュボード自身は保存しない）
  function isSavableTab(tab) { return !!tab && !tab.pinned && isSavableUrl(urlOf(tab)); }

  const liveSpaces = data => (data?.spaces || []).filter(s => s && !s.archived && typeof s.name === 'string');
  function activeSpaceId(data, windowId) {
    const id = data?.windowActiveSpaces?.[windowId];
    return id && liveSpaces(data).some(s => s.id === id) ? id : null;
  }
  // 「続きから」：このウィンドウのスペースを先頭に、あとは最後に使った順
  function recent(data, windowId, limit = 4) {
    const current = activeSpaceId(data, windowId);
    return liveSpaces(data).slice().sort((a, b) => (b.id === current) - (a.id === current) || usedAt(b) - usedAt(a)).slice(0, limit);
  }
  function search(data, query, limit = 8) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const out = [];
    const spaces = liveSpaces(data).slice().sort((a, b) => usedAt(b) - usedAt(a));
    for (const s of spaces) if (s.name.toLowerCase().includes(q)) out.push({kind: 'space', space: s});
    for (const s of spaces) {
      for (const tab of s.tabs || []) {
        if (out.length >= limit * 3) break;
        if (`${tab.title || ''} ${tab.url || ''}`.toLowerCase().includes(q)) out.push({kind: 'tab', space: s, tab});
      }
    }
    return out.slice(0, limit);
  }
  function uniqueName(data, base) {
    const names = new Set((data?.spaces || []).map(s => s.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(`${base} (${i})`)) return `${base} (${i})`;
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

  // ウィンドウのタブをスペースに保存する（ダッシュボードの saveCurrentTabsToSpace と同じ規則）。
  // data を書き換え、取り消し用の控えを返す。
  function saveWindow(data, {windowId, tabs, chromeGroups = [], newSpaceName, now = new Date()}) {
    const savable = (tabs || []).filter(isSavableTab);
    if (!savable.length) return {count: 0};
    if (!Array.isArray(data.spaces)) data.spaces = [];
    if (!data.windowActiveSpaces || typeof data.windowActiveSpaces !== 'object') data.windowActiveSpaces = {};
    const iso = now.toISOString();
    let space = data.spaces.find(s => s.id === activeSpaceId(data, windowId));
    let created = false;
    const undo = {windowId, prevActive: data.windowActiveSpaces[windowId] ?? null, prevGlobalActive: data.activeSpaceId ?? null};
    if (!space) {
      space = {id: newId(), name: uniqueName(data, newSpaceName), createdAt: iso, updatedAt: iso, tabs: [], categoryId: null, archived: false, color: '', tabGroups: [], archivedTabs: []};
      data.spaces.push(space);
      data.windowActiveSpaces[windowId] = space.id;
      data.activeSpaceId = space.id;
      created = true;
    } else {
      undo.prev = structuredClone({tabs: space.tabs || [], tabGroups: space.tabGroups || [], updatedAt: space.updatedAt, tabsSavedAt: space.tabsSavedAt});
    }
    if (!Array.isArray(space.tabGroups)) space.tabGroups = [];
    // Chrome のタブグループは名前で既存グループと照合して使い回す
    const byChromeId = {};
    const byName = {};
    for (const g of space.tabGroups) if (g.name) byName[g.name] = g;
    for (const cg of chromeGroups) {
      const color = GROUP_HEX[cg.color] || '#7a8098';
      const existing = cg.title ? byName[cg.title] : null;
      if (existing) { existing.color = color || existing.color; byChromeId[cg.id] = existing.id; continue; }
      const group = {id: newId(), name: cg.title || '', color, collapsed: false, chromeGroupId: null};
      space.tabGroups.push(group); byChromeId[cg.id] = group.id;
    }
    const valid = new Set(space.tabGroups.map(g => g.id));
    const keepByUrl = new Map();
    for (const tab of space.tabs || []) {
      if (tab.url && tab.groupId && valid.has(tab.groupId)) { if (!keepByUrl.has(tab.url)) keepByUrl.set(tab.url, []); keepByUrl.get(tab.url).push(tab.groupId); }
    }
    space.tabs = savable.map(tab => {
      const url = urlOf(tab);
      const fromChrome = tab.groupId != null && tab.groupId !== -1 ? byChromeId[tab.groupId] : null;
      const kept = keepByUrl.get(url);
      return {title: tab.title || url, url, favIconUrl: tab.favIconUrl || '', pinned: false, groupId: fromChrome || (kept && kept.length ? kept.shift() : null)};
    });
    space.updatedAt = iso;
    space.tabsSavedAt = iso;
    return {count: space.tabs.length, spaceId: space.id, name: space.name, created, undo};
  }
  function undoSave(data, result) {
    const space = (data.spaces || []).find(s => s.id === result.spaceId);
    if (!space) return false;
    const {undo} = result;
    if (result.created) {
      data.spaces = data.spaces.filter(s => s.id !== result.spaceId);
      if (data.windowActiveSpaces?.[undo.windowId] === result.spaceId) {
        if (undo.prevActive) data.windowActiveSpaces[undo.windowId] = undo.prevActive; else delete data.windowActiveSpaces[undo.windowId];
      }
      if (data.activeSpaceId === result.spaceId) data.activeSpaceId = undo.prevGlobalActive;
      return true;
    }
    Object.assign(space, structuredClone(undo.prev));
    if (undo.prev.tabsSavedAt === undefined) delete space.tabsSavedAt;
    return true;
  }
  return {isSavableTab, isSavableUrl, activeSpaceId, recent, search, saveWindow, undoSave, uniqueName, usedAt, colorOf};
})();

// ---- 画面 ----
(() => {
  if (typeof document === 'undefined' || !document.getElementById('ppMain')) return;
  const M = PopupModel;
  const DATA_KEY = 'pwm_data';
  const $ = id => document.getElementById(id);
  const state = {data: {spaces: []}, windowId: null, tabs: [], items: [], sel: 0, closeTimer: null};
  const locale = () => { try { return I18n.current().replace('_', '-'); } catch { return 'en'; } };

  function ago(ms) {
    if (!ms) return '';
    const diff = (ms - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale(), {numeric: 'auto', style: 'short'});
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of units) if (Math.abs(diff) >= size) return rtf.format(Math.round(diff / size), unit);
    return rtf.format(0, 'minute');
  }
  function notice(text) { $('ppNotice').textContent = text || ''; }
  const load = async () => ((await chrome.storage.local.get(DATA_KEY))[DATA_KEY]) || {spaces: [], categories: []};
  const withLock = fn => navigator.locks.request('pwm-space-switch', fn);
  const send = message => chrome.runtime.sendMessage(message);

  async function openDashboard() {
    try { await send({type: 'OPEN_DASHBOARD', windowId: state.windowId}); } catch (e) { console.warn('[PWM] open dashboard', e); }
    window.close();
  }
  async function openSpace(space) {
    if (M.activeSpaceId(state.data, state.windowId) !== space.id) {
      await chrome.storage.local.set({pwm_popup_request: {type: 'switch', spaceId: space.id, windowId: state.windowId, at: Date.now()}});
    }
    await openDashboard();
  }
  async function openTab(tab) {
    if (!/^https?:\/\//.test(tab.url || '')) { notice(t('popupCannotOpen')); return; }
    await chrome.tabs.create({url: tab.url, windowId: state.windowId});
    window.close();
  }

  function favicon(url) {
    const img = document.createElement('img');
    img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    if (/^https?:|^data:image\//.test(url || '')) img.src = url; else img.hidden = true;
    img.addEventListener('error', () => { img.hidden = true; });
    return img;
  }
  function spaceItem(space) {
    const row = document.createElement('div');
    row.className = 'pp-item'; row.setAttribute('role', 'option');
    const dot = document.createElement('span'); dot.className = 'pp-dot';
    const color = M.colorOf(space.color); if (color) dot.style.background = color;
    const text = document.createElement('span'); text.className = 'pp-item__text';
    const name = document.createElement('span'); name.className = 'pp-item__name'; name.textContent = space.name; name.title = space.name;
    text.append(name);
    row.append(dot, text);
    if (M.activeSpaceId(state.data, state.windowId) === space.id) {
      const cur = document.createElement('span'); cur.className = 'pp-item__current'; cur.textContent = t('popupCurrentSpace'); row.append(cur);
    } else {
      const favs = document.createElement('span'); favs.className = 'pp-favs'; favs.setAttribute('aria-hidden', 'true');
      for (const tab of (space.tabs || []).filter(x => x.favIconUrl).slice(0, 3)) favs.append(favicon(tab.favIconUrl));
      row.append(favs);
    }
    const meta = document.createElement('span'); meta.className = 'pp-item__meta';
    const count = (space.tabs || []).length;
    // このウィンドウのスペースは名前を優先して見せるため、時刻は省いて枚数だけ
    meta.textContent = M.activeSpaceId(state.data, state.windowId) === space.id ? t('popupTabCount', [count]) : t('popupSpaceMeta', [count, ago(M.usedAt(space))]);
    row.append(meta);
    row.setAttribute('aria-label', `${space.name} ${meta.textContent}`);
    return {row, run: () => openSpace(space)};
  }
  function tabItem(tab, space) {
    const row = document.createElement('div');
    row.className = 'pp-item'; row.setAttribute('role', 'option');
    const icon = favicon(tab.favIconUrl); icon.className = 'pp-fav';
    const text = document.createElement('span'); text.className = 'pp-item__text';
    const name = document.createElement('span'); name.className = 'pp-item__name'; name.textContent = tab.title || tab.url; name.title = tab.url || '';
    const sub = document.createElement('span'); sub.className = 'pp-item__sub'; sub.textContent = t('popupTabInSpace', [space.name]);
    text.append(name, sub); row.append(icon, text);
    return {row, run: () => openTab(tab)};
  }

  function renderList() {
    const list = $('ppList'); list.replaceChildren();
    const query = $('ppSearch').value;
    let entries;
    if (query.trim()) {
      $('ppListTitle').textContent = t('popupSearchTitle');
      entries = M.search(state.data, query).map(r => r.kind === 'space' ? spaceItem(r.space) : tabItem(r.tab, r.space));
    } else {
      $('ppListTitle').textContent = t('popupRecentTitle');
      entries = M.recent(state.data, state.windowId).map(spaceItem);
    }
    state.items = entries; state.sel = 0;
    if (!entries.length) {
      const empty = document.createElement('div'); empty.className = 'pp-empty';
      empty.textContent = query.trim() ? t('popupNoResults') : t('popupNoSpaces');
      list.append(empty); return;
    }
    entries.forEach((entry, i) => {
      entry.row.id = 'ppItem' + i;
      entry.row.addEventListener('click', entry.run);
      entry.row.addEventListener('mousemove', () => select(i));
      list.append(entry.row);
    });
    select(0);
  }
  function select(i) {
    if (!state.items.length) return;
    state.sel = (i + state.items.length) % state.items.length;
    state.items.forEach((entry, j) => entry.row.setAttribute('aria-selected', String(j === state.sel)));
    $('ppSearch').setAttribute('aria-activedescendant', state.items[state.sel].row.id);
    state.items[state.sel].row.scrollIntoView({block: 'nearest'});
  }

  function renderSaveButton() {
    const count = state.tabs.filter(M.isSavableTab).length;
    const current = state.data.spaces?.find(s => s.id === M.activeSpaceId(state.data, state.windowId));
    $('ppSaveWindowLabel').textContent = current ? t('popupSaveWindowTo', [current.name]) : t('popupSaveWindow');
    $('ppSaveWindowCount').textContent = t('popupTabCount', [count]);
    $('ppSaveWindow').disabled = count === 0;
    const active = state.tabs.find(x => x.active);
    $('ppSaveTab').disabled = !(active && /^https?:\/\//.test(active.pendingUrl || active.url || '') && M.recent(state.data, state.windowId, 1).length);
  }

  async function renderStatus() {
    const box = $('ppStatus'); box.replaceChildren();
    const chip = (text, kind) => { const el = document.createElement('span'); el.className = 'pp-chip' + (kind ? ' pp-chip--' + kind : ''); el.textContent = text; box.append(el); };
    try {
      const stored = await chrome.storage.local.get(['pwm_drive_auto', 'pwm_settings']);
      const drive = stored.pwm_drive_auto || {};
      if (drive.enabled) {
        if (drive.needsReconnect || (drive.failures > 0 && drive.lastError)) chip(t('popupDriveProblem'), 'warn');
        else if (drive.lastSuccessAt) chip(t('popupDriveSaved', [ago(drive.lastSuccessAt)]), 'ok');
        else chip(t('popupDriveWaiting'));
      }
      if (typeof AutoClean !== 'undefined') {
        const plan = AutoClean.plan(state.data, stored.pwm_settings || {});
        if (plan.ids.length) chip(t(plan.action === 'delete' ? 'popupAutoCleanDelete' : 'popupAutoCleanArchive', [plan.ids.length]));
      }
    } catch (e) { console.warn('[PWM] popup status', e); }
  }

  async function refresh() {
    state.data = await load();
    try { state.tabs = await chrome.tabs.query({windowId: state.windowId}); } catch { state.tabs = []; }
    renderSaveButton(); renderList(); await renderStatus();
  }

  function newSpaceName() {
    const date = new Intl.DateTimeFormat(locale(), {month: 'short', day: 'numeric'}).format(new Date());
    return t('popupNewSpaceName', [date]);
  }
  async function chromeGroups() {
    try { return chrome.tabGroups ? await chrome.tabGroups.query({windowId: state.windowId}) : []; } catch { return []; }
  }

  async function saveWindow() {
    $('ppSaveWindow').disabled = true;
    try {
      const groups = await chromeGroups();
      const tabs = await chrome.tabs.query({windowId: state.windowId});
      const result = await withLock(async () => {
        const data = await load();
        const r = M.saveWindow(data, {windowId: state.windowId, tabs, chromeGroups: groups, newSpaceName: newSpaceName()});
        if (r.count) await chrome.storage.local.set({[DATA_KEY]: data});
        return r;
      });
      if (!result.count) { notice(t('popupNothingToSave')); renderSaveButton(); return; }
      showDone(result);
    } catch (e) {
      console.error('[PWM] popup save window', e); notice(t('popupSaveFailed')); renderSaveButton();
    }
  }
  function showDone(result) {
    $('ppMain').hidden = true; $('ppDone').hidden = false;
    $('ppDoneCount').textContent = t('popupTabCount', [result.count]);
    $('ppDoneText').textContent = result.created ? t('popupSavedNew', [result.name]) : t('popupSavedTo', [result.name]);
    $('ppToastText').textContent = t('popupSaved');
    // 既存のスペースへの保存は、ダッシュボードが開いているとタブを動かすたびに同じ内容で保存し直されるため
    // 取り消しは出さない（ダッシュボードの「現在のタブを保存」と同じ扱い）。新しく作ったスペースだけ取り消せる。
    $('ppUndo').hidden = !result.created;
    const bar = $('ppBar'); bar.classList.remove('pp-bar--run'); void bar.offsetWidth; bar.classList.add('pp-bar--run');
    $('ppUndo').onclick = async () => {
      clearTimeout(state.closeTimer);
      try {
        const ok = await withLock(async () => {
          const data = await load();
          if (!M.undoSave(data, result)) return false;
          await chrome.storage.local.set({[DATA_KEY]: data});
          return true;
        });
        $('ppDone').hidden = true; $('ppMain').hidden = false;
        notice(ok ? t('popupUndone') : t('popupUndoFailed'));
        await refresh();
      } catch (e) { console.error('[PWM] popup undo', e); notice(t('popupUndoFailed')); }
    };
    if (result.created) $('ppUndo').focus();
    state.closeTimer = setTimeout(() => window.close(), 2500);
  }

  async function saveTab() {
    const active = state.tabs.find(x => x.active);
    const target = M.recent(state.data, state.windowId, 1)[0];
    if (!active || !target) return;
    try {
      const r = await send({type: 'POPUP_SAVE_TAB', spaceId: target.id, tab: {url: active.pendingUrl || active.url, title: active.title, favIconUrl: active.favIconUrl}});
      if (r?.ok) notice(t('popupTabSaved', [r.name, r.count]));
      else if (r?.reason === 'duplicate') notice(t('popupTabDuplicate', [r.name]));
      else notice(t('popupSaveFailed'));
      await refresh();
    } catch (e) { console.error('[PWM] popup save tab', e); notice(t('popupSaveFailed')); }
  }

  async function init() {
    try { await I18n.ready(); } catch {}
    I18n.apply(document);
    try {
      const theme = (await chrome.storage.local.get('pwm_theme')).pwm_theme;
      document.body.classList.toggle('theme-dark', theme === 'dark');
    } catch {}
    try { state.windowId = (await chrome.windows.getCurrent()).id; } catch { state.windowId = null; }
    $('ppSaveWindow').addEventListener('click', saveWindow);
    $('ppSaveTab').addEventListener('click', saveTab);
    $('ppOpenDashboard').addEventListener('click', openDashboard);
    $('ppSeeAll').addEventListener('click', openDashboard);
    $('ppSettings').addEventListener('click', async () => {
      await chrome.storage.local.set({pwm_popup_request: {type: 'settings', windowId: state.windowId, at: Date.now()}});
      await openDashboard();
    });
    const input = $('ppSearch');
    input.addEventListener('input', renderList);
    input.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'ArrowDown') { event.preventDefault(); select(state.sel + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); select(state.sel - 1); }
      else if (event.key === 'Enter') { event.preventDefault(); state.items[state.sel]?.run(); }
    });
    await refresh();
    input.focus();
  }
  init();
})();
