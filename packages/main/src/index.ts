import {app, globalShortcut, BrowserWindow, Tray, Menu, nativeImage} from 'electron';
import type {State as ElectronWindowState} from 'electron-window-state';
import windowStateKeeper from 'electron-window-state';
import openAboutWindow from 'electron-about-window';
import Store from 'electron-store';
import {join} from 'path';
import {URL} from 'url';
import trayIcon from './tray-icon-white.png';
import icon from './icon.png';

const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}

/**
 * Workaround for TypeScript bug
 * @see https://github.com/microsoft/TypeScript/issues/41468#issuecomment-727543400
 */
const env = import.meta.env;


// Install "Vue.js devtools"
if (env.MODE === 'development') {
  app.whenReady()
    .then(() => import('electron-devtools-installer'))
    .then(({default: installExtension, VUEJS3_DEVTOOLS}) => installExtension(VUEJS3_DEVTOOLS, {
      loadExtensionOptions: {
        allowFileAccess: true,
      },
    }))
    .catch(e => console.error('Failed install extension:', e));
}

const store = new Store();

let mainWindow: BrowserWindow | null = null;
let tray = null;
let mainWindowState: ElectronWindowState | null = null;

const initStore = () => {
  if (!store.has('plexWebLeftPanelHidden')) {
    store.set('plexWebLeftPanelHidden', true);
  }

  if (!store.has('simplePlayerMode')) {
    store.set('simplePlayerMode', false);
  }

  if (!store.has('windowChromeHidden')) {
    store.set('windowChromeHidden', false);
  }

  if (!store.has('showOnAllWorkspaces')) {
    store.set('showOnAllWorkspaces', false);
  }

  if (!store.has('autoPause')) {
    store.set('autoPause', true);
  }

  if (!store.has('positionLocked')) {
    store.set('positionLocked', true);
  }

  if (!store.has('windowOpacity')) {
    store.set('windowOpacity', 1.0);
  }
};

const manageWindow = async () => {
  mainWindow = new BrowserWindow({
    alwaysOnTop: true,
    'x': mainWindowState?.x,
    'y': mainWindowState?.y,
    'width': mainWindowState?.width,
    'height': mainWindowState?.height,
    frame: !store.get('windowChromeHidden'),
    skipTaskbar: true, // Don't show app in the taskbar on windows
    resizable: !store.get('positionLocked'),
    movable: !store.get('positionLocked'),
    fullscreenable: !store.get('showOnAllWorkspaces'),
    visibleOnAllWorkspaces: store.get('showOnAllWorkspaces'),
    show: false, // Use 'ready-to-show' event to show window
    webPreferences: {
      preload: join(__dirname, '../../preload/dist/index.cjs'),
      contextIsolation: env.MODE !== 'test',   // Spectron tests can't work with contextIsolation: true
      enableRemoteModule: env.MODE === 'test', // Spectron tests can't work with enableRemoteModule: false
      webviewTag: true,
    },
  });
  mainWindow?.setMenu(null);
  mainWindowState?.manage(mainWindow);

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
   mainWindow?.on('ready-to-show', () => {
    mainWindow?.show();

    if (env.MODE === 'development') {
      mainWindow?.webContents.openDevTools();
    }
  });

  /**
   * URL for main window.
   * Vite dev server for development.
   * `file://../renderer/index.html` for production and test
   */
  const pageUrl = env.MODE === 'development'
    ? env.VITE_DEV_SERVER_URL
    : new URL('../renderer/dist/index.html', 'file://' + __dirname).toString();


  await mainWindow?.loadURL(pageUrl);
};

const createWindow = () => {
  if (!mainWindowState) {
    mainWindowState = windowStateKeeper({
      defaultWidth: 600,
      defaultHeight: 500,
    });

    manageWindow();
  } else {
    manageWindow();
  }
};

const setWindowAspectRatio = (ratio: string, direction: string) => {
  const [currentWidth, currentHeight] = mainWindow?.getSize() ?? [];

  if (ratio === '4:3') {
    if (direction === 'vertical') {
      mainWindow?.setSize(currentWidth, Math.round(currentWidth * 3 / 4));
    }

    if (direction === 'horizontal') {
      mainWindow?.setSize(Math.round(currentHeight * 4 / 3), currentHeight);
    }
  }

  if (ratio === '16:9') {
    if (direction === 'vertical') {
      mainWindow?.setSize(currentWidth, Math.round(currentWidth * 9 / 16));
    }

    if (direction === 'horizontal') {
      mainWindow?.setSize(Math.round(currentHeight * 16 / 9), currentHeight);
    }
  }
};

function removeFrame() {
  store.set('windowChromeHidden', !store.get('windowChromeHidden'));

  const currentWindowId = mainWindow?.id;

  if (currentWindowId) {
    createWindow();

    BrowserWindow.fromId(currentWindowId)?.close();
  }
}

