# cloud-workflow-tombstone-gate-retirement Design

The active machine surface should have one Package D runner image publish gate. The local gate owns both the private-build-runner shape and the assertion that the old GitHub Actions workflow is not a current live path.

No compatibility alias is kept. Consumers move to the local gate or retain `githubActions.status` as structured state in the deploy-readiness contract.

