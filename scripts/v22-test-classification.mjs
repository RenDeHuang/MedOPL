import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_POLICY_SURFACE_COVERAGE } from "./v22-test-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const SMOKE_CATEGORIES = Object.freeze([
  "product",
  "frontend",
  "backend",
  "runtime",
  "release",
  "cloud",
  "hygiene",
  "smoke",
  "contract",
  "regression",
  "retired-governance",
  "suite-wrapper",
]);
export const SMOKE_EVAL_TIERS = Object.freeze([
  "product-contract",
  "frontend-contract",
  "backend-contract",
  "runtime-contract",
  "release-boundary",
  "cloud-boundary",
  "hygiene-check",
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "real-cloud-readiness",
  "future-authorized",
  "retired-governance",
]);
export const SMOKE_EVAL_SURFACES = Object.freeze(["control-plane", "portal", "opl", "runtime-bridge", "cloud"]);
export const SMOKE_EVAL_ENTRY_KINDS = Object.freeze(["atomic", "suite-wrapper", "gate-self-test"]);
export const SMOKE_EVAL_AUTHORIZATIONS = Object.freeze(["none", "future-authorized"]);
export const SMOKE_EVAL_LIFECYCLE_ROLES = Object.freeze([
  "current-owner",
  "negative-retirement-guard",
  "suite-wrapper",
  "real-cloud-readiness-boundary",
  "future-authorized-boundary",
  "retired-governance",
]);
export const TEST_LANES = Object.freeze([
  "product",
  "frontend",
  "backend",
  "runtime",
  "release",
  "cloud",
  "hygiene",
  "health",
  "smoke",
  "contract",
  "regression-portal",
  "regression-opl",
  "regression-runtime-bridge",
  "real-cloud-readiness",
  "future-authorized",
  "retired-governance",
]);
export const DEFAULT_SMOKE_CATEGORIES = Object.freeze(["product", "frontend", "backend", "runtime", "release", "hygiene", "smoke", "suite-wrapper"]);
export const HEALTH_CHECK_MAX = 12;
export const SMOKE_GOLDEN_MIN = 8;
export const SMOKE_GOLDEN_MAX = 15;
export const TEST_LIFECYCLE_CLEANUP_POLICY = Object.freeze({
  directCleanup: true,
  activeTestRequiresLaneOwner: true,
  activeTestRequiresCurrentOwnerSurface: true,
  historyKeepsSummaryOnly: true,
  gitHistoryKeepsDetails: true,
  duplicateAggregateAction: "merge-or-delete",
  lifecycleRoleAuthority: "TEST_LANE_REGISTRY",
});
export const TEST_LANE_CONTRACT_REFS = Object.freeze([
  "contracts/medopl-product-profile.json",
  "contracts/medopl-portal-page-state-matrix.json",
  "contracts/medopl-api-contract.json",
  "contracts/medopl-runtime-bridge-contract.json",
  "contracts/medopl-data-plane-contract.json",
  "contracts/medopl-billing-ledger-contract.json",
  "contracts/medopl-release-boundary.json",
  "contracts/medopl-cloud-boundary.json",
  "contracts/medopl-cloud-authorization-pack.json",
  "specs/product/spec.md",
  "specs/runtime/spec.md",
  "specs/operations/spec.md",
  "specs/source/spec.md",
  "specs/framework/spec.md",
  "specs/evidence/spec.md",
  "specs/policies/spec.md",
]);

