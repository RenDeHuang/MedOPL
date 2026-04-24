$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$helm = Join-Path $repo ".runtime\tools\helm-v3.17.3\windows-amd64\helm.exe"
$values = Join-Path $repo "infra\opencost\helm-values.yaml"

if (-not (Test-Path $helm)) {
  throw "Helm not found at $helm"
}

& $helm repo add opencost https://opencost.github.io/opencost-helm-chart | Out-Null
& $helm repo update | Out-Null

& $helm upgrade --install `
  opencost `
  opencost/opencost `
  --namespace opencost-system `
  --create-namespace `
  -f $values `
  --timeout 20m

kubectl rollout status deployment/opencost -n opencost-system --timeout=20m
kubectl get svc -n opencost-system
