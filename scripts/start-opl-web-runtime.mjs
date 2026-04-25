import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, ".runtime");
const configuredOplRoot = String(process.env.OPL_UPSTREAM_DIR || process.env.OPL_ACP_RUNTIME_DIR || "").trim();
const oplRoot = configuredOplRoot ? path.resolve(repoRoot, configuredOplRoot) : path.join(runtimeRoot, "one-person-lab-upstream");
const configuredShellRoot = String(process.env.OPL_AION_SHELL_DIR || "").trim();
const shellRoot = configuredShellRoot ? path.resolve(repoRoot, configuredShellRoot) : path.join(runtimeRoot, "opl-aion-shell");
const oplRepoUrl = process.env.OPL_UPSTREAM_REPO || "https://github.com/gaofeng21cn/one-person-lab";
const webRepoUrl = process.env.OPL_AION_SHELL_REPO || "https://github.com/gaofeng21cn/opl-aion-shell";
const imageName = process.env.OPL_WEB_IMAGE || "one-person-lab-webui:local";
const containerName = process.env.OPL_WEB_CONTAINER || "one-person-lab-webui";
const hostPort = Number(process.env.OPL_WEB_PORT || 3000);
const gatewayEnabled = String(process.env.OPL_WEB_GATEWAY_ENABLED || "1") !== "0";
const gatewayPort = Number(process.env.OPL_WEB_GATEWAY_PORT || hostPort + 1);
const recreate = String(process.env.OPL_WEB_RECREATE || "") === "1";
const reuseExisting = String(process.env.OPL_WEB_REUSE || "") === "1";
const startMode = String(process.env.OPL_WEB_START_MODE || "docker").trim().toLowerCase();
const buildLocal = String(process.env.OPL_WEB_BUILD_LOCAL || "1") !== "0";
const authMode = process.env.OPL_WEBUI_AUTH_MODE || "none";
let currentStage = "init";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result;
}

function output(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd || repoRoot,
      env: options.env || process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (options.allowFailure) return String(error.stdout || "").trim();
    throw error;
  }
}

