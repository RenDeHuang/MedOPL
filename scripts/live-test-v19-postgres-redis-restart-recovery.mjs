import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { loginPortalOidc } from "./lib/portal-oidc-playwright.mjs";

const execFileAsync = promisify(execFile);
const kubectlExecTimeoutMs = 45_000;
const kubectlMaxBuffer = 8 * 1024 * 1024;
const defaultAuxSecretNames = [
  "secret-portal",
  "secret-opl",
  "secret-trace",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function skip(reason, detail = "") {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason,
    detail,
  }, null, 2));
  process.exit(0);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function splitCsv(value, fallback = []) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : [...fallback];
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  assert(value, `${name}_required`);
  return value;
}

async function loadFixtureEnvFile() {
  const filePath = String(process.env.PORTAL_RECOVERY_FIXTURE_FILE || "").trim();
  if (!filePath) return {};
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw || "{}");
  const env = parsed && typeof parsed.env === "object" && parsed.env ? parsed.env : {};
  const loaded = Object.fromEntries(
    Object.entries(env)
      .map(([key, value]) => [String(key), String(value || "").trim()])
      .filter(([, value]) => value !== ""),
  );
  const secretFiles = parsed && typeof parsed.secretFiles === "object" && parsed.secretFiles ? parsed.secretFiles : {};
  for (const [key, secretPath] of Object.entries(secretFiles)) {
    if (process.env[key]) continue;
    if (!secretPath) continue;
    const secretValue = String(await readFile(String(secretPath), "utf8")).trim();
    if (secretValue) loaded[String(key)] = secretValue;
  }
  return loaded;
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function splitSetCookie(headerValue = "") {
  return String(headerValue || "")
    .split(/,\s*(?=[^ ;]+=)/)
    .map((item) => item.split(";")[0]?.trim() || "")
    .filter(Boolean);
}

function cookieHeaderFromSetCookie(headerValue, names = []) {
  const cookies = splitSetCookie(headerValue);
  const filtered = names.length
    ? cookies.filter((cookie) => names.some((name) => cookie.startsWith(`${name}=`)))
    : cookies;
  return filtered.join("; ");
}

function summarizeStatus(status, bodyText = "") {
  return `${status}:${String(bodyText || "").slice(0, 200)}`;
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadPlaywright() {
  const repoRoot = process.cwd();
  const candidates = [
    process.env.PLAYWRIGHT_ENTRY,
    path.join(repoRoot, ".runtime", "browser-test", "node_modules", "playwright", "index.js"),
    path.join(repoRoot, "node_modules", "playwright", "index.js"),
    path.join(os.homedir(), ".codex", "skills", "gstack", "browse", "node_modules", "playwright", "index.js"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      const loaded = await import(pathToFileURL(candidate).href);
      return loaded.default || loaded;
    }
  }
  throw new Error(`playwright_not_found:${candidates.join(",")}`);
}

function normalizeCookieHeader(cookies = []) {
  return cookies
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
}

async function loginPortalLocal({ baseUrl, email, password, timeoutMs }) {
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const cookie = cookieHeaderFromSetCookie(response.headers.get("set-cookie") || "", ["portal_session"]);
  assert(response.status === 302, `portal_local_login_failed:${summarizeStatus(response.status, await response.text().catch(() => ""))}`);
  assert(cookie.includes("portal_session="), "portal_session_cookie_missing_after_local_login");
  return cookie;
}

async function loginPortalWithOidc({ baseUrl, email, password, timeoutMs }) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 960 },
    });
    const page = await context.newPage();
    await loginPortalOidc(page, { baseUrl, email, password, timeoutMs });
    await page.waitForURL((url) => url.href.startsWith(`${baseUrl}/portal`), { timeout: timeoutMs });
    const cookies = await context.cookies(baseUrl);
    const cookieHeader = normalizeCookieHeader(cookies.filter((item) => item.name === "portal_session"));
    assert(cookieHeader.includes("portal_session="), "portal_session_cookie_missing_after_oidc_login");
    return cookieHeader;
  } finally {
    await browser.close();
  }
}

async function createPortalSessionCookie(config) {
  if (config.loginMode === "local") {
    return loginPortalLocal(config);
  }
  if (config.loginMode === "oidc") {
    return loginPortalWithOidc(config);
  }
  throw new Error(`unsupported_PORTAL_TEST_LOGIN:${config.loginMode}`);
}

function withJsonOutput(stdout = "") {
  try {
    return JSON.parse(stdout || "{}");
  } catch (error) {
    throw new Error(`kubectl_json_parse_failed:${String(error.message || error)}`);
  }
}

