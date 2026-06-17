import { goControlPlaneClient } from "../client";

export interface ProductionLedgerInput {
  tenantId: string;
  accountId: string;
  workspaceId: string;
  resourceBindingId: string;
  billingAttributionId: string;
  serverPlanId: string;
  workspaceStorageGb: number;
  cloudProvider: string;
  region: string;
  clusterId: string;
  nodePoolId?: string;
  nodePoolName: string;
  providerKeyRef: string;
  idempotencyKey: string;
}

export interface ProductionLedgerContractPayload {
  ok: false;
  contract: "production_launch_gap_03_resourcebinding_postgresql_ledger_contract_local_gate";
  mode: "contract-only";
  error: "production_launch_ledger_required";
  requiredRunner: string;
  externalAccess: {
    status: "blocked_until_multi_tenant_minimum_launch_closure";
  };
  providerBoundary?: {
    publicFields: Array<"provider" | "providerKeyRef" | "boundStatus">;
    rawSecretBackendOnly: true;
  };
  ledgerShape?: {
    canonicalStore: "PostgreSQL resource_bindings/cloud_operations";
    resourceBindings: {
      table: "resource_bindings";
      uniqueKey: "resource_binding_id";
      statusField: "status";
      operationReference: "operation_id";
      productionWriteNow: false;
      productionReadNow: false;
    };
    cloudOperations: {
      table: "cloud_operations";
      uniqueKey: "operation_id";
      resourceBindingReference: "resource_binding_id";
      statusField: "status";
      productionWriteNow: false;
      productionReadNow: false;
    };
  };
}

export async function planProductionLedger(input: ProductionLedgerInput) {
  const { data } = await goControlPlaneClient.post<ProductionLedgerContractPayload>("/v22/production/ledger/plan", input);
  return data;
}

export async function commitProductionLedger(input: ProductionLedgerInput) {
  const { data } = await goControlPlaneClient.post<ProductionLedgerContractPayload>("/v22/production/ledger/commit", input);
  return data;
}
