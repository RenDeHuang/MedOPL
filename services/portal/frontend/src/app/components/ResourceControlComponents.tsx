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

const stateTone: Record<ResourceControlState, { badge: string; panel: string; iconPanel: string; label: string }> = {
  loading: {
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    panel: "border-teal-100 bg-white",
    iconPanel: "bg-teal-50 text-teal-700",
    label: "读取中",
  },
  empty: {
    badge: "bg-neutral-100 text-neutral-700 border-neutral-200",
    panel: "border-neutral-200 bg-white",
    iconPanel: "bg-slate-100 text-slate-500",
    label: "待开通",
  },
  ready: {
    badge: "bg-[var(--resource-active-background)] text-[var(--resource-active)] border-green-200",
    panel: "border-green-100 bg-white",
    iconPanel: "bg-emerald-50 text-emerald-700",
    label: "可用",
  },
  blocked: {
    badge: "bg-[var(--billing-warning-background)] text-[var(--billing-warning)] border-amber-200",
    panel: "border-amber-100 bg-white",
    iconPanel: "bg-amber-50 text-amber-700",
    label: "受限",
  },
  failed: {
    badge: "bg-[var(--resource-blocked-background)] text-[var(--resource-blocked)] border-red-200",
    panel: "border-red-100 bg-white",
    iconPanel: "bg-red-50 text-red-700",
    label: "失败",
  },
  pending: {
    badge: "bg-[var(--release-pending-background)] text-[var(--release-pending)] border-teal-200",
    panel: "border-teal-100 bg-white",
    iconPanel: "bg-teal-50 text-teal-700",
    label: "处理中",
  },
  released: {
    badge: "bg-neutral-100 text-neutral-700 border-neutral-200",
    panel: "border-neutral-200 bg-white",
    iconPanel: "bg-slate-100 text-slate-600",
    label: "已释放",
  },
  protected: {
    badge: "bg-[var(--storage-protected-background)] text-[var(--storage-protected)] border-slate-200",
    panel: "border-slate-200 bg-white",
    iconPanel: "bg-slate-100 text-slate-600",
    label: "保护期",
  },
};

function stateIcon(status: ResourceControlState) {
  if (status === "ready") return <CheckCircle2 data-ui-signal="status-icon" aria-hidden="true" className="w-4 h-4" />;
  if (status === "pending" || status === "loading") return <Clock data-ui-signal="status-icon" aria-hidden="true" className="w-4 h-4" />;
  if (status === "failed") return <XCircle data-ui-signal="status-icon" aria-hidden="true" className="w-4 h-4" />;
  if (status === "blocked") return <AlertCircle data-ui-signal="status-icon" aria-hidden="true" className="w-4 h-4" />;
  if (status === "protected") return <Shield data-ui-signal="status-icon" aria-hidden="true" className="w-4 h-4" />;
  return <Server data-ui-signal="status-icon" aria-hidden="true" className="w-4 h-4" />;
}

function stateFeedbackLabel(component: string, status: ResourceControlState, label?: string) {
  return `${component}状态：${label || stateTone[status].label}`;
}

