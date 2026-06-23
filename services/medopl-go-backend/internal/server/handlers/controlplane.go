package handlers

import (
	"context"

	"github.com/gin-gonic/gin"
	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cps "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
)

type ControlPlaneService interface {
	PrepareBusinessAccount(ctx context.Context, input cps.PrepareBusinessAccountInput) (cps.BusinessAccountProjection, error)
	CreditBusinessAccount(ctx context.Context, input cps.CreditBusinessAccountInput) (cps.BusinessAccountProjection, error)
	BindProviderKey(ctx context.Context, input cps.BindProviderKeyInput) (cpd.ProviderBinding, error)
	ProviderBinding(ctx context.Context, input cps.WorkspaceInput) (cpd.ProviderBinding, error)
	Preflight(ctx context.Context, input cps.WorkspaceInput) (cpd.PreflightResult, error)
	OpenManagedEnvironment(ctx context.Context, input cps.OpenManagedEnvironmentInput) (cpd.LaunchProjection, error)
	RuntimeGate(ctx context.Context, input cps.RuntimeGateInput) (cps.RuntimeGateProjection, error)
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
	DestroyStorage(ctx context.Context, input cps.DestroyStorageInput) (cps.StorageDestroyReceipt, error)
}

type bindProviderKeyRequest struct {
	TenantID       string `json:"tenantId"`
	PortalUserID   string `json:"portalUserId"`
	UserID         string `json:"userId"`
	WorkspaceID    string `json:"workspaceId"`
	APIKey         string `json:"apiKey"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type prepareBusinessAccountRequest struct {
	TenantID     string `json:"tenantId"`
	PortalUserID string `json:"portalUserId"`
	UserID       string `json:"userId"`
	WorkspaceID  string `json:"workspaceId"`
}

type creditBusinessAccountRequest struct {
	TenantID       string  `json:"tenantId"`
	PortalUserID   string  `json:"portalUserId"`
	UserID         string  `json:"userId"`
	WorkspaceID    string  `json:"workspaceId"`
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`
	IdempotencyKey string  `json:"idempotencyKey"`
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

type runtimeGateRequest struct {
	WorkspaceID    string `json:"workspaceId"`
	InvocationMode string `json:"invocationMode"`
	RuntimePlanID  string `json:"runtimePlanId"`
	StoragePlanID  string `json:"storagePlanId"`
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

type destroyStorageRequest struct {
	WorkspaceID       string `json:"workspaceId"`
	ResourceBindingID string `json:"resourceBindingId"`
	StorageBindingID  string `json:"storageBindingId"`
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
	api.POST("/v22/production/external-access-strategy/plan", productionExternalAccessStrategyContractPlan())
	api.POST("/v22/production/external-access-strategy/commit", productionExternalAccessStrategyContractCommit())
	api.POST("/v22/users/prepare", prepareUser(service))
	api.POST("/v22/users/credit", creditUser(service))
	api.POST("/v22/provider-key", bindProviderKey(service))
	api.POST("/v22/managed-environment/readiness", managedEnvironmentReadiness(service))
	api.POST("/v22/managed-environment/open", openManagedEnvironment(service))
	api.POST("/v22/managed-environment/release", releaseManagedEnvironment(service))
	api.POST("/v22/storage/destroy", destroyStorage(service))
	api.POST("/opl/runtime-gate", runtimeGate(service))
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
