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
  bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'タブの一括操作');
  bar.innerHTML = `
    <label class="bulk-bar__all"><input type="checkbox" id="bulkSelectAll"><span>全選択</span></label>
    <span id="bulkCount" class="bulk-bar__count" role="status" aria-live="polite">0件選択</span>
    <button type="button" id="bulkOpen" class="btn btn--ghost" title="選択したタブをこのウィンドウで開く">開く</button>
    <span class="bulk-bar__field"><select id="bulkMoveTarget" aria-label="移動先のスペース"></select><button type="button" id="bulkMove" class="btn btn--ghost">移動</button></span>
    <span class="bulk-bar__field"><select id="bulkGroupTarget" aria-label="入れるグループ"></select><button type="button" id="bulkGroup" class="btn btn--ghost">グループへ</button></span>
    <span class="bulk-bar__field"><select id="bulkCopyFormat" aria-label="コピーの形式"><option value="md">Markdown</option><option value="text">タイトルとURL</option><option value="urls">URLのみ</option></select><button type="button" id="bulkCopy" class="btn btn--ghost" title="選択したタブ（未選択ならスペース全体）の一覧をコピー">コピー</button></span>
    <button type="button" id="bulkArchive" class="btn btn--ghost" title="選択したタブをアーカイブ">アーカイブ</button>
    <button type="button" id="bulkDelete" class="btn btn--ghost btn--danger" title="選択したタブを削除">削除</button>
    <button type="button" id="bulkClear" class="btn btn--ghost" title="選択を解除（Esc）">解除</button>`;
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
    el('bulkCount').textContent = n ? `${n}件選択` : '0件選択';
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
      move.replaceChildren(new Option('移動先…', ''));
      for (const s of data.spaces) if (!s.archived && (!space || s.id !== space.id)) move.append(new Option(s.name, s.id));
      if ([...move.options].some(o => o.value === prevMove)) move.value = prevMove;
      const group = el('bulkGroupTarget'); const prevGroup = group.value;
      group.replaceChildren(new Option('グループ…', ''), new Option('グループなし', 'none'));
      for (const g of (space?.tabGroups || [])) group.append(new Option(g.name || '名称未設定グループ', g.id));
      group.append(new Option('新しいグループ…', 'new'));
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
    if (g_isSwitching) { showMessage('切り替え中は操作できません。', 'error'); return; }
    for (const id of ['bulkOpen','bulkMove','bulkGroup','bulkArchive','bulkDelete']) el(id).disabled = true;
    try {
      await navigator.locks.request('pwm-space-switch', async () => {
        const data = await loadData(); const space = activeSpace(data);
        if (!space || space.id !== spaceId) throw Error('スペースが切り替わったため中止しました。選択し直してください。');
        const picked = indices().filter(i => i < space.tabs.length);
        if (!picked.length) throw Error('選択したタブが見つかりません。');
        const message = await work(data, space, picked);
        if (message) showMessage(message, 'success');
      });
      clearSelection();
    } catch (error) {
      showMessage(error?.message || `${label}に失敗しました。`, 'error'); console.error('[PWM] bulk', label, error);
    } finally { sync(); }
  }
  el('bulkOpen').addEventListener('click', () => run('開く', async (data, space, picked) => {
    let opened = 0;
    for (const i of picked) {
      const tab = space.tabs[i]; if (!isRestorableUrl(tab.url)) continue;
      try { await chrome.tabs.create({ windowId: g_dashboardWindowId, url: tab.url, active: false, pinned: !!tab.pinned }); opened++; } catch { /* 1枚ずつ続ける */ }
    }
    return `${opened}枚のタブを開きました。`;
  }));
  el('bulkMove').addEventListener('click', () => {
    const targetId = el('bulkMoveTarget').value;
    if (!targetId) { showMessage('移動先のスペースを選んでください。', 'error'); return; }
    run('移動', async (data, space, picked) => {
      const target = data.spaces.find(s => s.id === targetId && !s.archived);
      if (!target) throw Error('移動先のスペースがありません。');
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
      return `「${target.name}」へ${moved}枚移動しました。${skipped ? `（同じURLの${skipped}枚は移動先に保存済みのため除外）` : ''}`;
    });
  });
  el('bulkGroup').addEventListener('click', async () => {
    const choice = el('bulkGroupTarget').value;
    if (!choice) { showMessage('入れるグループを選んでください。', 'error'); return; }
    let groupId = choice === 'none' ? null : choice;
    let groupName = '';
    if (choice === 'new') {
      const result = await openTabGroupModal('新しいグループ', '', '');
      if (!result) return;
      const group = await createTabGroup(spaceId, result.name, result.color || '');
      if (!group) return;
      groupId = group.id; groupName = group.name;
    }
    run('グループ移動', async (data, space, picked) => {
      const group = groupId ? (space.tabGroups || []).find(g => g.id === groupId) : null;
      if (groupId && !group) throw Error('グループが見つかりません。');
      for (const i of picked) space.tabs[i].groupId = groupId;
      space.updatedAt = new Date().toISOString();
      await saveData(data); await renderAll(); applyGroupsToChromeTabs(space.id).catch(() => {});
      return groupId ? `${picked.length}枚を「${group.name || groupName || '名称未設定グループ'}」に入れました。` : `${picked.length}枚をグループから外しました。`;
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
      if (!picked.length) { showMessage('コピーするタブがありません。', 'error'); return; }
      const format = el('bulkCopyFormat').value; const label = { md: 'Markdown', text: 'タイトルとURL', urls: 'URLのみ' }[format] || format;
      if (await copyText(formatTabs(picked, format))) showMessage(`${picked.length}件を${label}でコピーしました。`, 'success');
      else showMessage('クリップボードにコピーできませんでした。', 'error');
    } catch (error) { showMessage('コピーに失敗しました。', 'error'); console.error('[PWM] bulk copy', error); }
  });
  el('bulkArchive').addEventListener('click', () => run('アーカイブ', async (data, space, picked) => {
    const snapshot = typeof Undo !== 'undefined' ? Undo.snapshotOf(space) : null;
    if (!Array.isArray(space.archivedTabs)) space.archivedTabs = [];
    const now = new Date().toISOString();
    const archived = picked.map(i => ({ ...space.tabs[i], archivedAt: now }));
    for (const i of [...picked].reverse()) space.tabs.splice(i, 1);
    space.archivedTabs.unshift(...archived); space.updatedAt = now;
    await saveData(data); await renderAll();
    if (snapshot) await Undo.offer(`${archived.length}枚をアーカイブしました。`, snapshot);
    return `${archived.length}枚をアーカイブしました。`;
  }));
  el('bulkDelete').addEventListener('click', async () => {
    const n = selected.size; if (!n) return;
    if (!await DashboardDialogs.confirm(`選択した${n}枚のタブを削除します。元に戻せません。よろしいですか？`)) return;
    run('削除', async (data, space, picked) => {
      const snapshot = typeof Undo !== 'undefined' ? Undo.snapshotOf(space) : null;
      for (const i of [...picked].reverse()) space.tabs.splice(i, 1);
      space.updatedAt = new Date().toISOString();
      await saveData(data); await renderAll();
      if (snapshot) await Undo.offer(`${picked.length}枚のタブを削除しました。`, snapshot);
      return `${picked.length}枚のタブを削除しました。`;
    });
  });
  schedule();
  return { selected, clearSelection, selectAllVisible };
})();
