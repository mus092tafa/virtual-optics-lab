// Desktop shell: opens the built laboratory in a window. All application
// code lives in the web bundle (dist/); nothing here touches the optics.
const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    title: 'Virtual Optics Laboratory',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  // External links open in the system browser, never inside the lab window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => app.quit())
