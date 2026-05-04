import { randomUUID } from "node:crypto";
import {
  addArtifactRecord,
  addCostRecord,
  addRunAction,
  createRunRecord,
  updateRunStatus,
} from "./state-store.mjs";
import {
  createWorkspace as createRunnerWorkspace,
  getRunStatus,
  listOutputs,
  submitRun,
} from "./runner-client.mjs";
import { usableServerPlanId } from "./server-plan-ids.mjs";
import { createRunCorrelationId, createRunTraceId } from "./run-observability.mjs";

function isTerminal(status = "") {
  return ["succeeded", "failed", "cancelled", "timed_out"].includes(String(status || "").toLowerCase());
}

function isDeliverableOutput(output = {}) {
  const name = String(output.name || "").trim();
  const sizeBytes = Number(output.sizeBytes || output.size_bytes || 0);
  return Boolean(name && name !== ".keep" && sizeBytes > 0);
}

function preparedPlanContext(order = {}) {
  return {
    serverPlanId: usableServerPlanId(order.serverPlanId, order.server_plan_id),
    instanceType: String(order.instanceType || order.instance_type || order.InstanceType || "").trim(),
    region: String(order.region || "").trim(),
    zone: String(order.zone || "").trim(),
  };
}

export function createRunApi({
  portalInternalBaseUrl,
  portalInternalAuthToken = "",
  runnerImage,
  k8sNamespace,
  publishTraceEvent,
}) {
  function runContextFromRuntime(runtimeSession, input, req) {
    const runId = input.runId || input.run_id || randomUUID();
    return {
      correlationId: createRunCorrelationId({ ...input, runId }),
      traceId: createRunTraceId({ ...input, runId }),
      portalUserId: runtimeSession.portalUserId,
      tenantId: input.tenantId || input.tenant_id || runtimeSession.tenantId || runtimeSession.portalUserId,
      customerId: runtimeSession.portalUserId,
      userId: runtimeSession.portalUserId,
      workspaceId: runtimeSession.workspaceId,
      workspaceSessionId: runtimeSession.workspaceSessionId,
      runtimeSessionId: runtimeSession.runtimeSessionId,
      runId,
      agentId: input.agentId || input.agent_id || "mas",
      toolName: input.toolName || input.tool_name || "med-autoscience",
      billingScope: input.billingScope || input.billing_scope || "run",
      costCenter: input.costCenter || input.cost_center || "research-foundry",
      serverPlanId: usableServerPlanId(input.serverPlanId, input.server_plan_id, runtimeSession.serverPlanId),
      instanceType: input.instanceType || input.instance_type || input.InstanceType || runtimeSession.instanceType || "",
      region: input.region || runtimeSession.region || "",
      zone: input.zone || runtimeSession.zone || "",
      nodePool: input.nodePool || input.node_pool || runtimeSession.nodePool || "",
      runtimeClass: input.runtimeClass || input.runtime_class || runtimeSession.runtimeClass || "",
      nodeSelector: (input.nodeSelector && typeof input.nodeSelector === "object" ? input.nodeSelector : runtimeSession.nodeSelector) || {},
      tolerations: Array.isArray(input.tolerations) ? input.tolerations : (Array.isArray(runtimeSession.tolerations) ? runtimeSession.tolerations : []),
      podNetworkingMode: input.podNetworkingMode || input.pod_networking_mode || runtimeSession.podNetworkingMode || "",
      requiresEniPod: input.requiresEniPod === true || input.requires_eni_pod === true || runtimeSession.requiresEniPod === true,
      podAnnotations: (input.podAnnotations && typeof input.podAnnotations === "object" ? input.podAnnotations : runtimeSession.podAnnotations) || {},
      cpuRequest: input.cpuRequest || input.cpu_request || runtimeSession.cpuRequest || "",
      cpuLimit: input.cpuLimit || input.cpu_limit || runtimeSession.cpuLimit || "",
      memoryRequest: input.memoryRequest || input.memory_request || runtimeSession.memoryRequest || "",
      memoryLimit: input.memoryLimit || input.memory_limit || runtimeSession.memoryLimit || "",
      gpuCount: Number(input.gpuCount ?? input.gpu_count ?? runtimeSession.gpuCount ?? 0),
      storageRequest: input.storageRequest || input.storage_request || runtimeSession.storageRequest || "",
      storageLimit: input.storageLimit || input.storage_limit || runtimeSession.storageLimit || "",
      provisioningMode: input.provisioningMode || input.provisioning_mode || runtimeSession.provisioningMode || "schedule_to_node_pool",
      tkeClusterId: input.tkeClusterId || input.tke_cluster_id || runtimeSession.tkeClusterId || "",
      nodePoolId: input.nodePoolId || input.node_pool_id || runtimeSession.nodePoolId || "",
      nodePoolCreatePayload: input.nodePoolCreatePayload || input.node_pool_create_payload || runtimeSession.nodePoolCreatePayload || null,
      nodePoolScalePayload: input.nodePoolScalePayload || input.node_pool_scale_payload || runtimeSession.nodePoolScalePayload || null,
      provisionerPayload: input.provisionerPayload || input.provisioner_payload || runtimeSession.provisionerPayload || null,
      model: input.model || "opl-runtime",
      tokenCount: Number(input.tokenCount || input.token_count || 0),
      estimatedHours: Number(input.estimatedHours ?? input.estimated_hours ?? 1),
      resourceOrderId: String(input.resourceOrderId || input.resource_order_id || "").trim(),
      userAgent: req.headers["user-agent"] || "",
      runnerImage: input.runnerImage || input.runner_image || runnerImage,
      namespace: input.namespace || k8sNamespace,
      providerConfigured: Boolean(runtimeSession.providerConfigured),
      providerConfigStatus: runtimeSession.providerConfigStatus || (runtimeSession.providerConfigured ? "configured" : "missing"),
      providerConfigSecretRef: runtimeSession.providerConfigSecretRef || "",
      providerName: runtimeSession.providerName || "",
      providerBaseUrl: runtimeSession.providerBaseUrl || "",
      modelProvider: runtimeSession.modelProvider || "",
      modelReasoningEffort: runtimeSession.modelReasoningEffort || "",
      serviceTier: runtimeSession.serviceTier || "",
      sandboxMode: runtimeSession.sandboxMode || "",
    };
  }

  async function prepareRunResourceOrder(context) {
    if (!portalInternalBaseUrl) {
      throw new Error("PORTAL_INTERNAL_BASE_URL is required for resource order preparation");
    }
    const idempotencyKey = `${context.runId}:${context.workspaceSessionId || "no-workspace-session"}`;
    const response = await fetch(new URL("/portal/internal/resource-orders/prepare-run", `${portalInternalBaseUrl}/`), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(portalInternalAuthToken ? { "x-portal-internal-token": portalInternalAuthToken } : {}),
      },
      body: JSON.stringify({
        tenantId: context.tenantId,
        userId: context.userId,
        workspaceId: context.workspaceId,
        workspaceSessionId: context.workspaceSessionId,
        runId: context.runId,
        serverPlanId: context.serverPlanId,
        estimatedHours: Number.isFinite(context.estimatedHours) && context.estimatedHours > 0 ? context.estimatedHours : 1,
        idempotencyKey,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok || !String(payload.resourceOrderId || "").trim()) {
      throw new Error(payload?.error || `resource_order_prepare_failed:${response.status}`);
    }
    return {
      resourceOrderId: String(payload.resourceOrderId).trim(),
      order: payload.order || null,
      idempotencyKey,
      planContext: preparedPlanContext(payload.order || {}),
    };
  }

  async function submitRuntimeRun(state, runtimeSession, input, req) {
    const baseContext = runContextFromRuntime(runtimeSession, input, req);
    const startedAt = Date.now();
    const prepared = await prepareRunResourceOrder(baseContext);
    const context = {
      ...baseContext,
      ...Object.fromEntries(Object.entries(prepared.planContext).filter(([, value]) => value)),
      resourceOrderId: prepared.resourceOrderId,
      resourceOrder: prepared.order,
      resourceOrderPrepareIdempotencyKey: prepared.idempotencyKey,
    };
    addRunAction(state, {
      ...context,
      actionType: "resource_order_prepared",
      summary: "Portal resource order prepared before runner submission.",
      status: "prepared",
    });
    await createRunnerWorkspace(context);
    addRunAction(state, { ...context, actionType: "runner_workspace_created", summary: "Runner workspace created.", status: "succeeded" });
    const submitted = await submitRun(context);
    const run = createRunRecord(state, {
      ...context,
      ...submitted,
      traceId: submitted.traceId || submitted.trace_id || context.traceId,
      status: submitted.status || "submitted",
      latencyMs: Date.now() - startedAt,
      userAgent: context.userAgent,
      tokenCount: context.tokenCount,
      model: context.model,
    });
    run.traceId = submitted.traceId || submitted.trace_id || context.traceId;
    run.correlationId = submitted.correlationId || submitted.correlation_id || context.correlationId;
    addRunAction(state, { ...run, actionType: "runner_run_submitted", summary: "med-autoscience runner accepted run.", status: run.status });
    await publishTraceEvent(state, {
      ...run,
      eventType: "run_started",
      traceName: "OPL run started",
      status: run.status,
      latencyMs: run.latencyMs,
      model: context.model,
      tokenCount: context.tokenCount,
      userAgent: context.userAgent,
    });
    addCostRecord(state, {
      ...run,
      status: "pending",
      pricingSource: "opencost-pending",
      totalCost: null,
    });
    return run;
  }

  async function syncRunnerRun(state, run, runStatus = null) {
    const latest = runStatus || await getRunStatus(run.runId);
    const patched = updateRunStatus(state, run.runId, {
      status: latest.status || run.status,
      jobName: latest.jobName || run.jobName,
      namespace: latest.namespace || run.namespace,
      manifestPath: latest.manifestPath || run.manifestPath,
      finishedAt: latest.finishedAt || run.finishedAt,
      error: latest.error || run.error || "",
    });
    if (!patched) return null;

    if (isTerminal(patched.status)) {
      const outputs = await listOutputs(patched);
      for (const output of outputs.filter(isDeliverableOutput)) {
        const artifact = addArtifactRecord(state, {
          ...patched,
          name: output.name || "",
          objectKey: output.objectKey || output.object_key || "",
          localPath: output.path || output.localPath || "",
          sizeBytes: output.sizeBytes || output.size_bytes || 0,
          contentType: output.contentType || output.content_type || "application/octet-stream",
        });
        await publishTraceEvent(state, {
          ...patched,
          ...artifact,
          eventType: "artifact_created",
          traceName: "OPL artifact created",
          status: patched.status,
        });
      }
      await publishTraceEvent(state, {
        ...patched,
        eventType: patched.status === "failed" ? "run_failed" : "run_completed",
        traceName: "OPL run completed",
        status: patched.status,
      });
    }
    return patched;
  }

  return {
    submitRuntimeRun,
    syncRunnerRun,
  };
}
