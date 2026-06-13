import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ALLOWLIST,
  REQUIRED_KEYS,
  REQUIRED_TABLES,
  createPackageCPostgresDriverAdapter,
  createPackageCPostgresLedgerSink,
  parsePostgresLedgerEnv,
  redactPostgresLedgerConfig,
  validatePostgresLedgerEnv,
} from "./package-c-postgres-ledger-sink.js";

function clean(value = "") {
  return String(value || "").trim();
}

function redactedText(value = "") {
  return String(value || "")
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, "[redacted-db-url]")
    .replace(/password\s*[:=]\s*[^,\s;]+/giu, "password=[redacted]")
    .replace(/SecretId|SecretKey|KUBECONFIG|kubeconfig/giu, "[redacted-sensitive-key]")
    .slice(0, 512);
}

function requiredString(object, key) {
  const output = clean(object?.[key]);
  if (!output) throw new Error(`package_c_postgres_ledger_missing:${key}`);
  return output;
}

function assertTenantNodePool(nodePoolId = "") {
  const normalized = clean(nodePoolId);
  if (normalized === "np-cbk784r8") {
    throw new Error("package_c_postgres_ledger_refuses_protected_platform_pool");
  }
  return normalized || null;
}

function assertTenantNodePoolName(nodePoolName = "") {
  const normalized = requiredString({ nodePoolName }, "nodePoolName");
  if (!normalized.startsWith("medopl-tenant-")) {
    throw new Error("package_c_postgres_ledger_tenant_node_pool_name_prefix_required");
  }
  return normalized;
}

function ensureCanaryResourceBindingId(resourceBindingId = "") {
  const normalized = requiredString({ resourceBindingId }, "resourceBindingId");
  if (!/^rb-postgres-ledger-canary-[a-z0-9-]+$/u.test(normalized)) {
    throw new Error("package_c_postgres_ledger_canary_resource_binding_id_required");
  }
  return normalized;
}

function ensureCanaryOperationId(operationId = "") {
  const normalized = requiredString({ operationId }, "operationId");
  if (!/^op-postgres-ledger-canary-[a-z0-9-]+$/u.test(normalized)) {
    throw new Error("package_c_postgres_ledger_canary_operation_id_required");
  }
  return normalized;
}

function canaryIdentity({
  operationId,
  resourceBindingId,
  tenantId,
  accountId,
  workspaceId,
  billingAttributionId,
  nodePoolId = "",
  nodePoolName = "",
  serverPlanId = "starter_2c4g_10gb",
  workspaceStorageGb = 10,
  cloudProvider = "tencent",
  region = "na-siliconvalley",
  clusterId = "cls-fi097sy4",
} = {}) {
  const safeResourceBindingId = ensureCanaryResourceBindingId(resourceBindingId);
  const safeOperationId = ensureCanaryOperationId(operationId);
  const safeNodePoolId = assertTenantNodePool(nodePoolId) || "";
  const safeNodePoolName = assertTenantNodePoolName(nodePoolName || `medopl-tenant-${safeResourceBindingId}`);
  return {
    tenantId: requiredString({ tenantId }, "tenantId"),
    accountId: requiredString({ accountId }, "accountId"),
    workspaceId: requiredString({ workspaceId }, "workspaceId"),
    resourceBindingId: safeResourceBindingId,
    billingAttributionId: requiredString({ billingAttributionId }, "billingAttributionId"),
    serverPlanId: requiredString({ serverPlanId }, "serverPlanId"),
    workspaceStorageGb: Number(workspaceStorageGb),
    cloudProvider: requiredString({ cloudProvider }, "cloudProvider"),
    region: requiredString({ region }, "region"),
    clusterId: requiredString({ clusterId }, "clusterId"),
    nodePoolId: safeNodePoolId,
    nodePoolName: safeNodePoolName,
    operationId: safeOperationId,
    canonicalOwnershipSource: "postgres_resource_binding_ledger",
    cloudTagSupport: "tke_nodepool_unsupported",
  };
}

