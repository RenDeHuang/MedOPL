# OPL v19 L3 Final Live Evidence

日期：2026-05-02

## 结论

本轮 live 用户链路已经跑到 L3 `DescribeBillDetail +120min`，并完成目标资源的唯一归因：

- tenant/user：`aeb7ec00-b260-4f4d-9446-b051e45ecbf5`
- workspace：`test-v19-moo3vbjk-180c83`
- run：`test-run-test-v19-moo3vbjk-180c83`
- resource mapping：`b8ce0d6c-ee7c-45a4-8a94-d3cc5cecff58`
- node pool：`np-g45p2542`
- CVM：`ins-cq3svd4q`

最终 L3 结果不是 `charged`，而是可审计的 `unattributed / exact_bill_zero_cost`。腾讯 L3 明细能匹配到目标 CVM，但目标行金额为 `0`，因此本次不能证明“真实扣费入账”。系统没有伪造扣费：目标 ledger 只有 `preauth_hold`，没有 `exact_resource_charge`、`refund` 或 `makeup_charge`，wallet 余额仍为 `1000`。

## 修复与部署

live billing 已滚动到：

`uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v19-l3-final-20260502-eb06918`

digest：

`sha256:5b04900f266c54451525f230097e6613621dba78800b9c3ba6578c27e04198e2`

关键修复：

- `DescribeBillDetail` 分页不再在 `Total=0` 且满页时提前停止。
- L3 query time 使用腾讯账单时间轴，目标窗口为 `2026-05-02 16:56:14` 到 `2026-05-02 19:00:43`。
- billing 容器显式设置 `BILLING_REPO_ROOT=/app`，读取实际 mounted runtime。
- billing 连接 `RESOURCE_PROVISIONER_URL=http://resource-provisioner:18893`，可拉取 resource mapping。
- 0 元 exact bill 返回可审计结果，不写错误扣费 ledger。
- `billing-summary-runtime` 保留 L3 target，不再只保留 COS target。

## 证据

JSON evidence：

- `docs/reports/v19-live-e2e-json/2026-05-02T09-01-33-471Z-same_day.json`
- `docs/reports/v19-live-e2e-json/2026-05-02T12-15-30-000Z-l3_final.json`

验收口径状态：

- same-day 主流程：通过。
- L3 `DescribeBillDetail +120min`：目标资源已匹配，但金额为 0。
- COS T+1：仍作为 audit replay 待跑。
- CVM 当前按 `ResourceId -> resource mapping` 唯一归因验收。
- CVM `TagResources` 补齐仍是商业 GA 前 P0。
