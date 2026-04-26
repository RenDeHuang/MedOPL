import { LAUNCH_SCRIPT_PATH, buildPortalContinueUrl } from "./config.mjs";

export function injectLaunchScript(html, directEntry) {
  if (html.includes(LAUNCH_SCRIPT_PATH)) return html;
  const metaTag = `<meta name="opl-portal-direct-entry" content="${directEntry ? "1" : "0"}">`;
  const scriptTag = `<script type="module" src="${LAUNCH_SCRIPT_PATH}"></script>`;
  const directEntryMarkup = directEntry ? buildNativeLoginEntryMarkup() : "";
  if (html.includes("</head>")) {
    html = html.replace("</head>", `    ${metaTag}\n    ${scriptTag}\n  </head>`);
  }
  if (directEntryMarkup && html.includes("</body>")) {
    html = html.replace("</body>", `${directEntryMarkup}\n  </body>`);
  } else if (directEntryMarkup) {
    html = `${html}\n${directEntryMarkup}`;
  }
  if (html.includes(metaTag) || html.includes(scriptTag)) return html;
  return `${metaTag}\n${scriptTag}\n${html}`;
}

export function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDirectEntryMarkup() {
  const continueUrl = buildPortalContinueUrl();
  const button = continueUrl
    ? `<a class="opl-portal-entry__button" data-opl-portal-continue-link href="${escapeHtml(continueUrl)}">使用 Portal 继续</a>`
    : `<span class="opl-portal-entry__button opl-portal-entry__button--disabled" data-opl-portal-continue-link>使用 Portal 继续</span>`;
  return `
<section id="opl-portal-direct-entry" class="opl-portal-entry" aria-live="polite">
  <style>
    .opl-portal-entry {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #0b1020;
      color: #e5eefc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .opl-portal-entry__panel {
      width: min(520px, 100%);
      padding: 32px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.96);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
    }
    .opl-portal-entry__eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #93c5fd;
    }
    .opl-portal-entry__title {
      margin: 0 0 12px;
      font-size: 28px;
      line-height: 1.2;
      color: #f8fafc;
    }
    .opl-portal-entry__copy {
      margin: 0 0 24px;
      font-size: 15px;
      line-height: 1.7;
      color: #cbd5e1;
    }
    .opl-portal-entry__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
      text-decoration: none;
    }
    .opl-portal-entry__button--disabled {
      background: #334155;
      color: #cbd5e1;
      cursor: default;
    }
    .opl-portal-entry__hint {
      margin: 16px 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
  <div class="opl-portal-entry__panel">
    <p class="opl-portal-entry__eyebrow">One Person Lab</p>
    <h1 class="opl-portal-entry__title">请先通过 Portal 打开工作台</h1>
    <p class="opl-portal-entry__copy">当前 OPL Web 不接受原生账号登录。请从 Portal 登录后继续，这样当前用户、workspace、session、trace 和存储归属都会绑定到 Portal 身份。</p>
    ${button}
    <p class="opl-portal-entry__hint">${continueUrl ? `继续入口：${escapeHtml(continueUrl)}` : "未配置 Portal 公开地址，请联系管理员设置 PORTAL_PUBLIC_URL。"}</p>
  </div>
</section>`;
}

export function buildNativeLoginEntryMarkup() {
  const continueUrl = buildPortalContinueUrl();
  const button = continueUrl
    ? `<a class="opl-portal-entry__button" data-opl-portal-continue-link href="${escapeHtml(continueUrl)}">返回 Portal</a>`
    : `<span class="opl-portal-entry__button opl-portal-entry__button--disabled" data-opl-portal-continue-link>返回 Portal</span>`;
  return `
<section id="opl-portal-direct-entry" class="opl-portal-entry" aria-live="polite">
  <style>
    .opl-portal-entry {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 0;
      background: transparent;
      pointer-events: none;
      color: #e5eefc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .opl-portal-entry__panel {
      width: min(360px, calc(100vw - 32px));
      padding: 20px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.96);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
      pointer-events: auto;
    }
    .opl-portal-entry__eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #93c5fd;
    }
    .opl-portal-entry__title {
      margin: 0 0 10px;
      font-size: 18px;
      line-height: 1.3;
      color: #f8fafc;
    }
    .opl-portal-entry__copy {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .opl-portal-entry__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
      text-decoration: none;
    }
    .opl-portal-entry__button--disabled {
      background: #334155;
      color: #cbd5e1;
      cursor: default;
    }
    .opl-portal-entry__hint {
      margin: 16px 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
  <div class="opl-portal-entry__panel">
    <p class="opl-portal-entry__eyebrow">One Person Lab</p>
    <h1 class="opl-portal-entry__title">使用 Portal 账号登录</h1>
    <p class="opl-portal-entry__copy">可以直接在当前登录框输入 Portal 邮箱和密码，也可以回 Portal 进入工作台。</p>
    ${button}
    <p class="opl-portal-entry__hint">${continueUrl ? `继续入口：${escapeHtml(continueUrl)}` : "未配置 Portal 公开地址，请联系管理员设置 PORTAL_PUBLIC_URL。"}</p>
  </div>
</section>`;
}
