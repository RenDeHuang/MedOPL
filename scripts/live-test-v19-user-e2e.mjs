import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  buildCosTargetFromFixture,
  buildKubeAttributionLabels,
  parseLiveE2eConfig,
  validateSameDayFixture,
} from "./lib/v19-live-e2e-contract.mjs";
import { runWithRequiredCleanup } from "./lib/v19-live-cleanup-guard.mjs";
import { liveCloudTagValue } from "./lib/v19-live-labels.mjs";

const execFileAsync = promisify(execFile);

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function redactEnv(env = {}) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => !/password|secret|token|authorization|cookie|key/i.test(key))
      .map(([key, value]) => [key, value]),
  );
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeEvidence(config, evidence) {
  await mkdir(config.outputDir, { recursive: true });
  const filePath = path.join(config.outputDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${config.phase}.json`);
  await writeFile(filePath, `${stableJson(evidence)}\n`, "utf8");
  return filePath;
}

async function runNodeScript(scriptPath, env, options = {}) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: options.timeoutMs || 30 * 60 * 1000,
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
  });
  return { stdout, stderr };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredConfig(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

function normalizeKubeconfigForKubectl(kubeconfig, kubectlBin) {
  const value = requiredConfig(kubeconfig, "V19_LIVE_E2E_KUBECONFIG");
  if (/\.exe$/i.test(String(kubectlBin || "")) && value.startsWith("/mnt/c/")) {
    return value.replace(/^\/mnt\/c\//, "C:\\").replace(/\//g, "\\");
  }
  return value;
}

function kubectlBaseArgs(config) {
  const kubeconfig = normalizeKubeconfigForKubectl(config.kubeconfig, config.kubectlBin);
  const args = [`--kubeconfig=${kubeconfig}`];
  if (config.kubeServerOverride) args.push(`--server=${config.kubeServerOverride}`);
  if (config.kubeInsecureSkipTlsVerify) args.push("--insecure-skip-tls-verify=true");
  return args;
}

async function runKubectlJson(config, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(config.kubectlBin, [...kubectlBaseArgs(config), ...args], {
    cwd: process.cwd(),
    env: { ...process.env, KUBECONFIG: normalizeKubeconfigForKubectl(config.kubeconfig, config.kubectlBin) },
    encoding: "utf8",
    timeout: options.timeoutMs || 120_000,
    maxBuffer: options.maxBuffer || 32 * 1024 * 1024,
  });
  if (options.allowText) return { stdout, stderr };
  try {
    return JSON.parse(stdout || "{}");
  } catch {
    throw new Error(`kubectl_json_parse_failed:${String(stdout || stderr || "").slice(0, 240)}`);
  }
}

async function execResourceProvisioner(config, requestPath, options = {}) {
  const deployment = requiredConfig(config.resourceProvisionerDeployment, "V19_LIVE_E2E_RESOURCE_PROVISIONER_DEPLOYMENT");
  const namespace = requiredConfig(config.resourceProvisionerNamespace, "V19_LIVE_E2E_RESOURCE_PROVISIONER_NAMESPACE");
  const args = [
    "exec",
    `deploy/${deployment}`,
    "-n",
    namespace,
    "--",
    "wget",
    "-qO-",
  ];
  if (options.postData) {
    args.push("--header=Content-Type: application/json", `--post-data=${JSON.stringify(options.postData)}`);
  }
  args.push(`http://127.0.0.1:18893${requestPath}`);
  return runKubectlJson(config, args, {
    timeoutMs: options.timeoutMs || 180_000,
    maxBuffer: options.maxBuffer || 32 * 1024 * 1024,
  });
}

function expectedCloudTags(target) {
  return {
    tenantid: liveCloudTagValue(target.tenantId),
    workspaceid: liveCloudTagValue(target.workspaceId),
    resourceorderid: liveCloudTagValue(target.resourceOrderId),
    runid: liveCloudTagValue(target.runId),
    serverplanid: liveCloudTagValue(target.serverPlanId),
  };
}

function tagMapFromList(tags = []) {
  const entries = [];
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    for (const [key, value] of Object.entries(tags)) {
      const normalizedKey = String(key || "").trim().toLowerCase();
      if (normalizedKey) entries.push([normalizedKey, String(value ?? "").trim()]);
    }
  } else {
    for (const tag of Array.isArray(tags) ? tags : []) {
      const key = String(tag.Key || tag.tagKey || "").trim().toLowerCase();
      const value = String(tag.Value || tag.tagValue || "").trim();
      if (key) entries.push([key, value]);
    }
  }
  return Object.fromEntries(entries);
}

