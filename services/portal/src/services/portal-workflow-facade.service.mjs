const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

function defaultNow() {
  return new Date().toISOString();
}

function commandType(type = "") {
  const normalized = String(type || "").trim();
  if (!normalized) throw new Error("workflow_command_type_required");
  return normalized;
}

function commandIdFor({ type, commandId = "" } = {}) {
  const normalizedType = commandType(type);
  const normalizedId = String(commandId || "").trim();
  if (normalizedId) return normalizedId;
  return `${normalizedType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function publicError(error) {
  return {
    error: error?.code || error?.error || "workflow_command_failed",
    message: String(error?.message || error || ""),
  };
}

export function createPortalWorkflowFacade({
  now = defaultNow,
} = {}) {
  const commands = new Map();

  function transition(command, status, patch = {}) {
    if (TERMINAL_STATUSES.has(command.status)) return command;
    command.status = status;
    command.updatedAt = now();
    Object.assign(command, patch);
    return command;
  }

  async function submitCommand({ type, commandId = "", payload = {}, execute }) {
    if (typeof execute !== "function") throw new Error("workflow_command_execute_required");
    const resolvedCommandId = commandIdFor({ type, commandId });
    const existing = commands.get(resolvedCommandId);
    if (existing && TERMINAL_STATUSES.has(existing.status)) {
      if (existing.result) return existing.result;
      throw new Error(existing.error?.message || "workflow_command_failed");
    }
    const command = existing || {
      commandId: resolvedCommandId,
      type: commandType(type),
      payload,
      status: "pending",
      createdAt: now(),
      updatedAt: now(),
      result: null,
      error: null,
    };
    commands.set(resolvedCommandId, command);
    transition(command, "running");
    try {
      const result = await execute({ commandId: resolvedCommandId, type: command.type, payload });
      command.result = result;
      if (result?.ok === false) {
        command.error = {
          error: result.error || "workflow_command_failed",
          message: result.message || result.businessMessage || "",
        };
        transition(command, "failed");
        return result;
      }
      transition(command, "succeeded");
      return result;
    } catch (error) {
      command.error = publicError(error);
      transition(command, "failed");
      throw error;
    }
  }

  function getCommand(commandId = "") {
    return commands.get(String(commandId || "").trim()) || null;
  }

  function getCommandStatus(commandId = "") {
    const command = getCommand(commandId);
    if (!command) return null;
    return {
      commandId: command.commandId,
      type: command.type,
      status: command.status,
      createdAt: command.createdAt,
      updatedAt: command.updatedAt,
      error: command.error,
    };
  }

  function runOplLaunchCommand({ commandId = "", payload = {}, execute }) {
    return submitCommand({
      type: "opl_launch",
      commandId,
      payload,
      execute,
    });
  }

  function runCloudOperationCommand({ commandId = "", payload = {}, execute }) {
    return submitCommand({
      type: "cloud_operation",
      commandId,
      payload,
      execute,
    });
  }

  return {
    submitCommand,
    runOplLaunchCommand,
    runCloudOperationCommand,
    getCommand,
    getCommandStatus,
  };
}
