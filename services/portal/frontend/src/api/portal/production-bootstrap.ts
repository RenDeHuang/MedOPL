import { goControlPlaneClient } from "../client";

export interface ProductionBootstrapAdminShape {
  email: string;
  displayName: string;
  role: "platform_owner";
  identitySource: "production_identity_provider_required";
}

export interface ProductionBootstrapTenantShape {
  id: string;
  slug: string;
  name: string;
  planId: string;
}

export interface ProductionBootstrapWorkspaceShape {
  id: string;
  slug: string;
  title: string;
  storageGb: number;
  packageId: string;
  providerKeyRef: string;
}

export interface ProductionBootstrapPlanInput {
  firstAdmin: ProductionBootstrapAdminShape;
  tenant: ProductionBootstrapTenantShape;
  workspace: ProductionBootstrapWorkspaceShape;
  idempotencyKey: string;
}

export interface ProductionBootstrapContractPayload {
  ok: false;
  contract: "production_launch_gap_01_bootstrap_contract_local_gate";
  mode: "contract-only";
  error: "production_bootstrap_contract_only" | "production_bootstrap_apply_not_authorized";
  requiredRunner: string;
  externalAccess: {
    status: "blocked_until_multi_tenant_minimum_launch_closure";
  };
  providerBoundary?: {
    publicFields: Array<"provider" | "providerKeyRef" | "boundStatus">;
    rawSecretBackendOnly: true;
  };
}

export async function planProductionBootstrap(input: ProductionBootstrapPlanInput) {
  const { data } = await goControlPlaneClient.post<ProductionBootstrapContractPayload>("/v22/production/bootstrap/plan", input);
  return data;
}

export async function commitProductionBootstrap(input: ProductionBootstrapPlanInput) {
  const { data } = await goControlPlaneClient.post<ProductionBootstrapContractPayload>("/v22/production/bootstrap/commit", input);
  return data;
}
