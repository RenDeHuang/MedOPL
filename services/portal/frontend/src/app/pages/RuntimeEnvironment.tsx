import { useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, cn, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Progress } from "../components/ui/core";
import { Link } from "react-router";
import { AlertCircle, Check, HardDrive, Server, Shield, Zap } from "lucide-react";
import { activateRuntimeEnvironmentPlan, useRuntimeEnvironmentModel } from "../data/portalRuntimeEnvironmentModel";
import {
  PlanCard,
  ReadinessChecklist,
  ResourceStatusCard,
} from "../components/ResourceControlComponents";

type ServiceStatus = "not_opened" | "active";

export function RuntimeEnvironment() {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const query = useRuntimeEnvironmentModel(refreshVersion);
  const [selectedPlan, setSelectedPlan] = useState("pro_8c16g_100gb");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  if (query.status === "loading") return <div className="p-8 max-w-7xl mx-auto"><Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取计算资源数据...</Card></div>;
  if (query.status === "error") return <div className="p-8 max-w-7xl mx-auto"><Card className="border border-red-200 bg-red-50 p-6 text-sm text-red-700">{query.error}</Card></div>;

  const model = query.data;
  const serviceStatus: ServiceStatus = model.serviceStatus;
  const current = model.plans.find((p) => p.id === selectedPlan) || model.plans[0];

  const handleConfirmActivation = async () => {
    if (activationPending) return;
    setActivationPending(true);
    setActivationError(null);
    const workspaceId = typeof model.workspaceId === "string" ? model.workspaceId.trim() : "";
    const idempotencyKey = `${current.id}-${Date.now()}`;
    try {
      const subscriptionId = model.subscription.subscription?.id || "";
      const payload = workspaceId
        ? { packageId: current.id, workspaceId, idempotencyKey, ...(subscriptionId ? { subscriptionId } : {}) }
        : { packageId: current.id, idempotencyKey, ...(subscriptionId ? { subscriptionId } : {}) };
      await activateRuntimeEnvironmentPlan(payload);
      setShowConfirmDialog(false);
      setRefreshVersion((v) => v + 1);
    } catch {
      setActivationError("开通服务失败，请稍后重试。");
    } finally {
      setActivationPending(false);
    }
  };

  if (serviceStatus === "not_opened") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-3">计算资源</h2>
          <Badge variant="outline" className="bg-neutral-100 text-neutral-600 border-neutral-200 text-sm px-3 py-1">未开通</Badge>
          <p className="text-sm text-neutral-600 mt-3">套餐目录由平台维护，不提供云资源调整动作。</p>
        </div>
        <div className="mb-6">
          <ResourceStatusCard
            status="empty"
            title="当前工作空间尚未开通计算环境"
            spec="选择一个 MedOPL 套餐后，平台会为当前工作空间开通计算资源和存储空间。"
            receiptState={model.subscriptionStatusText}
            primaryAction={<Button onClick={() => setShowConfirmDialog(true)}>开通服务</Button>}
            metrics={[
              { label: "工作空间", value: model.workspaceDisplayName },
              { label: "实验室权益", value: model.entitlementMessageText },
              { label: "价格状态", value: "待审批" },
              { label: "存储策略", value: "随套餐开通" },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {model.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              planId={plan.id}
              density="compact"
              title={plan.name}
              description={plan.description}
              selected={selectedPlan === plan.id}
              recommended={plan.recommended}
              priceState={plan.priceLabel || "正式售价未定价"}
              computeSpec={`${plan.cpu} 核 / ${plan.memory} GB`}
              storageSize={`${plan.storage} GB`}
              taskConcurrency={`并发任务最多 ${plan.concurrent} 个`}
              purchaseState={selectedPlan === plan.id ? "ready" : "empty"}
              action={
                <Button className="w-full" disabled={activationPending} onClick={() => { setSelectedPlan(plan.id); setShowConfirmDialog(true); }}>
                  {activationPending ? "开通中..." : selectedPlan === plan.id ? "开通服务" : "选择并开通"}
                </Button>
              }
            />
          ))}
        </div>
        <ReadinessChecklist
          status="pending"
          items={[
            { label: "工作空间归属", detail: model.workspaceDisplayName, state: model.workspaceId ? "ready" : "pending" },
            { label: "套餐选择", detail: current.name, state: "ready" },
            { label: "价格审批", detail: current.priceLabel || "正式售价未定价", state: current.pendingProductApproval ? "pending" : "ready" },
            { label: "计费边界", detail: "开通后按已审批合同计费，真实扣费以后端账本为准。", state: "protected" },
          ]}
          primaryAction={<Button onClick={() => setShowConfirmDialog(true)} disabled={activationPending}>{activationPending ? "开通中..." : "确认开通所选套餐"}</Button>}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">当前订阅状态</div>
            <div className="font-semibold text-neutral-900">{model.subscriptionStatusText}</div>
          </Card>
          <Card className="border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">实验室权益</div>
            <div className="font-semibold text-neutral-900">{model.entitlementMessageText}</div>
          </Card>
        </div>
        <Alert className="mt-6 border-teal-200 bg-teal-50"><AlertCircle className="h-4 w-4 text-teal-700" /><AlertDescription className="text-teal-900 text-sm">套餐价格尚待审批，开通后将按已审批合同计费。</AlertDescription></Alert>
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>确认开通服务</DialogTitle><DialogDescription>请确认配置信息。价格待审批，不展示小时售价。</DialogDescription></DialogHeader>
            <div className="space-y-4 py-2">
              {activationError && <Alert className="border-red-200 bg-red-50"><AlertCircle className="h-4 w-4 text-red-600" /><AlertDescription className="text-red-700 text-sm">{activationError}</AlertDescription></Alert>}
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-neutral-900">当前配置</h3><Badge variant="outline">{current.name}</Badge></div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-neutral-600">价格状态</span><span className="font-semibold text-neutral-900">待审批</span></div>
                  <div className="flex justify-between"><span className="text-neutral-600">正式售价</span><span className="font-semibold text-neutral-900">未定价</span></div>
                </div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={activationPending}>取消</Button><Button onClick={handleConfirmActivation} disabled={activationPending}>{activationPending ? "开通中..." : "确认开通"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const releaseOwnerReadinessReason = "释放能力仍在平台接入中。当前只展示停止计费与存储保留规则，不能声明释放确认交互已完成，存储空间会继续保留。";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900 mb-3">计算资源</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md"><div className="w-2 h-2 rounded-full bg-green-600" /><span className="text-sm font-medium text-green-900">可用</span></div>
            <span className="text-neutral-600">查看当前计算资源是否可用、规格、计费状态和释放状态。</span>
          </div>
          <p className="text-sm text-neutral-600 mt-3">套餐目录由平台维护，不提供云资源调整动作。</p>
        </div>
        <Button asChild variant="outline"><Link to="/billing">查看计费</Link></Button>
      </div>
      <div className="mb-8">
        <ResourceStatusCard
          status="ready"
          title={model.currentPlanName}
          spec={model.computeSpec}
          receiptState={model.billingStatus}
          primaryAction={
            <Button
              variant="outline"
              disabled
              aria-describedby="release-owner-readiness-reason"
              title={releaseOwnerReadinessReason}
            >
              释放交互接入中
            </Button>
          }
          metrics={[
            { label: "存储空间", value: model.storageTotal, hint: `${model.storageUsed} 已用` },
            { label: "可用空间", value: model.storageAvailable },
            { label: "停止计费", value: model.releaseLifecycle.stopBillingStatus, hint: model.releaseLifecycle.stopBillingWindow },
            { label: "审计状态", value: model.releaseLifecycle.auditStatus, hint: model.releaseLifecycle.auditPolicy },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="border border-neutral-200 p-4">
          <div className="text-xs text-neutral-600 mb-1">当前订阅状态</div>
          <div className="font-semibold text-neutral-900">{model.subscriptionStatusText}</div>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <div className="text-xs text-neutral-600 mb-1">实验室权益</div>
          <div className="font-semibold text-neutral-900">{model.entitlementMessageText}</div>
        </Card>
      </div>
      <div className="mb-8 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><h2 className="font-semibold text-neutral-900">当前配置</h2><Badge variant="outline" className="bg-white text-teal-700 border-teal-200">{model.currentPlanName}</Badge></div><div className="text-sm text-neutral-600">{model.billingStatus}</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="flex items-center gap-3"><Server className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">计算资源</div><div className="font-semibold text-neutral-900">{model.computeSpec}</div></div></div>
          <div className="flex items-center gap-3"><HardDrive className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">存储空间</div><div className="font-semibold text-neutral-900">{model.storageTotal}</div></div></div>
          <div className="flex items-center gap-3"><Zap className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">价格状态</div><div className="font-semibold text-neutral-900">待审批</div></div></div>
          <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">审计模式</div><div className="font-semibold text-neutral-900">标准审计</div></div></div>
        </div>
      </div>
      <Card
        className="border border-neutral-200 p-5 mb-8"
        data-release-owner-readiness="partial_fail_closed_pending_owner_receipt"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-neutral-900">释放与停止计费</h2>
            <p id="release-owner-readiness-reason" className="text-sm text-neutral-600 mt-1">{releaseOwnerReadinessReason}</p>
          </div>
          <Badge variant="outline" className="bg-white text-neutral-700 border-neutral-200">接入中 / T+1 审计</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div><div className="text-xs text-neutral-600 mb-1">释放状态</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.releaseStatus}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">停止计费核对</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.stopBillingStatus}</div><div className="text-xs text-neutral-500 mt-1">{model.releaseLifecycle.stopBillingWindow} / {model.releaseLifecycle.stopBillingConfirmBy}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">审计状态</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.auditStatus}</div><div className="text-xs text-neutral-500 mt-1">{model.releaseLifecycle.auditPolicy} / {model.releaseLifecycle.auditReadyAt}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">存储空间策略</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.fileSpacePolicy}</div></div>
        </div>
      </Card>
      <Card className="border border-neutral-200 p-5 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-4">
          <div><div className="text-xs text-neutral-600 mb-1">总容量</div><div className="text-xl font-semibold text-neutral-900">{model.storageTotal}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">已使用</div><div className="text-xl font-semibold text-neutral-900">{model.storageUsed}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">可用空间</div><div className="text-xl font-semibold text-neutral-900">{model.storageAvailable}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">使用率</div><div className="text-xl font-semibold text-neutral-900">{model.storagePercent}%</div></div>
        </div>
        <Progress value={model.storagePercent} className="h-2 mb-2" />
      </Card>
    </div>
  );
}
