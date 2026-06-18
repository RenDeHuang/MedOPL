package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func productionBootstrapContractPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, gin.H{
			"ok":             false,
			"contract":       "production_launch_gap_01_bootstrap_contract_local_gate",
			"mode":           "contract-only",
			"error":          "production_bootstrap_contract_only",
			"requiredRunner": "tests/support/cloud-prework/production-launch-bootstrap-runner.js",
			"firstAdmin": gin.H{
				"status":         "bootstrap_required",
				"role":           "platform_owner",
				"identitySource": "production_identity_provider_required",
			},
			"tenant": gin.H{
				"status": "bootstrap_required",
			},
			"workspace": gin.H{
				"status": "seed_required",
			},
			"providerBoundary": gin.H{
				"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
				"rawSecretBackendOnly": true,
			},
			"externalAccess": gin.H{
				"status": "blocked_until_multi_tenant_minimum_launch_closure",
			},
		})
	}
}

func productionBootstrapContractCommit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, gin.H{
			"ok":             false,
			"contract":       "production_launch_gap_01_bootstrap_contract_local_gate",
			"mode":           "contract-only",
			"error":          "production_bootstrap_apply_not_authorized",
			"requiredRunner": "tests/support/cloud-prework/production-launch-bootstrap-runner.js",
			"providerBoundary": gin.H{
				"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
				"rawSecretBackendOnly": true,
			},
			"externalAccess": gin.H{
				"status": "blocked_until_multi_tenant_minimum_launch_closure",
			},
		})
	}
}

func productionPackageCOperationContractPayload(errorCode string) gin.H {
	return gin.H{
		"ok":             false,
		"contract":       "production_launch_gap_02_package_c_operation_contract_local_gate",
		"mode":           "contract-only",
		"error":          errorCode,
		"requiredRunner": "tests/support/cloud-prework/production-launch-operation-runner.js",
		"portalAction": gin.H{
			"shape":            "Portal workspace provisioning action",
			"rawSecretAllowed": false,
		},
		"goBackendOperationRequest": gin.H{
			"requiredFields": []string{
				"tenantId",
				"accountId",
				"workspaceId",
				"resourceBindingId",
				"billingAttributionId",
				"serverPlanId",
				"providerKeyRef",
				"idempotencyKey",
			},
		},
		"packageCRunnerInvocationBoundary": gin.H{
			"runner":                  "tests/support/cloud-prework/v22-package-c-live-canary-live-runner.js",
			"contractOnly":            true,
			"liveExecutionAllowedNow": false,
			"futureRunGate":           "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
		},
		"resourceBindingStateContract": gin.H{
			"minimumStates":              []string{"requested", "creating", "ready"},
			"canonicalStore":             "PostgreSQL resource_bindings/cloud_operations",
			"productionPostgresWriteNow": false,
		},
		"providerBoundary": gin.H{
			"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
			"rawSecretBackendOnly": true,
		},
		"externalAccess": gin.H{
			"status": "blocked_until_multi_tenant_minimum_launch_closure",
		},
	}
}

func productionPackageCOperationContractPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionPackageCOperationContractPayload("production_launch_operation_required"))
	}
}

func productionPackageCOperationContractCommit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionPackageCOperationContractPayload("production_launch_operation_required"))
	}
}

