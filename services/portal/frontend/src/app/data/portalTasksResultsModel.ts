import { fetchOplArtifact } from "../../api/portal/opl";
import { fetchSessionTraces } from "../../api/portal/traces";
import { dateText, money, stringValue } from "./portalFormatters";
import { currentLaunchId } from "./portalLaunchContext";
import { PortalDisplayError } from "./portalDisplayErrors";
import { usePortalQuery } from "./portalQuery";
import { taskStatus } from "./portalTaskStatus";

export interface TaskItem {
  id: string;
  name: string;
  workspace: string;
  status: "running" | "completed" | "failed" | "waiting";
  startTime: string;
  duration: string;
  cost: string;
  outputFiles: number;
  outputFileNames?: string[];
  resourceUsage: string;
  runtimeTraceStatus?: string;
  artifactTraceStatus?: string;
  artifactRef?: string;
  outputFileRef?: string;
  launchId?: string;
  artifactActionEnabled?: boolean;
  artifactActionMessage?: string;
}

export interface OplArtifactView {
  artifactRef: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  kind: string;
}

export async function loadTasksResultsModel() {
  const traces = await fetchSessionTraces();
  const launchId = currentLaunchId();
  return {
    launchId,
    workspaceOptions: Array.from(new Set(traces.items.map((item) => item.workspaceId).filter(Boolean))),
    tasks: traces.items.map<TaskItem>((item) => {
      const outputFile = (item.linkedOutputFiles || item.outputFiles || item.files?.linkedOutputFiles || [])[0];
      const artifactRef = stringValue(outputFile?.artifactRef, "");
      return {
        id: item.taskRef || item.traceId,
        name: item.title || item.traceName || item.inputPreview || "任务记录",
        workspace: item.workspaceId,
        status: taskStatus(item.businessStatus || item.status),
        startTime: dateText(item.startedAt),
        duration: item.latencyMs ? `${Math.round(item.latencyMs / 1000)} 秒` : "未返回",
        cost: money(item.costEstimate?.amount ?? item.billing?.exactCost ?? item.billing?.pendingCost),
        outputFiles: item.linkedOutputFiles?.length || item.outputFiles?.length || item.files?.linkedOutputCount || 0,
        outputFileNames: (item.linkedOutputFiles || item.outputFiles || []).map((file) => file.name),
        resourceUsage: item.resourceUsage?.status || "运行记录",
        runtimeTraceStatus: item.runtimeTrace?.runStatus,
        artifactTraceStatus: item.runtimeTrace?.artifactStatus,
        artifactRef,
        outputFileRef: stringValue(outputFile?.fileRef, ""),
        launchId,
        artifactActionEnabled: Boolean(launchId && artifactRef),
        artifactActionMessage: launchId
          ? artifactRef ? "" : "当前任务没有可解析的 artifactRef。"
          : "当前页面没有 launchId，不能直接读取 OPL artifact 投影。",
      };
    }),
    async resolveTraceArtifact(task: TaskItem) {
      if (!launchId) {
        throw new PortalDisplayError("当前页面没有 launchId，无法读取 OPL artifact 投影。请先从 Portal 进入 OPL。");
      }
      if (!task.artifactRef) {
        throw new PortalDisplayError("当前任务没有可读取的 artifactRef。");
      }
      const payload = await fetchOplArtifact(launchId, task.artifactRef);
      if (!payload.ok || !payload.artifact) {
        throw new PortalDisplayError(
          payload.error === "artifact_not_observed"
            ? "当前任务的 artifact 尚未回流到 Portal 可见投影。"
            : "当前任务结果暂不可读取，请稍后重试。",
        );
      }
      return {
        artifactRef: payload.artifact.artifactRef,
        name: payload.artifact.name,
        contentType: payload.artifact.contentType,
        sizeBytes: payload.artifact.sizeBytes,
        kind: payload.artifact.kind,
      } satisfies OplArtifactView;
    },
  };
}

export function useTasksResultsModel() {
  return usePortalQuery(loadTasksResultsModel, []);
}
