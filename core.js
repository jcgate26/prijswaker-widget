// BF Deals widget, the overview screen and adding products. Loaded by the loader script
// (Prijswaker.js); edit this file to change the look. Runs inside an async function, so top-level
// await is fine. Everything people see is in English.
//
// Two people use it. Each phone remembers who it belongs to (Jasper or Rebecca) and which themes to
// show; every product has an owner ("gedeeld" = shared, "jasper" or "rebecca") and you see the shared
// ones plus your own.
//
// Widget: a grid with one cell per theme (2x2 on small and medium, up to 2x4 on large). A cell shows
// the theme, its best price in large type, the product, and the discount in green when it is a deal.
// Widget parameter (long-press > Edit widget > Parameter) with a theme name, e.g. "Pans": the cells
// show that theme's products instead. Tapping opens the overview: every theme with all its products,
// plus add product, choose themes and settings.

const DATA_URL = "https://raw.githubusercontent.com/jcgate26/prijswaker-widget/main/widget.json";
const BLACK_FRIDAY = new Date(2026, 10, 27);
const CORE_VERSION = "v12";

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
      return { who: NAMES[s.who] ? s.who : null, hidden: Array.isArray(s.hidden) ? s.hidden : [], lastAdd: Number(s.lastAdd) || 0 };
    }
  } catch (e) { /* damaged file: start fresh */ }
  return { who: null, hidden: [], lastAdd: 0 };
}
function saveSettings(S) {
  fm.writeString(settingsPath, JSON.stringify({ who: S.who, hidden: S.hidden, lastAdd: S.lastAdd || 0 }));
}

// Shared products for everyone; your own only for you. Before you say who you are: shared only.
const ownerOf = (it) => it.owner || "gedeeld";
const canSee = (it, S) => { const o = ownerOf(it); return o === "gedeeld" || (S.who && o === S.who); };

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

// One accent colour (green = deal); everything else is white and two shades of grey. No fills, so a
// tinted or black-and-white home screen keeps it readable.
const HEX = { bg: "#1c1c1e", text: "#ffffff", green: "#30d158", amber: "#ff9f0a" };
const C = {
  bg: new Color(HEX.bg),
  text: new Color(HEX.text),
  muted: new Color("#ebebf5", 0.6),
  faint: new Color("#ebebf5", 0.32),
  green: new Color(HEX.green),
  amber: new Color(HEX.amber),
};

