# MedOPL v22 仓库协作规范

## 适用范围

本文件适用于仓库根目录及其所有子目录；若更深层目录存在 `AGENTS.md`，以更近者为准。

## 定位

- Always respond in 中文。
- `AGENTS.md` 只约束 agent 工作方式、少量稳定身份边界和文档生命周期纪律，不承载项目知识细节、阶段完成判断、产品长叙事、分支 closeout 或临时执行明细。
- `TASTE.md` 记录 MedOPL 维护开发 taste；做架构、代码、文档、测试、review、cleanup 和 closeout 判断时，先按 `TASTE.md` 校准长期偏好，再读取项目事实与更深层规范。
- 项目知识默认从 `README*`、`docs/README.md` 和 docs reading order 读取。当前事实、产品视角、runtime、spec、policy、delivery、source、reference、history 分别归对应 `docs/*/README.md`。
- 机器真相归 source、tests、test lane registry、fixtures、manifest、runner、CLI/API 行为和 runtime evidence；Markdown prose 不作为稳定机器接口。
- 不能根据聊天记录、旧路径、旧分散文档或本文件判断当前阶段。

## 开发原则

- 维护开发判断默认遵循根层 `TASTE.md`；如果本仓事实、spec、runtime evidence 或更深层 `AGENTS.md` 需要局部偏离，必须写清偏离原因和适用范围。
- MedOPL v22 的稳定产品边界是 `platform-provisioned / customer-dedicated` 的 OPL SaaS 托管科研工作台。普通用户购买托管工作台、计算能力、文件空间、任务并发和运行环境；平台负责开通、隔离、计费、审计和释放。
- MedOPL 不是云资源控制台，不把用户自配云资源、旧资源订单或旧 runner/provisioner 路线恢复为主线。
- clean upstream OPL 保持干净。不得修改 upstream 源码，不得在 upstream 目录写 Portal/Gateway/Adapter/Runtime 代码，不得 import upstream 内部模块；只能通过 Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和明确 anti-corruption mapping 适配。
- 理想态优先，不把现状当长期架构。开发文档先设理想态，再写当前差距；差距不是妥协清单，也不是保留旧污染面的理由。
- 目标 topology、owner surface 或 machine truth 已明确后，新增投入默认服务目标态；不得继续深磨旧路线、旧 facade、旧 wrapper、旧兼容入口或旧测试。
- 可以革命式重构并完全抛弃旧模块、旧接口、旧测试、旧目录和旧文案。被当前 owner surface 替代的模块、接口、alias、facade、聚合测试和文档入口，迁移 active caller 后默认直接退役。
- 不以兼容为理由保留历史污染面。确需短期兼容时，必须写明 active caller、owner、退役门、验证入口和最晚清退条件；兼容层不得成为长期架构。
- 旧路线只进 history / tombstone / provenance。active docs、source、tests、fixtures、manifest 和 runner 不得继续把旧路线当当前事实、默认入口或验证 owner。
- 不做降级处理、兜底方案、临时补丁、启发式修补或“先糊住再说”式实现。
- 保持 diff 小、可审查、可回退；能删就别加，能复用现有模式就别新起抽象。
- 长文件是明确拆分信号。repo-tracked source、test、runner 或 fixture 接近 `1000` 行时，必须判断 owner boundary 是否过宽；超过 `1000` 行的新增或继续扩写需要拆分方案或 reviewed baseline，不能继续无解释堆叠。
- 新增能力或修改行为前，先确认 owner surface、machine truth、测试 lane 和验收命令。

## 文档分层与生命周期治理

- 本仓采用 OPL-style lifecycle taxonomy。`README*` 与 `docs/README.md` 是默认人读入口；docs reading order 是当前项目事实的入口索引。
- `docs/**` 是人读生命周期面；source、tests、fixtures、manifest、runner、CLI/API 行为和 runtime evidence 是机器面。
- 每份长期文档都必须能说明 owner、purpose、state 和 machine boundary；缺少任一信号时，先补入口或归位，再继续扩写。
- current truth、active baton、spec、policy、delivery、source、history 各有唯一 owner。新增文档先判断 lifecycle role；能吸收到现有 README 的内容，不新增文件。
- 临时执行 baton 只能作为当前推进载体存在；完成后折叠为 history summary、closed machine state 和 next cursor，不在 `AGENTS.md` 或新目录里变成长期 truth。
- 机器可读合同必须 consumer-first：只有 source、tests、runner、CLI/API 或 runtime evidence 真实消费时才新增 machine-readable contract surface；不要为了目录外形新增空 contract。
- 每次修改都必须把代码清退、文档折叠和验证闭环作为同一交付面处理。新增或替代能力时，必须同时判断旧代码、旧测试、旧 fixture、旧 manifest entry、旧 docs baton 和旧 runner 是否应删除、折叠或 tombstone。
- active baton 只能短期存在。完成后必须折叠为 compact history summary、closed machine cursor 和下一步 owner；不得把完整过程包、gap 流水、run id 细节或历史阶段板长期保留在 active truth、manifest 或 fixture 中。
- 机器 cursor、verify manifest 和 test lane registry 必须保持小而当前。它们只能表达当前入口、当前授权边界、当前验证 bundle 和必要禁区；历史 gap map、完整执行日志和过期 leaf 必须迁出到 history/provenance 或 git history。

