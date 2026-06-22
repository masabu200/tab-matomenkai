// ============================================================
// タブまとめん改 — dashboard.js
// ============================================================

const EXCLUDED_URL_PREFIXES = [
  'chrome://', 'chrome-extension://', 'edge://',
  'about:', 'javascript:', 'data:', 'file://',
];
const STORAGE_KEY         = 'pwm_data';
const MESSAGE_DURATION_MS = 3500;

// SVG アイコン（ハードコード定数のため innerHTML 使用可）
const ICONS = {
  edit:    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash:   '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>',
  folder:  '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  archive: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  check:   '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  palette: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
};

// テーマカラーパレット（空文字 = なし）
const COLOR_PALETTE = [
  { value: '',        label: 'なし'    },
  { value: '#e05555', label: '赤'      },
  { value: '#e07835', label: 'オレンジ' },
  { value: '#c9a830', label: '黄'      },
  { value: '#4aaa5a', label: '緑'      },
  { value: '#2a9aa0', label: '青緑'    },
  { value: '#4a7ef8', label: '青'      },
  { value: '#8a50d8', label: '紫'      },
  { value: '#d04878', label: 'ピンク'  },
  { value: '#7a8098', label: 'グレー'  },
];
// Chrome タブグループのカラー名 → hex マッピング（Chrome の実際の色に合わせる）
const CHROME_GROUP_COLOR_MAP = {
  grey:   '#5f6368',
  blue:   '#1a73e8',
  red:    '#d93025',
  yellow: '#f9ab00',
  green:  '#1e8e3e',
  pink:   '#e52592',
  purple: '#a142f4',
  cyan:   '#129eaf',
  orange: '#e8710a',
};

// タブグループ専用カラーパレット（Chrome 標準と同じ9色）
const CHROME_GROUP_COLORS = [
  { value: 'grey',   label: 'グレー',   hex: '#5f6368' },
  { value: 'blue',   label: 'ブルー',   hex: '#1a73e8' },
  { value: 'red',    label: 'レッド',   hex: '#d93025' },
  { value: 'yellow', label: 'イエロー', hex: '#f9ab00' },
  { value: 'green',  label: 'グリーン', hex: '#1e8e3e' },
  { value: 'pink',   label: 'ピンク',   hex: '#e52592' },
  { value: 'purple', label: 'パープル', hex: '#a142f4' },
  { value: 'cyan',   label: 'シアン',   hex: '#129eaf' },
  { value: 'orange', label: 'オレンジ', hex: '#e8710a' },
];

/** Chrome カラー名 or hex → Chrome カラー名 */
function toChromeColorName(color) {
  if (CHROME_GROUP_COLOR_MAP[color]) return color; // すでにカラー名
  // hex から逆引き
  const found = Object.entries(CHROME_GROUP_COLOR_MAP).find(([, h]) => h === color);
  return found ? found[0] : 'grey';
}

/** Chrome カラー名 or hex → 表示用 hex */
function toDisplayHex(color) {
  return CHROME_GROUP_COLOR_MAP[color] || color || '';
}

/** hex → rgba */
function hexToRgba(hex, alpha = 0.06) {
  if (!hex || typeof hex !== 'string') return '';
  hex = hex.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  if (hex.length !== 6) return '';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// hex / カラー名 → Chrome タブグループカラー名（後方互換のため関数名はそのまま）
function getChromeColorFromHex(color) {
  return toChromeColorName(color);
}

function createIcon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = ICONS[name] || '';
  return span;
}

/**
 * テーマカラー選択ポップアップを表示する
 * @param {HTMLElement} anchorEl   クリックされた要素（位置計算に使用）
 * @param {string}      current    現在選択中のカラー値
 * @param {Function}    onSelect   色が選ばれたときのコールバック (value: string) => void
 */
function showColorPicker(anchorEl, current, onSelect, onSelectIcon, currentIcon) {
  // 既存のポップアップを閉じる
  const old = document.getElementById('colorPickerPopup');
  if (old) old.remove();

  const popup = document.createElement('div');
  popup.id        = 'colorPickerPopup';
  popup.className = 'color-picker-popup';

  const grid = document.createElement('div');
  grid.className = 'color-picker-grid';

  COLOR_PALETTE.forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'color-swatch' + (value === current ? ' color-swatch--active' : '');
    btn.title     = label;

    if (value) {
      btn.style.background = value;
    } else {
      btn.classList.add('color-swatch--none');
      btn.textContent = '×';
    }

    if (value === current && value) {
      btn.appendChild(createIcon('check'));
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.remove();
      document.removeEventListener('click', closeOnOutside, true);
      onSelect(value);
    });
    grid.appendChild(btn);
  });
  popup.appendChild(grid);

  if (onSelectIcon) {
    const divider = document.createElement('div');
    divider.className = 'color-picker-divider';
    popup.appendChild(divider);

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'color-picker-upload-btn';
    uploadBtn.textContent = '画像を設定';
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          resizeAndProcessImage(file, (dataUrl) => {
            if (dataUrl) {
              popup.remove();
              document.removeEventListener('click', closeOnOutside, true);
              onSelectIcon(dataUrl);
            }
          });
        }
      });
      fileInput.click();
    });
    popup.appendChild(uploadBtn);

    if (currentIcon) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'color-picker-remove-btn';
      removeBtn.textContent = '画像を解除';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        document.removeEventListener('click', closeOnOutside, true);
        onSelectIcon('');
      });
      popup.appendChild(removeBtn);
    }
  }

  document.body.appendChild(popup);

  // アンカー要素の直下に配置する（画面端で折り返す）
  const rect = anchorEl.getBoundingClientRect();
  const pw   = popup.offsetWidth  || 148;
  const ph   = popup.offsetHeight || 120;
  let left = rect.left;
  let top  = rect.bottom + 6;
  if (left + pw > window.innerWidth  - 8) left = window.innerWidth  - pw - 8;
  if (top  + ph > window.innerHeight - 8) top  = rect.top - ph - 6;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';

  function closeOnOutside(e) {
    if (!popup.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeOnOutside, true);
    }
  }
  // 次のイベントループで登録して、今回のクリックを拾わないようにする
  setTimeout(() => document.addEventListener('click', closeOnOutside, true), 0);
}

// グローバル状態
let g_dashboardTabId    = null;
let g_dashboardWindowId = null;
let g_searchQuery       = '';
let g_messageTimer      = null;
let g_draggedSpaceId    = null;
let g_draggedCategoryId = null;
let g_draggedTabInfo     = null; // {originalIndex, groupId} for tab DnD
let g_draggedGroupInfo   = null; // {spaceId, groupId} for group reorder DnD
let g_viewMode           = 'list'; // 'list' | 'card'

// スペース切り替えの排他制御
// 切り替え中に来たリクエストは g_pendingSwitch に上書き保存し、
// 現在の切り替えが完了してから最後のリクエストのみ実行する
let g_isSwitching  = false;
let g_pendingSwitch = null;

// renderAll のシーケンス番号
// 複数の renderAll() が並走したとき、最新以外の描画結果を捨てるために使う
let g_renderSeq = 0;

// ============================================================
// ユーティリティ
// ============================================================

function getActiveSpaceId(data) {
  if (g_dashboardWindowId && data.windowActiveSpaces && data.windowActiveSpaces[g_dashboardWindowId]) {
    return data.windowActiveSpaces[g_dashboardWindowId];
  }
  return null;
}

function setActiveSpaceId(data, spaceId) {
  if (!data.windowActiveSpaces) {
    data.windowActiveSpaces = {};
  }
  if (g_dashboardWindowId) {
    data.windowActiveSpaces[g_dashboardWindowId] = spaceId;
  }
  data.activeSpaceId = spaceId; // Sync to global activeSpaceId for backward compatibility
}

function isSavableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  for (const p of EXCLUDED_URL_PREFIXES) { if (url.startsWith(p)) return false; }
  return true;
}

function isRestorableUrl(url) {
  if (!isSavableUrl(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch { return false; }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ============================================================
// メッセージバナー
// ============================================================

function showMessage(text, type = 'success') {
  const el = document.getElementById('message');
  if (!el) return;
  if (g_messageTimer) { clearTimeout(g_messageTimer); g_messageTimer = null; }
  el.className = 'message';
  el.textContent = text;
  el.classList.add(type === 'error' ? 'message--error' : 'message--success');
  el.style.display = 'block';
  g_messageTimer = setTimeout(() => {
    el.style.display = 'none';
    el.textContent = '';
    el.className = 'message';
  }, MESSAGE_DURATION_MS);
}

// ============================================================
// ストレージ
// ============================================================

async function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        console.error('[PWM] ストレージ読み込みエラー:', chrome.runtime.lastError);
        resolve({ activeSpaceId: null, windowActiveSpaces: {}, categories: [], spaces: [] });
        return;
      }
      const raw = result[STORAGE_KEY];
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.spaces)) {
        resolve({ activeSpaceId: null, windowActiveSpaces: {}, categories: [], spaces: [] });
        return;
      }
      if (!Array.isArray(raw.categories)) raw.categories = [];
      if (!raw.windowActiveSpaces || typeof raw.windowActiveSpaces !== 'object') {
        raw.windowActiveSpaces = {};
      }
      if (!('archiveColor' in raw)) raw.archiveColor = '';
      // スペースの正規化
      raw.spaces.forEach((s) => {
        if (!('categoryId' in s)) s.categoryId = null;
        if (!('archived'   in s)) s.archived   = false;
        if (!('color'      in s)) s.color      = '';
        if (!('icon'       in s)) s.icon       = '';
        if (!Array.isArray(s.tabGroups)) s.tabGroups = [];
        s.tabGroups.forEach((g) => { if (!('chromeGroupId' in g)) g.chromeGroupId = null; });
        if (Array.isArray(s.tabs)) {
          s.tabs.forEach((t) => { if (!('groupId' in t)) t.groupId = null; });
        }
        if (!Array.isArray(s.archivedTabs)) s.archivedTabs = [];
      });
      // カテゴリーの正規化
      raw.categories.forEach((c) => {
        if (!('collapsed' in c)) c.collapsed = false;
        if (!('color'     in c)) c.color     = '';
        if (!('icon'      in c)) c.icon      = '';
        if (!('parentId'  in c)) c.parentId  = null;
      });
      resolve(raw);
    });
  });
}

async function saveData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
      if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
      resolve();
    });
  });
}

// ============================================================
// カテゴリー CRUD
// ============================================================

async function createCategory(name, color = '', parentId = null) {
  const trimmed = name.trim();
  if (!trimmed) { showMessage('カテゴリー名を入力してください。', 'error'); return null; }
  const data = await loadData();
  if (data.categories.some((c) => c.name === trimmed)) {
    showMessage(`「${trimmed}」というカテゴリーが既に存在します。`, 'error'); return null;
  }
  const newCat = { id: generateId(), name: trimmed, collapsed: false, color: color || '', parentId: parentId || null };
  data.categories.push(newCat);
  await saveData(data);
  return newCat;
}

async function renameCategory(categoryId, newName) {
  const trimmed = newName.trim();
  if (!trimmed) { showMessage('カテゴリー名を入力してください。', 'error'); return false; }
  const data = await loadData();
  if (data.categories.some((c) => c.id !== categoryId && c.name === trimmed)) {
    showMessage(`「${trimmed}」というカテゴリーが既に存在します。`, 'error'); return false;
  }
  const cat = data.categories.find((c) => c.id === categoryId);
  if (!cat) return false;
  cat.name = trimmed;
  await saveData(data);
  return true;
}

async function deleteCategory(categoryId) {
  const data = await loadData();
  const idx  = data.categories.findIndex((c) => c.id === categoryId);
  if (idx === -1) return false;
  const cat = data.categories[idx];
  data.spaces.forEach((s) => { if (s.categoryId === categoryId) s.categoryId = null; });
  // 子カテゴリーを削除するカテゴリーの親に付け替える
  data.categories.forEach((c) => { if (c.parentId === categoryId) c.parentId = cat.parentId; });
  data.categories.splice(idx, 1);
  await saveData(data);
  return true;
}

async function moveSpaceToCategory(spaceId, categoryId) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return;
  space.categoryId = categoryId;
  space.updatedAt  = new Date().toISOString();
  await saveData(data);
}

async function toggleCategoryCollapsed(categoryId) {
  const data = await loadData();
  const cat  = data.categories.find((c) => c.id === categoryId);
  if (!cat) return;
  cat.collapsed = !cat.collapsed;
  await saveData(data);
}

// ============================================================
// アーカイブ操作
// ============================================================

async function archiveSpace(spaceId) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return false;
  space.archived  = true;
  space.updatedAt = new Date().toISOString();
  if (data.windowActiveSpaces) {
    for (const winId in data.windowActiveSpaces) {
      if (data.windowActiveSpaces[winId] === spaceId) {
        const nonArchived = data.spaces.filter((s) => !s.archived);
        data.windowActiveSpaces[winId] = nonArchived.length > 0 ? nonArchived[0].id : null;
      }
    }
  }
  if (getActiveSpaceId(data) === spaceId) {
    const nonArchived  = data.spaces.filter((s) => !s.archived);
    setActiveSpaceId(data, nonArchived.length > 0 ? nonArchived[0].id : null);
  }
  await saveData(data);
  return true;
}

async function unarchiveSpace(spaceId) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return false;
  space.archived  = false;
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

// ============================================================
// タブ操作ユーティリティ
// ============================================================

async function getWindowTabs() {
  try {
    const win = await chrome.windows.getCurrent();
    if (win) {
      g_dashboardWindowId = win.id;
    }
  } catch (err) {
    console.error('[PWM] ウィンドウID取得エラー:', err);
  }
  const query = g_dashboardWindowId !== null
    ? { windowId: g_dashboardWindowId }
    : { currentWindow: true };
  return new Promise((resolve) => {
    chrome.tabs.query(query, (tabs) => {
      if (chrome.runtime.lastError) { console.error('[PWM] タブ取得エラー:', chrome.runtime.lastError); resolve([]); return; }
      resolve(tabs || []);
    });
  });
}

