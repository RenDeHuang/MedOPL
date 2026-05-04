import { createWorkspaceUploadSupport } from "../routes/workspace-storage-upload-support.mjs";

export function createPortalWorkspaceRuntime({
  buildWorkspaceFileChecksum,
  buildWorkspaceStorageKey,
  codexRuntimeEventsFile,
  defaultTaskTitle,
  exists,
  getTaskPath,
  guessContentType,
  isBlockedUserStatus,
  layoutV2,
  logPortalEvent,
  markWorkspaceStorageDeleting,
  medRunsRoot,
  minioStorageClient,
  mkdir,
  path,
  randomUUID,
  readBody,
  readDb,
  readFile,
  readdir,
  recordWorkspaceFile,
  resolveWorkspaceStorageEntitlement,
  sanitizeTaskTitle,
  sendHtml,
  slugify,
  stat,
  writeDb,
  writeFile,
}) {
  function nextTaskSlug(db, userId, requestedTitle) {
    const baseSlug = slugify(requestedTitle || "task");
    const existing = new Set(
      db.taskSpaces.filter((item) => item.userId === userId).map((item) => item.slug),
    );
    if (!existing.has(baseSlug)) return baseSlug;
    let counter = 2;
    while (existing.has(`${baseSlug}-${counter}`)) counter += 1;
    return `${baseSlug}-${counter}`;
  }

  function safeRelativePath(value) {
    const normalized = path.normalize(String(value || "")).replace(/^([/\\])+/, "");
    if (!normalized || normalized === "." || normalized.startsWith("..") || path.isAbsolute(normalized)) return "";
    return normalized;
  }

  async function listFilesRecursive(rootDir, currentDir = rootDir, prefix = "") {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const relative = prefix ? path.join(prefix, entry.name) : entry.name;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await listFilesRecursive(rootDir, fullPath, relative)));
        } else if (entry.isFile()) {
          files.push({ name: relative.replaceAll("\\", "/"), fullPath });
        }
      }
      return files.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  function listTaskSpacesForUser(db, userId) {
    return db.taskSpaces
      .filter((item) => item.userId === userId && item.status !== "deleted")
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((item) => ({
        ...item,
        title: sanitizeTaskTitle(item.slug || "default", item.title || ""),
      }));
  }

  function findTaskSpace(db, userId, slug) {
    const normalized = slugify(slug || "default");
    return db.taskSpaces.find((item) => item.userId === userId && item.slug === normalized) || null;
  }

  function currentTaskSpaceForUser(db, user) {
    return findTaskSpace(db, user.id, user.currentTaskSlug || "default");
  }

  function isRunTerminal(run) {
    const status = String(run?.status || "").toLowerCase();
    if (["succeeded", "failed", "cancelled", "timed_out", "completed"].includes(status)) return true;
    if (run?.k8sStatus?.succeeded) return true;
    const conditions = Array.isArray(run?.k8sStatus?.conditions) ? run.k8sStatus.conditions : [];
    return conditions.some((item) => ["Complete", "Failed"].includes(item?.type) && item?.status === "True");
  }

  async function hasActiveRuns(userId, workspaceId) {
    const runs = await collectRunsForTask(userId, workspaceId);
    return runs.some((run) => !isRunTerminal(run));
  }

  function hasActiveWorkspaceSession(db, userId, workspaceId) {
    const now = Date.now();
    return db.workspaceSessions.some((item) =>
      item.userId === userId &&
      item.workspaceId === workspaceId &&
      item.status === "active" &&
      (!item.expiresAt || Date.parse(item.expiresAt) > now),
    );
  }

  async function ensureTaskSpace(db, user, slug = "default", title = "Default Task") {
    const normalized = slugify(slug);
    const existing = db.taskSpaces.find((item) => item.userId === user.id && item.slug === normalized);
    if (existing) return existing;
    const taskSpace = {
      id: randomUUID(),
      userId: user.id,
      slug: normalized,
      title: sanitizeTaskTitle(normalized, title),
      path: getTaskPath(user.id, normalized),
      status: "active",
      serverPlanId: "",
      serverPlanRegion: "",
      serverPlanSnapshot: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.taskSpaces.push(taskSpace);
    await mkdir(path.join(taskSpace.path, "inputs"), { recursive: true });
    await mkdir(path.join(taskSpace.path, "outputs"), { recursive: true });
    await mkdir(path.join(taskSpace.path, "logs"), { recursive: true });
    await mkdir(path.join(taskSpace.path, "runtime"), { recursive: true });
    await mkdir(path.join(taskSpace.path, "work"), { recursive: true });
    await minioStorageClient.ensureWorkspaceSkeleton(user.id, taskSpace.slug, taskSpace.path);
    if (!user.currentTaskSlug) user.currentTaskSlug = taskSpace.slug;
    await logPortalEvent({ type: "workspace_created", userId: user.id, workspaceId: taskSpace.slug, title: taskSpace.title });
    return taskSpace;
  }

  async function archiveTaskSpace(db, user, taskSpace) {
    taskSpace.status = "archived";
    taskSpace.archivedAt = new Date().toISOString();
    taskSpace.updatedAt = taskSpace.archivedAt;
    if (user.currentTaskSlug === taskSpace.slug) {
      const fallback = listTaskSpacesForUser(db, user.id).find((item) => item.slug !== taskSpace.slug && item.status === "active");
      user.currentTaskSlug = fallback?.slug || "default";
    }
    await logPortalEvent({ type: "workspace_archived", userId: user.id, workspaceId: taskSpace.slug, title: taskSpace.title });
  }

  async function restoreTaskSpace(db, user, taskSpace) {
    taskSpace.status = "active";
    delete taskSpace.archivedAt;
    taskSpace.updatedAt = new Date().toISOString();
    user.currentTaskSlug = taskSpace.slug;
    await logPortalEvent({ type: "workspace_restored", userId: user.id, workspaceId: taskSpace.slug, title: taskSpace.title });
  }

  async function markTaskSpaceDeleted(db, user, taskSpace) {
    taskSpace.status = "deleted";
    taskSpace.deletedAt = new Date().toISOString();
    taskSpace.updatedAt = taskSpace.deletedAt;
    const storageRetention = markWorkspaceStorageDeleting(db, {
      user,
      workspaceId: taskSpace.slug,
      deletedAt: taskSpace.deletedAt,
      retentionDays: 7,
    });
    db.workspaceSessions = db.workspaceSessions.map((item) => {
      if (item.userId === user.id && item.workspaceId === taskSpace.slug && item.status === "active") {
        return { ...item, status: "revoked", revokedAt: new Date().toISOString() };
      }
      return item;
    });
    if (user.currentTaskSlug === taskSpace.slug) {
      const fallback = listTaskSpacesForUser(db, user.id).find((item) => item.slug !== taskSpace.slug && item.status === "active");
      user.currentTaskSlug = fallback?.slug || "default";
    }
    await logPortalEvent({
      type: "workspace_deleted",
      userId: user.id,
      workspaceId: taskSpace.slug,
      title: taskSpace.title,
      storageRetention,
    });
  }

  function workspaceSessionCookie() {
    return "workspace_session";
  }

  function readWorkspaceSession(db, sessionId, userId = "") {
    if (!sessionId) return null;
    const now = Date.now();
    const match = db.workspaceSessions.find((item) => item.id === sessionId && item.status === "active");
    if (!match) return null;
    if (match.expiresAt && Date.parse(match.expiresAt) <= now) return null;
    if (userId && match.userId !== userId) return null;
    return match;
  }

  async function ensureWorkspaceSession(db, user, taskSpace) {
    const active = db.workspaceSessions.find((item) =>
      item.userId === user.id &&
      item.workspaceId === taskSpace.slug &&
      item.status === "active" &&
      (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
    );
    if (active) {
      active.lastUsedAt = new Date().toISOString();
      return active;
    }
    const session = {
      id: randomUUID(),
      userId: user.id,
      workspaceId: taskSpace.slug,
      workspaceTitle: taskSpace.title,
      sessionType: "opl_session",
      status: "active",
      source: "portal-workspace-entry",
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };
    db.workspaceSessions.push(session);
    await logPortalEvent({ type: "workspace_session_created", userId: user.id, workspaceId: taskSpace.slug, workspaceSessionId: session.id });
    return session;
  }

  function latestActiveWorkspaceSession(db, userId, workspaceId) {
    return db.workspaceSessions
      .filter((item) =>
        item.userId === userId &&
        item.workspaceId === workspaceId &&
        item.status === "active" &&
        (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()),
      )
      .sort((a, b) => String(b.lastUsedAt || b.createdAt || "").localeCompare(String(a.lastUsedAt || a.createdAt || "")))[0] || null;
  }

  async function fetchWorkspaceStorageSnapshot(taskSpace) {
    const inputDir = path.join(taskSpace.path, "inputs");
    const outputDir = path.join(taskSpace.path, "outputs");
    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    const files = await listFilesRecursive(inputDir);
    const outputs = await listFilesRecursive(outputDir);
    const inputBytes = (await Promise.all(files.map((item) => stat(item.fullPath).then((meta) => meta.size).catch(() => 0)))).reduce((sum, item) => sum + item, 0);
    const outputBytes = (await Promise.all(outputs.map((item) => stat(item.fullPath).then((meta) => meta.size).catch(() => 0)))).reduce((sum, item) => sum + item, 0);
    return {
      source: "workspace_file_system",
      type: "live",
      workspaceId: taskSpace.slug,
      inputsCount: files.length,
      outputsCount: outputs.length,
      inputBytes,
      outputBytes,
      files,
      outputs,
    };
  }

  function workspaceStorageEntitlement(db, user, workspaceId) {
    return resolveWorkspaceStorageEntitlement(db, user, workspaceId);
  }

  function workspaceUploadBlock(entitlement) {
    if (!entitlement.enabled) {
      return {
        title: "存储未开通",
        html: `<div class="card"><h2>请先开通存储</h2><p class="hint">免费容量为 0。上传输入文件和保存输出文件前，需要在“服务器与费用”开通至少 10GB 对象存储。</p></div>`,
        status: 402,
      };
    }
    if (entitlement.gates && entitlement.gates.canUpload === false) {
      return {
        title: "当前不可上传",
        html: `<div class="card"><h2>当前不可上传</h2><p class="hint">当前实验室套餐处于只读或存储已满状态，可以先下载已有文件或完成扩容。</p></div>`,
        status: 409,
      };
    }
    return null;
  }

  async function fetchWorkspaceMinioState(userId, taskSlug) {
    return minioStorageClient.fetchWorkspaceState(userId, taskSlug);
  }

  async function syncWorkspaceFileToMinio(userId, taskSlug, kind, filePath, relativePath = "") {
    return minioStorageClient.syncWorkspaceFile(userId, taskSlug, kind, filePath, relativePath);
  }

  async function readDirSafe(dir) {
    try {
      return await readdir(dir);
    } catch {
      return [];
    }
  }

  async function collectRunsForUser(userId, { limit = 200, workspaceId = "", runId = "" } = {}) {
    const maxRows = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 200;
    const targetWorkspaceId = String(workspaceId || "").trim();
    const targetRunId = String(runId || "").trim();
    const runMatches = (item = {}) =>
      (item.userId === userId || item.customerId === userId || item.portalUserId === userId) &&
      (!targetWorkspaceId || item.workspaceId === targetWorkspaceId) &&
      (!targetRunId || item.runId === targetRunId);
    const items = [];
    const files = await readDirSafe(medRunsRoot);
    let limitReached = false;
    for (const file of files.slice().reverse()) {
      if (!file.endsWith(".json")) continue;
      try {
        const json = JSON.parse(await readFile(path.join(medRunsRoot, file), "utf8"));
        if (runMatches(json)) items.push(json);
        if (items.length >= maxRows) {
          limitReached = true;
          break;
        }
      } catch {}
    }
    if (!limitReached && await exists(codexRuntimeEventsFile)) {
      try {
        const raw = await readFile(codexRuntimeEventsFile, "utf8");
        const lines = raw.split(/\r?\n/).filter(Boolean).reverse();
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type !== "codex_runtime_run") continue;
            if (event.portalUserId !== userId) continue;
            if (targetWorkspaceId && event.workspaceId !== targetWorkspaceId) continue;
            if (targetRunId && event.runId !== targetRunId) continue;
            items.push({
              runId: event.runId,
              userId: event.portalUserId,
              customerId: event.portalUserId,
              workspaceId: event.workspaceId,
              workspaceSessionId: event.workspaceSessionId || "",
              status: Number(event.exitCode || 0) === 0 ? "completed" : "failed",
              exitCode: Number(event.exitCode || 0),
              createdAt: event.occurredAt,
              source: "codex_runtime",
              stdoutFile: event.stdoutFile || "",
              stderrFile: event.stderrFile || "",
            });
            if (items.length >= maxRows) {
              limitReached = true;
              break;
            }
          } catch {}
        }
      } catch {}
    }
    const deduped = new Map();
    for (const item of items) {
      const key = item?.runId || randomUUID();
      const existing = deduped.get(key);
      if (!existing || String(item.createdAt || "") > String(existing.createdAt || "")) {
        deduped.set(key, item);
      }
    }
    const boundedRuns = [...deduped.values()]
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const merged = boundedRuns.slice(0, maxRows);
    Object.defineProperty(merged, "limitReached", {
      value: limitReached || boundedRuns.length > maxRows,
      enumerable: false,
    });
    return merged;
  }

  async function evaluateUserPolicy(db, user) {
    const group = db.groups.find((item) =>
      item.id === user.groupId &&
      String(item.status || "active").toLowerCase() === "active",
    ) || null;
    const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
    const concurrentRuns = (await collectRunsForUser(user.id)).filter((run) => !isRunTerminal(run)).length;
    const workspaceCount = db.taskSpaces.filter((item) =>
      item.userId === user.id &&
      !["deleted", "deleting"].includes(String(item.status || "").toLowerCase()),
    ).length;

    const allowMas = group ? group.allowMas !== false : true;
    let allowWorkspaceCreate = group ? group.allowWorkspaceCreate !== false : true;
    const blocks = [];

    if (isBlockedUserStatus(user.status)) {
      blocks.push("当前账号已被禁用");
    }

    if (group) {
      const balanceFloor = Number(group.balanceFloor || 0);
      if (balanceFloor > 0 && Number(wallet.balance || 0) < balanceFloor) {
        blocks.push(`当前余额低于分组门槛（${balanceFloor.toFixed(2)}）`);
      }

      const maxConcurrentRuns = Number(group.maxConcurrentRuns || 0);
      if (maxConcurrentRuns > 0 && concurrentRuns >= maxConcurrentRuns) {
        blocks.push(`已达到分组并发运行上限（${maxConcurrentRuns}）`);
      }

      const maxWorkspaces = Number(group.maxWorkspaces || 0);
      if (maxWorkspaces > 0 && workspaceCount >= maxWorkspaces) {
        allowWorkspaceCreate = false;
      }
    }

    return {
      group,
      wallet,
      concurrentRuns,
      workspaceCount,
      allowMas,
      allowWorkspaceCreate,
      blocks,
      blocked: blocks.length > 0,
    };
  }

  async function collectRunsForTask(userId, workspaceId) {
    return collectRunsForUser(userId, { workspaceId, limit: 200 });
  }

  function summarizeTaskRuns(runs) {
    const latestRun = runs[0] || null;
    const completed = runs.filter((run) => isRunTerminal(run)).length;
    return { latestRun, totalRuns: runs.length, completed };
  }

  const {
    persistWorkspaceUpload,
    readMultipartFiles,
  } = createWorkspaceUploadSupport({
    buildWorkspaceFileChecksum,
    buildWorkspaceStorageKey,
    guessContentType,
    mkdir,
    path,
    recordWorkspaceFile,
    safeRelativePath,
    stat,
    syncWorkspaceFileToMinio,
    writeFile,
  });

  async function handleUpload(req, res, user, existingDb = null) {
    const url = new URL(req.url || "/", "http://local");
    const taskSlug = slugify(url.searchParams.get("task") || "default");
    const contentType = String(req.headers["content-type"] || "");
    const match = contentType.match(/boundary=(.+)$/);
    if (!match) {
      sendHtml(res, layoutV2("上传失败", `<div class="card">上传请求缺少 multipart boundary。</div>`, user), 400);
      return;
    }

    const files = readMultipartFiles(await readBody(req), match[1]);
    const db = existingDb || await readDb();
    const taskSpace = await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    if (taskSpace.status !== "active") {
      sendHtml(res, layoutV2("任务空间不可上传", `<div class="card"><h2>当前任务空间不可上传</h2><p class="hint">只有 active 状态的任务空间才能继续上传文件与发起新运行。</p></div>`, user), 409);
      return;
    }
    const entitlement = workspaceStorageEntitlement(db, user, taskSpace.slug);
    const uploadBlock = workspaceUploadBlock(entitlement);
    if (uploadBlock) {
      sendHtml(res, layoutV2(uploadBlock.title, uploadBlock.html, user), uploadBlock.status);
      return;
    }

    let fileCount = 0;
    for (const file of files) {
      const saved = await persistWorkspaceUpload({ db, user, taskSpace, kind: "inputs", file });
      if (!saved.ok) continue;
      fileCount += 1;
    }
    await logPortalEvent({ type: "workspace_input_uploaded", userId: user.id, workspaceId: taskSpace.slug, fileCount });
    await writeDb(db);
    res.writeHead(302, { Location: `/portal/workspace?task=${encodeURIComponent(taskSpace.slug)}` });
    res.end();
  }

  return {
    archiveTaskSpace,
    collectRunsForTask,
    collectRunsForUser,
    currentTaskSpaceForUser,
    evaluateUserPolicy,
    fetchWorkspaceMinioState,
    fetchWorkspaceStorageSnapshot,
    findTaskSpace,
    handleUpload,
    hasActiveRuns,
    hasActiveWorkspaceSession,
    isRunTerminal,
    latestActiveWorkspaceSession,
    listFilesRecursive,
    listTaskSpacesForUser,
    markTaskSpaceDeleted,
    nextTaskSlug,
    readWorkspaceSession,
    restoreTaskSpace,
    safeRelativePath,
    summarizeTaskRuns,
    syncWorkspaceFileToMinio,
    workspaceSessionCookie,
    workspaceStorageEntitlement,
    ensureTaskSpace,
    ensureWorkspaceSession,
  };
}
