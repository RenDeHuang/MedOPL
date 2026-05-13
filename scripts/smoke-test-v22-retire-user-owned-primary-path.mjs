import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const filePaths = {
  repoZoning: "docs/recovery/repo-zoning.md",
  legacyBacklog: "docs/recovery/legacy-cleanup-backlog.md",
  readme: "README.md",
  product: "docs/product.md",
  architecture: "docs/architecture.md",
  productCompose: "compose.product.yaml",
  defaultEntryGate: "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
};

const serviceDeletionTargets = [
  "services/portal/src/domain/user-owned-resources.mjs",
  "services/portal/src/routes/user-owned-resource.routes.mjs",
  "services/portal/src/state/portal-user-owned-resource-store.mjs",
];

const forbiddenDefaultUserOwnedPatterns = [
  {
    pattern: /PRODUCT_RUNTIME_MODE["']?\s*[:=]\s*["']?user_owned/iu,
    detail: "PRODUCT_RUNTIME_MODE must not default to user_owned.",
  },
  {
    pattern: /\buser_owned\b\s+(?:primary|default)\s+(?:path|route|entry|runtime|mode)/iu,
    detail: "user_owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /(?:primary|default)\s+(?:path|route|entry|runtime|mode)\s+\buser_owned\b/iu,
    detail: "user_owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /`user_owned`\s*(?:是|作为|为)\s*(?:默认|主线|主路径|主入口|正式入口)/u,
    detail: "user_owned must not be named as the default or primary product path.",
  },
  {
    pattern: /(?:默认|主线|主路径|主入口|正式入口)\s*(?:是|作为|为)\s*`user_owned`/u,
    detail: "user_owned must not be named as the default or primary product path.",
  },
  {
    pattern: /user-owned\s+(?:primary|default)\s+(?:path|route|entry|runtime|mode)/iu,
    detail: "user-owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /(?:primary|default)\s+(?:path|route|entry|runtime|mode)\s+user-owned/iu,
    detail: "user-owned must not be described as a primary/default v22 path.",
  },
  {
    pattern: /用户自带\s*(?:CVM|COS|K8s|TKE)/iu,
    detail: "Default docs must not restore user-owned cloud resource language.",
  },
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function markdownRows(source) {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function assertRepoZoningUserOwnedTombstones(source) {
  const rows = markdownRows(source);
  for (const targetPath of serviceDeletionTargets) {
    const row = rows.find((cells) => cells[0] === `\`${targetPath}\``);
    assert(row, `repo_zoning_user_owned_target_missing:${targetPath}`);
    assert.equal(row[1], "Zone 2", `repo_zoning_user_owned_target_must_be_zone_2:${targetPath}`);
    assert.equal(row[2], "tombstone/delete", `repo_zoning_user_owned_target_must_be_tombstone_delete:${targetPath}`);
    assert.match(row[3], /legacy alias|旧用户自带资源|user-owned/iu, `repo_zoning_user_owned_reason_missing:${targetPath}`);
    assert.equal(row[5], "user-owned-retirement", `repo_zoning_user_owned_cleanup_slice_mismatch:${targetPath}`);
  }
}

function assertLegacyBacklogSlice(source) {
  assertIncludes(source, "## Slice 2: user_owned Primary Path Retirement", "legacy_backlog_user_owned_slice_heading");
  assertIncludes(
    source,
    "把 `user_owned` / `user-owned` 收敛为 legacy alias 或 tombstone",
    "legacy_backlog_user_owned_retirement_goal",
  );
  assertIncludes(
    source,
    "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
    "legacy_backlog_user_owned_retirement_gate",
  );
  assertIncludes(source, "Portal 默认配置不再是 `user_owned`", "legacy_backlog_user_owned_default_config_check");
  assertIncludes(source, "普通用户页面不展示用户自配云资源", "legacy_backlog_user_owned_user_surface_check");
  assertIncludes(
    source,
    "新代码不得新增 `user-owned` route/domain/store 作为正式入口",
    "legacy_backlog_user_owned_new_entry_check",
  );
  assertIncludes(source, "不做兼容翻译", "legacy_backlog_user_owned_no_compat_translation");
  assertIncludes(
    source,
    "不授权本分支删除、移动或修改实现",
    "legacy_backlog_gate_only_does_not_authorize_implementation_changes",
  );
}

function assertNoUserOwnedPrimaryDefault(source, label) {
  for (const { pattern, detail } of forbiddenDefaultUserOwnedPatterns) {
    const match = pattern.exec(source);
    assert.equal(
      match,
      null,
      `${label}_must_not_restore_user_owned_primary_default:${detail}:line_${match ? lineOf(source, match.index) : "unknown"}`,
    );
  }
}

function parseCompose(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    assert.fail(`compose_product_must_remain_strict_json:${error.message}`);
  }
}

function assertComposeDoesNotUseUserOwnedDefault(source) {
  assertNoUserOwnedPrimaryDefault(source, "compose_product");

  const compose = parseCompose(source);
  assert(compose.services, "compose_product_services_missing");
  for (const [serviceName, service] of Object.entries(compose.services)) {
    const environment = service.environment ?? {};
    assert.notEqual(
      environment.PRODUCT_RUNTIME_MODE,
      "user_owned",
      `compose_product_service_must_not_default_user_owned:${serviceName}`,
    );
    if (Object.hasOwn(environment, "PRODUCT_RUNTIME_MODE")) {
      assert.equal(
        environment.PRODUCT_RUNTIME_MODE,
        "platform_provisioned",
        `compose_product_runtime_mode_must_be_platform_provisioned:${serviceName}`,
      );
    }
  }
}

function assertDefaultEntryGateCoversUserOwned(source) {
  assertIncludes(source, "PRODUCT_RUNTIME_MODE\\\": \\\"user_owned", "default_entry_gate_user_owned_json_runtime_mode");
  assertIncludes(source, "PRODUCT_RUNTIME_MODE=user_owned", "default_entry_gate_user_owned_env_runtime_mode");
  assertIncludes(source, "user_owned_primary_runtime_mode", "default_entry_gate_user_owned_retired_default");
  assertIncludes(source, "assertComposeBoundary", "default_entry_gate_compose_boundary");
}

function assertGateDoesNotRequireServiceDeletion() {
  for (const filePath of Object.values(filePaths)) {
    assert(
      !filePath.startsWith("services/"),
      `retirement_gate_must_not_read_service_file_or_require_deletion:${filePath}`,
    );
  }
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(filePaths).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));

assertGateDoesNotRequireServiceDeletion();
assertRepoZoningUserOwnedTombstones(sources.repoZoning);
assertLegacyBacklogSlice(sources.legacyBacklog);

for (const [label, source] of Object.entries({
  readme: sources.readme,
  product: sources.product,
  architecture: sources.architecture,
})) {
  assertNoUserOwnedPrimaryDefault(source, label);
}

assertComposeDoesNotUseUserOwnedDefault(sources.productCompose);
assertDefaultEntryGateCoversUserOwned(sources.defaultEntryGate);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_user_owned_primary_path",
  checked: {
    repoZoning: filePaths.repoZoning,
    legacyBacklog: filePaths.legacyBacklog,
    defaultEntrypoints: [
      filePaths.readme,
      filePaths.product,
      filePaths.architecture,
      filePaths.productCompose,
    ],
    defaultEntryGate: filePaths.defaultEntryGate,
  },
  retirementTargets: serviceDeletionTargets,
  gateOnly: {
    requiresServiceDeletionNow: false,
    serviceFilesRead: false,
  },
}, null, 2));
