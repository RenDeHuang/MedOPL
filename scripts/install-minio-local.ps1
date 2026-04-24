$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifest = Join-Path $repo "infra\kubernetes\minio-local.yaml"

kubectl apply -f $manifest
kubectl rollout status deployment/minio -n minio-system --timeout=20m
kubectl get svc -n minio-system
powershell -ExecutionPolicy Bypass -File (Join-Path $repo "scripts\start-minio-port-forward.ps1")
