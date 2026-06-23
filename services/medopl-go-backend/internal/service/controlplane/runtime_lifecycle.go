package controlplane

import (
	"context"
	"errors"
	"strings"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/secret/providersecret"
)

type BindProviderKeyInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	RawProviderKey string
	IdempotencyKey string
}

type OpenManagedEnvironmentInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	IdempotencyKey string
}

type RuntimeGateInput struct {
	WorkspaceID    string
	InvocationMode string
	RuntimePlanID  string
	StoragePlanID  string
}

type NodePoolProjection struct {
	NodePoolRef     string `json:"nodePoolRef"`
	State           string `json:"state"`
	CustomerVisible bool   `json:"customerVisible"`
}

type RuntimeGateBilling struct {
	FreezeStatus string  `json:"freezeStatus"`
	FrozenAmount float64 `json:"frozenAmount"`
	Currency     string  `json:"currency"`
}

type RuntimeGateRelease struct {
	CanReleaseRuntime bool   `json:"canReleaseRuntime"`
	DestroyStorage    string `json:"destroyStorage"`
	StopBilling       string `json:"stopBilling"`
}

type RuntimeGateConsumerProjection struct {
	ChatSurface     string `json:"chatSurface"`
	RunSurface      string `json:"runSurface"`
	UploadEnabled   bool   `json:"uploadEnabled"`
	RunEnabled      bool   `json:"runEnabled"`
	ArtifactEnabled bool   `json:"artifactEnabled"`
	ReleaseAction   string `json:"releaseAction"`
	StorageAction   string `json:"storageAction"`
}

type RuntimeGateProjection struct {
	Ok                    bool                          `json:"ok"`
	ProductOwner          string                        `json:"productOwner"`
	PrimaryConsumer       string                        `json:"primaryConsumer"`
	ConsumerRole          string                        `json:"consumerRole"`
	OrdinaryChatOwner     string                        `json:"ordinaryChatOwner"`
	RuntimeRequiredOwner  string                        `json:"runtimeRequiredOwner"`
	WorkspaceID           string                        `json:"workspaceId"`
	WorkspaceBindingID    string                        `json:"workspaceBindingId"`
	InvocationMode        string                        `json:"invocationMode"`
	MedOPLRuntimeRequired bool                          `json:"medoplRuntimeRequired"`
	ProviderKeyStatus     string                        `json:"providerKeyStatus"`
	ProviderKeyRef        string                        `json:"providerKeyRef,omitempty"`
	RuntimePlanID         string                        `json:"runtimePlanId"`
	RuntimeBindingID      string                        `json:"runtimeBindingId,omitempty"`
	RuntimeState          string                        `json:"runtimeState"`
	StoragePlanID         string                        `json:"storagePlanId"`
	StorageBindingID      string                        `json:"storageBindingId,omitempty"`
	StorageState          string                        `json:"storageState"`
	NodePoolProjection    NodePoolProjection            `json:"nodePoolProjection"`
	Billing               RuntimeGateBilling            `json:"billing"`
	Release               RuntimeGateRelease            `json:"release"`
	ConsumerProjection    RuntimeGateConsumerProjection `json:"consumerProjection"`
	NextAction            string                        `json:"nextAction"`
	CannotClaim           []string                      `json:"cannotClaim"`
}

type LaunchLookupInput struct {
	LaunchID string
}

func (service *Service) BindProviderKey(ctx context.Context, input BindProviderKeyInput) (cpd.ProviderBinding, error) {
	binding, err := cpd.NewProviderBinding(cpd.BindProviderKeyInput{
		TenantID:       input.TenantID,
		PortalUserID:   input.PortalUserID,
		WorkspaceID:    input.WorkspaceID,
		RawProviderKey: input.RawProviderKey,
		IdempotencyKey: input.IdempotencyKey,
		CreatedAt:      service.now(),
	})
	if err != nil {
		return cpd.ProviderBinding{}, err
	}
	if err := service.store.SaveProviderBinding(ctx, binding); err != nil {
		return cpd.ProviderBinding{}, err
	}
	if service.providerSecretSink != nil {
		if err := service.providerSecretSink.WriteProviderSecret(binding.ProviderKeyRef, providersecret.Secret{
			Provider: "gflabtoken",
			Source:   "user_input",
			APIKey:   input.RawProviderKey,
		}); err != nil {
			return cpd.ProviderBinding{}, err
		}
	}
	return binding, nil
}

