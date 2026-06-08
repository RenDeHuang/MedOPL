import { useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, cn, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Progress } from "../components/ui/core";
import { Link } from "react-router";
import { AlertCircle, Check, HardDrive, Server, Shield, Zap } from "lucide-react";
import { activateRuntimeEnvironmentPlan, useRuntimeEnvironmentModel } from "../data/portalRuntimeEnvironmentModel";

type ServiceStatus = "not_activated" | "active";

export function RuntimeEnvironment() {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const query = useRuntimeEnvironmentModel(refreshVersion);
  const [selectedPlan, setSelectedPlan] = useState("pro_8c16g_100gb");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  if (query.status === "loading") return <div className="p-8 max-w-7xl mx-auto"><Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取运行环境数据...</Card></div>;
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

  if (serviceStatus === "not_activated") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-3">运行环境</h1>
          <Badge variant="outline" className="bg-neutral-100 text-neutral-600 border-neutral-200 text-sm px-3 py-1">未开通</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {model.plans.map((plan) => (
            <Card key={plan.id} className={cn("border-2 cursor-pointer transition-all", selectedPlan === plan.id ? "border-neutral-900 shadow-md" : "border-neutral-200 hover:border-neutral-300")} onClick={() => setSelectedPlan(plan.id)}>
              {plan.recommended && <div className="px-5 py-2 bg-neutral-900 text-white text-xs font-medium">推荐套餐</div>}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
                    <p className="text-sm text-neutral-600 mt-1">{plan.description}</p>
                  </div>
                  {selectedPlan === plan.id && <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                </div>
                <div className="mb-4">
                  <div className="text-xl font-semibold text-neutral-900">价格待审批</div>
                  <div className="text-xs text-neutral-500 mt-1">{plan.priceLabel || "正式售价未定价"}</div>
                </div>
                <div className="space-y-2 text-sm text-neutral-700 mb-5">
                  <div className="flex justify-between"><span className="text-neutral-600">计算资源</span><span className="font-medium">{plan.cpu} 核 {plan.memory} GB</span></div>
                  <div className="flex justify-between"><span className="text-neutral-600">文件空间</span><span className="font-medium">{plan.storage} GB</span></div>
                  <div className="flex justify-between"><span className="text-neutral-600">并发任务</span><span className="font-medium">最多 {plan.concurrent} 个</span></div>
                </div>
                <Button className="w-full" disabled={activationPending} onClick={(e) => { e.stopPropagation(); setShowConfirmDialog(true); }}>{activationPending ? "开通中..." : "开通服务"}</Button>
              </div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">当前订阅状态</div>
            <div className="font-semibold text-neutral-900">{model.subscription.status}</div>
          </Card>
          <Card className="border border-neutral-200 p-4">
            <div className="text-xs text-neutral-600 mb-1">实验室权益</div>
            <div className="font-semibold text-neutral-900">{model.entitlement.entitlement.message || "未返回"}</div>
          </Card>
        </div>
        <Alert className="mt-6 border-blue-200 bg-blue-50"><AlertCircle className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-900 text-sm">套餐价格尚待审批，开通后将按已审批合同计费。</AlertDescription></Alert>
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 pb-8 border-b border-neutral-200 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-3">运行环境</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md"><div className="w-2 h-2 rounded-full bg-green-600" /><span className="text-sm font-medium text-green-900">可用</span></div>
            <span className="text-neutral-600">当前页面仅展示状态，不提供资源调整动作。</span>
          </div>
        </div>
        <Button asChild variant="outline"><Link to="/billing">查看计费</Link></Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="border border-neutral-200 p-4">
          <div className="text-xs text-neutral-600 mb-1">当前订阅状态</div>
          <div className="font-semibold text-neutral-900">{model.subscription.status}</div>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <div className="text-xs text-neutral-600 mb-1">实验室权益</div>
          <div className="font-semibold text-neutral-900">{model.entitlement.entitlement.message || "未返回"}</div>
        </Card>
      </div>
      <div className="mb-8 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
        <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><h2 className="font-semibold text-neutral-900">当前配置</h2><Badge variant="outline" className="bg-white text-blue-700 border-blue-200">{model.currentPlanName}</Badge></div><div className="text-sm text-neutral-600">{model.billingStatus}</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="flex items-center gap-3"><Server className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">计算资源</div><div className="font-semibold text-neutral-900">{model.computeSpec}</div></div></div>
          <div className="flex items-center gap-3"><HardDrive className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">文件空间</div><div className="font-semibold text-neutral-900">{model.storageTotal}</div></div></div>
          <div className="flex items-center gap-3"><Zap className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">价格状态</div><div className="font-semibold text-neutral-900">待审批</div></div></div>
          <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-neutral-400" /><div><div className="text-xs text-neutral-600">审计模式</div><div className="font-semibold text-neutral-900">标准审计</div></div></div>
        </div>
      </div>
      <Card className="border border-neutral-200 p-5 mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-neutral-900">释放与停止计费</h2>
            <p className="text-sm text-neutral-600 mt-1">停止计费核对在 120 分钟内完成，文件空间独立保留。</p>
          </div>
          <Badge variant="outline" className="bg-white text-neutral-700 border-neutral-200">T+1 审计</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div><div className="text-xs text-neutral-600 mb-1">释放状态</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.releaseStatus}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">停止计费核对</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.stopBillingStatus}</div><div className="text-xs text-neutral-500 mt-1">{model.releaseLifecycle.stopBillingWindow} / {model.releaseLifecycle.stopBillingConfirmBy}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">审计状态</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.auditStatus}</div><div className="text-xs text-neutral-500 mt-1">{model.releaseLifecycle.auditPolicy} / {model.releaseLifecycle.auditReadyAt}</div></div>
          <div><div className="text-xs text-neutral-600 mb-1">文件空间策略</div><div className="font-semibold text-neutral-900">{model.releaseLifecycle.fileSpacePolicy}</div></div>
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
