#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const budgets = Object.freeze({
  docsMarkdownFiles: 16,
  scriptsFiles: 8,
  testsMjsFiles: 110,
  testsRegressionPortalFiles: 32,
  testsFutureAuthorizedCloudFiles: 24,
  servicesPortalFiles: 260,
  servicesPortalBytes: 2_000_000,
});

const areaPrefixes = Object.freeze([
  "docs/",
  "scripts/",
  "tests/health/",
  "tests/smoke/",
  "tests/contract/",
  "tests/regression/portal/",
  "tests/regression/opl/",
  "tests/regression/runtime-bridge/",
  "tests/future-authorized/cloud/",
  "tests/fixtures/",
  "services/portal/",
  "services/opl-web-gateway/",
  "services/opl-runtime-bridge/",
]);

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `git ${args.join(" ")} failed\n`);
    process.exit(result.status ?? 1);
  }
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

function areaForFile(filePath) {
  return areaPrefixes.find((prefix) => filePath.startsWith(prefix))?.replace(/\/$/u, "") || filePath.split("/")[0];
}

function fileSize(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  if (!existsSync(absolutePath)) return 0;
  return statSync(absolutePath).size;
}

function countMatching(files, predicate) {
  return files.filter(predicate).length;
}

function largestAreas(files) {
  const areas = new Map();
  for (const file of files) {
    const area = areaForFile(file);
    const current = areas.get(area) || { path: area, files: 0, bytes: 0 };
    current.files += 1;
    current.bytes += fileSize(file);
    areas.set(area, current);
  }
  return [...areas.values()]
    .sort((left, right) => right.files - left.files || right.bytes - left.bytes || left.path.localeCompare(right.path))
    .slice(0, 12);
}

function bloatBudgetFindings(counts) {
  const findings = [];
  for (const [key, limit] of Object.entries(budgets)) {
    if (counts[key] > limit) {
      findings.push({
        code: "bloat_budget_exceeded",
        metric: key,
        actual: counts[key],
        limit,
      });
    }
  }
  return findings;
}

const tracked = runGit(["ls-files", "--cached", "--others", "--exclude-standard"]);
const counts = {
  docsMarkdownFiles: countMatching(tracked, (file) => file.startsWith("docs/") && file.endsWith(".md")),
  scriptsFiles: countMatching(tracked, (file) => file.startsWith("scripts/")),
  testsMjsFiles: countMatching(tracked, (file) => file.startsWith("tests/") && file.endsWith(".mjs")),
  testsRegressionPortalFiles: countMatching(tracked, (file) => file.startsWith("tests/regression/portal/") && file.endsWith(".mjs")),
  testsFutureAuthorizedCloudFiles: countMatching(tracked, (file) => file.startsWith("tests/future-authorized/cloud/") && file.endsWith(".mjs")),
  servicesPortalFiles: countMatching(tracked, (file) => file.startsWith("services/portal/")),
  servicesPortalBytes: tracked.filter((file) => file.startsWith("services/portal/")).reduce((total, file) => total + fileSize(file), 0),
};
const findings = bloatBudgetFindings(counts);
const notes = [];

if (counts.testsRegressionPortalFiles >= 24) {
  notes.push("tests/regression/portal is the largest test area; split by product surface before adding broad regression files.");
}
if (counts.testsFutureAuthorizedCloudFiles >= 18) {
  notes.push("tests/future-authorized/cloud is large; keep future-authorized cloud checks out of current/default verification unless separately authorized.");
}
if (counts.servicesPortalFiles >= 230) {
  notes.push("services/portal is the largest source area; add broad portal surface files only with a dedicated product-surface split.");
}

const payload = {
  ok: findings.length === 0,
  contract: "v22_repo_bloat_audit",
  bloat_budget: "hard budgets count git-tracked plus non-ignored untracked files; this audit reports pressure and blocks only when budgets are exceeded.",
  budgets,
  counts,
  largestAreas: largestAreas(tracked),
  findings,
  notes,
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
if (!payload.ok) process.exitCode = 1;
