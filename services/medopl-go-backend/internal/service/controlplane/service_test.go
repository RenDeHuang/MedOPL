package controlplane

import (
	"context"
	"errors"
	"testing"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceBindsProviderKeyThenOpensLaunchAndBootstrap(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())

	prepareFundedWorkspace(t, ctx, service, "tenant-v22", "user-v22", "workspace-v22", 200, "credit-bootstrap-once")
	binding, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-once",
	})
	if err != nil {
		t.Fatalf("BindProviderKey() error = %v", err)
	}
	if !binding.ProviderBound || binding.ProviderKeyRef == "" {
		t.Fatalf("binding = %+v", binding)
	}

	preflight, err := service.Preflight(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Preflight() error = %v", err)
	}
	if !preflight.Ok || !preflight.ReadyForManagedEnvironment {
		t.Fatalf("preflight = %+v", preflight)
	}

	launch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		IdempotencyKey: "open-once",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}
	if launch.LaunchStatus != cpd.LaunchStatusReady || launch.ProviderKeyRef != binding.ProviderKeyRef {
		t.Fatalf("launch = %+v", launch)
	}

	bootstrap, err := service.Bootstrap(ctx, LaunchLookupInput{LaunchID: launch.LaunchID})
	if err != nil {
		t.Fatalf("Bootstrap() error = %v", err)
	}
	if bootstrap.Identity.RuntimeSessionID != launch.RuntimeSessionID || bootstrap.Identity.OPLSessionID != launch.OPLSessionID {
		t.Fatalf("bootstrap = %+v", bootstrap)
	}
}

func TestServiceRuntimeGateKeepsOrdinaryChatInOPLWebui(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())

	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		WorkspaceID:    "workspace-v22",
		InvocationMode: "ordinary_chat",
		RuntimePlanID:  "starter_2c4g_10gb",
		StoragePlanID:  "workspace_10gb",
	})
	if err != nil {
		t.Fatalf("RuntimeGate() error = %v", err)
	}
	if gate.ProductOwner != "medopl" || gate.PrimaryConsumer != "opl-webui" || gate.ConsumerRole != "entry_and_chat_surface" {
		t.Fatalf("runtime gate owner boundary = %+v", gate)
	}
	if gate.MedOPLRuntimeRequired || gate.OrdinaryChatOwner != "opl-webui" || gate.RuntimeRequiredOwner != "medopl" {
		t.Fatalf("ordinary chat boundary = %+v", gate)
	}
	if gate.NextAction != "continue_in_opl_webui" || gate.ProviderKeyStatus != "not_required_for_ordinary_chat" {
		t.Fatalf("ordinary chat next action = %+v", gate)
	}
	if gate.ConsumerProjection.ChatSurface != "opl-webui" || gate.ConsumerProjection.RunSurface != "none" {
		t.Fatalf("ordinary chat consumer projection = %+v", gate.ConsumerProjection)
	}
	if gate.ConsumerProjection.UploadEnabled || gate.ConsumerProjection.RunEnabled || gate.ConsumerProjection.ArtifactEnabled {
		t.Fatalf("ordinary chat must not project MedOPL runtime actions: %+v", gate.ConsumerProjection)
	}
}

func TestServiceRuntimeGateProjectsMedOPLRuntimeBindingForOPLWebui(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{
		WorkspaceID:    "workspace-v22",
		InvocationMode: "runtime_required",
		RuntimePlanID:  "starter_2c4g_10gb",
		StoragePlanID:  "workspace_10gb",
	})
	if err != nil {
		t.Fatalf("RuntimeGate() error = %v", err)
	}
	if !gate.MedOPLRuntimeRequired || gate.NextAction != "run_in_opl_webui_with_medopl_runtime" {
		t.Fatalf("runtime required gate = %+v", gate)
	}
	if gate.WorkspaceBindingID == "" || gate.RuntimeBindingID != launch.ResourceBindingID || gate.StorageBindingID == "" {
		t.Fatalf("runtime/storage binding projection = %+v", gate)
	}
	if gate.ProviderKeyRef != launch.ProviderKeyRef || gate.ProviderKeyStatus != "bound" {
		t.Fatalf("provider projection = %+v", gate)
	}
	if gate.NodePoolProjection.NodePoolRef == "" || gate.NodePoolProjection.State != "ready" || gate.NodePoolProjection.CustomerVisible {
		t.Fatalf("node pool projection = %+v", gate.NodePoolProjection)
	}
	if gate.Billing.FreezeStatus != "active" || !gate.Release.CanReleaseRuntime || gate.Release.DestroyStorage != "requires_explicit_user_intent" {
		t.Fatalf("billing/release projection = %+v release=%+v", gate.Billing, gate.Release)
	}
	if gate.ConsumerProjection.ChatSurface != "opl-webui" || gate.ConsumerProjection.RunSurface != "opl-webui_with_medopl_runtime" {
		t.Fatalf("runtime consumer surface projection = %+v", gate.ConsumerProjection)
	}
	if !gate.ConsumerProjection.UploadEnabled || !gate.ConsumerProjection.RunEnabled || !gate.ConsumerProjection.ArtifactEnabled {
		t.Fatalf("runtime consumer actions must be enabled for ready runtime/storage: %+v", gate.ConsumerProjection)
	}
	if gate.ConsumerProjection.ReleaseAction != "release_runtime_stop_billing" || gate.ConsumerProjection.StorageAction != "retain_storage_until_explicit_destroy" {
		t.Fatalf("runtime consumer release/storage action = %+v", gate.ConsumerProjection)
	}
}

