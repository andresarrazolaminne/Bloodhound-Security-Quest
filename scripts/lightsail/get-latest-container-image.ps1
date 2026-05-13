param(
  [Parameter(Mandatory = $true)][string]$Region,
  [Parameter(Mandatory = $true)][string]$ServiceName
)
$ErrorActionPreference = "Stop"
$json = aws lightsail get-container-images --region $Region --service-name $ServiceName --output json
$parsed = $json | ConvertFrom-Json
$imgs = $parsed.containerImages
if (-not $imgs -or $imgs.Count -lt 1) { exit 1 }
$latest = $imgs | Sort-Object { $_.createdAt } | Select-Object -Last 1
if (-not $latest.image) { exit 1 }
Write-Output $latest.image
