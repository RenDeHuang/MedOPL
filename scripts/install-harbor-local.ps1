$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$helm = Join-Path $repo ".runtime\tools\helm-v3.17.3\windows-amd64\helm.exe"
$values = Join-Path $repo "configs\harbor\harbor-values-local.yaml"

if (-not (Test-Path $helm)) {
  throw "Helm not found at $helm"
}

& $helm repo add harbor https://helm.goharbor.io | Out-Null
& $helm repo update | Out-Null

& $helm upgrade --install `
  harbor `
  harbor/harbor `
  --version 1.18.3 `
  --namespace harbor-system `
  --create-namespace `
  -f $values `
  --timeout 25m

kubectl rollout status deployment/harbor-nginx -n harbor-system --timeout=25m
kubectl rollout status deployment/harbor-portal -n harbor-system --timeout=25m
kubectl rollout status deployment/harbor-core -n harbor-system --timeout=25m
kubectl rollout status deployment/harbor-jobservice -n harbor-system --timeout=25m
kubectl get svc -n harbor-system
powershell -ExecutionPolicy Bypass -File (Join-Path $repo "scripts\start-harbor-port-forward.ps1")
