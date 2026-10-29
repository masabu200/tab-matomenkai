'use strict';
// "+ Space" dialog: name, category, colour and icon image are all set in one modal.
// open() resolves to {name, categoryId, color, icon} or null when cancelled.
// Uses dashboard.js globals: COLOR_PALETTE, buildFlatCategoryList, resizeAndProcessImage, loadData, t.
globalThis.SpaceCreateDialog = (() => {
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const dialog = el('dialog', 'space-create-dialog');
  dialog.id = 'spaceCreateDialog';
  dialog.setAttribute('aria-labelledby', 'spaceCreateTitle');
  const form = el('form', 'space-create');
  form.method = 'dialog';
  form.noValidate = true;

  const title = el('h3', 'modal__title', t('spaceCreateTitle'));
  title.id = 'spaceCreateTitle';

  // Name
  const nameField = el('div', 'space-create__field');
  const nameLabel = el('label', 'space-create__label', t('spaceCreateName'));
  nameLabel.htmlFor = 'spaceCreateName';
  const nameInput = el('input', 'modal__input');
  nameInput.id = 'spaceCreateName';
  nameInput.type = 'text';
  nameInput.autocomplete = 'off';
  nameInput.placeholder = t('spaceCreateNamePlaceholder');
  nameInput.setAttribute('aria-describedby', 'spaceCreateError');
  const error = el('p', 'space-create__error');
  error.id = 'spaceCreateError';
  error.setAttribute('role', 'alert');
  nameField.append(nameLabel, nameInput, error);

  // Category
  const catField = el('div', 'space-create__field');
  const catLabel = el('label', 'space-create__label', t('spaceCreateCategory'));
  catLabel.htmlFor = 'spaceCreateCategory';
  const catSelect = el('select', 'modal__input space-create__select');
  catSelect.id = 'spaceCreateCategory';
  catField.append(catLabel, catSelect);

  // Colour
  const colorField = el('div', 'space-create__field');
  const colorLabel = el('span', 'space-create__label', t('m_121ae791f1'));
  colorLabel.id = 'spaceCreateColorLabel';
  const colorGrid = el('div', 'modal__color-grid');
  colorGrid.setAttribute('role', 'radiogroup');
  colorGrid.setAttribute('aria-labelledby', 'spaceCreateColorLabel');
  colorField.append(colorLabel, colorGrid);

  // Icon image
  const iconField = el('div', 'space-create__field');
  const iconLabel = el('span', 'space-create__label', t('spaceCreateImage'));
  const iconRow = el('div', 'space-create__icon-row');
  const preview = el('span', 'space-create__preview');
  preview.setAttribute('aria-hidden', 'true');
  const chooseBtn = el('button', 'btn btn--ghost', t('m_aabcb11957'));
  chooseBtn.type = 'button';
  chooseBtn.id = 'spaceCreateImageChoose';
  const clearBtn = el('button', 'btn btn--ghost', t('m_ace3472c03'));
  clearBtn.type = 'button';
  clearBtn.id = 'spaceCreateImageClear';
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  fileInput.id = 'spaceCreateImageFile';
  iconRow.append(preview, chooseBtn, clearBtn, fileInput);
  const iconHelp = el('p', 'space-create__help', t('spaceCreateImageHelp'));
  iconField.append(iconLabel, iconRow, iconHelp);

  const footer = el('div', 'modal__footer');
  const cancelBtn = el('button', 'btn btn--ghost', t('m_269b0f92e4'));
  cancelBtn.type = 'button';
  cancelBtn.id = 'spaceCreateCancel';
  const okBtn = el('button', 'btn btn--primary', t('m_614f2eaaff'));
  okBtn.type = 'submit';
  okBtn.id = 'spaceCreateOk';
  footer.append(cancelBtn, okBtn);

  form.append(title, nameField, catField, colorField, iconField, footer);
  dialog.append(form);
  document.body.append(dialog);

  let state = {color: '', icon: ''};
  let existingNames = new Set();
  let finish = null;

  function renderPreview() {
    preview.style.background = state.icon ? `center / cover no-repeat url("${state.icon}")` : (state.color || '');
    preview.classList.toggle('space-create__preview--empty', !state.icon && !state.color);
    clearBtn.hidden = !state.icon;
  }

  function renderColors() {
    colorGrid.innerHTML = '';
    COLOR_PALETTE.forEach(({value, label}) => {
      const btn = el('button', 'modal__color-swatch' + (value ? '' : ' modal__color-swatch--none'));
      btn.type = 'button';
      btn.title = label;
      btn.dataset.color = value;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', label);
      if (value) btn.style.background = value; else btn.textContent = '×';
      const active = value === state.color;
      btn.classList.toggle('modal__color-swatch--active', active);
      btn.setAttribute('aria-checked', String(active));
      btn.addEventListener('click', () => {
        state.color = value;
        for (const b of colorGrid.children) {
          const on = b === btn;
          b.classList.toggle('modal__color-swatch--active', on);
          b.setAttribute('aria-checked', String(on));
        }
        renderPreview();
      });
      colorGrid.append(btn);
    });
  }

  function renderCategories(categories, selectedId) {
    catSelect.innerHTML = '';
    catSelect.append(new Option(t('m_f4d781035f'), ''));
    for (const {cat, depth} of buildFlatCategoryList(categories)) {
      catSelect.append(new Option('　'.repeat(depth) + cat.name, cat.id));
    }
    catSelect.value = categories.some(c => c.id === selectedId) ? selectedId : '';
  }

  function showError(text) {
    error.textContent = text;
    nameInput.setAttribute('aria-invalid', text ? 'true' : 'false');
  }

  chooseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    resizeAndProcessImage(file, dataUrl => { if (dataUrl) { state.icon = dataUrl; renderPreview(); } });
  });
  clearBtn.addEventListener('click', () => { state.icon = ''; renderPreview(); chooseBtn.focus(); });
  nameInput.addEventListener('input', () => showError(''));
  cancelBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { showError(t('m_629a6eefac')); nameInput.focus(); return; }
    if (existingNames.has(name)) { showError(t('m_29c082f9b5', [name])); nameInput.focus(); return; }
    const result = {name, categoryId: catSelect.value || null, color: state.color, icon: state.icon};
    const done = finish; finish = null;
    dialog.close();
    if (done) done(result);
  });
  dialog.addEventListener('close', () => { if (finish) { const done = finish; finish = null; done(null); } });

  async function open({categoryId = null} = {}) {
    if (dialog.open) return null;
    const data = await loadData();
    existingNames = new Set(data.spaces.map(s => s.name));
    state = {color: '', icon: ''};
    nameInput.value = '';
    showError('');
    renderCategories(data.categories || [], categoryId);
    renderColors();
    renderPreview();
    const previousFocus = document.activeElement;
    return new Promise(resolve => {
      finish = result => {
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(result);
      };
      dialog.showModal();
      nameInput.focus();
    });
  }

  return {open};
})();
