import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, access, copyFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getGroupById, getPortalUserById, getWalletByUserId, getWorkspaceSession } from "../../shared/portal-state.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.runtime/med-autoscience");
const WORKSPACES_DIR = path.join(ROOT_DIR, "workspaces");
const RUNS_DIR = path.join(ROOT_DIR, "runs");
const INDEX_DIR = path.join(ROOT_DIR, "index");
const JOB_TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../infra/kubernetes/job-template.yaml");
const ADAPTER_WORKDIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SYNC_WORKSPACE_TO_MINIO_SCRIPT = path.join("..", "..", "scripts", "sync-workspace-file-to-minio.ps1");
const MINIO_API_URL = process.env.MINIO_API_URL || "http://127.0.0.1:30091";
const BILLING_RECONCILE_URL = (process.env.BILLING_RECONCILE_URL || "").trim();
const KUBECTL_BIN = process.env.KUBECTL_BIN || "kubectl";
const K8S_NAMESPACE = (process.env.K8S_NAMESPACE || "med-agent-demo").trim();
const RUNNER_IMAGE = (process.env.MED_AUTOSCIENCE_RUNNER_IMAGE || "host.docker.internal:30095/library/med-autoscience-runner:local-test").trim();
const RUNNER_COMMAND = (process.env.MED_AUTOSCIENCE_RUNNER_COMMAND || "medautosci show-agent-entry-modes").trim();
const RUNNER_CPU_REQUEST = (process.env.MED_AUTOSCIENCE_RUNNER_CPU_REQUEST || "250m").trim();
const RUNNER_MEMORY_REQUEST = (process.env.MED_AUTOSCIENCE_RUNNER_MEMORY_REQUEST || "128Mi").trim();
const RUNNER_CPU_LIMIT = (process.env.MED_AUTOSCIENCE_RUNNER_CPU_LIMIT || "500m").trim();
const RUNNER_MEMORY_LIMIT = (process.env.MED_AUTOSCIENCE_RUNNER_MEMORY_LIMIT || "256Mi").trim();
const RUNNER_WARMUP_MODE = (process.env.MED_AUTOSCIENCE_WARMUP_MODE || "local").trim().toLowerCase();
const WARMUP_JOB_TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../infra/kubernetes/warmup-job-template.yaml");
const IMAGE_PULL_SECRET = (process.env.MED_AUTOSCIENCE_IMAGE_PULL_SECRET || "").trim();
const WARMUP_COMMAND = (process.env.MED_AUTOSCIENCE_WARMUP_COMMAND || "echo warmup-ready").trim();
const HTTP_PORT = Number(process.env.MED_AUTOSCIENCE_RUNNER_PORT || 0);
const execFileAsync = promisify(execFile);
let minioAvailability = { checkedAt: 0, ok: false };
let runnerWarmupState = { image: "", readyAt: 0, details: null };

