import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { unique } from "./git-diff.mjs";

export const reviewRequiredCommands = Object.freeze([
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs tests scripts services",
]);

export const currentCommandReferenceSources = Object.freeze([
  "package.json",
  ".github/workflows/verify.yml",
  "tests/fixtures/v22/agent-verify-manifest.json",
  "tests/fixtures/v22/goal-current.json",
  "scripts/v22-workflow-gate.mjs",
  "README.md",
  "docs/active/README.md",
  "docs/delivery/README.md",
]);

function rootPackageScripts(repoRoot) {
  const source = readFileSync(path.join(repoRoot, "package.json"), "utf8");
  return new Set(Object.keys(JSON.parse(source).scripts || {}));
}

function localCommandReferencesFromSource(source) {
  const text = String(source || "");
  const nodeFiles = [...text.matchAll(/\bnode\s+((?:tests|scripts)\/[^\s`'"]+\.mjs)(?:\s|$)/gu)]
    .map((match) => match[1]);
  const npmScripts = [...text.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)\b/gu)]
    .map((match) => match[1]);
  return {
    nodeFiles: unique(nodeFiles).sort(),
    npmScripts: unique(npmScripts).sort(),
  };
}

export function findMissingLocalCommandReferences(repoRoot, {
  sources = currentCommandReferenceSources,
} = {}) {
  const missing = [];
  const packageScripts = rootPackageScripts(repoRoot);
  for (const sourcePath of sources) {
    const absoluteSourcePath = path.join(repoRoot, sourcePath);
    if (!existsSync(absoluteSourcePath)) {
      missing.push({
        source: sourcePath,
        file: sourcePath,
        reason: "command_source_missing",
      });
      continue;
    }
    const source = readFileSync(absoluteSourcePath, "utf8");
    const references = localCommandReferencesFromSource(source);
    for (const filePath of references.nodeFiles) {
      if (!existsSync(path.join(repoRoot, filePath))) {
        missing.push({
          source: sourcePath,
          file: filePath,
          reason: "node_entry_missing",
        });
      }
    }
    for (const scriptName of references.npmScripts) {
      if (!packageScripts.has(scriptName)) {
        missing.push({
          source: sourcePath,
          script: scriptName,
          reason: "package_script_missing",
        });
      }
    }
  }
  return missing;
}
