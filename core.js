// BF Deals widget design (tiles, dark), the app screen and adding products. Loaded by the loader
// script (Prijswaker.js); edit this file to change the look. Runs inside an async function, so
// top-level await is fine.
//
// Two people use it. Each phone remembers who it belongs to (Jasper or Rebecca) and which themes to
// show; every product has an owner ("gedeeld", "jasper" or "rebecca") and you see the shared ones
// plus your own. Without a parameter the widget shows every chosen theme as its own section: a label
// with the theme's deals, then at most 3 of its products (deals always; when more, expensive ones go
// first, then normal ones). Widget parameter (long-press > Edit widget > Parameter): a theme name such
// as "Pannen" or "Speakers" shows only that theme. Tapping opens the app screen: all products, add a
// product, choose themes, switch person.

const DATA_URL = "https://raw.githubusercontent.com/jcgate26/prijswaker-widget/main/widget.json";
const BLACK_FRIDAY = new Date(2026, 10, 27);

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "prijswaker-widget.json");

// Per phone: who this is and which themes are hidden. Kept in Scriptable's documents (also read by
// the widget); the key for adding products lives in the Keychain.
const settingsPath = fm.joinPath(fm.documentsDirectory(), "bfdeals-instellingen.json");
const KEY_NAME = "bfdeals-github-sleutel";
const NAMES = { jasper: "Jasper", rebecca: "Rebecca" };
const OTHER = { jasper: "Rebecca", rebecca: "Jasper" };

function loadSettings() {
  try {
    if (fm.fileExists(settingsPath)) {
      const s = JSON.parse(fm.readString(settingsPath));
      return { who: NAMES[s.who] ? s.who : null, hidden: Array.isArray(s.hidden) ? s.hidden : [] };
    }
  } catch (e) { /* damaged file: start fresh */ }
  return { who: null, hidden: [] };
}
function saveSettings(S) {
  fm.writeString(settingsPath, JSON.stringify({ who: S.who, hidden: S.hidden }));
}

// Shared products for everyone; your own only for you. Before you say who you are: shared only.
const canSee = (it, S) => { const o = it.owner || "gedeeld"; return o === "gedeeld" || (S.who && o === S.who); };

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
const CORE_VERSION = "v10";

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

// Top row: "BF Deals" (or the chosen theme) left; Black Friday countdown right. With one theme,
// its deals go here too. A stale date shows in amber.
function headerImage(data, L, w, h, title, deals, setUp) {
  const d = daysToBlackFriday();
  const parts = [];
  if (!setUp) parts.push("tik om in te stellen");
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
    bold: true, leftColor: C.text, rightColor: stale || !setUp ? C.amber : deals ? C.green : C.muted }], null, 0, 3);
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

