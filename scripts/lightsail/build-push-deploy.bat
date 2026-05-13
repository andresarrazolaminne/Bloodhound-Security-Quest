@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Carpeta de este script: aquí deben estar lightsailctl.exe, containers.json y public-endpoint.json (por defecto)
set "SCRIPT_DIR=%~dp0"

REM Raíz del repo (este .bat vive en scripts\lightsail)
cd /d "%SCRIPT_DIR%..\.." || exit /b 1
set "ROOT=%CD%"

REM Ruta de lightsailctl y JSON (override: set LIGHTSAIL_DIR=... antes de llamar al .bat)
if not defined LIGHTSAIL_DIR set "LIGHTSAIL_DIR=%SCRIPT_DIR%"
if not exist "%LIGHTSAIL_DIR%" (
  echo ERROR: no existe LIGHTSAIL_DIR=%LIGHTSAIL_DIR%
  exit /b 1
)

REM lightsailctl junto al .bat para que aws lightsail push-container-image lo encuentre
if not exist "%LIGHTSAIL_DIR%lightsailctl.exe" if not exist "%LIGHTSAIL_DIR%\lightsailctl.exe" (
  echo ADVERTENCIA: no se encontro lightsailctl.exe en %LIGHTSAIL_DIR%
  echo Coloca lightsailctl.exe en esa carpeta o define LIGHTSAIL_DIR.
)

REM Asegura que aws encuentre lightsailctl
set "PATH=%LIGHTSAIL_DIR%;%PATH%"

REM Carga scripts\lightsail\.env (líneas KEY=VAL, ignora #; primer = separa clave del valor)
if exist "scripts\lightsail\.env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("scripts\lightsail\.env") do (
    if not "%%A"=="" set "%%A=%%~B"
  )
)

REM Claves S3 del .env solo para containers.json. Si quedan como AWS_ACCESS_KEY_ID en este CMD,
REM la CLI las aplica a todos los "aws" y anulan ~/.aws (parece que "solo quieres usar S3-rw").
if defined AWS_ACCESS_KEY_ID (
  set "CONTAINER_AWS_ACCESS_KEY_ID=!AWS_ACCESS_KEY_ID!"
  set "AWS_ACCESS_KEY_ID="
)
if defined AWS_SECRET_ACCESS_KEY (
  set "CONTAINER_AWS_SECRET_ACCESS_KEY=!AWS_SECRET_ACCESS_KEY!"
  set "AWS_SECRET_ACCESS_KEY="
)

REM Valores por defecto (ajusta SERVICE_NAME si tu servicio no es "bloodhound-prod")
if not defined AWS_REGION set "AWS_REGION=us-east-1"
if not defined SERVICE_NAME set "SERVICE_NAME=bloodhound-prod"
if not defined CONTAINER_NAME set "CONTAINER_NAME=app"
if not defined CONTAINER_PORT set "CONTAINER_PORT=5000"
if not defined VITE_BASE_PATH set "VITE_BASE_PATH=/"
if not defined NODE_ENV set "NODE_ENV=production"
if not defined PORT set "PORT=5000"
if not defined UI_BASE_PATH set "UI_BASE_PATH=/"
if not defined UPLOADS_DIR set "UPLOADS_DIR=/app/uploads"
if not defined UPLOADS_BACKEND set "UPLOADS_BACKEND=local"
if not defined VITE_ADMIN_API_TOKEN set "VITE_ADMIN_API_TOKEN=admin123"

for /f "delims=" %%G in ('git -C "%ROOT%" rev-parse --short HEAD 2^>nul') do set "TAG=%%G"
if not defined TAG set "TAG=deploy"

set "IMAGE_LOCAL=bloodhound:!TAG!"

REM SKIP_LIGHTSAIL_DEPLOY=1 : solo Docker build + push al registry de Lightsail (no create-container-service-deployment).
REM   Útil si aws usa un usuario solo S3/push; el deploy exige IAM p. ej. lightsail:CreateContainerServiceDeployment.
REM SKIP_DEPLOY_WAIT=1 : no esperar a que termine un deployment anterior (o sin permiso GetContainerServices).

REM Este script carga scripts\lightsail\.env para AWS y DB; si ese archivo define DOCKER_* o viene
REM de sesiones antiguas, la CLI puede apuntar al motor equivocado pese a que Docker Desktop funcione.
REM Para build/push usamos siempre el motor local por defecto (npipe/desktop-linux).
set "DOCKER_HOST="
set "DOCKER_CONTEXT="

REM Comprobaciones mínimas
where docker >nul 2>&1 || (echo ERROR: docker no está en PATH & exit /b 1)
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: el motor de Docker no responde ^(comprueba Docker Desktop encendido^).
  echo        Salida de diagnóstico:
  docker info 2>&1
  exit /b 1
)
where aws >nul 2>&1 || (echo ERROR: aws CLI no está en PATH & exit /b 1)

if "%DATABASE_URL%"=="" (
  echo ERROR: define DATABASE_URL en scripts\lightsail\.env
  exit /b 1
)
if "%ADMIN_API_TOKEN%"=="" (
  echo ERROR: define ADMIN_API_TOKEN en scripts\lightsail\.env
  exit /b 1
)
if "%QUIZ_CHALLENGE_SECRET%"=="" (
  echo ERROR: define QUIZ_CHALLENGE_SECRET en scripts\lightsail\.env
  exit /b 1
)

echo ==^> Build Docker: !IMAGE_LOCAL!
docker build ^
  --build-arg "VITE_BASE_PATH=%VITE_BASE_PATH%" ^
  --build-arg "VITE_ADMIN_API_TOKEN=%VITE_ADMIN_API_TOKEN%" ^
  -t "!IMAGE_LOCAL!" ^
  "%ROOT%" || exit /b 1

