import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const baselinePath = "tests/fixtures/v22/line-budget-baseline.json";

function normalizeFile(file) {
  return String(file || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function gitBlobContent(repoRoot, ref, repoPath) {
  const result = spawnSync("git", ["show", `${ref}:${repoPath}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return "";
  return result.stdout;
}

function countLines(content) {
  if (content.length === 0) return 0;
  return content.endsWith("\n") ? content.split("\n").length - 1 : content.split("\n").length;
}

function readBaseline(repoRoot) {
  return JSON.parse(readFileSync(path.join(repoRoot, baselinePath), "utf8"));
}

export function lineBudgetDiffForChangedFiles(repoRoot, {
  base = "origin/recovery/platform-v22-trunk",
  changedFiles = [],
} = {}) {
  const baseline = readBaseline(repoRoot);
  const baselineFiles = baseline.files || {};
  const trackedOversizeFiles = new Set(Object.keys(baselineFiles).map(normalizeFile));
  const grownOversizeFiles = [];

  for (const repoPath of changedFiles.map(normalizeFile)) {
    if (!trackedOversizeFiles.has(repoPath)) continue;
    const absolutePath = path.join(repoRoot, repoPath);
    if (!existsSync(absolutePath)) continue;
    const before = countLines(gitBlobContent(repoRoot, base, repoPath));
    const after = countLines(readFileSync(absolutePath, "utf8"));
    if (before > 0 && after > before) {
      grownOversizeFiles.push({ file: repoPath, before, after });
    }
  }

  return {
    baseline: baselinePath,
    grownOversizeFiles,
  };
}
