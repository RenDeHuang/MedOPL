package lab

import (
	"context"
	"errors"

	labdomain "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/lab"
)

var (
	ErrDuplicateID = errors.New("duplicate_id")
	ErrNotFound    = errors.New("not_found")
)

type Store interface {
	ListPackages(ctx context.Context) ([]labdomain.PackagePlan, error)
	SubscriptionByWorkspace(ctx context.Context, workspaceID string) (labdomain.Subscription, error)
	ActivateSubscription(ctx context.Context, subscription labdomain.Subscription) error
	UpgradeSubscription(ctx context.Context, subscription labdomain.Subscription) error
}