function labelsMatch(actual = {}, expected = {}) {
  return Object.entries(expected).every(([key, value]) => String(actual[key] || "") === String(value || ""));
}

function cloudTagsMatch(item = {}, expected = {}) {
  const tagMap = item.tagMap || tagMapFromList(item.tags || item.Tags);
  return Object.entries(expected).every(([key, value]) => String(tagMap[key] || "") === String(value || ""));
}

function summarizeKubeItem(item = {}) {
  return {
    kind: String(item.kind || ""),
    namespace: String(item.metadata?.namespace || ""),
    name: String(item.metadata?.name || ""),
    phase: String(item.status?.phase || item.status?.conditions?.[0]?.type || ""),
    labels: item.metadata?.labels || {},
  };
}

function summarizeNodePool(item = {}) {
  return {
    nodePoolId: String(item.nodePoolId || item.id || ""),
    status: String(item.status || ""),
    clusterId: String(item.clusterId || ""),
    labels: item.labelMap || item.labels || [],
    tags: item.tagMap || item.tags || [],
  };
}

function summarizeInstance(item = {}) {
  return {
    instanceId: String(item.instanceId || item.id || ""),
    status: String(item.status || ""),
    nodePoolId: String(item.nodePoolId || ""),
    clusterId: String(item.clusterId || ""),
    tags: item.tagMap || item.tags || [],
  };
}

function uniqueStrings(...values) {
  const result = [];
  const seen = new Set();
  for (const value of values.flat(Infinity)) {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) continue;
    result.push(text);
    seen.add(text);
  }
  return result;
}

function billingServiceConfig(config) {
  return {
    deployment: String(process.env.V19_LIVE_E2E_BILLING_DEPLOYMENT || "billing-aggregator-opl").trim(),
    namespace: String(process.env.V19_LIVE_E2E_BILLING_NAMESPACE || config.resourceProvisionerNamespace || "default").trim(),
    port: String(process.env.V19_LIVE_E2E_BILLING_PORT || "3001").trim(),
    stabilityPollMs: Number(process.env.V19_LIVE_E2E_BILLING_STABILITY_POLL_MS || 20_000),
    stabilityTolerance: Number(process.env.V19_LIVE_E2E_BILLING_STABILITY_TOLERANCE || 0.000001),
  };
}

function summarizeBillingEnvelope(payload = {}, target) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const pendingItems = Array.isArray(payload.pending?.items) ? payload.pending.items : [];
  const allItems = [...items, ...pendingItems];
  const matchingItems = allItems.filter((item) => {
    const props = item.properties || {};
    return String(item.runId || item.name || props.run_id || "") === target.runId ||
      String(props.workspace_id || item.workspaceId || "") === target.workspaceId;
  });
  const uniqueItems = [];
  const seenItems = new Set();
  for (const item of matchingItems) {
    const props = item.properties || {};
    const key = [
      String(item.runId || item.name || props.run_id || ""),
      String(props.workspace_id || item.workspaceId || ""),
      String(item.start || item.createdAt || ""),
      String(item.end || item.completedAt || ""),
      String(item.totalCost || item.totals?.totalCost || ""),
    ].join("\u0000");
    if (seenItems.has(key)) continue;
    seenItems.add(key);
    uniqueItems.push(item);
  }
  const totalCost = Number(
    uniqueItems.reduce((sum, item) => sum + Number(item.totalCost || item.totals?.totalCost || 0), 0).toFixed(12),
  );
  const pendingTotal = Number(payload.pending?.totals?.totalCost || 0);
  const exactTotal = Number(payload.exact?.totals?.totalCost || 0);
  return {
    chargeBasis: String(payload.chargeBasis || ""),
    source: String(payload.source || ""),
    exactSource: String(payload.exact?.source || ""),
    pendingSource: String(payload.pending?.source || ""),
    exactTotal,
    pendingTotal,
    targetTotalCost: totalCost,
    targetItemCount: uniqueItems.length,
    targetItems: uniqueItems.map((item) => ({
      runId: String(item.runId || item.name || item.properties?.run_id || ""),
      workspaceId: String(item.workspaceId || item.properties?.workspace_id || ""),
      customerId: String(item.customerId || item.properties?.customer_id || ""),
      totalCost: Number(item.totalCost || item.totals?.totalCost || 0),
      cpuCost: Number(item.cpuCost || 0),
      gpuCost: Number(item.gpuCost || 0),
      pvCost: Number(item.pvCost || 0),
      pricingSource: String(item.pricingSource || item.properties?.pricing_source || ""),
      start: String(item.start || item.createdAt || ""),
      end: String(item.end || item.completedAt || ""),
    })),
  };
}

