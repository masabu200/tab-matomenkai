'use strict';
// Asks established users how the extension is working for them, then routes them: 4-5 stars are
// invited to rate it on the Chrome Web Store, 1-3 stars are asked what to improve (the store link
// stays available to everyone, so reviews are never gated). The card waits for a finished space
// switch, i.e. a moment when the extension just did its job. "Later" snoozes, "Don't show again"
// is permanent, any star choice ends the prompting. Shown at most MAX_SHOWN times.
// Settings also carries a permanent "Write a review / Send feedback" card (addSettingsCard).
globalThis.ReviewPrompt = (() => {
  const KEY = 'pwm_review';
  const DAY = 86400000;
  const MIN_INSTALL_DAYS = 3, MIN_ACTIVE_DAYS = 5, SNOOZE_DAYS = 14, MAX_SHOWN = 3, HAPPY_MIN = 4;
  const FEEDBACK_EMAIL = 'info@kw-s.jp';

  async function state() {
    const s = (await chrome.storage.local.get(KEY))[KEY] || {};
    return {installedAt: Number(s.installedAt) || Date.now(), days: Array.isArray(s.days) ? s.days : [], snoozeUntil: Number(s.snoozeUntil) || 0, shown: Number(s.shown) || 0, done: !!s.done, rating: Number(s.rating) || 0};
  }
  const save = s => chrome.storage.local.set({[KEY]: s});

  // Records that the dashboard was used today (distinct days drive the trigger, not actions).
  async function recordUse(now = Date.now()) {
    const s = await state();
    const today = new Date(now).toISOString().slice(0, 10);
    if (!s.days.includes(today)) s.days = [...s.days, today].slice(-60);
    await save(s);
    return s;
  }
  function shouldShow(s, now = Date.now()) {
    return !s.done && s.shown < MAX_SHOWN && now - s.installedAt >= MIN_INSTALL_DAYS * DAY && s.days.length >= MIN_ACTIVE_DAYS && now >= s.snoozeUntil;
  }
  // For store installs chrome.runtime.id is the store item ID.
  const storeUrl = () => `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
  function feedbackUrl(rating) {
    const version = chrome.runtime.getManifest().version;
    const subject = `${t('appName')} ${version} feedback` + (rating ? ` (${rating}/5)` : '');
    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`;
  }
  const openStore = async () => { try { await chrome.tabs.create({url: storeUrl(), active: true}); } catch {} };

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (id, label, cls) => { const b = el('button', 'btn ' + cls, label); b.type = 'button'; b.id = id; return b; };
  function link(id, label, href, cls) { const a = el('a', 'btn ' + cls, label); a.id = id; a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }

  function render(s) {
    const card = el('section', 'review-prompt');
    card.id = 'reviewPrompt'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-labelledby', 'reviewPromptTitle');
    const dismiss = button('reviewClose', '×', 'review-prompt__close'); dismiss.setAttribute('aria-label', t('reviewLater'));
    const title = el('h2', 'review-prompt__title', t('reviewAskTitle')); title.id = 'reviewPromptTitle';
    const body = el('p', 'review-prompt__body', t('reviewAskBody'));
    const stars = el('div', 'review-stars'); stars.setAttribute('role', 'radiogroup'); stars.setAttribute('aria-label', t('reviewAskTitle'));
    const actions = el('div', 'review-prompt__actions');
    const close = () => card.remove();
    const snooze = async () => { s.snoozeUntil = Date.now() + SNOOZE_DAYS * DAY; await save(s); close(); };

    for (let n = 1; n <= 5; n++) {
      const star = button('reviewStar' + n, '★', 'review-star'); star.setAttribute('role', 'radio'); star.setAttribute('aria-checked', 'false');
      star.setAttribute('aria-label', t('reviewStarLabel', [String(n)])); star.dataset.n = n;
      star.addEventListener('mouseenter', () => paint(n)); star.addEventListener('focus', () => paint(n));
      star.addEventListener('click', () => choose(n));
      stars.append(star);
    }
    stars.addEventListener('mouseleave', () => paint(0));
    function paint(n) { for (const b of stars.children) b.classList.toggle('is-on', Number(b.dataset.n) <= n); }

    const later = button('reviewLater', t('reviewLater'), 'btn--ghost');
    const never = button('reviewNever', t('reviewNever'), 'btn--ghost');
    actions.append(later, never);
    later.addEventListener('click', snooze); dismiss.addEventListener('click', snooze);
    never.addEventListener('click', async () => { s.done = true; await save(s); close(); });

    // Step 2: route by rating. Choosing a rating ends prompting either way.
    async function choose(n) {
      s.rating = n; s.done = true; await save(s);
      paint(n); for (const b of stars.children) { b.disabled = true; b.setAttribute('aria-checked', String(Number(b.dataset.n) === n)); }
      actions.replaceChildren();
      if (n >= HAPPY_MIN) {
        title.textContent = t('reviewHappyTitle'); body.textContent = t('reviewHappyBody');
        const write = button('reviewWrite', t('reviewWrite'), 'btn--primary');
        const notNow = button('reviewNotNow', t('reviewNotNow'), 'btn--ghost');
        write.addEventListener('click', async () => { await openStore(); thanks(); });
        notNow.addEventListener('click', close);
        actions.append(write, notNow); write.focus();
      } else {
        title.textContent = t('reviewSadTitle'); body.textContent = t('reviewSadBody');
        const send = link('reviewFeedback', t('reviewFeedback'), feedbackUrl(n), 'btn--primary');
        const store = button('reviewWrite', t('reviewWriteAnyway'), 'btn--ghost');
        send.addEventListener('click', () => thanks());
        store.addEventListener('click', async () => { await openStore(); thanks(); });
        actions.append(send, store); send.focus();
      }
    }
    function thanks() { stars.remove(); title.textContent = t('reviewThanks'); body.textContent = t('reviewThanksBody'); actions.remove(); setTimeout(close, 2500); }

    card.append(dismiss, title, body, stars, actions);
    document.body.append(card);
    requestAnimationFrame(() => card.classList.add('is-in'));
    return card;
  }

  async function maybeShow(now = Date.now()) {
    const s = await state();
    if (!shouldShow(s, now)) return false;
    if (document.getElementById('reviewPrompt') || document.querySelector('dialog[open]')) return false;
    s.shown += 1; await save(s);
    render(s);
    return true;
  }

  // Permanent entry in Settings: rate on the store, or send feedback. Always available.
  function addSettingsCard() {
    const dialog = document.getElementById('settingsDialog');
    if (!dialog || document.getElementById('reviewSettings')) return;
    const section = el('section', 'review-settings'); section.id = 'reviewSettings';
    const write = button('reviewSettingsWrite', '★ ' + t('reviewWrite'), 'btn--primary');
    write.addEventListener('click', openStore);
    section.append(el('h3', '', t('reviewSettingsHeading')), el('p', 'settings-help', t('reviewSettingsHelp')), write,
      link('reviewSettingsFeedback', t('reviewFeedback'), feedbackUrl(0), 'btn--ghost'));
    dialog.append(section);
    globalThis.SettingsLayout?.layout();
  }

  return {KEY, maybeShow, shouldShow, recordUse, storeUrl, feedbackUrl, addSettingsCard, MIN_INSTALL_DAYS, MIN_ACTIVE_DAYS, SNOOZE_DAYS, MAX_SHOWN, HAPPY_MIN};
})();

if (typeof document !== 'undefined') {
  ReviewPrompt.recordUse().catch(() => {});
  ReviewPrompt.addSettingsCard();
  // Wait for a successful space switch, then let the new tabs settle before asking.
  window.addEventListener('pwm-space-switched', () => { setTimeout(() => { ReviewPrompt.maybeShow().catch(() => {}); }, 1200); });
}