async function ensureDirectories() {
  await mkdir(WORKSPACES_DIR, { recursive: true });
  await mkdir(RUNS_DIR, { recursive: true });
  await mkdir(INDEX_DIR, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function workspaceRoot(customerId, workspaceId) {
  return path.join(WORKSPACES_DIR, customerId, workspaceId);
}

function k8sLabelSafe(value = "") {
  const safe = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return safe || "default";
}

function runFile(runId) {
  return path.join(RUNS_DIR, `${runId}.json`);
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function resolveGroupPolicy(portal, customerId = "") {
  const user = portal?.user || null;
  const group = portal?.group || null;
  return {
    user,
    group,
    groupId: group?.id || "",
    policyVersion: group ? `${group.id}:${group.createdAt || ""}` : "default",
    balanceFloor: Number(group?.balanceFloor || 0),
    maxWorkspaces: Number(group?.maxWorkspaces || 0),
    maxConcurrentRuns: Number(group?.maxConcurrentRuns || 0),
    cpuRequest: String(group?.cpuRequest || "").trim(),
    cpuLimit: String(group?.cpuLimit || "").trim(),
    memoryRequest: String(group?.memoryRequest || "").trim(),
    memoryLimit: String(group?.memoryLimit || "").trim(),
    gpuCount: Number(group?.gpuCount || 0),
    storageRequest: String(group?.storageRequest || "").trim(),
    storageLimit: String(group?.storageLimit || "").trim(),
    allowMas: group?.allowMas !== false,
    allowWorkspaceCreate: group?.allowWorkspaceCreate !== false,
  };
}

async function resolveWorkspaceSession(sessionId, userId = "") {
  if (!sessionId) return null;
  const session = await getWorkspaceSession(sessionId, userId);
  if (!session) return null;

  return {
    customerId: session.userId,
    userId: session.userId,
    workspaceId: session.workspaceId,
    workspaceTitle: session.workspaceTitle,
    workspaceSessionId: session.id
  };
}

async function ensureRuntimeStartAllowedLegacy(customerId) {
  const portal = await readPortalDb();
  if (!portal || !customerId) return;

  const wallet = portal.wallets?.find((item) => item.userId === customerId);
  if (!wallet) return;

  if (Number(wallet.balance || 0) <= 0) {
    throw new Error("余额不足，不能启动新的 runtime。请先充值后再运行研究任务。");
  }
}

async function reconcileCustomerCosts(customerId) {
  if (!BILLING_RECONCILE_URL || !customerId) return null;

  try {
    const response = await fetch(BILLING_RECONCILE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customer_id: customerId, window: "7d" })
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function ensureRuntimeStartAllowed(customerId) {
  if (!customerId) return resolveGroupPolicy(null, "");
  const user = await getPortalUserById(customerId);
  const wallet = await getWalletByUserId(customerId);
  const group = user?.groupId ? await getGroupById(user.groupId) : null;
  const policy = resolveGroupPolicy({ user, group }, customerId);
  if (!wallet) return policy;

  if (Number(wallet.balance || 0) <= 0) {
    throw new Error("余额不足，不能启动新的 runtime。请先充值后再运行研究任务。");
  }
  if (policy.balanceFloor > 0 && Number(wallet.balance || 0) < policy.balanceFloor) {
    throw new Error(`当前余额低于分组阈值 ${policy.balanceFloor}`);
  }
  if (!policy.allowMas) {
    throw new Error("当前分组不允许启动 MAS 研究运行");
  }
  return policy;
}

async function listRunMetadata() {
  try {
    const names = await readdir(RUNS_DIR);
    const runs = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        runs.push(await readJson(path.join(RUNS_DIR, name)));
      } catch {}
    }
    return runs;
  } catch {
    return [];
  }
}

async function ensureGroupRuntimePolicy({ customerId }) {
  if (!customerId) return resolveGroupPolicy(null, "");
  const user = await getPortalUserById(customerId);
  const group = user?.groupId ? await getGroupById(user.groupId) : null;
  const policy = resolveGroupPolicy({ user, group }, customerId);
  if (!policy.allowWorkspaceCreate) {
    throw new Error("当前分组不允许创建任务空间");
  }
  if (policy.maxWorkspaces > 0) {
    const taskCount = (await listRunMetadata()).length >= 0 ? 0 : 0;
    // taskCount will be derived from workspace filesystem until adapters no longer depend on file layout
    const userWorkspaceDir = path.join(WORKSPACES_DIR, customerId);
    const names = await readdir(userWorkspaceDir).catch(() => []);
    const taskCountFromFs = names.length;
    if (taskCountFromFs > policy.maxWorkspaces) {
      throw new Error(`已超过分组任务空间上限 ${policy.maxWorkspaces}`);
    }
  }
  if (policy.maxConcurrentRuns > 0) {
    const runs = await listRunMetadata();
    const activeCount = runs.filter((item) => item.customerId === customerId && !["succeeded", "failed", "cancelled", "timed_out", "completed"].includes(String(item.status || "").toLowerCase())).length;
    if (activeCount >= policy.maxConcurrentRuns) {
      throw new Error(`已达到分组并发运行上限 ${policy.maxConcurrentRuns}`);
    }
  }
  return policy;
}

async function warmupRunner({ workspaceId = "", workspaceSessionId = "", userId = "" }) {
  const now = Date.now();
  if (runnerWarmupState.image === RUNNER_IMAGE && now - runnerWarmupState.readyAt < 10 * 60_000) {
    return { ok: true, mode: "cached", image: RUNNER_IMAGE, ...runnerWarmupState.details };
  }
  const details = {
    image: RUNNER_IMAGE,
    workspaceId,
    workspaceSessionId,
    userId,
    publishToHarbor: "skipped",
    loadIntoKind: "skipped",
  };
  if (RUNNER_WARMUP_MODE === "cloud") {
    try {
      const warmupId = randomUUID();
      const template = await readFile(WARMUP_JOB_TEMPLATE, "utf8");
      const runnerImageTag = RUNNER_IMAGE.includes(":") ? RUNNER_IMAGE.split(":").pop() : "latest";
      const imagePullSecretsBlock = IMAGE_PULL_SECRET ? `imagePullSecrets:\n        - name: "${IMAGE_PULL_SECRET}"` : "";
      const warmupYaml = template
        .replaceAll("__WARMUP_ID__", warmupId)
        .replaceAll("__CUSTOMER_ID__", userId || "unknown")
        .replaceAll("__WORKSPACE_ID__", workspaceId || "unknown")
        .replaceAll("__WORKSPACE_SESSION_ID__", workspaceSessionId || "unknown")
        .replaceAll("__RUNNER_IMAGE_TAG__", k8sLabelSafe(runnerImageTag))
        .replaceAll("__RUNNER_IMAGE__", RUNNER_IMAGE)
        .replaceAll("__IMAGE_PULL_SECRETS_BLOCK__", imagePullSecretsBlock)
        .replaceAll("__GPU_REQUEST_BLOCK__", "")
        .replaceAll("__GPU_LIMIT_BLOCK__", "")
        .replaceAll("__EPHEMERAL_STORAGE_REQUEST_BLOCK__", "")
        .replaceAll("__EPHEMERAL_STORAGE_LIMIT_BLOCK__", "")
        .replaceAll("__CPU_REQUEST__", RUNNER_CPU_REQUEST)
        .replaceAll("__MEMORY_REQUEST__", RUNNER_MEMORY_REQUEST)
        .replaceAll("__CPU_LIMIT__", RUNNER_CPU_LIMIT)
        .replaceAll("__MEMORY_LIMIT__", RUNNER_MEMORY_LIMIT)
        .replaceAll("__WARMUP_COMMAND__", WARMUP_COMMAND);
      const warmupManifest = path.join(ROOT_DIR, "warmup", `job-${warmupId}.yaml`);
      await mkdir(path.dirname(warmupManifest), { recursive: true });
      await writeFile(warmupManifest, warmupYaml, "utf8");
      await ensureNamespace();
      const apply = await kubectl(["apply", "-n", K8S_NAMESPACE, "-f", warmupManifest]);
      details.publishToHarbor = "cloud-assumed";
      details.loadIntoKind = "not_applicable";
      details.k8sWarmup = apply.stdout || "applied";
      try {
        const wait = await kubectl(["wait", "--for=condition=complete", `job/med-autoscience-warmup-${warmupId}`, "-n", K8S_NAMESPACE, "--timeout=120s"]);
        details.k8sWarmupWait = wait.stdout || "completed";
      } catch (error) {
        details.k8sWarmupWait = `error:${String(error.message || error)}`;
      }
    } catch (error) {
      details.k8sWarmup = `error:${String(error.message || error)}`;
    }
  } else {
    try {
      await execFileAsync("powershell.exe", ["-ExecutionPolicy", "Bypass", "-File", path.join("..", "..", "scripts", "publish-runner-to-harbor.ps1")], {
        cwd: ADAPTER_WORKDIR,
        timeout: 8 * 60_000,
        maxBuffer: 1024 * 1024 * 8,
      });
      details.publishToHarbor = "ok";
    } catch (error) {
      details.publishToHarbor = `error:${String(error.message || error)}`;
    }
    try {
      await execFileAsync("powershell.exe", ["-ExecutionPolicy", "Bypass", "-File", path.join("..", "..", "scripts", "load-med-runner-into-kind.ps1")], {
        cwd: ADAPTER_WORKDIR,
        timeout: 8 * 60_000,
        maxBuffer: 1024 * 1024 * 8,
        env: { ...process.env, MED_AUTOSCIENCE_RUNNER_IMAGE: "dify_bundle-med-autoscience:latest" },
      });
      details.loadIntoKind = "ok";
    } catch (error) {
      details.loadIntoKind = `error:${String(error.message || error)}`;
    }
  }
  runnerWarmupState = { image: RUNNER_IMAGE, readyAt: now, details };
  return { ok: true, mode: "executed", ...details };
}

async function syncWorkspaceFileToMinio(userId, taskSlug, kind, filePath) {
  const targetFile = path.resolve(filePath);
  if (!(await fileExists(targetFile))) {
    return;
  }

  const now = Date.now();
  if (now - minioAvailability.checkedAt > 10_000) {
    try {
      const probeResponse = await fetch(new URL("/minio/health/live", `${MINIO_API_URL}/`), {
        signal: AbortSignal.timeout(1500)
      });
      minioAvailability = { checkedAt: now, ok: probeResponse.ok };
    } catch {
      minioAvailability = { checkedAt: now, ok: false };
    }
  }

  if (!minioAvailability.ok) {
    return;
  }

  try {
    await execFileAsync("powershell.exe", [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      SYNC_WORKSPACE_TO_MINIO_SCRIPT,
      "-UserId",
      userId,
      "-TaskSlug",
      taskSlug,
      "-Kind",
      kind,
      "-FilePath",
      targetFile
    ], {
      cwd: ADAPTER_WORKDIR,
      timeout: 120000,
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    console.error("MinIO sync failed", error);
  }
}

async function syncWorkspaceDirToMinio(userId, taskSlug, kind, dirPath) {
  const names = await readdir(dirPath);
  for (const name of names) {
    await syncWorkspaceFileToMinio(userId, taskSlug, kind, path.join(dirPath, name));
  }
  return names;
}

async function resolvePortalTaskContext(userId) {
  if (!userId) return null;
  const user = await getPortalUserById(userId);
  if (!user) return null;
  const slug = user.currentTaskSlug || "default";
  return {
    customerId: user.id,
    userId: user.id,
    workspaceId: slug
  };
}

async function kubectl(args, options = {}) {
  const result = await execFileAsync(KUBECTL_BIN, args, {
    timeout: 30000,
    maxBuffer: 1024 * 1024,
    ...options
  });

  return {
    stdout: result.stdout?.trim() || "",
    stderr: result.stderr?.trim() || ""
  };
}

async function ensureNamespace() {
  try {
    await kubectl(["get", "namespace", K8S_NAMESPACE]);
  } catch {
    await kubectl(["create", "namespace", K8S_NAMESPACE]);
  }
}

async function createWorkspace(args = {}) {
  const customerId = args.customerId || "demo-customer";
  const userId = args.userId || "demo-user";
  const workspaceId = args.workspaceId || randomUUID();
  const root = workspaceRoot(customerId, workspaceId);

  for (const segment of ["inputs", "runtime", "logs", "outputs"]) {
    await mkdir(path.join(root, segment), { recursive: true });
  }

  const metadata = {
    customerId,
    userId,
    workspaceId,
    root,
    createdAt: new Date().toISOString()
  };

  await writeJson(path.join(root, "workspace.json"), metadata);
  await writeJson(path.join(INDEX_DIR, `workspace-${workspaceId}.json`), metadata);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(metadata, null, 2)
      }
    ]
  };
}

async function materializeInputFiles(inputFiles, targetDir) {
  if (!Array.isArray(inputFiles)) return [];

  const materialized = [];

  for (const file of inputFiles) {
    if (!file?.path) continue;
    const fileName = file.name || path.basename(file.path);
    const dest = path.join(targetDir, fileName);
    await copyFile(file.path, dest);
    materialized.push(dest);
  }

  return materialized;
}

async function listWorkspaceInputFiles(workspaceRoot) {
  const inputDir = path.join(workspaceRoot, "inputs");
  await mkdir(inputDir, { recursive: true });
  const names = await readdir(inputDir);
  return names.map((name) => path.join(inputDir, name));
}

async function startRun(args = {}) {
  const customerId = args.customerId || "demo-customer";
  const userId = args.userId || "demo-user";
  const workspaceId = args.workspaceId || randomUUID();
  const runId = args.runId || randomUUID();

  const policy = await ensureRuntimeStartAllowed(customerId);
  await ensureGroupRuntimePolicy({ customerId, workspaceId });

  const root = workspaceRoot(customerId, workspaceId);

  if (!(await fileExists(path.join(root, "workspace.json")))) {
    await createWorkspace({ customerId, userId, workspaceId });
  }

  const copiedFiles = await materializeInputFiles(args.inputFiles, path.join(root, "inputs"));
  const workspaceInputFiles = await listWorkspaceInputFiles(root);
  const jobTemplate = await readFile(JOB_TEMPLATE, "utf8");
  const runnerImage = args.runnerImage || RUNNER_IMAGE;
  const runnerImageTag = runnerImage.includes(":") ? runnerImage.split(":").pop() : "latest";
  const policyVersion = policy.policyVersion || "default";
  const policyVersionLabel = k8sLabelSafe(policyVersion);
  const groupIdLabel = k8sLabelSafe(policy.groupId || "default");
  const runnerImageTagLabel = k8sLabelSafe(runnerImageTag);
  const cpuRequest = policy.cpuRequest || args.cpuRequest || RUNNER_CPU_REQUEST;
  const cpuLimit = policy.cpuLimit || args.cpuLimit || RUNNER_CPU_LIMIT;
  const memoryRequest = policy.memoryRequest || args.memoryRequest || RUNNER_MEMORY_REQUEST;
  const memoryLimit = policy.memoryLimit || args.memoryLimit || RUNNER_MEMORY_LIMIT;
  const gpuCount = Number(args.gpuCount ?? policy.gpuCount ?? 0);
  const storageRequest = policy.storageRequest || args.storageRequest || "";
  const storageLimit = policy.storageLimit || args.storageLimit || "";
  const gpuRequestBlock = gpuCount > 0 ? `nvidia.com/gpu: "${gpuCount}"` : "";
  const gpuLimitBlock = gpuCount > 0 ? `nvidia.com/gpu: "${gpuCount}"` : "";
  const storageRequestBlock = storageRequest ? `ephemeral-storage: "${storageRequest}"` : "";
  const storageLimitBlock = storageLimit ? `ephemeral-storage: "${storageLimit}"` : "";
  const imagePullSecretsBlock = process.env.MED_AUTOSCIENCE_IMAGE_PULL_SECRET
    ? `imagePullSecrets:\n        - name: "${process.env.MED_AUTOSCIENCE_IMAGE_PULL_SECRET}"`
    : "";
  const jobYaml = jobTemplate
    .replaceAll("__CUSTOMER_ID__", customerId)
    .replaceAll("__USER_ID__", userId)
    .replaceAll("__WORKSPACE_ID__", workspaceId)
    .replaceAll("__RUN_ID__", runId)
    .replaceAll("__RUNNER_IMAGE__", runnerImage)
    .replaceAll("__WORKSPACE_SESSION_ID__", args.workspaceSessionId || "")
    .replaceAll("__GROUP_ID__", groupIdLabel)
    .replaceAll("__POLICY_VERSION__", policyVersionLabel)
    .replaceAll("__RUNNER_IMAGE_TAG__", runnerImageTagLabel)
    .replaceAll("__IMAGE_PULL_SECRETS_BLOCK__", imagePullSecretsBlock)
    .replaceAll("__GPU_REQUEST_BLOCK__", gpuRequestBlock)
    .replaceAll("__GPU_LIMIT_BLOCK__", gpuLimitBlock)
    .replaceAll("__EPHEMERAL_STORAGE_REQUEST_BLOCK__", storageRequestBlock)
    .replaceAll("__EPHEMERAL_STORAGE_LIMIT_BLOCK__", storageLimitBlock)
    .replaceAll("__CPU_REQUEST__", cpuRequest)
    .replaceAll("__MEMORY_REQUEST__", memoryRequest)
    .replaceAll("__CPU_LIMIT__", cpuLimit)
    .replaceAll("__MEMORY_LIMIT__", memoryLimit)
    .replaceAll("__RUNNER_COMMAND__", args.runnerCommand || RUNNER_COMMAND);

  const manifestPath = path.join(root, "runtime", `job-${runId}.yaml`);
  const logPath = path.join(root, "logs", `${runId}.log`);

  await writeFile(manifestPath, jobYaml, "utf8");
  await writeFile(logPath, `Run ${runId} created at ${new Date().toISOString()}\n`, "utf8");

  const runMetadata = {
    runId,
    customerId,
    userId,
    workspaceId,
    workspaceSessionId: args.workspaceSessionId || "",
    groupId: policy.groupId || "",
    policyVersion,
    runnerImage,
    runnerImageTag,
    cpuRequest,
    cpuLimit,
    memoryRequest,
    memoryLimit,
    gpuCount,
    storageRequest,
    storageLimit,
    policySnapshot: {
      cpuRequest: policy.cpuRequest || "",
      cpuLimit: policy.cpuLimit || "",
      memoryRequest: policy.memoryRequest || "",
      memoryLimit: policy.memoryLimit || "",
      gpuCount: policy.gpuCount || 0,
      storageRequest: policy.storageRequest || "",
      storageLimit: policy.storageLimit || "",
    },
    status: "queued",
    namespace: K8S_NAMESPACE,
    jobName: `med-autoscience-${runId}`,
    manifestPath,
    logPath,
    inputFiles: copiedFiles,
    workspaceInputFiles,
    createdAt: new Date().toISOString()
  };

  await ensureNamespace();
  const applyResult = await kubectl(["apply", "-n", K8S_NAMESPACE, "-f", manifestPath]);
  await writeFile(logPath, `Run ${runId} created at ${new Date().toISOString()}\n${applyResult.stdout}\n${applyResult.stderr}\n`, "utf8");

  runMetadata.status = "submitted";
  runMetadata.kubectlApply = applyResult;

  await writeJson(runFile(runId), runMetadata);
  await writeJson(path.join(INDEX_DIR, `run-${runId}.json`), runMetadata);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(runMetadata, null, 2)
      }
    ]
  };
}

