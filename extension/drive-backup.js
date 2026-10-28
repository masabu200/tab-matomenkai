'use strict';
// Backups contain workspace data, never credentials.
// Two connection modes:
//  - builtin: manifest.json has an `oauth2` client (type "Chrome Extension"). Chrome's
//    identity.getAuthToken mints and silently renews tokens; nothing is stored by us.
//  - manual: the user supplies their own web-application client ID (development / non-Chrome).
//    The implicit-flow token lives only in chrome.storage.session and is renewed with a
//    silent (prompt=none) launchWebAuthFlow when possible.
// Files go into a dedicated folder (appProperties pwm=folder); each backup is a new file
// tagged appProperties pwm=backup, and older ones beyond the keep count are deleted.
globalThis.DriveBackup = (() => {
  const scope = 'https://www.googleapis.com/auth/drive.file';
  const API = 'https://www.googleapis.com/drive/v3';
  const sessionKey = 'pwm_drive_auth';
  const connectedKey = 'pwm_drive_connected';
  const folderKey = 'pwm_drive_folder_id';
  const DEFAULT_KEEP = 30;
  const safeId = id => /^[\w-]+$/.test(id || '');

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
      if (error?.message === t('driveAuthTimeout')) throw error;
      throw Error(interactive ? t('m_9e9943aa18') + (error?.message ? `（${error.message}）` : '') : t('m_1b162ecb08'));
    }
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

  // ---------- connection ----------
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

  // ---------- Drive API helpers ----------
  async function api(path, init, token) {
    let response;
    try {
      response = await fetch(API + path, {...init, headers: {Authorization: `Bearer ${token}`, ...(init?.headers || {})}, signal: AbortSignal.timeout(30000)});
    } catch { throw Error(t('m_551f37d20f')); }
    if (response.status === 401) { await invalidate(token); throw Error(t('m_6d2d7cf526')); }
    return response;
  }
  const q = s => encodeURIComponent(s);
  async function ensureFolder(token) {
    const cached = (await chrome.storage.local.get(folderKey))[folderKey];
    if (safeId(cached)) {
      const check = await api(`/files/${cached}?fields=id,trashed`, {}, token);
      if (check.ok) { const f = await check.json(); if (!f.trashed) return cached; }
    }
    const found = await api(`/files?q=${q("mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='pwm' and value='folder' }")}&fields=files(id)&pageSize=1`, {}, token);
    if (found.ok) {
      const {files} = await found.json();
      if (safeId(files?.[0]?.id)) { await chrome.storage.local.set({[folderKey]: files[0].id}); return files[0].id; }
    }
    const created = await api('/files?fields=id', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name: t('driveFolderName'), mimeType:'application/vnd.google-apps.folder', appProperties:{pwm:'folder'}})}, token);
    if (!created.ok) throw Error(t('driveFolderFailed', [created.status]));
    const folder = await created.json();
    if (!safeId(folder.id)) throw Error(t('driveFolderFailed', ['?']));
    await chrome.storage.local.set({[folderKey]: folder.id});
    return folder.id;
  }
  async function listFiles(token) {
    const response = await api(`/files?q=${q("appProperties has { key='pwm' and value='backup' } and trashed=false")}&orderBy=createdTime desc&pageSize=100&fields=files(id,name,createdTime,size,appProperties)`, {}, token);
    if (!response.ok) throw Error(t('driveListFailed', [response.status]));
    return ((await response.json()).files || []).filter(f => safeId(f.id));
  }
  async function keepCount() {
    const settings = (await chrome.storage.local.get('pwm_settings')).pwm_settings || {};
    const value = Number(settings.driveKeep);
    return Number.isFinite(value) && value >= 0 && settings.driveKeep !== undefined ? value : DEFAULT_KEEP;
  }
  async function setKeepCount(value) {
    const cur = (await chrome.storage.local.get('pwm_settings')).pwm_settings || {};
    await chrome.storage.local.set({pwm_settings: {...cur, driveKeep: Math.max(0, Number(value) || 0)}});
  }
  // Deletes backups beyond the keep count (newest first). Never deletes the file just written. 0 = unlimited.
  async function prune(token, keepId) {
    const keep = await keepCount();
    if (!keep) return 0;
    const files = await listFiles(token);
    const extra = files.slice(keep).filter(f => f.id !== keepId);
    let removed = 0;
    for (const file of extra) {
      const response = await api(`/files/${file.id}`, {method:'DELETE'}, token);
      if (response.ok || response.status === 404) removed++;
    }
    return removed;
  }

  // ---------- public operations ----------
  async function save(data, activeSpaceId) {
    return navigator.locks.request('pwm-drive-backup', {ifAvailable:true}, async lock => {
      if (!lock) throw Error(t('m_76e8f9b19a'));
      const credentials = await auth();
      const exportedAt = new Date().toISOString();
      const backup = {version:1, exportedAt, activeSpaceId, categories:data.categories || [], spaces:data.spaces || []};
      validateBackup(backup);
      const folderId = await ensureFolder(credentials.token);
      const name = t('m_c62a99397a') + exportedAt.replace(/[:.]/g,'-') + '.json';
      const metadata = {name, mimeType:'application/json', parents:[folderId], appProperties:{pwm:'backup', spaces:String(backup.spaces.length), categories:String(backup.categories.length), exportedAt}};
      const boundary = 'pwm_' + crypto.randomUUID();
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(backup,null,2)}\r\n--${boundary}--`;
      let response;
      try {
        response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
          method:'POST', headers:{Authorization:`Bearer ${credentials.token}`, 'Content-Type':`multipart/related; boundary=${boundary}`},body,signal:AbortSignal.timeout(60000)
        });
      } catch { throw Error(t('m_551f37d20f')); }
      if (response.status === 401) {await invalidate(credentials.token); throw Error(t('m_6d2d7cf526'));}
      if (!response.ok) throw Error(t('m_e5be1db2f7', [response.status]));
      const file = await response.json();
      if (!safeId(file.id)) throw Error(t('m_fd067b945c'));
      const result = {id:file.id,name,exportedAt,folderId,url:`https://drive.google.com/file/d/${file.id}/view`,pruned:0};
      await chrome.storage.local.set({pwm_drive_last_backup:result});
      try { result.pruned = await prune(credentials.token, file.id); } catch { result.pruned = 0; }
      return result;
    });
  }
  async function listBackups() {
    const credentials = await auth();
    return listFiles(credentials.token);
  }
  async function download(id) {
    if (!safeId(id)) throw Error(t('driveDownloadFailed', ['?']));
    const credentials = await auth();
    const response = await api(`/files/${id}?alt=media`, {}, credentials.token);
    if (!response.ok) throw Error(t('driveDownloadFailed', [response.status]));
    const text = await response.text();
    return validateBackup(JSON.parse(text.replace(/^﻿/, '')));
  }
  async function folderUrl() {
    const id = (await chrome.storage.local.get(folderKey))[folderKey];
    return safeId(id) ? `https://drive.google.com/drive/folders/${id}` : '';
  }
  return {mode,connect,auth,disconnect,save,listBackups,download,folderUrl,keepCount,setKeepCount,DEFAULT_KEEP};
})();
