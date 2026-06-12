package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

const localWorkspaceID = "workspace-local-rc"
const localTimestamp = "2026-05-24T00:00:00Z"

type localPortalUser struct {
	ID        string
	Name      string
	Email     string
	Role      string
	Status    string
	Balance   float64
	CreatedAt string
}

type localPortalFinanceRow struct {
	ID        string
	UserID    string
	UserName  string
	Type      string
	Amount    float64
	Reason    string
	CreatedAt string
}

type localPortalAnnouncement struct {
	ID        string
	Title     string
	Content   string
	Status    string
	Pinned    bool
	CreatedAt string
	UpdatedAt string
}

type localPortalProjectionState struct {
	mu                  sync.Mutex
	users               []localPortalUser
	financeRows         []localPortalFinanceRow
	announcements       []localPortalAnnouncement
	nextUserSequence    int
	nextFinanceSequence int
	nextAnnouncementSeq int
	stateFile           string
}

type localPortalProjectionSnapshot struct {
	Users               []localPortalUser         `json:"users"`
	FinanceRows         []localPortalFinanceRow   `json:"financeRows"`
	Announcements       []localPortalAnnouncement `json:"announcements"`
	NextUserSequence    int                       `json:"nextUserSequence"`
	NextFinanceSequence int                       `json:"nextFinanceSequence"`
	NextAnnouncementSeq int                       `json:"nextAnnouncementSeq"`
}

var portalProjectionState = newLocalPortalProjectionState()

func newLocalPortalProjectionState() *localPortalProjectionState {
	return newSeededLocalPortalProjectionState("")
}

func NewLocalPortalProjectionState(root string) *localPortalProjectionState {
	state := newSeededLocalPortalProjectionState(root)
	if root == "" {
		return state
	}
	_ = state.load()
	return state
}

func NewLocalPortalProjectionStateChecked(root string) (*localPortalProjectionState, error) {
	state := newSeededLocalPortalProjectionState(root)
	if root == "" {
		return state, nil
	}
	if err := state.load(); err != nil {
		return state, err
	}
	return state, nil
}

func newSeededLocalPortalProjectionState(root string) *localPortalProjectionState {
	stateFile := ""
	if strings.TrimSpace(root) != "" {
		stateFile = filepath.Join(root, "portal-projection-state.json")
	}
	return &localPortalProjectionState{
		users: []localPortalUser{{
			ID:        "user-local-rc",
			Name:      "MedOPL Local User",
			Email:     "local@medopl.test",
			Role:      "admin",
			Status:    "active",
			Balance:   100,
			CreatedAt: localTimestamp,
		}},
		financeRows: []localPortalFinanceRow{{
			ID:        "finance-local-rc",
			UserID:    "user-local-rc",
			UserName:  "MedOPL Local User",
			Type:      "credit",
			Amount:    100,
			Reason:    "local_rc",
			CreatedAt: localTimestamp,
		}},
		announcements: []localPortalAnnouncement{{
			ID:        "announcement-local-rc",
			Title:     "Local RC",
			Content:   "Pre-cloud local RC is active.",
			Status:    "active",
			Pinned:    true,
			CreatedAt: localTimestamp,
			UpdatedAt: localTimestamp,
		}},
		nextUserSequence:    1,
		nextFinanceSequence: 1,
		nextAnnouncementSeq: 1,
		stateFile:           stateFile,
	}
}

func UseLocalPortalProjectionState(state *localPortalProjectionState) func() {
	previous := portalProjectionState
	portalProjectionState = state
	return func() {
		portalProjectionState = previous
	}
}

func (state *localPortalProjectionState) load() error {
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.stateFile == "" {
		return nil
	}
	raw, err := os.ReadFile(state.stateFile)
	if os.IsNotExist(err) {
		return state.persistLocked()
	}
	if err != nil {
		return err
	}
	var snapshot localPortalProjectionSnapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		return err
	}
	if len(snapshot.Users) > 0 {
		state.users = snapshot.Users
	}
	if len(snapshot.FinanceRows) > 0 {
		state.financeRows = snapshot.FinanceRows
	}
	if len(snapshot.Announcements) > 0 {
		state.announcements = snapshot.Announcements
	}
	if snapshot.NextUserSequence > 0 {
		state.nextUserSequence = snapshot.NextUserSequence
	}
	if snapshot.NextFinanceSequence > 0 {
		state.nextFinanceSequence = snapshot.NextFinanceSequence
	}
	if snapshot.NextAnnouncementSeq > 0 {
		state.nextAnnouncementSeq = snapshot.NextAnnouncementSeq
	}
	return nil
}

