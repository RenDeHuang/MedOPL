package controlplane

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

func normalizedCanaryAdmissionPolicy(policy CanaryAdmissionPolicy) CanaryAdmissionPolicy {
	normalized := policy
	normalized.AllowTenants = normalizedStringSet(policy.AllowTenants)
	normalized.AllowUsers = normalizedStringSet(policy.AllowUsers)
	normalized.EnabledBy = firstNonEmpty(policy.EnabledBy, "medopl-operations")
	normalized.MonitoringOwner = firstNonEmpty(policy.MonitoringOwner, "MedOPL Operations")
	normalized.RollbackOwner = firstNonEmpty(policy.RollbackOwner, "MedOPL Operations")
	normalized.DisableCommandRef = firstNonEmpty(policy.DisableCommandRef, "MEDOPL_CANARY_ADMISSION_ENABLED=0")
	return normalized
}

func normalizedStringSet(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		out = append(out, trimmed)
	}
	sort.Strings(out)
	return out
}

func (service *Service) canaryAdmissionDecision(ctx context.Context, tenantID string, portalUserID string, workspaceID string) (CanaryAdmissionDecision, error) {
	policy := service.canaryAdmission
	if !policy.Enabled {
		return CanaryAdmissionDecision{Enabled: false, Allowed: true, Decision: "not_required"}, nil
	}
	decision := CanaryAdmissionDecision{
		Enabled:            true,
		Allowed:            true,
		Decision:           "allowed",
		EnabledBy:          policy.EnabledBy,
		TenantScopeHash:    scopeHash(policy.AllowTenants),
		UserScopeHash:      scopeHash(policy.AllowUsers),
		CostCeiling:        policy.CostCeiling,
		MonitoringOwner:    policy.MonitoringOwner,
		RollbackOwner:      policy.RollbackOwner,
		DisableCommandRef:  policy.DisableCommandRef,
		AdmissionReceiptID: "audit-" + stableID(workspaceID+":canary-admission"),
	}
	if policy.EmergencyStop {
		decision.Allowed = false
		decision.Decision = "disabled"
		decision.Reason = "emergency_stop_triggered"
		audit, err := service.recordCanaryAdmissionAudit(ctx, cpd.AuditKindEmergencyStopTriggered, workspaceID, "", decision, "canary-admission:emergency:"+stableID(workspaceID+":"+tenantID+":"+portalUserID))
		if err != nil {
			return decision, err
		}
		decision.AdmissionReceiptID = audit.ID
		return decision, cpd.ErrCanaryAdmissionDisabled
	}
	if !allows(policy.AllowTenants, tenantID) || !allows(policy.AllowUsers, portalUserID) {
		decision.Allowed = false
		decision.Decision = "denied"
		decision.Reason = "selected_tenant_user_required"
		audit, err := service.recordCanaryAdmissionAudit(ctx, cpd.AuditKindCanaryAdmissionDenied, workspaceID, "", decision, "canary-admission:denied:"+stableID(workspaceID+":"+tenantID+":"+portalUserID))
		if err != nil {
			return decision, err
		}
		decision.AdmissionReceiptID = audit.ID
		return decision, cpd.ErrCanaryAdmissionDenied
	}
	audit, err := service.recordCanaryAdmissionAudit(ctx, cpd.AuditKindCanaryAdmissionEnabled, workspaceID, "", decision, "canary-admission:enabled:"+stableID(workspaceID+":"+tenantID+":"+portalUserID))
	if err != nil {
		return decision, err
	}
	decision.AdmissionReceiptID = audit.ID
	return decision, nil
}

func (service *Service) recordCanaryAdmissionDisabled(ctx context.Context, workspaceID string, resourceBindingID string) error {
	decision := CanaryAdmissionDecision{
		Enabled:            true,
		Allowed:            false,
		Decision:           "disabled",
		Reason:             "new_runtime_required_blocked",
		EnabledBy:          service.canaryAdmission.EnabledBy,
		TenantScopeHash:    scopeHash(service.canaryAdmission.AllowTenants),
		UserScopeHash:      scopeHash(service.canaryAdmission.AllowUsers),
		CostCeiling:        service.canaryAdmission.CostCeiling,
		MonitoringOwner:    service.canaryAdmission.MonitoringOwner,
		RollbackOwner:      service.canaryAdmission.RollbackOwner,
		DisableCommandRef:  service.canaryAdmission.DisableCommandRef,
		AdmissionReceiptID: "audit-" + stableID(workspaceID+":canary-disabled"),
	}
	_, err := service.recordCanaryAdmissionAudit(ctx, cpd.AuditKindCanaryAdmissionDisabled, workspaceID, resourceBindingID, decision, "canary-admission:disabled:"+stableID(workspaceID+":"+resourceBindingID))
	return err
}

func (service *Service) recordCanaryAdmissionAudit(ctx context.Context, kind string, workspaceID string, resourceBindingID string, decision CanaryAdmissionDecision, idempotencyKey string) (cpd.AuditEvent, error) {
	if strings.TrimSpace(workspaceID) == "" {
		workspaceID = "workspace-unknown"
	}
	audit := cpd.AuditEvent{
		ID:                "audit-" + stableID(kind+":"+workspaceID+":"+idempotencyKey),
		Kind:              kind,
		WorkspaceID:       workspaceID,
		ResourceBindingID: resourceBindingID,
		Status:            "recorded",
		IdempotencyKey:    idempotencyKey,
		CreatedAt:         service.now().UTC().Format(time.RFC3339),
	}
	if err := service.store.SaveAuditEvent(ctx, audit); err != nil {
		return cpd.AuditEvent{}, err
	}
	return audit, nil
}

func allows(allowlist []string, value string) bool {
	trimmed := strings.TrimSpace(value)
	if len(allowlist) == 0 || trimmed == "" {
		return false
	}
	for _, item := range allowlist {
		if item == trimmed {
			return true
		}
	}
	return false
}

func scopeHash(values []string) string {
	return stableID(strings.Join(normalizedStringSet(values), ","))
}

func isCanaryAdmissionError(err error) bool {
	return errors.Is(err, cpd.ErrCanaryAdmissionDenied) || errors.Is(err, cpd.ErrCanaryAdmissionDisabled)
}
