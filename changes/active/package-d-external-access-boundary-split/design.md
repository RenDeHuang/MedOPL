# package-d-external-access-boundary-split Design

Keep `package-d-external-access-runner.js` as the public plan/run/evidence entrypoint. Move reusable boundary validation to `package-d-external-access-boundary.js`; no command strings, exported runner functions or authorization behavior change.
