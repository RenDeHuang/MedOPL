param(
  [string]$RegistryNamespace = "uswccr.ccs.tencentyun.com/gaofenglab",
  [string]$Username = "100047070895",
  [string]$ImageTar = ".\images\opl-tke-images-opl-v1.tar",
  [switch]$SkipLogin
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $ImageTar)) {
  throw "Image tar not found: $ImageTar"
}

$sourceRepo = "uswccr.ccs.tencentyun.com/gaofenglab/opl"
$images = @(
  @{ Source = "$sourceRepo`:portal-opl-v1"; Target = "$RegistryNamespace/portal-opl:opl-v1" },
  @{ Source = "$sourceRepo`:portal-opl-adapter-opl-v1"; Target = "$RegistryNamespace/portal-opl-adapter-opl:opl-v1" },
  @{ Source = "$sourceRepo`:opl-web-gateway-opl-v1"; Target = "$RegistryNamespace/opl-web-gateway-opl:opl-v1" },
  @{ Source = "$sourceRepo`:opl-web-opl-v1"; Target = "$RegistryNamespace/opl-web-opl:opl-v1" },
  @{ Source = "$sourceRepo`:billing-aggregator-opl-v1"; Target = "$RegistryNamespace/billing-aggregator-opl:opl-v1" },
  @{ Source = "$sourceRepo`:med-autoscience-runner-orchestrator-opl-v1"; Target = "$RegistryNamespace/med-autoscience-runner-orchestrator-opl:opl-v1" },
  @{ Source = "$sourceRepo`:med-autoscience-runner-opl-v1"; Target = "$RegistryNamespace/med-autoscience-runner-opl:opl-v1" }
)

docker load -i $ImageTar

if (!$SkipLogin) {
  if (!$Username) {
    throw "Pass -Username <TCR login username>. TCR username is the Tencent Cloud account, not the namespace."
  }
  if (!$env:TCR_PASSWORD) {
    throw "Set TCR_PASSWORD in the current shell before running this script."
  }
  $registryHost = $RegistryNamespace.Split("/")[0]
  $env:TCR_PASSWORD | docker login $registryHost --username $Username --password-stdin
}

foreach ($image in $images) {
  Write-Host "Tagging $($image.Source) -> $($image.Target)" -ForegroundColor Cyan
  docker tag $image.Source $image.Target
}

foreach ($image in $images) {
  Write-Host "Pushing $($image.Target)" -ForegroundColor Cyan
  docker push $image.Target
}

Write-Host "All split-repository images pushed." -ForegroundColor Green