async function collectBillingEvidence(config, target) {
  const billing = billingServiceConfig(config);
  const namespace = requiredConfig(billing.namespace, "V19_LIVE_E2E_BILLING_NAMESPACE");
  const deployment = requiredConfig(billing.deployment, "V19_LIVE_E2E_BILLING_DEPLOYMENT");
  const query = new URLSearchParams({
    customer_id: target.tenantId,
    workspace_id: target.workspaceId,
    window: "7d",
  });
  const args = [
    "exec",
    `deploy/${deployment}`,
    "-n",
    namespace,
    "--",
    "wget",
    "-qO-",
    "--header=Accept: application/json",
    `http://127.0.0.1:${billing.port}/billing?${query.toString()}`,
  ];
  const payload = await runKubectlJson(config, args, {
    timeoutMs: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    observedAt: new Date().toISOString(),
    service: { deployment, namespace, port: billing.port },
    summary: summarizeBillingEnvelope(payload, target),
  };
}

function assertBillingPendingPositive(evidence) {
  const summary = evidence?.summary || {};
  if (summary.chargeBasis !== "pending") {
    throw new Error(`same_day_billing_not_pending:${stableJson(summary)}`);
  }
  if (summary.targetItemCount <= 0) {
    throw new Error(`same_day_billing_target_item_missing:${stableJson(summary)}`);
  }
  if (summary.targetTotalCost <= 0) {
    throw new Error(`same_day_billing_pending_cost_not_positive:${stableJson(summary)}`);
  }
  if (summary.exactTotal !== 0 || summary.exactSource !== "exact_unavailable") {
    throw new Error(`same_day_billing_exact_should_wait_for_t1:${stableJson(summary)}`);
  }
}

function assertBillingStoppedGrowing(afterCleanup, stableAfterCleanup) {
  const tolerance = billingServiceConfig({}).stabilityTolerance;
  const first = Number(afterCleanup?.summary?.targetTotalCost || 0);
  const second = Number(stableAfterCleanup?.summary?.targetTotalCost || 0);
  if (first <= 0 || second <= 0) {
    throw new Error(`same_day_billing_cleanup_cost_missing:${stableJson({ afterCleanup, stableAfterCleanup })}`);
  }
  if (second - first > tolerance) {
    throw new Error(`same_day_billing_cost_still_growing:${stableJson({ first, second, tolerance })}`);
  }
}

async function collectKubernetesAttribution(config, target) {
  const labels = buildKubeAttributionLabels(target);
  const selector = Object.entries(labels).map(([key, value]) => `${key}=${value}`).join(",");
  const parsed = await runKubectlJson(config, [
    "get",
    "jobs,pods,pvc",
    "--all-namespaces",
    "-l",
    selector,
    "-o",
    "json",
  ]);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return {
    selector,
    itemCount: items.length,
    items: items.map(summarizeKubeItem),
  };
}

async function collectProvisionerAttribution(config, target) {
  const [orders, resources] = await Promise.all([
    execResourceProvisioner(config, "/resource-orders"),
    execResourceProvisioner(config, "/cloud/resources", { timeoutMs: 240_000 }),
  ]);
  const expectedTags = expectedCloudTags(target);
  const orderMatches = (orders.items || []).filter((item) =>
    String(item.resourceOrderId || "") === target.resourceOrderId ||
    String(item.runId || "") === target.runId,
  );
  const nodePools = (resources.nodePools || []).filter((item) =>
    String(item.resourceOrderId || "") === target.resourceOrderId ||
    String(item.runId || "") === target.runId ||
    cloudTagsMatch(item, expectedTags),
  );
  const nodePoolIds = new Set(nodePools.map((item) => String(item.nodePoolId || item.id || "")).filter(Boolean));
  const instances = (resources.instances || []).filter((item) =>
    String(item.resourceOrderId || "") === target.resourceOrderId ||
    String(item.runId || "") === target.runId ||
    (item.nodePoolId && nodePoolIds.has(String(item.nodePoolId))) ||
    cloudTagsMatch(item, expectedTags),
  );
  return {
    expectedTags,
    resourceOrderCount: orderMatches.length,
    resourceOrders: orderMatches.map((item) => ({
      id: item.id,
      status: item.status,
      nodePoolId: item.nodePoolId || "",
      resourceOrderId: item.resourceOrderId || "",
      runId: item.runId || "",
      serverPlanId: item.serverPlanId || "",
    })),
    nodePools: nodePools.map(summarizeNodePool),
    instances: instances.map(summarizeInstance),
  };
}

async function collectResourceMappingEvidence(config, target) {
  const requestPath = `/resource-mappings?resourceOrderId=${encodeURIComponent(target.resourceOrderId)}`;
  const payload = await execResourceProvisioner(config, requestPath);
  return {
    observedAt: new Date().toISOString(),
    query: { resourceOrderId: target.resourceOrderId },
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}

function assertResourceMappingActive(evidence, target) {
  const mapping = evidence.items.find((item) =>
    String(item.resourceOrderId || "") === target.resourceOrderId &&
    String(item.runId || "") === target.runId
  );
  if (!mapping) {
    throw new Error(`same_day_resource_mapping_missing:${stableJson(evidence)}`);
  }
  if (!mapping.billingStartedAt || mapping.cleanupStatus !== "active") {
    throw new Error(`same_day_resource_mapping_not_active:${stableJson(mapping)}`);
  }
  return mapping;
}

function assertResourceMappingHasObservedResources(evidence, target) {
  const mapping = evidence.items.find((item) =>
    String(item.resourceOrderId || "") === target.resourceOrderId &&
    String(item.runId || "") === target.runId
  );
  if (!mapping) {
    throw new Error(`same_day_resource_mapping_missing_after_observe:${stableJson(evidence)}`);
  }
  const nodePoolIds = uniqueStrings(mapping.nodePoolIds, mapping.nodePoolId);
  if (nodePoolIds.length === 0) {
    throw new Error(`same_day_resource_mapping_missing_observed_node_pool:${stableJson(mapping)}`);
  }
  if (!Array.isArray(mapping.cvmInstanceIds) || mapping.cvmInstanceIds.length === 0) {
    throw new Error(`same_day_resource_mapping_missing_observed_cvm:${stableJson(mapping)}`);
  }
  if (!mapping.lastObservedAt) {
    throw new Error(`same_day_resource_mapping_missing_observed_at:${stableJson(mapping)}`);
  }
  return mapping;
}

function assertResourceMappingDeleted(evidence, target) {
  const mapping = evidence.items.find((item) =>
    String(item.resourceOrderId || "") === target.resourceOrderId &&
    String(item.runId || "") === target.runId
  );
  if (!mapping) {
    throw new Error(`same_day_resource_mapping_missing_after_cleanup:${stableJson(evidence)}`);
  }
  if (!mapping.billingStoppedAt || mapping.cleanupStatus !== "deleted") {
    throw new Error(`same_day_resource_mapping_not_deleted:${stableJson(mapping)}`);
  }
  const remaining = mapping.cleanupRemaining || {};
  const stillPresent = Object.entries(remaining).filter(([, value]) => Number(value || 0) !== 0);
  if (stillPresent.length) {
    throw new Error(`same_day_resource_mapping_cleanup_remaining:${stableJson(mapping)}`);
  }
  return mapping;
}

function observedResourcePayload(target, state) {
  const provisioner = state?.provisionerBeforeDelete || {};
  const kubernetes = state?.kubernetesBeforeDelete || {};
  const mapping = state?.resourceMappingBeforeDelete?.items?.find((item) =>
    String(item.resourceOrderId || "") === target.resourceOrderId &&
    String(item.runId || "") === target.runId
  ) || {};
  const nodePoolIds = uniqueStrings(
    provisioner.nodePools?.map((item) => item.nodePoolId || item.id),
    mapping.nodePoolIds,
    mapping.nodePoolId,
  );
  const nodeNames = uniqueStrings(
    provisioner.instances?.map((item) => item.privateIp || item.instanceName || item.instanceId),
    mapping.nodeNames,
  );
  return {
    resourceOrderId: target.resourceOrderId,
    runId: target.runId,
    nodePoolId: nodePoolIds[0] || mapping.nodePoolId || "",
    cloudResources: {
      clusterId: uniqueStrings(
        provisioner.nodePools?.map((item) => item.clusterId),
        provisioner.instances?.map((item) => item.clusterId),
        mapping.clusterId,
      )[0] || "",
      nodePoolIds,
      cvmInstanceIds: uniqueStrings(provisioner.instances?.map((item) => item.instanceId || item.id), mapping.cvmInstanceIds),
      nodeNames,
      podNames: uniqueStrings(kubernetes.items?.filter((item) => item.kind === "Pod").map((item) => item.name), mapping.podNames),
      jobNames: uniqueStrings(kubernetes.items?.filter((item) => item.kind === "Job").map((item) => item.name), mapping.jobNames),
      pvcNames: uniqueStrings(kubernetes.items?.filter((item) => item.kind === "PersistentVolumeClaim").map((item) => item.name), mapping.pvcNames),
      cosKeys: uniqueStrings(mapping.cosKeys, target.fixture?.prepared?.storageKeys),
      ledgerIds: uniqueStrings(mapping.ledgerIds),
    },
    observedAt: new Date().toISOString(),
  };
}

async function observeResourceMappingResources(config, target, state) {
  return execResourceProvisioner(config, "/resource-mappings/observe-resources", {
    postData: observedResourcePayload(target, state),
    timeoutMs: 120_000,
  });
}

async function markResourceMappingDeleted(config, target, finalState) {
  const remaining = {
    nodePools: Number(finalState?.provisioner?.nodePools?.length || 0),
    instances: Number(finalState?.provisioner?.instances?.length || 0),
    pods: Number(finalState?.kubernetes?.items?.filter((item) => item.kind === "Pod").length || 0),
    jobs: Number(finalState?.kubernetes?.items?.filter((item) => item.kind === "Job").length || 0),
    pvcs: Number(finalState?.kubernetes?.items?.filter((item) => item.kind === "PersistentVolumeClaim").length || 0),
    cosKeys: 0,
  };
  return execResourceProvisioner(config, "/resource-mappings/mark-cleanup", {
    postData: {
      resourceOrderId: target.resourceOrderId,
      runId: target.runId,
      status: "deleted",
      cleanupEvidenceId: `same-day-${target.resourceOrderId}`,
      billingStoppedAt: new Date().toISOString(),
      cleanupRemaining: remaining,
    },
    timeoutMs: 120_000,
  });
}

async function deleteKubernetesAttribution(config, target) {
  const labels = buildKubeAttributionLabels(target);
  const selector = Object.entries(labels).map(([key, value]) => `${key}=${value}`).join(",");
  const jobs = await runKubectlJson(config, [
    "get",
    "jobs",
    "--all-namespaces",
    "-l",
    selector,
    "-o",
    "json",
  ]);
  const deleted = [];
  for (const item of Array.isArray(jobs.items) ? jobs.items : []) {
    const namespace = String(item.metadata?.namespace || "default");
    const name = String(item.metadata?.name || "");
    if (!name) continue;
    const result = await runKubectlJson(config, [
      "delete",
      "job",
      name,
      "-n",
      namespace,
      "--ignore-not-found=true",
      "--wait=false",
    ], { allowText: true });
    deleted.push({ namespace, name, stdout: result.stdout });
  }
  return { selector, deleted };
}

async function waitForResourceProvisionerCleanup(config, target) {
  const timeoutMs = Number(process.env.V19_LIVE_E2E_TKE_CLEANUP_TIMEOUT_MS || 15 * 60 * 1000);
  const pollMs = Number(process.env.V19_LIVE_E2E_TKE_CLEANUP_POLL_MS || 20_000);
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() <= deadline) {
    const [kubernetes, provisioner] = await Promise.all([
      collectKubernetesAttribution(config, target),
      collectProvisionerAttribution(config, target),
    ]);
    last = { kubernetes, provisioner };
    if (kubernetes.itemCount === 0 && provisioner.nodePools.length === 0 && provisioner.instances.length === 0) {
      return last;
    }
    await sleep(pollMs);
  }
  const error = new Error("resource_provisioner_cleanup_timeout");
  error.lastState = last;
  throw error;
}

async function prepareFixture(config) {
  const env = {
    RUN_PORTAL_RECOVERY_LIVE: "1",
    PORTAL_RECOVERY_START_OPL_RUN: "1",
    PORTAL_RECOVERY_PREPARE_TRACE: process.env.PORTAL_RECOVERY_PREPARE_TRACE || "0",
  };
  const result = await runNodeScript("scripts/live-prepare-v19-portal-recovery-fixture.mjs", env, {
    timeoutMs: Number(process.env.V19_LIVE_E2E_PREPARE_TIMEOUT_MS || 30 * 60 * 1000),
  });
  const payload = JSON.parse(result.stdout || "{}");
  if (!payload?.ok || !payload.fixtureFile) {
    throw new Error(`fixture_prepare_failed:${result.stderr || result.stdout}`);
  }
  return { payload, stderr: result.stderr };
}

async function runRecoveryBaseline(config, fixtureFile) {
  return runNodeScript("scripts/live-test-v19-postgres-redis-restart-recovery.mjs", {
    RUN_PORTAL_RECOVERY_LIVE: "1",
    PORTAL_RECOVERY_FIXTURE_FILE: fixtureFile,
    PORTAL_RECOVERY_EXPECT_POST_RESTART: "0",
    PORTAL_RECOVERY_KUBECONFIG: config.kubeconfig,
    PORTAL_RECOVERY_KUBE_SERVER_OVERRIDE: config.kubeServerOverride,
  }, {
    timeoutMs: Number(process.env.V19_LIVE_E2E_RECOVERY_TIMEOUT_MS || 10 * 60 * 1000),
  });
}

async function runResourceProvisionerTkeGate(config, target) {
  if (config.tkeGateMode !== "resource_provisioner_via_kubectl") {
    throw new Error(`unsupported_tke_gate_mode:${config.tkeGateMode}`);
  }
  const guarded = await runWithRequiredCleanup({
    collect: () => collectSameDayTkeState(config, target),
    validate: (state) => validateSameDayTkeState(state, target),
	    cleanup: async (state) => {
	      const observeResources = await observeResourceMappingResources(config, target, state);
	      const resourceMappingAfterObserve = await collectResourceMappingEvidence(config, target);
	      assertResourceMappingHasObservedResources(resourceMappingAfterObserve, target);
	      const cleanupResult = await cleanupSameDayTkeState(config, target, state);
	      return { observeResources, resourceMappingAfterObserve, ...cleanupResult };
	    },
	    runAfterCleanup: async () => {
	      const finalState = await waitForResourceProvisionerCleanup(config, target);
	      const markCleanup = await markResourceMappingDeleted(config, target, finalState);
	      const resourceMappingAfterCleanup = await collectResourceMappingEvidence(config, target);
	      assertResourceMappingDeleted(resourceMappingAfterCleanup, target);
	      const billingAfterCleanup = await collectBillingEvidence(config, target);
	      await sleep(billingServiceConfig(config).stabilityPollMs);
	      const billingStableAfterCleanup = await collectBillingEvidence(config, target);
	      assertBillingStoppedGrowing(billingAfterCleanup, billingStableAfterCleanup);
	      return { finalState, markCleanup, resourceMappingAfterCleanup, billingAfterCleanup, billingStableAfterCleanup };
	    },
	  });
	  const { observeResources, resourceMappingAfterObserve, kubernetesDelete, deleteNodePools } = guarded.cleanupResult;
	  const { finalState, markCleanup, resourceMappingAfterCleanup, billingAfterCleanup, billingStableAfterCleanup } = guarded.afterCleanupResult;
	  return {
	    stdout: {
	      ok: true,
	      mode: config.tkeGateMode,
	      kubernetesBeforeDelete: guarded.state.kubernetesBeforeDelete,
	      provisionerBeforeDelete: guarded.state.provisionerBeforeDelete,
	      billingBeforeDelete: guarded.state.billingBeforeDelete,
	      resourceMappingBeforeDelete: guarded.state.resourceMappingBeforeDelete,
	      observeResources,
	      resourceMappingAfterObserve,
	      kubernetesDelete,
	      deleteNodePools,
	      finalState,
	      markCleanup,
	      resourceMappingAfterCleanup,
	      billingAfterCleanup,
	      billingStableAfterCleanup,
	    },
  };
}

async function collectSameDayTkeState(config, target) {
  const [kubernetesBeforeDelete, provisionerBeforeDelete, billingBeforeDelete, resourceMappingBeforeDelete] = await Promise.all([
    collectKubernetesAttribution(config, target),
    collectProvisionerAttribution(config, target),
    collectBillingEvidence(config, target),
    collectResourceMappingEvidence(config, target),
  ]);
  return { kubernetesBeforeDelete, provisionerBeforeDelete, billingBeforeDelete, resourceMappingBeforeDelete };
}

function validateSameDayTkeState(state, target) {
  const { kubernetesBeforeDelete, provisionerBeforeDelete, billingBeforeDelete, resourceMappingBeforeDelete } = state;
  assertBillingPendingPositive(billingBeforeDelete);
  assertResourceMappingActive(resourceMappingBeforeDelete, target);
  if (kubernetesBeforeDelete.itemCount === 0) {
    throw new Error("same_day_tke_gate_missing_kubernetes_attribution");
  }
  if (provisionerBeforeDelete.nodePools.length === 0) {
    throw new Error("same_day_tke_gate_missing_node_pool_attribution");
  }
  if (provisionerBeforeDelete.instances.length === 0) {
    throw new Error("same_day_tke_gate_missing_cvm_attribution");
  }
  const labelExpected = buildKubeAttributionLabels(target);
  const labelFailures = kubernetesBeforeDelete.items
    .filter((item) => !labelsMatch(item.labels || {}, labelExpected));
  if (labelFailures.length) {
    throw new Error(`same_day_tke_gate_kubernetes_label_mismatch:${stableJson(labelFailures)}`);
  }
  const tagExpected = expectedCloudTags(target);
  const nodePoolTagFailures = provisionerBeforeDelete.nodePools
    .filter((item) => !cloudTagsMatch(item, tagExpected));
  const instanceTagFailures = provisionerBeforeDelete.instances
    .filter((item) => !cloudTagsMatch(item, tagExpected));
  if (nodePoolTagFailures.length || instanceTagFailures.length) {
    throw new Error(`same_day_tke_gate_cloud_tag_mismatch:${stableJson({ nodePoolTagFailures, instanceTagFailures })}`);
  }
  return { ok: true };
}

async function cleanupSameDayTkeState(config, target, state) {
  const kubernetesDelete = await deleteKubernetesAttribution(config, target);
  const deleteNodePools = [];
  for (const item of state.provisionerBeforeDelete.nodePools) {
    const nodePoolId = String(item.nodePoolId || item.id || "").trim();
    if (!nodePoolId) continue;
    const result = await execResourceProvisioner(config, "/resource-orders/delete-node-pool", {
      postData: {
        nodePoolId,
        resourceOrderId: target.resourceOrderId,
        runId: target.runId,
        tenantId: target.tenantId,
        workspaceId: target.workspaceId,
        serverPlanId: target.serverPlanId,
        destroyCvmInstances: true,
        confirmation: "delete-node-pool",
      },
      timeoutMs: 180_000,
    });
    deleteNodePools.push({ nodePoolId, result });
  }
  return { kubernetesDelete, deleteNodePools };
}

async function runT1BillGate(config, target) {
  const env = {
    RUN_COS_LIVE: "1",
    ...buildCosTargetFromFixture(target),
  };
  return runNodeScript("scripts/live-test-v19-cos-exact-bill-reconcile.mjs", env, {
    timeoutMs: Number(process.env.V19_LIVE_E2E_COS_TIMEOUT_MS || 10 * 60 * 1000),
  });
}

async function runSameDay(config) {
  const prepared = config.prepareFixture ? await prepareFixture(config) : null;
  const fixtureFile = prepared?.payload?.fixtureFile || config.fixtureFile;
  if (!fixtureFile) throw new Error("V19_LIVE_E2E_FIXTURE_FILE_required_or_set_V19_LIVE_E2E_PREPARE_FIXTURE=1");
  const fixture = await readJsonFile(fixtureFile);
  const target = validateSameDayFixture(fixture);
  const cosTarget = buildCosTargetFromFixture(target);
  const evidence = {
    ok: false,
    phase: "same_day",
    startedAt: new Date().toISOString(),
    fixtureFile,
    target: {
      tenantId: target.tenantId,
      workspaceId: target.workspaceId,
      resourceOrderId: target.resourceOrderId,
      runId: target.runId,
      serverPlanId: target.serverPlanId,
    },
    cosTarget,
    preparedFixture: prepared ? { ok: true, payload: prepared.payload } : { ok: false, reused: true },
    recoveryBaseline: null,
    tkeGate: null,
    warnings: [],
  };

  if (!fixture.prepared?.oplRun) {
    evidence.warnings.push("fixture_missing_opl_run; same-day E2E is not full until PORTAL_RECOVERY_START_OPL_RUN=1 succeeds");
  }

  if (config.runRecoveryBaseline) {
    const result = await runRecoveryBaseline(config, fixtureFile);
    evidence.recoveryBaseline = {
      ok: true,
      stdout: JSON.parse(result.stdout || "{}"),
    };
  }

  if (config.runTkeGate) {
    const result = await runResourceProvisionerTkeGate(config, target);
    evidence.tkeGate = {
      ok: true,
      stdout: typeof result.stdout === "string" ? JSON.parse(result.stdout || "{}") : result.stdout,
    };
  }

  evidence.ok = evidence.warnings.length === 0
    && (!config.runRecoveryBaseline || evidence.recoveryBaseline?.ok === true)
    && (!config.runTkeGate || evidence.tkeGate?.ok === true);
  evidence.completedAt = new Date().toISOString();
  evidence.evidenceFile = await writeEvidence(config, evidence);
  return evidence;
}

async function runT1Bill(config) {
  if (!config.fixtureFile) throw new Error("V19_LIVE_E2E_FIXTURE_FILE_required_for_t1_bill");
  const fixture = await readJsonFile(config.fixtureFile);
  const target = validateSameDayFixture(fixture);
  const result = await runT1BillGate(config, target);
  const evidence = {
    ok: true,
    phase: "t1_bill",
    startedAt: new Date().toISOString(),
    fixtureFile: config.fixtureFile,
    target: {
      tenantId: target.tenantId,
      workspaceId: target.workspaceId,
      resourceOrderId: target.resourceOrderId,
      runId: target.runId,
      serverPlanId: target.serverPlanId,
    },
    cos: JSON.parse(result.stdout || "{}"),
    completedAt: new Date().toISOString(),
  };
  evidence.evidenceFile = await writeEvidence(config, evidence);
  return evidence;
}

async function main() {
  const config = parseLiveE2eConfig(process.env);
  const result = config.phase === "same_day"
    ? await runSameDay(config)
    : await runT1Bill(config);
  console.log(stableJson({
    ok: result.ok,
    phase: result.phase,
    evidenceFile: result.evidenceFile,
    target: result.target,
    warnings: result.warnings || [],
    gates: {
      recoveryBaseline: Boolean(result.recoveryBaseline?.ok),
      tkeGate: Boolean(result.tkeGate?.ok),
      cos: Boolean(result.cos?.ok),
    },
  }));
  if (!result.ok) process.exitCode = 1;
}

main().catch(async (error) => {
  const config = (() => {
    try {
      return parseLiveE2eConfig({ ...process.env, RUN_V19_LIVE_E2E: process.env.RUN_V19_LIVE_E2E || "1" });
    } catch {
      return { phase: process.env.V19_LIVE_E2E_PHASE || "unknown", outputDir: ".runtime/v19-live-e2e" };
    }
  })();
  const evidence = {
    ok: false,
    phase: config.phase,
    error: String(error.message || error),
    env: redactEnv({
      V19_LIVE_E2E_PHASE: process.env.V19_LIVE_E2E_PHASE,
      V19_LIVE_E2E_FIXTURE_FILE: process.env.V19_LIVE_E2E_FIXTURE_FILE,
      V19_LIVE_E2E_PREPARE_FIXTURE: process.env.V19_LIVE_E2E_PREPARE_FIXTURE,
      V19_LIVE_E2E_RUN_TKE_GATE: process.env.V19_LIVE_E2E_RUN_TKE_GATE,
      V19_LIVE_E2E_RUN_RECOVERY_BASELINE: process.env.V19_LIVE_E2E_RUN_RECOVERY_BASELINE,
    }),
    failedAt: new Date().toISOString(),
  };
  try {
    evidence.evidenceFile = await writeEvidence(config, evidence);
  } catch {}
  console.error(stableJson(evidence));
  process.exitCode = 1;
});