function canaryResourceBinding(identity) {
  return {
    ...identity,
    status: "requested",
    createdAt: new Date().toISOString(),
  };
}

function canaryCloudOperation(identity) {
  return {
    ...identity,
    operationType: "package_c_postgres_ledger_canary",
    status: "requested",
    createdAt: new Date().toISOString(),
  };
}

function redactedCanaryIdentity(identity = {}) {
  return {
    tenantId: clean(identity.tenantId),
    accountId: clean(identity.accountId),
    workspaceId: clean(identity.workspaceId),
    resourceBindingId: clean(identity.resourceBindingId),
    billingAttributionId: clean(identity.billingAttributionId),
    serverPlanId: clean(identity.serverPlanId),
    workspaceStorageGb: Number(identity.workspaceStorageGb) || 0,
    cloudProvider: clean(identity.cloudProvider),
    region: clean(identity.region),
    clusterId: clean(identity.clusterId),
    nodePoolId: clean(identity.nodePoolId),
    nodePoolName: clean(identity.nodePoolName),
    operationId: clean(identity.operationId),
    canonicalOwnershipSource: clean(identity.canonicalOwnershipSource),
    cloudTagSupport: clean(identity.cloudTagSupport),
  };
}

function failurePayload(error) {
  return {
    code: clean(error?.message || error?.code || "package_c_postgres_ledger_failed"),
    message: redactedText(error?.message || "package_c_postgres_ledger_failed"),
  };
}

