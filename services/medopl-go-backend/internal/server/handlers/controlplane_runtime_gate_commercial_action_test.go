package handlers

import "testing"

func TestControlPlaneHandlersExposeOPLWebuiCommercialActionContract(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "runtime-gate-commercial-action-provider-key-material-that-must-stay-private"

	missingProviderRuntimeRequired := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-needs-purchase",
		"invocationMode": "runtime_required",
		"taskIntent":     "paper",
		"sessionId":      "session-needs-purchase",
		"taskRef":        "task-needs-purchase",
	})
	missingProviderActionContract := missingProviderRuntimeRequired["actionContract"].(map[string]any)
	missingProviderAction := missingProviderActionContract["primaryAction"].(map[string]any)
	if missingProviderAction["action"] != "open_medopl_purchase" || missingProviderAction["reason"] != "provider_key_required" {
		t.Fatalf("missing provider commercial action = %+v", missingProviderAction)
	}
	if missingProviderAction["workspaceId"] != "workspace-needs-purchase" || missingProviderAction["sessionId"] != "session-needs-purchase" || missingProviderAction["taskRef"] != "task-needs-purchase" || missingProviderAction["taskIntent"] != "paper" {
		t.Fatalf("missing provider action context = %+v", missingProviderAction)
	}
	if missingProviderAction["medoplDeeplink"] == "" || missingProviderAction["returnToOplDeeplink"] == "" {
		t.Fatalf("missing provider action deeplinks = %+v", missingProviderAction)
	}
	missingProviderReturnContract := missingProviderAction["returnToOplTaskContract"].(map[string]any)
	if missingProviderReturnContract["resumeAction"] != "return_to_opl_task" || missingProviderReturnContract["resumeMethod"] != "GET" || missingProviderReturnContract["workspaceId"] != "workspace-needs-purchase" {
		t.Fatalf("missing provider return-to-OPL contract = %+v", missingProviderReturnContract)
	}
	if missingProviderReturnContract["returnToOplDeeplink"] != missingProviderAction["returnToOplDeeplink"] {
		t.Fatalf("return-to-OPL contract must share action deeplink: action=%+v contract=%+v", missingProviderAction, missingProviderReturnContract)
	}
	availableActions := missingProviderActionContract["availableActions"].([]any)
	seenActions := map[string]bool{}
	for _, item := range availableActions {
		action := item.(map[string]any)
		for _, field := range []string{"action", "reason", "workspaceId", "taskIntent", "planRequirement", "balanceRequirement", "medoplDeeplink", "returnToOplDeeplink", "returnToOplTaskContract", "canClaim", "cannotClaim"} {
			if _, ok := action[field]; !ok {
				t.Fatalf("available action missing stable field %s: %+v", field, action)
			}
		}
		seenActions[action["action"].(string)] = true
	}
	for _, requiredAction := range []string{"open_medopl_purchase", "select_plan", "recharge_or_credit_required", "open_runtime_storage", "return_to_opl_task"} {
		if !seenActions[requiredAction] {
			t.Fatalf("runtime gate commercial action missing %s in %+v", requiredAction, availableActions)
		}
	}

	postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-needs-credit",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "runtime-gate-provider-credit",
	})
	needsCredit := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-needs-credit",
		"invocationMode": "runtime_required",
		"taskIntent":     "grant",
		"taskRef":        "task-needs-credit",
	})
	needsCreditAction := needsCredit["actionContract"].(map[string]any)["primaryAction"].(map[string]any)
	if needsCreditAction["action"] != "recharge_or_credit_required" || needsCreditAction["reason"] != "account_required" {
		t.Fatalf("needs credit commercial action = %+v", needsCreditAction)
	}
	balanceRequirement := needsCreditAction["balanceRequirement"].(map[string]any)
	if balanceRequirement["minRequiredBalance"] == nil || balanceRequirement["currency"] != "CNY" {
		t.Fatalf("needs credit balance requirement = %+v", balanceRequirement)
	}

	prepareCreditUser(t, router, "workspace-open-resource", 200)
	postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-open-resource",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "runtime-gate-provider-open-resource",
	})
	openResourceGate := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-open-resource",
		"invocationMode": "runtime_required",
		"taskIntent":     "ppt",
		"taskRef":        "task-open-resource",
	})
	openResourceAction := openResourceGate["actionContract"].(map[string]any)["primaryAction"].(map[string]any)
	if openResourceAction["action"] != "open_runtime_storage" || openResourceAction["reason"] != "runtime_storage_not_opened" {
		t.Fatalf("open resource commercial action = %+v", openResourceAction)
	}
	purchaseProjection := openResourceGate["actionContract"].(map[string]any)["purchaseProjection"].(map[string]any)
	if purchaseProjection["workspaceId"] != "workspace-open-resource" || purchaseProjection["selectedPlanId"] != "starter_2c4g_10gb" {
		t.Fatalf("purchase projection context = %+v", purchaseProjection)
	}
	if purchaseProjection["canOpenRuntimeStorage"] != true || purchaseProjection["availableBalance"] != float64(200) {
		t.Fatalf("purchase projection wallet = %+v", purchaseProjection)
	}
	returnContract := purchaseProjection["returnToOplTaskContract"].(map[string]any)
	if returnContract["sessionId"] != "" || returnContract["taskRef"] != "task-open-resource" || returnContract["taskIntent"] != "ppt" {
		t.Fatalf("purchase projection return-to-OPL contract context = %+v", returnContract)
	}
	if returnContract["returnToOplDeeplink"] != purchaseProjection["returnToOplAction"].(map[string]any)["href"] {
		t.Fatalf("purchase projection return-to-OPL deeplink mismatch: projection=%+v contract=%+v", purchaseProjection, returnContract)
	}
	for _, field := range []string{"selectPlanAction", "rechargeOrCreditAction", "openRuntimeStorageAction", "returnToOplAction"} {
		action, ok := purchaseProjection[field].(map[string]any)
		if !ok || action["href"] == "" || action["method"] == "" {
			t.Fatalf("purchase projection action %s = %+v", field, purchaseProjection[field])
		}
	}
}

