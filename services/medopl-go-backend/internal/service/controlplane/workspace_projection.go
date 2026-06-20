package controlplane

import (
	"context"
	"strings"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

type ResourcesProjection struct {
	Ok               bool                  `json:"ok"`
	Source           string                `json:"source"`
	ComputeResources []map[string]any      `json:"computeResources"`
	FileSpaces       []map[string]any      `json:"fileSpaces"`
	Protections      []map[string]any      `json:"protections"`
	Items            []cpd.ManagedResource `json:"items"`
	Summary          ResourcesSummary      `json:"summary"`
}

type ResourcesSummary struct {
	ComputeResources         int     `json:"computeResources"`
	FileSpaces               int     `json:"fileSpaces"`
	ActiveEnvironments       int     `json:"activeEnvironments"`
	InactiveEnvironments     int     `json:"inactiveEnvironments"`
	ActiveProtections        int     `json:"activeProtections"`
	FrozenAmount             float64 `json:"frozenAmount"`
	ConsumedAmount           float64 `json:"consumedAmount"`
	RemainingAmount          float64 `json:"remainingAmount"`
	ReleasedProtectionAmount float64 `json:"releasedProtectionAmount"`
	ComputeResourceCount     int     `json:"computeResourceCount"`
	FileSpaceCount           int     `json:"fileSpaceCount"`
	EnvironmentCount         int     `json:"environmentCount"`
	ProtectionCount          int     `json:"protectionCount"`
}

func (service *Service) Resources(ctx context.Context, input WorkspaceInput) (ResourcesProjection, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID == "" {
		return ResourcesProjection{}, cpd.ErrWorkspaceRequired
	}
	items, err := service.store.ListResources(ctx, workspaceID)
	if err != nil {
		return ResourcesProjection{}, err
	}
	active := 0
	for _, item := range items {
		if item.Status == cpd.ResourceStatusActive {
			active++
		}
	}
	count := len(items)
	return ResourcesProjection{
		Ok:               true,
		Source:           "go-control-plane",
		ComputeResources: []map[string]any{},
		FileSpaces:       []map[string]any{},
		Protections:      []map[string]any{},
		Items:            items,
		Summary: ResourcesSummary{
			ComputeResources:     count,
			FileSpaces:           count,
			ActiveEnvironments:   active,
			InactiveEnvironments: count - active,
			ActiveProtections:    active,
			RemainingAmount:      90,
			ComputeResourceCount: count,
			FileSpaceCount:       count,
			EnvironmentCount:     count,
			ProtectionCount:      count,
		},
	}, nil
}
