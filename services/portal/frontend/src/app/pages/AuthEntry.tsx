import { useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import { Badge, Button, Card } from "../components/ui/core";

type AuthMode = "login" | "register";

const readinessItems = [
  "owner 创建或批准 MedOPL 账号",
  "账户余额、套餐和 quota 满足资源开通条件",
  "计算资源、存储空间和账单 receipt 由 Portal 后端确认",
];

const resourceCards = [
  {
    title: "计算资源",
    copy: "按套餐开通专属计算资源，资源状态和释放边界由 MedOPL 账本确认。",
    icon: Server,
  },
  {
    title: "存储空间",
    copy: "输入文件、输出文件和保留期归存储空间管理，释放计算不自动删除存储。",
    icon: HardDrive,
  },
  {
    title: "费用与用量",
    copy: "余额、冻结金额、用量和对账状态在 Portal 内统一展示。",
    icon: CreditCard,
  },
];

const brandPromises = [
  { icon: Server, text: "计算资源按量计费，开通状态由后端确认" },
  { icon: HardDrive, text: "弹性存储，释放计算后数据可按策略保留" },
  { icon: Shield, text: "账号、资源和账单边界 fail closed" },
];

function fieldClasses(hasError: boolean, withAction = false) {
  return [
    "h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-slate-950 shadow-sm shadow-slate-200/60",
    "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40",
    hasError ? "border-red-300" : "border-slate-200",
    withAction ? "pr-11" : "",
  ].join(" ");
}

function AuthInput({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const password = type === "password";
  const renderedType = password && showPassword ? "text" : type;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={renderedType}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClasses(Boolean(error), password)}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {password ? (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden w-[440px] shrink-0 overflow-hidden bg-[#0a4f49] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_85%,rgba(20,184,166,0.18)_0%,transparent_55%),radial-gradient(ellipse_at_85%_15%,rgba(15,118,110,0.25)_0%,transparent_55%)]" />
      <div className="relative z-10">
        <Link to="/login" className="mb-14 inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40" aria-label="MedOPL 登录入口">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-normal">MedOPL</span>
        </Link>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-snug tracking-normal">
            AI 研究资源
            <br />
            控制面板
          </h1>
          <p className="text-[15px] leading-relaxed text-white/60">
            按需使用算力，弹性存储数据，
            <br />
            专注于你的研究本身。
          </p>
        </div>
      </div>
      <div className="relative z-10 space-y-3">
        {brandPromises.map((item) => (
          <div key={item.text} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/65">
              <item.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm text-white/65">{item.text}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function AuthEntry() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState("");

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (mode === "register" && !name.trim()) nextErrors.name = "请输入姓名";
    if (!email) nextErrors.email = "请输入邮箱";
    else if (!/\S+@\S+\.\S+/.test(email)) nextErrors.email = "邮箱格式不正确";
    if (!password) nextErrors.password = mode === "register" ? "请设置密码" : "请输入密码";
    else if (password.length < 6) nextErrors.password = "密码至少 6 位";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitStatus("");
    if (!validate()) return;
    setSubmitStatus("生产登录接口尚未开放自助密码登录。请使用 owner 提供的 session bootstrap 链接进入；本页面不会伪造会话。");
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrors({});
    setSubmitStatus("");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950" data-page-id="production-auth-entry">
      <div className="flex min-h-screen">
        <BrandPanel />
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:hidden">
            <Link to="/login" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="MedOPL 登录入口">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Zap className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-slate-950">MedOPL</span>
            </Link>
            <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
              生产准入
            </Badge>
          </header>

          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
            <div className="grid w-full max-w-5xl items-start gap-6 xl:grid-cols-[minmax(0,360px)_minmax(340px,1fr)]">
              <div className="mx-auto w-full max-w-[360px] xl:mx-0">
                <div className="mb-8">
                  <Badge variant="outline" className="mb-4 hidden border-teal-200 bg-teal-50 text-teal-700 lg:inline-flex">
                    owner-created-or-approved MedOPL account
                  </Badge>
                  <h2 className="text-2xl font-bold leading-tight tracking-normal text-slate-950">
                    {mode === "login" ? "欢迎回来" : "创建账户"}
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">
                    {mode === "login" ? "登录你的 MedOPL 账户" : "填写信息，等待 owner 完成商业账号准入"}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {mode === "register" ? (
                    <AuthInput id="name" label="姓名" placeholder="你的姓名" value={name} onChange={setName} error={errors.name} />
                  ) : null}
                  <AuthInput id="email" label="邮箱" type="email" placeholder="you@example.com" value={email} onChange={setEmail} error={errors.email} />
                  <div className="space-y-1">
                    <AuthInput id="password" label="密码" type="password" placeholder="至少 6 位" value={password} onChange={setPassword} error={errors.password} />
                    {mode === "login" ? (
                      <div className="flex justify-end pt-0.5">
                        <button type="button" className="min-h-11 rounded-lg px-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                          忘记密码？
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <Button type="submit" size="lg" className="mt-2 w-full">
                    {mode === "login" ? "登录" : "创建账户"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600">
                  {mode === "login" ? "还没有账户？" : "已有账户？"}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === "login" ? "register" : "login")}
                    className="ml-1 min-h-11 rounded-lg px-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {mode === "login" ? "免费注册" : "直接登录"}
                  </button>
                </p>

                <div
                  className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"
                  role="status"
                  aria-label="账号准入状态"
                  data-ui-pattern="state-feedback"
                >
                  <div className="flex items-start gap-2">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" data-ui-signal="status-icon" aria-hidden="true" />
                    <span data-ui-signal="status-label">
                      {submitStatus || "当前浏览器没有有效 MedOPL 会话。请使用 owner 提供的账号开通或 session bootstrap 链接进入。"}
                    </span>
                  </div>
                </div>

                <p className="mt-8 text-center text-xs leading-6 text-slate-400">
                  登录即表示同意服务条款与隐私政策；自助密码登录、外部支付结算和全量生产账号开通仍由后端授权边界控制。
                </p>
              </div>

              <div className="grid gap-4">
                <Card className="border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">上线前准入检查</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">这些条件满足后，Portal 才会显示资源、存储、费用和 OPL 入口。</p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-primary">
                      {mode === "login" ? <KeyRound className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {readinessItems.map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-sm leading-6 text-slate-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3" aria-label="MedOPL 资源控制范围">
                  {resourceCards.map((item) => (
                    <Card key={item.title} className="border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-primary">
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
                    </Card>
                  ))}
                </div>

                <Card className="border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-primary">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-950">进入后路径</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">套餐选择、计算开通、存储上传、费用核对和进入 OPL 都按 journey closeout 验收。</p>
                    </div>
                    <Check className="ml-auto hidden h-4 w-4 text-primary sm:block" aria-hidden="true" />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