async function getRunStatus(args = {}) {
  const runId = args.runId;
  if (!runId) throw new Error("Missing runId");

  const runMetadata = await readJson(runFile(runId));

  try {
    const result = await kubectl(["get", "job", runMetadata.jobName, "-n", runMetadata.namespace || K8S_NAMESPACE, "-o", "json"]);
    const parsed = JSON.parse(result.stdout);
    const status = parsed?.status || {};
    runMetadata.k8sStatus = {
      active: status.active || 0,
      succeeded: status.succeeded || 0,
      failed: status.failed || 0,
      conditions: status.conditions || []
    };
  } catch (error) {
    runMetadata.k8sStatus = `Unknown: ${String(error)}`;
  }

  if (runMetadata.k8sStatus?.succeeded) {
    runMetadata.billingReconcile = await reconcileCustomerCosts(runMetadata.customerId || runMetadata.userId);
  }

  await writeJson(runFile(runId), runMetadata);
  await writeJson(path.join(INDEX_DIR, `run-${runId}.json`), runMetadata);

  return {
    content: [{ type: "text", text: JSON.stringify(runMetadata, null, 2) }]
  };
}

async function getRunLogs(args = {}) {
  const runId = args.runId;
  if (!runId) throw new Error("Missing runId");

  const runMetadata = await readJson(runFile(runId));
  let logs = await readFile(runMetadata.logPath, "utf8");

  try {
    const pods = await kubectl([
      "get",
      "pods",
      "-n",
      runMetadata.namespace || K8S_NAMESPACE,
      "-l",
      `job-name=${runMetadata.jobName}`,
      "-o",
      "jsonpath={.items[0].metadata.name}"
    ]);

    if (pods.stdout) {
      const podLogs = await kubectl(["logs", "-n", runMetadata.namespace || K8S_NAMESPACE, pods.stdout]);
      logs += `\n--- kubectl logs ---\n${podLogs.stdout}\n${podLogs.stderr}\n`;
    }
  } catch (error) {
    logs += `\n--- kubectl logs error ---\n${String(error)}\n`;
  }

  return {
    content: [{ type: "text", text: logs }]
  };
}