## 文档规则

- 文档先设理想态，再写当前差距和验收边界；不能把缺实现和缺证据混成同一类差距。
- `README*`、`docs/**` 与参考文档是人读面。代码、测试、runner 或 workflow 不得把 Markdown 章节、文案或 prose path 当成稳定机器接口。
- 叙述性文档不作为测试断言对象；测试不得锁定 Markdown 文案、章节结构、长段 prose 或 fenced JSON。需要稳定机器判断时，必须下沉到 schema、fixture、manifest、OpenAPI、source contract、runner 行为或 CLI/API 输出。
- 退役定位只出现在 history、tombstone、provenance 或 docs cleanup 语境；active 文档提到旧路线时，必须同时指向当前 truth owner。
- 如果某条规则需要长期冻结，应写入相应 specs、policies、source、tests 或 contract owner，而不是继续堆在 `AGENTS.md`。

## 变更与验证

- 默认工程入口走 `package.json` scripts；底层 runner 可以是 repo-local scripts，但 agent 不应绕过 package scripts 和 test lane registry 发明私有入口。
- 标准闭环是 `authoring branch -> landing gate -> post-merge closeout -> next cursor`；功能开发和清退分支都走同一闭环，具体记录字段以 docs lifecycle owner 和 machine fixtures 为准。
- 默认最小验证入口是 `npm run verify`。
- 默认 test lane 入口是 `npm run test:health`、`npm run test:smoke`、`npm run test:contract` 和 `npm run test:regression`。
- 默认 review gate 是 `npm run gate:review`。
- repo hygiene、repo bloat、line budget、secret hygiene 和 test lane registry 是软件工程闭环的一部分，不得用手工记忆替代 gate。
- 修改 machine-readable contracts、默认 docs 入口、文档骨架、产品边界、runtime 边界、test lane registry 或 source owner 时，必须同步更新相关 docs、tests、fixtures、manifest 和 runner。
- 叙述性文档不作为测试断言对象；可以测试 schema、fixture、manifest、registry、CLI/API 行为、runner 行为、生成产物结构、路径存在性和 owner boundary。
- 声称“完成、落地、闭环、彻底清退、商业化 ready”前必须执行 Plan Completion Audit：逐项列出功能行为、代码清退、文档折叠、测试/验证、旧入口退役、cannot-claim，状态只能是 `done`、`partial`、`not_started` 或 `blocked`。docs、contract、测试绿或 closeout 不能单独替代真实 runtime 行为、可执行证据、owner receipt 或用户要求的验收。
- 每个工程变更的 review/closeout 必须说明清退结果：删除了什么、折叠了什么、保留了什么、为什么保留、下一次清退门是什么。没有清退说明的 closeout 不完整。
- 默认不得执行 build/push、kubectl、deploy、live-test 或真实云资源操作。

## 并行开发与工作树

- 大改动、长链路工作、并行多 agent 开发，默认先从最新 `origin/recovery/platform-v22-trunk` 开独立 worktree，再在 worktree 内实现和验证。
- authoring branch 默认不 push、不 merge；只有被明确指定为 landing operator 时，才可以执行 ff-only merge / push。
- 需要多条 lane 时创建多个 worktree，不要把多条长线塞进同一工作目录。互不冲突才并行，完成后及时关闭 subagent、清理 worktree 和临时状态。
- 创建/使用 git worktree 或 Codex native subagent 时，必须显式选择并记录模型；允许模型仅限 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- subagent 只承接边界清晰、互不冲突、可独立验证的任务；不要让 subagent 持有唯一上下文或替代 landing review。

## 授权与本地状态

- 未授权不得读取 secret、raw provider key、token、kubeconfig、SSH private key 或云凭据。
- 未授权不得执行真实云调用、build/push、kubectl、deploy、live-test，或修改 `deploy/*`、`.sentrux/*`、`adapters/*`、`infra/*`、one-person-lab upstream。
- raw provider API key 只能进入后端密钥边界；前端最多持有 `providerKeyRef`、bound status 和一次性输入态，不能把 raw key、bearer token、launchToken/runtimeToken 写入 browser storage、全局 JS state、日志、evidence 或 git。
- discovery/canary 需要用户明确授权边界；输出默认进入 `.runtime` 或外部临时状态，不进入 git，也不能自动变成 production dependency。
- 项目临时状态、session、prompt、log、canary evidence 和本地运行副产物不成为 current truth。
