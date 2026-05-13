param(
  [Parameter(Mandatory = $true)][string]$Region,
  [Parameter(Mandatory = $true)][string]$ServiceName,
  [int]$IntervalSeconds = 15,
  [int]$MaxWaitSeconds = 600
)

$ErrorActionPreference = "Continue"
$deadline = (Get-Date).AddSeconds($MaxWaitSeconds)

function Get-ServiceStateJson {
  $output = & aws lightsail get-container-services --region $Region --service-name $ServiceName --output json 2>&1
  $text = ($output | ForEach-Object { $_.ToString() }) -join "`n"
  return @{ ExitCode = $LASTEXITCODE; Text = $text }
}

while ((Get-Date) -lt $deadline) {
  $r = Get-ServiceStateJson
  if ($r.ExitCode -ne 0) {
    if ($r.Text -match "(?i)AccessDeniedException|not authorized") {
      Write-Warning "Sin permiso IAM para lightsail:GetContainerServices. Se omite la espera (no se puede comprobar si hay deploy en curso). Si create-container-service-deployment falla por conflicto, espera en la consola Lightsail y vuelve a ejecutar, o usa un usuario con permisos Lightsail."
      exit 0
    }
    Write-Error "get-container-services falló ($($r.ExitCode)): $($r.Text)"
    exit 1
  }

  try {
    $j = $r.Text | ConvertFrom-Json
  } catch {
    Write-Error "Respuesta no JSON de AWS: $($r.Text)"
    exit 1
  }

  $cs = @($j.containerServices)[0]
  if (-not $cs) {
    Write-Error "Servicio no encontrado: $ServiceName (revisa SERVICE_NAME en scripts/lightsail/.env; debe coincidir con el nombre en Lightsail)."
    exit 1
  }

  $state = [string]$cs.state
  $nd = $cs.nextDeployment

  if ($state -ne "DEPLOYING" -and $null -eq $nd) {
    Write-Output "OK: servicio listo (state=$state)."
    exit 0
  }

  $ndMsg = if ($nd) { "nextDeployment v$($nd.version) state=$($nd.state)" } else { "nextDeployment=null" }
  Write-Host "Esperando fin de deployment en curso: serviceState=$state $ndMsg (siguiente chequeo en ${IntervalSeconds}s)..."
  Start-Sleep -Seconds $IntervalSeconds
}

Write-Error "Timeout (${MaxWaitSeconds}s): sigue un deployment en curso en $ServiceName. Revisa la consola de Lightsail."
exit 1
