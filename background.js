/**
 * background.js — サービスワーカー
 *
 * - アイコンクリック時に dashboard.html を開く（またはフォーカス）
 * - ダッシュボードタブを常にピン留め＆最左端に固定する
 * - chrome.alarms で定期自動バックアップを実行する
 */

const DASHBOARD_URL = chrome.runtime.getURL('dashboard.html');
const ALARM_NAME    = 'pwm-auto-backup';
const DATA_KEY      = 'pwm_data';
const SETTINGS_KEY  = 'pwm_settings';

// ============================================================
// ダッシュボードタブのピン留め
// ============================================================

async function pinAndMoveToFirst(tabId) {
  await chrome.tabs.update(tabId, { pinned: true });
  await chrome.tabs.move(tabId, { index: 0 });
}

chrome.action.onClicked.addListener(async () => {
  try {
    // 現在のウィンドウ内だけを検索（他ウィンドウのダッシュボードには飛ばない）
    const currentWindow = await chrome.windows.getCurrent();
    const tabsInWindow  = await chrome.tabs.query({ windowId: currentWindow.id });
    const existingTab   = tabsInWindow.find((t) => t.url && t.url.startsWith(DASHBOARD_URL));

    if (existingTab) {
      await chrome.tabs.update(existingTab.id, { active: true });
      await pinAndMoveToFirst(existingTab.id);
      g_dashboardTabIds.add(existingTab.id);
    } else {
      const newTab = await chrome.tabs.create({ url: DASHBOARD_URL });
      await pinAndMoveToFirst(newTab.id);
      g_dashboardTabIds.add(newTab.id);
    }
  } catch (err) {
    console.error('[PWM] dashboard.html を開く際にエラーが発生しました:', err);
  }
});

// ============================================================
// ダッシュボードの保護（ブックマーク等で上書きされないようにする）
// ============================================================
// Service Worker は再起動するとメモリが消えるため、
// chrome.storage.session でタブIDを永続化する（ブラウザを閉じるまで保持）

const SESSION_KEY = 'pwm_dashboard_tab_ids';

async function getDashboardTabIds() {
  const result = await chrome.storage.session.get(SESSION_KEY);
  return new Set(result[SESSION_KEY] || []);
}

async function saveDashboardTabIds(set) {
  await chrome.storage.session.set({ [SESSION_KEY]: [...set] });
}

async function addDashboardTabId(tabId) {
  const ids = await getDashboardTabIds();
  ids.add(tabId);
  await saveDashboardTabIds(ids);
}

async function removeDashboardTabId(tabId) {
  const ids = await getDashboardTabIds();
  ids.delete(tabId);
  await saveDashboardTabIds(ids);
}

// 起動時に現在のダッシュボードタブを登録する
async function registerExistingDashboards() {
  const tabs = await chrome.tabs.query({});
  const ids  = new Set();
  for (const tab of tabs) {
    if (tab.url && tab.url.startsWith(DASHBOARD_URL)) ids.add(tab.id);
  }
  await saveDashboardTabIds(ids);
}
chrome.runtime.onInstalled.addListener(registerExistingDashboards);
chrome.runtime.onStartup.addListener(registerExistingDashboards);

// ============================================================
// コンテンツスクリプトからのメッセージ処理
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'FOCUS_DASHBOARD') return;

  // 送信元と同じウィンドウのダッシュボードタブを優先してフォーカス
  const windowId = sender.tab ? sender.tab.windowId : null;
  chrome.tabs.query({}, (tabs) => {
    void chrome.runtime.lastError;
    const dashTabs = tabs.filter((t) => t.url && t.url.startsWith(DASHBOARD_URL));
    if (dashTabs.length === 0) return;
    // 同ウィンドウのダッシュボードを優先、なければ最初に見つかったもの
    const target = (windowId && dashTabs.find((t) => t.windowId === windowId)) || dashTabs[0];
    chrome.tabs.update(target.id, { active: true }, () => { void chrome.runtime.lastError; });
    chrome.windows.update(target.windowId, { focused: true }, () => { void chrome.runtime.lastError; });
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  if (changeInfo.url.startsWith(DASHBOARD_URL)) {
    await addDashboardTabId(tabId);
  } else {
    const ids = await getDashboardTabIds();
    if (ids.has(tabId)) {
      try {
        // ダッシュボードを復元し、開こうとしたURLは新しいタブで開く
        // （タブドラッグ中は操作できないため try-catch で安全に処理）
        await chrome.tabs.update(tabId, { url: DASHBOARD_URL });
        await chrome.tabs.create({ url: changeInfo.url, index: tab.index + 1, active: true });
      } catch (err) {
        console.warn('[PWM] ダッシュボード保護エラー（ドラッグ中など）:', err.message);
      }
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeDashboardTabId(tabId);
});

// ============================================================
// 自動バックアップ — アラーム設定
// ============================================================

// インストール時・Chrome 起動時にアラームを登録する
// （1時間ごとに発火し、ハンドラ側でユーザー指定間隔を判定する）
chrome.runtime.onInstalled.addListener(setupAutoBackupAlarm);
chrome.runtime.onStartup.addListener(setupAutoBackupAlarm);

function setupAutoBackupAlarm() {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
    }
  });
}

// ============================================================
// 自動バックアップ — アラームハンドラ
// ============================================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  try {
    const result        = await chrome.storage.local.get(SETTINGS_KEY);
    const settings      = result[SETTINGS_KEY] || {};
    const intervalHours = settings.backupIntervalHours ?? 24;

    // 0 = オフ
    if (intervalHours === 0) return;

    // 前回のバックアップから指定時間が経過していなければスキップ
    const lastAt = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
    const now    = new Date();
    if (lastAt && (now - lastAt) < intervalHours * 3_600_000) return;

    await performAutoBackup(now);

    // 最終バックアップ時刻を更新する
    await chrome.storage.local.set({
      [SETTINGS_KEY]: { ...settings, lastBackupAt: now.toISOString() },
    });
  } catch (err) {
    console.error('[PWM] 自動バックアップエラー:', err);
  }
});

// ============================================================
// バックアップ実行
// ============================================================

/**
 * JSON 文字列を base64 に変換する
 * service worker では URL.createObjectURL() が使えないため data URI を使う
 */
function jsonToBase64DataUri(str) {
  const bytes  = new TextEncoder().encode(str);
  let   binary = '';
  // 大きなデータでもスタックオーバーフローしないよう 8192 バイトずつ変換する
  const CHUNK  = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return 'data:application/json;base64,' + btoa(binary);
}

async function performAutoBackup(now = new Date()) {
  const dataResult = await chrome.storage.local.get(DATA_KEY);
  const data       = dataResult[DATA_KEY];

  // データが空の場合はバックアップしない
  if (!data || !Array.isArray(data.spaces) || data.spaces.length === 0) return;

  const backup = {
    version:       1,
    exportedAt:    now.toISOString(),
    activeSpaceId: data.activeSpaceId || null,
    categories:    data.categories    || [],
    spaces:        data.spaces        || [],
  };

  const json = JSON.stringify(backup, null, 2);
  const ts   = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  await chrome.downloads.download({
    url:            jsonToBase64DataUri(json),
    // Downloads フォルダ内の tab-matomenn サブフォルダに保存する
    filename:       `tab-matomenn/pwm-autobackup-${ts}.json`,
    saveAs:         false,   // ダイアログを出さずに自動保存する
    conflictAction: 'uniquify',
  });
}
