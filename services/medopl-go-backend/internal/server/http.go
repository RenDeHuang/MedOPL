package server

import (
	"net/http"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
)

func Run(cfg config.Config) error {
	if err := cfg.Validate(); err != nil {
		return err
	}
	httpServer := &http.Server{
		Addr:    cfg.Addr(),
		Handler: Router(cfg),
	}
	return httpServer.ListenAndServe()
}
