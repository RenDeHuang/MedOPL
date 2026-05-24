package server

import (
	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/server/handlers"
	labservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/lab"
	workflowservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/workflow"
)

func Router(cfg config.Config) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.GET("/health", handlers.Health(cfg))
	router.GET("/version", handlers.Version())
	router.GET("/config/check", handlers.ConfigCheck(cfg))
	labControlPlane := labservice.NewService(memory.NewLabStore())
	api := router.Group("/api")
	api.GET("/lab-packages", handlers.LabPackages(labControlPlane))
	api.GET("/lab-subscription", handlers.LabSubscription(labControlPlane))
	api.GET("/lab-entitlement", handlers.LabEntitlement(labControlPlane))
	api.POST("/lab-packages/activate", handlers.ActivateLabPackage(labControlPlane))
	api.POST("/lab-packages/upgrade", handlers.UpgradeLabPackage(labControlPlane))
	workflowFacade := workflowservice.NewFacade(memory.NewWorkflowStore())
	router.POST("/workflow/commands", handlers.WorkflowCommands(workflowFacade))
	router.POST("/runtime/launch", handlers.WorkflowCommandAction(workflowFacade, handlers.CommandTypeRuntimeLaunch))
	router.POST("/runs", handlers.WorkflowCommandAction(workflowFacade, handlers.CommandTypeManagedRun))
	router.POST("/billing/freeze", handlers.WorkflowCommandAction(workflowFacade, handlers.CommandTypeBillingFreeze))
	router.POST("/resources/release", handlers.WorkflowCommandAction(workflowFacade, handlers.CommandTypeResourceRelease))
	return router
}
