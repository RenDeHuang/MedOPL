import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateDiffAdmission } from "../../scripts/v22-repo-bloat-audit.mjs";

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
  "docsActiveGuards",
  "artifactBloatGuards",
  "retiredChangePathGuards",
  "active_doc_bloat_forbidden",
  "retired_change_path_forbidden",
  "raw_artifact_bloat_forbidden",
  "lineBudgetDiffForChangedFiles",
  "isNewTargetStatus",
  "...runGit([\"diff\", \"--name-only\"",
  "output.map((item) => item.trim())",
  "diff_oversize_file_growth_forbidden",
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
assert(scriptSource.includes('"tests/hygiene/"'), "repo_bloat_audit_must_keep_hygiene_area_prefix");
assert.equal(scriptSource.includes('"tests/governance/"'), false, "repo_bloat_audit_must_not_keep_retired_governance_area_prefix");
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
assert(payload.docsActiveGuards, "repo_bloat_audit_must_report_docs_active_guards");
assert.equal(payload.docsActiveGuards.readmeOnly, true, "repo_bloat_audit_must_keep_docs_active_readme_only");
assert.equal(payload.docsActiveGuards.noMultiPlanSpecs, true, "repo_bloat_audit_must_forbid_active_plan_spec_sprawl");
assert(payload.retiredChangePathGuards, "repo_bloat_audit_must_report_retired_change_path_guards");
assert.equal(payload.retiredChangePathGuards.noChangesActive, true, "repo_bloat_audit_must_forbid_changes_active");
assert.equal(payload.retiredChangePathGuards.noChangesArchive, true, "repo_bloat_audit_must_forbid_changes_archive");
assert(payload.artifactBloatGuards, "repo_bloat_audit_must_report_artifact_bloat_guards");
assert.equal(payload.artifactBloatGuards.allowSmallFixtures, true, "repo_bloat_audit_must_allow_small_fixtures");
assert(Array.isArray(payload.artifactBloatGuards.forbiddenPathPatterns), "repo_bloat_audit_must_report_forbidden_artifact_paths");
assert(Array.isArray(payload.artifactBloatGuards.forbiddenExtensions), "repo_bloat_audit_must_report_forbidden_artifact_extensions");
assert(
  payload.artifactBloatGuards.forbiddenPathPatterns.some((pattern) => pattern.includes("uploads")),
  "repo_bloat_audit_must_guard_upload_paths",
);
assert(
  payload.artifactBloatGuards.forbiddenPathPatterns.some((pattern) => pattern.includes("screenshots")),
  "repo_bloat_audit_must_guard_screenshot_paths",
);
assert(
  payload.artifactBloatGuards.forbiddenPathPatterns.some((pattern) => pattern.includes("transcript")),
  "repo_bloat_audit_must_guard_transcript_paths",
);
assert(
  payload.lifecycleFindings.every((finding) => [
    "slide_doc_bloat_forbidden",
    "active_doc_bloat_forbidden",
    "retired_change_path_forbidden",
    "raw_artifact_bloat_forbidden",
  ].includes(finding.code)),
  "repo_bloat_audit_must_use_known_lifecycle_finding_codes",
);

const productDiffAdmission = evaluateDiffAdmission({
  changedFiles: [
    "scripts/v22-extra-control-surface.mjs",
    "tests/health/health-check-v22-extra-governance.mjs",
    "services/medopl-go-backend/internal/service/controlplane/service.go",
  ],
  changedStatuses: new Map([
    ["scripts/v22-extra-control-surface.mjs", "A"],
    ["tests/health/health-check-v22-extra-governance.mjs", "C100"],
  ]),
  sliceAdmission: {
    slice_type: "product",
    owner_surface: "backend",
    new_top_level_scripts_allowed: false,
    new_health_tests_allowed: false,
    new_contracts_allowed: false,
    touches_cloud: false,
    touches_active_docs: false,
    must_reduce_or_hold_bloat: true,
    cannot_claim: ["production complete"],
  },
  lineBudgetDiff: {
    grownOversizeFiles: [
      {
        file: "services/medopl-go-backend/internal/service/controlplane/service.go",
        before: 1064,
        after: 1065,
      },
    ],
  },
});
assert.equal(productDiffAdmission.ok, false, "repo_bloat_diff_admission_must_block_product_control_surface_growth");
assert(productDiffAdmission.findings.some((finding) => finding.code === "diff_new_top_level_script_forbidden"), "repo_bloat_diff_must_block_new_top_level_script");
assert(productDiffAdmission.findings.some((finding) => finding.code === "diff_new_health_test_forbidden"), "repo_bloat_diff_must_block_new_health_test");
assert(productDiffAdmission.findings.some((finding) => finding.code === "diff_oversize_file_growth_forbidden"), "repo_bloat_diff_must_block_oversize_file_growth");
assert(
  productDiffAdmission.findings.find((finding) => finding.code === "diff_new_health_test_forbidden")?.files.includes("tests/health/health-check-v22-extra-governance.mjs"),
  "repo_bloat_diff_must_treat_copied_health_test_as_new_target",
);

const cloudDiffAdmission = evaluateDiffAdmission({
  changedFiles: [
    "scripts/v22-cloud-authorized-executor.mjs",
    "tests/cloud/cloud-test-v22-cloud-authorized-executor.mjs",
    "contracts/medopl-cloud-authorization-pack.json",
  ],
  sliceAdmission: {
    slice_type: "cloud",
    owner_surface: "cloud",
    operation_class: "readonly_inventory",
    evidence_sink: ".runtime/v22-cloud-authorization",
    receipt_manifest_required: true,
    allowed_paths: ["scripts/", "tests/cloud/", "contracts/"],
    new_top_level_scripts_allowed: false,
    new_health_tests_allowed: false,
    new_contracts_allowed: false,
    touches_cloud: true,
    touches_active_docs: false,
    must_reduce_or_hold_bloat: true,
    cannot_claim: ["production complete"],
  },
});
assert.equal(cloudDiffAdmission.ok, true, "repo_bloat_diff_admission_must_allow_existing_cloud_owner_surface");
assert.deepEqual(cloudDiffAdmission.findings, [], "repo_bloat_diff_admission_allowed_cloud_findings_must_be_empty");

const suite = manifest.suites.find((item) => item.id === "repo-hygiene");
assert(suite, "repo_hygiene_suite_missing");
assert(suite.commands.includes("node scripts/v22-repo-bloat-audit.mjs --json"), "repo_hygiene_suite_must_run_bloat_audit");
assert(suite.commands.includes("node tests/health/health-check-v22-repo-bloat-audit-gate.mjs"), "repo_hygiene_suite_must_run_bloat_audit_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_repo_bloat_audit_gate",
  counts: payload.counts,
}, null, 2));
