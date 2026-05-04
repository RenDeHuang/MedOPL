import {
  createGflabProviderConfig,
  normalizeProviderApiKey,
} from "../domain/provider-config.mjs";

export {
  createGflabProviderConfig,
  normalizeProviderApiKey,
  redactProviderConfig,
} from "../domain/provider-config.mjs";

const PROVIDER_KEY_VALIDATORS = [
  {
    accepts: ({ provider, source, apiKey }) => Boolean(provider && source && apiKey),
    error: "provider_api_key_required",
    message: "请输入 gflabtoken API key 后再进入 OPL。",
  },
  {
    accepts: ({ provider }) => provider === "gflabtoken",
    error: "provider_not_supported",
    message: "当前仅支持 gflabtoken 作为 OPL provider。",
  },
  {
    accepts: ({ source }) => source === "user_input",
    error: "provider_source_invalid",
    message: "OPL provider API key 必须来自 user_input。",
  },
];

const OPL_LAUNCH_STAGES = Object.freeze([
  "workspace_ready",
  "provider_key_bound",
  "session_created",
  "gateway_ready",
  "opl_opening",
]);

function nowIso() {
  return new Date().toISOString();
}

function createLaunchStage(stage, { ok = true, blockingUser = false, userVisibleState = "" } = {}) {
  const at = nowIso();
  return {
    stage,
    ok,
    blockingUser,
    userVisibleState: userVisibleState || stage,
    startedAt: at,
    endedAt: at,
    latencyMs: 0,
  };
}

function normalizeProviderKeyInput(providerKeyPayload = {}) {
  return {
    provider: String(providerKeyPayload.provider || "").trim(),
    source: String(providerKeyPayload.source || "").trim(),
    apiKey: normalizeProviderApiKey(providerKeyPayload.apiKey || ""),
  };
}

function providerKeyFailure(rule, context) {
  return {
    ok: false,
    error: rule.error,
    status: 400,
    message: rule.message,
    ...context,
  };
}

function createdProviderConfigFailure(created, context) {
  return {
    ok: false,
    error: created.error,
    status: 400,
    message: created.message,
    ...context,
  };
}

function resolveProviderKeyConfig({
  providerConfig = null,
  providerConfigSecretRef = "",
  providerKeyPayload = null,
  user,
  taskSpace,
  context,
}) {
  if (!providerKeyPayload) {
    return {
      ok: true,
      providerConfig,
      providerConfigSecretRef,
      providerKeyMeta: null,
    };
  }
  const input = normalizeProviderKeyInput(providerKeyPayload);
  const invalidRule = PROVIDER_KEY_VALIDATORS.find((rule) => !rule.accepts(input));
  if (invalidRule) return providerKeyFailure(invalidRule, context);
  if (providerConfig && providerConfigSecretRef) {
    return {
      ok: true,
      providerConfig,
      providerConfigSecretRef,
      providerSecret: {
        provider: input.provider,
        source: input.source,
        apiKey: input.apiKey,
      },
      providerKeyMeta: {
        provider: input.provider,
        source: input.source,
      },
    };
  }

  const created = createGflabProviderConfig({
    userId: user.id,
    workspaceId: taskSpace.slug,
    apiKey: input.apiKey,
  });
  if (!created.ok) return createdProviderConfigFailure(created, context);

  return {
    ok: true,
    providerConfig: created.providerConfig,
    providerConfigSecretRef: created.providerConfigSecretRef,
    providerSecret: created.providerSecret,
    providerKeyMeta: {
      provider: input.provider,
      source: input.source,
    },
  };
}