function buildWidget(data, family, param, S) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  if (!data) {
    const t = w.addText("BF Deals: nog geen gegevens");
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
  const sections = (chosen ? [chosen] : groupsOf(data).filter((g) => !S.hidden.includes(g.id)))
    .map((g) => {
      const items = data.items.filter((i) => inGroup(i, g) && canSee(i, S));
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
  addImageRow(headerImage(data, L, innerW, L.headH, chosen ? chosen.short || chosen.title : data.name || "BF Deals",
    chosen ? totalDeals : null, !!S.who), L.headH);

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

// ---------- adding a product (from the app screen or the Safari share sheet) ----------

// The request becomes a GitHub issue in the private prijswaker repository. A GitHub Action turns it
// into a line in nieuwe-producten.txt and the cloud round adds the product and tracks it everywhere.
const REPO = "jcgate26/prijswaker";

async function ask(title, message, actions, cancel = "Annuleer") {
  const a = new Alert();
  a.title = title;
  a.message = message;
  actions.forEach((x) => a.addAction(x));
  if (cancel) a.addCancelAction(cancel);
  return await a.present();
}

// Setup code, sent by the other person in one message: BFDEALS:<who>:<key>. Copying the whole message
// and opening the app is enough; the app finds the code on the clipboard and sets itself up.
const SETUP_RE = /BFDEALS:(jasper|rebecca):(github_pat_[A-Za-z0-9_]{20,})/;
const DOC_URL = "https://github.com/jcgate26/prijswaker-widget/blob/main/INSTALLEREN.md";

async function trySetupFromClipboard(S) {
  let clip = "";
  try { clip = Pasteboard.pasteString() || ""; } catch (e) { return false; }
  const m = clip.match(SETUP_RE);
  if (!m) return false;
  S.who = m[1];
  saveSettings(S);
  Keychain.set(KEY_NAME, m[2]);
  try { Pasteboard.copyString(""); } catch (e) { /* leave the clipboard */ }
  await ask(`Klaar, ${NAMES[S.who]}!`, `BF Deals is ingesteld. Zet nu de widget op je beginscherm.\n\nAll set! Now add the widget to your home screen.`, ["OK"], null);
  return true;
}

async function askKey(S) {
  if (await trySetupFromClipboard(S)) return Keychain.get(KEY_NAME);
  const a = new Alert();
  a.title = "Instelcode";
  a.message = `Plak de instelcode uit het bericht van ${S.who ? OTHER[S.who] : "Jasper"} (begint met BFDEALS:). Je hoeft dit maar één keer te doen.`;
  a.addSecureTextField("BFDEALS:…", "");
  a.addAction("Bewaar");
  a.addCancelAction("Annuleer");
  if ((await a.present()) === -1) return null;
  const text = a.textFieldValue(0).trim();
  const m = text.match(SETUP_RE);
  const key = m ? m[2] : /^github_pat_\w{20,}$/.test(text) ? text : null;
  if (!key) {
    await ask("Dat is geen instelcode", "Kopieer het hele bericht met de code en probeer het opnieuw.", ["OK"], null);
    return null;
  }
  if (m && !S.who) { S.who = m[1]; saveSettings(S); }
  Keychain.set(KEY_NAME, key);
  return key;
}

// Make a setup code for the other person and send it (WhatsApp, Berichten, ...) via the share sheet.
async function invite(S) {
  const other = S.who === "rebecca" ? "jasper" : "rebecca";
  const a = new Alert();
  a.title = `${NAMES[other]} uitnodigen`;
  a.message = `Plak de sleutel die je op github.com voor ${NAMES[other]} hebt gemaakt (begint met github_pat_). Daarna kies je hoe je hem verstuurt.`;
  a.addSecureTextField("github_pat_…", "");
  a.addAction("Maak bericht");
  a.addCancelAction("Annuleer");
  if ((await a.present()) === -1) return;
  const key = a.textFieldValue(0).trim();
  if (!/^github_pat_\w{20,}$/.test(key)) {
    await ask("Dat is geen sleutel", "Een sleutel begint met github_pat_. Kopieer hem opnieuw op github.com.", ["OK"], null);
    return;
  }
  const msg = `Hoi ${NAMES[other]}! Hier is BF Deals voor je iPhone. Uitleg (Nederlands + English):\n${DOC_URL}\n\n`
    + `Je persoonlijke instelcode, niet doorsturen / your personal setup code, don't share:\nBFDEALS:${other}:${key}`;
  await ShareSheet.present([msg]);
}

async function addProduct(S, presetUrl) {
  if (!S.who) await askWho(S);
  if (!S.who) return false;
  let key = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) : await askKey(S);
  if (!key) return false;
  let preset = presetUrl || "";
  if (!preset) {
    try {
      const clip = (Pasteboard.pasteString() || "").trim();
      if (/^https?:\/\/\S+$/.test(clip)) preset = clip;
    } catch (e) { /* no clipboard access */ }
  }
  const a = new Alert();
  a.title = "Product toevoegen";
  a.message = "Een link uit een willekeurige winkel of de naam van het product. BF Deals zoekt het product daarna overal op, niet alleen in die winkel.";
  a.addTextField("Link of productnaam", preset);
  a.addTextField("Notitie, bijv. kleur (mag leeg)", "");
  a.addAction("Verder");
  a.addCancelAction("Annuleer");
  if ((await a.present()) === -1) return false;
  const product = a.textFieldValue(0).replace(/\s+/g, " ").trim();
  const note = a.textFieldValue(1).replace(/\s+/g, " ").trim();
  if (product.length < 3) {
    await ask("Niets toegevoegd", "Vul een link of productnaam in.", ["OK"], null);
    return false;
  }

  // Theme: one of the themes you can see, a new one, or let the round pick.
  const themes = data ? groupsOf(data).filter((g) => data.items.some((i) => inGroup(i, g) && canSee(i, S))).map((g) => g.short || g.title) : [];
  const ti = await ask("Bij welk thema?", "Kies een bestaand thema of maak een nieuw thema, bijvoorbeeld Keuken of Fietsen.",
    [...themes, "＋ Nieuw thema…", "Laat BF Deals kiezen"]);
  if (ti === -1) return false;
  let theme = ti < themes.length ? themes[ti] : "";
  if (ti === themes.length) {
    const n = new Alert();
    n.title = "Nieuw thema";
    n.message = "Eén of twee woorden. Dit wordt de kop in je widget.";
    n.addTextField("Bijv. Keuken", "");
    n.addAction("Maak thema");
    n.addCancelAction("Annuleer");
    if ((await n.present()) === -1) return false;
    theme = n.textFieldValue(0).replace(/[^\p{L}\p{N} &-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
  }

  const wi = await ask("Voor wie?", `Alleen voor jou: ${OTHER[S.who]} ziet het niet. Gedeeld: jullie zien het allebei.`,
    ["Alleen voor mij", `Gedeeld met ${OTHER[S.who]}`]);
  if (wi === -1) return false;
  const owner = wi === 0 ? S.who : "gedeeld";
  const req = new Request(`https://api.github.com/repos/${REPO}/issues`);
  req.method = "POST";
  req.timeoutInterval = 20;
  req.headers = { Authorization: "Bearer " + key, Accept: "application/vnd.github+json",
    "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" };
  req.body = JSON.stringify({
    title: `BF Deals: nieuw product (${NAMES[S.who]})`,
    body: `wie: ${owner}\nproduct: ${product}\nthema: ${theme}\nnotitie: ${note}\n\nAangevraagd in de BF Deals-widget door ${NAMES[S.who]}.`,
  });
  let status = 0;
  try {
    await req.loadJSON();
    status = req.response ? req.response.statusCode : 0;
  } catch (e) { status = -1; }
  if (status === 201) {
    await ask("Toegevoegd", `${owner === "gedeeld" ? `Gedeeld met ${OTHER[S.who]}` : "Alleen voor jou"}${theme ? `, thema ${theme}` : ""}. BF Deals zoekt het product op in alle winkels; uiterlijk morgenochtend staat het in je widget.`, ["OK"], null);
    return true;
  }
  if (status === 401 || status === 403 || status === 404) {
    Keychain.remove(KEY_NAME);
    await ask("Instelcode werkt niet meer", `De code is verlopen of ingetrokken. Vraag ${OTHER[S.who]} om een nieuwe instelcode en probeer het opnieuw.`, ["OK"], null);
  } else {
    await ask("Niet gelukt", "Geen verbinding met GitHub. Probeer het straks opnieuw.", ["OK"], null);
  }
  return false;
}

// ---------- app screen (opens in Scriptable when you tap the widget) ----------

async function askWho(S) {
  const i = await ask("Wie ben je?", "BF Deals laat je de gedeelde producten zien en die van jezelf.", ["Jasper", "Rebecca"], "Later");
  if (i === -1) return;
  S.who = i === 0 ? "jasper" : "rebecca";
  saveSettings(S);
}

function detailScreen(data, S, groupId, productId) {
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
  const action = (title, sub, color, fn) => add(56, C.bg, (row) => {
    const c = row.addText(title, sub);
    c.titleFont = Font.semiboldSystemFont(15);
    c.titleColor = color;
    c.subtitleFont = Font.systemFont(12);
    c.subtitleColor = C.muted;
  }, async () => { await fn(); fill(); });

  // mode: "list" (products) or "themes" (pick which themes to show)
  let mode = "list";
  const fill = () => {
    table.removeAllRows();
    const d = daysToBlackFriday();
    const upd = new Date(data.updated + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "long" });
    add(64, C.bg, (row) => {
      const c = row.addText(data.name || "BF Deals", `${S.who ? NAMES[S.who] + " · " : ""}stand ${upd}${d > 0 ? ` · Black Friday over ${d} dagen` : ""}`);
      c.titleFont = Font.boldSystemFont(24);
      c.titleColor = C.text;
      c.subtitleColor = data.updated < todayIso() ? C.amber : C.muted;
      c.subtitleFont = Font.systemFont(13);
    });

    if (!S.who) {
      action("Wie ben je? Tik om in te stellen", "Tot die tijd zie je alleen de gedeelde producten", C.amber, () => askWho(S));
    }

    if (mode === "themes") {
      add(44, C.bg, (row) => {
        const c = row.addText("THEMA'S IN JE WIDGET", "Tik om aan of uit te zetten");
        c.titleFont = Font.semiboldSystemFont(13);
        c.titleColor = C.muted;
        c.subtitleFont = Font.systemFont(12);
        c.subtitleColor = C.muted;
      });
      for (const g of groupsOf(data)) {
        const items = data.items.filter((i) => inGroup(i, g) && canSee(i, S));
        if (!items.length) continue;
        const on = !S.hidden.includes(g.id);
        add(52, new Color("#1f1f21"), (row) => {
          const c = row.addText(`${on ? "✓" : "○"}  ${g.short || g.title}`, `${items.length} producten${g.short && g.short !== g.title ? " · " + g.title : ""}`);
          c.titleFont = Font.semiboldSystemFont(16);
          c.titleColor = on ? C.green : C.muted;
          c.subtitleFont = Font.systemFont(12);
          c.subtitleColor = C.muted;
        }, () => {
          S.hidden = on ? [...S.hidden, g.id] : S.hidden.filter((x) => x !== g.id);
          saveSettings(S);
          fill();
        });
      }
      action("Klaar", null, C.green, () => { mode = "list"; });
      table.reload();
      return;
    }

    const all = groupsOf(data).filter((g) => !S.hidden.includes(g.id) || g.id === groupId);
    const first = all.find((g) => g.id === groupId);
    const ordered = first ? [first, ...all.filter((g) => g !== first)] : all;
    for (const g of ordered) {
      const items = data.items.filter((i) => inGroup(i, g) && canSee(i, S));
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
        const fillColor = it.product === productId ? new Color("#2c2c30") : new Color("#1f1f21");
        const parts = [shopName(it.shop) || "geen prijs die meetelt"];
        if (it.avg2026) parts.push(`gem. ${eur(it.avg2026)}`);
        if (it.threshold) parts.push(`deal ≤ ${eur(it.threshold)}`);
        if ((it.owner || "gedeeld") !== "gedeeld") parts.push("alleen jij");
        add(66, fillColor, (row) => {
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

    action("＋  Product toevoegen", "Plak een link uit een winkel; ook via Deel › Scriptable in Safari", C.green, () => addProduct(S));
    action("Thema's kiezen", "Welke thema's je widget laat zien", C.text, () => { mode = "themes"; });
    action(S.who ? `Ik ben ${NAMES[S.who]} · wisselen` : "Wie ben je?", Keychain.contains(KEY_NAME) ? "Toevoegen is ingesteld" : "Toevoegen nog niet ingesteld (instelcode nodig)", C.muted, async () => {
      const i = await ask("Instellingen", null, ["Ik ben Jasper", "Ik ben Rebecca", "Instelcode opnieuw plakken"], "Annuleer");
      if (i === 0 || i === 1) { S.who = i === 0 ? "jasper" : "rebecca"; saveSettings(S); }
      if (i === 2) await askKey(S);
    });
    if (S.who === "jasper") action(`${OTHER[S.who]} uitnodigen`, `Stuur ${OTHER[S.who]} een bericht met de uitleg en een instelcode`, C.muted, () => invite(S));
    action("Volledig dashboard openen ↗", "Grafieken, alle winkels en het advies per product", C.green, () => Safari.open(data.dashboard));
    table.reload();
  };
  fill();
  return table;
}

// ---------- run ----------

const S = loadSettings();
const data = await loadData();
const shared = (args.urls && args.urls.length ? args.urls : (args.plainTexts || []).filter((t) => /^https?:\/\//.test(t)));
if (config.runsInWidget) {
  Script.setWidget(buildWidget(data, config.widgetFamily || "small", args.widgetParameter, S));
} else if (config.runsInActionExtension || (shared && shared.length)) {
  // Safari: Deel › Scriptable › BF Deals (needs "Share Sheet Inputs: URLs" in the script settings).
  await addProduct(S, shared && shared[0]);
} else if (data) {
  const q = args.queryParameters || {};
  if (!S.who || !Keychain.contains(KEY_NAME)) await trySetupFromClipboard(S);
  if (!S.who) await askWho(S);
  if (q.action === "add") await addProduct(S);
  await detailScreen(data, S, q.group, q.product).present(false);
} else {
  const a = new Alert();
  a.title = "BF Deals";
  a.message = "Geen gegevens: controleer je internetverbinding.";
  a.addAction("OK");
  await a.present();
}
Script.complete();
