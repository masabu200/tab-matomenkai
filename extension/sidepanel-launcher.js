'use strict';
const panelStatus = document.getElementById('verticalTabsStatus');
const openedMessage = t('m_2c14db7241');
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
  const ownerWindowId = g_dashboardWindowId;
  if (ownerWindowId === null) {
    panelStatus.textContent = t('m_c5ed08a7f9');
    return;
  }
  try {
    if (!chrome.sidePanel?.open) throw Error('sidePanel unavailable');
    await chrome.sidePanel.open({windowId:ownerWindowId});
    panelStatus.textContent = openedMessage;
    await syncLeftSidebar();
  } catch { panelStatus.textContent = t('m_14ae9512a4'); }
});
window.addEventListener('focus', syncLeftSidebar);
setTimeout(syncLeftSidebar, 1000);
void syncLeftSidebar();
