#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

const fixedLocalServiceTruthClaimPattern = /(?:http:\/\/(?:127\.0\.0\.1|localhost):(?:17080|17081|17082|17180|18130|18789|8788|5173)\b|\b(?:17080|17081|17082|17180|18130|18789|8788|5173)\b)/u;
const currentTruthLocalServiceClaimFiles = Object.freeze([
  "docs/active/README.md",
  "docs/delivery/README.md",
  ...runGit(["ls-files", "--", "changes/active/**/*.md"]),
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

function readTrackedFile(repoPath) {
  return readFileSync(repoPath, "utf8");
}

const trackedForbidden = matches([], forbiddenTrackedPathGlobs);
const untrackedGenerated = runGit(["ls-files", "--others", "--exclude-standard", "--", ...forbiddenUntrackedPathGlobs]);
const fixedLocalServiceTruthClaims = currentTruthLocalServiceClaimFiles.filter((repoPath) => {
  const source = readTrackedFile(repoPath);
  return fixedLocalServiceTruthClaimPattern.test(source);
});
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

if (fixedLocalServiceTruthClaims.length > 0) {
  failures.push({
    code: "fixed_local_service_endpoint_in_current_truth",
    files: fixedLocalServiceTruthClaims,
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
    fixedLocalServiceTruthClaimPattern: String(fixedLocalServiceTruthClaimPattern),
    currentTruthLocalServiceClaimFiles,
  },
}, null, 2)}\n`);