export function createOplLaunchService({
  evaluateUserPolicy,
  findTaskSpace,
  ensureTaskSpace,
  ensureWorkspaceSession,
  createOplLaunch,
  providerSecretStore = null,
  resolveStorageEntitlement,
  defaultTaskTitle,
  logPortalEvent,
  writeDb,
}) {
  const launchStatuses = new Map();

  function updateLaunchStage(launchId, stage, details = {}) {
    const current = launchStatuses.get(launchId);
    if (!current) return null;
    const existing = current.stages.find((item) => item.stage === stage);
    const next = {
      ...(existing || createLaunchStage(stage)),
      ...details,
      stage,
      endedAt: nowIso(),
      ok: details.ok ?? true,
      blockingUser: Boolean(details.blockingUser),
      userVisibleState: details.userVisibleState || existing?.userVisibleState || stage,
    };
    if (existing) {
      Object.assign(existing, next);
    } else {
      current.stages.push(next);
    }
    current.currentStage = stage;
    current.updatedAt = nowIso();
    return current;
  }

  function getLaunchStatus(launchId) {
    return launchStatuses.get(launchId) || null;
  }

  function createLaunchIntent({ user, taskSlug, source = "portal-page" }) {
    const launchId = `opl-launch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const status = {
      ok: true,
      launchId,
      status: "preparing",
      currentStage: "workspace_ready",
      taskSlug,
      source,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      userId: user.id,
      userVisibleState: "正在准备实验空间",
      blockingUser: false,
      oplWebUrl: "",
      stages: [
        createLaunchStage("workspace_ready", {
          blockingUser: false,
          userVisibleState: "正在准备实验空间",
        }),
      ],
    };
    launchStatuses.set(launchId, status);
    return status;
  }

  async function prepareLaunchIntent({ launchId, db, user, taskSlug, requireRealOplWeb = true, source = "portal-page" }) {
    const startedAt = Date.now();
    try {
      updateLaunchStage(launchId, "provider_key_bound", {
        blockingUser: false,
        userVisibleState: "正在绑定 OPL 访问凭证",
      });
      const result = await prepareLaunch({
        db,
        user,
        taskSlug,
        requireRealOplWeb,
        source,
      });
      if (!result.ok) {
        const current = launchStatuses.get(launchId);
        if (current) {
          current.ok = false;
          current.status = "failed";
          current.error = result.error;
          current.message = result.message || (result.reasons || []).join("；");
          current.blockingUser = true;
          current.userVisibleState = result.message || "OPL 准备失败，请检查账号和工作空间状态";
          current.updatedAt = nowIso();
          updateLaunchStage(launchId, "session_created", {
            ok: false,
            blockingUser: true,
            userVisibleState: current.userVisibleState,
          });
        }
        return result;
      }
      updateLaunchStage(launchId, "session_created", {
        blockingUser: false,
        userVisibleState: "正在创建 OPL 会话",
      });
      updateLaunchStage(launchId, "gateway_ready", {
        blockingUser: false,
        userVisibleState: "OPL 网关已准备",
      });
      updateLaunchStage(launchId, "opl_opening", {
        blockingUser: false,
        userVisibleState: "正在打开 OPL",
      });
      const current = launchStatuses.get(launchId);
      if (current) {
        current.status = "ready";
        current.userVisibleState = "OPL 已准备好，正在打开";
        current.blockingUser = false;
        current.oplWebUrl = result.launch.oplWebUrl || "";
        current.runtimeUrl = result.launch.runtimeUrl || "";
        current.workspace = result.taskSpace;
        current.workspaceSession = result.workspaceSession;
        current.launch = result.launch;
        current.latencyMs = Date.now() - startedAt;
        current.updatedAt = nowIso();
      }
      return result;
    } catch (error) {
      const current = launchStatuses.get(launchId);
      if (current) {
        current.ok = false;
        current.status = "failed";
        current.error = "opl_launch_failed";
        current.message = String(error.message || error);
        current.blockingUser = true;
        current.userVisibleState = "OPL 准备失败，请稍后重试";
        current.latencyMs = Date.now() - startedAt;
        current.updatedAt = nowIso();
        updateLaunchStage(launchId, current.currentStage || "session_created", {
          ok: false,
          blockingUser: true,
          userVisibleState: current.userVisibleState,
        });
      }
      throw error;
    }
  }

  async function buildLaunchBlockReasons(db, user) {
    const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
    const policy = await evaluateUserPolicy(db, user);
    const accountBlocks = (policy.blocks || []).filter((item) => String(item || "").includes("账号已被禁用"));
    return {
      wallet,
      policy,
      reasons: [
        ...accountBlocks,
      ],
    };
  }

  async function prepareLaunch({
      db,
      user,
      taskSlug,
      requireRealOplWeb = true,
      source = "portal-api",
      sourceSurface = "portal-control-plane",
      providerConfig = null,
      providerConfigSecretRef = "",
      providerKeyPayload = null,
    }) {
      const { wallet, policy, reasons } = await buildLaunchBlockReasons(db, user);
      if (reasons.length) {
        await logPortalEvent({
          type: "opl_launch_blocked",
          userId: user.id,
          source,
          groupId: policy.group?.id || "",
          reasons,
        });
        return {
          ok: false,
          error: "workspace_launch_blocked",
          status: 403,
          reasons,
          policy,
          wallet,
        };
      }

      const taskSpace =
        findTaskSpace(db, user.id, taskSlug) ||
        await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
      if (taskSpace.status !== "active") {
        return {
          ok: false,
          error: "workspace_not_active",
          status: 409,
          reasons: ["只有 active 状态的任务空间才能启动 OPL。"],
          taskSpace,
          policy,
          wallet,
        };
      }

      const workspaceSession = await ensureWorkspaceSession(db, user, taskSpace);
      const storageEntitlement = typeof resolveStorageEntitlement === "function"
        ? resolveStorageEntitlement(db, user, taskSpace.slug)
        : null;
      const resolvedProvider = resolveProviderKeyConfig({
        providerConfig,
        providerConfigSecretRef,
        providerKeyPayload,
        user,
        taskSpace,
        context: { taskSpace, workspaceSession, policy, wallet },
      });
      if (!resolvedProvider.ok) return resolvedProvider;
      if (providerSecretStore && resolvedProvider.providerConfigSecretRef && resolvedProvider.providerSecret) {
        await providerSecretStore.writeProviderSecret(
          resolvedProvider.providerConfigSecretRef,
          resolvedProvider.providerSecret,
        );
      }

      let launch;
      try {
        launch = await createOplLaunch({
          user,
          taskSpace,
          workspaceSession,
          requireRealOplWeb,
          sourceSurface,
          providerConfig: resolvedProvider.providerConfig,
          providerConfigSecretRef: resolvedProvider.providerConfigSecretRef,
          providerKeyPayload: resolvedProvider.providerKeyMeta,
          storageEntitlement,
        });
      } catch (error) {
        await logPortalEvent({
          type: "opl_launch_failed",
          userId: user.id,
          workspaceId: taskSpace.slug,
          workspaceSessionId: workspaceSession.id,
          source,
          sourceSurface,
          error: String(error.message || error),
          providerKey: resolvedProvider.providerKeyMeta,
        });
        return {
          ok: false,
          error: "opl_launch_failed",
          status: 502,
          message: String(error.message || error),
          taskSpace,
          workspaceSession,
          policy,
          wallet,
        };
      }

      await logPortalEvent({
        type: "opl_launch_created",
        userId: user.id,
        workspaceId: taskSpace.slug,
        workspaceSessionId: workspaceSession.id,
        runtimeSessionId: launch.runtimeSessionId || "",
        source,
        sourceSurface,
        providerKey: resolvedProvider.providerKeyMeta,
      });
      await writeDb(db);

      return {
        ok: true,
        taskSpace,
        workspaceSession,
        launch,
        policy,
        wallet,
      };
    }

  return {
    createLaunchIntent,
    getLaunchStatus,
    prepareLaunch,
    prepareLaunchIntent,
    updateLaunchStage,
  };
}
