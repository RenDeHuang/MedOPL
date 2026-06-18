# MedOPL v22 Docs

Owner: `MedOPL`
Purpose: `docs_taxonomy_index`
State: `active`
Machine boundary: 本文是人读入口。机器验证入口是 `scripts/v22-verify.mjs`；机器 cursor 和 verify manifest 在 `tests/fixtures/v22/goal-current.json` 与 `tests/fixtures/v22/agent-verify-manifest.json`。

本目录采用 OPL-style lifecycle taxonomy，并在 v22 严格版里执行“一目录一 README 真相”。`docs/active/README.md` 是唯一人读 current truth；`docs/specs/README.md` 是合同/spec 的人读索引，durable requirement 和 eval anchor 归 root `specs/**`。和 one-person-lab 一样，`docs/**` 是人读生命周期面；机器真相归 source、tests、fixtures、manifest、runner、root specs 和 API/CLI 行为，不把 Markdown 长计划当稳定机器接口。

## Reading Order

1. [active](./active/README.md): 当前状态、理想目标差距、业务 cursor 和不可宣称事项。
2. [product](./product/README.md): 用户购买什么、Portal/OPL 怎么解释服务、普通用户与管理员边界。
3. [runtime](./runtime/README.md): Portal -> Gateway -> clean OPL upstream -> Runtime Bridge / Runtime Agent 的运行边界。
4. [framework](./framework/README.md): MedOPL Platform Framework 的 owner boundary、surface budget、admission、readiness 和四个 plane。
5. [specs](./specs/README.md): v22 contract/spec 单一真相。
6. [evidence](./evidence/README.md): evidence-after-contract、证据等级、can-claim / cannot-claim 和证据落点。
7. [policies](./policies/README.md): 授权红线、secret hygiene、agent 证据、smoke/eval 和清退纪律。
8. [delivery](./delivery/README.md): 当前 cursor、验证入口、cloud / deploy / release 授权顺序。
9. [source](./source/README.md): active source surface、服务边界、禁止恢复的旧入口。
10. [public](./public/README.md): 对外产品叙事。
11. [references](./references/README.md): 外部参考、upstream 参考和迁移摘要。
12. [history](./history/README.md): agent-run、landing gate、landed 记录、cleanup 记录和 provenance 摘要。
13. [tests](../tests/README.md): repo-local eval taxonomy、fixtures、manifest 和 lifecycle gate。
14. [changes](../changes/README.md): repo-native change lifecycle、proposal、spec delta、eval plan、review、archive 和 closeout。

## Truth Lookup

| Question | Read |
| --- | --- |
| 当前真实状态、gap、cursor、不可宣称事项 | [active](./active/README.md) |
| 用户到底购买什么、Portal/OPL 分工是什么 | [product](./product/README.md) |
| Gateway、clean upstream、Runtime Bridge 和数据回流边界 | [runtime](./runtime/README.md) |
| Platform Framework 的 owner、surface、admission、readiness 和 plane 模型 | [framework](./framework/README.md) |
| 长期合同/spec anchor 和分支订阅包 | [specs](./specs/README.md) |
| smoke/proof/canary/live/production evidence 各自能证明什么 | [evidence](./evidence/README.md) |
| agent 怎么跑、authoring branch / landing gate / parallel lane、secret/cloud/deploy 红线 | [policies](./policies/README.md) |
| 本地怎么验收、怎么交 landing gate、真实云顺序是什么 | [delivery](./delivery/README.md) |
| 哪些源码目录是 active surface、哪些旧语义不得恢复 | [source](./source/README.md) |
| 哪些 run 已 landed、post-merge closeout 是否完成 | [history](./history/README.md) |
| 机器 cursor、verify manifest、eval 分类和 lifecycle gate | [tests](../tests/README.md) |

自治闭环按这个顺序运行：

```text
docs/README -> active truth -> product/runtime/framework -> specs/evidence/policies -> delivery -> tests/fixtures/manifest -> verify -> history closeout -> next cursor
```

正式工程变更使用更严格的 change lifecycle：

```text
active truth -> change package -> spec delta -> eval plan -> implementation -> verify -> review -> archive -> durable specs sync -> history closeout -> next cursor
```

如果任一环节漂移，以 `docs/active/README.md`、`docs/specs/README.md`、root `specs/**`、`tests/fixtures/v22/goal-current.json`、`tests/fixtures/v22/agent-verify-manifest.json` 和 `docs/history/README.md` 的一致性为裁定对象；不能用聊天记录或旧路径补事实。

`changes/README.md` 是 open change 和 archive change 的 repo-native 生命周期入口。它不是 docs taxonomy 的第二套 truth，也不改变 `docs/{active,product,runtime,framework,specs,evidence,policies,delivery,source,public,references,history}/` 一目录一 README 规则。`docs/active/README.md` 可以指向 open change，但不得承载 change package 正文。

