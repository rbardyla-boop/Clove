// ─── OPERATOR'S DECK + CLOVELEARN — ELECTRON MAIN PROCESS ───────────────────
// Zero server. Zero cloud. Everything local. localStorage persists in Chromium.
// Dual mode: Full Deck (index.html) or CloveLearn direct (whats-going-on.html)
// Voice-input ready: microphone permission pre-granted for future Web Speech API.
// ─────────────────────────────────────────────────────────────────────────────

const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Single instance lock — prevent duplicate windows
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let mainWindow = null;

// ── Paths
const APP_DIR = path.join(__dirname, 'app');
const INDEX   = path.join(APP_DIR, 'index.html');
const WGO     = path.join(APP_DIR, 'whats-going-on.html');

// ── Launch mode: --clovelearn flag loads WGO directly
const launchCloveLearn = process.argv.includes('--clovelearn');
const ENTRY_FILE = launchCloveLearn ? WGO : INDEX;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 380,
    minHeight: 600,
    maxWidth: 600,
    backgroundColor: '#08080f',
    title: launchCloveLearn ? "CloveLearn — What's Going On" : "Operator's Deck",
    icon: path.join(APP_DIR, 'icon512x512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    // Mobile-feel on desktop
    titleBarStyle: 'hiddenInset',
    frame: process.platform !== 'darwin',
    show: false, // show after ready-to-show to prevent flash
  });

  // ── Load the app
  mainWindow.loadFile(ENTRY_FILE);

  // ── Show when ready (no white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ── Handle external links — open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // ── Intercept new-window navigation (target="_blank" links)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // ── Permission handler: grant microphone for future voice input
  // Also grants media (camera disabled, mic only) and localStorage
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const ALLOWED = ['media', 'audioCapture', 'clipboard-read', 'clipboard-sanitized-write'];
    if (ALLOWED.includes(permission)) {
      callback(true);
    } else {
      // Allow everything else too (localStorage, notifications, etc.)
      callback(true);
    }
  });

  // ── Also handle permission checks (some APIs check before requesting)
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'audioCapture') return true;
    return true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Build menu with navigation
function buildMenu() {
  const template = [
    {
      label: "Operator's Deck",
      submenu: [
        {
          label: 'Home — Full Deck',
          accelerator: 'CmdOrCtrl+1',
          click: () => { if (mainWindow) mainWindow.loadFile(INDEX); }
        },
        {
          label: "What's Going On — CloveLearn",
          accelerator: 'CmdOrCtrl+2',
          click: () => { if (mainWindow) mainWindow.loadFile(WGO); }
        },
        {
          label: 'Pattern Intelligence',
          accelerator: 'CmdOrCtrl+3',
          click: () => { if (mainWindow) mainWindow.loadFile(path.join(APP_DIR, 'pattern-intelligence.html')); }
        },
        {
          label: 'Tool Shed',
          accelerator: 'CmdOrCtrl+4',
          click: () => { if (mainWindow) mainWindow.loadFile(path.join(APP_DIR, 'toolshed.html')); }
        },
        { type: 'separator' },
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        {
          label: 'Export localStorage Backup',
          accelerator: 'CmdOrCtrl+E',
          click: () => exportData()
        },
        {
          label: 'Import localStorage Backup',
          accelerator: 'CmdOrCtrl+I',
          click: () => importData()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ]
    }
  ];

  // Dev tools in development only
  if (!app.isPackaged) {
    template[1].submenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools', accelerator: 'F12' }
    );
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Export all localStorage to JSON backup file
async function exportData() {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Operator\'s Deck Backup',
    defaultPath: `operators-deck-backup-${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return;

  try {
    const data = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const dump = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          dump[key] = localStorage.getItem(key);
        }
        return JSON.stringify(dump, null, 2);
      })()
    `);
    fs.writeFileSync(result.filePath, data, 'utf-8');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Backup Complete',
      message: `Exported ${Object.keys(JSON.parse(data)).length} keys to:\n${result.filePath}`
    });
  } catch (e) {
    dialog.showErrorBox('Export Failed', e.message);
  }
}

// ── Import localStorage from JSON backup file
async function importData() {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Operator\'s Deck Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return;

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw);
    const keyCount = Object.keys(parsed).length;

    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Confirm Import',
      message: `This will merge ${keyCount} keys into your current data.\nExisting keys with the same name will be overwritten.\n\nContinue?`,
      buttons: ['Cancel', 'Import'],
      defaultId: 0,
      cancelId: 0
    });
    if (confirm.response !== 1) return;

    await mainWindow.webContents.executeJavaScript(`
      (() => {
        const data = ${JSON.stringify(parsed)};
        Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
        return true;
      })()
    `);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Import Complete',
      message: `Imported ${keyCount} keys. Reloading app...`
    });
    mainWindow.reload();
  } catch (e) {
    dialog.showErrorBox('Import Failed', e.message);
  }
}

// ── App lifecycle
app.whenReady().then(() => {
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ── Second instance → focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
