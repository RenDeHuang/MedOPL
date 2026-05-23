# local-golden-path-release-candidate Proposal

Status: local-rc-eval-complete
Branch: cleanup/golden-path-first-class
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product, Integration, Runtime, Framework

## Why

MedOPL local pre-cloud proof currently shows the golden path shape and guardrails, but the observed runtime gap is at the provider-key-bound message backflow step. Portal, OPL Web Gateway, Runtime Bridge and local One Person Lab WebUI can run locally, yet a launch without provider config correctly fails message backflow with `provider_config_required`.

This change turns the local RC into a repo-native proof package: it verifies that a user-owned gflabtoken provider key can enter only the backend secret boundary, produce a public `providerKeyRef`, open OPL through Gateway, and allow Runtime Bridge message reply/artifact/trace projection without leaking raw key material.

## Goals

- Keep the golden path as the first-class product spine.
- Prove the local RC path from Portal launch to OPL Gateway to Runtime Bridge message backflow.
- Preserve fail-closed behavior when provider config is missing.
- Keep raw provider key out of git, logs, public response, evidence and final reports.
- Record the remaining gap between local RC proof and production cloud/live evidence.

## Non-Goals

- No real cloud mutation, deploy, kubectl, build/push or production live-test.
- No one-person-lab upstream source modification.
- No default platform provider credential.
- No production truth claim from local provider-key-bound evidence.
- No restoration of `user_owned`, `resource-order`, old runner/provisioner, OpenCost or Langfuse primary product narrative.

## Golden Path Impact

- improves:
- affected steps:
  - `login / credit / provider key`
  - `launch OPL`
  - `run / artifact`
  - `billing / trace / audit`
- required golden path eval:
  - `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk`
  - `node tests/local-rc/local-rc-test-v22-provider-key-message-backflow.mjs`

## Authorization Boundary

- User authorized reading only `~/.secrets/medopl/secrets.env.txt` for `GFLABTOKEN`.
- Do not read unrelated secret values from that file.
- Do not echo, log, persist, commit or report the raw provider key.
- No real cloud, deploy, kubectl, build/push or live-test.
- No `.env`, kubeconfig, SSH private key, provider console or production API access.

## Subscribed Truth

- `docs/active/README.md`
- `docs/product/README.md`
- `docs/runtime/README.md`
- `docs/framework/README.md`
- `docs/specs/README.md`
- `docs/evidence/README.md`
- `docs/policies/README.md`
- `docs/delivery/README.md`
- `docs/source/README.md`
- `changes/README.md`

## Baseline Inventory

Rules:

- Portal is the SaaS control plane.
- clean One Person Lab upstream remains outside MedOPL ownership.
- raw provider key is backend-only.
- local proof cannot become production truth.

Contracts:

- `spec:v22-user-credit-provider-key-boundary`
- `spec:v22-opl-entry-preflight-auth-boundary`
- `spec:v22-portal-opl-connection-boundary`
- `spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary`
- `spec:v22-portal-opl-context-backflow-boundary`

Status:

- OPL WebUI is locally deployed at `http://127.0.0.1:18130`.
- Portal, Gateway and Runtime Bridge can run locally at `17082`, `18789` and `8788`.
- Current active cursor remains `real-cloud-authorization-boundary`.

Evidence:

- Existing default evals prove local contract shape and guardrails.
- This change adds local provider-key-bound message backflow evidence.

History:

- Prior pre-cloud product closure remains history-only.

Noise / obsolete:

- Direct OPL login without Portal launch is not the MedOPL golden path.
- Missing-provider failure is not a product failure; it is a correct fail-closed gate.

## Cannot Claim

- This does not prove production provider readiness.
- This does not prove production deploy, kubectl rollout, real cloud resource lifecycle or real billing.
- This does not prove all OPL native UI flows are production-ready.
- This does not authorize future cloud or secret reads beyond the single `GFLABTOKEN` local RC run.