func (state *localPortalProjectionState) persistLocked() error {
	if state.stateFile == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(state.stateFile), 0o700); err != nil {
		return err
	}
	snapshot := localPortalProjectionSnapshot{
		Users:               state.users,
		FinanceRows:         state.financeRows,
		Announcements:       state.announcements,
		NextUserSequence:    state.nextUserSequence,
		NextFinanceSequence: state.nextFinanceSequence,
		NextAnnouncementSeq: state.nextAnnouncementSeq,
	}
	raw, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(state.stateFile, append(raw, '\n'), 0o600)
}

func CurrentUser() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"id":                 "user-local-rc",
			"name":               "MedOPL Local User",
			"email":              "local@medopl.test",
			"role":               "admin",
			"status":             "active",
			"accountStatus":      "active",
			"billingStatus":      "funded",
			"entitlementStatus":  "active",
			"initials":           "ML",
			"currentTaskSlug":    localWorkspaceID,
			"commercial":         commercialProfile(),
			"selectedServerPlan": selectedServerPlan(),
			"productProfile": gin.H{
				"runtimeMode":       "precloud_local_rc",
				"opsProfileEnabled": true,
				"opsSurfaceEnabled": true,
			},
		})
	}
}

func Overview() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"kpis": gin.H{
				"accountStatus":     "active",
				"billingStatus":     "funded",
				"entitlementStatus": "active",
				"balance":           100,
				"todayCost":         1.35,
				"historicalCost":    1.35,
				"activeTasks":       1,
				"workspaceCount":    1,
				"runCount":          1,
				"frozenAmount":      10,
				"availableBalance":  90,
			},
			"commercial":             commercialProfile(),
			"serverPlansSummary":     serverPlansSummary(),
			"selectedServerPlan":     selectedServerPlan(),
			"onboarding":             onboardingPayload(),
			"latestResourceBindings": []gin.H{{"workspaceId": localWorkspaceID, "status": "active", "createdAt": localTimestamp, "updatedAt": localTimestamp}},
			"taskCards":              []gin.H{{"slug": localWorkspaceID, "title": "Local RC Workspace", "status": "active", "runCount": 1, "updatedAt": localTimestamp}},
			"taskPagination":         pagination(1),
			"latestRuns":             []gin.H{{"taskRef": "run-local-rc", "workspaceId": localWorkspaceID, "workspaceTitle": "Local RC Workspace", "status": "succeeded", "createdAt": localTimestamp, "displayTime": localTimestamp}},
			"latestRunsPagination":   pagination(1),
		})
	}
}

func Workspace() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := workspaceIDFromRequest(ctx)
		ctx.JSON(http.StatusOK, gin.H{
			"workspace": gin.H{
				"slug":               workspaceID,
				"title":              "Local RC Workspace",
				"status":             "active",
				"serverPlan":         selectedServerPlan(),
				"storageEntitlement": storageEntitlement(workspaceID),
				"createdAt":          localTimestamp,
				"archivedAt":         nil,
				"deletedAt":          nil,
			},
			"counts":                     gin.H{"inputs": 1, "outputs": 1, "runs": 1, "completedRuns": 1},
			"costs":                      gin.H{"cpuCost": 1.25, "gpuCost": 0, "pvCost": 0.1, "totalCost": 1.35},
			"storageEntitlement":         storageEntitlement(workspaceID),
			"managedResourceBindingPlan": managedResourceBindingPlan(),
			"fileSpace":                  fileSpace(),
			"runStatus":                  gin.H{"running": 0, "completed": 1},
			"activeSession":              gin.H{"id": "session-local-rc", "createdAt": localTimestamp, "lastUsedAt": localTimestamp, "expiresAt": ""},
			"recentRuns":                 []gin.H{runProjection(workspaceID)},
			"eventTimeline":              []gin.H{{"type": "run.succeeded", "occurredAt": localTimestamp, "workspaceId": workspaceID}},
			"distribution":               gin.H{"inputBytes": 128, "outputBytes": 256},
			"tasks":                      []gin.H{taskProjection(workspaceID)},
			"tasksPageRows":              []gin.H{taskProjection(workspaceID)},
			"tasksPagination":            pagination(1),
			"taskTreemap":                []gin.H{{"name": "Local RC Workspace", "value": 1, "task": taskProjection(workspaceID)}},
			"files":                      []gin.H{{"name": "input.csv", "fullPath": "inputs/input.csv"}},
			"filesPagination":            pagination(1),
			"outputs":                    []gin.H{outputProjection(workspaceID)},
			"outputsPagination":          pagination(1),
			"runsPagination":             pagination(1),
		})
	}
}

