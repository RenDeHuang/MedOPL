param(
  [string]$EnvFile = ".\env\tke.env",
  [string]$TemplateDir = ".\manifests",
  [string]$OutDir = ".\rendered"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}
if (!(Test-Path $TemplateDir)) {
  throw "Template dir not found: $TemplateDir"
}

$vars = @{}
Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (!$line -or $line.StartsWith("#")) { return }
  $idx = $line.IndexOf("=")
  if ($idx -lt 0) { return }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1)
  if ($key) { $vars[$key] = $value }
}

if (Test-Path $OutDir) {
  Remove-Item -Recurse -Force $OutDir
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$templateRoot = (Resolve-Path $TemplateDir).Path
Get-ChildItem -Path $TemplateDir -Recurse -File -Include *.yaml,*.yml | ForEach-Object {
  $relative = $_.FullName.Substring($templateRoot.Length).TrimStart("\", "/")
  $target = Join-Path $OutDir $relative
  $targetDir = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

  $content = Get-Content -Raw -Path $_.FullName
  foreach ($key in $vars.Keys) {
    $content = $content.Replace("__$($key)__", [string]$vars[$key])
  }
  Set-Content -Path $target -Value $content -Encoding utf8
}

$renderedFiles = Get-ChildItem -Path $OutDir -Recurse -File -Include *.yaml,*.yml
$unresolved = $renderedFiles | Select-String -Pattern "__[A-Z0-9_]+__" -ErrorAction SilentlyContinue
if ($unresolved) {
  Write-Host "Unresolved placeholders:" -ForegroundColor Yellow
  $unresolved | Select-Object Path, LineNumber, Line | Format-Table -AutoSize
  throw "Render completed with unresolved placeholders."
}

Write-Host "Rendered manifests to $OutDir"
