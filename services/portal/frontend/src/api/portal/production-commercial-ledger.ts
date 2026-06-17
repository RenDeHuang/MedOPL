import { goControlPlaneClient } from "../client";

export interface ProductionCommercialLedgerInput {
  tenantId: string;
  accountId: string;
  workspaceId: string;
  resourceBindingId: string;
  cloudOperationId: string;
  billingAttributionId: string;
  serverPlanId: string;
  workspaceStorageGb: number;
  providerKeyRef: string;
  idempotencyKey: string;
  quota: {
    storageGb: number;
    cpuCores: number;
    memoryGb: number;
    maxConcurrentRuns: number;
  };
}

export interface ProductionCommercialLedgerContractPayload {
  ok: false;
  contract: "production_launch_gap_04_billing_audit_quota_ledger_contract_local_gate";
  mode: "contract-only";
  error: "production_launch_commercial_ledger_required";
  requiredRunner: string;
  externalAccess: {
    status: "blocked_until_multi_tenant_minimum_launch_closure";
  };
  providerBoundary?: {
    publicFields: Array<"provider" | "providerKeyRef" | "boundStatus">;
    rawSecretBackendOnly: true;
  };
  ledgerShape?: {
    canonicalParents: "PostgreSQL resource_bindings/cloud_operations";
    billingEvents: {
      table: "billing_events";
      uniqueKey: "billing_event_id";
      idempotencyKey: "idempotency_key";
      statusField: "status";
      productionWriteNow: false;
      productionReadNow: false;
    };
    auditEvents: {
      table: "audit_events";
      uniqueKey: "audit_event_id";
      idempotencyKey: "idempotency_key";
      statusField: "status";
      productionWriteNow: false;
      productionReadNow: false;
    };
    quotaLedger: {
      table: "quota_ledger";
      uniqueKey: "quota_event_id";
      idempotencyKey: "idempotency_key";
      decisionField: "enforcement_decision";
      productionWriteNow: false;
      productionReadNow: false;
    };
  };
  quotaEnforcementBoundary?: {
    quotaTypes: string[];
    futureDecisionValues: Array<"allow" | "deny" | "manual_review">;
    productionEnforcementNow: false;
    failClosedWhenMissingQuota: true;
  };
}

export async function planProductionCommercialLedger(input: ProductionCommercialLedgerInput) {
  const { data } = await goControlPlaneClient.post<ProductionCommercialLedgerContractPayload>("/v22/production/commercial-ledger/plan", input);
  return data;
}

export async function commitProductionCommercialLedger(input: ProductionCommercialLedgerInput) {
  const { data } = await goControlPlaneClient.post<ProductionCommercialLedgerContractPayload>("/v22/production/commercial-ledger/commit", input);
  return data;
}
