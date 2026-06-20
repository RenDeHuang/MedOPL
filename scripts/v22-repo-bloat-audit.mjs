#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lineBudgetDiffForChangedFiles } from "./workflow-gate/line-budget-diff.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const budgets = Object.freeze({
  docsMarkdownFiles: 16,
  scriptsFiles: 8,
  scriptsModuleFiles: 8,
  testsMjsFiles: 111,
  testsRegressionPortalFiles: 32,
  testsCloudFiles: 12,
  servicesPortalFiles: 260,
  servicesPortalBytes: 2_000_000,
});

const areaPrefixes = Object.freeze([
  "docs/",
  "scripts/",
  "tests/health/",
  "tests/smoke/",
  "tests/contracts/",
  "tests/hygiene/",
  "tests/suites/",
  "tests/regression/portal/",
  "tests/regression/opl/",
  "tests/regression/runtime-bridge/",
  "tests/local-rc/",
  "tests/cloud/",
  "tests/fixtures/",
  "services/portal/",
  "services/opl-web-gateway/",
  "services/opl-runtime-bridge/",
]);

const allowedDocsMarkdownFiles = Object.freeze([
  "docs/README.md",
  "docs/active/README.md",
  "docs/product/README.md",
  "docs/runtime/README.md",
  "docs/framework/README.md",
  "docs/specs/README.md",
  "docs/evidence/README.md",
  "docs/policies/README.md",
  "docs/delivery/README.md",
  "docs/source/README.md",
  "docs/public/README.md",
  "docs/references/README.md",
  "docs/history/README.md",
]);

const forbiddenSlideDocPatterns = Object.freeze([
  /^docs\/slides\//u,
  /^docs\/slide[-/]/u,
  /^docs\/active\/slide[-/]/u,
  /^docs\/product\/slide[-/]/u,
  /^docs\/.*\/slide-\d+/u,
  /^docs\/.*\/subslide[-/]/u,
]);

const docsActiveAllowedFiles = Object.freeze([
  "docs/active/README.md",
]);

const retiredChangePathPatterns = Object.freeze([
  /^changes\/active(?:\/|$)/u,
  /^changes\/archive(?:\/|$)/u,
]);

const forbiddenArtifactPathPatterns = Object.freeze([
  /(?:^|\/)uploads?(?:\/|$)/u,
  /(?:^|\/)runtime-artifacts?(?:\/|$)/u,
  /(?:^|\/)raw-artifacts?(?:\/|$)/u,
  /(?:^|\/)screenshots?(?:\/|$)/u,
  /(?:^|\/)transcripts?(?:\/|$)/u,
  /(?:^|\/)cloud-payloads?(?:\/|$)/u,
  /(?:^|\/)raw-payloads?(?:\/|$)/u,
  /(?:^|\/)payload-dumps?(?:\/|$)/u,
  /(?:^|\/)build(?:\/|$)/u,
  /(?:^|\/)dist(?:\/|$)/u,
  /(?:^|\/)coverage(?:\/|$)/u,
]);

const forbiddenArtifactExtensions = Object.freeze([
  ".har",
  ".trace",
  ".webm",
  ".mp4",
  ".mov",
  ".zip",
  ".tar",
  ".tgz",
  ".gz",
]);

const artifactPathAllowlistPatterns = Object.freeze([
  /^tests\/fixtures\//u,
  /^tests\/cloud\//u,
  /^contracts\//u,
]);

const slideBloatGuards = Object.freeze({
  noPerSlideDocs: true,
  noSlideSubtaskDocs: true,
  noUnregisteredTests: true,
  allowedDocsMarkdownFiles,
  forbiddenSlideDocPatterns: forbiddenSlideDocPatterns.map((pattern) => pattern.source),
});

const docsActiveGuards = Object.freeze({
  readmeOnly: true,
  noMultiPlanSpecs: true,
  allowedFiles: docsActiveAllowedFiles,
});

const retiredChangePathGuards = Object.freeze({
  noChangesActive: true,
  noChangesArchive: true,
  forbiddenPathPatterns: retiredChangePathPatterns.map((pattern) => pattern.source),
});

const artifactBloatGuards = Object.freeze({
  allowSmallFixtures: true,
  allowContractsPointersAndReceipts: true,
  forbiddenPathPatterns: forbiddenArtifactPathPatterns.map((pattern) => pattern.source),
  forbiddenExtensions: forbiddenArtifactExtensions,
  allowlistPathPatterns: artifactPathAllowlistPatterns.map((pattern) => pattern.source),
});

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

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return options;
}

