package controlplane

import (
	"context"
	"strings"
	"time"

	cpd "github.com/rendehuang/medopl/services/medopl-go-backend/internal/domain/controlplane"
)

type BillingSummary struct {
	Ok          bool   `json:"ok"`
	Source      string `json:"source"`
	RunCount    int    `json:"runCount"`
	LedgerCount int    `json:"ledgerCount"`
	Wallet      Wallet `json:"wallet"`
	Totals      Costs  `json:"totals"`
	Breakdown   struct {
		CPUCost        float64 `json:"cpuCost"`
		GPUCost        float64 `json:"gpuCost"`
		StorageCost    float64 `json:"storageCost"`
		VPnCost        float64 `json:"vpnCost"`
		TrafficCost    float64 `json:"trafficCost"`
		OtherCloudCost float64 `json:"otherCloudCost"`
		CloudSource    string  `json:"cloudSource"`
		PricingSource  string  `json:"pricingSource"`
	} `json:"breakdown"`
	Summary struct {
		SelectedCost   float64 `json:"selectedCost"`
		RunCount       int     `json:"runCount"`
		WorkspaceCount int     `json:"workspaceCount"`
		PendingCost    float64 `json:"pendingCost"`
		ExactCost      float64 `json:"exactCost"`
	} `json:"summary"`
	SupportBoundary SupportBoundary `json:"supportBoundary"`
	Filter          BillingFilter   `json:"filter"`
	TodayCost       float64         `json:"todayCost"`
	Ledger          []LedgerItem    `json:"ledger,omitempty"`
}

type BillingDetails struct {
	Ok               bool         `json:"ok"`
	Source           string       `json:"source"`
	TaskCosts        []TaskCost   `json:"taskCosts"`
	TaskPagination   Pagination   `json:"taskPagination"`
	RunCosts         []RunCost    `json:"runCosts"`
	RunPagination    Pagination   `json:"runPagination"`
	Ledger           []LedgerItem `json:"ledger"`
	LedgerPagination Pagination   `json:"ledgerPagination"`
	Trend            Trend        `json:"trend"`
}

type Wallet struct {
	Balance          float64 `json:"balance"`
	ActiveFreeze     float64 `json:"activeFreeze"`
	Frozen           float64 `json:"frozen"`
	AvailableBalance float64 `json:"availableBalance"`
}

type Costs struct {
	CPUCost   float64 `json:"cpuCost"`
	GPUCost   float64 `json:"gpuCost"`
	PVCost    float64 `json:"pvCost"`
	TotalCost float64 `json:"totalCost"`
}

type SupportBoundary struct {
	SupportStatus             string   `json:"supportStatus"`
	FundingStatus             string   `json:"fundingStatus"`
	GraceStatus               string   `json:"graceStatus"`
	FileRetentionStatus       string   `json:"fileRetentionStatus"`
	FailedRunBillingStatus    string   `json:"failedRunBillingStatus"`
	CanStartPaidRun           bool     `json:"canStartPaidRun"`
	CanDownloadExistingOutput bool     `json:"canDownloadExistingOutput"`
	BillingCopy               string   `json:"billingCopy"`
	UserCopy                  string   `json:"userCopy"`
	ActionRequired            []string `json:"actionRequired"`
	Amounts                   struct {
		WalletBalance      float64 `json:"walletBalance"`
		ActiveFreeze       float64 `json:"activeFreeze"`
		AvailableBalance   float64 `json:"availableBalance"`
		MinRequiredBalance float64 `json:"minRequiredBalance"`
	} `json:"amounts"`
}

type BillingFilter struct {
	Range string `json:"range"`
	From  string `json:"from"`
	To    string `json:"to"`
}

type TaskCost struct {
	Slug        string  `json:"slug"`
	Title       string  `json:"title"`
	TotalCost   float64 `json:"totalCost"`
	CPUCost     float64 `json:"cpuCost"`
	GPUCost     float64 `json:"gpuCost"`
	StorageCost float64 `json:"storageCost"`
	RunCount    int     `json:"runCount"`
}

type RunCost struct {
	TaskRef       string  `json:"taskRef"`
	WorkspaceID   string  `json:"workspaceId"`
	CPUCost       float64 `json:"cpuCost"`
	GPUCost       float64 `json:"gpuCost"`
	StorageCost   float64 `json:"storageCost"`
	TotalCost     float64 `json:"totalCost"`
	StartedAt     string  `json:"startedAt"`
	EndedAt       string  `json:"endedAt"`
	PricingSource string  `json:"pricingSource"`
	RunStatus     string  `json:"runStatus"`
}

type LedgerItem struct {
	ID              string  `json:"id,omitempty"`
	Type            string  `json:"type"`
	Amount          float64 `json:"amount"`
	Reason          string  `json:"reason,omitempty"`
	OwnerScope      string  `json:"ownerScope,omitempty"`
	SourceEventID   string  `json:"sourceEventId,omitempty"`
	SourceEventType string  `json:"sourceEventType,omitempty"`
	CreatedAt       string  `json:"createdAt"`
}

type Pagination struct {
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
	Total    int `json:"total"`
}

type Trend struct {
	Labels  []string  `json:"labels"`
	Total   []float64 `json:"total"`
	CPU     []float64 `json:"cpu"`
	GPU     []float64 `json:"gpu"`
	Storage []float64 `json:"storage"`
}

