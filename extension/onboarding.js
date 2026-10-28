'use strict';
// First-run guidance: puts the next action directly inside the empty-state guides so a new
// user never has to hunt for the right button.
(() => {
  const noSpace = document.getElementById('noSpaceNote');
  const emptyTabs = document.getElementById('emptyTabNote');
  if (!noSpace || !emptyTabs) return;
  const button = (id, label) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'btn btn--primary empty-guide__action'; b.textContent = label; return b; };

  const create = button('guideCreateSpace', t('guideCreateSpace'));
  create.addEventListener('click', () => { if (typeof handleCreateSpace === 'function') handleCreateSpace(); });
  noSpace.append(create);

  const save = button('guideSaveTabs', t('guideSaveTabs'));
  save.addEventListener('click', () => {
    if (typeof handleSaveTabs !== 'function') return;
    save.disabled = true;
    navigator.locks.request('pwm-space-switch', () => handleSaveTabs()).finally(() => { save.disabled = false; });
  });
  emptyTabs.append(save);
})();