echo ==^> Push imagen a Lightsail y capturar referencia: !IMAGE_LOCAL!
for /f "delims=" %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%push-container-image-capture.ps1" -Region "!AWS_REGION!" -ServiceName "!SERVICE_NAME!" -Label "app" -LocalImage "!IMAGE_LOCAL!"') do set "LS_IMAGE=%%I"
if "!LS_IMAGE!"=="" (
  echo ERROR: no se pudo obtener imagen desde Lightsail
  exit /b 1
)
if "!LS_IMAGE!"=="None" (
  echo ERROR: Lightsail devolvió imagen None
  exit /b 1
)
echo     Imagen despliegue: !LS_IMAGE!

REM Genera JSON en LIGHTSAIL_DIR (misma carpeta que este .bat por defecto); PowerShell hereda variables de este CMD
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = $env:LIGHTSAIL_DIR;" ^
  "$img = $env:LS_IMAGE;" ^
  "$cn = $env:CONTAINER_NAME;" ^
  "$port = [int]$env:CONTAINER_PORT;" ^
  "$portKey = [string]$env:CONTAINER_PORT;" ^
  "$ports = [ordered]@{}; $ports[$portKey] = 'HTTP';" ^
  "$containers = [ordered]@{ $cn = [ordered]@{ image = $img; ports = $ports; environment = [ordered]@{ NODE_ENV = $env:NODE_ENV; PORT = $env:PORT; UI_BASE_PATH = $env:UI_BASE_PATH; UPLOADS_DIR = $env:UPLOADS_DIR; DEFAULT_CAMPAIGN_SLUG = $env:DEFAULT_CAMPAIGN_SLUG; DATABASE_URL = $env:DATABASE_URL; ADMIN_API_TOKEN = $env:ADMIN_API_TOKEN; QUIZ_CHALLENGE_SECRET = $env:QUIZ_CHALLENGE_SECRET; UPLOADS_BACKEND = $env:UPLOADS_BACKEND; S3_BUCKET = $env:S3_BUCKET; S3_REGION = $env:S3_REGION; S3_PREFIX = $env:S3_PREFIX; S3_PUBLIC_BASE_URL = $env:S3_PUBLIC_BASE_URL; AWS_ACCESS_KEY_ID = $env:CONTAINER_AWS_ACCESS_KEY_ID; AWS_SECRET_ACCESS_KEY = $env:CONTAINER_AWS_SECRET_ACCESS_KEY } } };" ^
  "$public = [ordered]@{ containerName = $cn; containerPort = $port; healthCheck = [ordered]@{ path = '/api/health'; successCodes = '200-499'; intervalSeconds = 10; timeoutSeconds = 5; healthyThreshold = 2; unhealthyThreshold = 2 } };" ^
  "$containersJson = $containers | ConvertTo-Json -Depth 20 -Compress;" ^
  "$publicJson = $public | ConvertTo-Json -Depth 20 -Compress;" ^
  "$enc = New-Object System.Text.UTF8Encoding $false;" ^
  "[System.IO.File]::WriteAllText((Join-Path $dir 'containers.json'), $containersJson, $enc);" ^
  "[System.IO.File]::WriteAllText((Join-Path $dir 'public-endpoint.json'), $publicJson, $enc);"

if errorlevel 1 exit /b 1

if "%SKIP_LIGHTSAIL_DEPLOY%"=="1" (
  echo.
  echo OK: Build y push al registry de Lightsail listos ^(la imagen SÍ se subió^).
  echo     Referencia para la consola o API: !LS_IMAGE!
  echo     Entorno generado: %LIGHTSAIL_DIR%containers.json
  echo     Para aplicar cambios en el servicio hace falta un usuario IAM con permisos Lightsail ^(p. ej. CreateContainerServiceDeployment^), no solo S3.
  echo     Quita SKIP_LIGHTSAIL_DEPLOY o usa otro AWS_PROFILE para el paso de deploy.
  endlocal
  exit /b 0
)

REM Lightsail no acepta dos deployments a la vez; esperar al anterior si sigue en curso
if not "%SKIP_DEPLOY_WAIT%"=="1" (
  echo ==^> Esperar si hay deployment en curso en Lightsail...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%wait-for-lightsail-idle.ps1" -Region "!AWS_REGION!" -ServiceName "!SERVICE_NAME!" || exit /b 1
)

echo ==^> Crear deployment en Lightsail
echo     carpeta: %LIGHTSAIL_DIR%
pushd "%LIGHTSAIL_DIR%" || exit /b 1
aws lightsail create-container-service-deployment ^
  --region "%AWS_REGION%" ^
  --service-name "%SERVICE_NAME%" ^
  --containers file://containers.json ^
  --public-endpoint file://public-endpoint.json
set "DEPLOY_ERR=!ERRORLEVEL!"
popd
if not "!DEPLOY_ERR!"=="0" (
  echo.
  echo ------------------------------------------------------------------
  echo Deploy fallo ^(p. ej. AccessDenied CreateContainerServiceDeployment^).
  echo   - La imagen puede haberse subido al registry ^(ver "Imagen despliegue" arriba^).
  echo   - Las claves AWS del .env solo entran en containers.json; la CLI usa ~/.aws.
  echo.
  echo Que hacer:
  echo   1^) Usuario/rol IAM con permisos Lightsail o AWS_PROFILE correcto en .env.
  echo   2^) SKIP_LIGHTSAIL_DEPLOY=1 y deployment manual con %LIGHTSAIL_DIR%containers.json
  echo ------------------------------------------------------------------
  exit /b 1
)

echo OK: despliegue enviado. Revisa estado con:
echo   aws lightsail get-container-services --region %AWS_REGION% --service-name %SERVICE_NAME%

endlocal
exit /b 0