const PRODUCT_FILES = Object.freeze(["tests/product/product-test-v22-medopl-contract-authority.mjs"]);
const FRONTEND_FILES = Object.freeze(["tests/frontend/frontend-test-v22-portal-page-state-matrix.mjs"]);
const BACKEND_FILES = Object.freeze(["tests/backend/backend-test-v22-api-contract.mjs"]);
const RUNTIME_FILES = Object.freeze(["tests/runtime/runtime-test-v22-runtime-bridge-product-boundary.mjs"]);
const RELEASE_FILES = Object.freeze(["tests/release/release-test-v22-boundary-contract.mjs"]);
const HYGIENE_FILES = Object.freeze(["tests/hygiene/hygiene-test-v22-secret-and-retired-changes-boundary.mjs"]);
const HEALTH_FILES = Object.freeze([
  "tests/health/health-check-v22-contract-conflict-boundary.mjs",
  "tests/health/health-check-v22-line-budget-gate.mjs",
  "tests/health/health-check-v22-repo-bloat-audit-gate.mjs",
  "tests/health/health-check-v22-repo-hygiene-gate.mjs",
  "tests/health/health-check-v22-smoke-classification-gate.mjs",
  "tests/health/health-check-v22-smoke-eval-boundary.mjs",
  "tests/health/health-check-v22-workflow-command-reference-gate.mjs",
  "tests/health/health-check-v22-zero-compat-active-surface-gate.mjs",
]);
const SMOKE_FILES = Object.freeze([
  "tests/smoke/smoke-test-v22-managed-environment-open-flow.mjs",
  "tests/smoke/smoke-test-v22-mvp-managed-opl-loop-contract.mjs",
  "tests/smoke/smoke-test-v22-managed-user-loop-contract.mjs",
  "tests/smoke/smoke-test-v22-portal-files-billing-trace-flow.mjs",
  "tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs",
  "tests/smoke/smoke-test-v22-pricing-plan-contract.mjs",
  "tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs",
  "tests/smoke/smoke-test-v22-resource-plan-contract.mjs",
  "tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs",
  "tests/smoke/smoke-test-v22-user-credit-provider-key-flow.mjs",
]);
const CLOUD_READINESS_FILES = Object.freeze(["tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs"]);
const CLOUD_FUTURE_FILES = Object.freeze([
  "tests/cloud/cloud-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs",
  "tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs",
]);
const CURRENT_GATE_FILES = Object.freeze(["tests/governance/governance-test-v22-validate-active-platform.mjs"]);