func (service *Service) ProviderBinding(ctx context.Context, input WorkspaceInput) (cpd.ProviderBinding, error) {
	if strings.TrimSpace(input.WorkspaceID) == "" {
		return cpd.ProviderBinding{}, cpd.ErrWorkspaceRequired
	}
	return service.store.ProviderBindingByWorkspace(ctx, strings.TrimSpace(input.WorkspaceID))
}

func (service *Service) Preflight(ctx context.Context, input WorkspaceInput) (cpd.PreflightResult, error) {
	if strings.TrimSpace(input.WorkspaceID) == "" {
		return cpd.PreflightResult{}, cpd.ErrWorkspaceRequired
	}
	binding, err := service.store.ProviderBindingByWorkspace(ctx, strings.TrimSpace(input.WorkspaceID))
	if errors.Is(err, cprepo.ErrNotFound) {
		return cpd.Preflight(cpd.PreflightInput{WorkspaceID: input.WorkspaceID}), nil
	}
	if err != nil {
		return cpd.PreflightResult{}, err
	}
	return cpd.Preflight(cpd.PreflightInput{WorkspaceID: input.WorkspaceID, Binding: binding}), nil
}

func (service *Service) OpenManagedEnvironment(ctx context.Context, input OpenManagedEnvironmentInput) (cpd.LaunchProjection, error) {
	service.mu.Lock()
	defer service.mu.Unlock()

	binding, err := service.store.ProviderBindingByWorkspace(ctx, strings.TrimSpace(input.WorkspaceID))
	if errors.Is(err, cprepo.ErrNotFound) {
		return cpd.LaunchProjection{}, cpd.ErrProviderKeyRequired
	}
	if err != nil {
		return cpd.LaunchProjection{}, err
	}
	launch, err := cpd.NewLaunch(cpd.LaunchInput{
		TenantID:       input.TenantID,
		PortalUserID:   input.PortalUserID,
		WorkspaceID:    input.WorkspaceID,
		Binding:        binding,
		IdempotencyKey: input.IdempotencyKey,
		CreatedAt:      service.now(),
	})
	if err != nil {
		return cpd.LaunchProjection{}, err
	}
	if service.oplGatewayURL != "" {
		launch.OpenURL = service.oplGatewayURL + "?launchId=" + launch.LaunchID
		launch.OPLWebURL = launch.OpenURL
	}
	if service.runtimeBridgeURL != "" {
		launch.RuntimeURL = service.runtimeBridgeURL
	}
	if err := service.store.SaveLaunch(ctx, launch); err != nil {
		return cpd.LaunchProjection{}, err
	}
	resource := cpd.NewManagedResource(cpd.ResourceInput{
		TenantID:          input.TenantID,
		PortalUserID:      input.PortalUserID,
		WorkspaceID:       input.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
	})
	if err := service.store.SaveResource(ctx, resource); err != nil {
		return cpd.LaunchProjection{}, err
	}
	if err := service.ensureRuntimeLifecycleLedger(ctx, launch, input); err != nil {
		return cpd.LaunchProjection{}, err
	}
	return launch, nil
}