function isSavableTab(tab) {
  if (!tab) return false;
  if (g_dashboardTabId !== null && tab.id === g_dashboardTabId) return false;
  return isSavableUrl(tab.url);
}

function isClosableTab(tab) {
  if (!tab) return false;
  if (g_dashboardTabId !== null && tab.id === g_dashboardTabId) return false;
  return true;
}

// ============================================================
// スペース CRUD
// ============================================================

async function createSpace(name) {
  const trimmed = name.trim();
  if (!trimmed) { showMessage('スペース名を入力してください。', 'error'); return null; }
  const data = await loadData();
  if (data.spaces.some((s) => s.name === trimmed)) {
    showMessage(`「${trimmed}」という名前のスペースが既に存在します。`, 'error'); return null;
  }
  const now      = new Date().toISOString();
  const newSpace = { id: generateId(), name: trimmed, createdAt: now, updatedAt: now, tabs: [], categoryId: null, archived: false, color: '' };
  data.spaces.push(newSpace);
  if (!getActiveSpaceId(data)) setActiveSpaceId(data, newSpace.id);
  await saveData(data);
  return newSpace;
}

async function renameSpace(spaceId, newName) {
  const trimmed = newName.trim();
  if (!trimmed) { showMessage('スペース名を入力してください。', 'error'); return false; }
  const data = await loadData();
  if (data.spaces.some((s) => s.id !== spaceId && s.name === trimmed)) {
    showMessage(`「${trimmed}」という名前のスペースが既に存在します。`, 'error'); return false;
  }
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) { showMessage('スペースが見つかりません。', 'error'); return false; }
  space.name      = trimmed;
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

async function deleteSpace(spaceId) {
  const data = await loadData();
  const idx  = data.spaces.findIndex((s) => s.id === spaceId);
  if (idx === -1) { showMessage('スペースが見つかりません。', 'error'); return null; }
  const deletedName = data.spaces[idx].name;
  data.spaces.splice(idx, 1);
  if (data.windowActiveSpaces) {
    for (const winId in data.windowActiveSpaces) {
      if (data.windowActiveSpaces[winId] === spaceId) {
        const nonArchived = data.spaces.filter((s) => !s.archived);
        data.windowActiveSpaces[winId] = nonArchived.length > 0 ? nonArchived[0].id : null;
      }
    }
  }
  if (getActiveSpaceId(data) === spaceId) {
    const nonArchived = data.spaces.filter((s) => !s.archived);
    setActiveSpaceId(data, nonArchived.length > 0 ? nonArchived[0].id : null);
  }
  await saveData(data);
  return { deletedName, newActiveSpaceId: getActiveSpaceId(data) };
}

async function saveCurrentTabsToSpace(spaceId) {
  const allTabs = await getWindowTabs();
  const savable = allTabs.filter(isSavableTab);
  const data    = await loadData();
  const space   = data.spaces.find((s) => s.id === spaceId);
  if (!space) return -1;

  // Chrome タブグループ情報を取得（API が使えない場合は無視）
  const chromeGroupsMap = {};
  const newTabGroups    = [];
  try {
    if (typeof chrome !== 'undefined' && chrome.tabGroups) {
      const queryOpts = g_dashboardWindowId !== null ? { windowId: g_dashboardWindowId } : {};
      const groups    = await chrome.tabGroups.query(queryOpts);
      groups.forEach((g) => {
        const color = CHROME_GROUP_COLOR_MAP[g.color] || '#7a8098';
        const ourId = generateId();
        chromeGroupsMap[g.id] = { ourId, color };
        newTabGroups.push({ id: ourId, _chromeId: g.id, name: g.title || '', color, collapsed: false });
      });
    }
  } catch (e) { /* tabGroups API 未サポートの場合は無視 */ }

  // 保存前に既存グループ情報を退避
  if (!Array.isArray(space.tabGroups)) space.tabGroups = [];

  // Chrome グループをグループ名で照合して再利用
  // （chrome.tabs.group() のたびに chromeGroupId が変わるため名前で照合する）
  if (newTabGroups.length > 0) {
    const existingByName = {};
    (space.tabGroups || []).forEach((g) => { if (g.name) existingByName[g.name] = g; });
    const trulyNew = [];
    newTabGroups.forEach((ng) => {
      const existing = ng.name ? existingByName[ng.name] : null;
      if (existing) {
        // 既存グループを更新して再利用
        existing.color = ng.color || existing.color;
        // chromeGroupsMap のキー（Chrome の数値ID）は ng._chromeId に保存してある
        if (ng._chromeId != null) chromeGroupsMap[ng._chromeId] = { ourId: existing.id, color: existing.color };
      } else {
        trulyNew.push(ng);
      }
    });
    space.tabGroups.push(...trulyNew);
  }

  // マージ後に有効グループIDセットと既存groupId→URLマップを構築
  const _validGroupIds = new Set(space.tabGroups.map((g) => g.id));
  const _existGidsByUrl = new Map();
  for (const t of space.tabs || []) {
    if (t.url && t.groupId && _validGroupIds.has(t.groupId)) {
      if (!_existGidsByUrl.has(t.url)) _existGidsByUrl.set(t.url, []);
      _existGidsByUrl.get(t.url).push(t.groupId);
    }
  }

  // タブを保存：Chrome グループ → ダッシュボードグループ の優先順で groupId を決定
  space.tabs = savable.map((t) => {
    const chromeGid = (t.groupId && t.groupId !== -1 && chromeGroupsMap[t.groupId])
      ? chromeGroupsMap[t.groupId].ourId : null;
    let dashGid = null;
    const list = _existGidsByUrl.get(t.url);
    if (list && list.length > 0) {
      dashGid = list.shift();
    }
    return {
      title:      t.title || t.url,
      url:        t.url,
      favIconUrl: t.favIconUrl || '',
      pinned:     t.pinned || false,
      groupId:    chromeGid || dashGid,
    };
  });

  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return space.tabs.length;
}

// ============================================================
// テーマカラー操作
// ============================================================

async function setSpaceColor(spaceId, color) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return;
  space.color     = color;
  space.updatedAt = new Date().toISOString();
  await saveData(data);
}

async function setCategoryColor(categoryId, color) {
  const data = await loadData();
  const cat  = data.categories.find((c) => c.id === categoryId);
  if (!cat) return;
  cat.color = color;
  await saveData(data);
}

async function setArchiveColor(color) {
  const data = await loadData();
  data.archiveColor = color;
  await saveData(data);
}

async function setSpaceIcon(spaceId, iconDataUrl) {
  const data = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (space) {
    space.icon = iconDataUrl;
    await saveData(data);
  }
}

async function setCategoryIcon(categoryId, iconDataUrl) {
  const data = await loadData();
  const cat = data.categories.find((c) => c.id === categoryId);
  if (cat) {
    cat.icon = iconDataUrl;
    await saveData(data);
  }
}

function resizeAndProcessImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 32;
      canvas.height = 32;
      
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 32, 32);
      const dataUrl = canvas.toDataURL('image/png');
      callback(dataUrl);
    };
    img.onerror = () => {
      console.error('[PWM] 画像の読み込みに失敗しました。');
      callback(null);
    };
    img.src = e.target.result;
  };
  reader.onerror = () => {
    console.error('[PWM] ファイルの読み込みに失敗しました。');
    callback(null);
  };
  reader.readAsDataURL(file);
}

// ============================================================
// タブグループ CRUD
// ============================================================

async function createTabGroup(spaceId, name, color = '') {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return null;
  if (!Array.isArray(space.tabGroups)) space.tabGroups = [];
  const group = { id: generateId(), name: (name || '').trim() || '新しいグループ', color: color || '', collapsed: false };
  space.tabGroups.push(group);
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return group;
}

async function deleteTabGroup(spaceId, groupId) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return false;
  (space.tabs || []).forEach((t) => { if (t.groupId === groupId) t.groupId = null; });
  space.tabGroups = (space.tabGroups || []).filter((g) => g.id !== groupId);
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

async function renameTabGroup(spaceId, groupId, newName) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return false;
  const group = (space.tabGroups || []).find((g) => g.id === groupId);
  if (!group) return false;
  group.name      = (newName || '').trim() || group.name;
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

async function setTabGroupColor(spaceId, groupId, color) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return;
  const group = (space.tabGroups || []).find((g) => g.id === groupId);
  if (!group) return;
  group.color     = color;
  space.updatedAt = new Date().toISOString();
  await saveData(data);
}

async function toggleTabGroupCollapsed(spaceId, groupId) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space) return;
  const group = (space.tabGroups || []).find((g) => g.id === groupId);
  if (!group) return;
  group.collapsed = !group.collapsed;
  await saveData(data);
  applyGroupsToChromeTabs(spaceId).catch(() => {});
}

async function moveTabToGroup(spaceId, tabIndex, groupId) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space || tabIndex < 0 || tabIndex >= (space.tabs || []).length) return false;
  space.tabs[tabIndex].groupId = groupId;
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}
async function reorderTabGroup(spaceId, draggedGroupId, targetGroupId, insertBefore) {
  try {
    const data  = await loadData();
    const space = data.spaces.find((s) => s.id === spaceId);
    if (!space || !Array.isArray(space.tabGroups)) return;
    const dragIdx   = space.tabGroups.findIndex((g) => g.id === draggedGroupId);
    const targetIdx = space.tabGroups.findIndex((g) => g.id === targetGroupId);
    if (dragIdx === -1 || targetIdx === -1 || draggedGroupId === targetGroupId) return;
    const [dragged]    = space.tabGroups.splice(dragIdx, 1);
    const newTargetIdx = space.tabGroups.findIndex((g) => g.id === targetGroupId);
    space.tabGroups.splice(insertBefore ? newTargetIdx : newTargetIdx + 1, 0, dragged);
    space.updatedAt = new Date().toISOString();
    await saveData(data);
    await renderAll();
    applyGroupsToChromeTabs(spaceId).catch(() => {});
  } catch (err) {
    showMessage('グループの並び替えに失敗しました。', 'error');
    console.error('[PWM] reorderTabGroup:', err);
  }
}

async function reorderTab(spaceId, draggedIndex, targetIndex, insertBefore) {
  try {
    const data  = await loadData();
    const space = data.spaces.find((s) => s.id === spaceId);
    if (!space || !Array.isArray(space.tabs)) return;
    if (draggedIndex === targetIndex) return;

    const dragTab = space.tabs[draggedIndex];
    if (!dragTab) return;

    const targetTab = space.tabs[targetIndex];
    if (!targetTab) return;

    // 移動先の所属グループIDをターゲットのタブに合わせる
    dragTab.groupId = targetTab.groupId;

    // 要素を移動
    space.tabs.splice(draggedIndex, 1);
    
    let newTargetIdx = space.tabs.indexOf(targetTab);
    if (newTargetIdx === -1) return;
    
    space.tabs.splice(insertBefore ? newTargetIdx : newTargetIdx + 1, 0, dragTab);

    space.updatedAt = new Date().toISOString();
    await saveData(data);
    await renderAll();
    await applyGroupsToChromeTabs(spaceId).catch(() => {});
  } catch (err) {
    showMessage('タブの並び替えに失敗しました。', 'error');
    console.error('[PWM] reorderTab:', err);
  }
}


// ============================================================
// スペース内タブアーカイブ CRUD
// ============================================================

async function archiveSpaceTab(spaceId, tabIndex) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space || tabIndex < 0 || tabIndex >= (space.tabs || []).length) return false;
  const [tab] = space.tabs.splice(tabIndex, 1);
  tab.archivedAt = new Date().toISOString();
  if (!Array.isArray(space.archivedTabs)) space.archivedTabs = [];
  space.archivedTabs.unshift(tab); // 新しいものを先頭に
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

async function unarchiveSpaceTab(spaceId, archiveIndex) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space || archiveIndex < 0 || archiveIndex >= (space.archivedTabs || []).length) return false;
  const [tab] = space.archivedTabs.splice(archiveIndex, 1);
  delete tab.archivedAt;
  space.tabs.push(tab);
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}

async function deleteArchivedSpaceTab(spaceId, archiveIndex) {
  const data  = await loadData();
  const space = data.spaces.find((s) => s.id === spaceId);
  if (!space || archiveIndex < 0 || archiveIndex >= (space.archivedTabs || []).length) return false;
  space.archivedTabs.splice(archiveIndex, 1);
  space.updatedAt = new Date().toISOString();
  await saveData(data);
  return true;
}





// ============================================================
// スペース切り替え
// ============================================================