func TestServiceOpenManagedEnvironmentCreatesCanonicalRuntimeLifecycleLedger(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	ledger, err := service.store.ResourceBindingLedgerByID(ctx, launch.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID() error = %v", err)
	}
	if ledger.WorkspaceID != launch.WorkspaceID || ledger.Status != cpd.ResourceBindingStatusReady {
		t.Fatalf("runtime lifecycle ledger = %+v launch=%+v", ledger, launch)
	}
	if ledger.ServerPlanID != "starter_2c4g_10gb" || ledger.WorkspaceStorageGB != 10 {
		t.Fatalf("runtime lifecycle plan/storage = %+v", ledger)
	}

	secondLaunch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		IdempotencyKey: "open-again-with-active-runtime",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment(active runtime) error = %v", err)
	}
	if secondLaunch.ResourceBindingID != launch.ResourceBindingID {
		t.Fatalf("active runtime must be single binding: first=%s second=%s", launch.ResourceBindingID, secondLaunch.ResourceBindingID)
	}
	ledgers, err := service.store.ListResourceBindingLedgers(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListResourceBindingLedgers() error = %v", err)
	}
	if len(ledgers) != 1 {
		t.Fatalf("open active runtime must not create duplicate lifecycle ledgers: %+v", ledgers)
	}
	resources, err := service.Resources(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("Resources() error = %v", err)
	}
	if resources.Summary.ActiveEnvironments != 1 || len(resources.Items) != 1 {
		t.Fatalf("open active runtime must keep one active resource: %+v", resources)
	}
}

func TestServiceRuntimeGateProjectsRuntimeLifecycleLedgerState(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	if err := service.store.UpdateResourceBindingStatus(ctx, launch.ResourceBindingID, cpd.ResourceBindingStatusCreating); err != nil {
		t.Fatalf("UpdateResourceBindingStatus(creating) error = %v", err)
	}
	provisioning, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(provisioning) error = %v", err)
	}
	if provisioning.RuntimeState != "provisioning" || provisioning.NodePoolProjection.State != "provisioning" {
		t.Fatalf("runtime gate must project provisioning state from ledger: %+v", provisioning)
	}
	if provisioning.ConsumerProjection.UploadEnabled || provisioning.ConsumerProjection.RunEnabled || provisioning.Release.CanReleaseRuntime {
		t.Fatalf("provisioning runtime must not enable upload/run/release actions: %+v", provisioning)
	}

	if err := service.store.UpdateResourceBindingStatus(ctx, launch.ResourceBindingID, cpd.ResourceBindingStatusFailed); err != nil {
		t.Fatalf("UpdateResourceBindingStatus(failed) error = %v", err)
	}
	failed, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(failed) error = %v", err)
	}
	if failed.RuntimeState != "failed" || failed.NextAction != "open_medopl_runtime" {
		t.Fatalf("runtime gate must project failed state and reopen action from ledger: %+v", failed)
	}

	if err := service.store.UpdateResourceBindingStatus(ctx, launch.ResourceBindingID, cpd.ResourceBindingStatusReady); err != nil {
		t.Fatalf("UpdateResourceBindingStatus(ready) error = %v", err)
	}
	ready, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(ready) error = %v", err)
	}
	if ready.RuntimeState != "ready" || !ready.ConsumerProjection.UploadEnabled || !ready.Release.CanReleaseRuntime {
		t.Fatalf("ready runtime must re-enable OPL-Webui upload/run/release projection: %+v", ready)
	}
}

