# OPL v19 Docker Product Appliance

## Scope

This appliance contract is local-only and uses mock or fixture cloud behavior.
It never creates a real TKE cluster from Docker Compose.

The `product` profile is image-based and does not mount repository source code.
The `dev` profile is the only profile that mounts the workspace for source-level iteration.

## Services

The `product` profile includes:

- `portal`
- `opl-web-gateway`
- `opl-web`
- `portal-opl-adapter`
- `billing-aggregator`
- `resource-provisioner`
- `med-autoscience-runner`
- `postgres`
- `redis`

Default storage mode is `PORTAL_STORAGE_MODE=postgres_redis`.
Every service in the compose contract has a healthcheck.

## Cloud Boundary

- `resource-provisioner` runs with `RESOURCE_PROVISIONING_ENABLED=0`
- `billing-aggregator` runs with Tencent billing and pricing disabled
- `med-autoscience-runner` points at the local mock provisioner URL
- No Tencent cloud secret is required for local compose contract validation

This is a mock or fixture cloud appliance for local contract verification, not a production cloud deployment.

## Usage

Validate the image-based product profile:

```powershell
docker compose -f compose.product.yaml --profile product config
docker compose -f compose.product.yaml --profile product up -d --build
```

Use the source-mounted dev profile:

```powershell
docker compose -f compose.product.yaml --profile dev config
docker compose -f compose.product.yaml --profile dev up -d
```

Bring the stack down:

```powershell
docker compose -f compose.product.yaml --profile product down
docker compose -f compose.product.yaml --profile dev down
```

## Image Notes

`opl-web` is intentionally image-based in both profiles.
Set `OPL_WEB_IMAGE` to a prepared upstream OPL Web image before `up` if the local daemon does not already have the default image tag.

Other product services build from repository-local Dockerfiles under `deploy/local/dockerfiles` and run as images in the `product` profile.

## Verification

Run the compose contract smoke:

```powershell
node scripts/smoke-test-v19-compose-product-appliance.mjs
```

If Docker is available, the smoke also runs lightweight `docker compose ... config` verification for both `product` and `dev` profiles.