function assertValidPort(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid OPL_WEB_PORT: ${String(process.env.OPL_WEB_PORT || "")}`);
  }
}

async function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (["EADDRINUSE", "EACCES"].includes(error.code)) {
        if (reuseExisting) {
          resolve(false);
          return;
        }
        reject(new Error(`OPL Web port ${port} is already in use. Stop that process or set OPL_WEB_PORT.`));
        return;
      }
      reject(error);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

function removeStaleGitLock(lockFile) {
  if (!fs.existsSync(lockFile)) return;
  const ageMs = Date.now() - fs.statSync(lockFile).mtimeMs;
  if (ageMs < 60_000) {
    throw new Error(`Git lock is still fresh: ${lockFile}`);
  }
  fs.rmSync(lockFile, { force: true });
}

function resolveDefaultBranch(repoUrl) {
  const symref = output("git", ["ls-remote", "--symref", repoUrl, "HEAD"]);
  const match = symref.match(/^ref:\s+refs\/heads\/([^\s]+)\s+HEAD/m);
  if (!match) {
    throw new Error(`Cannot resolve default branch from ${repoUrl}`);
  }
  return match[1];
}

function repairIncompleteGitRepo({ root, repoUrl, stage }) {
  currentStage = stage;
  removeStaleGitLock(path.join(root, ".git", "shallow.lock"));
  const branch = resolveDefaultBranch(repoUrl);
  run("git", ["remote", "set-url", "origin", repoUrl], { cwd: root });
  run("git", ["fetch", "--depth", "1", "origin", `refs/heads/${branch}:refs/remotes/origin/${branch}`], { cwd: root });
  run("git", ["checkout", "-B", branch, `refs/remotes/origin/${branch}`], { cwd: root });
}

function ensureGitRepo({ root, repoUrl, ensureStage, repairStage }) {
  currentStage = ensureStage;
  fs.mkdirSync(runtimeRoot, { recursive: true });

  if (!fs.existsSync(root)) {
    run("git", ["clone", "--depth", "1", repoUrl, root]);
    return;
  }

  if (!fs.existsSync(path.join(root, ".git"))) {
    const entries = fs.readdirSync(root).filter((entry) => entry !== "." && entry !== "..");
    if (entries.length > 0) {
      throw new Error(`Directory exists but is not a git repo: ${root}`);
    }
    run("git", ["clone", "--depth", "1", repoUrl, root]);
    return;
  }

  const insideWorkTree = output("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, allowFailure: true });
  if (insideWorkTree !== "true") {
    throw new Error(`Directory is not a valid git work tree: ${root}`);
  }

  const dirty = output("git", ["status", "--short"], { cwd: root, allowFailure: true });
  if (dirty) {
    throw new Error(`Git repo has local changes; refusing to update automatically: ${root}`);
  }

  const head = output("git", ["rev-parse", "--verify", "HEAD"], { cwd: root, allowFailure: true });
  if (!head) {
    repairIncompleteGitRepo({ root, repoUrl, stage: repairStage });
    return;
  }

  removeStaleGitLock(path.join(root, ".git", "shallow.lock"));
  run("git", ["remote", "set-url", "origin", repoUrl], { cwd: root });
  run("git", ["pull", "--ff-only"], { cwd: root });
}

function ensureOplUpstreamRepo() {
  if (configuredOplRoot) {
    currentStage = "verify-configured-opl-upstream";
    const packageJson = path.join(oplRoot, "package.json");
    const sourceCli = path.join(oplRoot, "src", "cli.ts");
    const builtCli = path.join(oplRoot, "dist", "cli.js");
    if (!fs.existsSync(packageJson) || (!fs.existsSync(sourceCli) && !fs.existsSync(builtCli))) {
      throw new Error(`OPL_UPSTREAM_DIR/OPL_ACP_RUNTIME_DIR must contain package.json and src/cli.ts or dist/cli.js: ${oplRoot}`);
    }
    return;
  }
  ensureGitRepo({
    root: oplRoot,
    repoUrl: oplRepoUrl,
    ensureStage: "ensure-opl-upstream-repo",
    repairStage: "repair-opl-upstream-repo",
  });
}

function ensureShellRepo() {
  if (configuredShellRoot) {
    currentStage = "verify-configured-opl-web-source";
    const requiredPaths = [
      "Dockerfile",
      "package.json",
      "scripts/build-server.mjs",
      "vite.renderer.config.ts",
      "src/server.ts",
      "src/process/worker/gemini.ts",
      "src/renderer/index.html",
    ];
    const missing = requiredPaths.filter((item) => !fs.existsSync(path.join(shellRoot, item)));
    if (missing.length) {
      throw new Error(`OPL_AION_SHELL_DIR is not a complete OPL Web source tree: ${shellRoot}. Missing: ${missing.join(", ")}`);
    }
    return;
  }
  ensureGitRepo({
    root: shellRoot,
    repoUrl: webRepoUrl,
    ensureStage: "ensure-opl-web-repo",
    repairStage: "repair-opl-web-repo",
  });
}

function removeExistingContainerIfRequested() {
  currentStage = "prepare-opl-web-container";
  const existing = output("docker", ["ps", "-a", "--filter", `name=^/${containerName}$`, "--format", "{{.ID}}"]);
  if (!existing) return;
  if (!recreate) {
    throw new Error(`Docker container ${containerName} already exists. Set OPL_WEB_RECREATE=1 to replace it.`);
  }
  run("docker", ["rm", "-f", containerName]);
}

function assertSupportedStartMode() {
  if (!["docker", "local"].includes(startMode)) {
    throw new Error(`Invalid OPL_WEB_START_MODE: ${startMode}. Use docker or local.`);
  }
}

function startLocalWebServer() {
  currentStage = "start-local-opl-web";
  const logDir = path.join(runtimeRoot, "logs");
  const dataDir = path.join(runtimeRoot, "opl-aion-shell-data");
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const stdoutPath = path.join(logDir, "opl-aion-shell-web.stdout.log");
  const stderrPath = path.join(logDir, "opl-aion-shell-web.stderr.log");
  const stdout = fs.openSync(stdoutPath, "a");
  const stderr = fs.openSync(stderrPath, "a");
  const child = spawn("bun", ["dist-server/server.mjs"], {
    cwd: shellRoot,
    env: {
      ...process.env,
      PORT: String(hostPort),
      NODE_ENV: process.env.NODE_ENV || "production",
      ALLOW_REMOTE: "true",
      DATA_DIR: process.env.DATA_DIR || dataDir,
      OPL_WEBUI_AUTH_MODE: authMode,
    },
    detached: true,
    stdio: ["ignore", stdout, stderr],
  });
  child.unref();
  return {
    pid: child.pid,
    stdout: stdoutPath,
    stderr: stderrPath,
  };
}

function startGatewayProcess({ upstreamUrl, adapterUrl }) {
  currentStage = "start-opl-web-gateway";
  const logDir = path.join(runtimeRoot, "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const stdoutPath = path.join(logDir, "opl-web-gateway.stdout.log");
  const stderrPath = path.join(logDir, "opl-web-gateway.stderr.log");
  const stdout = fs.openSync(stdoutPath, "a");
  const stderr = fs.openSync(stderrPath, "a");
  const child = spawn("node", ["services/opl-web-gateway/src/server.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(gatewayPort),
      OPL_WEB_UPSTREAM_URL: upstreamUrl,
      PORTAL_OPL_ADAPTER_URL: adapterUrl,
      OPL_WEB_GATEWAY_PUBLIC_URL: process.env.OPL_WEB_GATEWAY_PUBLIC_URL || `http://127.0.0.1:${gatewayPort}`,
    },
    detached: true,
    stdio: ["ignore", stdout, stderr],
  });
  child.unref();
  return {
    pid: child.pid,
    stdout: stdoutPath,
    stderr: stderrPath,
  };
}

