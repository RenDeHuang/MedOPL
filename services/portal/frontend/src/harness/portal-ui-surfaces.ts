export interface PortalUiSurface {
  routeId: string;
  componentId: string;
  question: string;
  states: string[];
  selector: string;
  invariants: string[];
}

export interface PortalUiLayout {
  layoutId: string;
  purpose: string;
  slots: string[];
  selector: string;
  invariants: string[];
}

export const portalUiLayouts: PortalUiLayout[] = [
  {
    layoutId: "layout.dashboard_page",
    purpose: "承载页面结论、指标和主要分区，让总览类页面先回答当前状态",
    slots: ["hero", "metrics", "primary", "secondary"],
    selector: '[data-layout-id="layout.dashboard_page"]',
    invariants: ["hero 必须先于指标出现", "页面级状态不得散落在业务组件外"],
  },
  {
    layoutId: "layout.table_page",
    purpose: "承载筛选、列表和分页，让列表类页面保持固定信息顺序",
    slots: ["header", "actions", "filters", "table", "pagination"],
    selector: '[data-layout-id="layout.table_page"]',
    invariants: ["filters 必须先于 table 出现", "pagination 必须独立于 table 内容"],
  },
  {
    layoutId: "layout.detail_page",
    purpose: "承载主详情和辅助信息，让详情类页面避免把所有面板堆在同一层",
    slots: ["primary", "secondary"],
    selector: '[data-layout-id="layout.detail_page"]',
    invariants: ["primary 承载主问题", "secondary 只能承载辅助解释或次级列表"],
  },
];

export const portalUiSurfaces: PortalUiSurface[] = [
  {
    routeId: "overview",
    componentId: "overview.hero",
    question: "用户能否进入 OPL 工作台，以及当前平台定位是什么",
    states: ["loading", "ready", "restricted"],
    selector: '[data-component-id="overview.hero"]',
    invariants: ["主入口必须可见", "工作台状态必须在首屏出现"],
  },
  {
    routeId: "overview",
    componentId: "overview.financial_metrics",
    question: "用户当前余额、冻结金额、消费和任务数量是什么",
    states: ["loading", "ready", "empty"],
    selector: '[data-component-id="overview.financial_metrics"]',
    invariants: ["余额和冻结金额必须拆成独立指标", "累计消费必须独立展示"],
  },
  {
    routeId: "overview",
    componentId: "overview.managed_environment",
    question: "用户的托管运行环境和文件空间是否可用",
    states: ["loading", "ready", "empty"],
    selector: '[data-component-id="overview.managed_environment"]',
    invariants: ["托管运行环境状态必须可见", "文件空间状态必须可见"],
  },
  {
    routeId: "overview",
    componentId: "overview.recent_runs",
    question: "最近任务执行进度是什么",
    states: ["ready", "empty"],
    selector: '[data-component-id="overview.recent_runs"]',
    invariants: ["任务状态必须使用用户可理解文案", "分页动作必须稳定"],
  },
  {
    routeId: "overview",
    componentId: "overview.workspace",
    question: "用户工作空间和最近任务空间是什么",
    states: ["ready", "empty"],
    selector: '[data-component-id="overview.workspace"]',
    invariants: ["工作空间入口必须可见", "内部资源标识不得展示"],
  },
  {
    routeId: "billing",
    componentId: "billing.hero",
    question: "用户当前余额、冻结金额、消费和账单核对状态是什么",
    states: ["loading", "ready", "restricted"],
    selector: '[data-component-id="billing.hero"]',
    invariants: ["余额、可用余额和冻结金额必须拆成独立指标", "导出入口必须保留"],
  },
  {
    routeId: "billing",
    componentId: "billing.cost_breakdown",
    question: "用户的钱花在计算、加速、文件空间和其他服务中的哪一类",
    states: ["ready", "degraded"],
    selector: '[data-component-id="billing.cost_breakdown"]',
    invariants: ["计算消费和文件空间消费必须独立展示", "账单回补状态必须可见"],
  },
  {
    routeId: "billing",
    componentId: "billing.trend_filter",
    question: "用户如何按日期查看账单窗口和成本趋势",
    states: ["loading", "ready", "empty"],
    selector: '[data-component-id="billing.trend_filter"]',
    invariants: ["筛选窗口必须使用日期输入", "趋势为空时必须有空态"],
  },
  {
    routeId: "billing",
    componentId: "billing.workspace_costs",
    question: "各工作空间产生了多少任务和消费",
    states: ["loading", "ready", "empty"],
    selector: '[data-component-id="billing.workspace_costs"]',
    invariants: ["移动端卡片和桌面表格必须同时存在", "工作空间成本分页必须稳定"],
  },
  {
    routeId: "billing",
    componentId: "billing.run_costs",
    question: "单次任务的状态、账单来源和总消费是什么",
    states: ["loading", "ready", "empty"],
    selector: '[data-component-id="billing.run_costs"]',
    invariants: ["任务状态必须使用用户可理解文案", "任务成本分页必须稳定"],
  },
  {
    routeId: "billing",
    componentId: "billing.ledger",
    question: "用户账户流水里有哪些充值、资源扣费、退款和补扣",
    states: ["loading", "ready", "empty"],
    selector: '[data-component-id="billing.ledger"]',
    invariants: ["账户流水必须独立于任务成本展示", "流水分页必须稳定"],
  },
  {
    routeId: "admin.system",
    componentId: "admin.system.site_settings",
    question: "管理员如何配置站点名称、站点 logo、首页内容和注册开关",
    states: ["loading", "ready", "saving", "error"],
    selector: '[data-component-id="admin.system.site_settings"]',
    invariants: ["站点 logo 必须支持预览", "首页内容必须保留代码编辑框"],
  },
  {
    routeId: "admin.system",
    componentId: "admin.system.service_status",
    question: "管理员如何查看 Portal 主链路服务状态",
    states: ["ready", "empty"],
    selector: '[data-component-id="admin.system.service_status"]',
    invariants: ["服务状态必须与站点设置分离", "服务异常数量必须独立展示"],
  },
];

export const portalUiSurfaceSelectors = portalUiSurfaces.map((surface) => surface.selector);