function toggleWindow() {
  if (mainWindow?.isVisible()) {
    mainWindow?.hide();
    if (store.get('autoPause')) {
      mainWindow?.webContents.send('pause');
    }
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
}

function setPositionLocked(isLocked: boolean) {
  mainWindow?.setResizable(!isLocked);
  mainWindow?.setMovable(!isLocked);
  store.set('positionLocked', isLocked);
}

function setShowOnAllWorkspaces(show: boolean) {
  mainWindow?.setVisibleOnAllWorkspaces(show);
  mainWindow?.setFullScreenable(!show);
  store.set('showOnAllWorkspaces', show);
}

function setWindowOpacity(opacity: number) {
  store.set('windowOpacity', opacity);
  mainWindow?.setOpacity(opacity);
}

function registerShortcuts() {
  globalShortcut.register('Shift+Control+X', () => {
    toggleWindow();
  });

  globalShortcut.register('Shift+Control+Z', () => {
    removeFrame();
  });

  globalShortcut.register('medianexttrack', function () {
    mainWindow?.webContents.send('next');
  });

  globalShortcut.register('mediaplaypause', function () {
    mainWindow?.webContents.send('play-pause');
  });

  globalShortcut.register('mediaprevioustrack', function () {
    mainWindow?.webContents.send('previous');
  });

  globalShortcut.register('Shift+Control+Left', function () {
    mainWindow?.webContents.send('back');
  });

  globalShortcut.register('Shift+Control+Right', function () {
    mainWindow?.webContents.send('forward');
  });

  globalShortcut.register('Shift+Control+>', function () {
    mainWindow?.webContents.send('next');
  });

  globalShortcut.register('Shift+Control+<', function () {
    mainWindow?.webContents.send('previous');
  });

  globalShortcut.register('Shift+Control+M', function () {
    mainWindow?.webContents.send('simple-player-mode');
  });
}

function buildTray() {
  tray = new Tray(nativeImage.createFromDataURL(trayIcon));

  tray.setToolTip('Plex Viewer');
  tray.on('double-click', toggleWindow);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Aspect Ratio',
      submenu: [
        {
          label: '4:3 (Horizontal)',
          click: () => setWindowAspectRatio('4:3', 'horizontal'),
        },
        {
          label: '4:3 (Vertical)',
          click: () => setWindowAspectRatio('4:3', 'vertical'),
        },
        {
          label: '16:9 (Horizontal)',
          click: () => setWindowAspectRatio('16:9', 'horizontal'),
        },
        {
          label: '16:9 (Vertical)',
          click: () => setWindowAspectRatio('16:9', 'vertical'),
        },
      ],
    },
    {
      label: 'Window Opacity',
      submenu: [.1, .2, .3, .4, .5, .6, .7, .8, .9, 1].map(val => {
        return {
          label: val.toFixed(1).toString(),
          type: 'radio',
          checked: store.get('windowOpacity') === val,
          click: () => setWindowOpacity(val),
        };
      }),
    },
    {
      label: 'Pause on Minimize',
      submenu: [
        {
          label: 'On',
          type: 'radio',
          checked: !!store.get('autoPause'),
          click: () => store.set('autoPause', true),
        },
        {
          label: 'Off',
          type: 'radio',
          checked: !store.get('autoPause'),
          click: () => store.set('autoPause', false),
        },
      ],
    },
    {
      label: 'Lock Window',
      submenu: [
        {
          label: 'On',
          type: 'radio',
          checked: !!store.get('positionLocked'),
          click: () => setPositionLocked(true),
        },
        {
          label: 'Off',
          type: 'radio',
          checked: !store.get('positionLocked'),
          click: () => setPositionLocked(false),
        },
      ],
    },
    {
      label: 'Show on All Workspaces',
      submenu: [
        {
          label: 'On',
          type: 'radio',
          checked: !!store.get('showOnAllWorkspaces'),
          click: () => setShowOnAllWorkspaces(true),
        },
        {
          label: 'Off',
          type: 'radio',
          checked: !store.get('showOnAllWorkspaces'),
          click: () => setShowOnAllWorkspaces(false),
        },
      ],
    },
    {
      label: 'Toggle Window',
      click: toggleWindow,
    },
    {
      label: 'About',
      click: () =>
        openAboutWindow({
          icon_path: icon,
          product_name: 'Plex Viewer',
          bug_report_url: 'https://github.com/ztoben/plex-viewer/issues',
          description: 'An electron wrapper for viewing Plex',
          license: 'MIT',
        }),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

app.on('second-instance', () => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow?.isMinimized()) mainWindow?.restore();
    mainWindow?.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady()
  .then(() => {
    initStore();
    buildTray();
    registerShortcuts();
    createWindow();
  })
  .catch((e) => console.error('Failed create window:', e));


// Auto-updates
if (env.PROD) {
  app.whenReady()
    .then(() => import('electron-updater'))
    .then(({autoUpdater}) => autoUpdater.checkForUpdatesAndNotify())
    .catch((e) => console.error('Failed check updates:', e));
}

