# API + cliente + conexión a PostgreSQL (Docker recomendado)
Set-Location "$PSScriptRoot\..\servidor"
if (-not (Test-Path ".venv")) {
  python -m venv .venv
  .\.venv\Scripts\pip install -r requirements.txt
}
Copy-Item ..\.env.example .env -ErrorAction SilentlyContinue
.\.venv\Scripts\Activate.ps1
$env:HOST = "0.0.0.0"
Write-Host "tppmaps en http://0.0.0.0:8000 (accesible desde tu red local)"
uvicorn aplicacion.principal:app --host 0.0.0.0 --port 8000 --reload
