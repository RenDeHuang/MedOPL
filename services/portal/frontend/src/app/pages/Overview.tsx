import { Link } from "react-router";
import { ArrowRight, CheckCircle2, FileText, Receipt, Server } from "lucide-react";
import { useOverviewModel } from "../data/portalOverviewModel";
import {
  BillingSummary,
  ReadinessChecklist,
  ResourceStatusCard,
  StorageInventoryPanel,
  type ResourceControlState,
} from "../components/ResourceControlComponents";
import { Badge, Button, Card } from "../components/ui/core";
import { Error } from "./system/Error";

type ServiceStatus = "ready" | "restricted" | "unprovisioned" | "degraded";

function resourceState(status: ServiceStatus): ResourceControlState {
  if (status === "ready") return "ready";
  if (status === "restricted") return "blocked";
  if (status === "degraded") return "failed";
  return "empty";
}

function statusLabel(status: ServiceStatus) {
  if (status === "ready") return "可用";
  if (status === "restricted") return "受限";
  if (status === "degraded") return "异常";
  return "待开通";
}

function overviewHeadline(status: ServiceStatus) {
  if (status === "ready") return "计算资源和存储空间可用";
  if (status === "restricted") return "资源受限，请先处理费用";
  if (status === "degraded") return "资源状态异常，需要查看详情";
  return "选择套餐开通计算资源";
}

function overviewCopy(status: ServiceStatus) {
  if (status === "ready") return "你的 OPL 云端计算资源和存储空间当前状态正常，可以进入 OPL 使用。";
  if (status === "restricted") return "当前余额或冻结金额需要处理。处理后再继续使用计算资源和存储空间。";
  if (status === "degraded") return "资源状态需要排查。先查看计算资源和费用状态，再决定是否进入 OPL。";
  return "开通计算资源和存储空间后，即可回到 OPL 使用云端能力。";
}