func WorkspaceStorage() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := workspaceIDFromRequest(ctx)
		ctx.JSON(http.StatusOK, gin.H{
			"workspaceId": workspaceID,
			"entitlement": storageEntitlement(workspaceID),
			"storage":     gin.H{"inputsCount": 1, "outputsCount": 1, "inputBytes": 128, "outputBytes": 256},
			"userStorage": gin.H{"available": true, "synced": true, "status": "local_rc", "note": "Go local pre-cloud storage projection", "objects": []gin.H{}},
			"metadata":    []gin.H{{"fileRef": "file-local-rc", "workspaceId": workspaceID, "kind": "inputs", "name": "input.csv", "relativePath": "inputs/input.csv", "sizeBytes": 128, "checksum": "sha256-local-rc", "contentType": "text/csv", "status": "available", "source": "go-control-plane", "createdAt": localTimestamp, "updatedAt": localTimestamp}},
		})
	}
}

func StorageEntitlement() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := workspaceIDFromRequest(ctx)
		ctx.JSON(http.StatusOK, gin.H{"workspaceId": workspaceID, "entitlement": storageEntitlement(workspaceID)})
	}
}

func WorkspaceFileUploadURL() gin.HandlerFunc {
	return workspaceFileTransfer(http.MethodPost)
}

func WorkspaceFileDownloadURL() gin.HandlerFunc {
	return workspaceFileTransfer(http.MethodGet)
}

func WorkspaceFileLocalTransfer() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := workspaceIDFromRequest(ctx)
		fileName := firstNonEmptyString(ctx.Query("file"), ctx.Query("relativePath"), ctx.PostForm("fileName"), "input.csv")
		if ctx.Request.Method == http.MethodGet {
			ctx.Header("content-disposition", `attachment; filename="`+fileName+`"`)
			ctx.String(http.StatusOK, "medopl precloud local transfer\nworkspace=%s\nfile=%s\n", workspaceID, fileName)
			return
		}
		ctx.JSON(http.StatusOK, gin.H{
			"ok":          true,
			"workspaceId": workspaceID,
			"file":        gin.H{"name": fileName, "relativePath": fileName, "status": "accepted", "source": "go-control-plane"},
			"source":      "go-control-plane",
			"mode":        "precloud_local_rc",
		})
	}
}

func SessionTraces() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := workspaceIDFromRequest(ctx)
		ctx.JSON(http.StatusOK, tracesPayload(workspaceID))
	}
}

func Announcements() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"items":  portalProjectionState.announcementPayloads(),
			"source": "go-control-plane",
			"type":   "local_projection",
		})
	}
}

func Sessions() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"user":       gin.H{"id": "user-local-rc", "name": "MedOPL Local User", "email": "local@medopl.test"},
			"sessions":   []gin.H{{"sessionId": "session-local-rc", "sessionType": "ordinary", "userId": "user-local-rc", "userName": "MedOPL Local User", "userEmail": "local@medopl.test", "workspaceId": localWorkspaceID, "workspaceSessionId": "workspace-session-local-rc", "lastUsedAt": localTimestamp, "status": "active", "source": "go-control-plane"}},
			"pagination": pagination(1),
			"sources":    gin.H{"go-control-plane": gin.H{"source": "go-control-plane", "type": "local_projection"}},
		})
	}
}

func Runs() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"runs":   []gin.H{{"taskRef": "run-local-rc", "workspaceId": localWorkspaceID, "workspaceSessionId": "workspace-session-local-rc", "userId": "user-local-rc", "userName": "MedOPL Local User", "userEmail": "local@medopl.test", "status": "succeeded", "startedAt": localTimestamp, "endedAt": localTimestamp, "source": "go-control-plane", "type": "local_projection"}},
			"source": "go-control-plane",
			"type":   "local_projection",
		})
	}
}

func PublicSettings() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, publicSettings())
	}
}

func ServerPlans() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"ok":                        true,
			"catalogSource":             "go-control-plane",
			"configured":                true,
			"priceEnabled":              false,
			"availabilitySyncEnabled":   false,
			"availabilitySnapshotCount": 0,
			"catalogCount":              1,
			"items":                     []gin.H{serverPlanItem()},
			"selectedServerPlan":        selectedServerPlan(),
			"workspaceId":               localWorkspaceID,
			"note":                      "precloud_local_rc",
			"catalogRuntimeStatus":      gin.H{"status": "local_rc", "configured": true, "catalogSource": "go-control-plane", "catalogCount": 1, "candidateCount": 1, "platformProvisionedRuntimeCount": 1},
			"pricingSourceStatus":       gin.H{"enabled": false, "status": "pending_real_cloud", "priceOrigin": "not_authorized", "quotedCount": 0, "pendingSource": "real-cloud-authorization-boundary"},
			"summary":                   serverPlansSummary(),
			"commercial":                commercialProfile(),
			"freezePolicy":              gin.H{"catalogSource": "go-control-plane", "basis": "local_rc", "finalBilling": "requires_real_cloud_package", "minBillableHoursDefault": 1, "pendingCostIntervalSeconds": 60, "pendingSource": "local_projection"},
		})
	}
}

