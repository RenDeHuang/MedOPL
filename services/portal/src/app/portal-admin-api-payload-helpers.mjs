export function buildAdminTopUsers({ users = [], items = [], wallets = [] }) {
  return users.map((item) => {
    const userItems = items.filter((entry) => {
      const props = entry?.properties || {};
      return props["label:customer_id"] === item.id || props.customer_id === item.id;
    });
    return {
      userId: item.id,
      name: item.name,
      email: item.email,
      totalCost: userItems.reduce((sum, entry) => sum + Number(entry?.totalCost || 0), 0),
      balance: Number((wallets.find((wallet) => wallet.userId === item.id)?.balance) || 0),
      status: item.status || "active",
      groupId: item.groupId || "",
    };
  }).sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);
}

export function buildAdminRecentUsage({ allRuns = [], isRunTerminal, formatDateTime }) {
  return allRuns
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 12)
    .map((run) => ({
      runId: run.runId,
      userId: run.userId,
      userName: run.userName,
      workspaceId: run.workspaceId || "-",
      status: isRunTerminal(run) ? "completed" : (run.status || "running"),
      createdAt: formatDateTime(run.createdAt || ""),
    }));
}

export function buildAdminUsageRows({ allRuns = [], items = [], isRunTerminal, formatDateTime }) {
  return allRuns
    .slice()
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map((run) => {
      const relatedItem = items.find((entry) => entry?.properties?.["label:run_id"] === run.runId || entry?.properties?.run_id === run.runId || entry?.name?.includes(run.runId));
      return {
        runId: run.runId,
        userId: run.userId,
        userName: run.userName,
        workspaceId: run.workspaceId || "-",
        status: isRunTerminal(run) ? "completed" : (run.status || "running"),
        createdAt: formatDateTime(run.createdAt || ""),
        cpuCost: Number(relatedItem?.cpuCost || 0),
        gpuCost: Number(relatedItem?.gpuCost || 0),
        storageCost: Number(relatedItem?.pvCost || 0),
        vpnCost: 0,
        trafficCost: 0,
        otherCloudCost: 0,
        totalCost: Number(relatedItem?.totalCost || 0),
      };
    });
}

export function buildAdminAlerts({
  securitySummary,
  performanceSummary,
  unavailableServices = [],
  traceMissingAlerts = [],
  failedRuns = [],
  pendingRuns = [],
  lowBalanceUsers = [],
  formatDateTime,
  money,
}) {
  const securityAlerts = securitySummary.checks
    .filter((item) => !item.healthy)
    .map((item) => ({
      severity: "danger",
      category: "security",
      title: `安全配置未收口：${item.key}`,
      detail: item.detail,
      occurredAt: "",
      action: `/portal/admin/system`,
    }));
  const performanceAlerts = [];
  if (performanceSummary.warmupTimeoutCount > 0) {
    performanceAlerts.push({
      severity: "warning",
      category: "performance",
      title: "MAS warmup 存在超时",
      detail: `最近检测到 ${performanceSummary.warmupTimeoutCount} 次 warmup 超时`,
      occurredAt: "",
      action: `/portal/admin/system`,
    });
  }
  if (Number(performanceSummary.masFirstReplyApproxMs || 0) > 20000) {
    performanceAlerts.push({
      severity: "warning",
      category: "performance",
      title: "MAS 首次回复偏慢",
      detail: `最近成功样本平均约 ${performanceSummary.masFirstReplyApproxMs} ms`,
      occurredAt: "",
      action: `/portal/admin/system`,
    });
  }

  return [
    ...securityAlerts,
    ...performanceAlerts,
    ...unavailableServices.map((item) => ({
      severity: "danger",
      category: "system",
      title: `${item.name} 不可达`,
      detail: `当前状态 ${item.probe.status}`,
      occurredAt: "",
      action: `/portal/admin/system`,
    })),
    ...traceMissingAlerts,
    ...failedRuns.map((run) => ({
      severity: "danger",
      category: "run",
      title: `${run.userName} 有失败运行`,
      userId: run.userId,
      runId: run.runId,
      workspaceId: run.workspaceId,
      detail: `失败 run：${run.runId}`,
      occurredAt: run.createdAt,
      action: `/portal/admin/run?runId=${run.runId}`,
    })),
    ...pendingRuns.slice(0, 12).map((item) => ({
      severity: "warning",
      category: "pending",
      userId: item.customerId,
      runId: item.runId,
      workspaceId: item.workspaceId || "-",
      title: "Pending 计量待补齐",
      detail: `${Number(item.pendingHours || 0).toFixed(2)} 小时未补齐`,
      occurredAt: formatDateTime(item.completedAt || item.createdAt || ""),
      action: "/portal/admin/billing-ops",
    })),
    ...lowBalanceUsers.map((entry) => ({
      severity: "warning",
      category: "balance",
      title: `${entry.name} 余额不足`,
      userId: entry.userId,
      detail: `当前余额 ${money(entry.balance)}`,
      occurredAt: "",
      action: `/portal/admin/user?userId=${entry.userId}`,
    })),
  ].slice(0, 40);
}

