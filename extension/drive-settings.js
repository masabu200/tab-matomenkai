'use strict';
(() => {
  const section = document.createElement('section');
  section.className = 'ai-settings drive-settings';
  section.innerHTML = `<h3>${t('m_e756be4d47')}</h3>
    <p>${t('m_5ea424f93b')}</p>
    <p id="driveBuiltinHelp" hidden>${t('m_6b5763bf71')}</p>
    <details id="driveManualSetup"><summary>${t('m_7b5914be86')}</summary>
      <p>${t('m_e6720a68da')}</p>
      <label for="driveRedirect">${t('m_f5da3ecf70')}</label><input id="driveRedirect" readonly>
      <label for="driveClientId">${t('m_d80926d454')}</label><input id="driveClientId" placeholder="…apps.googleusercontent.com" autocomplete="off">
      <p>${t('m_dc59c3eb54')}</p>
    </details>
    <button type="button" class="btn btn--ghost" id="driveConnect">${t('m_a8a3126796')}</button>
    <button type="button" class="btn btn--ghost" id="driveSave">${t('m_4c23d9e46d')}</button>
    <button type="button" class="btn btn--ghost" id="driveDisconnect">${t('m_4d138770f9')}</button>
    <p id="driveStatus" role="status">${t('m_7ea46c0315')}</p><p id="driveLastBackup"></p>
    <div class="drive-keep"><label for="driveKeep">${t('driveKeepLabel')}</label>
      <select id="driveKeep"><option value="10">10</option><option value="30">30</option><option value="100">100</option><option value="0">${t('driveKeepUnlimited')}</option></select></div>
    <div class="drive-history">
      <div class="drive-history__bar"><button type="button" class="btn btn--ghost" id="driveRefresh">${t('driveRefreshList')}</button><a id="driveFolderLink" target="_blank" rel="noopener noreferrer" hidden>${t('driveOpenFolder')}</a></div>
      <select id="driveBackups" size="5" aria-label="${t('driveRefreshList')}"></select>
      <button type="button" class="btn btn--ghost" id="driveRestore">${t('driveRestoreButton')}</button>
      <button type="button" class="btn btn--ghost" id="driveRestoreUndo" hidden>${t('driveRestoreUndo')}</button>
    </div>`;
  document.getElementById('settingsDialog').append(section);
  const el = id => section.querySelector('#'+id);
  let setupError = '';
  try { el('driveRedirect').value = chrome.identity.getRedirectURL('drive'); }
  catch (error) { setupError = error?.message || String(error); }
  let builtin = false;
  try { builtin = DriveBackup.mode() === 'builtin'; }
  catch (error) { setupError = setupError || error?.message || String(error); }
  el('driveBuiltinHelp').hidden = !builtin;
  el('driveManualSetup').hidden = builtin;
  const hasOauth2 = !!chrome.runtime.getManifest().oauth2;
  if (!builtin && hasOauth2) setupError = setupError || t('driveIdentityUnavailable');

  const locale = () => I18n.current().replace('_','-');
  const formatWhen = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(locale()); };
  async function refresh() {
    const stored = await chrome.storage.local.get(['pwm_drive_client_id','pwm_drive_last_backup','pwm_drive_restore_undo']);
    if (!el('driveClientId').value) el('driveClientId').value = stored.pwm_drive_client_id || '';
    const last = stored.pwm_drive_last_backup;
    el('driveLastBackup').replaceChildren();
    if (last && /^[\w-]+$/.test(last.id)) {
      const link = document.createElement('a');link.href = `https://drive.google.com/file/d/${last.id}/view`;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent = t('m_c64f38ecfa');
      el('driveLastBackup').append(document.createTextNode(t('m_81d7efe6b9', [formatWhen(last.exportedAt)])),link);
    }
    const folder = await DriveBackup.folderUrl();
    el('driveFolderLink').hidden = !folder; if (folder) el('driveFolderLink').href = folder;
    el('driveKeep').value = String(await DriveBackup.keepCount());
    if (![...el('driveKeep').options].some(o => o.selected)) el('driveKeep').value = String(DriveBackup.DEFAULT_KEEP);
    el('driveRestoreUndo').hidden = !stored.pwm_drive_restore_undo;
  }
  function renderBackups(files) {
    const select = el('driveBackups'); select.replaceChildren();
    if (!files.length) { select.append(new Option(t('driveBackupsEmpty'), '')); select.options[0].disabled = true; return; }
    for (const f of files) {
      const p = f.appProperties || {};
      select.append(new Option(t('driveBackupItem', [formatWhen(p.exportedAt || f.createdTime), p.spaces ?? '?', p.categories ?? '?']), f.id));
    }
  }
  let busy=false;
  function action(id, fn) {el(id).addEventListener('click',async()=>{
    if(busy)return;busy=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);el('driveStatus').textContent=t('m_f11b0168dc');
    try {await fn();await refresh();}catch(error){el('driveStatus').textContent=error.message;}
    finally{busy=false;section.querySelectorAll('button').forEach(b=>b.disabled=false);}
  });}
  action('driveConnect',async()=>{if(builtin)el('driveStatus').textContent=t('driveAuthWaiting');await DriveBackup.connect(builtin?null:el('driveClientId').value.trim());el('driveStatus').textContent=t('m_e873b731b1');section.querySelector('details').open=false;});
  action('driveSave',async()=>{const data=await loadData();const result=await DriveBackup.save(data,getActiveSpaceId(data));el('driveStatus').textContent=result.pruned?t('driveSavedPruned',[result.pruned]):t('m_f714e3e49d');try{renderBackups(await DriveBackup.listBackups());}catch{}});
  action('driveDisconnect',async()=>{await DriveBackup.disconnect();el('driveStatus').textContent=t('m_307c18ccd9');renderBackups([]);});
  action('driveRefresh',async()=>{renderBackups(await DriveBackup.listBackups());el('driveStatus').textContent=t('m_23e782bfe8');});
  action('driveRestore',async()=>{
    const id=el('driveBackups').value;
    if(!id){el('driveStatus').textContent=t('driveSelectBackup');return;}
    const parsed=await DriveBackup.download(id);
    const spaces=parsed.spaces.length, categories=Array.isArray(parsed.categories)?parsed.categories.length:0;
    const label=el('driveBackups').selectedOptions[0]?.textContent||'';
    if(!await DashboardDialogs.open(t('driveRestoreConfirm',[label,spaces,categories]))){el('driveStatus').textContent=t('m_23e782bfe8');return;}
    const current=await loadData();
    await chrome.storage.local.set({pwm_drive_restore_undo:{at:new Date().toISOString(),data:{version:1,exportedAt:new Date().toISOString(),activeSpaceId:getActiveSpaceId(current),categories:current.categories||[],spaces:current.spaces||[],windowActiveSpaces:current.windowActiveSpaces||{}}}});
    const counts=await applyBackupData(parsed);
    el('driveStatus').textContent=t('driveRestoreDone',[counts.spaces,counts.categories]);
  });
  action('driveRestoreUndo',async()=>{
    const undo=(await chrome.storage.local.get('pwm_drive_restore_undo')).pwm_drive_restore_undo;
    if(!undo?.data){el('driveStatus').textContent=t('m_62157d9463');return;}
    await applyBackupData(validateBackup(undo.data));
    await chrome.storage.local.remove('pwm_drive_restore_undo');
    el('driveStatus').textContent=t('driveRestoreUndone');
  });
  el('driveKeep').addEventListener('change',async()=>{await DriveBackup.setKeepCount(el('driveKeep').value);});
  refresh().then(async()=>{if(setupError){el('driveStatus').textContent=setupError;return}try{await DriveBackup.auth();el('driveStatus').textContent=t('m_23e782bfe8');renderBackups(await DriveBackup.listBackups());}catch{renderBackups([]);}}).catch(()=>{el('driveStatus').textContent=t('m_26a4745b1e');});
})();
