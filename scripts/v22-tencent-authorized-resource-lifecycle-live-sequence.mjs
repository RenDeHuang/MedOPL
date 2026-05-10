#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(".");
const runnerPath = "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs";

const operations = Object.freeze([
  { operation: "storage-create", acceptedDryRunId: "package-c-live-storage-create", needsCapacity: false },
  { operation: "compute-expand", acceptedDryRunId: "package-c-live-compute-expand", needsCapacity: true },
  { operation: "compute-release", acceptedDryRunId: "package-c-live-compute-release", needsCapacity: true },
  { operation: "storage-delete", acceptedDryRunId: "package-c-live-storage-delete", needsCapacity: false },
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const options = {
    secretFile: "",
    secretDir: "",
    workspaceId: "",
    targetDesiredCapacity: "",
    releaseDesiredCapacity: "0",
    runId: "package-c-live",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--secret-file") {
      options.secretFile = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--secret-dir") {
      options.secretDir = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--workspace-id") {
      options.workspaceId = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--target-desired-capacity") {
      options.targetDesiredCapacity = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--release-desired-capacity") {
      options.releaseDesiredCapacity = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--run-id") {
      options.runId = text(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`tencent_resource_lifecycle_live_sequence_unknown_arg:${arg}`);
  }
  return options;
}

function candidateFiles(secretDir) {
  if (!secretDir) return [];
  try {
    return readdirSync(secretDir)
      .filter((name) => !name.startsWith("."))
      .map((name) => path.join(secretDir, name))
      .sort();
  } catch {
    return [];
  }
}

function runRunner(args) {
  const result = spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  let parsed = null;
  try {
    parsed = JSON.parse((result.stdout || result.stderr || "{}").trim());
  } catch {
    parsed = null;
  }
  return { status: result.status, parsed };
}

function discoverSecretFile(explicitFile = "", secretDir = "") {
  if (explicitFile) return explicitFile;
  for (const file of candidateFiles(secretDir)) {
    const { status, parsed } = runRunner([
      "--check-config",
      "--secret-file",
      file,
      "--operation",
      "storage-create",
    ]);
    if (status === 0 && parsed?.ok === true) return file;
  }
  return "";
}

function dryRun({ secretFile, operation, acceptedDryRunId }) {
  return runRunner([
    "--dry-run",
    "--secret-file",
    secretFile,
    "--operation",
    operation,
    "--run-id",
    acceptedDryRunId.replace(`-${operation}`, ""),
  ]);
}

function execute({ secretFile, operation, acceptedDryRunId, workspaceId, targetDesiredCapacity }) {
  const args = [
    "--execute",
    "--sdk-mode",
    "tencent-official-sdk-live",
    "--secret-file",
    secretFile,
    "--operation",
    operation,
    "--run-id",
    acceptedDryRunId.replace(`-${operation}`, ""),
    "--accepted-dry-run-id",
    acceptedDryRunId,
    "--workspace-id",
    workspaceId,
  ];
  if (operation.startsWith("compute-")) {
    args.push("--target-desired-capacity", targetDesiredCapacity);
  }
  return runRunner(args);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const secretFile = discoverSecretFile(options.secretFile, options.secretDir);
  if (!secretFile) {
    console.log(JSON.stringify({
      ok: false,
      contract: "v22_tencent_authorized_resource_lifecycle_live_sequence",
      blockedReason: "no_package_c_mutation_secret_file_matches_allowlist",
      executed: [],
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const executed = [];
  for (const item of operations) {
    const runId = item.acceptedDryRunId.replace(`-${item.operation}`, "");
    const dry = runRunner([
      "--dry-run",
      "--secret-file",
      secretFile,
      "--operation",
      item.operation,
      "--run-id",
      runId,
    ]);
    executed.push({ phase: "dry-run", operation: item.operation, ok: dry.status === 0, reportPath: dry.parsed?.reportPath || "" });
    if (dry.status !== 0) {
      console.log(JSON.stringify({
        ok: false,
        contract: "v22_tencent_authorized_resource_lifecycle_live_sequence",
        blockedReason: dry.parsed?.summary?.blockedReason || dry.parsed?.error || "dry_run_failed",
        executed,
      }, null, 2));
      process.exitCode = 1;
      return;
    }
    const desiredCapacity = item.operation === "compute-release" ? options.releaseDesiredCapacity : options.targetDesiredCapacity;
    const live = execute({
      secretFile,
      operation: item.operation,
      acceptedDryRunId: item.acceptedDryRunId,
      workspaceId: options.workspaceId || "package-c-live-workspace",
      targetDesiredCapacity: desiredCapacity,
    });
    executed.push({ phase: "execute", operation: item.operation, ok: live.status === 0, reportPath: live.parsed?.reportPath || "", blockedReason: live.parsed?.summary?.blockedReason || "" });
    if (live.status !== 0) {
      console.log(JSON.stringify({
        ok: false,
        contract: "v22_tencent_authorized_resource_lifecycle_live_sequence",
        blockedReason: live.parsed?.summary?.blockedReason || live.parsed?.error || "execute_failed",
        executed,
      }, null, 2));
      process.exitCode = 1;
      return;
    }
  }
  console.log(JSON.stringify({
    ok: true,
    contract: "v22_tencent_authorized_resource_lifecycle_live_sequence",
    executed,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_tencent_authorized_resource_lifecycle_live_sequence",
    error: text(error?.message || error),
  }, null, 2));
  process.exitCode = 1;
});
