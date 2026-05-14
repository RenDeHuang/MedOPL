#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const manifestPath = "docs/recovery/v22-agent-verify-manifest.json";
const currentStatePath = "docs/recovery/v22-goal-current.json";

function parseArgs(argv) {
  const [mode, maybeTarget, ...tail] = argv;
  const target = maybeTarget && !maybeTarget.startsWith("--") ? maybeTarget : undefined;
  const rest = target ? tail : [maybeTarget, ...tail].filter(Boolean);
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
  return { mode, target, options };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.join(repoRoot, filePath), "utf8"));
}

function commandToSpawn(command) {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function replaceBase(command, base) {
  if (!base) return command;
  return command.replaceAll("origin/recovery/platform-v22-trunk", base);
}

function commandBundle({ mode, target, manifest, current, base }) {
  if (mode === "current") {
    const leaf = manifest.leaves.find((item) => item.leaf_id === current.current_cursor);
    if (!leaf) throw new Error(`current_leaf_missing_from_manifest:${current.current_cursor}`);
    return {
      mode: "current",
      leafId: leaf.leaf_id,
      commands: leaf.verification_commands.map((command) => replaceBase(command, base)),
      allowedFiles: leaf.allowed_files,
      forbiddenFiles: leaf.forbidden_files,
      forbiddenOps: leaf.forbidden_ops,
      riskClass: leaf.risk_class,
    };
  }

  if (mode === "suite") {
    const suite = manifest.suites.find((item) => item.id === target);
    if (!suite) throw new Error(`suite_missing:${target || "(missing)"}`);
    return {
      mode: "suite",
      suiteId: suite.id,
      commands: suite.commands.map((command) => replaceBase(command, base)),
      allowedFiles: suite.allowed_files || [],
      forbiddenFiles: manifest.global_forbidden_files,
      forbiddenOps: manifest.global_forbidden_ops,
      riskClass: "local_doc_eval",
    };
  }

  if (mode === "package") {
    const suite = manifest.package_suites.find((item) => item.id === target);
    if (!suite) throw new Error(`package_suite_missing:${target || "(missing)"}`);
    return {
      mode: "package",
      packageId: suite.id,
      commands: suite.commands.map((command) => replaceBase(command, base)),
      allowedFiles: [],
      forbiddenFiles: manifest.global_forbidden_files,
      forbiddenOps: manifest.global_forbidden_ops,
      riskClass: "local_service_code",
    };
  }

  if (mode === "review") {
    const suite = manifest.suites.find((item) => item.id === "review");
    if (!suite) throw new Error("review_suite_missing");
    return {
      mode: "review",
      commands: suite.commands.map((command) => replaceBase(command, base)),
      allowedFiles: [],
      forbiddenFiles: manifest.global_forbidden_files,
      forbiddenOps: manifest.global_forbidden_ops,
      riskClass: "local_doc_eval",
    };
  }

  throw new Error(`unknown_verify_mode:${mode || "(missing)"}`);
}

function runCommand(command) {
  const [bin, ...args] = commandToSpawn(command);
  if (!bin) throw new Error(`empty_command:${command}`);
  const result = spawnSync(bin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  return {
    command,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    ok: result.status === 0,
  };
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-verify.mjs list [--json]",
    "  node scripts/v22-verify.mjs current [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "  node scripts/v22-verify.mjs suite <id> [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "  node scripts/v22-verify.mjs package <id> [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "  node scripts/v22-verify.mjs review [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "",
  ].join("\n"));
}

function renderHuman(payload) {
  const lines = [
    `v22 verify ${payload.mode}`,
    `ok: ${payload.ok}`,
  ];
  if (payload.leafId) lines.push(`leaf: ${payload.leafId}`);
  if (payload.suiteId) lines.push(`suite: ${payload.suiteId}`);
  if (payload.packageId) lines.push(`package: ${payload.packageId}`);
  lines.push("commands:");
  for (const command of payload.commands || []) lines.push(`- ${command}`);
  if (payload.dryRun) lines.push("dry_run: true");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const { mode, target, options } = parseArgs(process.argv.slice(2));
  const [manifest, current] = await Promise.all([
    readJson(manifestPath),
    readJson(currentStatePath),
  ]);

  if (mode === "list") {
    const payload = {
      ok: true,
      mode: "list",
      manifest: manifestPath,
      defaultAgentEntrypoint: manifest.default_agent_entrypoint,
      leaves: manifest.leaves.map((leaf) => leaf.leaf_id),
      suites: manifest.suites.map((suite) => suite.id),
      packages: manifest.package_suites.map((suite) => suite.id),
    };
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
    return;
  }

  if (!mode) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const bundle = commandBundle({
    mode,
    target,
    manifest,
    current,
    base: options.base || "origin/recovery/platform-v22-trunk",
  });
  const payload = {
    ok: true,
    ...bundle,
    manifest: manifestPath,
    currentState: currentStatePath,
    dryRun: Boolean(options["dry-run"]),
    results: [],
  };

  if (!payload.dryRun) {
    for (const command of bundle.commands) {
      const result = runCommand(command);
      payload.results.push({
        command: result.command,
        status: result.status,
        ok: result.ok,
      });
      if (!result.ok) {
        if (result.stdout) process.stderr.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        payload.ok = false;
        break;
      }
    }
  }

  process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
  if (!payload.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