func TestControlPlaneHandlersExposeOPLWebuiRuntimeGate(t *testing.T) {
	router := controlPlaneHandlerTestRouter()
	rawProviderKey := "runtime-gate-provider-key-material-that-must-stay-private"

	ordinaryChat := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-v22",
		"invocationMode": "ordinary_chat",
		"runtimePlanId":  "starter_2c4g_10gb",
		"storagePlanId":  "workspace_10gb",
	})
	assertPublicPayload(t, ordinaryChat, rawProviderKey)
	if ordinaryChat["productOwner"] != "medopl" || ordinaryChat["primaryConsumer"] != "opl-webui" {
		t.Fatalf("ordinary runtime gate owner boundary = %+v", ordinaryChat)
	}
	if ordinaryChat["medoplRuntimeRequired"] != false || ordinaryChat["nextAction"] != "continue_in_opl_webui" {
		t.Fatalf("ordinary runtime gate = %+v", ordinaryChat)
	}
	ordinaryConsumer := ordinaryChat["consumerProjection"].(map[string]any)
	if ordinaryConsumer["chatSurface"] != "opl-webui" || ordinaryConsumer["runSurface"] != "none" {
		t.Fatalf("ordinary runtime consumer projection = %+v", ordinaryConsumer)
	}
	if ordinaryConsumer["uploadEnabled"] != false || ordinaryConsumer["runEnabled"] != false || ordinaryConsumer["artifactEnabled"] != false {
		t.Fatalf("ordinary runtime consumer actions = %+v", ordinaryConsumer)
	}

	prepareCreditUser(t, router, "workspace-v22", 200)
	bindResponse := postMap(t, router, "/api/v22/provider-key", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"apiKey":         rawProviderKey,
		"idempotencyKey": "runtime-gate-provider-once",
	})
	openResponse := postMap(t, router, "/api/v22/managed-environment/open", map[string]any{
		"tenantId":       "tenant-v22",
		"portalUserId":   "user-v22",
		"workspaceId":    "workspace-v22",
		"idempotencyKey": "runtime-gate-open-once",
	})

	runtimeRequired := postMap(t, router, "/api/opl/runtime-gate", map[string]any{
		"workspaceId":    "workspace-v22",
		"invocationMode": "runtime_required",
		"runtimePlanId":  "starter_2c4g_10gb",
		"storagePlanId":  "workspace_10gb",
		"taskIntent":     "book",
		"sessionId":      "session-v22",
		"taskRef":        "task-v22",
	})
	assertPublicPayload(t, runtimeRequired, rawProviderKey)
	if runtimeRequired["medoplRuntimeRequired"] != true || runtimeRequired["runtimeBindingId"] != openResponse["resourceBindingId"] {
		t.Fatalf("runtime required gate = %+v", runtimeRequired)
	}
	if runtimeRequired["providerKeyRef"] != bindResponse["providerKeyRef"] || runtimeRequired["storageBindingId"] == "" {
		t.Fatalf("runtime required provider/storage = %+v", runtimeRequired)
	}
	nodePool := runtimeRequired["nodePoolProjection"].(map[string]any)
	if nodePool["nodePoolRef"] == "" || nodePool["state"] != "ready" || nodePool["customerVisible"] != false {
		t.Fatalf("runtime required node pool projection = %+v", nodePool)
	}
	release := runtimeRequired["release"].(map[string]any)
	if release["canReleaseRuntime"] != true || release["destroyStorage"] != "requires_explicit_user_intent" {
		t.Fatalf("runtime required release projection = %+v", release)
	}
	consumerProjection := runtimeRequired["consumerProjection"].(map[string]any)
	if consumerProjection["chatSurface"] != "opl-webui" || consumerProjection["runSurface"] != "opl-webui_with_medopl_runtime" {
		t.Fatalf("runtime required consumer surface = %+v", consumerProjection)
	}
	if consumerProjection["uploadEnabled"] != true || consumerProjection["runEnabled"] != true || consumerProjection["artifactEnabled"] != true {
		t.Fatalf("runtime required consumer actions = %+v", consumerProjection)
	}
	if consumerProjection["releaseAction"] != "release_runtime_stop_billing" || consumerProjection["storageAction"] != "retain_storage_until_explicit_destroy" {
		t.Fatalf("runtime required consumer release/storage = %+v", consumerProjection)
	}
	actionContract := runtimeRequired["actionContract"].(map[string]any)
	primaryAction := actionContract["primaryAction"].(map[string]any)
	if primaryAction["action"] != "return_to_opl_task" || primaryAction["reason"] != "runtime_storage_ready" {
		t.Fatalf("runtime required primary commercial action = %+v", primaryAction)
	}
	if primaryAction["workspaceId"] != "workspace-v22" || primaryAction["sessionId"] != "session-v22" || primaryAction["taskRef"] != "task-v22" || primaryAction["taskIntent"] != "book" {
		t.Fatalf("runtime required primary commercial action context = %+v", primaryAction)
	}
	if primaryAction["medoplDeeplink"] == "" || primaryAction["returnToOplDeeplink"] == "" {
		t.Fatalf("runtime required commercial action deeplinks = %+v", primaryAction)
	}
	returnContract := primaryAction["returnToOplTaskContract"].(map[string]any)
	if returnContract["resumeAction"] != "return_to_opl_task" || returnContract["workspaceId"] != "workspace-v22" || returnContract["sessionId"] != "session-v22" || returnContract["taskRef"] != "task-v22" || returnContract["taskIntent"] != "book" {
		t.Fatalf("runtime required return-to-OPL contract = %+v", returnContract)
	}
	if returnContract["returnToOplDeeplink"] != primaryAction["returnToOplDeeplink"] {
		t.Fatalf("runtime required return-to-OPL deeplink mismatch: action=%+v contract=%+v", primaryAction, returnContract)
	}
}