func TestServiceReleaseIsIdempotentAndClosesRuntimeLifecycleLedger(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	first, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-runtime-once",
	})
	if err != nil {
		t.Fatalf("Release(first) error = %v", err)
	}
	second, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-runtime-retry-different-key",
	})
	if err != nil {
		t.Fatalf("Release(second) error = %v", err)
	}
	if second.AuditEventID != first.AuditEventID || second.Resource.Status != cpd.ResourceStatusReleased {
		t.Fatalf("repeated release must return the existing release receipt: first=%+v second=%+v", first, second)
	}
	ledger, err := service.store.ResourceBindingLedgerByID(ctx, launch.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID(after release) error = %v", err)
	}
	if ledger.Status != cpd.ResourceBindingStatusReleased || ledger.ReleasedAt == "" {
		t.Fatalf("release must close runtime lifecycle ledger: %+v", ledger)
	}
	audits, err := service.store.ListAuditEvents(ctx, launch.WorkspaceID)
	if err != nil {
		t.Fatalf("ListAuditEvents() error = %v", err)
	}
	releaseAudits := 0
	for _, audit := range audits {
		if audit.Kind == cpd.AuditKindResourceRelease {
			releaseAudits++
		}
	}
	if releaseAudits != 1 {
		t.Fatalf("release retry must not write duplicate release audit events: %+v", audits)
	}
}

func TestServiceOpenAfterReleaseReactivatesRuntimeLifecycleWithoutStaleReleaseTime(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)
	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-before-reopen",
	}); err != nil {
		t.Fatalf("Release() error = %v", err)
	}

	reopened, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    launch.WorkspaceID,
		IdempotencyKey: "open-after-release",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment(after release) error = %v", err)
	}
	if reopened.ResourceBindingID != launch.ResourceBindingID {
		t.Fatalf("reopen must keep workspace runtime binding stable: first=%s reopened=%s", launch.ResourceBindingID, reopened.ResourceBindingID)
	}
	ledger, err := service.store.ResourceBindingLedgerByID(ctx, launch.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceBindingLedgerByID(after reopen) error = %v", err)
	}
	if ledger.Status != cpd.ResourceBindingStatusReady || ledger.ReleasedAt != "" {
		t.Fatalf("reopen must project ready lifecycle without stale release timestamp: %+v", ledger)
	}
	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(after reopen) error = %v", err)
	}
	if gate.RuntimeState != "ready" || gate.Release.StopBilling != cpd.BillingStatusActive || !gate.ConsumerProjection.RunEnabled {
		t.Fatalf("reopen must restore runnable runtime projection: %+v", gate)
	}
}

func TestServiceFailsClosedWithoutProviderKey(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())

	preflight, err := service.Preflight(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Preflight() error = %v", err)
	}
	if preflight.Ok || preflight.Error != "provider_key_required" {
		t.Fatalf("preflight = %+v", preflight)
	}

	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		IdempotencyKey: "open-once",
	}); !errors.Is(err, cpd.ErrProviderKeyRequired) {
		t.Fatalf("OpenManagedEnvironment() error = %v", err)
	}
}

func TestServiceRecordsFileRunArtifactBillingAuditAndRelease(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "measurements.csv",
		RelativePath: "inputs/measurements.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	if fileRef.FileRef == "" || fileRef.ProviderKeyRef != launch.ProviderKeyRef {
		t.Fatalf("file ref = %+v", fileRef)
	}

	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "analyze file",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-workbench",
		RequestID: "run-v22",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	if runResult.Run.Status != "succeeded" || len(runResult.Artifacts) != 1 {
		t.Fatalf("run result = %+v", runResult)
	}
	if runResult.ArtifactRef == "" || runResult.ArtifactRef != runResult.Artifacts[0].ArtifactRef {
		t.Fatalf("run result top-level artifactRef = %q artifacts = %+v", runResult.ArtifactRef, runResult.Artifacts)
	}
	if runResult.Refs.RunRef != runResult.Run.RunRef ||
		runResult.Refs.ArtifactRef != runResult.ArtifactRef ||
		runResult.Refs.StorageBindingID != fileRef.StorageBindingID ||
		len(runResult.Refs.FileRefs) != 1 ||
		runResult.Refs.FileRefs[0] != fileRef.FileRef {
		t.Fatalf("run result refs must stabilize OPL-Webui resume pointers: %+v", runResult.Refs)
	}
	if len(runResult.Progress) != 2 {
		t.Fatalf("run result progress = %+v", runResult.Progress)
	}
	if runResult.Progress[0] != (PublicProgress{Stage: "run_started", State: "done", Title: "Run started"}) {
		t.Fatalf("run result first progress = %+v", runResult.Progress[0])
	}
	if runResult.Progress[1] != (PublicProgress{Stage: "artifact_available", State: "done", Title: "Artifact ref ready"}) {
		t.Fatalf("run result second progress = %+v", runResult.Progress[1])
	}
	if len(runResult.Deliverables) != 1 {
		t.Fatalf("run result deliverables = %+v", runResult.Deliverables)
	}
	deliverable := runResult.Deliverables[0]
	if deliverable.DeliverableID == "" || deliverable.ArtifactRef != runResult.ArtifactRef || deliverable.Ref != runResult.ArtifactRef || deliverable.Status != "available" || deliverable.Title != "result.md" || deliverable.Kind != "outputs" {
		t.Fatalf("run result deliverable = %+v", deliverable)
	}

	billing, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	if billing.Wallet.Balance <= 0 || billing.RunCount != 1 || billing.Summary.RunCount != 1 || billing.LedgerCount != len(billing.Ledger) || billing.LedgerCount == 0 {
		t.Fatalf("billing = %+v", billing)
	}

	resources, err := service.Resources(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Resources() error = %v", err)
	}
	if len(resources.Items) != 1 || resources.Summary.ActiveEnvironments != 1 {
		t.Fatalf("resources = %+v", resources)
	}

	release, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-once",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	if !release.BillingStopped || release.Resource.StopBilling.Status != cpd.BillingStatusStopped {
		t.Fatalf("release = %+v", release)
	}
	if release.AuditEventID == "" || release.AuditEventID != release.AuditEvent.ID {
		t.Fatalf("release must expose audit event id for production canary: %+v", release)
	}
}

