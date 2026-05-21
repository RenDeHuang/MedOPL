# MedOPL v22 Taste

Owner: `MedOPL`
Purpose: `maintenance_development_taste`
State: `active_preference`
Machine boundary: 本文是人读协作偏好。项目事实、接口约束、验收结论和机器真相以源码、tests、fixtures、manifest、runner、docs lifecycle owner、runtime 输出和 repo-native 验证为准。

## 读法

`TASTE.md` 记录长期判断标准，帮助 `AGENTS.md`、项目文档和后续迭代保持一致。`AGENTS.md` 定义 agent 工作方式；`TASTE.md` 定义维护开发偏好；项目 `docs/`、source、tests 和 runtime evidence 定义项目事实。

跨项目复用时，只调整 Owner、项目名和少量本地例子。若某个分支需要局部偏离，必须在对应 docs、spec、test 或更深层 `AGENTS.md` 写清适用范围。

## 总则

MedOPL v22 的上位原则是 `managed OPL SaaS first`：平台把 clean upstream OPL 变成开箱即用、可购买、可管理、可计费、可审计、可释放的托管科研工作台。Portal 做控制面和服务交付；OPL 做科研执行；Runtime/Gateway 做边界适配；测试和 runner 守住 truth 闭环。

## 原则

1. **托管服务优先**
   用户看到的是科研工作台、工作空间、文件空间、运行环境、余额、账单、任务和结果，不是云资源控制台。云资源、runtime、secret、对象存储和审计都应被平台边界吸收，不暴露为普通用户主叙事。

2. **clean upstream 优先**
   one-person-lab 是 upstream reference，不是 MedOPL active source。平台通过 Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 和 anti-corruption mapping 接入；不要把 Portal、Gateway 或 Runtime 逻辑写回 upstream。

3. **单一 truth 派生多入口**
   当前事实、spec、policy、delivery、source、history 和 machine cursor 都有唯一 owner。CLI、package scripts、runner、test lane registry、fixture、manifest 和 docs 必须从同一事实链路派生，不能互相复制成第二真相。

4. **consumer-first contract**
   machine-readable contract 必须被 source、tests、runner、CLI/API 或 runtime evidence 实际消费。没有消费者时先用 docs/specs 做人读 anchor，不为了模仿目录而新增空合同。

5. **目标态快速落地**
   目标明确时，按目标架构快速、干净、可回退地推进。结构治理、命名收敛、接口收薄和明确迁移优先完成；长周期证据和真实外部系统验证作为单独授权尾项管理。

6. **历史面及时退役**
   当前 owner surface 已替代的旧模块、旧入口、alias、facade、wrapper、兼容测试和过时文档，在迁移条件成立后进入删除、归档或 tombstone。历史信息保留为 provenance，当前入口保持单一。

7. **薄入口与清晰结构**
   入口保持稳定而薄，复杂逻辑进入按职责命名的模块。源码、测试和文档表达真实边界；目录结构让维护者快速识别 source owner、spec anchor、test lane、runtime boundary、diagnostic 和 history。

8. **不接受伪通过**
   不做降级处理、兜底补丁、启发式后处理、隐式默认值或“先糊住再说”式实现。缺参数、缺授权、缺 schema、缺连接、缺 evidence 时应 fail closed，并把差距写回对应 owner。

9. **文档治理分层**
   文档服务导航、边界、状态、决策和交接。每份长期文档都有明确 owner、purpose、state 和 machine boundary；README、docs、AGENTS、TASTE、tests、fixtures、manifest、runner 各自持有单一职责。

10. **最小充分验证**
    验证强度与风险匹配。文档治理、结构收薄和命名清理采用最小充分验证；生产声明、权限边界、secret、真实云、artifact mutation、deploy、release 和 owner authority 使用更重的 receipt、gate 或人工授权证据。
