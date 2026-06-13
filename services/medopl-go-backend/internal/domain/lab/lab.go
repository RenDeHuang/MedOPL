package lab

import (
	"errors"
	"strings"
)

type SubscriptionStatus string

const (
	SubscriptionStatusActive      SubscriptionStatus = "active"
	SubscriptionStatusGracePeriod SubscriptionStatus = "grace_period"
	SubscriptionStatusCancelled   SubscriptionStatus = "cancelled"
)

var (
	ErrWorkspaceRequired = errors.New("workspace_id_required")
	ErrPackageRequired   = errors.New("package_id_required")
	ErrPackageNotFound   = errors.New("package_not_found")
)

type ComputeSpec struct {
	Tier              string `json:"tier"`
	Label             string `json:"label"`
	Cores             int    `json:"cores"`
	MemoryGB          int    `json:"memoryGb"`
	MaxConcurrentRuns int    `json:"maxConcurrentRuns"`
}

type StorageSpec struct {
	IncludedGB   int     `json:"includedGb"`
	WarningRatio float64 `json:"warningRatio"`
}

type BillingSpec struct {
	BasePrice              *int   `json:"basePrice"`
	PendingProductApproval bool   `json:"pendingProductApproval"`
	PriceLabel             string `json:"priceLabel"`
	FreezeDays             int    `json:"freezeDays"`
}

type PackagePlan struct {
	ID                  string      `json:"id"`
	Name                string      `json:"name"`
	Audience            string      `json:"audience"`
	Currency            string      `json:"currency"`
	ComputeTier         string      `json:"computeTier"`
	Headline            string      `json:"headline"`
	Compute             ComputeSpec `json:"compute"`
	Storage             StorageSpec `json:"storage"`
	Billing             BillingSpec `json:"billing"`
	BackingServerPlanID string      `json:"backingServerPlanId"`
	ComputePower        string      `json:"computePower"`
	StorageCapacityGB   int         `json:"storageCapacityGb"`
	GracePeriodDays     int         `json:"gracePeriodDays"`
	PlanSummary         string      `json:"planSummary"`
	MemoryGB            int         `json:"memoryGb"`
}

type Subscription struct {
	ID             string             `json:"id"`
	WorkspaceID    string             `json:"workspaceId"`
	PackageID      string             `json:"packageId"`
	Status         SubscriptionStatus `json:"status"`
	IdempotencyKey string             `json:"idempotencyKey"`
}

type Entitlement struct {
	Enabled     bool        `json:"enabled"`
	Status      string      `json:"status"`
	WorkspaceID string      `json:"workspaceId,omitempty"`
	PackageID   string      `json:"packageId,omitempty"`
	PackageName string      `json:"packageName,omitempty"`
	Compute     ComputeSpec `json:"compute"`
	Storage     struct {
		IncludedGB    int     `json:"includedGb"`
		AddonGB       int     `json:"addonGb"`
		TotalGB       int     `json:"totalGb"`
		UsedGB        int     `json:"usedGb"`
		AvailableGB   int     `json:"availableGb"`
		RetentionDays int     `json:"retentionDays"`
		WarningRatio  float64 `json:"warningRatio"`
		Warning       bool    `json:"warning"`
		Blocked       bool    `json:"blocked"`
	} `json:"storage"`
	Gates struct {
		CanUpload   bool `json:"canUpload"`
		CanRun      bool `json:"canRun"`
		CanDownload bool `json:"canDownload"`
	} `json:"gates"`
	Actions struct {
		CanCreateWorkspace         bool `json:"canCreateWorkspace"`
		CanUploadFile              bool `json:"canUploadFile"`
		CanStartPaidRun            bool `json:"canStartPaidRun"`
		CanDownloadExistingOutputs bool `json:"canDownloadExistingOutputs"`
	} `json:"actions"`
	Message string `json:"message,omitempty"`
}

var catalog = []PackagePlan{
	{
		ID:                  "starter_2c4g_10gb",
		Name:                "入门套餐",
		Audience:            "regular",
		Currency:            "CNY",
		ComputeTier:         "starter",
		Headline:            "适合小型文件分析和轻量任务",
		Compute:             ComputeSpec{Tier: "starter", Label: "标准计算能力", Cores: 2, MemoryGB: 4, MaxConcurrentRuns: 1},
		Storage:             StorageSpec{IncludedGB: 10, WarningRatio: 0.8},
		Billing:             BillingSpec{BasePrice: nil, PendingProductApproval: true, PriceLabel: "正式售价未定价", FreezeDays: 7},
		BackingServerPlanID: "starter_2c4g_10gb",
		ComputePower:        "2 核计算能力",
		StorageCapacityGB:   10,
		GracePeriodDays:     7,
		PlanSummary:         "2C / 4GB 内存 / 10GB",
		MemoryGB:            4,
	},
	{
		ID:                  "pro_8c16g_100gb",
		Name:                "进阶套餐",
		Audience:            "regular",
		Currency:            "CNY",
		ComputeTier:         "pro",
		Headline:            "适合更大的文件分析和多任务处理",
		Compute:             ComputeSpec{Tier: "pro", Label: "更快计算能力", Cores: 8, MemoryGB: 16, MaxConcurrentRuns: 2},
		Storage:             StorageSpec{IncludedGB: 100, WarningRatio: 0.8},
		Billing:             BillingSpec{BasePrice: nil, PendingProductApproval: true, PriceLabel: "正式售价未定价", FreezeDays: 7},
		BackingServerPlanID: "pro_8c16g_100gb",
		ComputePower:        "8 核计算能力",
		StorageCapacityGB:   100,
		GracePeriodDays:     7,
		PlanSummary:         "8C / 16GB 内存 / 100GB",
		MemoryGB:            16,
	},
}