async function waitFor(url) {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return response.status;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`OPL Web did not become reachable in time: ${url}`);
}

async function main() {
  currentStage = "validate-port";
  assertSupportedStartMode();
  assertValidPort(hostPort);
  if (gatewayEnabled) assertValidPort(gatewayPort);
  const portWasFree = await assertPortFree(hostPort);
  const gatewayPortWasFree = gatewayEnabled ? await assertPortFree(gatewayPort) : true;
  ensureOplUpstreamRepo();
  ensureShellRepo();

  const webUrl = `http://127.0.0.1:${hostPort}`;
  const adapterUrl = process.env.PORTAL_OPL_ADAPTER_URL || process.env.PORTAL_OPL_ADAPTER_PUBLIC_URL || "http://127.0.0.1:8788";
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  let localProcess = null;
  let gatewayProcess = null;
  if (!portWasFree && reuseExisting) {
    currentStage = "wait-existing-opl-web-ready";
    await waitFor(webUrl);
  } else if (startMode === "local") {
    currentStage = "verify-local-bun";
    run("bun", ["--version"], { stdio: "pipe" });
    if (buildLocal) {
      currentStage = "build-local-opl-web-renderer";
      run("bun", ["run", "build:renderer:web"], { cwd: shellRoot });
      currentStage = "build-local-opl-web-server";
      run("bun", ["scripts/build-server.mjs"], { cwd: shellRoot });
    }
    localProcess = startLocalWebServer();
  } else {
    currentStage = "build-opl-web-image";
    run("docker", ["build", "-t", imageName, "."], { cwd: shellRoot });

    removeExistingContainerIfRequested();

    currentStage = "start-opl-web-container";
    run("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "-p",
      `${hostPort}:3000`,
      "-v",
      "opl-data:/data",
      "-e",
      "ALLOW_REMOTE=true",
      "-e",
      "DATA_DIR=/data",
      "-e",
      `OPL_WEBUI_AUTH_MODE=${authMode}`,
      ...(process.env.CODEX_HOME ? ["-e", `CODEX_HOME=${process.env.CODEX_HOME}`] : []),
      ...(process.env.OPL_CODEX_MODEL ? ["-e", `OPL_CODEX_MODEL=${process.env.OPL_CODEX_MODEL}`] : []),
      ...(process.env.OPL_CODEX_REASONING_EFFORT ? ["-e", `OPL_CODEX_REASONING_EFFORT=${process.env.OPL_CODEX_REASONING_EFFORT}`] : []),
      ...(process.env.OPL_CODEX_BASE_URL ? ["-e", `OPL_CODEX_BASE_URL=${process.env.OPL_CODEX_BASE_URL}`] : []),
      ...(process.env.OPL_CODEX_API_KEY ? ["-e", `OPL_CODEX_API_KEY=${process.env.OPL_CODEX_API_KEY}`] : []),
      imageName,
    ]);
  }

  currentStage = "wait-opl-web-ready";
  await waitFor(webUrl);
  if (gatewayEnabled && !gatewayPortWasFree && reuseExisting) {
    currentStage = "wait-existing-opl-web-gateway-ready";
    await waitFor(`${gatewayUrl}/healthz`);
  } else if (gatewayEnabled) {
    gatewayProcess = startGatewayProcess({ upstreamUrl: webUrl, adapterUrl });
    currentStage = "wait-opl-web-gateway-ready";
    await waitFor(`${gatewayUrl}/healthz`);
  }

  console.log(JSON.stringify({
    ok: true,
    startMode,
    containerName,
    imageName,
    localProcess,
    gatewayProcess,
    reusedExisting: !portWasFree && reuseExisting,
    reusedExistingGateway: gatewayEnabled && !gatewayPortWasFree && reuseExisting,
    oplUpstreamRepo: {
      url: oplRepoUrl,
      path: oplRoot,
    },
    oplWebRepo: {
      url: webRepoUrl,
      path: shellRoot,
    },
    oplWebUrl: gatewayEnabled ? gatewayUrl : webUrl,
    oplWebUpstreamUrl: webUrl,
    portalEnv: {
      START_OPL_PRODUCT_API_FIXTURE: "0",
      OPL_WEB_URL: gatewayEnabled ? gatewayUrl : webUrl,
      OPL_PRODUCT_API_URL: "",
      OPL_RUNTIME_MODE: "acp",
      OPL_ACP_RUNTIME_DIR: oplRoot,
    },
    nextCommand: `$env:START_OPL_PRODUCT_API_FIXTURE="0"; $env:OPL_WEB_URL="${gatewayEnabled ? gatewayUrl : webUrl}"; $env:OPL_PRODUCT_API_URL=""; $env:OPL_RUNTIME_MODE="acp"; $env:OPL_ACP_RUNTIME_DIR="${oplRoot}"; node scripts/start-portal-live.mjs`,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    stage: currentStage,
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
});
