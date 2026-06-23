package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func registerPortalStaticRoutes(router *gin.Engine, staticRoot string) {
	root := strings.TrimSpace(staticRoot)
	if root == "" {
		return
	}
	indexPath := filepath.Join(root, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		return
	}
	assetsRoot := filepath.Join(root, "assets")
	if info, err := os.Stat(assetsRoot); err == nil && info.IsDir() {
		router.Static("/assets", assetsRoot)
	}
	router.NoRoute(func(ctx *gin.Context) {
		if shouldServePortalEntry(ctx.Request.Method, ctx.Request.URL.Path) {
			ctx.File(indexPath)
			return
		}
		ctx.Status(http.StatusNotFound)
	})
}

func shouldServePortalEntry(method string, requestPath string) bool {
	if method != http.MethodGet && method != http.MethodHead {
		return false
	}
	path := strings.TrimSpace(requestPath)
	if path == "" {
		return true
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if strings.HasPrefix(path, "/api/") || path == "/api" {
		return false
	}
	if strings.HasPrefix(path, "/health") || path == "/healthz" || path == "/readyz" || path == "/version" || path == "/config/check" {
		return false
	}
	if strings.Contains(filepath.Base(path), ".") {
		return false
	}
	return true
}
