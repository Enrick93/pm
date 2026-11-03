# Native command failures are checked via $LASTEXITCODE; "Stop" would abort on docker's stderr in Windows PowerShell 5.1.
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-app .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker rm -f pm-app *> $null
$envFile = @()
if (Test-Path .env) { $envFile = @("--env-file", ".env") }
docker run -d --name pm-app -p 8000:8000 @envFile -v pm-data:/app/data pm-app
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Running at http://localhost:8000"
