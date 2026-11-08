// Prijswaker widget for Scriptable (iOS). Paste this once; it never needs to change.
// It downloads the current design (core.js) from GitHub each time and keeps a copy for offline use,
// so design updates arrive automatically. Tap the widget to open the full dashboard.

const CORE_URL = "https://raw.githubusercontent.com/jcgate26/prijswaker-widget/main/core.js";
const fm = FileManager.local();
const corePath = fm.joinPath(fm.cacheDirectory(), "prijswaker-core.js");

let code = null;
try {
  const req = new Request(CORE_URL + "?t=" + Date.now());
  req.timeoutInterval = 15;
  const text = await req.loadString();
  if (req.response && req.response.statusCode === 200 && text.includes("Script.complete")) {
    code = text;
    fm.writeString(corePath, text);
  }
} catch (e) {
  // offline: fall back to the saved copy below
}
if (!code && fm.fileExists(corePath)) code = fm.readString(corePath);

if (code) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(code)();
} else {
  const w = new ListWidget();
  w.backgroundColor = new Color("#161617");
  const t = w.addText("Prijswaker: geen verbinding");
  t.textColor = new Color("#98989f");
  t.font = Font.systemFont(12);
  Script.setWidget(w);
  Script.complete();
}
