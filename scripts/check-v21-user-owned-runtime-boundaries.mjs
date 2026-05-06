import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const REQUIRED_FILES = [
  {
    file: "compose.product.yaml",
    checks: [
      { token: "PRODUCT_RUNTIME_MODE=user_owned", pattern: /\bPRODUCT_RUNTIME_MODE["']?\s*[:=]\s*["']?user_owned\b/ },
    ],
  },
  {
    file: "docs/plan/2026-05-05-OPL-v21-User-Owned-Runtime-Refactor-Checklist.md",
    checks: [
      { token: "next migration to platform_provisioned", pattern: /下一轮代码迁移应改成\s+`?platform_provisioned`?/ },
      { token: "new PRODUCT_RUNTIME_MODE=user_owned", pattern: /新增\s+`PRODUCT_RUNTIME_MODE=user_owned`/ },
      { token: "unchecked platform_provisioned migration", pattern: /\[ \]\s+将\s+`PRODUCT_RUNTIME_MODE=user_owned`\s+迁移为\s+`platform_provisioned`/ },
    ],
  },
  {
    file: "docs/superpowers/plans/2026-05-06-opl-v21-phase-0.5-and-phase-1.md",
    checks: [
      { token: "user_owned is only product runtime mode", pattern: /`(?:PRODUCT_RUNTIME_MODE=)?user_owned`\s+is the only v21 product runtime mode|`user_owned`\s+is the only product runtime mode/ },
      { token: "user CVM Runtime Agent", pattern: /\buser CVM Runtime Agent\b/ },
      { token: "v21 user-owned product", pattern: /\bv21 user-owned product\b/ },
      { token: "default user-owned mode", pattern: /默认\s+user-owned\s+模式/ },
    ],
  },
  {
    file: "docs/reports/2026-05-06-OPL-v21-Phase2-9-Local-Acceptance-Report.md",
    checks: [
      { token: "用户自有 CVM", pattern: /用户自有\s+CVM/ },
      { token: "真实用户 CVM", pattern: /真实用户\s+CVM/ },
    ],
  },
  {
    file: "services/opl-runtime-bridge/src/runtime-bridge-runs.mjs",
    checks: [
      { token: "/portal/internal/resource-orders/prepare-run", pattern: /\/portal\/internal\/resource-orders\/prepare-run/ },
      { token: "provision", pattern: /\bprovision\b/ },
      { token: "user_owned_runtime_dispatch", pattern: /\buser_owned_runtime_dispatch\b/ },
    ],
  },
  {
    file: "services/opl-runtime-bridge/src/runtime-bridge-launch.mjs",
    checks: [
      { token: "runnerUrl", pattern: /\brunnerUrl\b/ },
      { token: "k8sNamespace", pattern: /\bk8sNamespace\b/ },
      { token: "runnerImage", pattern: /\brunnerImage\b/ },
      { token: "user_owned_runtime_agent", pattern: /\buser_owned_runtime_agent\b/ },
    ],
  },
  {
    file: "services/portal/src/routes/portal-api-costs.routes.mjs",
    checks: [
      { token: "OpenCost", pattern: /\bOpenCost\b/ },
    ],
  },
  {
    file: "services/portal/src/app/portal-page-payload-helpers.mjs",
    checks: [
      { token: "OpenCost aggregated", pattern: /OpenCost aggregated/ },
    ],
  },
  {
    file: "services/portal/src/app/portal-admin-api-payloads.mjs",
    checks: [
      { token: "minioConsoleUrl", pattern: /\bminioConsoleUrl\b/ },
    ],
  },
  {
    file: "services/portal/src/app/portal-admin-overview-payloads.mjs",
    checks: [
      { token: "minioSummary", pattern: /\bminioSummary\b/ },
      { token: "用户自有资源", pattern: /用户自有资源/ },
      { token: "user_owned_storage", pattern: /\buser_owned_storage\b/ },
      { token: "user_owned_local_metering", pattern: /\buser_owned_local_metering\b/ },
    ],
  },
  {
    file: "services/portal/src/app/portal-server-plan-runtime-handler.mjs",
    checks: [
      { token: "user_owned_local_metering", pattern: /\buser_owned_local_metering\b/ },
    ],
  },
  {
    file: "services/portal/src/app/portal-feature-runtime-handlers.mjs",
    checks: [
      { token: "productRuntimeMode user_owned default", pattern: /productRuntimeMode\s*=\s*["']user_owned["']/ },
    ],
  },
  {
    file: "services/portal/src/routes/resource-order.routes.mjs",
    checks: [
      { token: "primary user-owned resource pointer", pattern: /\buse:\s*["']\/portal\/api\/user-owned-resources/ },
    ],
  },
  {
    file: "services/portal/src/routes/resource-order-internal.routes.mjs",
    checks: [
      { token: "primary user-owned resource pointer", pattern: /\buse:\s*["']\/portal\/api\/user-owned-resources/ },
    ],
  },
  {
    file: "services/portal/src/routes/resource-order-provisioning-service.mjs",
    checks: [
      { token: "primary user-owned resource pointer", pattern: /\buse:\s*["']\/portal\/api\/user-owned-resources/ },
    ],
  },
  {
    file: "services/portal/src/routes/resource-order-public-delete.routes.mjs",
    checks: [
      { token: "primary user-owned resource pointer", pattern: /\buse:\s*["']\/portal\/api\/user-owned-resources/ },
    ],
  },
  {
    file: "services/portal/frontend/src/api/portal/resources.ts",
    checks: [
      { token: "frontend primary user-owned API path", pattern: /apiClient\.(?:get|post)[\s\S]*?["']\/user-owned-resources/ },
    ],
  },
  {
    file: "services/portal/frontend/src/views/resources/ResourcesView.vue",
    checks: [
      { token: "运行节点", pattern: /运行节点/ },
      { token: "运行代理", pattern: /运行代理/ },
    ],
  },
  {
    file: "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs",
    checks: [
      { token: "fetchWorkspaceMinioState", pattern: /\bfetchWorkspaceMinioState\b/ },
      { token: "fetchMinioSummary", pattern: /\bfetchMinioSummary\b/ },
      { token: "user_owned_storage", pattern: /\buser_owned_storage\b/ },
    ],
  },
  {
    file: "services/portal/src/integrations/opl-adapter-client.mjs",
    checks: [
      { token: "catch {}", pattern: /catch\s*\{\s*\}/ },
      { token: "fetchJson return null", pattern: /async function fetchJson[\s\S]*?return null;/ },
    ],
  },
];

function absolutePath(filePath) {
  return path.resolve(repoRoot, filePath);
}

async function readRequiredFile(filePath) {
  try {
    return await readFile(absolutePath(filePath), "utf8");
  } catch (error) {
    throw new Error(`required_file_missing_or_unreadable:${filePath}:${error instanceof Error ? error.message : String(error)}`);
  }
}

function findLine(content, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  const match = globalPattern.exec(content);
  if (!match) return null;
  return content.slice(0, match.index).split("\n").length;
}

function collectViolations(file, content, checks, violations) {
  for (const check of checks) {
    const line = findLine(content, check.pattern);
    if (line === null) continue;
    violations.push({
      rule: "retired_stack_token_detected",
      file,
      token: check.token,
      line,
      message: `${file} still contains retired stack token ${check.token}`,
    });
  }
}

async function main() {
  const violations = [];
  for (const entry of REQUIRED_FILES) {
    const content = await readRequiredFile(entry.file);
    collectViolations(entry.file, content, entry.checks, violations);
  }

  const payload = {
    ok: violations.length === 0,
    status: violations.length === 0 ? "pass" : "fail",
    contract: "v21_platform_provisioned_runtime_boundaries",
    checkedFiles: REQUIRED_FILES.map((entry) => entry.file),
    violations,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    status: "error",
    contract: "v21_platform_provisioned_runtime_boundaries",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
