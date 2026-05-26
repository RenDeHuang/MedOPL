package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func CloudConnectorStatus() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"ok":          false,
			"status":      "authorization_required",
			"mode":        "fail_closed",
			"reason":      "real-cloud authorization package is required before connector execution",
			"canPlan":     false,
			"canCreate":   false,
			"canRelease":  false,
			"canDeploy":   false,
			"evidence":    "local_precloud_boundary",
			"nextPackage": "real-cloud-authorization-boundary",
		})
	}
}

func CloudConnectorPlan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusPreconditionRequired, gin.H{
			"ok":          false,
			"error":       "authorization_required",
			"status":      "authorization_required",
			"mode":        "fail_closed",
			"reason":      "real-cloud authorization package is required before connector execution",
			"planCreated": false,
			"mutated":     false,
			"nextPackage": "real-cloud-authorization-boundary",
		})
	}
}
