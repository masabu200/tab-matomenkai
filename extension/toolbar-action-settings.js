'use strict';
// Settings: what clicking the toolbar icon does (pwm_settings.toolbarAction).
//  'popup' (default) shows the small window (popup.html); 'dashboard' opens the dashboard tab directly.
// background.js applies the choice with chrome.action.setPopup().
(() => {
  const dialog = document.getElementById('settingsDialog');
  if (!dialog) return;
  const section = document.createElement('section');
  section.className = 'toolbar-action-settings';
  const title = document.createElement('h3'); title.id = 'toolbarActionHeading'; title.textContent = t('toolbarActionHeading');
  const select = document.createElement('select'); select.id = 'toolbarAction'; select.setAttribute('aria-labelledby', 'toolbarActionHeading');
  select.append(new Option(t('toolbarActionPopup'), 'popup'), new Option(t('toolbarActionDashboard'), 'dashboard'));
  const help = document.createElement('p'); help.className = 'settings-help'; help.textContent = t('toolbarActionHelp');
  section.append(title, select, help);
  const palette = dialog.querySelector('.palette-settings');
  if (palette) palette.after(section); else dialog.append(section);
  const read = async () => ((await chrome.storage.local.get('pwm_settings')).pwm_settings) || {};
  async function load() { select.value = (await read()).toolbarAction === 'dashboard' ? 'dashboard' : 'popup'; }
  select.addEventListener('change', async () => {
    select.disabled = true;
    try { await chrome.storage.local.set({pwm_settings: {...(await read()), toolbarAction: select.value}}); }
    catch (e) { console.error('[PWM] toolbar action setting', e); await load(); }
    finally { select.disabled = false; }
  });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.pwm_settings) load().catch(() => {}); });
  load().catch(() => {});
})();
