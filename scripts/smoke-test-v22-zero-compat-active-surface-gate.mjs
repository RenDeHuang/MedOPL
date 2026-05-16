import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const activeCodeRoots = [
  "services/portal/src",
  "services/portal/frontend/src",
  "services/opl-web-gateway/src",
  "services/opl-runtime-bridge/src",
];

const currentNarrativeRoots = [
  "docs/recovery",
  "docs/contracts",
];

const currentNarrativeFiles = [
  "README.md",
  "docs/product.md",
  "docs/architecture.md",
  "scripts/v22-workflow-gate.mjs",
];

const allowedTokenGuardianScripts = new Set([
  "scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs",
  "scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs",
  "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
  "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs",
  "scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
  "scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "scripts/smoke-test-v22-contract-conflict-boundary.mjs",
  "scripts/smoke-test-v22-goal-state-consistency.mjs",
  "scripts/smoke-test-v22-product-goal-harness.mjs",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-legacy-script-archive-boundary.mjs",
  "scripts/smoke-test-v22-agent-verify-entrypoint.mjs",
  "scripts/smoke-test-v22-admin-ops-console-boundary.mjs",
  "scripts/smoke-test-v22-authorized-tencent-create-release-contract.mjs",
  "scripts/smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs",
  "scripts/smoke-test-v22-env-template-default-entry.mjs",
  "scripts/smoke-test-v22-product-goal-execution-order.mjs",
  "scripts/smoke-test-v22-repo-zoning-boundary.mjs",
]);

const oldRouteFieldPatterns = [
  /\bresourceOrderId\b/gu,
  /\bresource_order_id\b/gu,
  /\blegacyResourceOrderId\b/gu,
  /\bresource_orders\b/gu,
  /\bresource-order\b/giu,
  /\buser_owned(?:_runtime|_runtime_dispatch)?\b/gu,
  /\buser-owned(?:-runtime)?\b/giu,
  /\bUSER_OWNED_RUNTIME_AGENT_REQUIRED\b/gu,
  /\bUSER_OWNED_RUNTIME_DISPATCH\b/gu,
];

const residualExecutableScriptNamePatterns = [
  /(?:^|-)live(?:-|\.mjs$)/u,
  /(?:^|-)canary(?:-|\.mjs$)/u,
  /authorized-deploy/u,
  /authorized-resource-lifecycle/u,
  /real-live/u,
  /live-runner/u,
  /live-bridge/u,
  /live-diagnostics/u,
];