function StateBadge({ status, label }: { status: ResourceControlState; label?: string }) {
  const tone = stateTone[status];
  return (
    <Badge variant="outline" className={tone.badge}>
      {stateIcon(status)}
      <span data-ui-signal="status-label">{label || tone.label}</span>
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
    <Card
      className={cn("border p-5 shadow-sm shadow-slate-200/40", stateTone[status].panel)}
      data-ui-component="ResourceStatusCard"
      data-ui-pattern="state-feedback"
      role="status"
      aria-live="polite"
      aria-label={stateFeedbackLabel(title, status)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", stateTone[status].iconPanel)}>
              {stateIcon(status)}
            </span>
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
            <div key={metric.label} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
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
  density = "default",
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
  density?: "default" | "compact";
}) {
  const isCompact = density === "compact";
  return (
    <Card
      data-ui-component="PlanCard"
      data-ui-pattern="state-feedback"
      data-plan-id={planId}
      data-density={density}
      role="status"
      aria-live="polite"
      aria-label={stateFeedbackLabel(`${title}套餐`, purchaseState)}
      className={cn(
        "border overflow-hidden transition-colors motion-reduce:transition-none",
        selected ? "border-neutral-900 shadow-sm" : "border-neutral-200",
      )}
    >
      {recommended && !isCompact && <div className="bg-neutral-900 px-5 py-2 text-xs font-medium text-white">推荐套餐</div>}
      <div className={cn(isCompact ? "p-4" : "p-5")}>
        <div className={cn("flex items-start justify-between gap-3", isCompact ? "mb-4" : "mb-5")}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-lg font-semibold text-neutral-900">{title}</h2>
              {recommended && isCompact && (
                <Badge variant="outline" className="bg-neutral-900 text-white border-neutral-900">
                  推荐
                </Badge>
              )}
            </div>
            {description && !isCompact && <p className="mt-1 break-words text-sm text-neutral-600">{description}</p>}
          </div>
          <StateBadge status={purchaseState} />
        </div>
        {isCompact ? (
          <div data-ui-pattern="plan-spec-rows" className="grid grid-cols-1 gap-x-5 gap-y-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 sm:grid-cols-2">
            <SpecRow icon={<Server className="w-4 h-4" />} label="计算资源" value={computeSpec} />
            <SpecRow icon={<HardDrive className="w-4 h-4" />} label="存储空间" value={storageSize} />
            <SpecRow icon={<Clock className="w-4 h-4" />} label="并发任务" value={taskConcurrency} />
            <SpecRow icon={<Receipt className="w-4 h-4" />} label="计费规则" value={priceState} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SpecTile icon={<Server className="w-4 h-4" />} label="计算资源" value={computeSpec} />
            <SpecTile icon={<HardDrive className="w-4 h-4" />} label="存储空间" value={storageSize} />
            <SpecTile icon={<Clock className="w-4 h-4" />} label="并发任务" value={taskConcurrency} />
            <SpecTile icon={<Receipt className="w-4 h-4" />} label="计费规则" value={priceState} />
          </div>
        )}
        {action && <div className={cn(isCompact ? "mt-4" : "mt-5")}>{action}</div>}
      </div>
    </Card>
  );
}

function SpecRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div data-ui-pattern="plan-spec-tile" className="min-w-0">
      <div className="mb-0.5 flex items-center gap-2 text-xs text-neutral-500">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="break-words text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function SpecTile({ icon, label, value, compact = false }: { icon: ReactNode; label: string; value: string; compact?: boolean }) {
  return (
    <div data-ui-pattern="plan-spec-tile" className={cn("min-w-0 rounded-md border border-neutral-200", compact ? "p-2.5" : "p-3")}>
      <div className={cn("flex items-center gap-2 text-neutral-600", compact ? "mb-0.5 text-xs" : "mb-1 text-sm")}>
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
    <Card
      className="border border-neutral-200 p-5"
      data-ui-component="StorageInventoryPanel"
      data-ui-pattern="state-feedback"
      role="status"
      aria-live="polite"
      aria-label={stateFeedbackLabel("存储空间清单", status)}
    >
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
  const fields = [
    { label: "余额", value: balance },
    { label: "冻结", value: freeze },
    { label: usageLabel, value: usage },
    { label: "审计", value: auditState },
  ];
  return (
    <Card
      className="border border-neutral-200 p-5"
      data-ui-component="BillingSummary"
      data-ui-pattern="state-feedback"
      role="status"
      aria-live="polite"
      aria-label={stateFeedbackLabel("费用与审计摘要", status)}
    >
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
      <div data-ui-pattern="billing-ledger-summary" className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 md:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label} data-ui-pattern="billing-ledger-field" className="min-w-0">
            <div className="text-xs text-neutral-500">{field.label}</div>
            <div className="mt-1 break-words text-base font-semibold text-neutral-900">{field.value}</div>
          </div>
        ))}
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
    <Card
      className="border border-neutral-200 p-5"
      data-ui-component="ReadinessChecklist"
      data-ui-pattern="state-feedback"
      role="status"
      aria-live="polite"
      aria-label={stateFeedbackLabel("开通就绪核对", status)}
    >
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
