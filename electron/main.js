const { app, BrowserWindow, session } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Permette a FFmpeg di leggere i file locali
      additionalArguments: ['--enable-features=SharedArrayBuffer']
    },
  });

  // ABILITA GLI HEADER DI SICUREZZA PER FFMPEG (COOP & COEP)
  // Senza questo, SharedArrayBuffer non è definito e FFmpeg fallisce
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['credentialless']  ,
        'Cross-Origin-Resource-Policy': ['cross-origin']
          }
    });
  });

  // GESTIONE DEI PERCORSI PER LA BUILD
  const indexPath = app.isPackaged
    ? path.join(__dirname, "..", "dist", "index.html")
    : path.join(__dirname, "dist", "index.html");

  win.loadFile(indexPath).catch((err) => {
    console.error("Errore nel caricamento di index.html:", err);
  });

  // Apre automaticamente i DevTools se c'è un errore di caricamento pagina
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Pagina fallita:", errorCode, errorDescription);
    win.webContents.openDevTools();
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});