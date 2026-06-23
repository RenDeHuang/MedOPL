import { useState, useEffect } from "react";
import { Alert, AlertDescription, Badge, Button, Card, Input } from "../components/ui/core";
import { Link } from "react-router";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Server,
  CreditCard,
  RotateCw,
  FolderOpen
} from "lucide-react";
import { bindOplEntryProviderKey, buildOplEntryViewState, useOplEntryModel } from "../data/portalOplEntryModel";

const OPL_GATEWAY_UNAVAILABLE_MESSAGE = "OPL 网关暂不可用，请稍后重试；如持续失败，请联系管理员。";

function statusBadgeClass(status: string) {
  if (status === "failed") return "bg-red-50 text-red-700 border-red-200";
  if (status === "ready" || status === "completed") return "bg-green-50 text-green-700 border-green-200";
  if (status === "preparing" || status === "retrying" || status === "in_progress") return "bg-teal-50 text-teal-700 border-teal-200";
  return "bg-orange-50 text-orange-700 border-orange-200";
}

function statusIcon(status: string) {
  if (status === "ready" || status === "completed") return <CheckCircle2 data-ui-signal="status-icon" aria-hidden="true" className="w-3 h-3" />;
  if (status === "failed") return <AlertCircle data-ui-signal="status-icon" aria-hidden="true" className="w-3 h-3" />;
  if (status === "preparing" || status === "retrying" || status === "in_progress") return <Loader2 data-ui-signal="status-icon" aria-hidden="true" className="w-3 h-3 animate-spin" />;
  return <AlertCircle data-ui-signal="status-icon" aria-hidden="true" className="w-3 h-3" />;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge variant="outline" className={statusBadgeClass(status)}>
      {statusIcon(status)}
      <span data-ui-signal="status-label">{label}</span>
    </Badge>
  );
}

function launchStateLabel(status: string) {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "进行中";
  if (status === "failed") return "失败";
  return "等待中";
}

