'use strict';
// AUTO-01: automatic Google Drive backup (Pro). Runs in the service worker.
// - Saves only when the data changed since the last successful backup (SHA-256 of spaces+categories).
// - Saves at most once per chosen interval, and waits for a quiet period after the last edit.
// - Survives restarts: state lives in chrome.storage.local, the check runs on a chrome.alarms tick.
// - One run at a time (Web Lock inside DriveBackup.save) and exponential backoff on failure,
//   capped; auth problems stop retrying until the user reconnects.
globalThis.DriveAuto = (() => {
  const STATE_KEY = 'pwm_drive_auto';
  const ALARM = 'pwm-drive-auto';
  const TICK_MINUTES = 15;
  const QUIET_MS = 5 * 60000;
  const INTERVALS = [1, 6, 24];
  const MAX_FAILURES = 8;
  const BASE_RETRY_MS = 15 * 60000, MAX_RETRY_MS = 24 * 3600000;

  const defaults = () => ({enabled: false, intervalHours: 6, lastHash: '', lastSuccessAt: 0, lastAttemptAt: 0, lastError: '', failures: 0, nextRetryAt: 0, needsReconnect: false, dirtyAt: 0});
  async function getState() { return {...defaults(), ...((await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {})}; }
  async function setState(patch) { const s = {...(await getState()), ...patch}; await chrome.storage.local.set({[STATE_KEY]: s}); return s; }

  async function hashOf(data) {
    const body = JSON.stringify({categories: data?.categories || [], spaces: data?.spaces || []});
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Pure decision: what should a tick do now?
  function decide(state, {now, hash, entitled, connected}) {
    if (!state.enabled) return 'disabled';
    if (!entitled) return 'not-entitled';
    if (!connected) return 'not-connected';
    if (state.needsReconnect) return 'needs-reconnect';
    if (state.failures >= MAX_FAILURES) return 'paused';
    if (state.nextRetryAt && now < state.nextRetryAt) return 'backoff';
    if (hash === state.lastHash) return 'unchanged';
    if (state.dirtyAt && now - state.dirtyAt < QUIET_MS) return 'settling';
    const interval = (INTERVALS.includes(state.intervalHours) ? state.intervalHours : 6) * 3600000;
    if (state.lastSuccessAt && now - state.lastSuccessAt < interval) return 'too-soon';
    return 'save';
  }
  const retryDelay = failures => Math.min(BASE_RETRY_MS * 2 ** Math.max(0, failures - 1), MAX_RETRY_MS);
  const isAuthError = message => [t('m_1b162ecb08'), t('m_27298d6197'), t('m_6d2d7cf526'), t('m_38e08f6f72')].some(m => m && message.includes(m));

  async function setBadge(problem) {
    try {
      await chrome.action.setBadgeBackgroundColor({color: '#d94040'});
      await chrome.action.setBadgeText({text: problem ? '!' : ''});
      await chrome.action.setTitle({title: problem ? t('driveAutoBadgeTitle') : t('actionTitle')});
    } catch { /* badge is best effort */ }
  }

  // One check. `force` ignores interval/quiet (used by "run now"), never the entitlement.
  async function tick({now = Date.now(), force = false} = {}) {
    const state = await getState();
    const data = (await chrome.storage.local.get('pwm_data')).pwm_data || {spaces: [], categories: []};
    const hash = await hashOf(data);
    const entitled = await Entitlements.has('driveAutoSave');
    const connected = !!(await chrome.storage.local.get('pwm_drive_connected')).pwm_drive_connected || DriveBackup.mode() === 'manual';
    let action = decide(state, {now, hash, entitled, connected});
    if (force && ['unchanged', 'settling', 'too-soon', 'backoff', 'paused'].includes(action)) action = 'save';
    if (action !== 'save') return {action, state};
    await setState({lastAttemptAt: now});
    try {
      const result = await DriveBackup.save(data, data.activeSpaceId || null);
      const next = await setState({lastHash: hash, lastSuccessAt: now, lastError: '', failures: 0, nextRetryAt: 0, needsReconnect: false, dirtyAt: 0, lastFile: {id: result.id, name: result.name}});
      await setBadge(false);
      return {action: 'saved', state: next, result};
    } catch (error) {
      const message = error?.message || String(error);
      const auth = isAuthError(message);
      const failures = state.failures + 1;
      const next = await setState({lastError: message, failures, nextRetryAt: auth ? 0 : now + retryDelay(failures), needsReconnect: auth});
      if (auth || failures >= MAX_FAILURES) await setBadge(true);
      return {action: auth ? 'needs-reconnect' : 'failed', state: next, error: message};
    }
  }
  async function setEnabled(enabled, intervalHours) {
    const patch = {enabled: !!enabled};
    if (INTERVALS.includes(Number(intervalHours))) patch.intervalHours = Number(intervalHours);
    if (enabled) Object.assign(patch, {failures: 0, nextRetryAt: 0, needsReconnect: false});
    const s = await setState(patch);
    if (!enabled) await setBadge(false);
    return s;
  }
  // Called after the user reconnects: clear the stop flag and badge.
  async function reconnected() { await setState({needsReconnect: false, failures: 0, nextRetryAt: 0}); await setBadge(false); }
  function install() {
    const ensureAlarm = () => { try { chrome.alarms.get(ALARM, a => { if (!a) chrome.alarms.create(ALARM, {delayInMinutes: 1, periodInMinutes: TICK_MINUTES}); }); } catch {} };
    chrome.runtime.onInstalled.addListener(ensureAlarm);
    chrome.runtime.onStartup.addListener(ensureAlarm);
    ensureAlarm();
    chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) tick().catch(e => console.warn('[PWM] drive auto', e)); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.pwm_data) setState({dirtyAt: Date.now()}).catch(() => {});
      if (changes.pwm_drive_connected?.newValue === true) reconnected().catch(() => {});
    });
  }
  return {STATE_KEY, ALARM, INTERVALS, MAX_FAILURES, QUIET_MS, decide, retryDelay, hashOf, getState, setEnabled, tick, reconnected, install};
})();
