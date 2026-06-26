package controlplane

import (
	"context"
	"errors"
	"strings"
	"time"

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
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	InvocationMode string
	RuntimePlanID  string
	StoragePlanID  string
	SessionID      string
	TaskRef        string
	TaskIntent     string
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

type RuntimeGatePlanRequirement struct {
	RuntimePlanID string `json:"runtimePlanId"`
	StoragePlanID string `json:"storagePlanId"`
	Compute       string `json:"compute"`
	Storage       string `json:"storage"`
}

type RuntimeGateBalanceRequirement struct {
	Currency           string  `json:"currency"`
	MinRequiredBalance float64 `json:"minRequiredBalance"`
	CurrentBalance     float64 `json:"currentBalance"`
	AvailableBalance   float64 `json:"availableBalance"`
	ActiveFreeze       float64 `json:"activeFreeze"`
}

type RuntimeGateCommercialAction struct {
	Action              string                        `json:"action"`
	Reason              string                        `json:"reason"`
	WorkspaceID         string                        `json:"workspaceId"`
	SessionID           string                        `json:"sessionId"`
	TaskRef             string                        `json:"taskRef"`
	TaskIntent          string                        `json:"taskIntent"`
	RequiredPlan        string                        `json:"requiredPlan"`
	PlanRequirement     RuntimeGatePlanRequirement    `json:"planRequirement"`
	BalanceRequirement  RuntimeGateBalanceRequirement `json:"balanceRequirement"`
	MedOPLDeeplink      string                        `json:"medoplDeeplink"`
	ReturnToOPLDeeplink string                        `json:"returnToOplDeeplink"`
	ReturnToOPLTask     RuntimeReturnToOPLTask        `json:"returnToOplTaskContract"`
	CanClaim            []string                      `json:"canClaim"`
	CannotClaim         []string                      `json:"cannotClaim"`
}

type RuntimeGateCommercialActionContract struct {
	PrimaryAction      RuntimeGateCommercialAction     `json:"primaryAction"`
	AvailableActions   []RuntimeGateCommercialAction   `json:"availableActions"`
	PurchaseProjection RuntimePurchaseActionProjection `json:"purchaseProjection"`
}

type RuntimePurchaseActionLink struct {
	Action string `json:"action"`
	Label  string `json:"label"`
	Href   string `json:"href"`
	Method string `json:"method"`
}

type RuntimePurchaseActionProjection struct {
	WorkspaceID              string                    `json:"workspaceId"`
	SessionID                string                    `json:"sessionId"`
	TaskRef                  string                    `json:"taskRef"`
	TaskIntent               string                    `json:"taskIntent"`
	RequiredPlan             string                    `json:"requiredPlan"`
	SelectedPlanID           string                    `json:"selectedPlanId"`
	Balance                  float64                   `json:"balance"`
	AvailableBalance         float64                   `json:"availableBalance"`
	ActiveFreeze             float64                   `json:"activeFreeze"`
	MinRequiredBalance       float64                   `json:"minRequiredBalance"`
	CanOpenRuntimeStorage    bool                      `json:"canOpenRuntimeStorage"`
	SelectPlanAction         RuntimePurchaseActionLink `json:"selectPlanAction"`
	RechargeOrCreditAction   RuntimePurchaseActionLink `json:"rechargeOrCreditAction"`
	OpenRuntimeStorageAction RuntimePurchaseActionLink `json:"openRuntimeStorageAction"`
	ReturnToOplAction        RuntimePurchaseActionLink `json:"returnToOplAction"`
	ReturnToOPLTask          RuntimeReturnToOPLTask    `json:"returnToOplTaskContract"`
	CanClaim                 []string                  `json:"canClaim"`
	CannotClaim              []string                  `json:"cannotClaim"`
}

type RuntimeReturnToOPLTask struct {
	ResumeAction        string   `json:"resumeAction"`
	ResumeMethod        string   `json:"resumeMethod"`
	WorkspaceID         string   `json:"workspaceId"`
	SessionID           string   `json:"sessionId"`
	TaskRef             string   `json:"taskRef"`
	TaskIntent          string   `json:"taskIntent"`
	ReturnToOPLDeeplink string   `json:"returnToOplDeeplink"`
	RequiredConsumer    string   `json:"requiredConsumer"`
	CanClaim            []string `json:"canClaim"`
	CannotClaim         []string `json:"cannotClaim"`
}

type RuntimeGateProjection struct {
	Ok                    bool                                `json:"ok"`
	ProductOwner          string                              `json:"productOwner"`
	PrimaryConsumer       string                              `json:"primaryConsumer"`
	ConsumerRole          string                              `json:"consumerRole"`
	OrdinaryChatOwner     string                              `json:"ordinaryChatOwner"`
	RuntimeRequiredOwner  string                              `json:"runtimeRequiredOwner"`
	WorkspaceID           string                              `json:"workspaceId"`
	WorkspaceBindingID    string                              `json:"workspaceBindingId"`
	InvocationMode        string                              `json:"invocationMode"`
	MedOPLRuntimeRequired bool                                `json:"medoplRuntimeRequired"`
	ProviderKeyStatus     string                              `json:"providerKeyStatus"`
	ProviderKeyRef        string                              `json:"providerKeyRef,omitempty"`
	RuntimePlanID         string                              `json:"runtimePlanId"`
	RuntimeBindingID      string                              `json:"runtimeBindingId,omitempty"`
	RuntimeState          string                              `json:"runtimeState"`
	StoragePlanID         string                              `json:"storagePlanId"`
	StorageBindingID      string                              `json:"storageBindingId,omitempty"`
	StorageState          string                              `json:"storageState"`
	NodePoolProjection    NodePoolProjection                  `json:"nodePoolProjection"`
	Billing               RuntimeGateBilling                  `json:"billing"`
	Release               RuntimeGateRelease                  `json:"release"`
	ConsumerProjection    RuntimeGateConsumerProjection       `json:"consumerProjection"`
	CommercialAdmission   RuntimeGateCommercialAdmission      `json:"commercialAdmission"`
	ActionContract        RuntimeGateCommercialActionContract `json:"actionContract"`
	NextAction            string                              `json:"nextAction"`
	CannotClaim           []string                            `json:"cannotClaim"`
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

	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID == "" {
		return cpd.LaunchProjection{}, cpd.ErrWorkspaceRequired
	}
	binding, err := service.store.ProviderBindingByWorkspace(ctx, strings.TrimSpace(input.WorkspaceID))
	if errors.Is(err, cprepo.ErrNotFound) {
		return cpd.LaunchProjection{}, cpd.ErrProviderKeyRequired
	}
	if err != nil {
		return cpd.LaunchProjection{}, err
	}
	if launch, ok, err := service.activeLaunchForWorkspace(ctx, strings.TrimSpace(input.WorkspaceID)); err != nil {
		return cpd.LaunchProjection{}, err
	} else if ok {
		return launch, nil
	}
	if _, err := service.ensureCommercialAccountCanOpen(ctx, strings.TrimSpace(input.WorkspaceID)); err != nil {
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
	if err := service.ensureCommercialRuntimeHold(ctx, launch, input); err != nil {
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
		CommercialAdmission:   RuntimeGateCommercialAdmission{WorkspaceExists: true, PlanSelected: true, QuotaAvailable: true, Allowed: true, Decision: "not_required", Reason: "ordinary_chat_or_api_only"},
		ProviderKeyStatus:     "not_required_for_ordinary_chat",
		NextAction:            "continue_in_opl_webui",
		CannotClaim:           runtimeGateCannotClaim(),
		MedOPLRuntimeRequired: false,
	}
	projection.ActionContract = runtimeGateCommercialActionContract(input, projection, "continue_in_opl_webui")
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
	projection.CommercialAdmission = service.runtimeGateCommercialAdmission(ctx, workspaceID, false, runtimeGateActionReason(projection))
	projection.ActionContract = runtimeGateCommercialActionContract(input, projection, "provider_key_required")

	binding, err := service.store.ProviderBindingByWorkspace(ctx, workspaceID)
	if errors.Is(err, cprepo.ErrNotFound) {
		projection.CommercialAdmission = service.runtimeGateCommercialAdmission(ctx, workspaceID, false, "provider_key_required")
		return projection, nil
	}
	if err != nil {
		return RuntimeGateProjection{}, err
	}
	projection.ProviderKeyStatus = binding.BoundStatus
	projection.ProviderKeyRef = binding.ProviderKeyRef
	projection.NextAction = "open_medopl_runtime"
	if wallet, err := service.runtimeGateWallet(ctx, workspaceID); err == nil {
		reason := "runtime_storage_not_opened"
		if wallet.AvailableBalance < commercialRuntimeHoldAmount {
			reason = "insufficient_balance"
		}
		projection.CommercialAdmission = service.runtimeGateCommercialAdmissionWithWallet(ctx, workspaceID, true, reason, wallet)
		projection.ActionContract = runtimeGateCommercialActionContractWithWallet(input, projection, reason, wallet)
	} else if errors.Is(err, cprepo.ErrNotFound) {
		projection.CommercialAdmission = service.runtimeGateCommercialAdmission(ctx, workspaceID, true, "account_required")
		projection.ActionContract = runtimeGateCommercialActionContract(input, projection, "account_required")
	} else {
		return RuntimeGateProjection{}, err
	}

	resources, err := service.store.ListResources(ctx, workspaceID)
	if err != nil {
		return RuntimeGateProjection{}, err
	}
	if len(resources) == 0 {
		projection.RuntimeState = "not_opened"
		projection.StorageState = "not_opened"
		projection.CommercialAdmission = service.runtimeGateCommercialAdmission(ctx, workspaceID, true, "runtime_storage_not_opened")
		if wallet, err := service.runtimeGateWallet(ctx, workspaceID); err == nil {
			reason := "runtime_storage_not_opened"
			if wallet.AvailableBalance < commercialRuntimeHoldAmount {
				reason = "insufficient_balance"
			}
			projection.CommercialAdmission = service.runtimeGateCommercialAdmissionWithWallet(ctx, workspaceID, true, reason, wallet)
			projection.ActionContract = runtimeGateCommercialActionContractWithWallet(input, projection, reason, wallet)
		} else if errors.Is(err, cprepo.ErrNotFound) {
			projection.CommercialAdmission = service.runtimeGateCommercialAdmission(ctx, workspaceID, true, "account_required")
			projection.ActionContract = runtimeGateCommercialActionContract(input, projection, "account_required")
		} else {
			return RuntimeGateProjection{}, err
		}
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
		projection.Billing.FrozenAmount = service.activeCommercialHoldAmount(ctx, resource.WorkspaceID)
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
	reason := runtimeGateActionReason(projection)
	if wallet, err := service.runtimeGateWallet(ctx, workspaceID); err == nil {
		projection.CommercialAdmission = service.runtimeGateCommercialAdmissionWithWallet(ctx, workspaceID, projection.ProviderKeyRef != "", reason, wallet)
		projection.ActionContract = runtimeGateCommercialActionContractWithWallet(input, projection, reason, wallet)
	} else if errors.Is(err, cprepo.ErrNotFound) {
		projection.CommercialAdmission = service.runtimeGateCommercialAdmission(ctx, workspaceID, projection.ProviderKeyRef != "", "account_required")
		projection.ActionContract = runtimeGateCommercialActionContract(input, projection, "account_required")
	} else {
		return RuntimeGateProjection{}, err
	}
	return projection, nil
}

func (service *Service) activeLaunchForWorkspace(ctx context.Context, workspaceID string) (cpd.LaunchProjection, bool, error) {
	resources, err := service.store.ListResources(ctx, workspaceID)
	if err != nil {
		return cpd.LaunchProjection{}, false, err
	}
	activeBindingIDs := make(map[string]struct{})
	for _, resource := range resources {
		if resource.WorkspaceID != workspaceID || resource.Status != cpd.ResourceStatusActive {
			continue
		}
		ledger, err := service.store.ResourceBindingLedgerByID(ctx, resource.ResourceBindingID)
		if err != nil && !errors.Is(err, cprepo.ErrNotFound) {
			return cpd.LaunchProjection{}, false, err
		}
		if err == nil && (ledger.Status == cpd.ResourceBindingStatusReleased || ledger.Status == cpd.ResourceBindingStatusFailed || ledger.Status == cpd.ResourceBindingStatusCleanupRequired) {
			continue
		}
		activeBindingIDs[resource.ResourceBindingID] = struct{}{}
	}
	if len(activeBindingIDs) == 0 {
		return cpd.LaunchProjection{}, false, nil
	}
	launches, err := service.store.ListLaunches(ctx, workspaceID)
	if err != nil {
		return cpd.LaunchProjection{}, false, err
	}
	for _, launch := range launches {
		if launch.WorkspaceID == workspaceID && launch.LaunchStatus == cpd.LaunchStatusReady {
			if _, ok := activeBindingIDs[launch.ResourceBindingID]; ok {
				return launch, true, nil
			}
		}
	}
	return cpd.LaunchProjection{}, false, nil
}

func (service *Service) ensureCommercialRuntimeHold(ctx context.Context, launch cpd.LaunchProjection, input OpenManagedEnvironmentInput) error {
	account, err := service.store.BusinessAccountByWorkspace(ctx, launch.WorkspaceID)
	if err != nil {
		return err
	}
	return service.store.SaveBillingEvent(ctx, cpd.BillingEvent{
		ID:                   "billing-hold-" + stableID(launch.WorkspaceID+":"+launch.ResourceBindingID+":"+launch.LaunchID),
		TenantID:             firstNonEmpty(account.TenantID, input.TenantID),
		WorkspaceID:          launch.WorkspaceID,
		Type:                 "hold",
		Status:               "active",
		IdempotencyKey:       "commercial-runtime-hold:" + launch.ResourceBindingID + ":" + launch.LaunchID,
		Amount:               commercialRuntimeHoldAmount,
		Currency:             firstNonEmpty(account.Currency, "CNY"),
		Reason:               "resource_preauth_freeze",
		OwnerScope:           "go-control-plane",
		ResourceBindingID:    launch.ResourceBindingID,
		BillingAttributionID: "billing-" + shortID(launch.WorkspaceID),
		SourceEventID:        launch.LaunchID,
		SourceEventType:      "resource.open",
		CreatedAt:            service.now().UTC().Format(time.RFC3339),
	})
}

func (service *Service) activeCommercialHoldAmount(ctx context.Context, workspaceID string) float64 {
	events, err := service.store.ListBillingEvents(ctx, workspaceID)
	if err != nil {
		return 0
	}
	wallet := walletFromCommercialLedger(ledgerFromBillingEvents(events))
	if wallet.ActiveFreeze > 0 {
		return wallet.ActiveFreeze
	}
	for _, event := range events {
		if event.Type == "hold" && event.Reason == "resource_preauth_freeze" {
			return 0
		}
	}
	return 0
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

func (service *Service) runtimeGateWallet(ctx context.Context, workspaceID string) (Wallet, error) {
	account, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID)
	if err != nil {
		return Wallet{}, err
	}
	events, err := service.store.ListBillingEvents(ctx, workspaceID)
	if err != nil {
		return Wallet{}, err
	}
	credits, err := service.store.ListCreditEvents(ctx, workspaceID)
	if err != nil {
		return Wallet{}, err
	}
	wallet := walletFromCommercialLedger(appendCreditLedgerItems(ledgerFromBillingEvents(events), credits))
	if len(credits) == 0 && wallet.Balance == 0 && account.Balance > 0 {
		wallet.Balance = account.Balance
		wallet.AvailableBalance = maxFloat(0, wallet.Balance-wallet.ActiveFreeze)
	}
	return wallet, nil
}

func runtimeGateCommercialActionContract(input RuntimeGateInput, projection RuntimeGateProjection, reason string) RuntimeGateCommercialActionContract {
	return runtimeGateCommercialActionContractWithWallet(input, projection, reason, Wallet{
		Balance:          0,
		ActiveFreeze:     projection.Billing.FrozenAmount,
		Frozen:           projection.Billing.FrozenAmount,
		AvailableBalance: 0,
	})
}

func runtimeGateCommercialActionContractWithWallet(input RuntimeGateInput, projection RuntimeGateProjection, reason string, wallet Wallet) RuntimeGateCommercialActionContract {
	actions := []RuntimeGateCommercialAction{
		runtimeGateCommercialAction(input, projection, "open_medopl_purchase", reason, wallet),
		runtimeGateCommercialAction(input, projection, "select_plan", reason, wallet),
		runtimeGateCommercialAction(input, projection, "recharge_or_credit_required", reason, wallet),
		runtimeGateCommercialAction(input, projection, "open_runtime_storage", reason, wallet),
		runtimeGateCommercialAction(input, projection, "return_to_opl_task", reason, wallet),
	}
	primary := actions[0]
	switch reason {
	case "account_required", "insufficient_balance":
		primary = actions[2]
	case "runtime_storage_not_opened", "runtime_storage_released", "runtime_storage_failed":
		primary = actions[3]
	case "runtime_storage_ready":
		primary = actions[4]
	case "provider_key_required", "continue_in_opl_webui":
		primary = actions[0]
	case "plan_required":
		primary = actions[1]
	}
	return RuntimeGateCommercialActionContract{
		PrimaryAction:      primary,
		AvailableActions:   actions,
		PurchaseProjection: RuntimePurchaseActionProjectionFromQuery(primary),
	}
}

func RuntimePurchaseActionProjectionFromQuery(action RuntimeGateCommercialAction) RuntimePurchaseActionProjection {
	canOpen := action.BalanceRequirement.AvailableBalance >= action.BalanceRequirement.MinRequiredBalance
	base := "?workspaceId=" + action.WorkspaceID +
		"&runtimePlanId=" + action.PlanRequirement.RuntimePlanID +
		"&storagePlanId=" + action.PlanRequirement.StoragePlanID +
		"&taskIntent=" + action.TaskIntent +
		"&sessionId=" + action.SessionID +
		"&taskRef=" + action.TaskRef
	return RuntimePurchaseActionProjection{
		WorkspaceID:              action.WorkspaceID,
		SessionID:                action.SessionID,
		TaskRef:                  action.TaskRef,
		TaskIntent:               action.TaskIntent,
		RequiredPlan:             action.RequiredPlan,
		SelectedPlanID:           action.PlanRequirement.RuntimePlanID,
		Balance:                  action.BalanceRequirement.CurrentBalance,
		AvailableBalance:         action.BalanceRequirement.AvailableBalance,
		ActiveFreeze:             action.BalanceRequirement.ActiveFreeze,
		MinRequiredBalance:       action.BalanceRequirement.MinRequiredBalance,
		CanOpenRuntimeStorage:    canOpen,
		SelectPlanAction:         RuntimePurchaseActionLink{Action: "select_plan", Label: "选择托管套餐", Href: "/packages" + base, Method: "POST /api/lab-packages/activate"},
		RechargeOrCreditAction:   RuntimePurchaseActionLink{Action: "recharge_or_credit_required", Label: "充值或申请授信", Href: "/usage" + base, Method: "POST /api/v22/users/credit"},
		OpenRuntimeStorageAction: RuntimePurchaseActionLink{Action: "open_runtime_storage", Label: "开通计算资源和存储空间", Href: "/compute" + base, Method: "POST /api/v22/managed-environment/open"},
		ReturnToOplAction:        RuntimePurchaseActionLink{Action: "return_to_opl_task", Label: "返回 OPL 继续任务", Href: action.ReturnToOPLDeeplink, Method: "GET"},
		ReturnToOPLTask:          action.ReturnToOPLTask,
		CanClaim:                 []string{"purchase_action_projection", "internal_credit_or_grant_path", "existing_runtime_storage_open_path", "return_to_opl_task_contract"},
		CannotClaim:              []string{"external_psp_settlement", "full_opl_webui_resume_implementation", "production_canary_commercial_closure"},
	}
}

func runtimeGateCommercialAction(input RuntimeGateInput, projection RuntimeGateProjection, action string, reason string, wallet Wallet) RuntimeGateCommercialAction {
	workspaceID := firstNonEmpty(projection.WorkspaceID, input.WorkspaceID, "workspace-local-rc")
	taskIntent := firstNonEmpty(input.TaskIntent, "research")
	sessionID := strings.TrimSpace(input.SessionID)
	taskRef := strings.TrimSpace(input.TaskRef)
	runtimePlanID := firstNonEmpty(projection.RuntimePlanID, input.RuntimePlanID, "starter_2c4g_10gb")
	storagePlanID := firstNonEmpty(projection.StoragePlanID, input.StoragePlanID, "workspace_10gb")
	returnToOPLDeeplink := runtimeGateReturnToOPLDeeplink(workspaceID, taskIntent, sessionID, taskRef)
	return RuntimeGateCommercialAction{
		Action:       action,
		Reason:       reason,
		WorkspaceID:  workspaceID,
		SessionID:    sessionID,
		TaskRef:      taskRef,
		TaskIntent:   taskIntent,
		RequiredPlan: runtimePlanID,
		PlanRequirement: RuntimeGatePlanRequirement{
			RuntimePlanID: runtimePlanID,
			StoragePlanID: storagePlanID,
			Compute:       "2c4g",
			Storage:       "10gb",
		},
		BalanceRequirement: RuntimeGateBalanceRequirement{
			Currency:           firstNonEmpty(projection.Billing.Currency, "CNY"),
			MinRequiredBalance: commercialRuntimeHoldAmount,
			CurrentBalance:     wallet.Balance,
			AvailableBalance:   wallet.AvailableBalance,
			ActiveFreeze:       wallet.ActiveFreeze,
		},
		MedOPLDeeplink:      runtimeGateMedOPLDeeplink(action, workspaceID, runtimePlanID, storagePlanID, taskIntent, sessionID, taskRef),
		ReturnToOPLDeeplink: returnToOPLDeeplink,
		ReturnToOPLTask:     runtimeReturnToOPLTaskContract(workspaceID, taskIntent, sessionID, taskRef, returnToOPLDeeplink),
		CanClaim: []string{
			"runtime_required_action_contract",
			"internal_billing_projection_only",
			"return_to_opl_task_contract",
		},
		CannotClaim: []string{
			"external_psp_settlement",
			"complete_purchase_page",
			"full_opl_webui_resume_implementation",
			"production_canary_commercial_closure",
		},
	}
}

func runtimeReturnToOPLTaskContract(workspaceID string, taskIntent string, sessionID string, taskRef string, deeplink string) RuntimeReturnToOPLTask {
	return RuntimeReturnToOPLTask{
		ResumeAction:        "return_to_opl_task",
		ResumeMethod:        "GET",
		WorkspaceID:         workspaceID,
		SessionID:           sessionID,
		TaskRef:             taskRef,
		TaskIntent:          taskIntent,
		ReturnToOPLDeeplink: deeplink,
		RequiredConsumer:    "opl-webui",
		CanClaim:            []string{"return_to_opl_task_contract"},
		CannotClaim:         []string{"full_opl_webui_resume_implementation", "opl_domain_quality_verdict"},
	}
}

func runtimeGateActionReason(projection RuntimeGateProjection) string {
	if projection.RuntimeState == "ready" && projection.StorageState == "ready" {
		return "runtime_storage_ready"
	}
	if projection.RuntimeState == "released" || projection.StorageState == "destroyed" {
		return "runtime_storage_released"
	}
	if projection.RuntimeState == "failed" || projection.RuntimeState == "cleanup_required" {
		return "runtime_storage_failed"
	}
	if projection.RuntimeState == "provisioning" || projection.RuntimeState == "releasing" {
		return "runtime_storage_pending"
	}
	return "runtime_storage_not_opened"
}

func runtimeGateMedOPLDeeplink(action string, workspaceID string, runtimePlanID string, storagePlanID string, taskIntent string, sessionID string, taskRef string) string {
	path := "/packages"
	if action == "recharge_or_credit_required" {
		path = "/usage"
	}
	if action == "open_runtime_storage" {
		path = "/compute"
	}
	if action == "return_to_opl_task" {
		path = "/opl"
	}
	return path + "?workspaceId=" + workspaceID +
		"&runtimePlanId=" + runtimePlanID +
		"&storagePlanId=" + storagePlanID +
		"&taskIntent=" + taskIntent +
		"&sessionId=" + sessionID +
		"&taskRef=" + taskRef
}

func runtimeGateReturnToOPLDeeplink(workspaceID string, taskIntent string, sessionID string, taskRef string) string {
	return "/opl?workspaceId=" + workspaceID +
		"&taskIntent=" + taskIntent +
		"&sessionId=" + sessionID +
		"&taskRef=" + taskRef
}