export function buildAdminGroups({ groups = [], users = [] }) {
  return groups.map((group) => ({
    ...group,
    memberCount: users.filter((user) => user.groupId === group.id).length,
  }));
}

export function buildAdminLedgerSummary(ledger = []) {
  return {
    topup: ledger.filter((item) => item.type === "topup").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    resourceCharge: ledger.filter((item) => item.type === "resource_charge").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    refund: ledger.filter((item) => item.type === "refund").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    makeupCharge: ledger.filter((item) => item.type === "makeup_charge").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    entryCount: ledger.length,
  };
}

export function buildAdminAuditRows(events = [], formatDateTime) {
  return events.map((event) => ({
    type: event.type,
    userId: event.userId || "",
    operatorId: event.operatorId || "",
    workspaceId: event.workspaceId || "",
    occurredAt: formatDateTime(event.occurredAt),
    detail: JSON.stringify(event).slice(0, 240),
  }));
}

export function buildAdminUsersRows({
  users = [],
  wallets = [],
  taskSpaces = [],
  workspaceSessions = [],
  sessions = [],
  activeUserStatus,
  formatDateTime,
  groupNameById,
}) {
  return users
    .filter((item) => item.role !== "admin")
    .filter((item) => activeUserStatus(item.status) !== "deleted")
    .map((item) => {
      const wallet = wallets.find((entry) => entry.userId === item.id) || { balance: 0 };
      const userTaskSpaces = taskSpaces.filter((task) => task.userId === item.id && String(task.status || "").toLowerCase() !== "deleted");
      const userWorkspaceSessions = workspaceSessions.filter((session) => session.userId === item.id);
      const latestWorkspaceSessionAt = userWorkspaceSessions
        .map((session) => String(session.lastUsedAt || session.createdAt || ""))
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const latestPortalSessionAt = sessions
        .filter((session) => session.userId === item.id)
        .map((session) => String(session.createdAt || ""))
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const latestTaskAt = userTaskSpaces
        .map((task) => String(task.updatedAt || task.createdAt || ""))
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const lastActiveAt = [latestPortalSessionAt, latestWorkspaceSessionAt, latestTaskAt, String(item.createdAt || "")]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))[0] || "";
      const lastUsedAt = [latestWorkspaceSessionAt, latestTaskAt]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a))[0] || "";
      return {
        ...item,
        status: activeUserStatus(item.status),
        balance: Number(wallet.balance || 0),
        taskCount: userTaskSpaces.length,
        groupName: groupNameById(item.groupId || ""),
        lastActiveAt: lastActiveAt ? formatDateTime(lastActiveAt) : "",
        lastUsedAt: lastUsedAt ? formatDateTime(lastUsedAt) : "",
        workspaceSlugs: userTaskSpaces.map((task) => task.slug),
      };
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
