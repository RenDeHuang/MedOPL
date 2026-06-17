package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cps "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

type ControlPlaneService interface {
	BindProviderKey(ctx context.Context, input cps.BindProviderKeyInput) (cpd.ProviderBinding, error)
	ProviderBinding(ctx context.Context, input cps.WorkspaceInput) (cpd.ProviderBinding, error)
	Preflight(ctx context.Context, input cps.WorkspaceInput) (cpd.PreflightResult, error)
	OpenManagedEnvironment(ctx context.Context, input cps.OpenManagedEnvironmentInput) (cpd.LaunchProjection, error)
	LaunchStatus(ctx context.Context, input cps.LaunchLookupInput) (cpd.LaunchProjection, error)
	Bootstrap(ctx context.Context, input cps.LaunchLookupInput) (cpd.BootstrapProjection, error)
	BindSession(ctx context.Context, input cps.LaunchLookupInput) (map[string]any, error)
	RecordMessage(ctx context.Context, input cps.LaunchLookupInput, message string) (map[string]any, error)
	RecordFile(ctx context.Context, input cps.RecordFileInput) (cps.PublicFileRef, error)
	StartRun(ctx context.Context, input cps.StartRunInput) (cps.PublicRunResult, error)
	Artifact(ctx context.Context, launchID string, artifactRef string) (map[string]any, error)
	BillingSummary(ctx context.Context, input cps.WorkspaceInput) (cps.BillingSummary, error)
	BillingDetails(ctx context.Context, input cps.WorkspaceInput) (cps.BillingDetails, error)
	Resources(ctx context.Context, input cps.WorkspaceInput) (cps.ResourcesProjection, error)
	Release(ctx context.Context, input cps.ReleaseInput) (cps.ReleaseResult, error)
}

type bindProviderKeyRequest struct {
	TenantID       string `json:"tenantId"`
	PortalUserID   string `json:"portalUserId"`
	UserID         string `json:"userId"`
	WorkspaceID    string `json:"workspaceId"`
	APIKey         string `json:"apiKey"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type workspaceRequest struct {
	WorkspaceID string `json:"workspaceId"`
}

type openManagedEnvironmentRequest struct {
	TenantID       string `json:"tenantId"`
	PortalUserID   string `json:"portalUserId"`
	UserID         string `json:"userId"`
	WorkspaceID    string `json:"workspaceId"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type recordFileRequest struct {
	FileName     string `json:"fileName"`
	RelativePath string `json:"relativePath"`
	ContentType  string `json:"contentType"`
	SizeBytes    int64  `json:"sizeBytes"`
}

type startRunRequest struct {
	Message   string   `json:"message"`
	FileRefs  []string `json:"fileRefs"`
	ToolName  string   `json:"toolName"`
	RequestID string   `json:"requestId"`
}

type messageRequest struct {
	Message string `json:"message"`
}

type releaseRequest struct {
	WorkspaceID       string `json:"workspaceId"`
	ResourceBindingID string `json:"resourceBindingId"`
	StopBilling       bool   `json:"stopBilling"`
	IdempotencyKey    string `json:"idempotencyKey"`
}

func RegisterControlPlaneRoutes(api *gin.RouterGroup, service ControlPlaneService) {
	api.GET("/provider/binding", getProviderBinding(service))
	api.POST("/provider/bind", bindProviderKey(service))
	api.POST("/provider/preflight", providerPreflight(service))
	api.POST("/opl/entry/preflight", providerPreflight(service))
	api.POST("/v22/production/bootstrap/plan", productionBootstrapContractPlan())
	api.POST("/v22/production/bootstrap/commit", productionBootstrapContractCommit())
	api.POST("/v22/production/package-c-operation/plan", productionPackageCOperationContractPlan())
	api.POST("/v22/production/package-c-operation/commit", productionPackageCOperationContractCommit())
	api.POST("/v22/production/ledger/plan", productionLedgerContractPlan())
	api.POST("/v22/production/ledger/commit", productionLedgerContractCommit())
	api.POST("/v22/production/commercial-ledger/plan", productionCommercialLedgerContractPlan())
	api.POST("/v22/production/commercial-ledger/commit", productionCommercialLedgerContractCommit())
	api.POST("/v22/production/workspace-lifecycle/plan", productionWorkspaceLifecycleContractPlan())
	api.POST("/v22/production/workspace-lifecycle/commit", productionWorkspaceLifecycleContractCommit())
	api.POST("/v22/production/canary/plan", productionCanaryContractPlan())
	api.POST("/v22/production/canary/commit", productionCanaryContractCommit())
	api.POST("/v22/users/prepare", prepareUser())
	api.POST("/v22/users/credit", creditUser())
	api.POST("/v22/provider-key", bindProviderKey(service))
	api.POST("/v22/managed-environment/readiness", managedEnvironmentReadiness(service))
	api.POST("/v22/managed-environment/open", openManagedEnvironment(service))
	api.POST("/v22/managed-environment/release", releaseManagedEnvironment(service))
	api.POST("/opl/launch", openManagedEnvironment(service))
	api.GET("/opl/launch-status/:launchId", launchStatus(service))
	api.GET("/opl/bootstrap", bootstrap(service))
	api.POST("/opl/sessions/bind", bindSession(service))
	api.POST("/opl/messages", recordMessage(service))
	api.GET("/opl/messages/:messageId/status", messageStatus())
	api.POST("/opl/files", recordFile(service))
	api.POST("/opl/runs", startRun(service))
	api.GET("/opl/artifacts/:artifactRef", artifact(service))
	api.GET("/billing/summary", billingSummary(service))
	api.GET("/billing/details", billingDetails(service))
	api.GET("/costs/summary", costsSummary(service))
	api.GET("/costs/workspace", costsSummary(service))
	api.GET("/costs/run", runCost())
	api.GET("/platform-provisioned-resources", resources(service))
}

func getProviderBinding(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		binding, err := service.ProviderBinding(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, binding)
	}
}

