import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererPath = path.join(repoRoot, "deploy/tke-package/scripts/render-tke-manifests.mjs");
  const {
  quoteYamlDoubleString,
  parseEnvContent,
  resolveRenderOptions,
  renderTkeManifests,
} = await import(`${path.toNamespacedPath(rendererPath)}?contract=${Date.now()}`);

{
  const vars = parseEnvContent(`
    # comment
    SIMPLE=value
    QUOTED_EMAIL="admin@example.test"
    QUOTED_SECRET='secret-value'
    URL=postgres://user:p%40ss@postgres:5432/portal?sslmode=disable
    JSON={"command":"node","args":["a=b","c"]}
  `);

  assert.deepEqual(vars, {
    SIMPLE: "value",
    QUOTED_EMAIL: "admin@example.test",
    QUOTED_SECRET: "secret-value",
    URL: "postgres://user:p%40ss@postgres:5432/portal?sslmode=disable",
    JSON: '{"command":"node","args":["a=b","c"]}',
  });
}

{
  assert.equal(quoteYamlDoubleString('plain'), '"plain"');
  assert.equal(quoteYamlDoubleString('a"b\\c'), '"a\\"b\\\\c"');
  assert.equal(quoteYamlDoubleString('line\nnext'), '"line\\nnext"');
}

{
  const tmp = mkdtempSync(path.join(tmpdir(), "tke-render-contract-"));
  const envFile = path.join(tmp, "env/tke.env");
  const templateDir = path.join(tmp, "templates");
  const outDir = path.join(tmp, "rendered");
  mkdirSync(path.dirname(envFile), { recursive: true });
  mkdirSync(path.join(templateDir, "nested"), { recursive: true });
  writeFileSync(envFile, "NAME=portal\nSECRET=quote\"and\\slash\n", "utf8");
  writeFileSync(path.join(templateDir, "00-config.yaml"), "name: __NAME__\nsecret: __SECRET__\n", "utf8");
  writeFileSync(path.join(templateDir, "nested/01-config.yml"), "same: __NAME__\n", "utf8");

  const result = renderTkeManifests({ envFile, templateDir, outDir });

  assert.equal(result.outDir, outDir);
  assert.deepEqual(result.renderedFiles.map((file) => path.relative(outDir, file)).sort(), [
    "00-config.yaml",
    "nested/01-config.yml",
  ]);
  assert.equal(readFileSync(path.join(outDir, "00-config.yaml"), "utf8"), "name: portal\nsecret: quote\"and\\slash\n");
  assert.equal(readFileSync(path.join(outDir, "nested/01-config.yml"), "utf8"), "same: portal\n");

  rmSync(tmp, { recursive: true, force: true });
}

{
  const tmp = mkdtempSync(path.join(tmpdir(), "tke-render-quoted-"));
  const envFile = path.join(tmp, "env/tke.env");
  const templateDir = path.join(tmp, "templates");
  const outDir = path.join(tmp, "rendered");
  mkdirSync(path.dirname(envFile), { recursive: true });
  mkdirSync(templateDir, { recursive: true });
  writeFileSync(envFile, "SECRET=quote\"and\\slash\n", "utf8");
  writeFileSync(path.join(templateDir, "00-secret.yaml"), "secret: \"__SECRET__\"\n", "utf8");

  renderTkeManifests({ envFile, templateDir, outDir });

  assert.equal(readFileSync(path.join(outDir, "00-secret.yaml"), "utf8"), 'secret: "quote\\"and\\\\slash"\n');

  rmSync(tmp, { recursive: true, force: true });
}

{
  const tmp = mkdtempSync(path.join(tmpdir(), "tke-render-unresolved-"));
  const envFile = path.join(tmp, "env/tke.env");
  const templateDir = path.join(tmp, "templates");
  const outDir = path.join(tmp, "rendered");
  mkdirSync(path.dirname(envFile), { recursive: true });
  mkdirSync(templateDir, { recursive: true });
  writeFileSync(envFile, "NAME=portal\n", "utf8");
  writeFileSync(path.join(templateDir, "00-config.yaml"), "name: __NAME__\nmissing: __MISSING__\n", "utf8");

  assert.throws(
    () => renderTkeManifests({ envFile, templateDir, outDir }),
    /Render completed with unresolved placeholders/,
  );

  rmSync(tmp, { recursive: true, force: true });
}

{
  const options = resolveRenderOptions([
    "--env-file",
    "custom.env",
    "-TemplateDir",
    "custom-manifests",
    "-OutDir",
    "custom-rendered",
    "--set",
    "BUILD_SHA=opl-v20.33",
    "--set",
    "PORTAL_IMAGE=registry/portal:opl-v20.33",
  ]);

  assert.equal(options.envFile, path.resolve(repoRoot, "custom.env"));
  assert.equal(options.templateDir, path.resolve(repoRoot, "custom-manifests"));
  assert.equal(options.outDir, path.resolve(repoRoot, "custom-rendered"));
  assert.deepEqual(options.overrideVars, {
    BUILD_SHA: "opl-v20.33",
    PORTAL_IMAGE: "registry/portal:opl-v20.33",
  });
}