async function switchToSpace(targetSpaceId) {
  // 全ての非同期データを先に取得し、loadData 〜 saveData の間に await が挟まらないようにする（競合回避）
  const settingsResult = await chrome.storage.local.get('pwm_settings');
  const autoSettings   = settingsResult['pwm_settings'] || {};
  const autoSaveOnSwitch = autoSettings.autoSaveOnSwitch ?? false;
  
  const allTabs     = await getWindowTabs();
  const savableTabs = allTabs.filter(isSavableTab);

  const data           = await loadData();
  const currentSpaceId = getActiveSpaceId(data);
  if (currentSpaceId === targetSpaceId) return data;

  // アーカイブ済みスペースからの切り替えはタブ保存をスキップする
  if (currentSpaceId && autoSaveOnSwitch) {
    const currentSpaceObj = data.spaces.find((s) => s.id === currentSpaceId);
    if (currentSpaceObj && !currentSpaceObj.archived) {
      const idx = data.spaces.findIndex((s) => s.id === currentSpaceId);
      if (idx !== -1 && savableTabs.length > 0) {
        // 既存の groupId を URL をキーに保持してから上書き保存する
        const _gidsByUrl = new Map();
        (data.spaces[idx].tabs || []).forEach((t) => {
          if (t.url && t.groupId) {
            if (!_gidsByUrl.has(t.url)) _gidsByUrl.set(t.url, []);
            _gidsByUrl.get(t.url).push(t.groupId);
          }
        });
        data.spaces[idx].tabs = savableTabs.map((t) => {
          let dashGid = null;
          const list = _gidsByUrl.get(t.url);
          if (list && list.length > 0) {
            dashGid = list.shift();
          }
          return {
            title:      t.title || t.url,
            url:        t.url,
            favIconUrl: t.favIconUrl || '',
            pinned:     t.pinned || false,
            groupId:    dashGid,
          };
        });
        data.spaces[idx].updatedAt = new Date().toISOString();
      }
    }
  }

  setActiveSpaceId(data, targetSpaceId);
  await saveData(data);

  const allTabsNow  = await getWindowTabs();
  const tabsToClose = allTabsNow.filter(isClosableTab);
  try {
    if (tabsToClose.length > 0) {
      await new Promise((resolve) => {
        chrome.tabs.remove(tabsToClose.map((t) => t.id), () => {
          void chrome.runtime.lastError; // ドラッグ中など操作不可の場合も握りつぶす
          resolve();
        });
      });
    }

    const targetSpace = data.spaces.find((s) => s.id === targetSpaceId);
    if (targetSpace && targetSpace.tabs.length > 0) {
      // グループごとに作成した Chrome タブIDを収集する
      const groupTabIds = {}; // ourGroupId -> [chromeTabId, ...]
      (targetSpace.tabGroups || []).forEach((g) => { groupTabIds[g.id] = []; });

      for (const savedTab of targetSpace.tabs) {
        if (!isRestorableUrl(savedTab.url)) continue;
        const newTab = await new Promise((resolve) => {
          chrome.tabs.create({ url: savedTab.url, windowId: g_dashboardWindowId, active: false, pinned: savedTab.pinned || false }, (tab) => {
            void chrome.runtime.lastError;
            resolve(tab);
          });
        });
        if (newTab && savedTab.groupId && groupTabIds[savedTab.groupId]) {
          groupTabIds[savedTab.groupId].push(newTab.id);
        }
      }

      // Chrome のタブグループを復元する（Promise API 使用）
      if (chrome.tabGroups) {
        for (const group of (targetSpace.tabGroups || [])) {
          const tabIds = (groupTabIds[group.id] || []).filter(Boolean);
          if (tabIds.length === 0) continue;
          try {
            const chromeGroupId = await chrome.tabs.group({ tabIds });
            if (chromeGroupId != null) {
              await chrome.tabGroups.update(chromeGroupId, {
                title:     group.name || '',
                color:     getChromeColorFromHex(group.color),
                collapsed: group.collapsed || false,
              });
            }
          } catch (e) {
            console.warn('[PWM] タブグループ復元エラー:', group.name, e);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[PWM] タブ操作エラー（ドラッグ中など）:', err);
  }

  return data;
}

// ============================================================
// レンダリング
// ============================================================

function renderSidebar(data) {
  const listEl  = document.getElementById('spaceList');
  const emptyEl = document.getElementById('sidebarEmpty');
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  const categories     = data.categories || [];
  const allSpaces      = data.spaces     || [];
  const activeSpaces   = allSpaces.filter((s) => !s.archived);
  const archivedSpaces = allSpaces.filter((s) =>  s.archived);

  emptyEl.style.display = 'none';

  const activeSpaceId = getActiveSpaceId(data);

  if (allSpaces.length === 0 && categories.length === 0) {
    emptyEl.style.display = 'block';
  } else {
    const allCategories = data.categories || [];
    const topLevelCats = allCategories.filter((c) => !c.parentId);
    topLevelCats.forEach((cat) => {
      listEl.appendChild(createCategorySection(cat, activeSpaces, activeSpaceId, 0, allCategories));
    });

    const uncatSpaces = activeSpaces.filter((s) => !s.categoryId);
    if (uncatSpaces.length > 0) {
      if (allCategories.length === 0) {
        // カテゴリーが存在しない場合は、フラットなリストとして直下に表示
        const spaceList = document.createElement('ul');
        spaceList.className = 'cat-group__spaces cat-group__spaces--root';
        uncatSpaces.forEach((s) => spaceList.appendChild(createSpaceListItem(s, s.id === activeSpaceId)));
        listEl.appendChild(spaceList);
      } else {
        // カテゴリーが存在する場合は、「未分類」グループにまとめる
        listEl.appendChild(createUncategorizedSection(uncatSpaces, activeSpaceId));
      }
    }
  }

  listEl.appendChild(createArchiveSection(archivedSpaces, activeSpaceId, data.archiveColor || ''));
}

function addDropTargetListeners(section, categoryId) {
  section.addEventListener('dragover', (e) => {
    // カテゴリーDnD中、またはスペースアイテム上（stopPropagationされた）はここに来ない
    if (g_draggedCategoryId) return;
    if (g_draggedSpaceId && e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      section.classList.add('cat-group--drop-target');
    }
  });
  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget)) section.classList.remove('cat-group--drop-target');
  });
  section.addEventListener('drop', (e) => {
    if (g_draggedCategoryId) return;
    e.preventDefault();
    section.classList.remove('cat-group--drop-target');
    const spaceId = e.dataTransfer.getData('text/plain');
    // スペースアイテム間にdropした場合はreorderSpaceが処理しstopPropagationしているので
    // ここには伝播してこない。カテゴリーヘッダーへのdropのみ処理する。
    if (spaceId && g_draggedSpaceId) handleDropSpaceToCategory(spaceId, categoryId);
  });
}

/**
 * カラードット要素を生成する（スペース・カテゴリー共用）
 * @param {string}   color        現在のカラー値
 * @param {string}   title        ツールチップ
 * @param {Function} onBtnClick   クリックハンドラ
 */
function createColorDot(color, title, onBtnClick, icon) {
  const dot = document.createElement('span');
  dot.className = 'color-dot' + (color || icon ? ' color-dot--set' : '');
  dot.title     = title;
  if (icon) {
    dot.classList.add('color-dot--image');
    dot.style.backgroundImage = `url(${icon})`;
    dot.style.backgroundColor = 'transparent';
  } else if (color) {
    dot.style.background = color;
  }
  dot.addEventListener('click', (e) => { e.stopPropagation(); onBtnClick(e); });
  return dot;
}

function getDescendantCategoryIds(categoryId, allCategories) {
  const result = [];
  allCategories.filter((c) => c.parentId === categoryId).forEach((child) => {
    result.push(child.id);
    result.push(...getDescendantCategoryIds(child.id, allCategories));
  });
  return result;
}

function buildFlatCategoryList(categories, parentId = null, depth = 0) {
  const result = [];
  categories.filter((c) => c.parentId === parentId).forEach((cat) => {
    result.push({ cat, depth });
    result.push(...buildFlatCategoryList(categories, cat.id, depth + 1));
  });
  return result;
}

function createCategorySection(category, activeSpaces, activeSpaceId, depth, allCategories) {
  const section = document.createElement('div');
  section.className = 'cat-group' + (category.color ? ' cat-group--colored' : '');
  section.dataset.categoryId = category.id;
  section.setAttribute('draggable', 'true');

  const header = document.createElement('div');
  header.className = 'cat-group__header';

  if (category.color) {
    section.style.setProperty('--cat-color', category.color);
    const _rgba = hexToRgba(category.color, 0.05);
    const _rgbaHover = hexToRgba(category.color, 0.08);
    const _rgbaSpaces = hexToRgba(category.color, 0.02);
    if (_rgba) header.style.setProperty('--cat-bg', _rgba);
    if (_rgbaHover) header.style.setProperty('--cat-bg-hover', _rgbaHover);
    if (_rgbaSpaces) section.style.setProperty('--cat-spaces-bg', _rgbaSpaces);
  }

  const toggle = document.createElement('span');
  toggle.className  = 'cat-group__toggle' + (category.collapsed ? ' cat-group__toggle--collapsed' : '');
  toggle.textContent = '▾';

  // カテゴリーカラードット（視覚インジケーターのみ、クリック不要）
  const colorDot = document.createElement('span');
  colorDot.className = 'color-dot' + (category.color || category.icon ? ' color-dot--set' : '');
  if (category.icon) {
    colorDot.classList.add('color-dot--image');
    colorDot.style.backgroundImage = `url(${category.icon})`;
    colorDot.style.backgroundColor = 'transparent';
  } else if (category.color) {
    colorDot.style.background = category.color;
  }

  const nameEl = document.createElement('span');
  nameEl.className  = 'cat-group__name';
  nameEl.textContent = category.name;
  if (category.color) nameEl.style.color = category.color;

  // countEl: このカテゴリー直下 + 子孫カテゴリーのスペース合計を表示
  const descIds = getDescendantCategoryIds(category.id, allCategories);
  const totalCount = activeSpaces.filter((s) => s.categoryId === category.id || descIds.includes(s.categoryId)).length;
  const countEl = document.createElement('span');
  countEl.className  = 'cat-group__count';
  countEl.textContent = totalCount;

  const actionsEl = document.createElement('div');
  actionsEl.className = 'cat-group__actions';

  // depth < 2 のときだけサブカテゴリー追加ボタンを追加
  if (depth < 2) {
    const addSubBtn = document.createElement('button');
    addSubBtn.type      = 'button';
    addSubBtn.className = 'cat-btn';
    addSubBtn.title     = 'サブカテゴリーを追加';
    addSubBtn.appendChild(createIcon('folder'));
    addSubBtn.addEventListener('click', (e) => { e.stopPropagation(); handleCreateSubcategory(category.id, category.name); });
    actionsEl.appendChild(addSubBtn);
  }

  const paletteBtn = document.createElement('button');
  paletteBtn.type      = 'button';
  paletteBtn.className = 'cat-btn';
  paletteBtn.title     = 'カテゴリーの色を変更';
  paletteBtn.appendChild(createIcon('palette'));
  paletteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showColorPicker(
      paletteBtn,
      category.color || '',
      async (val) => {
        await setCategoryColor(category.id, val);
        await renderAll();
      },
      async (iconDataUrl) => {
        await setCategoryIcon(category.id, iconDataUrl);
        await renderAll();
      },
      category.icon || ''
    );
  });

  const renameBtn = document.createElement('button');
  renameBtn.type      = 'button';
  renameBtn.className = 'cat-btn';
  renameBtn.title     = 'カテゴリー名を変更';
  renameBtn.appendChild(createIcon('edit'));
  renameBtn.addEventListener('click', (e) => { e.stopPropagation(); handleRenameCategory(category.id, category.name); });

  const deleteBtn = document.createElement('button');
  deleteBtn.type      = 'button';
  deleteBtn.className = 'cat-btn cat-btn--delete';
  deleteBtn.title     = '削除（スペースは未分類へ）';
  deleteBtn.appendChild(createIcon('trash'));
  deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteCategory(category.id, category.name); });

  actionsEl.appendChild(paletteBtn);
  actionsEl.appendChild(renameBtn);
  actionsEl.appendChild(deleteBtn);
  header.appendChild(toggle);
  header.appendChild(colorDot);
  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(actionsEl);
  header.addEventListener('click', () => handleToggleCategoryCollapse(category.id));

  // スペース一覧（このカテゴリー直属のみ）
  const catSpaces = activeSpaces.filter((s) => s.categoryId === category.id);
  const spaceList = document.createElement('ul');
  spaceList.className = 'cat-group__spaces';
  if (category.collapsed) spaceList.style.display = 'none';
  catSpaces.forEach((s) => spaceList.appendChild(createSpaceListItem(s, s.id === activeSpaceId, category.color || '')));

  section.appendChild(header);
  section.appendChild(spaceList);

  // 子カテゴリー（depth < 2 のときのみ）
  const children = allCategories.filter((c) => c.parentId === category.id);
  if (children.length > 0) {
    const childrenEl = document.createElement('div');
    childrenEl.className = 'cat-group__children';
    if (category.collapsed) childrenEl.style.display = 'none';
    children.forEach((child) => {
      childrenEl.appendChild(createCategorySection(child, activeSpaces, activeSpaceId, depth + 1, allCategories));
    });
    section.appendChild(childrenEl);
  }

  // カテゴリー並び替えのDnDリスナー
  section.addEventListener('dragstart', (e) => {
    // スペースアイテムのdragstartが伝播してきた場合は無視
    if (g_draggedSpaceId) return;
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', category.id);
    e.dataTransfer.effectAllowed = 'move';
    g_draggedCategoryId = category.id;
    g_draggedSpaceId    = null;
    setTimeout(() => section.classList.add('cat-group--dragging'), 0);
  });

  section.addEventListener('dragend', () => {
    section.classList.remove('cat-group--dragging');
    g_draggedCategoryId = null;
    clearInsertMarkers();
    document.querySelectorAll('.cat-group--drop-target').forEach((el) => el.classList.remove('cat-group--drop-target'));
  });

  section.addEventListener('dragover', (e) => {
    if (!g_draggedCategoryId || g_draggedCategoryId === category.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = section.getBoundingClientRect();
    const mid  = rect.top + rect.height / 2;
    section.classList.remove('cat-group--insert-before', 'cat-group--insert-after');
    if (e.clientY < mid) {
      section.classList.add('cat-group--insert-before');
    } else {
      section.classList.add('cat-group--insert-after');
    }
  });

  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget)) {
      section.classList.remove('cat-group--insert-before', 'cat-group--insert-after');
    }
  });

  section.addEventListener('drop', (e) => {
    if (!g_draggedCategoryId) return;
    e.preventDefault();
    e.stopPropagation();
    const insertBefore = section.classList.contains('cat-group--insert-before');
    section.classList.remove('cat-group--insert-before', 'cat-group--insert-after');
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== category.id) {
      reorderCategory(draggedId, category.id, insertBefore);
    }
  });

  addDropTargetListeners(section, category.id);
  return section;
}

