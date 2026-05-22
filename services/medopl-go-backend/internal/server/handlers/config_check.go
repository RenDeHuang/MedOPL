package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

type ConfigCheckPayload struct {
	Ok      bool   `json:"ok"`
	Service string `json:"service"`
	Mode    string `json:"mode"`
	Status  string `json:"status"`
	Error   string `json:"error,omitempty"`
}

func ConfigCheck(cfg config.Config) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if err := cfg.Validate(); err != nil {
			ctx.JSON(http.StatusInternalServerError, ConfigCheckPayload{
				Ok:      false,
				Service: cfg.Service,
				Mode:    cfg.Mode,
				Status:  "failed",
				Error:   err.Error(),
			})
			return
		}
		ctx.JSON(http.StatusOK, ConfigCheckPayload{
			Ok:      true,
			Service: cfg.Service,
			Mode:    cfg.Mode,
			Status:  "ok",
		})
	}
}
