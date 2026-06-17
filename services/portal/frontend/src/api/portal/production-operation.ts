import { goControlPlaneClient } from "../client";

export interface ProductionPackageCOperationInput {
  tenantId: string;
  accountId: string;
  workspaceId: string;
  resourceBindingId: string;
  billingAttributionId: string;
  serverPlanId: string;
  providerKeyRef: string;
  idempotencyKey: string;
}

export interface ProductionPackageCOperationContractPayload {
  ok: false;
  contract: "production_launch_gap_02_package_c_operation_contract_local_gate";
  mode: "contract-only";
  error: "production_launch_operation_required" | "production_launch_operation_commit_not_authorized";
  requiredRunner: string;
  externalAccess: {
    status: "blocked_until_multi_tenant_minimum_launch_closure";
  };
  providerBoundary?: {
    publicFields: Array<"provider" | "providerKeyRef" | "boundStatus">;
    rawSecretBackendOnly: true;
  };
  resourceBindingStateContract?: {
    minimumStates: Array<"requested" | "creating" | "ready">;
    canonicalStore: "PostgreSQL resource_bindings/cloud_operations";
    productionPostgresWriteNow: false;
  };
}

export async function planProductionPackageCOperation(input: ProductionPackageCOperationInput) {
  const { data } = await goControlPlaneClient.post<ProductionPackageCOperationContractPayload>("/v22/production/package-c-operation/plan", input);
  return data;
}

export async function commitProductionPackageCOperation(input: ProductionPackageCOperationInput) {
  const { data } = await goControlPlaneClient.post<ProductionPackageCOperationContractPayload>("/v22/production/package-c-operation/commit", input);
  return data;
}
