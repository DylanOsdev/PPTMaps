#!/usr/bin/env bash
# =============================================================================
# setup_db.sh — Configuración inicial de PostgreSQL para TTPMaps/MoviMed
# Ejecutar con: sudo bash setup_db.sh
# =============================================================================

set -e

DB_NAME="movimed"
DB_USER="postgres"
DB_PASS="postgres"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  TTPMaps — Configuración de PostgreSQL   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Verificar que PostgreSQL está corriendo
if ! pg_isready -q; then
    echo "❌ PostgreSQL no está corriendo. Inícialo con: systemctl start postgresql"
    exit 1
fi
echo "✅ PostgreSQL activo."

# 2. Crear rol 'postgres' con contraseña si no existe
echo ""
echo "▶ Configurando rol '$DB_USER'..."
sudo -u postgres psql -c "
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE ROLE $DB_USER WITH LOGIN SUPERUSER PASSWORD '$DB_PASS';
        RAISE NOTICE 'Rol $DB_USER creado.';
    ELSE
        ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
        RAISE NOTICE 'Contraseña de $DB_USER actualizada.';
    END IF;
END
\$\$;
"

# 3. Crear la base de datos si no existe
echo ""
echo "▶ Verificando base de datos '$DB_NAME'..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")
if [ "$DB_EXISTS" != "1" ]; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    echo "✅ Base de datos '$DB_NAME' creada."
else
    echo "ℹ️  La base de datos '$DB_NAME' ya existe."
fi

# 4. Habilitar extensión PostGIS
echo ""
echo "▶ Habilitando extensión PostGIS en '$DB_NAME'..."
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>&1 || {
    echo "⚠️  PostGIS no pudo instalarse. ¿Está instalado el paquete 'postgis'?"
    echo "   Fedora: sudo dnf install postgis"
    echo "   Arch:   sudo pacman -S postgis"
}

# 5. Configurar pg_hba.conf para permitir auth md5/scram por TCP
echo ""
echo "▶ Verificando configuración de autenticación (pg_hba.conf)..."
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
if grep -q "^host.*all.*all.*127.0.0.1.*md5\|^host.*all.*all.*127.0.0.1.*scram-sha-256" "$PG_HBA" 2>/dev/null; then
    echo "ℹ️  Autenticación por contraseña TCP ya configurada."
else
    echo "   Añadiendo regla de autenticación md5 para 127.0.0.1..."
    echo "host    all             all             127.0.0.1/32            scram-sha-256" >> "$PG_HBA"
    sudo -u postgres pg_ctl reload -D /var/lib/pgsql/data
    echo "✅ pg_hba.conf actualizado y servicio recargado."
fi

echo ""
echo "════════════════════════════════════════════"
echo "✅ Configuración completada:"
echo "   Host:     localhost"
echo "   Puerto:   5432"
echo "   BD:       $DB_NAME"
echo "   Usuario:  $DB_USER"
echo "   Password: $DB_PASS"
echo ""
echo "Próximo paso — aplicar migraciones Alembic:"
echo "   cd backend && source ../venv/bin/activate"
echo "   alembic upgrade head"
echo "════════════════════════════════════════════"
