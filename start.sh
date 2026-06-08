#!/usr/bin/env bash
# start.sh — TPPMaps Inicio Rápido (Linux)
set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

# ── Trampa global: si algo falla inesperadamente, muestra el error y pausa ──
trap 'echo ""; echo "❌ El script falló en la línea $LINENO."; echo "   Presiona Enter para cerrar..."; read -r _; exit 1' ERR

echo "╔══════════════════════════════════════════════════════╗"
echo "║         TPPMaps — Inicio Rápido (Linux)             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────
# Seleccionar Python disponible
# ─────────────────────────────────────────────
PYTHON_BIN=""
for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" &>/dev/null; then
        PYTHON_BIN="$candidate"
        break
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo "❌ ERROR: No se encontró Python 3. Instálalo con:"
    echo "     sudo dnf install -y python3"
    echo ""
    echo "Presiona Enter para cerrar..."
    read -r _
    exit 1
fi
echo "✅ Usando $($PYTHON_BIN --version)"
echo ""

# ─────────────────────────────────────────────
# [1/4] Verificar PostgreSQL e intentar iniciarlo
# ─────────────────────────────────────────────
echo "[1/4] Verificando PostgreSQL..."

PG_AVAILABLE=0
if command -v pg_isready &>/dev/null; then
    if pg_isready -q 2>/dev/null; then
        PG_AVAILABLE=1
    fi
    # Docker PostgreSQL (puerto explícito)
    if [ "$PG_AVAILABLE" -eq 0 ] && pg_isready -h localhost -p 5432 -q 2>/dev/null; then
        PG_AVAILABLE=1
    fi
fi

# Verificar que la BD movimed sea accesible
PG_READY=0
if [ "$PG_AVAILABLE" -eq 1 ]; then
    if command -v psql &>/dev/null; then
        if PGPASSWORD=postgres psql -h localhost -U postgres -d movimed -c "SELECT 1" -q 2>/dev/null; then
            PG_READY=1
        fi
    fi
fi

if [ "$PG_READY" -eq 1 ]; then
    echo "  ✅ PostgreSQL activo — BD 'movimed' lista."
elif [ "$PG_AVAILABLE" -eq 1 ]; then
    echo "  ⚠️  PostgreSQL accesible pero falta la BD 'movimed'."
    echo "     Ejecuta: sudo bash backend/scripts/setup/setup_db.sh"
else
    echo "  ℹ️  PostgreSQL no está corriendo."
    echo "     La BD se necesita solo para el backend (conductores, reportes, etc.)."
fi

# ─────────────────────────────────────────────
# [2/4] Verificar pg_hba.conf (solo si PostgreSQL está activo)
# ─────────────────────────────────────────────
echo ""
echo "[2/4] Verificando credenciales PostgreSQL..."

if [ "$PG_READY" -eq 1 ]; then
    PG_AUTH_OK=0
    if PGPASSWORD=postgres psql -h localhost -U postgres -d movimed -c "SELECT 1" -q 2>/dev/null; then
        PG_AUTH_OK=1
    fi

    if [ "$PG_AUTH_OK" -eq 1 ]; then
        echo "  ✅ Credenciales correctas (postgres:postgres @ localhost:5432/movimed)."
    else
        echo "  ⚠️  No se pudo autenticar con postgres:postgres."
        echo "     Verifica la contraseña en backend/app/core/config.py"
    fi
else
    echo "  ℹ️  PostgreSQL no disponible — se omite verificación de credenciales."
fi

# ─────────────────────────────────────────────
# [3/4] Construir frontend (Vite → dist/)
# ─────────────────────────────────────────────
echo ""
echo "[3/4] Construyendo frontend..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "  Instalando dependencias del frontend..."
    npm install || { echo "  ❌ npm install falló."; }
fi

# Desactivar ERR trap temporalmente para el build (puede retornar código != 0 con warnings)
trap '' ERR
npm run build 2>&1 | tail -5
BUILD_EXIT=${PIPESTATUS[0]}
trap 'echo ""; echo "❌ El script falló en la línea $LINENO."; echo "   Presiona Enter para cerrar..."; read -r _; exit 1' ERR

if [ "$BUILD_EXIT" -eq 0 ]; then
    echo "  ✅ Frontend compilado en dist/"
else
    echo "  ⚠️  El build del frontend tuvo errores (ver salida arriba). Continuando..."
fi

# ─────────────────────────────────────────────
# [4/4] Iniciar servidor backend
# ─────────────────────────────────────────────
echo ""
echo "[4/4] Iniciando servidor..."
echo ""
echo "   🌐  Abrir en el navegador: http://localhost:8000"
echo "   📖  Documentación API:    http://localhost:8000/docs"
echo ""

cd "$ROOT_DIR"

# Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "  Creando entorno virtual con $PYTHON_BIN..."
    "$PYTHON_BIN" -m venv venv
fi

source venv/bin/activate

# Solo instalar dependencias si requirements.txt cambió o es la primera vez
SENTINEL="$ROOT_DIR/venv/.deps_installed"
if [ ! -f "$SENTINEL" ] || [ "$BACKEND_DIR/requirements.txt" -nt "$SENTINEL" ]; then
    echo "  Instalando dependencias del backend..."
    cd "$BACKEND_DIR"
    trap '' ERR
    pip install -q --upgrade pip && pip install -q -r requirements.txt
    PIP_EXIT=$?
    trap 'echo ""; echo "❌ El script falló en la línea $LINENO."; echo "   Presiona Enter para cerrar..."; read -r _; exit 1' ERR
    if [ "$PIP_EXIT" -eq 0 ]; then
        touch "$SENTINEL"
        echo "  ✅ Dependencias instaladas."
    else
        echo "  ❌ Error instalando dependencias."
        echo "     Presiona Enter para cerrar..."
        read -r _
        exit 1
    fi
else
    echo "  ✅ Dependencias ya instaladas (sin cambios)."
fi

cd "$BACKEND_DIR"

# Liberar puerto 8000 si está ocupado por una instancia anterior
PORT_PIDS=$(lsof -t -i :8000 2>/dev/null || true)
if [ -n "$PORT_PIDS" ]; then
    echo "  ♻️  Puerto 8000 ocupado por proceso(s): $PORT_PIDS. Liberando..."
    echo "$PORT_PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1.5
fi

exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
