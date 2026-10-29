'use strict';
// Settings card for Pro: buy (Stripe Checkout), check status, manage or cancel, and carry the
// purchase id to another PC. Talks to the billing worker through Entitlements.
(() => {
  const dialog = document.getElementById('settingsDialog');
  if (!dialog) return;
  const section = document.createElement('section');
  section.className = 'ai-settings billing-settings';
  section.innerHTML = `<h3>${t('billingHeading')} <span class="pro-badge">Pro</span></h3>
    <p>${t('billingHelp')}</p>
    <p id="billingStatus" class="billing-status" role="status"></p>
    <div class="billing-actions">
      <button type="button" class="btn" id="billingBuy">${t('billingBuy')}</button>
      <button type="button" class="btn btn--ghost" id="billingCheck">${t('billingCheck')}</button>
      <button type="button" class="btn btn--ghost" id="billingManage">${t('billingManage')}</button>
    </div>
    <p id="billingResult" class="settings-help" role="status"></p>
    <p class="settings-help billing-legal" id="billingLegal">${t('billingLegalNote')}<br>
      <a id="billingTerms" target="_blank" rel="noopener">${t('billingLegalTerms')}</a> ·
      <a id="billingTokushoho" target="_blank" rel="noopener">${t('billingLegalTokushoho')}</a> ·
      <a id="billingPrivacy" target="_blank" rel="noopener">${t('billingLegalPrivacy')}</a></p>
    <details class="billing-id"><summary>${t('billingIdHeading')}</summary>
      <p class="settings-help">${t('billingIdHelp')}</p>
      <div class="billing-id__row"><code id="billingId"></code><button type="button" class="btn btn--ghost" id="billingIdCopy">${t('billingIdCopy')}</button></div>
      <label for="billingIdInput">${t('billingIdRestore')}</label>
      <div class="billing-id__row"><input id="billingIdInput" autocomplete="off" spellcheck="false"><button type="button" class="btn btn--ghost" id="billingIdApply">${t('billingIdApply')}</button></div>
    </details>`;
  const drive = dialog.querySelector('.drive-settings');
  if (drive) drive.after(section); else dialog.append(section);
  const el = id => section.querySelector('#' + id);
  const date = ms => new Date(ms).toLocaleDateString(I18n.current().replace('_', '-'));
  const say = text => { el('billingResult').textContent = text; };
  // Terms, 特商法 and privacy pages are served by the billing worker (built from store/*.md).
  const base = String(globalThis.BillingConfig?.apiBase || '').replace(/\/$/, '');
  const prefix = I18n.current() === 'ja' ? '' : '/en';
  el('billingTerms').href = `${base}${prefix}/terms`;
  el('billingTokushoho').href = `${base}/tokushoho`;
  el('billingPrivacy').href = `${base}${prefix}/privacy`;

  function describe(s) {
    if (s.reason === 'development') return t('billingStatusDev');
    if (s.reason === 'unavailable') return t('billingUnavailable');
    if (s.reason === 'offline' || s.reason === 'offline-grace') return t('billingStatusOffline');
    if (s.status === 'paid') return t('billingStatusPurchased');
    if (s.status === 'refunded') return t('billingStatusRefunded');
    if (s.status === 'past_due') return t('billingStatusPastDue');
    if (s.pro && s.cancelAtPeriodEnd) return t('billingStatusCanceling', [date(s.until)]);
    if (s.pro) return t('billingStatusActive', [date(s.until)]);
    return t('billingStatusFree');
  }
  async function render(force) {
    const s = await (force ? Entitlements.refresh() : Entitlements.status());
    const live = Entitlements.available() && s.reason !== 'development';
    el('billingStatus').textContent = describe(s);
    el('billingBuy').hidden = !live || s.pro;
    el('billingCheck').hidden = !live;
    // Cancel/manage only exists for the earlier monthly plan; a one-time purchase has nothing to manage.
    el('billingManage').hidden = !live || ['none', 'paid', 'refunded'].includes(s.status || 'none');
    section.querySelector('.billing-id').hidden = !live;
    el('billingLegal').hidden = !live;
    if (live) el('billingId').textContent = await Entitlements.accountId();
    return s;
  }
  let awaitingReturn = false;
  async function openFrom(getUrl) {
    say(t('billingOpening'));
    try { await chrome.tabs.create({url: await getUrl()}); awaitingReturn = true; say(t('billingOpened')); }
    catch (error) { say(t('billingError', [error.message])); }
  }
  el('billingBuy').addEventListener('click', () => openFrom(Entitlements.checkoutUrl));
  el('billingManage').addEventListener('click', () => openFrom(Entitlements.portalUrl));
  el('billingCheck').addEventListener('click', async () => {
    say('');
    const s = await render(true);
    if (s.reason === 'offline') say(t('billingError', [s.error || '']));
    window.dispatchEvent(new CustomEvent('pwm-entitlement-changed'));
  });
  el('billingIdCopy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(el('billingId').textContent); say(t('billingIdCopied'));
  });
  el('billingIdApply').addEventListener('click', async () => {
    try { await Entitlements.setAccountId(el('billingIdInput').value); }
    catch { say(t('billingIdInvalid')); return; }
    el('billingIdInput').value = ''; say(t('billingIdApplied'));
    await render(true); window.dispatchEvent(new CustomEvent('pwm-entitlement-changed'));
  });
  // Coming back from the Stripe tab: check right away, then keep checking for a while, because a
  // purchase can take about a minute to reach the server's storage. Stops as soon as Pro shows up.
  const RETURN_CHECKS = 12, RETURN_INTERVAL_MS = 10000;
  let returnTimer = 0;
  async function checkAfterReturn(left) {
    clearTimeout(returnTimer);
    const s = await render(true).catch(() => null);
    window.dispatchEvent(new CustomEvent('pwm-entitlement-changed'));
    if (s && !s.pro && left > 1 && document.visibilityState === 'visible') returnTimer = setTimeout(() => checkAfterReturn(left - 1), RETURN_INTERVAL_MS);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !awaitingReturn) return;
    awaitingReturn = false;
    checkAfterReturn(RETURN_CHECKS);
  });
  dialog.addEventListener('toggle', () => { if (dialog.open) render().catch(() => {}); });
  render().catch(() => {});
})();
