// Prijswaker widget design (tiles, dark) and the detail screen. Loaded by Prijswaker.js; edit this file
// to change the look. Runs inside an async function, so top-level await is fine.
//
// Widget parameter (long-press the widget > Edit widget > Parameter): a theme name such as "Pannen" or
// "Soundbars" shows only that theme. Empty shows everything; when that no longer fits, one tile per theme.
// Tapping opens the detail screen in Scriptable (all products of the theme, tap a product for its shop).

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

// Tile fills are semi-transparent on purpose: with a tinted home screen iOS turns every opaque colour
// into solid white (hiding the white text on it), while translucent fills stay translucent.
const C = {
  bg: new Color("#161617"),
  tile: new Color("#ffffff", 0.08),
  text: new Color("#f2f2f7"),
  muted: new Color("#98989f"),
  green: new Color("#34b36b"),
  dealTile: new Color("#34b36b", 0.5),
  white: new Color("#ffffff"),
  sharpTile: new Color("#34b36b", 0.16),
  sharpText: new Color("#5fd28f"),
  redTile: new Color("#ff7a63", 0.15),
  redText: new Color("#ff7a63"),
  amber: new Color("#f0b54a"),
};

// Per status: [tile background, price colour, small text colour, name colour]
const STYLE = {
  Deal: [C.dealTile, C.white, C.white, C.white],
  Scherp: [C.sharpTile, C.sharpText, C.sharpText, C.muted],
  Normaal: [C.tile, C.text, C.muted, C.muted],
  Duur: [C.redTile, C.redText, C.redText, C.muted],
  "Geen prijs": [C.tile, C.muted, C.muted, C.muted],
};
const TEXT_COLOR = { Deal: C.green, Scherp: C.sharpText, Normaal: C.text, Duur: C.redText, "Geen prijs": C.muted };

const eur = (v) => v == null ? "—" : "€" + new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
const pct = (d) => d == null ? "" : (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(Math.round(d)) + "%";
const shopName = (s) => (s || "").replace(/\s*\(.*\)$/, "");

function daysToBlackFriday() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((BLACK_FRIDAY - today) / 86400000);
}

function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function groupsOf(data) {
  if (data.groups && data.groups.length) return data.groups;
  const seen = [];
  for (const it of data.items) if (!seen.find((g) => g.title === it.group)) seen.push({ id: it.group, short: it.group, title: it.group });
  return seen;
}
const inGroup = (it, g) => it.group_id === g.id || it.group === g.title;

function findGroup(data, text) {
  const q = (text || "").trim().toLowerCase();
  if (!q) return null;
  return groupsOf(data).find((g) => [g.id, g.short, g.title].some((x) => (x || "").toLowerCase().startsWith(q))) || null;
}

function runUrl(params) {
  const base = URLScheme.forRunningScript();
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  return q ? base + (base.includes("?") ? "&" : "?") + q : base;
}

// ---------- widget ----------

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

function addTile(row, L, tileW, tileH) {
  const t = row.addStack();
  t.size = new Size(tileW, tileH);
  t.backgroundColor = C.tile;
  t.cornerRadius = L.big ? 12 : 9;
  t.layoutVertically();
  t.setPadding(2, L.big ? 9 : 7, 2, L.big ? 9 : 7);
  return t;
}

function headerTile(t, data, L, title, deals) {
  t.backgroundColor = Color.clear();
  t.setPadding(2, 3, 2, 3);
  t.addSpacer();
  const head = t.addText(title);
  head.font = Font.semiboldSystemFont(L.big ? 15 : 12);
  head.textColor = C.text;
  head.lineLimit = 1;
  head.minimumScaleFactor = 0.75;
  const d = daysToBlackFriday();
  const parts = [];
  if (deals) parts.push(`${deals} deal${deals > 1 ? "s" : ""}`);
  if (d > 0) parts.push(`BF ${d} d`);
  else if (d === 0) parts.push("Black Friday!");
  const sub = t.addText(parts.join(" · ") || " ");
  sub.font = Font.semiboldSystemFont(L.big ? 11 : 8.5);
  sub.textColor = deals ? C.green : C.muted;
  sub.lineLimit = 1;
  sub.minimumScaleFactor = 0.8;
  if (data.updated && data.updated < todayIso()) {
    // Only show the date when the data is not from today.
    const upd = new Date(data.updated + "T12:00:00");
    const old = t.addText("stand " + upd.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }));
    old.font = Font.mediumSystemFont(L.big ? 10 : 8);
    old.textColor = C.amber;
    old.lineLimit = 1;
  }
  t.addSpacer();
}

