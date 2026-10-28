'use strict';
// Pinned tabs are shared by every space: they stay open when switching spaces and are never
// saved into a space. This file shows them in a strip above the tab list (open / unpin) and
// lets a saved tab be pinned from its card (it moves out of the space and opens pinned).
globalThis.PinnedTabs = (() => {
  const strip = document.createElement('section');
  strip.id = 'pinnedTabs'; strip.className = 'pinned-tabs'; strip.hidden = true;
  strip.setAttribute('aria-label', t('pinnedHeading'));
  const title = document.createElement('span'); title.className = 'pinned-tabs__title'; title.textContent = t('pinnedHeading');
  const list = document.createElement('div'); list.className = 'pinned-tabs__list';
  strip.append(title, list);
  const anchor = document.getElementById('tabList');
  if (anchor) anchor.before(strip);

  async function windowTabs() {
    if (g_dashboardWindowId === null) return [];
    try { return await chrome.tabs.query({windowId: g_dashboardWindowId}); } catch { return []; }
  }
  async function render() {
    const pinned = (await windowTabs()).filter(tab => tab.pinned && !(tab.url || '').startsWith(DASHBOARD_PAGE_URL) && tab.id !== g_dashboardTabId);
    list.replaceChildren();
    strip.hidden = !pinned.length;
    for (const tab of pinned) {
      const item = document.createElement('div'); item.className = 'pinned-tab';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'pinned-tab__open';
      open.title = (tab.title || tab.url || '') + '\n' + (tab.url || tab.pendingUrl || '');
      if (tab.favIconUrl && /^https?:/.test(tab.favIconUrl)) { const icon = document.createElement('img'); icon.src = tab.favIconUrl; icon.alt = ''; icon.width = 16; icon.height = 16; open.append(icon); }
      const label = document.createElement('span'); label.textContent = tab.title || tab.url || tab.pendingUrl || ''; open.append(label);
      open.addEventListener('click', () => { chrome.tabs.update(tab.id, {active: true}).catch(() => {}); });
      const unpin = document.createElement('button'); unpin.type = 'button'; unpin.className = 'pinned-tab__unpin'; unpin.textContent = '×';
      unpin.setAttribute('aria-label', t('unpinTabLabel', [tab.title || tab.url || ''])); unpin.title = t('unpinTabTitle');
      unpin.addEventListener('click', async () => {
        try { await chrome.tabs.update(tab.id, {pinned: false}); showMessage(t('unpinnedMessage'), 'success'); } catch { showMessage(t('m_a89f5a6dd5'), 'error'); }
        render();
      });
      item.append(open, unpin); list.append(item);
    }
  }
  // Pin a saved tab: open it pinned in this window (or pin an open tab with the same URL),
  // then remove it from the space so it is not reopened twice.
  async function pinSaved(index) {
    await navigator.locks.request('pwm-space-switch', async () => {
      const data = await loadData();
      const space = data.spaces.find(s => s.id === getActiveSpaceId(data));
      const saved = space?.tabs?.[index];
      if (!saved || !isRestorableUrl(saved.url)) { showMessage(t('m_fa9f222dca'), 'error'); return; }
      const tabs = await windowTabs();
      const existing = tabs.find(tab => (tab.pendingUrl || tab.url) === saved.url);
      try {
        if (existing) await chrome.tabs.update(existing.id, {pinned: true});
        else await chrome.tabs.create({url: saved.url, windowId: g_dashboardWindowId, active: false, pinned: true});
      } catch { showMessage(t('m_fa9f222dca'), 'error'); return; }
      space.tabs.splice(index, 1);
      space.updatedAt = new Date().toISOString();
      await saveData(data);
      showMessage(t('pinnedMessage', [saved.title || saved.url]), 'success');
    });
    if (typeof renderAll === 'function') await renderAll();
    render();
  }
  for (const event of ['onUpdated', 'onRemoved', 'onCreated', 'onMoved', 'onAttached', 'onDetached']) {
    try { chrome.tabs[event].addListener((...args) => { if (event === 'onUpdated' && !('pinned' in (args[1] || {})) && !('title' in (args[1] || {})) && !('favIconUrl' in (args[1] || {}))) return; render(); }); } catch {}
  }
  const start = () => { if (g_dashboardWindowId === null) { setTimeout(start, 200); return; } render(); };
  start();
  return {render, pinSaved};
})();
