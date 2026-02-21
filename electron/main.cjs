const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Diário do Professor",
    icon: path.join(__dirname, "../public/app-icon.svg"),
  });

  win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(createWindow);
