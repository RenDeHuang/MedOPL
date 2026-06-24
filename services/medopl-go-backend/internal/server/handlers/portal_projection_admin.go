package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

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