function PrimaryOverviewAction({ status }: { status: ServiceStatus }) {
  if (status === "ready") {
    return (
      <Button asChild className="w-full gap-2 sm:w-auto">
        <Link to="/opl">
          进入 OPL
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  if (status === "restricted") {
    return (
      <Button asChild className="w-full gap-2 sm:w-auto">
        <Link to="/usage">
          处理费用
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  if (status === "degraded") {
    return (
      <Button asChild className="w-full gap-2 sm:w-auto">
        <Link to="/compute">
          查看计算资源
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild className="w-full gap-2 sm:w-auto">
      <Link to="/packages">
        选择套餐
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}

export function Overview() {
  const query = useOverviewModel();

  if (query.status === "loading") {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取资源总览数据...</Card>
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <Error description={query.error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const model = query.data;
  const serviceStatus: ServiceStatus = model.serviceStatus;
  const state = resourceState(serviceStatus);
  const computeTitle = serviceStatus === "unprovisioned" ? "计算资源未开通" : model.planName;
  const computeSpec = serviceStatus === "unprovisioned"
    ? "前往套餐与购买页面选择配置，开通后即可进入 OPL。"
    : model.planSpec;
  const storageState: ResourceControlState = serviceStatus === "unprovisioned" ? "empty" : state;
  const billingState: ResourceControlState = serviceStatus === "restricted" ? "blocked" : state;

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-8" data-ui-template="resource-console-overview">
      <div className="mb-6 border-b border-slate-200 pb-6">
        <div data-ui-section="overview-primary-hero" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-neutral-200 bg-neutral-100 text-neutral-700">
                资源总览
              </Badge>
              <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                {statusLabel(serviceStatus)}
              </Badge>
            </div>
            <h2 className="mb-3 text-2xl font-semibold text-neutral-900">{overviewHeadline(serviceStatus)}</h2>
            <p className="max-w-2xl text-sm text-neutral-600">{overviewCopy(serviceStatus)}</p>
            <p className="mt-2 max-w-2xl text-xs text-neutral-500">
              商业路径：账号开通/批准、充值/授信、套餐、计算资源、存储空间和账单核对。
            </p>
          </div>
          <PrimaryOverviewAction status={serviceStatus} />
        </div>
      </div>

      <div data-ui-section="overview-core-resources" className="mb-6">
      <div data-ui-section="commercial-launch-core-cards" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ResourceStatusCard
          status={state}
          title={computeTitle}
          spec={computeSpec}
          receiptState={serviceStatus === "unprovisioned" ? "待开通" : model.pricingStatus}
          primaryAction={
            <Button asChild variant={serviceStatus === "ready" ? "outline" : "default"}>
              <Link to={serviceStatus === "unprovisioned" ? "/packages" : "/compute"}>
                {serviceStatus === "unprovisioned" ? "购买计算资源" : "查看计算资源"}
              </Link>
            </Button>
          }
          metrics={[
            { label: "套餐", value: model.planName },
            { label: "并发任务", value: `${model.concurrent} 个` },
            { label: "状态", value: statusLabel(serviceStatus) },
          ]}
        />

        <StorageInventoryPanel
          status={storageState}
          capacity={model.storageTotal}
          used={model.storageUsed}
          available={model.storageAvailable}
          percent={model.storagePercent}
          files={`${model.inputFiles + model.outputFiles} 个文件`}
          retentionState={serviceStatus === "unprovisioned" ? "开通存储空间后显示输入文件、输出文件和保留期。" : "输入文件和输出文件按存储空间保留策略管理。"}
        />

        <div className="min-w-0">
          <BillingSummary
            status={billingState}
            balance={model.availableBalance}
            freeze={model.frozenAmount}
            usage={model.todayCost}
            usageLabel="费用估算"
            auditState={serviceStatus === "restricted" ? "待处理" : "标准审计"}
          />
        </div>
      </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <ReadinessChecklist
          status={state}
          items={[
            {
              label: "计算资源",
              detail: serviceStatus === "unprovisioned" ? "尚未购买套餐和计算资源。" : `${model.planName} / ${model.planSpec}`,
              state: serviceStatus === "unprovisioned" ? "empty" : state,
            },
            {
              label: "存储空间",
              detail: `${model.storageUsed} / ${model.storageTotal}`,
              state: storageState,
            },
            {
              label: "费用与用量",
              detail: `可用余额 ${model.availableBalance}，冻结金额 ${model.frozenAmount}`,
              state: billingState,
            },
            {
              label: "进入 OPL",
              detail: serviceStatus === "ready" ? "资源条件满足，可以进入 OPL。" : "按缺失步骤处理后再进入 OPL。",
              state: serviceStatus === "ready" ? "ready" : "blocked",
            },
          ]}
          primaryAction={
            <PrimaryOverviewAction status={serviceStatus} />
          }
        />

        <Card className="border border-neutral-200 p-5 shadow-sm shadow-slate-200/40">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-neutral-900">商业化首屏摘要</h2>
              <p className="mt-1 text-sm text-neutral-600">这里只展示资源视角的输入文件和输出文件。</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/storage">查看存储空间</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-slate-50 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-neutral-600">
                <Server className="h-3.5 w-3.5" />
                计算资源
              </div>
              <div className="text-lg font-semibold text-neutral-900">{statusLabel(serviceStatus)}</div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-slate-50 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-neutral-600">
                <Receipt className="h-3.5 w-3.5" />
                账本状态
              </div>
              <div className="text-lg font-semibold text-neutral-900">{serviceStatus === "restricted" ? "待处理" : "标准审计"}</div>
            </div>
            <div className="rounded-md border border-neutral-200 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-neutral-600">
                <FileText className="h-3.5 w-3.5" />
                输入文件
              </div>
              <div className="text-lg font-semibold text-neutral-900">{model.inputFiles} 个</div>
            </div>
            <div className="rounded-md border border-neutral-200 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-neutral-600">
                <FileText className="h-3.5 w-3.5" />
                输出文件
              </div>
              <div className="text-lg font-semibold text-neutral-900">{model.outputFiles} 个</div>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
            科研对话、项目、session 和 skill 上传仍在 OPL；MedOPL 只显示资源、存储和费用。
          </div>
        </Card>
      </div>
    </div>
  );
}
