# ai-runtime-contract Proposal

Status: authoring
Branch: ai-runtime-contract
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Runtime Bridge
Affected plane: Runtime

## Why

MedOPL v22 needs an AI runtime boundary that supports end-to-end AI MVP readiness without making LangGraph, OpenAI Agents SDK, MCP, A2A, one-person-lab internals or a cloud provider the primary framework owner. The stable product boundary remains platform-provisioned OPL SaaS; Runtime Bridge owns the adapter layer that projects workbench context, run requests, artifacts, audit and billing metadata safely.

## Goals

- Define AI Runtime Contract as the Runtime Bridge AI runtime adapter layer.
- Keep Runtime Bridge as the anti-corruption boundary between Portal/Gateway, clean OPL, Runtime Agent HTTP API and future MCP-compatible shapes.
- Name the stable contract objects: runtimeSession, runtimeTool, runtimeResource, runtimeRun, runtimeArtifact and runtimeApproval.
- Define MCP-compatible boundary as tools / resources / prompts / artifacts / approval shape compatibility only.
- Add a Runtime Bridge-owned local MCP-compatible shape projection without starting a production MCP server.
- Preserve providerKeyRef and secret hygiene boundaries.

## Non-Goals

- Do not start a production MCP server or authorize external MCP clients.
- Do not replace Runtime Bridge with LangGraph, OpenAI Agents SDK, MCP or A2A as the platform framework.
- Do not modify one-person-lab upstream or import upstream internals.
- Do not read secrets, raw provider keys, bearer tokens, kubeconfig, SSH private keys or cloud credentials.
- Do not call real cloud, deploy, kubectl, build/push or live-test.

## Golden Path Impact

- improves: the local golden path gains a durable AI runtime adapter contract before real cloud/runtime authorization.
- affected steps: Portal -> Gateway -> Runtime Bridge -> Runtime Agent/OPL ACP -> artifact/trace/billing/audit projection.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.
- required contract eval: `node tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.
- No production MCP server, external MCP client access or network mutation is authorized by this package.
- providerKeyRef may cross the runtime boundary as a reference; raw key, bearer token, launchToken, runtimeToken, objectKey, localPath, signedUrl and presignedUrl must not enter public projection, evidence, logs or git.

## Subscribed Truth

- docs/active/README.md
- docs/runtime/README.md
- docs/framework/README.md
- docs/specs/README.md
- specs/runtime/spec.md
- changes/README.md
- services/opl-runtime-bridge
- tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs
