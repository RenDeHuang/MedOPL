package controlplane

import (
	"errors"
	"time"
)

const (
	ResourceBindingStatusRequested        = "requested"
	ResourceBindingStatusCreating         = "creating"
	ResourceBindingStatusCreated          = "created"
	ResourceBindingStatusScaling          = "scaling"
	ResourceBindingStatusReady            = "ready"
	ResourceBindingStatusReleaseRequested = "releaseRequested"
	ResourceBindingStatusDeleting         = "deleting"
	ResourceBindingStatusReleased         = "released"
	ResourceBindingStatusFailed           = "failed"
	ResourceBindingStatusCleanupRequired  = "cleanupRequired"

	CloudOperationTypeCreateReleaseCanary = "package_c_create_release_canary"

	CanonicalOwnershipSourcePostgres = "postgres_resource_binding_ledger"
	CloudTagSupportTKENodePool       = "tke_nodepool_unsupported"
)

var (
	ErrAccountRequired            = errors.New("account_required")
	ErrBillingAttributionRequired = errors.New("billing_attribution_required")
	ErrServerPlanRequired         = errors.New("server_plan_required")
	ErrWorkspaceStorageRequired   = errors.New("workspace_storage_required")
	ErrCloudProviderRequired      = errors.New("cloud_provider_required")
	ErrRegionRequired             = errors.New("region_required")
	ErrClusterRequired            = errors.New("cluster_required")
	ErrNodePoolRequired           = errors.New("node_pool_required")
	ErrOperationRequired          = errors.New("operation_required")
	ErrStatusRequired             = errors.New("status_required")
)

type ResourceBindingLedgerInput struct {
	TenantID             string
	AccountID            string
	WorkspaceID          string
	ResourceBindingID    string
	BillingAttributionID string
	ServerPlanID         string
	WorkspaceStorageGB   int
	CloudProvider        string
	Region               string
	ClusterID            string
	NodePoolID           string
	NodePoolName         string
	Status               string
	CreatedAt            time.Time
	ReleasedAt           time.Time
	OperationID          string
}

type ResourceBindingLedger struct {
	TenantID                 string `json:"tenantId"`
	AccountID                string `json:"accountId"`
	WorkspaceID              string `json:"workspaceId"`
	ResourceBindingID        string `json:"resourceBindingId"`
	BillingAttributionID     string `json:"billingAttributionId"`
	ServerPlanID             string `json:"serverPlanId"`
	WorkspaceStorageGB       int    `json:"workspaceStorageGb"`
	CloudProvider            string `json:"cloudProvider"`
	Region                   string `json:"region"`
	ClusterID                string `json:"clusterId"`
	NodePoolID               string `json:"nodePoolId"`
	NodePoolName             string `json:"nodePoolName"`
	Status                   string `json:"status"`
	CreatedAt                string `json:"createdAt"`
	ReleasedAt               string `json:"releasedAt,omitempty"`
	OperationID              string `json:"operationId"`
	CanonicalOwnershipSource string `json:"canonicalOwnershipSource"`
	CloudTagSupport          string `json:"cloudTagSupport"`
}

type CloudOperationInput struct {
	OperationID          string
	ResourceBindingID    string
	TenantID             string
	AccountID            string
	WorkspaceID          string
	BillingAttributionID string
	OperationType        string
	ServerPlanID         string
	WorkspaceStorageGB   int
	Status               string
	CloudProvider        string
	Region               string
	ClusterID            string
	NodePoolID           string
	NodePoolName         string
	CloudTagSupport      string
	CreatedAt            time.Time
	CompletedAt          time.Time
}

type CloudOperation struct {
	OperationID              string `json:"operationId"`
	ResourceBindingID        string `json:"resourceBindingId"`
	TenantID                 string `json:"tenantId"`
	AccountID                string `json:"accountId"`
	WorkspaceID              string `json:"workspaceId"`
	BillingAttributionID     string `json:"billingAttributionId"`
	OperationType            string `json:"operationType"`
	ServerPlanID             string `json:"serverPlanId"`
	WorkspaceStorageGB       int    `json:"workspaceStorageGb"`
	Status                   string `json:"status"`
	CloudProvider            string `json:"cloudProvider"`
	Region                   string `json:"region"`
	ClusterID                string `json:"clusterId"`
	NodePoolID               string `json:"nodePoolId"`
	NodePoolName             string `json:"nodePoolName"`
	CloudTagSupport          string `json:"cloudTagSupport"`
	CanonicalOwnershipSource string `json:"canonicalOwnershipSource"`
	CreatedAt                string `json:"createdAt"`
	CompletedAt              string `json:"completedAt,omitempty"`
}

