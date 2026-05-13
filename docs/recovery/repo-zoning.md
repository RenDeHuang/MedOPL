# MedOPL v22 Repo Zoning Ledger

本台账把仓库上下文裁定为四个区：主线真相区、迁移观察区、历史归档区和授权禁区。它先记录裁定，不移动、不删除、不改实现。

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
- Zone 2: Migration Observation Surface. 位于 active surface 或默认上下文附近，但带旧语义、旧入口、旧命名或污染风险；需要逐项裁定为 `rewrite`、`tombstone`、`delete` 或受限 `keep`。
- Zone 3: Historical Archive Surface. 只保留历史证据和迁移参考，不作为新实现入口，不进入默认验证入口。
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

动作默认值：`rewrite` 或 `tombstone`。该区不是删除清单；它是人工复核和专题 cleanup 的候选池。

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
| `services/portal/src/domain/user-owned-resources.mjs` | Zone 2 | tombstone/delete | `user-owned` 只能是 legacy alias，不得作为主路径 | platform-provisioned resources | user-owned-retirement |
| `services/portal/src/routes/user-owned-resource.routes.mjs` | Zone 2 | tombstone/delete | 旧用户自带资源 route 风险 | managed environment / resource binding routes | user-owned-retirement |
| `services/portal/src/state/portal-user-owned-resource-store.mjs` | Zone 2 | tombstone/delete | 旧 user-owned store 风险 | platform-provisioned resource store | user-owned-retirement |
| `services/portal/src/domain/resource-orders.mjs` | Zone 2 | tombstone/rewrite | `resource-order` 不得作为 v22 主产品叙事 | managed environment/resource binding lifecycle | resource-order-retirement |
| `services/portal/src/domain/resource-order-*.mjs` | Zone 2 | tombstone/rewrite | 旧 resource-order domain 家族 | managed environment/resource binding lifecycle | resource-order-retirement |
| `services/portal/src/routes/resource-order*.mjs` | Zone 2 | tombstone/delete | 旧 resource-order public/internal routes | managed environment/resource binding routes | resource-order-retirement |
| `services/portal/src/state/portal-resource-order-store.mjs` | Zone 2 | tombstone/rewrite | 旧 resource-order persistence | managed environment/resource binding persistence | resource-order-retirement |
| `services/portal/src/integrations/resource-provisioner-client.mjs` | Zone 2 | tombstone/delete | 旧 resource-provisioner 不得成为主入口 | cloud-lane authorized provider boundary | resource-order-retirement |
| `services/portal/src/domain/*tencent*` | Zone 2 | review/keep | 云 provider 可作为后端边界，但不得成为普通用户主叙事 | readonly/dry-run/authorized cloud contracts | cloud-lane |
| `services/portal/src/domain/*inventory*` | Zone 2 | review/keep | inventory 可作为后台只读盘点，不得变用户云控制台 | readonly inventory contract | cloud-lane |
| `services/portal/src/domain/*quote*` | Zone 2 | review/keep | quote 可作为 pricing/resource plan 边界，不得变真实开通默认动作 | quote/dry-run contract | cloud-lane |
| `services/portal/src/integrations/langfuse-trace-client.mjs` | Zone 2 | review/rewrite | Langfuse 只能是 sanitized observability attachment | trace metadata boundary | observability-narrative |
| `services/opl-runtime-bridge/src/langfuse-publisher.mjs` | Zone 2 | review/rewrite | Langfuse 不得成为 canonical run/billing source | trace metadata boundary | observability-narrative |
| `services/portal/frontend/**` legacy term hits | Zone 2 | review/rewrite | 前端 active surface 可保留后台技术词，但普通用户主语言不得云控制台化 | Portal Chinese product language | default-entry |
| `services/opl-runtime-bridge/**` legacy term hits | Zone 2 | review/rewrite | Runtime Bridge 可携带兼容字段，但不得伪成功或扩散旧主叙事 | Runtime Bridge contracts | runtime-bridge |

## Zone 3: Historical Archive Surface

