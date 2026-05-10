import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(".");
const runnerPath = "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs";

const forbiddenOutputPattern = /SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|signedUrl|rawResponse|providerRawResponse|cosObjectBody|bucketPolicy/i;

function runRunner(args) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(forbiddenOutputPattern.test(result.stdout), false, `stdout_must_be_redacted:${args.join(" ")}`);
  assert.equal(forbiddenOutputPattern.test(result.stderr), false, `stderr_must_be_redacted:${args.join(" ")}`);
  let parsed = null;
  try {
    parsed = JSON.parse((result.stdout || result.stderr || "{}").trim());
  } catch {
    parsed = null;
  }
  return { result, parsed };
}

const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "v22-package-c-live-gate-"));
const fixtures = [
  {
    name: "package-c-mutation.env",
    text: [
      "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
      "TENCENT_MUTATION_SECRET_ID=mutation-secret-id-proof",
      "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key-proof",
      "TENCENT_MUTATION_ALLOWED_APIS=putObject,deleteObject,DescribeNodePools,ScaleNodePool",
      "TENCENT_MUTATION_REGIONS=na-siliconvalley",
      "TENCENT_MUTATION_ACCOUNT_ID=account-proof-123456",
      "TENCENT_MUTATION_DAILY_BUDGET_CNY=20",
      "TENCENT_MUTATION_MAX_OPERATION_COUNT=6",
      "TENCENT_MUTATION_TKE_CLUSTER_ID=cluster-proof",
      "TENCENT_MUTATION_TKE_NODE_POOL_ID=node-pool-proof",
      "TENCENT_MUTATION_COS_BUCKET=bucket-proof",
      "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
      "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=workspace-prefix-proof",
    ].join("\n"),
  },
  {
    name: "readonly.env",
    text: [
      "RUN_TENCENT_READONLY_INVENTORY=1",
      "TENCENT_READONLY_SECRET_ID=readonly-secret-proof",
    ].join("\n"),
  },
  {
    name: "deploy.env",
    text: [
      "RUN_TENCENT_DEPLOY_EXECUTION=1",
      "TCR_SECRET=deploy-secret-proof",
    ].join("\n"),
  },
];

const checked = [];
let acceptedSecretFile = "";
try {
  for (const fixture of fixtures) {
    writeFileSync(path.join(fixtureDir, fixture.name), fixture.text, "utf8");
  }

  for (const fixture of fixtures) {
    const file = path.join(fixtureDir, fixture.name);
    const { result, parsed } = runRunner([
      "--check-config",
      "--secret-file",
      file,
      "--operation",
      "storage-create",
    ]);
    const ok = result.status === 0 && parsed?.ok === true;
    checked.push({
      file: path.basename(file),
      ok,
      blockedReason: ok ? "" : (parsed?.summary?.blockedReason || parsed?.error || "check_config_failed"),
    });
    if (ok && !acceptedSecretFile) {
      acceptedSecretFile = fixture.name;
    }
  }
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_authorized_resource_lifecycle_live_gate",
  checked,
  liveReady: Boolean(acceptedSecretFile),
  acceptedSecretFile,
  blockedReason: acceptedSecretFile ? "" : "no_package_c_mutation_secret_file_matches_allowlist",
}, null, 2));
