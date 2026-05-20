import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const SMOKE_CATEGORIES = Object.freeze([
  "default/local-contract",
  "portal-local",
  "opl-local",
  "cloud-future-authorized",
]);

export const SMOKE_EVAL_TIERS = Object.freeze([
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "future-authorized",
]);

export const SMOKE_EVAL_SURFACES = Object.freeze([
  "control-plane",
  "portal",
  "opl",
  "runtime-bridge",
  "cloud",
]);

export const SMOKE_EVAL_ENTRY_KINDS = Object.freeze([
  "atomic",
  "suite-wrapper",
  "gate-self-test",
]);

export const SMOKE_EVAL_AUTHORIZATIONS = Object.freeze([
  "none",
  "future-authorized",
]);

export const DEFAULT_SMOKE_CATEGORIES = Object.freeze([
  "default/local-contract",
  "portal-local",
  "opl-local",
]);

export const HEALTH_CHECK_MAX = 6;
export const SMOKE_GOLDEN_MIN = 8;
export const SMOKE_GOLDEN_MAX = 15;

export const SMOKE_GOLDEN_SCRIPTS = Object.freeze([
  "tests/smoke/smoke-test-v22-managed-environment-open-flow.mjs",
  "tests/smoke/smoke-test-v22-mvp-managed-opl-loop-contract.mjs",
  "tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs",
  "tests/smoke/smoke-test-v22-portal-files-billing-trace-flow.mjs",
  "tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs",
  "tests/smoke/smoke-test-v22-pricing-plan-contract.mjs",
  "tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs",
  "tests/smoke/smoke-test-v22-resource-plan-contract.mjs",
  "tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs",
  "tests/smoke/smoke-test-v22-user-credit-provider-key-flow.mjs",
]);

function normalizeSmokeScriptPath(scriptPath) {
  return String(scriptPath || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function listTestFiles(dir = path.join(repoRoot, "tests"), prefix = "tests") {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTestFiles(absolutePath, repoPath));
    } else if (/\.mjs$/u.test(entry.name)) {
      files.push(repoPath);
    }
  }
  return files.sort();
}

function exists(repoPath) {
  try {
    return statSync(path.join(repoRoot, repoPath)).isFile();
  } catch {
    return false;
  }
}

function categoryOf(scriptPath) {
  if (scriptPath.includes("/future-authorized/")) return "cloud-future-authorized";
  if (scriptPath.includes("/portal/")) return "portal-local";
  if (scriptPath.includes("/runtime-bridge/")) return "opl-local";
  if (scriptPath.includes("/opl/")) return "opl-local";
  const name = path.basename(scriptPath);
  if (/portal-opl|runtime-bridge|user-credit-provider-key|mvp-managed-opl/u.test(name)) return "opl-local";
  if (/managed-environment|portal-files|release-stop-billing/u.test(name)) return "portal-local";
  return "default/local-contract";
}

function surfaceOf(scriptPath, category) {
  if (category === "cloud-future-authorized") return "cloud";
  if (scriptPath.includes("/portal/")) return "portal";
  if (scriptPath.includes("/runtime-bridge/")) return "runtime-bridge";
  if (scriptPath.includes("/opl/")) return "opl";
  const name = path.basename(scriptPath);
  if (/runtime-bridge/u.test(name)) return "runtime-bridge";
  if (/portal-opl|opl|provider-key/u.test(name)) return "opl";
  if (/portal|managed-environment|billing|release-stop/u.test(name)) return "portal";
  return "control-plane";
}

function entryKindOf(scriptPath) {
  const name = path.basename(scriptPath);
  if (/suite/u.test(name)) return "suite-wrapper";
  if (/workflow-gate/u.test(name)) return "gate-self-test";
  return "atomic";
}

function tierOf(scriptPath, category) {
  if (scriptPath.startsWith("tests/health/")) return "health-check";
  if (SMOKE_GOLDEN_SCRIPTS.includes(scriptPath)) return "smoke-golden";
  if (category === "cloud-future-authorized") return "future-authorized";
  if (scriptPath.startsWith("tests/regression/")) return "local-regression";
  return "contract-local";
}

export const HEALTH_CHECK_SCRIPTS = Object.freeze(
  listTestFiles()
    .filter((scriptPath) => scriptPath.startsWith("tests/health/"))
    .sort(),
);

export const SMOKE_SUITE_ENTRYPOINTS = Object.freeze([
  "tests/future-authorized/cloud/future-authorized-test-v22-cloud-resource-contract-suite.mjs",
  "tests/contract/contract-test-v22-golden-smoke-suite.mjs",
  "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
  "tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs",
].filter(exists));

export const SMOKE_CLASSIFICATION = Object.freeze(Object.fromEntries(
  listTestFiles()
    .filter((scriptPath) => !scriptPath.startsWith("tests/fixtures/"))
    .map((scriptPath) => [scriptPath, categoryOf(scriptPath)]),
));

export function smokeCategoryOf(scriptPath) {
  return SMOKE_CLASSIFICATION[normalizeSmokeScriptPath(scriptPath)] || "";
}

export function smokeEvalMetadataOf(scriptPath) {
  const normalized = normalizeSmokeScriptPath(scriptPath);
  const category = smokeCategoryOf(normalized);
  const tier = tierOf(normalized, category);
  const surface = surfaceOf(normalized, category);
  const entryKind = entryKindOf(normalized);
  const authorization = category === "cloud-future-authorized" ? "future-authorized" : "none";
  return Object.freeze({
    scriptPath: normalized,
    category,
    tier,
    surface,
    entryKind,
    authorization,
    contractRefs: Object.freeze(["docs/specs/README.md"]),
  });
}

export function listClassifiedSmokeScripts({ categories = SMOKE_CATEGORIES } = {}) {
  const allowed = new Set(categories);
  return Object.entries(SMOKE_CLASSIFICATION)
    .filter(([, category]) => allowed.has(category))
    .map(([scriptPath]) => scriptPath)
    .sort();
}

export function listSmokeEvalScripts({ tiers = SMOKE_EVAL_TIERS, surfaces = SMOKE_EVAL_SURFACES } = {}) {
  const allowedTiers = new Set(tiers);
  const allowedSurfaces = new Set(surfaces);
  return Object.keys(SMOKE_CLASSIFICATION)
    .filter((scriptPath) => {
      const metadata = smokeEvalMetadataOf(scriptPath);
      return allowedTiers.has(metadata.tier) && allowedSurfaces.has(metadata.surface);
    })
    .sort();
}

export function isSmokeClassifiedIn(scriptPath, { categories = DEFAULT_SMOKE_CATEGORIES } = {}) {
  const allowed = new Set(categories);
  return allowed.has(smokeCategoryOf(scriptPath));
}
