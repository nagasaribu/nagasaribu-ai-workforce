export const consoleHtml = String.raw`<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pusat Kawalan Operasi — NAGASARIBU AI WORKFORCE</title>
<style>
  :root {
    --bg: #f4f6fb;
    --surface: #ffffff;
    --surface-2: #f8fafc;
    --ink: #172033;
    --muted: #64748b;
    --line: #e2e8f0;
    --navy: #0f172a;
    --navy-2: #16233d;
    --accent: #2563eb;
    --accent-soft: #dbeafe;
    --green: #047857;
    --green-soft: #d1fae5;
    --amber: #b45309;
    --amber-soft: #fef3c7;
    --red: #b91c1c;
    --red-soft: #fee2e2;
    --radius: 14px;
    --shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--bg);
    color: var(--ink);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .hidden { display: none !important; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  h1, h2, h3, p { margin-top: 0; }
  h1 { font-size: 26px; line-height: 1.2; margin-bottom: 4px; }
  h2 { font-size: 18px; }
  h3 { font-size: 15px; }
  a { color: var(--accent); }

  /* ---------- Auth ---------- */
  .auth {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
      radial-gradient(circle at 15% 15%, rgba(37, 99, 235, 0.18), transparent 45%),
      radial-gradient(circle at 85% 85%, rgba(14, 165, 233, 0.15), transparent 40%),
      #0b1220;
  }
  .auth-card {
    width: 100%;
    max-width: 420px;
    background: var(--surface);
    border-radius: 20px;
    padding: 36px 32px 28px;
    box-shadow: 0 30px 70px rgba(2, 6, 23, 0.5);
  }
  .auth-brand {
    font-weight: 800;
    letter-spacing: 0.06em;
    font-size: 13px;
    color: var(--navy);
  }
  .auth-brand span { color: var(--accent); }
  .auth-sub { color: var(--muted); font-size: 13px; margin: 4px 0 26px; }
  .auth-card h1 { font-size: 24px; }
  .auth-card form { display: grid; gap: 14px; margin-top: 20px; }
  .error { color: var(--red); font-size: 13px; margin: 0; min-height: 18px; }

  /* ---------- Layout ---------- */
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: 248px;
    background: linear-gradient(180deg, var(--navy) 0%, #0b1220 100%);
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    padding: 22px 16px;
    z-index: 20;
  }
  .brand { display: flex; align-items: center; gap: 12px; padding: 4px 8px 22px; }
  .brand .mark {
    width: 38px; height: 38px; border-radius: 11px;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.02em;
  }
  .brand strong { display: block; color: #f8fafc; font-size: 13px; letter-spacing: 0.08em; }
  .brand span { display: block; font-size: 11px; color: #94a3b8; letter-spacing: 0.04em; }
  #nav { display: grid; gap: 4px; }
  .nav-item {
    appearance: none; border: 0; background: transparent; color: #cbd5e1;
    text-align: left; padding: 11px 12px; border-radius: 10px;
    font: inherit; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 10px;
  }
  .nav-item:hover { background: rgba(148, 163, 184, 0.14); color: #fff; }
  .nav-item.active { background: rgba(37, 99, 235, 0.28); color: #fff; font-weight: 600; }
  .nav-item .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.6; }
  .sidebar-foot { margin-top: auto; padding-top: 18px; border-top: 1px solid rgba(148, 163, 184, 0.18); }
  .user-chip { padding: 8px 10px 12px; }
  .user-chip strong { display: block; color: #f8fafc; font-size: 13px; }
  .user-chip span { display: block; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }

  .shell { margin-left: 248px; min-height: 100vh; }
  .topbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 18px 32px;
    background: rgba(244, 246, 251, 0.88);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); font-weight: 700; }
  .topbar h1 { font-size: 21px; margin: 2px 0 0; }
  .env-pill {
    background: var(--green-soft); color: var(--green); font-weight: 700;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    padding: 6px 12px; border-radius: 999px;
  }
  main { padding: 26px 32px 60px; max-width: 1240px; }

  /* ---------- Components ---------- */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 22px; }
  .stat {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 18px; box-shadow: var(--shadow);
  }
  .stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); font-weight: 700; }
  .stat .value { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; margin: 6px 0 2px; }
  .stat .hint { font-size: 12px; color: var(--muted); }

  .panel {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    box-shadow: var(--shadow); margin-bottom: 18px; overflow: hidden;
  }
  .panel-head { padding: 16px 20px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .panel-head h2 { margin: 0; font-size: 16px; }
  .panel-body { padding: 18px 20px; }
  .grid-2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; }
  .page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
  .page-head p { margin: 0; color: var(--muted); font-size: 13px; max-width: 620px; }

  .btn {
    appearance: none; border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    font: inherit; font-size: 13px; font-weight: 600; padding: 9px 14px; border-radius: 9px;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  }
  .btn:hover { background: var(--surface-2); }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-danger { background: var(--red-soft); border-color: #fecaca; color: var(--red); }
  .btn-success { background: var(--green-soft); border-color: #a7f3d0; color: var(--green); }
  .btn-ghost { background: transparent; border-color: rgba(148, 163, 184, 0.3); color: #cbd5e1; }
  .btn-ghost:hover { background: rgba(148, 163, 184, 0.16); }
  .btn-sm { padding: 6px 10px; font-size: 12px; border-radius: 7px; }
  .btn-block { width: 100%; }

  .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
  .toolbar input, .toolbar select { min-width: 150px; }

  label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; color: #334155; }
  input, select, textarea {
    width: 100%; font: inherit; font-size: 14px; color: var(--ink);
    background: var(--surface); border: 1px solid #cbd5e1; border-radius: 9px;
    padding: 9px 11px; outline: none;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
  textarea { min-height: 84px; resize: vertical; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  .form-grid .wide { grid-column: 1 / -1; }
  .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
  .check { display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 500; }
  .check input { width: auto; }

  details.panel > summary {
    cursor: pointer; padding: 16px 20px; font-weight: 700; font-size: 14px;
    list-style: none; display: flex; align-items: center; justify-content: space-between;
  }
  details.panel > summary::-webkit-details-marker { display: none; }
  details.panel > summary::after { content: "+"; font-size: 20px; color: var(--muted); line-height: 1; }
  details.panel[open] > summary::after { content: "−"; }
  details.panel .panel-body { border-top: 1px solid var(--line); }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); background: var(--surface-2); }
  tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: #fbfcff; }
  td .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }

  .badge {
    display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap;
    background: #eef2ff; color: #3730a3;
  }
  .badge.green { background: var(--green-soft); color: var(--green); }
  .badge.amber { background: var(--amber-soft); color: var(--amber); }
  .badge.red { background: var(--red-soft); color: var(--red); }
  .badge.slate { background: #e2e8f0; color: #475569; }
  .badge.blue { background: var(--accent-soft); color: #1d4ed8; }

  .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .card {
    border: 1px solid var(--line); border-radius: 12px; padding: 16px; background: var(--surface);
  }
  .card h3 { margin: 0 0 4px; }
  .card .meta { color: var(--muted); font-size: 12px; }
  .card .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip { background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px; padding: 2px 7px; font-size: 11px; color: #475569; }
  .card-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }

  .empty { text-align: center; color: var(--muted); padding: 30px 16px; font-size: 13px; }
  .toast {
    position: fixed; right: 22px; bottom: 22px; z-index: 100;
    background: var(--navy); color: #f8fafc; padding: 12px 18px; border-radius: 10px;
    font-size: 13px; box-shadow: 0 18px 40px rgba(2, 6, 23, 0.35);
    opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity 160ms ease, transform 160ms ease;
    max-width: min(380px, calc(100vw - 44px));
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.error { background: #7f1d1d; }

  dialog {
    border: 0; border-radius: 16px; padding: 0; width: min(560px, calc(100vw - 32px));
    box-shadow: 0 30px 80px rgba(2, 6, 23, 0.4);
  }
  dialog::backdrop { background: rgba(15, 23, 42, 0.55); }
  dialog form { padding: 22px; }
  dialog h2 { margin: 0 0 4px; font-size: 18px; }
  dialog .dialog-sub { color: var(--muted); font-size: 12px; margin-bottom: 16px; }

  .login-note {
    background: var(--amber-soft); color: #92400e; border: 1px solid #fde68a;
    border-radius: 9px; padding: 10px 12px; font-size: 12px; margin-top: 16px;
  }

  @media (max-width: 900px) {
    .sidebar { position: static; width: auto; flex-direction: row; align-items: center; padding: 12px 16px; gap: 14px; overflow-x: auto; }
    .brand { padding: 0; flex: 0 0 auto; }
    .brand div { display: none; }
    #nav { display: flex; gap: 4px; overflow-x: auto; }
    .nav-item { white-space: nowrap; padding: 9px 11px; }
    .nav-item .dot { display: none; }
    .sidebar-foot { margin: 0 0 0 auto; padding: 0; border: 0; display: flex; align-items: center; gap: 8px; }
    .user-chip { display: none; }
    .shell { margin-left: 0; }
    .topbar { padding: 14px 18px; }
    main { padding: 20px 18px 50px; }
    .grid-2 { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .auth-card { padding: 28px 22px; }
    .stats { grid-template-columns: 1fr 1fr; }
    .stat .value { font-size: 24px; }
    .topbar h1 { font-size: 18px; }
    .hide-sm { display: none; }
  }
</style>
</head>
<body>

<div id="auth-view" class="auth hidden">
  <div class="auth-card">
    <div class="auth-brand">NAGASARIBU <span>AI WORKFORCE</span></div>
    <p class="auth-sub">Pusat Kawalan Operasi</p>
    <h1 id="auth-title">Log Masuk</h1>
    <p id="auth-note" class="muted small"></p>
    <form id="auth-form" autocomplete="on">
      <label id="name-field" class="hidden">Nama penuh
        <input name="name" type="text" maxlength="120" autocomplete="name" placeholder="Nama penuh anda">
      </label>
      <label>E-mel
        <input name="email" type="email" maxlength="254" required autocomplete="username" placeholder="nama@syarikat.com">
      </label>
      <label>Kata laluan
        <input name="password" type="password" minlength="12" maxlength="200" required autocomplete="current-password" placeholder="Sekurang-kurangnya 12 aksara">
      </label>
      <p id="auth-error" class="error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit" id="auth-submit">Log Masuk</button>
    </form>
    <p class="muted small" style="margin:18px 0 0">Akses terhad. Semua aktiviti pentadbir direkodkan dalam log audit.</p>
    <div id="auth-warning" class="login-note hidden"></div>
  </div>
</div>

<div id="app-view" class="hidden">
  <aside class="sidebar">
    <div class="brand">
      <div class="mark">NA</div>
      <div><strong>NAGASARIBU</strong><span>AI Workforce</span></div>
    </div>
    <nav id="nav" aria-label="Navigasi utama"></nav>
    <div class="sidebar-foot">
      <div class="user-chip"><strong id="user-name"></strong><span id="user-role"></span></div>
      <button class="btn btn-ghost" type="button" data-action="logout">Log Keluar</button>
    </div>
  </aside>
  <div class="shell">
    <header class="topbar">
      <div>
        <span class="eyebrow">Pusat Kawalan Operasi</span>
        <h1 id="page-title">Ringkasan</h1>
      </div>
      <span class="env-pill">Production</span>
    </header>
    <main id="view" aria-live="polite"></main>
  </div>
</div>

<div id="toast" class="toast" role="status"></div>

<dialog id="task-dialog">
  <form id="task-edit-form">
    <h2>Kemas Kini Tugas</h2>
    <p class="dialog-sub">Kemas kini status, keutamaan atau penugasan.</p>
    <input type="hidden" name="id">
    <div class="form-grid">
      <label class="wide">Tajuk<input name="title" type="text" maxlength="200" required></label>
      <label class="wide">Keterangan<textarea name="description" maxlength="5000"></textarea></label>
      <label>Status<select name="status"></select></label>
      <label>Keutamaan<select name="priority"></select></label>
      <label class="wide">Ejen<select name="assignedAgentId"></select></label>
    </div>
    <div class="form-actions">
      <button class="btn" type="button" data-close="task-dialog">Batal</button>
      <button class="btn btn-primary" type="submit">Simpan</button>
    </div>
  </form>
</dialog>

<dialog id="lead-dialog">
  <form id="lead-edit-form">
    <h2>Kemas Kini Prospek</h2>
    <p class="dialog-sub">Hanya gunakan data yang dipersetujui untuk dihubungi.</p>
    <input type="hidden" name="id">
    <div class="form-grid">
      <label>Syarikat<input name="companyName" type="text" maxlength="200" required></label>
      <label>Nama hubungan<input name="contactName" type="text" maxlength="120"></label>
      <label>E-mel<input name="email" type="email" maxlength="254"></label>
      <label>Telefon<input name="phone" type="text" maxlength="40"></label>
      <label>Sumber<select name="sourceId"></select></label>
      <label>Status<select name="status"></select></label>
      <label>Persetujuan<select name="consentStatus"></select></label>
      <label class="check wide"><input name="doNotContact" type="checkbox"> Jangan hubungi</label>
      <label class="wide">Nota<textarea name="notes" maxlength="5000"></textarea></label>
    </div>
    <div class="form-actions">
      <button class="btn" type="button" data-close="lead-dialog">Batal</button>
      <button class="btn btn-primary" type="submit">Simpan</button>
    </div>
  </form>
</dialog>

<dialog id="decision-dialog">
  <form id="decision-form">
    <h2 id="decision-title">Keputusan Kelulusan</h2>
    <p class="dialog-sub" id="decision-sub"></p>
    <input type="hidden" name="id">
    <input type="hidden" name="decision">
    <label>Catatan keputusan<textarea name="note" maxlength="2000" placeholder="Sebab atau nota tambahan (pilihan)"></textarea></label>
    <div class="form-actions">
      <button class="btn" type="button" data-close="decision-dialog">Batal</button>
      <button class="btn btn-primary" type="submit" id="decision-submit">Hantar</button>
    </div>
  </form>
</dialog>

<script>
(function () {
  "use strict";

  var state = {
    user: null,
    tab: "dashboard",
    authMode: "login",
    tasks: [],
    agents: [],
    leads: [],
    sources: [],
    approvals: [],
    users: []
  };

  var ROLE_LABELS = { admin: "Pentadbir", manager: "Pengurus", agent: "Ejen", viewer: "Pemerhati" };
  var TASK_STATUS = {
    pending: "Menunggu", assigned: "Ditugaskan", in_progress: "Sedang Berjalan",
    blocked: "Terhalang", completed: "Selesai", cancelled: "Dibatalkan"
  };
  var PRIORITY = { low: "Rendah", normal: "Biasa", high: "Tinggi", urgent: "Mendesak" };
  var LEAD_STATUS = {
    new: "Baru", contacted: "Dihubungi", qualified: "Layak",
    proposal: "Cadangan", won: "Berjaya", lost: "Gagal"
  };
  var APPROVAL_STATUS = { pending: "Menunggu", approved: "Diluluskan", rejected: "Ditolak", cancelled: "Dibatalkan" };
  var CONSENT = { unknown: "Belum Diketahui", granted: "Diberikan", declined: "Ditolak" };
  var ENTITY = { task: "Tugas", lead: "Prospek", agent: "Ejen", campaign: "Kempen", other: "Lain-lain" };
  var AGENT_STATUS = { active: "Aktif", paused: "Dijeda", retired: "Bersara" };
  var USER_STATUS = { active: "Aktif", disabled: "Dilumpuhkan" };

  var navMeta = {
    dashboard: "Ringkasan",
    tasks: "Tugas",
    agents: "Ejen",
    leads: "Prospek",
    approvals: "Kelulusan",
    users: "Pengguna",
    audit: "Log Audit"
  };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/[&<>"']/g, function (char) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
      });
  }

  function label(map, value) { return map[value] || value || "—"; }

  function fmtDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function badge(value, map) {
    var tone = "slate";
    if (value === "completed" || value === "won" || value === "approved" || value === "active") tone = "green";
    else if (value === "in_progress" || value === "qualified" || value === "assigned") tone = "blue";
    else if (value === "blocked" || value === "pending" || value === "new" || value === "contacted") tone = "amber";
    else if (value === "cancelled" || value === "lost" || value === "rejected" || value === "disabled") tone = "red";
    return '<span class="badge ' + tone + '">' + esc(label(map, value)) + "</span>";
  }

  function toast(message, isError) {
    var node = $("toast");
    node.textContent = message;
    node.className = "toast show" + (isError ? " error" : "");
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(function () { node.className = "toast"; }, 4200);
  }

  function api(path, options) {
    options = options || {};
    var init = { method: options.method || "GET", credentials: "same-origin", headers: {} };
    if (options.body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    return fetch(path, init).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (ignore) { data = null; }
        if (!response.ok) {
          var message = data && data.error && data.error.message ? data.error.message : "Ralat rangkaian.";
          if (response.status === 401 && path.indexOf("/api/auth/") !== 0) {
            showAuth({ configured: true, needsSetup: false });
          }
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function optionList(map, selected) {
    return Object.keys(map).map(function (key) {
      return '<option value="' + esc(key) + '"' + (key === selected ? " selected" : "") + ">" + esc(map[key]) + "</option>";
    }).join("");
  }

  function showAuth(me) {
    $("app-view").classList.add("hidden");
    $("auth-view").classList.remove("hidden");
    var setup = Boolean(me && me.needsSetup);
    state.authMode = setup ? "setup" : "login";
    $("auth-title").textContent = setup ? "Penyediaan Awal" : "Log Masuk";
    $("auth-note").textContent = setup
      ? "Cipta akaun pentadbir pertama untuk memulakan Pusat Kawalan Operasi."
      : "Masukkan kelayakan akaun anda untuk meneruskan.";
    $("name-field").classList.toggle("hidden", !setup);
    var nameInput = document.querySelector('#auth-form [name="name"]');
    if (nameInput) nameInput.required = setup;
    $("auth-submit").textContent = setup ? "Cipta Akaun Pentadbir" : "Log Masuk";
    var password = document.querySelector('#auth-form [name="password"]');
    if (password) password.autocomplete = setup ? "new-password" : "current-password";
    $("auth-error").textContent = "";

    var warning = $("auth-warning");
    if (me && me.configured === false) {
      warning.classList.remove("hidden");
      warning.textContent = "Pengesahan belum dikonfigurasikan. Pentadbir sistem perlu menetapkan rahsia SESSION_SECRET pada Worker sebelum log masuk dibenarkan.";
      $("auth-submit").disabled = true;
    } else {
      warning.classList.add("hidden");
      $("auth-submit").disabled = false;
    }
  }

  function buildNav() {
    var items = [["dashboard", "Ringkasan"], ["tasks", "Tugas"], ["agents", "Ejen"]];
    if (state.user.role === "manager" || state.user.role === "admin" || state.user.role === "agent") {
      items.push(["leads", "Prospek"]);
      items.push(["approvals", "Kelulusan"]);
    }
    if (state.user.role === "admin") items.push(["users", "Pengguna"]);
    if (state.user.role === "admin" || state.user.role === "manager") items.push(["audit", "Log Audit"]);

    $("nav").innerHTML = items.map(function (item) {
      return '<button class="nav-item' + (item[0] === state.tab ? " active" : "") + '" type="button" data-action="nav" data-tab="' + item[0] + '"><span class="dot"></span>' + item[1] + "</button>";
    }).join("");
  }

  function enterApp() {
    $("auth-view").classList.add("hidden");
    $("app-view").classList.remove("hidden");
    $("user-name").textContent = state.user.name;
    $("user-role").textContent = label(ROLE_LABELS, state.user.role);
    buildNav();
    switchTab("dashboard");
  }

  function switchTab(tab) {
    if (!navMeta[tab]) tab = "dashboard";
    state.tab = tab;
    $("page-title").textContent = navMeta[tab];
    buildNav();
    $("view").innerHTML = '<div class="panel"><div class="empty">Memuatkan data…</div></div>';
    var loader = loaders[tab];
    if (!loader) return;
    loader().catch(function (error) {
      $("view").innerHTML = '<div class="panel"><div class="empty">' + esc(error.message) + "</div></div>";
      toast(error.message, true);
    });
  }

  function statCard(title, value, hint) {
    return '<div class="stat"><div class="label">' + esc(title) + '</div><div class="value">' + esc(value) + '</div><div class="hint">' + esc(hint) + "</div></div>";
  }

  function emptyRow(cols, message) {
    return '<tr><td colspan="' + cols + '"><div class="empty">' + esc(message) + "</div></td></tr>";
  }

  var loaders = {};

  loaders.dashboard = function () {
    return api("/api/dashboard").then(function (data) {
      var recent = data.recentTasks.length
        ? data.recentTasks.map(function (task) {
            return "<tr><td><strong>" + esc(task.title) + '</strong><div class="sub">' + esc(task.assigned_agent_name || task.assigned_user_name || "Belum ditugaskan") + "</div></td><td>" + badge(task.status, TASK_STATUS) + "</td><td>" + esc(fmtDate(task.created_at)) + "</td></tr>";
          }).join("")
        : emptyRow(3, "Belum ada tugasan.");

      var approvals = data.pendingApprovals.length
        ? data.pendingApprovals.map(function (item) {
            return "<tr><td><strong>" + esc(item.title) + '</strong><div class="sub">' + esc(label(ENTITY, item.entity_type)) + "</div></td><td>" + esc(item.requested_by_name || "—") + "</td><td>" + esc(fmtDate(item.created_at)) + "</td></tr>";
          }).join("")
        : emptyRow(3, "Tiada kelulusan menunggu.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Gambaran operasi</h2><p>Pantau tugas, ejen, prospek dan kelulusan dalam satu tempat.</p></div></div>' +
        '<div class="stats">' +
          statCard("Tugas Aktif", data.tasks.active, data.tasks.total + " jumlah tugasan") +
          statCard("Ejen Aktif", data.agents.active, data.agents.total + " ejen berdaftar") +
          statCard("Prospek Baru", data.leads.new, data.leads.total + " jumlah prospek") +
          statCard("Kelulusan Menunggu", data.approvals.pending, data.approvals.total + " jumlah permohonan") +
        "</div>" +
        '<div class="grid-2">' +
          '<div class="panel"><div class="panel-head"><h2>Tugasan Terkini</h2><button class="btn btn-sm" type="button" data-action="nav" data-tab="tasks">Lihat semua</button></div><div class="table-wrap"><table><thead><tr><th>Tugas</th><th>Status</th><th>Dicipta</th></tr></thead><tbody>' + recent + "</tbody></table></div></div>" +
          '<div class="panel"><div class="panel-head"><h2>Kelulusan Menunggu</h2><button class="btn btn-sm" type="button" data-action="nav" data-tab="approvals">Lihat semua</button></div><div class="table-wrap"><table><thead><tr><th>Permohonan</th><th>Pemohon</th><th>Tarikh</th></tr></thead><tbody>' + approvals + "</tbody></table></div></div>" +
        "</div>";
    });
  };

  loaders.tasks = function () {
    return Promise.all([api("/api/tasks?limit=100"), api("/api/agents")]).then(function (results) {
      state.tasks = results[0].tasks;
      state.agents = results[1].agents;

      var agentOptions = '<option value="">Belum ditugaskan</option>' + state.agents.map(function (agent) {
        return '<option value="' + esc(agent.id) + '">' + esc(agent.name) + "</option>";
      }).join("");

      var rows = state.tasks.length
        ? state.tasks.map(function (task) {
            return "<tr><td><strong>" + esc(task.title) + '</strong><div class="sub">' + esc(task.description || "Tiada keterangan") + "</div></td><td>" + badge(task.status, TASK_STATUS) + "</td><td>" + badge(task.priority, PRIORITY) + "</td><td>" + esc(task.assigned_agent_name || task.assigned_user_name || "—") + '</td><td class="hide-sm">' + esc(fmtDate(task.created_at)) + '</td><td><button class="btn btn-sm" type="button" data-action="task-edit" data-id="' + esc(task.id) + '">Kemas Kini</button></td></tr>';
          }).join("")
        : emptyRow(6, "Belum ada tugasan. Cipta tugasan pertama anda.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Pengurusan tugas</h2><p>Cipta, tugaskan dan jejak status kerja pasukan.</p></div></div>' +
        '<details class="panel"><summary>Cipta tugasan baharu</summary><div class="panel-body"><form id="task-form"><div class="form-grid">' +
          '<label class="wide">Tajuk<input name="title" type="text" maxlength="200" required placeholder="Contoh: Sediakan laporan mingguan"></label>' +
          '<label class="wide">Keterangan<textarea name="description" maxlength="5000" placeholder="Skop dan hasil dijangka"></textarea></label>' +
          '<label>Keutamaan<select name="priority">' + optionList(PRIORITY, "normal") + "</select></label>" +
          '<label>Ejen<select name="assignedAgentId">' + agentOptions + "</select></label>" +
          '<label>Tarikh akhir<input name="dueAt" type="date"></label>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">Cipta Tugasan</button></div></form></div></details>' +
        '<div class="panel"><div class="panel-head"><h2>Senarai Tugas</h2><span class="muted small">' + state.tasks.length + " tugasan</span></div><div class=\"table-wrap\"><table><thead><tr><th>Tugas</th><th>Status</th><th>Keutamaan</th><th>Ditugaskan</th><th class=\"hide-sm\">Dicipta</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div></div>";
    });
  };

  loaders.agents = function () {
    return api("/api/agents").then(function (data) {
      state.agents = data.agents;
      var cards = state.agents.length
        ? state.agents.map(function (agent) {
            var capabilities = [];
            try { capabilities = JSON.parse(agent.capabilities || "[]"); } catch (ignore) { capabilities = []; }
            var chips = capabilities.length
              ? capabilities.map(function (item) { return '<span class="chip">' + esc(item) + "</span>"; }).join("")
              : '<span class="chip">Tiada keupayaan dinyatakan</span>';
            var next = agent.status === "active" ? "paused" : "active";
            return '<div class="card"><h3>' + esc(agent.name) + "</h3><div class=\"meta\">" + esc(agent.kind || "general") + " · " + badge(agent.status, AGENT_STATUS) + "</div><p class=\"small\" style=\"margin:10px 0 0\">" + esc(agent.description || "Tiada keterangan.") + '</p><div class="chips">' + chips + '</div><div class="card-actions"><button class="btn btn-sm" type="button" data-action="agent-status" data-id="' + esc(agent.id) + '" data-status="' + esc(next) + '">' + (next === "paused" ? "Jeda Ejen" : "Aktifkan Ejen") + "</button></div></div>";
          }).join("")
        : '<div class="empty">Belum ada ejen berdaftar.</div>';

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Daftar ejen</h2><p>Daftarkan ejen AI dan urus status operasi mereka.</p></div></div>' +
        '<details class="panel"><summary>Daftar ejen baharu</summary><div class="panel-body"><form id="agent-form"><div class="form-grid">' +
          '<label>Nama<input name="name" type="text" maxlength="120" required placeholder="Contoh: Ejen Penyelidikan"></label>' +
          '<label>Jenis<input name="kind" type="text" maxlength="60" placeholder="research / operations"></label>' +
          '<label class="wide">Keterangan<textarea name="description" maxlength="2000" placeholder="Peranan dan skop ejen"></textarea></label>' +
          '<label class="wide">Keupayaan (pisahkan dengan koma)<input name="capabilities" type="text" placeholder="penyelidikan, penulisan, analisis"></label>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">Daftar Ejen</button></div></form></div></details>' +
        '<div class="card-grid">' + cards + "</div>";
    });
  };

  loaders.leads = function () {
    return Promise.all([api("/api/leads"), api("/api/lead-sources")]).then(function (results) {
      state.leads = results[0].leads;
      state.sources = results[1].sources;

      var sourceOptions = state.sources.map(function (source) {
        return '<option value="' + esc(source.id) + '">' + esc(source.name) + "</option>";
      }).join("");

      var rows = state.leads.length
        ? state.leads.map(function (lead) {
            return "<tr><td><strong>" + esc(lead.company_name) + '</strong><div class="sub">' + esc(lead.contact_name || "Tiada nama hubungan") + "</div></td><td>" + badge(lead.status, LEAD_STATUS) + "</td><td>" + esc(lead.source_name || "—") + '</td><td class="hide-sm">' + esc(lead.owner_name || "—") + '</td><td class="hide-sm">' + (lead.do_not_contact ? '<span class="badge red">Jangan hubungi</span>' : esc(label(CONSENT, lead.consent_status))) + '</td><td><button class="btn btn-sm" type="button" data-action="lead-edit" data-id="' + esc(lead.id) + '">Kemas Kini</button></td></tr>';
          }).join("")
        : emptyRow(6, "Belum ada prospek. Tambah prospek yang telah memberi persetujuan.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Prospek pelanggan</h2><p>Rekod prospek secara manual. Tiada mesej pemasaran dihantar oleh sistem ini.</p></div></div>' +
        '<details class="panel"><summary>Tambah prospek</summary><div class="panel-body"><form id="lead-form"><div class="form-grid">' +
          '<label>Syarikat<input name="companyName" type="text" maxlength="200" required></label>' +
          '<label>Nama hubungan<input name="contactName" type="text" maxlength="120"></label>' +
          '<label>E-mel<input name="email" type="email" maxlength="254"></label>' +
          '<label>Telefon<input name="phone" type="text" maxlength="40"></label>' +
          '<label>Sumber<select name="sourceId">' + sourceOptions + "</select></label>" +
          '<label>Status<select name="status">' + optionList(LEAD_STATUS, "new") + "</select></label>" +
          '<label>Persetujuan<select name="consentStatus">' + optionList(CONSENT, "unknown") + "</select></label>" +
          '<label class="check"><input name="doNotContact" type="checkbox"> Jangan hubungi</label>' +
          '<label class="wide">Nota<textarea name="notes" maxlength="5000" placeholder="Konteks perbualan atau keperluan prospek"></textarea></label>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">Tambah Prospek</button></div></form></div></details>' +
        '<div class="panel"><div class="panel-head"><h2>Senarai Prospek</h2><span class="muted small">' + state.leads.length + " prospek</span></div><div class=\"table-wrap\"><table><thead><tr><th>Syarikat</th><th>Status</th><th>Sumber</th><th class=\"hide-sm\">Pemilik</th><th class=\"hide-sm\">Persetujuan</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div></div>";
    });
  };

  loaders.approvals = function () {
    return api("/api/approvals").then(function (data) {
      state.approvals = data.approvals;
      var canDecide = state.user.role === "admin" || state.user.role === "manager";

      var cards = state.approvals.length
        ? state.approvals.map(function (item) {
            var actions = "";
            if (canDecide && item.status === "pending") {
              actions = '<div class="card-actions"><button class="btn btn-sm btn-success" type="button" data-action="decide" data-id="' + esc(item.id) + '" data-decision="approved">Luluskan</button><button class="btn btn-sm btn-danger" type="button" data-action="decide" data-id="' + esc(item.id) + '" data-decision="rejected">Tolak</button></div>';
            }
            return '<div class="card"><h3>' + esc(item.title) + '</h3><div class="meta">' + esc(label(ENTITY, item.entity_type)) + " · " + badge(item.status, APPROVAL_STATUS) + '</div><p class="small" style="margin:10px 0 0">' + esc(item.description || "Tiada keterangan.") + '</p><div class="meta" style="margin-top:10px">Dipohon oleh ' + esc(item.requested_by_name || "—") + " · " + esc(fmtDate(item.created_at)) + "</div>" + (item.decision_note ? '<div class="meta" style="margin-top:8px">Catatan: ' + esc(item.decision_note) + "</div>" : "") + actions + "</div>";
          }).join("")
        : '<div class="empty">Tiada permohonan kelulusan.</div>';

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Aliran kelulusan</h2><p>Mohon dan keputuskan kelulusan untuk tugasan, prospek atau kempen.</p></div></div>' +
        '<details class="panel"><summary>Mohon kelulusan baharu</summary><div class="panel-body"><form id="approval-form"><div class="form-grid">' +
          '<label>Jenis<select name="entityType">' + optionList(ENTITY, "task") + "</select></label>" +
          '<label>ID rujukan<input name="entityId" type="text" maxlength="64" placeholder="Pilihan"></label>' +
          '<label class="wide">Tajuk<input name="title" type="text" maxlength="200" required placeholder="Contoh: Kelulusan kempen suku tahun"></label>' +
          '<label class="wide">Keterangan<textarea name="description" maxlength="5000" placeholder="Konteks dan sebab permohonan"></textarea></label>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">Hantar Permohonan</button></div></form></div></details>' +
        '<div class="card-grid">' + cards + "</div>";
    });
  };

  loaders.users = function () {
    return api("/api/users").then(function (data) {
      state.users = data.users;
      var rows = state.users.length
        ? state.users.map(function (user) {
            var next = user.status === "active" ? "disabled" : "active";
            var isSelf = user.id === state.user.id;
            return "<tr><td><strong>" + esc(user.name) + '</strong><div class="sub">' + esc(user.email) + "</div></td><td>" + esc(label(ROLE_LABELS, user.role)) + "</td><td>" + badge(user.status, USER_STATUS) + '</td><td class="hide-sm">' + esc(fmtDate(user.last_login_at)) + '</td><td><button class="btn btn-sm" type="button" data-action="user-status" data-id="' + esc(user.id) + '" data-status="' + esc(next) + '"' + (isSelf ? " disabled" : "") + ">" + (next === "disabled" ? "Lumpuhkan" : "Dayakan") + "</button></td></tr>";
          }).join("")
        : emptyRow(5, "Tiada pengguna.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Pengguna dan peranan</h2><p>Urus akses pasukan. Kata laluan disimpan sebagai hash PBKDF2.</p></div></div>' +
        '<details class="panel"><summary>Tambah pengguna</summary><div class="panel-body"><form id="user-form"><div class="form-grid">' +
          '<label>Nama<input name="name" type="text" maxlength="120" required></label>' +
          '<label>E-mel<input name="email" type="email" maxlength="254" required></label>' +
          '<label>Kata laluan<input name="password" type="password" minlength="12" maxlength="200" required placeholder="Sekurang-kurangnya 12 aksara"></label>' +
          '<label>Peranan<select name="role">' + optionList(ROLE_LABELS, "viewer") + "</select></label>" +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">Tambah Pengguna</button></div></form></div></details>' +
        '<div class="panel"><div class="panel-head"><h2>Senarai Pengguna</h2></div><div class="table-wrap"><table><thead><tr><th>Pengguna</th><th>Peranan</th><th>Status</th><th class="hide-sm">Log Masuk Terakhir</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
    });
  };

  loaders.audit = function () {
    return api("/api/audit-logs?limit=150").then(function (data) {
      var rows = data.logs.length
        ? data.logs.map(function (log) {
            return "<tr><td><strong>" + esc(log.action) + '</strong><div class="sub">' + esc(log.entity_type || "—") + " " + esc(log.entity_id || "") + "</div></td><td>" + esc(log.actor_name || "Sistem") + "</td><td>" + esc(fmtDate(log.created_at)) + "</td></tr>";
          }).join("")
        : emptyRow(3, "Belum ada log audit.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Log audit</h2><p>Jejak tindakan pentadbir dan operasi terkini.</p></div></div>' +
        '<div class="panel"><div class="table-wrap"><table><thead><tr><th>Tindakan</th><th>Aktor</th><th>Masa</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
    });
  };

  function openTaskDialog(id) {
    var task = state.tasks.filter(function (item) { return item.id === id; })[0];
    if (!task) return;
    var form = $("task-edit-form");
    form.elements.id.value = task.id;
    form.elements.title.value = task.title;
    form.elements.description.value = task.description || "";
    form.elements.status.innerHTML = optionList(TASK_STATUS, task.status);
    form.elements.priority.innerHTML = optionList(PRIORITY, task.priority);
    form.elements.assignedAgentId.innerHTML = '<option value="">Belum ditugaskan</option>' + state.agents.map(function (agent) {
      return '<option value="' + esc(agent.id) + '"' + (agent.id === task.assigned_agent_id ? " selected" : "") + ">" + esc(agent.name) + "</option>";
    }).join("");
    $("task-dialog").showModal();
  }

  function openLeadDialog(id) {
    var lead = state.leads.filter(function (item) { return item.id === id; })[0];
    if (!lead) return;
    var form = $("lead-edit-form");
    form.elements.id.value = lead.id;
    form.elements.companyName.value = lead.company_name;
    form.elements.contactName.value = lead.contact_name || "";
    form.elements.email.value = lead.email || "";
    form.elements.phone.value = lead.phone || "";
    form.elements.sourceId.innerHTML = '<option value="">Tiada sumber</option>' + state.sources.map(function (source) {
      return '<option value="' + esc(source.id) + '"' + (source.id === lead.source_id ? " selected" : "") + ">" + esc(source.name) + "</option>";
    }).join("");
    form.elements.status.innerHTML = optionList(LEAD_STATUS, lead.status);
    form.elements.consentStatus.innerHTML = optionList(CONSENT, lead.consent_status);
    form.elements.doNotContact.checked = Boolean(lead.do_not_contact);
    form.elements.notes.value = lead.notes || "";
    $("lead-dialog").showModal();
  }

  function openDecisionDialog(id, decision) {
    var item = state.approvals.filter(function (approval) { return approval.id === id; })[0];
    if (!item) return;
    var form = $("decision-form");
    form.elements.id.value = id;
    form.elements.decision.value = decision;
    form.elements.note.value = "";
    $("decision-title").textContent = decision === "approved" ? "Luluskan Permohonan" : "Tolak Permohonan";
    $("decision-sub").textContent = item.title;
    $("decision-submit").className = "btn " + (decision === "approved" ? "btn-success" : "btn-danger");
    $("decision-submit").textContent = decision === "approved" ? "Luluskan" : "Tolak";
    $("decision-dialog").showModal();
  }

  document.addEventListener("submit", function (event) {
    var form = event.target;

    if (form.id === "auth-form") {
      event.preventDefault();
      var authData = new FormData(form);
      var payload = {
        email: String(authData.get("email") || "").trim(),
        password: String(authData.get("password") || "")
      };
      if (state.authMode === "setup") payload.name = String(authData.get("name") || "").trim();
      $("auth-error").textContent = "";
      $("auth-submit").disabled = true;
      api(state.authMode === "setup" ? "/api/auth/setup" : "/api/auth/login", { method: "POST", body: payload })
        .then(function (data) {
          state.user = data.user;
          form.reset();
          enterApp();
          toast(state.authMode === "setup" ? "Akaun pentadbir dicipta." : "Selamat kembali.");
        })
        .catch(function (error) {
          $("auth-error").textContent = error.message;
        })
        .then(function () {
          $("auth-submit").disabled = false;
        });
      return;
    }

    if (!state.user) return;

    if (form.id === "task-form") {
      event.preventDefault();
      var taskData = new FormData(form);
      api("/api/tasks", {
        method: "POST",
        body: {
          title: taskData.get("title"),
          description: taskData.get("description"),
          priority: taskData.get("priority"),
          assignedAgentId: taskData.get("assignedAgentId") || null,
          dueAt: taskData.get("dueAt") || null
        }
      }).then(function () {
        toast("Tugasan dicipta.");
        switchTab("tasks");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "task-edit-form") {
      event.preventDefault();
      var taskEdit = new FormData(form);
      api("/api/tasks/" + encodeURIComponent(taskEdit.get("id")), {
        method: "PATCH",
        body: {
          title: taskEdit.get("title"),
          description: taskEdit.get("description"),
          status: taskEdit.get("status"),
          priority: taskEdit.get("priority"),
          assignedAgentId: taskEdit.get("assignedAgentId") || null
        }
      }).then(function () {
        $("task-dialog").close();
        toast("Tugasan dikemas kini.");
        switchTab("tasks");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "agent-form") {
      event.preventDefault();
      var agentData = new FormData(form);
      var capabilities = String(agentData.get("capabilities") || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
      api("/api/agents", {
        method: "POST",
        body: {
          name: agentData.get("name"),
          kind: agentData.get("kind"),
          description: agentData.get("description"),
          capabilities: capabilities
        }
      }).then(function () {
        toast("Ejen didaftarkan.");
        switchTab("agents");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "lead-form") {
      event.preventDefault();
      var leadData = new FormData(form);
      api("/api/leads", {
        method: "POST",
        body: {
          companyName: leadData.get("companyName"),
          contactName: leadData.get("contactName"),
          email: leadData.get("email"),
          phone: leadData.get("phone"),
          sourceId: leadData.get("sourceId") || null,
          status: leadData.get("status"),
          consentStatus: leadData.get("consentStatus"),
          doNotContact: leadData.get("doNotContact") === "on",
          notes: leadData.get("notes")
        }
      }).then(function () {
        toast("Prospek ditambah.");
        switchTab("leads");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "lead-edit-form") {
      event.preventDefault();
      var leadEdit = new FormData(form);
      api("/api/leads/" + encodeURIComponent(leadEdit.get("id")), {
        method: "PATCH",
        body: {
          companyName: leadEdit.get("companyName"),
          contactName: leadEdit.get("contactName"),
          email: leadEdit.get("email"),
          phone: leadEdit.get("phone"),
          sourceId: leadEdit.get("sourceId") || null,
          status: leadEdit.get("status"),
          consentStatus: leadEdit.get("consentStatus"),
          doNotContact: leadEdit.get("doNotContact") === "on",
          notes: leadEdit.get("notes")
        }
      }).then(function () {
        $("lead-dialog").close();
        toast("Prospek dikemas kini.");
        switchTab("leads");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "approval-form") {
      event.preventDefault();
      var approvalData = new FormData(form);
      api("/api/approvals", {
        method: "POST",
        body: {
          entityType: approvalData.get("entityType"),
          entityId: approvalData.get("entityId"),
          title: approvalData.get("title"),
          description: approvalData.get("description")
        }
      }).then(function () {
        toast("Permohonan dihantar.");
        switchTab("approvals");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "decision-form") {
      event.preventDefault();
      var decisionData = new FormData(form);
      api("/api/approvals/" + encodeURIComponent(decisionData.get("id")) + "/decision", {
        method: "POST",
        body: { decision: decisionData.get("decision"), note: decisionData.get("note") }
      }).then(function () {
        $("decision-dialog").close();
        toast("Keputusan direkodkan.");
        switchTab("approvals");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "user-form") {
      event.preventDefault();
      var userData = new FormData(form);
      api("/api/users", {
        method: "POST",
        body: {
          name: userData.get("name"),
          email: userData.get("email"),
          password: userData.get("password"),
          role: userData.get("role")
        }
      }).then(function () {
        toast("Pengguna ditambah.");
        switchTab("users");
      }).catch(function (error) { toast(error.message, true); });
    }
  });

  document.addEventListener("click", function (event) {
    var closeButton = event.target.closest("[data-close]");
    if (closeButton) {
      var closeTarget = $(closeButton.getAttribute("data-close"));
      if (closeTarget) closeTarget.close();
      return;
    }

    var target = event.target.closest("[data-action]");
    if (!target) return;
    var action = target.getAttribute("data-action");

    if (action === "nav") {
      switchTab(target.getAttribute("data-tab"));
      return;
    }

    if (action === "logout") {
      api("/api/auth/logout", { method: "POST", body: {} }).then(function () {
        state.user = null;
        showAuth({ configured: true, needsSetup: false });
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (action === "task-edit") {
      openTaskDialog(target.getAttribute("data-id"));
      return;
    }

    if (action === "lead-edit") {
      openLeadDialog(target.getAttribute("data-id"));
      return;
    }

    if (action === "decide") {
      openDecisionDialog(target.getAttribute("data-id"), target.getAttribute("data-decision"));
      return;
    }

    if (action === "agent-status") {
      var agentId = target.getAttribute("data-id");
      var nextStatus = target.getAttribute("data-status");
      api("/api/agents/" + encodeURIComponent(agentId), { method: "PATCH", body: { status: nextStatus } })
        .then(function () {
          toast("Status ejen dikemas kini.");
          switchTab("agents");
        }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (action === "user-status") {
      var userId = target.getAttribute("data-id");
      var userStatus = target.getAttribute("data-status");
      api("/api/users/" + encodeURIComponent(userId), { method: "PATCH", body: { status: userStatus } })
        .then(function () {
          toast("Status pengguna dikemas kini.");
          switchTab("users");
        }).catch(function (error) { toast(error.message, true); });
    }
  });

  api("/api/auth/me").then(function (me) {
    if (me.authenticated && me.user) {
      state.user = me.user;
      enterApp();
    } else {
      showAuth(me);
    }
  }).catch(function (error) {
    showAuth({ configured: true, needsSetup: false });
    toast(error.message, true);
  });
})();
</script>
</body>
</html>`;
