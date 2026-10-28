'use strict';
// Asks established users for a Chrome Web Store review, once they have used the dashboard on
// several different days. Non-blocking card; "Later" snoozes, "Don't show again" is permanent,
// "Write a review" opens the store page and never asks again. Shown at most MAX_SHOWN times.
globalThis.ReviewPrompt = (() => {
  const KEY = 'pwm_review';
  const DAY = 86400000;
  const MIN_INSTALL_DAYS = 3, MIN_ACTIVE_DAYS = 5, SNOOZE_DAYS = 14, MAX_SHOWN = 3;

  async function state() {
    const s = (await chrome.storage.local.get(KEY))[KEY] || {};
    return {installedAt: Number(s.installedAt) || Date.now(), days: Array.isArray(s.days) ? s.days : [], snoozeUntil: Number(s.snoozeUntil) || 0, shown: Number(s.shown) || 0, done: !!s.done};
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

  function render(s) {
    const card = document.createElement('section');
    card.id = 'reviewPrompt'; card.className = 'review-prompt'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-labelledby', 'reviewPromptTitle');
    const title = document.createElement('h2'); title.id = 'reviewPromptTitle'; title.className = 'review-prompt__title'; title.textContent = t('reviewTitle');
    const body = document.createElement('p'); body.className = 'review-prompt__body'; body.textContent = t('reviewBody');
    const actions = document.createElement('div'); actions.className = 'review-prompt__actions';
    const button = (id, label, cls) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'btn ' + cls; b.textContent = label; return b; };
    const write = button('reviewWrite', t('reviewWrite'), 'btn--primary');
    const later = button('reviewLater', t('reviewLater'), 'btn--ghost');
    const never = button('reviewNever', t('reviewNever'), 'btn--ghost');
    actions.append(write, later, never); card.append(title, body, actions);
    const close = () => card.remove();
    write.addEventListener('click', async () => {
      s.done = true; await save(s);
      try { await chrome.tabs.create({url: storeUrl(), active: true}); } catch {}
      body.textContent = t('reviewThanks'); actions.remove(); setTimeout(close, 2500);
    });
    later.addEventListener('click', async () => { s.snoozeUntil = Date.now() + SNOOZE_DAYS * DAY; await save(s); close(); });
    never.addEventListener('click', async () => { s.done = true; await save(s); close(); });
    document.body.append(card);
    return card;
  }

  async function maybeShow(now = Date.now()) {
    const s = await recordUse(now);
    if (!shouldShow(s, now)) return false;
    if (document.getElementById('reviewPrompt') || document.querySelector('dialog[open]')) return false;
    s.shown += 1; await save(s);
    render(s);
    return true;
  }
  return {KEY, maybeShow, shouldShow, recordUse, storeUrl, MIN_INSTALL_DAYS, MIN_ACTIVE_DAYS, SNOOZE_DAYS, MAX_SHOWN};
})();

if (typeof document !== 'undefined' && !document.body.classList.contains('sidebar-panel')) {
  setTimeout(() => { ReviewPrompt.maybeShow().catch(() => {}); }, 1500);
}