function normalizeFile(file) {
  return String(file || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function changedFilesSince(base) {
  const outputs = [
    ...runGit(["diff", "--name-only", `${base}...HEAD`]),
    ...runGit(["diff", "--name-only", "--cached"]),
    ...runGit(["diff", "--name-only"]),
    ...runGit(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(outputs.map(normalizeFile).filter(Boolean))];
}

function changedFileStatusesSince(base) {
  const outputs = [
    { output: runGit(["diff", "--name-status", `${base}...HEAD`]), override: false },
    { output: runGit(["diff", "--name-status", "--cached"]), override: true },
    { output: runGit(["diff", "--name-status"]), override: true },
  ];
  const statuses = new Map();
  for (const { output, override } of outputs) {
    for (const line of output.map((item) => item.trim()).filter(Boolean)) {
      const [status, ...paths] = line.split(/\s+/u);
      const file = normalizeFile(paths.at(-1));
      if (file && (override || !statuses.has(file))) statuses.set(file, status);
    }
  }
  for (const file of changedFilesSince(base)) {
    if (!statuses.has(file)) statuses.set(file, "A");
  }
  return statuses;
}

function readSliceAdmission(sliceId) {
  if (!sliceId || sliceId === true) return null;
  const safeSliceId = String(sliceId).trim().replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (!safeSliceId) return null;
  const manifestPath = path.join(repoRoot, ".runtime", "slices", safeSliceId, "slice.json");
  if (!existsSync(manifestPath)) throw new Error(`slice_manifest_not_found:${path.relative(repoRoot, manifestPath)}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return manifest.admission || null;
}

function isNewTargetStatus(status) {
  const value = String(status || "");
  return value.startsWith("A") || value.startsWith("C") || value.startsWith("R") || value.includes("A");
}

function patternMatches(file, pattern) {
  const normalized = normalizeFile(pattern);
  if (!normalized) return false;
  if (normalized.endsWith("/**")) return file === normalized.slice(0, -3) || file.startsWith(normalized.slice(0, -2));
  if (normalized.endsWith("/")) return file.startsWith(normalized);
  return file === normalized;
}

function isAllowedByAdmission(file, admission) {
  const allowed = admission?.allowed_paths || [];
  if (allowed.length === 0) return true;
  return allowed.some((pattern) => patternMatches(file, pattern));
}

export function evaluateDiffAdmission({
  changedFiles = [],
  changedStatuses = new Map(),
  sliceAdmission,
  lineBudgetDiff = {},
} = {}) {
  const files = changedFiles.map(normalizeFile).filter(Boolean);
  const findings = [];
  if (!sliceAdmission) {
    return {
      ok: true,
      contract: "v22_repo_bloat_diff_admission",
      changedFiles: files,
      sliceAdmission: null,
      findings,
    };
  }

  const outsideAllowed = files.filter((file) => !isAllowedByAdmission(file, sliceAdmission));
  if (outsideAllowed.length > 0) {
    findings.push({ code: "diff_changed_file_outside_allowed_paths", severity: "blocker", files: outsideAllowed });
  }

  const newTopLevelScripts = files.filter((file) =>
    /^scripts\/v22-[^/]+\.mjs$/u.test(file)
    && isNewTargetStatus(changedStatuses.get(file)));
  if (!sliceAdmission.new_top_level_scripts_allowed && newTopLevelScripts.length > 0) {
    findings.push({ code: "diff_new_top_level_script_forbidden", severity: "blocker", files: newTopLevelScripts });
  }

  const newHealthTests = files.filter((file) =>
    /^tests\/health\/[^/]+\.mjs$/u.test(file)
    && isNewTargetStatus(changedStatuses.get(file)));
  if (!sliceAdmission.new_health_tests_allowed && newHealthTests.length > 0) {
    findings.push({ code: "diff_new_health_test_forbidden", severity: "blocker", files: newHealthTests });
  }

  const newContracts = files.filter((file) =>
    /^contracts\/[^/]+\.json$/u.test(file)
    && isNewTargetStatus(changedStatuses.get(file)));
  if (!sliceAdmission.new_contracts_allowed && newContracts.length > 0) {
    findings.push({ code: "diff_new_contract_forbidden", severity: "blocker", files: newContracts });
  }

  if (sliceAdmission.must_reduce_or_hold_bloat) {
    const grownOversizeFiles = lineBudgetDiff.grownOversizeFiles || [];
    if (grownOversizeFiles.length > 0) {
      findings.push({ code: "diff_oversize_file_growth_forbidden", severity: "blocker", files: grownOversizeFiles.map((item) => item.file || item) });
    }
  }

  return {
    ok: findings.length === 0,
    contract: "v22_repo_bloat_diff_admission",
    changedFiles: files,
    sliceAdmission,
    findings,
  };
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

function isTopLevelScript(file) {
  return /^scripts\/[^/]+$/u.test(file);
}

function isScriptModule(file) {
  return /^scripts\/[^/]+\/[^/]+$/u.test(file);
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
        code: "bloat_pressure_exceeded",
        severity: "pressure",
        metric: key,
        actual: counts[key],
        limit,
      });
    }
  }
  return findings;
}

function slideDocFindings(files) {
  return files
    .filter((file) => file.startsWith("docs/") && file.endsWith(".md"))
    .filter((file) => !allowedDocsMarkdownFiles.includes(file) || forbiddenSlideDocPatterns.some((pattern) => pattern.test(file)))
    .map((file) => ({
      code: "slide_doc_bloat_forbidden",
      file,
      reason: "slide subtasks must live in code/tests/fixtures or history closeout summary, not permanent per-slide docs",
    }));
}

function docsActiveFindings(files) {
  return files
    .filter((file) => file.startsWith("docs/active/"))
    .filter((file) => !docsActiveAllowedFiles.includes(file))
    .map((file) => ({
      code: "active_doc_bloat_forbidden",
      file,
      reason: "docs/active is README-only; active plan/goal detail must fold into current owner truth, contracts, tests, or history closeout",
    }));
}

function retiredChangePathFindings(files) {
  return files
    .filter((file) => retiredChangePathPatterns.some((pattern) => pattern.test(file)))
    .map((file) => ({
      code: "retired_change_path_forbidden",
      file,
      reason: "changes/active and changes/archive are retired; closeout belongs in current owners, contracts, tests, or docs/history summary",
    }));
}

function isAllowedArtifactFixture(file) {
  return artifactPathAllowlistPatterns.some((pattern) => pattern.test(file));
}

function artifactBloatFindings(files) {
  return files
    .filter((file) => !isAllowedArtifactFixture(file))
    .filter((file) => {
      const extension = path.extname(file).toLowerCase();
      return forbiddenArtifactPathPatterns.some((pattern) => pattern.test(file)) || forbiddenArtifactExtensions.includes(extension);
    })
    .map((file) => ({
      code: "raw_artifact_bloat_forbidden",
      file,
      reason: "raw evidence bundles, uploads, transcripts, bulk screenshots, build output, and cloud payload dumps must stay out of git; keep only small manifests, pointers, contracts, or fixtures",
    }));
}

export function evaluateRepoBloatAudit({ diff = false, base = "origin/recovery/platform-v22-trunk", sliceAdmission = null } = {}) {
  const deleted = new Set(runGit(["ls-files", "--deleted"]));
  const tracked = runGit(["ls-files", "--cached", "--others", "--exclude-standard"])
    .filter((file) => !deleted.has(file));
  const counts = {
    docsMarkdownFiles: countMatching(tracked, (file) => file.startsWith("docs/") && file.endsWith(".md")),
    scriptsFiles: countMatching(tracked, isTopLevelScript),
    scriptsModuleFiles: countMatching(tracked, isScriptModule),
    testsMjsFiles: countMatching(tracked, (file) => file.startsWith("tests/") && file.endsWith(".mjs")),
    testsRegressionPortalFiles: countMatching(tracked, (file) => file.startsWith("tests/regression/portal/") && file.endsWith(".mjs")),
    testsCloudFiles: countMatching(tracked, (file) => file.startsWith("tests/cloud/") && file.endsWith(".mjs")),
    servicesPortalFiles: countMatching(tracked, (file) => file.startsWith("services/portal/")),
    servicesPortalBytes: tracked.filter((file) => file.startsWith("services/portal/")).reduce((total, file) => total + fileSize(file), 0),
  };
  const findings = [
    ...slideDocFindings(tracked),
    ...docsActiveFindings(tracked),
    ...retiredChangePathFindings(tracked),
    ...artifactBloatFindings(tracked),
  ];
  const pressureFindings = bloatBudgetFindings(counts);
  const lifecycleFindings = findings;
  const notes = [];

  if (counts.testsRegressionPortalFiles >= 24) {
    notes.push("tests/regression/portal is the largest test area; split by product surface before adding broad regression files.");
  }
  if (counts.testsCloudFiles >= 10) {
    notes.push("tests/cloud is a future-authorized boundary lane; keep it out of current/default verification unless separately authorized.");
  }
  if (counts.servicesPortalFiles >= 230) {
    notes.push("services/portal is the largest source area; add broad portal surface files only with a dedicated product-surface split.");
  }

  const diffFiles = diff ? changedFilesSince(base) : [];
  const diffAdmission = diff
    ? evaluateDiffAdmission({
      changedFiles: diffFiles,
      changedStatuses: changedFileStatusesSince(base),
      sliceAdmission,
      lineBudgetDiff: lineBudgetDiffForChangedFiles(repoRoot, { base, changedFiles: diffFiles }),
    })
    : null;
  const diffFindings = diffAdmission?.findings || [];

  return {
    ok: lifecycleFindings.length === 0 && diffFindings.length === 0,
    contract: "v22_repo_bloat_audit",
    bloat_pressure: "count and byte budgets report pressure only; lifecycle/consumer findings decide pass/fail",
    budgets,
    counts,
    slideBloatGuards,
    docsActiveGuards,
    retiredChangePathGuards,
    artifactBloatGuards,
    largestAreas: largestAreas(tracked),
    findings: [...lifecycleFindings, ...diffFindings],
    lifecycleFindings,
    diffAdmission,
    pressureFindings,
    notes,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const payload = evaluateRepoBloatAudit({
    diff: Boolean(options.diff),
    base: options.base || "origin/recovery/platform-v22-trunk",
    sliceAdmission: readSliceAdmission(options["slice-id"]),
  });
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!payload.ok) process.exitCode = 1;
}