async function listRunOutputs(args = {}) {
  const customerId = args.customerId;
  const workspaceId = args.workspaceId;
  if (!customerId || !workspaceId) throw new Error("Missing customerId or workspaceId");

  const outputsDir = path.join(workspaceRoot(customerId, workspaceId), "outputs");
  await mkdir(outputsDir, { recursive: true });
  const names = await syncWorkspaceDirToMinio(customerId, workspaceId, "outputs", outputsDir);

  return {
    content: [{ type: "text", text: JSON.stringify(names, null, 2) }]
  };
}

async function listWorkspaceFiles(args = {}) {
  const customerId = args.customerId;
  const workspaceId = args.workspaceId;
  if (!customerId || !workspaceId) throw new Error("Missing customerId or workspaceId");

  const root = workspaceRoot(customerId, workspaceId);
  const inputDir = path.join(root, "inputs");
  const outputDir = path.join(root, "outputs");
  await mkdir(inputDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const inputs = await syncWorkspaceDirToMinio(customerId, workspaceId, "inputs", inputDir);
  const outputs = await syncWorkspaceDirToMinio(customerId, workspaceId, "outputs", outputDir);

  return {
    content: [{ type: "text", text: JSON.stringify({ workspaceId, inputs, outputs }, null, 2) }]
  };
}

const runnerActions = {
  create_workspace: createWorkspace,
  start_run: startRun,
  get_run_status: getRunStatus,
  get_run_logs: getRunLogs,
  list_run_outputs: listRunOutputs,
  list_workspace_files: listWorkspaceFiles
};

function normalizeActionResult(result) {
  const text = result?.content?.[0]?.text;
  if (typeof text === "string") {
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }
  return result;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
  }
  return body ? JSON.parse(body) : {};
}

