'use strict';
// Dashboard keeps its existing browser dialogs. A Side Panel uses an accessible
// in-panel dialog because it has no ordinary tab for a browser modal dialog.
globalThis.DashboardDialogs = {
  prompt(message, initial = '') {
    return document.body.classList.contains('sidebar-panel')
      ? this.open(message, initial)
      : Promise.resolve(window.prompt(message, initial));
  },
  confirm(message) {
    return document.body.classList.contains('sidebar-panel')
      ? this.open(message)
      : Promise.resolve(window.confirm(message));
  },
  open(message, initial) {
    if (document.getElementById('panelDialog')) return Promise.resolve(initial === undefined ? false : null);
    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const dialog = document.createElement('dialog'); dialog.id = 'panelDialog'; dialog.className = 'panel-dialog';
      const form = document.createElement('form'); form.method = 'dialog';
      const label = document.createElement('label'); label.id = 'panelDialogLabel'; label.textContent = message;
      dialog.setAttribute('aria-labelledby', label.id);
      form.append(label);
      let input;
      if (initial !== undefined) {
        input = document.createElement('input'); input.id = 'panelDialogInput'; input.type = 'text'; input.value = initial;
        label.htmlFor = input.id; form.append(input);
      }
      const controls = document.createElement('div'); controls.className = 'panel-dialog-actions';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn--ghost'; cancel.textContent = 'キャンセル';
      const ok = document.createElement('button'); ok.type = 'submit'; ok.className = 'btn btn--primary'; ok.textContent = 'OK';
      controls.append(cancel, ok); form.append(controls); dialog.append(form); document.body.append(dialog);
      function finish(accepted) {
        dialog.close(); dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(input ? (accepted ? input.value : null) : accepted);
      }
      cancel.addEventListener('click', () => finish(false));
      form.addEventListener('submit', e => { e.preventDefault(); finish(true); });
      dialog.addEventListener('cancel', e => { e.preventDefault(); finish(false); });
      dialog.showModal(); (input || cancel).focus();
    });
  }
};

// Explicit choices use the same accessible modal on dashboard and panel.
DashboardDialogs.chooseSwitch = function(message, canSave) {
  if (document.getElementById('panelDialog')) return Promise.resolve('cancel');
  return new Promise(resolve => {
    const focus = document.activeElement;
    const dialog = document.createElement('dialog'); dialog.id='panelDialog'; dialog.className='workspace-dialog';
    const title=document.createElement('h2');title.id='switchDialogTitle';title.textContent='スペースを切り替える';dialog.setAttribute('aria-labelledby',title.id);
    const text=document.createElement('p');text.textContent=message;
    const form=document.createElement('form');form.method='dialog';
    const finish=value=>{dialog.close();dialog.remove();if(focus?.isConnected)focus.focus();resolve(value)};
    for(const [value,label] of [['save','保存して切り替える'],['skip','保存せず切り替える'],['cancel','キャンセル']]){
      const button=document.createElement('button');button.type=value==='skip'?'submit':'button';button.className='btn btn--ghost';button.dataset.choice=value;button.textContent=label;button.disabled=value==='save'&&!canSave;
      if(value!=='skip')button.addEventListener('click',()=>finish(value));form.append(button);
    }
    if(!canSave){const note=document.createElement('p');note.textContent='保存先のスペースがないため、この画面では保存できません。';dialog.append(note)}
    dialog.prepend(title,text);dialog.append(form);document.body.append(dialog);
    form.addEventListener('submit',event=>{event.preventDefault();finish('skip')});dialog.addEventListener('cancel',event=>{event.preventDefault();finish('cancel')});
    dialog.showModal();form.querySelector('[data-choice="cancel"]').focus();
  });
};
