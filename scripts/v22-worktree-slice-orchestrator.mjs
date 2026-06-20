#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const PHASES = ["start", "plan", "verify", "land", "post-push-verify", "cleanup"];
const GIT_MUTATION_PHASES = new Set(["land", "cleanup"]);
const RETIRED_CHANGE_SURFACE_PREFIXES = Object.freeze([
  ["changes", "active", "**"].join("/"),
  ["changes", "archive", "**"].join("/"),
]);
const PHASE_DETAILS = Object.freeze({
  start: Object.freeze({
    requires: Object.freeze(["clean worktree or isolated feature worktree", "base ref origin/recovery/platform-v22-trunk"]),
    commands: Object.freeze(["node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk"]),
    produces: Object.freeze(["slice metadata plan", "allowed and forbidden surface check"]),
  }),
  plan: Object.freeze({
    requires: Object.freeze(["slice:start accepted"]),
    commands: Object.freeze(["node scripts/v22-verify.mjs plan --base origin/recovery/platform-v22-trunk"]),
    produces: Object.freeze(["changed-file surface plan", "preflight and cannot-claim report"]),
  }),
  verify: Object.freeze({
    requires: Object.freeze(["slice:plan reviewed"]),
    commands: Object.freeze(["node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk"]),
    produces: Object.freeze(["local current verification evidence"]),
  }),
  land: Object.freeze({
    requires: Object.freeze(["slice:verify passed", "human-selected landing operator"]),
    commands: Object.freeze(["node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk"]),
    produces: Object.freeze(["landing readiness check; no merge or push is executed by this dry-run orchestrator"]),
  }),
  "post-push-verify": Object.freeze({
    requires: Object.freeze(["branch has been landed and pushed by explicit operator"]),
    commands: Object.freeze([
      "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
      "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
    ]),
    produces: Object.freeze(["post-push verification command bundle"]),
  }),
  cleanup: Object.freeze({
    requires: Object.freeze(["post-push verification passed", "closeout/cursor fields updated"]),
    commands: Object.freeze(["node scripts/v22-landing-closeout.mjs check --trunk-ref origin/recovery/platform-v22-trunk"]),
    produces: Object.freeze(["worktree cleanup readiness check", "closeout/cursor consistency check"]),
  }),
});

function repoRelative(...parts) {
  return path.join(...parts).replaceAll("\\", "/");
}

function sanitizeId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function currentBranchName() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function defaultSliceId() {
  return sanitizeId(currentBranchName()) || "v22-slice";
}

function slicePaths(sliceId) {
  const safeSliceId = sanitizeId(sliceId) || defaultSliceId();
  const dir = path.join(repoRoot, ".runtime", "slices", safeSliceId);
  return {
    id: safeSliceId,
    dir,
    manifestPath: path.join(dir, "slice.json"),
    publicManifestPath: repoRelative(".runtime", "slices", safeSliceId, "slice.json"),
  };
}

function readSliceManifest(sliceId) {
  const paths = slicePaths(sliceId);
  if (!existsSync(paths.manifestPath)) return null;
  return JSON.parse(readFileSync(paths.manifestPath, "utf8"));
}

