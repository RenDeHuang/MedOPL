# MedOPL v22 Repo Zoning Ledger

本台账把仓库上下文裁定为四个区：主线真相区、迁移观察区、退役删除区和授权禁区。strict monolith cleanup 下，旧兼容面、旧测试、旧 public 退役壳、旧 deploy/adapters/infra 资产不再因为历史证据留在 active repo。

zero-compat active surface cleanup 进一步收紧：`adapters/*`、`deploy/*`、`infra/*`、live/canary/authorized runner executable surface 不再因为曾被合同或 suite 引用而保留。仍有业务价值的能力必须迁入 `services/portal`、`services/opl-web-gateway`、`services/opl-runtime-bridge` 或 repo-local v22 gate 后，删除旧路径。

## Branch Declaration

- branch: `cleanup/v22-repo-zoning-ledger`
- model: gpt-5.4
- intent: 建立 v22 仓库上下文四区台账，为后续专题 cleanup 提供裁定依据。
- subscribed baseline:
  - `AGENTS.md`
  - `docs/vibe-coding.md`
  - `docs/contracts/README.md`
  - `docs/recovery/mvp-contract-acceptance.md`
  - `docs/recovery/status-matrix.md`
  - `docs/recovery/active-surface.md`
- authorization boundary: 不读 secret，不调用真实云，不运行 live-test，不 build/push，不 kubectl，不修改 `deploy/**`、`.sentrux/**`、`adapters/**` 或 upstream。
- branch non-action: 本分支不删除文件、不移动 scripts、不修改 cloud-lane implementation、不修改 Portal cloud handlers、不修改 MVP suite。

## Zone Definitions

- Zone 1: Mainline Truth Surface. AI 和新人可以默认学习、扩写和验证的 v22 主线表面。
- Zone 2: Migration Observation Surface. 位于 active surface 或默认上下文附近，但带旧语义、旧入口、旧命名或污染风险；需要逐项裁定为 `rewrite`、`delete` 或受限 `keep`。
- Zone 3: Retired Delete Surface. 已被 v22 替代且无 active v22 reason 的旧文件、旧脚本、旧 public shell、旧 deploy/adapters/infra 资产；进入 strict cleanup 删除队列。
- Zone 4: Authorization Forbidden Surface. 没有单独授权不得修改、执行或扩大接入的路径和操作。

## Zone 1: Mainline Truth Surface

动作默认值：`keep`。发现旧叙事时使用 `rewrite`，不把旧语义解释成可继续扩写的主线。

| path_or_group | zone | action | reason | replacement | cleanup_slice |
| --- | --- | --- | --- | --- | --- |
| `README.md` | Zone 1 | keep/rewrite | 仓库默认入口，必须表达 v22 托管科研工作台真相 | v22 product truth | default-entry |
| `AGENTS.md` | Zone 1 | keep | 稳定工作纪律和授权边界入口 | none | none |
| `docs/product.md` | Zone 1 | keep/rewrite | 产品真相入口 | v22 product truth | default-entry |
| `docs/architecture.md` | Zone 1 | keep/rewrite | 架构真相入口 | v22 architecture truth | default-entry |
| `docs/status.md` | Zone 1 | keep | 当前活状态入口 | recovery docs | none |
| `docs/invariants.md` | Zone 1 | keep | 长期红线入口 | v22 invariants | none |
| `docs/decisions.md` | Zone 1 | keep | 当前有效关键决策入口 | v22 decisions | none |
| `docs/vibe-coding.md` | Zone 1 | keep | A/B/C/D、worktree 和合同优先工作流 | v22 workflow truth | none |
| `docs/contracts/README.md` | Zone 1 | keep/rewrite | v22 合同索引 | v22 contract index | default-entry |
| `docs/contracts/v22-*` | Zone 1 | keep/rewrite | v22 合同和边界真相 | relevant v22 contract | per-contract |
| `docs/recovery/*` | Zone 1 | keep/rewrite | 阶段、状态、program board 和恢复裁定 | recovery truth | per-recovery-doc |
| `services/portal/**` | Zone 1 | keep/rewrite | v22 Portal active service | Portal product surface | portal-layering |
| `services/opl-web-gateway/**` | Zone 1 | keep/rewrite | v22 OPL Web Gateway active service | Gateway boundary | gateway |
| `services/opl-runtime-bridge/**` | Zone 1 | keep/rewrite | v22 Runtime Bridge / Adapter active service | Runtime Bridge boundary | runtime-bridge |
| `scripts/smoke-test-v22-*` | Zone 1 | keep/rewrite | v22 本地合同和 smoke 验证入口 | v22 smoke | smoke-governance |
| `.dockerignore` | Zone 1 | keep | 仓库 hygiene | none | none |
| `.gitignore` | Zone 1 | keep | 仓库 hygiene | none | none |

