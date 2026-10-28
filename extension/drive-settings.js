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
    <p id="driveStatus" role="status">${t('m_7ea46c0315')}</p><p id="driveLastBackup"></p>`;
  document.getElementById('settingsDialog').append(section);
  const el = id => section.querySelector('#'+id);
  el('driveRedirect').value = chrome.identity.getRedirectURL('drive');
  const builtin = DriveBackup.mode() === 'builtin';
  el('driveBuiltinHelp').hidden = !builtin;
  el('driveManualSetup').hidden = builtin;
  async function refresh() {
    const stored = await chrome.storage.local.get(['pwm_drive_client_id','pwm_drive_last_backup']);
    if (!el('driveClientId').value) el('driveClientId').value = stored.pwm_drive_client_id || '';
    const last = stored.pwm_drive_last_backup;
    el('driveLastBackup').replaceChildren();
    if (last && /^[\w-]+$/.test(last.id)) {
      const link = document.createElement('a');link.href = `https://drive.google.com/file/d/${last.id}/view`;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent = t('m_c64f38ecfa');
      el('driveLastBackup').append(document.createTextNode(t('m_81d7efe6b9', [new Date(last.exportedAt).toLocaleString(I18n.current().replace('_','-'))])),link);
    }
  }
  let busy=false;
  function action(id, fn) {el(id).addEventListener('click',async()=>{
    if(busy)return;busy=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);el('driveStatus').textContent=t('m_f11b0168dc');
    try {await fn();await refresh();}catch(error){el('driveStatus').textContent=error.message;}
    finally{busy=false;section.querySelectorAll('button').forEach(b=>b.disabled=false);}
  });}
  action('driveConnect',async()=>{if(builtin)el('driveStatus').textContent=t('driveAuthWaiting');await DriveBackup.connect(builtin?null:el('driveClientId').value.trim());el('driveStatus').textContent=t('m_e873b731b1');section.querySelector('details').open=false;});
  action('driveSave',async()=>{const data=await loadData();await DriveBackup.save(data,getActiveSpaceId(data));el('driveStatus').textContent=t('m_f714e3e49d');});
  action('driveDisconnect',async()=>{await DriveBackup.disconnect();el('driveStatus').textContent=t('m_307c18ccd9');});
  refresh().then(async()=>{try{await DriveBackup.auth();el('driveStatus').textContent=t('m_23e782bfe8');}catch{}}).catch(()=>{el('driveStatus').textContent=t('m_26a4745b1e');});
})();