func productionLedgerContractPayload(errorCode string) gin.H {
	return gin.H{
		"ok":             false,
		"contract":       "production_launch_gap_03_resourcebinding_postgresql_ledger_contract_local_gate",
		"mode":           "contract-only",
		"error":          errorCode,
		"requiredRunner": "tests/support/cloud-prework/production-launch-ledger-runner.js",
		"ledgerShape": gin.H{
			"canonicalStore": "PostgreSQL resource_bindings/cloud_operations",
			"resourceBindings": gin.H{
				"table":              "resource_bindings",
				"uniqueKey":          "resource_binding_id",
				"statusField":        "status",
				"operationReference": "operation_id",
				"productionWriteNow": false,
				"productionReadNow":  false,
			},
			"cloudOperations": gin.H{
				"table":                    "cloud_operations",
				"uniqueKey":                "operation_id",
				"resourceBindingReference": "resource_binding_id",
				"statusField":              "status",
				"productionWriteNow":       false,
				"productionReadNow":        false,
			},
		},
		"statePersistenceBoundary": gin.H{
			"minimumStates":              []string{"requested", "creating", "ready"},
			"fullLifecycleStates":        []string{"requested", "creating", "created", "scaling", "ready", "releaseRequested", "deleting", "released", "failed", "cleanupRequired"},
			"productionPostgresWriteNow": false,
			"productionPostgresReadNow":  false,
		},
		"idempotency": gin.H{
			"operationIdRequired":      true,
			"idempotencyKeyRequired":   true,
			"resourceBindingUniqueKey": "resource_binding_id",
			"cloudOperationUniqueKey":  "operation_id",
		},
		"providerBoundary": gin.H{
			"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
			"rawSecretBackendOnly": true,
		},
		"canonicalOwnershipSource": "postgres_resource_binding_ledger",
		"localVsProductionRepository": gin.H{
			"localRepositoryMode":        "dry-run-memory-shape-only",
			"futureProductionRepository": "PostgreSQL resource_bindings/cloud_operations",
			"connectsToPostgresNow":      false,
		},
		"externalAccess": gin.H{
			"status": "blocked_until_multi_tenant_minimum_launch_closure",
		},
	}
}

func productionLedgerContractPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionLedgerContractPayload("production_launch_ledger_required"))
	}
}

func productionLedgerContractCommit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionLedgerContractPayload("production_launch_ledger_required"))
	}
}

func productionCommercialLedgerContractPayload(errorCode string) gin.H {
	return gin.H{
		"ok":             false,
		"contract":       "production_launch_gap_04_billing_audit_quota_ledger_contract_local_gate",
		"mode":           "contract-only",
		"error":          errorCode,
		"requiredRunner": "tests/support/cloud-prework/production-launch-commercial-ledger-runner.js",
		"ledgerShape": gin.H{
			"canonicalParents": "PostgreSQL resource_bindings/cloud_operations",
			"billingEvents": gin.H{
				"table":              "billing_events",
				"uniqueKey":          "billing_event_id",
				"idempotencyKey":     "idempotency_key",
				"statusField":        "status",
				"productionWriteNow": false,
				"productionReadNow":  false,
			},
			"auditEvents": gin.H{
				"table":              "audit_events",
				"uniqueKey":          "audit_event_id",
				"idempotencyKey":     "idempotency_key",
				"statusField":        "status",
				"productionWriteNow": false,
				"productionReadNow":  false,
			},
			"quotaLedger": gin.H{
				"table":              "quota_ledger",
				"uniqueKey":          "quota_event_id",
				"idempotencyKey":     "idempotency_key",
				"decisionField":      "enforcement_decision",
				"productionWriteNow": false,
				"productionReadNow":  false,
			},
		},
		"linkage": gin.H{
			"resourceBindingKey":    "resource_binding_id",
			"cloudOperationKey":     "cloud_operation_id",
			"billingAttributionKey": "billing_attribution_id",
			"workspaceCostScope":    "tenant/account/workspace/resourceBinding/cloudOperation/billingAttribution/serverPlan",
		},
		"quotaEnforcementBoundary": gin.H{
			"quotaTypes":                     []string{"workspace_storage_gb", "cpu_cores", "memory_gb", "max_concurrent_runs"},
			"futureDecisionValues":           []string{"allow", "deny", "manual_review"},
			"productionEnforcementNow":       false,
			"failClosedWhenMissingQuota":     true,
			"packageCAdmissionDependsOnGate": true,
		},
		"idempotency": gin.H{
			"operationIdRequired":    true,
			"idempotencyKeyRequired": true,
			"billingUniqueKey":       "idempotency_key",
			"auditUniqueKey":         "idempotency_key",
			"quotaUniqueKey":         "idempotency_key",
		},
		"providerBoundary": gin.H{
			"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
			"rawSecretBackendOnly": true,
		},
		"localVsProductionRepository": gin.H{
			"localRepositoryMode":        "dry-run-memory-shape-only",
			"futureProductionRepository": "PostgreSQL billing_events/audit_events/quota_ledger",
			"parentRepository":           "PostgreSQL resource_bindings/cloud_operations",
			"connectsToPostgresNow":      false,
		},
		"externalAccess": gin.H{
			"status": "blocked_until_multi_tenant_minimum_launch_closure",
		},
	}
}

func productionCommercialLedgerContractPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionCommercialLedgerContractPayload("production_launch_commercial_ledger_required"))
	}
}

func productionCommercialLedgerContractCommit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionCommercialLedgerContractPayload("production_launch_commercial_ledger_required"))
	}
}

func productionWorkspaceLifecycleContractPayload(errorCode string) gin.H {
	return gin.H{
		"ok":             false,
		"contract":       "production_launch_gap_05_workspace_lifecycle_contract_local_gate",
		"mode":           "contract-only",
		"error":          errorCode,
		"requiredRunner": "tests/support/cloud-prework/production-launch-workspace-lifecycle-runner.js",
		"requestShape": gin.H{
			"actions": []string{"suspend", "resume", "delete"},
			"requiredFields": []string{
				"tenantId",
				"accountId",
				"workspaceId",
				"resource_binding_id",
				"cloud_operation_id",
				"billingAttributionId",
				"serverPlanId",
				"providerKeyRef",
				"idempotencyKey",
			},
			"rawSecretFieldsAllowed": false,
		},
		"resourceBindingLifecycle": gin.H{
			"table": "resource_bindings",
			"statesByAction": gin.H{
				"suspend": []string{"ready", "suspendRequested", "suspended"},
				"resume":  []string{"suspended", "resumeRequested", "ready"},
				"delete":  []string{"ready", "releaseRequested", "deleting", "released"},
			},
			"productionWriteNow": false,
			"productionReadNow":  false,
		},
		"cloudOperationLifecycle": gin.H{
			"table": "cloud_operations",
			"operationTypes": gin.H{
				"suspend": "workspace_suspend",
				"resume":  "workspace_resume",
				"delete":  "workspace_delete",
			},
			"productionWriteNow": false,
			"productionReadNow":  false,
		},
		"commercialLinkage": gin.H{
			"billingEvents": gin.H{
				"table":   "billing_events",
				"actions": []string{"stop_on_suspend", "resume_on_resume", "finalize_on_delete"},
			},
			"auditEvents": gin.H{
				"table":   "audit_events",
				"actions": []string{"workspace_suspend_requested", "workspace_resume_requested", "workspace_delete_requested"},
			},
			"quotaLedger": gin.H{
				"table":   "quota_ledger",
				"actions": []string{"release_on_suspend", "restore_on_resume", "final_release_on_delete"},
			},
		},
		"idempotency": gin.H{
			"operationIdRequired":    true,
			"idempotencyKeyRequired": true,
			"perLifecycleAction":     true,
		},
		"providerBoundary": gin.H{
			"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
			"rawSecretBackendOnly": true,
		},
		"localVsProductionRepository": gin.H{
			"localRepositoryMode":        "dry-run-memory-shape-only",
			"futureProductionRepository": "PostgreSQL resource_bindings/cloud_operations/billing_events/audit_events/quota_ledger",
			"connectsToPostgresNow":      false,
		},
		"rollbackCleanupEvidence": gin.H{
			"rollbackPlanRequired": true,
			"cleanupPlanRequired":  true,
			"redactedEvidenceOnly": true,
		},
		"externalAccess": gin.H{
			"status": "blocked_until_multi_tenant_minimum_launch_closure",
		},
	}
}

func productionWorkspaceLifecycleContractPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionWorkspaceLifecycleContractPayload("production_launch_workspace_lifecycle_required"))
	}
}

func productionWorkspaceLifecycleContractCommit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionWorkspaceLifecycleContractPayload("production_launch_workspace_lifecycle_required"))
	}
}

