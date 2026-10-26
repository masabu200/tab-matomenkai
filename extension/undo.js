'use strict';
// 削除・アーカイブの「元に戻す」（ダッシュボード）
//   操作前のタブ一覧を控えておき、数秒間だけトースト（元に戻す）を出す。
//   その後にスペースが別の変更を受けていたら（updatedAt が変わる）上書きを避けて戻さない。
const Undo = (() => {
  const TOAST_MS = 8000;
  const clone = v => JSON.parse(JSON.stringify(v ?? []));
  let record = null, timer = null;
  const toast = document.createElement('div'); toast.id = 'undoToast'; toast.className = 'undo-toast'; toast.hidden = true; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  const text = document.createElement('span'); text.className = 'undo-toast__text';
  const button = document.createElement('button'); button.type = 'button'; button.id = 'undoButton'; button.className = 'btn btn--primary'; button.textContent = '元に戻す';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'undo-toast__close'; close.setAttribute('aria-label', '閉じる'); close.textContent = '×';
  toast.append(text, button, close); document.body.append(toast);
  function hide() { clearTimeout(timer); timer = null; toast.hidden = true; record = null; }
  close.addEventListener('click', hide);
  // 操作前の控え。loadData だけなのでロックの内外どちらから呼んでもよい。
  async function snapshotActive() {
    const data = await loadData(); const space = data.spaces.find(s => s.id === getActiveSpaceId(data));
    return space ? snapshotOf(space) : null;
  }
  function snapshotOf(space) { return { spaceId: space.id, tabs: clone(space.tabs), archivedTabs: clone(space.archivedTabs) }; }
  // 操作後に呼ぶ。実際に変化していればトーストを出す。
  async function offer(label, snapshot) {
    if (!snapshot) return;
    const data = await loadData(); const space = data.spaces.find(s => s.id === snapshot.spaceId);
    if (!space) return;
    const changed = JSON.stringify(space.tabs) !== JSON.stringify(snapshot.tabs) || JSON.stringify(space.archivedTabs || []) !== JSON.stringify(snapshot.archivedTabs);
    if (!changed) return;
    record = { ...snapshot, label, updatedAt: space.updatedAt };
    text.textContent = label;
    toast.hidden = false; clearTimeout(timer); timer = setTimeout(hide, TOAST_MS);
  }
  async function apply() {
    if (!record) return false;
    const current = record; hide();
    if (g_isSwitching) { showMessage('切り替え中は戻せません。', 'error'); return false; }
    try {
      return await navigator.locks.request('pwm-space-switch', async () => {
        const data = await loadData(); const space = data.spaces.find(s => s.id === current.spaceId);
        if (!space) { showMessage('スペースが見つからないため戻せません。', 'error'); return false; }
        if (space.updatedAt !== current.updatedAt) { showMessage('その後に変更があったため、元に戻すのを中止しました。', 'error'); return false; }
        space.tabs = clone(current.tabs); space.archivedTabs = clone(current.archivedTabs); space.updatedAt = new Date().toISOString();
        await saveData(data); await renderAll(); applyGroupsToChromeTabs(space.id).catch(() => {});
        showMessage('元に戻しました。', 'success'); return true;
      });
    } catch (error) { showMessage('元に戻せませんでした。', 'error'); console.error('[PWM] undo', error); return false; }
  }
  button.addEventListener('click', apply);
  const editable = node => !!node && (node.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(node.tagName));
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z' && record && !editable(document.activeElement) && !document.querySelector('dialog[open]')) { event.preventDefault(); apply(); }
  });
  // カード単体の削除・アーカイブも戻せるように、既存ハンドラを包む
  if (typeof handleDeleteTab === 'function') { const original = handleDeleteTab; handleDeleteTab = async function(index) { const snap = await snapshotActive(); await original(index); await offer('タブを1枚削除しました。', snap); }; }
  if (typeof handleArchiveSpaceTab === 'function') { const original = handleArchiveSpaceTab; handleArchiveSpaceTab = async function(index) { const snap = await snapshotActive(); await original(index); await offer('タブを1枚アーカイブしました。', snap); }; }
  return { snapshotActive, snapshotOf, offer, apply, hide, get pending() { return record; } };
})();
