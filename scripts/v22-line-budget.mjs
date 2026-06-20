#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const baselinePath = "tests/fixtures/v22/line-budget-baseline.json";
const codeExtensions = Object.freeze([".mjs", ".js", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".sh", ".ps1", ".go"]);
const ignoredParts = Object.freeze(["node_modules", "dist", "build", "coverage", ".venv", "__pycache__"]);
const ignoredSuffixes = Object.freeze([".min.js"]);

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

function readJson(repoPath) {
  return JSON.parse(readFileSync(path.join(repoRoot, repoPath), "utf8"));
}

function isCodeFile(repoPath) {
  const parts = repoPath.split("/");
  if (parts.some((part) => ignoredParts.includes(part))) return false;
  if (ignoredSuffixes.some((suffix) => repoPath.endsWith(suffix))) return false;
  return codeExtensions.includes(path.extname(repoPath));
}

function countLines(content) {
  if (content.length === 0) return 0;
  return content.endsWith("\n") ? content.split("\n").length - 1 : content.split("\n").length;
}

function lineCount(repoPath) {
  return countLines(readFileSync(path.join(repoRoot, repoPath), "utf8"));
}

const baseline = readJson(baselinePath);
const defaultLimit = baseline.default_limit;
const baselineFiles = baseline.files || {};
const trackedCodeFiles = runGit(["ls-files"]).filter(isCodeFile);
const failures = [];
const oversize = [];

for (const repoPath of trackedCodeFiles) {
  if (!existsSync(path.join(repoRoot, repoPath))) continue;
  const lines = lineCount(repoPath);
  if (lines <= defaultLimit) continue;
  oversize.push({ file: repoPath, lines });
  const locked = baselineFiles[repoPath];
  if (locked === undefined) {
    failures.push(`${repoPath}: ${lines} lines exceeds ${defaultLimit} line budget; split before adding a baseline`);
  } else if (lines > locked) {
    failures.push(`${repoPath}: ${lines} lines exceeds locked baseline ${locked}; split before growing this file`);
  }
}

for (const repoPath of Object.keys(baselineFiles).sort()) {
  const absolutePath = path.join(repoRoot, repoPath);
  if (!existsSync(absolutePath)) {
    failures.push(`${repoPath}: stale baseline entry; remove it after deleting or renaming the file`);
    continue;
  }
  const lines = lineCount(repoPath);
  if (lines <= defaultLimit) {
    failures.push(`${repoPath}: baseline can be retired because file is back under ${defaultLimit} lines`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    contract: "v22_line_budget",
    defaultLimit,
    failures,
    oversize: oversize.sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file)),
  }, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  contract: "v22_line_budget",
  defaultLimit,
  baseline: baselinePath,
  oversize: oversize.sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file)),
}, null, 2)}\n`);