async function kubectlAvailable(config) {
  if (typeof config._kubectlAvailable === "boolean") return config._kubectlAvailable;
  try {
    await execFileAsync(config.kubectlBin, ["version", "--client"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 256 * 1024,
    });
    config._kubectlAvailable = true;
  } catch (error) {
    if (error?.code === "ENOENT" || /spawn .* ENOENT/i.test(String(error?.message || ""))) {
      config._kubectlAvailable = false;
    } else {
      throw error;
    }
  }
  return config._kubectlAvailable;
}

function parseKubeconfigValue(text, key) {
  const pattern = new RegExp(`^\\s*${key}:\\s*(\\S+)\\s*$`, "m");
  const matched = text.match(pattern);
  assert(matched?.[1], `kubeconfig_${key}_missing`);
  return matched[1].trim();
}

async function kubeApiClient(config) {
  if (config._kubeApiClient) return config._kubeApiClient;
  const kubeconfigText = await readFile(config.kubeconfig, "utf8");
  const caData = parseKubeconfigValue(kubeconfigText, "certificate-authority-data");
  const certData = parseKubeconfigValue(kubeconfigText, "client-certificate-data");
  const keyData = parseKubeconfigValue(kubeconfigText, "client-key-data");
  const server = config.kubeServerOverride || parseKubeconfigValue(kubeconfigText, "server");
  config._kubeApiClient = {
    server,
    tls: {
      ca: Buffer.from(caData, "base64"),
      cert: Buffer.from(certData, "base64"),
      key: Buffer.from(keyData, "base64"),
      rejectUnauthorized: true,
    },
  };
  return config._kubeApiClient;
}

async function kubeApiRequest(config, pathname, options = {}) {
  const client = await kubeApiClient(config);
  const url = new URL(pathname, client.server);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value != null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  const method = options.method || "GET";
  const body = options.body == null ? null : String(options.body);
  const headers = {
    accept: "application/json",
    ...(options.headers || {}),
  };
  if (body != null && !headers["content-length"]) {
    headers["content-length"] = String(Buffer.byteLength(body));
  }
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      ...client.tls,
      method,
      headers,
      timeout: options.timeoutMs || kubectlExecTimeoutMs,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const bodyText = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = bodyText ? JSON.parse(bodyText) : null;
        } catch {}
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          bodyText,
          json,
        });
      });
    });
    req.on("error", (error) => reject(error));
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (body != null) req.write(body);
    req.end();
  });
}

function parseNamespaceArgs(args) {
  if (args[0] === "-n" && args[1]) {
    return {
      namespace: args[1],
      rest: args.slice(2),
    };
  }
  return {
    namespace: "default",
    rest: [...args],
  };
}

async function kubectlJsonViaApi(config, args) {
  const { namespace, rest } = parseNamespaceArgs(args);
  assert(rest[0] === "get", `unsupported_kube_api_get:${rest.join(" ")}`);
  if (rest[1] === "deployment" && rest[2]) {
    const result = await kubeApiRequest(config, `/apis/apps/v1/namespaces/${namespace}/deployments/${rest[2]}`);
    assert(result.status === 200, `kube_api_get_deployment_failed:${result.status}:${result.bodyText.slice(0, 240)}`);
    return result.json;
  }
  if (rest[1] === "pods") {
    const labelSelector = rest[2] === "-l" ? rest[3] || "" : "";
    const result = await kubeApiRequest(config, `/api/v1/namespaces/${namespace}/pods`, {
      query: labelSelector ? { labelSelector } : {},
    });
    assert(result.status === 200, `kube_api_get_pods_failed:${result.status}:${result.bodyText.slice(0, 240)}`);
    return result.json;
  }
  if (rest[1] === "configmap" && rest[2]) {
    const result = await kubeApiRequest(config, `/api/v1/namespaces/${namespace}/configmaps/${rest[2]}`);
    assert(result.status === 200, `kube_api_get_configmap_failed:${result.status}:${result.bodyText.slice(0, 240)}`);
    return result.json;
  }
  if (rest[1] === "secret" && rest[2]) {
    const result = await kubeApiRequest(config, `/api/v1/namespaces/${namespace}/secrets/${rest[2]}`);
    assert(result.status === 200, `kube_api_get_secret_failed:${result.status}:${result.bodyText.slice(0, 240)}`);
    return result.json;
  }
  throw new Error(`unsupported_kube_api_args:${rest.join(" ")}`);
}

