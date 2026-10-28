'use strict';
// Settings UI for AutoClean: period, action, run now, last result, trash with restore.
(() => {
  const dialog = document.getElementById('settingsDialog');
  if (!dialog) return;
  const section = document.createElement('section');
  section.className = 'ai-settings auto-clean-settings';
  section.innerHTML = `<h3>${t('autoCleanHeading')}</h3>
    <p>${t('autoCleanHelp')}</p>
    <div class="auto-clean-row"><label for="autoCleanDays">${t('autoCleanPeriodLabel')}</label><select id="autoCleanDays"></select></div>
    <div class="auto-clean-row"><label for="autoCleanAction">${t('autoCleanActionLabel')}</label><select id="autoCleanAction"><option value="archive">${t('autoCleanActionArchive')}</option><option value="delete">${t('autoCleanActionDelete')}</option></select></div>
    <p class="settings-help">${t('autoCleanExclusions')}</p>
    <button type="button" class="btn btn--ghost" id="autoCleanRun">${t('autoCleanRunNow')}</button>
    <p id="autoCleanStatus" role="status"></p><p id="autoCleanLast" class="settings-help"></p>
    <div class="auto-clean-trash"><h4>${t('autoCleanTrashHeading', [AutoClean.TRASH_DAYS])}</h4><ul id="autoCleanTrash" class="auto-clean-trash__list"></ul></div>`;
  const drive = dialog.querySelector('.drive-settings');
  if (drive) dialog.insertBefore(section, drive); else dialog.append(section);
  const el = id => section.querySelector('#' + id);
  const days = el('autoCleanDays');
  days.append(new Option(t('m_17b500293e'), '0'));
  for (const d of AutoClean.PERIODS.filter(Boolean)) days.append(new Option(t('autoCleanDaysOption', [d]), String(d)));
  const locale = () => I18n.current().replace('_', '-');
  const when = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(locale()); };

  async function load() {
    const settings = AutoClean.settingsOf(((await chrome.storage.local.get('pwm_settings')).pwm_settings) || {});
    days.value = String(settings.days); el('autoCleanAction').value = settings.action;
    const last = await AutoClean.lastResult();
    el('autoCleanLast').textContent = last ? t('autoCleanLastResult', [when(last.at), last.archived, last.deleted]) : '';
    await renderTrash();
  }
  async function renderTrash() {
    const list = el('autoCleanTrash'); list.replaceChildren();
    const trash = await AutoClean.listTrash();
    if (!trash.length) { const li = document.createElement('li'); li.className = 'auto-clean-trash__empty'; li.textContent = t('autoCleanTrashEmpty'); list.append(li); return; }
    for (const entry of trash) {
      const li = document.createElement('li');
      const text = document.createElement('span'); text.textContent = t('autoCleanTrashItem', [entry.space.name, (entry.space.tabs || []).length, when(entry.deletedAt)]);
      const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'btn btn--ghost'; restore.textContent = t('m_442ee7eb76'); restore.dataset.spaceId = entry.space.id;
      restore.addEventListener('click', async () => {
        restore.disabled = true;
        try { const space = await AutoClean.restoreFromTrash(entry.space.id); if (space) { el('autoCleanStatus').textContent = t('autoCleanRestored', [space.name]); if (typeof renderAll === 'function') await renderAll(); } }
        catch (error) { el('autoCleanStatus').textContent = error.message; }
        await renderTrash();
      });
      li.append(text, restore); list.append(li);
    }
  }
  async function saveSettings() {
    const cur = ((await chrome.storage.local.get('pwm_settings')).pwm_settings) || {};
    await chrome.storage.local.set({pwm_settings: {...cur, autoCleanDays: Number(days.value), autoCleanAction: el('autoCleanAction').value}});
  }
  days.addEventListener('change', saveSettings);
  el('autoCleanAction').addEventListener('change', saveSettings);
  el('autoCleanRun').addEventListener('click', async () => {
    const button = el('autoCleanRun'); button.disabled = true; el('autoCleanStatus').textContent = t('m_f11b0168dc');
    try {
      if (Number(days.value) === 0) { el('autoCleanStatus').textContent = t('autoCleanOffHint'); return; }
      const result = await AutoClean.run();
      el('autoCleanStatus').textContent = t('autoCleanRunResult', [result.archived, result.deleted]);
      if (typeof renderAll === 'function') await renderAll();
      await renderTrash();
    } catch (error) { el('autoCleanStatus').textContent = error.message; }
    finally { button.disabled = false; }
  });
  load().catch(() => {});
  // Keep the list current when the dialog is reopened or another context changes the data.
  new MutationObserver(() => { if (dialog.open) load().catch(() => {}); }).observe(dialog, {attributes: true, attributeFilter: ['open']});
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.pwm_trash || changes.pwm_auto_clean_last || changes.pwm_settings)) load().catch(() => {}); });
})();
