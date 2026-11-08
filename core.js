// Prijswaker widget design (tiles, dark). Loaded by Prijswaker.js; edit this file to change the look.
// Runs inside an async function, so top-level await is fine. Scriptable globals (ListWidget, config ...) are available.

const DATA_URL = "https://raw.githubusercontent.com/jcgate26/prijswaker-widget/main/widget.json";
const BLACK_FRIDAY = new Date(2026, 10, 27);

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

const C = {
  bg: new Color("#161617"),
  tile: new Color("#262628"),
  text: new Color("#f2f2f7"),
  muted: new Color("#98989f"),
  green: new Color("#34b36b"),
  greenText: new Color("#ffffff"),
  sharpTile: new Color("#1d3426"),
  sharpText: new Color("#5fd28f"),
  redTile: new Color("#3b201c"),
  redText: new Color("#ff7a63"),
  amber: new Color("#f0b54a"),
};

// Tile colours per status: [tile background, price colour, small text colour]
const STYLE = {
  Deal: [C.green, C.greenText, C.greenText],
  Scherp: [C.sharpTile, C.sharpText, C.sharpText],
  Normaal: [C.tile, C.text, C.muted],
  Duur: [C.redTile, C.redText, C.redText],
  "Geen prijs": [C.tile, C.muted, C.muted],
};

const eur = (v) => v == null ? "—" : "€" + new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
const pct = (d) => d == null ? "" : (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(Math.round(d)) + "%";

function daysToBlackFriday() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((BLACK_FRIDAY - today) / 86400000);
}

// Widget size in points, derived from the screen width (iOS widget sizes scale with the phone).
function layout(family) {
  const s = Device.screenSize();
  const screenW = Math.min(s.width, s.height);
  const small = Math.round(screenW * 0.395);
  const wide = Math.round(screenW * 0.847);
  const tall = Math.round(small * 2.24);
  if (family === "large") return { w: wide, h: tall, cols: 3, rows: 6, pad: 12, gap: 6, big: true };
  if (family === "medium") return { w: wide, h: small, cols: 4, rows: 2, pad: 11, gap: 5, big: false };
  return { w: small, h: small, cols: 2, rows: 4, pad: 9, gap: 4, big: false };
}

function addTile(row, L, tileW, tileH, fill) {
  const t = row.addStack();
  t.size = new Size(tileW, tileH);
  t.backgroundColor = fill;
  t.cornerRadius = L.big ? 12 : 9;
  t.layoutVertically();
  t.setPadding(2, L.big ? 9 : 7, 2, L.big ? 9 : 7);
  return t;
}

function headerTile(t, data, L) {
  t.backgroundColor = Color.clear();
  t.setPadding(2, 3, 2, 3);
  t.addSpacer();
  const title = t.addText("Prijswaker");
  title.font = Font.semiboldSystemFont(L.big ? 15 : 12);
  title.textColor = C.text;
  title.lineLimit = 1;
  title.minimumScaleFactor = 0.8;
  const d = daysToBlackFriday();
  const bf = d > 0 ? `BF ${d} d` : d === 0 ? "Black Friday!" : "";
  const parts = [];
  if (data.deals) parts.push(`${data.deals} deal${data.deals > 1 ? "s" : ""}`);
  if (bf) parts.push(bf);
  const sub = t.addText(parts.join(" · ") || " ");
  sub.font = Font.semiboldSystemFont(L.big ? 11 : 8.5);
  sub.textColor = data.deals ? C.green : C.muted;
  sub.lineLimit = 1;
  sub.minimumScaleFactor = 0.8;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (data.updated && data.updated < iso) {
    // Only show the date when the data is not from today.
    const upd = new Date(data.updated + "T12:00:00");
    const old = t.addText("stand " + upd.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }));
    old.font = Font.mediumSystemFont(L.big ? 10 : 8);
    old.textColor = C.amber;
    old.lineLimit = 1;
  }
  t.addSpacer();
}

function productTile(t, it, L) {
  const [fill, priceColor, smallColor] = STYLE[it.status] || STYLE.Normaal;
  t.backgroundColor = fill;
  t.addSpacer();
  const name = t.addText(it.name);
  name.font = Font.systemFont(L.big ? 11 : 8.5);
  name.textColor = it.status === "Deal" ? C.greenText : C.muted;
  name.lineLimit = 1;
  name.minimumScaleFactor = 0.75;
  const line = t.addStack();
  line.centerAlignContent();
  const price = line.addText(eur(it.best));
  price.font = Font.semiboldSystemFont(L.big ? 17 : 12.5);
  price.textColor = priceColor;
  price.lineLimit = 1;
  price.minimumScaleFactor = 0.7;
  line.addSpacer(2);
  line.addSpacer();
  const d = line.addText(it.best == null ? "geen prijs" : pct(it.diff_pct));
  d.font = Font.semiboldSystemFont(L.big ? 11 : 8.5);
  d.textColor = smallColor;
  d.lineLimit = 1;
  if (L.big && it.shop) {
    const shop = t.addText(it.shop.replace(/\s*\(.*\)$/, ""));
    shop.font = Font.systemFont(9.5);
    shop.textColor = it.status === "Deal" ? C.greenText : C.muted;
    shop.lineLimit = 1;
  }
  t.addSpacer();
}

function build(data) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  if (!data) {
    const t = w.addText("Prijswaker: nog geen gegevens");
    t.textColor = C.muted;
    t.font = Font.systemFont(12);
    return w;
  }
  w.url = data.dashboard;
  const family = config.widgetFamily || "small";
  const L = layout(family);
  w.setPadding(L.pad, L.pad, L.pad, L.pad);
  const tileW = Math.floor((L.w - 2 * L.pad - (L.cols - 1) * L.gap) / L.cols);
  const tileH = Math.floor((L.h - 2 * L.pad - (L.rows - 1) * L.gap) / L.rows);
  // Items arrive sorted: deals first, then normal (lowest % first), then expensive, then no price.
  const items = data.items.slice(0, L.cols * L.rows - 1);
  const slots = [null, ...items];
  const grid = w.addStack();
  grid.layoutVertically();
  grid.spacing = L.gap;
  for (let r = 0; r < L.rows; r++) {
    const row = grid.addStack();
    row.spacing = L.gap;
    for (let c = 0; c < L.cols; c++) {
      const i = r * L.cols + c;
      if (i >= slots.length) {
        const empty = row.addStack();
        empty.size = new Size(tileW, tileH);
        continue;
      }
      const t = addTile(row, L, tileW, tileH, C.tile);
      if (i === 0) headerTile(t, data, L);
      else productTile(t, slots[i], L);
    }
    if (r * L.cols + L.cols >= slots.length) break;
  }
  return w;
}

const data = await loadData();
const widget = build(data);
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}
Script.complete();