async function execKubectl(config, args, options = {}) {
  if (!await kubectlAvailable(config)) {
    throw new Error("kubectl_unavailable");
  }
  const finalArgs = [
    "--kubeconfig",
    config.kubeconfig,
    "--server",
    config.kubeServerOverride,
    ...args,
  ];
  const { stdout } = await execFileAsync(config.kubectlBin, finalArgs, {
    encoding: "utf8",
    timeout: options.timeoutMs || kubectlExecTimeoutMs,
    maxBuffer: options.maxBuffer || kubectlMaxBuffer,
  });
  return stdout;
}

async function kubectlJson(config, args, options = {}) {
  if (!await kubectlAvailable(config)) {
    return kubectlJsonViaApi(config, args);
  }
  return withJsonOutput(await execKubectl(config, [...args, "-o", "json"], options));
}

async function kubectlRolloutStatus(config, timeoutMs) {
  if (!await kubectlAvailable(config)) {
    await waitForDeploymentReady(config, timeoutMs);
    return "kube_api_wait_ready";
  }
  return execKubectl(config, [
    "-n",
    config.namespace,
    "rollout",
    "status",
    `deployment/${config.deployment}`,
    `--timeout=${Math.max(1, Math.ceil(timeoutMs / 1000))}s`,
  ], { timeoutMs: timeoutMs + 5_000 });
}

async function kubectlSecretMetadata(config, name) {
  if (!await kubectlAvailable(config)) {
    try {
      const secret = await kubectlJsonViaApi(config, [
        "-n",
        config.namespace,
        "get",
        "secret",
        name,
      ]);
      return {
        ok: Boolean(secret?.metadata?.name),
        name: String(secret?.metadata?.name || name),
        type: String(secret?.type || ""),
        uid: String(secret?.metadata?.uid || ""),
      };
    } catch (error) {
      return {
        ok: false,
        name,
        error: String(error.message || error),
      };
    }
  }
  try {
    const raw = await execKubectl(config, [
      "-n",
      config.namespace,
      "get",
      "secret",
      name,
      "-o",
      "jsonpath={.metadata.name}{\"\\t\"}{.type}{\"\\t\"}{.metadata.uid}",
    ]);
    const [secretName = "", type = "", uid = ""] = String(raw || "").split("\t");
    return {
      ok: Boolean(secretName),
      name: secretName,
      type,
      uid,
    };
  } catch (error) {
    return {
      ok: false,
      name,
      error: String(error.stderr || error.stdout || error.message || error),
    };
  }
}

function deploymentSelector(deployment) {
  const matchLabels = deployment?.spec?.selector?.matchLabels || {};
  const entries = Object.entries(matchLabels).filter(([, value]) => String(value || "") !== "");
  assert(entries.length > 0, "deployment_selector_missing");
  return entries.map(([key, value]) => `${key}=${value}`).join(",");
}

function summarizePod(pod = {}) {
  const statuses = Array.isArray(pod?.status?.containerStatuses) ? pod.status.containerStatuses : [];
  const readyContainers = statuses.filter((item) => item.ready === true).length;
  return {
    name: pod?.metadata?.name || "",
    uid: pod?.metadata?.uid || "",
    phase: pod?.status?.phase || "",
    ready: statuses.length > 0 && readyContainers === statuses.length,
    readyContainers: `${readyContainers}/${statuses.length}`,
    restartCount: statuses.reduce((sum, item) => sum + Number(item?.restartCount || 0), 0),
    createdAt: pod?.metadata?.creationTimestamp || "",
  };
}

