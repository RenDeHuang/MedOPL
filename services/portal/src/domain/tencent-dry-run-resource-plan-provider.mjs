function text(value = "") {
  return String(value ?? "").trim();
}

function numberValue(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resourceBindingIdFor(binding = {}) {
  return text(binding.resourceBindingId || binding.id);
}

function publicEstimatedCost(quote = {}) {
  const sourceCost = quote.estimatedCost && typeof quote.estimatedCost === "object" ? quote.estimatedCost : {};
  return {
    amount: numberValue(sourceCost.amount),
    currency: text(sourceCost.currency || "CNY"),
    source: text(sourceCost.source || quote.quoteSource || "contract_snapshot"),
    status: text(sourceCost.status || quote.quoteStatus || "dry_run"),
    billingTruth: false,
    chargeApplied: false,
  };
}

function releasePolicy(binding = {}) {
  return {
    status: text(binding.releasedAt) ? "release_requested" : "not_released",
    releasedAt: text(binding.releasedAt),
    billingStopConfirmBy: text(binding.billingStopConfirmBy),
    stopBillingConfirmWithinMinutes: 120,
    protection: "文件和输出进入保护/审计边界",
  };
}

function auditStatus(binding = {}) {
  return {
    status: text(binding.auditStatus || (text(binding.releasedAt) ? "audit_pending" : "not_started")),
    auditReadyAt: text(binding.auditReadyAt),
    policy: "T+1",
  };
}

function resourceSteps() {
  return [
    "准备托管运行环境",
    "分配文件空间",
    "准备运行网络边界",
    "登记账单和审计边界",
  ];
}

function riskNotes() {
  return [
    "dry-run 只生成不会执行的资源创建计划",
    "真实腾讯云接入必须另开 feat/* 并单独授权",
    "当前不创建、绑定、释放真实资源，不真实扣费",
  ];
}

function dryRunPlanFromQuote({ binding = {}, quote = {} } = {}) {
  const resourceBindingId = resourceBindingIdFor(binding);
  if (!resourceBindingId) {
    throw new Error("resource_binding_required");
  }
  if (!text(quote.regionLabel) || !text(quote.planSpec) || !quote.estimatedCost) {
    throw new Error("readonly_quote_required");
  }
  return {
    resourcePlanId: `dry-run-plan-${resourceBindingId}`,
    resourceBindingId,
    planMode: "dry_run",
    regionLabel: text(quote.regionLabel),
    planSpec: text(quote.planSpec),
    estimatedCost: publicEstimatedCost(quote),
    resourceSteps: resourceSteps(),
    approvalRequired: true,
    releasePolicy: releasePolicy(binding),
    auditStatus: auditStatus(binding),
    riskNotes: riskNotes(),
  };
}

export function createMockTencentDryRunResourcePlanProvider() {
  return Object.freeze({
    name: "mock/tencent-dry-run-resource-plan-provider",
    mode: "dry_run",
    planResourceBinding(input = {}) {
      return dryRunPlanFromQuote({
        binding: input.binding,
        quote: input.quote,
      });
    },
  });
}

export const defaultTencentDryRunResourcePlanProvider = createMockTencentDryRunResourcePlanProvider();

export function planTencentDryRunResourceBinding({
  provider = defaultTencentDryRunResourcePlanProvider,
  binding = {},
  quote = {},
} = {}) {
  if (!provider || typeof provider.planResourceBinding !== "function") {
    throw new Error("dry_run_tencent_resource_plan_provider_required");
  }
  return provider.planResourceBinding({ binding, quote });
}
