# v22 Canonical User Loop Contract

本合同定义 MedOPL v22 的核心用户 loop。MedOPL 是 `platform-provisioned / customer-dedicated` 托管 OPL 科研工作台，不是云资源控制台。

## Loop

1. 平台创建一个用户或租户用户。
2. 给用户或租户充值额度。
3. 用户登录 `portal.medopl.cn`。
4. 用户绑定 gflabtoken API key。
5. 用户选择是否开通托管 runtime。
6. 如开通，用户选择基础套餐、叠加资源或自定义套餐。
7. 平台在自己的 TKE/存储资源池里给租户开通对应资源。
8. Portal 展示租户的 runtime、计算、存储、workspace 和资源绑定状态。
9. 开通资源后开始预扣费或冻结金额。
10. 用户进入 `opl.medopl.cn`，通过 clean upstream OPL Web 工作。
11. 用户可以发送消息、上传文件、跑任务、下载输出文件。
12. Portal 可以看到 workspace 文件、账单和 session trace metadata。
13. 如果余额不足，Portal 提示将消耗冻结金额。
14. 冻结保护期是 7 天；7 天后清理对应数据和资源。
15. 用户删除或释放资源后，扣费停止。

## Runtime Gate

runtime 是租户可选开通能力。

- 租户开通 runtime 后，才能使用平台托管 runtime 跑任务。
- 租户不开通 runtime 时，可以有账号、充值、绑定 API key，但不能跑托管 runtime 任务。
- runtime、compute、storage 必须绑定 tenant、user、workspace、resource binding、billing account、audit tag / cost allocation tag。

## Non-goals

- 不把 MedOPL 描述成云资源控制台。
- 不要求用户理解或直接配置 CVM、COS、K8s。
- 不把未开通 runtime 的租户描述成可以运行托管 runtime 任务。
