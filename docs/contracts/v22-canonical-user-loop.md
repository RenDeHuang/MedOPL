# v22 Canonical User Loop Contract

本合同定义 MedOPL v22 的核心用户 loop。MedOPL 是 `platform-provisioned / customer-dedicated` 托管 OPL 科研工作台，不是云资源控制台。

## Loop

1. 平台创建一个用户或租户用户。
2. 给用户或租户充值额度。
3. 用户登录 `portal.medopl.cn`；portal.medopl.cn 登录不需要 gflabtoken API Key。
4. 用户进入 `opl.medopl.cn`；opl.medopl.cn 登录 / 进入 OPL 工作台需要 gflabtoken API Key。
5. API Key 输入框放在 OPL 登录页密码下面；已绑定时显示“已绑定”，不要求重复输入。
6. gflabtoken.cn 网站本身不进入 MedOPL 用户主流程。
7. 用户选择是否开通托管 runtime。
8. 如开通，用户选择基础套餐、叠加资源或自定义套餐。
9. 平台在自己的 TKE/存储资源池里给租户开通对应资源。
10. Portal 展示租户的 runtime、计算、存储、workspace 和资源绑定状态。
11. 开通资源后开始预扣费或冻结金额。
12. 用户通过 clean upstream OPL Web 工作。
13. 用户可以发送消息、上传文件、跑任务、下载输出文件。
14. Portal 可以看到 workspace 文件、账单和 session trace metadata。
15. 如果余额不足，Portal 提示将消耗冻结金额。
16. 冻结保护期是 7 天；7 天后清理对应数据和资源。
17. 用户删除或释放资源后，扣费停止。

## Runtime Gate

runtime 是租户可选开通能力。

- 租户开通 runtime 后，才能使用平台托管 runtime 跑任务。
- 租户不开通 runtime 时，可以有账号、充值和 OPL entry/preflight provider key 绑定状态，但不能跑托管 runtime 任务。
- runtime、compute、storage 必须绑定 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。

## Provider Key Entry Boundary

- Portal 可以展示“是否已绑定”状态，但 API Key 不是 Portal 普通登录字段。
- raw API Key 只能进入后端密钥边界，不能返回前端、不能写日志、不能进 git。

## Non-goals

- 不把 MedOPL 描述成云资源控制台。
- 不要求用户理解或直接配置 CVM、COS、K8s。
- 不把未开通 runtime 的租户描述成可以运行托管 runtime 任务。
