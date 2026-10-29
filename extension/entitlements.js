'use strict';
// Which paid (Pro) features this installation may use.
// - Development installs (unpacked) are always Pro.
// - Store installs ask the billing worker (BillingConfig.apiBase) with a random purchase id kept in
//   chrome.storage.sync. The last answer is cached; when the server cannot be reached a Pro answer
//   is honoured for OFFLINE_GRACE_MS so a network blip never switches paid features off.
globalThis.Entitlements = (() => {
  const PRO_FEATURES = ['driveAutoSave'];
  const ACCOUNT_KEY = 'pwm_account_id';
  const CACHE_KEY = 'pwm_entitlement';
  const FRESH_MS = 6 * 3600000;
  const OFFLINE_GRACE_MS = 7 * 86400000;
  const ACCOUNT_RE = /^[0-9a-f]{64}$/;
  let cached = null;

  const apiBase = () => String(globalThis.BillingConfig?.apiBase || '').replace(/\/$/, '');
  const available = () => !!apiBase();

  async function accountId() {
    const stored = (await chrome.storage.sync.get(ACCOUNT_KEY))[ACCOUNT_KEY];
    if (ACCOUNT_RE.test(stored || '')) return stored;
    const id = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    await chrome.storage.sync.set({[ACCOUNT_KEY]: id});
    return id;
  }
  async function setAccountId(id) {
    const value = String(id || '').trim().toLowerCase();
    if (!ACCOUNT_RE.test(value)) throw new Error('invalid id');
    await chrome.storage.sync.set({[ACCOUNT_KEY]: value});
    await chrome.storage.local.remove(CACHE_KEY);
    cached = null;
  }

  async function call(path, init) {
    const response = await fetch(apiBase() + path, {cache: 'no-store', ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || `HTTP ${response.status}`), {status: response.status});
    return body;
  }
  const post = (path, account) => call(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({account})});

  async function fromServer(now) {
    const account = await accountId();
    const remote = await call(`/v1/entitlement?account=${account}`);
    const record = {pro: !!remote.pro, status: remote.status || 'none', until: Number(remote.until) || 0, cancelAtPeriodEnd: !!remote.cancelAtPeriodEnd, checkedAt: now};
    await chrome.storage.local.set({[CACHE_KEY]: record});
    return record;
  }

  async function resolve({force = false, now = Date.now()} = {}) {
    try {
      const self = await chrome.management.getSelf();
      // pwm_billing_live_test lets an unpacked build go through the real purchase check (Stripe test mode).
      const liveTest = (await chrome.storage.local.get('pwm_billing_live_test')).pwm_billing_live_test === true;
      if (self.installType === 'development' && !liveTest) return {pro: true, reason: 'development'};
    } catch {}
    if (!available()) return {pro: false, reason: 'unavailable'};
    const last = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
    if (!force && last && now - last.checkedAt < FRESH_MS) return {...last, reason: last.pro ? 'purchased' : 'not-purchased'};
    try {
      const record = await fromServer(now);
      return {...record, reason: record.pro ? 'purchased' : 'not-purchased'};
    } catch (error) {
      if (last?.pro && now - last.checkedAt < OFFLINE_GRACE_MS) return {...last, reason: 'offline-grace'};
      return {pro: false, status: last?.status || 'none', reason: 'offline', error: error.message};
    }
  }

  async function status(options) {
    if (!cached || options?.force || Date.now() - cached.at > FRESH_MS) cached = {...(await resolve(options)), at: Date.now()};
    return cached;
  }
  async function has(feature) { return PRO_FEATURES.includes(feature) && (await status()).pro; }
  function reset() { cached = null; }
  // A purchase checked on the settings page (or an id carried over) must reach the service worker too.
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if ((area === 'local' && (changes[CACHE_KEY] || changes.pwm_billing_live_test)) || (area === 'sync' && changes[ACCOUNT_KEY])) cached = null;
  });
  const refresh = () => status({force: true});
  async function checkoutUrl() { return (await post('/v1/checkout', await accountId())).url; }
  async function portalUrl() { return (await post('/v1/portal', await accountId())).url; }

  return {PRO_FEATURES, available, accountId, setAccountId, status, has, reset, refresh, checkoutUrl, portalUrl, FRESH_MS, OFFLINE_GRACE_MS};
})();
