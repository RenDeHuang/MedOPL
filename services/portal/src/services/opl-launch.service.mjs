export function createOplLaunchService({
  evaluateUserPolicy,
  findTaskSpace,
  ensureTaskSpace,
  ensureWorkspaceSession,
  createOplLaunch,
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
      let launch;
      try {
        launch = await createOplLaunch({
          user,
          taskSpace,
          workspaceSession,
          requireRealOplWeb,
        });
      } catch (error) {
        await logPortalEvent({
          type: "opl_launch_failed",
          userId: user.id,
          workspaceId: taskSpace.slug,
          workspaceSessionId: workspaceSession.id,
          source,
          error: String(error.message || error),
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