function normalizeSmokeScriptPath(scriptPath) {
  return String(scriptPath || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function listTestFiles(dir = path.join(repoRoot, "tests"), prefix = "tests") {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTestFiles(absolutePath, repoPath));
    if (entry.isFile() && /\.mjs$/u.test(entry.name)) files.push(repoPath);
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

function idForFile(file) {
  return file.replace(/^tests\//u, "").replace(/\.mjs$/u, "").replace(/[^a-zA-Z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

function lifecycleRoleForEntry({ authorization, entryKind, lane }) {
  if (lane === "retired-governance") return "retired-governance";
  if (authorization === "future-authorized") return "future-authorized-boundary";
  if (lane === "real-cloud-readiness") return "real-cloud-readiness-boundary";
  if (entryKind === "suite-wrapper") return "suite-wrapper";
  if (entryKind === "gate-self-test" || lane === "health" || lane === "hygiene") return "negative-retirement-guard";
  return "current-owner";
}

function surfaceForFile(file) {
  if (file.includes("/portal/") || file.startsWith("tests/frontend/") || file.startsWith("tests/regression/portal/")) return "portal";
  if (file.includes("/runtime-bridge/") || file.startsWith("tests/runtime/") || file.startsWith("tests/regression/runtime-bridge/")) return "runtime-bridge";
  if (file.startsWith("tests/cloud/") || file.startsWith("tests/release/")) return "cloud";
  if (file.startsWith("tests/regression/opl/") || file.includes("-opl-")) return "opl";
  return "control-plane";
}

function contractsForFile(file, surface) {
  const refs = new Set(["specs/framework/spec.md"]);
  if (file.startsWith("tests/product/")) refs.add("contracts/medopl-product-profile.json");
  if (file.startsWith("tests/frontend/")) refs.add("contracts/medopl-portal-page-state-matrix.json");
  if (file.startsWith("tests/backend/")) refs.add("contracts/medopl-api-contract.json");
  if (file.startsWith("tests/runtime/")) refs.add("contracts/medopl-runtime-bridge-contract.json");
  if (file.startsWith("tests/release/")) refs.add("contracts/medopl-release-boundary.json");
  if (file.startsWith("tests/cloud/")) refs.add("contracts/medopl-cloud-boundary.json");
  if (file.startsWith("tests/hygiene/")) refs.add("contracts/medopl-product-profile.json");
  if (surface === "portal") refs.add("specs/product/spec.md");
  if (surface === "runtime-bridge" || surface === "opl") refs.add("specs/runtime/spec.md");
  if (surface === "cloud") refs.add("specs/operations/spec.md");
  refs.add("specs/source/spec.md");
  return Object.freeze([...refs].sort());
}

function entryKindForFile(file) {
  if (file.startsWith("tests/suites/")) return "suite-wrapper";
  if (file.startsWith("tests/health/") || file.startsWith("tests/governance/") || file.startsWith("tests/hygiene/")) return "gate-self-test";
  return "atomic";
}

function categoryForEntry({ file, lane }) {
  if (file.startsWith("tests/suites/")) return "suite-wrapper";
  if (lane === "real-cloud-readiness" || lane === "future-authorized") return "cloud";
  if (lane.startsWith("regression-")) return "regression";
  if (lane === "health") return "hygiene";
  if (lane === "contract") return "contract";
  return lane;
}

function baseEntry(file, lane, tier, verifySuites = []) {
  const surface = surfaceForFile(file);
  const entryKind = entryKindForFile(file);
  const authorization = tier === "future-authorized" ? "future-authorized" : "none";
  const lifecycleRole = lifecycleRoleForEntry({ authorization, entryKind, lane });
  return Object.freeze({
    id: idForFile(file),
    file,
    lane,
    category: categoryForEntry({ file, lane }),
    tier,
    surface,
    entryKind,
    authorization,
    ownerSurface: `surface:${surface}`,
    lifecycleRole,
    contracts: contractsForFile(file, surface),
    verifySuites: Object.freeze([...verifySuites]),
  });
}

function explicitEntries() {
  return [
    ...PRODUCT_FILES.map((file) => baseEntry(file, "product", "product-contract", ["product", "current", "local-contract", "review"])),
    ...FRONTEND_FILES.map((file) => baseEntry(file, "frontend", "frontend-contract", ["frontend", "current", "local-contract", "review"])),
    ...BACKEND_FILES.map((file) => baseEntry(file, "backend", "backend-contract", ["backend", "current", "local-contract", "review"])),
    ...RUNTIME_FILES.map((file) => baseEntry(file, "runtime", "runtime-contract", ["runtime", "current", "local-contract", "review"])),
    ...RELEASE_FILES.map((file) => baseEntry(file, "release", "release-boundary", ["release", "current", "local-contract", "review"])),
    ...HYGIENE_FILES.map((file) => baseEntry(file, "hygiene", "hygiene-check", ["hygiene", "current", "health", "local-contract", "review"])),
    ...HEALTH_FILES.map((file) => baseEntry(file, "health", "health-check", ["health", "hygiene", "local-contract"])),
    ...SMOKE_FILES.map((file) => baseEntry(file, "smoke", "smoke-golden", ["smoke"])),
    ...CLOUD_READINESS_FILES.map((file) => baseEntry(file, "real-cloud-readiness", "real-cloud-readiness", ["cloud", "real-cloud-readiness"])),
    ...CLOUD_FUTURE_FILES.map((file) => baseEntry(file, "future-authorized", "future-authorized", ["cloud-future-authorized"])),
    ...CURRENT_GATE_FILES.map((file) => baseEntry(file, "contract", "contract-local", ["health", "local-contract", "current", "review"])),
    ...["tests/suites/suite-test-v22-golden-smoke.mjs", "tests/suites/suite-test-v22-mvp.mjs"]
      .map((file) => baseEntry(file, "contract", "contract-local", file.includes("golden") ? ["golden-path", "smoke"] : ["local-contract"])),
  ];
}

const explicitByFile = new Map(explicitEntries().map((entry) => [entry.file, entry]));

function fallbackEntry(file) {
  if (file.startsWith("tests/regression/portal/")) return baseEntry(file, "regression-portal", "local-regression", ["local-regression"]);
  if (file.startsWith("tests/regression/opl/")) return baseEntry(file, "regression-opl", "local-regression", ["local-regression"]);
  if (file.startsWith("tests/regression/runtime-bridge/")) return baseEntry(file, "regression-runtime-bridge", "local-regression", ["local-regression"]);
  if (file === "tests/contracts/contract-test-v22-go-backend-service-surface.mjs") return baseEntry(file, "contract", "contract-local", ["health", "local-contract"]);
  if (file === "tests/contracts/contract-test-v22-precloud-deployable-rc.mjs") return baseEntry(file, "contract", "contract-local", ["health", "local-contract"]);
  if (file === "tests/governance/governance-test-v22-dynamic-test-run-plan.mjs") return baseEntry(file, "contract", "contract-local", ["health", "local-contract", "review"]);
  if (file === "tests/governance/governance-test-v22-verify-plan-mode.mjs") return baseEntry(file, "contract", "contract-local", ["health", "local-contract", "review"]);
  if (file.startsWith("tests/contracts/")) return baseEntry(file, "contract", "contract-local", ["local-contract"]);
  if (file.startsWith("tests/governance/")) return baseEntry(file, "retired-governance", "retired-governance", ["retired-governance"]);
  if (file.startsWith("tests/local-rc/")) return baseEntry(file, "retired-governance", "retired-governance", ["retired-governance"]);
  return baseEntry(file, "retired-governance", "retired-governance", ["retired-governance"]);
}

export const TEST_LANE_REGISTRY = Object.freeze(
  listTestFiles()
    .filter((file) => !file.startsWith("tests/fixtures/"))
    .map((file) => explicitByFile.get(file) || fallbackEntry(file))
    .sort((left, right) => left.file.localeCompare(right.file)),
);

const registryByFile = Object.freeze(new Map(TEST_LANE_REGISTRY.map((entry) => [entry.file, entry])));

function suiteFiles(suiteId) {
  return Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes(suiteId)).map((entry) => entry.file).sort());
}

export const TEST_LANE_SUITES = Object.freeze({
  current: suiteFiles("current"),
  product: suiteFiles("product"),
  frontend: suiteFiles("frontend"),
  backend: suiteFiles("backend"),
  runtime: suiteFiles("runtime"),
  release: suiteFiles("release"),
  cloud: suiteFiles("cloud"),
  hygiene: suiteFiles("hygiene"),
  health: suiteFiles("health"),
  smoke: suiteFiles("smoke"),
  "local-contract": suiteFiles("local-contract"),
  "local-regression": suiteFiles("local-regression"),
  "real-cloud-readiness": suiteFiles("real-cloud-readiness"),
  "cloud-future-authorized": suiteFiles("cloud-future-authorized"),
  review: suiteFiles("review"),
  "golden-path": suiteFiles("golden-path"),
  "retired-governance": suiteFiles("retired-governance"),
});

const ACTIVE_MANIFEST_SUITE_IDS = Object.freeze([
  "current",
  "health",
  "smoke",
  "local-contract",
  "local-regression",
  "review",
  "product",
  "frontend",
  "backend",
  "runtime",
  "release",
  "cloud",
  "hygiene",
  "real-cloud-readiness",
  "cloud-future-authorized",
]);

const SUITE_WRAPPER_MANIFEST_ALIASES = Object.freeze({
  current: Object.freeze({
    "tests/suites/suite-test-v22-golden-smoke.mjs": Object.freeze(["smoke", "golden-path"]),
  }),
});

const SUITE_COMMAND_COVERAGE_ALIASES = Object.freeze({
  current: Object.freeze({
    "node scripts/v22-verify.mjs active-platform --json": Object.freeze([
      "tests/governance/governance-test-v22-validate-active-platform.mjs",
    ]),
  }),
});

function wrapperCoverageFiles(wrapperFile) {
  if (wrapperFile === "tests/suites/suite-test-v22-golden-smoke.mjs") {
    return Object.freeze(TEST_LANE_REGISTRY
      .filter((entry) => entry.tier === "smoke-golden" && entry.entryKind !== "suite-wrapper")
      .map((entry) => entry.file)
      .sort());
  }
  if (wrapperFile === "tests/suites/suite-test-v22-mvp.mjs") {
    return Object.freeze(TEST_LANE_REGISTRY
      .filter((entry) => ["health-check", "smoke-golden", "contract-local"].includes(entry.tier) && entry.entryKind !== "suite-wrapper")
      .map((entry) => entry.file)
      .sort());
  }
  return Object.freeze([]);
}

function normalizeManifestCommandTestFile(command) {
  const match = String(command || "").match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u);
  return match?.[1] || "";
}

function allowsManifestSuiteWrapperAlias(suiteId, entry) {
  const aliases = SUITE_WRAPPER_MANIFEST_ALIASES[suiteId];
  const expectedSuites = aliases?.[entry.file] || [];
  return entry.entryKind === "suite-wrapper" && expectedSuites.length > 0 && expectedSuites.every((aliasSuite) => entry.verifySuites.includes(aliasSuite));
}

function suiteCommandCoverageFiles(suiteId, command) {
  return SUITE_COMMAND_COVERAGE_ALIASES[suiteId]?.[String(command)] || [];
}

export const HEALTH_CHECK_SCRIPTS = Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.tier === "health-check").map((entry) => entry.file).sort());
export const SMOKE_GOLDEN_SCRIPTS = Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.tier === "smoke-golden").map((entry) => entry.file).sort());
export const SMOKE_SUITE_ENTRYPOINTS = Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.entryKind === "suite-wrapper").map((entry) => entry.file).filter(exists).sort());
export const SMOKE_CLASSIFICATION = Object.freeze(Object.fromEntries(TEST_LANE_REGISTRY.map((entry) => [entry.file, entry.category])));

