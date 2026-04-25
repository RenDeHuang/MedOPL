# med-autoscience Runner Adapter

This directory was migrated from the previous protocol adapter because it contains useful workspace,
Kubernetes manifest, policy, log, and output handling code.

In v1 it is no longer the product entry. The product path is:

`Portal -> OPL Web -> OPL runtime -> med-autoscience`

The Portal OPL adapter or OPL runtime orchestrator should call this adapter internally. Do not expose this service
as the user-facing workbench path.

## Scope

- create workspace
- start run
- get status
- get logs
- list outputs

## Current Implementation Status

Current code now supports:

- workspace creation on disk
- run metadata persistence
- Kubernetes Job manifest generation
- real `kubectl apply/get/logs` flow against the current context
- a legacy HTTP adapter surface kept only as implementation material

Still pending:

- a real med-autoscience runner image and domain-specific runtime command
- wiring the internal runner API into the real OPL runtime-orchestrator

## Rules

- do not modify med-autoscience upstream
- do not expose this adapter as a user-facing product entry
- all run identity must map to:
  - `customer_id`
  - `user_id`
  - `workspace_id`
  - `run_id`
