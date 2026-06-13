package lab

import "testing"

func TestCatalogDefinesStarterAndProWithoutProductionPriceClaim(t *testing.T) {
	items := Catalog()
	if len(items) != 2 {
		t.Fatalf("catalog length = %d", len(items))
	}
	starter, ok := PackageByID("starter")
	if !ok || starter.ID != "starter_2c4g_10gb" || starter.Compute.Cores != 2 || starter.Storage.IncludedGB != 10 {
		t.Fatalf("starter package = %+v ok=%v", starter, ok)
	}
	pro, ok := PackageByID("pro")
	if !ok || pro.ID != "pro_8c16g_100gb" || pro.Compute.Cores != 8 || pro.Compute.MaxConcurrentRuns != 2 || pro.Storage.IncludedGB != 100 {
		t.Fatalf("pro package = %+v ok=%v", pro, ok)
	}
	for _, item := range items {
		if item.Billing.BasePrice != nil || !item.Billing.PendingProductApproval {
			t.Fatalf("package must not claim production price: %+v", item)
		}
	}
}

func TestBuildEntitlementFailsClosedWithoutSubscription(t *testing.T) {
	entitlement := BuildEntitlement("", Subscription{})
	if entitlement.Enabled || entitlement.Status != "disabled" || entitlement.Gates.CanRun {
		t.Fatalf("entitlement = %+v", entitlement)
	}
}

func TestBuildEntitlementProjectsActiveSubscription(t *testing.T) {
	subscription := Subscription{
		ID:             "sub-v22",
		WorkspaceID:    "workspace-v22",
		PackageID:      "starter_2c4g_10gb",
		Status:         SubscriptionStatusActive,
		IdempotencyKey: "idem-v22",
	}
	entitlement := BuildEntitlement("workspace-v22", subscription)
	if !entitlement.Enabled || entitlement.Status != string(SubscriptionStatusActive) || entitlement.PackageID != "starter_2c4g_10gb" {
		t.Fatalf("entitlement = %+v", entitlement)
	}
	if !entitlement.Gates.CanUpload || !entitlement.Gates.CanRun || !entitlement.Actions.CanStartPaidRun {
		t.Fatalf("entitlement gates = %+v actions = %+v", entitlement.Gates, entitlement.Actions)
	}
	if entitlement.Storage.TotalGB != 10 || entitlement.Compute.MaxConcurrentRuns != 1 {
		t.Fatalf("entitlement resource projection = %+v", entitlement)
	}
}

func TestValidationRequiresWorkspaceAndPackage(t *testing.T) {
	if err := ValidateWorkspaceID(""); err != ErrWorkspaceRequired {
		t.Fatalf("workspace err = %v", err)
	}
	if err := ValidatePackageID(""); err != ErrPackageRequired {
		t.Fatalf("package err = %v", err)
	}
	if _, ok := PackageByID("does-not-exist"); ok {
		t.Fatalf("unexpected package")
	}
}