func TestServiceBusinessAccountCreditIsIdempotentAndPreparePreservesBalance(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	prepare, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-business-rc",
		PortalUserID: "user-business-rc",
		WorkspaceID:  "workspace-business-rc",
	})
	if err != nil {
		t.Fatalf("PrepareBusinessAccount() error = %v", err)
	}
	if prepare.Balance != 0 || prepare.Currency != "CNY" {
		t.Fatalf("prepare = %+v", prepare)
	}
	for attempt := 0; attempt < 2; attempt++ {
		credit, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
			PortalUserID:   "user-business-rc",
			Amount:         100,
			Currency:       "CNY",
			IdempotencyKey: "credit-once",
		})
		if err != nil {
			t.Fatalf("CreditBusinessAccount() attempt %d error = %v", attempt, err)
		}
		if credit.Balance != 100 {
			t.Fatalf("CreditBusinessAccount() attempt %d balance = %v, want 100", attempt, credit.Balance)
		}
	}
	preparedAgain, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-business-rc",
		PortalUserID: "user-business-rc",
		WorkspaceID:  "workspace-business-rc",
	})
	if err != nil {
		t.Fatalf("PrepareBusinessAccount(again) error = %v", err)
	}
	if preparedAgain.Balance != 100 {
		t.Fatalf("PrepareBusinessAccount(again) balance = %v, want 100", preparedAgain.Balance)
	}
}

func TestServiceUploadRunArtifactBillingAuditUsesStoredMedOPLStorageRefs(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "cohort.csv",
		RelativePath: "inputs/cohort.csv",
		ContentType:  "text/csv",
		SizeBytes:    256,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}

	if _, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "analyze unknown upload",
		FileRefs:  []string{"file-missing"},
		ToolName:  "opl-workbench",
		RequestID: "run-with-missing-file",
	}); !errors.Is(err, cpd.ErrFileRefRequired) {
		t.Fatalf("StartRun(unknown fileRef) error = %v", err)
	}

	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "analyze stored upload",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-workbench",
		RequestID: "run-with-stored-file",
	})
	if err != nil {
		t.Fatalf("StartRun(stored fileRef) error = %v", err)
	}
	if runResult.Run.Status != "succeeded" || len(runResult.Artifacts) != 1 {
		t.Fatalf("run result = %+v", runResult)
	}
	artifactRef := runResult.Artifacts[0].ArtifactRef

	artifact, err := service.Artifact(ctx, launch.LaunchID, artifactRef)
	if err != nil {
		t.Fatalf("Artifact(stored run artifact) error = %v", err)
	}
	if artifact["ok"] != true {
		t.Fatalf("artifact = %+v", artifact)
	}
	artifactPayload, ok := artifact["artifact"].(PublicArtifact)
	if !ok {
		t.Fatalf("artifact payload type = %T %+v", artifact["artifact"], artifact["artifact"])
	}
	if artifactPayload.ArtifactRef != artifactRef || artifactPayload.WorkspaceID != launch.WorkspaceID || artifactPayload.ProviderKeyRef != launch.ProviderKeyRef {
		t.Fatalf("artifact payload = %+v", artifactPayload)
	}

	if _, err := service.Artifact(ctx, launch.LaunchID, "artifact-missing"); !errors.Is(err, cpd.ErrArtifactRefRequired) {
		t.Fatalf("Artifact(missing) error = %v", err)
	}

	if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
		TenantID:     "tenant-v22",
		PortalUserID: "user-v22",
		WorkspaceID:  "workspace-other-v22",
	}); err != nil {
		t.Fatalf("PrepareBusinessAccount(other) error = %v", err)
	}
	if _, err := service.ApproveBusinessAccount(ctx, ApproveBusinessAccountInput{
		TenantID:     "tenant-v22",
		PortalUserID: "user-v22",
		WorkspaceID:  "workspace-other-v22",
	}); err != nil {
		t.Fatalf("ApproveBusinessAccount(other) error = %v", err)
	}
	if _, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-other-v22",
		Amount:         200,
		Currency:       "CNY",
		IdempotencyKey: "credit-other-workspace",
	}); err != nil {
		t.Fatalf("CreditBusinessAccount(other) error = %v", err)
	}
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-other-v22",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-other-workspace",
	}); err != nil {
		t.Fatalf("BindProviderKey(other) error = %v", err)
	}
	otherLaunch, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-other-v22",
		IdempotencyKey: "open-other-workspace",
	})
	if err != nil {
		t.Fatalf("OpenManagedEnvironment(other workspace) error = %v", err)
	}
	if _, err := service.Artifact(ctx, otherLaunch.LaunchID, artifactRef); !errors.Is(err, cpd.ErrArtifactRefRequired) {
		t.Fatalf("Artifact(wrong launch) error = %v", err)
	}

	billing, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	if billing.Summary.RunCount != 1 {
		t.Fatalf("billing run count = %+v", billing.Summary)
	}
	assertLedgerHasSourceEvent(t, billing.Ledger, "file.upload")
	assertLedgerHasSourceEvent(t, billing.Ledger, "run.succeeded")
	assertLedgerHasSourceEvent(t, billing.Ledger, "artifact.available")
	assertLedgerAmount(t, billing.Ledger, "run.succeeded", 1.25)
	assertLedgerAmount(t, billing.Ledger, "artifact.available", 0)
}

