import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  evaluateProductionReceiptManifest,
  PRODUCTION_RECEIPT_BOUNDARY_PATH,
} from "./v22-production-receipt-boundary.mjs";

function commandToSpawn(command) {
  const parts = String(command || "").match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function defaultExecutor(command, context) {
  const [bin, ...args] = commandToSpawn(command);
  if (!bin) throw new Error(`empty_command:${command}`);
  const result = spawnSync(bin, args, {
    cwd: context.repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: context.env,
  });
  return {
    command,
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
    ok: result.status === 0,
  };
}

async function loadExecutor({ repoRoot, env }) {
  const executorModulePath = env.V22_VERIFY_COMMAND_EXECUTOR;
  if (!executorModulePath) return defaultExecutor;
  const resolvedPath = path.isAbsolute(executorModulePath)
    ? executorModulePath
    : path.join(repoRoot, executorModulePath);
  const moduleUrl = pathToFileURL(resolvedPath).href;
  const loaded = await import(moduleUrl);
  const executor = loaded.default || loaded.runCommand;
  if (typeof executor !== "function") {
    throw new Error(`invalid_command_executor:${executorModulePath}`);
  }
  return executor;
}

function createCommandRecords(plan, { includeAuthorized = false } = {}) {
  return [
    ...(plan.recommendedCommands || []).map((command) => ({
      command,
      source: "recommended",
      status: "planned",
    })),
    ...(plan.authorizedCommands || []).map((command) => ({
      command,
      source: "authorized",
      status: includeAuthorized ? "planned" : "skipped",
      ...(includeAuthorized ? {} : { skippedReason: "authorized_command_requires_explicit_authorization_pack" }),
    })),
  ];
}

function defaultReceiptManifestPath(plan) {
  const evidenceSink = String(plan.authorization?.evidenceSink || "").replace(/\/+$/u, "");
  const runId = String(plan.authorization?.runId || "").trim();
  if (!evidenceSink || !runId) return "";
  return `${evidenceSink}/${runId}/receipt-manifest.json`;
}

function productionReceiptManifestRequirement(plan) {
  const requirement = plan.authorization?.postAuthorizedCommandReceiptManifest || {};
  const required = Boolean(requirement.required);
  return {
    requiredAfterAuthorizedCommands: required,
    contract: requirement.contract || PRODUCTION_RECEIPT_BOUNDARY_PATH,
    path: defaultReceiptManifestPath(plan),
    policy: requirement.policy || "small_pointer_and_summary_only",
    status: required ? "pending" : "not_required",
  };
}

function validateWrittenReceiptManifest(repoRoot, plan) {
  const manifestPath = defaultReceiptManifestPath(plan);
  if (!manifestPath) {
    return {
      ok: false,
      status: "missing_path",
      path: "",
      blockers: ["production_receipt_manifest_path_missing"],
    };
  }
  const absoluteManifestPath = path.join(repoRoot, manifestPath);
  if (!existsSync(absoluteManifestPath)) {
    return {
      ok: false,
      status: "missing",
      path: manifestPath,
      blockers: ["production_receipt_manifest_missing_after_authorized_commands"],
    };
  }
  try {
    const boundary = JSON.parse(readFileSync(path.join(repoRoot, PRODUCTION_RECEIPT_BOUNDARY_PATH), "utf8"));
    const manifest = JSON.parse(readFileSync(absoluteManifestPath, "utf8"));
    const evaluated = evaluateProductionReceiptManifest({ boundary, manifest });
    const rawBlockers = [
      ...(evaluated.rawEvidenceViolations || []).map((field) => `production_receipt_manifest_raw_field:${field}`),
      ...(evaluated.unexpectedFieldViolations || []).map((field) => `production_receipt_manifest_unexpected_field:${field}`),
    ];
    return {
      ok: rawBlockers.length === 0,
      status: evaluated.cloudReleaseCandidateComplete ? "complete" : "present",
      path: manifestPath,
      cloudReleaseCandidateComplete: evaluated.cloudReleaseCandidateComplete,
      productionComplete: evaluated.productionComplete,
      blockers: rawBlockers,
      missingReceiptTypes: evaluated.missingReceiptTypes,
    };
  } catch (error) {
    return {
      ok: false,
      status: "invalid",
      path: manifestPath,
      blockers: [`production_receipt_manifest_invalid:${error.message}`],
    };
  }
}

export async function runPlanWithReport({
  repoRoot,
  plan,
  dryRun = false,
  includeAuthorized = false,
  env = process.env,
}) {
  const executableAuthorized = Boolean(includeAuthorized && plan.authorization?.authorizedCommandsExecutable);
  const commands = createCommandRecords(plan, { includeAuthorized: executableAuthorized });
  const payload = {
    ok: true,
    mode: "run-plan",
    profile: plan.profile,
    changedFiles: plan.changedFiles,
    matchedSurfaces: plan.matchedSurfaces,
    environments: plan.environments,
    authorizedEnvironments: plan.authorizedEnvironments,
    recommendedCommands: plan.recommendedCommands,
    authorizedCommands: plan.authorizedCommands,
    reasons: plan.reasons,
    cannotClaim: plan.cannotClaim,
    preflight: plan.preflight,
    dryRun,
    executesCommands: !dryRun,
    includeAuthorized: executableAuthorized,
    commands,
    report: {
      kind: "v22_dynamic_test_plan_report",
      mode: "run-plan",
      profile: plan.profile,
      changedFiles: plan.changedFiles,
      matchedSurfaces: plan.matchedSurfaces,
      environments: plan.environments,
      authorizedEnvironments: plan.authorizedEnvironments,
      preflight: plan.preflight,
      authorization: plan.authorization,
      cannotClaim: plan.cannotClaim,
      commands: {
        planned: [...(plan.recommendedCommands || [])],
        executed: [],
        skippedAuthorized: executableAuthorized ? [] : [...(plan.authorizedCommands || [])],
        authorizedExecuted: [],
      },
      completion: {
        status: "not_started",
        cannotClaim: plan.cannotClaim,
      },
      productionReceiptManifest: productionReceiptManifestRequirement(plan),
    },
  };

  if (plan.preflight && !plan.preflight.ok) {
    payload.ok = false;
    payload.executesCommands = false;
    for (const record of payload.commands) {
      if (record.source !== "recommended") continue;
      record.status = dryRun ? "planned" : "skipped";
      if (!dryRun) record.skippedReason = "preflight_failed";
    }
    payload.report.completion.status = "blocked";
    return payload;
  }

  if (includeAuthorized && !plan.authorization?.authorizedCommandsExecutable) {
    payload.ok = false;
    payload.executesCommands = false;
    payload.includeAuthorized = false;
    payload.report.authorization = plan.authorization;
    for (const record of payload.commands) {
      if (record.source !== "authorized") continue;
      record.status = "skipped";
      record.skippedReason = "authorization_pack_invalid";
    }
    payload.report.completion.status = "blocked";
    return payload;
  }

  if (dryRun) {
    return payload;
  }

  const executor = await loadExecutor({ repoRoot, env });
  for (const record of payload.commands) {
    if (record.source !== "recommended" && !(record.source === "authorized" && executableAuthorized)) continue;
    const result = await executor(record.command, {
      mode: payload.mode,
      dryRun,
      repoRoot,
      env,
      plan: payload,
    });
    if (result?.stdout) process.stderr.write(result.stdout);
    if (result?.stderr) process.stderr.write(result.stderr);
    record.ok = Boolean(result?.ok);
    record.exitCode = result?.status ?? 1;
    record.status = record.ok ? "executed" : "failed";
    payload.report.commands.executed.push({
      command: record.command,
      source: record.source,
      ok: record.ok,
      status: record.exitCode,
    });
    if (record.source === "authorized") {
      payload.report.commands.authorizedExecuted.push({
        command: record.command,
        ok: record.ok,
        status: record.exitCode,
      });
    }
    if (!record.ok) {
      payload.ok = false;
      payload.report.completion.status = "blocked";
      break;
    }
  }

  if (payload.ok) {
    payload.report.completion.status = executableAuthorized
      ? "recommended_and_authorized_commands_passed"
      : "local_recommended_commands_passed";
  }

  if (payload.ok && executableAuthorized && payload.report.commands.authorizedExecuted.length > 0) {
    const receiptManifest = validateWrittenReceiptManifest(repoRoot, plan);
    payload.report.productionReceiptManifest = {
      ...payload.report.productionReceiptManifest,
      ...receiptManifest,
    };
    if (!receiptManifest.ok) {
      payload.ok = false;
      payload.report.completion.status = "blocked";
    }
  }

  return payload;
}
