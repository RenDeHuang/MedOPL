# sentrux-health-signal-downgrade Design

The cleanup keeps `.sentrux/*` protected by the normal forbidden-path gate while removing the retired active package and dedicated contract test from the current verification graph.

Implementation shape:

- archive `changes/active/sentrux-v22-rules-alignment`;
- delete `tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs`;
- remove the special workflow-gate Sentrux authorization helper;
- replace current bundle references with the active-platform validator;
- keep Sentrux wording only as optional repo health context in specs/source.
