// Prijswaker widget design (tiles, dark) and the detail screen. Loaded by Prijswaker.js; edit this file
// to change the look. Runs inside an async function, so top-level await is fine.
//
// Without a parameter the widget shows every theme as its own section: a label with the theme's deals,
// then at most 3 of its products (deals always; when more, expensive ones go first, then normal ones). Widget parameter (long-press > Edit widget > Parameter): a theme name such as "Pannen" or
// "Speakers" shows only that theme.
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

// Tiles have no fill, only a thin border. With a tinted or black-and-white home screen iOS turns
// filled shapes into solid white (hiding the text on them); borders and text stay readable.
const C = {
  bg: new Color("#161617"),
  text: new Color("#f2f2f7"),
  muted: new Color("#98989f"),
  green: new Color("#34b36b"),
  white: new Color("#ffffff"),
  sharpText: new Color("#5fd28f"),
  redText: new Color("#ff7a63"),
  amber: new Color("#f0b54a"),
};

// Per status: [border colour, border width, price colour, small text colour, name colour]
const STYLE = {
  Deal: [C.green, 2, C.sharpText, C.sharpText, C.text],
  Scherp: [C.sharpText, 1, C.sharpText, C.sharpText, C.muted],
  Normaal: [new Color("#5a5a60"), 1, C.text, C.muted, C.muted],
  Duur: [C.redText, 1, C.redText, C.redText, C.muted],
  "Geen prijs": [new Color("#5a5a60"), 1, C.muted, C.muted, C.muted],
};
const TEXT_COLOR = { Deal: C.green, Scherp: C.sharpText, Normaal: C.text, Duur: C.redText, "Geen prijs": C.muted };

const eur = (v) => v == null ? "—" : "€" + new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
const pct = (d) => d == null ? "" : (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(Math.round(d)) + "%";
// Whole euros in the widget tiles (no room for cents); the detail screen keeps cents.
const eur0 = (v) => v == null ? "—" : "€" + new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(Math.round(v));
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
  // Prefix match either way, so an old parameter like "Soundbars" still finds the theme with id "soundbar".
  return groupsOf(data).find((g) => [g.id, g.short, g.title].some((x) => {
    const v = (x || "").toLowerCase();
    return v && (v.startsWith(q) || q.startsWith(v));
  })) || null;
}

function runUrl(params) {
  const base = URLScheme.forRunningScript();
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  return q ? base + (base.includes("?") ? "&" : "?") + q : base;
}

// ---------- widget ----------

// Widget size in points, derived from the screen width (iOS widget sizes scale with the phone).
// The widget is built from rows: one header row, then per theme a label row (theme name and its
// deals) followed by tile rows with that theme's products. minTile/maxTile bound the tile height.
function layout(family) {
  const s = Device.screenSize();
  const screenW = Math.min(s.width, s.height);
  const small = Math.round(screenW * 0.395);
  const wide = Math.round(screenW * 0.847);
  const tall = Math.round(small * 2.24);
  if (family === "large") return { w: wide, h: tall, cols: 3, pad: 12, gap: 6, headH: 22, labelH: 17, minTile: 46, maxTile: 76, big: true };
  if (family === "medium") return { w: wide, h: small, cols: 4, pad: 11, gap: 4, headH: 14, labelH: 13, minTile: 34, maxTile: 46, big: false };
  return { w: small, h: small, cols: 2, pad: 9, gap: 4, headH: 14, labelH: 13, minTile: 34, maxTile: 46, big: false };
}

// Each tile is drawn as a transparent image (border + text only). Home screens in tinted or
// black-and-white mode turn widget shapes into solid white; a transparent image keeps only its
// lines and letters, so the tiles stay readable in every home screen style.
const CORE_VERSION = "v8";

function canvas(w, h) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  return ctx;
}

function border(ctx, w, h, color, width, radius) {
  if (!width) return;
  const p = new Path();
  const i = width / 2;
  p.addRoundedRect(new Rect(i, i, w - width, h - width), radius, radius);
  ctx.addPath(p);
  ctx.setStrokeColor(color);
  ctx.setLineWidth(width);
  ctx.strokePath();
}

