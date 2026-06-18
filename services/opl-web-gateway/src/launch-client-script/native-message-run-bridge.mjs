export const NATIVE_MESSAGE_RUN_BRIDGE_SECTION = `function resolveOplModuleClickTarget(event) {
  const closest = resolveOplModuleElement(event);
  if (!closest || typeof closest.getAttribute !== "function") return null;
  const moduleId = resolveOplModuleId(closest);
  if (!OPL_MODULE_IDS.includes(moduleId)) return null;
  return {
    moduleId,
    label: String(closest.textContent || moduleId).trim()
  };
}

function resolveOplModuleElement(event) {
  const target = event && event.target;
  return target && typeof target.closest === "function"
    ? target.closest('[data-testid^="opl-module-pill-"], [data-opl-module-id]')
    : null;
}

function resolveOplModuleId(element) {
  const explicitId = element.getAttribute("data-opl-module-id");
  const testId = String(element.getAttribute("data-testid") || "").replace(/^opl-module-pill-/, "");
  return String(explicitId || testId).toLowerCase();
}

function dispatchPortalRunEvent(type, detail) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch {}
}

function dispatchPortalMessageEvent(type, detail) {
  try {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  } catch {}
}

function resolveNativeMessageText(target) {
  try {
    const root = target && typeof target.closest === "function" ? target.closest("main, form, section, div") : document;
    const inputSelector = "textarea, input[name='message'], input[name='prompt'], [contenteditable='true']";
    const scoped = root && typeof root.querySelectorAll === "function" ? Array.from(root.querySelectorAll(inputSelector)) : [];
    const global = typeof document !== "undefined" && typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll(inputSelector)) : [];
    const inputs = [...scoped, ...global];
    for (const input of inputs) {
      const value = String(input && "value" in input ? input.value : input.textContent || "").trim();
      if (value) return value;
    }
  } catch {}
  return "";
}

function consumeNativeMessageEvent(event, target, message) {
  if (!event || !target || !message) return false;
  if (event.__OPL_PORTAL_MESSAGE_BRIDGED__) return false;
  if (target.dataset.oplPortalMessagePending === "1") return false;
  event.__OPL_PORTAL_MESSAGE_BRIDGED__ = true;
  markFirstInteraction({ source: "opl-web-native-ui-send" });
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  target.dataset.oplPortalMessagePending = "1";
  window.__OPL_PORTAL__.sendMessage({
    message,
    source: "opl-web-native-ui-send",
    toolName: "opl-native-ui",
  })
    .then((result) => dispatchPortalMessageEvent("opl:portal-message-sent", { message, result }))
    .catch((error) => dispatchPortalMessageEvent("opl:portal-message-error", {
      message,
      error: String(error && error.message ? error.message : error)
    }))
    .finally(() => {
      delete target.dataset.oplPortalMessagePending;
    });
  return true;
}

function resolveNativeMessageSendTarget(event) {
  const target = event && event.target;
  if (!target || typeof target.closest !== "function") return null;
  return target.closest("button.send-button-custom, [data-testid='send-button'], button[aria-label='Send'], button[aria-label='发送'], button[type='submit']");
}

function installNativeMessageBridge() {
  if (window.__OPL_PORTAL_NATIVE_MESSAGE_BRIDGE_INSTALLED__) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  window.__OPL_PORTAL_NATIVE_MESSAGE_BRIDGE_INSTALLED__ = true;
  document.addEventListener("submit", (event) => {
    const form = event && event.target;
    if (!form || typeof form.querySelector !== "function") return;
    const message = resolveNativeMessageText(form);
    consumeNativeMessageEvent(event, form, message);
  }, true);
  document.addEventListener("click", (event) => {
    const sendTarget = resolveNativeMessageSendTarget(event);
    if (!sendTarget) return;
    const message = resolveNativeMessageText(sendTarget);
    consumeNativeMessageEvent(event, sendTarget, message);
  }, true);
}

function installNativeRunBridge() {
  if (window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__) return;
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
  window.__OPL_PORTAL_NATIVE_RUN_BRIDGE_INSTALLED__ = true;
  document.addEventListener("click", (event) => {
    const module = resolveOplModuleClickTarget(event);
    if (!module) return;
    markFirstInteraction({ source: "opl-web-native-ui-click", moduleId: module.moduleId });
    window.__OPL_PORTAL__.startRun({
      agentId: module.moduleId,
      toolName: "opl-native-ui",
      source: "opl-web-native-ui-click",
      input: {
        moduleId: module.moduleId,
        label: module.label
      }
    })
      .then((run) => dispatchPortalRunEvent("opl:portal-run-started", { module, run }))
      .catch((error) => dispatchPortalRunEvent("opl:portal-run-error", {
        module,
        error: String(error && error.message ? error.message : error)
      }));
  }, true);
}

window.__OPL_PORTAL__.installNativeRunBridge = installNativeRunBridge;
window.__OPL_PORTAL__.installNativeMessageBridge = installNativeMessageBridge;
window.__OPL_PORTAL__.markFirstInteraction = markFirstInteraction;
installDomReadyMarker();
installGflabtokenApiKeyFieldObserver();`;
