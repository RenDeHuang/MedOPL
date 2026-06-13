# package-c-plan-catalog-contract Proposal

Status: authoring
Branch: recovery/platform-v22-trunk
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Resource / Billing / Audit

## Why

Package C live canary cloud params still accepted a temporary instance shape and current product truth still described starter as 10GB. That split can make the live canary validate a shape that is not the customer-visible plan.

## Goals

- Make Package C live canary validate the Starter plan from a repo-consumed plan catalog allowlist.
- Move starter to `2C4G + 100GB workspace storage`.
- Keep workspace storage separate from the TKE node system disk.
- Reject arbitrary Tencent `instanceType` / `nodeInstanceType` input.

## Non-Goals

- Do not execute real Tencent mutation.
- Do not authorize deploy, kubectl, build/push, live-test or Package D.
- Do not read secrets, kubeconfig, tokens, SecretId, SecretKey or SSH private keys.
- Do not modify one-person-lab upstream.

## Golden Path Impact

preserves: the local golden path remains non-cloud and deterministic.

required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

This package is contract / prepare-only. It keeps `RUN_TENCENT_CREATE_RELEASE_EXECUTION=0` and does not authorize any real cloud operation.

Future live execution still requires a separate current-session authorization naming operation class, target environment, secret allowlist, API allowlist, budget, evidence sink and rollback owner.
