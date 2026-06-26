package controlplane

import (
	"context"
	"strings"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

const (
	commercialAdmissionConditionAccountExists            = "account_exists"
	commercialAdmissionConditionAccountApproved          = "account_approved"
	commercialAdmissionConditionWorkspaceExists          = "workspace_exists"
	commercialAdmissionConditionProviderKeyRefWhenNeeded = "provider_key_ref_exists_when_needed"
	commercialAdmissionConditionPlanSelected             = "plan_selected"
	commercialAdmissionConditionBalanceSufficient        = "balance_sufficient"
	commercialAdmissionConditionQuotaAvailable           = "quota_available"
	commercialAdmissionConditionNoEmergencyPlatformStop  = "no_emergency_platform_stop"
)

type RuntimeGateCommercialAdmission struct {
	AccountExists         bool   `json:"accountExists"`
	AccountApproved       bool   `json:"accountApproved"`
	WorkspaceExists       bool   `json:"workspaceExists"`
	ProviderKeyRefExists  bool   `json:"providerKeyRefExists"`
	PlanSelected          bool   `json:"planSelected"`
	BalanceSufficient     bool   `json:"balanceSufficient"`
	QuotaAvailable        bool   `json:"quotaAvailable"`
	EmergencyPlatformStop bool   `json:"emergencyPlatformStop"`
	Allowed               bool   `json:"allowed"`
	Decision              string `json:"decision"`
	Reason                string `json:"reason"`
}

func (service *Service) runtimeGateCommercialAdmission(ctx context.Context, workspaceID string, providerKeyRefExists bool, reason string) RuntimeGateCommercialAdmission {
	wallet, err := service.runtimeGateWallet(ctx, workspaceID)
	if err != nil {
		return RuntimeGateCommercialAdmission{
			AccountExists:         false,
			AccountApproved:       false,
			WorkspaceExists:       strings.TrimSpace(workspaceID) != "",
			ProviderKeyRefExists:  providerKeyRefExists,
			PlanSelected:          true,
			BalanceSufficient:     false,
			QuotaAvailable:        true,
			EmergencyPlatformStop: false,
			Allowed:               false,
			Decision:              "blocked",
			Reason:                firstNonEmpty(reason, "account_required"),
		}
	}
	return service.runtimeGateCommercialAdmissionWithWallet(ctx, workspaceID, providerKeyRefExists, reason, wallet)
}

func (service *Service) runtimeGateCommercialAdmissionWithWallet(ctx context.Context, workspaceID string, providerKeyRefExists bool, reason string, wallet Wallet) RuntimeGateCommercialAdmission {
	accountExists := false
	accountApproved := false
	if account, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID); err == nil {
		accountExists = true
		accountApproved = businessAccountApproved(account)
	}
	balanceSufficient := wallet.AvailableBalance >= commercialRuntimeHoldAmount || reason == "runtime_storage_ready"
	allowed := accountExists && accountApproved && strings.TrimSpace(workspaceID) != "" && providerKeyRefExists && balanceSufficient
	decision := "allowed"
	if !allowed {
		decision = "blocked"
	}
	return RuntimeGateCommercialAdmission{
		AccountExists:         accountExists,
		AccountApproved:       accountApproved,
		WorkspaceExists:       strings.TrimSpace(workspaceID) != "",
		ProviderKeyRefExists:  providerKeyRefExists,
		PlanSelected:          true,
		BalanceSufficient:     balanceSufficient,
		QuotaAvailable:        true,
		EmergencyPlatformStop: false,
		Allowed:               allowed,
		Decision:              decision,
		Reason:                firstNonEmpty(reason, "runtime_storage_not_opened"),
	}
}

func businessAccountApproved(account cpd.BusinessAccount) bool {
	switch strings.TrimSpace(account.Status) {
	case "prepared", "approved", "active", "provisioned":
		return true
	default:
		return false
	}
}

func commercialAdmissionConditions() []string {
	return []string{
		commercialAdmissionConditionAccountExists,
		commercialAdmissionConditionAccountApproved,
		commercialAdmissionConditionWorkspaceExists,
		commercialAdmissionConditionProviderKeyRefWhenNeeded,
		commercialAdmissionConditionPlanSelected,
		commercialAdmissionConditionBalanceSufficient,
		commercialAdmissionConditionQuotaAvailable,
		commercialAdmissionConditionNoEmergencyPlatformStop,
	}
}