{
  const tmp = mkdtempSync(path.join(tmpdir(), "tke-render-overrides-"));
  const envFile = path.join(tmp, "env/tke.env");
  const templateDir = path.join(tmp, "templates");
  const outDir = path.join(tmp, "rendered");
  mkdirSync(path.dirname(envFile), { recursive: true });
  mkdirSync(templateDir, { recursive: true });
  writeFileSync(envFile, "BUILD_SHA=opl-v20.32\nPORTAL_IMAGE=registry/portal:opl-v20.32\n", "utf8");
  writeFileSync(path.join(templateDir, "00-config.yaml"), "sha: __BUILD_SHA__\nimage: __PORTAL_IMAGE__\n", "utf8");

  renderTkeManifests({
    envFile,
    templateDir,
    outDir,
    overrideVars: {
      BUILD_SHA: "opl-v20.33",
      PORTAL_IMAGE: "registry/portal:opl-v20.33",
    },
  });

  assert.equal(
    readFileSync(path.join(outDir, "00-config.yaml"), "utf8"),
    "sha: opl-v20.33\nimage: registry/portal:opl-v20.33\n",
    "renderer_overrides_must_replace_stale_env_release_values",
  );

  rmSync(tmp, { recursive: true, force: true });
}

{
  const options = resolveRenderOptions([]);

  assert.equal(options.envFile, path.resolve(repoRoot, "deploy/tke-package/env/tke.env"));
  assert.equal(options.templateDir, path.resolve(repoRoot, "deploy/tke-package/manifests"));
  assert.equal(options.outDir, path.resolve(repoRoot, "deploy/tke-package/rendered-local-check"));
}

{
  const rendered = readFileSync(path.join(repoRoot, "deploy/tke-package/manifests/04-runner-rbac.yaml"), "utf8");
  assert.match(rendered, /kind:\s*ClusterRoleBinding/, "runner RBAC manifest must include ClusterRoleBinding");
  assert.match(rendered, /namespace:\s*__NAMESPACE__/, "runner RBAC binding must be namespace-rendered for the target service account");
  assert.equal(
    rendered.match(/name:\s*__RUNNER_RBAC_NAME__/g)?.length,
    3,
    "runner ClusterRole, ClusterRoleBinding, and roleRef must share one renderable RBAC name",
  );
  assert.doesNotMatch(
    rendered,
    /name:\s*med-autoscience-runner-job-manager(\n|$)/,
    "runner RBAC manifest must not hard-code the shared staging ClusterRole or ClusterRoleBinding name",
  );
}

{
  const namespaces = readFileSync(path.join(repoRoot, "deploy/tke-package/manifests/00-namespaces.yaml"), "utf8");
  const langfuse = readFileSync(path.join(repoRoot, "deploy/tke-package/manifests/08-langfuse-stack.yaml"), "utf8");
  assert.doesNotMatch(
    namespaces,
    /\n\s*name:\s*langfuse-system(\n|$)/,
    "base namespace manifest must not include the shared Langfuse namespace",
  );
  assert.match(
    langfuse,
    /kind:\s*Namespace[\s\S]*?\n\s*name:\s*langfuse-system(\n|$)/,
    "Langfuse stack manifest must own the shared Langfuse namespace",
  );
}

{
  const migrationJob = readFileSync(path.join(repoRoot, "deploy/tke-package/manifests/07a-portal-schema-migrate-job.yaml"), "utf8");
  assert.match(migrationJob, /kind:\s*Job/, "portal schema migration must be packaged as an explicit Kubernetes Job");
  assert.match(migrationJob, /\n\s*name:\s*portal-schema-migrate-v20-32(\n|$)/, "portal schema migration Job must use the v20.32 isolated name");
  assert.match(migrationJob, /\n\s*namespace:\s*__NAMESPACE__(\n|$)/, "portal schema migration Job must render into the target namespace");
  assert.match(migrationJob, /image:\s*"__PORTAL_IMAGE__"/, "portal schema migration Job must run the same portal image being deployed");
  assert.match(migrationJob, /command:\s*\[\s*"node",\s*"src\/migrate-schema\.mjs"\s*\]/, "portal schema migration Job must run the explicit migration entrypoint");
  assert.match(migrationJob, /name:\s*portal-postgres-redis-secret/, "portal schema migration Job must source postgres and redis from the scoped secret");
  assert.match(migrationJob, /name:\s*"__IMAGE_PULL_SECRET__"/, "portal schema migration Job must use the rendered registry pull secret");
  assert.doesNotMatch(migrationJob, /langfuse-system|portal-staging/, "portal schema migration Job must not target shared or old namespaces");
}

{
  const tmp = mkdtempSync(path.join(tmpdir(), "tke-render-tracked-guard-"));
  const envFile = path.join(tmp, "env/tke.env");
  const templateDir = path.join(tmp, "templates");
  mkdirSync(path.dirname(envFile), { recursive: true });
  mkdirSync(templateDir, { recursive: true });
  writeFileSync(envFile, "NAME=portal\n", "utf8");
  writeFileSync(path.join(templateDir, "00-config.yaml"), "name: __NAME__\n", "utf8");

  assert.throws(
    () =>
      renderTkeManifests({
        envFile,
        templateDir,
        outDir: path.join(repoRoot, "deploy/tke-package/rendered"),
      }),
    /Refusing to render into tracked directory/,
  );

  rmSync(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "tke_manifest_renderer",
}, null, 2));
