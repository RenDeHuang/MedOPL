#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const PHASES = ["start", "plan", "verify", "land", "post-push-verify", "cleanup"];
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

function buildPlan(phase) {
  if (!PHASES.includes(phase)) throw new Error(`unknown_slice_phase:${phase || "(missing)"}`);
  const phaseIndex = PHASES.indexOf(phase);
  const details = PHASE_DETAILS[phase];
  return {
    ok: true,
    kind: "v22_worktree_slice_orchestrator_plan",
    phase,
    phases: PHASES,
    dryRun: true,
    failClosed: true,
    executesCommands: false,
    executionMode: "plan-only",
    usesRealMergePush: false,
    previousPhase: PHASES[phaseIndex - 1] || "",
    nextPhase: PHASES[phaseIndex + 1] || "",
    requires: details.requires,
    commands: details.commands,
    produces: details.produces,
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

function main() {
  const { phase, options } = parseArgs(process.argv.slice(2));
  if (!options.json) {
    process.stderr.write("Usage:\n  node scripts/v22-worktree-slice-orchestrator.mjs <start|plan|verify|land|post-push-verify|cleanup> [--json]\n");
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`${JSON.stringify(buildPlan(phase), null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
