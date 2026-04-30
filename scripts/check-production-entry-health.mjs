import dns from "node:dns/promises";
import { execFile } from "node:child_process";
import net from "node:net";
import tls from "node:tls";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_HOSTS = ["portal.medopl.cn", "opl.medopl.cn", "trace.medopl.cn"];

function parseArgs(argv) {
  const args = new Map();
  for (const item of argv) {
    const [key, value = ""] = String(item).split("=");
    args.set(key.replace(/^--/, ""), value || "1");
  }
  return args;
}

function hostsFromArgs(args) {
  const raw = args.get("hosts") || "";
  if (!raw) return DEFAULT_HOSTS;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function healthPathForHost(host) {
  return hostParts(host).hostname.toLowerCase() === "trace.medopl.cn"
    ? "/api/public/health"
    : "/healthz";
}

function hostParts(host, defaultPort = 443) {
  const raw = String(host || "").trim();
  const [hostname, portValue = ""] = raw.split(":");
  const port = Number(portValue || defaultPort);
  return { raw, hostname, port: Number.isFinite(port) && port > 0 ? port : defaultPort };
}

function probeTcp(host, port) {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 8000 });
    socket.once("connect", () => {
      const elapsedMs = Date.now() - started;
      socket.destroy();
      resolve({ ok: true, port, elapsedMs });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, port, error: "tcp_timeout", elapsedMs: Date.now() - started });
    });
    socket.once("error", (error) => {
      resolve({ ok: false, port, error: String(error.code || error.message || error), elapsedMs: Date.now() - started });
    });
  });
}

function probeTls(host, port) {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port, servername: host, timeout: 10000, rejectUnauthorized: false });
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const elapsedMs = Date.now() - started;
      socket.destroy();
      resolve({
        ok: true,
        port,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || "",
        subject: cert?.subject || {},
        validFrom: cert?.valid_from || "",
        validTo: cert?.valid_to || "",
        elapsedMs,
      });
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, port, error: "tls_timeout", elapsedMs: Date.now() - started });
    });
    socket.once("error", (error) => {
      resolve({ ok: false, port, error: String(error.code || error.message || error), elapsedMs: Date.now() - started });
    });
  });
}

async function probeUrl(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual" });
    const text = await response.text().catch(() => "");
    return {
      ok: response.status >= 200 && response.status < 500,
      status: response.status,
      location: response.headers.get("location") || "",
      contentType: response.headers.get("content-type") || "",
      contentLength: text.length,
      contentSample: text.slice(0, 160),
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error.message || error),
      elapsedMs: Date.now() - started,
    };
  }
}

async function checkHost(host) {
  const healthPath = healthPathForHost(host);
  const parsed = hostParts(host);
  const httpParts = hostParts(host, 80);
  const dnsResult = await dns.resolve4(parsed.hostname).then(
    (addresses) => ({ ok: true, addresses }),
    (error) => ({ ok: false, error: String(error.code || error.message || error) }),
  );
  const tcp80 = await probeTcp(httpParts.hostname, httpParts.port);
  const tcp443 = await probeTcp(parsed.hostname, parsed.port);
  const tls443 = process.argv.includes("--http-only") ? null : await probeTls(parsed.hostname, parsed.port);
  const http = await probeUrl(`http://${host}${healthPath}`);
  const https = process.argv.includes("--http-only") ? null : await probeUrl(`https://${host}${healthPath}`);
  return { host, hostname: parsed.hostname, healthPath, dns: dnsResult, tcp80, tcp443, tls443, http, https };
}

async function kubectlJson(args) {
  const namespace = args.get("namespace") || "default";
  const ingress = args.get("ingress") || "gaofenglab";
  const enabled = args.has("k8s") || args.has("kubectl");
  if (!enabled) return null;
  try {
    const [ingressOut, svcOut, epOut] = await Promise.all([
      execFileAsync("kubectl", ["get", "ingress", ingress, "-n", namespace, "-o", "json"]),
      execFileAsync("kubectl", ["get", "svc", "-n", namespace, "-o", "json"]),
      execFileAsync("kubectl", ["get", "endpoints", "-n", namespace, "-o", "json"]),
    ]);
    return {
      ok: true,
      namespace,
      ingress,
      ingress: JSON.parse(ingressOut.stdout || "{}"),
      services: JSON.parse(svcOut.stdout || "{}"),
      endpoints: JSON.parse(epOut.stdout || "{}"),
    };
  } catch (error) {
    return {
      ok: false,
      namespace,
      ingress,
      error: String(error.stderr || error.message || error),
    };
  }
}

function ingressConditions(ingress) {
  const conditionRaw = ingress?.metadata?.annotations?.["ingress.cloud.tencent.com/status.conditions"] || "[]";
  try {
    return JSON.parse(conditionRaw);
  } catch {
    return [];
  }
}

function ingressServiceNames(ingress) {
  const serviceNames = new Set();
  for (const rule of ingress?.spec?.rules || []) {
    for (const path of rule.http?.paths || []) {
      const name = path.backend?.service?.name;
      if (name) serviceNames.add(name);
    }
  }
  return serviceNames;
}

function endpointSummaries(endpoints, serviceNames) {
  return (endpoints?.items || [])
    .filter((item) => serviceNames.has(item.metadata?.name))
    .map((item) => ({
      name: item.metadata?.name,
      readyAddresses: (item.subsets || []).reduce((sum, subset) => sum + (subset.addresses || []).length, 0),
      ports: (item.subsets || []).flatMap((subset) => (subset.ports || []).map((port) => port.port)),
    }));
}

function summarizeK8s(k8s) {
  if (!k8s) return null;
  if (!k8s.ok) return k8s;
  const serviceNames = ingressServiceNames(k8s.ingress);
  return {
    ok: true,
    namespace: k8s.namespace,
    ingress: k8s.ingress,
    loadBalancer: k8s.ingress?.status?.loadBalancer || {},
    conditions: ingressConditions(k8s.ingress),
    services: [...serviceNames],
    endpoints: endpointSummaries(k8s.endpoints, serviceNames),
  };
}

const args = parseArgs(process.argv.slice(2));
const hosts = hostsFromArgs(args);
const hostResults = [];
for (const host of hosts) {
  hostResults.push(await checkHost(host));
}
const k8s = summarizeK8s(await kubectlJson(args));

const httpOnly = args.has("http-only");
const failed = hostResults.some((item) =>
  !item.dns.ok ||
  !item.tcp80.ok ||
  (!httpOnly && (!item.tcp443.ok || !item.tls443?.ok || !item.https?.ok || Number(item.https?.status || 0) >= 500)) ||
  (item.http && Number(item.http.status || 0) >= 500)
)
  || (k8s && !k8s.ok);

console.log(JSON.stringify({
  ok: !failed,
  checkedAt: new Date().toISOString(),
  hosts: hostResults,
  k8s,
}, null, 2));

if (failed) process.exitCode = 1;
