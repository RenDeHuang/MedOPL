package controlplane

import (
	"encoding/json"
	"strings"
	"testing"
)

const rawProviderKey = "local-rc-provider-key-material-that-must-stay-private"

func TestBindProviderKeyReturnsOnlyProviderKeyRef(t *testing.T) {
	binding, err := NewProviderBinding(BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: rawProviderKey,
		IdempotencyKey: "bind-provider-key-once",
	})
	if err != nil {
		t.Fatalf("NewProviderBinding() error = %v", err)
	}

	if binding.ProviderKeyRef == "" {
		t.Fatal("ProviderKeyRef must be public and stable")
	}
	if strings.Contains(binding.ProviderKeyRef, rawProviderKey) {
		t.Fatal("providerKeyRef must not contain raw provider key")
	}
	assertPublicJSONDoesNotLeak(t, binding)
}

func TestPreflightFailsClosedUntilProviderKeyBound(t *testing.T) {
	result := Preflight(PreflightInput{WorkspaceID: "workspace-v22"})

	if result.Ok {
		t.Fatalf("preflight without binding should fail closed: %+v", result)
	}
	if result.Error != "provider_key_required" || result.LaunchStatus != "blocked_by_provider_key" {
		t.Fatalf("unexpected preflight result: %+v", result)
	}
}

func TestPreflightAllowsManagedEnvironmentWhenProviderKeyBound(t *testing.T) {
	binding, err := NewProviderBinding(BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: rawProviderKey,
		IdempotencyKey: "bind-provider-key-once",
	})
	if err != nil {
		t.Fatalf("NewProviderBinding() error = %v", err)
	}

	result := Preflight(PreflightInput{WorkspaceID: "workspace-v22", Binding: binding})

	if !result.Ok || !result.ProviderBound || !result.ReadyForManagedEnvironment {
		t.Fatalf("unexpected preflight result: %+v", result)
	}
	if result.ProviderKeyRef != binding.ProviderKeyRef || result.LaunchStatus != "ready_for_launch" {
		t.Fatalf("unexpected public projection: %+v", result)
	}
	assertPublicJSONDoesNotLeak(t, result)
}

func TestLaunchProjectionUsesGatewayBoundaryWithoutSecretFields(t *testing.T) {
	binding, err := NewProviderBinding(BindProviderKeyInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		RawProviderKey: rawProviderKey,
		IdempotencyKey: "bind-provider-key-once",
	})
	if err != nil {
		t.Fatalf("NewProviderBinding() error = %v", err)
	}

	launch, err := NewLaunch(LaunchInput{
		TenantID:       "tenant-v22",
		PortalUserID:   "user-v22",
		WorkspaceID:    "workspace-v22",
		Binding:        binding,
		IdempotencyKey: "launch-once",
	})
	if err != nil {
		t.Fatalf("NewLaunch() error = %v", err)
	}

	if launch.LaunchID == "" || launch.RuntimeSessionID == "" || launch.OPLSessionID == "" {
		t.Fatalf("launch projection missing ids: %+v", launch)
	}
	if launch.ProviderKeyRef != binding.ProviderKeyRef {
		t.Fatalf("providerKeyRef = %q", launch.ProviderKeyRef)
	}
	if launch.LaunchStatus != LaunchStatusReady || !launch.GatewayReady {
		t.Fatalf("launch status = %+v", launch)
	}
	assertPublicJSONDoesNotLeak(t, launch)
}

func TestReleaseStopsBillingAndKeepsHistoryAuditable(t *testing.T) {
	resource := NewManagedResource(ResourceInput{
		TenantID:          "tenant-v22",
		PortalUserID:      "user-v22",
		WorkspaceID:       "workspace-v22",
		ResourceBindingID: "binding-v22",
	})

	released, auditEvent, err := ReleaseManagedResource(resource, ReleaseInput{
		StopBilling:    true,
		IdempotencyKey: "release-once",
	})
	if err != nil {
		t.Fatalf("ReleaseManagedResource() error = %v", err)
	}

	if released.Status != ResourceStatusReleased || released.StopBilling.Status != BillingStatusStopped {
		t.Fatalf("release projection = %+v", released)
	}
	if auditEvent.Kind != AuditKindResourceRelease || auditEvent.Status != "recorded" {
		t.Fatalf("audit event = %+v", auditEvent)
	}
	assertPublicJSONDoesNotLeak(t, released)
	assertPublicJSONDoesNotLeak(t, auditEvent)
}

func assertPublicJSONDoesNotLeak(t *testing.T, value any) {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal public value: %v", err)
	}
	text := string(encoded)
	for _, marker := range []string{
		rawProviderKey,
		"rawProviderKey",
		"apiKey",
		"providerApiKey",
		"launchToken",
		"runtimeToken",
		"bearerToken",
		"SecretId",
		"SecretKey",
		"localPath",
		"signedUrl",
		"objectKey",
	} {
		if strings.Contains(text, marker) {
			t.Fatalf("public JSON leaked %q: %s", marker, text)
		}
	}
}
