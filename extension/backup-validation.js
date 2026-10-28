'use strict';
function validateBackup(data) {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fail = () => { throw new Error(t('m_56415d676e')); };
  const ids = items => {
    const seen = new Set();
    for (const item of items) {
      if (!object(item) || typeof item.id !== 'string' || !item.id || seen.has(item.id)) fail();
      seen.add(item.id);
    }
  };
  const tabs = items => {
    if (!Array.isArray(items)) fail();
    for (const t of items) {
      if (!object(t) || typeof t.url !== 'string' || !t.url) fail();
      try { const u = new URL(t.url); if (!['http:', 'https:', 'file:', 'chrome:', 'about:', 'chrome-extension:'].includes(u.protocol)) fail(); } catch { fail(); }
      if (t.title !== undefined && typeof t.title !== 'string') fail();
    }
  };
  if (!object(data) || !Array.isArray(data.spaces) || (data.version !== undefined && data.version !== 1)) fail();
  ids(data.spaces);
  for (const s of data.spaces) {
    if (typeof s.name !== 'string') fail();
    tabs(s.tabs);
    if (s.archivedTabs !== undefined) tabs(s.archivedTabs);
    if (s.tabGroups !== undefined) {
      if (!Array.isArray(s.tabGroups)) fail();
      ids(s.tabGroups);
      if (s.tabGroups.some(g => typeof g.name !== 'string')) fail();
    }
  }
  if (data.categories !== undefined) {
    if (!Array.isArray(data.categories)) fail();
    ids(data.categories);
    const byId = new Map(data.categories.map(c => [c.id,c]));
    for (const c of data.categories) {
      if (typeof c.name !== 'string') fail();
      const seen = new Set([c.id]); let parent = c.parentId;
      while (parent) { if (!byId.has(parent) || seen.has(parent)) fail(); seen.add(parent); parent = byId.get(parent).parentId; }
    }
  }
  if (data.windowActiveSpaces !== undefined && !object(data.windowActiveSpaces)) fail();
  return data;
}