function summarizePods(pods = []) {
  return [...pods]
    .filter((item) => item?.metadata?.deletionTimestamp == null)
    .map(summarizePod)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function podUidSet(pods = []) {
  return new Set(pods.map((item) => item.uid).filter(Boolean));
}

function allReadyPods(pods = []) {
  return pods.length > 0 && pods.every((item) => item.ready === true && item.phase === "Running");
}

function disjointPodSets(beforeSet, afterSet) {
  for (const value of afterSet) {
    if (beforeSet.has(value)) return false;
  }
  return afterSet.size > 0;
}

function summarizeDeployment(deployment = {}) {
  const specReplicas = Number(deployment?.spec?.replicas || 0);
  const status = deployment?.status || {};
  const conditions = new Map(
    Array.isArray(status.conditions)
      ? status.conditions.map((item) => [item.type, item.status])
      : [],
  );
  return {
    namespace: deployment?.metadata?.namespace || "",
    name: deployment?.metadata?.name || "",
    generation: Number(deployment?.metadata?.generation || 0),
    observedGeneration: Number(status.observedGeneration || 0),
    replicas: specReplicas,
    readyReplicas: Number(status.readyReplicas || 0),
    updatedReplicas: Number(status.updatedReplicas || 0),
    availableReplicas: Number(status.availableReplicas || 0),
    progressing: conditions.get("Progressing") || "",
    available: conditions.get("Available") || "",
  };
}

async function getDeploymentAndPods(config) {
  const deployment = await kubectlJson(config, [
    "-n",
    config.namespace,
    "get",
    "deployment",
    config.deployment,
  ]);
  const selector = deploymentSelector(deployment);
  const podsJson = await kubectlJson(config, [
    "-n",
    config.namespace,
    "get",
    "pods",
    "-l",
    selector,
  ]);
  return {
    selector,
    deployment,
    deploymentSummary: summarizeDeployment(deployment),
    pods: summarizePods(podsJson.items || []),
  };
}

async function waitForDeploymentReady(config, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastSummary = null;
  while (Date.now() < deadline) {
    const current = await getDeploymentAndPods(config);
    lastSummary = current.deploymentSummary;
    const ready = current.deploymentSummary.replicas > 0 &&
      current.deploymentSummary.readyReplicas === current.deploymentSummary.replicas &&
      current.deploymentSummary.updatedReplicas === current.deploymentSummary.replicas &&
      current.deploymentSummary.availableReplicas === current.deploymentSummary.replicas &&
      allReadyPods(current.pods);
    if (ready) return current;
    await sleep(config.pollMs);
  }
  throw new Error(`deployment_not_ready:${stableJson(lastSummary)}`);
}

function pickContainer(config, deployment) {
  const containers = deployment?.spec?.template?.spec?.containers || [];
  assert(containers.length > 0, "portal_container_missing");
  const requestedName = String(process.env.PORTAL_CONTAINER_NAME || "").trim();
  if (requestedName) {
    const matched = containers.find((item) => item.name === requestedName);
    assert(matched, `portal_container_not_found:${requestedName}`);
    return matched;
  }
  if (containers.length === 1) return containers[0];
  const exact = containers.find((item) => item.name === config.deployment);
  if (exact) return exact;
  const portalNamed = containers.find((item) => item.name.includes("portal"));
  if (portalNamed) return portalNamed;
  throw new Error(`portal_container_ambiguous:${containers.map((item) => item.name).join(",")}`);
}

function envEntryMap(container = {}) {
  return new Map((container.env || []).map((item) => [item.name, item]));
}

function secretRefNames(container = {}) {
  const names = new Set();
  for (const envFrom of container.envFrom || []) {
    const name = envFrom?.secretRef?.name;
    if (name) names.add(String(name));
  }
  for (const entry of container.env || []) {
    const name = entry?.valueFrom?.secretKeyRef?.name;
    if (name) names.add(String(name));
  }
  return [...names].sort();
}

async function resolveConfigMapValue(config, name, key, cache) {
  const cacheKey = `${name}:${key}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const configMap = await kubectlJson(config, [
    "-n",
    config.namespace,
    "get",
    "configmap",
    name,
  ]);
  const value = String(configMap?.data?.[key] || "");
  cache.set(cacheKey, value);
  return value;
}

async function restartDeploymentViaApi(config) {
  const body = JSON.stringify({
    spec: {
      template: {
        metadata: {
          annotations: {
            "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
          },
        },
      },
    },
  });
  const result = await kubeApiRequest(
    config,
    `/apis/apps/v1/namespaces/${config.namespace}/deployments/${config.deployment}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/strategic-merge-patch+json",
      },
      body,
      timeoutMs: kubectlExecTimeoutMs,
    },
  );
  assert(result.status >= 200 && result.status < 300, `kube_api_restart_failed:${result.status}:${result.bodyText.slice(0, 240)}`);
}

async function resolveEnvValue(config, container, name, configMapCache) {
  const entry = envEntryMap(container).get(name);
  if (!entry) return { found: false, source: "missing", value: "" };
  if (Object.prototype.hasOwnProperty.call(entry, "value")) {
    return { found: true, source: "literal", value: String(entry.value || "") };
  }
  const configMapRef = entry?.valueFrom?.configMapKeyRef;
  if (configMapRef?.name && configMapRef?.key) {
    return {
      found: true,
      source: "configMapKeyRef",
      configMapName: String(configMapRef.name),
      configMapKey: String(configMapRef.key),
      value: await resolveConfigMapValue(config, String(configMapRef.name), String(configMapRef.key), configMapCache),
    };
  }
  const secretRef = entry?.valueFrom?.secretKeyRef;
  if (secretRef?.name) {
    return {
      found: true,
      source: "secretKeyRef",
      secretName: String(secretRef.name),
      secretKey: String(secretRef.key || ""),
      value: "",
    };
  }
  return { found: true, source: "unresolved", value: "" };
}