function text(ctx, str, x, y, w, size, color, opts = {}) {
  ctx.setFont(opts.bold ? Font.semiboldSystemFont(size) : Font.systemFont(size));
  ctx.setTextColor(color);
  if (opts.right) ctx.setTextAlignedRight();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, new Rect(x, y, w, size * 1.35));
}

// lines: [{left, right, size, bold, leftColor, rightColor, rightSize}] drawn vertically centred
function drawTile(L, w, h, lines, borderColor, borderWidth, padX) {
  const ctx = canvas(w, h);
  border(ctx, w, h, borderColor, borderWidth, L.big ? 12 : 9);
  const heights = lines.map((l) => l.size * 1.28);
  let y = (h - heights.reduce((a, b) => a + b, 0)) / 2;
  lines.forEach((l, i) => {
    const inner = w - 2 * padX;
    if (l.right) {
      const rs = l.rightSize || l.size;
      text(ctx, l.right, padX, y + (l.size - rs) * 0.85, inner, rs, l.rightColor || l.leftColor, { bold: true, right: true });
    }
    text(ctx, l.left, padX, y, inner - (l.right ? l.right.length * (l.rightSize || l.size) * 0.55 + 2 : 0), l.size, l.leftColor, { bold: l.bold });
    y += heights[i];
  });
  return ctx.getImage();
}

function priceSize(L, value, tileW) {
  const base = L.big ? 17 : 12.5;
  // Narrow tiles: shrink four-digit prices so the % still fits next to them.
  return value != null && value >= 1000 && tileW < 80 ? base - 2 : base;
}

const dealText = (n) => `${n} deal${n > 1 ? "s" : ""}`;

// The overview shows at most PER_THEME products per theme. Deals always stay (even when there are
// more), then the rest fills up by status: sharp first, then grey (normal, no price), red (expensive) last.
// Within a status the data's own order is kept (lowest % first).
const PER_THEME = 3;
const KEEP_ORDER = { Deal: 0, Scherp: 1, Normaal: 2, "Geen prijs": 2, Duur: 3 };
function pickForTheme(items, max) {
  const rank = (i) => KEEP_ORDER[i.status] ?? 2;
  const sorted = items.map((it, n) => ({ it, n })).sort((a, b) => rank(a.it) - rank(b.it) || a.n - b.n).map((x) => x.it);
  const deals = sorted.filter((i) => i.status === "Deal").length;
  return sorted.slice(0, Math.max(max, deals));
}

// Top row: "Prijswaker" (or the chosen theme) left; Black Friday countdown right. With one theme,
// its deals go here too. A stale date shows in amber.
function headerImage(data, L, w, h, title, deals) {
  const d = daysToBlackFriday();
  const parts = [];
  if (deals != null) parts.push(deals ? dealText(deals) : "geen deals");
  if (data.updated && data.updated < todayIso()) {
    const upd = new Date(data.updated + "T12:00:00");
    parts.push("stand " + upd.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }));
  }
  if (d > 0) parts.push(`BF ${d} d`);
  else if (d === 0) parts.push("Black Friday!");
  const stale = data.updated && data.updated < todayIso();
  const right = parts.join(" · ");
  return drawTile(L, w, h, [{ left: title, right, size: L.big ? 15 : 12, rightSize: L.big ? 10.5 : 8,
    bold: true, leftColor: C.text, rightColor: stale ? C.amber : deals ? C.green : C.muted }], null, 0, 3);
}

// Theme label row: "SPEAKERS" left, the theme's deals right (green), plus how many products did not fit.
function labelImage(g, deals, hidden, L, w, h) {
  const parts = [deals ? dealText(deals) : "geen deals"];
  if (hidden > 0) parts.push(`+${hidden} meer`);
  return drawTile(L, w, h, [{ left: (g.short || g.title).toUpperCase(), right: parts.join(" · "),
    size: L.big ? 11.5 : 8.5, bold: true, leftColor: C.muted, rightColor: deals ? C.green : C.muted }], null, 0, 3);
}

function productImage(it, L, w, h) {
  const [bColor, bWidth, priceColor, smallColor, nameColor] = STYLE[it.status] || STYLE.Normaal;
  const small = L.big ? 11 : 8.5;
  const lines = [
    { left: it.name, size: small, leftColor: nameColor },
    { left: eur0(it.best), right: it.best == null ? "geen prijs" : pct(it.diff_pct), size: priceSize(L, it.best, w),
      rightSize: small, bold: true, leftColor: priceColor, rightColor: smallColor },
  ];
  if (L.big && it.shop && h >= 52) lines.push({ left: shopName(it.shop), size: 9.5, leftColor: nameColor });
  return drawTile(L, w, h, lines, bColor, bWidth, L.big ? 9 : 7);
}

