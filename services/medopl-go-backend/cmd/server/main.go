package main

import (
	"log"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/config"
	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := server.Run(cfg); err != nil {
		log.Fatalf("run server: %v", err)
	}
}
