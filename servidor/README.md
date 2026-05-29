# MoviMed Backend

API FastAPI para tppmaps (rutas, reportes, telemetría).

## Desarrollo

```powershell
cd d:\ttpmap\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- App + frontend: http://localhost:8000/
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health