var packageAliases = map[string]string{
	"starter":              "starter_2c4g_10gb",
	"starter-2c":           "starter_2c4g_10gb",
	"starter-2c4g-10gb":   "starter_2c4g_10gb",
	"starter_2c4gb_10gb":  "starter_2c4g_10gb",
	"starter_2c4g_10gb":   "starter_2c4g_10gb",
	"pro":                  "pro_8c16g_100gb",
	"pro-8c":               "pro_8c16g_100gb",
	"pro-8c16g-100gb":      "pro_8c16g_100gb",
	"pro_8c16gb_100gb":     "pro_8c16g_100gb",
	"pro_8c16g_100gb":      "pro_8c16g_100gb",
	"default-8c16gb-100gb": "pro_8c16g_100gb",
}

func Catalog() []PackagePlan {
	items := make([]PackagePlan, len(catalog))
	copy(items, catalog)
	return items
}

func PackageByID(packageID string) (PackagePlan, bool) {
	canonicalID := canonicalPackageID(packageID)
	for _, item := range catalog {
		if item.ID == canonicalID {
			return item, true
		}
	}
	return PackagePlan{}, false
}

func ValidateWorkspaceID(workspaceID string) error {
	if strings.TrimSpace(workspaceID) == "" {
		return ErrWorkspaceRequired
	}
	return nil
}

func ValidatePackageID(packageID string) error {
	if strings.TrimSpace(packageID) == "" {
		return ErrPackageRequired
	}
	if _, ok := PackageByID(packageID); !ok {
		return ErrPackageNotFound
	}
	return nil
}

func BuildEntitlement(workspaceID string, subscription Subscription) Entitlement {
	if strings.TrimSpace(subscription.WorkspaceID) == "" || subscription.Status == SubscriptionStatusCancelled {
		entitlement := Entitlement{Enabled: false, Status: "disabled", WorkspaceID: workspaceID, Message: "尚未开通实验室套餐。"}
		entitlement.Gates.CanDownload = true
		entitlement.Actions.CanDownloadExistingOutputs = true
		return entitlement
	}
	plan, ok := PackageByID(subscription.PackageID)
	if !ok {
		entitlement := Entitlement{Enabled: false, Status: "disabled", WorkspaceID: workspaceID, Message: "套餐不存在。"}
		entitlement.Gates.CanDownload = true
		entitlement.Actions.CanDownloadExistingOutputs = true
		return entitlement
	}
	entitlement := Entitlement{
		Enabled:     true,
		Status:      string(subscription.Status),
		WorkspaceID: subscription.WorkspaceID,
		PackageID:   plan.ID,
		PackageName: plan.Name,
		Compute:     plan.Compute,
		Message:     "实验室套餐权益已就绪。",
	}
	entitlement.Storage.IncludedGB = plan.Storage.IncludedGB
	entitlement.Storage.TotalGB = plan.Storage.IncludedGB
	entitlement.Storage.AvailableGB = plan.Storage.IncludedGB
	entitlement.Storage.RetentionDays = 7
	entitlement.Storage.WarningRatio = plan.Storage.WarningRatio
	canWrite := subscription.Status == SubscriptionStatusActive
	entitlement.Gates.CanUpload = canWrite
	entitlement.Gates.CanRun = canWrite
	entitlement.Gates.CanDownload = true
	entitlement.Actions.CanCreateWorkspace = canWrite
	entitlement.Actions.CanUploadFile = canWrite
	entitlement.Actions.CanStartPaidRun = canWrite
	entitlement.Actions.CanDownloadExistingOutputs = true
	return entitlement
}

func CanonicalPackageID(packageID string) (string, bool) {
	id := canonicalPackageID(packageID)
	_, ok := PackageByID(id)
	return id, ok
}

func canonicalPackageID(packageID string) string {
	id := strings.TrimSpace(packageID)
	if canonical, ok := packageAliases[id]; ok {
		return canonical
	}
	return id
}