function createUncategorizedSection(spaces, activeSpaceId) {
  const section = document.createElement('div');
  section.className = 'cat-group cat-group--uncategorized';

  const header = document.createElement('div');
  header.className = 'cat-group__header';

  const toggle = document.createElement('span');
  toggle.className  = 'cat-group__toggle';
  toggle.textContent = '▾';

  const nameEl = document.createElement('span');
  nameEl.className  = 'cat-group__name';
  nameEl.textContent = '未分類';

  const countEl = document.createElement('span');
  countEl.className  = 'cat-group__count';
  countEl.textContent = spaces.length;

  header.appendChild(toggle);
  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.addEventListener('click', () => {
    const list      = section.querySelector('.cat-group__spaces');
    const collapsed = list.style.display === 'none';
    list.style.display = collapsed ? '' : 'none';
    toggle.classList.toggle('cat-group__toggle--collapsed', !collapsed);
  });

  const spaceList = document.createElement('ul');
  spaceList.className = 'cat-group__spaces';
  spaces.forEach((s) => spaceList.appendChild(createSpaceListItem(s, s.id === activeSpaceId)));

  section.appendChild(header);
  section.appendChild(spaceList);
  addDropTargetListeners(section, null);
  return section;
}

function createArchiveSection(archivedSpaces, activeSpaceId, archiveColor = '') {
  const section = document.createElement('div');
  section.className = 'cat-group cat-group--archive' + (archiveColor ? ' cat-group--colored' : '');
  if (archiveColor) {
    section.style.setProperty('--cat-color', archiveColor);
    const _rgbaSpaces = hexToRgba(archiveColor, 0.02);
    if (_rgbaSpaces) section.style.setProperty('--cat-spaces-bg', _rgbaSpaces);
  }

  const header = document.createElement('div');
  header.className = 'cat-group__header';

  const toggle = document.createElement('span');
  toggle.className  = 'cat-group__toggle';
  toggle.textContent = '▾';

  const iconWrap = document.createElement('span');
  iconWrap.className = 'cat-group__archive-icon';
  if (archiveColor) iconWrap.style.color = archiveColor;
  iconWrap.appendChild(createIcon('archive'));

  const nameEl = document.createElement('span');
  nameEl.className  = 'cat-group__name';
  nameEl.textContent = 'アーカイブ';
  if (archiveColor) nameEl.style.color = archiveColor;

  const countEl = document.createElement('span');
  countEl.className  = 'cat-group__count';
  countEl.textContent = archivedSpaces.length;

  const actionsEl = document.createElement('div');
  actionsEl.className = 'cat-group__actions';

  const paletteBtn = document.createElement('button');
  paletteBtn.type      = 'button';
  paletteBtn.className = 'cat-btn';
  paletteBtn.title     = 'アーカイブの色を変更';
  paletteBtn.appendChild(createIcon('palette'));
  paletteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showColorPicker(paletteBtn, archiveColor, async (val) => {
      await setArchiveColor(val);
      await renderAll();
    });
  });

  actionsEl.appendChild(paletteBtn);
  header.appendChild(toggle);
  header.appendChild(iconWrap);
  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(actionsEl);
  header.addEventListener('click', () => {
    const list      = section.querySelector('.cat-group__spaces');
    const collapsed = list.style.display === 'none';
    list.style.display = collapsed ? '' : 'none';
    toggle.classList.toggle('cat-group__toggle--collapsed', !collapsed);
  });

  const spaceList = document.createElement('ul');
  spaceList.className = 'cat-group__spaces';

  if (archivedSpaces.length === 0) {
    const emptyEl = document.createElement('li');
    emptyEl.className   = 'archive-empty';
    emptyEl.textContent = 'アーカイブはありません';
    spaceList.appendChild(emptyEl);
  } else {
    archivedSpaces.forEach((s) => spaceList.appendChild(createArchiveSpaceItem(s, s.id === activeSpaceId)));
  }

  section.appendChild(header);
  section.appendChild(spaceList);
  return section;
}

function createArchiveSpaceItem(space, isActive) {
  const li = document.createElement('li');
  li.className   = 'space-item space-item--archived' + (isActive ? ' space-item--active' : '');
  li.dataset.spaceId = space.id;
  li.setAttribute('role', 'button');
  li.setAttribute('tabindex', '0');
  li.title = `${space.name}（アーカイブ済み / ${space.tabs ? space.tabs.length : 0} タブ）`;

  // カラードット（表示のみ、クリックでも変更可）
  const colorDot = createColorDot(
    space.color || '',
    'テーマカラー・アイコンを変更',
    (e) => showColorPicker(
      e.currentTarget,
      space.color || '',
      async (val) => {
        await setSpaceColor(space.id, val);
        await renderAll();
      },
      async (iconDataUrl) => {
        await setSpaceIcon(space.id, iconDataUrl);
        await renderAll();
      },
      space.icon || ''
    ),
    space.icon || ''
  );

  const nameEl = document.createElement('span');
  nameEl.className  = 'space-item__name';
  nameEl.textContent = space.name;

  const badge = document.createElement('span');
  badge.className  = 'space-item__badge';
  badge.textContent = space.tabs ? space.tabs.length : 0;

  li.appendChild(colorDot);
  li.appendChild(nameEl);
  li.appendChild(badge);

  li.addEventListener('click', () => handleViewArchivedSpace(space.id));
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewArchivedSpace(space.id); }
  });
  return li;
}

function createSpaceListItem(space, isActive, categoryColor = '') {
  const li = document.createElement('li');
  li.className   = 'space-item' + (isActive ? ' space-item--active' : '');
  li.dataset.spaceId = space.id;
  li.setAttribute('role', 'button');
  li.setAttribute('tabindex', '0');
  li.setAttribute('draggable', 'true');
  li.title = `${space.name}（${space.tabs ? space.tabs.length : 0} タブ）`;

  // スペースカラーをアクティブインジケーターに反映する（スペース色→カテゴリー色の順で優先）
  if (isActive) {
    const accentColor = space.color || categoryColor;
    if (accentColor) li.style.boxShadow = `inset 3px 0 0 ${accentColor}`;
  }

  // カラードット（スペース色→カテゴリー色の順で優先）
  const dotColor = space.color || categoryColor;
  if (dotColor) {
    const _rgba = hexToRgba(dotColor, 0.04);
    const _rgbaHover = hexToRgba(dotColor, 0.07);
    const _rgbaActive = hexToRgba(dotColor, 0.08);
    const _rgbaActiveHover = hexToRgba(dotColor, 0.12);
    if (_rgba) li.style.setProperty('--space-bg', _rgba);
    if (_rgbaHover) li.style.setProperty('--space-bg-hover', _rgbaHover);
    if (_rgbaActive) li.style.setProperty('--space-bg-active', _rgbaActive);
    if (_rgbaActiveHover) li.style.setProperty('--space-bg-active-hover', _rgbaActiveHover);
  }
  const colorDot = createColorDot(
    dotColor,
    'テーマカラー・アイコンを変更',
    (e) => showColorPicker(
      e.currentTarget,
      space.color || '',
      async (val) => {
        await setSpaceColor(space.id, val);
        await renderAll();
      },
      async (iconDataUrl) => {
        await setSpaceIcon(space.id, iconDataUrl);
        await renderAll();
      },
      space.icon || ''
    ),
    space.icon || ''
  );

  const nameEl = document.createElement('span');
  nameEl.className  = 'space-item__name';
  nameEl.textContent = space.name;

  const badge = document.createElement('span');
  badge.className  = 'space-item__badge';
  badge.textContent = space.tabs ? space.tabs.length : 0;

  li.appendChild(colorDot);
  li.appendChild(nameEl);
  li.appendChild(badge);

  li.addEventListener('click', () => handleSwitchSpace(space.id));
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSwitchSpace(space.id); }
  });

  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', space.id);
    e.dataTransfer.effectAllowed = 'move';
    g_draggedSpaceId    = space.id;
    g_draggedCategoryId = null;
    setTimeout(() => li.classList.add('space-item--dragging'), 0);
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('space-item--dragging');
    g_draggedSpaceId = null;
    clearInsertMarkers();
    document.querySelectorAll('.cat-group--drop-target').forEach((el) => el.classList.remove('cat-group--drop-target'));
  });

  li.addEventListener('dragover', (e) => {
    if (!g_draggedSpaceId || g_draggedSpaceId === space.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = li.getBoundingClientRect();
    const mid  = rect.top + rect.height / 2;
    li.classList.remove('space-item--insert-before', 'space-item--insert-after');
    if (e.clientY < mid) {
      li.classList.add('space-item--insert-before');
    } else {
      li.classList.add('space-item--insert-after');
    }
  });

  li.addEventListener('dragleave', (e) => {
    if (!li.contains(e.relatedTarget)) {
      li.classList.remove('space-item--insert-before', 'space-item--insert-after');
    }
  });

  li.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const insertBefore = li.classList.contains('space-item--insert-before');
    li.classList.remove('space-item--insert-before', 'space-item--insert-after');
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== space.id) {
      reorderSpace(draggedId, space.id, insertBefore);
    }
  });

  return li;
}

const DEFAULT_DOCUMENT_TITLE = 'タブまとめん改';

function updateDocumentTitle(activeSpace) {
  document.title = activeSpace
    ? `${activeSpace.name} | ダッシュボード`
    : DEFAULT_DOCUMENT_TITLE;
}

function renderMainArea(data) {
  const spaceTitleEl    = document.getElementById('spaceTitle');
  const spaceActionsEl  = document.getElementById('spaceActions');
  const mainControlsEl  = document.getElementById('mainControls');
  const noSpaceNoteEl   = document.getElementById('noSpaceNote');
  const badgeEl         = document.getElementById('spaceCategoryBadge');
  const archivedBadgeEl = document.getElementById('archivedBadge');
  const mainHeader      = document.querySelector('.main__header');

  const activeSpace = data.spaces.find((s) => s.id === getActiveSpaceId(data));

  if (!activeSpace) {
    const hasActive = data.spaces.some((s) => !s.archived);
    spaceTitleEl.textContent     = hasActive ? 'スペースを選択してください' : 'まずスペースを作成してください';
    spaceActionsEl.style.display = 'none';
    mainControlsEl.style.display = 'none';
    noSpaceNoteEl.style.display  = 'block';
    if (badgeEl)         badgeEl.style.display          = 'none';
    if (archivedBadgeEl) archivedBadgeEl.style.display  = 'none';
    if (mainHeader)      mainHeader.style.borderTop      = '';
    renderTabList([], '', [], null);
    updateDocumentTitle(null);
    return;
  }

  spaceTitleEl.textContent     = activeSpace.name;
  updateDocumentTitle(activeSpace);
  spaceActionsEl.style.display = 'flex';
  noSpaceNoteEl.style.display  = 'none';

  // テーマカラーをヘッダー上部のボーダーに反映する
  if (mainHeader) {
    mainHeader.style.borderTop = activeSpace.color
      ? `3px solid ${activeSpace.color}`
      : '';
  }

  const isArchived = !!activeSpace.archived;
  if (archivedBadgeEl) archivedBadgeEl.style.display = isArchived ? 'inline-flex' : 'none';

  if (badgeEl) {
    if (!isArchived) {
      const cat     = (data.categories || []).find((c) => c.id === activeSpace.categoryId);
      const catName = cat ? cat.name : '未分類';
      while (badgeEl.firstChild) badgeEl.removeChild(badgeEl.firstChild);
      badgeEl.appendChild(createIcon('folder'));
      badgeEl.appendChild(document.createTextNode(' ' + catName));
      badgeEl.style.display = 'inline-flex';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  const normalBtnIds  = ['btnChangeCategory', 'btnRenameSpace', 'btnArchiveSpace', 'btnDeleteSpace'];
  const archiveBtnIds = ['btnRestoreSpace', 'btnDeletePermanently'];
  normalBtnIds.forEach((id)  => { const el = document.getElementById(id); if (el) el.style.display = isArchived ? 'none' : ''; });
  archiveBtnIds.forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = isArchived ? '' : 'none'; });

  mainControlsEl.style.display = isArchived ? 'none' : 'flex';

  renderTabList(activeSpace.tabs || [], g_searchQuery, activeSpace.tabGroups || [], activeSpace.id, activeSpace.archivedTabs || []);
}



function createSpaceArchiveSection(archivedTabs, spaceId) {
  const section = document.createElement('div');
  section.className = 'space-archive';

  const header = document.createElement('div');
  header.className = 'space-archive__header';

  const toggle = document.createElement('span');
  toggle.className  = 'space-archive__toggle';
  toggle.textContent = '▾';

  const iconWrap = document.createElement('span');
  iconWrap.className = 'space-archive__icon';
  iconWrap.appendChild(createIcon('archive'));

  const nameEl = document.createElement('span');
  nameEl.className  = 'space-archive__name';
  nameEl.textContent = 'アーカイブ';

  const countEl = document.createElement('span');
  countEl.className  = 'space-archive__count';
  countEl.textContent = archivedTabs.length;

  header.appendChild(toggle);
  header.appendChild(iconWrap);
  header.appendChild(nameEl);
  header.appendChild(countEl);

  const body = document.createElement('div');
  body.className = 'space-archive__body';
  body.style.display = 'none'; // デフォルト折りたたみ
  toggle.classList.add('space-archive__toggle--collapsed');

  header.addEventListener('click', () => {
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? '' : 'none';
    toggle.classList.toggle('space-archive__toggle--collapsed', !collapsed);
  });

  archivedTabs.forEach((tab, archiveIndex) => {
    const row = document.createElement('div');
    row.className = 'space-archive__item';

    const favicon = document.createElement('img');
    favicon.className = 'tab-card__favicon';
    favicon.width = 14; favicon.height = 14; favicon.alt = '';
    if (tab.favIconUrl) {
      favicon.src = tab.favIconUrl;
      favicon.onerror = () => { favicon.style.visibility = 'hidden'; };
    } else {
      favicon.style.visibility = 'hidden';
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'space-archive__item-text';

    const titleEl = document.createElement('p');
    titleEl.className   = 'space-archive__item-title';
    titleEl.textContent = tab.title || tab.url;
    titleEl.title       = tab.title || '';

    const urlEl = document.createElement('p');
    urlEl.className   = 'space-archive__item-url';
    urlEl.textContent = tab.url;
    urlEl.title       = tab.url;

    textWrap.appendChild(titleEl);
    textWrap.appendChild(urlEl);

    // 復元ボタン
    const restoreBtn = document.createElement('button');
    restoreBtn.type      = 'button';
    restoreBtn.className = 'space-archive__restore';
    restoreBtn.title     = 'アクティブなタブに戻す';
    restoreBtn.textContent = '↩';
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleUnarchiveSpaceTab(spaceId, archiveIndex);
    });

    // 削除ボタン
    const delBtn = document.createElement('button');
    delBtn.type      = 'button';
    delBtn.className = 'space-archive__delete';
    delBtn.title     = '完全削除';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteArchivedSpaceTab(spaceId, archiveIndex);
    });

    row.appendChild(favicon);
    row.appendChild(textWrap);
    row.appendChild(restoreBtn);
    row.appendChild(delBtn);
    body.appendChild(row);
  });

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

