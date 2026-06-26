package controlplane

import (
	"context"
	"errors"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
	cprepo "github.com/rendehuang/medopl/services/medopl-go-backend/internal/repository/controlplane"
)

const commercialFreezeDays = 7

type CreatePaymentOrderInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	Amount         float64
	Currency       string
	IdempotencyKey string
	ProviderRef    string
}

type PaymentOrderProjection struct {
	Ok             bool    `json:"ok"`
	Source         string  `json:"source"`
	OrderID        string  `json:"orderId"`
	Status         string  `json:"status"`
	TenantID       string  `json:"tenantId"`
	PortalUserID   string  `json:"portalUserId"`
	WorkspaceID    string  `json:"workspaceId"`
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`
	IdempotencyKey string  `json:"idempotencyKey"`
	ProviderRef    string  `json:"providerRef,omitempty"`
	CreatedAt      string  `json:"createdAt"`
}

type MarkPaymentPaidInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	OrderID        string
	Amount         float64
	Currency       string
	IdempotencyKey string
	ProviderRef    string
}

type RefundBusinessAccountInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	Amount         float64
	Currency       string
	IdempotencyKey string
	Reason         string
}

type AdjustBusinessAccountInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	Amount         float64
	Currency       string
	IdempotencyKey string
	Reason         string
}

type BillingStatement struct {
	Ok                     bool                             `json:"ok"`
	Source                 string                           `json:"source"`
	WorkspaceID            string                           `json:"workspaceId"`
	RunCount               int                              `json:"runCount"`
	LedgerCount            int                              `json:"ledgerCount"`
	Wallet                 Wallet                           `json:"wallet"`
	Rows                   []LedgerItem                     `json:"rows"`
	BusinessClosureReceipt CommercialBusinessClosureReceipt `json:"businessClosureReceipt"`
	Receipts               struct {
		RuntimeHold        bool `json:"runtimeHold"`
		StorageMetadata    bool `json:"storageMetadata"`
		FileMetadata       bool `json:"fileMetadata"`
		RunMetadata        bool `json:"runMetadata"`
		ArtifactMetadata   bool `json:"artifactMetadata"`
		BillingAuditLinked bool `json:"billingAuditLinked"`
		ReleaseSettlement  bool `json:"releaseSettlement"`
	} `json:"receipts"`
}

type CommercialBusinessClosureReceipt struct {
	CustomerAccountExists     bool     `json:"customerAccountExists"`
	CreditRecorded            bool     `json:"creditRecorded"`
	BalanceIncreased          bool     `json:"balanceIncreased"`
	PreOpenBalanceCheck       string   `json:"preOpenBalanceCheck"`
	ResourcePreauthFreeze     bool     `json:"resourcePreauthFreeze"`
	UsageDebitRecorded        bool     `json:"usageDebitRecorded"`
	BillingAttributionLinked  bool     `json:"billingAttributionLinked"`
	ReleaseStopBilling        bool     `json:"releaseStopBilling"`
	StorageBillingStopped     bool     `json:"storageBillingStopped"`
	AuditLinked               bool     `json:"auditLinked"`
	IdempotencyPolicy         string   `json:"idempotencyPolicy"`
	InsufficientBalancePolicy string   `json:"insufficientBalancePolicy"`
	CanClaim                  []string `json:"canClaim"`
	CannotClaim               []string `json:"cannotClaim"`
}

type RuntimeFreezeProjection struct {
	Ok                bool    `json:"ok"`
	Source            string  `json:"source"`
	WorkspaceID       string  `json:"workspaceId"`
	ResourceBindingID string  `json:"resourceBindingId"`
	Status            string  `json:"status"`
	Amount            float64 `json:"amount"`
	Currency          string  `json:"currency"`
	StartedAt         string  `json:"startedAt,omitempty"`
	SettleEligibleAt  string  `json:"settleEligibleAt,omitempty"`
	FreezeDays        int     `json:"freezeDays"`
}

func (service *Service) CreatePaymentOrder(ctx context.Context, input CreatePaymentOrderInput) (PaymentOrderProjection, error) {
	if input.Amount <= 0 {
		return PaymentOrderProjection{}, cpd.ErrBillingAttributionRequired
	}
	tenantID, portalUserID, workspaceID, err := service.resolveCommercialIdentity(ctx, input.TenantID, input.PortalUserID, input.WorkspaceID)
	if err != nil {
		return PaymentOrderProjection{}, err
	}
	idempotencyKey := firstNonEmpty(input.IdempotencyKey, "payment-order:"+workspaceID)
	createdAt := service.now().UTC().Format(time.RFC3339)
	return PaymentOrderProjection{
		Ok:             true,
		Source:         "go-control-plane",
		OrderID:        "payorder-" + stableID(workspaceID+":"+idempotencyKey),
		Status:         "created",
		TenantID:       tenantID,
		PortalUserID:   portalUserID,
		WorkspaceID:    workspaceID,
		Amount:         input.Amount,
		Currency:       firstNonEmpty(input.Currency, "CNY"),
		IdempotencyKey: idempotencyKey,
		ProviderRef:    strings.TrimSpace(input.ProviderRef),
		CreatedAt:      createdAt,
	}, nil
}

func (service *Service) MarkPaymentPaid(ctx context.Context, input MarkPaymentPaidInput) (BusinessAccountProjection, error) {
	if input.Amount <= 0 {
		return BusinessAccountProjection{}, cpd.ErrBillingAttributionRequired
	}
	tenantID, portalUserID, workspaceID, err := service.resolveCommercialIdentity(ctx, input.TenantID, input.PortalUserID, input.WorkspaceID)
	if err != nil {
		return BusinessAccountProjection{}, err
	}
	orderID := firstNonEmpty(input.OrderID, "payorder-"+stableID(workspaceID+":"+input.IdempotencyKey))
	return service.CreditBusinessAccount(ctx, CreditBusinessAccountInput{
		TenantID:       tenantID,
		PortalUserID:   portalUserID,
		WorkspaceID:    workspaceID,
		Amount:         input.Amount,
		Currency:       firstNonEmpty(input.Currency, "CNY"),
		IdempotencyKey: "payment-paid:" + orderID + ":" + firstNonEmpty(input.IdempotencyKey, input.ProviderRef),
	})
}

func (service *Service) RefundBusinessAccount(ctx context.Context, input RefundBusinessAccountInput) (BusinessAccountProjection, error) {
	return service.writeCommercialBillingMutation(ctx, commercialBillingMutationInput{
		TenantID:       input.TenantID,
		PortalUserID:   input.PortalUserID,
		WorkspaceID:    input.WorkspaceID,
		Amount:         input.Amount,
		Currency:       input.Currency,
		IdempotencyKey: input.IdempotencyKey,
		Type:           "refund",
		Reason:         firstNonEmpty(input.Reason, "customer_refund"),
	})
}

func (service *Service) AdjustBusinessAccount(ctx context.Context, input AdjustBusinessAccountInput) (BusinessAccountProjection, error) {
	return service.writeCommercialBillingMutation(ctx, commercialBillingMutationInput{
		TenantID:       input.TenantID,
		PortalUserID:   input.PortalUserID,
		WorkspaceID:    input.WorkspaceID,
		Amount:         input.Amount,
		Currency:       input.Currency,
		IdempotencyKey: input.IdempotencyKey,
		Type:           "adjustment",
		Reason:         firstNonEmpty(input.Reason, "admin_adjustment"),
	})
}

func (service *Service) BillingStatement(ctx context.Context, input WorkspaceInput) (BillingStatement, error) {
	summary, err := service.BillingSummary(ctx, input)
	if err != nil {
		return BillingStatement{}, err
	}
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	files, err := service.store.ListFiles(ctx, workspaceID)
	if err != nil {
		return BillingStatement{}, err
	}
	runs, err := service.store.ListRuns(ctx, workspaceID)
	if err != nil {
		return BillingStatement{}, err
	}
	artifacts, err := service.store.ListArtifacts(ctx, workspaceID)
	if err != nil {
		return BillingStatement{}, err
	}
	audits, err := service.store.ListAuditEvents(ctx, workspaceID)
	if err != nil {
		return BillingStatement{}, err
	}
	statement := BillingStatement{
		Ok:                     true,
		Source:                 "go-control-plane",
		WorkspaceID:            workspaceID,
		RunCount:               summary.RunCount,
		LedgerCount:            summary.LedgerCount,
		Wallet:                 summary.Wallet,
		Rows:                   summary.Ledger,
		BusinessClosureReceipt: service.commercialBusinessClosureReceipt(ctx, workspaceID, summary.Wallet, summary.Ledger, audits),
	}
	for _, row := range summary.Ledger {
		if row.Type == "hold" && row.Reason == "resource_preauth_freeze" {
			statement.Receipts.RuntimeHold = true
		}
		if row.Type == "release" && row.Reason == "subscription_freeze_release" {
			statement.Receipts.ReleaseSettlement = true
		}
		if row.SourceEventID != "" && row.SourceEventType != "" {
			statement.Receipts.BillingAuditLinked = true
		}
	}
	statement.Receipts.FileMetadata = len(files) > 0
	statement.Receipts.RunMetadata = len(runs) > 0
	statement.Receipts.ArtifactMetadata = len(artifacts) > 0
	statement.Receipts.StorageMetadata = hasStorageMetadata(files, runs, artifacts)
	return statement, nil
}

func (service *Service) commercialBusinessClosureReceipt(ctx context.Context, workspaceID string, wallet Wallet, ledger []LedgerItem, audits []cpd.AuditEvent) CommercialBusinessClosureReceipt {
	receipt := CommercialBusinessClosureReceipt{
		PreOpenBalanceCheck:       "account_and_available_balance_required",
		IdempotencyPolicy:         "credit_and_billing_events_use_idempotency_keys",
		InsufficientBalancePolicy: "runtime_open_fails_closed_when_available_balance_below_hold",
		CanClaim: []string{
			"internal_commercial_billing_ledger_closure",
			"credit_balance_freeze_debit_release_audit_receipt",
		},
		CannotClaim: []string{
			"external_psp_settlement",
			"card_network_or_bank_reconciliation",
			"tax_invoice_or_enterprise_compliance",
			"full_production_complete",
		},
	}
	if _, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID); err == nil {
		receipt.CustomerAccountExists = true
	}
	for _, item := range ledger {
		if item.Type == "credit" && item.Amount > 0 {
			receipt.CreditRecorded = true
		}
		if item.Type == "hold" && item.Reason == "resource_preauth_freeze" {
			receipt.ResourcePreauthFreeze = true
		}
		if item.Type == "debit" && item.Amount > 0 {
			receipt.UsageDebitRecorded = true
		}
		if item.BillingAttributionID != "" && item.SourceEventID != "" && item.SourceEventType != "" {
			receipt.BillingAttributionLinked = true
			receipt.AuditLinked = true
		}
		if item.Type == "release" && item.SourceEventType == cpd.AuditKindResourceRelease {
			receipt.ReleaseStopBilling = true
		}
		if item.Type == "release" && item.SourceEventType == cpd.AuditKindStorageDestroy {
			receipt.StorageBillingStopped = true
		}
	}
	receipt.BalanceIncreased = receipt.CreditRecorded && wallet.Balance > 0
	for _, audit := range audits {
		if audit.ID != "" && audit.Kind != "" {
			receipt.AuditLinked = true
		}
		if audit.Kind == cpd.AuditKindResourceRelease {
			receipt.ReleaseStopBilling = true
		}
		if audit.Kind == cpd.AuditKindStorageDestroy {
			receipt.StorageBillingStopped = true
		}
	}
	return receipt
}

func (service *Service) RuntimeFreeze(ctx context.Context, input WorkspaceInput) (RuntimeFreezeProjection, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	if workspaceID == "" {
		return RuntimeFreezeProjection{}, cpd.ErrWorkspaceRequired
	}
	events, err := service.store.ListBillingEvents(ctx, workspaceID)
	if err != nil {
		return RuntimeFreezeProjection{}, err
	}
	for _, event := range events {
		if event.Type != "hold" || event.Reason != "resource_preauth_freeze" {
			continue
		}
		started := parseCommercialTime(event.CreatedAt)
		status := "active"
		if walletFromCommercialLedger(ledgerFromBillingEvents(events)).ActiveFreeze <= 0 {
			status = "settled"
		}
		return RuntimeFreezeProjection{
			Ok:                true,
			Source:            "go-control-plane",
			WorkspaceID:       workspaceID,
			ResourceBindingID: event.ResourceBindingID,
			Status:            status,
			Amount:            event.Amount,
			Currency:          firstNonEmpty(event.Currency, "CNY"),
			StartedAt:         event.CreatedAt,
			SettleEligibleAt:  started.AddDate(0, 0, commercialFreezeDays).UTC().Format(time.RFC3339),
			FreezeDays:        commercialFreezeDays,
		}, nil
	}
	return RuntimeFreezeProjection{
		Ok:          true,
		Source:      "go-control-plane",
		WorkspaceID: workspaceID,
		Status:      "none",
		FreezeDays:  commercialFreezeDays,
	}, nil
}

func (service *Service) ensureCommercialAccountCanOpen(ctx context.Context, workspaceID string) (cpd.BusinessAccount, error) {
	account, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID)
	if err != nil {
		return cpd.BusinessAccount{}, cpd.ErrAccountRequired
	}
	if !businessAccountApproved(account) {
		return cpd.BusinessAccount{}, cpd.ErrAccountNotApproved
	}
	events, err := service.store.ListBillingEvents(ctx, workspaceID)
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	credits, err := service.store.ListCreditEvents(ctx, workspaceID)
	if err != nil {
		return cpd.BusinessAccount{}, err
	}
	wallet := walletFromCommercialLedger(appendCreditLedgerItems(ledgerFromBillingEvents(events), credits))
	if wallet.AvailableBalance < commercialRuntimeHoldAmount {
		return cpd.BusinessAccount{}, cpd.ErrInsufficientBalance
	}
	return account, nil
}

type commercialBillingMutationInput struct {
	TenantID       string
	PortalUserID   string
	WorkspaceID    string
	Amount         float64
	Currency       string
	IdempotencyKey string
	Type           string
	Reason         string
}

func (service *Service) writeCommercialBillingMutation(ctx context.Context, input commercialBillingMutationInput) (BusinessAccountProjection, error) {
	if input.Amount <= 0 {
		return BusinessAccountProjection{}, cpd.ErrBillingAttributionRequired
	}
	tenantID, portalUserID, workspaceID, err := service.resolveCommercialIdentity(ctx, input.TenantID, input.PortalUserID, input.WorkspaceID)
	if err != nil {
		return BusinessAccountProjection{}, err
	}
	currency := firstNonEmpty(input.Currency, "CNY")
	idempotencyKey := firstNonEmpty(input.IdempotencyKey, input.Type+":"+workspaceID)
	if input.Type == "refund" {
		summary, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: workspaceID})
		if err != nil {
			return BusinessAccountProjection{}, err
		}
		if summary.Wallet.AvailableBalance < input.Amount {
			return BusinessAccountProjection{}, cpd.ErrInsufficientBalance
		}
	}
	event := cpd.BillingEvent{
		ID:              "billing-" + input.Type + "-" + stableID(workspaceID+":"+idempotencyKey),
		TenantID:        tenantID,
		WorkspaceID:     workspaceID,
		Type:            input.Type,
		Status:          "recorded",
		IdempotencyKey:  input.Type + ":" + idempotencyKey,
		Amount:          input.Amount,
		Currency:        currency,
		Reason:          input.Reason,
		OwnerScope:      "go-control-plane",
		SourceEventID:   input.Type + "-" + stableID(idempotencyKey),
		SourceEventType: input.Type,
		CreatedAt:       service.now().UTC().Format(time.RFC3339),
	}
	if err := service.store.SaveBillingEvent(ctx, event); err != nil {
		return BusinessAccountProjection{}, err
	}
	summary, err := service.BillingSummary(ctx, WorkspaceInput{WorkspaceID: workspaceID})
	if err != nil {
		return BusinessAccountProjection{}, err
	}
	return BusinessAccountProjection{
		Ok:           true,
		Source:       "go-control-plane",
		Status:       "prepared",
		TenantID:     tenantID,
		PortalUserID: portalUserID,
		WorkspaceID:  workspaceID,
		Balance:      summary.Wallet.Balance,
		Currency:     currency,
	}, nil
}

func (service *Service) resolveCommercialIdentity(ctx context.Context, tenantID string, portalUserID string, workspaceID string) (string, string, string, error) {
	tenantID = strings.TrimSpace(tenantID)
	portalUserID = strings.TrimSpace(portalUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID != "" {
		account, err := service.store.BusinessAccountByWorkspace(ctx, workspaceID)
		if err == nil {
			return firstNonEmpty(tenantID, account.TenantID), firstNonEmpty(portalUserID, account.PortalUserID), workspaceID, nil
		}
		if err != nil && !errors.Is(err, cprepo.ErrNotFound) {
			return "", "", "", err
		}
	}
	if portalUserID != "" {
		account, err := service.store.BusinessAccountByUser(ctx, portalUserID)
		if err == nil {
			return firstNonEmpty(tenantID, account.TenantID), portalUserID, account.WorkspaceID, nil
		}
		if err != nil && !errors.Is(err, cprepo.ErrNotFound) {
			return "", "", "", err
		}
	}
	if tenantID == "" {
		return "", "", "", cpd.ErrTenantRequired
	}
	if portalUserID == "" {
		return "", "", "", cpd.ErrPortalUserRequired
	}
	if workspaceID == "" {
		return "", "", "", cpd.ErrWorkspaceRequired
	}
	return tenantID, portalUserID, workspaceID, nil
}

func hasStorageMetadata(files []cpd.FileRecord, runs []cpd.RunRecord, artifacts []cpd.ArtifactRecord) bool {
	for _, file := range files {
		if file.StorageBindingID != "" && file.ObjectRef != "" {
			return true
		}
	}
	for _, run := range runs {
		if run.StorageBindingID != "" && len(run.InputObjectRefs) > 0 {
			return true
		}
	}
	for _, artifact := range artifacts {
		if artifact.StorageBindingID != "" && artifact.ObjectRef != "" {
			return true
		}
	}
	return false
}

func parseCommercialTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(value))
	if err != nil {
		return time.Time{}
	}
	return parsed
}
