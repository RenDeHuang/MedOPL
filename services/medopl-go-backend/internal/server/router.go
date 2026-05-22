package server

import (
	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/server/handlers"
)

func Router(cfg config.Config) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.GET("/health", handlers.Health(cfg))
	router.GET("/version", handlers.Version())
	router.GET("/config/check", handlers.ConfigCheck(cfg))
	return router
}
