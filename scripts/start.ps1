$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-app .
docker rm -f pm-app 2>$null
$envFile = @()
if (Test-Path .env) { $envFile = @("--env-file", ".env") }
docker run -d --name pm-app -p 8000:8000 @envFile -v pm-data:/app/data pm-app
Write-Host "Running at http://localhost:8000"
