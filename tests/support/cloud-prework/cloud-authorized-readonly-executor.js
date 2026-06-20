import { spawnSync } from "node:child_process";
import path from "node:path";

function safeSdkMode(value = "") {
  const mode = String(value || "tencent-official-sdk-readonly").trim();
  if (mode === "fake-readonly" || mode === "tencent-official-sdk-readonly") return mode;
  throw new Error(`readonly_executor_invalid_sdk_mode:${mode}`);
}

function sanitizeSummary(value = {}) {
  const json = JSON.stringify(value || {});
  return JSON.parse(json
    .replace(/SecretId/gu, "SecretRef")
    .replace(/SecretKey/gu, "SecretRef")
    .replace(/secret/giu, "redacted_secret_ref")
    .replace(/rawResponse/gu, "redacted_raw_response")
    .replace(/kubeconfig/giu, "kubeconfig_ref"));
}

export default async function runCommand(command, context = {}) {
  if (context.operationClass !== "readonly_inventory") {
    return {
      command,
      ok: false,
      status: 64,
      summary: {
        blocker: "readonly_executor_operation_not_supported",
        operationClass: context.operationClass,
      },
    };
  }

  const secretFile = process.env.V22_TENCENT_READONLY_SECRET_FILE;
  if (!secretFile) {
    return {
      command,
      ok: false,
      status: 65,
      summary: {
        blocker: "readonly_secret_file_missing",
        requiredEnv: "V22_TENCENT_READONLY_SECRET_FILE",
      },
    };
  }

  const sdkMode = safeSdkMode(process.env.V22_TENCENT_READONLY_SDK_MODE);
  const repoRoot = context.repoRoot || process.cwd();
  const reportDir = path.dirname(path.join(repoRoot, context.evidenceRef || ".runtime/v22-cloud-authorization/run-v22-001/readonly_inventory.json"));
  const runId = `readonly-${context.authorization?.runId || "run"}`;
  const args = [
    "tests/support/cloud-prework/tencent-readonly-inventory-support.js",
    "--live-readonly",
    "--confirm-current-session-authorization",
    "--secret-file",
    secretFile,
    "--sdk-mode",
    sdkMode,
    "--report-dir",
    reportDir,
    "--run-id",
    runId,
  ];
  if (sdkMode === "tencent-official-sdk-readonly") args.push("--enable-official-sdk-loader");

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });
  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout || "{}");
  } catch {
    parsed = {};
  }
  return {
    command,
    ok: result.status === 0 && parsed.ok === true,
    status: result.status ?? 1,
    summary: sanitizeSummary({
      operationClass: context.operationClass,
      runnerId: context.runnerId,
      reportPath: parsed.reportPath || "",
      sdkMode,
      blockers: parsed.blockers || [],
    }),
  };
}
