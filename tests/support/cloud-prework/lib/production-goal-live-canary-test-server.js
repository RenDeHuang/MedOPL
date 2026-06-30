import { spawn } from "node:child_process";

export async function startProductionGoalLiveCanaryServer(mode = "full") {
  const child = spawn(process.execPath, ["-e", `
const { createServer } = require("node:http");
const mode = process.argv[1];
const state = { preparedWorkspaceId: "", approvedWorkspaceId: "", sequence: [] };
async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const sendJson = (status, payload) => {
    response.writeHead(status, { "content-type": "application/json", connection: "close" });
    response.end(JSON.stringify(payload));
  };
  const requireIdentityScopeHeaders = (body) => {
    const expected = {
      "x-medopl-tenant-id": body.tenantId || body.tenant_id || "",
      "x-medopl-user-id": body.portalUserId || body.portal_user_id || body.userId || body.user_id || "",
      "x-medopl-workspace-id": body.workspaceId || body.workspace_id || "",
    };
    for (const [name, value] of Object.entries(expected)) {
      if (!request.headers[name] || (value && request.headers[name] !== value)) {
        sendJson(401, { ok: false, error: "unauthenticated", code: "authentication_required", missingScopeHeader: name });
        return false;
      }
    }
    return true;
  };
  const requireApprovedAccount = (body) => {
    if (state.approvedWorkspaceId !== body.workspaceId) {
      sendJson(428, { ok: false, error: "account_not_approved" });
      return false;
    }
    return true;
  };
  if (mode === "html-medopl" && (url.pathname === "/healthz" || url.pathname === "/readyz")) {
    response.writeHead(200, { "content-type": "text/html", connection: "close" });
    response.end("<!doctype html><title>wrong upstream</title>");
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html", connection: "close" });
    response.end("<!doctype html><title>MedOPL Portal</title><div id=\\"root\\">MedOPL Portal</div><script type=\\"module\\" src=\\"/assets/app.js\\"></script>");
    return;
  }
  if (url.pathname === "/healthz" || url.pathname === "/readyz") {
    sendJson(200, { service: "medopl-go-backend", status: "ok", mode: "production" });
    return;
  }
  if (url.pathname === "/api/v22/provider-key" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    state.sequence.push("bind_provider_key");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, providerKeyRef: "pkref_canary", boundStatus: "bound" });
    return;
  }
  if (url.pathname === "/api/v22/users/prepare" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    state.preparedWorkspaceId = body.workspaceId;
    state.approvedWorkspaceId = "";
    state.sequence.push("prepare_business_account");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "pending_approval", balance: 0, currency: "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/users/approve" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (state.preparedWorkspaceId !== body.workspaceId) {
      sendJson(428, { ok: false, error: "account_required" });
      return;
    }
    state.approvedWorkspaceId = body.workspaceId;
    state.sequence.push("approve_business_account");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "approved", status: "approved" });
    return;
  }
  if (url.pathname === "/api/v22/users/credit" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "active", balance: body.amount || 0, currency: body.currency || "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/billing/payment-orders" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    state.sequence.push("create_payment_order");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, orderId: "payorder_canary", status: "created", amount: body.amount || 0, currency: body.currency || "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/billing/payment-paid" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    if (request.headers["x-medopl-webhook-secret"] !== "webhook-secret-test") {
      sendJson(401, { ok: false, error: "webhook_signature_required" });
      return;
    }
    state.sequence.push("mark_payment_paid");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "active", balance: body.amount || 0, currency: body.currency || "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/managed-environment/open" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    state.sequence.push("open_runtime");
    sendJson(200, { launchId: "launch_canary", resourceBindingId: "rb_canary", workspaceId: body.workspaceId });
    return;
  }
  if (url.pathname === "/api/opl/runtime-gate" && request.method === "POST") {
    const body = await readRequestJson(request);
    sendJson(200, {
      ok: true,
      productOwner: "medopl",
      primaryConsumer: "opl-webui",
      workspaceId: body.workspaceId,
      medoplRuntimeRequired: true,
      providerKeyStatus: "bound",
      providerKeyRef: "pkref_canary",
      runtimeState: "ready",
      storageState: "ready",
      runtimeBindingId: "rb_canary",
      storageBindingId: "storage_canary",
      nodePoolProjection: { nodePoolRef: "nodepool_canary", state: "ready", customerVisible: false },
      consumerProjection: { uploadEnabled: true, runEnabled: true, artifactEnabled: true },
      commercialAdmission: {
        accountExists: true,
        accountApproved: true,
        workspaceExists: true,
        providerKeyRefExists: true,
        planSelected: true,
        balanceSufficient: true,
        quotaAvailable: true,
        emergencyPlatformStop: false,
        allowed: true,
        decision: "allowed",
        reason: "runtime_storage_ready",
      },
    });
    return;
  }
  if (url.pathname === "/api/opl/files" && request.method === "POST") {
    if (mode === "upload-diagnostic") {
      sendJson(400, {
        ok: false,
        error: "control_plane_operation_failed",
        errorCategory: "file_save_failed",
        correlationId: "corr-upload-canary",
        operationId: "upload-file-canary",
        launchIdPresent: true,
        launchLookupSucceeded: true,
        workspaceIdHash: "workspace_hash",
        resourceBindingIdHash: "resource_hash",
        storageBindingIdHash: "storage_hash",
        providerKeyRefPresent: true,
        runtimeState: "ready",
        storageState: "ready",
        fileNamePresent: true,
        relativePathHash: "relative_path_hash",
        fileRefHash: "file_hash",
        objectRefHash: "object_hash",
        saveFileStageSucceeded: false,
        saveAuditEventStageSucceeded: false,
        billingEventStageSucceeded: false,
        dbOperationStage: "save_file",
        handlerStage: "upload_file_handler",
        migrationState: "matched",
        duplicateCategory: "none",
        retryable: false,
      });
      return;
    }
    sendJson(200, { ok: true, fileRef: "file_canary", storageBindingId: "storage_canary" });
    return;
  }
  if (url.pathname === "/api/opl/runs" && request.method === "POST") {
    sendJson(200, { ok: true, runRef: "run_canary", artifactRef: "artifact_canary" });
    return;
  }
  if (url.pathname === "/api/opl/artifacts/artifact_canary" && request.method === "GET") {
    sendJson(200, { ok: true, artifactRef: "artifact_canary", fileRef: "artifact_file_canary" });
    return;
  }
  if (url.pathname === "/api/session/bootstrap" && request.method === "POST") {
    const body = await readRequestJson(request);
    response.setHeader("Set-Cookie", [
      "medopl_session=session-canary; Path=/; HttpOnly; Secure; SameSite=Strict",
      "medopl_csrf=csrf-canary; Path=/; Secure; SameSite=Strict",
    ]);
    sendJson(200, {
      ok: true,
      tenantId: body.tenantId,
      userId: body.userId,
      workspaceId: body.workspaceId,
      session: "issued",
    });
    return;
  }
  if (url.pathname === "/api/billing/summary" && request.method === "GET") {
    sendJson(200, { ok: true, runCount: 1, ledgerCount: 1 });
    return;
  }
  if (url.pathname === "/api/v22/managed-environment/release" && request.method === "POST") {
    if (mode === "release-diagnostic") {
      sendJson(400, {
        ok: false,
        error: "control_plane_operation_failed",
        errorCategory: "provider_release_failed",
        correlationId: "corr-release-canary",
        operationId: "runtime-release-canary",
        workspaceIdHash: "workspace_hash",
        runtimeBindingIdHash: "runtime_hash",
        runtimeState: "ready",
        expectedReleaseTransition: "ready_to_released",
        resourceBindingPresent: true,
        billingAttributionPresent: true,
        billingStopped: false,
        stopBillingState: "pending",
        idempotencyKeyPresent: true,
        alreadyReleased: false,
        auditEventWritten: false,
        providerRefPresent: true,
        providerReleaseCategory: "adapter_error",
        dbOperationStage: "release_runtime",
        handlerStage: "release_runtime_handler",
        migrationState: "matched",
        workspaceBindingMatch: "matched",
        authSessionMatch: "matched",
        retryable: false,
      });
      return;
    }
    sendJson(200, { ok: true, billingStopped: true, auditEventId: "audit_release_canary", runtimeState: "released" });
    return;
  }
  if (url.pathname === "/api/v22/storage/destroy" && request.method === "POST") {
    if (mode === "destroy-diagnostic") {
      sendJson(400, {
        ok: false,
        error: "control_plane_operation_failed",
        errorCategory: "db_constraint_failed",
        correlationId: "corr-destroy-canary",
        operationId: "storage-destroy-canary",
        workspaceIdHash: "workspace_hash",
        runtimeBindingIdHash: "runtime_hash",
        storageBindingIdHash: "storage_hash",
        currentStorageState: "ready",
        releaseState: "released",
        billingStopped: true,
        destroyIntentState: "requested",
        auditEventWritten: false,
        providerRefPresent: true,
        dbOperationStage: "save_billing_event",
        handlerStage: "storage_destroy_handler",
        retryable: false,
      });
      return;
    }
    sendJson(200, { ok: true, storageDestroyed: true, storageState: "destroyed", auditEventId: "audit_destroy_canary" });
    return;
  }
  sendJson(404, { ok: false, error: "not_found", path: url.pathname });
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write("READY " + address.port + "\\n");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`, mode], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("canary_server_start_timeout")), 5000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const match = buffer.match(/READY (\d+)/u);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`canary_server_exited:${code}`));
    });
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    }),
  };
}