function textLine(t, L, left, right, leftColor, rightColor, leftSize) {
  const line = t.addStack();
  line.centerAlignContent();
  const a = line.addText(left);
  a.font = Font.semiboldSystemFont(leftSize || (L.big ? 17 : 12.5));
  a.textColor = leftColor;
  a.lineLimit = 1;
  a.minimumScaleFactor = 0.7;
  line.addSpacer();
  const b = line.addText(right);
  b.font = Font.semiboldSystemFont(L.big ? 11 : 8.5);
  b.textColor = rightColor;
  b.lineLimit = 1;
}

function label(t, L, text, color) {
  const n = t.addText(text);
  n.font = Font.systemFont(L.big ? 11 : 8.5);
  n.textColor = color;
  n.lineLimit = 1;
  n.minimumScaleFactor = 0.75;
}

function productTile(t, it, L) {
  const [fill, priceColor, smallColor, nameColor] = STYLE[it.status] || STYLE.Normaal;
  t.backgroundColor = fill;
  t.addSpacer();
  label(t, L, it.name, nameColor);
  textLine(t, L, eur(it.best), it.best == null ? "geen prijs" : pct(it.diff_pct), priceColor, smallColor);
  if (L.big && it.shop) label(t, L, shopName(it.shop), nameColor);
  t.addSpacer();
}

function themeTile(t, g, items, L) {
  const deals = items.filter((i) => i.status === "Deal").length;
  const top = items[0];
  const status = deals ? "Deal" : top && top.status === "Scherp" ? "Scherp" : "Normaal";
  const [fill, priceColor, smallColor, nameColor] = STYLE[status];
  t.backgroundColor = fill;
  t.addSpacer();
  label(t, L, `${g.short} · ${items.length}`, nameColor);
  const main = deals ? `${deals} deal${deals > 1 ? "s" : ""}` : top ? eur(top.best) : "—";
  textLine(t, L, main, top ? pct(top.diff_pct) : "", priceColor, smallColor, L.big ? 15 : 11.5);
  if (L.big && top) label(t, L, "beste: " + top.name, nameColor);
  t.addSpacer();
}

function buildWidget(data, family, param) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  if (!data) {
    const t = w.addText("Prijswaker: nog geen gegevens");
    t.textColor = C.muted;
    t.font = Font.systemFont(12);
    return w;
  }
  const L = layout(family);
  w.setPadding(L.pad, L.pad, L.pad, L.pad);
  const tileW = Math.floor((L.w - 2 * L.pad - (L.cols - 1) * L.gap) / L.cols);
  const tileH = Math.floor((L.h - 2 * L.pad - (L.rows - 1) * L.gap) / L.rows);
  const capacity = L.cols * L.rows - 1;

  const group = findGroup(data, param);
  // Items arrive sorted: deals first, then normal (lowest % first), then expensive, then no price.
  const items = group ? data.items.filter((i) => inGroup(i, group)) : data.items;
  const deals = items.filter((i) => i.status === "Deal").length;
  w.url = runUrl({ group: group && group.id });

  // Slots: header first, then products; when everything does not fit (and no theme was chosen),
  // one tile per theme first, then the best products in the remaining slots.
  const slots = [{ kind: "header" }];
  const groups = groupsOf(data);
  if (!group && items.length > capacity && groups.length > 1) {
    for (const g of groups) slots.push({ kind: "theme", g, items: items.filter((i) => inGroup(i, g)) });
  }
  for (const it of items) if (slots.length <= capacity) slots.push({ kind: "item", it });

  const grid = w.addStack();
  grid.layoutVertically();
  grid.spacing = L.gap;
  for (let r = 0; r * L.cols < slots.length && r < L.rows; r++) {
    const row = grid.addStack();
    row.spacing = L.gap;
    for (let c = 0; c < L.cols; c++) {
      const s = slots[r * L.cols + c];
      if (!s) {
        const empty = row.addStack();
        empty.size = new Size(tileW, tileH);
        continue;
      }
      const t = addTile(row, L, tileW, tileH);
      if (s.kind === "header") headerTile(t, data, L, group ? group.short : "Prijswaker", deals);
      else if (s.kind === "theme") themeTile(t, s.g, s.items, L);
      else productTile(t, s.it, L);
      // Medium and large widgets can link each tile; the small one opens the screen of the whole widget.
      if (family !== "small" && s.kind !== "header") {
        const gid = s.kind === "theme" ? s.g.id : s.it.group_id;
        t.url = runUrl({ group: gid, product: s.kind === "item" ? s.it.product : null });
      }
    }
  }
  w.addSpacer();
  return w;
}

