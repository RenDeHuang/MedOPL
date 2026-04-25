param(
  [string]$Namespace = "portal-staging",
  [string]$PortalHost = "",
  [string]$OplHost = ""
)

$ErrorActionPreference = "Stop"

kubectl get ns $Namespace | Out-Host
kubectl -n $Namespace get deploy,svc,ingress,pod | Out-Host

$deployments = @(
  "portal",
  "portal-opl-adapter",
  "opl-web-upstream",
  "opl-web-gateway",
  "billing-aggregator",
  "med-autoscience-runner"
)

foreach ($name in $deployments) {
  kubectl -n $Namespace rollout status "deploy/$name" --timeout=180s | Out-Host
}

if ($PortalHost) {
  $portalHealth = Invoke-WebRequest -UseBasicParsing "https://$PortalHost/healthz"
  Write-Host "Portal /healthz: $($portalHealth.StatusCode)"
}

if ($OplHost) {
  $gatewayHealth = Invoke-WebRequest -UseBasicParsing "https://$OplHost/healthz"
  Write-Host "OPL Gateway /healthz: $($gatewayHealth.StatusCode)"
}

Write-Host "TKE smoke verification finished."