func TestServiceStorageFileArtifactMetadataRoundTripsThroughPostgresOwnedRefs(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)
	gate, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate() error = %v", err)
	}
	if gate.StorageBindingID == "" {
		t.Fatalf("runtime gate must expose storage binding id: %+v", gate)
	}

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "metadata.csv",
		RelativePath: "inputs/metadata.csv",
		ContentType:  "text/csv",
		SizeBytes:    512,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	if fileRef.StorageBindingID != gate.StorageBindingID || fileRef.ObjectRef == "" {
		t.Fatalf("file ref must expose MedOPL storage metadata: %+v gate=%+v", fileRef, gate)
	}
	storedFile, err := service.store.FileByRef(ctx, fileRef.FileRef)
	if err != nil {
		t.Fatalf("FileByRef() error = %v", err)
	}
	if storedFile.StorageBindingID != gate.StorageBindingID || storedFile.ObjectRef != fileRef.ObjectRef {
		t.Fatalf("file metadata must persist storageBindingId/objectRef: stored=%+v public=%+v", storedFile, fileRef)
	}

	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "analyze stored metadata object",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-webui-runtime",
		RequestID: "run-storage-metadata-rc",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	storedRun, err := service.store.RunByID(ctx, runResult.Run.RunRef)
	if err != nil {
		t.Fatalf("RunByID() error = %v", err)
	}
	if storedRun.StorageBindingID != gate.StorageBindingID || len(storedRun.InputObjectRefs) != 1 || storedRun.InputObjectRefs[0] != fileRef.ObjectRef {
		t.Fatalf("run metadata must persist storage input object lineage: %+v file=%+v", storedRun, fileRef)
	}
	artifact := runResult.Artifacts[0]
	if artifact.ArtifactRef == "" || artifact.Title != "result.md" || artifact.Status != "available" {
		t.Fatalf("run result artifact must expose refs-only consumer metadata: %+v", artifact)
	}
	storedArtifact, err := service.store.ArtifactByRef(ctx, artifact.ArtifactRef)
	if err != nil {
		t.Fatalf("ArtifactByRef() error = %v", err)
	}
	if storedArtifact.StorageBindingID != gate.StorageBindingID || storedArtifact.ObjectRef == "" || storedArtifact.SourceFileRefs[0] != fileRef.FileRef {
		t.Fatalf("artifact metadata must persist storage output lineage: stored=%+v public=%+v file=%+v", storedArtifact, artifact, fileRef)
	}

	artifactPayload, err := service.Artifact(ctx, launch.LaunchID, artifact.ArtifactRef)
	if err != nil {
		t.Fatalf("Artifact() error = %v", err)
	}
	publicArtifact, ok := artifactPayload["artifact"].(PublicArtifact)
	if !ok {
		t.Fatalf("artifact payload type = %T %+v", artifactPayload["artifact"], artifactPayload["artifact"])
	}
	if publicArtifact.StorageBindingID != gate.StorageBindingID || publicArtifact.ObjectRef != storedArtifact.ObjectRef {
		t.Fatalf("artifact projection must round-trip storage metadata: %+v", publicArtifact)
	}
}

