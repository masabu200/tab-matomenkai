'use strict';
// Reuse dashboard.js and its original sidebar. Only panel presentation and the
// full-dashboard link live here; no separate categories/spaces/JSON model.
const panelMessage = document.getElementById('message');
document.getElementById('panelMessageHost').append(panelMessage);
document.getElementById('openDashboard').addEventListener('click', async event => {
  const button = event.currentTarget;
  if (button.disabled || g_dashboardWindowId === null) return;
  button.disabled = true;
  try {
    const tabs = await chrome.tabs.query({ windowId: g_dashboardWindowId });
    const existing = tabs.find(tab => tab.url?.startsWith(DASHBOARD_PAGE_URL));
    if (existing) await chrome.tabs.update(existing.id, { active: true });
    else await chrome.tabs.create({ windowId: g_dashboardWindowId, url: DASHBOARD_PAGE_URL, active: true });
  } catch { showMessage(t('m_99f2a39628'), 'error'); }
  finally { button.disabled = false; }
});
// Modal width/focus adapts to the narrow panel; category fields remain original.
const categoryModal = document.getElementById('categoryModal');
categoryModal.setAttribute('role', 'dialog');
categoryModal.setAttribute('aria-modal', 'true');
categoryModal.setAttribute('aria-labelledby', 'categoryModalTitle');
categoryModal.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...categoryModal.querySelectorAll('input, button')].filter(el => !el.disabled);
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

// The native Chrome menu can also open the panel. Never render a second menu
// on the right, even when that entry point bypasses the dashboard launcher.
let dashboardPort = null;
function connectLeftDashboard() {
  if (g_dashboardWindowId === null || !document.documentElement.classList.contains('left-layout-verified')) return;
  if (dashboardPort) dashboardPort.disconnect();
  dashboardPort = chrome.runtime.connect({name:`left-panel:${g_dashboardWindowId}`});
}
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'LEFT_PANEL_CONNECT' && message.windowId === g_dashboardWindowId) connectLeftDashboard();
});
async function enforceLeftPanel() {
  if (!chrome.sidePanel?.getLayout) {
    document.querySelector('.app').hidden = true;
    return;
  }
  const {side} = await chrome.sidePanel.getLayout();
  document.documentElement.classList.toggle('left-layout-verified', side === 'left');
  document.querySelector('.app').hidden = side !== 'left';
  if (side === 'left' && !dashboardPort) connectLeftDashboard();
  if (side !== 'left' && chrome.sidePanel.close && g_dashboardWindowId !== null) {
    await chrome.sidePanel.close({windowId:g_dashboardWindowId}).catch(() => {});
  }
}
void enforceLeftPanel();
setInterval(() => { void enforceLeftPanel(); }, 500);
