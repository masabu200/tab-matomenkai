'use strict';
// Space-level sharing: export selected spaces as a file or a share code, and add received
// spaces to the current data without overwriting anything.
// Package format: {format:'tab-matomen-kai/spaces', version:1, exportedAt, spaces:[{name,color,
//   categoryPath:[...names], tabs:[{title,url,groupId}], tabGroups:[{id,name,color,collapsed}]}]}
// Share code: 'TMK1.' + base64url(gzip(JSON)).
globalThis.SpaceShare = (() => {
  const FORMAT = 'tab-matomen-kai/spaces';
  const CODE_PREFIX = 'TMK1.';
  const MAX_SPACES = 200, MAX_TABS = 5000;

  // ---------- pure helpers ----------
  function categoryPath(categories, id) {
    const byId = new Map((categories || []).map(c => [c.id, c]));
    const path = []; const seen = new Set(); let cur = byId.get(id);
    while (cur && !seen.has(cur.id)) { path.unshift(cur.name); seen.add(cur.id); cur = byId.get(cur.parentId); }
    return path;
  }
  function stripUrl(url) {
    try { const u = new URL(url); u.search = ''; u.hash = ''; return u.href; } catch { return url; }
  }
  function pack(data, spaceIds, options = {}) {
    const wanted = new Set(spaceIds);
    const spaces = (data.spaces || []).filter(s => wanted.has(s.id)).map(s => ({
      name: s.name, color: s.color || '',
      categoryPath: categoryPath(data.categories, s.categoryId),
      tabGroups: (s.tabGroups || []).map(g => ({id: g.id, name: g.name || '', color: g.color || '', collapsed: !!g.collapsed})),
      tabs: (s.tabs || []).map(tab => ({title: tab.title || tab.url, url: options.stripQuery ? stripUrl(tab.url) : tab.url, groupId: tab.groupId || null})),
    }));
    return {format: FORMAT, version: 1, exportedAt: new Date().toISOString(), spaces};
  }
  function validatePackage(pkg) {
    const fail = () => { throw Error(t('shareInvalid')); };
    if (!pkg || typeof pkg !== 'object' || pkg.format !== FORMAT || pkg.version !== 1 || !Array.isArray(pkg.spaces)) fail();
    if (!pkg.spaces.length || pkg.spaces.length > MAX_SPACES) fail();
    let tabs = 0;
    const shaped = pkg.spaces.map((s, i) => {
      if (!s || typeof s !== 'object') fail();
      if (s.categoryPath !== undefined && (!Array.isArray(s.categoryPath) || s.categoryPath.some(n => typeof n !== 'string' || !n.trim()))) fail();
      tabs += Array.isArray(s.tabs) ? s.tabs.length : 0;
      return {id: 'pkg' + i, name: s.name, tabs: s.tabs, tabGroups: s.tabGroups};
    });
    if (tabs > MAX_TABS) fail();
    try { validateBackup({spaces: shaped}); } catch { fail(); }
    for (const s of pkg.spaces) for (const tab of s.tabs) if (!/^https?:$/.test(new URL(tab.url).protocol)) fail();
    return pkg;
  }
  function uniqueName(name, taken) {
    const base = name.trim() || t('shareUntitled');
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) { const candidate = `${base} (${n})`; if (!taken.has(candidate)) return candidate; }
  }
  // Adds the package's spaces to data (mutates). Returns the new spaces.
  function merge(data, pkg, makeId) {
    data.spaces = data.spaces || []; data.categories = data.categories || [];
    const taken = new Set(data.spaces.map(s => s.name));
    const now = new Date().toISOString();
    const ensureCategory = path => {
      let parentId = null;
      for (const name of path || []) {
        let cat = data.categories.find(c => c.name === name && (c.parentId || null) === parentId);
        if (!cat) { cat = {id: makeId(), name, color: '', parentId}; data.categories.push(cat); }
        parentId = cat.id;
      }
      return parentId;
    };
    const added = [];
    for (const s of pkg.spaces) {
      const groupIds = new Map((s.tabGroups || []).map(g => [g.id, makeId()]));
      const space = {
        id: makeId(), name: uniqueName(s.name, taken), color: typeof s.color === 'string' ? s.color : '',
        categoryId: ensureCategory(s.categoryPath), archived: false, createdAt: now, updatedAt: now,
        tabGroups: (s.tabGroups || []).map(g => ({id: groupIds.get(g.id), name: g.name || '', color: g.color || '', collapsed: !!g.collapsed})),
        tabs: s.tabs.map(tab => ({title: typeof tab.title === 'string' && tab.title ? tab.title : tab.url, url: tab.url, favIconUrl: '', pinned: false, groupId: groupIds.get(tab.groupId) || null})),
      };
      taken.add(space.name); data.spaces.push(space); added.push(space);
    }
    return added;
  }
  // ---------- share code ----------
  const toB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const fromB64 = text => { const s = atob(text.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  async function toCode(pkg) { return CODE_PREFIX + toB64(await pipe(new TextEncoder().encode(JSON.stringify(pkg)), new CompressionStream('gzip'))); }
  async function parseInput(text) {
    const value = String(text || '').trim();
    if (!value) throw Error(t('shareInvalid'));
    let pkg;
    try {
      if (value.startsWith(CODE_PREFIX)) pkg = JSON.parse(new TextDecoder().decode(await pipe(fromB64(value.slice(CODE_PREFIX.length).replace(/\s+/g, '')), new DecompressionStream('gzip'))));
      else pkg = JSON.parse(value.replace(/^﻿/, ''));
    } catch { throw Error(t('shareInvalid')); }
    return validatePackage(pkg);
  }

  // ---------- UI ----------
  function dialogShell(titleText) {
    const dialog = document.createElement('dialog'); dialog.className = 'workspace-dialog share-dialog';
    const title = document.createElement('h2'); title.textContent = titleText; title.id = 'shareDialogTitle'; dialog.setAttribute('aria-labelledby', title.id);
    const status = document.createElement('p'); status.className = 'share-status'; status.setAttribute('role', 'status');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn--ghost'; close.textContent = t('m_3da5c18551');
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.append(title);
    document.body.append(dialog);
    return {dialog, status, close};
  }
  const button = (label, cls = 'btn btn--ghost') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; return b; };

  async function openExport() {
    const data = await loadData();
    const activeId = getActiveSpaceId(data);
    const spaces = data.spaces.filter(s => !s.archived);
    if (!spaces.length) { showMessage(t('m_e17d188654'), 'error'); return; }
    const {dialog, status, close} = dialogShell(t('shareExportTitle'));
    dialog.id = 'shareExportDialog';
    const help = document.createElement('p'); help.className = 'share-help'; help.textContent = t('shareExportHelp');
    const list = document.createElement('div'); list.className = 'share-list';
    for (const s of spaces) {
      const label = document.createElement('label'); label.className = 'share-item';
      const box = document.createElement('input'); box.type = 'checkbox'; box.value = s.id; box.checked = s.id === activeId;
      const name = document.createElement('span'); name.textContent = t('m_b8901ba999', [s.name, (s.tabs || []).length]);
      label.append(box, name); list.append(label);
    }
    if (!list.querySelector('input:checked')) list.querySelector('input').checked = true;
    const stripLabel = document.createElement('label'); stripLabel.className = 'share-option';
    const strip = document.createElement('input'); strip.type = 'checkbox'; strip.id = 'shareStripQuery';
    const stripText = document.createElement('span'); stripText.textContent = t('shareStripQuery');
    stripLabel.append(strip, stripText);
    const warn = document.createElement('p'); warn.className = 'share-warning'; warn.textContent = t('shareWarning');
    const actions = document.createElement('div'); actions.className = 'share-actions';
    const fileBtn = button(t('shareToFile'), 'btn btn--primary'); fileBtn.id = 'shareToFile';
    const codeBtn = button(t('shareCopyCode')); codeBtn.id = 'shareCopyCode';
    actions.append(fileBtn, codeBtn, close);
    const output = document.createElement('textarea'); output.id = 'shareCodeOutput'; output.readOnly = true; output.rows = 3; output.hidden = true; output.className = 'share-code';
    dialog.append(help, list, stripLabel, warn, actions, output, status);
    const selected = () => [...list.querySelectorAll('input:checked')].map(b => b.value);
    const build = async () => { const ids = selected(); if (!ids.length) throw Error(t('shareSelectOne')); return pack(await loadData(), ids, {stripQuery: strip.checked}); };
    fileBtn.addEventListener('click', async () => {
      try {
        const pkg = await build();
        const blob = new Blob([JSON.stringify(pkg, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        const base = pkg.spaces.length === 1 ? pkg.spaces[0].name : t('shareFileMany', [pkg.spaces.length]);
        a.download = `${base.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60)}.tabmatomen.json`;
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
        status.textContent = t('shareFileDone', [pkg.spaces.length]);
      } catch (error) { status.textContent = error.message; }
    });
    codeBtn.addEventListener('click', async () => {
      try {
        const code = await toCode(await build());
        output.value = code; output.hidden = false; output.select();
        try { await navigator.clipboard.writeText(code); status.textContent = t('shareCodeCopied', [code.length]); }
        catch { status.textContent = t('shareCodeShown'); }
      } catch (error) { status.textContent = error.message; }
    });
    dialog.showModal(); (list.querySelector('input:checked') || fileBtn).focus();
  }

  async function openImport() {
    const {dialog, status, close} = dialogShell(t('shareImportTitle'));
    dialog.id = 'shareImportDialog';
    const help = document.createElement('p'); help.className = 'share-help'; help.textContent = t('shareImportHelp');
    const input = document.createElement('textarea'); input.id = 'shareCodeInput'; input.rows = 4; input.className = 'share-code'; input.placeholder = t('shareCodePlaceholder');
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.id = 'shareFileInput'; file.hidden = true;
    const fileBtn = button(t('shareChooseFile')); fileBtn.id = 'shareChooseFile';
    const checkBtn = button(t('shareCheck'), 'btn btn--primary'); checkBtn.id = 'shareCheck';
    const preview = document.createElement('div'); preview.className = 'share-preview'; preview.id = 'sharePreview';
    const addBtn = button(t('shareAdd'), 'btn btn--primary'); addBtn.id = 'shareAdd'; addBtn.hidden = true;
    const actions = document.createElement('div'); actions.className = 'share-actions'; actions.append(checkBtn, fileBtn, addBtn, close);
    dialog.append(help, input, file, actions, preview, status);
    let pending = null;
    const show = pkg => {
      pending = pkg; preview.replaceChildren();
      const heading = document.createElement('p'); heading.className = 'share-preview__title'; heading.textContent = t('sharePreviewTitle', [pkg.spaces.length, pkg.spaces.reduce((n, s) => n + s.tabs.length, 0)]);
      const ul = document.createElement('ul');
      for (const s of pkg.spaces) { const li = document.createElement('li'); li.textContent = (s.categoryPath?.length ? s.categoryPath.join(' / ') + ' / ' : '') + t('m_b8901ba999', [s.name, s.tabs.length]); ul.append(li); }
      const note = document.createElement('p'); note.className = 'share-help'; note.textContent = t('sharePreviewNote');
      preview.append(heading, ul, note); addBtn.hidden = false; addBtn.focus(); status.textContent = '';
    };
    const check = async text => { try { show(await parseInput(text)); } catch (error) { pending = null; preview.replaceChildren(); addBtn.hidden = true; status.textContent = error.message; } };
    checkBtn.addEventListener('click', () => check(input.value));
    fileBtn.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => { const f = file.files[0]; file.value = ''; if (f) { if (f.size > 20 * 1024 * 1024) { status.textContent = t('shareInvalid'); return; } await check(await f.text()); } });
    addBtn.addEventListener('click', async () => {
      if (!pending) return;
      addBtn.disabled = true;
      try {
        let added = [];
        await navigator.locks.request('pwm-space-switch', async () => {
          const data = await loadData();
          added = merge(data, pending, generateId);
          await saveData(data);
        });
        if (typeof renderAll === 'function') await renderAll();
        showMessage(t('shareAdded', [added.length]), 'success');
        dialog.close();
      } catch (error) { status.textContent = error.message; addBtn.disabled = false; }
    });
    dialog.showModal(); input.focus();
    return {check};
  }

  // header button + settings card
  const actionsBar = document.getElementById('spaceActions');
  if (actionsBar) {
    const share = button(t('shareButton')); share.id = 'btnShareSpace'; share.title = t('shareButtonTitle');
    share.addEventListener('click', () => { openExport().catch(error => showMessage(error.message, 'error')); });
    const del = document.getElementById('btnDeleteSpace');
    actionsBar.insertBefore(share, del || null);
  }
  // The settings dialog is created by settings-dialog.js, which loads after this file.
  const attachSettings = () => {
  const settings = document.getElementById('settingsDialog');
  if (settings && !document.getElementById('settingsShareImport')) {
    const card = document.createElement('section'); card.className = 'ai-settings share-settings';
    const h = document.createElement('h3'); h.textContent = t('shareSettingsHeading');
    const p = document.createElement('p'); p.textContent = t('shareSettingsHelp');
    const exportBtn = button(t('shareExportTitle')); exportBtn.id = 'settingsShareExport';
    const importBtn = button(t('shareImportTitle')); importBtn.id = 'settingsShareImport';
    exportBtn.addEventListener('click', () => { settings.close(); openExport().catch(error => showMessage(error.message, 'error')); });
    importBtn.addEventListener('click', () => { settings.close(); openImport().catch(error => showMessage(error.message, 'error')); });
    card.append(h, p, exportBtn, importBtn);
    settings.append(card);
  }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachSettings, {once: true}); else setTimeout(attachSettings, 0);
  return {FORMAT, pack, validatePackage, merge, uniqueName, stripUrl, toCode, parseInput, openExport, openImport};
})();