const fmt0 = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Whole euros in the widget; the overview keeps cents.
const eur0 = (v) => v == null ? "—" : "€" + fmt0.format(Math.round(v));
const eur = (v) => v == null ? "—" : "€" + (Number.isInteger(v) ? fmt0.format(v) : fmt2.format(v));
const pct = (d) => d == null ? "" : (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(Math.round(d)) + "%";
const shopName = (s) => (s || "").replace(/\s*\(.*\)$/, "").replace(/^art & craft$/i, "Art & Craft");
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
const themeName = (g) => g.short || g.title;

function findGroup(data, text) {
  const q = (text || "").trim().toLowerCase();
  if (!q) return null;
  // Prefix match either way, so an old parameter like "Pannen" or "Soundbars" still finds its theme.
  const aliases = { pannen: "pan", soundbars: "soundbar" };
  return groupsOf(data).find((g) => [g.id, g.short, g.title].some((x) => {
    const v = (x || "").toLowerCase();
    return v && (v.startsWith(q) || q.startsWith(v));
  }) || aliases[q] === g.id) || null;
}

// Best first: deals and lowest % under the average, then products without an average yet (new),
// then products without any price.
const rank = (i) => i.diff_pct != null ? i.diff_pct : i.best != null ? 1000 : 2000;
const byRank = (a, b) => rank(a) - rank(b) || (a.best || 0) - (b.best || 0);

// Themes you can see (shared + your own products), each with its products sorted best first.
function themesFor(data, S, includeHidden) {
  return groupsOf(data)
    .filter((g) => includeHidden || !S.hidden.includes(g.id))
    .map((g) => {
      const items = data.items.filter((i) => inGroup(i, g) && canSee(i, S)).sort(byRank);
      return { g, items, best: items[0], deals: items.filter((i) => i.status === "Deal").length,
        allMine: items.length > 0 && items.every((i) => ownerOf(i) !== "gedeeld") };
    })
    .filter((t) => t.items.length);
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
  if (family === "large") return { w: wide, h: tall, cols: 2, maxRows: 4, padX: 16, padY: 16, colGap: 18, rowGap: 10, label: 12, price: 30, name: 12, showName: true };
  if (family === "medium") return { w: wide, h: small, cols: 2, maxRows: 2, padX: 16, padY: 14, colGap: 18, rowGap: 6, label: 11, price: 25, name: 11, showName: true };
  return { w: small, h: small, cols: 2, maxRows: 2, padX: 13, padY: 13, colGap: 10, rowGap: 6, label: 10, price: 18, name: 9, showName: false, compact: true };
}

function addText(stack, str, font, color, opts = {}) {
  const t = stack.addText(str);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = opts.scale || 0.6;
  return t;
}

// One cell: label (theme or product) with the deal % on the right, price large, a small line below.
function addCell(row, L, cellW, cellH, cell, url) {
  const c = row.addStack();
  c.layoutVertically();
  c.size = new Size(cellW, cellH);
  if (url) c.url = url;
  c.addSpacer();
  const top = c.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();
  addText(top, cell.label, Font.semiboldSystemFont(L.label), C.muted, { scale: 0.8 });
  top.addSpacer();
  // Small widget: no room for the %, so a deal shows as a green price instead.
  if (cell.deal && !L.compact) addText(top, cell.deal, Font.semiboldSystemFont(L.label), C.green, { scale: 0.8 });
  c.addSpacer(1);
  addText(c, cell.price, Font.semiboldSystemFont(L.price), cell.deal && L.compact ? C.green : C.text, { scale: 0.55 });
  if (L.showName && cell.sub) {
    c.addSpacer(1);
    const line = c.addStack();
    line.layoutHorizontally();
    addText(line, cell.sub, Font.systemFont(L.name), C.muted, { scale: 0.8 });
    if (cell.note) addText(line, " · " + cell.note, Font.systemFont(L.name), C.faint, { scale: 0.8 });
  }
  c.addSpacer();
}

function cellForTheme(t) {
  const b = t.best;
  return {
    label: themeName(t.g),
    deal: b.status === "Deal" ? pct(b.diff_pct) : null,
    price: eur0(b.best),
    sub: b.name,
    note: b.best != null && b.diff_pct == null ? "new" : null,
  };
}

function cellForProduct(it) {
  return {
    label: it.name,
    deal: it.status === "Deal" ? pct(it.diff_pct) : null,
    price: eur0(it.best),
    sub: it.best == null ? "no shop yet" : shopName(it.shop),
    note: it.best != null && it.diff_pct == null ? "new" : null,
  };
}

function message(w, title, line, color) {
  w.addSpacer();
  addText(w, title, Font.semiboldSystemFont(15), C.text);
  w.addSpacer(3);
  addText(w, line, Font.systemFont(12), color || C.muted);
  w.addSpacer();
}

function buildWidget(data, family, param, S) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  // Ask iOS for a fresh widget every 15 minutes, so new products and prices (also ones the other
  // person added) show up soon. Right after you added a product: every 5 minutes for 2 hours.
  const justAdded = S.lastAdd && Date.now() - S.lastAdd < 2 * 60 * 60 * 1000;
  w.refreshAfterDate = new Date(Date.now() + (justAdded ? 5 : 15) * 60 * 1000);
  w.url = runUrl({});
  if (!data) { message(w, "BF Deals", "No data yet"); return w; }
  if (!S.who) { message(w, "BF Deals", "Tap to set up", C.amber); return w; }

  const L = layout(family);
  w.setPadding(L.padY, L.padX, L.padY, L.padX);
  const max = L.cols * L.maxRows;

  // One theme (parameter): its products. Otherwise one cell per theme; when there are more themes
  // than cells, themes with a deal win, in their usual order.
  const chosen = findGroup(data, param);
  let cells;
  if (chosen) {
    const t = themesFor(data, S, true).find((x) => x.g.id === chosen.id);
    cells = (t ? t.items : []).slice(0, max).map((it) => ({ ...cellForProduct(it), url: runUrl({ group: chosen.id }) }));
  } else {
    let themes = themesFor(data, S, false);
    if (themes.length > max) {
      const keep = [...themes].sort((a, b) => (b.deals > 0) - (a.deals > 0)).slice(0, max);
      themes = themes.filter((t) => keep.includes(t));
    }
    cells = themes.map((t) => ({ ...cellForTheme(t), url: runUrl({ group: t.g.id }) }));
  }
  if (!cells.length) { message(w, "BF Deals", "No themes chosen"); return w; }

  const rows = Math.min(L.maxRows, Math.ceil(cells.length / L.cols));
  const innerW = L.w - 2 * L.padX;
  const innerH = L.h - 2 * L.padY;
  const cellW = Math.floor((innerW - (L.cols - 1) * L.colGap) / L.cols);
  const cellH = Math.floor((innerH - (rows - 1) * L.rowGap) / rows);
  const linkCells = family !== "small";

  const grid = w.addStack();
  grid.layoutVertically();
  grid.spacing = L.rowGap;
  for (let r = 0; r < rows; r++) {
    const row = grid.addStack();
    row.layoutHorizontally();
    row.spacing = L.colGap;
    for (let col = 0; col < L.cols; col++) {
      const cell = cells[r * L.cols + col];
      if (cell) addCell(row, L, cellW, cellH, cell, linkCells ? cell.url : null);
      else { const e = row.addStack(); e.size = new Size(cellW, cellH); }
    }
  }
  return w;
}