async function inspectPortalDeployment(config) {
  const configMapCache = new Map();
  const current = await waitForDeploymentReady(config, 90_000);
  await kubectlRolloutStatus(config, 30_000);
  const container = pickContainer(config, current.deployment);
  const referencedSecretNames = secretRefNames(container);
  const databaseSecretReferenced = referencedSecretNames.includes(config.databaseSecretName);
  const storageMode = await resolveEnvValue(config, container, "PORTAL_STORAGE_MODE", configMapCache);
  assert(storageMode.found, "PORTAL_STORAGE_MODE_env_missing");
  assert(storageMode.value === "postgres_redis", `PORTAL_STORAGE_MODE_not_postgres_redis:${storageMode.value || storageMode.source}`);

  let postgresUrl = await resolveEnvValue(config, container, "PORTAL_POSTGRES_URL", configMapCache);
  let redisUrl = await resolveEnvValue(config, container, "PORTAL_REDIS_URL", configMapCache);
  if (!postgresUrl.found && databaseSecretReferenced) {
    postgresUrl = {
      found: true,
      source: "envFromSecretRef",
      secretName: config.databaseSecretName,
      value: "",
    };
  }
  if (!redisUrl.found && databaseSecretReferenced) {
    redisUrl = {
      found: true,
      source: "envFromSecretRef",
      secretName: config.databaseSecretName,
      value: "",
    };
  }
  assert(postgresUrl.found, "PORTAL_POSTGRES_URL_env_missing");
  assert(redisUrl.found, "PORTAL_REDIS_URL_env_missing");
  assert(postgresUrl.source !== "literal", "PORTAL_POSTGRES_URL_must_not_be_literal");
  assert(redisUrl.source !== "literal", "PORTAL_REDIS_URL_must_not_be_literal");

  assert(databaseSecretReferenced, `${config.databaseSecretName}_not_referenced_by_portal_container`);

  const secretChecks = [];
  for (const secretName of config.secretNames) {
    secretChecks.push(await kubectlSecretMetadata(config, secretName));
  }
  const missingSecrets = secretChecks.filter((item) => !item.ok).map((item) => item.name);
  assert(missingSecrets.length === 0, `required_secrets_missing:${missingSecrets.join(",")}`);

  return {
    deployment: current.deploymentSummary,
    selector: current.selector,
    pods: current.pods,
    container: {
      name: container.name,
      image: container.image || "",
      referencedSecretNames,
    },
    storageMode,
    connectionRefs: {
      postgresUrl,
      redisUrl,
    },
    secrets: secretChecks.map((item) => ({
      name: item.name,
      type: item.type,
      uid: item.uid,
    })),
  };
}

