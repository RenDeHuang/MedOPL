import { createPortalPlatformProvisionedResourceStore } from "../state/portal-platform-provisioned-resource-store.mjs";

function text(value) {
  return String(value ?? "").trim();
}

function parseJsonBodyOrEmpty(raw = Buffer.from("")) {
  const source = String(raw || "").trim();
  if (!source) return {};
  return JSON.parse(source);
}

function mapErrorCode(error = null) {
  const code = text(error?.code || error?.message);
  if (!code) return { status: 400, error: "bad_request" };
  if (code.startsWith("missing_")) return { status: 422, error: code };
  if (code.startsWith("invalid_")) return { status: 422, error: code };
  if (code.endsWith("_not_found_in_owner_scope")) return { status: 404, error: code };
  if (code === "active_binding_required") return { status: 409, error: code };
  if (code === "cloud_provisioner_required") return { status: 503, error: code };
  return { status: 400, error: code };
}

const PLATFORM_PROVISIONED_RESOURCE_PATHS = {
  list: ["/portal/api/platform-provisioned-resources"],
  computeInstances: ["/portal/api/platform-provisioned-resources/compute-instances"],
  storageBuckets: ["/portal/api/platform-provisioned-resources/storage-buckets"],
  deleteCompute: ["/portal/api/platform-provisioned-resources/compute-instances/delete"],
  deleteStorage: ["/portal/api/platform-provisioned-resources/storage-buckets/delete"],
  bind: ["/portal/api/platform-provisioned-resources/bind"],
  unbind: ["/portal/api/platform-provisioned-resources/unbind"],
  protectionFreezes: ["/portal/api/platform-provisioned-resources/protection-freezes"],
  ensureProtectionFreeze: ["/portal/api/platform-provisioned-resources/protection-freezes/ensure"],
};

const LEGACY_USER_OWNED_RESOURCE_PATHS = {
  list: ["/portal/api/user-owned-resources"],
  computeInstances: ["/portal/api/user-owned-resources/compute-instances"],
  storageBuckets: ["/portal/api/user-owned-resources/storage-buckets"],
  deleteCompute: ["/portal/api/user-owned-resources/compute-instances/delete"],
  deleteStorage: ["/portal/api/user-owned-resources/storage-buckets/delete"],
  bind: ["/portal/api/user-owned-resources/bind"],
  unbind: ["/portal/api/user-owned-resources/unbind"],
  protectionFreezes: ["/portal/api/user-owned-resources/protection-freezes"],
  ensureProtectionFreeze: ["/portal/api/user-owned-resources/protection-freezes/ensure"],
};

function resourcePath(url, paths, key = "list") {
  return (paths[key] || []).includes(String(url?.pathname || ""));
}

function createResourceRoutes({ readBody, sendJson, writeDb, cloudProvisioner = null, paths }) {
  const store = createPortalPlatformProvisionedResourceStore({ writeDb, cloudProvisioner });

  async function safeAction(res, action) {
    try {
      return await action();
    } catch (error) {
      const mapped = mapErrorCode(error);
      sendJson(res, { ok: false, error: mapped.error }, mapped.status);
      return true;
    }
  }

  async function handleList({ req, res, url, db, user }) {
    if (req.method !== "GET" || !resourcePath(url, paths)) return false;
    sendJson(res, store.listOwnerScopedResources(db, user));
    return true;
  }

  async function handleCreateCompute({ req, res, url, db, user }) {
    if (req.method !== "POST" || !resourcePath(url, paths, "computeInstances")) return false;
    return safeAction(res, async () => {
      const payload = parseJsonBodyOrEmpty(await readBody(req));
      const item = await store.createComputeInstance(db, user, payload);
      sendJson(res, { ok: true, item }, 201);
      return true;
    });
  }

  async function handleCreateBucket({ req, res, url, db, user }) {
    if (req.method !== "POST" || !resourcePath(url, paths, "storageBuckets")) return false;
    return safeAction(res, async () => {
      const payload = parseJsonBodyOrEmpty(await readBody(req));
      const item = await store.createStorageBucket(db, user, payload);
      sendJson(res, { ok: true, item }, 201);
      return true;
    });
  }

  async function handleDeleteCompute({ req, res, url, db, user }) {
    if (req.method !== "POST" || !resourcePath(url, paths, "deleteCompute")) return false;
    return safeAction(res, async () => {
      const payload = parseJsonBodyOrEmpty(await readBody(req));
      const result = await store.deleteComputeInstance(db, user, payload);
      sendJson(res, result);
      return true;
    });
  }

  async function handleDeleteBucket({ req, res, url, db, user }) {
    if (req.method !== "POST" || !resourcePath(url, paths, "deleteStorage")) return false;
    return safeAction(res, async () => {
      const payload = parseJsonBodyOrEmpty(await readBody(req));
      const result = await store.deleteStorageBucket(db, user, payload);
      sendJson(res, result);
      return true;
    });
  }

  async function handleBind({ req, res, url, db, user }) {
    if (req.method !== "POST" || !resourcePath(url, paths, "bind")) return false;
    return safeAction(res, async () => {
      const payload = parseJsonBodyOrEmpty(await readBody(req));
      const binding = await store.bindWorkspaceResource(db, user, payload);
      sendJson(res, { ok: true, binding });
      return true;
    });
  }

  async function handleUnbind({ req, res, url, db, user }) {
    if (req.method !== "POST" || !resourcePath(url, paths, "unbind")) return false;
    return safeAction(res, async () => {
      const payload = parseJsonBodyOrEmpty(await readBody(req));
      const result = await store.unbindWorkspaceResource(db, user, payload);
      sendJson(res, result);
      return true;
    });
  }

  async function handleProtectionFreezeList({ req, res, url, db, user }) {
    if (req.method !== "GET" || !resourcePath(url, paths, "protectionFreezes")) return false;
    sendJson(res, store.listOwnerScopedProtectionFreezes(db, user, {
      bindingId: url.searchParams.get("bindingId"),
      resourceBindingId: url.searchParams.get("resourceBindingId"),
      workspaceId: url.searchParams.get("workspaceId"),
      windowStartAt: url.searchParams.get("windowStartAt"),
      windowEndAt: url.searchParams.get("windowEndAt"),
      status: url.searchParams.get("status"),
    }));
    return true;
  }

  async function handleProtectionFreezeEnsure({ req, res, url, db, user }) {
    if (req.method !== "POST" || !resourcePath(url, paths, "ensureProtectionFreeze")) return false;
    return safeAction(res, async () => {
      const payload = parseJsonBodyOrEmpty(await readBody(req));
      const result = await store.ensureWeeklyProtectionFreeze(db, user, payload);
      sendJson(res, result);
      return true;
    });
  }

  return async function handlePlatformProvisionedResourceRoutes(context) {
    if (await handleList(context)) return true;
    if (await handleCreateCompute(context)) return true;
    if (await handleCreateBucket(context)) return true;
    if (await handleDeleteCompute(context)) return true;
    if (await handleDeleteBucket(context)) return true;
    if (await handleBind(context)) return true;
    if (await handleUnbind(context)) return true;
    if (await handleProtectionFreezeList(context)) return true;
    if (await handleProtectionFreezeEnsure(context)) return true;
    return false;
  };
}

export function createPlatformProvisionedResourceRoutes(options = {}) {
  return createResourceRoutes({ ...options, paths: PLATFORM_PROVISIONED_RESOURCE_PATHS });
}

export function createLegacyUserOwnedResourceRoutes(options = {}) {
  return createResourceRoutes({ ...options, paths: LEGACY_USER_OWNED_RESOURCE_PATHS });
}
