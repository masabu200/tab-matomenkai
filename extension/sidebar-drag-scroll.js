'use strict';
// Listen in capture phase because space rows stop dragover propagation.
(() => {
  const sidebar = document.querySelector('.sidebar');
  const list = document.getElementById('spaceList');
  let frame = 0, point = null, previousTime = 0;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0; point = null; previousTime = 0;
  }
  function tick(time) {
    frame = 0;
    if (!point || !g_draggedSpaceId || !sidebar.isConnected) { stop(); return; }
    const outer = sidebar.getBoundingClientRect();
    const inner = list.getBoundingClientRect();
    const top = Math.max(0, outer.top, inner.top);
    const bottom = Math.min(innerHeight, outer.bottom, inner.bottom);
    if (point.x < outer.left || point.x > outer.right || point.y < outer.top || point.y > outer.bottom || bottom <= top) { stop(); return; }
    const edge = Math.min(64, (bottom - top) / 3);
    let speed = 0;
    if (point.y < top + edge) speed = -Math.min(1, (top + edge - point.y) / edge);
    else if (point.y > bottom - edge) speed = Math.min(1, (point.y - bottom + edge) / edge);
    const delta = speed * 650 * Math.min(previousTime ? time - previousTime : 16, 40) / 1000;
    previousTime = time;
    if (delta) {
      const before = list.scrollTop;
      list.scrollTop += delta;
      // On very short windows the outer sidebar can also have overflow.
      if (list.scrollTop === before) sidebar.scrollTop += delta;
    }
    frame = requestAnimationFrame(tick);
  }
  document.addEventListener('dragover', event => {
    if (!g_draggedSpaceId || !sidebar.contains(event.target)) { stop(); return; }
    point = { x:event.clientX, y:event.clientY };
    if (!frame) frame = requestAnimationFrame(tick);
  }, true);
  document.addEventListener('drop', stop, true);
  document.addEventListener('dragend', stop, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') stop(); }, true);
  document.addEventListener('dragleave', event => {
    if (!event.relatedTarget && (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= innerWidth || event.clientY >= innerHeight)) stop();
  }, true);
  window.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
})();
