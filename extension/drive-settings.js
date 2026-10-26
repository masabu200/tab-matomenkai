'use strict';
(() => {
  const section = document.createElement('section');
  section.className = 'ai-settings drive-settings';
  section.innerHTML = `<h3>Googleドライブにバックアップ</h3>
    <p>保存済みのスペース・カテゴリー・タブを、マイドライブに日時付きのJSONで保存します。</p>
    <details><summary>初回の接続設定</summary>
      <p>Google CloudでDrive APIを有効にし、OAuthクライアント（ウェブアプリケーション）を作成してください。承認済みリダイレクトURIには次のURLを登録します。</p>
      <label for="driveRedirect">リダイレクトURI</label><input id="driveRedirect" readonly>
      <label for="driveClientId">OAuthクライアントID</label><input id="driveClientId" placeholder="…apps.googleusercontent.com" autocomplete="off">
      <p>クライアントシークレットは不要です。テスト公開の場合は、利用するGoogleアカウントをテストユーザーに登録してください。</p>
    </details>
    <button type="button" class="btn btn--ghost" id="driveConnect">Googleドライブに接続</button>
    <button type="button" class="btn btn--ghost" id="driveSave">今すぐバックアップ</button>
    <button type="button" class="btn btn--ghost" id="driveDisconnect">このブラウザの接続を解除</button>
    <p id="driveStatus" role="status">未接続</p><p id="driveLastBackup"></p>`;
  document.getElementById('settingsDialog').append(section);
  const el = id => section.querySelector('#'+id);
  el('driveRedirect').value = chrome.identity.getRedirectURL('drive');
  async function refresh() {
    const stored = await chrome.storage.local.get(['pwm_drive_client_id','pwm_drive_last_backup']);
    if (!el('driveClientId').value) el('driveClientId').value = stored.pwm_drive_client_id || '';
    const last = stored.pwm_drive_last_backup;
    el('driveLastBackup').replaceChildren();
    if (last && /^[\w-]+$/.test(last.id)) {
      const link = document.createElement('a');link.href = `https://drive.google.com/file/d/${last.id}/view`;link.target='_blank';link.rel='noopener noreferrer';
      link.textContent = '前回のバックアップを開く';
      el('driveLastBackup').append(document.createTextNode(`最終保存：${new Date(last.exportedAt).toLocaleString('ja-JP')} `),link);
    }
  }
  let busy=false;
  function action(id, fn) {el(id).addEventListener('click',async()=>{
    if(busy)return;busy=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);el('driveStatus').textContent='処理中…';
    try {await fn();await refresh();}catch(error){el('driveStatus').textContent=error.message;}
    finally{busy=false;section.querySelectorAll('button').forEach(b=>b.disabled=false);}
  });}
  action('driveConnect',async()=>{await DriveBackup.connect(el('driveClientId').value.trim());el('driveStatus').textContent='接続しました。バックアップを保存できます。';section.querySelector('details').open=false;});
  action('driveSave',async()=>{const data=await loadData();await DriveBackup.save(data,getActiveSpaceId(data));el('driveStatus').textContent='Googleドライブにバックアップを保存しました。';});
  action('driveDisconnect',async()=>{await DriveBackup.disconnect();el('driveStatus').textContent='このブラウザの接続を解除しました。保存済みのファイルは残ります。';});
  refresh().then(async()=>{try{await DriveBackup.auth();el('driveStatus').textContent='接続中';}catch{}}).catch(()=>{el('driveStatus').textContent='設定を読み込めませんでした。画面を開き直してください。';});
})();