func AdminOverview() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"source": "go-control-plane", "kpis": gin.H{"users": 1, "workspaces": 1, "runs": 1}, "alerts": []gin.H{}})
	}
}

func AdminUsers() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"items":             portalProjectionState.userPayloads(),
			"pagination":        pagination(portalProjectionState.userCount()),
			"allowRegistration": true,
			"financeRows":       portalProjectionState.financePayloads(),
			"groups":            []gin.H{{"id": "group-local-rc", "name": "Local RC"}},
			"kpis":              gin.H{"activeUsers": portalProjectionState.activeUserCount()},
		})
	}
}

func AdminGroups() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"items": []gin.H{{"id": "group-local-rc", "name": "Local RC"}}})
	}
}

func AdminBillingOps() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"items": []gin.H{}, "source": "go-control-plane"})
	}
}

func AdminUsage() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"items": []gin.H{}, "summary": gin.H{}, "source": "go-control-plane"})
	}
}

func AdminSystem() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"serviceStatuses": []gin.H{{"name": "medopl-go-backend", "status": "ok"}}, "summaries": gin.H{}, "systemMetrics": gin.H{}, "productProfile": gin.H{"runtimeMode": "precloud_local_rc"}, "allowRegistration": true, "publicSettings": publicSettings()})
	}
}

func AdminOps() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"opsSurfaceEnabled": true, "items": []gin.H{}, "source": "go-control-plane"})
	}
}

func AdminSandboxes() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"items": []gin.H{}, "source": "go-control-plane"})
	}
}

func AdminAudit() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"items": []gin.H{{"id": "audit-local-rc", "kind": "local_rc", "status": "recorded", "createdAt": localTimestamp}}, "source": "go-control-plane"})
	}
}

func AdminAlerts() gin.HandlerFunc {
	return Announcements()
}

func AdminPortrait() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"source": "go-control-plane", "item": gin.H{"id": firstNonEmptyString(ctx.Query("userId"), ctx.Query("workspaceId"), ctx.Query("runId"), "local-rc"), "status": "active"}})
	}
}

func AdminAction() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var payload map[string]any
		if ctx.Request.ContentLength != 0 {
			if err := ctx.ShouldBindJSON(&payload); err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"ok": false, "source": "go-control-plane", "error": "invalid_admin_action_payload"})
				return
			}
		}
		if payload == nil {
			payload = map[string]any{}
		}
		action := ctx.Param("action")
		if err := portalProjectionState.applyAdminAction(action, payload); err != nil {
			status := http.StatusBadRequest
			if strings.Contains(err.Error(), "not_found") {
				status = http.StatusNotFound
			}
			ctx.JSON(status, gin.H{"ok": false, "source": "go-control-plane", "action": action, "error": err.Error(), "businessMessage": "Portal 管理动作未完成，请稍后重试；如持续失败，请联系管理员。"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "source": "go-control-plane", "action": action, "status": "accepted"})
	}
}

func BillingExportCSV() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Header("content-type", "text/csv; charset=utf-8")
		ctx.Header("content-disposition", `attachment; filename="medopl-local-rc-billing.csv"`)
		ctx.String(http.StatusOK, portalProjectionState.billingCSV())
	}
}

func Logout() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Redirect(http.StatusFound, "/")
	}
}

func workspaceFileTransfer(method string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := workspaceIDFromRequest(ctx)
		fileName := firstNonEmptyString(ctx.Query("file"), ctx.Query("relativePath"), "input.csv")
		ctx.JSON(http.StatusOK, gin.H{
			"workspaceId": workspaceID,
			"provider":    "local-precloud",
			"method":      method,
			"expiresAt":   localTimestamp,
			"url":         "/api/workspace/files/local-transfer",
			"file":        gin.H{"kind": firstNonEmptyString(ctx.Query("kind"), "inputs"), "name": fileName, "relativePath": fileName, "contentType": "application/octet-stream"},
		})
	}
}

