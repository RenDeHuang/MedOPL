import type { ReactNode } from "react";
import { CheckCircle2, Clock, Server, Shield, AlertCircle, HardDrive, Receipt, XCircle } from "lucide-react";
import {
  Badge,
  Card,
  Progress,
  cn,
} from "./ui/core";

export type ResourceControlState =
  | "loading"
  | "empty"
  | "ready"
  | "blocked"
  | "failed"
  | "pending"
  | "released"
  | "protected";

const stateTone: Record<ResourceControlState, { badge: string; panel: string; label: string }> = {
  loading: {
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    panel: "border-blue-200 bg-blue-50",
    label: "读取中",
  },
  empty: {
    badge: "bg-neutral-100 text-neutral-700 border-neutral-200",
    panel: "border-neutral-200 bg-white",
    label: "待开通",
  },
  ready: {
    badge: "bg-[var(--resource-active-background)] text-[var(--resource-active)] border-green-200",
    panel: "border-green-200 bg-[var(--resource-active-background)]",
    label: "可用",
  },
  blocked: {
    badge: "bg-[var(--billing-warning-background)] text-[var(--billing-warning)] border-amber-200",
    panel: "border-amber-200 bg-[var(--billing-warning-background)]",
    label: "受限",
  },
  failed: {
    badge: "bg-[var(--resource-blocked-background)] text-[var(--resource-blocked)] border-red-200",
    panel: "border-red-200 bg-[var(--resource-blocked-background)]",
    label: "失败",
  },
  pending: {
    badge: "bg-[var(--release-pending-background)] text-[var(--release-pending)] border-blue-200",
    panel: "border-blue-200 bg-[var(--release-pending-background)]",
    label: "处理中",
  },
  released: {
    badge: "bg-neutral-100 text-neutral-700 border-neutral-200",
    panel: "border-neutral-200 bg-neutral-50",
    label: "已释放",
  },
  protected: {
    badge: "bg-[var(--storage-protected-background)] text-[var(--storage-protected)] border-purple-200",
    panel: "border-purple-200 bg-[var(--storage-protected-background)]",
    label: "保护期",
  },
};

function stateIcon(status: ResourceControlState) {
  if (status === "ready") return <CheckCircle2 className="w-4 h-4" />;
  if (status === "pending" || status === "loading") return <Clock className="w-4 h-4" />;
  if (status === "failed") return <XCircle className="w-4 h-4" />;
  if (status === "blocked") return <AlertCircle className="w-4 h-4" />;
  if (status === "protected") return <Shield className="w-4 h-4" />;
  return <Server className="w-4 h-4" />;
}

function StateBadge({ status, label }: { status: ResourceControlState; label?: string }) {
  const tone = stateTone[status];
  return (
    <Badge variant="outline" className={tone.badge}>
      {stateIcon(status)}
      {label || tone.label}
    </Badge>
  );
}

