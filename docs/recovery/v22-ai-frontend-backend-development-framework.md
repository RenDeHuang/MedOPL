# v22 AI Frontend Backend Development Framework

This framework constrains future AI-driven cleanup, refactor, and development work. This branch records the framework only; it does not upgrade dependencies and does not modify business code.

## Backend Framework

- backend 当前基线使用 Node 22 ESM，route -> app payload -> domain -> state/persistence。
- Node 24 Active LTS migration readiness 作为 future gap 记录，不在本 harness 分支升级。
- backend 禁止隐式 fallback/shim；不得恢复 user_owned/resource-order/OpenCost/Langfuse 主路径。
- backend eval 必须覆盖 route smoke、payload/domain contract smoke、node --check 或 npm check、workflow gate。
- 每个 backend 改动必须有 route/payload/domain smoke 或 contract eval。
- refactor 必须保持合同行为，先 characterization gate，再移动/拆分代码。
- cleanup 必须先 tombstone/archive/gate，再删除 active dependency。
- development 必须先 contract/eval，再最小实现。
- 禁止用 fallback/shim/adapter 兼容层掩盖旧主路径。

## Frontend Framework

- frontend 当前基线使用 React + Vite + TypeScript + shadcn/Radix + lucide，普通用户 Portal routes 由 Figma Make ZIP implementation leaf 和 surface gate 承接。
- frontend eval 必须覆盖 `npm --prefix services/portal/frontend run typecheck`、`npm --prefix services/portal/frontend run build`、React route/surface gate、desktop/mobile responsive check、loading/empty/error state、table/card usability。
- Admin / Ops Portal UI 是同技术栈 future leaf；当前 Figma Make 文件只覆盖普通用户 Portal routes。
- 每个 frontend 改动必须有 API contract、组件状态、响应式/mobile/table 可用性验证。
- User-facing copy must preserve `开箱即用 SaaS 托管科研工作台`, `不是云资源控制台`, and `不是用户自配云资源`.
- Admin/ops may expose CVM/COS/runtime/resourceBinding/billingAccount/auditTag only as admin/ops facts, not ordinary user language.

## Secret And Security Eval

- secret/security eval 使用 workflow gate 和 changed-files / added-lines diff-scoped secret scan。
- `scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs` provides a reusable local changed-files / added-lines diff-scoped hygiene eval without reading real secret-like paths. The filename intentionally uses `sensitive-hygiene` rather than `secret-hygiene` so path-level fail-closed gates do not classify the eval file itself as a secret-like path.
- 浏览器状态、日志、evidence、git 中不得出现 raw provider key、bearer token、launchToken、runtimeToken、SecretId/SecretKey、kubeconfig 或 private key。
- `raw API Key 只能进入后端密钥边界`.
- Full-repo secret scan is read-only audit only; B absorb uses changed-files / added-lines diff-scoped secret scan.

## OPL Boundary

- OPL Web 必须保持 clean upstream one-person-lab，不修改 upstream 源码，不 import upstream 内部模块。
- `Portal “进入 OPL 工作台”` and `/opl/entry/preflight` remain user-visible entry points.
- `portal.medopl.cn 登录不需要 gflabtoken API Key`.
- `opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key`.
- `API Key 输入框放在 OPL 登录页密码下面`.
- `Portal 可以展示“是否已绑定”状态`.
- `API Key 不是 Portal 普通登录字段`.

## Cloud Lane Boundary

- Cloud lane 必须按 mock -> readonly -> dry-run -> authorized create/release 推进；真实云、secret、build/push/kubectl/live-test 必须单独授权。
- Authorization model: Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps；Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。
- Any secret/live/cloud/kubectl/build/push/deploy step must have a step-local auth record with budget_limit, baseline_requirement, rollback_plan, cleanup_plan, evidence_path, and stop_conditions. auth record 默认写入 .runtime，不进入 git。
- docs/recovery 只写脱敏摘要和 truth writeback，不写 raw secret、kubeconfig、token、SecretId/SecretKey、raw cloud response。
- 没有 auth record 的 risky leaf step 必须停在 deferred_authorized。
- Cloud live baseline / cleanup / minimum spend policy applies to every authorized live step: desired/current baseline 应为 2，且测试后必须回到 2；平台共享 baseline，不得删除或 scale to 0；本 step 创建的测试资源，必须 cleanup/release。
- 开通/创建类 cloud step 必须有 cleanup-first 或 cleanup-after 计划；release/delete 类 cloud step 必须证明只释放本 step 或本用户绑定的资源，不能删除共享节点池、别人的节点、别人的存储或平台服务资源。
- cleanup evidence must include created resources, released resources, remaining resources, baseline after cleanup, active operations count, and billing/reconciliation status.
- minimum spend requires budget_limit, stop_conditions, max_runtime, and cleanup deadline; 不得自动扩容或长时间保留测试资源。
- Owner guard: 任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。
- 不改 deploy/adapters/.sentrux/.env.demo.template.
- 不跑 live-test.
- 不读 secret.
- 不 build/push/kubectl.
- 不改 upstream one-person-lab.
- 不升级依赖.

## Work Type Coverage

- cleanup: remove or tombstone legacy meaning after gate proves the replacement truth.
- refactor: preserve contract behavior through characterization gates.
- development: start with contract/eval, then minimum implementation.

## A/B/C Window Responsibilities

- A：执行 8-step goal loop，写 gate/eval，做最小实现，提交。
- B：审计 diff、复跑验证、执行 changed-files / added-lines diff-scoped secret scan，无 blocker 时 ff-only absorb 并 push。
- C：只做只读审计或明确不冲突的小片段；合并前必须 rebase 最新 trunk 并交 B。

## Validation Commands

- `node scripts/smoke-test-v22-product-goal-harness.mjs`
- `node scripts/smoke-test-v22-default-entry-narrative-gate.mjs`
- `node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs`
- `node scripts/smoke-test-v22-mvp-contract-suite.mjs`
- `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk`
- `git diff --check -- docs/recovery scripts`
