import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReview } from "../../scripts/v22-workflow-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const sensitivePathPatterns = [
  /(?:^|\/)\.env(?:\.|$)/i,
  /\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.kubeconfig$/i,
  /kubeconfig/i,
  /(?:^|\/)\.kube(?:\/|$)/i,
  /secret/i,
  /secrets/i,
  /token/i,
  /(?:^|\/)github$/i,
];

const sensitiveValuePatterns = [
  { label: "openai_compatible_key", pattern: /sk-[A-Za-z0-9_-]{16,}/u },
  { label: "github_token", pattern: /gh[pousr]_[A-Za-z0-9_]{16,}/u },
  { label: "github_pat", pattern: /github_pat_[A-Za-z0-9_]{16,}/u },
  { label: "tencent_secret_id", pattern: /AKID[A-Za-z0-9]{12,}/u },
  { label: "private_key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u },
  { label: "x_access_token", pattern: /x-access-token[:=][A-Za-z0-9._-]+/iu },
  { label: "bearer_token", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/u },
  {
    label: "named_secret_assignment",
    pattern: /^(?:SecretId|SecretKey|TENCENT_[A-Z_]*SECRET[A-Z_]*|LANGFUSE_SECRET_KEY|ZITADEL_ADMIN_BEARER_TOKEN)[ \t]*=[ \t]*[^#\s$][^\r\n#]*/mu,
  },
];

function buildSyntheticKey() {
  return ["sk", "test", "x".repeat(20)].join("-");
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function gitSucceeds(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0;
}

function normalizePath(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function unique(values) {
  return [...new Set(values)];
}

function isSensitivePath(filePath) {
  const normalized = normalizePath(filePath);
  return sensitivePathPatterns.some((pattern) => pattern.test(normalized));
}

function changedFilesFromBase(cwd, base) {
  return unique([
    runGit(cwd, ["diff", "--name-only", base]),
    runGit(cwd, ["ls-files", "--others", "--exclude-standard"]),
  ].flatMap((output) => output.split(/\r?\n/u).map((line) => normalizePath(line.trim())).filter(Boolean)));
}

function diffAddedLinesFromBase(cwd, base) {
  const diff = runGit(cwd, ["diff", "--unified=0", base]);
  const lines = [];
  let currentFile = "";
  for (const line of diff.split(/\r?\n/u)) {
    if (line.startsWith("+++ b/")) {
      currentFile = normalizePath(line.slice("+++ b/".length));
      continue;
    }
    if (line.startsWith("+++ /dev/null")) {
      currentFile = "";
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (!currentFile || isSensitivePath(currentFile)) continue;
    lines.push({
      filePath: currentFile,
      source: line.slice(1),
    });
  }
  return lines;
}

async function untrackedAddedLines(cwd, changedFiles) {
  const lines = [];
  for (const filePath of changedFiles) {
    if (isSensitivePath(filePath)) continue;
    const isTracked = gitSucceeds(cwd, ["ls-files", "--error-unmatch", filePath]);
    if (isTracked) continue;
    const source = await readFile(path.join(cwd, filePath), "utf8");
    lines.push(...source.split(/\r?\n/u).map((line) => ({ filePath, source: line })));
  }
  return lines;
}

async function scanChangedAddedLines(cwd, base) {
  const changedFiles = changedFilesFromBase(cwd, base);
  const skippedSensitivePaths = changedFiles.filter(isSensitivePath);
  const addedLines = [
    ...diffAddedLinesFromBase(cwd, base),
    ...await untrackedAddedLines(cwd, changedFiles),
  ];
  const findings = [];
  for (const [index, line] of addedLines.entries()) {
    for (const { label, pattern } of sensitiveValuePatterns) {
      if (pattern.test(line.source)) {
        findings.push({
          filePath: line.filePath,
          lineIndex: index + 1,
          pattern: label,
        });
      }
    }
  }
  return {
    ok: findings.length === 0,
    mode: "changed_files_added_lines",
    changedFiles,
    scannedLineCount: addedLines.length,
    skippedSensitivePaths,
    findings,
  };
}

async function writeRepoFile(cwd, filePath, source) {
  await writeFile(path.join(cwd, filePath), source, "utf8");
}

async function withTempRepo(callback) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-diff-scoped-sensitive-"));
  try {
    runGit(tempRoot, ["init"]);
    runGit(tempRoot, ["config", "user.email", "codex@example.invalid"]);
    runGit(tempRoot, ["config", "user.name", "Codex Eval"]);
    return await callback(tempRoot);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

const result = await withTempRepo(async (tempRoot) => {
  const safeBaselineLeak = buildSyntheticKey();
  await writeFile(path.join(tempRoot, "tracked-history.txt"), `historical=${safeBaselineLeak}\n`, "utf8");
  runGit(tempRoot, ["add", "tracked-history.txt"]);
  runGit(tempRoot, ["commit", "-m", "baseline"]);
  const base = runGit(tempRoot, ["rev-parse", "HEAD"]);

  await writeRepoFile(tempRoot, "tracked-history.txt", `historical=${safeBaselineLeak}\nnew_line=safe\n`);
  await writeRepoFile(tempRoot, "new-added.txt", `runtime=${buildSyntheticKey()}\n`);
  await writeRepoFile(tempRoot, ".env.local", `runtime=${buildSyntheticKey()}\n`);

  const failingScan = await scanChangedAddedLines(tempRoot, base);
  assert.equal(failingScan.ok, false, "diff_scoped_scan_must_fail_on_added_sensitive_value");
  assert(
    failingScan.findings.some((finding) => finding.filePath === "new-added.txt" && finding.pattern === "openai_compatible_key"),
    "diff_scoped_scan_must_report_added_sensitive_value_without_value",
  );
  assert.deepEqual(
    failingScan.findings.filter((finding) => finding.filePath === "tracked-history.txt"),
    [],
    "diff_scoped_scan_must_ignore_unchanged_historical_content",
  );
  assert(failingScan.skippedSensitivePaths.includes(".env.local"), "diff_scoped_scan_must_skip_sensitive_like_paths");

  await writeRepoFile(tempRoot, "new-added.txt", "runtime=providerKeyRef\n");
  const cleanScan = await scanChangedAddedLines(tempRoot, base);
  assert.equal(cleanScan.ok, true, "diff_scoped_scan_must_pass_when_added_lines_are_clean");
  assert(cleanScan.skippedSensitivePaths.includes(".env.local"), "clean_scan_must_still_skip_sensitive_like_paths");

  const review = evaluateReview({ base, changedFiles: cleanScan.changedFiles });
  assert.equal(review.ok, false, "workflow_review_must_still_fail_closed_on_sensitive_like_paths");
  assert(
    review.findings.some((finding) => finding.code === "secret_like_path_changed" && finding.files.includes(".env.local")),
    "workflow_review_must_report_sensitive_like_paths_without_reading_content",
  );

  return {
    failingFindingCount: failingScan.findings.length,
    cleanScannedLineCount: cleanScan.scannedLineCount,
    skippedSensitivePaths: cleanScan.skippedSensitivePaths,
    workflowPathGateFindingCodes: review.findings.map((finding) => finding.code),
  };
});

const contractSource = await readFile(path.join(repoRoot, "docs/contracts/v22-token-provider-boundary.md"), "utf8");
assert(contractSource.includes("raw API Key 只能进入后端密钥边界"), "token_provider_raw_key_boundary_missing");
assert(contractSource.includes("不能写入 sessionStorage、localStorage、global JS state、log、evidence 或 git"), "token_provider_forbidden_storage_missing");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_diff_scoped_sensitive_hygiene",
  mode: "local_temp_git_repo_only",
  noRealSecretRead: true,
  fullRepoScanPolicy: "read_only_audit_only",
  diffScopedScan: "changed_files_added_lines",
  result,
}, null, 2));