func (service *Service) BillingSummary(ctx context.Context, input WorkspaceInput) (BillingSummary, error) {
	workspaceID := strings.TrimSpace(input.WorkspaceID)
	events, err := service.store.ListAuditEvents(ctx, workspaceID)
	if err != nil {
		return BillingSummary{}, err
	}
	runCount := 0
	for _, event := range events {
		if event.Kind == cpd.AuditKindRunSucceeded {
			runCount++
		}
	}
	totalCost := float64(runCount) * 1.25
	summary := BillingSummary{
		Ok:        true,
		Source:    "go-control-plane",
		Wallet:    Wallet{Balance: 100, ActiveFreeze: 10, Frozen: 10, AvailableBalance: 90},
		Totals:    Costs{CPUCost: totalCost, GPUCost: 0, PVCost: 0.1, TotalCost: totalCost + 0.1},
		Filter:    BillingFilter{Range: "local-rc", From: "", To: ""},
		TodayCost: totalCost + 0.1,
		Ledger:    ledgerFromEvents(events),
	}
	summary.Breakdown.CPUCost = totalCost
	summary.Breakdown.StorageCost = 0.1
	summary.Breakdown.CloudSource = "local-go-control-plane"
	summary.Breakdown.PricingSource = "local-rc-deterministic"
	summary.Summary.SelectedCost = totalCost + 0.1
	summary.Summary.RunCount = runCount
	summary.Summary.WorkspaceCount = 1
	summary.Summary.ExactCost = totalCost + 0.1
	summary.RunCount = runCount
	summary.LedgerCount = len(summary.Ledger)
	summary.SupportBoundary.SupportStatus = "local_rc"
	summary.SupportBoundary.FundingStatus = "funded"
	summary.SupportBoundary.GraceStatus = "active"
	summary.SupportBoundary.FileRetentionStatus = "active"
	summary.SupportBoundary.FailedRunBillingStatus = "not_charged"
	summary.SupportBoundary.CanStartPaidRun = true
	summary.SupportBoundary.CanDownloadExistingOutput = true
	summary.SupportBoundary.BillingCopy = "Go control-plane local RC billing projection."
	summary.SupportBoundary.UserCopy = "本地 RC 账务投影可用。"
	summary.SupportBoundary.ActionRequired = []string{}
	summary.SupportBoundary.Amounts.WalletBalance = summary.Wallet.Balance
	summary.SupportBoundary.Amounts.ActiveFreeze = summary.Wallet.ActiveFreeze
	summary.SupportBoundary.Amounts.AvailableBalance = summary.Wallet.AvailableBalance
	summary.SupportBoundary.Amounts.MinRequiredBalance = 1
	return summary, nil
}

func (service *Service) BillingDetails(ctx context.Context, input WorkspaceInput) (BillingDetails, error) {
	summary, err := service.BillingSummary(ctx, input)
	if err != nil {
		return BillingDetails{}, err
	}
	now := service.now().UTC().Format(time.RFC3339)
	return BillingDetails{
		Ok:               true,
		Source:           "go-control-plane",
		TaskCosts:        []TaskCost{{Slug: firstNonEmpty(input.WorkspaceID, "workspace-local-rc"), Title: "Go local RC workspace", TotalCost: summary.Totals.TotalCost, CPUCost: summary.Totals.CPUCost, StorageCost: summary.Breakdown.StorageCost, RunCount: summary.Summary.RunCount}},
		TaskPagination:   Pagination{Page: 1, PageSize: 20, Total: 1},
		RunCosts:         []RunCost{{TaskRef: "run-local-rc", WorkspaceID: firstNonEmpty(input.WorkspaceID, "workspace-local-rc"), CPUCost: summary.Totals.CPUCost, StorageCost: summary.Breakdown.StorageCost, TotalCost: summary.Totals.TotalCost, StartedAt: now, EndedAt: now, PricingSource: "local-rc-deterministic", RunStatus: "succeeded"}},
		RunPagination:    Pagination{Page: 1, PageSize: 20, Total: 1},
		Ledger:           summary.Ledger,
		LedgerPagination: Pagination{Page: 1, PageSize: 20, Total: len(summary.Ledger)},
		Trend:            Trend{Labels: []string{"local-rc"}, Total: []float64{summary.Totals.TotalCost}, CPU: []float64{summary.Totals.CPUCost}, GPU: []float64{0}, Storage: []float64{summary.Breakdown.StorageCost}},
	}, nil
}

func ledgerFromEvents(events []cpd.AuditEvent) []LedgerItem {
	if len(events) == 0 {
		return []LedgerItem{{ID: "ledger-local-rc-open", Type: "hold", Amount: 10, Reason: "local_rc_environment_open", OwnerScope: "go-control-plane", CreatedAt: time.Time{}.Format(time.RFC3339)}}
	}
	items := make([]LedgerItem, 0, len(events))
	for _, event := range events {
		entryType := "debit"
		amount := 1.25
		switch event.Kind {
		case cpd.AuditKindFileUpload:
			entryType = "hold"
			amount = 0.1
		case cpd.AuditKindArtifactAvailable:
			entryType = "debit"
			amount = 0
		case cpd.AuditKindResourceRelease, cpd.AuditKindStorageDestroy:
			entryType = "release"
			amount = 0
		}
		items = append(items, LedgerItem{
			ID:              event.ID,
			Type:            entryType,
			Amount:          amount,
			Reason:          event.Status,
			OwnerScope:      "go-control-plane",
			SourceEventID:   event.ID,
			SourceEventType: event.Kind,
			CreatedAt:       event.CreatedAt,
		})
	}
	return items
}
