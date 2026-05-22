package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/buildinfo"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

type HealthPayload struct {
	Checks  map[string]string `json:"checks"`
	Mode    string            `json:"mode"`
	Service string            `json:"service"`
	Status  string            `json:"status"`
	Version string            `json:"version"`
}

func Health(cfg config.Config) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, HealthPayload{
			Checks: map[string]string{
				"config": "ok",
			},
			Mode:    cfg.Mode,
			Service: cfg.Service,
			Status:  "ok",
			Version: buildinfo.Version,
		})
	}
}
