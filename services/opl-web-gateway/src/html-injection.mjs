import { LAUNCH_SCRIPT_PATH, buildPortalContinueUrl } from "./config.mjs";

export function injectLaunchScript(html, directEntry) {
  if (html.includes(LAUNCH_SCRIPT_PATH)) return html;

  const metaTag = `<meta name="opl-portal-direct-entry" content="${directEntry ? "1" : "0"}">`;
  const scriptTag = `<script type="module" src="${LAUNCH_SCRIPT_PATH}"></script>`;
  const directEntryMarkup = directEntry ? buildNativeLoginEntryMarkup() : "";

  html = injectHeadTags(html, metaTag, scriptTag);
  html = injectDirectEntryMarkup(html, directEntryMarkup);
  return ensureLaunchTags(html, metaTag, scriptTag);
}

function injectHeadTags(html, metaTag, scriptTag) {
  if (html.includes("</head>")) {
    return html.replace("</head>", `    ${metaTag}\n    ${scriptTag}\n  </head>`);
  }
  return html;
}

function injectDirectEntryMarkup(html, directEntryMarkup) {
  if (directEntryMarkup && html.includes("</body>")) {
    return html.replace("</body>", `${directEntryMarkup}\n  </body>`);
  }
  return directEntryMarkup ? `${html}\n${directEntryMarkup}` : html;
}

function ensureLaunchTags(html, metaTag, scriptTag) {
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

export function buildNativeLoginEntryMarkup() {
  const continueUrl = buildPortalContinueUrl();
  const button = continueUrl
    ? `<a class="opl-portal-entry__button" data-opl-portal-continue-link href="${escapeHtml(continueUrl)}">返回 Portal</a>`
    : `<span class="opl-portal-entry__button opl-portal-entry__button--disabled" data-opl-portal-continue-link>返回 Portal</span>`;

  return `
<section id="opl-portal-direct-entry" class="opl-portal-entry" aria-live="polite">
  <style>${portalEntryStyles()}</style>
  <div class="opl-portal-entry__panel">
    <button class="opl-portal-entry__close" type="button" aria-label="关闭提示" data-opl-portal-dismiss>&times;</button>
    <p class="opl-portal-entry__eyebrow">One Person Lab</p>
    <h1 class="opl-portal-entry__title">使用 Portal 账号进入 OPL</h1>
    <p class="opl-portal-entry__copy">可直接在当前登录表单使用 Portal 账号登录，并在密码下方填写来源于 gflabtoken 的 API Key；也可以返回 Portal 统一入口继续。</p>
    ${button}
    <p class="opl-portal-entry__hint">${continueUrl ? `继续入口：${escapeHtml(continueUrl)}` : "未配置 Portal 公开地址，请联系管理员设置 PORTAL_PUBLIC_URL。"}</p>
  </div>
</section>`;
}

function portalEntryStyles() {
  return `
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
    .opl-portal-entry--blocking {
      inset: 0;
      right: 0;
      bottom: 0;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #0b1020;
      pointer-events: auto;
    }
    .opl-portal-entry__panel {
      position: relative;
      width: min(380px, calc(100vw - 32px));
      padding: 20px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.96);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
      pointer-events: auto;
    }
    .opl-portal-entry--blocking .opl-portal-entry__panel {
      width: min(520px, 100%);
      padding: 32px;
    }
    .opl-portal-entry__close {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 28px;
      height: 28px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.8);
      color: #cbd5e1;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }
    .opl-portal-entry__eyebrow {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #93c5fd;
    }
    .opl-portal-entry__title {
      margin: 0 32px 10px 0;
      font-size: 18px;
      line-height: 1.3;
      color: #f8fafc;
    }
    .opl-portal-entry--blocking .opl-portal-entry__title {
      margin-right: 0;
      font-size: 28px;
    }
    .opl-portal-entry__copy {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .opl-portal-entry--blocking .opl-portal-entry__copy {
      font-size: 15px;
      line-height: 1.7;
    }
    .opl-portal-entry__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 16px;
      border-radius: 6px;
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
      margin: 14px 0 0;
      font-size: 12px;
      color: #94a3b8;
      overflow-wrap: anywhere;
    }
    .opl-portal-provider-key-field {
      display: grid;
      gap: 6px;
      margin-top: 12px;
    }
    .opl-portal-provider-key-field label {
      font-size: 12px;
      color: #64748b;
    }
    .opl-portal-provider-key-field input {
      width: 100%;
      min-height: 40px;
      box-sizing: border-box;
    }
  `;
}
