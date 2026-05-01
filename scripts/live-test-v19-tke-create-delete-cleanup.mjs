import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import {
  PROVISIONING_ENABLED,
  TENCENT_CLOUD_REGION,
  TENCENT_TKE_CLUSTER_ID,
  TENCENT_TKE_ENDPOINT,
  TENCENT_TKE_ZONE,
  runtimeRoot,
  tencentCloudConfigured,
} from "../adapters/resource-provisioner/src/config.mjs";
import { describeClusterInstances, describeNodePools } from "../adapters/resource-provisioner/src/inventory.mjs";
import { cloudTagValue, labelValue } from "../adapters/resource-provisioner/src/labels.mjs";
import { deleteNodePool, ensureCapacity, previewCreateNodePoolPayload, scaleToZero } from "../adapters/resource-provisioner/src/provisioner.mjs";
import { sanitizeTencentError } from "../adapters/resource-provisioner/src/tencent-cloud.mjs";

const execFileAsync = promisify(execFile);
const evidenceDir = path.join(runtimeRoot, "live-tke-create-delete-cleanup");

function fail(message, extras = {}) {
  const error = new Error(message);
  Object.assign(error, extras);
  throw error;
}

function readEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function requiredEnv(name) {
  const value = readEnv(name);
  if (!value) fail(`${name}_required`);
  return value;
}

function parseBooleanEnv(name, fallback = false) {
  const value = readEnv(name);
  if (!value) return fallback;
  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;
  fail(`${name}_invalid_boolean`);
}

function parseNumberEnv(name, fallback) {
  const value = readEnv(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) fail(`${name}_invalid_number`);
  return parsed;
}

function parseJsonEnv(name) {
  const value = readEnv(name);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    fail(`${name}_invalid_json`);
  }
}

function assertLabelSafe(name, value, { requireTestPrefix = false } = {}) {
  if (!value) fail(`${name}_required`);
  if (labelValue(value) !== value) fail(`${name}_must_be_lowercase_label_safe`);
  if (requireTestPrefix && !value.startsWith("test-")) fail(`${name}_must_start_with_test-`);
  return value;
}

function parseObjectField(value, fieldName) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      fail(`${fieldName}_invalid_json`);
    }
  }
  if (typeof value === "object") return value;
  fail(`${fieldName}_invalid_type`);
}

