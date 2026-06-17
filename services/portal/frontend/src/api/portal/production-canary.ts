import { goControlPlaneClient } from "../client";

export interface ProductionCanaryInput {
  tenantId: string;
  accountId: string;
  workspaceId: string;
  resourceBindingId: string;
  cloudOperationId: string;
  billingAttributionId: string;
  serverPlanId: string;
  providerKeyRef: string;
  idempotencyKey: string;
}

export interface ProductionCanaryContractPayload {
  ok: false;
  contract: "production_launch_gap_06_canary_rollback_cleanup_contract_local_gate";
  mode: "contract-only";
  error: "production_launch_canary_required";
  requiredRunner: string;
  externalAccess: {
    status: "blocked_until_multi_tenant_minimum_launch_closure";
  };
  productionCanaryShape?: {
    stages: string[];
    contractOnly: true;
    rawSecretFieldsAllowed: false;
  };
  smokeShape?: {
    admin: {
      requiredFields: string[];
    };
    tenant: {
      requiredFields: string[];
    };
    workspace: {
      requiredFields: string[];
    };
  };
  portalBackendPackageCDryRunBoundary?: {
    liveExecutionAllowedNow: false;
    packageCLiveAllowedNow: false;
    tencentMutationAllowedNow: false;
  };
  rollbackCleanupEvidence?: {
    rollbackPlanRequired: true;
    cleanupPlanRequired: true;
    redactedEvidenceOnly: true;
  };
  providerBoundary?: {
    publicFields: Array<"provider" | "providerKeyRef" | "boundStatus">;
    rawSecretBackendOnly: true;
  };
}

export async function planProductionCanary(input: ProductionCanaryInput) {
  const { data } = await goControlPlaneClient.post<ProductionCanaryContractPayload>("/v22/production/canary/plan", input);
  return data;
}

export async function commitProductionCanary(input: ProductionCanaryInput) {
  const { data } = await goControlPlaneClient.post<ProductionCanaryContractPayload>("/v22/production/canary/commit", input);
  return data;
}
