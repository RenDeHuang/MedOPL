import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../");
const configuredRuntimeDir = String(process.env.OPL_ACP_RUNTIME_DIR || process.env.OPL_UPSTREAM_DIR || "").trim();
const defaultRuntimeDir = path.join(repoRoot, ".runtime", "one-person-lab-upstream");
const runtimeMode = String(process.env.OPL_RUNTIME_MODE || "").trim().toLowerCase();
const runtimeCommandJson = String(process.env.OPL_ACP_RUNTIME_COMMAND_JSON || "").trim();
const timeoutMs = Number(process.env.OPL_ACP_RUNTIME_TIMEOUT_MS || 15000);

export function hasOplAcpRuntime() {
  return runtimeMode === "acp" || Boolean(runtimeCommandJson);
}

function runtimeCommand() {
  if (runtimeCommandJson) {
    const parsed = JSON.parse(runtimeCommandJson);
    if (!Array.isArray(parsed) || !parsed.length || typeof parsed[0] !== "string") {
      throw new Error("OPL_ACP_RUNTIME_COMMAND_JSON must be a JSON array: [command, ...args]");
    }
    return { command: parsed[0], args: parsed.slice(1).map((item) => String(item)) };
  }

  const runtimeDir = configuredRuntimeDir ? path.resolve(repoRoot, configuredRuntimeDir) : defaultRuntimeDir;
  const sourceCliPath = path.join(runtimeDir, "src", "cli.ts");
  const builtCliPath = path.join(runtimeDir, "dist", "cli.js");
  const cliPath = fs.existsSync(sourceCliPath) ? sourceCliPath : builtCliPath;
  if (!fs.existsSync(cliPath)) {
    throw new Error(`OPL ACP runtime CLI not found. Set OPL_ACP_RUNTIME_DIR or OPL_ACP_RUNTIME_COMMAND_JSON. Checked: ${sourceCliPath}, ${builtCliPath}`);
  }
  return {
    command: process.execPath,
    args: cliPath.endsWith(".ts")
      ? ["--experimental-strip-types", cliPath, "session", "runtime", "--acp"]
      : [cliPath, "session", "runtime", "--acp"],
  };
}

async function runAcpRequests(requests) {
  const { command, args } = runtimeCommand();
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });

  const responses = [];
  let stderr = "";
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    responses.push(JSON.parse(trimmed));
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, timeoutMs);

  for (const request of requests) {
    child.stdin.write(`${JSON.stringify(request)}\n`);
  }
  child.stdin.end();

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(1));
  });
  clearTimeout(timer);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `OPL ACP runtime exited with code ${exitCode}`);
  }
  return responses;
}

function responseById(responses, id) {
  return responses.find((item) => item?.id === id) || null;
}

function assertOk(response, label) {
  if (response?.ok) return response;
  const error = response?.error?.message || response?.error?.code || "unknown_acp_runtime_error";
  throw new Error(`${label}:${error}`);
}

export async function initializeAcpRuntime() {
  const responses = await runAcpRequests([{ id: "initialize", command: "initialize" }]);
  return assertOk(responseById(responses, "initialize"), "acp_initialize").result || {};
}

export async function bindAcpWorkspace(context = {}) {
  await initializeAcpRuntime();
  return {
    id: context.workspaceId || context.workspace_id || "",
    workspaceId: context.workspaceId || context.workspace_id || "",
    workspaceTitle: context.workspaceTitle || context.workspace_title || "",
    workspacePath: context.workspacePath || context.workspace_path || "",
    workspaceSessionId: context.workspaceSessionId || context.workspace_session_id || "",
    runtimeSessionId: context.runtimeSessionId || context.runtime_session_id || "",
    source: "opl_acp_runtime",
    status: "bound",
  };
}

export async function createAcpSession(context = {}) {
  const sessionId = context.runtimeSessionId || context.runtime_session_id || `portal-acp-${Date.now()}`;
  const taskId = context.workspaceSessionId || context.workspace_session_id || sessionId;
  const responses = await runAcpRequests([
    { id: "initialize", command: "initialize" },
    {
      id: "session_create",
      command: "session_create",
      payload: {
        version: "g2",
        session_create: {
          surface_id: "opl_session_create",
          request_mode: "submitted",
          payload: {
            product_entry: {
              entry_surface: "portal_opl_launch",
              mode: "launch",
              seed: { session_id: sessionId },
              task: {
                task_id: taskId,
                status: "accepted",
                stage: "launch",
                summary: "Portal launch bound to OPL ACP runtime.",
                executor_backend: "codex",
                session_id: null,
              },
            },
          },
        },
      },
    },
  ]);
  const result = assertOk(responseById(responses, "session_create"), "acp_session_create").result || {};
  return {
    id: result.session_id || sessionId,
    sessionId: result.session_id || sessionId,
    status: "ready",
    source: "opl_acp_runtime",
    taskAcceptance: result.task_acceptance || null,
  };
}

export async function getAcpBootstrap(context = {}) {
  const responses = await runAcpRequests([
    { id: "initialize", command: "initialize" },
    { id: "session_list", command: "session_list", payload: { limit: 20 } },
    { id: "session_ledger", command: "session_ledger", payload: { limit: 20 } },
  ]);
  const initialized = assertOk(responseById(responses, "initialize"), "acp_initialize").result || {};
  const sessions = assertOk(responseById(responses, "session_list"), "acp_session_list").result || {};
  const ledger = assertOk(responseById(responses, "session_ledger"), "acp_session_ledger").result || {};
  const workspace = {
    workspaceId: context.workspaceId || context.workspace_id || "",
    workspaceTitle: context.workspaceTitle || context.workspace_title || "",
    workspacePath: context.workspacePath || context.workspace_path || "",
    source: "portal_context",
  };
  return {
    health: {
      ok: true,
      source: "opl_acp_runtime",
      surfaceId: initialized.surface_id || "",
      version: initialized.version || "",
      commands: initialized.commands || [],
    },
    system: {
      id: "opl-acp-runtime",
      status: "ready",
      source: "one-person-lab",
      commands: initialized.commands || [],
    },
    engines: [],
    modules: [],
    agents: [],
    workspaces: workspace.workspaceId || workspace.workspacePath ? [workspace] : [],
    sessions: Array.isArray(sessions.items) ? sessions.items : [],
    progress: [],
    artifacts: [],
    ledger,
  };
}
