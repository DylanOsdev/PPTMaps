#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

echo "╔══════════════════════════════════════════════════════╗"
echo "║         MoviMed — Inicio Rápido (Linux)             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 1. Verificar PostgreSQL
echo "[1/4] Verificando PostgreSQL..."
if command -v pg_isready &>/dev/null && pg_isready -q 2>/dev/null; then
    echo "  ✅ PostgreSQL está corriendo."
else
    echo "  ⚠️  PostgreSQL no está accesible."
    echo "     Para iniciarlo: sudo systemctl start postgresql"
    echo "     La app se iniciará pero los datos no estarán disponibles."
fi

# 2. Verificar la autenticación de PostgreSQL
echo ""
echo "[2/4] Verificando pg_hba.conf..."
PG_HBA=$(find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
if [ -n "$PG_HBA" ]; then
    if grep -q "local.*postgres.*ident" "$PG_HBA" 2>/dev/null; then
        echo "  ⚠️  pg_hba.conf usa autenticación 'ident'. Cambiando a 'md5'..."
        echo "     Para arreglar permanentemente:"
        echo "     sudo sed -i 's/local.*all.*all.*peer/local all all md5/' $PG_HBA"
        echo "     sudo sed -i 's/local.*postgres.*ident/local postgres postgres md5/' $PG_HBA"
        echo "     sudo systemctl restart postgresql"
        echo ""
        echo "  Temporal: usando usuario del sistema 'postgres'"
    else
        echo "  ✅ pg_hba.conf configurado correctamente."
    fi
else
    echo "  ⚠️  No se encontró pg_hba.conf. PostgreSQL puede no estar instalado."
fi

# 3. Construir frontend (Vite → dist/)
echo ""
echo "[3/4] Construyendo frontend..."
cd "$FRONTEND_DIR"
npm run build 2>&1 | tail -3
echo "  ✅ Frontend compilado en dist/"

# 4. Iniciar servidor
echo ""
echo "[4/4] Iniciando servidor..."
echo ""
echo "  🌐 Abrir en el navegador: http://localhost:8000"
echo "  📖 Documentación API:    http://localhost:8000/docs"
echo ""

cd "$BACKEND_DIR"

# Activar virtualenv si existe
if [ -f .venv/bin/activate ]; then
    source .venv/bin/activate
fi

exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