## Zone 2: Migration Observation Surface

动作默认值：`rewrite` 或 `delete`。该区不是保留清单；它是人工复核和专题 cleanup 的候选池。

| path_or_group | zone | action | reason | replacement | cleanup_slice |
| --- | --- | --- | --- | --- | --- |
| `.env.demo.template` | Zone 2 | review/rewrite | 默认环境变量会影响 AI 和新人对主线的理解，且会触发 secret-like path gate | v22 platform-provisioned defaults | cleanup/v22-env-template-default-entry |
| `compose.product.yaml` | Zone 2 | review/rewrite | 默认 product compose 可能携带旧运行叙事 | v22 product runtime entry | default-entry |
| `configs/**` | Zone 2 | review/rewrite | 配置面可能携带旧默认值或真实外部系统暗示 | explicit v22 config | default-entry |
| `scripts/smoke-test-portal-*` | Zone 2 | review/rewrite | 无 v22 前缀，需确认是否仍是当前 Portal 合同入口 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/smoke-test-opl-*` | Zone 2 | review/rewrite | 无 v22 前缀，需确认是否仍是当前 OPL 合同入口 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/smoke-test-billing-*` | Zone 2 | review/rewrite | 无 v22 前缀，需确认是否仍是当前 billing 合同入口 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/smoke-test-resource-*` | Zone 2 | review/rewrite | 无 v22 前缀，需确认是否恢复旧 resource-order 或 provisioner 叙事 | managed environment/resource binding smoke | legacy-scripts |
| `services/portal/src/config/portal-config.mjs` | Zone 2 | rewrite | active config 中存在 legacy runtime mode 风险 | `platform_provisioned` / `customer_dedicated` | default-entry |
| `services/portal/src/routes/user-owned-resource.routes.mjs` | Zone 2 | delete | 旧用户自带资源 route 风险 | managed environment / resource binding routes | user-owned-retirement |
| `services/portal/src/domain/resource-orders.mjs` | Zone 2 | delete/rewrite | `resource-order` 不得作为 v22 主产品叙事 | managed environment/resource binding lifecycle | resource-order-retirement |
| `services/portal/src/domain/resource-order-*.mjs` | Zone 2 | delete/rewrite | 旧 resource-order domain 家族 | managed environment/resource binding lifecycle | resource-order-retirement |
| `services/portal/src/routes/resource-order*.mjs` | Zone 2 | delete | 旧 resource-order public/internal routes | managed environment/resource binding routes | resource-order-retirement |
| `services/portal/src/state/portal-resource-order-store.mjs` | Zone 2 | delete | 旧 resource-order persistence has no active v22 reason after strict monolith Slice E | managed environment/resource binding persistence | resource-order-retirement |
| `services/portal/src/integrations/resource-provisioner-client.mjs` | Zone 2 | delete | 旧 resource-provisioner 不得成为主入口；strict monolith Slice E 已删除该 Portal client wiring | cloud-lane authorized provider boundary | resource-order-retirement |
| `services/portal/src/domain/*tencent*` | Zone 2 | review/keep | 云 provider 可作为后端边界，但不得成为普通用户主叙事 | readonly/dry-run/authorized cloud contracts | cloud-lane |
| `services/portal/src/domain/*inventory*` | Zone 2 | review/keep | inventory 可作为后台只读盘点，不得变用户云控制台 | readonly inventory contract | cloud-lane |
| `services/portal/src/domain/*quote*` | Zone 2 | review/keep | quote 可作为 pricing/resource plan 边界，不得变真实开通默认动作 | quote/dry-run contract | cloud-lane |
| `services/portal/src/integrations/langfuse-trace-client.mjs` | Zone 2 | review/rewrite | Langfuse 只能是 sanitized observability attachment | trace metadata boundary | observability-narrative |
| `services/opl-runtime-bridge/src/langfuse-publisher.mjs` | Zone 2 | review/rewrite | Langfuse 不得成为 canonical run/billing source | trace metadata boundary | observability-narrative |
| `services/portal/frontend/**` legacy term hits | Zone 2 | review/rewrite | 前端 active surface 可保留后台技术词，但普通用户主语言不得云控制台化 | Portal Chinese product language | default-entry |
| `services/opl-runtime-bridge/**` legacy term hits | Zone 2 | review/rewrite | Runtime Bridge 可携带兼容字段，但不得伪成功或扩散旧主叙事 | Runtime Bridge contracts | runtime-bridge |
| `services/opl-runtime-bridge/**` `resourceOrderId` / `resource_order_id` / `user_owned` / `USER_OWNED_*` hits | Zone 2 | deleted | zero-compat 下 Runtime Bridge active code 不得接受、映射、持久化或发布 retired resource-order / user-owned alias；本 cleanup branch 已清退这些 active code hits | `resourceBindingId` / `platform_provisioned` / v22 run stage and error code | zero-compat-runtime-bridge |
| `adapters/billing-aggregator/**` | Zone 4 | deleted | residual adapter 形态不能作为 strict monolith active repo 默认上下文；Slice K 已删除并把账单投影收回 Portal monolith ledger | Portal billing ledger projection | zero-compat-adapters |
| `deploy/local/dockerfiles/**` | Zone 2 | delete | strict monolith local verification 不需要 build/deploy；future deploy 只保留合同边界并需重新授权 | future authorized v22 deploy boundary | zero-compat-deploy |
| `scripts/smoke-test-v22-*live*`, `*canary*`, `*authorized-deploy*`, `*authorized-resource-lifecycle*` | Zone 2 | rewrite/delete | live/canary/authorized runner 不属于默认 active executable surface | contract-only boundary or non-live local v22 gate | zero-compat-live-runner |

## Zone 3: Retired Delete Surface

动作默认值：`delete`。git history 已足够保存历史；旧文件不作为新实现入口，也不作为默认验证入口。

| path_or_group | zone | action | reason | replacement | cleanup_slice |
| --- | --- | --- | --- | --- | --- |
| `docs/plan/*` | Zone 3 | delete-or-migrate | 历史计划和路线证据不进入 active default context | v22 contracts/recovery | legacy-docs |
| `docs/reports/*` | Zone 3 | delete-or-migrate | 历史报告证据不进入 active default context | v22 status/recovery | legacy-docs |
| `docs/releases/*` | Zone 3 | delete-or-migrate | 历史 release 证据不进入 active default context | v22 status/recovery | legacy-docs |
| `docs/logs/*` | Zone 3 | delete-or-migrate | 历史日志证据不进入 active default context | v22 recovery docs | legacy-docs |
| `docs/deployment/*` | Zone 3 | delete-or-migrate | 旧部署说明不能成为默认 deploy truth | authorized deploy contracts | legacy-docs |
| `docs/operations/*` | Zone 3 | delete-or-migrate | 旧运维说明不能成为默认 product truth | authorized ops contracts | legacy-docs |
| `docs/superpowers/*` | Zone 3 | delete-or-migrate | 本地计划/技能输出，不是 v22 产品主线合同 | recovery/contracts | legacy-docs |
| `scripts/smoke-test-v19-*` | Zone 3 | delete | v19 smoke 不是当前验证体系 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/smoke-test-v20*` | Zone 3 | delete | v20 smoke 不是当前验证体系 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/smoke-test-v21-*` | Zone 3 | delete | v21 smoke 不是当前验证体系 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/live-test-*` | Zone 3 | delete | live-test 是高风险历史/授权操作，不是默认验证入口；2026-05-14 用户已授权物理删除仓库内旧 live-test 文件，不授权执行 live-test | v22 local smoke / authorized future canary contract | legacy-scripts |
| `scripts/daily-check-v19-*` | Zone 3 | delete | v19 daily check 不是当前验证体系 | v22 smoke/canary | legacy-scripts |
| `scripts/check-v18-*` | Zone 3 | delete | v18 check 不是当前验证体系 | v22 smoke | legacy-scripts |
| `scripts/check-v20*` | Zone 3 | delete | v20 check 不是当前验证体系 | v22 smoke | legacy-scripts |
| `scripts/check-v21-*` | Zone 3 | delete | v21 check 不是当前验证体系 | v22 smoke | legacy-scripts |
| `scripts/live-prepare-v19-*` | Zone 3 | delete | v19 live prepare 不是当前验证体系 | authorized canary only | legacy-scripts |
| `OPL-v20-商业化产品套餐开发方案.md` | Zone 3 | delete-or-migrate | v20 商业化历史参考不作为 v22 默认合同 | v22 product/contracts | legacy-docs |
| `compose.demo.yaml` | Zone 3 | delete-or-migrate | demo compose 不作为 v22 产品默认入口 | explicit v22 local smoke setup | default-entry |
| `compose.langfuse.yaml` | Zone 3 | delete | Langfuse 旧默认叙事不能成为主产品入口 | sanitized observability attachment | observability-narrative |

## Zone 4: Authorization Forbidden Surface

动作默认值：`forbidden_without_authorization`。这些路径和操作不得由普通 cleanup 分支顺手修改或执行。

| path_or_group | zone | action | reason | replacement | cleanup_slice |
| --- | --- | --- | --- | --- | --- |
| `deploy/**` | Zone 4 | forbidden_without_authorization | deploy 修改必须单独授权 | authorized deploy lane | none |
| `.sentrux/**` | Zone 4 | forbidden_without_authorization | 结构规则修改必须单独授权 | explicit Sentrux task | none |
| `adapters/**` | Zone 4 | forbidden_without_authorization | 旧 adapters 是禁区，不在普通 cleanup 触碰 | authorized adapter task | none |
| `infra/**` | Zone 4 | forbidden_without_authorization | 基础设施修改可能影响真实部署叙事 | authorized infra task | none |
| one-person-lab upstream | Zone 4 | forbidden_without_authorization | upstream 必须保持 clean | Gateway/Adapter/Runtime public boundary | none |
| build/push/kubectl/live-test | Zone 4 | forbidden_without_authorization | 真实外部系统和发布操作必须单独授权 | authorized lane only | none |
| secret files, `.env`, kubeconfig, tokens, SSH private keys | Zone 4 | forbidden_without_authorization | secret hygiene 红线 | backend secret boundary only | none |

## Initial Asset Ledger

本初判按文件组落地，不按全仓逐文件精读。后续 cleanup 分支只从 Zone 2 或 Zone 3 中选择一个专题切片推进。

| asset_group | initial_zone | initial_action | adjudication_note |
| --- | --- | --- | --- |
| v22 truth docs | Zone 1 | keep/rewrite | `README.md`、`docs/product.md`、`docs/architecture.md` 和合同索引必须保持 v22 truth。 |
| v22 recovery docs | Zone 1 | keep/rewrite | 阶段事实写 recovery，不写死在 AGENTS。 |
| active services | Zone 1 | keep/rewrite | Portal/Gateway/Runtime Bridge 是当前 active surface。 |
| v22 smoke | Zone 1 | keep/rewrite | 只允许本地合同/smoke 成为默认验证入口。 |
| legacy naming inside active surface | Zone 2 | review/rewrite/tombstone | 重点复核 `user-owned`、`resource-order`、旧 runner/provisioner、OpenCost/Langfuse 主叙事。 |
| cloud provider terms inside active surface | Zone 2 | review/keep/rewrite | 后端合同可出现 CVM/COS/TKE/K8s，但普通用户主语言不得云控制台化。 |
| non-v22 smoke families | Zone 2 | review/rewrite/delete | 无 v22 前缀但仍有用的 smoke 需要迁名，否则删除。 |
| v19/v20/v21 and live scripts | Zone 3 | delete | 不保留为 active repo 历史证据，不作为默认入口。 |
| deploy/adapters/infra/sentrux | Zone 4 | forbidden_without_authorization | 普通 cleanup 分支不得触碰。 |

default-entry cleanup completed on `cleanup/v22-default-entry-legacy-narrative`: `compose.product.yaml` is a v22 product runtime entry without v19 appliance naming, `user_owned` default mode, legacy runner/provisioner services, or deploy/adapters default wiring.

env-template cleanup completed on `cleanup/v22-env-template-default-entry`: `.env.demo.template` is now a tracked v22 local template for Portal, OPL Web Gateway, Runtime Bridge / Adapter, and clean One Person Lab upstream entry wiring. It no longer carries legacy runner, K8s namespace, resource-provisioner, OpenCost billing truth, Langfuse stack image, `user_owned`, or `resource-order` defaults.

user-owned primary path cleanup completed on `cleanup/v22-retire-user-owned-primary-path`: Portal default runtime is `platform_provisioned`; strict monolith cleanup now deletes remaining legacy `user-owned` route shell, route registration, copy, fixture and test anchors.

user-owned physical-delete completed on `cleanup/v22-physical-legacy-goal`: physical-delete completed: `services/portal/src/domain/user-owned-resources.mjs`; physical-delete completed: `services/portal/src/state/portal-user-owned-resource-store.mjs`; remaining route shell is now a strict delete target.

resource-order route success path first-slice cleanup completed on `cleanup/v22-retire-resource-order-route-tombstones`: old `resource-order` public/internal paths no longer carry success handlers. Strict monolith slice-b deletes the remaining public route shell and runtime registration.

resource-order billing/payload second-slice cleanup completed on `cleanup/v22-retire-resource-order-billing-payloads`: active ledger, user resource binding projection, and Portal page/API payloads now use `resourceBindingId`, `billingAttributionId`, `workspaceId`, `accountId`, and `serverPlanId` as v22 attribution fields. Strict monolith cleanup supersedes the temporary migration alias posture; old resource-order identifiers are not retained as active compatibility fields.

resource-order store/admin/frontend third-slice cleanup completed on `cleanup/v22-retire-resource-order-store-admin-frontend`: active admin payload helpers, admin ops payload, admin overview runtime payload, module source, store health, frontend Portal API types, admin ops view, and frontend harness fixture no longer expose `resource-order` as an active required/default surface. Main attribution fields are `resourceBindingId`, `billingAttributionId`, `workspaceId`, `accountId`, and `serverPlanId`; strict monolith cleanup removes old resource-order identifiers instead of preserving migration aliases. Store schema, Postgres persistence, migrations, seed/migration collection keys, billing/payload semantics, and frontend routes remained outside that slice and were handled by later resource-order cleanup slices.

resource-order store/Postgres/schema characterization gate completed on `cleanup/v22-resource-order-store-postgres-schema-eval-shell`: the old static gate characterized remaining Zone 2 persistence facts as an intermediate step only. Strict monolith cleanup supersedes that shell and deletes the characterization script from active repo.

resource-order store/Postgres/schema implementation completed on `cleanup/v22-resource-order-store-postgres-schema-implementation`: active Portal runtime no longer instantiates or wires resource-order store/Postgres persistence. Strict monolith cleanup now removes `portal-resource-order-store.mjs`, resource-order domain family, schema fragments, snapshot helpers and JSON migration collection keys without executing real DB migration.

strict monolith Slice E completed on `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement`: resource-order store/schema/domain remnants, resource-order Postgres fragments, snapshot helper writers, JSON migration collection keys, the old characterization gate, old non-v22 billing/portal smoke anchors, `scripts/start-billing-live.mjs`, and the unused Portal `resource-provisioner-client` runtime wiring are physically retired from active repo. Active Portal persistence keeps resource binding, workspace, billing, audit and trace surfaces only.

residual strict monolith cleanup Phase G completed on `cleanup/v22-strict-monolith-residual-test-anchor-retirement`: remaining non-v22 Portal/Billing smoke anchors, `start-opl-web-runtime.mjs`, MinIO/Harbor local install or port-forward helper remnants, and v22 fixture acceptance of `resourceOrders` / `resourceOrderEvents` are retired. Current Portal/API validation references `scripts/smoke-test-v22-*` and `scripts/v22-verify.mjs` only.

observability/billing primary narrative cleanup completed by `cleanup/v22-cleanup-completion-truth`: `scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs` proves Langfuse is optional sanitized observability attachment, not Portal/billing/artifact/run canonical source, and OpenCost is not the current billing truth. Strict monolith cleanup now deletes old OpenCost/Langfuse compose/deploy/infra assets while retaining active sanitized trace metadata implementation code.

strict monolith Slice D completed on `cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement`: old adapters, old deploy/tke-package, old infra, old compose assets, old runner/provisioner Dockerfiles, old v13 scripts, old portal resource-order/provisioner scripts, old runner fixtures, and old v19/v20 helper libs are physically deleted from active repo. Future real external canary or deploy implementation must use new v22 contracts and active v22 surfaces rather than restoring these paths.

Workflow gate blocker disposition for this slice: `node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk` may still report `secret_like_path_changed` for `.env.demo.template` because the generic workflow gate treats any `.env*` path as fail-closed. This branch is explicitly authorized to modify `.env.demo.template`. `scripts/smoke-test-v22-env-template-default-entry.mjs` performs a content-level secret scan and enforces that all secret-like template values remain empty placeholders.

## Adjudication Rules

每个 Zone 2 候选过五问：

1. 它是否在 active surface。
2. 它是否是默认入口或会被 AI/新人第一眼看到。
3. 它表达 v22 主线真相，还是旧路线真相。
4. 它会不会让 legacy 语义继续扩散。
5. 是否已有 v22 替代物。

动作只能使用：

- `keep`: 主线正确，继续保留。
- `rewrite`: 仍需要，但要改名、改文案、改默认值或改边界。
- `delete`: 无保留价值且无主链依赖。
- `forbidden_without_authorization`: 无单独授权不得触碰。

## Non Goals

- 不在本分支 move scripts。
- 不在本分支 delete files in this branch。
- 不在本分支 modify cloud-lane implementation。
- 不在本分支 modify Portal cloud handlers。
- 不在本分支修改 `scripts/smoke-test-v22-mvp-contract-suite.mjs`。
- 不在本分支 run live-test。
- 不在本分支执行 kubectl。
- 不在本分支执行 build/push。
- 不读取 secret、`.env`、kubeconfig、token 或 SSH private key。
