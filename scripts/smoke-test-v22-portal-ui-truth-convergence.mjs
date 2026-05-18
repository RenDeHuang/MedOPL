import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { retiredFrontendRoutes } from "./smoke-test-v22-portal-retired-frontend-surface-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  design: "DESIGN.md",
  compositionContract: "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
  figmaContract: "docs/contracts/v22-portal-figma-make-ui-implementation-boundary.md",
  current: "docs/recovery/v22-goal-current.json",
  goalState: "docs/recovery/v22-goal-state.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  architectureTruth: "docs/recovery/architecture-truth.md",
  prd: "docs/recovery/portal-ui-design-prd.md",
  verifyManifest: "docs/recovery/v22-agent-verify-manifest.json",
  playwrightConfig: "services/portal/frontend/playwright.config.ts",
  retiredFrontendGate: "scripts/smoke-test-v22-portal-retired-frontend-surface-gate.mjs",
};

async function source(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function json(filePath) {
  return JSON.parse(await source(filePath));
}

function assertIncludes(text, expected, label) {
  assert(text.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(text, forbidden, label) {
  assert(!text.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

const [
  design,
  compositionContract,
  figmaContract,
  current,
  goalState,
  gapMatrix,
  architectureTruth,
  prd,
  verifyManifest,
  playwrightConfig,
  retiredFrontendGate,
] = await Promise.all([
  source(files.design),
  source(files.compositionContract),
  source(files.figmaContract),
  json(files.current),
  source(files.goalState),
  source(files.gapMatrix),
  source(files.architectureTruth),
  source(files.prd),
  json(files.verifyManifest),
  source(files.playwrightConfig),
  source(files.retiredFrontendGate),
]);

assert.equal(current.current_cursor, "leaf-portal-ui-contract-truth-convergence", "current_cursor_mismatch");
assert.equal(current.next_leaf, "leaf-portal-ui-contract-truth-convergence", "next_leaf_mismatch");
assert.equal(current.current_branch, "cleanup/v22-portal-old-ui-smoke-residue-cleanup", "current_branch_mismatch");
assert.equal(current.authoring_branch, "cleanup/v22-portal-old-ui-smoke-residue-cleanup", "authoring_branch_mismatch");
assert.equal(current.current_risk_class, "local_service_code", "current_risk_class_mismatch");
assert.equal(current.current_leaf.step_id, "leaf-portal-ui-contract-truth-convergence", "current_leaf_step_mismatch");
assert.equal(current.current_leaf.gap_id, "portal-ui-contract-truth-convergence", "current_leaf_gap_mismatch");
assert(current.current_leaf.allowed_files.includes("services/portal/frontend/playwright.config.ts"), "playwright_config_must_be_allowed");
assert(current.current_leaf.verification_commands.includes("node scripts/smoke-test-v22-portal-retired-frontend-surface-gate.mjs"), "retired_frontend_gate_must_be_current_command");
assert(current.current_leaf.verification_commands.includes("node scripts/smoke-test-v22-portal-ui-truth-convergence.mjs"), "truth_convergence_smoke_must_be_current_command");

const manifestLeaf = verifyManifest.leaves.find((leaf) => leaf.leaf_id === "leaf-portal-ui-contract-truth-convergence");
assert(manifestLeaf, "verify_manifest_truth_convergence_leaf_missing");
assert.deepEqual(manifestLeaf.allowed_files, current.current_leaf.allowed_files, "manifest_allowed_files_must_match_current");
assert.deepEqual(manifestLeaf.verification_commands, current.current_leaf.verification_commands, "manifest_commands_must_match_current");

const currentSuite = verifyManifest.suites.find((suite) => suite.id === "current");
assert(currentSuite, "current_suite_missing");
assert.deepEqual(currentSuite.commands, current.current_leaf.verification_commands, "current_suite_commands_must_match_current_leaf");

assertIncludes(goalState, "- current cursor summary: `leaf-portal-ui-contract-truth-convergence`", "goal_state_cursor_summary");
assertIncludes(goalState, "- highest-priority executable leaf summary: `leaf-portal-ui-contract-truth-convergence`", "goal_state_leaf_summary");
assertIncludes(gapMatrix, "### Gap: portal-ui-contract-truth-convergence", "gap_matrix_truth_convergence_gap");
assertIncludes(gapMatrix, "- next_leaf_step: leaf-portal-ui-contract-truth-convergence", "gap_matrix_next_leaf");

assertIncludes(design, "Figma Make ZIP", "design_must_reference_figma_zip");
assertIncludes(design, "React app root", "design_must_reference_react_app_root");
assertIncludes(design, "旧路径防回归统一由 retired frontend surface gate 承接", "design_must_point_to_retired_frontend_gate");
assertIncludes(design, "后续产品系统重构必须保持 Figma 页面视觉、布局、信息架构和主路径不变", "design_must_freeze_figma_ui");

assertIncludes(compositionContract, "retired frontend surface gate", "composition_must_point_to_retired_frontend_gate");
assertIncludes(figmaContract, "唯一 Portal UI source-of-truth", "figma_contract_must_keep_zip_truth");
assertIncludes(retiredFrontendGate, "retiredFrontendSurface", "retired_frontend_gate_must_define_banlist");

assertIncludes(playwrightConfig, "url: \"http://127.0.0.1:17180/overview\"", "playwright_must_use_current_route");
for (const retiredRoute of retiredFrontendRoutes) {
  assertExcludes(playwrightConfig, retiredRoute, "playwright_must_not_use_retired_frontend_route");
}

assertExcludes(architectureTruth, "当前普通用户 Figma Make UI 不包含可吸收 Admin/Ops 前端", "architecture_truth_must_not_claim_admin_missing");
assertIncludes(architectureTruth, "管理员页面位于 `services/portal/frontend/src/app/pages/admin/*.tsx`", "architecture_truth_must_record_admin_pages");
assertExcludes(prd, "当前普通用户 Figma Make UI 不包含可吸收管理台页面", "prd_must_not_claim_admin_missing");
assertIncludes(prd, "当前 Figma Make ZIP 已覆盖普通用户和管理员 Portal UI", "prd_must_record_admin_coverage");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_ui_truth_convergence",
  current_cursor: current.current_cursor,
  checked: [
    files.design,
    files.compositionContract,
    files.playwrightConfig,
    files.architectureTruth,
    files.prd,
    files.current,
    files.verifyManifest,
  ],
}, null, 2));
