import { ensurePublicSiteSettings } from "../domain/portal-public-settings.mjs";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHttpUrl(value = "") {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function brandMark(settings) {
  if (settings.siteLogo) {
    return `<img class="portal-home-logo" src="${escapeHtml(settings.siteLogo)}" alt="${escapeHtml(settings.siteName)}" />`;
  }
  return `<div class="portal-home-logo portal-home-logo-text">${escapeHtml(settings.siteName.slice(0, 1) || "M")}</div>`;
}

function homeShell({ title, settings, content, fullBleed = false }) {
  const fullBleedClass = fullBleed ? " portal-home-full" : "";
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; --text: #172033; --muted: #5b6475; --line: #d8dee8; --bg: #f6f8fb; --panel: #ffffff; --primary: #2457d6; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; font-family: "Inter", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--text); background: var(--bg); }
      .portal-home-shell { min-height: 100vh; display: flex; flex-direction: column; }
      .portal-home-header { height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 32px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.94); }
      .portal-home-brand { min-width: 0; display: flex; align-items: center; gap: 12px; color: inherit; }
      .portal-home-logo { width: 36px; height: 36px; border-radius: 8px; object-fit: contain; border: 1px solid var(--line); background: #fff; }
      .portal-home-logo-text { display: flex; align-items: center; justify-content: center; background: var(--primary); color: #fff; font-weight: 700; border-color: var(--primary); }
      .portal-home-title { font-size: 15px; font-weight: 700; line-height: 1.2; }
      .portal-home-subtitle { margin-top: 2px; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 52vw; }
      .portal-home-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
      .portal-home-button { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: #fff; color: var(--text); text-decoration: none; font-size: 14px; font-weight: 600; }
      .portal-home-button.primary { border-color: var(--primary); background: var(--primary); color: #fff; }
      .portal-home-main { width: min(1120px, calc(100vw - 48px)); margin: 0 auto; padding: 40px 0 56px; flex: 1; }
      .portal-home-full .portal-home-main { width: 100%; padding: 0; }
      .portal-home-iframe { width: 100%; height: calc(100vh - 64px); border: 0; display: block; background: #fff; }
      .opl-intro { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 28px; align-items: start; }
      .opl-intro h1 { margin: 0; font-size: 40px; line-height: 1.12; letter-spacing: 0; }
      .opl-intro p { margin: 14px 0 0; color: var(--muted); font-size: 16px; line-height: 1.8; }
      .opl-panel { border: 1px solid var(--line); background: var(--panel); border-radius: 8px; padding: 22px; }
      .opl-panel h2 { margin: 0 0 14px; font-size: 18px; }
      .opl-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
      .opl-list li { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); }
      .opl-list li:first-child { border-top: 0; padding-top: 0; }
      .opl-list strong { font-size: 14px; }
      .opl-list span { color: var(--muted); font-size: 14px; line-height: 1.6; }
      @media (max-width: 820px) {
        .portal-home-header { height: auto; min-height: 64px; align-items: flex-start; flex-direction: column; padding: 14px 18px; }
        .portal-home-actions { justify-content: flex-start; }
        .portal-home-main { width: min(100vw - 32px, 1120px); padding-top: 26px; }
        .opl-intro { grid-template-columns: 1fr; }
        .opl-intro h1 { font-size: 30px; }
      }
    </style>
  </head>
  <body>
    <div class="portal-home-shell${fullBleedClass}">
      <header class="portal-home-header">
        <a class="portal-home-brand" href="/">
          ${brandMark(settings)}
          <span class="portal-home-copy">
            <span class="portal-home-title">${escapeHtml(settings.siteName)}</span>
            <span class="portal-home-subtitle">${escapeHtml(settings.siteSubtitle)}</span>
          </span>
        </a>
        <nav class="portal-home-actions" aria-label="Portal 入口">
          <a class="portal-home-button" href="/login">登录</a>
          <a class="portal-home-button" href="/register">注册</a>
          <a class="portal-home-button primary" href="/overview">进入工作台</a>
        </nav>
      </header>
      <main class="portal-home-main">${content}</main>
    </div>
  </body>
</html>`;
}

function defaultOplIntro(settings) {
  return `
    <section class="opl-intro">
      <div>
        <h1>One Person Lab</h1>
        <p>OPL 是面向个人科研工作的实验室环境。MedOPL 提供托管入口、账号、计算资源、文件空间、任务执行和账务记录，让用户专注于科研任务本身。</p>
        <p>平台负责开通工作空间、隔离运行环境、记录费用和保留输出文件。用户登录后进入工作台查看余额、资源、任务和文件。</p>
      </div>
      <aside class="opl-panel">
        <h2>工作台能力</h2>
        <ul class="opl-list">
          <li><strong>计算资源</strong><span>查看套餐、计算规格、并发数和费用估算。</span></li>
          <li><strong>任务执行</strong><span>查看会话、任务状态、输出文件和资源用量。</span></li>
          <li><strong>文件空间</strong><span>管理输入文件、输出文件、文件夹和保护期。</span></li>
          <li><strong>账务记录</strong><span>查看余额、可用余额、冻结金额、累计消费和账户流水。</span></li>
        </ul>
      </aside>
    </section>`;
}

export function renderPortalPublicHome(db = {}) {
  const settings = ensurePublicSiteSettings(db);
  const homeContent = String(settings.homeContent || "").trim();
  if (isHttpUrl(homeContent)) {
    return homeShell({
      title: settings.siteName,
      settings,
      fullBleed: true,
      content: `<iframe class="portal-home-iframe" src="${escapeHtml(homeContent)}" title="${escapeHtml(settings.siteName)} 首页内容"></iframe>`,
    });
  }
  return homeShell({
    title: settings.siteName,
    settings,
    content: homeContent || defaultOplIntro(settings),
  });
}