func (service *Service) RuntimeGate(ctx context.Context, input RuntimeGateInput) (RuntimeGateProjection, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID == "" {
		return RuntimeGateProjection{}, cpd.ErrWorkspaceRequired
	}
	mode := strings.TrimSpace(input.InvocationMode)
	if mode == "" {
		mode = "runtime_required"
	}
	projection := RuntimeGateProjection{
		Ok:                   true,
		ProductOwner:         "medopl",
		PrimaryConsumer:      "opl-webui",
		ConsumerRole:         "entry_and_chat_surface",
		OrdinaryChatOwner:    "opl-webui",
		RuntimeRequiredOwner: "medopl",
		WorkspaceID:          workspaceID,
		WorkspaceBindingID:   "workspace-binding-" + shortID(workspaceID),
		InvocationMode:       mode,
		RuntimePlanID:        firstNonEmpty(input.RuntimePlanID, "starter_2c4g_10gb"),
		StoragePlanID:        firstNonEmpty(input.StoragePlanID, "workspace_10gb"),
		RuntimeState:         "not_required",
		StorageState:         "not_required",
		NodePoolProjection:   NodePoolProjection{State: "not_required", CustomerVisible: false},
		Billing:              RuntimeGateBilling{FreezeStatus: "not_required", Currency: "CNY"},
		Release:              RuntimeGateRelease{CanReleaseRuntime: false, DestroyStorage: "not_requested", StopBilling: "not_required"},
		ConsumerProjection: RuntimeGateConsumerProjection{
			ChatSurface:   "opl-webui",
			RunSurface:    "none",
			ReleaseAction: "not_required",
			StorageAction: "not_required",
		},
		ProviderKeyStatus:     "not_required_for_ordinary_chat",
		NextAction:            "continue_in_opl_webui",
		CannotClaim:           runtimeGateCannotClaim(),
		MedOPLRuntimeRequired: false,
	}
	if mode == "api_only" || mode == "ordinary_chat" {
		return projection, nil
	}
	projection.MedOPLRuntimeRequired = true
	projection.RuntimeState = "blocked"
	projection.StorageState = "blocked"
	projection.NodePoolProjection = NodePoolProjection{State: "blocked", CustomerVisible: false}
	projection.Billing = RuntimeGateBilling{FreezeStatus: "pending", Currency: "CNY"}
	projection.Release = RuntimeGateRelease{CanReleaseRuntime: false, DestroyStorage: "requires_runtime_binding", StopBilling: "not_started"}
	projection.ConsumerProjection = RuntimeGateConsumerProjection{
		ChatSurface:   "opl-webui",
		RunSurface:    "blocked_until_medopl_runtime_ready",
		ReleaseAction: "not_started",
		StorageAction: "requires_runtime_binding",
	}
	projection.ProviderKeyStatus = "missing"
	projection.NextAction = "bind_provider_key"

	binding, err := service.store.ProviderBindingByWorkspace(ctx, workspaceID)
	if errors.Is(err, cprepo.ErrNotFound) {
		return projection, nil
	}
	if err != nil {
		return RuntimeGateProjection{}, err
	}
	projection.ProviderKeyStatus = binding.BoundStatus
	projection.ProviderKeyRef = binding.ProviderKeyRef
	projection.NextAction = "open_medopl_runtime"

	resources, err := service.store.ListResources(ctx, workspaceID)
	if err != nil {
		return RuntimeGateProjection{}, err
	}
	if len(resources) == 0 {
		projection.RuntimeState = "not_opened"
		projection.StorageState = "not_opened"
		return projection, nil
	}
	resource := newestResource(resources)
	runtimeState := runtimeGateResourceState(resource.Status)
	nodePoolRef := "nodepool-" + shortID(resource.WorkspaceID+":"+resource.ResourceBindingID)
	if ledger, err := service.store.ResourceBindingLedgerByID(ctx, resource.ResourceBindingID); err == nil {
		runtimeState = runtimeGateLedgerState(ledger.Status)
		if ledger.NodePoolID != "" {
			nodePoolRef = ledger.NodePoolID
		}
	} else if !errors.Is(err, cprepo.ErrNotFound) {
		return RuntimeGateProjection{}, err
	}
	projection.RuntimeBindingID = resource.ResourceBindingID
	projection.StorageBindingID = "storage-" + shortID(resource.WorkspaceID+":"+resource.ResourceBindingID)
	projection.NodePoolProjection = NodePoolProjection{
		NodePoolRef:     nodePoolRef,
		State:           runtimeState,
		CustomerVisible: false,
	}
	projection.RuntimeState = runtimeState
	projection.StorageState = runtimeGateStorageState(resource.StorageState)
	projection.Billing.FreezeStatus = resource.StopBilling.Status
	if resource.StopBilling.Status == cpd.BillingStatusActive {
		projection.Billing.FrozenAmount = 10
	}
	destroyStorage := "requires_explicit_user_intent"
	if projection.StorageState == "destroyed" {
		destroyStorage = "completed"
	}
	projection.Release = RuntimeGateRelease{
		CanReleaseRuntime: resource.Status == cpd.ResourceStatusActive && runtimeState == "ready",
		DestroyStorage:    destroyStorage,
		StopBilling:       resource.StopBilling.Status,
	}
	projection.ConsumerProjection = runtimeGateConsumerProjection(projection.RuntimeState, projection.StorageState, projection.Release)
	if runtimeState == "ready" {
		projection.NextAction = "run_in_opl_webui_with_medopl_runtime"
	} else if runtimeState == "provisioning" || runtimeState == "releasing" {
		projection.NextAction = "wait_for_medopl_runtime"
	} else {
		projection.NextAction = "open_medopl_runtime"
	}
	return projection, nil
}