func TestServiceBillingDoesNotCountUploadedFileAsCompletedRun(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	if _, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "upload-only.csv",
		RelativePath: "inputs/upload-only.csv",
		ContentType:  "text/csv",
		SizeBytes:    128,
	}); err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}

	billing, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary() error = %v", err)
	}
	if billing.Summary.RunCount != 0 {
		t.Fatalf("file upload without run must not count completed runs: %+v", billing.Summary)
	}
	assertLedgerAmount(t, billing.Ledger, "file.upload", 0.1)
}

func TestServiceReleaseRetainsStorageUntilExplicitDestroyReceipt(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	release, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-before-storage-destroy-once",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	if !release.BillingStopped || release.Resource.Status != cpd.ResourceStatusReleased {
		t.Fatalf("release = %+v", release)
	}

	gateAfterRelease, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: "workspace-v22", InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(after release) error = %v", err)
	}
	if gateAfterRelease.RuntimeState != "released" || gateAfterRelease.StorageState != "ready" {
		t.Fatalf("release must retain storage for OPL-Webui projection: %+v", gateAfterRelease)
	}
	if gateAfterRelease.Release.DestroyStorage != "requires_explicit_user_intent" || gateAfterRelease.StorageBindingID == "" {
		t.Fatalf("release storage intent projection = %+v", gateAfterRelease)
	}

	receipt, err := service.DestroyStorage(ctx, DestroyStorageInput{
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: launch.ResourceBindingID,
		StorageBindingID:  gateAfterRelease.StorageBindingID,
		IdempotencyKey:    "destroy-storage-once",
	})
	if err != nil {
		t.Fatalf("DestroyStorage() error = %v", err)
	}
	if !receipt.StorageDestroyed || !receipt.BillingStopped || receipt.StorageState != "destroyed" {
		t.Fatalf("storage destroy receipt = %+v", receipt)
	}
	if receipt.AuditEvent.Kind != cpd.AuditKindStorageDestroy || receipt.AuditEvent.Status != "recorded" {
		t.Fatalf("storage destroy audit = %+v", receipt.AuditEvent)
	}
	storedResource, err := service.store.ResourceByBinding(ctx, launch.ResourceBindingID)
	if err != nil {
		t.Fatalf("ResourceByBinding(after destroy) error = %v", err)
	}
	if storedResource.StorageState != cpd.StorageStatusDestroyed {
		t.Fatalf("storage destroy must persist canonical resource storage state: %+v", storedResource)
	}

	gateAfterDestroy, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: "workspace-v22", InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(after destroy) error = %v", err)
	}
	if gateAfterDestroy.StorageState != "destroyed" || gateAfterDestroy.Release.DestroyStorage != "completed" {
		t.Fatalf("destroyed storage projection = %+v", gateAfterDestroy)
	}
}

func TestServiceDestroyStorageFailsClosedUntilRuntimeReleased(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	if _, err := service.DestroyStorage(ctx, DestroyStorageInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StorageBindingID:  "storage-" + shortID(launch.WorkspaceID+":"+launch.ResourceBindingID),
		IdempotencyKey:    "destroy-storage-before-release-once",
	}); !errors.Is(err, cpd.ErrRuntimeReleaseRequired) {
		t.Fatalf("DestroyStorage(active runtime) error = %v", err)
	}

	gateAfterRejectedDestroy, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(after rejected destroy) error = %v", err)
	}
	if gateAfterRejectedDestroy.Billing.FreezeStatus != cpd.BillingStatusActive || gateAfterRejectedDestroy.Release.StopBilling != cpd.BillingStatusActive {
		t.Fatalf("rejected storage destroy must keep active billing machine truth: billing=%+v release=%+v", gateAfterRejectedDestroy.Billing, gateAfterRejectedDestroy.Release)
	}
	if gateAfterRejectedDestroy.StorageState != "ready" || gateAfterRejectedDestroy.Release.DestroyStorage != "requires_explicit_user_intent" {
		t.Fatalf("rejected storage destroy must not change storage projection: %+v", gateAfterRejectedDestroy)
	}
}

