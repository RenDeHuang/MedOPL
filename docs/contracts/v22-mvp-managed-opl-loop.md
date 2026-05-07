# v22 MVP Managed OPL Loop Contract

本合同定义 MedOPL v22 MVP 的托管 OPL 科研闭环。MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。

## Product Narrative

用户主叙事必须围绕科研工作流，而不是云资源管理：

- 科研工作台
- 托管运行环境
- 工作空间
- 文件空间
- 套餐
- 余额
- 任务
- 输出文件
- 运行轨迹
- 停止使用 / 释放托管环境

后台实现可以使用 CVM、COS、runtime、resourceBinding、billingAccount 和 auditTag。它们只能作为后台实现、计费、隔离和审计边界，不能成为用户主叙事。CVM、COS、TKE、K8s 和云资源控制台不得成为 MVP 用户侧产品语言。

Langfuse 只作为后续 trace metadata 来源，不进入 MVP 主产品叙事。

## Scope

- 默认套餐只引用 `starter_2c4g_10gb` 和 `pro_8c16g_100gb`。
- 本合同不扩展自定义套餐实现。
- portal.medopl.cn 登录不需要 gflabtoken API Key。
- opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
- API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。
- gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
- Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git；用户侧只看到 `providerKeyRef` 和 bound status。
- OPL Web 使用 clean upstream one-person-lab：`https://github.com/gaofeng21cn/one-person-lab`。
- 不修改 upstream 源码，不 import upstream 内部模块。

## Contract Data

