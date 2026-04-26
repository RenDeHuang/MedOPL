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

  try {
    $authUser = Invoke-WebRequest -UseBasicParsing "https://$OplHost/api/auth/user"
    throw "Expected OPL Gateway /api/auth/user without launch cookie to return 401, got $($authUser.StatusCode)."
  } catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -ne 401) {
      throw "Expected OPL Gateway /api/auth/user without launch cookie to return 401, got $statusCode."
    }
    Write-Host "OPL Gateway /api/auth/user without launch cookie: 401"
  }
}

Write-Host "TKE smoke verification finished."