const forbiddenDefaultReferencePatterns = [
  /scripts\/smoke-test-v(?:19|20|21)[^"'\s)]*/u,
  /scripts\/live-test-[^"'\s)]*/u,
  /scripts\/check-v(?:18|20|21)[^"'\s)]*/u,
  /scripts\/(?:start|install)-opencost[^"'\s)]*/u,
  /scripts\/.*resource-provisioner[^"'\s)]*/u,
  /scripts\/.*med-autoscience-runner[^"'\s)]*/u,
  /scripts\/.*authorized-deploy[^"'\s)]*/u,
  /scripts\/.*authorized-resource-lifecycle[^"'\s)]*/u,
  /scripts\/.*real-live[^"'\s)]*/u,
  /scripts\/.*live-runner[^"'\s)]*/u,
  /scripts\/.*live-bridge[^"'\s)]*/u,
  /scripts\/.*live-diagnostics[^"'\s)]*/u,
];

const compatibilityCompletionPatterns = [
  /\bkeep_tombstone\b/iu,
  /\barchive_reference\b/iu,
  /\bGateway alias\b/iu,
  /Runtime Bridge 合同包/iu,
  /portal-legacy-redirect\.routes\.mjs[^.\n]*(?:路径迁移壳|兼容|compat)/iu,
  /旧 workspace redirects[^.\n]*(?:兼容|compat)/iu,
  /旧入口兼容参考/iu,
  /runtime-bridge-managed-runs\.mjs[^.\n]*(?:compatibility fence|兼容)/iu,
  /\bmanaged_runtime\b[^.\n]*(?:兼容|compat)/iu,
  /## 默认本地 MVP suite[\s\S]{0,5200}\bfake-live\b/iu,
  /## 默认本地 MVP suite[\s\S]{0,5200}\bfake Product API\b/iu,
  /## 默认本地 MVP suite[\s\S]{0,5200}\bfake Runtime Agent relay\b/iu,
  /## 默认本地 MVP suite[\s\S]{0,5200}scripts\/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop\.mjs/iu,
  /## 默认本地 MVP suite[\s\S]{0,5200}scripts\/smoke-test-v22-portal-opl-api-runtime-loop\.mjs/iu,
  /adapters\/billing-aggregator\/\*\*[^.\n]*(?:active|retain|retention|可保留|保留|active reason)/iu,
  /deploy\/local\/dockerfiles\/[^.\n]*(?:active|retain|retention|evidence surface|可保留|保留|active reason)/iu,
  /active v22 retention truth:[^\n]*(?:adapters\/billing-aggregator|deploy\/local\/dockerfiles)/iu,
  /must_retain_active_v22_paths[\s\S]{0,800}(?:adapters\/billing-aggregator|deploy\/local\/dockerfiles)/iu,
  /old deploy\/adapters\/infra assets[^.\n]*(?:unless proven active|active v22 surface)/iu,
];

function normalizeRepoPath(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function lineOf(source, index) {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

function contextAround(source, index, radius = 180) {
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + radius));
}

function isNegativeRetirementContext(context) {
  return /(?:must not|不得|禁止|delete|deleted|retired|physical|forbidden|must_be_deleted|must_not|not retain|not include|not restore|不能|不保留|不再|退役|删除|已删除|清退|fail-closed)/iu.test(context);
}

function asGlobalPattern(pattern) {
  if (pattern.global) return pattern;
  return new RegExp(pattern.source, `${pattern.flags}g`);
}

function isTextFile(filePath) {
  return /\.(?:mjs|js|ts|tsx|vue|json|md|yaml|yml|ps1|cmd|html|css)$/iu.test(filePath);
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(rootPath) {
  const absoluteRoot = path.join(repoRoot, rootPath);
  if (!(await exists(rootPath))) return [];
  const entries = await readdir(absoluteRoot, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = normalizeRepoPath(path.join(rootPath, entry.name));
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".runtime", "dist", "coverage"].includes(entry.name)) continue;
      files.push(...await listFiles(repoPath));
    } else if (entry.isFile()) {
      files.push(repoPath);
    }
  }
  return files;
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function pushPatternFindings(findings, { type, file, source, patterns, detail }) {
  for (const pattern of patterns) {
    for (const match of source.matchAll(asGlobalPattern(pattern))) {
      if (isNegativeRetirementContext(contextAround(source, match.index ?? 0))) continue;
      findings.push({
        type,
        file,
        line: lineOf(source, match.index ?? 0),
        match: match[0],
        detail,
      });
    }
  }
}

async function assertNoActiveCodeLegacyFields(findings) {
  const files = (await Promise.all(activeCodeRoots.map(listFiles))).flat().filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "active_code_legacy_compat_field",
      file,
      source,
      patterns: oldRouteFieldPatterns,
      detail: "Active Portal/Gateway/Runtime Bridge code must not accept, map, persist, or publish retired user-owned/resource-order fields or runtime aliases.",
    });
  }
}

async function assertScriptLegacyTokensOnlyInGuardianGates(findings) {
  const files = (await listFiles("scripts")).filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    const isGuardian = allowedTokenGuardianScripts.has(file);
    for (const pattern of oldRouteFieldPatterns) {
      for (const match of source.matchAll(pattern)) {
        if (isGuardian) continue;
        if (isNegativeRetirementContext(contextAround(source, match.index ?? 0))) continue;
        findings.push({
          type: "script_legacy_token_outside_retirement_gate",
          file,
          line: lineOf(source, match.index ?? 0),
          match: match[0],
          detail: "Scripts may mention retired user-owned/resource-order tokens only inside strict/retire/zero-compat forbidden-token gates.",
        });
      }
    }
  }
}

async function assertNoResidualAdapterDeployInfra(findings) {
  for (const rootPath of ["adapters", "deploy", "infra"]) {
    const files = await listFiles(rootPath);
    for (const file of files) {
      findings.push({
        type: "residual_adapter_deploy_infra_surface",
        file,
        line: 1,
        match: rootPath,
        detail: "Zero-compat monolith active repo must not keep adapters/deploy/infra as default executable context.",
      });
    }
  }
}

async function assertNoResidualLiveCanaryRunnerScripts(findings) {
  const files = await listFiles("scripts");
  for (const file of files) {
    const name = path.basename(file);
    if (!name.startsWith("smoke-test-v22-") && !name.startsWith("v22-")) continue;
    if (residualExecutableScriptNamePatterns.some((pattern) => pattern.test(name))) {
      findings.push({
        type: "residual_live_canary_authorized_executable_surface",
        file,
        line: 1,
        match: name,
        detail: "Live/canary/authorized runner scripts must be deleted or migrated to non-live local v22 gates; future external operations stay contract-only until separately authorized.",
      });
    }
  }
}

async function assertDefaultSuitesAndWorkflowDoNotReferenceResiduals(findings) {
  const files = [
    "README.md",
    "docs/product.md",
    "docs/architecture.md",
    "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "scripts/v22-verify.mjs",
    "scripts/v22-workflow-gate.mjs",
    "scripts/smoke-test-v22-agent-verify-entrypoint.mjs",
  ];

  for (const file of files) {
    if (!(await exists(file))) continue;
    const source = await readRepoFile(file);
    for (const pattern of forbiddenDefaultReferencePatterns) {
      for (const match of source.matchAll(asGlobalPattern(pattern))) {
        const context = contextAround(source, match.index ?? 0, 220);
        if (isNegativeRetirementContext(context)) continue;
        findings.push({
          type: "default_suite_or_workflow_residual_reference",
          file,
          line: lineOf(source, match.index ?? 0),
          match: match[0],
          detail: "Default suite, workflow, README, and agent verify must not reference old smoke/live/check/provisioner/deploy runner paths as current verification truth.",
        });
      }
    }
  }
}

async function assertCurrentNarrativeDoesNotRetainCompatibility(findings) {
  const files = [
    ...currentNarrativeFiles,
    ...(await Promise.all(currentNarrativeRoots.map(listFiles))).flat().filter((file) => /\.(?:md|json)$/iu.test(file)),
  ];
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "current_narrative_compatibility_completion_state",
      file,
      source,
      patterns: compatibilityCompletionPatterns,
      detail: "Current README/product/architecture/contracts/recovery truth must not retain tombstone/archive/compat/adapter/deploy/live/canary surfaces as completion state or default context.",
    });
  }
}

async function main() {
  const findings = [];

  await assertNoActiveCodeLegacyFields(findings);
  await assertScriptLegacyTokensOnlyInGuardianGates(findings);
  await assertNoResidualAdapterDeployInfra(findings);
  await assertNoResidualLiveCanaryRunnerScripts(findings);
  await assertDefaultSuitesAndWorkflowDoNotReferenceResiduals(findings);
  await assertCurrentNarrativeDoesNotRetainCompatibility(findings);

  findings.sort((left, right) =>
    `${left.type}:${left.file}:${left.line}`.localeCompare(`${right.type}:${right.file}:${right.line}`),
  );

  assert.deepEqual(findings, [], `zero_compat_active_surface_findings:${JSON.stringify(findings, null, 2)}`);

  console.log(JSON.stringify({
    ok: true,
    gate: "v22_zero_compat_active_surface",
    checked: {
      activeCodeRoots,
      currentNarrativeRoots,
      currentNarrativeFiles,
      residualExecutableScriptNamePatterns: residualExecutableScriptNamePatterns.map((pattern) => pattern.source),
    },
  }, null, 2));
}

await main();