async function writeSummary(summaryPath, summary) {
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function baseCanarySummary({ operationId, boundary, validation = null }) {
  return {
    ok: false,
    mode: "postgres_ledger_live_canary",
    operationId,
    ...(validation ? {
      validation: {
        forbidden: validation.forbidden,
        missing: validation.missing,
        errors: validation.errors,
        requiredKeys: REQUIRED_KEYS,
        allowlist: ALLOWLIST,
      },
    } : {}),
    boundary,
    confirmations: {
      preflight: false,
      parentRowsExist: false,
      insertReadback: false,
      cleanupReadbackAbsent: false,
    },
    redactionAudit: {
      passwordRedacted: true,
      connectionUrlOmitted: true,
      rawProviderResponseStored: false,
      kubeConfigStored: false,
    },
    evidenceSink: ".runtime",
  };
}

export async function runPackageCPostgresLedgerCanaryLive({
  envContent = "",
  envFile = "",
  reportDir = path.join(".runtime", "v22-cloud-lifecycle"),
  operationId = "op-postgres-ledger-canary",
  resourceBindingId = "rb-postgres-ledger-canary-20260614-001",
  tenantId = "",
  accountId = "",
  workspaceId = "",
  billingAttributionId = "",
  nodePoolId = "np-postgres-ledger-canary",
  nodePoolName = "",
  adapter,
} = {}) {
  if (clean(envFile) && /(?:package-d-deploy|kubeconfig)/iu.test(clean(envFile))) {
    throw new Error("package_c_postgres_ledger_env_file_forbidden");
  }
  const content = clean(envFile) ? await readFile(envFile, "utf8") : envContent;
  const env = parsePostgresLedgerEnv(content);
  const validation = validatePostgresLedgerEnv(env);
  const evidenceRoot = path.join(reportDir, operationId);
  await mkdir(evidenceRoot, { recursive: true });
  const summaryPath = path.join(evidenceRoot, "postgres-ledger-live-canary-summary.json");
  const boundary = {
    productionPostgresWrite: true,
    canaryWriteReadCleanup: true,
    readsPackageDDeployEnv: false,
    readsKubeconfig: false,
    executesTencentMutation: false,
    deploysWorkload: false,
    buildsOrPushesImage: false,
    entersPackageD: false,
  };
  if (!validation.ok) {
    return { ...(await writeSummary(summaryPath, baseCanarySummary({ operationId, boundary, validation }))), summaryPath, evidenceRoot };
  }

  let identity;
  try {
    identity = canaryIdentity({ operationId, resourceBindingId, tenantId, accountId, workspaceId, billingAttributionId, nodePoolId, nodePoolName });
  } catch (error) {
    const summary = {
      ...baseCanarySummary({ operationId, boundary }),
      config: redactPostgresLedgerConfig(validation.config),
      failure: failurePayload(error),
    };
    return { ...(await writeSummary(summaryPath, summary)), summaryPath, evidenceRoot };
  }

  const sink = createPackageCPostgresLedgerSink({
    config: validation.config,
    adapter: adapter || createPackageCPostgresDriverAdapter(),
  });
  const confirmations = {
    preflight: false,
    parentRowsExist: false,
    insertReadback: false,
    cleanupIssued: false,
    cleanupReadbackAbsent: false,
  };
  try {
    await sink.preflight();
    confirmations.preflight = true;
    await sink.assertParentRows(identity);
    confirmations.parentRowsExist = true;
    await sink.deleteCanary(identity.resourceBindingId);
    await sink.createResourceBinding(canaryResourceBinding(identity));
    await sink.appendCloudOperationEvent(canaryCloudOperation(identity));
    const resourceBinding = await sink.readResourceBinding(identity.resourceBindingId);
    const cloudOperation = await sink.readCloudOperation(identity.operationId);
    confirmations.insertReadback = Boolean(resourceBinding && cloudOperation);
    if (!confirmations.insertReadback) throw new Error("package_c_postgres_ledger_canary_readback_missing");
    await sink.deleteCanary(identity.resourceBindingId);
    confirmations.cleanupIssued = true;
    const resourceBindingAfterCleanup = await sink.readResourceBinding(identity.resourceBindingId);
    const cloudOperationAfterCleanup = await sink.readCloudOperation(identity.operationId);
    confirmations.cleanupReadbackAbsent = !resourceBindingAfterCleanup && !cloudOperationAfterCleanup;
    if (!confirmations.cleanupReadbackAbsent) throw new Error("package_c_postgres_ledger_canary_cleanup_readback_still_exists");
    const summary = {
      ok: true,
      mode: "postgres_ledger_live_canary",
      operationId,
      resourceBindingId: identity.resourceBindingId,
      config: redactPostgresLedgerConfig(validation.config),
      identity: redactedCanaryIdentity(identity),
      requiredTables: REQUIRED_TABLES,
      boundary,
      confirmations,
      canaryRows: {
        resourceBindingConfirmed: true,
        cloudOperationConfirmed: true,
        cleanupConfirmedAbsent: true,
      },
      redactionAudit: {
        passwordRedacted: true,
        connectionUrlOmitted: true,
        rawProviderResponseStored: false,
        kubeConfigStored: false,
      },
      evidenceSink: ".runtime",
    };
    return { ...(await writeSummary(summaryPath, summary)), summaryPath, evidenceRoot };
  } catch (error) {
    try {
      await sink.deleteCanary(identity.resourceBindingId);
      confirmations.cleanupIssued = true;
      const resourceBindingAfterCleanup = await sink.readResourceBinding(identity.resourceBindingId);
      const cloudOperationAfterCleanup = await sink.readCloudOperation(identity.operationId);
      confirmations.cleanupReadbackAbsent = !resourceBindingAfterCleanup && !cloudOperationAfterCleanup;
    } catch {
      confirmations.cleanupReadbackAbsent = false;
    }
    const summary = {
      ...baseCanarySummary({ operationId, boundary }),
      resourceBindingId: identity.resourceBindingId,
      config: redactPostgresLedgerConfig(validation.config),
      identity: redactedCanaryIdentity(identity),
      requiredTables: REQUIRED_TABLES,
      confirmations,
      failure: failurePayload(error),
    };
    return { ...(await writeSummary(summaryPath, summary)), summaryPath, evidenceRoot };
  } finally {
    await sink.close();
  }
}