func tracesPayload(workspaceID string) gin.H {
	return gin.H{
		"filters": gin.H{"userId": "user-local-rc", "workspaceId": workspaceID, "sessionId": "session-local-rc", "status": "succeeded"},
		"summary": gin.H{"available": true, "mode": "precloud_local_rc", "traceCount": 1, "latestTraceAt": localTimestamp, "dataSource": "go-control-plane", "businessFactSource": "local_projection", "canonicalSource": "go-control-plane", "observabilityAttachmentSource": "none", "observabilityAvailable": false, "billingTruth": false},
		"items": []gin.H{{
			"traceId": "trace-local-rc", "traceName": "Local RC Run", "title": "Local RC Run", "userId": "user-local-rc", "workspaceId": workspaceID, "workspaceSessionId": "workspace-session-local-rc", "runtimeSessionId": "runtime-session-local-rc", "taskRef": "run-local-rc", "model": "opl-local", "sessionId": "session-local-rc", "tokenCount": 0, "userAgent": "local-rc", "latencyMs": 0, "inputPreview": "local rc", "startedAt": localTimestamp, "updatedAt": localTimestamp, "status": "succeeded", "businessStatus": "succeeded", "url": "/workspace", "source": "go-control-plane", "customerDefaultTraceSurface": "portal", "customerDefaultLangfuseUi": false,
			"resourceUsage": resourceUsage(workspaceID),
			"costEstimate":  costEstimate(),
			"balanceLink":   balanceLink(),
			"runtimeTrace":  gin.H{"source": "go-control-plane", "ownerScope": "workspace", "taskRef": "run-local-rc", "workspaceId": workspaceID, "sessionId": "session-local-rc", "runStatus": "succeeded", "artifactStatus": "available", "artifactCount": 1, "linkedOutputCount": 1},
			"files":         gin.H{"inputsCount": 1, "outputsCount": 1, "linkedOutputCount": 1, "linkedOutputFiles": []gin.H{outputProjection(workspaceID)}, "latestOutputs": []gin.H{{"name": "result.md", "size": 256, "downloadUrl": "/api/workspace/files/download-url?file=result.md"}}},
			"billing":       gin.H{"pendingCost": 0, "exactCost": 1.35, "source": "go-control-plane"},
		}},
		"pagination":                pagination(1),
		"dataSource":                "go-control-plane",
		"customerTraceSurface":      "portal",
		"customerDefaultLangfuseUi": false,
		"note":                      "precloud_local_rc",
	}
}

func taskProjection(workspaceID string) gin.H {
	return gin.H{"slug": workspaceID, "title": "Local RC Workspace", "status": "active", "inputs": 1, "outputs": 1, "runs": 1, "totalCost": 1.35, "updatedAt": localTimestamp}
}

func runProjection(workspaceID string) gin.H {
	return gin.H{"taskRef": "run-local-rc", "status": "succeeded", "createdAt": localTimestamp, "resourceUsage": resourceUsage(workspaceID), "costEstimate": costEstimate(), "balanceLink": balanceLink()}
}

func outputProjection(workspaceID string) gin.H {
	return gin.H{"name": "result.md", "fullPath": "outputs/result.md", "artifactRef": "artifact-local-rc", "fileRef": "file-output-local-rc", "taskRef": "run-local-rc", "sessionId": "session-local-rc", "workspaceId": workspaceID, "kind": "outputs", "sizeBytes": 256, "contentType": "text/markdown", "status": "available", "source": "go-control-plane", "createdAt": localTimestamp, "updatedAt": localTimestamp, "resourceUsage": resourceUsage(workspaceID), "costEstimate": costEstimate(), "balanceLink": balanceLink()}
}

func resourceUsage(workspaceID string) gin.H {
	return gin.H{"source": "go-control-plane", "taskRef": "run-local-rc", "sessionId": "session-local-rc", "workspaceId": workspaceID, "status": "succeeded", "latencyMs": 0, "inputFileCount": 1, "outputFileCount": 1, "outputBytes": 256, "costItemCount": 1, "tokenCount": 0}
}

func costEstimate() gin.H {
	return gin.H{"amount": 1.35, "currency": "CNY", "source": "go-control-plane", "pricingSource": "local-rc-deterministic", "status": "exact", "billingTruth": false, "pendingReconciliation": false, "components": gin.H{"compute": 1.25, "storage": 0.1, "total": 1.35}}
}

func balanceLink() gin.H {
	return gin.H{"linkedToBalance": true, "chargeApplied": true, "rechargeStatus": "funded", "estimateOnly": false, "estimatedAmount": 1.35, "currency": "CNY", "balanceCents": 10000, "availableBalanceCents": 9000}
}

func storageEntitlement(workspaceID string) gin.H {
	return gin.H{"enabled": true, "status": "active", "freeQuotaGb": 10, "minimumPurchaseGb": 10, "retentionPolicy": "workspace_lifecycle", "storageSizeGb": 10, "message": "precloud_local_rc", "workspaceId": workspaceID}
}

func fileSpace() gin.H {
	return gin.H{"capacityGb": 10, "usedGb": 1, "retentionDays": 7, "currentFolderRef": "root", "folders": []gin.H{{"folderRef": "root", "name": "root", "parentFolderRef": "", "path": "/", "status": "active"}}, "files": []gin.H{{"fileRef": "file-local-rc", "name": "input.csv", "folderRef": "root", "kind": "input", "source": "upload", "sessionId": "session-local-rc", "taskRef": "run-local-rc", "artifactRef": "", "sizeBytes": 128, "status": "available", "deletedAt": "", "retentionUntil": ""}}, "selectedFileRefs": []string{}, "actions": gin.H{"createFolder": true, "renameFolder": true, "deleteFileOrFolder": true, "uploadToCurrentFolder": true, "moveFileOrFolder": true, "selectFiles": true, "batchDownload": true, "batchDelete": true, "permanentDeleteRequiresConfirmation": true, "clearFileSpaceRequiresConfirmation": true}, "deletePolicy": gin.H{"ordinaryDeleteRequiresConfirmation": true, "retentionDays": 7, "permanentDeleteRequiresConfirmation": true, "clearFileSpaceRequiresConfirmation": true}}
}

