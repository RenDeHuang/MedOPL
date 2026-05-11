export interface PortalUiSurface {
  routeId: string;
  componentId: string;
  question: string;
  states: string[];
  selector: string;
  invariants: string[];
}

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
