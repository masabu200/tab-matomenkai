/**
 * content.js — コンテンツスクリプト
 * 全ページで動作し、設定されたマウスボタンでダッシュボードに移動する
 */

(function () {
  // ダッシュボードページ自体では動作しない
  if (location.protocol === 'chrome-extension:') return;

  document.addEventListener('mouseup', (e) => {
    // button 3 = マウス「戻る」ボタン, button 4 = マウス「進む」ボタン
    // デフォルトは button 4（進むボタン）
    // 変更したい場合は background.js 側の設定と合わせて変更
    if (e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'FOCUS_DASHBOARD' });
    }
  }, true); // キャプチャフェーズで受け取りブラウザのデフォルト動作より先に処理
})();
