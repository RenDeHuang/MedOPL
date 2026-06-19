# ai-runtime-contract Design

## Architecture

AI Runtime Contract is a Runtime plane contract owned by Runtime Bridge. It keeps MedOPL's framework centered on platform-provisioned OPL SaaS and treats external AI frameworks as adapters, not owners of product truth.

```text
Portal
-> Gateway
-> Runtime Bridge AI runtime adapter layer
-> Runtime Adapter
   -> OPL ACP runtime
   -> Runtime Agent HTTP API
   -> future MCP-compatible tools/resources
-> Portal artifacts / traces / billing / audit
```

## Contract Objects

- runtimeSession: tenant, user, workspace, runtime identity, providerKeyRef and trace context.
- runtimeTool: a callable operation shape exposed through a controlled adapter.
- runtimeResource: a readable resource shape exposed through a controlled adapter.
- runtimeRun: a task/run request, state and public runtime claims.
- runtimeArtifact: sanitized output projection returned to Portal.
- runtimeApproval: human/admin approval state for future sensitive runtime operations.

## MCP-Compatible Boundary

MCP-compatible boundary means tools / resources / prompts / artifacts / approval shape compatibility. Current source proof is `runtime-bridge-mcp-compatible-shapes.mjs`, which emits local shape-only runtimeTool, runtimeResource, runtimeRun, runtimeArtifact and runtimeApproval projections for contract tests. It does not mean a production MCP server is running, external MCP clients are authorized, secrets can be read, or real cloud/deploy/live-test work is allowed.

## Failure Modes

- Missing providerKeyRef or runtime capability fails closed.
- Raw key/token/object locator fields in relay payloads fail closed.
- Runtime Agent relay evidence proves only local adapter behavior.
- MCP-compatible shape proof cannot be upgraded into production MCP or real cloud evidence.

## Surface Impact

- source: existing `services/opl-runtime-bridge` Runtime Bridge, Runtime Agent relay, OPL ACP runtime surfaces and `runtime-bridge-mcp-compatible-shapes.mjs`.
- specs: `specs/runtime/spec.md`.
- docs: `docs/specs/README.md`, `docs/runtime/README.md`, `docs/framework/README.md`.
- tests: `node tests/contracts/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs`.
