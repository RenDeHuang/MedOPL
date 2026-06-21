package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func CurrentUser() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		role := "admin"
		if ctx.GetHeader("x-medopl-local-role") == "user" {
			role = "user"
		}
		ctx.JSON(http.StatusOK, gin.H{
			"id":                 "user-local-rc",
			"name":               "MedOPL Local User",
			"email":              "local@medopl.test",
			"role":               role,
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

func AdminAuditEvents() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		workspaceID := workspaceIDFromRequest(ctx)
		ctx.JSON(http.StatusOK, auditEventsPayload(workspaceID))
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