function shellQuote(value) {
  return `'${String(value || "").replace(/'/g, `'\\''`)}'`;
}

function expectedTagSet(context) {
  return {
    tenantid: cloudTagValue(context.tenantId),
    workspaceid: cloudTagValue(context.workspaceId),
    runid: cloudTagValue(context.runId),
    serverplanid: cloudTagValue(context.serverPlanId),
    resourceorderid: cloudTagValue(context.resourceOrderId),
  };
}

function expectedLabelSet(context) {
  return {
    "gaofenglab/tenant-id": labelValue(context.tenantId),
    "gaofenglab/workspace-id": labelValue(context.workspaceId),
    "gaofenglab/run-id": labelValue(context.runId),
    "gaofenglab/server-plan-id": labelValue(context.serverPlanId),
    "gaofenglab/resource-order-id": labelValue(context.resourceOrderId),
  };
}

function summarizeNodePool(item = {}) {
  return {
    nodePoolId: item.nodePoolId || "",
    name: item.name || "",
    status: item.status || "",
    clusterId: item.clusterId || "",
    desiredCapacity: item.desiredCapacity ?? null,
    minNodes: item.minNodes ?? null,
    maxNodes: item.maxNodes ?? null,
    tagCompleteness: item.tagCompleteness ?? 0,
    labelCompleteness: item.labelCompleteness ?? 0,
    tagMap: item.tagMap || {},
    labelMap: item.labelMap || {},
  };
}

function summarizeInstance(item = {}) {
  return {
    instanceId: item.instanceId || "",
    instanceName: item.instanceName || "",
    instanceType: item.instanceType || "",
    status: item.status || "",
    clusterStatus: item.clusterStatus || "",
    clusterId: item.clusterId || "",
    nodePoolId: item.nodePoolId || "",
    nodePoolName: item.nodePoolName || "",
    privateIp: item.privateIp || "",
    publicIp: item.publicIp || "",
    tagCompleteness: item.tagCompleteness ?? 0,
    tagMap: item.tagMap || {},
  };
}

function summarizeSnapshot(snapshot = {}) {
  return {
    observedAt: snapshot.observedAt || new Date().toISOString(),
    totalNodePoolsScanned: Array.isArray(snapshot.nodePools) ? snapshot.nodePools.length : 0,
    totalInstancesScanned: Array.isArray(snapshot.instances) ? snapshot.instances.length : 0,
    matchedNodePools: Array.isArray(snapshot.matchedNodePools) ? snapshot.matchedNodePools.map(summarizeNodePool) : [],
    matchedInstances: Array.isArray(snapshot.matchedInstances) ? snapshot.matchedInstances.map(summarizeInstance) : [],
  };
}

function summarizeKubectlItem(item = {}) {
  return {
    kind: String(item.kind || "").trim(),
    namespace: String(item.metadata?.namespace || "").trim(),
    name: String(item.metadata?.name || "").trim(),
    phase: String(item.status?.phase || item.status?.conditions?.[0]?.type || "").trim(),
    labels: item.metadata?.labels || {},
  };
}

function serializeError(error) {
  const base = error?.code || error?.status ? sanitizeTencentError(error) : {
    message: String(error?.message || error || "unknown_error"),
    code: String(error?.code || "").trim(),
    status: Number(error?.status || 0) || undefined,
  };
  if (error?.details) base.details = error.details;
  if (error?.snapshot) base.snapshot = summarizeSnapshot(error.snapshot);
  if (error?.cleanupResult) base.cleanupResult = error.cleanupResult;
  return base;
}

function metadataMismatches(actual = {}, expected = {}) {
  return Object.entries(expected)
    .filter(([, value]) => value)
    .filter(([key, value]) => String(actual[key] || "") !== String(value))
    .map(([key, value]) => ({ key, expected: value, actual: String(actual[key] || "") }));
}

function verifyProvisioningMetadata(payload, expectedTags, expectedLabels, clusterId) {
  const payloadTagMap = Object.fromEntries(
    (Array.isArray(payload.Tags) ? payload.Tags : [])
      .map((item) => [String(item.Key || "").trim(), String(item.Value || "").trim()])
      .filter(([key]) => key),
  );
  const payloadLabelMap = Object.fromEntries(
    (Array.isArray(payload.Labels) ? payload.Labels : [])
      .map((item) => [String(item.Name || "").trim(), String(item.Value || "").trim()])
      .filter(([key]) => key),
  );
  const tagMismatch = metadataMismatches(payloadTagMap, expectedTags);
  if (tagMismatch.length) fail("preview_payload_tags_mismatch", { details: { tagMismatch, payloadTagMap, expectedTags } });
  const labelMismatch = metadataMismatches(payloadLabelMap, expectedLabels);
  if (labelMismatch.length) fail("preview_payload_labels_mismatch", { details: { labelMismatch, payloadLabelMap, expectedLabels } });
  if (String(payload.ClusterId || "").trim() !== clusterId) {
    fail("preview_payload_cluster_id_mismatch", {
      details: { expectedClusterId: clusterId, actualClusterId: String(payload.ClusterId || "").trim() },
    });
  }
}

function verifyNodePool(nodePool, expectedTags, expectedLabels, nodePoolId) {
  if (!nodePool) fail("target_node_pool_not_found");
  if (nodePoolId && nodePool.nodePoolId !== nodePoolId) fail("target_node_pool_id_mismatch", {
    details: { expectedNodePoolId: nodePoolId, actualNodePoolId: nodePool.nodePoolId || "" },
  });
  const tagMismatch = metadataMismatches(nodePool.tagMap || {}, expectedTags);
  if (tagMismatch.length) fail("target_node_pool_tags_mismatch", { details: { tagMismatch, nodePool: summarizeNodePool(nodePool) } });
  const labelMismatch = metadataMismatches(nodePool.labelMap || {}, expectedLabels);
  if (labelMismatch.length) fail("target_node_pool_labels_mismatch", { details: { labelMismatch, nodePool: summarizeNodePool(nodePool) } });
}

function verifyInstances(instances, expectedTags) {
  for (const instance of instances) {
    const tagMismatch = metadataMismatches(instance.tagMap || {}, expectedTags);
    if (tagMismatch.length) {
      fail("target_instance_tags_mismatch", { details: { tagMismatch, instance: summarizeInstance(instance) } });
    }
  }
}

function buildKubeSelector(context) {
  return [
    `gaofenglab/tenant-id=${labelValue(context.tenantId)}`,
    `gaofenglab/workspace-id=${labelValue(context.workspaceId)}`,
    `gaofenglab/run-id=${labelValue(context.runId)}`,
    `gaofenglab/resource-order-id=${labelValue(context.resourceOrderId)}`,
  ].join(",");
}

function buildScaleTriggerName(context) {
  return `v19-scale-${labelValue(context.resourceOrderId).slice(0, 42)}`.replace(/-+$/g, "");
}

function buildContext() {
  const tenantId = assertLabelSafe("TKE_LIVE_TENANT_ID", requiredEnv("TKE_LIVE_TENANT_ID"), { requireTestPrefix: true });
  const workspaceId = assertLabelSafe("TKE_LIVE_WORKSPACE_ID", requiredEnv("TKE_LIVE_WORKSPACE_ID"), { requireTestPrefix: true });
  const resourceOrderId = assertLabelSafe("TKE_LIVE_RESOURCE_ORDER_ID", requiredEnv("TKE_LIVE_RESOURCE_ORDER_ID"), { requireTestPrefix: true });
  const runId = assertLabelSafe("TKE_LIVE_RUN_ID", requiredEnv("TKE_LIVE_RUN_ID"), { requireTestPrefix: true });
  const serverPlanId = assertLabelSafe("TKE_LIVE_SERVER_PLAN_ID", requiredEnv("TKE_LIVE_SERVER_PLAN_ID"));
  return { tenantId, workspaceId, resourceOrderId, runId, serverPlanId };
}

function buildExecution(context) {
  const cleanupOnly = parseBooleanEnv("TKE_LIVE_CLEANUP_ONLY", false);
  const clusterId = readEnv("TKE_LIVE_CLUSTER_ID", TENCENT_TKE_CLUSTER_ID);
  const region = readEnv("TKE_LIVE_REGION", TENCENT_CLOUD_REGION);
  const zone = readEnv("TKE_LIVE_ZONE", TENCENT_TKE_ZONE);
  const kubectlBinary = readEnv("TKE_LIVE_KUBECTL_BIN", "kubectl");
  const createPayloadOverride = parseJsonEnv("TKE_LIVE_NODE_POOL_CREATE_PAYLOAD_JSON");
  const instanceType = cleanupOnly || createPayloadOverride ? "" : requiredEnv("TKE_LIVE_INSTANCE_TYPE");
  const expectedTags = expectedTagSet(context);
  const expectedLabels = expectedLabelSet(context);
  const kubeconfigPath = readEnv("TKE_LIVE_KUBECONFIG", readEnv("KUBECONFIG"));
  const kubeServerOverride = readEnv("TKE_LIVE_KUBE_SERVER_OVERRIDE");
  const requireKubectl = parseBooleanEnv("TKE_LIVE_REQUIRE_KUBECTL", true);
  const requestedNodePoolIdRaw = readEnv("TKE_LIVE_NODE_POOL_ID");
  const requestedNodePoolId = requestedNodePoolIdRaw ? assertLabelSafe("TKE_LIVE_NODE_POOL_ID", requestedNodePoolIdRaw) : "";
  const scaleTriggerEnabled = parseBooleanEnv("TKE_LIVE_CREATE_SCALE_TRIGGER", false);

  const serverPlan = {
    id: context.serverPlanId,
    provisioningMode: "tke_node_pool_create",
    clusterId,
    zone,
  };
  const nodePoolName = readEnv("TKE_LIVE_NODE_POOL_NAME");
  if (nodePoolName) serverPlan.nodePoolName = nodePoolName;
  const maxNodes = readEnv("TKE_LIVE_MAX_NODES");
  if (maxNodes) serverPlan.maxNodes = parseNumberEnv("TKE_LIVE_MAX_NODES", 0);
  const imageId = readEnv("TKE_LIVE_IMAGE_ID");
  if (imageId) serverPlan.imageId = imageId;
  if (createPayloadOverride) {
    serverPlan.nodePoolCreatePayload = createPayloadOverride;
  } else {
    serverPlan.instanceType = instanceType;
  }

  const provisionInput = {
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    resourceOrderId: context.resourceOrderId,
    runId: context.runId,
    serverPlanId: context.serverPlanId,
    region,
    provisioningMode: "tke_node_pool_create",
    serverPlan,
  };
  const previewPayload = cleanupOnly ? null : previewCreateNodePoolPayload(provisionInput);
  const autoScaling = cleanupOnly ? {} : parseObjectField(previewPayload.AutoScalingGroupPara, "preview_auto_scaling_group_para");
  const expectedMinimumInstances = Math.max(
    scaleTriggerEnabled ? 1 : 0,
    0,
    Number(autoScaling.DesiredCapacity || 0),
    Number(autoScaling.MinSize || 0),
  );
  return {
    cleanupOnly,
    clusterId,
    region,
    zone,
    provisionInput,
    previewPayload,
    expectedTags,
    expectedLabels,
    expectedMinimumInstances,
    kubectlBinary,
    kubeconfigPath,
    kubeServerOverride,
    requireKubectl,
    kubeSelector: buildKubeSelector(context),
    scaleTrigger: {
      enabled: scaleTriggerEnabled,
      namespace: readEnv("TKE_LIVE_SCALE_TRIGGER_NAMESPACE", "default"),
      name: readEnv("TKE_LIVE_SCALE_TRIGGER_NAME", buildScaleTriggerName(context)),
      image: readEnv("TKE_LIVE_SCALE_TRIGGER_IMAGE", "busybox:1.36"),
    },
    requestedNodePoolId,
    pollIntervalMs: parseNumberEnv("TKE_LIVE_POLL_INTERVAL_MS", 10_000),
    createTimeoutMs: parseNumberEnv("TKE_LIVE_CREATE_TIMEOUT_MS", 15 * 60 * 1000),
    instanceTimeoutMs: parseNumberEnv("TKE_LIVE_INSTANCE_TIMEOUT_MS", 15 * 60 * 1000),
    deleteTimeoutMs: parseNumberEnv("TKE_LIVE_DELETE_TIMEOUT_MS", 15 * 60 * 1000),
  };
}

async function captureTargetedState(context, execution, nodePoolId = "") {
  const [nodePools, instances] = await Promise.all([
    describeNodePools({ clusterId: execution.clusterId, region: execution.region }),
    describeClusterInstances({ clusterId: execution.clusterId, region: execution.region }),
  ]);
  const matchedNodePools = nodePools.filter((item) =>
    (nodePoolId && item.nodePoolId === nodePoolId) ||
    metadataMismatches(item.tagMap || {}, execution.expectedTags).length === 0 ||
    metadataMismatches(item.labelMap || {}, execution.expectedLabels).length === 0,
  );
  const matchedNodePoolIds = new Set(matchedNodePools.map((item) => item.nodePoolId).filter(Boolean));
  const matchedInstances = instances.filter((item) =>
    (nodePoolId && item.nodePoolId === nodePoolId) ||
    (item.nodePoolId && matchedNodePoolIds.has(item.nodePoolId)) ||
    metadataMismatches(item.tagMap || {}, execution.expectedTags).length === 0,
  );
  return {
    observedAt: new Date().toISOString(),
    context,
    nodePools,
    instances,
    matchedNodePools,
    matchedInstances,
  };
}

async function waitForSnapshot(label, capture, predicate, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = await capture();
  if (predicate(lastSnapshot)) return lastSnapshot;
  while (Date.now() < deadline) {
    await delay(intervalMs);
    lastSnapshot = await capture();
    if (predicate(lastSnapshot)) return lastSnapshot;
  }
  fail(`${label}_timeout`, { snapshot: lastSnapshot });
}

async function collectKubectlResources(context, execution, stage) {
  if (!execution.requireKubectl && !execution.kubeconfigPath) {
    return {
      available: false,
      required: false,
      stage,
      reason: "kubectl_evidence_not_required",
      kubectlBinary: execution.kubectlBinary,
      selector: execution.kubeSelector,
      itemCount: 0,
      items: [],
    };
  }
  if (!execution.kubeconfigPath) fail("TKE_LIVE_KUBECONFIG_required");
  const args = [];
  args.push(`--kubeconfig=${execution.kubeconfigPath}`);
  if (execution.kubeServerOverride) args.push(`--server=${execution.kubeServerOverride}`);
  args.push("get", "pods,jobs,pvc", "--all-namespaces", "-l", execution.kubeSelector, "-o", "json");
  try {
    const { stdout } = await execFileAsync(execution.kubectlBinary, args, {
      env: { ...process.env, KUBECONFIG: execution.kubeconfigPath },
      maxBuffer: 32 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout || "{}");
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      available: true,
      required: execution.requireKubectl,
      stage,
      kubectlBinary: execution.kubectlBinary,
      kubeconfigPath: execution.kubeconfigPath,
      serverOverride: execution.kubeServerOverride || "",
      selector: execution.kubeSelector,
      itemCount: items.length,
      items: items.map(summarizeKubectlItem),
    };
  } catch (error) {
    fail(`kubectl_${stage}_failed`, {
      details: {
        kubectlBinary: execution.kubectlBinary,
        message: String(error?.message || error || "kubectl_failed"),
        stderr: String(error?.stderr || "").trim(),
      },
    });
  }
}

function kubectlBaseArgs(execution) {
  if (!execution.kubeconfigPath) fail("TKE_LIVE_KUBECONFIG_required");
  const args = [`--kubeconfig=${execution.kubeconfigPath}`];
  if (execution.kubeServerOverride) args.push(`--server=${execution.kubeServerOverride}`);
  return args;
}

async function runKubectl(execution, args, label) {
  try {
    const { stdout, stderr } = await execFileAsync(execution.kubectlBinary, [...kubectlBaseArgs(execution), ...args], {
      env: { ...process.env, KUBECONFIG: execution.kubeconfigPath },
      maxBuffer: 32 * 1024 * 1024,
    });
    return {
      ok: true,
      label,
      stdout: String(stdout || "").trim(),
      stderr: String(stderr || "").trim(),
    };
  } catch (error) {
    fail(`kubectl_${label}_failed`, {
      details: {
        kubectlBinary: execution.kubectlBinary,
        args,
        message: String(error?.message || error || "kubectl_failed"),
        stderr: String(error?.stderr || "").trim(),
      },
    });
  }
}

async function createScaleTriggerPod(context, execution) {
  if (!execution.scaleTrigger.enabled) return { enabled: false };
  if (!execution.kubeconfigPath) fail("TKE_LIVE_KUBECONFIG_required");
  const labels = expectedLabelSet(context);
  const labelArg = Object.entries(labels).map(([key, value]) => `${key}=${value}`).join(",");
  const overrides = {
    apiVersion: "v1",
    metadata: {
      labels,
    },
    spec: {
      nodeSelector: labels,
      restartPolicy: "Never",
      terminationGracePeriodSeconds: 0,
      containers: [{
        name: "scale-trigger",
        image: execution.scaleTrigger.image,
        command: ["/bin/sh", "-c", "sleep 3600"],
        resources: {
          requests: {
            cpu: "100m",
            memory: "128Mi",
          },
        },
      }],
    },
  };
  const result = await runKubectl(execution, [
    "run",
    execution.scaleTrigger.name,
    "-n",
    execution.scaleTrigger.namespace,
    `--image=${execution.scaleTrigger.image}`,
    "--restart=Never",
    "--labels",
    labelArg,
    "--overrides",
    JSON.stringify(overrides),
  ], "create_scale_trigger");
  return {
    enabled: true,
    namespace: execution.scaleTrigger.namespace,
    name: execution.scaleTrigger.name,
    image: execution.scaleTrigger.image,
    selector: execution.kubeSelector,
    nodeSelector: labels,
    result,
  };
}

async function deleteScaleTriggerPods(context, execution) {
  if (!execution.scaleTrigger.enabled) return { enabled: false };
  if (!execution.kubeconfigPath) fail("TKE_LIVE_KUBECONFIG_required");
  const result = await runKubectl(execution, [
    "delete",
    "pods",
    "-n",
    execution.scaleTrigger.namespace,
    "-l",
    execution.kubeSelector,
    "--ignore-not-found=true",
    "--wait=false",
  ], "delete_scale_trigger");
  return {
    enabled: true,
    selector: execution.kubeSelector,
    result,
  };
}

function buildCleanupCommand(context, execution, nodePoolId = "") {
  const envs = [
    "RUN_TKE_LIVE=1",
    "RESOURCE_PROVISIONING_ENABLED=1",
    "TKE_LIVE_CLEANUP_ONLY=1",
    `TKE_LIVE_TENANT_ID=${shellQuote(context.tenantId)}`,
    `TKE_LIVE_WORKSPACE_ID=${shellQuote(context.workspaceId)}`,
    `TKE_LIVE_RESOURCE_ORDER_ID=${shellQuote(context.resourceOrderId)}`,
    `TKE_LIVE_RUN_ID=${shellQuote(context.runId)}`,
    `TKE_LIVE_SERVER_PLAN_ID=${shellQuote(context.serverPlanId)}`,
    `TKE_LIVE_CLUSTER_ID=${shellQuote(execution.clusterId)}`,
    `TKE_LIVE_REGION=${shellQuote(execution.region)}`,
    `TKE_LIVE_ZONE=${shellQuote(execution.zone)}`,
  ];
  if (nodePoolId) envs.push(`TKE_LIVE_NODE_POOL_ID=${shellQuote(nodePoolId)}`);
  if (execution.kubectlBinary) envs.push(`TKE_LIVE_KUBECTL_BIN=${shellQuote(execution.kubectlBinary)}`);
  if (execution.kubeconfigPath) envs.push(`TKE_LIVE_KUBECONFIG=${shellQuote(execution.kubeconfigPath)}`);
  if (execution.kubeServerOverride) envs.push(`TKE_LIVE_KUBE_SERVER_OVERRIDE=${shellQuote(execution.kubeServerOverride)}`);
  if (execution.scaleTrigger.enabled) envs.push("TKE_LIVE_CREATE_SCALE_TRIGGER=1");
  return `${envs.join(" ")} node scripts/live-test-v19-tke-create-delete-cleanup.mjs`;
}

async function performCleanup(context, execution, requestedNodePoolId = "") {
  const result = {
    startedAt: new Date().toISOString(),
    requestedNodePoolId,
    resolvedNodePoolId: "",
    beforeCleanup: null,
    afterScaleToZero: null,
    finalState: null,
    kubernetesAfterDelete: null,
    scaleToZero: null,
    scaleToZeroError: null,
    scaleToZeroWaitError: null,
    deleteNodePool: null,
    scaleTriggerDelete: null,
    scaleTriggerDeleteError: null,
    cleanupCommand: "",
  };

  try {
    const beforeCleanup = await captureTargetedState(context, execution, requestedNodePoolId);
    result.beforeCleanup = summarizeSnapshot(beforeCleanup);
    const requestedNodePool = requestedNodePoolId
      ? beforeCleanup.matchedNodePools.find((item) => item.nodePoolId === requestedNodePoolId)
      : null;
    const resolvedNodePoolId = requestedNodePool?.nodePoolId || beforeCleanup.matchedNodePools[0]?.nodePoolId || "";
    result.resolvedNodePoolId = resolvedNodePoolId;
    result.cleanupCommand = buildCleanupCommand(context, execution, resolvedNodePoolId);

    if (!resolvedNodePoolId) {
      result.finalState = result.beforeCleanup;
      try {
        result.scaleTriggerDelete = await deleteScaleTriggerPods(context, execution);
      } catch (error) {
        result.scaleTriggerDeleteError = serializeError(error);
      }
      result.kubernetesAfterDelete = await collectKubectlResources(context, execution, "after-delete");
      if (result.beforeCleanup.matchedInstances.length > 0) fail("cleanup_node_pool_id_unresolved", { cleanupResult: result });
      if (result.kubernetesAfterDelete.itemCount > 0) fail("post_delete_kubernetes_resources_remain", { cleanupResult: result });
      return result;
    }

    try {
      result.scaleTriggerDelete = await deleteScaleTriggerPods(context, execution);
    } catch (error) {
      result.scaleTriggerDeleteError = serializeError(error);
    }

    try {
      result.scaleToZero = await scaleToZero({
        clusterId: execution.clusterId,
        nodePoolId: resolvedNodePoolId,
        resourceOrderId: context.resourceOrderId,
      });
    } catch (error) {
      result.scaleToZeroError = serializeError(error);
    }

    try {
      const scaledSnapshot = await waitForSnapshot(
        "scale_to_zero_instances",
        () => captureTargetedState(context, execution, resolvedNodePoolId),
        (snapshot) => snapshot.matchedInstances.length === 0,
        execution.deleteTimeoutMs,
        execution.pollIntervalMs,
      );
      result.afterScaleToZero = summarizeSnapshot(scaledSnapshot);
    } catch (error) {
      result.scaleToZeroWaitError = serializeError(error);
      result.afterScaleToZero = summarizeSnapshot(error.snapshot);
    }

    result.deleteNodePool = await deleteNodePool({
      clusterId: execution.clusterId,
      nodePoolId: resolvedNodePoolId,
      resourceOrderId: context.resourceOrderId,
      destroyCvmInstances: true,
      confirmation: "delete-node-pool",
    });

    const finalSnapshot = await waitForSnapshot(
      "delete_node_pool_cleanup",
      () => captureTargetedState(context, execution, resolvedNodePoolId),
      (snapshot) => snapshot.matchedNodePools.length === 0 && snapshot.matchedInstances.length === 0,
      execution.deleteTimeoutMs,
      execution.pollIntervalMs,
    );
    result.finalState = summarizeSnapshot(finalSnapshot);
    result.kubernetesAfterDelete = await collectKubectlResources(context, execution, "after-delete");
    if (result.kubernetesAfterDelete.itemCount > 0) fail("post_delete_kubernetes_resources_remain", { cleanupResult: result });
    return result;
  } catch (error) {
    if (!error.cleanupResult) error.cleanupResult = result;
    throw error;
  }
}

async function writeEvidenceFile(evidence) {
  await mkdir(evidenceDir, { recursive: true });
  const file = path.join(evidenceDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return file;
}

async function main() {
  if (readEnv("RUN_TKE_LIVE") !== "1") fail("RUN_TKE_LIVE_must_equal_1");
  if (!PROVISIONING_ENABLED) fail("RESOURCE_PROVISIONING_ENABLED_must_equal_1");
  if (!tencentCloudConfigured()) fail("tencent_cloud_credentials_not_configured");

  const context = buildContext();
  const execution = buildExecution(context);
  const evidence = {
    ok: false,
    startedAt: new Date().toISOString(),
    mode: execution.cleanupOnly ? "cleanup_only" : "create_delete_cleanup",
    cluster: {
      clusterId: execution.clusterId,
      region: execution.region,
      zone: execution.zone,
      tkeEndpoint: TENCENT_TKE_ENDPOINT,
    },
    context,
    expectedTags: execution.expectedTags,
    expectedLabels: execution.expectedLabels,
    expectedMinimumInstances: execution.expectedMinimumInstances,
    kubeconfig: {
      required: execution.requireKubectl,
      kubectlBinary: execution.kubectlBinary,
      path: execution.kubeconfigPath || "",
      serverOverride: execution.kubeServerOverride || "",
      selector: execution.kubeSelector,
    },
    previewPayload: execution.previewPayload || null,
    preflight: null,
    create: null,
    cleanup: null,
    error: null,
    cleanupCommand: "",
  };

  let nodePoolId = execution.requestedNodePoolId || "";
  let terminalError = null;

  try {
    if (!execution.cleanupOnly) {
      verifyProvisioningMetadata(execution.previewPayload, execution.expectedTags, execution.expectedLabels, execution.clusterId);
      const beforeCreate = await captureTargetedState(context, execution);
      const beforeCreateSummary = summarizeSnapshot(beforeCreate);
      const kubernetesBeforeCreate = await collectKubectlResources(context, execution, "before-create");
      evidence.preflight = {
        beforeCreate: beforeCreateSummary,
        kubernetesBeforeCreate,
      };
      if (beforeCreateSummary.matchedNodePools.length || beforeCreateSummary.matchedInstances.length) {
        fail("preexisting_targeted_cloud_resources_detected", { details: beforeCreateSummary });
      }
      if (kubernetesBeforeCreate.itemCount > 0) {
        fail("preexisting_targeted_kubernetes_resources_detected", { details: kubernetesBeforeCreate });
      }

      const createResult = await ensureCapacity(execution.provisionInput);
      if (createResult.reused) fail("live_tke_run_reused_existing_order", { details: createResult.order || {} });
      nodePoolId = String(createResult.order?.nodePoolId || "").trim();
      if (!nodePoolId) fail("create_response_missing_node_pool_id", { details: createResult.order || {} });

      const nodePoolSnapshot = await waitForSnapshot(
        "create_node_pool",
        () => captureTargetedState(context, execution, nodePoolId),
        (snapshot) => snapshot.matchedNodePools.some((item) => item.nodePoolId === nodePoolId),
        execution.createTimeoutMs,
        execution.pollIntervalMs,
      );
      const nodePool = nodePoolSnapshot.matchedNodePools.find((item) => item.nodePoolId === nodePoolId) || nodePoolSnapshot.matchedNodePools[0];
      verifyNodePool(nodePool, execution.expectedTags, execution.expectedLabels, nodePoolId);

      const scaleTrigger = await createScaleTriggerPod(context, execution);
      evidence.create = {
        request: {
          order: {
            id: String(createResult.order?.id || "").trim(),
            requestId: String(createResult.order?.requestId || "").trim(),
            nodePoolId,
            status: String(createResult.order?.status || "").trim(),
            resourceOrderId: String(createResult.order?.resourceOrderId || "").trim(),
            runId: String(createResult.order?.runId || "").trim(),
          },
        },
        nodePool: summarizeNodePool(nodePool),
        nodePoolSnapshot: summarizeSnapshot(nodePoolSnapshot),
        scaleTrigger,
        instanceSnapshot: null,
        kubernetesAfterCreate: null,
      };

      let instanceSnapshot = nodePoolSnapshot;
      if (execution.expectedMinimumInstances > 0) {
        instanceSnapshot = await waitForSnapshot(
          "create_instances",
          () => captureTargetedState(context, execution, nodePoolId),
          (snapshot) => snapshot.matchedInstances.length >= execution.expectedMinimumInstances,
          execution.instanceTimeoutMs,
          execution.pollIntervalMs,
        );
      } else {
        instanceSnapshot = await captureTargetedState(context, execution, nodePoolId);
      }
      verifyInstances(instanceSnapshot.matchedInstances, execution.expectedTags);

      const kubernetesAfterCreate = await collectKubectlResources(context, execution, "after-create");
      evidence.create.instanceSnapshot = summarizeSnapshot(instanceSnapshot);
      evidence.create.kubernetesAfterCreate = kubernetesAfterCreate;
    }
  } catch (error) {
    terminalError = error;
    evidence.error = serializeError(error);
  }

  try {
    const cleanupResult = await performCleanup(context, execution, nodePoolId);
    evidence.cleanup = cleanupResult;
    evidence.cleanupCommand = cleanupResult.cleanupCommand;
  } catch (error) {
    terminalError = terminalError || error;
    evidence.cleanup = error.cleanupResult || evidence.cleanup;
    if (!evidence.error) evidence.error = serializeError(error);
    evidence.cleanupCommand = evidence.cleanup?.cleanupCommand || buildCleanupCommand(context, execution, nodePoolId);
  }

  evidence.finishedAt = new Date().toISOString();
  evidence.ok = terminalError === null;
  const evidenceFile = await writeEvidenceFile(evidence);

  const summary = {
    ok: evidence.ok,
    mode: evidence.mode,
    evidenceFile,
    nodePoolId: evidence.cleanup?.resolvedNodePoolId || nodePoolId || "",
    cleanupCommand: evidence.cleanupCommand,
    error: evidence.error,
  };

  if (!evidence.ok) {
    console.error(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
}

await main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: serializeError(error),
  }, null, 2));
  process.exit(1);
});