// ============================================================
// ビューモード
// ============================================================

function applyViewMode(mode) {
  g_viewMode = mode;
  const listEl = document.getElementById('tabList');
  if (listEl) {
    listEl.classList.toggle('tab-list--card-view', mode === 'card');
  }
  const btnList = document.getElementById('btnViewList');
  const btnCard = document.getElementById('btnViewCard');
  if (btnList) btnList.classList.toggle('view-toggle__btn--active', mode === 'list');
  if (btnCard) btnCard.classList.toggle('view-toggle__btn--active', mode === 'card');
}

function renderTabList(tabs, searchQuery, tabGroups, spaceId, archivedTabs) {
  const listEl      = document.getElementById('tabList');
  const emptyNoteEl = document.getElementById('emptyTabNote');
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

  const query    = (searchQuery || '').toLowerCase().trim();
  const indexed  = tabs.map((tab, i) => ({ tab, originalIndex: i }));
  const filtered = indexed.filter(({ tab }) => {
    if (!query) return true;
    return (tab.title && tab.title.toLowerCase().includes(query)) ||
           (tab.url   && tab.url.toLowerCase().includes(query));
  });

  if (filtered.length === 0) {
    emptyNoteEl.style.display = tabs.length === 0 ? 'block' : 'none';
    if (tabs.length > 0) {
      const p = document.createElement('p');
      p.className   = 'empty-note';
      p.textContent = `「${searchQuery}」に一致するタブが見つかりませんでした。`;
      listEl.appendChild(p);
    }
    return;
  }

  emptyNoteEl.style.display = 'none';

  const groups = Array.isArray(tabGroups) ? tabGroups : [];

  if (groups.length === 0) {
    // グループなし: 従来どおりフラット表示
    filtered.forEach(({ tab, originalIndex }) => listEl.appendChild(createTabCard(tab, originalIndex)));
    // アーカイブセクション
    if (archivedTabs && archivedTabs.length > 0) {
      listEl.appendChild(createSpaceArchiveSection(archivedTabs, spaceId));
    }
    return;
  }

  // グループモード
  const ungrouped = filtered.filter(({ tab }) => !tab.groupId);
  const byGroup   = {};
  groups.forEach((g) => { byGroup[g.id] = []; });
  filtered.forEach(({ tab, originalIndex }) => {
    if (tab.groupId && byGroup[tab.groupId]) byGroup[tab.groupId].push({ tab, originalIndex });
  });

  // グループなしタブ → 上部に表示
  listEl.appendChild(createUngroupedSection(ungrouped, spaceId));

  // 各グループ
  groups.forEach((group) => {
    listEl.appendChild(createTabGroupSection(group, byGroup[group.id] || [], spaceId));
  });

  // アーカイブセクション
  if (archivedTabs && archivedTabs.length > 0) {
    listEl.appendChild(createSpaceArchiveSection(archivedTabs, spaceId));
  }
}

function createUngroupedSection(tabItems, spaceId) {
  const section = document.createElement('div');
  section.className = 'tab-ungrouped';

  tabItems.forEach(({ tab, originalIndex }) => {
    section.appendChild(createTabCard(tab, originalIndex));
  });

  if (tabItems.length === 0) {
    const hint = document.createElement('p');
    hint.className   = 'tab-ungrouped__hint';
    hint.textContent = 'ここにドロップするとグループを外せます';
    section.appendChild(hint);
  }

  // ドロップ → グループなしに移動
  section.addEventListener('dragover', (e) => {
    if (!g_draggedTabInfo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    section.classList.add('tab-ungrouped--drop-target');
  });
  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget)) section.classList.remove('tab-ungrouped--drop-target');
  });
  section.addEventListener('drop', (e) => {
    e.preventDefault();
    section.classList.remove('tab-ungrouped--drop-target');
    if (!g_draggedTabInfo) return;
    handleMoveTabToGroup(spaceId, g_draggedTabInfo.originalIndex, null);
  });

  return section;
}

function createTabGroupSection(group, groupTabs, spaceId) {
  const section = document.createElement('div');
  section.className = 'tab-group';
  section.dataset.groupId = group.id;
  const _grpHex = toDisplayHex(group.color);
  if (_grpHex) section.style.setProperty('--group-color', _grpHex);

  // ヘッダー
  const header = document.createElement('div');
  header.className = 'tab-group__header';

  const colorBar = document.createElement('div');
  colorBar.className = 'tab-group__color-bar';
  if (_grpHex) colorBar.style.background = _grpHex;

  const toggle = document.createElement('span');
  toggle.className  = 'tab-group__toggle' + (group.collapsed ? ' tab-group__toggle--collapsed' : '');
  toggle.textContent = '▾';

  const nameEl = document.createElement('span');
  nameEl.className  = 'tab-group__name';
  nameEl.textContent = group.name || '名称未設定グループ';
  if (_grpHex) nameEl.style.color = _grpHex;

  const countEl = document.createElement('span');
  countEl.className  = 'tab-group__count';
  countEl.textContent = groupTabs.length;

  const actionsEl = document.createElement('div');
  actionsEl.className = 'tab-group__actions';

  // カラーボタン
  const paletteBtn = document.createElement('button');
  paletteBtn.type      = 'button';
  paletteBtn.className = 'tab-group__action-btn';
  paletteBtn.title     = 'グループの色を変更';
  paletteBtn.appendChild(createIcon('palette'));
  paletteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openTabGroupModal('グループの色を変更', group.name, group.color || '').then(async (result) => {
      if (!result) return;
      if (result.name) await renameTabGroup(spaceId, group.id, result.name);
      await setTabGroupColor(spaceId, group.id, result.color);
      await renderAll();
      applyGroupsToChromeTabs(spaceId).catch(() => {});
    });
  });

  // リネームボタン
  const renameBtn = document.createElement('button');
  renameBtn.type      = 'button';
  renameBtn.className = 'tab-group__action-btn';
  renameBtn.title     = 'グループ名を変更';
  renameBtn.appendChild(createIcon('edit'));
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleRenameTabGroup(spaceId, group.id, group.name, group.color || '');
  });

  // 削除ボタン
  const deleteBtn = document.createElement('button');
  deleteBtn.type      = 'button';
  deleteBtn.className = 'tab-group__action-btn tab-group__action-btn--delete';
  deleteBtn.title     = 'グループを削除（タブはグループなしに移動）';
  deleteBtn.appendChild(createIcon('trash'));
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteTabGroup(spaceId, group.id, group.name);
  });

  actionsEl.appendChild(paletteBtn);
  actionsEl.appendChild(renameBtn);
  actionsEl.appendChild(deleteBtn);

  // ドラッグハンドル
  const dragHandle = document.createElement('span');
  dragHandle.className  = 'tab-group__drag-handle';
  dragHandle.textContent = '⠿';
  dragHandle.title       = 'ドラッグして並び替え';

  header.appendChild(colorBar);
  header.appendChild(dragHandle);
  header.appendChild(toggle);
  header.appendChild(nameEl);
  header.appendChild(countEl);
  header.appendChild(actionsEl);

  // 折りたたみ
  header.addEventListener('click', async () => {
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? '' : 'none';
    toggle.classList.toggle('tab-group__toggle--collapsed', !collapsed);
    await toggleTabGroupCollapsed(spaceId, group.id);
  });

  // ボディ（タブ一覧）
  const body = document.createElement('div');
  body.className = 'tab-group__body';
  if (group.collapsed) body.style.display = 'none';
  groupTabs.forEach(({ tab, originalIndex }) => {
    body.appendChild(createTabCard(tab, originalIndex, group.color || '', _grpHex));
  });

  // ドロップゾーン（ヘッダー + ボディ両方）
  function addGroupDropListeners(el) {
    el.addEventListener('dragover', (e) => {
      if (!g_draggedTabInfo) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      section.classList.add('tab-group--drop-target');
    });
    el.addEventListener('dragleave', (e) => {
      if (!section.contains(e.relatedTarget)) section.classList.remove('tab-group--drop-target');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      section.classList.remove('tab-group--drop-target');
      if (!g_draggedTabInfo) return;
      handleMoveTabToGroup(spaceId, g_draggedTabInfo.originalIndex, group.id);
    });
  }
  addGroupDropListeners(header);
  addGroupDropListeners(body);

  // グループ並び替えDnD
  // mousedown でハンドルを掴んだ時だけ section を draggable にする
  let _handleDown = false;
  dragHandle.addEventListener('mousedown', () => {
    _handleDown = true;
    section.setAttribute('draggable', 'true');
  });
  document.addEventListener('mouseup', () => {
    _handleDown = false;
    // drag が起きなかった場合も draggable を解除
    if (!g_draggedGroupInfo) section.removeAttribute('draggable');
  });

  section.addEventListener('dragstart', (e) => {
    if (!_handleDown || g_draggedTabInfo) { e.preventDefault(); return; }
    e.stopPropagation();
    g_draggedGroupInfo = { spaceId, groupId: group.id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', group.id);
    setTimeout(() => section.classList.add('tab-group--dragging'), 0);
  });
  section.addEventListener('dragend', () => {
    _handleDown = false;
    section.removeAttribute('draggable');
    section.classList.remove('tab-group--dragging', 'tab-group--insert-before', 'tab-group--insert-after');
    g_draggedGroupInfo = null;
    document.querySelectorAll('.tab-group--insert-before, .tab-group--insert-after')
      .forEach((el) => el.classList.remove('tab-group--insert-before', 'tab-group--insert-after'));
  });
  section.addEventListener('dragover', (e) => {
    if (!g_draggedGroupInfo || g_draggedGroupInfo.groupId === group.id || g_draggedTabInfo) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = section.getBoundingClientRect();
    section.classList.remove('tab-group--insert-before', 'tab-group--insert-after');
    section.classList.add(e.clientY < rect.top + rect.height / 2
      ? 'tab-group--insert-before' : 'tab-group--insert-after');
  });
  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget))
      section.classList.remove('tab-group--insert-before', 'tab-group--insert-after');
  });
  section.addEventListener('drop', (e) => {
    if (!g_draggedGroupInfo || g_draggedGroupInfo.groupId === group.id || g_draggedTabInfo) return;
    e.preventDefault();
    e.stopPropagation();
    const before = section.classList.contains('tab-group--insert-before');
    section.classList.remove('tab-group--insert-before', 'tab-group--insert-after');
    reorderTabGroup(g_draggedGroupInfo.spaceId, g_draggedGroupInfo.groupId, group.id, before);
  });

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