func productionCanaryContractPayload(errorCode string) gin.H {
	return gin.H{
		"ok":             false,
		"contract":       "production_launch_gap_06_canary_rollback_cleanup_contract_local_gate",
		"mode":           "contract-only",
		"error":          errorCode,
		"requiredRunner": "tests/support/cloud-prework/production-launch-canary-runner.js",
		"productionCanaryShape": gin.H{
			"stages": []string{
				"admin_identity_smoke",
				"tenant_smoke",
				"workspace_smoke",
				"portal_backend_package_c_dry_run_boundary",
				"resourcebinding_cloudoperation_ledger_linkage",
				"commercial_ledger_linkage",
				"workspace_lifecycle_linkage",
				"rollback_evidence",
				"cleanup_evidence",
				"redaction_observability_evidence",
			},
			"contractOnly":           true,
			"rawSecretFieldsAllowed": false,
		},
		"smokeShape": gin.H{
			"admin": gin.H{
				"requiredFields": []string{"adminIdentityRef", "tenantId", "auditEventId"},
			},
			"tenant": gin.H{
				"requiredFields": []string{"tenantId", "accountId", "billingAttributionId", "quotaScopeId"},
			},
			"workspace": gin.H{
				"requiredFields": []string{"workspaceId", "resourceBindingId", "cloudOperationId", "providerKeyRef"},
			},
		},
		"portalBackendPackageCDryRunBoundary": gin.H{
			"liveExecutionAllowedNow":    false,
			"packageCLiveAllowedNow":     false,
			"tencentMutationAllowedNow":  false,
			"futurePackageCRunnerStatus": "contract_only",
		},
		"resourceBindingCloudOperationLinkage": gin.H{
			"tables":       []string{"resource_bindings", "cloud_operations"},
			"states":       []string{"requested", "creating", "ready"},
			"persistedNow": false,
		},
		"commercialLedgerLinkage": gin.H{
			"tables":       []string{"billing_events", "audit_events", "quota_ledger"},
			"persistedNow": false,
		},
		"workspaceLifecycleLinkage": gin.H{
			"actions":              []string{"suspend", "resume", "delete"},
			"lifecycleMutationNow": false,
		},
		"rollbackCleanupEvidence": gin.H{
			"rollbackPlanRequired": true,
			"cleanupPlanRequired":  true,
			"redactedEvidenceOnly": true,
		},
		"idempotency": gin.H{
			"operationIdRequired":    true,
			"idempotencyKeyRequired": true,
		},
		"providerBoundary": gin.H{
			"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
			"rawSecretBackendOnly": true,
		},
		"localVsProductionRepository": gin.H{
			"localRepositoryMode":        "dry-run-memory-shape-only",
			"futureProductionRepository": "PostgreSQL ledgers plus future Kubernetes execution evidence",
			"connectsToPostgresNow":      false,
			"connectsToKubernetesNow":    false,
		},
		"externalAccess": gin.H{
			"status": "blocked_until_multi_tenant_minimum_launch_closure",
		},
	}
}

func productionCanaryContractPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionCanaryContractPayload("production_launch_canary_required"))
	}
}

func productionCanaryContractCommit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionCanaryContractPayload("production_launch_canary_required"))
	}
}

