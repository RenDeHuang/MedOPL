package controlplane

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/secret/providersecret"
)

type Service struct {
	store              cprepo.Store
	now                func() time.Time
	providerSecretSink ProviderSecretSink
	oplGatewayURL      string
	runtimeBridgeURL   string
}

type ProviderSecretSink interface {
	WriteProviderSecret(ref string, secret providersecret.Secret) error
}

type Option func(*Service)

type BindProviderKeyInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	RawProviderKey string
	IdempotencyKey string
}

type WorkspaceInput struct {
	WorkspaceID string
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

type RuntimeGateProjection struct {
	Ok                    bool               `json:"ok"`
	ProductOwner          string             `json:"productOwner"`
	PrimaryConsumer       string             `json:"primaryConsumer"`
	ConsumerRole          string             `json:"consumerRole"`
	OrdinaryChatOwner     string             `json:"ordinaryChatOwner"`
	RuntimeRequiredOwner  string             `json:"runtimeRequiredOwner"`
	WorkspaceID           string             `json:"workspaceId"`
	WorkspaceBindingID    string             `json:"workspaceBindingId"`
	InvocationMode        string             `json:"invocationMode"`
	MedOPLRuntimeRequired bool               `json:"medoplRuntimeRequired"`
	ProviderKeyStatus     string             `json:"providerKeyStatus"`
	ProviderKeyRef        string             `json:"providerKeyRef,omitempty"`
	RuntimePlanID         string             `json:"runtimePlanId"`
	RuntimeBindingID      string             `json:"runtimeBindingId,omitempty"`
	RuntimeState          string             `json:"runtimeState"`
	StoragePlanID         string             `json:"storagePlanId"`
	StorageBindingID      string             `json:"storageBindingId,omitempty"`
	StorageState          string             `json:"storageState"`
	NodePoolProjection    NodePoolProjection `json:"nodePoolProjection"`
	Billing               RuntimeGateBilling `json:"billing"`
	Release               RuntimeGateRelease `json:"release"`
	NextAction            string             `json:"nextAction"`
	CannotClaim           []string           `json:"cannotClaim"`
}

type LaunchLookupInput struct {
	LaunchID string
}

type RecordFileInput struct {
	LaunchID     string
	FileName     string
	RelativePath string
	ContentType  string
	SizeBytes    int64
}

type PublicFileRef struct {
	Ok             bool   `json:"ok"`
	FileRef        string `json:"fileRef"`
	WorkspaceID    string `json:"workspaceId"`
	ProviderKeyRef string `json:"providerKeyRef"`
	File           struct {
		FileRef      string `json:"fileRef"`
		Name         string `json:"name"`
		RelativePath string `json:"relativePath"`
		SizeBytes    int64  `json:"sizeBytes"`
		ContentType  string `json:"contentType"`
		Status       string `json:"status"`
	} `json:"file"`
}

type StartRunInput struct {
	LaunchID  string
	Message   string
	FileRefs  []string
	ToolName  string
	RequestID string
}

type PublicRun struct {
	TraceID string `json:"traceId"`
	Status  string `json:"status"`
}

type PublicArtifact struct {
	ArtifactRef    string `json:"artifactRef"`
	WorkspaceID    string `json:"workspaceId,omitempty"`
	ProviderKeyRef string `json:"providerKeyRef,omitempty"`
	Kind           string `json:"kind,omitempty"`
	Name           string `json:"name"`
	RelativePath   string `json:"relativePath"`
	SizeBytes      int64  `json:"sizeBytes"`
	ContentType    string `json:"contentType"`
}

type PublicRunResult struct {
	Ok        bool             `json:"ok"`
	Status    string           `json:"status"`
	StatusURL string           `json:"statusUrl,omitempty"`
	Run       PublicRun        `json:"run"`
	Artifacts []PublicArtifact `json:"artifacts"`
}

type BillingSummary struct {
	Ok        bool   `json:"ok"`
	Source    string `json:"source"`
	Wallet    Wallet `json:"wallet"`
	Totals    Costs  `json:"totals"`
	Breakdown struct {
		CPUCost        float64 `json:"cpuCost"`
		GPUCost        float64 `json:"gpuCost"`
		StorageCost    float64 `json:"storageCost"`
		VPnCost        float64 `json:"vpnCost"`
		TrafficCost    float64 `json:"trafficCost"`
		OtherCloudCost float64 `json:"otherCloudCost"`
		CloudSource    string  `json:"cloudSource"`
		PricingSource  string  `json:"pricingSource"`
	} `json:"breakdown"`
	Summary struct {
		SelectedCost   float64 `json:"selectedCost"`
		RunCount       int     `json:"runCount"`
		WorkspaceCount int     `json:"workspaceCount"`
		PendingCost    float64 `json:"pendingCost"`
		ExactCost      float64 `json:"exactCost"`
	} `json:"summary"`
	SupportBoundary SupportBoundary `json:"supportBoundary"`
	Filter          BillingFilter   `json:"filter"`
	TodayCost       float64         `json:"todayCost"`
	Ledger          []LedgerItem    `json:"ledger,omitempty"`
}

type BillingDetails struct {
	Ok               bool         `json:"ok"`
	Source           string       `json:"source"`
	TaskCosts        []TaskCost   `json:"taskCosts"`
	TaskPagination   Pagination   `json:"taskPagination"`
	RunCosts         []RunCost    `json:"runCosts"`
	RunPagination    Pagination   `json:"runPagination"`
	Ledger           []LedgerItem `json:"ledger"`
	LedgerPagination Pagination   `json:"ledgerPagination"`
	Trend            Trend        `json:"trend"`
}

type Wallet struct {
	Balance          float64 `json:"balance"`
	ActiveFreeze     float64 `json:"activeFreeze"`
	Frozen           float64 `json:"frozen"`
	AvailableBalance float64 `json:"availableBalance"`
}

type Costs struct {
	CPUCost   float64 `json:"cpuCost"`
	GPUCost   float64 `json:"gpuCost"`
	PVCost    float64 `json:"pvCost"`
	TotalCost float64 `json:"totalCost"`
}

type SupportBoundary struct {
	SupportStatus             string   `json:"supportStatus"`
	FundingStatus             string   `json:"fundingStatus"`
	GraceStatus               string   `json:"graceStatus"`
	FileRetentionStatus       string   `json:"fileRetentionStatus"`
	FailedRunBillingStatus    string   `json:"failedRunBillingStatus"`
	CanStartPaidRun           bool     `json:"canStartPaidRun"`
	CanDownloadExistingOutput bool     `json:"canDownloadExistingOutput"`
	BillingCopy               string   `json:"billingCopy"`
	UserCopy                  string   `json:"userCopy"`
	ActionRequired            []string `json:"actionRequired"`
	Amounts                   struct {
		WalletBalance      float64 `json:"walletBalance"`
		ActiveFreeze       float64 `json:"activeFreeze"`
		AvailableBalance   float64 `json:"availableBalance"`
		MinRequiredBalance float64 `json:"minRequiredBalance"`
	} `json:"amounts"`
}

type BillingFilter struct {
	Range string `json:"range"`
	From  string `json:"from"`
	To    string `json:"to"`
}

type TaskCost struct {
	Slug        string  `json:"slug"`
	Title       string  `json:"title"`
	TotalCost   float64 `json:"totalCost"`
	CPUCost     float64 `json:"cpuCost"`
	GPUCost     float64 `json:"gpuCost"`
	StorageCost float64 `json:"storageCost"`
	RunCount    int     `json:"runCount"`
}

type RunCost struct {
	TaskRef       string  `json:"taskRef"`
	WorkspaceID   string  `json:"workspaceId"`
	CPUCost       float64 `json:"cpuCost"`
	GPUCost       float64 `json:"gpuCost"`
	StorageCost   float64 `json:"storageCost"`
	TotalCost     float64 `json:"totalCost"`
	StartedAt     string  `json:"startedAt"`
	EndedAt       string  `json:"endedAt"`
	PricingSource string  `json:"pricingSource"`
	RunStatus     string  `json:"runStatus"`
}

type LedgerItem struct {
	ID              string  `json:"id,omitempty"`
	Type            string  `json:"type"`
	Amount          float64 `json:"amount"`
	Reason          string  `json:"reason,omitempty"`
	OwnerScope      string  `json:"ownerScope,omitempty"`
	SourceEventID   string  `json:"sourceEventId,omitempty"`
	SourceEventType string  `json:"sourceEventType,omitempty"`
	CreatedAt       string  `json:"createdAt"`
}

type Pagination struct {
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
	Total    int `json:"total"`
}

type Trend struct {
	Labels  []string  `json:"labels"`
	Total   []float64 `json:"total"`
	CPU     []float64 `json:"cpu"`
	GPU     []float64 `json:"gpu"`
	Storage []float64 `json:"storage"`
}

type ResourcesProjection struct {
	Ok               bool                  `json:"ok"`
	Source           string                `json:"source"`
	ComputeResources []map[string]any      `json:"computeResources"`
	FileSpaces       []map[string]any      `json:"fileSpaces"`
	Protections      []map[string]any      `json:"protections"`
	Items            []cpd.ManagedResource `json:"items"`
	Summary          ResourcesSummary      `json:"summary"`
}

type ResourcesSummary struct {
	ComputeResources         int     `json:"computeResources"`
	FileSpaces               int     `json:"fileSpaces"`
	ActiveEnvironments       int     `json:"activeEnvironments"`
	InactiveEnvironments     int     `json:"inactiveEnvironments"`
	ActiveProtections        int     `json:"activeProtections"`
	FrozenAmount             float64 `json:"frozenAmount"`
	ConsumedAmount           float64 `json:"consumedAmount"`
	RemainingAmount          float64 `json:"remainingAmount"`
	ReleasedProtectionAmount float64 `json:"releasedProtectionAmount"`
	ComputeResourceCount     int     `json:"computeResourceCount"`
	FileSpaceCount           int     `json:"fileSpaceCount"`
	EnvironmentCount         int     `json:"environmentCount"`
	ProtectionCount          int     `json:"protectionCount"`
}

type ReleaseInput struct {
	WorkspaceID       string
	ResourceBindingID string
	StopBilling       bool
	IdempotencyKey    string
}

type ReleaseResult struct {
	Ok             bool                `json:"ok"`
	Status         string              `json:"status"`
	BillingStopped bool                `json:"billingStopped"`
	Resource       cpd.ManagedResource `json:"resource"`
	AuditEvent     cpd.AuditEvent      `json:"auditEvent"`
}

func WithProviderSecretStore(sink ProviderSecretSink) Option {
	return func(service *Service) {
		service.providerSecretSink = sink
	}
}

func WithGatewayURLs(oplGatewayURL string, runtimeBridgeURL string) Option {
	return func(service *Service) {
		service.oplGatewayURL = strings.TrimRight(strings.TrimSpace(oplGatewayURL), "/")
		service.runtimeBridgeURL = strings.TrimRight(strings.TrimSpace(runtimeBridgeURL), "/")
	}
}

func NewService(store cprepo.Store, options ...Option) *Service {
	service := &Service{store: store, now: time.Now}
	for _, option := range options {
		if option != nil {
			option(service)
		}
	}
	return service
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
		Ok:                    true,
		ProductOwner:          "medopl",
		PrimaryConsumer:       "opl-webui",
		ConsumerRole:          "entry_and_chat_surface",
		OrdinaryChatOwner:     "opl-webui",
		RuntimeRequiredOwner:  "medopl",
		WorkspaceID:           workspaceID,
		WorkspaceBindingID:    "workspace-binding-" + shortID(workspaceID),
		InvocationMode:        mode,
		RuntimePlanID:         firstNonEmpty(input.RuntimePlanID, "starter_2c4g_10gb"),
		StoragePlanID:         firstNonEmpty(input.StoragePlanID, "workspace_10gb"),
		RuntimeState:          "not_required",
		StorageState:          "not_required",
		NodePoolProjection:    NodePoolProjection{State: "not_required", CustomerVisible: false},
		Billing:               RuntimeGateBilling{FreezeStatus: "not_required", Currency: "CNY"},
		Release:               RuntimeGateRelease{CanReleaseRuntime: false, DestroyStorage: "not_requested", StopBilling: "not_required"},
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
	projection.RuntimeBindingID = resource.ResourceBindingID
	projection.StorageBindingID = "storage-" + shortID(resource.WorkspaceID+":"+resource.ResourceBindingID)
	projection.NodePoolProjection = NodePoolProjection{
		NodePoolRef:     "nodepool-" + shortID(resource.WorkspaceID+":"+resource.ResourceBindingID),
		State:           runtimeGateResourceState(resource.Status),
		CustomerVisible: false,
	}
	projection.RuntimeState = runtimeGateResourceState(resource.Status)
	projection.StorageState = "ready"
	if storageDestroyReceiptRecorded(ctx, service.store, workspaceID, resource.ResourceBindingID) {
		projection.StorageState = "destroyed"
	}
	projection.Billing.FreezeStatus = resource.StopBilling.Status
	if resource.StopBilling.Status == cpd.BillingStatusActive {
		projection.Billing.FrozenAmount = 10
	}
	destroyStorage := "requires_explicit_user_intent"
	if projection.StorageState == "destroyed" {
		destroyStorage = "completed"
	}
	projection.Release = RuntimeGateRelease{
		CanReleaseRuntime: resource.Status == cpd.ResourceStatusActive,
		DestroyStorage:    destroyStorage,
		StopBilling:       resource.StopBilling.Status,
	}
	if resource.Status == cpd.ResourceStatusActive {
		projection.NextAction = "run_in_opl_webui_with_medopl_runtime"
	} else {
		projection.NextAction = "open_medopl_runtime"
	}
	return projection, nil
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

func (service *Service) RecordFile(ctx context.Context, input RecordFileInput) (PublicFileRef, error) {
	launch, err := service.LaunchStatus(ctx, LaunchLookupInput{LaunchID: input.LaunchID})
	if err != nil {
		return PublicFileRef{}, err
	}
	if strings.TrimSpace(input.FileName) == "" {
		return PublicFileRef{}, cpd.ErrFileNameRequired
	}
	relativePath := strings.TrimSpace(input.RelativePath)
	if relativePath == "" {
		relativePath = "inputs/" + strings.TrimSpace(input.FileName)
	}
	refID := "file-" + shortID(launch.LaunchID+":"+relativePath)
	result := PublicFileRef{Ok: true, FileRef: refID, WorkspaceID: launch.WorkspaceID, ProviderKeyRef: launch.ProviderKeyRef}
	result.File.FileRef = refID
	result.File.Name = strings.TrimSpace(input.FileName)
	result.File.RelativePath = relativePath
	result.File.SizeBytes = input.SizeBytes
	result.File.ContentType = strings.TrimSpace(input.ContentType)
	if result.File.ContentType == "" {
		result.File.ContentType = "application/octet-stream"
	}
	result.File.Status = "available"
	recordedAt := service.now().UTC().Format(time.RFC3339)
	if err := service.store.SaveFile(ctx, cpd.FileRecord{
		FileRef:        refID,
		LaunchID:       launch.LaunchID,
		WorkspaceID:    launch.WorkspaceID,
		ProviderKeyRef: launch.ProviderKeyRef,
		Name:           result.File.Name,
		RelativePath:   result.File.RelativePath,
		SizeBytes:      result.File.SizeBytes,
		ContentType:    result.File.ContentType,
		Status:         result.File.Status,
		CreatedAt:      recordedAt,
	}); err != nil {
		return PublicFileRef{}, err
	}
	if err := service.store.SaveAuditEvent(ctx, cpd.AuditEvent{
		ID:                "audit-" + shortID(refID+":file-upload"),
		Kind:              cpd.AuditKindFileUpload,
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		Status:            "recorded",
		IdempotencyKey:    refID,
		CreatedAt:         recordedAt,
	}); err != nil {
		return PublicFileRef{}, err
	}
	return result, nil
}

func (service *Service) StartRun(ctx context.Context, input StartRunInput) (PublicRunResult, error) {
	launch, err := service.LaunchStatus(ctx, LaunchLookupInput{LaunchID: input.LaunchID})
	if err != nil {
		return PublicRunResult{}, err
	}
	if len(input.FileRefs) == 0 {
		return PublicRunResult{}, cpd.ErrFileRefRequired
	}
	for _, fileRef := range input.FileRefs {
		file, err := service.store.FileByRef(ctx, strings.TrimSpace(fileRef))
		if errors.Is(err, cprepo.ErrNotFound) {
			return PublicRunResult{}, cpd.ErrFileRefRequired
		}
		if err != nil {
			return PublicRunResult{}, err
		}
		if file.LaunchID != launch.LaunchID || file.WorkspaceID != launch.WorkspaceID {
			return PublicRunResult{}, cpd.ErrFileRefRequired
		}
	}
	runID := strings.TrimSpace(input.RequestID)
	if runID == "" {
		runID = "run-" + shortID(launch.LaunchID+":"+strings.Join(input.FileRefs, ","))
	}
	artifactRef := "artifact-" + shortID(runID+":result")
	started := service.now().UTC()
	result := PublicRunResult{
		Ok:        true,
		Status:    "succeeded",
		StatusURL: "/api/opl/runs/" + runID + "/status",
		Run:       PublicRun{TraceID: "trace-" + shortID(runID), Status: "succeeded"},
		Artifacts: []PublicArtifact{{
			ArtifactRef:    artifactRef,
			WorkspaceID:    launch.WorkspaceID,
			ProviderKeyRef: launch.ProviderKeyRef,
			Kind:           "outputs",
			Name:           "result.md",
			RelativePath:   "outputs/result.md",
			SizeBytes:      256,
			ContentType:    "text/markdown",
		}},
	}
	if err := service.store.SaveRun(ctx, cpd.RunRecord{
		RunID:          runID,
		LaunchID:       launch.LaunchID,
		WorkspaceID:    launch.WorkspaceID,
		ProviderKeyRef: launch.ProviderKeyRef,
		TraceID:        result.Run.TraceID,
		Status:         result.Run.Status,
		ToolName:       strings.TrimSpace(input.ToolName),
		Message:        strings.TrimSpace(input.Message),
		FileRefs:       input.FileRefs,
		CreatedAt:      started.Format(time.RFC3339),
	}); err != nil {
		return PublicRunResult{}, err
	}
	artifact := result.Artifacts[0]
	if err := service.store.SaveArtifact(ctx, cpd.ArtifactRecord{
		ArtifactRef:    artifact.ArtifactRef,
		RunID:          runID,
		LaunchID:       launch.LaunchID,
		WorkspaceID:    artifact.WorkspaceID,
		ProviderKeyRef: artifact.ProviderKeyRef,
		Kind:           artifact.Kind,
		Name:           artifact.Name,
		RelativePath:   artifact.RelativePath,
		SizeBytes:      artifact.SizeBytes,
		ContentType:    artifact.ContentType,
		CreatedAt:      started.Format(time.RFC3339),
	}); err != nil {
		return PublicRunResult{}, err
	}
	for _, event := range []cpd.AuditEvent{
		{
			ID:                "audit-" + shortID(runID+":run"),
			Kind:              cpd.AuditKindRunSucceeded,
			WorkspaceID:       launch.WorkspaceID,
			ResourceBindingID: launch.ResourceBindingID,
			Status:            "recorded",
			IdempotencyKey:    runID,
			CreatedAt:         started.Format(time.RFC3339),
		},
		{
			ID:                "audit-" + shortID(artifactRef+":artifact"),
			Kind:              cpd.AuditKindArtifactAvailable,
			WorkspaceID:       launch.WorkspaceID,
			ResourceBindingID: launch.ResourceBindingID,
			Status:            "recorded",
			IdempotencyKey:    artifactRef,
			CreatedAt:         started.Format(time.RFC3339),
		},
	} {
		if err := service.store.SaveAuditEvent(ctx, event); err != nil {
			return PublicRunResult{}, err
		}
	}
	return result, nil
}

func (service *Service) Artifact(ctx context.Context, launchID string, artifactRef string) (map[string]any, error) {
	launch, err := service.LaunchStatus(ctx, LaunchLookupInput{LaunchID: launchID})
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(artifactRef) == "" {
		return nil, cpd.ErrArtifactRefRequired
	}
	record, err := service.store.ArtifactByRef(ctx, strings.TrimSpace(artifactRef))
	if errors.Is(err, cprepo.ErrNotFound) {
		return nil, cpd.ErrArtifactRefRequired
	}
	if err != nil {
		return nil, err
	}
	if record.LaunchID != launch.LaunchID || record.WorkspaceID != launch.WorkspaceID {
		return nil, cpd.ErrArtifactRefRequired
	}
	if _, err := service.store.RunByID(ctx, record.RunID); errors.Is(err, cprepo.ErrNotFound) {
		return nil, cpd.ErrArtifactRefRequired
	} else if err != nil {
		return nil, err
	}
	artifact := PublicArtifact{
		ArtifactRef:    record.ArtifactRef,
		WorkspaceID:    record.WorkspaceID,
		ProviderKeyRef: record.ProviderKeyRef,
		Kind:           record.Kind,
		Name:           record.Name,
		RelativePath:   record.RelativePath,
		SizeBytes:      record.SizeBytes,
		ContentType:    record.ContentType,
	}
	return map[string]any{"ok": true, "artifactRef": artifact.ArtifactRef, "artifact": artifact}, nil
}

func (service *Service) BillingSummary(ctx context.Context, input WorkspaceInput) (BillingSummary, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	events, err := service.store.ListAuditEvents(ctx, workspaceID)
	if err != nil {
		return BillingSummary{}, err
	}
	runCount := 0
	for _, event := range events {
		if event.Kind == cpd.AuditKindRunSucceeded {
			runCount++
		}
	}
	totalCost := float64(runCount) * 1.25
	summary := BillingSummary{
		Ok:        true,
		Source:    "go-control-plane",
		Wallet:    Wallet{Balance: 100, ActiveFreeze: 10, Frozen: 10, AvailableBalance: 90},
		Totals:    Costs{CPUCost: totalCost, GPUCost: 0, PVCost: 0.1, TotalCost: totalCost + 0.1},
		Filter:    BillingFilter{Range: "local-rc", From: "", To: ""},
		TodayCost: totalCost + 0.1,
		Ledger:    ledgerFromEvents(events),
	}
	summary.Breakdown.CPUCost = totalCost
	summary.Breakdown.StorageCost = 0.1
	summary.Breakdown.CloudSource = "local-go-control-plane"
	summary.Breakdown.PricingSource = "local-rc-deterministic"
	summary.Summary.SelectedCost = totalCost + 0.1
	summary.Summary.RunCount = runCount
	summary.Summary.WorkspaceCount = 1
	summary.Summary.ExactCost = totalCost + 0.1
	summary.SupportBoundary.SupportStatus = "local_rc"
	summary.SupportBoundary.FundingStatus = "funded"
	summary.SupportBoundary.GraceStatus = "active"
	summary.SupportBoundary.FileRetentionStatus = "active"
	summary.SupportBoundary.FailedRunBillingStatus = "not_charged"
	summary.SupportBoundary.CanStartPaidRun = true
	summary.SupportBoundary.CanDownloadExistingOutput = true
	summary.SupportBoundary.BillingCopy = "Go control-plane local RC billing projection."
	summary.SupportBoundary.UserCopy = "本地 RC 账务投影可用。"
	summary.SupportBoundary.ActionRequired = []string{}
	summary.SupportBoundary.Amounts.WalletBalance = summary.Wallet.Balance
	summary.SupportBoundary.Amounts.ActiveFreeze = summary.Wallet.ActiveFreeze
	summary.SupportBoundary.Amounts.AvailableBalance = summary.Wallet.AvailableBalance
	summary.SupportBoundary.Amounts.MinRequiredBalance = 1
	return summary, nil
}

func (service *Service) BillingDetails(ctx context.Context, input WorkspaceInput) (BillingDetails, error) {
	summary, err := service.BillingSummary(ctx, input)
	if err != nil {
		return BillingDetails{}, err
	}
	now := service.now().UTC().Format(time.RFC3339)
	return BillingDetails{
		Ok:               true,
		Source:           "go-control-plane",
		TaskCosts:        []TaskCost{{Slug: firstNonEmpty(input.WorkspaceID, "workspace-local-rc"), Title: "Go local RC workspace", TotalCost: summary.Totals.TotalCost, CPUCost: summary.Totals.CPUCost, StorageCost: summary.Breakdown.StorageCost, RunCount: summary.Summary.RunCount}},
		TaskPagination:   Pagination{Page: 1, PageSize: 20, Total: 1},
		RunCosts:         []RunCost{{TaskRef: "run-local-rc", WorkspaceID: firstNonEmpty(input.WorkspaceID, "workspace-local-rc"), CPUCost: summary.Totals.CPUCost, StorageCost: summary.Breakdown.StorageCost, TotalCost: summary.Totals.TotalCost, StartedAt: now, EndedAt: now, PricingSource: "local-rc-deterministic", RunStatus: "succeeded"}},
		RunPagination:    Pagination{Page: 1, PageSize: 20, Total: 1},
		Ledger:           summary.Ledger,
		LedgerPagination: Pagination{Page: 1, PageSize: 20, Total: len(summary.Ledger)},
		Trend:            Trend{Labels: []string{"local-rc"}, Total: []float64{summary.Totals.TotalCost}, CPU: []float64{summary.Totals.CPUCost}, GPU: []float64{0}, Storage: []float64{summary.Breakdown.StorageCost}},
	}, nil
}

func (service *Service) Resources(ctx context.Context, input WorkspaceInput) (ResourcesProjection, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID == "" {
		return ResourcesProjection{}, cpd.ErrWorkspaceRequired
	}
	items, err := service.store.ListResources(ctx, workspaceID)
	if err != nil {
		return ResourcesProjection{}, err
	}
	active := 0
	for _, item := range items {
		if item.Status == cpd.ResourceStatusActive {
			active++
		}
	}
	count := len(items)
	return ResourcesProjection{
		Ok:               true,
		Source:           "go-control-plane",
		ComputeResources: []map[string]any{},
		FileSpaces:       []map[string]any{},
		Protections:      []map[string]any{},
		Items:            items,
		Summary: ResourcesSummary{
			ComputeResources:     count,
			FileSpaces:           count,
			ActiveEnvironments:   active,
			InactiveEnvironments: count - active,
			ActiveProtections:    active,
			RemainingAmount:      90,
			ComputeResourceCount: count,
			FileSpaceCount:       count,
			EnvironmentCount:     count,
			ProtectionCount:      count,
		},
	}, nil
}

func (service *Service) Release(ctx context.Context, input ReleaseInput) (ReleaseResult, error) {
	resource, err := service.store.ResourceByBinding(ctx, strings.TrimSpace(input.ResourceBindingID))
	if errors.Is(err, cprepo.ErrNotFound) {
		return ReleaseResult{}, cpd.ErrResourceNotFound
	} else if err != nil {
		return ReleaseResult{}, err
	}
	if resource.WorkspaceID != strings.TrimSpace(input.WorkspaceID) {
		return ReleaseResult{}, cpd.ErrResourceNotFound
	}
	released, audit, err := cpd.ReleaseManagedResource(resource, cpd.ReleaseInput{
		WorkspaceID:       input.WorkspaceID,
		ResourceBindingID: input.ResourceBindingID,
		StopBilling:       input.StopBilling,
		IdempotencyKey:    input.IdempotencyKey,
		ReleasedAt:        service.now(),
	})
	if err != nil {
		return ReleaseResult{}, err
	}
	if err := service.store.SaveResource(ctx, released); err != nil {
		return ReleaseResult{}, err
	}
	if err := service.store.SaveAuditEvent(ctx, audit); err != nil {
		return ReleaseResult{}, err
	}
	return ReleaseResult{Ok: true, Status: released.Status, BillingStopped: released.StopBilling.Status == cpd.BillingStatusStopped, Resource: released, AuditEvent: audit}, nil
}

func ledgerFromEvents(events []cpd.AuditEvent) []LedgerItem {
	if len(events) == 0 {
		return []LedgerItem{{ID: "ledger-local-rc-open", Type: "hold", Amount: 10, Reason: "local_rc_environment_open", OwnerScope: "go-control-plane", CreatedAt: time.Time{}.Format(time.RFC3339)}}
	}
	items := make([]LedgerItem, 0, len(events))
	for _, event := range events {
		entryType := "debit"
		amount := 1.25
		switch event.Kind {
		case cpd.AuditKindFileUpload:
			entryType = "hold"
			amount = 0.1
		case cpd.AuditKindArtifactAvailable:
			entryType = "debit"
			amount = 0
		case cpd.AuditKindResourceRelease, cpd.AuditKindStorageDestroy:
			entryType = "release"
			amount = 0
		}
		items = append(items, LedgerItem{
			ID:              event.ID,
			Type:            entryType,
			Amount:          amount,
			Reason:          event.Status,
			OwnerScope:      "go-control-plane",
			SourceEventID:   event.ID,
			SourceEventType: event.Kind,
			CreatedAt:       event.CreatedAt,
		})
	}
	return items
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

func runtimeGateCannotClaim() []string {
	return []string{
		"medopl_owns_ordinary_chat",
		"medopl_owns_opl_research_quality",
		"runtime_required_without_medopl_runtime",
		"storage_destroy_without_user_intent",
	}
}

func shortID(value string) string {
	sum := 0
	for _, r := range value {
		sum += int(r)
	}
	return fmt.Sprintf("%x", sum)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
