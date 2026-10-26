'use strict';
const panelStatus = document.getElementById('verticalTabsStatus');
const leftOnlyMessage = 'Chromeのサイドパネルの位置を「左」にしてください。右側には開きません。';
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
    if (layout.side !== 'left') { panelStatus.textContent = leftOnlyMessage; return; }
    await chrome.sidePanel.open({windowId:ownerWindowId});
    panelStatus.textContent = '左サイドバーを開きました。';
    await syncLeftSidebar();
  } catch { panelStatus.textContent = 'サイドバーを開けませんでした。もう一度お試しください。'; }
});
window.addEventListener('focus', syncLeftSidebar);
setTimeout(syncLeftSidebar, 1000);
void syncLeftSidebar();