func managedResourceBindingPlan() gin.H {
	return gin.H{"managedEnvironment": "local-precloud", "regionLabel": "local", "planSpec": "local-rc", "status": "active", "estimatedCost": gin.H{"amount": 1.35, "currency": "CNY", "source": "go-control-plane", "status": "exact", "billingTruth": false, "chargeApplied": true}, "releasePolicy": gin.H{"status": "ready", "releasedAt": "", "billingStopConfirmBy": "", "stopBillingConfirmWithinMinutes": 120, "protection": "local_rc"}, "auditStatus": gin.H{"status": "recorded", "auditReadyAt": localTimestamp, "policy": "local_rc"}, "snapshot": gin.H{"source": "go-control-plane", "label": "local_rc", "realResourceCreated": false, "providerAdapterStage": "not_authorized"}}
}

func commercialProfile() gin.H {
	return gin.H{"accountStatus": "active", "billingStatus": "funded", "entitlementStatus": "active", "walletBalance": 100, "balanceFloor": 1, "canEnterWorkbench": true, "canStartChargeableRun": true, "chargeBlockedReasons": []string{}, "priceTransparency": "local_rc", "group": nil}
}

func selectedServerPlan() gin.H {
	return gin.H{"id": "local-rc", "name": "Local RC", "provider": "local", "region": "local", "zone": "local-a", "instanceType": "local-precloud", "cpu": 4, "memoryGb": 16, "gpu": 0, "currency": "CNY", "priceStatus": "pending_real_cloud", "availabilityStatus": "local", "statusCategory": "local", "basePrice": nil, "pendingProductApproval": true, "priceLabel": "本地 RC", "minBillableHours": 1, "riskFactor": 1, "reservationFloor": 0, "cpuRequest": "4", "cpuLimit": "4", "memoryRequest": "16Gi", "memoryLimit": "16Gi", "gpuCount": 0, "storageRequest": "10Gi", "storageLimit": "10Gi", "isPurchasable": false, "isSelectable": true, "selectedAt": localTimestamp, "selectionNote": "precloud local rc", "priceOrigin": "not_authorized"}
}

func serverPlanItem() gin.H {
	plan := selectedServerPlan()
	plan["catalogSource"] = "go-control-plane"
	return plan
}

func serverPlansSummary() gin.H {
	return gin.H{"catalogSource": "go-control-plane", "configured": true, "priceEnabled": false, "availabilitySyncEnabled": false, "availabilitySnapshotCount": 0, "catalogCount": 1, "quotedCount": 0, "purchasableCount": 0, "selectableCount": 1, "priceStatus": "pending_real_cloud", "basePrice": nil, "pendingProductApproval": true, "note": "precloud_local_rc", "catalogRuntimeStatus": gin.H{"status": "local_rc", "configured": true, "catalogSource": "go-control-plane", "catalogCount": 1, "candidateCount": 1, "platformProvisionedRuntimeCount": 1}, "pricingSourceStatus": gin.H{"enabled": false, "status": "pending_real_cloud", "priceOrigin": "not_authorized", "quotedCount": 0, "pendingSource": "real-cloud-authorization-boundary"}}
}

func onboardingPayload() gin.H {
	return gin.H{"nextStepId": "open-workbench", "items": []gin.H{{"id": "prepare", "title": "Prepare account", "state": "complete", "href": "/overview", "description": "local rc"}, {"id": "open-workbench", "title": "Open workbench", "state": "active", "href": "/workspace", "description": "local rc"}}}
}

func publicSettings() gin.H {
	return gin.H{"siteName": "MedOPL", "siteLogo": "", "siteSubtitle": "Pre-cloud local RC", "homeContent": "MedOPL pre-cloud local RC"}
}

func pagination(total int) gin.H {
	return gin.H{"page": 1, "pageSize": 20, "total": total, "totalPages": 1}
}

