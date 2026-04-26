param(
  [string]$RegistryNamespace = "uswccr.ccs.tencentyun.com/gaofenglab",
  [string]$Username = "100047070895",
  [string]$ImageTar = ".\images\opl-tke-images-opl-v10.tar",
  [switch]$SkipLogin
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $ImageTar)) {
  throw "Image tar not found: $ImageTar"
}

$sourceRepo = "uswccr.ccs.tencentyun.com/gaofenglab/opl"
$images = @(
  @{ Source = "$sourceRepo`:portal-opl-v10"; Target = "$RegistryNamespace/portal-opl:opl-v10" },
  @{ Source = "$sourceRepo`:portal-opl-adapter-opl-v10"; Target = "$RegistryNamespace/portal-opl-adapter-opl:opl-v10" },
  @{ Source = "$sourceRepo`:opl-web-gateway-opl-v10"; Target = "$RegistryNamespace/opl-web-gateway-opl:opl-v10" },
  @{ Source = "$sourceRepo`:opl-web-opl-v10"; Target = "$RegistryNamespace/opl-web-opl:opl-v10" },
  @{ Source = "$sourceRepo`:billing-aggregator-opl-v10"; Target = "$RegistryNamespace/billing-aggregator-opl:opl-v10" },
  @{ Source = "$sourceRepo`:resource-provisioner-opl-v10"; Target = "$RegistryNamespace/resource-provisioner-opl:opl-v10" },
  @{ Source = "$sourceRepo`:med-autoscience-runner-orchestrator-opl-v10"; Target = "$RegistryNamespace/med-autoscience-runner-orchestrator-opl:opl-v10" },
  @{ Source = "$sourceRepo`:med-autoscience-runner-opl-v10"; Target = "$RegistryNamespace/med-autoscience-runner-opl:opl-v10" }
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
