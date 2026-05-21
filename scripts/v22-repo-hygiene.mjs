#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const forbiddenTrackedPathGlobs = Object.freeze([
  "tmp",
  ":(glob)**/dist/**",
  ":(glob)**/build/**",
  ":(glob)**/out/**",
  ":(glob)**/target/**",
  ":(glob)**/.venv/**",
  ":(glob)**/__pycache__/**",
  ":(glob)**/.pytest_cache/**",
  ":(glob)**/*.egg-info/**",
  ":(glob)**/.DS_Store",
  ":(glob)**/.codex/**",
  ":(glob)**/.omx/**",
  ":(glob)**/.runtime/**",
  ":(glob)**/.runtime-program/**",
  ":(glob)**/runtime-state/**",
  ".agent-contract-baseline.json",
]);

const forbiddenUntrackedPathGlobs = Object.freeze([
  ...forbiddenTrackedPathGlobs,
  ":(glob)**/coverage/**",
  ":(glob)**/.turbo/**",
  ":(glob)**/.next/**",
]);

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `git ${args.join(" ")} failed\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

function matches(paths, globs) {
  return runGit(["ls-files", ...paths, "--", ...globs]);
}

const trackedForbidden = matches([], forbiddenTrackedPathGlobs);
const untrackedGenerated = runGit(["ls-files", "--others", "--exclude-standard", "--", ...forbiddenUntrackedPathGlobs]);
const failures = [];

if (trackedForbidden.length > 0) {
  failures.push({
    code: "forbidden_tracked_generated_path",
    files: trackedForbidden,
  });
}

if (untrackedGenerated.length > 0) {
  failures.push({
    code: "generated_path_not_ignored",
    files: untrackedGenerated,
  });
}

if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify({ ok: false, contract: "v22_repo_hygiene", failures }, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  contract: "v22_repo_hygiene",
  checked: {
    forbiddenTrackedPathGlobs,
    forbiddenUntrackedPathGlobs,
  },
}, null, 2)}\n`);
