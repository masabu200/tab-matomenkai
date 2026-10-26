'use strict';
const panelStatus = document.getElementById('verticalTabsStatus');
const leftOnlyMessage = 'Chromeのサイドパネルの位置を「左」にしてください。右側には開きません。';
const openedMessage = '左サイドバーを開きました。別のページを開いても表示されたままです。閉じたときはツールバーの拡張アイコンで再表示できます。';
// Chromeの配置が右のときの案内（dashboard.html の #panelPlacementHelp）
const placementHelp = document.getElementById('panelPlacementHelp');
const chromeSettingsButton = document.getElementById('openChromePanelSettings');
if (chromeSettingsButton && chromeSettingsButton.addEventListener) {
  chromeSettingsButton.addEventListener('click', () => {
    try { chrome.tabs?.create?.({url:'chrome://settings/appearance'})?.catch?.(() => {}); } catch { /* 設定を開けない環境では何もしない */ }
  });
}
async function refreshPlacementHelp() {
  if (!placementHelp || !chrome.sidePanel?.getLayout) return;
  try {
    const {side} = await chrome.sidePanel.getLayout();
    placementHelp.hidden = side === 'left';
  } catch { /* 取得できないときは案内を変えない */ }
}
const leftPanelPorts = new Set();
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== `left-panel:${g_dashboardWindowId}`) return;
  leftPanelPorts.add(port);
  document.body.classList.add('native-left-panel-open');
  port.onDisconnect.addListener(() => {
    leftPanelPorts.delete(port);
    if (!leftPanelPorts.size) document.body.classList.remove('native-left-panel-open');
  });
});
async function syncLeftSidebar() {
  if (g_dashboardWindowId === null) return;
  await chrome.runtime.sendMessage({type:'LEFT_PANEL_CONNECT',windowId:g_dashboardWindowId}).catch(() => {});
}
document.getElementById('openVerticalTabs').addEventListener('click', async () => {
  if (!chrome.sidePanel?.getLayout) {
    panelStatus.textContent = '左配置を確認できるChrome 141以上が必要です。';
    return;
  }
  const ownerWindowId = g_dashboardWindowId;
  if (ownerWindowId === null) {
    panelStatus.textContent = 'ウィンドウの準備中です。もう一度お試しください。';
    return;
  }
  try {
    const layout = await chrome.sidePanel.getLayout();
    if (layout.side !== 'left') { panelStatus.textContent = leftOnlyMessage; if (placementHelp) placementHelp.hidden = false; return; }
    await chrome.sidePanel.open({windowId:ownerWindowId});
    panelStatus.textContent = openedMessage;
    if (placementHelp) placementHelp.hidden = true;
    await syncLeftSidebar();
  } catch { panelStatus.textContent = 'サイドバーを開けませんでした。もう一度お試しください。'; }
});
window.addEventListener('focus', syncLeftSidebar);
window.addEventListener('focus', refreshPlacementHelp); // Chrome設定から戻ってきたら案内を更新
void refreshPlacementHelp();
setTimeout(syncLeftSidebar, 1000);
void syncLeftSidebar();
