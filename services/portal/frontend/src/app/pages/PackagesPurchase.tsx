import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Badge, Button, Card } from "../components/ui/core";
import { usePackagesPurchaseModel } from "../data/portalPackagesPurchaseModel";
import { BillingSummary, PlanCard } from "../components/ResourceControlComponents";

export function PackagesPurchase() {
  const query = usePackagesPurchaseModel();

  if (query.status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取套餐与购买数据...</Card>
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
  const filteredPlans = model.plans;

  return (
    <div data-ui-template="commercial-launch-packages" className="p-5 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6 pb-6 border-b border-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-2xl font-semibold text-neutral-900">套餐与购买</h2>
              <Badge variant="outline" className="bg-neutral-100 text-neutral-700 border-neutral-200">
                当前套餐 {model.currentPackageName}
              </Badge>
            </div>
            <p className="text-neutral-600 text-sm max-w-2xl">
              选择给 OPL 使用的计算资源、存储空间和并发任务；套餐、余额、冻结金额和 quota 共同决定是否可以开通 runtime/storage。
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/compute">
              查看计算资源
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <Card className="border border-neutral-200 p-4 shadow-sm shadow-slate-200/40">
          <div className="text-sm text-neutral-600 mb-1">我买了什么资源</div>
          <div className="text-xl font-semibold text-neutral-900">{model.currentPackageName}</div>
        </Card>
        <Card className="border border-neutral-200 p-4 shadow-sm shadow-slate-200/40">
          <div className="text-sm text-neutral-600 mb-1">资源是否可用</div>
          <div className="text-xl font-semibold text-neutral-900">{model.subscriptionStatusText}</div>
        </Card>
        <Card className="border border-neutral-200 p-4 shadow-sm shadow-slate-200/40">
          <div className="text-sm text-neutral-600 mb-1">存储空间里有什么</div>
          <div className="text-xl font-semibold text-neutral-900">输入文件 / 输出文件</div>
        </Card>
        <Card className="border border-neutral-200 p-4 shadow-sm shadow-slate-200/40">
          <div className="text-sm text-neutral-600 mb-1">费用是多少</div>
          <div className="text-xl font-semibold text-neutral-900">余额 ¥ {model.balance.toFixed(2)}</div>
        </Card>
        <Card className="border border-neutral-200 p-4 shadow-sm shadow-slate-200/40">
          <div className="text-sm text-neutral-600 mb-1">冻结金额</div>
          <div className="text-xl font-semibold text-neutral-900">¥ {model.frozenAmount.toFixed(2)}</div>
        </Card>
      </div>

      <div className="mb-8">
        <BillingSummary
          status={model.balance > model.frozenAmount ? "ready" : "blocked"}
          balance={`¥ ${model.balance.toFixed(2)}`}
          freeze={`¥ ${model.frozenAmount.toFixed(2)}`}
          usage={model.currentPackageName}
          usageLabel="当前套餐"
          auditState={model.subscriptionStatusText}
        />
      </div>

      <Card data-ui-section="commercial-launch-purchase-path" className="border border-neutral-200 p-5 mb-8 shadow-sm shadow-slate-200/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-neutral-900">OPL 任务购买路径</div>
            <div className="mt-1 text-sm text-neutral-600">
              {model.purchaseProjection.taskIntent} / {model.purchaseProjection.requiredPlan} / 可用余额 ¥ {model.purchaseProjection.availableBalance.toFixed(2)}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to={model.purchaseProjection.selectPlanAction.href}>{model.purchaseProjection.selectPlanAction.label}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={model.purchaseProjection.rechargeOrCreditAction.href}>{model.purchaseProjection.rechargeOrCreditAction.label}</Link>
            </Button>
            {model.purchaseProjection.canOpenRuntimeStorage ? (
              <Button asChild>
                <Link to={model.purchaseProjection.openRuntimeStorageAction.href}>{model.purchaseProjection.openRuntimeStorageAction.label}</Link>
              </Button>
            ) : (
              <Button disabled title="可用余额不足，需先充值或申请授信">
                {model.purchaseProjection.openRuntimeStorageAction.label}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to={model.purchaseProjection.returnToOplTaskContract.returnToOplDeeplink}>{model.purchaseProjection.returnToOplAction.label}</Link>
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        {filteredPlans.map((plan) => {
          const current = plan.id === model.currentPackageId;
          return (
            <PlanCard
              key={plan.id}
              planId={plan.id}
              title={plan.name}
              description={plan.description}
              recommended={plan.recommended}
              selected={current}
              priceState={plan.priceLabel}
              computeSpec={`${plan.cpu} 核 / ${plan.memory} GB`}
              storageSize={`${plan.storage} GB`}
              taskConcurrency={`最多 ${plan.concurrent} 个`}
              purchaseState={current ? "ready" : "empty"}
              action={
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-neutral-500">{plan.openingWindow}</div>
                  <Button asChild variant={current ? "outline" : undefined}>
                    <Link to={current ? model.purchaseProjection.openRuntimeStorageAction.href : plan.selectActionHref}>{current ? "查看当前计算资源" : "购买或升级"}</Link>
                  </Button>
                </div>
              }
            />
          );
        })}
      </div>

      <Card className="border border-teal-200 bg-teal-50 p-5">
        <div className="font-semibold text-teal-900 mb-1">购买后去哪里使用？</div>
        <p className="text-sm text-teal-900">
          购买和开通发生在 MedOPL；聊天、项目、session、skill 上传和科研任务体验回到 OPL。
        </p>
      </Card>
    </div>
  );
}
