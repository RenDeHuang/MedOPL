# ai-runtime-contract Spec Delta

Target specs:

- specs/runtime/spec.md

## ADDED

- `runtime:ai-runtime-contract` defines AI Runtime Contract as the Runtime Bridge AI runtime adapter layer for runtimeSession, runtimeTool, runtimeResource, runtimeRun, runtimeArtifact and runtimeApproval.
- `runtime:mcp-compatible-boundary` defines MCP-compatible boundary as tools / resources / prompts / artifacts / approval shape compatibility only.
- `services/opl-runtime-bridge/src/runtime-bridge-mcp-compatible-shapes.mjs` owns local shape-only MCP-compatible runtime projection for contract tests.

## MODIFIED

- Runtime Bridge contract packages must subscribe to the AI Runtime Contract when changing file/run/artifact/providerKeyRef, Runtime Agent relay, OPL ACP runtime, approval or future tool/resource projection.
- Framework and runtime truth must state that MCP-compatible boundary does not authorize a production MCP server, external MCP clients, real cloud, secret reads, deploy, kubectl, build/push or live-test.

## REMOVED

- No requirement is removed by this authoring package.

## CANNOT-CLAIM

- This package does not claim production runtime readiness.
- This package does not claim a production MCP server, external MCP client compatibility, real cloud authorization, deploy readiness, kubectl rollout, build/push authorization, live-test authorization or live provider evidence.
- This package does not expose raw provider keys, bearer tokens, launchToken, runtimeToken, objectKey, localPath, signedUrl or presignedUrl.

## EVALS

- `node tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs`
- `node tests/contract/contract-test-v22-change-package-lifecycle.mjs`
- `node tests/contract/contract-test-v22-spec-eval-traceability.mjs`
- `node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs`
