# Portal AionUI/OPL 真实联调推进日志 v1

## 2026-04-24 Step 0：方案落地

修改文件：
- `docs/plan/2026-04-24-Portal-AionUI-OPL-真实联调开发方案-v1.md`
- `docs/logs/2026-04-24-Portal-AionUI-OPL-真实联调推进日志-v1.md`

结论：
- 下一轮主线是把当前 OPL runtime bridge 接入 one-person-lab Product API / AionUI shell。
- bridge 后面的 contract run 要替换为 `med-autoscience-runner` internal API + 真实 K8s Job。
- Portal 只负责控制面与观测，不直连 AionUI 或 runner。

验证：
- 本 step 为方案与任务边界落地，未改运行代码。
- 后续每个 AI 开发 step 必须在本文件补充修改文件、测试命令、证据 ID 和未完成原因。

未完成：
- 尚未开发 `opl-client.mjs`。
- 尚未开发 `runner-client.mjs`。
- 尚未完成真实 AionUI shell launch。
- 尚未完成真实 K8s runner smoke。
