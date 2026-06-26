package controlplane

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

type PrepareBusinessAccountInput struct {
	TenantID     string
	PortalUserID string
	WorkspaceID  string
}

type ApproveBusinessAccountInput struct {
	TenantID     string
	PortalUserID string
	WorkspaceID  string
}

type CreditBusinessAccountInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	Amount         float64
	Currency       string
	IdempotencyKey string
}

type BusinessAccountProjection struct {
	Ok           bool    `json:"ok"`
	Source       string  `json:"source"`
	Status       string  `json:"status"`
	TenantID     string  `json:"tenantId"`
	PortalUserID string  `json:"portalUserId"`
	WorkspaceID  string  `json:"workspaceId"`
	Balance      float64 `json:"balance"`
	Currency     string  `json:"currency"`
}

func (service *Service) PrepareBusinessAccount(ctx context.Context, input PrepareBusinessAccountInput) (BusinessAccountProjection, error) {
	tenantID := strings.TrimSpace(input.TenantID)
	portalUserID := strings.TrimSpace(input.PortalUserID)
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID != "" {
		account, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID)
		if err == nil {
			if tenantID == "" {
				tenantID = account.TenantID
			}
			if portalUserID == "" {
				portalUserID = account.PortalUserID
			}
		} else if !errors.Is(err, cprepo.ErrNotFound) {
			return BusinessAccountProjection{}, err
		}
	}
	if workspaceID == "" && portalUserID != "" {
		account, err := service.store.BusinessAccountByUser(ctx, portalUserID)
		if err == nil {
			workspaceID = account.WorkspaceID
			if tenantID == "" {
				tenantID = account.TenantID
			}
		} else if !errors.Is(err, cprepo.ErrNotFound) {
			return BusinessAccountProjection{}, err
		}
	}
	if tenantID == "" {
		return BusinessAccountProjection{}, cpd.ErrTenantRequired
	}
	if portalUserID == "" {
		return BusinessAccountProjection{}, cpd.ErrPortalUserRequired
	}
	if workspaceID == "" {
		return BusinessAccountProjection{}, cpd.ErrWorkspaceRequired
	}
	account := cpd.BusinessAccount{
		TenantID:     tenantID,
		PortalUserID: portalUserID,
		WorkspaceID:  workspaceID,
		Status:       "prepared",
		Currency:     "CNY",
		CreatedAt:    service.now().UTC().Format(time.RFC3339),
	}
	if existing, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID); err == nil {
		account.Balance = existing.Balance
		account.Currency = firstNonEmpty(existing.Currency, account.Currency)
		account.CreatedAt = firstNonEmpty(existing.CreatedAt, account.CreatedAt)
	} else if !errors.Is(err, cprepo.ErrNotFound) {
		return BusinessAccountProjection{}, err
	}
	if err := service.store.SaveBusinessAccount(ctx, account); err != nil {
		return BusinessAccountProjection{}, err
	}
	return businessAccountProjection(account), nil
}

func (service *Service) ApproveBusinessAccount(ctx context.Context, input ApproveBusinessAccountInput) (BusinessAccountProjection, error) {
	tenantID := strings.TrimSpace(input.TenantID)
	portalUserID := strings.TrimSpace(input.PortalUserID)
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID == "" && portalUserID != "" {
		account, err := service.store.BusinessAccountByUser(ctx, portalUserID)
		if err == nil {
			workspaceID = account.WorkspaceID
			if tenantID == "" {
				tenantID = account.TenantID
			}
		} else if !errors.Is(err, cprepo.ErrNotFound) {
			return BusinessAccountProjection{}, err
		}
	}
	if workspaceID == "" {
		return BusinessAccountProjection{}, cpd.ErrWorkspaceRequired
	}
	account, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID)
	if err != nil {
		if errors.Is(err, cprepo.ErrNotFound) {
			return BusinessAccountProjection{}, cpd.ErrAccountRequired
		}
		return BusinessAccountProjection{}, err
	}
	if tenantID != "" {
		account.TenantID = tenantID
	}
	if portalUserID != "" {
		account.PortalUserID = portalUserID
	}
	account.Status = "approved"
	if err := service.store.SaveBusinessAccount(ctx, account); err != nil {
		return BusinessAccountProjection{}, err
	}
	return businessAccountProjection(account), nil
}

func (service *Service) CreditBusinessAccount(ctx context.Context, input CreditBusinessAccountInput) (BusinessAccountProjection, error) {
	if input.Amount <= 0 {
		return BusinessAccountProjection{}, cpd.ErrBillingAttributionRequired
	}
	tenantID := strings.TrimSpace(input.TenantID)
	portalUserID := strings.TrimSpace(input.PortalUserID)
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID != "" {
		account, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID)
		if err == nil {
			if tenantID == "" {
				tenantID = account.TenantID
			}
			if portalUserID == "" {
				portalUserID = account.PortalUserID
			}
		} else if !errors.Is(err, cprepo.ErrNotFound) {
			return BusinessAccountProjection{}, err
		}
	}
	if workspaceID == "" && portalUserID != "" {
		account, err := service.store.BusinessAccountByUser(ctx, portalUserID)
		if err == nil {
			workspaceID = account.WorkspaceID
			if tenantID == "" {
				tenantID = account.TenantID
			}
		} else if !errors.Is(err, cprepo.ErrNotFound) {
			return BusinessAccountProjection{}, err
		}
	}
	if tenantID == "" {
		return BusinessAccountProjection{}, cpd.ErrTenantRequired
	}
	if portalUserID == "" {
		return BusinessAccountProjection{}, cpd.ErrPortalUserRequired
	}
	if workspaceID == "" {
		return BusinessAccountProjection{}, cpd.ErrWorkspaceRequired
	}
	currency := firstNonEmpty(input.Currency, "CNY")
	eventID := "credit-" + stableID(workspaceID+":"+firstNonEmpty(input.IdempotencyKey, fmt.Sprintf("%.2f", input.Amount)))
	account, err := service.store.ApplyCreditEvent(ctx, cpd.CreditEvent{
		ID:             eventID,
		TenantID:       tenantID,
		PortalUserID:   portalUserID,
		WorkspaceID:    workspaceID,
		Amount:         input.Amount,
		Currency:       currency,
		IdempotencyKey: firstNonEmpty(input.IdempotencyKey, eventID),
		CreatedAt:      service.now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return BusinessAccountProjection{}, err
	}
	return businessAccountProjection(account), nil
}

func businessAccountProjection(account cpd.BusinessAccount) BusinessAccountProjection {
	return BusinessAccountProjection{
		Ok:           true,
		Source:       "go-control-plane",
		Status:       account.Status,
		TenantID:     account.TenantID,
		PortalUserID: account.PortalUserID,
		WorkspaceID:  account.WorkspaceID,
		Balance:      account.Balance,
		Currency:     account.Currency,
	}
}
