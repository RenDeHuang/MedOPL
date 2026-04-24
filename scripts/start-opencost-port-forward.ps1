$ErrorActionPreference = "Stop"

$localPort = $env:OPENCOST_LOCAL_PORT
if (-not $localPort) {
  $localPort = "9003"
}

$namespace = $env:OPENCOST_NAMESPACE
if (-not $namespace) {
  $namespace = "opencost-system"
}

$service = $env:OPENCOST_SERVICE
if (-not $service) {
  $service = "opencost"
}

Write-Host "Starting OpenCost port-forward: localhost:$localPort -> svc/$service:9003 in namespace $namespace"
kubectl port-forward -n $namespace "svc/$service" "$localPort`:9003"