动作默认值：`archive`。该区只作历史证据或迁移输入，不作为新实现入口。

| path_or_group | zone | action | reason | replacement | cleanup_slice |
| --- | --- | --- | --- | --- | --- |
| `docs/plan/*` | Zone 3 | archive | 历史计划和路线证据 | v22 contracts/recovery | legacy-docs |
| `docs/reports/*` | Zone 3 | archive | 历史报告证据 | v22 status/recovery | legacy-docs |
| `docs/releases/*` | Zone 3 | archive | 历史 release 证据 | v22 status/recovery | legacy-docs |
| `docs/logs/*` | Zone 3 | archive | 历史日志证据 | v22 recovery docs | legacy-docs |
| `docs/deployment/*` | Zone 3 | archive | 旧部署说明不能成为默认 deploy truth | authorized deploy contracts | legacy-docs |
| `docs/operations/*` | Zone 3 | archive | 旧运维说明不能成为默认 product truth | authorized ops contracts | legacy-docs |
| `docs/superpowers/*` | Zone 3 | archive | 本地计划/技能输出，不是 v22 产品主线合同 | recovery/contracts | legacy-docs |
| `scripts/smoke-test-v19-*` | Zone 3 | archive | v19 smoke 只作历史证据 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/smoke-test-v20*` | Zone 3 | archive | v20 smoke 只作历史证据 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/smoke-test-v21-*` | Zone 3 | archive | v21 smoke 只作历史证据 | `scripts/smoke-test-v22-*` | legacy-scripts |
| `scripts/live-test-*` | Zone 3 | archive | live-test 是高风险历史/授权操作，不是默认验证入口 | authorized canary only | legacy-scripts |
| `scripts/daily-check-v19-*` | Zone 3 | archive | v19 daily check 只作历史证据 | v22 smoke/canary | legacy-scripts |
| `scripts/check-v18-*` | Zone 3 | archive | v18 check 只作历史证据 | v22 smoke | legacy-scripts |
| `scripts/check-v20*` | Zone 3 | archive | v20 check 只作历史证据 | v22 smoke | legacy-scripts |
| `scripts/check-v21-*` | Zone 3 | archive | v21 check 只作历史证据 | v22 smoke | legacy-scripts |
| `scripts/live-prepare-v19-*` | Zone 3 | archive | v19 live prepare 只作历史证据 | authorized canary only | legacy-scripts |
| `OPL-v20-商业化产品套餐开发方案.md` | Zone 3 | archive | v20 商业化历史参考，不作为 v22 默认合同 | v22 product/contracts | legacy-docs |
| `compose.demo.yaml` | Zone 3 | archive | demo compose 不作为 v22 产品默认入口 | explicit v22 local smoke setup | default-entry |
| `compose.langfuse.yaml` | Zone 3 | archive | Langfuse 旧默认叙事不能成为主产品入口 | sanitized observability attachment | observability-narrative |

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
| non-v22 smoke families | Zone 2 | review/rewrite/archive | 无 v22 前缀但仍有用的 smoke 需要迁名或明确 archive。 |
| v19/v20/v21 and live scripts | Zone 3 | archive | 只保留历史证据，不作为默认入口。 |
| deploy/adapters/infra/sentrux | Zone 4 | forbidden_without_authorization | 普通 cleanup 分支不得触碰。 |

default-entry cleanup completed on `cleanup/v22-default-entry-legacy-narrative`: `compose.product.yaml` is a v22 product runtime entry without v19 appliance naming, `user_owned` default mode, legacy runner/provisioner services, or deploy/adapters default wiring.

`.env.demo.template` remains a Zone 2 review/rewrite item because the workflow gate treats `.env*` files as secret-like paths. Its default-entry cleanup requires a separate explicitly authorized branch: `cleanup/v22-env-template-default-entry`.

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
- `archive`: 只保留历史证据，不参与默认上下文。
- `delete`: 无保留价值且无主链依赖。
- `tombstone`: 暂时不能删，只保留 fail-closed 退役壳，不做兼容翻译。
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
