'use strict';
// Backups contain workspace data, never credentials.
// Two connection modes:
//  - builtin: manifest.json has an `oauth2` client (type "Chrome Extension"). Chrome's
//    identity.getAuthToken mints and silently renews tokens; nothing is stored by us.
//  - manual: the user supplies their own web-application client ID (development / non-Chrome).
//    The implicit-flow token lives only in chrome.storage.session and is renewed with a
//    silent (prompt=none) launchWebAuthFlow when possible.
globalThis.DriveBackup = (() => {
  const scope = 'https://www.googleapis.com/auth/drive.file';
  const sessionKey = 'pwm_drive_auth';
  const connectedKey = 'pwm_drive_connected';

  function mode() {
    const manifest = chrome.runtime.getManifest();
    const builtin = typeof manifest.oauth2?.client_id === 'string' && manifest.oauth2.client_id.endsWith('.apps.googleusercontent.com') && typeof chrome.identity?.getAuthToken === 'function';
    return builtin ? 'builtin' : 'manual';
  }

  // ---------- builtin (chrome.identity.getAuthToken) ----------
  const AUTH_TIMEOUT_MS = 120000;
  async function builtinToken(interactive) {
    let result;
    try {
      const request = chrome.identity.getAuthToken({interactive, scopes:[scope]});
      result = interactive
        ? await Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(Error(t('driveAuthTimeout'))), AUTH_TIMEOUT_MS))])
        : await request;
    }
    catch (error) {
      if (error?.message === t('driveAuthTimeout')) throw error; throw Error(interactive ? t('m_9e9943aa18') + (error?.message ? `（${error.message}）` : '') : t('m_1b162ecb08')); }
    const token = typeof result === 'string' ? result : result?.token;
    const granted = typeof result === 'string' ? [scope] : (result?.grantedScopes || [scope]);
    if (!token) throw Error(interactive ? t('m_9e9943aa18') : t('m_1b162ecb08'));
    if (!granted.includes(scope)) throw Error(t('m_38e08f6f72'));
    return token;
  }

  // ---------- manual (user-supplied client ID, implicit flow) ----------
  function authUrl(clientId, redirect, state, silent) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({client_id:clientId, redirect_uri:redirect, response_type:'token', scope, state, prompt: silent ? 'none' : 'select_account consent'});
    return url.href;
  }
  function parseCallback(response, redirect, state) {
    if (!response) throw Error(t('m_063e83e937'));
    const callback = new URL(response);
    if (callback.origin + callback.pathname !== redirect) throw Error(t('m_cbe501233e'));
    const params = new URLSearchParams(callback.hash.slice(1));
    if (params.get('state') !== state) throw Error(t('m_195c611c2a'));
    if (params.has('error')) throw Error(t('m_9e9943aa18'));
    const token = params.get('access_token');
    const seconds = Number(params.get('expires_in'));
    if (!token || !Number.isFinite(seconds) || seconds <= 0 || !params.get('scope')?.split(' ').includes(scope)) throw Error(t('m_38e08f6f72'));
    return {token, expiresAt: Date.now() + seconds*1000};
  }
  async function manualFlow(clientId, silent) {
    const redirect = chrome.identity.getRedirectURL('drive');
    const state = crypto.randomUUID();
    const response = await chrome.identity.launchWebAuthFlow({url: authUrl(clientId, redirect, state, silent), interactive: !silent});
    const value = parseCallback(response, redirect, state);
    await chrome.storage.session.set({[sessionKey]: value});
    return value;
  }

  // ---------- public ----------
  async function connect(clientId) {
    if (mode() === 'builtin') {
      await builtinToken(true);
      await chrome.storage.local.set({[connectedKey]: true});
      return;
    }
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId || '')) throw Error(t('m_210231350f'));
    await manualFlow(clientId, false);
    await chrome.storage.local.set({pwm_drive_client_id: clientId, [connectedKey]: true});
  }

  // Returns {token}. Renews silently when it can; otherwise asks the user to reconnect.
  async function auth() {
    if (mode() === 'builtin') {
      const connected = (await chrome.storage.local.get(connectedKey))[connectedKey];
      if (!connected) throw Error(t('m_1b162ecb08'));
      return {token: await builtinToken(false)};
    }
    const value = (await chrome.storage.session.get(sessionKey))[sessionKey];
    if (value && value.expiresAt >= Date.now() + 30000) return value;
    const clientId = (await chrome.storage.local.get('pwm_drive_client_id')).pwm_drive_client_id;
    if (clientId) {
      try { return await manualFlow(clientId, true); } catch { /* fall through to the reconnect message */ }
    }
    throw Error(t('m_27298d6197'));
  }

  async function disconnect() {
    await chrome.storage.session.remove(sessionKey);
    await chrome.storage.local.remove(connectedKey);
    if (mode() === 'builtin') {
      try {
        const result = await chrome.identity.getAuthToken({interactive:false, scopes:[scope]});
        const token = typeof result === 'string' ? result : result?.token;
        if (token) await chrome.identity.removeCachedAuthToken({token});
      } catch { /* nothing cached */ }
    }
  }

  async function invalidate(token) {
    if (mode() === 'builtin') { try { await chrome.identity.removeCachedAuthToken({token}); } catch {} }
    else await chrome.storage.session.remove(sessionKey);
  }

  async function save(data, activeSpaceId) {
    return navigator.locks.request('pwm-drive-backup', {ifAvailable:true}, async lock => {
      if (!lock) throw Error(t('m_76e8f9b19a'));
      const credentials = await auth();
      const exportedAt = new Date().toISOString();
      const backup = {version:1, exportedAt, activeSpaceId, categories:data.categories || [], spaces:data.spaces || []};
      validateBackup(backup);
      const name = t('m_c62a99397a') + exportedAt.replace(/[:.]/g,'-') + '.json';
      const boundary = 'pwm_' + crypto.randomUUID();
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name,mimeType:'application/json'})}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(backup,null,2)}\r\n--${boundary}--`;
      let response;
      try {
        response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
          method:'POST', headers:{Authorization:`Bearer ${credentials.token}`, 'Content-Type':`multipart/related; boundary=${boundary}`},body,signal:AbortSignal.timeout(60000)
        });
      } catch { throw Error(t('m_551f37d20f')); }
      if (response.status === 401) {await invalidate(credentials.token); throw Error(t('m_6d2d7cf526'));}
      if (!response.ok) throw Error(t('m_e5be1db2f7', [response.status]));
      const file = await response.json();
      if (!/^[\w-]+$/.test(file.id || '')) throw Error(t('m_fd067b945c'));
      const result = {id:file.id,name,exportedAt,url:`https://drive.google.com/file/d/${file.id}/view`};
      await chrome.storage.local.set({pwm_drive_last_backup:result});
      return result;
    });
  }
  return {mode,connect,auth,disconnect,save};
})();
