package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const localWorkspaceID = "workspace-local-rc"
const localTimestamp = "2026-05-24T00:00:00Z"

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
			"items":  []gin.H{{"id": "announcement-local-rc", "title": "Local RC", "content": "Pre-cloud local RC is active.", "scope": "all", "status": "active", "pinned": true, "createdAt": localTimestamp, "updatedAt": localTimestamp, "operatorId": "admin-local-rc"}},
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
			"items":             []gin.H{{"id": "user-local-rc", "name": "MedOPL Local User", "email": "local@medopl.test", "role": "admin", "status": "active", "balance": 100, "lastActiveAt": localTimestamp, "createdAt": localTimestamp}},
			"pagination":        pagination(1),
			"allowRegistration": true,
			"financeRows":       []gin.H{{"id": "finance-local-rc", "userId": "user-local-rc", "userName": "MedOPL Local User", "type": "credit", "amount": 100, "createdAt": localTimestamp, "reason": "local_rc"}},
			"groups":            []gin.H{{"id": "group-local-rc", "name": "Local RC"}},
			"kpis":              gin.H{"activeUsers": 1},
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
		ctx.JSON(http.StatusOK, gin.H{"ok": true, "source": "go-control-plane", "action": ctx.Param("action"), "status": "accepted"})
	}
}

func BillingExportCSV() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Header("content-type", "text/csv; charset=utf-8")
		ctx.Header("content-disposition", `attachment; filename="medopl-local-rc-billing.csv"`)
		ctx.String(http.StatusOK, "id,type,amount,reason,created_at\nledger-local-rc-open,hold,10,local_rc_environment_open,2026-05-24T00:00:00Z\n")
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
	return gin.H{"accountStatus": "active", "billingStatus": "funded", "entitlementStatus": "active", "walletBalance": 100, "balanceFloor": 1, "canEnterWorkbench": true, "canStartChargeableRun": true, "chargeBlockedReasons": []string{}, "priceTransparency": "local_rc", "trialEntitlement": nil, "group": nil}
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
