$ErrorActionPreference = "SilentlyContinue"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$log = Join-Path $repo ".runtime\minio-portforward.log"

Get-NetTCPConnection -LocalPort 30091,30092 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    try { Stop-Process -Id $_ -Force } catch {}
  }

Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-Command",
  "kubectl port-forward svc/minio -n minio-system 30091:9000 30092:9001 > `"$log`" 2>&1"
)