export function smokeCategoryOf(scriptPath) {
  return SMOKE_CLASSIFICATION[normalizeSmokeScriptPath(scriptPath)] || "";
}

export function smokeEvalMetadataOf(scriptPath) {
  const normalized = normalizeSmokeScriptPath(scriptPath);
  const entry = registryByFile.get(normalized);
  if (!entry) {
    return Object.freeze({
      scriptPath: normalized,
      category: "",
      tier: "",
      surface: "",
      entryKind: "",
      authorization: "",
      ownerSurface: "",
      lifecycleRole: "",
      contractRefs: Object.freeze([]),
    });
  }
  return Object.freeze({
    scriptPath: normalized,
    category: entry.category,
    tier: entry.tier,
    surface: entry.surface,
    entryKind: entry.entryKind,
    authorization: entry.authorization,
    ownerSurface: entry.ownerSurface,
    lifecycleRole: entry.lifecycleRole,
    contractRefs: Object.freeze([...entry.contracts]),
  });
}

export function listClassifiedSmokeScripts({ categories = SMOKE_CATEGORIES } = {}) {
  const allowed = new Set(categories);
  return TEST_LANE_REGISTRY.filter((entry) => allowed.has(entry.category)).map((entry) => entry.file).sort();
}

export function listSmokeEvalScripts({ tiers = SMOKE_EVAL_TIERS, surfaces = SMOKE_EVAL_SURFACES } = {}) {
  const allowedTiers = new Set(tiers);
  const allowedSurfaces = new Set(surfaces);
  return TEST_LANE_REGISTRY
    .filter((entry) => allowedTiers.has(entry.tier) && allowedSurfaces.has(entry.surface))
    .map((entry) => entry.file)
    .sort();
}