func productionExternalAccessStrategyContractPayload(errorCode string) gin.H {
	return gin.H{
		"ok":             false,
		"contract":       "production_launch_gap_07_external_access_strategy_contract_local_gate",
		"mode":           "contract-only",
		"error":          errorCode,
		"requiredRunner": "tests/support/cloud-prework/package-d-external-access-strategy-runner.js",
		"strategyComparison": []gin.H{
			{"id": "admin_only_port_forward", "executionNow": false, "formalLaunchCompletionStandard": false},
			{"id": "internal_gateway", "executionNow": false, "formalLaunchCompletionStandard": false},
			{"id": "kubernetes_ingress", "executionNow": false, "formalLaunchCompletionStandard": false},
			{"id": "loadbalancer_service", "executionNow": false, "formalLaunchCompletionStandard": false},
			{"id": "https_domain", "executionNow": false, "formalLaunchCompletionStandard": true},
		},
		"recommendedNextOption": gin.H{
			"id":                             "ingress_https_domain_formal_candidate",
			"executionNow":                   false,
			"requiresSeparateAuthorization":  true,
			"publicExposureClaimAllowedNow":  false,
			"adminPortForwardFormalStandard": false,
			"reason":                         "formal SaaS launch requires Kubernetes Ingress plus HTTPS/domain after separate authorization",
		},
		"productionEntryParameters": gin.H{
			"requiredKeys": []string{
				"PORTAL_HOST_DOMAIN",
				"INGRESS_CLASS",
				"TLS_SECRET_NAME_OR_CERT_MANAGER_ISSUER",
				"ALLOWED_INGRESS_ANNOTATIONS",
				"FORBIDDEN_INGRESS_ANNOTATIONS",
				"EXTERNAL_SMOKE_URL",
				"ROLLBACK_DELETE_INGRESS_PLAN",
			},
			"allowedAnnotationBoundary":   "allowlisted annotations only",
			"forbiddenAnnotationBoundary": "server-snippet/configuration-snippet/auth-snippet and arbitrary annotations are forbidden",
		},
		"qcloudTlsReadiness": gin.H{
			"status":                    "contract-only",
			"portalHost":                "portal.medopl.cn",
			"ingressClass":              "qcloud",
			"tlsSecretName":             "medopl-portal-tls",
			"externalSmokeUrl":          "https://portal.medopl.cn/",
			"certManagerRecommendedNow": false,
			"recommendedTlsPath":        "tencent_ssl_or_manual_certificate_material_to_authorized_kubernetes_tls_secret",
			"evidencePath":              ".runtime/package-d-external-access-strategy/<runid>/qcloud-tls-readiness-contract-redacted.json",
		},
		"allowedOperations": []string{
			"local strategy contract generation",
			"redacted authorization pack generation",
			"future server-side dry-run planning for allowlisted Ingress/TLS shapes",
		},
		"forbiddenOperations": []string{
			"secret/kubeconfig/DB password read",
			"Kubernetes API connection",
			"kubectl",
			"deploy/rollout/rollback execution",
			"build/push",
			"Tencent mutation",
			"Package C live",
			"Ingress/LoadBalancer/DNS/TLS mutation",
			"public user access completion claim",
		},
		"providerBoundary": gin.H{
			"publicFields":         []string{"provider", "providerKeyRef", "boundStatus"},
			"rawSecretBackendOnly": true,
		},
		"securityBoundary": gin.H{
			"providerKeyRefOnly":       true,
			"browserStorageSecret":     false,
			"rawSecretEvidenceAllowed": false,
		},
		"rollbackCleanupPlan": gin.H{
			"rollbackDeleteIngressPlanRequired": true,
			"deleteScope":                       "future Portal Ingress only",
			"serviceDeletionAllowed":            false,
			"namespaceDeletionAllowed":          false,
		},
		"smokePlan": gin.H{
			"internalPrerequisite": "portal-frontend ClusterIP HTTP 200",
			"external":             []string{"GET https://<portal-host>/health", "Portal login page shape", "redaction audit"},
		},
		"evidence": gin.H{
			"path":     ".runtime/package-d-external-access-strategy/<runid>/strategy-contract-redacted.json",
			"redacted": true,
		},
		"boundary": gin.H{
			"contractOnly":                   true,
			"kubernetesAccessAllowed":        false,
			"ingressMutationAllowedNow":      false,
			"loadBalancerMutationAllowedNow": false,
			"dnsTlsMutationAllowedNow":       false,
			"publicAccessClaimAllowedNow":    false,
		},
	}
}

func productionExternalAccessStrategyContractPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionExternalAccessStrategyContractPayload("package_d_external_access_strategy_required"))
	}
}

func productionExternalAccessStrategyContractCommit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, productionExternalAccessStrategyContractPayload("package_d_external_access_strategy_required"))
	}
}