// ---------- adding a product (from the overview or the Safari share sheet) ----------

// The request becomes a GitHub issue in the private prijswaker repository. A GitHub Action turns it
// into a line in nieuwe-producten.txt and a cloud routine adds the product and tracks it everywhere.
const REPO = "jcgate26/prijswaker";

async function ask(title, msg, actions, cancel = "Cancel") {
  const a = new Alert();
  a.title = title;
  if (msg) a.message = msg;
  actions.forEach((x) => a.addAction(x));
  if (cancel) a.addCancelAction(cancel);
  return await a.present();
}

// Setup code, sent by the other person: BFDEALS:<who>:<key>. Copying it and opening the app is
// enough; the app finds the code on the clipboard and sets itself up.
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
  await ask(`All set, ${NAMES[S.who]}!`, "BF Deals is ready. Now add the widget to your home screen.", ["OK"], null);
  return true;
}

async function askKey(S) {
  if (await trySetupFromClipboard(S)) return Keychain.get(KEY_NAME);
  const a = new Alert();
  a.title = "Setup code";
  a.message = `Paste the setup code from ${S.who ? OTHER[S.who] : "Jasper"} (it starts with BFDEALS:). You only need to do this once.`;
  a.addSecureTextField("BFDEALS:…", "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return null;
  const txt = a.textFieldValue(0).trim();
  const m = txt.match(SETUP_RE);
  const key = m ? m[2] : /^github_pat_\w{20,}$/.test(txt) ? txt : null;
  if (!key) {
    await ask("That's not a setup code", "Copy the whole message with the code and try again.", ["OK"], null);
    return null;
  }
  if (m && !S.who) { S.who = m[1]; saveSettings(S); }
  Keychain.set(KEY_NAME, key);
  return key;
}

// Make a setup code for the other person and send it (WhatsApp, Messages, ...) via the share sheet.
async function invite(S) {
  const other = S.who === "rebecca" ? "jasper" : "rebecca";
  const a = new Alert();
  a.title = `Invite ${NAMES[other]}`;
  a.message = `Paste the key you made on github.com for ${NAMES[other]} (it starts with github_pat_). Then choose how to send it.`;
  a.addSecureTextField("github_pat_…", "");
  a.addAction("Create message");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return;
  const key = a.textFieldValue(0).trim();
  if (!/^github_pat_\w{20,}$/.test(key)) {
    await ask("That's not a key", "A key starts with github_pat_. Copy it again on github.com.", ["OK"], null);
    return;
  }
  const msg = `Hi ${NAMES[other]}! Here's BF Deals for your iPhone. Guide:\n${DOC_URL}\n\n`
    + `Your personal setup code (don't share it):\nBFDEALS:${other}:${key}`;
  await ShareSheet.present([msg]);
}

async function addProduct(S, presetUrl) {
  if (!S.who) await askWho(S);
  if (!S.who) return false;
  const key = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) : await askKey(S);
  if (!key) return false;
  let preset = presetUrl || "";
  if (!preset) {
    try {
      const clip = (Pasteboard.pasteString() || "").trim();
      if (/^https?:\/\/\S+$/.test(clip)) preset = clip;
    } catch (e) { /* no clipboard access */ }
  }
  const a = new Alert();
  a.title = "Add product";
  a.message = "A link from any shop, or the product name. BF Deals then looks for it in every shop, not just that one.";
  a.addTextField("Link or product name", preset);
  a.addTextField("Note, e.g. colour (optional)", "");
  a.addAction("Next");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return false;
  const product = a.textFieldValue(0).replace(/\s+/g, " ").trim();
  const note = a.textFieldValue(1).replace(/\s+/g, " ").trim();
  if (product.length < 3) {
    await ask("Nothing added", "Enter a link or a product name.", ["OK"], null);
    return false;
  }

  // Theme: one of the themes you can see, a new one, or let the round pick.
  const themes = data ? themesFor(data, S, true).map((t) => themeName(t.g)) : [];
  const ti = await ask("Which theme?", "Pick a theme or make a new one, e.g. Kitchen or Bikes.",
    [...themes, "＋ New theme…", "Let BF Deals choose"]);
  if (ti === -1) return false;
  let theme = ti < themes.length ? themes[ti] : "";
  if (ti === themes.length) {
    const n = new Alert();
    n.title = "New theme";
    n.message = "One or two words. This becomes a heading in your widget.";
    n.addTextField("e.g. Kitchen", "");
    n.addAction("Create theme");
    n.addCancelAction("Cancel");
    if ((await n.present()) === -1) return false;
    theme = n.textFieldValue(0).replace(/[^\p{L}\p{N} &-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
  }

  const wi = await ask("Who is it for?", `Only you: ${OTHER[S.who]} won't see it. Shared: you both see it.`,
    ["Only me", `Shared with ${OTHER[S.who]}`]);
  if (wi === -1) return false;
  const owner = wi === 0 ? S.who : "gedeeld";
  const req = new Request(`https://api.github.com/repos/${REPO}/issues`);
  req.method = "POST";
  req.timeoutInterval = 20;
  req.headers = { Authorization: "Bearer " + key, Accept: "application/vnd.github+json",
    "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" };
  // The body keys (wie/product/thema/notitie) are what the GitHub Action reads; keep them.
  req.body = JSON.stringify({
    title: `BF Deals: new product (${NAMES[S.who]})`,
    body: `wie: ${owner}\nproduct: ${product}\nthema: ${theme}\nnotitie: ${note}\n\nRequested in the BF Deals widget by ${NAMES[S.who]}.`,
  });
  let status = 0;
  try {
    await req.loadJSON();
    status = req.response ? req.response.statusCode : 0;
  } catch (e) { status = -1; }
  if (status === 201) {
    S.lastAdd = Date.now();
    saveSettings(S);
    await ask("Added", `${owner === "gedeeld" ? `Shared with ${OTHER[S.who]}` : "Only for you"}${theme ? `, theme ${theme}` : ""}. BF Deals is looking it up in every shop now; it's usually in your widget within an hour.`, ["OK"], null);
    return true;
  }
  if (status === 401 || status === 403 || status === 404) {
    Keychain.remove(KEY_NAME);
    await ask("Setup code no longer works", `The code has expired or was revoked. Ask ${OTHER[S.who]} for a new one and try again.`, ["OK"], null);
  } else {
    await ask("Didn't work", "No connection to GitHub. Please try again later.", ["OK"], null);
  }
  return false;
}

async function askWho(S) {
  const i = await ask("Who are you?", "BF Deals shows the shared products plus your own.", ["Jasper", "Rebecca"], "Later");
  if (i === -1) return;
  S.who = i === 0 ? "jasper" : "rebecca";
  saveSettings(S);
}

async function settings(S) {
  const opts = ["I'm Jasper", "I'm Rebecca", "Paste setup code again"];
  if (S.who === "jasper") opts.push("Invite Rebecca");
  const i = await ask("Settings", Keychain.contains(KEY_NAME) ? "Adding products is set up." : "Adding products needs a setup code.", opts);
  if (i === 0 || i === 1) { S.who = i === 0 ? "jasper" : "rebecca"; saveSettings(S); }
  if (i === 2) await askKey(S);
  if (i === 3) await invite(S);
}

// ---------- overview (opens in Scriptable when you tap the widget) ----------

// A web page in Scriptable's web view. Taps on actions navigate to bfdeals://..., which the script
// intercepts; product rows link to the shop and open in Safari.
const CSS = `
:root{--bg:#000;--card:${HEX.bg};--t:#fff;--m:rgba(235,235,245,.6);--q:rgba(235,235,245,.32);--sep:rgba(84,84,88,.45);--g:${HEX.green};--a:${HEX.amber}}
*{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
html{background:var(--bg)}
body{font:16px -apple-system,system-ui,sans-serif;color:var(--t);background:var(--bg);padding:20px 16px calc(28px + env(safe-area-inset-bottom));-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
a{color:inherit;text-decoration:none;display:block}
.num{font-variant-numeric:tabular-nums;letter-spacing:-.01em}
h1{font-size:34px;font-weight:700;margin:0 4px}
.sub{font-size:15px;color:var(--m);margin:4px 4px 24px}
.sub b{color:var(--g);font-weight:600}
.sub .old{color:var(--a)}
.sec{margin-bottom:26px;scroll-margin-top:12px}
.sh{display:flex;justify-content:space-between;align-items:baseline;margin:0 4px 8px}
.sh h2{font-size:20px;font-weight:700}
.sh h2 small{font-size:13px;font-weight:500;color:var(--q);margin-left:6px}
.sh span{font-size:13px;font-weight:600;color:var(--q)}
.sh span.g{color:var(--g)}
.card{background:var(--card);border-radius:12px;overflow:hidden}
.it{padding:11px 16px;position:relative}
.it+.it:before{content:"";position:absolute;left:16px;right:0;top:0;height:.5px;background:var(--sep)}
a.it:active{background:#2c2c2e}
.l1,.l2{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.nm{font-size:16px;font-weight:500}
.pr{font-size:17px;font-weight:600;white-space:nowrap}
.l2{margin-top:2px;font-size:13px;color:var(--m)}
.l2 .d{font-weight:600;color:var(--q);white-space:nowrap}
.l2 .d.g{color:var(--g)}
.me{color:var(--q)}
.acts .it{display:flex;justify-content:space-between;padding:13px 16px}
.acts .it span{color:var(--q)}
.acts .g{color:var(--g);font-weight:500}
.foot{text-align:center;font-size:12px;color:var(--q);margin-top:14px;line-height:1.45}
.on{color:var(--g);font-weight:600}
.off{color:var(--q)}
.hint{font-size:13px;color:var(--m);margin:0 4px 10px}`;

function updatedText(data) {
  if (!data.updated || data.updated >= todayIso()) return { text: "Prices updated today", old: false };
  const d = new Date(data.updated + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { text: `Prices from ${d}`, old: true };
}

function productRow(it, t) {
  const deal = it.status === "Deal";
  const info = it.best == null ? "no shop found yet"
    : [shopName(it.shop), it.threshold ? `deal below ${eur0(it.threshold)}` : null].filter(Boolean).join(" · ");
  const mine = !t.allMine && ownerOf(it) !== "gedeeld" ? ' <span class="me">· only you</span>' : "";
  const right = it.diff_pct == null ? (it.best == null ? "" : "new") : pct(it.diff_pct);
  const inner = `<div class="l1"><span class="nm">${esc(it.name || it.full_name)}</span><span class="pr num">${eur(it.best)}</span></div>`
    + `<div class="l2"><span>${esc(info)}${mine}</span><span class="d ${deal ? "g" : ""}">${right}</span></div>`;
  return it.url ? `<a class="it" href="${esc(it.url)}">${inner}</a>` : `<div class="it">${inner}</div>`;
}

function overviewHtml(data, S, groupId, mode) {
  const d = daysToBlackFriday();
  const upd = updatedText(data);
  const head = (sub) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${CSS}</style></head><body><h1>${mode === "themes" ? "Themes" : "BF Deals"}</h1><div class="sub">${sub}</div>`;

  if (mode === "themes") {
    const rows = themesFor(data, S, true).map((t) => {
      const on = !S.hidden.includes(t.g.id);
      return `<a class="it" href="bfdeals://toggle/${encodeURIComponent(t.g.id)}"><div class="l1"><span class="nm">${esc(themeName(t.g))}</span><span class="${on ? "on" : "off"}">${on ? "✓" : "○"}</span></div><div class="l2"><span>${plural(t.items.length, "product")}${t.allMine ? ' <span class="me">· only you</span>' : ""}</span></div></a>`;
    }).join("");
    return head("Tap a theme to show or hide it.") + `<div class="card">${rows}</div>`
      + `<div class="card acts" style="margin-top:22px"><a class="it g" href="bfdeals://list">Done</a></div></body></html>`;
  }

  const all = themesFor(data, S, true);
  const shown = all.filter((t) => !S.hidden.includes(t.g.id) || t.g.id === groupId);
  const deals = shown.reduce((n, t) => n + t.deals, 0);
  const subParts = [deals ? `<b>${plural(deals, "deal")}</b>` : "No deals right now"];
  if (d > 0) subParts.push(`Black Friday in ${plural(d, "day")}`);
  else if (d === 0) subParts.push("Black Friday is today");
  const sections = shown.map((t) => `<div class="sec" id="g-${esc(t.g.id)}"><div class="sh"><h2>${esc(themeName(t.g))}${t.allMine ? "<small>only you</small>" : ""}</h2><span class="${t.deals ? "g" : ""}">${t.deals ? plural(t.deals, "deal") : "no deal"}</span></div><div class="card">${t.items.map((it) => productRow(it, t)).join("")}</div></div>`).join("");
  const acts = `<div class="card acts">`
    + `<a class="it g" href="bfdeals://add">Add product</a>`
    + `<a class="it" href="bfdeals://themes">Choose themes <span>${all.length - all.filter((t) => S.hidden.includes(t.g.id)).length} of ${all.length}</span></a>`
    + (data.dashboard ? `<a class="it" href="bfdeals://dashboard">Full dashboard <span>↗</span></a>` : "")
    + `<a class="it" href="bfdeals://settings">${S.who ? `I'm ${NAMES[S.who]}` : "Who are you?"} <span>${S.who ? "switch" : "set up"}</span></a></div>`;
  const foot = `<div class="foot">${upd.text}<br>Delivered to or picked up in Amsterdam, shipping included</div>`;
  const scroll = groupId ? `<script>document.getElementById(${JSON.stringify("g-" + groupId)})?.scrollIntoView()</script>` : "";
  return head(subParts.join(" · ") + (upd.old ? ` · <span class="old">${upd.text.toLowerCase()}</span>` : ""))
    + sections + acts + foot + scroll + "</body></html>";
}

async function overview(data, S, groupId) {
  const wv = new WebView();
  let mode = "list";
  const render = (g) => wv.loadHTML(overviewHtml(data, S, g, mode));
  const handle = async (url) => {
    const [cmd, arg] = url.replace("bfdeals://", "").split("/");
    if (cmd === "add") await addProduct(S); // the new product appears once the routine has run
    else if (cmd === "themes") mode = "themes";
    else if (cmd === "list") mode = "list";
    else if (cmd === "toggle") {
      const id = decodeURIComponent(arg || "");
      S.hidden = S.hidden.includes(id) ? S.hidden.filter((x) => x !== id) : [...S.hidden, id];
      saveSettings(S);
    } else if (cmd === "dashboard") { Safari.open(data.dashboard); return; }
    else if (cmd === "settings") await settings(S);
    await render(null);
  };
  wv.shouldAllowRequest = (req) => {
    const url = req.url || "";
    if (url.startsWith("bfdeals://")) { handle(url); return false; }
    if (/^https?:\/\//.test(url)) { Safari.open(url); return false; }
    return true;
  };
  await render(groupId);
  await wv.present(false);
}

// ---------- run ----------

const S = loadSettings();
const data = await loadData();
const shared = (args.urls && args.urls.length ? args.urls : (args.plainTexts || []).filter((t) => /^https?:\/\//.test(t)));
if (config.runsInWidget) {
  Script.setWidget(buildWidget(data, config.widgetFamily || "small", args.widgetParameter, S));
} else if (config.runsInActionExtension || (shared && shared.length)) {
  // Safari: Share › Run Script › BF Deals (needs "Share Sheet Inputs: URLs" in the script settings).
  await addProduct(S, shared && shared[0]);
} else if (data) {
  const q = args.queryParameters || {};
  if (!S.who || !Keychain.contains(KEY_NAME)) await trySetupFromClipboard(S);
  if (!S.who) await askWho(S);
  if (q.action === "add") await addProduct(S);
  await overview(data, S, q.group);
} else {
  await ask("BF Deals", "No data: check your internet connection.", ["OK"], null);
}
Script.complete();
