package controlplane

import (
	"context"
	"testing"

	"github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/memory"
)

func TestServiceBusinessAccountCreditEventIDsDoNotCollideAcrossWorkspaces(t *testing.T) {
	ctx := context.Background()
	service := NewService(memory.NewControlPlaneStore())
	idempotencyKey := "credit-once"
	workspaces := []string{
		"goal-f-production-canary-1790000000000",
		"goal-f-production-canary-1880000000000",
	}
	if shortID(workspaces[0]+":"+idempotencyKey) != shortID(workspaces[1]+":"+idempotencyKey) {
		t.Fatal("test requires colliding legacy short ids")
	}

	for index, workspaceID := range workspaces {
		portalUserID := "user-business-rc-" + string(rune('a'+index))
		if _, err := service.PrepareBusinessAccount(ctx, PrepareBusinessAccountInput{
			TenantID:     "tenant-business-rc",
			PortalUserID: portalUserID,
			WorkspaceID:  workspaceID,
		}); err != nil {
			t.Fatalf("PrepareBusinessAccount(%s) error = %v", workspaceID, err)
		}
		credit, err := service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
			TenantID:       "tenant-business-rc",
			PortalUserID:   portalUserID,
			WorkspaceID:    workspaceID,
			Amount:         1,
			Currency:       "CNY",
			IdempotencyKey: idempotencyKey,
		})
		if err != nil {
			t.Fatalf("CreditBusinessAccount(%s) error = %v", workspaceID, err)
		}
		if credit.WorkspaceID != workspaceID || credit.Balance != 1 {
			t.Fatalf("CreditBusinessAccount(%s) = %+v", workspaceID, credit)
		}
	}
}