func bindProviderKey(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request bindProviderKeyRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		binding, err := service.BindProviderKey(ctx.Request.Context(), cps.BindProviderKeyInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, "workspace-local-rc"),
			RawProviderKey: request.APIKey,
			IdempotencyKey: defaultString(request.IdempotencyKey, "bind-provider-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, mergeOK(binding))
	}
}

func providerPreflight(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request workspaceRequest
		_ = ctx.ShouldBindJSON(&request)
		result, err := service.Preflight(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: defaultString(request.WorkspaceID, workspaceIDFromQuery(ctx), "workspace-local-rc")})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

func managedEnvironmentReadiness(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request workspaceRequest
		_ = ctx.ShouldBindJSON(&request)
		result, err := service.Preflight(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: defaultString(request.WorkspaceID, workspaceIDFromQuery(ctx), "workspace-local-rc")})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		if !result.Ok {
			ctx.JSON(http.StatusPreconditionRequired, result)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}

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
			"actions":             []string{"suspend", "resume", "delete"},
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

func prepareUser() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "source": "go-control-plane", "status": "prepared"})
	}
}

func creditUser() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "source": "go-control-plane", "balance": 100, "currency": "CNY"})
	}
}

func openManagedEnvironment(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request openManagedEnvironmentRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		launch, err := service.OpenManagedEnvironment(ctx.Request.Context(), cps.OpenManagedEnvironmentInput{
			TenantID:       defaultString(request.TenantID, "tenant-local-rc"),
			PortalUserID:   defaultString(request.PortalUserID, request.UserID, "user-local-rc"),
			WorkspaceID:    defaultString(request.WorkspaceID, "workspace-local-rc"),
			IdempotencyKey: defaultString(request.IdempotencyKey, "open-managed-environment-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, launch)
	}
}

func launchStatus(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		launch, err := service.LaunchStatus(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: ctx.Param("launchId")})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, launch)
	}
}

