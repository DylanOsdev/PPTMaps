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
# [1/4] Verificar PostgreSQL
# ─────────────────────────────────────────────
echo "[1/4] Verificando PostgreSQL..."
PG_OK=0
if command -v pg_isready &>/dev/null; then
    if pg_isready -q 2>/dev/null; then
        PG_OK=1
    fi
fi

if [ "$PG_OK" -eq 1 ]; then
    echo "  ✅ PostgreSQL está corriendo."
else
    echo "  ⚠️  PostgreSQL no está accesible."
    echo "     Para iniciarlo: sudo systemctl start postgresql"
    echo "     La app se iniciará pero los datos no estarán disponibles."
fi

# ─────────────────────────────────────────────
# [2/4] Verificar pg_hba.conf
# ─────────────────────────────────────────────
echo ""
echo "[2/4] Verificando pg_hba.conf..."

# PostgreSQL en Fedora guarda su config en /var/lib/pgsql, no en /etc/postgresql
PG_HBA=""
for pg_dir in /etc/postgresql /var/lib/pgsql; do
    if [ -d "$pg_dir" ]; then
        PG_HBA=$(find "$pg_dir" -name pg_hba.conf 2>/dev/null | head -1 || true)
        [ -n "$PG_HBA" ] && break
    fi
done

if [ -n "$PG_HBA" ]; then
    if grep -qE "local\s+.*postgres.*ident" "$PG_HBA" 2>/dev/null; then
        echo "  ⚠️  pg_hba.conf usa autenticación 'ident'."
        echo "     Para arreglar permanentemente ejecuta:"
        echo "       sudo sed -i \"s/local.*all.*all.*peer/local all all md5/\" $PG_HBA"
        echo "       sudo systemctl restart postgresql"
    else
        echo "  ✅ pg_hba.conf configurado correctamente."
    fi
else
    echo "  ⚠️  No se encontró pg_hba.conf. PostgreSQL puede no estar instalado."
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
