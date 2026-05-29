# API FastAPI + frontend integrado (puerto 8000)
Set-Location "$PSScriptRoot\..\backend"
if (-not (Test-Path ".venv")) {
  python -m venv .venv
  .\.venv\Scripts\pip install -r requirements.txt
}
.\.venv\Scripts\Activate.ps1
Write-Host "TPPMAPS full stack: http://localhost:8000/"
uvicorn app.main:app --reload --port 8000