async function waitForPortalHealth(config) {
  const deadline = Date.now() + config.portalHealthTimeoutMs;
  let lastStatus = "unreachable";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${config.baseUrl}/healthz`, {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      lastStatus = String(response.status);
      if (response.status === 200) return;
    } catch (error) {
      lastStatus = String(error.message || error);
    }
    await sleep(config.pollMs);
  }
  throw new Error(`portal_healthz_unavailable:${lastStatus}`);
}

async function readPortalHealth(config) {
  const response = await fetch(`${config.baseUrl}/healthz`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  const bodyText = await response.text();
  assert(response.status === 200, `portal_healthz_unexpected_status:${response.status}:${bodyText.slice(0, 240)}`);
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  assert(json?.ok === true, `portal_healthz_payload_invalid:${bodyText.slice(0, 240)}`);
  return {
    build: {
      sha: String(json?.build?.sha || ""),
      time: String(json?.build?.time || ""),
    },
    identity: {
      ssoMode: String(json?.identity?.ssoMode || ""),
      identitySyncMode: String(json?.identity?.identitySyncMode || ""),
      oplWebAuthMode: String(json?.identity?.oplWebAuthMode || ""),
    },
    storage: {
      storageMode: String(json?.storage?.storageMode || ""),
    },
  };
}

async function apiJson(config, pathname, cookie, timeoutMs = 30_000) {
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
    },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const bodyText = await response.text();
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {}
  assert(response.status === 200, `portal_api_failed:${pathname}:${summarizeStatus(response.status, bodyText)}`);
  return json;
}

function selectOne(items, label, identifier = "", resolver = (item) => item?.id || "") {
  const rows = Array.isArray(items) ? items : [];
  if (identifier) {
    const matched = rows.find((item) => String(resolver(item)) === identifier);
    assert(matched, `${label}_not_found:${identifier}`);
    return matched;
  }
  assert(rows.length > 0, `${label}_missing`);
  assert(rows.length === 1, `${label}_ambiguous:${rows.map((item) => resolver(item)).join(",")}`);
  return rows[0];
}

function traceIdentity(trace = {}) {
  return String(trace.sessionId || trace.workspaceSessionId || trace.runId || "").trim();
}

function sessionIdentity(session = {}) {
  return String(session.workspaceSessionId || session.sessionId || "").trim();
}

function normalizeUserSnapshot(me = {}) {
  return {
    id: String(me.id || ""),
    email: String(me.email || ""),
    name: String(me.name || ""),
    role: String(me.role || ""),
    status: String(me.status || ""),
    accountStatus: String(me.accountStatus || ""),
    billingStatus: String(me.billingStatus || ""),
  };
}

function normalizeWalletSnapshot(billing = {}) {
  return {
    balance: Number(billing?.wallet?.balance || 0),
    activeFreeze: Number(billing?.wallet?.activeFreeze || 0),
    availableBalance: Number(billing?.wallet?.availableBalance || 0),
    trialRemaining: Number(billing?.wallet?.trialRemaining || 0),
  };
}

function normalizeOrderSnapshot(order = {}) {
  return {
    id: String(order.id || order.resourceOrderId || ""),
    status: String(order.status || ""),
    workspaceId: String(order.workspaceId || ""),
    workspaceSessionId: String(order.workspaceSessionId || ""),
    runId: String(order.runId || ""),
    serverPlanId: String(order.serverPlanId || ""),
    region: String(order.region || ""),
    zone: String(order.zone || ""),
    storagePlanId: String(order.storagePlanId || ""),
    storageSizeGb: Number(order.storageSizeGb || 0),
    quoteAmount: Number(order.quoteAmount ?? order.quotedAmount ?? 0),
    freezeAmount: Number(order.freezeAmount ?? order.frozenAmount ?? 0),
    exactCost: order.exactCost == null ? null : Number(order.exactCost),
    pricingSource: String(order.pricingSource || ""),
    createdAt: String(order.createdAt || ""),
    updatedAt: String(order.updatedAt || ""),
  };
}

function normalizeFileSnapshot(file = {}) {
  return {
    id: String(file.id || ""),
    workspaceId: String(file.workspaceId || ""),
    kind: String(file.kind || ""),
    name: String(file.name || ""),
    relativePath: String(file.relativePath || ""),
    storageKey: String(file.storageKey || ""),
    sizeBytes: Number(file.sizeBytes || 0),
    checksum: String(file.checksum || ""),
    contentType: String(file.contentType || ""),
    status: String(file.status || ""),
    source: String(file.source || ""),
    updatedAt: String(file.updatedAt || ""),
  };
}

function normalizeTraceSnapshot(trace = {}) {
  return {
    identity: traceIdentity(trace),
    workspaceId: String(trace.workspaceId || ""),
    runId: String(trace.runId || ""),
    sessionId: String(trace.sessionId || trace.workspaceSessionId || ""),
    title: String(trace.title || ""),
    businessStatus: String(trace.businessStatus || trace.status || ""),
    traceCount: Number(trace.traceCount || 0),
    startedAt: String(trace.startedAt || trace.createdAt || ""),
    dataSource: String(trace.dataSource || ""),
  };
}

function normalizeWorkspaceSessionSnapshot(session = null) {
  if (!session) return null;
  return {
    identity: sessionIdentity(session),
    workspaceId: String(session.workspaceId || ""),
    status: String(session.status || ""),
    lastUsedAt: String(session.lastUsedAt || ""),
    expiresAt: String(session.expiresAt || ""),
  };
}

async function collectPortalState(config, cookie) {
  const [me, billing, ordersPayload, storage, tracesPayload, sessionsPayload] = await Promise.all([
    apiJson(config, "/portal/api/me", cookie),
    apiJson(config, "/portal/api/billing", cookie),
    apiJson(config, "/portal/api/resource-orders", cookie),
    apiJson(config, `/portal/api/workspace/storage?task=${encodeURIComponent(config.workspaceId)}`, cookie),
    apiJson(config, `/portal/api/session-traces?workspaceId=${encodeURIComponent(config.workspaceId)}&page_size=200`, cookie),
    apiJson(config, "/portal/api/sessions?page_size=200", cookie),
  ]);

  const orders = (ordersPayload?.items || []).filter((item) => item.workspaceId === config.workspaceId);
  const selectedOrder = selectOne(
    orders,
    "resource_order",
    config.resourceOrderId,
    (item) => String(item.id || item.resourceOrderId || ""),
  );

  const metadata = (storage?.metadata || []).filter((item) => item.workspaceId === config.workspaceId);
  const selectedFile = selectOne(
    metadata,
    "workspace_file_metadata",
    config.fileRelativePath,
    (item) => String(item.relativePath || ""),
  );

  const traces = (tracesPayload?.items || []).filter((item) => item.workspaceId === config.workspaceId);
  const selectedTrace = selectOne(
    traces,
    "session_trace",
    config.traceSessionId,
    (item) => traceIdentity(item),
  );

  const sessions = Array.isArray(sessionsPayload?.sessions) ? sessionsPayload.sessions : [];
  const workspaceSessions = sessions.filter((item) => item.workspaceId === config.workspaceId);
  let selectedWorkspaceSession = null;
  if (config.workspaceSessionId) {
    selectedWorkspaceSession = selectOne(
      workspaceSessions,
      "workspace_session",
      config.workspaceSessionId,
      (item) => sessionIdentity(item),
    );
  } else if (workspaceSessions.length === 1) {
    selectedWorkspaceSession = workspaceSessions[0];
  }

  return {
    snapshot: {
      user: normalizeUserSnapshot(me),
      wallet: normalizeWalletSnapshot(billing),
      order: normalizeOrderSnapshot(selectedOrder),
      file: normalizeFileSnapshot(selectedFile),
      trace: normalizeTraceSnapshot(selectedTrace),
      session: {
        portalSessionValid: true,
        sessionsApiTotal: Number(sessionsPayload?.pagination?.total ?? sessions.length),
        workspaceSession: normalizeWorkspaceSessionSnapshot(selectedWorkspaceSession),
      },
    },
    raw: {
      me,
      billing,
      ordersPayload,
      storage,
      tracesPayload,
      sessionsPayload,
    },
  };
}

function diffObjects(before, after, prefix = "") {
  if (before === after) return [];
  const beforeIsObject = before && typeof before === "object" && !Array.isArray(before);
  const afterIsObject = after && typeof after === "object" && !Array.isArray(after);
  if (beforeIsObject && afterIsObject) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const differences = [];
    for (const key of [...keys].sort()) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      differences.push(...diffObjects(before[key], after[key], nextPrefix));
    }
    return differences;
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    return stableJson(before) === stableJson(after)
      ? []
      : [`${prefix}:before=${stableJson(before)};after=${stableJson(after)}`];
  }
  return [`${prefix}:before=${String(before)};after=${String(after)}`];
}

async function waitForManualOrScriptedRestart(config, beforePods) {
  const beforeSet = podUidSet(beforePods);
  if (config.allowKubectlRestart) {
    if (await kubectlAvailable(config)) {
      await execKubectl(config, [
        "-n",
        config.namespace,
        "rollout",
        "restart",
        `deployment/${config.deployment}`,
      ]);
    } else {
      await restartDeploymentViaApi(config);
    }
  } else {
    console.error([
      "waiting_for_manual_restart",
      `namespace=${config.namespace}`,
      `deployment=${config.deployment}`,
      `expectedPodReplacementTimeoutMs=${config.restartObservationTimeoutMs}`,
    ].join(" "));
  }

  const deadline = Date.now() + config.restartObservationTimeoutMs;
  let lastPods = beforePods;
  while (Date.now() < deadline) {
    const current = await getDeploymentAndPods(config);
    lastPods = current.pods;
    const afterSet = podUidSet(current.pods);
    if (allReadyPods(current.pods) && disjointPodSets(beforeSet, afterSet)) {
      await kubectlRolloutStatus(config, Math.max(10_000, deadline - Date.now()));
      return {
        deployment: current.deploymentSummary,
        pods: current.pods,
      };
    }
    await sleep(config.pollMs);
  }

  throw new Error(`portal_restart_not_observed:${stableJson(lastPods)}`);
}

async function buildConfig() {
  if (String(process.env.RUN_PORTAL_RECOVERY_LIVE || "").trim() !== "1") {
    skip("RUN_PORTAL_RECOVERY_LIVE!=1");
  }

  const fixtureEnv = await loadFixtureEnvFile();
  const envValue = (name, fallback = "") => String(process.env[name] || fixtureEnv[name] || fallback).trim();
  const requiredSetting = (name) => {
    const value = envValue(name);
    assert(value, `${name}_required`);
    return value;
  };

  const databaseSecretName = envValue("PORTAL_RECOVERY_DATABASE_SECRET_NAME", "portal-postgres-redis-secret") || "portal-postgres-redis-secret";
  const config = {
    baseUrl: trimTrailingSlash(envValue("PORTAL_BASE_URL", "https://portal.medopl.cn")),
    loginMode: envValue("PORTAL_TEST_LOGIN", "oidc").toLowerCase(),
    userEmail: requiredSetting("PORTAL_RECOVERY_USER_EMAIL"),
    userPassword: requiredSetting("PORTAL_RECOVERY_USER_PASSWORD"),
    workspaceId: requiredSetting("PORTAL_RECOVERY_WORKSPACE_ID"),
    resourceOrderId: envValue("PORTAL_RECOVERY_RESOURCE_ORDER_ID"),
    fileRelativePath: envValue("PORTAL_RECOVERY_FILE_RELATIVE_PATH"),
    traceSessionId: envValue("PORTAL_RECOVERY_TRACE_SESSION_ID"),
    workspaceSessionId: envValue("PORTAL_RECOVERY_WORKSPACE_SESSION_ID"),
    namespace: envValue("PORTAL_NAMESPACE", "default") || "default",
    deployment: envValue("PORTAL_DEPLOYMENT", "portal-opl") || "portal-opl",
    kubectlBin: envValue("PORTAL_RECOVERY_KUBECTL_BIN", process.env.KUBECTL_BIN || "kubectl") || "kubectl",
    kubeconfig: envValue("PORTAL_RECOVERY_KUBECONFIG", envValue("KUBECONFIG", "/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)")),
    kubeServerOverride: envValue("PORTAL_RECOVERY_KUBE_SERVER_OVERRIDE", envValue("KUBE_SERVER_OVERRIDE", "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443")),
    databaseSecretName,
    secretNames: splitCsv(envValue("PORTAL_RECOVERY_SECRET_NAMES"), [databaseSecretName, ...defaultAuxSecretNames]),
    portalHealthTimeoutMs: positiveInt(envValue("PORTAL_RECOVERY_HEALTH_TIMEOUT_MS"), 180_000),
    restartObservationTimeoutMs: positiveInt(envValue("PORTAL_RECOVERY_WAIT_TIMEOUT_MS"), 20 * 60 * 1000),
    pollMs: positiveInt(envValue("PORTAL_RECOVERY_POLL_MS"), 4_000),
    loginTimeoutMs: positiveInt(envValue("PORTAL_RECOVERY_LOGIN_TIMEOUT_MS"), 120_000),
    expectPostRestart: envValue("PORTAL_RECOVERY_EXPECT_POST_RESTART") === "1",
    allowKubectlRestart: envValue("PORTAL_RECOVERY_ALLOW_KUBECTL_RESTART") === "1",
    fixtureFile: envValue("PORTAL_RECOVERY_FIXTURE_FILE"),
  };

  if (String(process.env.PORTAL_IGNORE_TLS_ERRORS || "1").trim() === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  if (config.allowKubectlRestart) {
    config.expectPostRestart = true;
  }

  return config;
}

async function main() {
  const config = await buildConfig();
  const cluster = await inspectPortalDeployment(config);
  await waitForPortalHealth(config);
  const portalHealth = await readPortalHealth(config);
  const cookie = await createPortalSessionCookie({
    baseUrl: config.baseUrl,
    loginMode: config.loginMode,
    email: config.userEmail,
    password: config.userPassword,
    timeoutMs: config.loginTimeoutMs,
  });
  const baseline = await collectPortalState(config, cookie);

  if (!config.expectPostRestart) {
    console.log(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "PORTAL_RECOVERY_EXPECT_POST_RESTART!=1",
      liveGuard: "pass",
      fixtureFile: config.fixtureFile || null,
      portalHealth,
      cluster,
      baseline: baseline.snapshot,
      nextAction: {
        manualRestart: [
          `kubectl --kubeconfig "${config.kubeconfig}" --server "${config.kubeServerOverride}" rollout restart deploy/${config.deployment} -n ${config.namespace}`,
          `kubectl --kubeconfig "${config.kubeconfig}" --server "${config.kubeServerOverride}" rollout status deploy/${config.deployment} -n ${config.namespace}`,
        ],
        rerun: "Set PORTAL_RECOVERY_EXPECT_POST_RESTART=1 and rerun this script to complete before/after comparison.",
      },
    }, null, 2));
    return;
  }

  const restart = await waitForManualOrScriptedRestart(config, cluster.pods);
  await waitForPortalHealth(config);
  const after = await collectPortalState(config, cookie);

  const differences = diffObjects(baseline.snapshot, after.snapshot);
  assert(differences.length === 0, `portal_recovery_state_mismatch:${differences.join(" | ")}`);

  console.log(JSON.stringify({
    ok: true,
    skipped: false,
    gate: "portal_postgres_redis_restart_recovery",
    fixtureFile: config.fixtureFile || null,
    portalHealth,
    cluster: {
      ...cluster,
      postRestart: restart,
    },
    baseline: baseline.snapshot,
    after: after.snapshot,
    comparison: {
      matched: true,
      differences: [],
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error.message || error),
  }, null, 2));
  process.exitCode = 1;
});
