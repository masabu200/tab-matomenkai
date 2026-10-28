'use strict';
// タブの一括操作（ダッシュボード）
//   カードのチェックボックスで選択（Shift+クリックで範囲、全選択、Esc で解除、⌘/Ctrl+A で表示中を全選択）
//   選択したタブを「開く」「別スペースへ移動」「グループへ」「アーカイブ」「削除」
const BulkActions = (() => {
  const listEl = document.getElementById('tabList');
  if (!listEl) return null;
  const selected = new Set();   // 現在のスペース内のタブ番号（originalIndex）
  let lastIndex = null;         // Shift範囲選択の起点
  let spaceId = null;           // 選択が属するスペース
  const bar = document.createElement('div'); bar.id = 'bulkBar'; bar.className = 'bulk-bar'; bar.hidden = true;
  bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', t('m_a18e4bec39'));
  bar.innerHTML = `
    <label class="bulk-bar__all"><input type="checkbox" id="bulkSelectAll"><span>${t('m_f6365e7574')}</span></label>
    <span id="bulkCount" class="bulk-bar__count" role="status" aria-live="polite">${t('m_e135253c38')}</span>
    <button type="button" id="bulkOpen" class="btn btn--ghost" title="${t('m_9a2cef5d5b')}">${t('m_119daf93ee')}</button>
    <span class="bulk-bar__field"><select id="bulkMoveTarget" aria-label="${t('m_2cb583698f')}"></select><button type="button" id="bulkMove" class="btn btn--ghost">${t('m_9a97fc3ae6')}</button></span>
    <span class="bulk-bar__field"><select id="bulkGroupTarget" aria-label="${t('m_71a12fb43e')}"></select><button type="button" id="bulkGroup" class="btn btn--ghost">${t('m_e70ecafd50')}</button></span>
    <span class="bulk-bar__field"><select id="bulkCopyFormat" aria-label="${t('m_ae75ae1d2a')}"><option value="md">Markdown</option><option value="text">${t('m_ce05fd6a61')}</option><option value="urls">${t('m_c257bec714')}</option></select><button type="button" id="bulkCopy" class="btn btn--ghost" title="${t('m_295cc5d596')}">${t('m_e94c210766')}</button></span>
    <button type="button" id="bulkArchive" class="btn btn--ghost" title="${t('m_a2307d9555')}">${t('m_c686c1a9dd')}</button>
    <button type="button" id="bulkDelete" class="btn btn--ghost btn--danger" title="${t('m_2fe1822ad4')}">${t('m_5cbdf1fd70')}</button>
    <button type="button" id="bulkClear" class="btn btn--ghost" title="${t('m_f0dc9f43d4')}">${t('m_ec7ae06b09')}</button>`;
  listEl.before(bar);
  const el = id => bar.querySelector('#' + id);
  const cards = () => [...listEl.querySelectorAll('.tab-card[data-tab-index]')];
  const indexOf = card => Number(card.dataset.tabIndex);
  function activeSpace(data) { return data.spaces.find(s => s.id === getActiveSpaceId(data)); }

  // ---------- 表示の同期 ----------
  function sync() {
    const all = cards();
    for (const card of all) {
      const on = selected.has(indexOf(card));
      card.classList.toggle('tab-card--selected', on);
      const box = card.querySelector('.tab-card__checkbox'); if (box) box.checked = on;
    }
    bar.hidden = all.length === 0;
    const n = selected.size;
    el('bulkCount').textContent = n ? t('m_fca5a8dc9f', [n]) : t('m_e135253c38');
    const allBox = el('bulkSelectAll');
    allBox.checked = all.length > 0 && all.every(c => selected.has(indexOf(c)));
    allBox.indeterminate = n > 0 && !allBox.checked;
    for (const id of ['bulkOpen','bulkMove','bulkGroup','bulkArchive','bulkDelete','bulkClear']) el(id).disabled = n === 0;
    el('bulkCopy').disabled = all.length === 0;
    bar.classList.toggle('bulk-bar--active', n > 0);
  }
  let optionsSeq = 0;
  async function refreshOptions() {
    const seq = ++optionsSeq;
    try {
      const data = await loadData(); if (seq !== optionsSeq) return;
      const space = activeSpace(data);
      const move = el('bulkMoveTarget'); const prevMove = move.value;
      move.replaceChildren(new Option(t('m_91f77f62c2'), ''));
      for (const s of data.spaces) if (!s.archived && (!space || s.id !== space.id)) move.append(new Option(s.name, s.id));
      if ([...move.options].some(o => o.value === prevMove)) move.value = prevMove;
      const group = el('bulkGroupTarget'); const prevGroup = group.value;
      group.replaceChildren(new Option(t('m_cda05ed8b5'), ''), new Option(t('m_7a137f933a'), 'none'));
      for (const g of (space?.tabGroups || [])) group.append(new Option(g.name || t('m_bcbebef3cf'), g.id));
      group.append(new Option(t('m_4710908c81'), 'new'));
      if ([...group.options].some(o => o.value === prevGroup)) group.value = prevGroup;
      // スペースが変わったら選択は引き継がない。タブ数が減って指せない番号も外す。
      const currentId = space ? space.id : null;
      if (currentId !== spaceId) { selected.clear(); lastIndex = null; spaceId = currentId; }
      const count = space ? (space.tabs || []).length : 0;
      for (const i of [...selected]) if (i >= count) selected.delete(i);
      sync();
    } catch { /* 描画は既存のまま */ }
  }
  let timer; function schedule() { clearTimeout(timer); timer = setTimeout(refreshOptions, 60); }
  new MutationObserver(() => { sync(); schedule(); }).observe(listEl, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.pwm_data) schedule(); });
  document.addEventListener('DOMContentLoaded', schedule);

  // ---------- 選択 ----------
  function setSelected(index, on) { if (on) selected.add(index); else selected.delete(index); }
  listEl.addEventListener('click', event => {
    const box = event.target.closest('.tab-card__checkbox'); if (!box) return;
    const index = Number(box.dataset.tabIndex);
    const visible = cards().map(indexOf);
    if (event.shiftKey && lastIndex !== null && visible.includes(lastIndex)) {
      const a = visible.indexOf(lastIndex), b = visible.indexOf(index);
      const [from, to] = a < b ? [a, b] : [b, a];
      for (const i of visible.slice(from, to + 1)) setSelected(i, true);
    } else {
      setSelected(index, box.checked);
    }
    lastIndex = index; sync();
  });
  function selectAllVisible(on) { for (const i of cards().map(indexOf)) setSelected(i, on); sync(); }
  el('bulkSelectAll').addEventListener('change', event => selectAllVisible(event.target.checked));
  function clearSelection() { selected.clear(); lastIndex = null; sync(); }
  el('bulkClear').addEventListener('click', clearSelection);
  const editable = node => !!node && (node.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(node.tagName));
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && selected.size && !editable(document.activeElement)) { clearSelection(); return; }
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'a' && !editable(document.activeElement) && cards().length) {
      event.preventDefault(); selectAllVisible(true);
    }
  });

  // ---------- 一括操作 ----------
  function indices() { return [...selected].sort((a, b) => a - b); }
  async function run(label, work) {
    if (!selected.size) return;
    if (g_isSwitching) { showMessage(t('m_e4de78fe6b'), 'error'); return; }
    for (const id of ['bulkOpen','bulkMove','bulkGroup','bulkArchive','bulkDelete']) el(id).disabled = true;
    try {
      await navigator.locks.request('pwm-space-switch', async () => {
        const data = await loadData(); const space = activeSpace(data);
        if (!space || space.id !== spaceId) throw Error(t('m_37bb515e00'));
        const picked = indices().filter(i => i < space.tabs.length);
        if (!picked.length) throw Error(t('m_5e3dfdc724'));
        const message = await work(data, space, picked);
        if (message) showMessage(message, 'success');
      });
      clearSelection();
    } catch (error) {
      showMessage(error?.message || t('m_fba383cf43', [label]), 'error'); console.error('[PWM] bulk', label, error);
    } finally { sync(); }
  }
  el('bulkOpen').addEventListener('click', () => run(t('m_119daf93ee'), async (data, space, picked) => {
    let opened = 0;
    for (const i of picked) {
      const tab = space.tabs[i]; if (!isRestorableUrl(tab.url)) continue;
      try { await chrome.tabs.create({ windowId: g_dashboardWindowId, url: tab.url, active: false, pinned: !!tab.pinned }); opened++; } catch { /* 1枚ずつ続ける */ }
    }
    return t('m_481253a7af', [opened]);
  }));
  el('bulkMove').addEventListener('click', () => {
    const targetId = el('bulkMoveTarget').value;
    if (!targetId) { showMessage(t('m_8394e407bf'), 'error'); return; }
    run(t('m_9a97fc3ae6'), async (data, space, picked) => {
      const target = data.spaces.find(s => s.id === targetId && !s.archived);
      if (!target) throw Error(t('m_72a6bd4fe9'));
      const existing = new Set((target.tabs || []).map(t => t.url));
      let moved = 0, skipped = 0;
      const moving = picked.map(i => space.tabs[i]);
      for (const i of [...picked].reverse()) space.tabs.splice(i, 1);
      for (const tab of moving) {
        if (existing.has(tab.url)) { skipped++; continue; }
        existing.add(tab.url); target.tabs.push({ ...tab, groupId: null }); moved++;
      }
      const now = new Date().toISOString(); space.updatedAt = now; target.updatedAt = now;
      await saveData(data); await renderAll(); applyGroupsToChromeTabs(space.id).catch(() => {});
      return t('m_7c9bfe16e3', [target.name, moved, skipped ? t('m_33ad04a535', [skipped]) : '']);
    });
  });
  el('bulkGroup').addEventListener('click', async () => {
    const choice = el('bulkGroupTarget').value;
    if (!choice) { showMessage(t('m_c19f04094f'), 'error'); return; }
    let groupId = choice === 'none' ? null : choice;
    let groupName = '';
    if (choice === 'new') {
      const result = await openTabGroupModal(t('m_42f0321630'), '', '');
      if (!result) return;
      const group = await createTabGroup(spaceId, result.name, result.color || '');
      if (!group) return;
      groupId = group.id; groupName = group.name;
    }
    run(t('m_80eb0a488d'), async (data, space, picked) => {
      const group = groupId ? (space.tabGroups || []).find(g => g.id === groupId) : null;
      if (groupId && !group) throw Error(t('m_961c24d640'));
      for (const i of picked) space.tabs[i].groupId = groupId;
      space.updatedAt = new Date().toISOString();
      await saveData(data); await renderAll(); applyGroupsToChromeTabs(space.id).catch(() => {});
      return groupId ? t('m_d42ecb5149', [picked.length, group.name || groupName || t('m_bcbebef3cf')]) : t('m_2a8a7849b4', [picked.length]);
    });
  });
  // ---------- URL一覧コピー（選択分。未選択ならスペース全体） ----------
  function formatTabs(tabs, format) {
    const title = t => (t.title || t.url || '').replace(/\s+/g, ' ').trim() || t.url;
    if (format === 'urls') return tabs.map(t => t.url).join('\n');
    if (format === 'text') return tabs.map(t => `${title(t)}\n${t.url}`).join('\n\n');
    return tabs.map(t => `- [${title(t).replace(/[\[\]]/g, ' ')}](${t.url})`).join('\n');
  }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); return true; } catch { /* フォールバック */ }
    const area = document.createElement('textarea'); area.value = value; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.append(area); area.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } area.remove(); return ok;
  }
  el('bulkCopy').addEventListener('click', async () => {
    try {
      const data = await loadData(); const space = activeSpace(data); if (!space) return;
      const picked = selected.size ? indices().filter(i => i < space.tabs.length).map(i => space.tabs[i]) : space.tabs;
      if (!picked.length) { showMessage(t('m_d97fff8023'), 'error'); return; }
      const format = el('bulkCopyFormat').value; const label = { md: 'Markdown', text: t('m_ce05fd6a61'), urls: t('m_c257bec714') }[format] || format;
      if (await copyText(formatTabs(picked, format))) showMessage(t('m_fd05c05821', [picked.length, label]), 'success');
      else showMessage(t('m_b4a1f2d50c'), 'error');
    } catch (error) { showMessage(t('m_63b3f3287e'), 'error'); console.error('[PWM] bulk copy', error); }
  });
  el('bulkArchive').addEventListener('click', () => run(t('m_c686c1a9dd'), async (data, space, picked) => {
    const snapshot = typeof Undo !== 'undefined' ? Undo.snapshotOf(space) : null;
    if (!Array.isArray(space.archivedTabs)) space.archivedTabs = [];
    const now = new Date().toISOString();
    const archived = picked.map(i => ({ ...space.tabs[i], archivedAt: now }));
    for (const i of [...picked].reverse()) space.tabs.splice(i, 1);
    space.archivedTabs.unshift(...archived); space.updatedAt = now;
    await saveData(data); await renderAll();
    if (snapshot) await Undo.offer(t('m_b48b8f8f20', [archived.length]), snapshot);
    return t('m_b48b8f8f20', [archived.length]);
  }));
  el('bulkDelete').addEventListener('click', async () => {
    const n = selected.size; if (!n) return;
    if (!await DashboardDialogs.confirm(t('m_cba9bbaa15', [n]))) return;
    run(t('m_5cbdf1fd70'), async (data, space, picked) => {
      const snapshot = typeof Undo !== 'undefined' ? Undo.snapshotOf(space) : null;
      for (const i of [...picked].reverse()) space.tabs.splice(i, 1);
      space.updatedAt = new Date().toISOString();
      await saveData(data); await renderAll();
      if (snapshot) await Undo.offer(t('m_fae13af1e7', [picked.length]), snapshot);
      return t('m_fae13af1e7', [picked.length]);
    });
  });
  schedule();
  return { selected, clearSelection, selectAllVisible };
})();