func TestServiceLocalProductRCUploadFileRunArtifactBillingAuditReleaseAndStorageDestroy(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	launch := bindAndOpen(t, ctx, service)

	gateBeforeUpload, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(before upload) error = %v", err)
	}
	if gateBeforeUpload.PrimaryConsumer != "opl-webui" || gateBeforeUpload.NextAction != "run_in_opl_webui_with_medopl_runtime" {
		t.Fatalf("runtime gate must project OPL-Webui consumer path: %+v", gateBeforeUpload)
	}
	if !gateBeforeUpload.ConsumerProjection.UploadEnabled || !gateBeforeUpload.ConsumerProjection.RunEnabled || !gateBeforeUpload.ConsumerProjection.ArtifactEnabled {
		t.Fatalf("runtime gate must enable upload/run/artifact for ready runtime: %+v", gateBeforeUpload.ConsumerProjection)
	}

	fileRef, err := service.RecordFile(ctx, RecordFileInput{
		LaunchID:     launch.LaunchID,
		FileName:     "cohort.csv",
		RelativePath: "inputs/cohort.csv",
		ContentType:  "text/csv",
		SizeBytes:    256,
	})
	if err != nil {
		t.Fatalf("RecordFile() error = %v", err)
	}
	if fileRef.FileRef == "" || fileRef.WorkspaceID != launch.WorkspaceID || fileRef.ProviderKeyRef != launch.ProviderKeyRef {
		t.Fatalf("fileRef must stay scoped to workspace/providerKeyRef: %+v", fileRef)
	}

	runResult, err := service.StartRun(ctx, StartRunInput{
		LaunchID:  launch.LaunchID,
		Message:   "analyze uploaded cohort",
		FileRefs:  []string{fileRef.FileRef},
		ToolName:  "opl-webui-runtime",
		RequestID: "run-local-product-rc",
	})
	if err != nil {
		t.Fatalf("StartRun() error = %v", err)
	}
	if runResult.Run.Status != "succeeded" || len(runResult.Artifacts) != 1 {
		t.Fatalf("run result must produce a single artifact: %+v", runResult)
	}
	artifactRef := runResult.Artifacts[0].ArtifactRef

	artifact, err := service.Artifact(ctx, launch.LaunchID, artifactRef)
	if err != nil {
		t.Fatalf("Artifact() error = %v", err)
	}
	artifactPayload, ok := artifact["artifact"].(PublicArtifact)
	if !ok {
		t.Fatalf("artifact payload type = %T %+v", artifact["artifact"], artifact["artifact"])
	}
	if artifactPayload.ArtifactRef != artifactRef || artifactPayload.WorkspaceID != launch.WorkspaceID || artifactPayload.ProviderKeyRef != launch.ProviderKeyRef {
		t.Fatalf("artifact must stay scoped to launch/workspace/providerKeyRef: %+v", artifactPayload)
	}

	billingAfterRun, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary(after run) error = %v", err)
	}
	assertLedgerHasSourceEvent(t, billingAfterRun.Ledger, cpd.AuditKindFileUpload)
	assertLedgerHasSourceEvent(t, billingAfterRun.Ledger, cpd.AuditKindRunSucceeded)
	assertLedgerHasSourceEvent(t, billingAfterRun.Ledger, cpd.AuditKindArtifactAvailable)
	assertLedgerAmount(t, billingAfterRun.Ledger, cpd.AuditKindRunSucceeded, 1.25)
	assertLedgerAmount(t, billingAfterRun.Ledger, cpd.AuditKindArtifactAvailable, 0)

	release, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-local-product-rc",
	})
	if err != nil {
		t.Fatalf("Release() error = %v", err)
	}
	if !release.BillingStopped || release.AuditEvent.Kind != cpd.AuditKindResourceRelease {
		t.Fatalf("release must stop billing and write audit event: %+v", release)
	}
	assertReleaseReceipts(t, release.Receipts, false)

	gateAfterRelease, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(after release) error = %v", err)
	}
	if gateAfterRelease.RuntimeState != "released" || gateAfterRelease.StorageState != "ready" {
		t.Fatalf("release must stop runtime and retain storage: %+v", gateAfterRelease)
	}
	if gateAfterRelease.ConsumerProjection.ReleaseAction != "not_available" || gateAfterRelease.ConsumerProjection.StorageAction != "destroy_storage_explicit_intent" {
		t.Fatalf("released runtime must only expose explicit storage destroy action: %+v", gateAfterRelease.ConsumerProjection)
	}

	storageReceipt, err := service.DestroyStorage(ctx, DestroyStorageInput{
		WorkspaceID:       launch.WorkspaceID,
		ResourceBindingID: launch.ResourceBindingID,
		StorageBindingID:  gateAfterRelease.StorageBindingID,
		IdempotencyKey:    "destroy-storage-local-product-rc",
	})
	if err != nil {
		t.Fatalf("DestroyStorage() error = %v", err)
	}
	if !storageReceipt.Ok || !storageReceipt.StorageDestroyed || !storageReceipt.BillingStopped || storageReceipt.AuditEvent.Kind != cpd.AuditKindStorageDestroy {
		t.Fatalf("storage destroy receipt must close storage billing/audit: %+v", storageReceipt)
	}
	assertReleaseReceipts(t, storageReceipt.ReleaseReceipts, true)

	gateAfterDestroy, err := service.RuntimeGate(ctx, RuntimeGateInput{WorkspaceID: launch.WorkspaceID, InvocationMode: "runtime_required"})
	if err != nil {
		t.Fatalf("RuntimeGate(after destroy) error = %v", err)
	}
	if gateAfterDestroy.StorageState != "destroyed" || gateAfterDestroy.Release.DestroyStorage != "completed" {
		t.Fatalf("destroyed storage must be projected back to OPL-Webui consumer: %+v", gateAfterDestroy)
	}

	billingAfterDestroy, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: launch.WorkspaceID})
	if err != nil {
		t.Fatalf("BillingSummary(after destroy) error = %v", err)
	}
	assertLedgerHasSourceEvent(t, billingAfterDestroy.Ledger, cpd.AuditKindResourceRelease)
	assertLedgerHasSourceEvent(t, billingAfterDestroy.Ledger, cpd.AuditKindStorageDestroy)
}

