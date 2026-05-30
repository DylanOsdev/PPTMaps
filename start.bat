@echo off
REM Iniciar Backend
echo Iniciando Backend...
cd backend
if not exist "..\venv" (
    echo Creando entorno virtual...
    python -m venv ..\venv
)
call ..\venv\Scripts\activate.bat
echo Instalando dependencias del backend si es necesario...
pip install -r requirements.txt
start "FastAPI Backend" cmd /c "uvicorn app.main:app --reload --port 8000"
cd ..

REM Construir Frontend
echo Construyendo Frontend para FastAPI...
cd frontend
if not exist "node_modules" (
    echo Instalando dependencias del frontend...
    call npm install
)
call npm run build
cd ..

echo Aplicacion iniciada.
echo Servidor Unificado:  http://localhost:8000
echo Cierra las ventanas de la terminal para detener el servidor.
pause