// ---------- detail screen (opens in Scriptable when you tap the widget) ----------

function detailScreen(data, groupId, productId) {
  const table = new UITable();
  table.showSeparators = true;
  const add = (height, fill, build, onSelect) => {
    const row = new UITableRow();
    row.height = height;
    row.backgroundColor = fill || C.bg;
    build(row);
    if (onSelect) {
      row.onSelect = onSelect;
      row.dismissOnSelect = false;
    }
    table.addRow(row);
    return row;
  };

  const d = daysToBlackFriday();
  const upd = new Date(data.updated + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "long" });
  add(64, C.bg, (row) => {
    const c = row.addText("Prijswaker", `Stand ${upd}${d > 0 ? ` · Black Friday over ${d} dagen` : ""}`);
    c.titleFont = Font.boldSystemFont(24);
    c.titleColor = C.text;
    c.subtitleColor = data.updated < todayIso() ? C.amber : C.muted;
    c.subtitleFont = Font.systemFont(13);
  });

  const all = groupsOf(data);
  const first = all.find((g) => g.id === groupId);
  const ordered = first ? [first, ...all.filter((g) => g !== first)] : all;
  for (const g of ordered) {
    const items = data.items.filter((i) => inGroup(i, g));
    if (!items.length) continue;
    const deals = items.filter((i) => i.status === "Deal").length;
    add(44, C.bg, (row) => {
      const c = row.addText(g.title.toUpperCase(), null);
      c.titleFont = Font.semiboldSystemFont(13);
      c.titleColor = C.muted;
      const r = row.addText(deals ? `${deals} deal${deals > 1 ? "s" : ""}` : `${items.length} producten`);
      r.rightAligned();
      r.titleFont = Font.semiboldSystemFont(13);
      r.titleColor = deals ? C.green : C.muted;
    });
    for (const it of items) {
      const fill = it.product === productId ? new Color("#2c2c30") : new Color("#1f1f21");
      const parts = [shopName(it.shop) || "geen prijs die meetelt"];
      if (it.avg2026) parts.push(`gem. ${eur(it.avg2026)}`);
      if (it.threshold) parts.push(`deal ≤ ${eur(it.threshold)}`);
      add(66, fill, (row) => {
        const left = row.addText(it.full_name || it.name, parts.join(" · "));
        left.widthWeight = 70;
        left.titleFont = Font.semiboldSystemFont(15);
        left.titleColor = C.text;
        left.subtitleFont = Font.systemFont(12);
        left.subtitleColor = C.muted;
        const right = row.addText(eur(it.best), it.best == null ? "" : `${pct(it.diff_pct)} · ${it.status.toLowerCase()}`);
        right.widthWeight = 30;
        right.rightAligned();
        right.titleFont = Font.semiboldSystemFont(17);
        right.titleColor = TEXT_COLOR[it.status] || C.text;
        right.subtitleFont = Font.semiboldSystemFont(12);
        right.subtitleColor = TEXT_COLOR[it.status] === C.text ? C.muted : TEXT_COLOR[it.status];
      }, it.url ? () => Safari.open(it.url) : null);
    }
  }

  add(56, C.bg, (row) => {
    const c = row.addText("Volledig dashboard openen ↗", "Grafieken, alle winkels en het advies per product");
    c.titleFont = Font.semiboldSystemFont(15);
    c.titleColor = C.green;
    c.subtitleFont = Font.systemFont(12);
    c.subtitleColor = C.muted;
  }, () => Safari.open(data.dashboard));
  return table;
}

// ---------- run ----------

const data = await loadData();
if (config.runsInWidget) {
  Script.setWidget(buildWidget(data, config.widgetFamily || "small", args.widgetParameter));
} else if (data) {
  const q = args.queryParameters || {};
  await detailScreen(data, q.group, q.product).present(false);
} else {
  const a = new Alert();
  a.title = "Prijswaker";
  a.message = "Geen gegevens: controleer je internetverbinding.";
  a.addAction("OK");
  await a.present();
}
Script.complete();