func (service *Service) ensureRuntimeLifecycleLedger(ctx context.Context, launch cpd.LaunchProjection, input OpenManagedEnvironmentInput) error {
	existing, err := service.store.ResourceBindingLedgerByID(ctx, launch.ResourceBindingID)
	if err == nil {
		if existing.Status == cpd.ResourceBindingStatusReleased || existing.Status == cpd.ResourceBindingStatusFailed || existing.Status == cpd.ResourceBindingStatusCleanupRequired {
			return service.reactivateRuntimeLifecycleLedger(ctx, existing)
		}
		return nil
	}
	if !errors.Is(err, cprepo.ErrNotFound) {
		return err
	}
	createdAt := service.now()
	operationID := "operation-" + shortID(launch.WorkspaceID+":"+launch.ResourceBindingID)
	ledger, err := cpd.NewResourceBindingLedger(cpd.ResourceBindingLedgerInput{
		TenantID:             input.TenantID,
		AccountID:            input.PortalUserID,
		WorkspaceID:          launch.WorkspaceID,
		ResourceBindingID:    launch.ResourceBindingID,
		BillingAttributionID: "billing-" + shortID(launch.WorkspaceID),
		ServerPlanID:         "starter_2c4g_10gb",
		WorkspaceStorageGB:   10,
		CloudProvider:        "medopl-local-rc",
		Region:               "local",
		ClusterID:            "local-control-plane",
		NodePoolName:         "nodepool-" + shortID(launch.WorkspaceID+":"+launch.ResourceBindingID),
		Status:               cpd.ResourceBindingStatusReady,
		CreatedAt:            createdAt,
		OperationID:          operationID,
	})
	if err != nil {
		return err
	}
	operation, err := cpd.NewCloudOperation(cpd.CloudOperationInput{
		OperationID:          operationID,
		ResourceBindingID:    launch.ResourceBindingID,
		TenantID:             ledger.TenantID,
		AccountID:            ledger.AccountID,
		WorkspaceID:          launch.WorkspaceID,
		BillingAttributionID: ledger.BillingAttributionID,
		OperationType:        "runtime_open_local_rc",
		ServerPlanID:         ledger.ServerPlanID,
		WorkspaceStorageGB:   ledger.WorkspaceStorageGB,
		Status:               cpd.ResourceBindingStatusReady,
		CloudProvider:        ledger.CloudProvider,
		Region:               ledger.Region,
		ClusterID:            ledger.ClusterID,
		NodePoolName:         ledger.NodePoolName,
		CloudTagSupport:      ledger.CloudTagSupport,
		CreatedAt:            createdAt,
	})
	if err != nil {
		return err
	}
	if err := service.store.CreateResourceBindingLedger(ctx, ledger); err != nil {
		return err
	}
	return service.store.SaveCloudOperation(ctx, operation)
}

