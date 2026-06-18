import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

function repoExec(args, repoRoot, { fallback = "" } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return fallback;
  }
}

export function normalizePath(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

export function unique(values) {
  return [...new Set(values)];
}

export function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { mode, options };
}

export function runGit(repoRoot, args, options = {}) {
  return repoExec(args, repoRoot, options);
}

export function changedFilesSince(repoRoot, base) {
  const outputs = [
    runGit(repoRoot, ["diff", "--name-only", `${base}...HEAD`], { fallback: "" }),
    runGit(repoRoot, ["diff", "--name-only", "--cached"], { fallback: "" }),
    runGit(repoRoot, ["diff", "--name-only"], { fallback: "" }),
    runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"], { fallback: "" }),
  ];
  return unique(outputs.flatMap((output) => output.split("\n").map((line) => line.trim()).filter(Boolean)));
}

export function changedFileStatusesSince(repoRoot, base) {
  const outputs = [
    runGit(repoRoot, ["diff", "--name-status", `${base}...HEAD`], { fallback: "" }),
    runGit(repoRoot, ["diff", "--name-status", "--cached"], { fallback: "" }),
    runGit(repoRoot, ["diff", "--name-status"], { fallback: "" }),
  ];
  const statuses = new Map();
  for (const output of outputs) {
    for (const line of output.split("\n").map((item) => item.trim()).filter(Boolean)) {
      const [status, ...paths] = line.split(/\s+/u);
      const filePath = normalizePath(paths.at(-1));
      if (filePath && !statuses.has(filePath)) statuses.set(filePath, status);
    }
  }
  for (const filePath of changedFilesSince(repoRoot, base)) {
    if (!statuses.has(filePath)) statuses.set(filePath, "A");
  }
  return statuses;
}

export function currentBranchName(repoRoot) {
  return runGit(repoRoot, ["branch", "--show-current"], { fallback: "" });
}

export function statusPorcelain(repoRoot) {
  return runGit(repoRoot, ["status", "--porcelain"], { fallback: "" });
}

export function aheadCountForTrunk(repoRoot) {
  const output = runGit(repoRoot, ["rev-list", "--count", "origin/recovery/platform-v22-trunk..HEAD"], { fallback: "0" });
  const count = Number(output);
  return Number.isFinite(count) ? count : 0;
}

export function originPushRemoteUrl(repoRoot) {
  return runGit(repoRoot, ["remote", "get-url", "--push", "origin"], { fallback: "" });
}

export function addedLinesSince(repoRoot, base) {
  const effectiveDiff = runGit(repoRoot, ["diff", "--unified=0", base], { fallback: "" });
  const untrackedFiles = runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"], { fallback: "" })
    .split("\n")
    .map(normalizePath)
    .filter(Boolean);
  const untrackedLines = untrackedFiles.flatMap((filePath) => {
    try {
      return readFileSync(path.join(repoRoot, filePath), "utf8").split("\n");
    } catch {
      return [];
    }
  });
  return effectiveDiff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .concat(untrackedLines);
}