function createTabCard(tab, originalIndex, groupColor = '', groupColorHex = '') {
  const card = document.createElement('div');
  card.className = 'tab-card';
  card.title = 'クリックで開く / ドラッグでグループ移動';
  card.setAttribute('draggable', 'true');
  const _cardColorHex = groupColorHex || toDisplayHex(groupColor);
  if (_cardColorHex) {
    card.style.borderLeft = `3px solid ${_cardColorHex}`;
    const _rgba = hexToRgba(_cardColorHex, 0.05);
    if (_rgba) card.style.background = `linear-gradient(${_rgba}, ${_rgba}), var(--card-bg)`;
  }

  card.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    g_draggedTabInfo = { originalIndex, groupId: tab.groupId || null };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(originalIndex));
    setTimeout(() => card.classList.add('tab-card--dragging'), 0);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('tab-card--dragging');
    g_draggedTabInfo = null;
    document.querySelectorAll('.tab-group--drop-target, .tab-ungrouped--drop-target')
      .forEach((el) => el.classList.remove('tab-group--drop-target', 'tab-ungrouped--drop-target'));
  });

  card.addEventListener('click', (e) => {
    if (e.target.tagName.toLowerCase() === 'input' || e.target.closest('.tab-card__delete')) return;
    if (tab.url) {
      chrome.tabs.create({ url: tab.url, active: true }).catch(() => {});
    }
  });

  const checkbox = document.createElement('input');
  checkbox.type      = 'checkbox';
  checkbox.className = 'tab-card__checkbox';
  checkbox.setAttribute('aria-label', tab.title || tab.url);

  const favicon = document.createElement('img');
  favicon.className = 'tab-card__favicon';
  favicon.width = 16; favicon.height = 16; favicon.alt = '';
  if (tab.favIconUrl) {
    favicon.src     = tab.favIconUrl;
    favicon.onerror = () => { favicon.style.visibility = 'hidden'; };
  } else {
    favicon.style.visibility = 'hidden';
  }

  const textWrap = document.createElement('div');
  textWrap.className = 'tab-card__text';

  const titleEl = document.createElement('p');
  titleEl.className   = 'tab-card__title';
  titleEl.textContent = tab.title || tab.url;
  titleEl.title       = tab.title || '';

  const urlEl = document.createElement('p');
  urlEl.className   = 'tab-card__url';
  urlEl.textContent = tab.url;
  urlEl.title       = tab.url;

  textWrap.appendChild(titleEl);
  textWrap.appendChild(urlEl);

  const archiveBtn = document.createElement('button');
  archiveBtn.type      = 'button';
  archiveBtn.className = 'tab-card__archive';
  archiveBtn.setAttribute('aria-label', 'このタブをアーカイブ');
  archiveBtn.title     = 'アーカイブ（タブバーに表示しない）';
  archiveBtn.appendChild(createIcon('archive'));
  archiveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    card.style.opacity = '0.4';
    card.style.pointerEvents = 'none';
    handleArchiveSpaceTab(originalIndex).catch(() => {
      card.style.opacity = '';
      card.style.pointerEvents = '';
    });
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type        = 'button';
  deleteBtn.className   = 'tab-card__delete';
  deleteBtn.textContent = '×';
  deleteBtn.setAttribute('aria-label', 'このタブを削除');
  deleteBtn.title = 'このタブを削除';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    card.style.opacity = '0.4';
    card.style.pointerEvents = 'none';
    handleDeleteTab(originalIndex).catch(() => {
      card.style.opacity = '';
      card.style.pointerEvents = '';
    });
  });

  card.appendChild(checkbox);
  card.appendChild(favicon);
  card.appendChild(textWrap);
  card.appendChild(archiveBtn);
  card.appendChild(deleteBtn);

  // ドラッグ＆ドロップによる並び替えイベント
  card.addEventListener('dragover', (e) => {
    if (!g_draggedTabInfo || g_draggedTabInfo.originalIndex === originalIndex) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = card.getBoundingClientRect();
    const isGrid = g_viewMode === 'card' && tab.groupId;
    const before = isGrid
      ? (e.clientX < rect.left + rect.width / 2)
      : (e.clientY < rect.top + rect.height / 2);

    card.classList.toggle('tab-card--insert-before', before);
    card.classList.toggle('tab-card--insert-after', !before);
  });

  card.addEventListener('dragleave', () => {
    card.classList.remove('tab-card--insert-before', 'tab-card--insert-after');
  });

  card.addEventListener('drop', async (e) => {
    if (!g_draggedTabInfo || g_draggedTabInfo.originalIndex === originalIndex) return;
    e.preventDefault();
    e.stopPropagation();
    card.classList.remove('tab-card--insert-before', 'tab-card--insert-after');

    const rect = card.getBoundingClientRect();
    const isGrid = g_viewMode === 'card' && tab.groupId;
    const before = isGrid
      ? (e.clientX < rect.left + rect.width / 2)
      : (e.clientY < rect.top + rect.height / 2);

    const data = await loadData();
    const spaceId = getActiveSpaceId(data);
    if (!spaceId) return;

    await reorderTab(spaceId, g_draggedTabInfo.originalIndex, originalIndex, before);
  });

  return card;
}

async function renderAll() {
  const mySeq = ++g_renderSeq;
  try {
    const data = await loadData();
    if (mySeq !== g_renderSeq) return;  // 後発の renderAll() が走っている場合はこの描画を捨てる
    renderSidebar(data);
    renderMainArea(data);
  } catch (err) {
    showMessage('データの読み込みに失敗しました。', 'error');
    console.error('[PWM] renderAll エラー:', err);
  }
}

// ============================================================
// イベントハンドラ
// ============================================================

