'use strict';
// Settings UI for the Pro "automatic Google Drive backup" (AUTO-01).
// Shown inside the Drive card. Store installs see it as a Pro feature that is not available yet.
(() => {
  const drive = document.querySelector('.drive-settings');
  if (!drive) return;
  const box = document.createElement('div');
  box.className = 'drive-auto'; box.id = 'driveAuto';
  box.innerHTML = `<div class="drive-auto__head"><strong>${t('driveAutoHeading')}</strong><span class="pro-badge">Pro</span></div>
    <p class="settings-help" id="driveAutoHelp">${t('driveAutoHelp')}</p>
    <label class="drive-auto__toggle"><input type="checkbox" id="driveAutoEnabled"><span>${t('driveAutoEnable')}</span></label>
    <div class="drive-auto__row"><label for="driveAutoInterval">${t('driveAutoIntervalLabel')}</label>
      <select id="driveAutoInterval">${[1, 6, 24].map(h => `<option value="${h}">${t('driveAutoEvery', [h])}</option>`).join('')}</select></div>
    <button type="button" class="btn btn--ghost" id="driveAutoRunNow">${t('driveAutoRunNow')}</button>
    <p id="driveAutoResult" class="drive-auto__result" role="status"></p>
    <p id="driveAutoStatus" class="settings-help"></p>`;
  const anchor = drive.querySelector('.drive-keep');
  drive.insertBefore(box, anchor || null);
  const el = id => box.querySelector('#' + id);
  const when = ms => ms ? new Date(ms).toLocaleString(I18n.current().replace('_', '-')) : '';

  function describe(state, connected) {
    if (state.needsReconnect) return t('driveAutoNeedsReconnect');
    if (state.enabled && !connected) return t('driveAutoNeedConnect');
    if (state.failures >= DriveAutoLimits.MAX_FAILURES) return t('driveAutoPaused', [state.lastError || '']);
    if (state.lastError) return t('driveAutoRetrying', [state.lastError, when(state.nextRetryAt)]);
    if (!state.enabled) return t('driveAutoOff');
    if (state.lastSuccessAt) return t('driveAutoLast', [when(state.lastSuccessAt)]);
    return t('driveAutoWaiting');
  }
  const DriveAutoLimits = {MAX_FAILURES: 8};
  async function render() {
    const entitled = await Entitlements.has('driveAutoSave');
    const stored = await chrome.storage.local.get(['pwm_drive_auto', 'pwm_drive_connected']);
    const state = {enabled: false, intervalHours: 6, failures: 0, ...(stored.pwm_drive_auto || {})};
    const connected = !!stored.pwm_drive_connected || DriveBackup.mode() === 'manual';
    box.classList.toggle('drive-auto--locked', !entitled);
    for (const id of ['driveAutoEnabled', 'driveAutoInterval', 'driveAutoRunNow']) el(id).disabled = !entitled;
    el('driveAutoEnabled').checked = entitled && !!state.enabled;
    el('driveAutoInterval').value = String([1, 6, 24].includes(state.intervalHours) ? state.intervalHours : 6);
    el('driveAutoStatus').textContent = entitled ? describe(state, connected) : t('driveAutoLocked');
  }
  async function save() {
    const cur = (await chrome.storage.local.get('pwm_drive_auto')).pwm_drive_auto || {};
    const enabled = el('driveAutoEnabled').checked;
    const patch = {...cur, enabled, intervalHours: Number(el('driveAutoInterval').value)};
    if (enabled) Object.assign(patch, {failures: 0, nextRetryAt: 0, needsReconnect: false});
    await chrome.storage.local.set({pwm_drive_auto: patch});
  }
  el('driveAutoEnabled').addEventListener('change', save);
  el('driveAutoInterval').addEventListener('change', save);
  el('driveAutoRunNow').addEventListener('click', async () => {
    const button = el('driveAutoRunNow'); button.disabled = true; el('driveAutoResult').textContent = t('m_f11b0168dc');
    try {
      const response = await chrome.runtime.sendMessage({type: 'DRIVE_AUTO_RUN_NOW'});
      const messages = {saved: t('m_f714e3e49d'), 'not-connected': t('driveAutoNeedConnect'), disabled: t('driveAutoEnableFirst'), 'not-entitled': t('driveAutoLocked'), 'needs-reconnect': t('driveAutoNeedsReconnect')};
      el('driveAutoResult').textContent = response?.error || messages[response?.action] || t('driveAutoNoResponse');
    } catch (error) { el('driveAutoResult').textContent = error.message; }
    finally { button.disabled = false; }
  });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.pwm_drive_auto || changes.pwm_drive_connected)) render().catch(() => {}); });
  render().catch(() => {});
})();