func (service *Service) reactivateRuntimeLifecycleLedger(ctx context.Context, existing cpd.ResourceBindingLedger) error {
	existing.Status = cpd.ResourceBindingStatusReady
	existing.ReleasedAt = ""
	if err := service.store.SaveResourceBindingLedger(ctx, existing); err != nil {
		return err
	}
	operation, err := service.store.CloudOperationByID(ctx, existing.OperationID)
	if errors.Is(err, cprepo.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	operation.Status = cpd.ResourceBindingStatusReady
	operation.CompletedAt = ""
	return service.store.SaveCloudOperation(ctx, operation)
}

func runtimeGateConsumerProjection(runtimeState string, storageState string, release RuntimeGateRelease) RuntimeGateConsumerProjection {
	ready := runtimeState == "ready" && storageState == "ready"
	runSurface := "blocked_until_medopl_runtime_ready"
	if ready {
		runSurface = "opl-webui_with_medopl_runtime"
	}
	releaseAction := "not_available"
	if release.CanReleaseRuntime {
		releaseAction = "release_runtime_stop_billing"
	}
	storageAction := "not_available"
	if storageState == "ready" {
		storageAction = "retain_storage_until_explicit_destroy"
	}
	if storageState == "ready" && !release.CanReleaseRuntime && release.StopBilling == cpd.BillingStatusStopped {
		storageAction = "destroy_storage_explicit_intent"
	}
	if storageState == "destroyed" {
		storageAction = "storage_destroy_completed"
	}
	return RuntimeGateConsumerProjection{
		ChatSurface:     "opl-webui",
		RunSurface:      runSurface,
		UploadEnabled:   ready,
		RunEnabled:      ready,
		ArtifactEnabled: ready,
		ReleaseAction:   releaseAction,
		StorageAction:   storageAction,
	}
}

func (service *Service) LaunchStatus(ctx context.Context, input LaunchLookupInput) (cpd.LaunchProjection, error) {
	if strings.TrimSpace(input.LaunchID) == "" {
		return cpd.LaunchProjection{}, cpd.ErrLaunchRequired
	}
	launch, err := service.store.LaunchByID(ctx, strings.TrimSpace(input.LaunchID))
	if errors.Is(err, cprepo.ErrNotFound) {
		return cpd.LaunchProjection{}, cpd.ErrLaunchNotFound
	}
	return launch, err
}

func (service *Service) Bootstrap(ctx context.Context, input LaunchLookupInput) (cpd.BootstrapProjection, error) {
	launch, err := service.LaunchStatus(ctx, input)
	if err != nil {
		return cpd.BootstrapProjection{}, err
	}
	bootstrap := cpd.NewBootstrap(launch)
	bootstrap.Identity.PortalUserID = "user-local-rc"
	return bootstrap, nil
}

func (service *Service) BindSession(ctx context.Context, input LaunchLookupInput) (map[string]any, error) {
	launch, err := service.LaunchStatus(ctx, input)
	if err != nil {
		return nil, err
	}
	return map[string]any{"ok": true, "launchId": launch.LaunchID, "status": "bound", "runtimeSessionId": launch.RuntimeSessionID, "oplSessionId": launch.OPLSessionID}, nil
}

func (service *Service) RecordMessage(ctx context.Context, input LaunchLookupInput, message string) (map[string]any, error) {
	launch, err := service.LaunchStatus(ctx, input)
	if err != nil {
		return nil, err
	}
	messageID := "message-" + shortID(launch.LaunchID+":"+message)
	return map[string]any{"ok": true, "messageId": messageID, "status": "accepted", "launchId": launch.LaunchID}, nil
}

func newestResource(items []cpd.ManagedResource) cpd.ManagedResource {
	if len(items) == 0 {
		return cpd.ManagedResource{}
	}
	newest := items[len(items)-1]
	for _, item := range items {
		if item.ResourceBindingID > newest.ResourceBindingID {
			newest = item
		}
	}
	return newest
}

func runtimeGateResourceState(status string) string {
	if status == cpd.ResourceStatusReleased {
		return "released"
	}
	if status == cpd.ResourceStatusActive {
		return "ready"
	}
	return firstNonEmpty(status, "unknown")
}

func runtimeGateLedgerState(status string) string {
	switch status {
	case cpd.ResourceBindingStatusRequested,
		cpd.ResourceBindingStatusCreating,
		cpd.ResourceBindingStatusCreated,
		cpd.ResourceBindingStatusScaling:
		return "provisioning"
	case cpd.ResourceBindingStatusReady:
		return "ready"
	case cpd.ResourceBindingStatusReleaseRequested,
		cpd.ResourceBindingStatusDeleting:
		return "releasing"
	case cpd.ResourceBindingStatusReleased:
		return "released"
	case cpd.ResourceBindingStatusFailed:
		return "failed"
	case cpd.ResourceBindingStatusCleanupRequired:
		return "cleanup_required"
	default:
		return runtimeGateResourceState(status)
	}
}

func runtimeGateStorageState(status string) string {
	if status == "" {
		return cpd.StorageStatusReady
	}
	return status
}

func runtimeGateCannotClaim() []string {
	return []string{
		"medopl_owns_ordinary_chat",
		"medopl_owns_opl_research_quality",
		"runtime_required_without_medopl_runtime",
		"storage_destroy_without_user_intent",
	}
}