export function isSmokeClassifiedIn(scriptPath, { categories = DEFAULT_SMOKE_CATEGORIES } = {}) {
  const allowed = new Set(categories);
  return allowed.has(smokeCategoryOf(scriptPath));
}

export function listRegisteredTestFiles() {
  return TEST_LANE_REGISTRY.map((entry) => entry.file).sort();
}

export function assertPolicySurfaceCoverage() {
  const laneCoverageErrors = [];
  const categoryCoverageErrors = [];
  const surfaceCoverageErrors = [];

  for (const entry of TEST_LANE_REGISTRY) {
    const laneSurfaces = TEST_POLICY_SURFACE_COVERAGE.laneToSurfaces[entry.lane] || [];
    if (laneSurfaces.length === 0) {
      laneCoverageErrors.push(`lane:${entry.lane}:${entry.file}`);
    }

    const categorySurfaces = TEST_POLICY_SURFACE_COVERAGE.categoryToSurfaces[entry.category] || [];
    if (categorySurfaces.length === 0) {
      categoryCoverageErrors.push(`category:${entry.category}:${entry.file}`);
    }

    const registrySurfaceCoverage = TEST_POLICY_SURFACE_COVERAGE.registrySurfaceToPolicySurfaces[entry.surface] || [];
    if (registrySurfaceCoverage.length === 0) {
      surfaceCoverageErrors.push(`surface:${entry.surface}:${entry.file}`);
    }
  }

  return Object.freeze({
    ok: laneCoverageErrors.length === 0 && categoryCoverageErrors.length === 0 && surfaceCoverageErrors.length === 0,
    laneCoverageErrors: Object.freeze(laneCoverageErrors),
    categoryCoverageErrors: Object.freeze(categoryCoverageErrors),
    surfaceCoverageErrors: Object.freeze(surfaceCoverageErrors),
  });
}

