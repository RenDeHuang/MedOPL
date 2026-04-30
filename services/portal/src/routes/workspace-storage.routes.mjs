export function createWorkspaceStorageRoutes({
  buildWorkspaceStorageKey,
  createOrUpdateStorageOrder,
  defaultTaskTitle,
  ensureTaskSpace,
  fetchWorkspaceMinioState,
  fetchWorkspaceStorageSnapshot,
  findTaskSpace,
  guessContentType,
  issueWorkspaceTransferToken,
  listWorkspaceFiles,
  logPortalEvent,
  readBody,
  safeRelativePath,
  sendJson,
  slugify,
  workspaceStorageEntitlement,
  writeDb,
}) {
  async function readJsonBody(req, res) {
    try {
      return JSON.parse((await readBody(req)).toString("utf8") || "{}");
    } catch {
      sendJson(res, { error: "invalid_json" }, 400);
      return null;
    }
  }

  async function resolveTaskSpace({ db, user, task }) {
    const taskSlug = slugify(task || user.currentTaskSlug || "default");
    return findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
  }

  function fileNameFrom(relativePath) {
    return relativePath.split(/[\\/]/).pop() || relativePath;
  }

  async function handleWorkspaceStorageSnapshot({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/workspace/storage") return false;
    const taskSpace = await resolveTaskSpace({ db, user, task: url.searchParams.get("task") });
    const storage = await fetchWorkspaceStorageSnapshot(taskSpace);
    const minio = await fetchWorkspaceMinioState(user.id, taskSpace.slug);
    const entitlement = workspaceStorageEntitlement(db, user, taskSpace.slug);
    sendJson(res, {
      workspaceId: taskSpace.slug,
      entitlement,
      storage,
      minio,
      metadata: listWorkspaceFiles(db, { tenantId: user.tenantId || user.id, userId: user.id, workspaceId: taskSpace.slug }),
    });
    return true;
  }

  async function handleEntitlement({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/storage/entitlement") return false;
    const taskSpace = await resolveTaskSpace({
      db,
      user,
      task: url.searchParams.get("task") || url.searchParams.get("workspaceId"),
    });
    sendJson(res, {
      workspaceId: taskSpace.slug,
      entitlement: workspaceStorageEntitlement(db, user, taskSpace.slug),
    });
    return true;
  }

  async function handleStorageOrder({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/storage/orders") return false;
    const payload = await readJsonBody(req, res);
    if (!payload) return true;

    const taskSpace = await resolveTaskSpace({ db, user, task: payload.task || payload.workspaceId });
    const storageSizeGb = Math.max(0, Number(payload.storageSizeGb ?? payload.storage_size_gb ?? 0));
    if (storageSizeGb < 10) {
      sendJson(res, { error: "minimum_storage_10gb_required", minimumPurchaseGb: 10 }, 400);
      return true;
    }

    const created = createOrUpdateStorageOrder(db, {
      tenantId: user.tenantId || user.id,
      userId: user.id,
      workspaceId: taskSpace.slug,
      storageSizeGb,
      storagePlanId: String(payload.storagePlanId || `cos-${storageSizeGb}gb`),
      storageBackend: "cos",
      retentionPolicy: "order_lifecycle",
      sourceType: "portal_storage_order",
    });
    if (!created.ok) {
      sendJson(res, { error: created.error || "storage_order_failed" }, created.status || 400);
      return true;
    }

    await logPortalEvent({
      type: "workspace_storage_order_created",
      userId: user.id,
      workspaceId: taskSpace.slug,
      storageSizeGb,
      storageOrderId: created.order.id,
    });
    await writeDb(db);
    sendJson(res, {
      ok: true,
      workspaceId: taskSpace.slug,
      order: created.order,
      entitlement: workspaceStorageEntitlement(db, user, taskSpace.slug),
    }, created.created ? 201 : 200);
    return true;
  }

  async function handleUploadUrl({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/workspace/files/upload-url") return false;
    const payload = await readJsonBody(req, res);
    if (!payload) return true;

    const taskSpace = await resolveTaskSpace({ db, user, task: payload.task || payload.workspaceId });
    if (taskSpace.status !== "active") {
      sendJson(res, { error: "workspace_not_active" }, 409);
      return true;
    }

    const entitlement = workspaceStorageEntitlement(db, user, taskSpace.slug);
    if (!entitlement.enabled) {
      sendJson(res, { error: "storage_entitlement_required", entitlement }, 402);
      return true;
    }

    const relativePath = safeRelativePath(payload.relativePath || payload.fileName || payload.name || "");
    if (!relativePath) {
      sendJson(res, { error: "invalid_relative_path" }, 400);
      return true;
    }

    const kind = payload.kind === "outputs" ? "outputs" : "inputs";
    const fileName = fileNameFrom(relativePath);
    const issued = issueWorkspaceTransferToken({
      action: "upload",
      userId: user.id,
      workspaceId: taskSpace.slug,
      kind,
      relativePath,
      fileName,
      ttlMs: 10 * 60 * 1000,
    });
    sendJson(res, {
      workspaceId: taskSpace.slug,
      provider: "portal_signed_proxy",
      method: "POST",
      expiresAt: issued.expiresAt,
      url: `/portal/workspace/files/upload-signed?token=${encodeURIComponent(issued.token)}`,
      file: {
        kind,
        name: fileName,
        relativePath,
        storageKey: buildWorkspaceStorageKey(user.tenantId || user.id, taskSpace.slug, kind, relativePath),
        contentType: guessContentType(relativePath),
      },
    });
    return true;
  }

  async function handleDownloadUrl({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/workspace/files/download-url") return false;
    const taskSpace = await resolveTaskSpace({
      db,
      user,
      task: url.searchParams.get("task") || url.searchParams.get("workspaceId"),
    });
    const kind = url.searchParams.get("kind") === "outputs" ? "outputs" : "inputs";
    const relativePath = safeRelativePath(url.searchParams.get("relativePath") || url.searchParams.get("file") || "");
    if (!relativePath) {
      sendJson(res, { error: "invalid_relative_path" }, 400);
      return true;
    }

    const issued = issueWorkspaceTransferToken({
      action: "download",
      userId: user.id,
      workspaceId: taskSpace.slug,
      kind,
      relativePath,
      fileName: fileNameFrom(relativePath),
      ttlMs: 10 * 60 * 1000,
    });
    sendJson(res, {
      workspaceId: taskSpace.slug,
      provider: "portal_signed_proxy",
      method: "GET",
      expiresAt: issued.expiresAt,
      url: `/portal/workspace/files/download-signed?token=${encodeURIComponent(issued.token)}`,
      file: {
        kind,
        name: fileNameFrom(relativePath),
        relativePath,
      },
    });
    return true;
  }

  return async function handleWorkspaceStorageRoutes(context) {
    if (await handleWorkspaceStorageSnapshot(context)) return true;
    if (await handleEntitlement(context)) return true;
    if (await handleStorageOrder(context)) return true;
    if (await handleUploadUrl(context)) return true;
    if (await handleDownloadUrl(context)) return true;
    return false;
  };
}
