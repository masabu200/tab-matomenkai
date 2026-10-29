'use strict';
// Colour palette layer ("theme" in settings). Loaded synchronously in <head> so the first paint
// already uses the chosen palette: the last choice is mirrored to localStorage and set as
// <html data-theme-palette="...">. The source of truth is pwm_settings.palette in chrome.storage.
// The light/dark choice (pwm_theme) is mirrored the same way so a dark palette does not flash light.
globalThis.ThemePalette = (() => {
  // preview: [rail, page background, card, accent] for the swatch in the settings card.
  const LIST = [
    {id: 'standard', label: 'paletteStandard', preview: ['#191c1d', '#f5f6f6', '#ffffff', '#191c1d']},
    {id: 'pink', label: 'palettePink', preview: ['#7a2a4c', '#fdf3f7', '#ffffff', '#b8336a']},
    {id: 'beige', label: 'paletteBeige', preview: ['#3d3329', '#f6f1e9', '#fffdf9', '#6b5236']},
    {id: 'mint', label: 'paletteMint', preview: ['#174a3f', '#eff8f5', '#ffffff', '#1b7560']},
    {id: 'navy', label: 'paletteNavy', preview: ['#162a52', '#f1f4f9', '#ffffff', '#1f3b70']},
  ];
  const IDS = LIST.map(p => p.id);
  const LS_PALETTE = 'pwm_palette', LS_DARK = 'pwm_theme_dark';
  const valid = id => (IDS.includes(id) ? id : 'standard');
  const ls = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  };
  let current = valid(ls.get(LS_PALETTE));

  function apply(id) {
    current = valid(id);
    document.documentElement.setAttribute('data-theme-palette', current);
    ls.set(LS_PALETTE, current);
    document.dispatchEvent(new CustomEvent('pwm-palette-change', {detail: current}));
    return current;
  }
  async function set(id) {
    const value = apply(id);
    const cur = ((await chrome.storage.local.get('pwm_settings')).pwm_settings) || {};
    await chrome.storage.local.set({pwm_settings: {...cur, palette: value}});
    return value;
  }
  const get = () => current;

  document.documentElement.setAttribute('data-theme-palette', current);
  // Apply the cached dark mode as soon as <body> exists (before the first paint); dashboard.js's
  // applyTheme() later confirms or corrects it from pwm_theme.
  if (ls.get(LS_DARK) === '1') {
    const mark = () => { if (document.body) { document.body.classList.add('theme-dark'); return true; } return false; };
    if (!mark()) {
      const observer = new MutationObserver(() => { if (mark()) observer.disconnect(); });
      observer.observe(document.documentElement, {childList: true});
    }
  }

  try {
    chrome.storage.local.get(['pwm_settings', 'pwm_theme']).then(result => {
      const stored = valid((result.pwm_settings || {}).palette);
      if (stored !== current) apply(stored);
      ls.set(LS_DARK, result.pwm_theme === 'dark' ? '1' : '0');
    }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.pwm_settings) {
        const next = valid((changes.pwm_settings.newValue || {}).palette);
        if (next !== current) apply(next);
      }
      if (changes.pwm_theme) ls.set(LS_DARK, changes.pwm_theme.newValue === 'dark' ? '1' : '0');
    });
  } catch {}

  return {LIST, IDS, get, set, apply};
})();
