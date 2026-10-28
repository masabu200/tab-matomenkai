'use strict';
// Automatic tidying of spaces that have not been used for a chosen period.
// Settings (pwm_settings): autoCleanDays (0 = off), autoCleanAction ('archive' | 'delete').
// "Used" = the newest of lastOpenedAt / tabsSavedAt / updatedAt / createdAt.
// Never touches favorites, spaces active in any window, or already archived spaces.
// Deleted spaces go to pwm_trash and can be restored for TRASH_DAYS days.
globalThis.AutoClean = (() => {
  const DAY = 86400000;
  const TRASH_DAYS = 30;
  const DATA_KEY = 'pwm_data', SETTINGS_KEY = 'pwm_settings', TRASH_KEY = 'pwm_trash', LAST_KEY = 'pwm_auto_clean_last';
  const PERIODS = [0, 30, 60, 90, 180, 365];

  const stamp = v => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : 0; };
  function lastUsedAt(space) {
    return Math.max(stamp(space.lastOpenedAt), stamp(space.tabsSavedAt), stamp(space.updatedAt), stamp(space.createdAt));
  }
  function settingsOf(raw) {
    const days = Number(raw?.autoCleanDays);
    return {days: PERIODS.includes(days) ? days : 0, action: raw?.autoCleanAction === 'delete' ? 'delete' : 'archive'};
  }
  // Pure: which spaces are stale right now.
  function plan(data, rawSettings, now = Date.now()) {
    const {days, action} = settingsOf(rawSettings);
    if (!days) return {action, ids: [], days};
    const active = new Set(Object.values(data?.windowActiveSpaces || {}).concat(data?.activeSpaceId ? [data.activeSpaceId] : []));
    const cutoff = now - days * DAY;
    const ids = (data?.spaces || []).filter(s => s && !s.archived && !s.favorite && !active.has(s.id)).filter(s => { const used = lastUsedAt(s); return used > 0 && used < cutoff; }).map(s => s.id);
    return {action, ids, days};
  }
  // Pure: mutates data, returns the trash entries created (delete) or archived ids (archive).
  function apply(data, {action, ids}, now = Date.now()) {
    const when = new Date(now).toISOString();
    const set = new Set(ids);
    const trashed = [], archived = [];
    if (action === 'delete') {
      data.spaces = (data.spaces || []).filter(s => { if (!set.has(s.id)) return true; trashed.push({deletedAt: when, reason: 'auto', space: s}); return false; });
    } else {
      for (const s of data.spaces || []) if (set.has(s.id)) { s.archived = true; s.archivedAt = when; s.autoArchived = true; archived.push(s.id); }
    }
    return {trashed, archived};
  }
  function purgeTrash(trash, now = Date.now()) {
    return (Array.isArray(trash) ? trash : []).filter(e => e && e.space && now - stamp(e.deletedAt) < TRASH_DAYS * DAY);
  }
  // Runs one pass under the shared lock; safe to call from the worker or a page.
  async function run(now = Date.now()) {
    return navigator.locks.request('pwm-space-switch', async () => {
      const stored = await chrome.storage.local.get([DATA_KEY, SETTINGS_KEY, TRASH_KEY]);
      const data = stored[DATA_KEY];
      const trashBefore = Array.isArray(stored[TRASH_KEY]) ? stored[TRASH_KEY] : [];
      const trash = purgeTrash(trashBefore, now);
      const result = {at: new Date(now).toISOString(), action: settingsOf(stored[SETTINGS_KEY]).action, archived: 0, deleted: 0, names: []};
      if (!data || !Array.isArray(data.spaces)) { if (trash.length !== trashBefore.length) await chrome.storage.local.set({[TRASH_KEY]: trash}); return result; }
      const p = plan(data, stored[SETTINGS_KEY], now);
      if (p.ids.length) {
        const names = data.spaces.filter(s => p.ids.includes(s.id)).map(s => s.name);
        const {trashed, archived} = apply(data, p, now);
        result.archived = archived.length; result.deleted = trashed.length; result.names = names.slice(0, 10);
        await chrome.storage.local.set({[DATA_KEY]: data, [TRASH_KEY]: trash.concat(trashed), [LAST_KEY]: result});
      } else if (trash.length !== trashBefore.length) {
        await chrome.storage.local.set({[TRASH_KEY]: trash});
      }
      return result;
    });
  }
  async function restoreFromTrash(spaceId) {
    return navigator.locks.request('pwm-space-switch', async () => {
      const stored = await chrome.storage.local.get([DATA_KEY, TRASH_KEY]);
      const trash = Array.isArray(stored[TRASH_KEY]) ? stored[TRASH_KEY] : [];
      const index = trash.findIndex(e => e?.space?.id === spaceId);
      if (index < 0) return null;
      const data = stored[DATA_KEY] || {spaces: [], categories: []};
      const space = {...trash[index].space, updatedAt: new Date().toISOString()};
      if ((data.spaces || []).some(s => s.id === space.id)) space.id = space.id + '-restored-' + Date.now().toString(36);
      if (space.categoryId && !(data.categories || []).some(c => c.id === space.categoryId)) space.categoryId = null;
      data.spaces = (data.spaces || []).concat([space]);
      trash.splice(index, 1);
      await chrome.storage.local.set({[DATA_KEY]: data, [TRASH_KEY]: trash});
      return space;
    });
  }
  async function listTrash() {
    const stored = await chrome.storage.local.get(TRASH_KEY);
    return purgeTrash(stored[TRASH_KEY]);
  }
  async function lastResult() { return (await chrome.storage.local.get(LAST_KEY))[LAST_KEY] || null; }
  return {PERIODS, TRASH_DAYS, lastUsedAt, settingsOf, plan, apply, purgeTrash, run, restoreFromTrash, listTrash, lastResult};
})();
