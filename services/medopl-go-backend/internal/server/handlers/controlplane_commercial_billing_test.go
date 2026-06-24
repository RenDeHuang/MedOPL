package handlers

import "testing"

func TestControlPlaneHandlersExposeCommercialBillingAPIs(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "commercial-handler-provider-key-material-that-must-stay-private"

	prepare := postMap(t, router, "/api/v22/users/prepare", map[string]any{
		"tenantId":    "tenant-v22",
		"userId":      "user-v22",
		"workspaceId": "workspace-v22",
	})
	if prepare["status"] != "prepared" || prepare["workspaceId"] != "workspace-v22" {
		t.Fatalf("prepare = %+v", prepare)
	}
	order := postMap(t, router, "/api/v22/billing/payment-orders", map[string]any{
		"tenantId":       "tenant-v22",
		"userId":         "user-v22",
		"workspaceId":    "workspace-v22",
		"amount":         200,
		"currency":       "CNY",
		"idempotencyKey": "payment-order-handler-once",
		"providerRef":    "provider-order-handler",
	})
	if order["status"] != "created" || order["orderId"] == "" {
		t.Fatalf("order = %+v", order)
	}
	paid := postMap(t, router, "/api/v22/billing/payment-paid", map[string]any{
		"tenantId":       "tenant-v22",
		"userId":         "user-v22",
		"workspaceId":    "workspace-v22",
		"orderId":        order["orderId"],
		"amount":         200,
		"currency":       "CNY",
		"idempotencyKey": "payment-paid-handler-once",
	})
	if paid["balance"] != float64(200) {
		t.Fatalf("paid = %+v", paid)
	}

	_ = postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "commercial-handler-provider-once",
	})
	open := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "commercial-handler-open-once",
	})
	if open["launchStatus"] != "ready" {
		t.Fatalf("open = %+v", open)
	}
	freeze := getMap(t, router, "/api/v22/runtime/freeze?workspaceId=workspace-v22")
	if freeze["status"] != "active" || freeze["amount"] != float64(30) || freeze["freezeDays"] != float64(7) {
		t.Fatalf("freeze = %+v", freeze)
	}

	refund := postMap(t, router, "/api/v22/billing/refund", map[string]any{
		"tenantId":       "tenant-v22",
		"userId":         "user-v22",
		"workspaceId":    "workspace-v22",
		"amount":         10,
		"currency":       "CNY",
		"idempotencyKey": "refund-handler-once",
		"reason":         "customer_refund",
	})
	if refund["balance"] != float64(190) {
		t.Fatalf("refund = %+v", refund)
	}
	adjustment := postMap(t, router, "/api/v22/billing/adjustment", map[string]any{
		"tenantId":       "tenant-v22",
		"userId":         "user-v22",
		"workspaceId":    "workspace-v22",
		"amount":         5,
		"currency":       "CNY",
		"idempotencyKey": "adjustment-handler-once",
		"reason":         "admin_adjustment",
	})
	if adjustment["balance"] != float64(195) {
		t.Fatalf("adjustment = %+v", adjustment)
	}
	statement := getMap(t, router, "/api/v22/billing/statement?workspaceId=workspace-v22")
	wallet := statement["wallet"].(map[string]any)
	if wallet["balance"] != float64(195) || wallet["activeFreeze"] != float64(30) || wallet["availableBalance"] != float64(165) {
		t.Fatalf("statement wallet = %+v statement=%+v", wallet, statement)
	}
	receipts := statement["receipts"].(map[string]any)
	if receipts["runtimeHold"] != true || receipts["billingAuditLinked"] != true {
		t.Fatalf("statement receipts = %+v", receipts)
	}
}
