# Workspace Instructions

- Always respond in 中文。
- 避免采用降级处理、兜底方案、临时补丁、启发式方法、局部稳定化手段，以及非严谨通用算法的后处理补救措施。
- 对于不冲突、可以并行的任务，尽量使用 subagent 提高效率；不再需要的 subagent 要尽快关闭，避免占用 subagent 的席位。
- 以后创建/使用 git worktree 或 Codex native subagent 时，必须显式选择并记录模型；允许使用的模型仅限 `gpt-5.4`、`gpt-5.3-codex`、`gpt-5.4-mini`。
- 浏览网页时，优先使用 `agent-browser` skill。
- 涉及 PDF、图片、Office、网页内容提取时，优先使用官方 `mineru-document-extractor` skill。
