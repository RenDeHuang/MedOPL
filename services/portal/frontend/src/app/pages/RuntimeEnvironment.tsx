import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  AlertCircle,
  Server,
  HardDrive,
  Zap,
  Shield,
  Check,
  Settings,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Slider } from "../components/ui/slider";
import { Progress } from "../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "../components/ui/utils";
import { loadRuntimeEnvironmentModel, usePortalQuery } from "../data/portalAdapters";
import { Link } from "react-router";
import {
  activateCustomLabPackage,
  activateLabPackage,
  type LabCustomPackageSpec,
} from "../../api/portal/lab";

type ServiceStatus = "not_activated" | "active" | "adjusting";

export function RuntimeEnvironment() {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const query = usePortalQuery(loadRuntimeEnvironmentModel, [refreshVersion]);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "standard" | "custom">("standard");
  const [customCpu, setCustomCpu] = useState([8]);
  const [customMemory, setCustomMemory] = useState([16]);
  const [customStorage, setCustomStorage] = useState([100]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activationPending, setActivationPending] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  if (query.status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取运行环境数据...</Card>
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-red-200 bg-red-50 p-6 text-sm text-red-700">{query.error}</Card>
      </div>
    );
  }

  const model = query.data;
  const serviceStatus: ServiceStatus = model.serviceStatus;
  const resourceActionBoundary = "资源调整需要后端确认流程；当前页面只展示已接入的资源状态。";

  const plans = [
    {
      id: "basic" as const,
      name: "基础版",
      cpu: 2,
      memory: 4,
      storage: 10,
      price: 2.5,
      concurrent: 1,
      description: "适合轻量级科研任务",
    },
    {
      id: "standard" as const,
      name: "标准版",
      cpu: 8,
      memory: 16,
      storage: 100,
      price: 5.0,
      concurrent: 3,
      description: "适合常规科研工作",
      recommended: true,
    },
  ];

  const calculateCustomPrice = () => {
    const cpuPrice = customCpu[0] * 0.3;
    const memPrice = customMemory[0] * 0.15;
    const storagePrice = customStorage[0] * 0.01;
    return (cpuPrice + memPrice + storagePrice).toFixed(2);
  };

  const getCurrentPlanConfig = () => {
    if (selectedPlan === "custom") {
      return {
        name: "自定义配置",
        cpu: customCpu[0],
        memory: customMemory[0],
        storage: customStorage[0],
        price: parseFloat(calculateCustomPrice()),
        concurrent: Math.floor(customCpu[0] / 4) || 1,
      };
    }
    return plans.find((p) => p.id === selectedPlan)!;
  };

  const handleOpenConfirmDialog = () => {
    setActivationError(null);
    setShowConfirmDialog(true);
  };

  const getActivationIdempotencyKey = () => `${selectedPlan}-${Date.now()}`;

  const handleConfirmActivation = async () => {
    if (activationPending) return;
    setActivationPending(true);
    setActivationError(null);
    const workspaceId = "default";
    const idempotencyKey = getActivationIdempotencyKey();

    try {
      if (selectedPlan === "custom") {
        const customSpec: LabCustomPackageSpec = {
          computeCores: customCpu[0],
          memoryGb: customMemory[0],
          storageIncludedGb: customStorage[0],
        };
        await activateCustomLabPackage({
          workspaceId,
          customSpec,
          idempotencyKey,
        });
      } else {
        const packageId = selectedPlan === "basic" ? "starter_2c4g_10gb" : "pro_8c16g_100gb";
        await activateLabPackage({
          packageId,
          workspaceId,
          idempotencyKey,
        });
      }
      setShowConfirmDialog(false);
      setRefreshVersion((value) => value + 1);
    } catch {
      setActivationError("开通服务失败，请稍后重试。");
    } finally {
      setActivationPending(false);
    }
  };

  // ==================== 状态 1: 未开通 ====================
  if (serviceStatus === "not_activated") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* 当前服务状态区 - 强调未开通状态 */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">运行环境</h1>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-neutral-100 text-neutral-600 border-neutral-200 text-sm px-3 py-1">
                  未开通
                </Badge>
                <span className="text-neutral-600">
                  开通运行环境后即可使用托管科研工作台
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 套餐选择区 */}
        <div className="mb-6">
          <div className="mb-6">
            <h2 className="font-semibold text-neutral-900 mb-1">选择套餐</h2>
            <p className="text-sm text-neutral-600">根据科研任务需求选择合适的套餐配置</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  "border-2 cursor-pointer transition-all",
                  selectedPlan === plan.id
                    ? "border-neutral-900 shadow-md"
                    : "border-neutral-200 hover:border-neutral-300"
                )}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.recommended && (
                  <div className="px-5 py-2 bg-neutral-900 text-white text-xs font-medium">
                    推荐套餐
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
                      <p className="text-sm text-neutral-600 mt-1">{plan.description}</p>
                    </div>
                    {selectedPlan === plan.id && (
                      <div className="w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="text-3xl font-semibold text-neutral-900">
                      ¥ {plan.price}
                      <span className="text-sm font-normal text-neutral-600"> / 小时</span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      预计 ¥ {(plan.price * 24).toFixed(2)} / 天
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-neutral-700 mb-5">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">计算资源</span>
                      <span className="font-medium">{plan.cpu} 核 {plan.memory} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">文件空间</span>
                      <span className="font-medium">{plan.storage} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">并发任务</span>
                      <span className="font-medium">最多 {plan.concurrent} 个</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    disabled={activationPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenConfirmDialog();
                    }}
                  >
                    {activationPending ? "开通中..." : "开通服务"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* 自定义配置 */}
          <Card
            className={cn(
              "border-2 cursor-pointer transition-all",
              selectedPlan === "custom"
                ? "border-neutral-900 shadow-md"
                : "border-neutral-200 hover:border-neutral-300"
            )}
            onClick={() => setSelectedPlan("custom")}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-neutral-600" />
                    <h3 className="text-lg font-semibold text-neutral-900">自定义配置</h3>
                  </div>
                  <p className="text-sm text-neutral-600 mt-1">根据实际需求自由配置资源规格</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-neutral-900">
                    ¥ {calculateCustomPrice()}
                    <span className="text-sm font-normal text-neutral-600"> / 小时</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    预计 ¥ {(parseFloat(calculateCustomPrice()) * 24).toFixed(2)} / 天
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-neutral-900">CPU 核心</span>
                    <span className="text-sm font-semibold text-neutral-900">{customCpu[0]} 核</span>
                  </div>
                  <Slider
                    value={customCpu}
                    onValueChange={setCustomCpu}
                    min={2}
                    max={32}
                    step={2}
                    disabled={selectedPlan !== "custom"}
                  />
                  <div className="flex justify-between text-xs text-neutral-500 mt-2">
                    <span>2 核</span>
                    <span>32 核</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-neutral-900">内存</span>
                    <span className="text-sm font-semibold text-neutral-900">{customMemory[0]} GB</span>
                  </div>
                  <Slider
                    value={customMemory}
                    onValueChange={setCustomMemory}
                    min={4}
                    max={64}
                    step={4}
                    disabled={selectedPlan !== "custom"}
                  />
                  <div className="flex justify-between text-xs text-neutral-500 mt-2">
                    <span>4 GB</span>
                    <span>64 GB</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-neutral-900">文件空间</span>
                    <span className="text-sm font-semibold text-neutral-900">{customStorage[0]} GB</span>
                  </div>
                  <Slider
                    value={customStorage}
                    onValueChange={setCustomStorage}
                    min={10}
                    max={500}
                    step={10}
                    disabled={selectedPlan !== "custom"}
                  />
                  <div className="flex justify-between text-xs text-neutral-500 mt-2">
                    <span>10 GB</span>
                    <span>500 GB</span>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenConfirmDialog();
                }}
                disabled={activationPending || selectedPlan !== "custom"}
              >
                {activationPending ? "开通中..." : "开通服务"}
              </Button>
            </div>
          </Card>

          <Alert className="mt-6 border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-sm">
              确认开通后将冻结预计费用并开始计费，计算资源和文件空间可独立调整。
            </AlertDescription>
          </Alert>
        </div>

        {/* 开通确认弹窗 */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>确认开通服务</DialogTitle>
              <DialogDescription>
                请确认以下配置信息，开通后将立即开始计费
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {activationError && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 text-sm">
                    {activationError}
                  </AlertDescription>
                </Alert>
              )}
              {/* 当前配置 */}
              <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-neutral-900">当前配置</h3>
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-200">
                    {getCurrentPlanConfig().name}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">计费方式</span>
                    <span className="font-semibold text-neutral-900">
                      ¥ {getCurrentPlanConfig().price.toFixed(2)} / 小时
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">预计费用</span>
                    <span className="font-semibold text-neutral-900">
                      ¥ {(getCurrentPlanConfig().price * 24).toFixed(2)} / 天
                    </span>
                  </div>
                </div>
              </div>

              {/* 计算资源 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-neutral-600" />
                  <h3 className="font-semibold text-neutral-900">计算资源</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-neutral-600 mb-1">CPU 规格</div>
                    <div className="font-semibold text-neutral-900">{getCurrentPlanConfig().cpu} 核</div>
                  </div>
                  <div>
                    <div className="text-neutral-600 mb-1">内存规格</div>
                    <div className="font-semibold text-neutral-900">{getCurrentPlanConfig().memory} GB</div>
                  </div>
                  <div>
                    <div className="text-neutral-600 mb-1">并发能力</div>
                    <div className="font-semibold text-neutral-900">{getCurrentPlanConfig().concurrent} 个任务</div>
                  </div>
                </div>
              </div>

              {/* 文件空间 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="w-4 h-4 text-neutral-600" />
                  <h3 className="font-semibold text-neutral-900">文件空间</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-neutral-600 mb-1">总容量</div>
                    <div className="font-semibold text-neutral-900">{getCurrentPlanConfig().storage} GB</div>
                  </div>
                  <div>
                    <div className="text-neutral-600 mb-1">扩容方式</div>
                    <div className="font-semibold text-neutral-900">独立调整</div>
                  </div>
                  <div>
                    <div className="text-neutral-600 mb-1">文件保留</div>
                    <div className="font-semibold text-neutral-900">随文件空间保留</div>
                  </div>
                </div>
              </div>

              {/* 计费状态 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-neutral-600" />
                    <h3 className="font-semibold text-neutral-900">计费状态</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">预扣金额</span>
                      <span className="font-semibold text-orange-600">
                        ¥ {(getCurrentPlanConfig().price * 24).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">扣费周期</span>
                      <span className="font-semibold text-neutral-900">每 24 小时</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-neutral-600" />
                    <h3 className="font-semibold text-neutral-900">审计状态</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">操作日志</span>
                      <span className="font-semibold text-neutral-900">保留 90 天</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">账单记录</span>
                      <span className="font-semibold text-neutral-900">保留 1 年</span>
                    </div>
                  </div>
                </div>
              </div>

              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900 text-sm">
                  确认开通后将冻结预扣金额 ¥ {(getCurrentPlanConfig().price * 24).toFixed(2)} 并开始计费，审计记录将保留以供查询。
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={activationPending}>
                取消
              </Button>
              <Button onClick={handleConfirmActivation} disabled={activationPending}>
                {activationPending ? "开通中..." : "确认开通"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== 状态 2: 已开通可用 ====================
  if (serviceStatus === "active") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* 1. 当前服务状态区 - 强调可用状态 */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">运行环境</h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md">
                  <div className="w-2 h-2 rounded-full bg-green-600" />
                  <span className="text-sm font-medium text-green-900">可用</span>
                </div>
                <span className="text-neutral-600">
                  计算资源运行正常，可以执行任务
                </span>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link to="/billing">查看计费</Link>
            </Button>
          </div>
        </div>

        {/* 2. 当前配置摘要 - 不是普通卡片 */}
        <div className="mb-8 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-neutral-900">当前配置</h2>
              <Badge variant="outline" className="bg-white text-blue-700 border-blue-200">
                  {model.currentPlanName}
              </Badge>
            </div>
            <div className="text-sm text-neutral-600">
              {model.billingStatus}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-neutral-400" />
              <div>
                <div className="text-xs text-neutral-600">计算资源</div>
                <div className="font-semibold text-neutral-900">{model.computeSpec}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-neutral-400" />
              <div>
                <div className="text-xs text-neutral-600">文件空间</div>
                <div className="font-semibold text-neutral-900">{model.storageTotal}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-neutral-400" />
              <div>
                <div className="text-xs text-neutral-600">并发能力</div>
                <div className="font-semibold text-neutral-900">3 个任务</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-neutral-400" />
              <div>
                <div className="text-xs text-neutral-600">审计模式</div>
                <div className="font-semibold text-neutral-900">标准审计</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 计算资源区 - 明确动作层级 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-neutral-600" />
              <div>
                <h2 className="font-semibold text-neutral-900">计算资源</h2>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                运行中
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled title={resourceActionBoundary}>
                <Plus className="w-4 h-4 mr-1" />
                增加
              </Button>
              <Button variant="outline" size="sm" disabled title={resourceActionBoundary}>
                <Minus className="w-4 h-4 mr-1" />
                减少
              </Button>
            </div>
          </div>

          <Card className="border border-neutral-200">
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-4">
                <div>
                  <div className="text-xs text-neutral-600 mb-1">CPU 规格</div>
                  <div className="text-xl font-semibold text-neutral-900">{model.computeSpec}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600 mb-1">内存规格</div>
                  <div className="text-xl font-semibold text-neutral-900">16 GB</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600 mb-1">运行时长</div>
                  <div className="text-xl font-semibold text-neutral-900">12 天 5 小时</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600 mb-1">累计消耗</div>
                  <div className="text-xl font-semibold text-neutral-900">¥ 1,465.00</div>
                </div>
              </div>
            </div>

            {/* 危险操作区 - 独立分区 */}
            <div className="px-5 py-4 bg-red-50 border-t border-red-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-900 mb-1">
                    释放计算资源
                  </div>
                  <div className="text-xs text-red-700">
                    停止计费并中断任务，文件空间继续保留，不触发保护期
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
                  disabled
                  title="释放计算资源需要后端确认流程；当前入口未接入。"
                >
                  释放
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* 4. 文件空间区 - 明确动作层级 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-neutral-600" />
              <div>
                <h2 className="font-semibold text-neutral-900">文件空间</h2>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                正常
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled title={resourceActionBoundary}>
                <Plus className="w-4 h-4 mr-1" />
                增加
              </Button>
              <Button variant="outline" size="sm" disabled title={resourceActionBoundary}>
                <Minus className="w-4 h-4 mr-1" />
                减少
              </Button>
            </div>
          </div>

          <Card className="border border-neutral-200">
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-4">
                <div>
                  <div className="text-xs text-neutral-600 mb-1">总容量</div>
                  <div className="text-xl font-semibold text-neutral-900">{model.storageTotal}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600 mb-1">已使用</div>
                  <div className="text-xl font-semibold text-neutral-900">{model.storageUsed}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600 mb-1">可用空间</div>
                  <div className="text-xl font-semibold text-neutral-900">{model.storageAvailable}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600 mb-1">使用率</div>
                  <div className="text-xl font-semibold text-neutral-900">{model.storagePercent}%</div>
                </div>
              </div>
              <Progress value={model.storagePercent} className="h-2 mb-4" />
              <div className="text-sm text-neutral-600">
                文件空间独立管理，不受计算资源影响
              </div>
            </div>

            {/* 危险操作区 - 独立分区 */}
            <div className="px-5 py-4 bg-red-50 border-t border-red-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-900 mb-1">
                    删除存储资源
                  </div>
                  <div className="text-xs text-red-700">
                    将触发 7 天保护期，之后删除所有文件且无法恢复
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
                  disabled
                  title="删除存储资源需要后端确认流程；当前入口未接入。"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  删除
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* 5. 计费与审计区 - 简洁展示 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-neutral-600" />
              <div>
                <h2 className="font-semibold text-neutral-900">计费状态</h2>
              </div>
            </div>
            <Card className="border border-neutral-200">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">当前冻结金额</span>
                  <span className="text-lg font-semibold text-orange-600">{model.frozenAmount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">下次冻结时间</span>
                  <span className="font-medium text-neutral-900">18 小时后</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">计费状态</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    正常
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-neutral-600" />
              <div>
                <h2 className="font-semibold text-neutral-900">审计状态</h2>
              </div>
            </div>
            <Card className="border border-neutral-200">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">操作日志</span>
                  <span className="font-medium text-neutral-900">保留 90 天</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">账单记录</span>
                  <span className="font-medium text-neutral-900">保留 1 年</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">审计模式</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    标准审计
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>

      </div>
    );
  }

  // ==================== 状态 3: 资源调整中 ====================
  if (serviceStatus === "adjusting") {
    return (
        <div className="p-8 max-w-7xl mx-auto">
        {/* 1. 当前服务状态区 - 强调调整状态 */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-3">运行环境</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">
                <div className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                <span className="text-sm font-medium text-amber-900">调整中</span>
              </div>
              <span className="text-neutral-600">
                配置变更正在处理，预计 2 分钟完成
              </span>
            </div>
          </div>
          <Button variant="outline" disabled>
            处理中
          </Button>
        </div>
      </div>

      <Alert className="mb-8 border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900 text-sm">
          配置调整期间服务可能暂时不可用，完成后将自动恢复。
        </AlertDescription>
      </Alert>

      {/* 2. 当前配置摘要 - 显示调整状态 */}
      <div className="mb-8 p-6 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-neutral-900">配置调整</h2>
            <Badge variant="outline" className="bg-white text-amber-700 border-amber-300">
              处理中
            </Badge>
          </div>
          <div className="text-sm text-neutral-600">
            ¥ 5.00 → ¥ 9.00 / 小时
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-xs text-neutral-600">计算资源</div>
              <div className="font-semibold text-neutral-900">8 核 16 GB → 16 核 32 GB</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-neutral-400" />
            <div>
              <div className="text-xs text-neutral-600">文件空间</div>
              <div className="font-semibold text-neutral-900">100 GB</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-xs text-neutral-600">并发能力</div>
              <div className="font-semibold text-neutral-900">3 → 6 个任务</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-neutral-400" />
            <div>
              <div className="text-xs text-neutral-600">审计模式</div>
              <div className="font-semibold text-neutral-900">标准审计</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 计算资源区 - 调整中状态 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-neutral-600" />
            <div>
              <h2 className="font-semibold text-neutral-900">计算资源</h2>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              调整中
            </Badge>
          </div>
        </div>

        <Card className="border border-neutral-200">
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-4">
              <div>
                <div className="text-xs text-neutral-600 mb-1">当前规格</div>
                <div className="text-xl font-semibold text-neutral-400">8 核 16 GB</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">目标规格</div>
                <div className="text-xl font-semibold text-amber-700">16 核 32 GB</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">运行时长</div>
                <div className="text-xl font-semibold text-neutral-900">12 天 5 小时</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">累计消耗</div>
                <div className="text-xl font-semibold text-neutral-900">¥ 1,465.00</div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-4 border-t border-neutral-200">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm text-neutral-600">配置调整中，预计 2 分钟完成</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. 文件空间区 - 正常状态 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-neutral-600" />
            <div>
              <h2 className="font-semibold text-neutral-900">文件空间</h2>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              正常
            </Badge>
          </div>
        </div>

        <Card className="border border-neutral-200">
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-4">
              <div>
                <div className="text-xs text-neutral-600 mb-1">总容量</div>
                <div className="text-xl font-semibold text-neutral-900">100 GB</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">已使用</div>
                <div className="text-xl font-semibold text-neutral-900">28.5 GB</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">可用空间</div>
                <div className="text-xl font-semibold text-neutral-900">71.5 GB</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">使用率</div>
                <div className="text-xl font-semibold text-neutral-900">28.5%</div>
              </div>
            </div>
            <Progress value={28.5} className="h-2 mb-4" />
            <div className="text-sm text-neutral-600">
              文件空间不受配置调整影响，可正常访问
            </div>
          </div>
        </Card>
      </div>

      {/* 5. 计费与审计区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-5 h-5 text-neutral-600" />
            <div>
              <h2 className="font-semibold text-neutral-900">计费状态</h2>
            </div>
          </div>
          <Card className="border border-neutral-200">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">当前冻结金额</span>
                <span className="text-lg font-semibold text-orange-600">¥ 120.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">下次冻结金额</span>
                <span className="text-lg font-semibold text-amber-700">¥ 216.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">计费状态</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  调整中
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-neutral-600" />
            <div>
              <h2 className="font-semibold text-neutral-900">审计状态</h2>
            </div>
          </div>
          <Card className="border border-neutral-200">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">操作日志</span>
                <span className="font-medium text-neutral-900">保留 90 天</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">账单记录</span>
                <span className="font-medium text-neutral-900">保留 1 年</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">审计模式</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  标准审计
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>
    );
  }

  // 默认返回未开通状态
  return null;
}