function initialSliceManifest({ sliceId, options }) {
  const branch = currentBranchName();
  return {
    schema_version: 1,
    kind: "v22_worktree_slice_execution",
    slice_id: sliceId,
    owner: options.owner || "MedOPL Engineering",
    base_ref: options.base || "origin/recovery/platform-v22-trunk",
    branch,
    current_phase: "",
    execution_mode: "controlled-executor",
    git_mutation_allowed: Boolean(options["allow-git-mutation"]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    allowed_files: [],
    forbidden_files: [...RETIRED_CHANGE_SURFACE_PREFIXES],
    cannot_claim: ["destructive cloud execution", "live-test execution", "production complete"],
    phases: Object.fromEntries(PHASES.map((phase) => [phase, { status: "pending" }])),
  };
}

function writeSliceManifest(sliceId, manifest) {
  const paths = slicePaths(sliceId);
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return paths.publicManifestPath;
}

function commandToSpawn(command) {
  const parts = String(command || "").match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function runCommand(command) {
  const [bin, ...args] = commandToSpawn(command);
  if (!bin) return { command, ok: false, status: 1, stderr: "empty_command" };
  const result = spawnSync(bin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });
  return {
    command,
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseArgs(argv) {
  const [phase, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return { phase, options };
}

function readPackageScripts() {
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts || {};
}

function buildPlan(phase, options = {}) {
  if (!PHASES.includes(phase)) throw new Error(`unknown_slice_phase:${phase || "(missing)"}`);
  const phaseIndex = PHASES.indexOf(phase);
  const details = PHASE_DETAILS[phase];
  const execute = Boolean(options.execute);
  const allowGitMutation = Boolean(options["allow-git-mutation"]);
  const sliceId = sanitizeId(options["slice-id"]) || defaultSliceId();
  const paths = slicePaths(sliceId);
  return {
    ok: true,
    kind: "v22_worktree_slice_orchestrator_plan",
    phase,
    phases: PHASES,
    dryRun: !execute,
    failClosed: true,
    executesCommands: execute,
    executionAllowed: execute,
    executionMode: execute ? "controlled-executor" : "plan-only",
    usesRealMergePush: execute && allowGitMutation && GIT_MUTATION_PHASES.has(phase),
    gitMutationAllowed: allowGitMutation,
    previousPhase: PHASES[phaseIndex - 1] || "",
    nextPhase: PHASES[phaseIndex + 1] || "",
    requires: details.requires,
    commands: details.commands,
    produces: details.produces,
    slice: {
      id: sliceId,
      manifestPath: paths.publicManifestPath,
    },
    workflowDependencies: [
      "scripts/v22-verify.mjs",
      "scripts/v22-workflow-gate.mjs",
      "scripts/v22-landing-closeout.mjs",
    ],
    cannotClaim: ["real merge", "real push", "destructive cloud execution", "live-test execution"],
    registeredScripts: {
      start: readPackageScripts()["slice:start"] || "",
      plan: readPackageScripts()["slice:plan"] || "",
      verify: readPackageScripts()["slice:verify"] || "",
      land: readPackageScripts()["slice:land"] || "",
      "post-push-verify": readPackageScripts()["slice:post-push-verify"] || "",
      cleanup: readPackageScripts()["slice:cleanup"] || "",
    },
  };
}

function executePhase(phase, options) {
  const payload = buildPlan(phase, { ...options, execute: true });
  const sliceId = payload.slice.id;
  if (GIT_MUTATION_PHASES.has(phase) && !options["allow-git-mutation"]) {
    return {
      ...payload,
      ok: false,
      executesCommands: false,
      usesRealMergePush: false,
      blockers: ["slice_git_mutation_requires_allow_git_mutation"],
    };
  }

  const now = new Date().toISOString();
  const manifest = readSliceManifest(sliceId) || initialSliceManifest({ sliceId, options });
  manifest.current_phase = phase;
  manifest.updated_at = now;
  manifest.git_mutation_allowed = Boolean(options["allow-git-mutation"]);
  manifest.phases ||= Object.fromEntries(PHASES.map((item) => [item, { status: "pending" }]));

  const evidenceRef = repoRelative(".runtime", "slices", sliceId, `${phase}.json`);
  const phaseRecord = {
    status: "executed",
    executed_at: now,
    evidence_ref: evidenceRef,
    commands: [],
  };

  if (phase !== "start") {
    for (const command of payload.commands) {
      const result = runCommand(command);
      phaseRecord.commands.push({
        command: result.command,
        status: result.status,
        ok: result.ok,
      });
      if (!result.ok) {
        phaseRecord.status = "blocked";
        payload.ok = false;
        payload.blockers = [`slice_phase_command_failed:${phase}:${command}`];
        break;
      }
    }
  }

  manifest.phases[phase] = phaseRecord;
  const manifestPath = writeSliceManifest(sliceId, manifest);
  const paths = slicePaths(sliceId);
  writeFileSync(path.join(paths.dir, `${phase}.json`), `${JSON.stringify({
    kind: "v22_worktree_slice_phase_evidence",
    slice_id: sliceId,
    phase,
    status: phaseRecord.status,
    commands: phaseRecord.commands,
    created_at: now,
  }, null, 2)}\n`);

  return {
    ...payload,
    slice: {
      ...payload.slice,
      manifestPath,
    },
    phaseStatus: phaseRecord.status,
  };
}

function main() {
  const { phase, options } = parseArgs(process.argv.slice(2));
  if (!options.json) {
    process.stderr.write("Usage:\n  node scripts/v22-worktree-slice-orchestrator.mjs <start|plan|verify|land|post-push-verify|cleanup> [--json]\n");
    process.exitCode = 2;
    return;
  }
  const payload = options.execute ? executePhase(phase, options) : buildPlan(phase, options);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!payload.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