Active 文档只保当前 owner、当前状态、下一步 gate 和完成口径。product slide、cleanup tranche 或 framework run 这类执行序列只能作为 open baton 出现在 machine fixture / manifest 中；完成后必须折叠为 `docs/history/README.md` 摘要、closed summary 和 next cursor，不在 active truth 或 per-slide markdown 中永久保留。

## Directory Rule

`docs/{active,product,runtime,framework,specs,evidence,policies,delivery,source,public,references,history}/` 只允许一个 `README.md`。新增第二个 Markdown 文件必须先改本入口和 full-taxonomy cleanup gate，并说明为什么不能吸收到该目录 README。

## Document Portfolio Ledger

每个 docs README 都必须有唯一任务、生命周期和明确的 machine boundary。新增文档不是默认动作；如果内容能吸收到现有 README，就必须吸收进现有 README。只有当信息有独立生命周期、独立 owner、独立 verify boundary，并且无法作为现有 README 的章节维护时，才允许先修改本 ledger 和 gate，再新增 Markdown。

| File | owner purpose | state | allowed content | forbidden content | history handoff |
| --- | --- | --- | --- | --- | --- |
| `docs/active/README.md` | current truth / gap / cursor | active current truth | current facts, gap, current development lines, cannot-claim, next action | run evidence, landing gate detail, second specs, long provenance | landed run details move to `docs/history/README.md` |
| `docs/product/README.md` | product view | hard compacted view | product language, user experience framing, product spec anchor index | current status, implementation proof, cloud execution claims | product line changes summarize in history only after landing gate and post-merge closeout |
| `docs/runtime/README.md` | runtime view | hard compacted view | Gateway / Runtime Bridge / clean upstream boundary and spec anchors | upstream implementation details, canary evidence, deploy proof | runtime discovery evidence stays in `.runtime` or history summary |
| `docs/framework/README.md` | platform framework model | active framework view | owner boundary, surface budget, evidence/admission/readiness model, four-plane map | second current truth, production evidence claims, OPL AI runtime business semantics | framework model changes summarize in history after landing |
| `docs/specs/README.md` | contract/spec index | active spec index | domain spec owners, navigation, package templates, anchor pointers | durable requirements as machine source, agent-run logs, temporary plans, current cursor status | durable contracts live in root `specs/**`; superseded rationale summarizes in history |
| `docs/evidence/README.md` | evidence model | active evidence view | evidence levels, can-claim/cannot-claim, evidence storage and review routing | current truth, product truth, secret material, production claims without production evidence | evidence closeout summarizes in history |
| `docs/policies/README.md` | policy truth | active policy truth | stable workflow, authorization, docs lifecycle, smoke/eval, secret and cleanup policy | current product truth, run proof, implementation detail | policy changes record the landed branch in history |
| `docs/delivery/README.md` | delivery truth | active delivery view | current execution entrypoints, delivery order, cloud/deploy authorization sequence | release claims without authorization, B evidence detail | delivery closeout summarizes in history |
| `docs/source/README.md` | source surface view | hard compacted view | active source surfaces, forbidden surfaces, cleanup source semantics | implementation details better owned by source code or tests | source cleanup record summarizes in history |
| `docs/public/README.md` | public narrative view | hard compacted view | external-facing product wording and claim limits | internal secrets, cloud operations detail, current proof | public narrative updates summarize in history |
| `docs/references/README.md` | reference index | active reference index | external references, upstream links, migration references | current truth, local evidence, implementation plans | cleanup reference notes summarize in history |
| `docs/history/README.md` | evidence index | active history summary | landed runs, landing gate summaries, tombstone map, provenance summaries | product truth, second current state, new specs | no further handoff; detailed proof stays in git history |

## Cleanup Entrypoints

以下旧路径和旧语义不得恢复为 current truth、默认入口、fixture、compat alias 或产品主叙事：

- `docs/contracts/**`
- `docs/recovery/**`
- 旧分散 root docs：`docs/product.md`、`docs/architecture.md`、`docs/status.md`、`docs/invariants.md`、`docs/decisions.md`、`docs/vibe-coding.md`
- `scripts/smoke-test-*` 旧脚本入口和旧 workflow/cloud helper 默认入口
- `user_owned` 主路径、`resource-order` 主路径、旧 `med-autoscience-runner`、旧 `resource-provisioner`
- OpenCost 主叙事、Langfuse 主产品叙事
- v19/v20/v21 OPL direct path、direct upstream path、internal path
- one-person-lab upstream 作为本仓 active source 的写法

历史原因和证据只看 git history 或 `docs/history/README.md` 摘要；当前事实只看本 taxonomy。
