import { Link } from "react-router";
import { ArrowRight, CheckCircle2, Cpu, HardDrive, Layers3, Receipt } from "lucide-react";
import { Badge, Button, Card } from "../components/ui/core";
import { usePackagesPurchaseModel } from "../data/portalPackagesPurchaseModel";

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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 pb-8 border-b border-neutral-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h1 className="text-2xl font-semibold text-neutral-900">套餐与购买</h1>
              <Badge variant="outline" className="bg-neutral-100 text-neutral-700 border-neutral-200">
                当前套餐 {model.currentPackageName}
              </Badge>
            </div>
            <p className="text-neutral-600 text-sm max-w-2xl">
              选择给 OPL 使用的计算资源、存储空间和任务并发。这里不展示云控制台配置。
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/resources">
              查看计算资源
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <Card className="border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600 mb-1">我买了什么资源</div>
          <div className="text-xl font-semibold text-neutral-900">{model.currentPackageName}</div>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600 mb-1">资源是否可用</div>
          <div className="text-xl font-semibold text-neutral-900">{model.subscription.status}</div>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600 mb-1">存储空间里有什么</div>
          <div className="text-xl font-semibold text-neutral-900">输入文件 / 输出文件</div>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600 mb-1">费用是多少</div>
          <div className="text-xl font-semibold text-neutral-900">余额 ¥ {model.balance.toFixed(2)}</div>
        </Card>
        <Card className="border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600 mb-1">冻结金额</div>
          <div className="text-xl font-semibold text-neutral-900">¥ {model.frozenAmount.toFixed(2)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {filteredPlans.map((plan) => {
          const current = plan.id === model.currentPackageId;
          return (
            <Card key={plan.id} className="border border-neutral-200 overflow-hidden">
              {plan.recommended && (
                <div className="px-5 py-2 bg-neutral-900 text-white text-xs font-medium">推荐套餐</div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-neutral-900">{plan.name}</h2>
                      {current && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">当前</Badge>}
                    </div>
                    <p className="text-sm text-neutral-600">{plan.description}</p>
                  </div>
                  {current && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
                  <div className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center gap-2 text-neutral-600 mb-1"><Cpu className="w-4 h-4" />计算资源</div>
                    <div className="font-semibold text-neutral-900">{plan.cpu} 核 / {plan.memory} GB</div>
                  </div>
                  <div className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center gap-2 text-neutral-600 mb-1"><HardDrive className="w-4 h-4" />存储空间</div>
                    <div className="font-semibold text-neutral-900">{plan.storage} GB</div>
                  </div>
                  <div className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center gap-2 text-neutral-600 mb-1"><Layers3 className="w-4 h-4" />任务并发</div>
                    <div className="font-semibold text-neutral-900">最多 {plan.concurrent} 个</div>
                  </div>
                  <div className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center gap-2 text-neutral-600 mb-1"><Receipt className="w-4 h-4" />价格</div>
                    <div className="font-semibold text-neutral-900">{plan.priceLabel}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-neutral-500">{plan.openingWindow}</div>
                  <Button asChild variant={current ? "outline" : undefined}>
                    <Link to="/resources">{current ? "查看当前计算资源" : "购买或升级"}</Link>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="border border-blue-200 bg-blue-50 p-5">
        <div className="font-semibold text-blue-900 mb-1">购买后去哪里使用？</div>
        <p className="text-sm text-blue-900">
          购买和开通发生在 MedOPL；聊天、项目、session、skill 上传和科研任务体验回到 OPL。
        </p>
      </Card>
    </div>
  );
}
