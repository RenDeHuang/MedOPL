package lab

import (
	"context"
	"errors"
	"fmt"
	"strings"

	labdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/lab"
	labrepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/lab"
)

type Service struct {
	store labrepo.Store
}

type MutationInput struct {
	WorkspaceID    string
	PackageID      string
	IdempotencyKey string
}

type MutationResult struct {
	Ok           bool                   `json:"ok"`
	Subscription labdomain.Subscription `json:"subscription"`
	Entitlement  labdomain.Entitlement  `json:"entitlement"`
}

func NewService(store labrepo.Store) *Service {
	return &Service{store: store}
}

func (service *Service) ListLabPackages(ctx context.Context) ([]labdomain.PackagePlan, error) {
	return service.store.ListPackages(ctx)
}

func (service *Service) GetLabSubscription(ctx context.Context, workspaceID string) (labdomain.Subscription, error) {
	if err := labdomain.ValidateWorkspaceID(workspaceID); err != nil {
		return labdomain.Subscription{}, err
	}
	return service.store.SubscriptionByWorkspace(ctx, strings.TrimSpace(workspaceID))
}

func (service *Service) GetLabEntitlement(ctx context.Context, workspaceID string) (labdomain.Entitlement, error) {
	if err := labdomain.ValidateWorkspaceID(workspaceID); err != nil {
		return labdomain.Entitlement{}, err
	}
	subscription, err := service.store.SubscriptionByWorkspace(ctx, strings.TrimSpace(workspaceID))
	if errors.Is(err, labrepo.ErrNotFound) {
		return labdomain.BuildEntitlement(workspaceID, labdomain.Subscription{}), nil
	}
	if err != nil {
		return labdomain.Entitlement{}, err
	}
	return labdomain.BuildEntitlement(workspaceID, subscription), nil
}

func (service *Service) ActivateLabPackage(ctx context.Context, input MutationInput) (MutationResult, error) {
	subscription, err := service.subscriptionFromInput(input, "")
	if err != nil {
		return MutationResult{}, err
	}
	if err := service.store.ActivateSubscription(ctx, subscription); err != nil {
		if !errors.Is(err, labrepo.ErrDuplicateID) {
			return MutationResult{}, err
		}
		existing, findErr := service.store.SubscriptionByWorkspace(ctx, subscription.WorkspaceID)
		if findErr != nil {
			return MutationResult{}, err
		}
		subscription = existing
	}
	return MutationResult{Ok: true, Subscription: subscription, Entitlement: labdomain.BuildEntitlement(subscription.WorkspaceID, subscription)}, nil
}

func (service *Service) UpgradeLabPackage(ctx context.Context, input MutationInput) (MutationResult, error) {
	if err := labdomain.ValidateWorkspaceID(input.WorkspaceID); err != nil {
		return MutationResult{}, err
	}
	if err := labdomain.ValidatePackageID(input.PackageID); err != nil {
		return MutationResult{}, err
	}
	current, err := service.store.SubscriptionByWorkspace(ctx, strings.TrimSpace(input.WorkspaceID))
	if errors.Is(err, labrepo.ErrNotFound) {
		current, err = service.subscriptionFromInput(input, "")
		if err != nil {
			return MutationResult{}, err
		}
		if err := service.store.ActivateSubscription(ctx, current); err != nil {
			return MutationResult{}, err
		}
		return MutationResult{Ok: true, Subscription: current, Entitlement: labdomain.BuildEntitlement(current.WorkspaceID, current)}, nil
	}
	if err != nil {
		return MutationResult{}, err
	}
	canonicalPackageID, _ := labdomain.CanonicalPackageID(input.PackageID)
	current.PackageID = canonicalPackageID
	current.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
	if current.IdempotencyKey == "" {
		current.IdempotencyKey = fmt.Sprintf("upgrade:%s:%s", current.WorkspaceID, canonicalPackageID)
	}
	if err := service.store.UpgradeSubscription(ctx, current); err != nil {
		return MutationResult{}, err
	}
	return MutationResult{Ok: true, Subscription: current, Entitlement: labdomain.BuildEntitlement(current.WorkspaceID, current)}, nil
}

func (service *Service) subscriptionFromInput(input MutationInput, subscriptionID string) (labdomain.Subscription, error) {
	if err := labdomain.ValidateWorkspaceID(input.WorkspaceID); err != nil {
		return labdomain.Subscription{}, err
	}
	if err := labdomain.ValidatePackageID(input.PackageID); err != nil {
		return labdomain.Subscription{}, err
	}
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	canonicalPackageID, _ := labdomain.CanonicalPackageID(input.PackageID)
	idempotencyKey := strings.TrimSpace(input.IdempotencyKey)
	if idempotencyKey == "" {
		idempotencyKey = fmt.Sprintf("activate:%s:%s", workspaceID, canonicalPackageID)
	}
	if subscriptionID == "" {
		subscriptionID = fmt.Sprintf("sub:%s", workspaceID)
	}
	return labdomain.Subscription{
		ID:             subscriptionID,
		WorkspaceID:    workspaceID,
		PackageID:      canonicalPackageID,
		Status:         labdomain.SubscriptionStatusActive,
		IdempotencyKey: idempotencyKey,
	}, nil
}