async function handleCreateSpace() {
  const name = window.prompt('新しいスペースの名前を入力してください:');
  if (name === null) return;
  try {
    const s = await createSpace(name);
    if (!s) return;
    showMessage(`スペース「${s.name}」を作成しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('スペースの作成に失敗しました。', 'error');
    console.error('[PWM] handleCreateSpace エラー:', err);
  }
}

async function handleRenameSpace() {
  const data   = await loadData();
  const active = data.spaces.find((s) => s.id === getActiveSpaceId(data));
  if (!active) return;
  const newName = window.prompt('新しいスペース名を入力してください:', active.name);
  if (newName === null) return;
  try {
    if (!await renameSpace(active.id, newName)) return;
    showMessage('スペース名を変更しました。', 'success');
    await renderAll();
  } catch (err) {
    showMessage('スペース名の変更に失敗しました。', 'error');
    console.error('[PWM] handleRenameSpace エラー:', err);
  }
}

async function handleDeleteSpace() {
  const data   = await loadData();
  const active = data.spaces.find((s) => s.id === getActiveSpaceId(data));
  if (!active) return;
  if (!window.confirm(`スペース「${active.name}」を削除しますか？\n保存されているタブ情報もすべて削除されます。`)) return;
  try {
    const result = await deleteSpace(active.id);
    if (!result) return;
    showMessage(`スペース「${result.deletedName}」を削除しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('スペースの削除に失敗しました。', 'error');
    console.error('[PWM] handleDeleteSpace エラー:', err);
  }
}

async function handleArchiveSpace() {
  const data   = await loadData();
  const active = data.spaces.find((s) => s.id === getActiveSpaceId(data));
  if (!active) return;
  if (!window.confirm(`スペース「${active.name}」をアーカイブしますか？\nアーカイブ後もデータは保持され、復元できます。`)) return;
  try {
    if (!await archiveSpace(active.id)) return;
    showMessage(`スペース「${active.name}」をアーカイブしました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('アーカイブに失敗しました。', 'error');
    console.error('[PWM] handleArchiveSpace エラー:', err);
  }
}

async function handleRestoreSpaceFromMain() {
  const data   = await loadData();
  const active = data.spaces.find((s) => s.id === getActiveSpaceId(data));
  if (!active || !active.archived) return;
  try {
    if (!await unarchiveSpace(active.id)) return;
    showMessage(`スペース「${active.name}」を復元しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('復元に失敗しました。', 'error');
    console.error('[PWM] handleRestoreSpaceFromMain エラー:', err);
  }
}

async function handleDeletePermanentlyFromMain() {
  const data   = await loadData();
  const active = data.spaces.find((s) => s.id === getActiveSpaceId(data));
  if (!active) return;
  if (!window.confirm(`スペース「${active.name}」を完全に削除しますか？\nこの操作は元に戻せません。`)) return;
  try {
    const result = await deleteSpace(active.id);
    if (!result) return;
    showMessage(`スペース「${result.deletedName}」を完全に削除しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('削除に失敗しました。', 'error');
    console.error('[PWM] handleDeletePermanentlyFromMain エラー:', err);
  }
}

async function handleViewArchivedSpace(spaceId) {
  const data = await loadData();
  if (getActiveSpaceId(data) === spaceId) return;
  setActiveSpaceId(data, spaceId);
  await saveData(data);
  await renderAll();
}

async function handleSaveTabs() {
  if (g_isSwitching) return;
  const data = await loadData();
  const activeSpaceId = getActiveSpaceId(data);
  if (!activeSpaceId) {
    showMessage('スペースが選択されていません。スペースを選択または作成してください。', 'error'); return;
  }
  try {
    const count = await saveCurrentTabsToSpace(activeSpaceId);
    if (count === -1) { showMessage('スペースが見つかりません。', 'error'); return; }
    if (count === 0)  { showMessage('保存できるタブがありませんでした（chrome:// 系のタブは保存対象外です）。', 'error'); return; }
    showMessage(`${count} 件のタブを保存しました。`, 'success');
    await renderAll();
    // Chrome タブバーにグループを即時反映
    applyGroupsToChromeTabs(activeSpaceId).catch(() => {});
  } catch (err) {
    showMessage('タブの保存に失敗しました。', 'error');
    console.error('[PWM] handleSaveTabs エラー:', err);
  }
}

async function confirmSpaceSwitch(data, targetSpaceId) {
  const allTabs     = await getWindowTabs();
  const tabsToClose = allTabs.filter(isClosableTab);
  if (tabsToClose.length === 0) return true;

  const savableCount     = allTabs.filter(isSavableTab).length;
  const settingsResult   = await chrome.storage.local.get('pwm_settings');
  const autoSaveOnSwitch = (settingsResult['pwm_settings'] || {}).autoSaveOnSwitch ?? false;
  const currentSpaceId   = getActiveSpaceId(data);
  const currentSpace     = currentSpaceId ? data.spaces.find((s) => s.id === currentSpaceId) : null;
  const targetSpace      = data.spaces.find((s) => s.id === targetSpaceId);
  const targetName       = targetSpace ? targetSpace.name : '';

  const willSave = savableCount > 0
    && currentSpaceId
    && autoSaveOnSwitch
    && currentSpace
    && !currentSpace.archived;

  if (willSave) return true;

  let message;
  if (!currentSpace) {
    message = '現在開いているタブはどのスペースにも保存されていません。\n';
    message += '切り替えると、これらのタブは保存されずに閉じられます。\n\n';
  } else if (!autoSaveOnSwitch) {
    message = '「切り替え時の自動保存」がオフです。\n';
    message += `現在のタブは「${currentSpace.name}」に保存されず、閉じられます。\n\n`;
  } else if (currentSpace.archived) {
    message = 'アーカイブ済みのスペースから切り替えるため、現在のタブは保存されずに閉じられます。\n\n';
  } else {
    message = '現在開いているタブは保存されずに閉じられます。\n\n';
  }
  message += `スペース「${targetName}」に切り替えますか？`;

  return window.confirm(message);
}

async function handleSwitchSpace(targetSpaceId) {
  // 切り替え中なら最新のリクエストだけ記録して即リターン
  if (g_isSwitching) {
    g_pendingSwitch = targetSpaceId;
    return;
  }

  try {
    const data = await loadData();
    const targetSpace = data.spaces.find((s) => s.id === targetSpaceId);
    if (!targetSpace) return;

    // 既にそのスペースにいる場合はスキップ
    if (getActiveSpaceId(data) === targetSpaceId) return;
  } catch (err) {
    console.error('[PWM] 切り替え前処理エラー:', err);
    return;
  }

  // await より前に同期的にフラグを立てることで
  // イベントループが他のクリックを処理しても二重起動を防ぐ
  g_isSwitching = true;

  try {
    let currentTarget = targetSpaceId;

    while (currentTarget) {
      const target    = currentTarget;
      currentTarget   = null;

      const data = await loadData();

      // 既にそのスペースにいる場合はスキップして次のペンディングを確認する
      if (getActiveSpaceId(data) === target) {
        currentTarget   = g_pendingSwitch;
        g_pendingSwitch = null;
        continue;
      }

      const proceed = await confirmSpaceSwitch(data, target);
      if (!proceed) {
        g_pendingSwitch = null;
        break;
      }

      const spaceListEl = document.getElementById('spaceList');
      spaceListEl.classList.add('space-list--switching');

      const targetSpace = data.spaces.find((s) => s.id === target);
      const targetName  = targetSpace ? targetSpace.name : '';

      document.querySelectorAll('.space-item').forEach((el) => {
        el.classList.toggle('space-item--active', el.dataset.spaceId === target);
      });

      try {
        const savedData = await switchToSpace(target);
        showMessage(`スペース「${targetName}」に切り替えました。`, 'success');
        g_searchQuery = '';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        // switchToSpace が返したデータで同期描画し、並走中の renderAll() を無効化する
        ++g_renderSeq;
        renderSidebar(savedData);
        renderMainArea(savedData);
      } catch (err) {
        showMessage('スペースの切り替えに失敗しました。', 'error');
        console.error('[PWM] handleSwitchSpace エラー:', err);
        await renderAll();
      } finally {
        spaceListEl.classList.remove('space-list--switching');
      }

      // 今の切り替え中に積まれた最新リクエストを次ループで処理する
      currentTarget   = g_pendingSwitch;
      g_pendingSwitch = null;
    }
  } finally {
    g_isSwitching = false;
  }
}

async function handleDeleteTab(originalIndex) {
  if (g_isSwitching) return;
  try {
    const data        = await loadData();
    const activeSpace = data.spaces.find((s) => s.id === getActiveSpaceId(data));
    if (!activeSpace) return;
    if (originalIndex < 0 || originalIndex >= activeSpace.tabs.length) return;
    activeSpace.tabs.splice(originalIndex, 1);
    activeSpace.updatedAt = new Date().toISOString();
    await saveData(data);
    // renderAll() はシーケンス競合で無効化されることがあるため、
    // タブリストだけ直接再描画してから sidebar カウントを更新する
    renderTabList(activeSpace.tabs, g_searchQuery);
    renderAll(); // サイドバーのバッジ数更新（await しない）
  } catch (err) {
    showMessage('タブの削除に失敗しました。', 'error');
    console.error('[PWM] handleDeleteTab エラー:', err);
  }
}

async function handleSearch(query) {
  g_searchQuery = query;
  try {
    const data        = await loadData();
    const activeSpace = data.spaces.find((s) => s.id === getActiveSpaceId(data));
    renderTabList(
      activeSpace ? activeSpace.tabs         || [] : [],
      g_searchQuery,
      activeSpace ? activeSpace.tabGroups    || [] : [],
      activeSpace ? activeSpace.id              : null,
      activeSpace ? activeSpace.archivedTabs || [] : [],
    );
  } catch (err) {
    console.error('[PWM] handleSearch エラー:', err);
  }
}

async function handleDropSpaceToCategory(spaceId, categoryId) {
  try {
    const data  = await loadData();
    const space = data.spaces.find((s) => s.id === spaceId);
    if (!space || space.categoryId === categoryId) return;
    await moveSpaceToCategory(spaceId, categoryId);
    const catName = categoryId
      ? ((data.categories || []).find((c) => c.id === categoryId) || {}).name || categoryId
      : '未分類';
    showMessage(`「${space.name}」を「${catName}」に移動しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('カテゴリーの移動に失敗しました。', 'error');
    console.error('[PWM] handleDropSpaceToCategory エラー:', err);
  }
}

// ============================================================
// 並び替えハンドラ
// ============================================================

async function reorderSpace(draggedSpaceId, targetSpaceId, insertBefore) {
  try {
    const data = await loadData();
    const dragIdx = data.spaces.findIndex((s) => s.id === draggedSpaceId);
    const targetIdx = data.spaces.findIndex((s) => s.id === targetSpaceId);
    if (dragIdx === -1 || targetIdx === -1 || draggedSpaceId === targetSpaceId) return;

    const draggedSpace = data.spaces.splice(dragIdx, 1)[0];
    // targetのindexは削除後に再計算
    const newTargetIdx = data.spaces.findIndex((s) => s.id === targetSpaceId);
    const targetSpace = data.spaces[newTargetIdx];

    // カテゴリーをターゲットと同じに更新
    draggedSpace.categoryId = targetSpace.categoryId;
    draggedSpace.updatedAt  = new Date().toISOString();

    const insertIdx = insertBefore ? newTargetIdx : newTargetIdx + 1;
    data.spaces.splice(insertIdx, 0, draggedSpace);

    await saveData(data);
    await renderAll();
  } catch (err) {
    showMessage('並び替えに失敗しました。', 'error');
    console.error('[PWM] reorderSpace エラー:', err);
  }
}

async function reorderCategory(draggedCategoryId, targetCategoryId, insertBefore) {
  try {
    const data = await loadData();
    const dragCat   = data.categories.find((c) => c.id === draggedCategoryId);
    const targetCat = data.categories.find((c) => c.id === targetCategoryId);
    if (!dragCat || !targetCat || draggedCategoryId === targetCategoryId) return;

    // 同一親内の移動のみ許可
    if (dragCat.parentId !== targetCat.parentId) return;

    const dragIdx = data.categories.findIndex((c) => c.id === draggedCategoryId);
    data.categories.splice(dragIdx, 1);
    const newTargetIdx = data.categories.findIndex((c) => c.id === targetCategoryId);
    const insertIdx = insertBefore ? newTargetIdx : newTargetIdx + 1;
    data.categories.splice(insertIdx, 0, dragCat);

    await saveData(data);
    await renderAll();
  } catch (err) {
    showMessage('カテゴリーの並び替えに失敗しました。', 'error');
    console.error('[PWM] reorderCategory エラー:', err);
  }
}

function clearInsertMarkers() {
  document.querySelectorAll('.space-item--insert-before, .space-item--insert-after').forEach((el) => {
    el.classList.remove('space-item--insert-before', 'space-item--insert-after');
  });
  document.querySelectorAll('.cat-group--insert-before, .cat-group--insert-after').forEach((el) => {
    el.classList.remove('cat-group--insert-before', 'cat-group--insert-after');
  });
}

// ============================================================
// バックアップ
// ============================================================

async function exportData() {
  try {
    const data   = await loadData();
    const backup = { version: 1, exportedAt: new Date().toISOString(), activeSpaceId: getActiveSpaceId(data), categories: data.categories || [], spaces: data.spaces || [] };
    const json   = JSON.stringify(backup, null, 2);
    const blob   = new Blob([json], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const now    = new Date();
    const ts     = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0'),
                    String(now.getHours()).padStart(2,'0'), String(now.getMinutes()).padStart(2,'0'), String(now.getSeconds()).padStart(2,'0')].join('');
    const a      = document.createElement('a');
    a.href = url; a.download = `pwm-backup-${ts}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage(`エクスポート完了: ${backup.spaces.length} スペース / ${backup.categories.length} カテゴリー → pwm-backup-${ts}.json`, 'success');
  } catch (err) {
    showMessage('エクスポートに失敗しました。', 'error');
    console.error('[PWM] exportData エラー:', err);
  }
}

function handleImportClick() { document.getElementById('importFileInput').click(); }

async function handleImportFileSelected(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.spaces)) {
      showMessage('ファイル形式が正しくありません。', 'error'); return;
    }
    const spaceCount = parsed.spaces.length;
    const catCount   = Array.isArray(parsed.categories) ? parsed.categories.length : 0;
    const exportedAt = parsed.exportedAt ? formatDate(parsed.exportedAt) : '不明';
    if (!window.confirm(`バックアップファイルをインポートします。\n\n　スペース   : ${spaceCount} 件\n　カテゴリー : ${catCount} 件\n　作成日時   : ${exportedAt}\n\n現在のデータはすべて上書きされます。よろしいですか？`)) return;
    const newData = { activeSpaceId: parsed.activeSpaceId || null, windowActiveSpaces: parsed.windowActiveSpaces || {}, categories: Array.isArray(parsed.categories) ? parsed.categories : [], spaces: parsed.spaces };
    newData.spaces.forEach((s) => {
      if (!('categoryId' in s)) s.categoryId = null;
      if (!('archived'   in s)) s.archived   = false;
      if (!('color'      in s)) s.color      = '';
    });
    newData.categories.forEach((c) => {
      if (!('color' in c)) c.color = '';
    });
    await saveData(newData);
    showMessage(`インポート完了: ${spaceCount} スペース / ${catCount} カテゴリー`, 'success');
    await renderAll();
  } catch (err) {
    showMessage(err instanceof SyntaxError ? 'JSON の解析に失敗しました。' : 'インポートに失敗しました。', 'error');
    console.error('[PWM] handleImportFileSelected エラー:', err);
  }
}

// ============================================================
// カテゴリーハンドラ
// ============================================================

function openCategoryCreateModal(title = 'カテゴリーを作成') {
  return new Promise((resolve) => {
    const overlay   = document.getElementById('categoryModal');
    const nameInput = document.getElementById('categoryNameInput');
    const grid      = document.getElementById('categoryColorPicker');
    const okBtn     = document.getElementById('categoryModalOk');
    const cancelBtn = document.getElementById('categoryModalCancel');

    // タイトルを設定する
    const titleEl = document.getElementById('categoryModalTitle');
    if (titleEl) titleEl.textContent = title;

    // カラーグリッドを初期化
    grid.innerHTML = '';
    let selectedColor = '';

    COLOR_PALETTE.forEach(({ value, label }) => {
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'modal__color-swatch' + (!value ? ' modal__color-swatch--none' : '');
      btn.title     = label;
      if (value) {
        btn.style.background = value;
      } else {
        btn.textContent = '×';
      }
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.modal__color-swatch').forEach((s) => s.classList.remove('modal__color-swatch--active'));
        btn.classList.add('modal__color-swatch--active');
        selectedColor = value;
      });
      grid.appendChild(btn);
    });
    // 「なし」をデフォルト選択状態に
    grid.firstElementChild.classList.add('modal__color-swatch--active');

    nameInput.value = '';
    overlay.style.display = 'flex';
    nameInput.focus();

    function cleanup() {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeydown);
    }
    function onOk() { cleanup(); resolve({ name: nameInput.value, color: selectedColor }); }
    function onCancel() { cleanup(); resolve(null); }
    function onOverlayClick(e) { if (e.target === overlay) onCancel(); }
    function onKeydown(e) {
      if (e.key === 'Enter') onOk();
      if (e.key === 'Escape') onCancel();
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeydown);
  });
}

async function handleCreateCategory() {
  const result = await openCategoryCreateModal();
  if (!result) return;
  try {
    const cat = await createCategory(result.name, result.color);
    if (!cat) return;
    showMessage(`カテゴリー「${cat.name}」を作成しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('カテゴリーの作成に失敗しました。', 'error');
    console.error('[PWM] handleCreateCategory エラー:', err);
  }
}

async function handleCreateSubcategory(parentId, parentName) {
  const result = await openCategoryCreateModal(`「${parentName}」のサブカテゴリーを作成`);
  if (!result) return;
  try {
    const cat = await createCategory(result.name, result.color, parentId);
    if (!cat) return;
    showMessage(`サブカテゴリー「${cat.name}」を作成しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('サブカテゴリーの作成に失敗しました。', 'error');
    console.error('[PWM] handleCreateSubcategory エラー:', err);
  }
}

async function handleRenameCategory(categoryId, currentName) {
  const newName = window.prompt('新しいカテゴリー名を入力してください:', currentName);
  if (newName === null) return;
  try {
    if (!await renameCategory(categoryId, newName)) return;
    showMessage('カテゴリー名を変更しました。', 'success');
    await renderAll();
  } catch (err) {
    showMessage('カテゴリー名の変更に失敗しました。', 'error');
    console.error('[PWM] handleRenameCategory エラー:', err);
  }
}

async function handleDeleteCategory(categoryId, categoryName) {
  if (!window.confirm(`カテゴリー「${categoryName}」を削除しますか？\n中のスペースは「未分類」に移動します。`)) return;
  try {
    await deleteCategory(categoryId);
    showMessage(`カテゴリー「${categoryName}」を削除しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('カテゴリーの削除に失敗しました。', 'error');
    console.error('[PWM] handleDeleteCategory エラー:', err);
  }
}

async function handleToggleCategoryCollapse(categoryId) {
  try {
    await toggleCategoryCollapsed(categoryId);
    await renderAll();
  } catch (err) {
    console.error('[PWM] handleToggleCategoryCollapse エラー:', err);
  }
}

async function handleChangeCategoryForSpace() {
  const data        = await loadData();
  const activeSpaceId = getActiveSpaceId(data);
  if (!activeSpaceId) return;
  const activeSpace = data.spaces.find((s) => s.id === activeSpaceId);
  if (!activeSpace) return;
  const categories  = data.categories || [];

  const flatList = buildFlatCategoryList(categories);
  let listStr = '0: 未分類\n';
  flatList.forEach(({ cat, depth }, i) => {
    const indent = '　'.repeat(depth);
    const arrow = depth > 0 ? '└ ' : '';
    listStr += `${i + 1}: ${indent}${arrow}${cat.name}${cat.id === activeSpace.categoryId ? ' ← 現在' : ''}\n`;
  });
  listStr += `${flatList.length + 1}: ＋ 新しいカテゴリーを作成`;

  const input = window.prompt(`「${activeSpace.name}」のカテゴリーを選んでください（番号を入力）:\n\n${listStr}`);
  if (input === null) return;
  const num = parseInt(input.trim(), 10);
  if (isNaN(num)) { showMessage('有効な番号を入力してください。', 'error'); return; }

  try {
    if (num === 0) {
      await moveSpaceToCategory(activeSpaceId, null);
      showMessage('「未分類」に移動しました。', 'success');
    } else if (num >= 1 && num <= flatList.length) {
      const target = flatList[num - 1].cat;
      await moveSpaceToCategory(activeSpaceId, target.id);
      showMessage(`カテゴリー「${target.name}」に移動しました。`, 'success');
    } else if (num === flatList.length + 1) {
      const newCatResult = await openCategoryCreateModal('新しいカテゴリーを作成');
      if (!newCatResult) return;
      const newCat = await createCategory(newCatResult.name, newCatResult.color);
      if (!newCat) return;
      await moveSpaceToCategory(activeSpaceId, newCat.id);
      showMessage(`カテゴリー「${newCat.name}」を作成して移動しました。`, 'success');
    } else {
      showMessage('有効な番号を入力してください。', 'error'); return;
    }
    await renderAll();
  } catch (err) {
    showMessage('カテゴリーの変更に失敗しました。', 'error');
    console.error('[PWM] handleChangeCategoryForSpace エラー:', err);
  }
}



// ============================================================
// Chrome タブバーへのグループ反映
// ============================================================

async function applyGroupsToChromeTabs(spaceId) {
  if (!chrome.tabGroups) return;
  try {
    const allTabs = await getWindowTabs();
    const data    = await loadData();
    const space   = data.spaces.find((s) => s.id === spaceId);
    if (!space) return;

    const groups = space.tabGroups || [];
    const tabs   = space.tabs      || [];
    if (groups.length === 0) return;

    // 既存の Chrome グループを全解除してからグループを再生成する
    // （解除しないと chrome.tabs.group が毎回新グループを作り重複する）
    const allTabIds = allTabs
      .filter((t) => t.id !== g_dashboardTabId)
      .map((t) => t.id);
    if (allTabIds.length > 0) {
      await chrome.tabs.ungroup(allTabIds).catch(() => {});
    }

    // URLごとにChromeタブを配列で保持（同じURLが複数ある場合に対応）
    const chromeTabsByUrl = new Map();
    for (const t of allTabs) {
      if (t.id === g_dashboardTabId) continue; // ダッシュボードタブは除外
      if (!chromeTabsByUrl.has(t.url)) chromeTabsByUrl.set(t.url, []);
      chromeTabsByUrl.get(t.url).push(t);
    }

    // ダッシュボードのタブとChromeタブを紐付ける
    const dashToChromeId = new Map(); // dashboard tab (object reference) -> chromeTabId
    const orderedChromeTabIds = [];
    for (const t of tabs) {
      const list = chromeTabsByUrl.get(t.url);
      if (list && list.length > 0) {
        const chromeTab = list.shift();
        dashToChromeId.set(t, chromeTab.id);
        orderedChromeTabIds.push(chromeTab.id);
      }
    }

    // Chrome タブ自体の順番をダッシュボードの順序に揃える
    if (orderedChromeTabIds.length > 0) {
      g_isSwitching = true;
      await new Promise((resolve) => {
        chrome.tabs.move(orderedChromeTabIds, { index: 1 }, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      });
      g_isSwitching = false;
    }

    for (const group of groups) {
      const chromeTabIds = tabs
        .filter((t) => t.groupId === group.id)
        .map((t) => dashToChromeId.get(t))
        .filter((id) => id != null);

      if (chromeTabIds.length === 0) continue;

      try {
        const chromeGroupId = await chrome.tabs.group({ tabIds: chromeTabIds });
        if (chromeGroupId != null) {
          await chrome.tabGroups.move(chromeGroupId, { index: -1 }).catch(() => {});
          await chrome.tabGroups.update(chromeGroupId, {
            title:     group.name || '',
            color:     getChromeColorFromHex(group.color),
            collapsed: group.collapsed || false,
          });
        }
      } catch (e) {
        console.warn('[PWM] Chrome グループ適用エラー:', group.name, e);
      }
    }
  } catch (e) {
    console.warn('[PWM] applyGroupsToChromeTabs エラー:', e);
  }
}

// ============================================================
// タブグループハンドラ
// ============================================================


/** タブグループ作成・編集モーダル（Chrome 標準9色で選択） */
function openTabGroupModal(title = 'グループを作成', initName = '', initColor = '') {
  return new Promise((resolve) => {
    const overlay   = document.getElementById('categoryModal');
    const nameInput = document.getElementById('categoryNameInput');
    const grid      = document.getElementById('categoryColorPicker');
    const okBtn     = document.getElementById('categoryModalOk');
    const cancelBtn = document.getElementById('categoryModalCancel');
    const titleEl   = document.getElementById('categoryModalTitle');
    if (titleEl) titleEl.textContent = title;

    grid.innerHTML = '';
    let selectedColor = initColor || '';

    // 「なし」オプション
    const noneBtn = document.createElement('button');
    noneBtn.type      = 'button';
    noneBtn.className = 'modal__color-swatch modal__color-swatch--none' +
                        (!selectedColor ? ' modal__color-swatch--active' : '');
    noneBtn.textContent = '×';
    noneBtn.title       = 'なし';
    noneBtn.addEventListener('click', () => {
      grid.querySelectorAll('.modal__color-swatch').forEach((s) => s.classList.remove('modal__color-swatch--active'));
      noneBtn.classList.add('modal__color-swatch--active');
      selectedColor = '';
    });
    grid.appendChild(noneBtn);

    // Chrome 標準9色
    CHROME_GROUP_COLORS.forEach(({ value, label, hex }) => {
      const btn = document.createElement('button');
      btn.type            = 'button';
      btn.className       = 'modal__color-swatch chrome-color-swatch' +
                            (value === selectedColor ? ' modal__color-swatch--active' : '');
      btn.style.background = hex;
      btn.title            = label;
      btn.setAttribute('data-color', value);
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.modal__color-swatch').forEach((s) => s.classList.remove('modal__color-swatch--active'));
        btn.classList.add('modal__color-swatch--active');
        selectedColor = value;
      });
      grid.appendChild(btn);
    });

    nameInput.value        = initName;
    overlay.style.display  = 'flex';
    nameInput.focus();

    function cleanup() {
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKeydown);
    }
    function onOk()          { cleanup(); resolve({ name: nameInput.value, color: selectedColor }); }
    function onCancel()      { cleanup(); resolve(null); }
    function onOverlayClick(e) { if (e.target === overlay) onCancel(); }
    function onKeydown(e)    {
      if (e.key === 'Enter') onOk();
      if (e.key === 'Escape') onCancel();
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeydown);
  });
}

async function handleCreateTabGroup() {
  const data    = await loadData();
  const spaceId = getActiveSpaceId(data);
  if (!spaceId) { showMessage('スペースを選択してください。', 'error'); return; }
  const result = await openTabGroupModal('グループを作成');
  if (!result) return;
  try {
    const group = await createTabGroup(spaceId, result.name, result.color);
    if (!group) return;
    showMessage(`グループ「${group.name}」を作成しました。`, 'success');
    await renderAll();
  } catch (err) {
    showMessage('グループの作成に失敗しました。', 'error');
    console.error('[PWM] handleCreateTabGroup エラー:', err);
  }
}

async function handleRenameTabGroup(spaceId, groupId, currentName, currentColor) {
  const result = await openTabGroupModal('グループを編集', currentName, currentColor);
  if (!result) return;
  try {
    await renameTabGroup(spaceId, groupId, result.name || currentName);
    if (result.color !== undefined) await setTabGroupColor(spaceId, groupId, result.color);
    showMessage('グループを更新しました。', 'success');
    await renderAll();
  } catch (err) {
    showMessage('グループの更新に失敗しました。', 'error');
    console.error('[PWM] handleRenameTabGroup エラー:', err);
  }
}

async function handleDeleteTabGroup(spaceId, groupId, groupName) {
  if (!window.confirm(`グループ「${groupName}」を削除しますか？\nタブはグループなしになります。`)) return;
  try {
    await deleteTabGroup(spaceId, groupId);
    showMessage(`グループ「${groupName}」を削除しました。`, 'success');
    await renderAll();
    applyGroupsToChromeTabs(spaceId).catch(() => {});
  } catch (err) {
    showMessage('グループの削除に失敗しました。', 'error');
    console.error('[PWM] handleDeleteTabGroup エラー:', err);
  }
}

async function handleMoveTabToGroup(spaceId, tabIndex, groupId) {
  try {
    await moveTabToGroup(spaceId, tabIndex, groupId);
    await renderAll();
    applyGroupsToChromeTabs(spaceId).catch(() => {});
  } catch (err) {
    showMessage('タブの移動に失敗しました。', 'error');
    console.error('[PWM] handleMoveTabToGroup エラー:', err);
  }
}


async function handleArchiveSpaceTab(tabIndex) {
  if (g_isSwitching) return;
  try {
    const data = await loadData();
    const sp   = data.spaces.find((s) => s.id === getActiveSpaceId(data));
    if (!sp) return;
    await archiveSpaceTab(sp.id, tabIndex);
    renderAll();
  } catch (err) {
    showMessage('アーカイブに失敗しました。', 'error');
    console.error('[PWM] handleArchiveSpaceTab:', err);
  }
}

async function handleUnarchiveSpaceTab(spaceId, archiveIndex) {
  try {
    await unarchiveSpaceTab(spaceId, archiveIndex);
    await renderAll();
  } catch (err) {
    showMessage('復元に失敗しました。', 'error');
    console.error('[PWM] handleUnarchiveSpaceTab:', err);
  }
}

async function handleDeleteArchivedSpaceTab(spaceId, archiveIndex) {
  try {
    await deleteArchivedSpaceTab(spaceId, archiveIndex);
    await renderAll();
  } catch (err) {
    showMessage('削除に失敗しました。', 'error');
    console.error('[PWM] handleDeleteArchivedSpaceTab:', err);
  }
}

// テーマの適用
function applyTheme(theme) {
  const icon = document.getElementById('themeToggleIcon');
  if (!icon) return;

  if (theme === 'dark') {
    document.body.classList.add('theme-dark');
    icon.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
    const btn = document.getElementById('btnToggleTheme');
    if (btn) btn.title = 'ライトモードに切り替え';
  } else {
    document.body.classList.remove('theme-dark');
    icon.innerHTML = `
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    `;
    const btn = document.getElementById('btnToggleTheme');
    if (btn) btn.title = 'ダークモードに切り替え';
  }
}

// ============================================================
// 初期化
// ============================================================

async function init() {
  // ---- テーマの初期化と適用（画面のちらつきを防ぐため最初に行う） ----
  try {
    const themeResult = await chrome.storage.local.get('pwm_theme');
    applyTheme(themeResult['pwm_theme'] || 'light');
  } catch (err) {
    console.error('[PWM] テーマの適用に失敗:', err);
    applyTheme('light');
  }

  // テーマ切り替えボタンのイベントリスナー
  const btnToggleTheme = document.getElementById('btnToggleTheme');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', async () => {
      const isDark = document.body.classList.contains('theme-dark');
      const newTheme = isDark ? 'light' : 'dark';
      applyTheme(newTheme);
      try {
        await chrome.storage.local.set({ pwm_theme: newTheme });
      } catch (err) {
        console.error('[PWM] テーマの保存に失敗:', err);
      }
    });
  }

  try {
    const currentTab = await new Promise((resolve) => {
      chrome.tabs.getCurrent((tab) => {
        void chrome.runtime.lastError; // getCurrent は基本失敗しないが念のため
        resolve(tab);
      });
    });
    if (currentTab) {
      g_dashboardTabId    = currentTab.id;
      g_dashboardWindowId = currentTab.windowId;
      // ダッシュボードタブを常に最左端にピン留めする
      // （タブドラッグ中は操作できないため lastError を確認して無視する）
      chrome.tabs.update(currentTab.id, { pinned: true }, () => {
        if (chrome.runtime.lastError) return; // ドラッグ中などは無視
        chrome.tabs.move(currentTab.id, { index: 0 }, () => {
          void chrome.runtime.lastError; // エラーを握りつぶす
        });
      });
      // ダッシュボードが他のウィンドウへドラッグ移動された時にウィンドウIDを更新する
      chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
        if (tabId === g_dashboardTabId) {
          g_dashboardWindowId = attachInfo.newWindowId;
        }
      });
    }
  } catch (err) {
    console.error('[PWM] ダッシュボードタブ情報の取得に失敗:', err);
  }

  // ---- 各種設定の読み込みと変更ハンドラ ----
  try {
    const settingsResult = await chrome.storage.local.get('pwm_settings');
    const autoSettings   = settingsResult['pwm_settings'] || {};
    
    // 自動バックアップ間隔
    const intervalEl     = document.getElementById('autoBackupInterval');
    if (intervalEl) {
      intervalEl.value = String(autoSettings.backupIntervalHours ?? 24);
      intervalEl.addEventListener('change', async (e) => {
        const hours   = parseInt(e.target.value, 10);
        const cur     = ((await chrome.storage.local.get('pwm_settings'))['pwm_settings']) || {};
        await chrome.storage.local.set({ pwm_settings: { ...cur, backupIntervalHours: hours } });
        const label   = e.target.options[e.target.selectedIndex].text;
        showMessage(
          hours === 0
            ? '自動バックアップをオフにしました。'
            : `自動バックアップ: ${label} に設定しました。`,
          'success'
        );
      });
    }

    // 切り替え時に自動保存
    const autoSaveEl = document.getElementById('autoSaveOnSwitch');
    if (autoSaveEl) {
      autoSaveEl.checked = autoSettings.autoSaveOnSwitch ?? false;
      autoSaveEl.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        const cur     = ((await chrome.storage.local.get('pwm_settings'))['pwm_settings']) || {};
        await chrome.storage.local.set({ pwm_settings: { ...cur, autoSaveOnSwitch: enabled } });
        showMessage(
          enabled
            ? '切り替え時の自動保存をオンにしました。'
            : '切り替え時の自動保存をオフにしました。',
          'success'
        );
      });
    }
  } catch (err) {
    console.error('[PWM] 設定の読み込みに失敗:', err);
  }

  document.getElementById('btnCreateTabGroup').addEventListener('click', handleCreateTabGroup);
  document.getElementById('btnCreateSpace').addEventListener('click', handleCreateSpace);
  document.getElementById('btnCreateCategory').addEventListener('click', handleCreateCategory);
  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImport').addEventListener('click', handleImportClick);
  document.getElementById('importFileInput').addEventListener('change', handleImportFileSelected);
  document.getElementById('btnChangeCategory').addEventListener('click', handleChangeCategoryForSpace);
  document.getElementById('btnRenameSpace').addEventListener('click', handleRenameSpace);
  document.getElementById('btnArchiveSpace').addEventListener('click', handleArchiveSpace);
  document.getElementById('btnDeleteSpace').addEventListener('click', handleDeleteSpace);
  document.getElementById('btnRestoreSpace').addEventListener('click', handleRestoreSpaceFromMain);
  document.getElementById('btnDeletePermanently').addEventListener('click', handleDeletePermanentlyFromMain);
  document.getElementById('btnSaveTabs').addEventListener('click', handleSaveTabs);
  document.getElementById('searchInput').addEventListener('input', (e) => handleSearch(e.target.value));

  // ビュー切り替えトグル
  const btnViewList = document.getElementById('btnViewList');
  const btnViewCard = document.getElementById('btnViewCard');
  if (btnViewList) btnViewList.addEventListener('click', async () => {
    applyViewMode('list');
    const cur = ((await chrome.storage.local.get('pwm_settings'))['pwm_settings']) || {};
    await chrome.storage.local.set({ pwm_settings: { ...cur, viewMode: 'list' } });
    await renderAll();
  });
  if (btnViewCard) btnViewCard.addEventListener('click', async () => {
    applyViewMode('card');
    const cur = ((await chrome.storage.local.get('pwm_settings'))['pwm_settings']) || {};
    await chrome.storage.local.set({ pwm_settings: { ...cur, viewMode: 'card' } });
    await renderAll();
  });

  // 保存済みのビューモードを復元
  try {
    const s = ((await chrome.storage.local.get('pwm_settings'))['pwm_settings']) || {};
    if (s.viewMode === 'card') applyViewMode('card');
  } catch (e) { /* ignore */ }

  // Chromeのタブ移動やグループ変更を検知してダッシュボードに自動反映する
  let autoSaveTimer = null;
  function triggerAutoSave() {
    if (g_isSwitching) return; // 読み込み・切り替え・ダッシュボードからの移動中はスキップ
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(async () => {
      try {
        const data = await loadData();
        const activeSpaceId = getActiveSpaceId(data);
        if (!activeSpaceId) return;

        // 現在のタブ状態をスペースに自動保存
        await saveCurrentTabsToSpace(activeSpaceId);
        await renderAll();
      } catch (err) {
        console.error('[PWM] 自動保存エラー:', err);
      }
    }, 1000); // 1秒デバウンス
  }

  chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    if (moveInfo.windowId === g_dashboardWindowId) {
      triggerAutoSave();
    }
  });

  chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
    if (attachInfo.newWindowId === g_dashboardWindowId) {
      triggerAutoSave();
    }
  });

  chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
    if (detachInfo.oldWindowId === g_dashboardWindowId) {
      triggerAutoSave();
    }
  });

  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (removeInfo.windowId === g_dashboardWindowId) {
      triggerAutoSave();
    }
  });

  if (chrome.tabGroups) {
    chrome.tabGroups.onUpdated.addListener((group) => {
      if (group.windowId === g_dashboardWindowId) {
        triggerAutoSave();
      }
    });
    chrome.tabGroups.onMoved.addListener((group) => {
      if (group.windowId === g_dashboardWindowId) {
        triggerAutoSave();
      }
    });
  }

  await renderAll();
}

document.addEventListener('DOMContentLoaded', init);