// Tile height when the widget has nLabels label rows and nTiles tile rows.
function tileHeight(L, nLabels, nTiles) {
  if (!nTiles) return 0;
  const avail = L.h - 2 * L.pad - L.headH - nLabels * L.labelH - (nLabels + nTiles) * L.gap;
  return Math.floor(avail / nTiles);
}

// Hands out tile rows: first one per theme (in order), then extra rows to themes that still have
// products left, as long as the tiles stay at least minTile high.
function planRows(L, sections, withLabels) {
  const nLabels = withLabels ? sections.length : 0;
  let budget = 0;
  while (tileHeight(L, nLabels, budget + 1) >= L.minTile) budget++;
  sections.forEach((s) => { s.rows = 0; });
  let used = 0;
  for (const s of sections) if (used < budget && s.items.length) { s.rows = 1; used++; }
  let grew = true;
  while (used < budget && grew) {
    grew = false;
    for (const s of sections) {
      if (used < budget && s.items.length > s.rows * L.cols) { s.rows++; used++; grew = true; }
    }
  }
  return Math.min(L.maxTile, tileHeight(L, nLabels, used));
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
  const innerW = L.w - 2 * L.pad;
  const tileW = Math.floor((innerW - (L.cols - 1) * L.gap) / L.cols);

  // One theme (widget parameter) or all themes, each as its own section. Items arrive sorted:
  // deals first, then normal (lowest % first), then expensive, so deals are always on screen.
  const chosen = findGroup(data, param);
  const sections = (chosen ? [chosen] : groupsOf(data))
    .map((g) => {
      const items = data.items.filter((i) => inGroup(i, g));
      // One theme (parameter): all its products. Overview: at most PER_THEME per theme.
      const picked = chosen ? items : pickForTheme(items, PER_THEME);
      return { g, items: picked, total: items.length, deals: items.filter((i) => i.status === "Deal").length };
    })
    .filter((s) => s.items.length);
  const withLabels = !chosen;
  const tileH = planRows(L, sections, withLabels);
  w.url = runUrl({ group: chosen && chosen.id });

  const linkTiles = family !== "small";
  const col = w.addStack();
  col.layoutVertically();
  col.spacing = L.gap;

  const addImageRow = (img, h, url) => {
    const row = col.addStack();
    row.size = new Size(innerW, h);
    const wi = row.addImage(img);
    wi.imageSize = new Size(innerW, h);
    if (url && linkTiles) row.url = url;
  };

  const totalDeals = sections.reduce((a, s) => a + s.deals, 0);
  addImageRow(headerImage(data, L, innerW, L.headH, chosen ? chosen.short || chosen.title : "Prijswaker",
    chosen ? totalDeals : null), L.headH);

  for (const s of sections) {
    const shown = s.items.slice(0, s.rows * L.cols);
    if (withLabels) {
      addImageRow(labelImage(s.g, s.deals, s.total - shown.length, L, innerW, L.labelH), L.labelH,
        runUrl({ group: s.g.id }));
    }
    for (let r = 0; r < s.rows; r++) {
      const row = col.addStack();
      row.spacing = L.gap;
      for (let c = 0; c < L.cols; c++) {
        const it = shown[r * L.cols + c];
        const t = row.addStack();
        t.size = new Size(tileW, tileH);
        if (!it) continue;
        const wi = t.addImage(productImage(it, L, tileW, tileH));
        wi.imageSize = new Size(tileW, tileH);
        // Medium and large widgets link each tile; the small one opens the screen of the whole widget.
        if (linkTiles) t.url = runUrl({ group: it.group_id, product: it.product });
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
      const name = g.short && g.short !== g.title ? `${g.short} · ${g.title}` : g.title;
      const c = row.addText(name.toUpperCase(), null);
      c.titleFont = Font.semiboldSystemFont(13);
      c.titleColor = C.muted;
      const r = row.addText(deals ? `${dealText(deals)} · ${items.length} producten` : `geen deals · ${items.length} producten`);
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