func NewResourceBindingLedger(input ResourceBindingLedgerInput) (ResourceBindingLedger, error) {
	if err := validateLedgerIdentity(input.TenantID, input.AccountID, input.WorkspaceID, input.ResourceBindingID, input.BillingAttributionID); err != nil {
		return ResourceBindingLedger{}, err
	}
	if clean(input.ServerPlanID) == "" {
		return ResourceBindingLedger{}, ErrServerPlanRequired
	}
	if input.WorkspaceStorageGB <= 0 {
		return ResourceBindingLedger{}, ErrWorkspaceStorageRequired
	}
	if err := validateCloudTarget(input.CloudProvider, input.Region, input.ClusterID, input.NodePoolID, input.NodePoolName); err != nil {
		return ResourceBindingLedger{}, err
	}
	if !IsResourceBindingStatus(input.Status) {
		return ResourceBindingLedger{}, ErrStatusRequired
	}
	if clean(input.OperationID) == "" {
		return ResourceBindingLedger{}, ErrOperationRequired
	}
	return ResourceBindingLedger{
		TenantID:                 clean(input.TenantID),
		AccountID:                clean(input.AccountID),
		WorkspaceID:              clean(input.WorkspaceID),
		ResourceBindingID:        clean(input.ResourceBindingID),
		BillingAttributionID:     clean(input.BillingAttributionID),
		ServerPlanID:             clean(input.ServerPlanID),
		WorkspaceStorageGB:       input.WorkspaceStorageGB,
		CloudProvider:            clean(input.CloudProvider),
		Region:                   clean(input.Region),
		ClusterID:                clean(input.ClusterID),
		NodePoolID:               clean(input.NodePoolID),
		NodePoolName:             clean(input.NodePoolName),
		Status:                   clean(input.Status),
		CreatedAt:                optionalTime(input.CreatedAt.UTC()),
		ReleasedAt:               optionalTime(input.ReleasedAt.UTC()),
		OperationID:              clean(input.OperationID),
		CanonicalOwnershipSource: CanonicalOwnershipSourcePostgres,
		CloudTagSupport:          CloudTagSupportTKENodePool,
	}, nil
}

func NewCloudOperation(input CloudOperationInput) (CloudOperation, error) {
	if clean(input.OperationID) == "" {
		return CloudOperation{}, ErrOperationRequired
	}
	if err := validateLedgerIdentity(input.TenantID, input.AccountID, input.WorkspaceID, input.ResourceBindingID, input.BillingAttributionID); err != nil {
		return CloudOperation{}, err
	}
	if clean(input.OperationType) == "" {
		return CloudOperation{}, ErrOperationRequired
	}
	if clean(input.ServerPlanID) == "" {
		return CloudOperation{}, ErrServerPlanRequired
	}
	if input.WorkspaceStorageGB <= 0 {
		return CloudOperation{}, ErrWorkspaceStorageRequired
	}
	if !IsResourceBindingStatus(input.Status) {
		return CloudOperation{}, ErrStatusRequired
	}
	if err := validateCloudTarget(input.CloudProvider, input.Region, input.ClusterID, input.NodePoolID, input.NodePoolName); err != nil {
		return CloudOperation{}, err
	}
	cloudTagSupport := clean(input.CloudTagSupport)
	if cloudTagSupport == "" {
		cloudTagSupport = CloudTagSupportTKENodePool
	}
	return CloudOperation{
		OperationID:              clean(input.OperationID),
		ResourceBindingID:        clean(input.ResourceBindingID),
		TenantID:                 clean(input.TenantID),
		AccountID:                clean(input.AccountID),
		WorkspaceID:              clean(input.WorkspaceID),
		BillingAttributionID:     clean(input.BillingAttributionID),
		OperationType:            clean(input.OperationType),
		ServerPlanID:             clean(input.ServerPlanID),
		WorkspaceStorageGB:       input.WorkspaceStorageGB,
		Status:                   clean(input.Status),
		CloudProvider:            clean(input.CloudProvider),
		Region:                   clean(input.Region),
		ClusterID:                clean(input.ClusterID),
		NodePoolID:               clean(input.NodePoolID),
		NodePoolName:             clean(input.NodePoolName),
		CloudTagSupport:          cloudTagSupport,
		CanonicalOwnershipSource: CanonicalOwnershipSourcePostgres,
		CreatedAt:                optionalTime(input.CreatedAt.UTC()),
		CompletedAt:              optionalTime(input.CompletedAt.UTC()),
	}, nil
}

func IsResourceBindingStatus(status string) bool {
	switch clean(status) {
	case ResourceBindingStatusRequested,
		ResourceBindingStatusCreating,
		ResourceBindingStatusCreated,
		ResourceBindingStatusScaling,
		ResourceBindingStatusReady,
		ResourceBindingStatusReleaseRequested,
		ResourceBindingStatusDeleting,
		ResourceBindingStatusReleased,
		ResourceBindingStatusFailed,
		ResourceBindingStatusCleanupRequired:
		return true
	default:
		return false
	}
}

func validateLedgerIdentity(tenantID string, accountID string, workspaceID string, resourceBindingID string, billingAttributionID string) error {
	if clean(tenantID) == "" {
		return ErrTenantRequired
	}
	if clean(accountID) == "" {
		return ErrAccountRequired
	}
	if clean(workspaceID) == "" {
		return ErrWorkspaceRequired
	}
	if clean(resourceBindingID) == "" {
		return ErrResourceBindingRequired
	}
	if clean(billingAttributionID) == "" {
		return ErrBillingAttributionRequired
	}
	return nil
}

func validateCloudTarget(cloudProvider string, region string, clusterID string, nodePoolID string, nodePoolName string) error {
	if clean(cloudProvider) == "" {
		return ErrCloudProviderRequired
	}
	if clean(region) == "" {
		return ErrRegionRequired
	}
	if clean(clusterID) == "" {
		return ErrClusterRequired
	}
	if clean(nodePoolName) == "" {
		return ErrNodePoolRequired
	}
	return nil
}