export function OPLEntry() {
  const query = useOplEntryModel();
  const [countdown, setCountdown] = useState(3);
  const [providerKeyInput, setProviderKeyInput] = useState("");
  const [providerKeySubmitting, setProviderKeySubmitting] = useState(false);
  const [providerKeyError, setProviderKeyError] = useState("");
  const viewState = buildOplEntryViewState(query.status === "ready" ? query.data : {});
  const { pageState, steps } = viewState;

  const handleProviderKeyBind = async () => {
    const apiKey = providerKeyInput.trim();
    if (!apiKey) {
      setProviderKeyError("请输入 gflabtoken 模型调用密钥。");
      return;
    }
    setProviderKeySubmitting(true);
    setProviderKeyError("");
    try {
      await bindOplEntryProviderKey({
        workspaceId: query.status === "ready" ? query.data.workspaceId : undefined,
        apiKey,
      });
      setProviderKeyInput("");
      window.location.reload();
    } catch {
      setProviderKeyError("绑定失败，请确认密钥后重试。");
    } finally {
      setProviderKeySubmitting(false);
    }
  };

  // Ready 状态自动倒计时跳转
  useEffect(() => {
    if (pageState === "ready" && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (pageState === "ready" && countdown === 0) {
      const url = query.status === "ready" ? query.data.oplWebUrl : "";
      if (url) window.location.assign(url);
    }
  }, [pageState, countdown, query]);

  // 区块 1: 启动状态摘要区
  const renderStatusHero = () => {
    if (query.status === "loading") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：准备中">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="preparing" label="准备中" />
            <h2 className="text-2xl font-semibold text-neutral-900">进入 OPL</h2>
          </div>
          <p className="text-neutral-600 mb-4">正在读取 OPL 启动状态和 Portal bootstrap。</p>
        </div>
      );
    }

    if (query.status === "error") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：启动失败">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="failed" label="启动失败" />
            <h2 className="text-2xl font-semibold text-neutral-900">进入 OPL</h2>
          </div>
          <p className="text-neutral-600 mb-4">{query.error || OPL_GATEWAY_UNAVAILABLE_MESSAGE}</p>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/opl" reloadDocument>
                <RotateCw className="w-4 h-4" />
                重试进入 OPL
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "ready") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：即将进入">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="ready" label="即将进入" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            准备完成，{countdown} 秒后自动进入 OPL
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <a href={query.data.oplWebUrl}>
                立即进入 OPL
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/storage">
                <ArrowLeft className="w-4 h-4" />
                返回存储空间
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "preparing") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：准备中">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="preparing" label="准备中" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            {query.data.userVisibleState || "正在准备存储空间和 OPL 会话，准备完成后将自动进入"}
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/storage">
              <ArrowLeft className="w-4 h-4" />
              返回存储空间
            </Link>
          </Button>
        </div>
      );
    }

    if (pageState === "retrying") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：重试中">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="retrying" label="重试中" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            正在重新尝试连接 OPL 网关，请稍候
          </p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/storage">
              <ArrowLeft className="w-4 h-4" />
              返回存储空间
            </Link>
          </Button>
        </div>
      );
    }

    if (pageState === "blocked_by_provider_key") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：启动受限">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="blocked" label="启动受限" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            当前模型调用密钥状态未满足进入条件
          </p>
          <div className="mb-4 max-w-xl">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="password"
                autoComplete="off"
                value={providerKeyInput}
                onChange={(event) => setProviderKeyInput(event.target.value)}
                placeholder="输入 gflabtoken 模型调用密钥"
                aria-label="gflabtoken 模型调用密钥"
              />
              <Button
                type="button"
                className="gap-2 sm:w-40"
                onClick={handleProviderKeyBind}
                disabled={providerKeySubmitting}
              >
                {providerKeySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                绑定后进入 OPL
              </Button>
            </div>
            {providerKeyError && (
              <p className="mt-2 text-sm text-red-700">{providerKeyError}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "blocked_by_runtime") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：启动受限">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="blocked" label="启动受限" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            计算资源尚未准备好，请先开通计算资源
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <Link to="/compute">
                <Server className="w-4 h-4" />
                去计算资源页
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "workspace_required") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：启动受限">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="blocked" label="启动受限" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            存储空间不可用，请先检查存储空间状态
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <Link to="/storage">
                <FolderOpen className="w-4 h-4" />
                去存储空间页
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "balance_insufficient") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：启动受限">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="blocked" label="启动受限" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            当前余额不足或冻结金额不够，请先处理账单状态
          </p>
          <div className="flex gap-3">
            <Button asChild className="gap-2">
              <Link to="/usage">
                <CreditCard className="w-4 h-4" />
                去账单页
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    if (pageState === "service_unavailable") {
      return (
        <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：启动失败">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status="failed" label="启动失败" />
            <h2 className="text-2xl font-semibold text-neutral-900">
              进入 OPL
            </h2>
          </div>
          <p className="text-neutral-600 mb-4">
            {OPL_GATEWAY_UNAVAILABLE_MESSAGE}
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/opl" reloadDocument>
                <RotateCw className="w-4 h-4" />
                重试进入 OPL
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/overview">
                <ArrowLeft className="w-4 h-4" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    // failed 和其他失败状态
    return (
      <div className="mb-8" data-ui-pattern="state-feedback" role="status" aria-live="polite" aria-label="进入 OPL 状态：启动失败">
        <div className="flex items-center gap-3 mb-3">
          <StatusBadge status="failed" label="启动失败" />
          <h2 className="text-2xl font-semibold text-neutral-900">
            进入 OPL
          </h2>
        </div>
        <p className="text-neutral-600 mb-4">
          启动过程遇到问题，请重试或检查相关配置
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/opl" reloadDocument>
              <RotateCw className="w-4 h-4" />
              重试进入 OPL
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/overview">
              <ArrowLeft className="w-4 h-4" />
              返回总览
            </Link>
          </Button>
        </div>
      </div>
    );
  };

  // 区块 2: 阶段进度区
  const renderLaunchSteps = () => {
    return (
      <Card
        className="border border-neutral-200 mb-6"
        data-ui-pattern="state-feedback"
        role="status"
        aria-live="polite"
        aria-label={`启动阶段状态：${steps.map((step) => `${step.label}${launchStateLabel(step.status)}`).join("，")}`}
      >
        <div className="p-5 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">启动阶段</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-4 relative">
                {/* Step Icon */}
                <div className="flex-shrink-0 mt-0.5 relative z-10">
                  {step.status === "completed" && (
                    <CheckCircle2 data-ui-signal="status-icon" aria-hidden="true" className="w-5 h-5 text-green-600" />
                  )}
                  {step.status === "in_progress" && (
                    <Loader2 data-ui-signal="status-icon" aria-hidden="true" className="w-5 h-5 text-teal-700 animate-spin" />
                  )}
                  {step.status === "failed" && (
                    <AlertCircle data-ui-signal="status-icon" aria-hidden="true" className="w-5 h-5 text-red-600" />
                  )}
                  {step.status === "waiting" && (
                    <div data-ui-signal="status-icon" aria-hidden="true" className="w-5 h-5 rounded-full border-2 border-neutral-300" />
                  )}
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute left-[10px] top-[28px] w-0.5 h-8 bg-neutral-200"
                  />
                )}

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`font-medium ${
                        step.status === "completed"
                          ? "text-neutral-900"
                          : step.status === "in_progress"
                          ? "text-teal-700"
                          : step.status === "failed"
                          ? "text-red-700"
                          : "text-neutral-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.status === "completed" && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        <span data-ui-signal="status-label">已完成</span>
                      </Badge>
                    )}
                    {step.status === "in_progress" && (
                      <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                        <span data-ui-signal="status-label">进行中</span>
                      </Badge>
                    )}
                    {step.status === "failed" && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                        <span data-ui-signal="status-label">失败</span>
                      </Badge>
                    )}
                    {step.status === "waiting" && (
                      <Badge variant="outline" className="bg-neutral-50 text-neutral-600 border-neutral-200 text-xs">
                        <span data-ui-signal="status-label">等待中</span>
                      </Badge>
                    )}
                  </div>

                  {/* Additional detail */}
                  {step.detail && (
                    <div
                      className={`text-xs mt-1 ${
                        step.status === "failed" ? "text-red-600" : "text-neutral-500"
                      }`}
                    >
                      {step.id === "key" && step.status !== "failed" && "gflabtoken 模型调用密钥："}
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  };

  // 区块 3: 失败原因与回流操作区（仅在失败或受限时显示）
  const renderFailurePanel = () => {
    if (
      query.status === "loading" ||
      query.status === "error" ||
      pageState === "ready" ||
      pageState === "preparing" ||
      pageState === "retrying"
    ) {
      return null;
    }

    const failurePanel = viewState.failurePanel;
    if (!failurePanel) return null;


    return (
      <Card className="border border-amber-200 bg-amber-50">
        <div className="p-5 border-b border-amber-200 bg-amber-100/50">
          <h2 className="font-semibold text-amber-900">处理建议</h2>
        </div>
        <div className="p-5">
          <p className="text-amber-900 text-sm mb-3">{failurePanel.message}</p>
          {failurePanel.suggestions.length > 0 && (
            <ul className="text-amber-800 text-sm space-y-1.5 list-disc list-inside">
              {failurePanel.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* 区块 1: 启动状态摘要区 */}
      {renderStatusHero()}

      {/* 区块 2: 阶段进度区 */}
      {renderLaunchSteps()}

      {/* 区块 3: 失败原因与回流操作区 */}
      {renderFailurePanel()}

      {/* Ready 状态下的自动跳转提示 */}
      {pageState === "ready" && (
        <Alert className="border-teal-200 bg-teal-50">
          <AlertCircle className="h-4 w-4 text-teal-700" />
          <AlertDescription className="text-teal-900 text-sm">
            准备完成后将自动进入 OPL。您也可以点击上方按钮立即进入。
          </AlertDescription>
        </Alert>
      )}

      {/* Preparing 状态下的轻提示 */}
      {pageState === "preparing" && (
        <Alert className="border-teal-200 bg-teal-50">
          <Loader2 className="h-4 w-4 text-teal-700 animate-spin" />
          <AlertDescription className="text-teal-900 text-sm">
            {query.status === "ready" ? query.data.userVisibleState : "正在准备中，预计需要 1-2 分钟。准备完成后将自动跳转。"}
          </AlertDescription>
        </Alert>
      )}

      {/* Retrying 状态下的提示 */}
      {pageState === "retrying" && (
        <Alert className="border-teal-200 bg-teal-50">
          <Loader2 className="h-4 w-4 text-teal-700 animate-spin" />
          <AlertDescription className="text-teal-900 text-sm">
            正在重新尝试连接，请稍候。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
