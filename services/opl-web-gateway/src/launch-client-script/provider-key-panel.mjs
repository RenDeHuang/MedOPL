export const PROVIDER_KEY_PANEL_SECTION = `function providerConfiguredFromBootstrap(bootstrap) {
  const provider = bootstrap && bootstrap.provider ? bootstrap.provider : {};
  return provider.providerConfigured === true || provider.providerConfigStatus === "configured";
}

function normalizeProviderKey(value) {
  try {
    return String(value || "").trim();
  } catch {
    return "";
  }
}

function createProviderKeyField() {
  const wrapper = document.createElement("div");
  wrapper.className = "opl-portal-provider-key-field";
  const label = document.createElement("label");
  label.textContent = "gflabtoken API Key";
  const input = document.createElement("input");
  input.setAttribute("type", "password");
  input.setAttribute("name", "oplProviderApiKey");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("placeholder", "来源于 gflabtoken");
  input.setAttribute("data-opl-provider-key", "1");
  const hint = document.createElement("div");
  hint.textContent = MODEL_SERVICE_SOURCE_COPY + "，请填写与当前 Portal 身份配套的 API Key，且不在页面回显明文。";
  hint.style.fontSize = "12px";
  hint.style.color = "#64748b";
  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);
  return wrapper;
}

const PROVIDER_KEY_LOGIN_PATHS = ["/api/auth/signin", "/api/auth/login", "/api/v1/auths/signin", "/api/v1/auths/login", "/auth/login", "/login"];

function normalizedPath(value = "") {
  try {
    return new URL(String(value || ""), window.location.origin).pathname;
  } catch {
    return String(value || "").split("?")[0] || "";
  }
}

function isProviderKeyLoginPath(pathname = "") {
  return PROVIDER_KEY_LOGIN_PATHS.includes(String(pathname || ""));
}

function isProviderKeyLoginRoute() {
  const path = normalizedPath(window.location && window.location.href);
  const hash = String(window.location && window.location.hash || "").toLowerCase();
  return isProviderKeyLoginPath(path) || hash === "#/login" || hash === "#/signin" || hash === "#/auth/login";
}

function formTargetsProviderKeyLogin(form) {
  const action = form && typeof form.getAttribute === "function" ? form.getAttribute("action") : "";
  return isProviderKeyLoginPath(normalizedPath(action || window.location.href));
}

function isProviderKeyLoginForm(form) {
  if (!form || typeof form.querySelector !== "function") return false;
  if (form.getAttribute("data-opl-provider-key-form") === "1") return true;
  const method = String(form.getAttribute("method") || "post").toLowerCase();
  if (method && method !== "post") return false;
  const hasPassword = Boolean(form.querySelector('input[type="password"], input[name="password"]'));
  if (!hasPassword) return false;
  return formTargetsProviderKeyLogin(form) || isProviderKeyLoginRoute();
}

function injectGflabtokenApiKeyField(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  const forms = Array.from(root.querySelectorAll("form"));
  for (const form of forms) {
    if (!form || typeof form.querySelector !== "function") continue;
    if (form.querySelector("[data-opl-provider-key]")) continue;
    if (!isProviderKeyLoginForm(form)) continue;
    const passwordInputs = Array.from(form.querySelectorAll('input[type="password"], input[name="password"]'));
    if (!passwordInputs.length) continue;
    const passwordField = passwordInputs[passwordInputs.length - 1];
    const wrapper = createProviderKeyField();
    const anchor = passwordField.closest("p, div, label, section") || passwordField;
    if (anchor.parentNode && typeof anchor.parentNode.insertBefore === "function" && anchor.nextSibling) {
      anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
      continue;
    }
    if (anchor.parentNode && typeof anchor.parentNode.appendChild === "function") {
      anchor.parentNode.appendChild(wrapper);
      continue;
    }
    if (typeof form.appendChild === "function") form.appendChild(wrapper);
  }
}

function installGflabtokenApiKeyFieldObserver() {
  injectGflabtokenApiKeyField(document);
  if (typeof MutationObserver === "function" && document && document.body) {
    const observer = new MutationObserver(() => injectGflabtokenApiKeyField(document));
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (typeof window.setInterval === "function") {
    window.setInterval(() => injectGflabtokenApiKeyField(document), 1000);
  }
}

function removeLaunchProviderConnectionPanel() {
  try {
    const panel = document.querySelector("[data-opl-launch-provider-panel]");
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
  } catch {}
}

async function bindLaunchProviderKey(state, bootstrap, providerKey) {
  const launch = bootstrap.launch || {};
  const portal = bootstrap.portal || {};
  const workspace = bootstrap.workspace || {};
  return fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/sessions/bind", {
    method: "POST",
    body: JSON.stringify({
      workspaceId: portal.workspaceId || launch.workspaceId || workspace.workspaceId || "",
      workspaceSessionId: portal.workspaceSessionId || launch.workspaceSessionId || "",
      runtimeSessionId: portal.runtimeSessionId || launch.runtimeSessionId || "",
      oplSessionId: "opl-web:" + (launch.launchId || portal.runtimeSessionId || Date.now()),
      workspacePath: workspace.workspacePath || launch.workspacePath || "",
      provider: "gflabtoken",
      source: "user_input",
      apiKey: providerKey,
      userAgent: window.navigator.userAgent
    })
  });
}

function updateLaunchProviderPanelMessage(panel, message, { error = false } = {}) {
  if (!panel || typeof panel.querySelector !== "function") return;
  const messageNode = panel.querySelector("[data-opl-provider-message]");
  if (!messageNode) return;
  messageNode.textContent = message || "";
  messageNode.style.color = error ? "#dc2626" : "#475569";
}

function renderLaunchProviderConnectionPanel(state, bootstrap) {
  const existing = document.querySelector("[data-opl-launch-provider-panel]");
  if (existing) return existing;
  const panel = document.createElement("section");
  panel.setAttribute("data-opl-launch-provider-panel", "1");
  panel.style.position = "fixed";
  panel.style.inset = "0";
  panel.style.zIndex = "2147483647";
  panel.style.display = "flex";
  panel.style.alignItems = "center";
  panel.style.justifyContent = "center";
  panel.style.background = "rgba(15, 23, 42, 0.52)";

  const box = document.createElement("div");
  box.style.width = "min(420px, calc(100vw - 32px))";
  box.style.padding = "20px";
  box.style.borderRadius = "8px";
  box.style.background = "#ffffff";
  box.style.boxShadow = "0 20px 60px rgba(15, 23, 42, 0.25)";

  const title = document.createElement("h2");
  title.textContent = "连接 gflabtoken";
  title.style.margin = "0 0 12px";
  title.style.fontSize = "18px";

  const hint = document.createElement("p");
  hint.textContent = "当前 OPL 会话需要 gflabtoken API Key。模型服务来源于 gflabtoken，请填写与当前 Portal 身份配套的 key。";
  hint.style.margin = "0 0 14px";
  hint.style.fontSize = "14px";
  hint.style.color = "#475569";

  const form = document.createElement("form");
  form.style.display = "grid";
  form.style.gap = "12px";

  const providerField = createProviderKeyField();
  const providerInput = providerField.querySelector("[data-opl-provider-key]");
  if (providerInput) providerInput.setAttribute("placeholder", "来源于 gflabtoken");

  const message = document.createElement("p");
  message.setAttribute("data-opl-provider-message", "1");
  message.style.margin = "0";
  message.style.fontSize = "12px";
  message.style.minHeight = "18px";
  message.style.color = "#475569";

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "grid";
  buttonRow.style.gap = "8px";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "继续进入 OPL";
  submit.style.width = "100%";
  submit.style.height = "40px";
  submit.style.border = "0";
  submit.style.borderRadius = "6px";
  submit.style.background = "#111827";
  submit.style.color = "#ffffff";
  submit.style.cursor = "pointer";

  const returnButton = document.createElement("button");
  returnButton.type = "button";
  returnButton.textContent = "返回 Portal";
  returnButton.style.width = "100%";
  returnButton.style.height = "40px";
  returnButton.style.border = "1px solid #cbd5e1";
  returnButton.style.borderRadius = "6px";
  returnButton.style.background = "#ffffff";
  returnButton.style.color = "#0f172a";
  returnButton.style.cursor = "pointer";
  returnButton.addEventListener("click", () => {
    const directEntry = window.__OPL_PORTAL_DIRECT_ENTRY__ || DIRECT_ENTRY_DEFAULT;
    const target = directEntry.openFromPortalUrl || directEntry.portalPublicUrl || "";
    if (target) window.location.href = target;
  });

  form.addEventListener("submit", (event) => {
    handleLaunchProviderPanelSubmit(event, state, bootstrap, panel);
  }, true);

  buttonRow.appendChild(submit);
  buttonRow.appendChild(returnButton);
  box.appendChild(title);
  box.appendChild(hint);
  form.appendChild(providerField);
  form.appendChild(message);
  form.appendChild(buttonRow);
  box.appendChild(form);
  panel.appendChild(box);
  document.body.appendChild(panel);
  return panel;
}

async function handleLaunchProviderPanelSubmit(event, state, bootstrap, panel) {
  event.preventDefault();
  const input = panel && typeof panel.querySelector === "function"
    ? panel.querySelector("[data-opl-provider-key]")
    : null;
  const providerKey = normalizeProviderKey(input && "value" in input ? input.value : "");
  if (!providerKey) {
    updateLaunchProviderPanelMessage(panel, "请输入来源于 gflabtoken 的 API Key。", { error: true });
    return;
  }
  if (input) input.disabled = true;
  const submit = panel && typeof panel.querySelector === "function"
    ? panel.querySelector('button[type="submit"]')
    : null;
  if (submit) submit.disabled = true;
  updateLaunchProviderPanelMessage(panel, "正在绑定 gflabtoken 凭证...");
  try {
    await bindLaunchProviderKey(state, bootstrap, providerKey);
    if (input && "value" in input) input.value = "";
    const refreshedBootstrap = await fetchJson(RUNTIME_BRIDGE_OPL_API_PATH + "/bootstrap");
    writeStoredBootstrap(refreshedBootstrap);
    if (!providerConfiguredFromBootstrap(refreshedBootstrap)) {
      throw new Error("provider_connection_required");
    }
    removeLaunchProviderConnectionPanel();
    await completePortalLaunch(state, refreshedBootstrap);
  } catch (error) {
    updateLaunchProviderPanelMessage(panel, safeErrorMessage(error, "gflabtoken 绑定失败，请重试。"), { error: true });
  } finally {
    if (input && "value" in input) input.value = "";
    if (input) input.disabled = false;
    if (submit) submit.disabled = false;
  }
}

function ensureLaunchProviderPanel(state, bootstrap) {
  if (providerConfiguredFromBootstrap(bootstrap)) {
    removeLaunchProviderConnectionPanel();
    return true;
  }
  renderLaunchProviderConnectionPanel(state, bootstrap);
  updateDirectEntryState({
    active: true,
    authenticated: false,
    reason: "provider_connection_required"
  });
  return false;
}`;
