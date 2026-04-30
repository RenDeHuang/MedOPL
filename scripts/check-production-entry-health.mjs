import dns from "node:dns/promises";
import { execFile } from "node:child_process";
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
  return String(host || "").toLowerCase() === "trace.medopl.cn"
    ? "/api/public/health"
    : "/healthz";
}

async function probeUrl(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual" });
    return {
      ok: response.status >= 200 && response.status < 500,
      status: response.status,
      location: response.headers.get("location") || "",
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
  const dnsResult = await dns.resolve4(host).then(
    (addresses) => ({ ok: true, addresses }),
    (error) => ({ ok: false, error: String(error.code || error.message || error) }),
  );
  const http = await probeUrl(`http://${host}${healthPath}`);
  const https = await probeUrl(`https://${host}${healthPath}`);
  return { host, healthPath, dns: dnsResult, http, https };
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

const failed = hostResults.some((item) => !item.dns.ok || !item.https.ok || Number(item.https.status || 0) >= 500)
  || (k8s && !k8s.ok);

console.log(JSON.stringify({
  ok: !failed,
  checkedAt: new Date().toISOString(),
  hosts: hostResults,
  k8s,
}, null, 2));

if (failed) process.exitCode = 1;
