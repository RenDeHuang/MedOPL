param(
  [Parameter(Mandatory = $true)][string]$UserId,
  [Parameter(Mandatory = $true)][string]$TaskSlug,
  [Parameter(Mandatory = $true)][string]$Kind,
  [Parameter(Mandatory = $true)][string]$FilePath,
  [string]$RelativePath = ""
)

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$mc = Join-Path $repo ".runtime\tools\mc.exe"

if (-not (Test-Path $mc)) {
  throw "mc not found at $mc"
}

& $mc alias set localminio http://127.0.0.1:30091 minioadmin MinioAdmin123! | Out-Null
& $mc mb --ignore-existing localminio/workspaces | Out-Null

$name = if ([string]::IsNullOrWhiteSpace($RelativePath)) {
  Split-Path $FilePath -Leaf
} else {
  $RelativePath.Replace("\", "/").TrimStart("/")
}

if ($name.Contains("..")) {
  throw "RelativePath must not contain '..'"
}

$target = "localminio/workspaces/$UserId/$TaskSlug/$Kind/$name"

& $mc cp $FilePath $target | Out-Null
Write-Output $target
