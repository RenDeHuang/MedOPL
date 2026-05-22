package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/buildinfo"
)

type VersionPayload struct {
	Service string `json:"service"`
	Version string `json:"version"`
	Commit  string `json:"commit"`
}

func Version() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, VersionPayload{
			Service: "medopl-go-backend",
			Version: buildinfo.Version,
			Commit:  buildinfo.Commit,
		})
	}
}
