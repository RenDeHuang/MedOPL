export function createPortalLayout({ safeJsonForHtml, userTheme }) {
  function layoutV2(title, body, user, options = {}) {
    const page = options.page || "default";
    const bootstrap = safeJsonForHtml(options.bootstrap || {});
    const theme = userTheme(user);
    const isAdminPage = page.startsWith("admin");
    const navItems = user ? [
      { href: "/portal", label: "首页", active: page === "overview" },
      { href: "/portal/opl", label: "OPL 工作台", active: page === "default" || page === "workspace" },
      { href: "/portal/workspace", label: "任务空间", active: page === "workspace" },
      { href: "/portal/billing", label: "账单", active: page === "billing" },
      ...(user.role === "admin" ? [{ href: "/portal/admin", label: "管理后台", active: isAdminPage }] : []),
    ] : [];
    const adminItems = user?.role === "admin" ? [
      { href: "/portal/admin", label: "仪表盘", active: page === "admin-dashboard" || page === "admin" },
      { href: "/portal/admin/alerts", label: "告警中心", active: page === "admin-alerts" },
      { href: "/portal/admin/users", label: "用户管理", active: page === "admin-users" || page === "admin-user-more" },
      { href: "/portal/admin/groups", label: "分组与订阅", active: page === "admin-groups" },
      { href: "/portal/admin/usage", label: "使用记录", active: page === "admin-usage" },
      { href: "/portal/admin/billing-ops", label: "计费运维", active: page === "admin-billing-ops" },
      { href: "/portal/admin/system", label: "系统入口", active: page === "admin-system" },
      { href: "/portal/admin/ops", label: "运维监控", active: page === "admin-ops" },
      { href: "/portal/admin/sandboxes", label: "沙箱与分发", active: page === "admin-sandboxes" },
      { href: "/portal/admin/audit", label: "审计日志", active: page === "admin-audit" },
    ] : [];
    const chrome = user ? `
      <div class="app-shell">
        <aside class="app-sidebar">
          <div class="brand-block">
            <div class="brand-title">Portal</div>
            <div class="brand-subtitle">${user.role === "admin" ? "商用运营后台" : "研究工作台"}</div>
          </div>
          <div class="sidebar-group">
            <div class="sidebar-heading">主导航</div>
            ${navItems.map((item) => `<a class="sidebar-link ${item.active ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
          </div>
          ${adminItems.length ? `<div class="sidebar-group">
            <div class="sidebar-heading">管理后台</div>
            ${adminItems.map((item) => `<a class="sidebar-link ${item.active ? "active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
          </div>` : ""}
          <div class="sidebar-group sidebar-meta">
            <div class="sidebar-heading">账户</div>
            <div class="sidebar-user">${user.name || user.email}</div>
            <div class="sidebar-email">${user.email}</div>
          </div>
          <div class="sidebar-actions">
            <button id="theme-toggle" type="button" class="sidebar-button">切换主题</button>
            <a href="/logout" class="sidebar-link subtle">退出登录</a>
          </div>
        </aside>
        <main class="app-main">${body}</main>
      </div>
    ` : `<div class="auth-shell">${body}</div>`;
  
    return `<!doctype html>
    <html lang="zh-CN" data-theme="${theme}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${title}</title>
        <style>
          :root {
            --bg: #06111c;
            --sidebar: rgba(5, 12, 23, .92);
            --panel: rgba(10,18,34,.84);
            --panel-border: rgba(92,126,168,.22);
            --text: #eef6ff;
            --muted: #8ca3c3;
            --accent: #29c8ff;
            --accent-2: #52f1c7;
            --success: #65ffbf;
            --warning: #ffd666;
            --danger: #ff6b81;
            --shadow: 0 24px 70px rgba(0,0,0,.35);
          }
          html[data-theme="light"] {
            --bg: #eef5ff;
            --sidebar: rgba(255,255,255,.94);
            --panel: rgba(255,255,255,.92);
            --panel-border: rgba(92,126,168,.18);
            --text: #0f2746;
            --muted: #5f7799;
            --accent: #1368ff;
            --accent-2: #00a884;
            --success: #00a884;
            --warning: #d99700;
            --danger: #d64563;
            --shadow: 0 24px 60px rgba(31,58,104,.12);
          }
          body {
            font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            margin: 0;
            min-height: 100vh;
            color: var(--text);
            background:
              radial-gradient(circle at top left, rgba(56,214,255,.18), transparent 28%),
              radial-gradient(circle at top right, rgba(101,255,191,.14), transparent 24%),
              linear-gradient(180deg, #04101d 0%, #07111f 45%, #040a14 100%);
          }
          html[data-theme="light"] body {
            background:
              radial-gradient(circle at top left, rgba(19,104,255,.12), transparent 28%),
              radial-gradient(circle at top right, rgba(0,168,132,.10), transparent 24%),
              linear-gradient(180deg, #f7fbff 0%, #eef5ff 45%, #e8f0fb 100%);
          }
          .app-shell { display: grid; grid-template-columns: 268px minmax(0, 1fr); min-height: 100vh; }
          .app-sidebar {
            background: var(--sidebar);
            border-right: 1px solid var(--panel-border);
            padding: 28px 18px 24px;
            display: flex;
            flex-direction: column;
            gap: 18px;
            position: sticky;
            top: 0;
            height: 100vh;
            box-sizing: border-box;
            backdrop-filter: blur(18px);
          }
          .app-main { padding: 28px; min-width: 0; }
          .auth-shell { max-width: 720px; margin: 0 auto; padding: 56px 28px; }
          .brand-block { padding: 8px 10px 18px; border-bottom: 1px solid rgba(255,255,255,.08); }
          .brand-title { font-size: 22px; font-weight: 700; letter-spacing: .03em; }
          .brand-subtitle { color: var(--muted); font-size: 13px; margin-top: 8px; }
          .sidebar-group { display: flex; flex-direction: column; gap: 6px; }
          .sidebar-heading { color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; padding: 0 10px 6px; }
          .sidebar-link {
            display: flex;
            align-items: center;
            min-height: 44px;
            border-radius: 14px;
            padding: 0 12px;
            color: var(--text);
            background: rgba(255,255,255,.02);
            border: 1px solid transparent;
            transition: background .2s ease, border-color .2s ease, transform .2s ease;
          }
          .sidebar-link:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.08); transform: translateX(2px); }
          .sidebar-link.active { background: linear-gradient(135deg, rgba(41,200,255,.16), rgba(82,241,199,.12)); border-color: rgba(41,200,255,.36); }
          .sidebar-link.subtle { margin-top: 4px; }
          .sidebar-meta {
            margin-top: auto;
            border-top: 1px solid rgba(255,255,255,.08);
            padding-top: 18px;
          }
          .sidebar-user { font-weight: 600; padding: 0 10px 4px; }
          .sidebar-email { color: var(--muted); font-size: 13px; padding: 0 10px; word-break: break-all; }
          .sidebar-actions { display: flex; flex-direction: column; gap: 10px; }
          .sidebar-button {
            width: 100%;
            min-height: 44px;
            border-radius: 14px;
          }
          .hero { margin-bottom: 22px; padding: 28px; border-radius: 22px; background: linear-gradient(135deg, rgba(10,18,34,.92), rgba(7,17,31,.82)); border: 1px solid rgba(56,214,255,.18); box-shadow: var(--shadow); }
          html[data-theme="light"] .hero { background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(239,246,255,.96)); border-color: rgba(19,104,255,.12); }
          .hero h1 { margin: 0 0 8px; font-size: 34px; letter-spacing: .02em; }
          .hero p { margin: 0; color: var(--muted); }
          .card { background: var(--panel); border: 1px solid var(--panel-border); border-radius: 18px; padding: 20px; margin-bottom: 18px; box-shadow: var(--shadow); min-width: 0; }
          .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
          .grid-2 { display: grid; grid-template-columns: 1fr; gap: 18px; }
          .grid-dashboard { display: grid; grid-template-columns: 2fr 1.2fr; gap: 18px; align-items: start; }
          .grid-dashboard.equal { grid-template-columns: 1fr 1fr; align-items: stretch; }
          .stack-lg { display: grid; gap: 18px; }
          .metric { padding: 18px; border-radius: 16px; background: linear-gradient(180deg, rgba(16,29,51,.86), rgba(8,15,28,.92)); border: 1px solid rgba(56,214,255,.12); }
          html[data-theme="light"] .metric { background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(243,248,255,.98)); border-color: rgba(19,104,255,.10); }
          .metric small { display: block; color: var(--muted); margin-bottom: 8px; }
          .metric strong { font-size: 28px; }
          input, button, select, textarea { font: inherit; padding: 11px 13px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; width: 100%; box-sizing: border-box; background: rgba(6,13,24,.82); color: var(--text); }
          html[data-theme="light"] input, html[data-theme="light"] button, html[data-theme="light"] select, html[data-theme="light"] textarea { background: rgba(255,255,255,.92); border-color: rgba(19,104,255,.12); }
          button { cursor: pointer; width: auto; background: linear-gradient(135deg, rgba(56,214,255,.18), rgba(101,255,191,.16)); border-color: rgba(101,255,191,.28); color: var(--text); }
          a { color: var(--accent); text-decoration: none; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,.08); text-align: left; }
          th { color: var(--muted); font-weight: 500; white-space: nowrap; }
          td { vertical-align: top; }
          code { background: rgba(255,255,255,.08); padding: 2px 6px; border-radius: 6px; }
          .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); font-size: 12px; }
          .status-badge.ok { border-color: rgba(101,255,191,.28); background: rgba(101,255,191,.12); }
          .status-badge.warn { border-color: rgba(255,214,102,.28); background: rgba(255,214,102,.12); }
          .status-badge.danger { border-color: rgba(255,107,129,.28); background: rgba(255,107,129,.12); }
          .action-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
          .action-row form { margin: 0; }
          .section-head { display: flex; justify-content: space-between; align-items: end; gap: 12px; margin-bottom: 14px; }
          .section-head h2, .card h2 { margin: 0; }
          .section-head .hint { margin-left: auto; }
          .button-danger { background: linear-gradient(135deg, rgba(255,107,129,.18), rgba(255,107,129,.12)); border-color: rgba(255,107,129,.32); }
          .chart { width: 100%; min-height: 320px; }
          .chart-sm { min-height: 260px; }
          .chart-lg { min-height: 380px; }
          .explain { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
          .hint { color: var(--muted); font-size: 13px; }
          .list { margin: 0; padding-left: 18px; }
          .table-wrap { overflow: auto; max-height: 360px; }
          .page-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; }
          .system-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
          .system-card { display: grid; gap: 10px; min-height: 180px; }
          .system-card .status-badge { width: fit-content; }
          .metric-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
          .metric-grid-6 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px; }
          .muted-chip { display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.08); color: var(--muted); }
          .portal-dialog { width: min(720px, calc(100vw - 32px)); border: 1px solid var(--panel-border); border-radius: 18px; background: var(--panel); color: var(--text); box-shadow: var(--shadow); padding: 20px; }
          .portal-dialog::backdrop { background: rgba(1, 7, 16, .72); backdrop-filter: blur(6px); }
          .dialog-close-row { display: flex; justify-content: flex-end; margin-bottom: 12px; }
          .user-modal-panel { display: grid; gap: 12px; }
          @media (max-width: 980px) {
            .app-shell { grid-template-columns: 1fr; }
            .app-sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--panel-border); }
            .app-main { padding: 18px; }
            .grid-dashboard { grid-template-columns: 1fr; }
            .grid { grid-template-columns: 1fr 1fr; }
            .metric-grid-4, .metric-grid-6 { grid-template-columns: 1fr 1fr; }
          }
          @media (max-width: 720px) {
            .grid { grid-template-columns: 1fr; }
            .metric-grid-4, .metric-grid-6 { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        ${chrome}
        <script id="portal-bootstrap" type="application/json">${bootstrap}</script>
        <script>window.__PORTAL_PAGE__=${JSON.stringify(page)};</script>
      </body>
    </html>`;
  }
  
  function layout(title, body, user, options = {}) {
    return layoutV2(title, body, user, options);
  }

  return { layoutV2, layout };
}

