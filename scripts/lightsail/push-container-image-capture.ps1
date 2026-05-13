param(
  [Parameter(Mandatory = $true)][string]$Region,
  [Parameter(Mandatory = $true)][string]$ServiceName,
  [Parameter(Mandatory = $true)][string]$Label,
  [Parameter(Mandatory = $true)][string]$LocalImage
)

$ErrorActionPreference = "Continue"

$output = & aws lightsail push-container-image `
  --region $Region `
  --service-name $ServiceName `
  --label $Label `
  --image $LocalImage `
  2>&1

$text = ($output | ForEach-Object { $_.ToString() }) -join "`n"

if ($LASTEXITCODE -ne 0) {
  Write-Host $text
  Write-Error "aws lightsail push-container-image falló (código $LASTEXITCODE)."
  exit $LASTEXITCODE
}

$m = [regex]::Match(
  $text,
  'Refer to this image as "([^"]+)"',
  [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)
if ($m.Success) {
  Write-Output $m.Groups[1].Value.Trim()
  exit 0
}

Write-Host $text
Write-Host ""
Write-Host "No se encontró la referencia en la salida del push. Probando get-container-images (requiere IAM lightsail:GetContainerImages)..."

$jsonText = aws lightsail get-container-images --region $Region --service-name $ServiceName --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $jsonText) {
  try {
    $parsed = $jsonText | ConvertFrom-Json
    $imgs = $parsed.containerImages
    if ($imgs -and $imgs.Count -ge 1) {
      $latest = $imgs | Sort-Object { $_.createdAt } | Select-Object -Last 1
      if ($latest.image) {
        Write-Output $latest.image
        exit 0
      }
    }
  }
  catch {
    # ignore
  }
}

Write-Error @'
No se pudo obtener la referencia de imagen. Revisa la salida del push (debe incluir Refer to this image as ":servicio.label.N").
Opcional: IAM lightsail:GetContainerImages como respaldo si el parseo falla.
'@
exit 1
