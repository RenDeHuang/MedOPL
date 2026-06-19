import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

const [scriptSource, manifest] = await Promise.all([
  readFile(path.join(repoRoot, "scripts/v22-repo-bloat-audit.mjs"), "utf8"),
  readFile(path.join(repoRoot, "tests/fixtures/v22/agent-verify-manifest.json"), "utf8").then(JSON.parse),
]);

for (const expected of [
  "docsMarkdownFiles",
  "testsMjsFiles",
  "testsCloudFiles",
  "scriptsFiles",
  "scriptsModuleFiles",
  "servicesPortalFiles",
  "servicesPortalBytes",
  "largestAreas",
  "bloat_pressure",
  "slideBloatGuards",
  "forbiddenSlideDocPatterns",
  "allowedDocsMarkdownFiles",
  "lifecycleFindings",
  "pressureFindings",
]) {
  assert(scriptSource.includes(expected), `repo_bloat_audit_source_missing:${expected}`);
}

const result = runNode(["scripts/v22-repo-bloat-audit.mjs", "--json"]);
assert.equal(result.status, 0, result.stderr || result.stdout);
const payload = JSON.parse(result.stdout);
assert.equal(payload.ok, true, "repo_bloat_audit_payload_ok");
assert.equal(payload.contract, "v22_repo_bloat_audit", "repo_bloat_audit_contract_mismatch");
assert.equal(
  payload.bloat_pressure,
  "count and byte budgets report pressure only; lifecycle/consumer findings decide pass/fail",
  "repo_bloat_audit_must_not_treat_file_counts_as_architecture_truth",
);
assert(Array.isArray(payload.pressureFindings), "repo_bloat_audit_must_report_pressure_findings");
assert(Array.isArray(payload.lifecycleFindings), "repo_bloat_audit_must_report_lifecycle_findings");
assert.equal(
  payload.findings.length,
  payload.lifecycleFindings.length,
  "repo_bloat_audit_findings_must_only_include_lifecycle_blockers",
);
assert(
  payload.pressureFindings.every((finding) => finding.severity === "pressure"),
  "repo_bloat_audit_budget_findings_must_be_pressure_only",
);
assert(scriptSource.includes('"tests/contracts/"'), "repo_bloat_audit_must_keep_contracts_area_prefix");
assert(scriptSource.includes('"tests/governance/"'), "repo_bloat_audit_must_keep_governance_area_prefix");
assert(payload.largestAreas.some((area) => area.path === "tests/governance"), "repo_bloat_audit_must_surface_governance_area");
assert(payload.largestAreas.some((area) => area.path === "tests/regression/portal"), "repo_bloat_audit_must_surface_portal_regression_area");
assert(payload.largestAreas.some((area) => area.path === "services/portal"), "repo_bloat_audit_must_surface_largest_service_area");
assert.equal(
  payload.notes.includes("tests/regression/portal is the largest test area; split by product surface before adding broad regression files."),
  payload.counts.testsRegressionPortalFiles >= 24,
  "repo_bloat_audit_must_report_regression_portal_pressure_only_when_threshold_hit",
);
assert.equal(
  payload.notes.includes("services/portal is the largest source area; add broad portal surface files only with a dedicated product-surface split."),
  payload.counts.servicesPortalFiles >= 230,
  "repo_bloat_audit_must_report_services_portal_pressure_only_when_threshold_hit",
);
assert(payload.slideBloatGuards, "repo_bloat_audit_must_report_slide_bloat_guards");
assert.equal(payload.slideBloatGuards.noPerSlideDocs, true, "repo_bloat_audit_must_forbid_per_slide_docs");
assert.equal(payload.slideBloatGuards.noSlideSubtaskDocs, true, "repo_bloat_audit_must_forbid_slide_subtask_docs");
assert.equal(payload.slideBloatGuards.noUnregisteredTests, true, "repo_bloat_audit_must_forbid_unregistered_tests");
assert(Array.isArray(payload.slideBloatGuards.allowedDocsMarkdownFiles), "repo_bloat_audit_must_report_allowed_docs_markdown");

const suite = manifest.suites.find((item) => item.id === "repo-hygiene");
assert(suite, "repo_hygiene_suite_missing");
assert(suite.commands.includes("node scripts/v22-repo-bloat-audit.mjs --json"), "repo_hygiene_suite_must_run_bloat_audit");
assert(suite.commands.includes("node tests/health/health-check-v22-repo-bloat-audit-gate.mjs"), "repo_hygiene_suite_must_run_bloat_audit_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_repo_bloat_audit_gate",
  counts: payload.counts,
}, null, 2));
