'use strict';
// Session-only authorization. Backups contain workspace data, never credentials.
globalThis.DriveBackup = (() => {
  const scope = 'https://www.googleapis.com/auth/drive.file';
  const sessionKey = 'pwm_drive_auth';
  async function connect(clientId) {
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw Error('OAuthクライアントIDを入力してください。');
    const redirect = chrome.identity.getRedirectURL('drive');
    const state = crypto.randomUUID();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({client_id:clientId, redirect_uri:redirect, response_type:'token', scope, state, prompt:'select_account consent'});
    const response = await chrome.identity.launchWebAuthFlow({url:url.href, interactive:true});
    if (!response) throw Error('接続がキャンセルされました。');
    const callback = new URL(response);
    if (callback.origin + callback.pathname !== redirect) throw Error('認証の戻り先が一致しません。');
    const params = new URLSearchParams(callback.hash.slice(1));
    if (params.get('state') !== state) throw Error('認証を確認できません。もう一度接続してください。');
    if (params.has('error')) throw Error('Googleへのアクセスが許可されませんでした。');
    const token = params.get('access_token');
    const seconds = Number(params.get('expires_in'));
    if (!token || !Number.isFinite(seconds) || seconds <= 0 || !params.get('scope')?.split(' ').includes(scope)) throw Error('バックアップの保存権限を確認できません。');
    await chrome.storage.session.set({[sessionKey]:{token, expiresAt:Date.now() + seconds*1000}});
    await chrome.storage.local.set({pwm_drive_client_id:clientId});
  }
  async function auth() {
    const value = (await chrome.storage.session.get(sessionKey))[sessionKey];
    if (!value || value.expiresAt < Date.now()+30000) throw Error('Googleドライブに接続してください。接続期限が切れた場合は再接続が必要です。');
    return value;
  }
  async function disconnect() { await chrome.storage.session.remove(sessionKey); }
  async function save(data, activeSpaceId) {
    return navigator.locks.request('pwm-drive-backup', {ifAvailable:true}, async lock => {
      if (!lock) throw Error('別の画面でバックアップを保存中です。');
      const credentials = await auth();
      const exportedAt = new Date().toISOString();
      const backup = {version:1, exportedAt, activeSpaceId, categories:data.categories || [], spaces:data.spaces || []};
      validateBackup(backup);
      const name = 'タブまとめん改_' + exportedAt.replace(/[:.]/g,'-') + '.json';
      const boundary = 'pwm_' + crypto.randomUUID();
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name,mimeType:'application/json'})}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(backup,null,2)}\r\n--${boundary}--`;
      let response;
      try {
        response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
          method:'POST', headers:{Authorization:`Bearer ${credentials.token}`, 'Content-Type':`multipart/related; boundary=${boundary}`},body,signal:AbortSignal.timeout(60000)
        });
      } catch { throw Error('保存結果を確認できませんでした。再試行する前にGoogleドライブを確認してください。'); }
      if (response.status === 401) {await disconnect(); throw Error('接続期限が切れました。Googleドライブに再接続してください。');}
      if (!response.ok) throw Error(`保存できませんでした（${response.status}）。Google Drive APIの有効化・保存権限・空き容量を確認してください。`);
      const file = await response.json();
      if (!/^[\w-]+$/.test(file.id || '')) throw Error('保存先を確認できませんでした。Googleドライブを確認してください。');
      const result = {id:file.id,name,exportedAt,url:`https://drive.google.com/file/d/${file.id}/view`};
      await chrome.storage.local.set({pwm_drive_last_backup:result});
      return result;
    });
  }
  return {connect,auth,disconnect,save};
})();
