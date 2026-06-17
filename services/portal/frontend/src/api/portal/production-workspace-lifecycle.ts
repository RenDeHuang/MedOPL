import { goControlPlaneClient } from "../client";

export type ProductionWorkspaceLifecycleAction = "suspend" | "resume" | "delete";

export interface ProductionWorkspaceLifecycleInput {
  tenantId: string;
  accountId: string;
  workspaceId: string;
  resourceBindingId: string;
  cloudOperationId: string;
  billingAttributionId: string;
  serverPlanId: string;
  providerKeyRef: string;
  idempotencyKey: string;
  action: ProductionWorkspaceLifecycleAction;
}

export interface ProductionWorkspaceLifecycleContractPayload {
  ok: false;
  contract: "production_launch_gap_05_workspace_lifecycle_contract_local_gate";
  mode: "contract-only";
  error: "production_launch_workspace_lifecycle_required";
  requiredRunner: string;
  externalAccess: {
    status: "blocked_until_multi_tenant_minimum_launch_closure";
  };
  providerBoundary?: {
    publicFields: Array<"provider" | "providerKeyRef" | "boundStatus">;
    rawSecretBackendOnly: true;
  };
  requestShape?: {
    actions: ProductionWorkspaceLifecycleAction[];
    requiredFields: string[];
    rawSecretFieldsAllowed: false;
  };
  resourceBindingLifecycle?: {
    table: "resource_bindings";
    statesByAction: {
      suspend: Array<"ready" | "suspendRequested" | "suspended">;
      resume: Array<"suspended" | "resumeRequested" | "ready">;
      delete: Array<"ready" | "releaseRequested" | "deleting" | "released">;
    };
    productionWriteNow: false;
    productionReadNow: false;
  };
  cloudOperationLifecycle?: {
    table: "cloud_operations";
    operationTypes: {
      suspend: "workspace_suspend";
      resume: "workspace_resume";
      delete: "workspace_delete";
    };
    productionWriteNow: false;
    productionReadNow: false;
  };
  commercialLinkage?: {
    billingEvents: {
      table: "billing_events";
      actions: Array<"stop_on_suspend" | "resume_on_resume" | "finalize_on_delete">;
    };
    auditEvents: {
      table: "audit_events";
      actions: Array<"workspace_suspend_requested" | "workspace_resume_requested" | "workspace_delete_requested">;
    };
    quotaLedger: {
      table: "quota_ledger";
      actions: Array<"release_on_suspend" | "restore_on_resume" | "final_release_on_delete">;
    };
  };
  rollbackCleanupEvidence?: {
    rollbackPlanRequired: true;
    cleanupPlanRequired: true;
    redactedEvidenceOnly: true;
  };
}

export async function planProductionWorkspaceLifecycle(input: ProductionWorkspaceLifecycleInput) {
  const { data } = await goControlPlaneClient.post<ProductionWorkspaceLifecycleContractPayload>("/v22/production/workspace-lifecycle/plan", input);
  return data;
}

export async function commitProductionWorkspaceLifecycle(input: ProductionWorkspaceLifecycleInput) {
  const { data } = await goControlPlaneClient.post<ProductionWorkspaceLifecycleContractPayload>("/v22/production/workspace-lifecycle/commit", input);
  return data;
}
