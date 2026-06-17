import { goControlPlaneClient } from "../client";

export interface ExternalAccessStrategyInput {
  portalHost: string;
  ingressClass: string;
  tlsSecretName?: string;
  certificateManagement: "precreated-tls-secret" | "cert-manager";
  allowedAnnotations: string[];
  forbiddenAnnotations: string[];
  externalSmokeUrl: string;
  providerKeyRef: string;
}

export interface ExternalAccessStrategyContractPayload {
  ok: false;
  contract: "production_launch_gap_07_external_access_strategy_contract_local_gate";
  mode: "contract-only";
  error: "package_d_external_access_strategy_required";
  requiredRunner: string;
  recommendedNextOption: {
    id: "ingress_https_domain_formal_candidate";
    executionNow: false;
  };
  productionEntryParameters: {
    requiredKeys: string[];
    portalHost?: string;
    ingressClass?: string;
    tlsSecretName?: string;
    externalSmokeUrl?: string;
  };
  strategyComparison: Array<{
    id: "admin_only_port_forward" | "internal_gateway" | "kubernetes_ingress" | "loadbalancer_service" | "https_domain";
    executionNow: false;
  }>;
  boundary: {
    contractOnly: true;
    kubernetesAccessAllowed: false;
    ingressMutationAllowedNow: false;
    loadBalancerMutationAllowedNow: false;
    dnsTlsMutationAllowedNow: false;
    publicAccessClaimAllowedNow: false;
  };
  providerBoundary: {
    publicFields: Array<"provider" | "providerKeyRef" | "boundStatus">;
    rawSecretBackendOnly: true;
  };
}

export async function planExternalAccessStrategy(input: ExternalAccessStrategyInput) {
  const { data } = await goControlPlaneClient.post<ExternalAccessStrategyContractPayload>("/v22/production/external-access-strategy/plan", input);
  return data;
}

export async function commitExternalAccessStrategy(input: ExternalAccessStrategyInput) {
  const { data } = await goControlPlaneClient.post<ExternalAccessStrategyContractPayload>("/v22/production/external-access-strategy/commit", input);
  return data;
}
