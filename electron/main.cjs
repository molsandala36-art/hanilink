const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');

const DESKTOP_SERVER_PORT = Number(process.env.DESKTOP_SERVER_PORT || 3210);
let backendProcess = null;

const writeDebugLog = (message) => {
  try {
    const baseDir = app.isReady() ? app.getPath('userData') : process.cwd();
    const logPath = path.join(baseDir, 'desktop-debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch (err) {
    console.error('Failed to write desktop debug log:', err);
  }
};

const waitForServer = (port, retries = 300, delayMs = 300) =>
  new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts += 1;
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
          return;
        }
        res.resume();
        if (attempts >= retries) reject(new Error('Server health check failed'));
        else setTimeout(check, delayMs);
      });

      req.on('error', () => {
        if (attempts >= retries) reject(new Error('Server did not start in time'));
        else setTimeout(check, delayMs);
      });
    };

    check();
  });

const startEmbeddedServer = async () => {
  const appRoot = app.getAppPath ? app.getAppPath() : path.join(__dirname, '..');
  const serverEntry = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'build-server', 'server.js')
    : path.join(appRoot, 'build-server', 'server.js');
  const serverWorkingDir = app.isPackaged ? process.resourcesPath : appRoot;
  const packagedNodeModules = path.join(appRoot, 'node_modules');
  const workspaceNodeModules = path.resolve(process.resourcesPath, '..', '..', '..', 'node_modules');
  const nodePath = [packagedNodeModules, workspaceNodeModules, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter);

  writeDebugLog(`Starting embedded server from ${serverEntry}`);
  writeDebugLog(`App root ${appRoot}`);
  writeDebugLog(`Server working directory ${serverWorkingDir}`);
  writeDebugLog(`NODE_PATH ${nodePath}`);

  backendProcess = fork(serverEntry, {
    cwd: serverWorkingDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_PATH: nodePath,
      DESKTOP_EMBEDDED: '1',
      APP_DIST_PATH: path.join(appRoot, 'dist'),
      LOCAL_DB_PATH: path.join(app.getPath('userData'), 'local-db.json'),
      PORT: String(DESKTOP_SERVER_PORT)
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  backendProcess.on('error', (err) => {
    writeDebugLog(`Embedded server process error: ${err.stack || err.message}`);
    console.error('Embedded server process error:', err);
  });

  backendProcess.stdout?.on('data', (chunk) => {
    writeDebugLog(`SERVER STDOUT: ${String(chunk).trim()}`);
  });

  backendProcess.stderr?.on('data', (chunk) => {
    writeDebugLog(`SERVER STDERR: ${String(chunk).trim()}`);
  });

  backendProcess.on('exit', (code, signal) => {
    writeDebugLog(`Embedded server exited with code=${code} signal=${signal}`);
  });

  await waitForServer(DESKTOP_SERVER_PORT);
};

function createWindow() {
  writeDebugLog('Creating browser window');
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    title: 'HaniLink Desktop',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const startUrl = app.isPackaged
    ? `http://127.0.0.1:${DESKTOP_SERVER_PORT}`
    : 'http://localhost:5000';

  writeDebugLog(`Loading URL ${startUrl}`);
  win.loadURL(startUrl);
}

app.whenReady().then(async () => {
  writeDebugLog('Electron app ready');
  if (app.isPackaged) {
    try {
      await startEmbeddedServer();
    } catch (err) {
      writeDebugLog(`Failed to start embedded server: ${err.stack || err.message}`);
      console.error('Failed to start embedded server:', err);
      app.quit();
      return;
    }
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});
