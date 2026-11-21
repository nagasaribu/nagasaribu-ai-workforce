export const consoleHtml = String.raw`<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pusat Kawalan Operasi — NAGASARIBU AI WORKFORCE</title>
<style>
  :root {
    --bg: #f6f7f9;
    --bg-warm: #fbfaf8;
    --surface: #ffffff;
    --surface-2: #f8fafc;
    --surface-3: #f1f5f9;
    --ink: #0f1b2d;
    --ink-2: #24344d;
    --muted: #5b6b82;
    --muted-2: #8493a8;
    --line: #e3e8ef;
    --line-strong: #d4dce6;
    --navy: #0b1b33;
    --navy-2: #10294a;
    --navy-3: #071426;
    --accent: #2563eb;
    --accent-2: #0d9488;
    --accent-soft: #e8f0ff;
    --teal: #0f766e;
    --teal-soft: #e6fbf8;
    --green: #047857;
    --green-soft: #e7f8f1;
    --amber: #b45309;
    --amber-soft: #fff6e5;
    --red: #b42318;
    --red-soft: #feeceb;
    --violet: #6d28d9;
    --violet-soft: #f3e8ff;
    --radius: 16px;
    --radius-sm: 11px;
    --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06);
    --shadow: 0 10px 28px rgba(16, 24, 40, 0.07);
    --shadow-lg: 0 28px 70px rgba(6, 15, 30, 0.18);
  }
  * { box-sizing: border-box; }
  svg { width: 1em; height: 1em; flex: 0 0 auto; vertical-align: -0.12em; }
  html, body { margin: 0; padding: 0; max-width: 100%; overflow-x: hidden; }
  body {
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background:
      radial-gradient(circle at 12% -10%, rgba(37, 99, 235, 0.06), transparent 34%),
      linear-gradient(180deg, var(--bg-warm) 0%, var(--bg) 48%, #f3f5f8 100%);
    color: var(--ink);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    font-feature-settings: "cv11", "ss01";
  }
  .hidden { display: none !important; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  h1, h2, h3, p { margin-top: 0; }
  h1 { font-size: 26px; line-height: 1.2; margin-bottom: 4px; letter-spacing: -0.025em; }
  h2 { font-size: 18px; letter-spacing: -0.015em; }
  h3 { font-size: 15px; letter-spacing: -0.01em; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* ---------- Auth ---------- */
  .auth {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at 18% 16%, rgba(37, 99, 235, 0.28), transparent 38%),
      radial-gradient(circle at 82% 78%, rgba(13, 148, 136, 0.22), transparent 36%),
      linear-gradient(150deg, #071426 0%, #0b1b33 55%, #081b2c 100%);
  }
  .auth-card {
    width: 100%;
    max-width: 440px;
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    padding: 36px 34px 28px;
    box-shadow: 0 40px 90px rgba(2, 6, 23, 0.48);
  }
  .auth-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .auth-logo .mark {
    width: 42px; height: 42px; border-radius: 13px;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #2563eb, #0d9488);
    color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.02em;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
  }
  .auth-brand { font-weight: 800; letter-spacing: 0.13em; font-size: 12.5px; color: var(--navy); }
  .auth-brand span { color: var(--teal); }
  .auth-sub { color: var(--muted); font-size: 13px; margin: 4px 0 24px; }
  .auth-logo .auth-sub { margin: 1px 0 0; }
  .auth-card h1 { font-size: 26px; }
  .auth-card form { display: grid; gap: 14px; margin-top: 18px; }
  .error { color: var(--red); font-size: 13px; margin: 0; min-height: 18px; }

  /* ---------- Layout ---------- */
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: 272px;
    background:
      radial-gradient(circle at 20% 0%, rgba(37, 99, 235, 0.22), transparent 34%),
      radial-gradient(circle at 100% 100%, rgba(13, 148, 136, 0.13), transparent 42%),
      linear-gradient(180deg, #0b1b33 0%, #09172b 52%, #071426 100%);
    color: #c4d0e2;
    display: flex;
    flex-direction: column;
    padding: 20px 14px 16px;
    z-index: 40;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    transition: transform 220ms ease;
  }
  .brand { display: flex; align-items: center; gap: 12px; padding: 4px 8px 24px; }
  .brand .mark {
    width: 42px; height: 42px; border-radius: 13px;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #2563eb 0%, #0ea5a4 100%);
    color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.02em;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.3);
    flex: 0 0 auto;
  }
  .brand strong { display: block; color: #f8fafc; font-size: 13px; letter-spacing: 0.11em; }
  .brand span { display: block; font-size: 10px; color: #8fa3bd; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 1px; }
  .nav-section-label {
    font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
    color: #6f84a0; font-weight: 800; padding: 0 12px 8px;
  }
  #nav { display: grid; gap: 3px; }
  .nav-item {
    appearance: none; border: 0; background: transparent; color: #aebdd1;
    text-align: left; padding: 10px 12px; border-radius: 10px;
    font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer;
    display: flex; align-items: center; gap: 10px; width: 100%;
    transition: background 140ms ease, color 140ms ease;
  }
  .nav-item svg { width: 18px; height: 18px; flex: 0 0 auto; opacity: 0.75; }
  .nav-item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-item:hover { background: rgba(148, 163, 184, 0.1); color: #fff; }
  .nav-item.active {
    background: linear-gradient(90deg, rgba(37, 99, 235, 0.32), rgba(13, 148, 136, 0.12));
    color: #fff; font-weight: 600;
    box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.18);
  }
  .nav-item.active svg { opacity: 1; color: #7dd3fc; }
  .sidebar-foot { margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(148, 163, 184, 0.14); }
  .user-card {
    display: flex; align-items: center; gap: 10px;
    padding: 10px; border-radius: 12px;
    background: rgba(255, 255, 255, 0.045);
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 8px;
  }
  .avatar {
    width: 36px; height: 36px; border-radius: 50%;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #2563eb, #0d9488);
    color: #fff; font-weight: 800; font-size: 11.5px; flex: 0 0 auto;
  }
  .user-meta { min-width: 0; flex: 1; }
  .user-meta strong { display: block; color: #f8fafc; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .user-meta span { display: block; color: #8fa3bd; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.1em; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.12); flex: 0 0 auto; }
  .sidebar .btn-ghost { justify-content: flex-start; font-size: 12.5px; padding: 9px 10px; }

  .shell { margin-left: 272px; min-height: 100vh; display: flex; flex-direction: column; min-width: 0; }
  .topbar {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px 30px;
    min-height: 76px;
    background: rgba(251, 250, 248, 0.86);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
  }
  .topbar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .eyebrow { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); font-weight: 800; }
  .topbar h1 { font-size: 21px; margin: 1px 0 0; }
  .status-strip { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
  .status-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px; border-radius: 999px;
    background: var(--surface); border: 1px solid var(--line);
    font-size: 10.5px; font-weight: 800; letter-spacing: 0.02em;
    color: var(--muted); white-space: nowrap;
    box-shadow: var(--shadow-sm);
  }
  .status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
  .status-pill.green { color: var(--green); background: var(--green-soft); border-color: #c7f0df; }
  .status-pill.teal { color: #0f766e; background: var(--teal-soft); border-color: #bdeee8; }
  .status-pill.amber { color: var(--amber); background: var(--amber-soft); border-color: #f5dfb5; }
  .status-pill.red { color: var(--red); background: var(--red-soft); border-color: #f7c9c5; }
  .status-pill.slate { color: #475569; background: #eef2f7; border-color: #dbe3ec; }
  .status-pill.violet { color: var(--violet); background: var(--violet-soft); border-color: #e9d5ff; }
  .env-pill {
    background: var(--navy); color: #dbeafe; font-weight: 800;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    padding: 7px 12px; border-radius: 999px; white-space: nowrap;
  }
  .menu-btn { display: none; }
  .icon-btn {
    appearance: none; border: 1px solid var(--line); background: var(--surface);
    color: var(--muted); width: 36px; height: 36px; border-radius: 10px;
    display: inline-grid; place-items: center; cursor: pointer; flex: 0 0 auto;
    box-shadow: var(--shadow-sm);
  }
  .icon-btn:hover { background: var(--surface-2); color: var(--ink); }
  .icon-btn svg { width: 18px; height: 18px; }
  main { padding: 28px 30px 70px; width: 100%; max-width: 1480px; margin: 0 auto; min-width: 0; }

  /* ---------- Hero ---------- */
  .hero {
    position: relative; overflow: hidden;
    border-radius: 22px; padding: 28px 30px;
    background:
      radial-gradient(circle at 82% 18%, rgba(13, 148, 136, 0.34), transparent 32%),
      radial-gradient(circle at 18% 0%, rgba(37, 99, 235, 0.4), transparent 38%),
      linear-gradient(120deg, #0b1b33 0%, #10294a 54%, #0b3440 100%);
    color: #fff; box-shadow: var(--shadow-lg); margin-bottom: 22px;
  }
  .hero::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
    background-size: 30px 30px;
    mask-image: linear-gradient(115deg, rgba(0,0,0,.7), transparent 62%);
  }
  .hero-content { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; flex-wrap: wrap; }
  .hero-main { min-width: 0; flex: 1 1 420px; }
  .hero-eyebrow { display: inline-flex; align-items: center; gap: 7px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: #93c5fd; font-weight: 800; }
  .hero h2 { color: #fff; font-size: 30px; line-height: 1.15; letter-spacing: -0.03em; margin: 8px 0 6px; }
  .hero p { color: #b9c7da; font-size: 13.5px; margin: 0; max-width: 620px; }
  .quick-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
  .quick-actions .btn { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.18); color: #fff; box-shadow: none; }
  .quick-actions .btn:hover { background: rgba(255,255,255,0.18); }
  .quick-actions .btn-primary { background: #fff; border-color: #fff; color: var(--navy); }
  .quick-actions .btn svg { width: 15px; height: 15px; }
  .hero-status {
    flex: 0 1 340px; min-width: 260px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px; padding: 16px;
    backdrop-filter: blur(8px);
  }
  .hero-status-title { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.16em; color: #93c5fd; font-weight: 800; margin-bottom: 10px; }
  .hero .status-strip { justify-content: flex-start; }
  .hero .status-pill { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.13); color: #dbeafe; box-shadow: none; }
  .hero .status-pill.green { color: #a7f3d0; background: rgba(16,185,129,.12); border-color: rgba(52,211,153,.22); }
  .hero .status-pill.teal { color: #99f6e4; background: rgba(13,148,136,.14); border-color: rgba(45,212,191,.2); }
  .hero .status-pill.amber { color: #fde68a; background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.22); }
  .hero .status-pill.red { color: #fecaca; background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.22); }
  .hero .status-pill.slate { color: #cbd5e1; background: rgba(148,163,184,.1); border-color: rgba(148,163,184,.16); }
  .hero .status-pill.violet { color: #ddd6fe; background: rgba(139,92,246,.14); border-color: rgba(167,139,250,.22); }
  .hero-note { color: #93a9c4; font-size: 11px; margin-top: 10px; line-height: 1.45; }

  /* ---------- KPI / panels ---------- */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 22px; }
  .stat {
    position: relative; background: var(--surface); border: 1px solid var(--line);
    border-radius: 16px; padding: 18px; box-shadow: var(--shadow-sm);
    min-width: 0; overflow: hidden;
  }
  .stat .stat-icon {
    width: 38px; height: 38px; border-radius: 11px;
    display: grid; place-items: center; margin-bottom: 12px;
  }
  .stat .stat-icon svg { width: 19px; height: 19px; }
  .stat .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); font-weight: 800; }
  .stat .value { font-size: 31px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.08; margin: 4px 0 3px; }
  .stat .hint { font-size: 11.5px; color: var(--muted); }
  .stat .stat-link { position: absolute; right: 14px; top: 14px; color: #c2ccd9; }
  .stat .stat-link svg { width: 16px; height: 16px; }

  .panel {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); box-shadow: var(--shadow-sm);
    margin-bottom: 18px; overflow: hidden; min-width: 0;
  }
  .panel-head {
    padding: 16px 20px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .panel-head h2 { margin: 0; font-size: 15px; font-weight: 750; display: flex; align-items: center; gap: 8px; }
  .panel-head h2 svg { width: 16px; height: 16px; color: var(--muted); flex: 0 0 auto; }
  .panel-sub { color: var(--muted); font-size: 11.5px; margin: 2px 0 0; }
  .panel-body { padding: 20px; }
  .panel-body.tight { padding: 14px 20px; }
  .grid-2 { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 18px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
  .page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .page-head h2 { margin: 0; font-size: 23px; letter-spacing: -0.025em; }
  .page-head p { margin: 4px 0 0; color: var(--muted); font-size: 13px; max-width: 700px; }

  /* ---------- Buttons ---------- */
  .btn {
    appearance: none; border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    font: inherit; font-size: 12.5px; font-weight: 700; padding: 9px 14px; border-radius: 10px;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 38px; white-space: nowrap; transition: background 140ms ease, border-color 140ms ease, transform 120ms ease;
  }
  .btn svg { width: 15px; height: 15px; flex: 0 0 auto; }
  .btn:hover { background: var(--surface-2); border-color: var(--line-strong); }
  .btn:active { transform: translateY(1px); }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .btn-primary { background: linear-gradient(135deg, #2563eb, #1d4ed8); border-color: transparent; color: #fff; box-shadow: 0 5px 14px rgba(37, 99, 235, 0.24); }
  .btn-primary:hover { background: linear-gradient(135deg, #1d4ed8, #1e40af); border-color: transparent; }
  .btn-teal { background: linear-gradient(135deg, #0d9488, #0f766e); border-color: transparent; color: #fff; box-shadow: 0 5px 14px rgba(13, 148, 136, 0.2); }
  .btn-teal:hover { background: linear-gradient(135deg, #0f766e, #115e59); }
  .btn-danger { background: var(--red-soft); border-color: #f7c9c5; color: var(--red); }
  .btn-danger:hover { background: #fde3e1; }
  .btn-success { background: var(--green-soft); border-color: #bdeed8; color: var(--green); }
  .btn-ghost { background: transparent; border-color: rgba(148, 163, 184, 0.28); color: #cbd5e1; }
  .btn-ghost:hover { background: rgba(148, 163, 184, 0.14); border-color: rgba(148, 163, 184, 0.36); }
  .btn-sm { padding: 6px 10px; font-size: 11.5px; border-radius: 8px; min-height: 32px; }
  .btn-sm svg { width: 13px; height: 13px; }
  .btn-block { width: 100%; }
  .table-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .card-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; align-items: center; }

  /* ---------- Forms ---------- */
  label { display: grid; gap: 6px; font-size: 11.5px; font-weight: 700; color: #334155; }
  input, select, textarea {
    width: 100%; font: inherit; font-size: 13.5px; color: var(--ink);
    background: var(--surface); border: 1px solid #cbd5e1; border-radius: 10px;
    padding: 9px 11px; outline: none; transition: border-color 140ms ease, box-shadow 140ms ease;
  }
  input, select { min-height: 40px; }
  input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.13); }
  textarea { min-height: 94px; resize: vertical; line-height: 1.5; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
  .form-grid .wide { grid-column: 1 / -1; }
  .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; flex-wrap: wrap; }
  .form-section { border-top: 1px solid var(--line); padding-top: 16px; margin-top: 18px; }
  .form-section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.13em; color: var(--muted); font-weight: 800; margin-bottom: 12px; }
  .form-hint { font-size: 11px; color: var(--muted); font-weight: 500; margin-top: 2px; }
  .check { display: flex; align-items: center; gap: 9px; font-size: 12.5px; font-weight: 600; }
  .check input { width: auto; min-height: 0; }
  .toolbar { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
  .toolbar input, .toolbar select { min-width: 150px; width: auto; }

  details.panel > summary {
    cursor: pointer; padding: 16px 20px; font-weight: 750; font-size: 13.5px;
    list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  details.panel > summary::-webkit-details-marker { display: none; }
  details.panel > summary::after { content: "+"; font-size: 20px; color: var(--muted); line-height: 1; }
  details.panel[open] > summary::after { content: "−"; }
  details.panel .panel-body { border-top: 1px solid var(--line); }

  /* ---------- Tables ---------- */
  .table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 680px; }
  th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }
  td { word-break: break-word; }
  th { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); background: var(--surface-2); font-weight: 800; white-space: nowrap; }
  tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: #fafbfc; }
  td .sub, .sub { color: var(--muted); font-size: 11.5px; margin-top: 2px; }
  .result-preview {
    max-width: 320px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word; font-size: 11.5px; color: var(--muted);
  }
  .result-preview.error { color: var(--red); }

  /* ---------- Badges / chips ---------- */
  .badge {
    display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 999px;
    font-size: 10px; font-weight: 800; letter-spacing: 0.015em; white-space: nowrap;
    background: #eef2ff; color: #3730a3;
  }
  .badge .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.85; }
  .badge.green { background: var(--green-soft); color: var(--green); }
  .badge.amber { background: var(--amber-soft); color: var(--amber); }
  .badge.red { background: var(--red-soft); color: var(--red); }
  .badge.slate { background: #eef2f7; color: #475569; }
  .badge.blue { background: var(--accent-soft); color: #1d4ed8; }
  .badge.teal { background: var(--teal-soft); color: var(--teal); }
  .badge.violet { background: var(--violet-soft); color: var(--violet); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip { background: var(--surface-2); border: 1px solid var(--line); border-radius: 7px; padding: 3px 7px; font-size: 10.5px; color: #475569; }

  /* ---------- Agent cards ---------- */
  .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; box-shadow: var(--shadow-sm); min-width: 0; }
  .card h3 { margin: 0 0 4px; }
  .card .meta { color: var(--muted); font-size: 11.5px; }
  .agent-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; }
  .agent-grid.compact { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .agent-card {
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    padding: 17px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 10px; min-width: 0;
  }
  .agent-top { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .agent-avatar { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; flex: 0 0 auto; }
  .agent-avatar svg { width: 21px; height: 21px; }
  .agent-avatar.sm { width: 36px; height: 36px; border-radius: 10px; }
  .agent-avatar.sm svg { width: 17px; height: 17px; }
  .agent-name-wrap { min-width: 0; flex: 1; }
  .agent-card h3 { margin: 0; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .agent-role { color: var(--muted); font-size: 11px; margin-top: 1px; }
  .agent-status { margin-left: auto; flex: 0 0 auto; }
  .agent-desc { font-size: 12px; color: var(--muted); line-height: 1.5; min-height: 36px; }
  .agent-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10px; margin-top: auto; }
  .agent-meta strong { color: var(--ink); font-weight: 750; }
  .tone-blue { background: var(--accent-soft); color: #1d4ed8; }
  .tone-teal { background: var(--teal-soft); color: var(--teal); }
  .tone-amber { background: var(--amber-soft); color: var(--amber); }
  .tone-green { background: var(--green-soft); color: var(--green); }
  .tone-violet { background: var(--violet-soft); color: var(--violet); }
  .tone-slate { background: #eef2f7; color: #334155; }
  .tone-red { background: var(--red-soft); color: var(--red); }

  /* ---------- Activity / pipeline ---------- */
  .activity-list { display: grid; gap: 0; }
  .activity-item { display: flex; gap: 11px; padding: 11px 0; border-bottom: 1px solid var(--line); min-width: 0; }
  .activity-item:last-child { border-bottom: 0; padding-bottom: 0; }
  .activity-icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; flex: 0 0 auto; background: var(--surface-2); color: var(--muted); }
  .activity-icon svg { width: 15px; height: 15px; }
  .activity-body { min-width: 0; flex: 1; }
  .activity-title { font-size: 12.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .activity-sub { font-size: 11px; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .activity-meta { font-size: 10px; color: var(--muted-2); white-space: nowrap; margin-top: 2px; }
  .pipeline { display: grid; gap: 11px; }
  .pipeline-row { display: grid; gap: 5px; }
  .pipeline-top { display: flex; justify-content: space-between; gap: 12px; font-size: 11.5px; color: var(--muted); }
  .pipeline-top strong { color: var(--ink); font-size: 12px; }
  .pipeline-bar { height: 7px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
  .pipeline-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #2563eb, #0d9488); }
  .pipeline-fill.amber { background: linear-gradient(90deg, #f59e0b, #d97706); }
  .pipeline-fill.green { background: linear-gradient(90deg, #10b981, #047857); }
  .pipeline-fill.violet { background: linear-gradient(90deg, #8b5cf6, #6d28d9); }

  /* ---------- Prospect ---------- */
  .search-hero {
    background:
      radial-gradient(circle at 100% 0%, rgba(13, 148, 136, 0.08), transparent 34%),
      linear-gradient(135deg, #ffffff, #f8fcfb);
    border: 1px solid #d9eeeb; border-radius: 18px; padding: 20px;
    box-shadow: var(--shadow-sm); margin-bottom: 18px;
  }
  .search-hero-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .search-hero h2 { margin: 0; font-size: 18px; }
  .search-hero p { margin: 4px 0 0; color: var(--muted); font-size: 12.5px; max-width: 720px; }
  .prospect-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 14px; }
  .prospect-card {
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    padding: 18px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 10px; min-width: 0;
  }
  .prospect-top { display: flex; align-items: flex-start; gap: 12px; }
  .prospect-title { min-width: 0; flex: 1; }
  .prospect-title h3 { margin: 0; font-size: 14.5px; line-height: 1.3; word-break: break-word; }
  .prospect-links { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11.5px; }
  .prospect-summary { font-size: 12px; color: var(--muted); line-height: 1.55; }
  .score-ring {
    width: 48px; height: 48px; border-radius: 50%; position: relative;
    display: grid; place-items: center; flex: 0 0 auto;
  }
  .score-ring::before { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: var(--surface); }
  .score-ring span { position: relative; font-size: 12px; font-weight: 800; }
  .evidence-list { display: grid; gap: 6px; padding-top: 8px; border-top: 1px solid var(--line); }
  .evidence-item { font-size: 11px; color: var(--muted); line-height: 1.45; }
  .evidence-item a { font-weight: 600; }
  .prospect-actions { margin-top: auto; padding-top: 4px; }

  /* ---------- Empty / loading / toast ---------- */
  .empty, .empty-state { text-align: center; color: var(--muted); padding: 34px 18px; font-size: 12.5px; }
  .empty-state .empty-icon {
    width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center;
    margin: 0 auto 12px; background: var(--surface-2); border: 1px solid var(--line); color: #94a3b8;
  }
  .empty-state .empty-icon svg { width: 21px; height: 21px; }
  .empty-state h3 { margin: 0 0 4px; color: var(--ink); font-size: 14px; }
  .empty-state p { margin: 0 auto; max-width: 420px; font-size: 12px; line-height: 1.55; }
  .empty-state .btn { margin-top: 14px; }
  .loading-grid { display: grid; gap: 16px; }
  .skeleton {
    background: linear-gradient(90deg, #edf1f6 25%, #f8fafc 50%, #edf1f6 75%);
    background-size: 200% 100%; animation: shimmer 1.4s ease infinite; border-radius: 14px;
  }
  @keyframes shimmer { to { background-position: -200% 0; } }
  .skeleton-hero { height: 170px; }
  .skeleton-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .skeleton-card { height: 108px; }
  .skeleton-panel { height: 260px; }
  .toast {
    position: fixed; right: 22px; bottom: 22px; z-index: 100;
    background: var(--navy); color: #f8fafc; padding: 12px 17px; border-radius: 12px;
    font-size: 12.5px; font-weight: 600; box-shadow: 0 18px 44px rgba(2, 6, 23, 0.35);
    opacity: 0; transform: translateY(8px); pointer-events: none;
    transition: opacity 170ms ease, transform 170ms ease;
    max-width: min(400px, calc(100vw - 44px));
    border: 1px solid rgba(255,255,255,0.08);
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.error { background: #7f1d1d; border-color: #991b1b; }
  .login-note {
    background: var(--amber-soft); color: #92400e; border: 1px solid #fde68a;
    border-radius: 10px; padding: 10px 12px; font-size: 12px; margin-top: 14px; line-height: 1.5;
  }

  /* ---------- Dialogs ---------- */
  dialog {
    border: 0; border-radius: 20px; padding: 0; width: min(760px, calc(100vw - 28px));
    max-height: calc(100vh - 36px); box-shadow: var(--shadow-lg); background: var(--surface);
    overflow: hidden;
  }
  dialog::backdrop { background: rgba(6, 15, 30, 0.62); backdrop-filter: blur(3px); }
  dialog form { padding: 24px; overflow: auto; max-height: calc(100vh - 36px); }
  dialog h2 { margin: 0 0 4px; font-size: 19px; letter-spacing: -0.02em; }
  dialog .dialog-sub { color: var(--muted); font-size: 12px; margin-bottom: 16px; line-height: 1.5; }
  dialog .panel-body { padding: 24px; overflow: auto; max-height: calc(100vh - 36px); }
  .dialog-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px 0; }
  .dialog-head h2 { margin: 2px 0 0; }
  .dialog-body { padding: 18px 24px 22px; overflow: auto; max-height: calc(100vh - 190px); }
  .dialog-foot { padding: 14px 24px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px; background: var(--surface-2); }
  .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .detail-item { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; min-width: 0; }
  .detail-item .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); font-weight: 800; }
  .detail-item .value { font-size: 12.5px; margin-top: 3px; word-break: break-word; }
  .result-box {
    background: #0b1b33; color: #dbeafe; border-radius: 12px; padding: 15px;
    font-size: 12.5px; line-height: 1.65; white-space: pre-wrap; word-break: break-word;
    max-height: 380px; overflow: auto;
  }
  .error-box { background: var(--red-soft); color: #7f1d1d; border: 1px solid #f7c9c5; border-radius: 12px; padding: 12px 14px; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; }
  .timeline { display: grid; gap: 0; margin-top: 4px; }
  .timeline-item { display: flex; gap: 11px; padding: 9px 0; border-bottom: 1px solid var(--line); }
  .timeline-item:last-child { border-bottom: 0; }
  .timeline-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; background: var(--accent); flex: 0 0 auto; }
  .timeline-dot.green { background: var(--green); }
  .timeline-dot.red { background: var(--red); }
  .timeline-dot.amber { background: var(--amber); }
  .timeline-dot.slate { background: #94a3b8; }
  .timeline-body { min-width: 0; flex: 1; }
  .timeline-head { display: flex; justify-content: space-between; gap: 12px; font-size: 11.5px; }
  .timeline-head span { color: var(--muted); font-size: 10.5px; white-space: nowrap; }

  .nav-backdrop {
    position: fixed; inset: 0; background: rgba(6, 15, 30, 0.58);
    z-index: 35; opacity: 0; pointer-events: none; transition: opacity 200ms ease;
  }
  body.nav-open .nav-backdrop { opacity: 1; pointer-events: auto; }
  body.nav-open { overflow: hidden; }

  @media (min-width: 1025px) {
    .nav-backdrop { display: none !important; }
    body.nav-open { overflow: auto; }
  }
  @media (max-width: 1180px) {
    .grid-2, .grid-3 { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    table { min-width: 560px; }
  }
  @media (max-width: 1024px) {
    .sidebar { transform: translateX(-105%); width: 280px; box-shadow: 20px 0 60px rgba(2, 6, 23, 0.35); }
    body.nav-open .sidebar { transform: none; }
    .shell { margin-left: 0; }
    .menu-btn { display: inline-grid; }
    .topbar { padding: 12px 18px; min-height: 70px; }
    main { padding: 20px 18px 60px; }
  }
  @media (max-width: 720px) {
    .hero { padding: 22px 20px; border-radius: 18px; }
    .hero h2 { font-size: 24px; }
    .hero-status { flex-basis: 100%; min-width: 0; }
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .stat { padding: 15px; }
    .stat .value { font-size: 26px; }
    .stat .stat-icon { width: 34px; height: 34px; margin-bottom: 9px; }
    .page-head { align-items: flex-start; }
    .page-head h2 { font-size: 21px; }
    .form-grid { grid-template-columns: 1fr; }
    .prospect-grid, .agent-grid, .agent-grid.compact { grid-template-columns: 1fr; }
    .hide-sm { display: none; }
    .topbar h1 { font-size: 17px; }
    .topbar { flex-wrap: wrap; gap: 10px; }
    .status-strip { width: 100%; justify-content: flex-start; overflow-x: auto; padding-bottom: 1px; }
    .status-pill { font-size: 9.5px; padding: 5px 8px; }
    dialog { width: calc(100vw - 18px); }
    dialog form, dialog .panel-body { padding: 18px; }
    .dialog-head { padding: 18px 18px 0; }
    .dialog-body { padding: 14px 18px 18px; }
    .dialog-foot { padding: 12px 18px; }
  }
  @media (max-width: 480px) {
    .stats { grid-template-columns: 1fr; }
    .auth-card { padding: 28px 22px; }
    .hero h2 { font-size: 22px; }
    .quick-actions .btn { flex: 1 1 auto; }
    .table-actions { flex-direction: column; align-items: stretch; }
  }

</style>
</head>
<body>

<div id="auth-view" class="auth hidden">
  <div class="auth-card">
    <div class="auth-logo">
      <div class="mark">NA</div>
      <div>
        <div class="auth-brand">NAGASARIBU <span>AI WORKFORCE</span></div>
        <div class="auth-sub">Pusat Kawalan Operasi</div>
      </div>
    </div>
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
  <div id="nav-backdrop" class="nav-backdrop" data-action="close-nav"></div>
  <aside class="sidebar" id="sidebar" aria-label="Navigasi utama">
    <div class="brand">
      <div class="mark">NA</div>
      <div><strong>NAGASARIBU</strong><span>AI Workforce</span></div>
    </div>
    <div class="nav-section-label">Ruang Kerja</div>
    <nav id="nav"></nav>
    <div class="sidebar-foot">
      <div class="user-card">
        <div class="avatar" id="user-avatar">NA</div>
        <div class="user-meta"><strong id="user-name"></strong><span id="user-role"></span></div>
        <span class="status-dot" title="Aktif" aria-label="Aktif"></span>
      </div>
      <button class="btn btn-ghost btn-block" type="button" data-action="logout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Log Keluar
      </button>
    </div>
  </aside>
  <div class="shell">
    <header class="topbar">
      <div class="topbar-left">
        <button class="icon-btn menu-btn" type="button" data-action="toggle-nav" aria-label="Buka navigasi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <div>
          <span class="eyebrow">Pusat Kawalan Operasi</span>
          <h1 id="page-title">Ringkasan</h1>
        </div>
      </div>
      <div class="status-strip" id="global-status" aria-live="polite">
        <span class="status-pill slate"><span class="dot"></span> Menyemak status…</span>
      </div>
    </header>
    <main id="view" aria-live="polite"></main>
  </div>
</div>

<div id="toast" class="toast" role="status"></div>

<dialog id="task-detail-dialog">
  <div class="dialog-head">
    <div>
      <span class="eyebrow">Butiran Tugas</span>
      <h2 id="task-detail-title">—</h2>
      <p class="dialog-sub" id="task-detail-sub"></p>
    </div>
    <button class="icon-btn" type="button" data-close="task-detail-dialog" aria-label="Tutup">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="dialog-body" id="task-detail-body"></div>
  <div class="dialog-foot">
    <button class="btn" type="button" data-close="task-detail-dialog">Tutup</button>
  </div>
</dialog>

<dialog id="task-dialog">
  <form id="task-edit-form">
    <h2>Kemas Kini Tugas</h2>
    <p class="dialog-sub">Hanya peralihan state yang sah dipaparkan. Alat luaran memerlukan kelulusan.</p>
    <input type="hidden" name="id">
    <div class="form-grid">
      <label class="wide">Tajuk<input name="title" type="text" maxlength="200" required></label>
      <label class="wide">Keterangan<textarea name="description" maxlength="5000"></textarea></label>
      <label>State<select name="state"></select></label>
      <label>Keutamaan<select name="priority"></select></label>
      <label class="wide">Ejen<select name="assignedAgentId"></select></label>
      <label>Keupayaan<input name="capability" type="text" maxlength="80" placeholder="contoh: orchestration"></label>
      <label>Alat dalaman<select name="tool"></select></label>
      <label class="check"><input name="requiresApproval" type="checkbox"> Perlukan kelulusan</label>
      <label class="wide">Hasil / ralat terakhir<textarea name="lastResult" readonly placeholder="Belum ada pelaksanaan"></textarea></label>
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
      <label>Laman web<input name="website" type="url" maxlength="300"></label>
      <label>Tarikh susulan<input name="followUpAt" type="date"></label>
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

<dialog id="draft-dialog">
  <div class="panel-body">
    <h2>Draf Outreach</h2>
    <p class="dialog-sub">Draf untuk semakan manusia. Tiada mesej dihantar atau kandungan diterbitkan.</p>
    <div class="form-grid">
      <label class="wide">Analisis<textarea id="draft-analysis" readonly></textarea></label>
      <label class="wide">WhatsApp<textarea id="draft-whatsapp" readonly></textarea></label>
      <label class="wide">Subjek e-mel<input id="draft-email-subject" type="text" readonly></label>
      <label class="wide">E-mel<textarea id="draft-email-body" readonly></textarea></label>
      <label class="wide">Cadangan<textarea id="draft-proposal" readonly></textarea></label>
    </div>
    <div class="form-actions">
      <button class="btn" type="button" data-close="draft-dialog">Tutup</button>
    </div>
  </div>
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
    users: [],
    prospects: [],
    taskAgentFilter: null,
    taskAgentName: ""
  };

  var ROLE_LABELS = { admin: "Pentadbir", manager: "Pengurus", agent: "Ejen", viewer: "Pemerhati" };
  var TASK_STATUS = {
    pending: "Menunggu", assigned: "Ditugaskan", running: "Sedang Berjalan",
    in_progress: "Sedang Berjalan", blocked: "Terhalang", failed: "Gagal",
    completed: "Selesai", cancelled: "Dibatalkan"
  };
  var TASK_NEXT = {
    pending: ["pending", "assigned", "blocked", "cancelled"],
    assigned: ["assigned", "running", "blocked", "cancelled"],
    running: ["running", "completed", "failed", "blocked", "cancelled"],
    completed: ["completed", "assigned", "running", "blocked", "cancelled"],
    failed: ["failed", "assigned", "running", "blocked", "cancelled"],
    blocked: ["blocked", "assigned", "running", "cancelled"],
    cancelled: ["cancelled"]
  };
  var TOOL_OPTIONS = {
    "": "Tiada alat",
    registry_snapshot: "registry_snapshot (baca sahaja)",
    task_context: "task_context (baca sahaja)",
    lead_summary: "lead_summary (baca sahaja)",
    external_publish: "external_publish (perlu kelulusan)",
    send_campaign: "send_campaign (perlu kelulusan)",
    payment: "payment (perlu kelulusan)"
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
  var EVENT_LABELS = {
    execution_started: "Pelaksanaan bermula",
    execution_completed: "Pelaksanaan selesai",
    execution_failed: "Pelaksanaan gagal",
    execution_mock: "Mock sahaja",
    approval_required: "Kelulusan diperlukan",
    provider_fallback: "Fallback penyedia",
    auto_routed: "Auto-arah SARA",
    routing_failed: "Penghalaan gagal",
    created: "Dicipta",
    status_changed: "Status berubah",
    assigned: "Ditugaskan"
  };

  var svg = function (body) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  };
  var ICONS = {
    dashboard: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    tasks: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>'),
    agents: svg('<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 3v4M8.5 12h.01M15.5 12h.01M9 19v2M15 19v2"/>'),
    prospects: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M8 11h6M11 8v6"/>'),
    leads: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
    approvals: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
    users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>'),
    audit: svg('<path d="M3 3v18h18"/><path d="m7 14 3-3 3 2 4-5"/>'),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    play: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    bolt: svg('<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>'),
    database: svg('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
    activity: svg('<path d="M3 12h4l3 8 4-16 3 8h4"/>'),
    alert: svg('<path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    check: svg('<path d="m20 6-11 11-5-5"/>'),
    target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    external: svg('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    sara: svg('<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8z"/>'),
    qs: svg('<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>'),
    marketing: svg('<path d="m3 11 18-6v14L3 13z"/><path d="M11 13v4a3 3 0 0 0 6 0"/>'),
    finance: svg('<path d="M3 3v18h18"/><path d="m7 14 3-4 3 2 5-6"/>'),
    technical: svg('<path d="m8 9-4 3 4 3M16 9l4 3-4 3M13 5l-2 14"/>'),
    creative: svg('<path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h4a5 5 0 0 0-4-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="9.5" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>'),
    sparkles: svg('<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>'),
    filter: svg('<path d="M4 5h16l-6 7v5l-4 2v-7L4 5z"/>'),
    refresh: svg('<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>'),
    inbox: svg('<path d="M4 4h16v16H4z"/><path d="M4 12h5l2 3h6l2-3h5"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')
  };

  var AGENT_META = {
    agent_sara: { role: "Orkestrator Pusat", tone: "blue", icon: ICONS.sara },
    agent_qs: { role: "Ukur Bahan & Kos", tone: "teal", icon: ICONS.qs },
    agent_marketing: { role: "Pemerolehan Pelanggan", tone: "amber", icon: ICONS.marketing },
    agent_finance: { role: "Operasi Kewangan", tone: "green", icon: ICONS.finance },
    agent_technical: { role: "Kejuruteraan & Automasi", tone: "slate", icon: ICONS.technical },
    agent_creative: { role: "Produksi Kreatif", tone: "violet", icon: ICONS.creative }
  };

  function agentMeta(agent) {
    if (AGENT_META[agent.id]) return AGENT_META[agent.id];
    var kind = String(agent.kind || "").toLowerCase();
    if (kind.indexOf("quantity") >= 0) return AGENT_META.agent_qs;
    if (kind.indexOf("customer") >= 0 || kind.indexOf("marketing") >= 0) return AGENT_META.agent_marketing;
    if (kind.indexOf("financial") >= 0) return AGENT_META.agent_finance;
    if (kind.indexOf("engineering") >= 0 || kind.indexOf("technical") >= 0) return AGENT_META.agent_technical;
    if (kind.indexOf("creative") >= 0) return AGENT_META.agent_creative;
    if (kind.indexOf("orchestr") >= 0) return AGENT_META.agent_sara;
    return { role: "Ejen AI", tone: "slate", icon: ICONS.agents };
  }

  function initials(name) {
    return String(name || "NA").split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("") || "NA";
  }

  function statusPill(text, tone, iconName) {
    return '<span class="status-pill ' + esc(tone || "slate") + '">' +
      (iconName && ICONS[iconName] ? ICONS[iconName] : '<span class="dot"></span>') +
      esc(text) + "</span>";
  }

  function priorityBadge(priority) {
    var tone = priority === "urgent" ? "red" : priority === "high" ? "amber" : priority === "low" ? "slate" : "blue";
    return '<span class="badge ' + tone + '"><span class="dot"></span>' + esc(label(PRIORITY, priority)) + "</span>";
  }

  function emptyState(iconName, title, text, actionHtml) {
    return '<div class="empty-state"><div class="empty-icon">' + (ICONS[iconName] || ICONS.inbox) + "</div><h3>" + esc(title) + "</h3><p>" + esc(text) + "</p>" + (actionHtml || "") + "</div>";
  }

  function loadingSkeleton() {
    return '<div class="loading-grid" aria-label="Memuatkan"><div class="skeleton skeleton-hero"></div><div class="skeleton-row"><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div></div><div class="skeleton skeleton-panel"></div></div>';
  }

  var navMeta = {
    dashboard: "Ringkasan",
    tasks: "Tugas",
    agents: "Ejen",
    prospects: "Cari Prospek",
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
    else if (value === "running" || value === "in_progress" || value === "qualified" || value === "assigned") tone = "blue";
    else if (value === "blocked" || value === "pending" || value === "new" || value === "contacted") tone = "amber";
    else if (value === "failed" || value === "cancelled" || value === "lost" || value === "rejected" || value === "disabled") tone = "red";
    return '<span class="badge ' + tone + '"><span class="dot"></span>' + esc(label(map, value)) + "</span>";
  }

  function eventBadge(type) {
    var tone = "blue";
    if (type === "execution_completed") tone = "green";
    else if (type === "execution_failed" || type === "routing_failed") tone = "red";
    else if (type === "approval_required" || type === "execution_mock") tone = "amber";
    else if (type === "auto_routed") tone = "slate";
    return '<span class="badge ' + tone + '">' + esc(label(EVENT_LABELS, type)) + "</span>";
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

  function stateOfTask(task) {
    return task.execution_state || (task.status === "in_progress" ? "running" : task.status) || "pending";
  }

  function stateOptions(current) {
    var states = TASK_NEXT[current] || [current];
    return states.map(function (state) {
      return '<option value="' + esc(state) + '"' + (state === current ? " selected" : "") + ">" + esc(TASK_STATUS[state] || state) + "</option>";
    }).join("");
  }

  function showAuth(me) {
    document.body.classList.remove("nav-open");
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
    if (state.user.role === "admin" || state.user.role === "manager") {
      items.push(["prospects", "Cari Prospek"]);
    }
    if (state.user.role === "manager" || state.user.role === "admin" || state.user.role === "agent") {
      items.push(["leads", "Prospek"]);
      items.push(["approvals", "Kelulusan"]);
    }
    if (state.user.role === "admin") items.push(["users", "Pengguna"]);
    if (state.user.role === "admin" || state.user.role === "manager") items.push(["audit", "Log Audit"]);

    $("nav").innerHTML = items.map(function (item) {
      return '<button class="nav-item' + (item[0] === state.tab ? " active" : "") + '" type="button" data-action="nav" data-tab="' + item[0] + '">' + (ICONS[item[0]] || ICONS.dashboard) + "<span>" + item[1] + "</span></button>";
    }).join("");
  }

  function loadGlobalStatus() {
    var node = $("global-status");
    if (!node) return;
    api("/health").then(function (health) {
      var checks = (health && health.checks) || {};
      node.innerHTML = [
        statusPill(checks.ai === "live" ? "DeepSeek LIVE" : "DeepSeek MOCK", checks.ai === "live" ? "green" : "amber", null),
        statusPill(checks.search === "configured" ? "Exa READY" : "Exa OFFLINE", checks.search === "configured" ? "teal" : "amber", null),
        statusPill(checks.backup === "configured" ? "Muse Spark CONFIGURED" : "Muse Spark OFFLINE", checks.backup === "configured" ? "violet" : "amber", null),
        statusPill(checks.database === "ok" ? "D1 HEALTHY" : "D1 DEGRADED", checks.database === "ok" ? "green" : "red", null)
      ].join("");
    }).catch(function () {
      node.innerHTML = statusPill("Status tidak tersedia", "slate", null);
    });
  }

  function enterApp() {
    $("auth-view").classList.add("hidden");
    $("app-view").classList.remove("hidden");
    $("user-name").textContent = state.user.name;
    $("user-role").textContent = label(ROLE_LABELS, state.user.role);
    $("user-avatar").textContent = initials(state.user.name);
    buildNav();
    loadGlobalStatus();
    switchTab("dashboard");
  }

  function switchTab(tab) {
    if (!navMeta[tab]) tab = "dashboard";
    state.tab = tab;
    document.body.classList.remove("nav-open");
    $("page-title").textContent = navMeta[tab];
    buildNav();
    $("view").innerHTML = loadingSkeleton();
    window.scrollTo({ top: 0, behavior: "smooth" });
    var loader = loaders[tab];
    if (!loader) return;
    loader().catch(function (error) {
      $("view").innerHTML = '<div class="panel">' + emptyState("alert", "Tidak dapat memuatkan data", error.message || "Sila cuba lagi.") + "</div>";
      toast(error.message, true);
    });
  }

  function statCard(title, value, hint, iconName, tone) {
    return '<div class="stat"><div class="stat-icon tone-' + esc(tone || "blue") + '">' + (ICONS[iconName] || ICONS.activity) + '</div><div class="label">' + esc(title) + '</div><div class="value">' + esc(value) + '</div><div class="hint">' + esc(hint) + '</div><span class="stat-link">' + ICONS.arrow + "</span></div>";
  }

  function emptyRow(cols, message) {
    return '<tr><td colspan="' + cols + '"><div class="empty">' + esc(message) + "</div></td></tr>";
  }

  function providerCard(options) {
    return '<div class="agent-card"><div class="agent-top"><div class="agent-avatar sm tone-' + options.tone + '">' + (ICONS[options.icon] || ICONS.bolt) + '</div><div class="agent-name-wrap"><h3>' + esc(options.name) + '</h3><div class="agent-role">' + esc(options.role) + '</div></div><div class="agent-status"><span class="badge ' + options.statusTone + '"><span class="dot"></span>' + esc(options.status) + "</span></div></div>" +
      '<div class="agent-meta"><span>Model <strong>' + esc(options.model) + '</strong></span>' + (options.tokens !== undefined ? "<span><strong>" + esc(options.tokens) + "</strong> token</span>" : "") + "</div></div>";
  }

  function agentMiniCard(agent) {
    var meta = agentMeta(agent);
    var config = {};
    try { config = JSON.parse(agent.config || "{}"); } catch (ignore) { config = {}; }
    return '<div class="agent-card"><div class="agent-top"><div class="agent-avatar sm tone-' + meta.tone + '">' + meta.icon + '</div><div class="agent-name-wrap"><h3>' + esc(agent.name) + '</h3><div class="agent-role">' + esc(meta.role) + '</div></div><div class="agent-status">' + badge(agent.status, AGENT_STATUS) + '</div></div><div class="agent-meta"><span><strong>' + esc(agent.active_tasks || 0) + '</strong> tugas aktif</span><span>Model <strong>' + esc(config.model || "deepseek-chat") + '</strong></span></div></div>';
  }

  function pipelineRow(title, count, total, tone) {
    var pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
    return '<div class="pipeline-row"><div class="pipeline-top"><span>' + esc(title) + '</span><strong>' + esc(count) + '</strong></div><div class="pipeline-bar"><div class="pipeline-fill ' + (tone || "") + '" style="width:' + pct + '%"></div></div></div>';
  }

  function activityItem(event) {
    var tone = event.event_type === "execution_completed" ? "green" : (event.event_type === "execution_failed" || event.event_type === "routing_failed") ? "red" : (event.event_type === "approval_required" || event.event_type === "execution_mock" || event.event_type === "provider_fallback") ? "amber" : "blue";
    return '<div class="activity-item"><div class="activity-icon tone-' + tone + '">' + ICONS.activity + '</div><div class="activity-body"><div class="activity-title">' + esc(event.task_title || "Aktiviti operasi") + '</div><div class="activity-sub">' + esc(String(event.message || label(EVENT_LABELS, event.event_type)).slice(0, 180)) + '</div></div><div class="activity-meta">' + esc(fmtDate(event.created_at)) + '</div></div>';
  }

  function recentTaskRow(task) {
    return '<tr><td><strong>' + esc(task.title) + '</strong><div class="sub">' + esc(task.assigned_agent_name || task.assigned_user_name || "Belum ditugaskan") + '</div></td><td>' + badge(stateOfTask(task), TASK_STATUS) + '</td><td class="hide-sm">' + esc(fmtDate(task.created_at)) + '</td><td><button class="btn btn-sm" type="button" data-action="task-detail" data-id="' + esc(task.id) + '">Lihat</button></td></tr>';
  }

  var loaders = {};

  loaders.dashboard = function () {
    var canLeads = ["admin", "manager", "agent"].indexOf(state.user.role) !== -1;
    var canProspects = ["admin", "manager"].indexOf(state.user.role) !== -1;
    return Promise.all([
      api("/api/dashboard"),
      api("/api/agents").catch(function () { return { agents: [] }; }),
      api("/health").catch(function () { return { checks: {} }; }),
      canLeads ? api("/api/leads?limit=100").catch(function () { return null; }) : Promise.resolve(null),
      canProspects ? api("/api/prospects?status=new").catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (results) {
      var data = results[0];
      var agents = (results[1] && results[1].agents) || [];
      var health = results[2] || {};
      var leads = results[3];
      var prospects = results[4];
      var checks = health.checks || {};
      var aiLive = checks.ai === "live";
      var exaReady = checks.search === "configured";
      var dbOk = checks.database === "ok";
      var firstName = String(state.user.name || "").split(/\s+/)[0] || "SARA";
      var today = new Intl.DateTimeFormat("ms-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
      var canWriteTasks = state.user.role !== "viewer";

      var healthOk = Boolean(checks.database || checks.ai || checks.search);
      var heroStatus = healthOk
        ? [
            statusPill(aiLive ? "DeepSeek LIVE" : "DeepSeek MOCK", aiLive ? "green" : "amber", null),
            statusPill(exaReady ? "Exa READY" : "Exa OFFLINE", exaReady ? "teal" : "amber", null),
            statusPill(checks.backup === "configured" ? "Muse Spark CONFIGURED" : "Muse Spark OFFLINE", checks.backup === "configured" ? "violet" : "amber", null),
            statusPill(dbOk ? "D1 HEALTHY" : "D1 DEGRADED", dbOk ? "green" : "red", null)
          ].join("")
        : statusPill("Status sistem tidak tersedia", "slate", null);
      var systemNote = !healthOk
        ? "Status sistem tidak dapat disahkan buat masa ini. Data operasi di bawah masih dimuatkan daripada D1."
        : aiLive
          ? (exaReady ? "Enjin AI dan carian awam tersedia. Semua data adalah langsung daripada D1." : "Enjin AI tersedia. Exa belum dikonfigurasikan; carian prospek tidak tersedia.")
          : "DeepSeek dalam mod mock. Hasil AI tidak akan ditanda selesai sehingga mod live diaktifkan.";

      var quickActions = '<button class="btn ' + (canWriteTasks ? "btn-primary" : "") + '" type="button" data-action="nav" data-tab="tasks">' + (canWriteTasks ? ICONS.plus : ICONS.tasks) + " " + (canWriteTasks ? "Cipta Tugas" : "Lihat Tugas") + "</button>" +
        '<button class="btn" type="button" data-action="nav" data-tab="agents">' + ICONS.agents + " Ejen AI</button>";
      if (canProspects) {
        quickActions += '<button class="btn" type="button" data-action="nav" data-tab="prospects">' + ICONS.search + " Cari Prospek</button>";
      }
      if (state.user.role !== "viewer") {
        quickActions += '<button class="btn" type="button" data-action="nav" data-tab="approvals">' + ICONS.approvals + " Kelulusan</button>";
      }

      var stats = '<div class="stats">' +
        statCard("Tugas Aktif", data.tasks.active, data.tasks.total + " jumlah tugasan", "tasks", "blue") +
        statCard("Ejen Aktif", data.agents.active, data.agents.total + " ejen berdaftar", "agents", "teal") +
        statCard("Prospek Baharu", data.leads.new, data.leads.total + " prospek dalam CRM", "prospects", "amber") +
        statCard("Kelulusan Menunggu", data.approvals.pending, data.execution.approvalBlocked + " disekat kelulusan", "approvals", "violet") +
        "</div>";

      var providers = data.providers || {};
      var usage = data.usage || {};
      var primaryInfo = providers.primary || {};
      var backupInfo = providers.backup || {};
      var activeName = providers.active === "deepseek" ? "DeepSeek" : providers.active === "meta" ? "Muse Spark" : "Tiada";
      var activeModel = providers.active === "meta" ? (backupInfo.model || "muse-spark-1.3") : (primaryInfo.model || "deepseek-chat");
      var providerCards = [
        providerCard({ name: "DeepSeek", role: "Primary · Penjana utama", tone: "blue", icon: "bolt", status: primaryInfo.mode === "live" ? "LIVE" : "MOCK", statusTone: primaryInfo.mode === "live" ? "green" : "amber", model: primaryInfo.model || "deepseek-chat", tokens: usage.deepseekTokens || 0 }),
        providerCard({ name: "Muse Spark", role: "Backup · Fallback automatik", tone: "violet", icon: "sparkles", status: backupInfo.available ? "CONFIGURED" : "OFFLINE", statusTone: backupInfo.available ? "violet" : "slate", model: backupInfo.model || "muse-spark-1.3", tokens: usage.metaTokens || 0 }),
        providerCard({ name: "Exa", role: "Search · Carian awam", tone: "teal", icon: "search", status: exaReady ? "READY" : "OFFLINE", statusTone: exaReady ? "teal" : "amber", model: "exa" })
      ].join("");
      var providerPanel = '<div class="panel"><div class="panel-head"><h2>' + ICONS.bolt + ' Provider AI</h2><div class="status-strip">' + statusPill("Aktif: " + activeName, providers.active === "deepseek" ? "green" : providers.active === "meta" ? "violet" : "slate", null) + '</div></div><div class="panel-body"><div class="agent-grid compact">' + providerCards + '</div><div class="detail-grid" style="margin-top:16px"><div class="detail-item"><div class="label">Model Aktif</div><div class="value">' + esc(activeModel) + '</div></div><div class="detail-item"><div class="label">Jumlah Token</div><div class="value">' + esc(usage.totalTokens || 0) + '</div></div><div class="detail-item"><div class="label">Fallback</div><div class="value">' + esc(usage.fallbackEvents || 0) + ' event</div></div><div class="detail-item"><div class="label">Ralat Penyedia</div><div class="value">' + esc(usage.providerErrors || 0) + '</div></div></div><div class="panel-sub" style="margin-top:12px">Fallback automatik hanya untuk timeout, ralat rangkaian, HTTP 429 dan HTTP 5xx. Ralat pengesahan tidak dicuba semula.</div></div></div>';

      var agentCards = agents.length
        ? agents.map(agentMiniCard).join("")
        : emptyState("agents", "Belum ada ejen", "Daftarkan ejen AI untuk mula mengagihkan tugasan.");
      var agentsPanel = '<div class="panel"><div class="panel-head"><h2>' + ICONS.agents + ' Ejen AI</h2><button class="btn btn-sm" type="button" data-action="nav" data-tab="agents">Urus Ejen ' + ICONS.arrow + '</button></div><div class="panel-body"><div class="agent-grid compact">' + agentCards + "</div></div></div>";

      var activityRows = data.recentActivity && data.recentActivity.length
        ? data.recentActivity.map(activityItem).join("")
        : emptyState("activity", "Belum ada aktiviti", "Pelaksanaan tugas dan peristiwa operasi akan muncul di sini.");
      var activityPanel = '<div class="panel"><div class="panel-head"><h2>' + ICONS.activity + ' Aktiviti Operasi</h2><span class="panel-sub">' + esc(data.execution.completed) + " selesai · " + esc(data.execution.failed) + " gagal · " + esc(data.execution.mock) + ' mock</span></div><div class="panel-body"><div class="activity-list">' + activityRows + "</div></div></div>";

      var leadCounts = { new: data.leads.new, contacted: 0, qualified: data.leads.qualified, proposal: 0, won: 0, lost: 0, other: Math.max(0, data.leads.total - data.leads.new - data.leads.qualified) };
      var totalLeads = data.leads.total;
      if (leads && Array.isArray(leads.leads)) {
        totalLeads = leads.leads.length;
        leadCounts = { new: 0, contacted: 0, qualified: 0, proposal: 0, won: 0, lost: 0, other: 0 };
        leads.leads.forEach(function (lead) {
          if (leadCounts[lead.status] !== undefined) leadCounts[lead.status] += 1;
          else leadCounts.other += 1;
        });
      }
      var pipeline = leads
        ? pipelineRow("Baru", leadCounts.new, totalLeads, "amber") +
          pipelineRow("Dihubungi", leadCounts.contacted, totalLeads, "blue") +
          pipelineRow("Layak", leadCounts.qualified, totalLeads, "blue") +
          pipelineRow("Cadangan", leadCounts.proposal, totalLeads, "violet") +
          pipelineRow("Berjaya", leadCounts.won, totalLeads, "green") +
          pipelineRow("Gagal", leadCounts.lost, totalLeads, "amber")
        : pipelineRow("Baru", leadCounts.new, totalLeads, "amber") +
          pipelineRow("Layak", leadCounts.qualified, totalLeads, "blue") +
          pipelineRow("Peringkat lain", leadCounts.other, totalLeads, "violet");
      var prospectChips = prospects && Array.isArray(prospects.candidates) && prospects.candidates.length
        ? '<div class="chips">' + prospects.candidates.slice(0, 3).map(function (candidate) {
            return '<span class="chip">' + esc(candidate.company_name) + " · " + esc(candidate.qualification_score) + "</span>";
          }).join("") + "</div>"
        : "";
      var prospectReview = prospects && Array.isArray(prospects.candidates)
        ? '<div class="panel-sub" style="margin-top:14px"><strong>' + prospects.candidates.length + ' prospek</strong> menunggu semakan carian.</div>' + prospectChips +
          (canProspects ? '<div class="card-actions"><button class="btn btn-sm btn-teal" type="button" data-action="nav" data-tab="prospects">' + ICONS.search + " Semak Prospek</button></div>" : "")
        : "";
      var pipelinePanel = '<div class="panel"><div class="panel-head"><h2>' + ICONS.target + ' Prospek &amp; Jualan</h2>' +
        (canLeads ? '<button class="btn btn-sm" type="button" data-action="nav" data-tab="leads">Buka CRM ' + ICONS.arrow + "</button>" : "") +
        '</div><div class="panel-body"><div class="pipeline">' + pipeline + "</div>" + prospectReview + "</div></div>";

      var recentTasks = data.recentTasks && data.recentTasks.length
        ? data.recentTasks.map(recentTaskRow).join("")
        : emptyRow(4, "Belum ada tugasan. Cipta tugasan pertama untuk SARA.");
      var recentPanel = '<div class="panel"><div class="panel-head"><h2>' + ICONS.tasks + ' Tugasan Terkini</h2><button class="btn btn-sm" type="button" data-action="nav" data-tab="tasks">Semua Tugas ' + ICONS.arrow + '</button></div><div class="table-wrap"><table><thead><tr><th>Tugas</th><th>Status</th><th class="hide-sm">Dicipta</th><th></th></tr></thead><tbody>' + recentTasks + "</tbody></table></div></div>";

      var errorRows = data.recentErrors && data.recentErrors.length
        ? data.recentErrors.map(function (task) {
            return '<div class="activity-item"><div class="activity-icon tone-red">' + ICONS.alert + '</div><div class="activity-body"><div class="activity-title">' + esc(task.title) + '</div><div class="activity-sub">' + esc(String(task.last_error || "Ralat tidak dinyatakan").slice(0, 180)) + '</div></div><div class="activity-meta">' + esc(fmtDate(task.last_execution_at)) + "</div></div>";
          }).join("")
        : emptyState("check", "Tiada ralat direkodkan", "Ralat pelaksanaan dan sekatan kelulusan akan dipaparkan di sini.");
      var errorsPanel = '<div class="panel"><div class="panel-head"><h2>' + ICONS.alert + ' Ralat &amp; Sekatan</h2></div><div class="panel-body"><div class="activity-list">' + errorRows + "</div></div></div>";

      $("view").innerHTML =
        '<section class="hero"><div class="hero-content"><div class="hero-main">' +
          '<span class="hero-eyebrow">' + ICONS.sparkles + " Pusat Kawalan AI · " + esc(today) + "</span>" +
          "<h2>Selamat kembali, " + esc(firstName) + ".</h2>" +
          "<p>Pantau ejen, tugasan, prospek dan kelulusan dalam satu ruang kerja. Gunakan tindakan pantas di bawah untuk memulakan operasi.</p>" +
          '<div class="quick-actions">' + quickActions + "</div>" +
        '</div><div class="hero-status"><div class="hero-status-title">Status Sistem</div><div class="status-strip">' + heroStatus + '</div><div class="hero-note">' + esc(systemNote) + "</div></div></div></section>" +
        stats +
        providerPanel +
        agentsPanel +
        '<div class="grid-2">' + activityPanel + pipelinePanel + "</div>" +
        '<div class="grid-2">' + recentPanel + errorsPanel + "</div>";
    });
  };

  loaders.tasks = function () {
    var taskUrl = "/api/tasks?limit=100" + (state.taskAgentFilter ? "&agentId=" + encodeURIComponent(state.taskAgentFilter) : "");
    return Promise.all([api(taskUrl), api("/api/agents")]).then(function (results) {
      state.tasks = results[0].tasks || [];
      state.agents = results[1].agents || [];

      var agentOptions = '<option value="">Auto-arah melalui SARA</option>' + state.agents.map(function (agent) {
        return '<option value="' + esc(agent.id) + '">' + esc(agent.name) + "</option>";
      }).join("");

      var rows = state.tasks.map(function (task) {
        var meta = {};
        try { meta = JSON.parse(task.metadata || "{}"); } catch (ignore) { meta = {}; }
        var currentState = stateOfTask(task);
        var needsApproval = meta.requiresApproval === true;
        var approvalCell = task.approval_status
          ? badge(task.approval_status, APPROVAL_STATUS)
          : (needsApproval ? '<span class="badge amber"><span class="dot"></span>Belum dimohon</span>' : '<span class="muted">—</span>');
        var resultCell = task.last_error
          ? '<span class="badge ' + (currentState === "failed" ? "red" : "amber") + '"><span class="dot"></span>' + (currentState === "failed" ? "Gagal" : "Sekatan") + '</span><div class="result-preview error">' + esc(String(task.last_error).slice(0, 180)) + "</div>"
          : (task.result
              ? '<div class="result-preview">' + esc(String(task.result).slice(0, 200)) + (String(task.result).length > 200 ? "…" : "") + "</div>"
              : '<span class="muted">—</span>');
        var execBadge = task.execution_mode
          ? ' <span class="badge ' + (task.execution_mode === "live" ? "green" : "amber") + '"><span class="dot"></span>' + esc(task.execution_mode) + "</span>"
          : "";
        var disabled = currentState === "running" || currentState === "cancelled";
        var actions = '<button class="btn btn-sm" type="button" data-action="task-detail" data-id="' + esc(task.id) + '">' + ICONS.search + " Lihat</button>" +
          '<button class="btn btn-sm btn-primary" type="button" data-action="execute-task" data-id="' + esc(task.id) + '"' + (disabled ? " disabled" : "") + ">" + ICONS.play + " Jalankan</button>";
        if (!task.assigned_agent_id && !disabled) {
          actions += '<button class="btn btn-sm" type="button" data-action="auto-assign" data-id="' + esc(task.id) + '">' + ICONS.sparkles + " Auto-arah</button>";
        }
        if (needsApproval && task.approval_status !== "approved") {
          actions += '<button class="btn btn-sm" type="button" data-action="request-approval" data-id="' + esc(task.id) + '">' + ICONS.approvals + " Mohon</button>";
        }
        actions += '<button class="btn btn-sm" type="button" data-action="task-edit" data-id="' + esc(task.id) + '">' + ICONS.tasks + " Kemas Kini</button>";
        return "<tr><td><strong>" + esc(task.title) + '</strong><div class="sub">' + esc(task.description || "Tiada keterangan") + (meta.capability ? " · " + esc(meta.capability) : "") + (meta.tool ? " · alat: " + esc(meta.tool) : "") + "</div></td><td>" + badge(currentState, TASK_STATUS) + execBadge + "</td><td>" + priorityBadge(task.priority) + "</td><td>" + esc(task.assigned_agent_name || task.assigned_user_name || "SARA (auto)") + "</td><td>" + resultCell + '</td><td class="hide-sm">' + approvalCell + '</td><td><div class="table-actions">' + actions + "</div></td></tr>";
      }).join("");

      var filterBar = state.taskAgentFilter
        ? '<div class="toolbar"><span class="badge teal"><span class="dot"></span>Ejen: ' + esc(state.taskAgentName || "Dipilih") + '</span><button class="btn btn-sm" type="button" data-action="clear-task-filter">' + ICONS.refresh + " Kosongkan tapisan</button></div>"
        : "";

      var taskBody = state.tasks.length
        ? '<div class="table-wrap"><table><thead><tr><th>Tugas</th><th>Status</th><th>Keutamaan</th><th>Ejen</th><th>Hasil</th><th class="hide-sm">Kelulusan</th><th>Tindakan</th></tr></thead><tbody>' + rows + "</tbody></table></div>"
        : emptyState("tasks", state.taskAgentFilter ? "Tiada tugasan untuk ejen ini" : "Belum ada tugasan", state.taskAgentFilter ? "Kosongkan tapisan atau cipta tugasan baharu untuk ejen ini." : "Cipta tugasan pertama dan biarkan SARA memilih ejen yang paling sesuai.", state.taskAgentFilter ? '<button class="btn" type="button" data-action="clear-task-filter">' + ICONS.refresh + " Kosongkan tapisan</button>" : '<button class="btn btn-primary" type="button" data-action="open-task-form">' + ICONS.plus + " Cipta Tugasan</button>");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Pengurusan Tugas</h2><p>Cipta, tugaskan, jalankan dan semak hasil kerja pasukan AI. Semua pelaksanaan direkodkan.</p></div><button class="btn btn-primary" type="button" data-action="open-task-form">' + ICONS.plus + " Cipta Tugasan</button></div>" +
        filterBar +
        '<details class="panel" id="task-form-panel"><summary>Cipta tugasan baharu</summary><div class="panel-body"><form id="task-form">' +
          '<div class="form-section-title">Butiran asas</div>' +
          '<div class="form-grid">' +
            '<label class="wide">Tajuk<input name="title" type="text" maxlength="200" required placeholder="Contoh: Sediakan laporan mingguan"></label>' +
            '<label class="wide">Keterangan<textarea name="description" maxlength="5000" placeholder="Skop, hasil dijangka dan konteks yang berguna untuk ejen"></textarea></label>' +
            '<label>Keutamaan<select name="priority">' + optionList(PRIORITY, "normal") + "</select></label>" +
            '<label>Tarikh akhir<input name="dueAt" type="date"></label>' +
          '</div>' +
          '<div class="form-section"><div class="form-section-title">Penugasan &amp; pelaksanaan</div><div class="form-grid">' +
            '<label>Ejen<select name="assignedAgentId">' + agentOptions + '</select><span class="form-hint">Biarkan kosong untuk auto-arah melalui SARA.</span></label>' +
            '<label>Keupayaan<input name="capability" type="text" maxlength="80" placeholder="contoh: financial_operations"><span class="form-hint">Membantu SARA memilih ejen yang tepat.</span></label>' +
            '<label>Alat dalaman<select name="tool">' + optionList(TOOL_OPTIONS, "") + '</select><span class="form-hint">Alat luaran memerlukan kelulusan dan tidak dijalankan automatik.</span></label>' +
            '<label class="check"><input name="requiresApproval" type="checkbox"> Perlukan kelulusan manusia</label>' +
          '</div></div>' +
        '<div class="form-actions"><button class="btn btn-primary" type="submit">' + ICONS.plus + " Cipta Tugasan</button></div></form></div></details>" +
        '<div class="panel"><div class="panel-head"><h2>' + ICONS.tasks + ' Senarai Tugas</h2><span class="badge slate"><span class="dot"></span>' + state.tasks.length + " tugasan</span></div>" + taskBody + "</div>";
    });
  };

  loaders.agents = function () {
    return api("/api/agents").then(function (data) {
      state.agents = data.agents || [];
      var cards = state.agents.length
        ? state.agents.map(function (agent) {
            var meta = agentMeta(agent);
            var capabilities = [];
            try { capabilities = JSON.parse(agent.capabilities || "[]"); } catch (ignore) { capabilities = []; }
            var config = {};
            try { config = JSON.parse(agent.config || "{}"); } catch (ignore) { config = {}; }
            var chips = capabilities.length
              ? capabilities.slice(0, 5).map(function (item) { return '<span class="chip">' + esc(item) + "</span>"; }).join("") + (capabilities.length > 5 ? '<span class="chip">+' + (capabilities.length - 5) + "</span>" : "")
              : '<span class="chip">Tiada keupayaan dinyatakan</span>';
            var next = agent.status === "active" ? "paused" : "active";
            var approvalBadge = config.requiresApproval ? ' <span class="badge amber"><span class="dot"></span>Perlu kelulusan</span>' : "";
            return '<div class="agent-card"><div class="agent-top">' +
              '<div class="agent-avatar tone-' + meta.tone + '">' + meta.icon + "</div>" +
              '<div class="agent-name-wrap"><h3>' + esc(agent.name) + '</h3><div class="agent-role">' + esc(meta.role) + "</div></div>" +
              '<div class="agent-status">' + badge(agent.status, AGENT_STATUS) + "</div></div>" +
              '<p class="agent-desc">' + esc(agent.description || "Tiada keterangan.") + "</p>" +
              '<div class="chips">' + chips + approvalBadge + "</div>" +
              '<div class="agent-meta"><span><strong>' + esc(agent.active_tasks || 0) + "</strong> tugas aktif</span><span>Model <strong>" + esc(config.model || "deepseek-chat") + "</strong></span><span>Jenis <strong>" + esc(agent.kind || "general") + "</strong></span></div>" +
              '<div class="card-actions"><button class="btn btn-sm" type="button" data-action="agent-tasks" data-id="' + esc(agent.id) + '">' + ICONS.tasks + " Lihat Tugas</button>" +
              '<button class="btn btn-sm" type="button" data-action="agent-status" data-id="' + esc(agent.id) + '" data-status="' + esc(next) + '">' + (next === "paused" ? "Jeda" : "Aktifkan") + "</button></div></div>";
          }).join("")
        : emptyState("agents", "Belum ada ejen berdaftar", "Gunakan borang di atas untuk mendaftarkan ejen AI pertama.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Ejen AI</h2><p>Kenali setiap ejen, keupayaan dan status operasi. Gunakan “Lihat Tugas” untuk menapis tugasan mengikut ejen.</p></div><span class="badge blue"><span class="dot"></span>' + state.agents.length + " ejen</span></div>" +
        '<details class="panel"><summary>Daftar ejen baharu</summary><div class="panel-body"><form id="agent-form"><div class="form-grid">' +
          '<label>Nama<input name="name" type="text" maxlength="120" required placeholder="Contoh: Ejen Penyelidikan"></label>' +
          '<label>Jenis<input name="kind" type="text" maxlength="60" placeholder="research / operations"></label>' +
          '<label class="wide">Keterangan<textarea name="description" maxlength="2000" placeholder="Peranan dan skop ejen"></textarea></label>' +
          '<label class="wide">Keupayaan (pisahkan dengan koma)<input name="capabilities" type="text" placeholder="penyelidikan, penulisan, analisis"><span class="form-hint">Keupayaan membantu SARA memilih ejen yang sesuai.</span></label>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">' + ICONS.plus + " Daftar Ejen</button></div></form></div></details>" +
        '<div class="agent-grid">' + cards + "</div>";
    });
  };

  loaders.prospects = function () {
    return Promise.all([api("/api/prospects/status"), api("/api/prospects?status=new")]).then(function (results) {
      var status = results[0];
      var candidates = results[1].candidates || [];
      state.prospects = candidates;

      var warnings = "";
      if (!status.search.available) {
        warnings += '<div class="login-note">Carian web tidak tersedia. <strong>EXA_API_KEY</strong> belum dikonfigurasikan. Sistem tidak akan menjana hasil carian palsu.</div>';
      }
      if (!status.ai.liveDrafts) {
        warnings += '<div class="login-note">Draf outreach memerlukan DeepSeek Live. Draf tidak akan dijana dalam mod mock.</div>';
      }

      var statusStrip = [
        statusPill(status.search.available ? "Exa READY" : "Exa OFFLINE", status.search.available ? "teal" : "amber", null),
        statusPill(status.ai.liveDrafts ? "DeepSeek LIVE" : "DeepSeek MOCK", status.ai.liveDrafts ? "green" : "amber", null)
      ].join("");

      var cards = candidates.length
        ? candidates.map(function (candidate) {
            var score = Number(candidate.qualification_score || 0);
            var scoreTone = score >= 60 ? "green" : score >= 35 ? "amber" : "slate";
            var ringColor = score >= 60 ? "#0d9488" : score >= 35 ? "#d97706" : "#94a3b8";
            var analysisBadge = candidate.analysis_mode === "deepseek"
              ? '<span class="badge blue"><span class="dot"></span>Analisis DeepSeek</span>'
              : candidate.analysis_mode === "meta"
                ? '<span class="badge violet"><span class="dot"></span>Analisis Muse Spark</span>'
                : '<span class="badge slate"><span class="dot"></span>Skor peraturan</span>';
            var missing = (candidate.missingInfo || []).map(function (item) {
              return '<span class="chip">' + esc(item) + "</span>";
            }).join("");
            var evidence = (candidate.evidence || []).map(function (item) {
              var link = item && item.url ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.title || item.url) + "</a>" : "";
              return '<div class="evidence-item">' + link + (item && item.publishedDate ? " · " + esc(item.publishedDate) : "") + (item && item.snippet ? '<div class="sub">' + esc(String(item.snippet).slice(0, 180)) + "</div>" : "") + "</div>";
            }).join("");
            var contacts = [];
            if (candidate.email) contacts.push('<span class="chip">' + esc(candidate.email) + "</span>");
            if (candidate.phone) contacts.push('<span class="chip">' + esc(candidate.phone) + "</span>");
            var website = candidate.website
              ? '<a href="' + esc(candidate.website) + '" target="_blank" rel="noopener noreferrer">' + esc(candidate.website) + "</a>"
              : '<span class="muted">Laman web tidak ditemui</span>';
            var source = candidate.source_url
              ? '<a href="' + esc(candidate.source_url) + '" target="_blank" rel="noopener noreferrer">' + ICONS.external + " Sumber awam</a>"
              : "";
            var hasDraft = Boolean(candidate.draft_whatsapp || candidate.draft_email_body || candidate.draft_proposal);
            var draftButton = status.ai.liveDrafts
              ? '<button class="btn btn-sm" type="button" data-action="prospect-draft" data-id="' + esc(candidate.id) + '">' + ICONS.sparkles + " " + (hasDraft ? "Jana Semula" : "Jana Draf") + "</button>"
              : "";
            var viewDraft = hasDraft
              ? '<button class="btn btn-sm" type="button" data-action="prospect-view-draft" data-id="' + esc(candidate.id) + '">Lihat Draf</button>'
              : "";
            return '<article class="prospect-card"><div class="prospect-top"><div class="prospect-title"><h3>' + esc(candidate.company_name) + '</h3><div class="chips" style="margin-top:7px">' + (candidate.verified ? '<span class="badge green"><span class="dot"></span>Disahkan sumber</span>' : '<span class="badge amber"><span class="dot"></span>Belum disahkan</span>') + " " + analysisBadge + "</div></div>" +
              '<div class="score-ring" style="background:conic-gradient(' + ringColor + " " + score + "%, #e5e7eb " + score + '%)"><span style="color:' + ringColor + '">' + esc(score) + "</span></div></div>" +
              '<div class="prospect-links">' + website + " · " + (source || '<span class="muted">Sumber tidak tersedia</span>') + "</div>" +
              '<p class="prospect-summary">' + esc(candidate.summary || "Tiada ringkasan awam tersedia.") + "</p>" +
              '<div class="chips">' + (contacts.length ? contacts.join("") : '<span class="chip">Tiada hubungan awam ditemui</span>') + "</div>" +
              (candidate.ai_analysis ? '<div class="sub" style="margin-top:4px"><strong>Analisis AI:</strong> ' + esc(candidate.ai_analysis) + "</div>" : "") +
              (missing ? '<div class="sub" style="margin-top:4px">Maklumat hilang: ' + missing + "</div>" : "") +
              '<div class="evidence-list"><div class="form-section-title" style="margin-bottom:0">Bukti sumber</div>' + (evidence || '<div class="evidence-item">Tiada bukti tambahan.</div>') + "</div>" +
              '<div class="card-actions prospect-actions">' + draftButton + viewDraft + '<button class="btn btn-sm btn-primary" type="button" data-action="prospect-import" data-id="' + esc(candidate.id) + '">' + ICONS.check + ' Import ke CRM</button><button class="btn btn-sm btn-danger" type="button" data-action="prospect-reject" data-id="' + esc(candidate.id) + '">Tolak</button></div></article>';
          }).join("")
        : emptyState("search", "Tiada prospek menunggu semakan", "Jalankan carian baharu di atas. Hasil akan disimpan sebagai calon untuk semakan pentadbir sebelum diimport ke CRM.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Cari Prospek</h2><p>Cari perniagaan awam, semak bukti dan import hanya prospek yang disahkan ke CRM. Tiada hasil palsu dijana.</p></div><div class="status-strip">' + statusStrip + "</div></div>" +
        warnings +
        '<section class="search-hero"><div class="search-hero-head"><div><h2>' + ICONS.search + ' Carian prospek baharu</h2><p>Terangkan perkhidmatan, lokasi dan jenis pelanggan. Exa akan mencari sumber awam; DeepSeek akan menilai kelayakan berdasarkan bukti.</p></div><button class="btn btn-sm" type="button" data-action="nav" data-tab="leads">' + ICONS.leads + ' Buka CRM</button></div>' +
        '<form id="prospect-search-form"><div class="form-grid">' +
          '<label>Perkhidmatan<input name="service" type="text" maxlength="120" required placeholder="contoh: Waterproofing"></label>' +
          '<label>Lokasi<input name="location" type="text" maxlength="120" required placeholder="contoh: Selangor dan Kuala Lumpur"></label>' +
          '<label class="wide">Kategori pelanggan<input name="customerType" type="text" maxlength="120" required placeholder="contoh: pemilik bangunan, pengurusan hartanah dan kontraktor penyelenggaraan"></label>' +
          '<label>Had hasil<select name="limit">' + optionList({ "3": "3 hasil", "5": "5 hasil" }, "3") + '</select><span class="form-hint">Maksimum 5 hasil untuk kawalan kos API.</span></label>' +
        '</div><div class="form-actions"><button class="btn btn-teal" type="submit"' + (status.search.available ? "" : " disabled") + ">" + ICONS.search + " Cari Prospek</button></div></form></section>" +
        '<div class="panel"><div class="panel-head"><h2>' + ICONS.inbox + ' Menunggu Semakan</h2><span class="badge slate"><span class="dot"></span>' + candidates.length + ' prospek</span></div><div class="panel-body"><div class="prospect-grid">' + cards + "</div></div></div>";
    });
  };

  loaders.leads = function () {
    return Promise.all([api("/api/leads"), api("/api/lead-sources")]).then(function (results) {
      state.leads = results[0].leads || [];
      state.sources = results[1].sources || [];

      var sourceOptions = state.sources.map(function (source) {
        return '<option value="' + esc(source.id) + '">' + esc(source.name) + "</option>";
      }).join("");

      var rows = state.leads.map(function (lead) {
        var website = lead.website
          ? '<a href="' + esc(lead.website) + '" target="_blank" rel="noopener noreferrer">' + esc(lead.website) + "</a>"
          : "";
        var source = lead.source_url
          ? '<a href="' + esc(lead.source_url) + '" target="_blank" rel="noopener noreferrer">' + esc(lead.source_name || "Sumber") + "</a>"
          : esc(lead.source_name || "—");
        var score = Number(lead.qualification_score || 0);
        var scoreBadge = score > 0 ? '<span class="badge ' + (score >= 60 ? "green" : score >= 35 ? "amber" : "slate") + '"><span class="dot"></span>Skor ' + score + "</span>" : '<span class="muted">—</span>';
        return "<tr><td><strong>" + esc(lead.company_name) + '</strong><div class="sub">' + esc(lead.contact_name || "Tiada nama hubungan") + (website ? " · " + website : "") + "</div></td><td>" + badge(lead.status, LEAD_STATUS) + "</td><td>" + scoreBadge + "</td><td>" + source + '</td><td class="hide-sm">' + esc(fmtDate(lead.follow_up_at)) + '</td><td class="hide-sm">' + (lead.do_not_contact ? '<span class="badge red"><span class="dot"></span>Jangan hubungi</span>' : esc(label(CONSENT, lead.consent_status))) + '</td><td><div class="table-actions"><button class="btn btn-sm" type="button" data-action="lead-edit" data-id="' + esc(lead.id) + '">' + ICONS.tasks + " Kemas Kini</button></div></td></tr>";
      }).join("");

      var leadBody = state.leads.length
        ? '<div class="table-wrap"><table><thead><tr><th>Syarikat</th><th>Status</th><th>Skor</th><th>Sumber</th><th class="hide-sm">Susulan</th><th class="hide-sm">Persetujuan</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>"
        : emptyState("leads", "Belum ada prospek dalam CRM", "Tambah prospek secara manual atau import prospek yang telah disemak melalui Cari Prospek.");

      $("view").innerHTML =
        '<div class="page-head"><div><h2>Prospek Pelanggan</h2><p>Rekod dan urus prospek dalam CRM. Tiada mesej pemasaran dihantar secara automatik.</p></div><span class="badge blue"><span class="dot"></span>' + state.leads.length + ' prospek</span></div>' +
        '<details class="panel"><summary>Tambah prospek secara manual</summary><div class="panel-body"><form id="lead-form"><div class="form-grid">' +
          '<label>Syarikat<input name="companyName" type="text" maxlength="200" required></label>' +
          '<label>Nama hubungan<input name="contactName" type="text" maxlength="120"></label>' +
          '<label>E-mel<input name="email" type="email" maxlength="254"></label>' +
          '<label>Telefon<input name="phone" type="text" maxlength="40"></label>' +
          '<label>Laman web<input name="website" type="url" maxlength="300"></label>' +
          '<label>Tarikh susulan<input name="followUpAt" type="date"></label>' +
          '<label>Sumber<select name="sourceId">' + sourceOptions + "</select></label>" +
          '<label>Status<select name="status">' + optionList(LEAD_STATUS, "new") + "</select></label>" +
          '<label>Persetujuan<select name="consentStatus">' + optionList(CONSENT, "unknown") + "</select></label>" +
          '<label class="check"><input name="doNotContact" type="checkbox"> Jangan hubungi</label>' +
          '<label class="wide">Nota<textarea name="notes" maxlength="5000" placeholder="Konteks perbualan atau keperluan prospek"></textarea></label>' +
        '</div><div class="form-actions"><button class="btn btn-primary" type="submit">' + ICONS.plus + " Tambah Prospek</button></div></form></div></details>" +
        '<div class="panel"><div class="panel-head"><h2>' + ICONS.leads + " Senarai Prospek</h2></div>" + leadBody + "</div>";
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
              actions = '<div class="card-actions"><button class="btn btn-sm btn-success" type="button" data-action="decide" data-id="' + esc(item.id) + '" data-decision="approved">' + ICONS.check + ' Luluskan</button><button class="btn btn-sm btn-danger" type="button" data-action="decide" data-id="' + esc(item.id) + '" data-decision="rejected">' + ICONS.alert + ' Tolak</button></div>';
            }
            return '<div class="card"><h3>' + esc(item.title) + '</h3><div class="meta">' + esc(label(ENTITY, item.entity_type)) + " · " + badge(item.status, APPROVAL_STATUS) + '</div><p class="small" style="margin:10px 0 0">' + esc(item.description || "Tiada keterangan.") + '</p><div class="meta" style="margin-top:10px">Dipohon oleh ' + esc(item.requested_by_name || "—") + " · " + esc(fmtDate(item.created_at)) + "</div>" + (item.decision_note ? '<div class="meta" style="margin-top:8px">Catatan: ' + esc(item.decision_note) + "</div>" : "") + actions + "</div>";
          }).join("")
        : '<div class="empty">Tiada permohonan kelulusan.</div>';

      $("view").innerHTML =
        '<div class="page-head"><div><h2>' + ICONS.approvals + ' Aliran Kelulusan</h2><p>Mohon dan keputuskan kelulusan untuk tugasan, prospek atau kempen.</p></div></div>' +
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
        '<div class="page-head"><div><h2>' + ICONS.users + ' Pengguna &amp; Peranan</h2><p>Urus akses pasukan. Kata laluan disimpan sebagai hash PBKDF2.</p></div></div>' +
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
        '<div class="page-head"><div><h2>' + ICONS.audit + ' Log Audit</h2><p>Jejak tindakan pentadbir dan operasi terkini.</p></div></div>' +
        '<div class="panel"><div class="table-wrap"><table><thead><tr><th>Tindakan</th><th>Aktor</th><th>Masa</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
    });
  };

  function showDraft(draft) {
    $("draft-analysis").value = draft.analysis || "";
    $("draft-whatsapp").value = draft.whatsapp || "";
    $("draft-email-subject").value = draft.emailSubject || draft.email_subject || "";
    $("draft-email-body").value = draft.emailBody || draft.email_body || "";
    $("draft-proposal").value = draft.proposal || "";
    $("draft-dialog").showModal();
  }

  function openTaskDetail(id) {
    api("/api/tasks/" + encodeURIComponent(id)).then(function (data) {
      var task = data.task;
      var events = data.events || [];
      var meta = {};
      try { meta = JSON.parse(task.metadata || "{}"); } catch (ignore) { meta = {}; }
      var current = stateOfTask(task);
      $("task-detail-title").textContent = task.title || "Butiran Tugas";
      $("task-detail-sub").textContent = "Dicipta " + fmtDate(task.created_at) + " · Dikemas kini " + fmtDate(task.updated_at);
      var detailItems = [
        ["Status", badge(current, TASK_STATUS)],
        ["Keutamaan", priorityBadge(task.priority)],
        ["Ejen", esc(task.assigned_agent_name || task.assigned_user_name || "SARA (auto)")],
        ["Keupayaan", esc(meta.capability || "—")],
        ["Alat", esc(meta.tool || "—")],
        ["Pelaksanaan", esc(task.execution_mode || "—") + " · " + esc(task.execution_count || 0) + " kali"],
        ["Penyedia", task.provider ? esc(task.provider === "meta" ? "Muse Spark" : "DeepSeek") + (task.provider_model ? " · " + esc(task.provider_model) : "") : "—"],
        ["Fallback", task.fallback_used ? "Ya · " + esc(task.fallback_reason || "sementara") : "Tidak"],
        ["Terakhir", esc(fmtDate(task.last_execution_at))],
        ["Kelulusan", task.approval_status ? badge(task.approval_status, APPROVAL_STATUS) : (meta.requiresApproval ? '<span class="badge amber"><span class="dot"></span>Belum dimohon</span>' : "—")]
      ];
      var detailGrid = detailItems.map(function (item) {
        return '<div class="detail-item"><div class="label">' + esc(item[0]) + '</div><div class="value">' + item[1] + "</div></div>";
      }).join("");
      var description = task.description
        ? '<div class="form-section-title">Keterangan</div><p class="small" style="white-space:pre-wrap;color:var(--muted)">' + esc(task.description) + "</p>"
        : "";
      var resultHtml = task.result
        ? '<div class="form-section-title" style="margin-top:18px">Hasil AI</div><div class="result-box">' + esc(task.result) + "</div>"
        : "";
      var errorHtml = task.last_error
        ? '<div class="form-section-title" style="margin-top:18px">Ralat / sekatan</div><div class="error-box">' + esc(task.last_error) + "</div>"
        : "";
      var timeline = events.length
        ? events.map(function (event) {
            var tone = event.event_type === "execution_completed" ? "green" : (event.event_type === "execution_failed" || event.event_type === "routing_failed") ? "red" : (event.event_type === "approval_required" || event.event_type === "execution_mock" || event.event_type === "provider_fallback") ? "amber" : "blue";
            return '<div class="timeline-item"><span class="timeline-dot ' + tone + '"></span><div class="timeline-body"><div class="timeline-head"><strong>' + esc(label(EVENT_LABELS, event.event_type)) + "</strong><span>" + esc(fmtDate(event.created_at)) + '</span></div><div class="sub">' + esc(event.message || "") + '</div><div class="sub">' + esc(event.actor_name || "Sistem") + "</div></div></div>";
          }).join("")
        : emptyState("activity", "Belum ada peristiwa", "Peristiwa pelaksanaan akan muncul di sini.");
      $("task-detail-body").innerHTML = description + '<div class="detail-grid">' + detailGrid + "</div>" + resultHtml + errorHtml + '<div class="form-section-title" style="margin-top:18px">Garis Masa</div><div class="timeline">' + timeline + "</div>";
      $("task-detail-dialog").showModal();
    }).catch(function (error) { toast(error.message, true); });
  }

  function openTaskDialog(id) {
    var task = state.tasks.filter(function (item) { return item.id === id; })[0];
    if (!task) return;
    var form = $("task-edit-form");
    form.elements.id.value = task.id;
    form.elements.title.value = task.title;
    form.elements.description.value = task.description || "";
    var meta = {};
    try { meta = JSON.parse(task.metadata || "{}"); } catch (ignore) { meta = {}; }
    form.elements.state.innerHTML = stateOptions(stateOfTask(task));
    form.elements.priority.innerHTML = optionList(PRIORITY, task.priority);
    form.elements.assignedAgentId.innerHTML = '<option value="">Auto-arah melalui SARA</option>' + state.agents.map(function (agent) {
      return '<option value="' + esc(agent.id) + '"' + (agent.id === task.assigned_agent_id ? " selected" : "") + ">" + esc(agent.name) + "</option>";
    }).join("");
    form.elements.capability.value = meta.capability || "";
    form.elements.tool.innerHTML = optionList(TOOL_OPTIONS, meta.tool || "");
    form.elements.requiresApproval.checked = meta.requiresApproval === true;
    var lastResult = task.last_error ? "RALAT: " + task.last_error : (task.result || "");
    form.elements.lastResult.value = lastResult;
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
    form.elements.website.value = lead.website || "";
    form.elements.followUpAt.value = lead.follow_up_at ? String(lead.follow_up_at).slice(0, 10) : "";
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
          capability: taskData.get("capability"),
          tool: taskData.get("tool") || null,
          requiresApproval: taskData.get("requiresApproval") === "on",
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
          state: taskEdit.get("state"),
          priority: taskEdit.get("priority"),
          assignedAgentId: taskEdit.get("assignedAgentId") || null,
          capability: taskEdit.get("capability"),
          tool: taskEdit.get("tool") || "",
          requiresApproval: taskEdit.get("requiresApproval") === "on"
        }
      }).then(function () {
        $("task-dialog").close();
        toast("Tugasan dikemas kini.");
        switchTab("tasks");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (form.id === "prospect-search-form") {
      event.preventDefault();
      var prospectData = new FormData(form);
      var searchButton = form.querySelector('button[type="submit"]');
      if (searchButton) {
        searchButton.disabled = true;
        searchButton.textContent = "Mencari…";
      }
      api("/api/prospects/research", {
        method: "POST",
        body: {
          service: prospectData.get("service"),
          location: prospectData.get("location"),
          customerType: prospectData.get("customerType"),
          limit: Number(prospectData.get("limit") || 5)
        }
      }).then(function (data) {
        toast((data.candidates ? data.candidates.length : 0) + " prospek ditemui. Sila semak sebelum import.");
        switchTab("prospects");
      }).catch(function (error) {
        toast(error.message, true);
        switchTab("prospects");
      });
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
          website: leadData.get("website"),
          followUpAt: leadData.get("followUpAt") || null,
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
          website: leadEdit.get("website"),
          followUpAt: leadEdit.get("followUpAt") || null,
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
      var navTab = target.getAttribute("data-tab");
      if (navTab === "tasks") {
        state.taskAgentFilter = null;
        state.taskAgentName = "";
      }
      switchTab(navTab);
      return;
    }

    if (action === "toggle-nav") {
      document.body.classList.toggle("nav-open");
      return;
    }

    if (action === "close-nav") {
      document.body.classList.remove("nav-open");
      return;
    }

    if (action === "task-detail") {
      openTaskDetail(target.getAttribute("data-id"));
      return;
    }

    if (action === "open-task-form") {
      var formPanel = $("task-form-panel");
      if (formPanel) {
        formPanel.open = true;
        formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(function () {
          var titleInput = formPanel.querySelector('[name="title"]');
          if (titleInput) titleInput.focus();
        }, 260);
      }
      return;
    }

    if (action === "agent-tasks") {
      var filterAgentId = target.getAttribute("data-id");
      var filterAgent = state.agents.filter(function (agent) { return agent.id === filterAgentId; })[0];
      state.taskAgentFilter = filterAgentId;
      state.taskAgentName = filterAgent ? filterAgent.name : "Ejen";
      switchTab("tasks");
      return;
    }

    if (action === "clear-task-filter") {
      state.taskAgentFilter = null;
      state.taskAgentName = "";
      switchTab("tasks");
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

    if (action === "auto-assign") {
      var autoId = target.getAttribute("data-id");
      target.disabled = true;
      api("/api/tasks/" + encodeURIComponent(autoId) + "/auto-assign", { method: "POST", body: {} })
        .then(function (data) {
          toast("SARA memilih " + (data.agent ? data.agent.name : "ejen") + ".");
          switchTab("tasks");
        })
        .catch(function (error) {
          toast(error.message, true);
          switchTab("tasks");
        });
      return;
    }

    if (action === "execute-task") {
      var executeId = target.getAttribute("data-id");
      target.disabled = true;
      target.textContent = "Menjalankan…";
      api("/api/tasks/" + encodeURIComponent(executeId) + "/execute", { method: "POST", body: {} })
        .then(function (data) {
          if (data.execution && data.execution.live) {
            toast("Pelaksanaan AI selesai.");
          } else {
            toast("Mod mock: tiada panggilan AI sebenar. Hasil disimpan sebagai draf dan tugas ditanda terhalang.");
          }
          switchTab("tasks");
        })
        .catch(function (error) {
          toast(error.message, true);
          switchTab("tasks");
        });
      return;
    }

    if (action === "prospect-view-draft") {
      var draftCandidate = state.prospects.filter(function (item) { return item.id === target.getAttribute("data-id"); })[0];
      if (!draftCandidate) return;
      showDraft({
        analysis: draftCandidate.draft_analysis,
        whatsapp: draftCandidate.draft_whatsapp,
        emailSubject: draftCandidate.draft_email_subject,
        emailBody: draftCandidate.draft_email_body,
        proposal: draftCandidate.draft_proposal
      });
      return;
    }

    if (action === "prospect-draft") {
      target.disabled = true;
      target.textContent = "Menjana…";
      api("/api/prospects/" + encodeURIComponent(target.getAttribute("data-id")) + "/draft", {
        method: "POST",
        body: {}
      }).then(function (data) {
        showDraft(data.draft);
        toast("Draf dijana untuk semakan. Tiada mesej dihantar.");
        loaders.prospects();
      }).catch(function (error) {
        toast(error.message, true);
        target.disabled = false;
        target.textContent = "Jana Draf";
      });
      return;
    }

    if (action === "prospect-import") {
      target.disabled = true;
      api("/api/prospects/" + encodeURIComponent(target.getAttribute("data-id")) + "/import", {
        method: "POST",
        body: {}
      }).then(function () {
        toast("Prospek diimport ke CRM.");
        switchTab("prospects");
      }).catch(function (error) {
        toast(error.message, true);
        target.disabled = false;
      });
      return;
    }

    if (action === "prospect-reject") {
      if (!window.confirm("Tolak prospek ini? Tiada mesej akan dihantar.")) return;
      api("/api/prospects/" + encodeURIComponent(target.getAttribute("data-id")) + "/reject", {
        method: "POST",
        body: {}
      }).then(function () {
        toast("Prospek ditolak.");
        switchTab("prospects");
      }).catch(function (error) { toast(error.message, true); });
      return;
    }

    if (action === "request-approval") {
      var approvalTaskId = target.getAttribute("data-id");
      var approvalTask = state.tasks.filter(function (item) { return item.id === approvalTaskId; })[0];
      if (!approvalTask) return;
      api("/api/approvals", {
        method: "POST",
        body: {
          entityType: "task",
          entityId: approvalTask.id,
          title: ("Kelulusan pelaksanaan: " + approvalTask.title).slice(0, 200),
          description: approvalTask.description || "Permohonan kelulusan untuk pelaksanaan tugas."
        }
      }).then(function () {
        toast("Permohonan kelulusan dihantar.");
        switchTab("approvals");
      }).catch(function (error) { toast(error.message, true); });
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
