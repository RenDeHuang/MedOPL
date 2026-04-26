param(
  [string]$RegistryNamespace = "uswccr.ccs.tencentyun.com/gaofenglab",
  [string]$Username = "100047070895",
  [string]$Tag = "opl-v10",
  [switch]$SkipLogin,
  [switch]$SkipOplWeb,
  [string]$OplWebSource = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Step($Name, $Script) {
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Script
}

if (!$SkipLogin) {
  if (!$env:TCR_PASSWORD) {
    throw "Set TCR_PASSWORD in the current shell before running this script, or run with -SkipLogin if Docker is already logged in."
  }
  Invoke-Step "docker login $RegistryNamespace" {
    $registryHost = $RegistryNamespace.Split("/")[0]
    $env:TCR_PASSWORD | docker login $registryHost --username $Username --password-stdin
  }
}

$images = @(
  @{ Name = "portal"; Dockerfile = ".\build\dockerfiles\portal.Dockerfile"; Image = "$RegistryNamespace/portal-opl:$Tag" },
  @{ Name = "portal-opl-adapter"; Dockerfile = ".\build\dockerfiles\opl-runtime-bridge.Dockerfile"; Image = "$RegistryNamespace/portal-opl-adapter-opl:$Tag" },
  @{ Name = "opl-web-gateway"; Dockerfile = ".\build\dockerfiles\opl-web-gateway.Dockerfile"; Image = "$RegistryNamespace/opl-web-gateway-opl:$Tag" },
  @{ Name = "billing-aggregator"; Dockerfile = ".\build\dockerfiles\billing-aggregator.Dockerfile"; Image = "$RegistryNamespace/billing-aggregator-opl:$Tag" },
  @{ Name = "resource-provisioner"; Dockerfile = ".\build\dockerfiles\resource-provisioner.Dockerfile"; Image = "$RegistryNamespace/resource-provisioner-opl:$Tag" },
  @{ Name = "med-autoscience-runner-orchestrator"; Dockerfile = ".\build\dockerfiles\med-autoscience-runner-orchestrator.Dockerfile"; Image = "$RegistryNamespace/med-autoscience-runner-orchestrator-opl:$Tag" }
)

foreach ($image in $images) {
  Invoke-Step "build $($image.Name)" {
    docker build -f $image.Dockerfile -t $image.Image .
  }
  Invoke-Step "push $($image.Name)" {
    docker push $image.Image
  }
}

$localWorkloadImage = "dify_bundle-med-autoscience:latest"
$workloadImage = "$RegistryNamespace/med-autoscience-runner-opl:$Tag"
if (docker images -q $localWorkloadImage) {
  Invoke-Step "tag workload runner" {
    docker tag $localWorkloadImage $workloadImage
  }
  Invoke-Step "push workload runner" {
    docker push $workloadImage
  }
} else {
  Write-Host "Skipping workload runner image: $localWorkloadImage not found locally." -ForegroundColor Yellow
}

if (!$SkipOplWeb) {
  if (!$OplWebSource) {
    $candidates = @(
      (Join-Path (Get-Location) ".runtime\opl-aion-shell-full"),
      (Join-Path (Get-Location) "source\.runtime\opl-aion-shell-full"),
      (Join-Path (Get-Location) "..\.runtime\opl-aion-shell-full"),
      (Join-Path (Split-Path -Parent $PSScriptRoot) "source\.runtime\opl-aion-shell-full")
    )
    foreach ($candidate in $candidates) {
      if (Test-Path (Join-Path $candidate "Dockerfile")) {
        $OplWebSource = $candidate
        break
      }
    }
  }
  if (!$OplWebSource -or !(Test-Path (Join-Path $OplWebSource "Dockerfile"))) {
    throw "OPL Web source with Dockerfile not found. Pass -OplWebSource <path> or use -SkipOplWeb."
  }
  $oplWebImage = "$RegistryNamespace/opl-web-opl:$Tag"
  Invoke-Step "build opl-web-upstream" {
    docker build -t $oplWebImage $OplWebSource
  }
  Invoke-Step "push opl-web-upstream" {
    docker push $oplWebImage
  }
}

Write-Host "All requested split-repository images pushed to $RegistryNamespace" -ForegroundColor Green