export function ResourceStatusCard({
  status,
  title,
  spec,
  primaryAction,
  receiptState,
  metrics = [],
}: {
  status: ResourceControlState;
  title: string;
  spec: string;
  primaryAction?: ReactNode;
  receiptState: string;
  metrics?: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <Card className={cn("border p-5", stateTone[status].panel)} data-ui-component="ResourceStatusCard">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StateBadge status={status} />
            <Badge variant="outline" className="bg-white text-neutral-700 border-neutral-200">
              {receiptState}
            </Badge>
          </div>
          <h2 className="break-words text-lg font-semibold text-neutral-900">{title}</h2>
          <p className="mt-1 break-words text-sm text-neutral-700">{spec}</p>
        </div>
        {primaryAction && <div className="shrink-0 sm:max-w-xs">{primaryAction}</div>}
      </div>
      {metrics.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-md border border-white/70 bg-white/70 p-3">
              <div className="text-xs text-neutral-600">{metric.label}</div>
              <div className="mt-1 break-words font-semibold text-neutral-900">{metric.value}</div>
              {metric.hint && <div className="mt-1 break-words text-xs text-neutral-500">{metric.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PlanCard({
  planId,
  priceState,
  computeSpec,
  storageSize,
  purchaseState,
  title,
  description,
  taskConcurrency,
  recommended,
  selected,
  action,
}: {
  planId: string;
  priceState: string;
  computeSpec: string;
  storageSize: string;
  purchaseState: ResourceControlState;
  title: string;
  description?: string;
  taskConcurrency: string;
  recommended?: boolean;
  selected?: boolean;
  action?: ReactNode;
}) {
  return (
    <Card
      data-ui-component="PlanCard"
      data-plan-id={planId}
      className={cn(
        "border overflow-hidden transition-colors",
        selected ? "border-neutral-900 shadow-sm" : "border-neutral-200",
      )}
    >
      {recommended && <div className="px-5 py-2 bg-neutral-900 text-white text-xs font-medium">推荐套餐</div>}
      <div className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-neutral-900">{title}</h2>
            {description && <p className="mt-1 break-words text-sm text-neutral-600">{description}</p>}
          </div>
          <StateBadge status={purchaseState} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SpecTile icon={<Server className="w-4 h-4" />} label="计算资源" value={computeSpec} />
          <SpecTile icon={<HardDrive className="w-4 h-4" />} label="存储空间" value={storageSize} />
          <SpecTile icon={<Clock className="w-4 h-4" />} label="并发任务" value={taskConcurrency} />
          <SpecTile icon={<Receipt className="w-4 h-4" />} label="价格状态" value={priceState} />
        </div>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </Card>
  );
}

function SpecTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 p-3">
      <div className="mb-1 flex items-center gap-2 text-sm text-neutral-600">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="break-words font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

export function StorageInventoryPanel({
  status,
  capacity,
  used,
  files,
  retentionState,
  available,
  percent,
}: {
  status: ResourceControlState;
  capacity: string;
  used: string;
  files: string;
  retentionState: string;
  available: string;
  percent: number;
}) {
  return (
    <Card className="border border-neutral-200 p-5" data-ui-component="StorageInventoryPanel">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neutral-600" />
            <h2 className="font-semibold text-neutral-900">存储空间清单</h2>
          </div>
          <p className="text-sm text-neutral-600">输入文件、输出文件和保留期由 MedOPL 存储空间控制。</p>
        </div>
        <StateBadge status={status} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SpecTile icon={<HardDrive className="w-4 h-4" />} label="总容量" value={capacity} />
        <SpecTile icon={<HardDrive className="w-4 h-4" />} label="已使用" value={used} />
        <SpecTile icon={<HardDrive className="w-4 h-4" />} label="可用空间" value={available} />
        <SpecTile icon={<Shield className="w-4 h-4" />} label="文件数量" value={files} />
      </div>
      <div className="mt-4">
        <Progress value={percent} className="h-2" />
        <div className="mt-2 text-xs text-neutral-500">{retentionState}</div>
      </div>
    </Card>
  );
}

export function BillingSummary({
  status,
  balance,
  freeze,
  usage,
  usageLabel = "当前用量",
  auditState,
}: {
  status: ResourceControlState;
  balance: string;
  freeze: string;
  usage: string;
  usageLabel?: string;
  auditState: string;
}) {
  return (
    <Card className="border border-neutral-200 p-5" data-ui-component="BillingSummary">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-neutral-600" />
            <h2 className="font-semibold text-neutral-900">费用与审计摘要</h2>
          </div>
          <p className="text-sm text-neutral-600">余额、冻结金额、用量和审计状态按账户归属核对。</p>
        </div>
        <StateBadge status={status} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SpecTile icon={<Receipt className="w-4 h-4" />} label="余额" value={balance} />
        <SpecTile icon={<AlertCircle className="w-4 h-4" />} label="冻结金额" value={freeze} />
        <SpecTile icon={<Server className="w-4 h-4" />} label={usageLabel} value={usage} />
        <SpecTile icon={<Shield className="w-4 h-4" />} label="审计状态" value={auditState} />
      </div>
    </Card>
  );
}

export function ReadinessChecklist({
  status,
  items,
  primaryAction,
}: {
  status: ResourceControlState;
  items: Array<{ label: string; detail: string; state: ResourceControlState }>;
  primaryAction?: ReactNode;
}) {
  return (
    <Card className="border border-neutral-200 p-5" data-ui-component="ReadinessChecklist">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-neutral-600" />
            <h2 className="font-semibold text-neutral-900">开通就绪核对</h2>
          </div>
          <p className="text-sm text-neutral-600">开通前确认套餐、工作空间、余额和存储空间归属。</p>
        </div>
        <StateBadge status={status} />
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-md border border-neutral-200 p-3">
            <div className={cn("mt-0.5", stateTone[item.state].badge)}>{stateIcon(item.state)}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-neutral-900">{item.label}</div>
              <div className="break-words text-sm text-neutral-600">{item.detail}</div>
            </div>
            <StateBadge status={item.state} />
          </div>
        ))}
      </div>
      {primaryAction && <div className="mt-5">{primaryAction}</div>}
    </Card>
  );
}
