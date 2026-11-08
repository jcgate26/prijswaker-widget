// Prijswaker widget for Scriptable (iOS).
// Shows per product the status and best price from the daily price round.
// Tap the widget to open the full dashboard.

const DATA_URL = "https://raw.githubusercontent.com/jcgate26/prijswaker-widget/main/widget.json";

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "prijswaker-widget.json");

async function loadData() {
  try {
    const req = new Request(DATA_URL + "?t=" + Date.now());
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    fm.writeString(cachePath, JSON.stringify(data));
    return data;
  } catch (e) {
    return fm.fileExists(cachePath) ? JSON.parse(fm.readString(cachePath)) : null;
  }
}

const COLORS = {
  Deal: new Color("#2e9e5b"),
  Scherp: new Color("#5bb07f"),
  Normaal: Color.dynamic(new Color("#8a8a8e"), new Color("#9a9aa0")),
  Duur: new Color("#d0503a"),
  "Geen prijs": Color.dynamic(new Color("#b0b0b5"), new Color("#6a6a70")),
};
const TEXT = Color.dynamic(new Color("#1c1c1e"), new Color("#f2f2f7"));
const MUTED = Color.dynamic(new Color("#6e6e73"), new Color("#a1a1a6"));
const BG = Color.dynamic(new Color("#faf9f5"), new Color("#1f1e1d"));

const eur = (v) => v == null ? "—" : "€" + new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);

function daysToBlackFriday() {
  const bf = new Date(2026, 10, 27);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((bf - today) / 86400000);
}

function build(data) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(12, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  if (!data) {
    const t = w.addText("Prijswaker: geen gegevens");
    t.textColor = MUTED;
    t.font = Font.systemFont(12);
    return w;
  }
  w.url = data.dashboard;
  const family = config.widgetFamily || "medium";
  const max = family === "small" ? 4 : family === "large" ? 13 : 6;

  const head = w.addStack();
  head.centerAlignContent();
  const title = head.addText("Prijswaker");
  title.font = Font.semiboldSystemFont(family === "small" ? 13 : 14);
  title.textColor = TEXT;
  head.addSpacer();
  const d = daysToBlackFriday();
  const right = head.addText(data.deals ? `${data.deals} deal${data.deals > 1 ? "s" : ""}` : (d >= 0 ? `BF over ${d} d` : ""));
  right.font = Font.mediumSystemFont(11);
  right.textColor = data.deals ? COLORS.Deal : MUTED;
  w.addSpacer(6);

  for (const it of data.items.slice(0, max)) {
    const row = w.addStack();
    row.centerAlignContent();
    const dot = row.addText("●");
    dot.font = Font.systemFont(9);
    dot.textColor = COLORS[it.status] || MUTED;
    row.addSpacer(5);
    const name = row.addText(it.name);
    name.font = Font.systemFont(family === "small" ? 11 : 12);
    name.textColor = TEXT;
    name.lineLimit = 1;
    row.addSpacer();
    if (family !== "small" && it.status !== "Normaal" && it.status !== "Geen prijs") {
      const st = row.addText(it.status.toLowerCase() + "  ");
      st.font = Font.mediumSystemFont(10);
      st.textColor = COLORS[it.status];
    }
    const price = row.addText(eur(it.best));
    price.font = Font.mediumMonospacedSystemFont(family === "small" ? 11 : 12);
    price.textColor = it.status === "Deal" ? COLORS.Deal : TEXT;
    w.addSpacer(family === "large" ? 5 : 3);
  }

  w.addSpacer();
  const upd = new Date(data.updated + "T12:00:00");
  const foot = w.addText("Bijgewerkt " + upd.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }));
  foot.font = Font.systemFont(9);
  foot.textColor = MUTED;
  return w;
}

const data = await loadData();
const widget = build(data);
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