<!-- v22-mvp-managed-opl-loop-contract:start -->
```json
{
  "contract": "v22_mvp_managed_opl_loop",
  "version": 1,
  "productNarrative": {
    "audience": "AI 小白科研用户",
    "category": "OPL 科研托管平台",
    "notCloudConsole": true,
    "primaryStatement": "MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。"
  },
  "userVisibleConcepts": [
    "科研工作台",
    "托管运行环境",
    "工作空间",
    "文件空间",
    "套餐",
    "余额",
    "任务",
    "输出文件",
    "运行轨迹",
    "停止使用 / 释放托管环境"
  ],
  "forbiddenUserNarrative": [
    "CVM",
    "COS",
    "K8s",
    "TKE",
    "云资源控制台"
  ],
  "backendImplementationBoundary": {
    "allowedBackendTerms": [
      "CVM",
      "COS",
      "runtime",
      "resourceBinding",
      "billingAccount",
      "auditTag"
    ],
    "userNarrativeAllowed": false,
    "cloudConsoleShownToUser": false,
    "tkeUserNarrativeAllowed": false
  },
  "defaultPlans": [
    "starter_2c4g_10gb",
    "pro_8c16g_100gb"
  ],
  "secretBoundary": {
    "provider": "gflabtoken",
    "portalLoginRequiresProviderKey": false,
    "oplEntryRequiresProviderKey": true,
    "inputLocation": "OPL 登录页密码下面",
    "gflabtokenSiteInUserMainFlow": false,
    "rawKeyBackendOnly": true,
    "publicFields": [
      "providerKeyRef",
      "boundStatus"
    ]
  },
  "upstreamBoundary": {
    "repository": "https://github.com/gaofeng21cn/one-person-lab",
    "cleanUpstream": true,
    "modifySource": false,
    "importInternalModules": false
  },
  "billingBoundary": {
    "reconcileWithinBillingDay": true,
    "stopBillingConfirmationWithinMinutesAfterRelease": 120,
    "auditTPlusOne": true,
    "stopChargingAfterRelease": true
  },
  "auditingAndCleanup": {
    "postReleaseProtectionBoundary": true,
    "dataCleanupAudited": true,
    "langfuseMvpNarrative": false,
    "langfuseFutureTraceMetadataSourceOnly": true
  },
  "mvpLoop": [
    {
      "id": 1,
      "name": "平台创建 1 名用户",
      "userFacing": false,
      "requiredEvidence": [
        "tenant user exists",
        "workspace owner role exists"
      ]
    },
    {
      "id": 2,
      "name": "平台给用户充值额度",
      "userFacing": false,
      "requiredEvidence": [
        "billing account exists",
        "balance ledger top-up exists"
      ]
    },
    {
      "id": 3,
      "name": "用户登录 portal.medopl.cn",
      "userFacing": true,
      "requiredEvidence": [
        "Portal login session exists",
        "Portal login does not require gflabtoken API Key",
        "user sees 科研工作台"
      ]
    },
    {
      "id": 4,
      "name": "用户进入 opl.medopl.cn",
      "userFacing": true,
      "requiredEvidence": [
        "OPL Web entry opens",
        "OPL entry requires gflabtoken API Key",
        "workspace context is bound"
      ]
    },
    {
      "id": 5,
      "name": "用户在 opl.medopl.cn 登录 / 进入 OPL 工作台时绑定 gflabtoken API Key",
      "userFacing": true,
      "requiredEvidence": [
        "API Key input is below OPL login password field",
        "bound users see 已绑定",
        "providerKeyRef returned",
        "boundStatus returned",
        "raw key remains backend only"
      ]
    },
    {
      "id": 6,
      "name": "用户在 Portal 开通托管运行环境，选择套餐和文件空间",
      "userFacing": true,
      "requiredEvidence": [
        "selected plan is starter_2c4g_10gb or pro_8c16g_100gb",
        "file space quota selected",
        "hosted runtime requested"
      ]
    },
    {
      "id": 7,
      "name": "平台后台代开通 CVM / 存储 / runtime，但用户侧不展示云资源控制台",
      "userFacing": false,
      "requiredEvidence": [
        "backend resourceBinding exists",
        "backend billingAccount exists",
        "backend auditTag exists",
        "user surface hides cloud console"
      ]
    },
    {
      "id": 8,
      "name": "Portal 展示托管运行环境、工作空间、文件空间、余额、预扣费/冻结金额",
      "userFacing": true,
      "requiredEvidence": [
        "hosted runtime status visible",
        "workspace visible",
        "file space visible",
        "balance visible",
        "preauth or frozen amount visible"
      ]
    },
    {
      "id": 9,
      "name": "账单日内核对；释放后 120min 内完成停止计费确认；审计 T+1",
      "userFacing": true,
      "requiredEvidence": [
        "billing reconciles within billing day",
        "release stop-billing confirmation within 120 minutes",
        "audit completes T+1"
      ]
    },
    {
      "id": 10,
      "name": "OPL Web 使用 clean upstream one-person-lab，不修改源码，不 import upstream 内部模块",
      "userFacing": true,
      "requiredEvidence": [
        "upstream repository is https://github.com/gaofeng21cn/one-person-lab",
        "Gateway boundary is used",
        "no upstream source modification",
        "no upstream internal import"
      ]
    },
    {
      "id": 11,
      "name": "用户在 opl.medopl.cn 可发送信息、上传文件、用文件跑任务、下载输出",
      "userFacing": true,
      "requiredEvidence": [
        "message sent",
        "file uploaded",
        "task runs with file",
        "output file downloadable"
      ]
    },
    {
      "id": 12,
      "name": "Portal 可看到 workspace 文件、账单、session trace metadata",
      "userFacing": true,
      "requiredEvidence": [
        "workspace files visible",
        "billing visible",
        "session trace metadata visible"
      ]
    },
    {
      "id": 13,
      "name": "用户停止使用 / 释放托管环境后停止扣费",
      "userFacing": true,
      "requiredEvidence": [
        "release requested",
        "runtime marked released",
        "billing stops after release"
      ]
    },
    {
      "id": 14,
      "name": "后续资源与数据清理进入保护/审计边界",
      "userFacing": false,
      "requiredEvidence": [
        "cleanup protection boundary entered",
        "data cleanup audit event exists",
        "resource cleanup audit event exists"
      ]
    }
  ]
}
```
<!-- v22-mvp-managed-opl-loop-contract:end -->

## Smoke Boundary

`scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs` 是纯本地 contract 校验。它只读取本文件中的 JSON 契约块，不读取 secrets，不调用真实云 API，不执行 build、push、kubectl 或 live-test。
