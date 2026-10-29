'use strict';
// Which paid (Pro) features this installation may use.
// Until payments exist (PAY-01..05), Pro features are enabled only for development installs
// (unpacked extension), so nothing paid is shipped free to store users.
// PAY-04 will replace `resolve()` with the purchase check, keeping the same interface.
globalThis.Entitlements = (() => {
  const PRO_FEATURES = ['driveAutoSave'];
  let cached = null;
  async function resolve() {
    try {
      const self = await chrome.management.getSelf();
      return {pro: self.installType === 'development', reason: self.installType === 'development' ? 'development' : 'not-purchased'};
    } catch {
      return {pro: false, reason: 'unknown'};
    }
  }
  async function status() { if (!cached) cached = await resolve(); return cached; }
  async function has(feature) { return PRO_FEATURES.includes(feature) && (await status()).pro; }
  function reset() { cached = null; }
  return {PRO_FEATURES, status, has, reset};
})();
