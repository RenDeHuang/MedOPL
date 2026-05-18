import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_SMOKE_CATEGORIES, listClassifiedSmokeScripts } from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const reportPath = "docs/recovery/mvp-contract-acceptance.md";
const verifyManifestPath = "docs/recovery/v22-agent-verify-manifest.json";
const branchOverrideSuiteIds = new Set([
  "portal-ui-contract-truth-convergence",
  "strict-monolith-cleanup",
  "contract-index-runtime-bridge-alignment",
  "system-domain-truth-layer-zero-old-context",
]);

const requiredReportPhrases = [
  "pricing snapshot contract",
  "MVP managed OPL loop contract",
  "SaaS control plane user experience truth contract",
  "user credit provider key flow",
  "managed environment open flow",
  "OPL work message/file/run flow",
  "Portal files/billing/trace flow",
  "Portal structure/failure isolation governance contract",
  "release stop billing audit flow",
  "contract-level + Portal API/domain 小闭包",
  "十层 truth",
  "不是完整真实上线",
  "Portal frontend MVP UI",
  "Gateway / Runtime Bridge / Runtime Agent 生产联通",
  "scripts/smoke-test-v22-runtime-bridge-state-store-atomic-flow.mjs",
  "scripts/smoke-test-v22-portal-runtime-bridge-api-local-flow.mjs",
  "scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs",
  "scripts/smoke-test-v22-real-opl-capability-contract-gate.mjs",
  "scripts/smoke-test-v22-real-opl-provider-message-contract-gate.mjs",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-contract-gate.mjs",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs",
  "/home/dev/projects/one-person-lab` 主仓真实 canary 已确认",
  "真实 OPL/AionUI WebUI canary 已确认",
  "`/api/opl/*` 只是通用 `/api` catch-all 200 placeholder",
  "真实 WebUI Runtime Bridge session bridge 边界",
  "run 在没有真实 Runtime Agent relay 时不能伪成功",
  "one-person-lab 实际拉取/部署/运行接入：已完成主仓能力分类",
  "真实云资源开通",
  "真实价格审批",
  "Langfuse 真实 trace source 接入",
  "cleanup 删除 v19/v20/v21 旧路线",
];

const smokeScripts = listClassifiedSmokeScripts({ categories: DEFAULT_SMOKE_CATEGORIES })
  .filter((scriptPath) => scriptPath !== "scripts/smoke-test-v22-mvp-contract-suite.mjs")
  .map((scriptPath) => [path.basename(scriptPath, ".mjs"), scriptPath]);

async function assertReportAcceptanceBoundary() {
  const report = await readFile(path.join(repoRoot, reportPath), "utf8");
  for (const phrase of requiredReportPhrases) {
    assert(report.includes(phrase), `mvp_acceptance_report_missing:${phrase}`);
  }
}

async function assertSmokeScriptsExist() {
  for (const [name, scriptPath] of smokeScripts) {
    await access(path.join(repoRoot, scriptPath)).catch((error) => {
      throw new Error(`${name}_missing:${error.message}`);
    });
  }
}

function runSmoke(name, scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(`${name}_failed`);
  }
}

function currentBranchName() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_branch_show_current_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function branchOverrideSuiteForCurrentBranch() {
  const manifest = JSON.parse(await readFile(path.join(repoRoot, verifyManifestPath), "utf8"));
  const branchName = currentBranchName();
  return (manifest.branch_override_suites ?? []).find((suite) => {
    const branches = new Set([suite.branch, ...(suite.branches ?? [])].filter(Boolean));
    return branches.has(branchName);
  });
}

async function runBranchOverrideVerify(expectedSuiteId) {
  const result = spawnSync(process.execPath, [
    "scripts/v22-verify.mjs",
    "current",
    "--base",
    "origin/recovery/platform-v22-trunk",
    "--json",
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error("branch_override_verify_failed");
  }

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true, "branch_override_verify_must_be_ok");
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "docs/recovery/v22-goal-current.json"), "utf8"));
  assert.equal(payload.leafId, manifest.current_cursor, "branch_override_verify_must_not_change_current_leaf");
  assert(branchOverrideSuiteIds.has(payload.branchOverride?.suiteId), `branch_override_verify_suite_unknown:${payload.branchOverride?.suiteId || "(missing)"}`);
  assert.equal(payload.branchOverride?.suiteId, expectedSuiteId, "branch_override_verify_suite_mismatch");
  assert.equal(
    payload.commands.includes("node scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs"),
    false,
    "branch_override_mvp_suite_must_not_run_ui_authoring_gate",
  );
  return payload.results?.map((item) => item.command) || payload.commands;
}

await assertReportAcceptanceBoundary();

const branchOverrideSuite = await branchOverrideSuiteForCurrentBranch();
if (branchOverrideSuite) {
  const passed = await runBranchOverrideVerify(branchOverrideSuite.id);
  console.log(JSON.stringify({
    ok: true,
    contract: "v22_mvp_contract_acceptance_suite",
    branchOverride: branchOverrideSuite.id,
    currentLeaf: JSON.parse(await readFile(path.join(repoRoot, "docs/recovery/v22-goal-current.json"), "utf8")).current_cursor,
    passed,
  }, null, 2));
  process.exit(0);
}

await assertSmokeScriptsExist();

const passed = [];
for (const [name, scriptPath] of smokeScripts) {
  runSmoke(name, scriptPath);
  passed.push(name);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_mvp_contract_acceptance_suite",
  passed,
}, null, 2));
