const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  win.loadFile(path.join(__dirname, "../dist/index.html")).catch((err) => {
    console.error("Failed to load index.html:", err);
  });

  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Page failed to load:", errorCode, errorDescription);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});
