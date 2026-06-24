package server

import (
	"github.com/gin-gonic/gin"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/secret/providersecret"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/server/handlers"
	controlplaneservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/controlplane"
	labservice "github.com/rendehuang/medopl/services/medopl-go-backend/internal/service/lab"
)

func Router(cfg config.Config) *gin.Engine {
	router, err := RouterWithError(cfg)
	if err != nil {
		panic(err)
	}
	return router
}

func RouterWithError(cfg config.Config) (*gin.Engine, error) {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	portalState, err := handlers.NewLocalPortalProjectionStateChecked(cfg.PortalStateRoot)
	if err != nil {
		cfg.PortalStateStatus = "MEDOPL_PORTAL_STATE_ROOT invalid: " + err.Error()
	} else {
		cfg.PortalStateStatus = "ok"
	}
	handlers.UseLocalPortalProjectionState(portalState)
	router.Use(productionSecurityMiddleware(cfg))
	router.GET("/health", handlers.Health(cfg))
	router.GET("/healthz", handlers.Health(cfg))
	router.GET("/readyz", handlers.Health(cfg))
	router.GET("/version", handlers.Version())
	router.GET("/config/check", handlers.ConfigCheck(cfg))
	labControlPlane := labservice.NewService(memory.NewLabStore())
	api := router.Group("/api")
	api.GET("/lab-packages", handlers.LabPackages(labControlPlane))
	api.GET("/lab-subscription", handlers.LabSubscription(labControlPlane))
	api.GET("/lab-entitlement", handlers.LabEntitlement(labControlPlane))
	api.POST("/lab-packages/activate", handlers.ActivateLabPackage(labControlPlane))
	api.POST("/lab-packages/upgrade", handlers.UpgradeLabPackage(labControlPlane))
	router.POST("/api/session/bootstrap", productionSessionBootstrap(cfg))
	router.GET("/api/me", handlers.CurrentUser())
	router.GET("/api/overview", handlers.Overview())
	router.GET("/api/workspace", handlers.Workspace())
	router.GET("/api/workspace/storage", handlers.WorkspaceStorage())
	router.GET("/api/storage/entitlement", handlers.StorageEntitlement())
	router.POST("/api/workspace/files/upload-url", handlers.WorkspaceFileUploadURL())
	router.GET("/api/workspace/files/download-url", handlers.WorkspaceFileDownloadURL())
	router.POST("/api/workspace/files/local-transfer", handlers.WorkspaceFileLocalTransfer())
	router.GET("/api/workspace/files/local-transfer", handlers.WorkspaceFileLocalTransfer())
	router.GET("/api/announcements", handlers.Announcements())
	router.GET("/api/sessions", handlers.Sessions())
	router.GET("/api/runs", handlers.Runs())
	router.GET("/api/admin/audit-events", handlers.AdminAuditEvents())
	router.GET("/api/admin/overview", handlers.AdminOverview())
	router.GET("/api/admin/users", handlers.AdminUsers())
	router.GET("/api/admin/groups", handlers.AdminGroups())
	router.GET("/api/admin/billing-ops", handlers.AdminBillingOps())
	router.GET("/api/admin/usage", handlers.AdminUsage())
	router.GET("/api/admin/system", handlers.AdminSystem())
	router.GET("/api/admin/ops", handlers.AdminOps())
	router.GET("/api/admin/sandboxes", handlers.AdminSandboxes())
	router.GET("/api/admin/audit", handlers.AdminAudit())
	router.GET("/api/admin/alerts", handlers.AdminAlerts())
	router.GET("/api/admin/user", handlers.AdminPortrait())
	router.GET("/api/admin/workspace", handlers.AdminPortrait())
	router.GET("/api/admin/run", handlers.AdminPortrait())
	router.POST("/api/admin/actions/:action", handlers.AdminAction())
	router.GET("/api/public/settings", handlers.PublicSettings())
	router.GET("/api/server-plans", handlers.ServerPlans())
	router.GET("/api/billing/export.csv", handlers.BillingExportCSV())
	router.GET("/api/logout", productionLogout())
	router.GET("/api/cloud/connector/status", handlers.CloudConnectorStatus())
	router.POST("/api/cloud/connector/plan", handlers.CloudConnectorPlan())
	controlPlaneStore, err := newControlPlaneStore(cfg)
	if err != nil {
		return nil, err
	}
	controlPlane := controlplaneservice.NewService(
		controlPlaneStore,
		controlplaneservice.WithProviderSecretStore(providersecret.NewFileStore(cfg.ProviderSecretRoot)),
		controlplaneservice.WithGatewayURLs(cfg.OPLGatewayURL, cfg.RuntimeBridgeURL),
	)
	handlers.RegisterControlPlaneRoutes(api, controlPlane)
	registerPortalStaticRoutes(router, cfg.PortalStaticRoot)
	return router, nil
}
