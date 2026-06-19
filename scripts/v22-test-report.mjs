import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

  return payload;
}