export function assertManifestSuiteAlignment(manifest, options = {}) {
  const activeSuiteIds = options.activeSuiteIds || ACTIVE_MANIFEST_SUITE_IDS;
  const manifestSuites = Array.isArray(manifest?.suites) ? manifest.suites : [];
  const manifestSuitesById = new Map(manifestSuites.map((suite) => [suite.id, suite]));
  const invalidCommands = [];
  const missingCoverage = [];
  const retiredGovernanceLeaks = [];

  for (const suiteId of activeSuiteIds) {
    const suite = manifestSuitesById.get(suiteId);
    if (!suite) {
      missingCoverage.push({ suiteId, file: "", reason: "manifest_suite_missing" });
      continue;
    }

    const manifestFiles = (suite.commands || []).map(normalizeManifestCommandTestFile).filter(Boolean);
    const directFiles = new Set();
    const wrapperFiles = [];
    const commandCoverage = new Set((suite.commands || []).flatMap((command) => suiteCommandCoverageFiles(suiteId, command)));

    for (const file of manifestFiles) {
      const entry = registryByFile.get(file);
      if (!entry) {
        invalidCommands.push({ suiteId, file, reason: "manifest_test_command_not_registered" });
        continue;
      }
      if (entry.lane === "retired-governance") retiredGovernanceLeaks.push({ suiteId, file, reason: "retired_governance_must_not_enter_active_manifest_suite" });
      if (entry.verifySuites.includes(suiteId)) {
        directFiles.add(file);
        if (entry.entryKind === "suite-wrapper") wrapperFiles.push(file);
        continue;
      }
      if (allowsManifestSuiteWrapperAlias(suiteId, entry)) {
        wrapperFiles.push(file);
        continue;
      }
      invalidCommands.push({ suiteId, file, reason: "manifest_test_command_must_reference_suite_registered_entry" });
    }

    const wrapperCoverage = new Set(wrapperFiles.flatMap((file) => wrapperCoverageFiles(file)));
    for (const file of TEST_LANE_SUITES[suiteId] || []) {
      const entry = registryByFile.get(file);
      if (entry?.lane === "retired-governance") {
        retiredGovernanceLeaks.push({ suiteId, file, reason: "retired_governance_must_not_be_active_suite_member" });
        continue;
      }
      if (directFiles.has(file) || wrapperCoverage.has(file) || commandCoverage.has(file)) continue;
      missingCoverage.push({
        suiteId,
        file,
        reason: wrapperFiles.length > 0 ? "suite_member_missing_from_manifest_or_wrapper_coverage" : "suite_member_missing_from_manifest",
      });
    }
  }

  const retiredGovernanceSuite = manifestSuitesById.get("retired-governance");
  if (retiredGovernanceSuite) {
    retiredGovernanceLeaks.push({
      suiteId: "retired-governance",
      file: "",
      reason: "retired_governance_must_not_be_manifest_active_suite",
    });
  }

  return Object.freeze({
    ok: invalidCommands.length === 0 && missingCoverage.length === 0 && retiredGovernanceLeaks.length === 0,
    activeSuiteIds: Object.freeze([...activeSuiteIds]),
    invalidCommands: Object.freeze(invalidCommands),
    missingCoverage: Object.freeze(missingCoverage),
    retiredGovernanceLeaks: Object.freeze(retiredGovernanceLeaks),
  });
}

export async function assertTestLaneCoverage() {
  const actual = listTestFiles().filter((file) => !file.startsWith("tests/fixtures/"));
  const registered = listRegisteredTestFiles();
  const missing = actual.filter((file) => !registered.includes(file));
  const extra = registered.filter((file) => !actual.includes(file));
  const duplicates = registered.filter((file, index) => registered.indexOf(file) !== index);
  const orphaned = TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.length === 0).map((entry) => entry.file);
  const invalid = TEST_LANE_REGISTRY.filter((entry) => (
    !TEST_LANES.includes(entry.lane)
    || !SMOKE_CATEGORIES.includes(entry.category)
    || !SMOKE_EVAL_TIERS.includes(entry.tier)
    || !SMOKE_EVAL_SURFACES.includes(entry.surface)
    || !SMOKE_EVAL_ENTRY_KINDS.includes(entry.entryKind)
    || !SMOKE_EVAL_AUTHORIZATIONS.includes(entry.authorization)
    || !entry.ownerSurface
    || !SMOKE_EVAL_LIFECYCLE_ROLES.includes(entry.lifecycleRole)
    || entry.contracts.length === 0
    || entry.contracts.some((contract) => !TEST_LANE_CONTRACT_REFS.includes(contract))
  )).map((entry) => entry.file);
  return Object.freeze({
    ok: missing.length === 0 && extra.length === 0 && duplicates.length === 0 && orphaned.length === 0 && invalid.length === 0,
    missing,
    extra,
    duplicates,
    orphaned,
    invalid,
  });
}