async function runAction(actionName, args = {}) {
  const action = runnerActions[actionName];
  if (!action) throw new Error(`unknown_runner_action:${actionName}`);
  return normalizeActionResult(await action(args));
}

async function startHttpServer() {
  await ensureDirectories();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://local");

    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, mode: "internal-runner", namespace: K8S_NAMESPACE });
      return;
    }

    try {
      if (req.method === "POST" && (url.pathname === "/warmup" || url.pathname === "/api/warmup")) {
        const payload = await readJsonBody(req);
        const result = await warmupRunner({
          workspaceId: String(payload.workspaceId || ""),
          workspaceSessionId: String(payload.workspaceSessionId || ""),
          userId: String(payload.userId || payload.customerId || ""),
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/workspaces") {
        sendJson(res, 200, { ok: true, workspace: await runAction("create_workspace", await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/runs") {
        sendJson(res, 200, { ok: true, run: await runAction("start_run", await readJsonBody(req)) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/runs") {
        sendJson(res, 200, { ok: true, runs: await listRunMetadata() });
        return;
      }

      const runStatusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/status$/);
      if (req.method === "GET" && runStatusMatch) {
        sendJson(res, 200, { ok: true, run: await runAction("get_run_status", { runId: runStatusMatch[1] }) });
        return;
      }

      const runLogsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/logs$/);
      if (req.method === "GET" && runLogsMatch) {
        sendJson(res, 200, { ok: true, logs: await runAction("get_run_logs", { runId: runLogsMatch[1] }) });
        return;
      }

      const workspaceFilesMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/([^/]+)\/files$/);
      if (req.method === "GET" && workspaceFilesMatch) {
        sendJson(res, 200, {
          ok: true,
          files: await runAction("list_workspace_files", {
            customerId: decodeURIComponent(workspaceFilesMatch[1]),
            workspaceId: decodeURIComponent(workspaceFilesMatch[2]),
          }),
        });
        return;
      }

      const workspaceOutputsMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/([^/]+)\/outputs$/);
      if (req.method === "GET" && workspaceOutputsMatch) {
        sendJson(res, 200, {
          ok: true,
          outputs: await runAction("list_run_outputs", {
            customerId: decodeURIComponent(workspaceOutputsMatch[1]),
            workspaceId: decodeURIComponent(workspaceOutputsMatch[2]),
          }),
        });
        return;
      }
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error) });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not_found" });
  });

  server.listen(HTTP_PORT, () => {
    console.log(`med-autoscience-runner internal api listening on :${HTTP_PORT}`);
  });
}

async function main() {
  if (HTTP_PORT > 0) {
    await startHttpServer();
    return;
  }

  await ensureDirectories();
  console.log("med-autoscience-runner ready; set MED_AUTOSCIENCE_RUNNER_PORT to expose the internal HTTP API.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
