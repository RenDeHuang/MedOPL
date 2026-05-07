# GitHub Handoff And Secret Hygiene

本文件用于准备 platform-v22 安全推送 GitHub。它是 README / GitHub remote / secret hygiene runbook，不代表已经执行真实 GitHub 配置、真实云配置、部署或 push。

## Repository Policy

- 推荐使用 GitHub private repo。
- push 前必须确认 `git status --short --branch` 干净。
- push 前必须确认没有 secret 被 tracked。
- 不把 kubeconfig、token、API key、SecretId、SecretKey、GitHub token/PAT、SSH private key 或 `/home/dev/.secrets/medopl/secrets.env.txt` 写入 git。
- 不把任何 secret 值写入 README、docs、logs、commit message 或 evidence。
- 如果本地存在名为 `github` 的文件，默认按敏感本地配置处理：不要提交、不要打印内容；如确认为本地私有配置，应保持在 `.gitignore`。

## Remote Runbook

以下命令只是占位 runbook。不要在普通文档/检查分支中执行 remote 切换、push 或任何 GitHub token 操作。

```bash
git remote set-url origin <GITHUB_PRIVATE_REPO_URL>
```

实际执行 remote 切换前必须单独授权，并在执行前重新确认 secret hygiene。

## Pre-push Checks

只做路径和 git 跟踪状态检查，不打印 secret 文件内容。

```bash
git status --short --branch
git ls-files | rg '(^|/)(github|\\.env|.*\\.env|.*\\.pem|.*\\.key|.*kubeconfig.*|\\.kube)(/|$)|SecretId|SecretKey|PAT|id_rsa|id_ed25519'
git check-ignore -v .env .env.local local.env secret.env kubeconfig local.kubeconfig .kube/config github token.txt secrets.env.txt private.pem private.key || true
```

如果检查命中真实凭据路径，先停止，不要 `cat`、不要打印内容、不要提交。需要读取真实凭据时必须单独向用户确认授权，且不得输出值。

## .gitignore Coverage

当前 `.gitignore` 以明确本地凭据模式为主，覆盖：

- `.env`
- `.env.*`
- `*.env`
- `*.pem`
- `*.key`
- `*.kubeconfig`
- `*kubeconfig*`
- `.kube/`
- `github`

未加入全局 `*secret*` 或 `*token*`，因为仓库内存在合法的合同、示例 manifest、smoke 和源码文件名包含 `secret` / `token`。这些路径需要人工复核内容，不适合用过宽 ignore 规则隐藏。

## Current Risk Notes

- 本机可能存在腾讯云 kubeconfig、token、API key、SecretId、SecretKey、GitHub token/PAT、SSH key 和 `/home/dev/.secrets/medopl/secrets.env.txt` 等本地凭据。
- 这些凭据允许在后续“真实云 / GitHub 配置 / 部署”被单独授权时本地读取使用，但绝对不能进入 git / GitHub。
- 当前分支不执行真实云 API，不执行 `git remote set-url`，不 push，不运行 build/push/kubectl/live-test。

## Sentrux Note

Sentrux 免费版/本地 CLI 只作为结构健康传感器。文件、函数、import 级定位必须由 Codex 本地源码复核给出，不能只凭结构信号下结论。