func assertReleaseReceipts(t *testing.T, receipts ReleaseReceipts, storageDestroyed bool) {
	t.Helper()
	if receipts.RuntimeStopped != "recorded" {
		t.Fatalf("runtime stopped receipt missing: %+v", receipts)
	}
	if receipts.FileExportStatus != "retained" {
		t.Fatalf("file export receipt must retain files by default: %+v", receipts)
	}
	if receipts.BillingSettlement != "stopped" {
		t.Fatalf("billing settlement receipt missing: %+v", receipts)
	}
	if receipts.AuditExportRef == "" || receipts.ResourceCleanupRef == "" {
		t.Fatalf("audit/resource cleanup receipt refs required: %+v", receipts)
	}
	if storageDestroyed && receipts.StorageDestroyReceipt != "recorded" {
		t.Fatalf("storage destroy receipt must be recorded after destroy: %+v", receipts)
	}
	if !storageDestroyed && receipts.StorageDestroyReceipt != "pending_explicit_user_intent" {
		t.Fatalf("storage destroy receipt must stay pending after runtime release: %+v", receipts)
	}
}

func TestServiceResourcesAreWorkspaceScopedAndReleaseFailsClosedWhenMissing(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	workspaceLaunch := bindAndOpen(t, ctx, service)
	prepareFundedWorkspace(t, ctx, service, "tenant-v22", "user-v22", "workspace-other", 200, "credit-workspace-other-once")
	if _, err := service.BindProviderKey(ctx, BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-other",
		RawProviderKey: "local-rc-provider-key-material-that-must-stay-private",
		IdempotencyKey: "bind-provider-other-once",
	}); err != nil {
		t.Fatalf("BindProviderKey(other) error = %v", err)
	}
	if _, err := service.OpenManagedEnvironment(ctx, OpenManagedEnvironmentInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-other",
		IdempotencyKey: "open-other-once",
	}); err != nil {
		t.Fatalf("OpenManagedEnvironment(other) error = %v", err)
	}

	resources, err := service.Resources(ctx, WorkspaceInput{WorkspaceID: "workspace-v22"})
	if err != nil {
		t.Fatalf("Resources() error = %v", err)
	}
	if len(resources.Items) != 1 || resources.Items[0].WorkspaceID != "workspace-v22" || resources.Items[0].ResourceBindingID != workspaceLaunch.ResourceBindingID {
		t.Fatalf("workspace scoped resources = %+v", resources.Items)
	}

	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "missing-binding",
		StopBilling:       true,
		IdempotencyKey:    "release-missing-once",
	}); !errors.Is(err, cpd.ErrResourceNotFound) {
		t.Fatalf("Release(missing) error = %v", err)
	}

	if _, err := service.Release(ctx, ReleaseInput{
		WorkspaceID:       "workspace-other",
		ResourceBindingID: workspaceLaunch.ResourceBindingID,
		StopBilling:       true,
		IdempotencyKey:    "release-wrong-workspace-once",
	}); !errors.Is(err, cpd.ErrResourceNotFound) {
		t.Fatalf("Release(wrong workspace) error = %v", err)
	}

	if _, err := service.DestroyStorage(ctx, DestroyStorageInput{
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "missing-binding",
		IdempotencyKey:    "destroy-storage-missing-once",
	}); !errors.Is(err, cpd.ErrResourceNotFound) {
		t.Fatalf("DestroyStorage(missing) error = %v", err)
	}

	if _, err := service.DestroyStorage(ctx, DestroyStorageInput{
		WorkspaceID:       "workspace-other",
		ResourceBindingID: workspaceLaunch.ResourceBindingID,
		IdempotencyKey:    "destroy-storage-wrong-workspace-once",
	}); !errors.Is(err, cpd.ErrResourceNotFound) {
		t.Fatalf("DestroyStorage(wrong workspace) error = %v", err)
	}
}