func workspaceIDFromRequest(ctx *gin.Context) string {
	return firstNonEmptyString(ctx.Query("workspaceId"), ctx.Query("task"), localWorkspaceID)
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (state *localPortalProjectionState) userPayloads() []gin.H {
	state.mu.Lock()
	defer state.mu.Unlock()
	items := make([]gin.H, 0, len(state.users))
	for _, user := range state.users {
		if user.Status == "deleted" {
			continue
		}
		items = append(items, gin.H{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role, "status": user.Status, "balance": user.Balance, "lastActiveAt": localTimestamp, "createdAt": user.CreatedAt})
	}
	return items
}

func (state *localPortalProjectionState) financePayloads() []gin.H {
	state.mu.Lock()
	defer state.mu.Unlock()
	items := make([]gin.H, 0, len(state.financeRows))
	for _, row := range state.financeRows {
		items = append(items, gin.H{"id": row.ID, "userId": row.UserID, "userName": row.UserName, "type": row.Type, "amount": row.Amount, "createdAt": row.CreatedAt, "reason": row.Reason})
	}
	return items
}

func (state *localPortalProjectionState) announcementPayloads() []gin.H {
	state.mu.Lock()
	defer state.mu.Unlock()
	items := make([]gin.H, 0, len(state.announcements))
	for _, item := range state.announcements {
		if item.Status == "deleted" {
			continue
		}
		items = append(items, gin.H{"id": item.ID, "title": item.Title, "content": item.Content, "scope": "all", "status": item.Status, "pinned": item.Pinned, "createdAt": item.CreatedAt, "updatedAt": item.UpdatedAt, "operatorId": "admin-local-rc"})
	}
	return items
}

func (state *localPortalProjectionState) userCount() int {
	state.mu.Lock()
	defer state.mu.Unlock()
	count := 0
	for _, user := range state.users {
		if user.Status != "deleted" {
			count++
		}
	}
	return count
}

func (state *localPortalProjectionState) activeUserCount() int {
	state.mu.Lock()
	defer state.mu.Unlock()
	count := 0
	for _, user := range state.users {
		if user.Status == "active" {
			count++
		}
	}
	return count
}

func (state *localPortalProjectionState) applyAdminAction(action string, payload map[string]any) error {
	state.mu.Lock()
	defer state.mu.Unlock()
	var err error
	switch action {
	case "create-user":
		err = state.createUser(payload)
	case "update-user":
		err = state.updateUser(payload)
	case "toggle-user":
		err = state.toggleUser(payload)
	case "delete-user":
		err = state.deleteUser(payload)
	case "recharge":
		err = state.adjustUserBalance(payload, "topup", "admin_recharge")
	case "ledger-adjust":
		actionType := firstNonEmptyString(actionString(payload, "actionType"), "adjustment")
		reason := firstNonEmptyString(actionString(payload, "reason"), "admin_ledger_adjust")
		err = state.adjustUserBalance(payload, actionType, reason)
	case "announcements-save":
		err = state.saveAnnouncement(payload)
	case "announcements-toggle":
		err = state.toggleAnnouncement(payload)
	case "announcements-delete":
		err = state.deleteAnnouncement(payload)
	case "settings", "billing-ops-mark":
		err = nil
	default:
		err = fmt.Errorf("admin_action_not_supported")
	}
	if err != nil {
		return err
	}
	if err := state.persistLocked(); err != nil {
		return fmt.Errorf("admin_state_persist_failed")
	}
	return nil
}

func (state *localPortalProjectionState) createUser(payload map[string]any) error {
	name := actionString(payload, "name")
	email := strings.ToLower(actionString(payload, "email"))
	if name == "" || email == "" {
		return fmt.Errorf("admin_user_name_email_required")
	}
	for _, user := range state.users {
		if strings.EqualFold(user.Email, email) && user.Status != "deleted" {
			return fmt.Errorf("admin_user_duplicate_email")
		}
	}
	userID := fmt.Sprintf("user-local-rc-extra-%d", state.nextUserSequence)
	state.nextUserSequence++
	state.users = append(state.users, localPortalUser{ID: userID, Name: name, Email: email, Role: "user", Status: "active", Balance: 0, CreatedAt: localTimestamp})
	return nil
}

func (state *localPortalProjectionState) updateUser(payload map[string]any) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	if name := actionString(payload, "name"); name != "" {
		user.Name = name
	}
	if email := strings.ToLower(actionString(payload, "email")); email != "" {
		user.Email = email
	}
	return nil
}

func (state *localPortalProjectionState) toggleUser(payload map[string]any) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	if user.Status == "disabled" {
		user.Status = "active"
	} else {
		user.Status = "disabled"
	}
	return nil
}

func (state *localPortalProjectionState) deleteUser(payload map[string]any) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	user.Status = "deleted"
	return nil
}

