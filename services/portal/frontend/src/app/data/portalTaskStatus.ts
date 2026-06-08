export type PortalTaskStatus = "running" | "completed" | "failed" | "waiting";

export function taskStatus(status: string): PortalTaskStatus {
  if (["completed", "success", "succeeded", "done"].includes(status)) return "completed";
  if (["running", "active", "processing"].includes(status)) return "running";
  if (["failed", "error"].includes(status)) return "failed";
  return "waiting";
}
