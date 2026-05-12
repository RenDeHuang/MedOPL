import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultManifestPath = path.join(repoRoot, "docs/recovery/v22-cloud-harness-manifest.json");

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function pathMatches(pattern = "", changedPath = "") {
  const normalizedPattern = pattern.replace(/\\/g, "/");
  const normalizedPath = changedPath.replace(/\\/g, "/");
  if (normalizedPattern.endsWith("/*")) {
    return normalizedPath.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedPattern === normalizedPath || normalizedPath.startsWith(`${normalizedPattern}/`);
}

function gateMatchesChangedPath(gate = {}, changedPaths = []) {
  return changedPaths.some((changedPath) => (gate.ownedPaths || []).some((ownedPath) => pathMatches(ownedPath, changedPath)));
}

function expandCoupledGates(gates = [], selectedIds = []) {
  const ids = new Set(selectedIds);
  if (ids.has("L2b")) ids.add("L3");
  if (ids.has("L3")) ids.add("L2b");
  return gates.filter((gate) => ids.has(gate.id));
}

export function selectCloudHarnessChecks({ manifest, changedPaths = [] } = {}) {
  const gates = Array.isArray(manifest?.gates) ? manifest.gates : [];
  const matched = gates.filter((gate) => gateMatchesChangedPath(gate, changedPaths));
  const selected = expandCoupledGates(gates, matched.map((gate) => gate.id));
  const fallback = selected.length ? selected : gates.filter((gate) => gate.id === "L1");
  const requiresUserAuthorization = fallback.some((gate) => /real_cloud|mutation_secret|live|billing_read/.test(String(gate.authorizationBoundary || "")));
  return {
    programId: manifest?.programId || "",
    requiredGates: unique(fallback.map((gate) => gate.id)),
    requiredSmoke: unique(fallback.flatMap((gate) => gate.requiredSmoke || [])),
    requiredEvidence: unique(fallback.flatMap((gate) => gate.requiredEvidence || [])),
    forbiddenPaths: unique(manifest?.forbiddenPaths || []),
    cleanupRequired: fallback.some((gate) => Boolean(gate.cleanupRequired)),
    requiresUserAuthorization,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const changedIndex = args.indexOf("--changed");
  const changedPaths = changedIndex >= 0 ? args.slice(changedIndex + 1).filter((item) => !item.startsWith("--")) : [];
  const manifest = JSON.parse(await readFile(defaultManifestPath, "utf8"));
  const selection = selectCloudHarnessChecks({ manifest, changedPaths });
  console.log(JSON.stringify({ ok: true, ...selection }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