func bootstrap(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.Bootstrap(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: launchIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func bindSession(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BindSession(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: launchIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func recordMessage(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request messageRequest
		_ = ctx.ShouldBindJSON(&request)
		payload, err := service.RecordMessage(ctx.Request.Context(), cps.LaunchLookupInput{LaunchID: launchIDFromQuery(ctx)}, request.Message)
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func messageStatus() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "messageId": ctx.Param("messageId"), "status": "succeeded"})
	}
}

func recordFile(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request recordFileRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.RecordFile(ctx.Request.Context(), cps.RecordFileInput{
			LaunchID:     launchIDFromQuery(ctx),
			FileName:     request.FileName,
			RelativePath: request.RelativePath,
			ContentType:  request.ContentType,
			SizeBytes:    request.SizeBytes,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func startRun(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request startRunRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.StartRun(ctx.Request.Context(), cps.StartRunInput{
			LaunchID:  launchIDFromQuery(ctx),
			Message:   request.Message,
			FileRefs:  request.FileRefs,
			ToolName:  request.ToolName,
			RequestID: request.RequestID,
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func artifact(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.Artifact(ctx.Request.Context(), launchIDFromQuery(ctx), ctx.Param("artifactRef"))
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func billingSummary(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BillingSummary(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func billingDetails(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BillingDetails(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func costsSummary(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.BillingSummary(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"source": "go-control-plane", "type": "local-rc", "totals": payload.Totals, "items": []any{}})
	}
}

func runCost() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"source": "go-control-plane", "type": "local-rc", "taskRef": ctx.Query("taskRef"), "cost": gin.H{"cpuCost": 1.25, "gpuCost": 0, "storageCost": 0.1, "totalCost": 1.35, "pricingSource": "local-rc-deterministic"}})
	}
}

func resources(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		payload, err := service.Resources(ctx.Request.Context(), cps.WorkspaceInput{WorkspaceID: workspaceIDFromQuery(ctx)})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func releaseManagedEnvironment(service ControlPlaneService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var request releaseRequest
		if err := ctx.ShouldBindJSON(&request); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "invalid_json"})
			return
		}
		payload, err := service.Release(ctx.Request.Context(), cps.ReleaseInput{
			WorkspaceID:       defaultString(request.WorkspaceID, "workspace-local-rc"),
			ResourceBindingID: request.ResourceBindingID,
			StopBilling:       request.StopBilling,
			IdempotencyKey:    defaultString(request.IdempotencyKey, "release-local-rc"),
		})
		if err != nil {
			writeControlPlaneError(ctx, err)
			return
		}
		ctx.JSON(http.StatusOK, payload)
	}
}

func writeControlPlaneError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, cpd.ErrProviderKeyRequired):
		ctx.JSON(http.StatusPreconditionRequired, gin.H{"ok": false, "error": "provider_key_required"})
	case errors.Is(err, cpd.ErrLaunchNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "launch_not_found"})
	case errors.Is(err, cpd.ErrResourceNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"ok": false, "error": "resource_not_found"})
	case errors.Is(err, cpd.ErrWorkspaceRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "workspace_required"})
	case errors.Is(err, cpd.ErrIdempotencyKeyRequired):
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "idempotency_key_required"})
	default:
		ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "control_plane_operation_failed"})
	}
}

func workspaceIDFromQuery(ctx *gin.Context) string {
	return defaultString(ctx.Query("workspaceId"), ctx.Query("workspace_id"), "workspace-local-rc")
}

func launchIDFromQuery(ctx *gin.Context) string {
	return defaultString(ctx.Query("launchId"), ctx.Query("launch_id"))
}

func defaultString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func mergeOK(value any) gin.H {
	return gin.H{"ok": true, "tenantId": field(value, "TenantID"), "portalUserId": field(value, "PortalUserID"), "workspaceId": field(value, "WorkspaceID"), "providerBound": field(value, "ProviderBound"), "providerKeyRef": field(value, "ProviderKeyRef"), "boundStatus": field(value, "BoundStatus")}
}

func field(value any, name string) any {
	if binding, ok := value.(cpd.ProviderBinding); ok {
		switch name {
		case "TenantID":
			return binding.TenantID
		case "PortalUserID":
			return binding.PortalUserID
		case "WorkspaceID":
			return binding.WorkspaceID
		case "ProviderBound":
			return binding.ProviderBound
		case "ProviderKeyRef":
			return binding.ProviderKeyRef
		case "BoundStatus":
			return binding.BoundStatus
		default:
			return ""
		}
	}
	return ""
}
