#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const TRACKED_RENDERED_DIR = path.join(packageRoot, "rendered");

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

export function parseEnvContent(source) {
  const vars = {};
  for (const rawLine of stripBom(source).split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) vars[key] = value;
  }
  return vars;
}

export function quoteYamlDoubleString(value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("-")) continue;
    const key = token.replace(/^-+/, "").toLowerCase();
    const next = argv[index + 1];
    if (!next || next.startsWith("-")) {
      parsed[key] = "1";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function parseOverrideVars(argv) {
  const vars = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token !== "--set") continue;
    const assignment = argv[index + 1];
    if (!assignment || assignment.startsWith("-")) {
      throw new Error("--set requires KEY=VALUE");
    }
    const separatorIndex = assignment.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`--set requires KEY=VALUE, got: ${assignment}`);
    }
    const key = assignment.slice(0, separatorIndex);
    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error(`--set key must use uppercase env-style characters: ${key}`);
    }
    vars[key] = assignment.slice(separatorIndex + 1);
    index += 1;
  }
  return vars;
}

function absoluteFromRepoRoot(value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(repoRoot, value);
}

export function resolveRenderOptions(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  return {
    envFile: absoluteFromRepoRoot(args.envfile || args["env-file"] || "deploy/tke-package/env/tke.env"),
    templateDir: absoluteFromRepoRoot(args.templatedir || args["template-dir"] || "deploy/tke-package/manifests"),
    outDir: absoluteFromRepoRoot(args.outdir || args["out-dir"] || "deploy/tke-package/rendered-local-check"),
    allowTrackedOutput: args.allowtrackedoutput === "1" || args["allow-tracked-output"] === "1",
    overrideVars: parseOverrideVars(argv),
  };
}

function listYamlFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return listYamlFiles(file);
    return entry.isFile() && /\.ya?ml$/i.test(entry.name) ? [file] : [];
  });
}

function replacePlaceholders(source, vars) {
  let rendered = source;
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.split(`"__${key}__"`).join(quoteYamlDoubleString(value));
    rendered = rendered.split(`__${key}__`).join(String(value));
  }
  return rendered;
}

function findUnresolvedPlaceholders(files) {
  const unresolved = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/g);
    lines.forEach((line, index) => {
      if (/__[A-Z0-9_]+__/.test(line)) unresolved.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  return unresolved;
}

function ensureSafeOutputDir(outDir, allowTrackedOutput) {
  if (path.resolve(outDir) !== TRACKED_RENDERED_DIR || allowTrackedOutput) return;
  throw new Error(
    [
      `Refusing to render into tracked directory: ${outDir}`,
      "Use deploy/tke-package/rendered-local-check or deploy/tke-package/rendered-v20-local for real secrets.",
      "Pass --allow-tracked-output 1 only for placeholder-only rendered fixtures.",
    ].join("\n"),
  );
}

export function renderTkeManifests(options) {
  const envFile = path.resolve(options.envFile);
  const templateDir = path.resolve(options.templateDir);
  const outDir = path.resolve(options.outDir);
  const allowTrackedOutput = Boolean(options.allowTrackedOutput);

  if (!existsSync(envFile)) throw new Error(`Env file not found: ${envFile}`);
  if (!existsSync(templateDir)) throw new Error(`Template dir not found: ${templateDir}`);
  ensureSafeOutputDir(outDir, allowTrackedOutput);

  const vars = {
    ...parseEnvContent(readFileSync(envFile, "utf8")),
    ...(options.overrideVars || {}),
  };
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const sourceFile of listYamlFiles(templateDir)) {
    const relative = path.relative(templateDir, sourceFile);
    const target = path.join(outDir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, replacePlaceholders(readFileSync(sourceFile, "utf8"), vars), "utf8");
  }

  const renderedFiles = listYamlFiles(outDir);
  const unresolved = findUnresolvedPlaceholders(renderedFiles);
  if (unresolved.length > 0) {
    throw new Error(`Render completed with unresolved placeholders.\n${unresolved.join("\n")}`);
  }

  return {
    outDir,
    renderedFiles,
  };
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  try {
    const result = renderTkeManifests(resolveRenderOptions());
    console.log(`Rendered manifests to ${result.outDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