func (state *localPortalProjectionState) adjustUserBalance(payload map[string]any, entryType string, reason string) error {
	user := state.findUser(actionString(payload, "userId"))
	if user == nil {
		return fmt.Errorf("admin_user_not_found")
	}
	amount := actionFloat(payload, "amount")
	if amount <= 0 {
		return fmt.Errorf("admin_amount_required")
	}
	signedAmount := ledgerSignedAmount(entryType, amount)
	user.Balance += signedAmount
	state.financeRows = append(state.financeRows, localPortalFinanceRow{
		ID:        fmt.Sprintf("finance-local-rc-extra-%d", state.nextFinanceSequence),
		UserID:    user.ID,
		UserName:  user.Name,
		Type:      entryType,
		Amount:    signedAmount,
		Reason:    reason,
		CreatedAt: localTimestamp,
	})
	state.nextFinanceSequence++
	return nil
}

func ledgerSignedAmount(entryType string, amount float64) float64 {
	switch strings.ToLower(strings.TrimSpace(entryType)) {
	case "charge", "debit", "refund", "makeup_charge":
		return -amount
	default:
		return amount
	}
}

func (state *localPortalProjectionState) saveAnnouncement(payload map[string]any) error {
	title := actionString(payload, "title")
	content := actionString(payload, "content")
	if title == "" || content == "" {
		return fmt.Errorf("announcement_title_content_required")
	}
	status := firstNonEmptyString(actionString(payload, "status"), "active")
	pinned := actionBool(payload, "pinned")
	if pinned {
		for index := range state.announcements {
			state.announcements[index].Pinned = false
		}
	}
	if id := actionString(payload, "id"); id != "" {
		for index := range state.announcements {
			if state.announcements[index].ID == id {
				state.announcements[index].Title = title
				state.announcements[index].Content = content
				state.announcements[index].Status = status
				state.announcements[index].Pinned = pinned
				state.announcements[index].UpdatedAt = localTimestamp
				return nil
			}
		}
		return fmt.Errorf("announcement_not_found")
	}
	state.announcements = append(state.announcements, localPortalAnnouncement{
		ID:        fmt.Sprintf("announcement-local-rc-extra-%d", state.nextAnnouncementSeq),
		Title:     title,
		Content:   content,
		Status:    status,
		Pinned:    pinned,
		CreatedAt: localTimestamp,
		UpdatedAt: localTimestamp,
	})
	state.nextAnnouncementSeq++
	return nil
}

func (state *localPortalProjectionState) toggleAnnouncement(payload map[string]any) error {
	announcement := state.findAnnouncement(actionString(payload, "id"))
	if announcement == nil {
		return fmt.Errorf("announcement_not_found")
	}
	switch actionString(payload, "actionType") {
	case "pin":
		for index := range state.announcements {
			state.announcements[index].Pinned = false
		}
		announcement.Pinned = true
	case "deactivate":
		announcement.Status = "inactive"
	case "activate":
		announcement.Status = "active"
	}
	announcement.UpdatedAt = localTimestamp
	return nil
}

func (state *localPortalProjectionState) deleteAnnouncement(payload map[string]any) error {
	announcement := state.findAnnouncement(actionString(payload, "id"))
	if announcement == nil {
		return fmt.Errorf("announcement_not_found")
	}
	announcement.Status = "deleted"
	announcement.Pinned = false
	announcement.UpdatedAt = localTimestamp
	return nil
}

func (state *localPortalProjectionState) findUser(userID string) *localPortalUser {
	for index := range state.users {
		if state.users[index].ID == userID && state.users[index].Status != "deleted" {
			return &state.users[index]
		}
	}
	return nil
}

func (state *localPortalProjectionState) findAnnouncement(id string) *localPortalAnnouncement {
	for index := range state.announcements {
		if state.announcements[index].ID == id && state.announcements[index].Status != "deleted" {
			return &state.announcements[index]
		}
	}
	return nil
}

func (state *localPortalProjectionState) billingCSV() string {
	state.mu.Lock()
	defer state.mu.Unlock()
	var builder strings.Builder
	builder.WriteString("id,type,amount,reason,created_at\n")
	builder.WriteString("ledger-local-rc-open,hold,10,local_rc_environment_open,2026-05-24T00:00:00Z\n")
	for _, row := range state.financeRows {
		builder.WriteString(fmt.Sprintf("%s,%s,%.2f,%s,%s\n", row.ID, row.Type, row.Amount, row.Reason, row.CreatedAt))
	}
	return builder.String()
}

func actionString(payload map[string]any, key string) string {
	if value, ok := payload[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func actionFloat(payload map[string]any, key string) float64 {
	switch value := payload[key].(type) {
	case float64:
		return value
	case float32:
		return float64(value)
	case int:
		return float64(value)
	case int64:
		return float64(value)
	case string:
		var parsed float64
		_, _ = fmt.Sscanf(strings.TrimSpace(value), "%f", &parsed)
		return parsed
	default:
		return 0
	}
}

func actionBool(payload map[string]any, key string) bool {
	if value, ok := payload[key].(bool); ok {
		return value
	}
	return false
}
