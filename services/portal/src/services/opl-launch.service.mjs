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

  return {
    async prepareLaunch({
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
    },
  };
}
