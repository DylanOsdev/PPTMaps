#!/bin/bash
set -e

# ── Cyberpunk PPTMaps Bootstrap ─────────────────────────────────────────────
# Colores (ANSI safe)
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
MAGENTA='\033[35m'
RESET='\033[0m'

show_spinner() {
  local pid=$1
  local msg=$2
  local spin='-\|/'
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    i=$(( (i+1) % 4 ))
    printf "\r  [${CYAN}%s${RESET}] ${DIM}%s${RESET}" "${spin:$i:1}" "$msg"
    sleep .15
  done
  printf "\r  [${GREEN}\u2714${RESET}] ${msg}                         \n"
}

progress_bar() {
  local current=$1
  local total=$2
  local label=$3
  local pct=0
  (( total > 0 )) && pct=$(( current * 100 / total ))
  local filled=$(( pct / 5 ))
  local empty=$(( 20 - filled ))
  printf "\r  ${DIM}[${RESET}"
  printf "${CYAN}%${filled}s${RESET}" '' | tr ' ' '\u2588'
  printf "${DIM}%${empty}s${RESET}" '' | tr ' ' '\u2591'
  printf "${DIM}]${RESET} ${BOLD}%3d%%${RESET} ${DIM}%-30s${RESET}" "$pct" "$label"
}

print_box() {
  local title=$1
  shift
  local lines=("$@")
  local width=68
  echo ""
  printf "  ${CYAN}%s${RESET}\n" "$(printf '\u2501%.0s' $(seq 1 $width))"
  printf "  ${CYAN}\u2503${RESET} ${BOLD}%-${width}s${RESET} ${CYAN}\u2503${RESET}\n" "$title"
  printf "  ${CYAN}%s${RESET}\n" "$(printf '\u2501%.0s' $(seq 1 $width))"
  for line in "${lines[@]}"; do
    printf "  ${CYAN}\u2503${RESET}  %-${width}s ${CYAN}\u2503${RESET}\n" "$line"
  done
  printf "  ${CYAN}%s${RESET}\n" "$(printf '\u2501%.0s' $(seq 1 $width))"
  echo ""
}

timestamp() {
  printf "${DIM}[$(date +%H:%M:%S)]${RESET}"
}

log_info() {
  printf "  $(timestamp) ${CYAN}INFO${RESET}  %s\n" "$1"
}

log_ok() {
  printf "  $(timestamp) ${GREEN} OK ${RESET}  %s\n" "$1"
}

log_warn() {
  printf "  $(timestamp) ${YELLOW}WARN${RESET}  %s\n" "$1"
}

log_fail() {
  printf "  $(timestamp) ${RED}FAIL${RESET}  %s\n" "$1"
}

# ── PPTMaps Logo ─────────────────────────────────────────────────────────────

echo ""
echo ""
printf "  ${CYAN}%s${RESET}\n" "██████╗ ██████╗ ████████╗███╗   ███╗ █████╗ ██████╗ ██████╗"
printf "  ${CYAN}%s${RESET}\n" "██╔══██╗██╔══██╗╚══██╔══╝████╗ ████║██╔══██╗██╔══██╗██╔══██╗"
printf "  ${MAGENTA}%s${RESET}\n" "██████╔╝██████╔╝   ██║   ██╔████╔██║███████║██████╔╝██████╔╝"
printf "  ${MAGENTA}%s${RESET}\n" "██╔═══╝ ██╔═══╝    ██║   ██║╚██╔╝██║██╔══██║██╔═══╝ ╚════██╗"
printf "  ${CYAN}%s${RESET}\n" "██║     ██║        ██║   ██║ ╚═╝ ██║██║  ██║██║     ██████╔╝"
printf "  ${CYAN}%s${RESET}\n" "╚═╝     ╚═╝        ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     ╚═════╝"
echo ""
printf "  ${DIM}%s${RESET}\n" "    Climate Intelligence Platform // Medellin, Colombia"
printf "  ${DIM}%s${RESET}\n" "    v2.0.0 — System Bootstrap Sequence Initialized"
echo ""

# ── Phase 1: Database ────────────────────────────────────────────────────────

log_info "Phase 1/4: Establishing database connection..."

SPIN_PID=""
python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text
async def check():
    while True:
        try:
            async with async_session_maker() as db:
                await db.execute(text('SELECT 1'))
            return
        except:
            pass
asyncio.run(check())
" &
SPIN_PID=$!
show_spinner $SPIN_PID "Connecting to PostgreSQL (PostGIS) ..."
wait $SPIN_PID 2>/dev/null
log_ok "PostgreSQL connection established"

# ── Phase 2: Migrations ──────────────────────────────────────────────────────

log_info "Phase 2/4: Running database migrations..."
alembic upgrade head 2>&1 | while IFS= read -r line; do
  printf "  ${DIM}|${RESET}  %s\n" "$line"
done
log_ok "Schema migrations applied"

# ── Phase 3: Data ingestion check ────────────────────────────────────────────

log_info "Phase 3/4: Verifying data stores..."
ACCIDENT_COUNT=$(python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text
async def check():
    async with async_session_maker() as db:
        r = await db.execute(text('SELECT COUNT(*) FROM accident_incidents'))
        return r.scalar()
print(asyncio.run(check()))
")

WEATHER_COUNT=$(python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text
async def check():
    async with async_session_maker() as db:
        r = await db.execute(text('SELECT COUNT(*) FROM historical_weather_medellin'))
        return r.scalar()
print(asyncio.run(check()))
")

HAS_ACCIDENTS=false
HAS_WEATHER=false
[ "$ACCIDENT_COUNT" -gt 0 ] && HAS_ACCIDENTS=true
[ "$WEATHER_COUNT" -gt 0 ] && HAS_WEATHER=true

if $HAS_ACCIDENTS && $HAS_WEATHER; then
  log_ok "Data stores verified  [accidents: ${ACCIDENT_COUNT} | weather: ${WEATHER_COUNT}]"
else
  log_warn "Data stores incomplete — initiating first-time ingestion"
fi

# ── Ingesta de accidentes ──────────────────────────────────────────────────────

if [ "$ACCIDENT_COUNT" -eq 0 ]; then
  if [ ! -f "/repo/backend/data/raw/Fatal_Road_Traffic.xlsx" ]; then
    log_fail "Dataset Fatal_Road_Traffic.xlsx not found"
    log_warn "Skipping accident ingestion"
  else
    echo ""
    print_box " FIRST-TIME DATA INGESTION " \
      "" \
      "  Target: 702,540 accident records (2008-2025)" \
      "  Source: Fatal_Road_Traffic.xlsx [Secretaria de Movilidad]" \
      "  Estd:   5-10 minutes depending on hardware" \
      "  Status: API will start AFTER ingestion completes"
    echo ""

    log_info "Ingesting accident records..."
    python -c "
import asyncio, sys, time
sys.path.insert(0, '/repo/backend')
from scripts.ingest_accidents import ingest
total = 702540
async def run():
    start = time.time()
    n = await ingest('/repo/backend/data/raw/Fatal_Road_Traffic.xlsx')
    elapsed = time.time() - start
    return n, elapsed
n, elapsed = asyncio.run(run())
# Write result for bash
print(f'COUNT={n}')
print(f'TIME={elapsed:.1f}')
" > /tmp/ingest_result.txt 2>&1 &
    INGEST_PID=$!

    # Progress animation while ingesting
    while kill -0 "$INGEST_PID" 2>/dev/null; do
      if [ -f /tmp/ingest_result.txt ]; then
        inserted=0
        if grep -q 'COUNT=' /tmp/ingest_result.txt 2>/dev/null; then
          break
        fi
      fi
      for frame in '▌' '▀' '▐' '▄'; do
        printf "\r  ${CYAN}%s${RESET} ${DIM}Processing records...${RESET}" "$frame"
        sleep .2
        kill -0 "$INGEST_PID" 2>/dev/null || break
      done
    done

    wait "$INGEST_PID" 2>/dev/null || true

    # Read result
    INGEST_COUNT=$(grep '^COUNT=' /tmp/ingest_result.txt 2>/dev/null | cut -d= -f2)
    INGEST_TIME=$(grep '^TIME=' /tmp/ingest_result.txt 2>/dev/null | cut -d= -f2)
    rm -f /tmp/ingest_result.txt

    INGEST_COUNT=${INGEST_COUNT:-0}
    INGEST_TIME=${INGEST_TIME:-0}
    printf "\r  ${GREEN}\u2714${RESET} ${DIM}Ingestion complete${RESET}                              \n"
    log_ok "${INGEST_COUNT} accident records ingested in ${INGEST_TIME}s"
  fi
else
  log_ok "Accident data already present [${ACCIDENT_COUNT} records]"
fi

# ── Ingesta de clima ─────────────────────────────────────────────────────────

if [ "$WEATHER_COUNT" -eq 0 ]; then
  if [ ! -f "/repo/backend/data/processed/clima_historico_medellin.csv" ]; then
    log_warn "Historical weather data not found — weather features unavailable"
  else
    log_info "Ingesting 157,800 weather records..."
    python -c "
import asyncio, sys
sys.path.insert(0, '/repo/backend')
sys.path.insert(0, '/repo/backend/scripts/setup')
from load_historical_weather import load_historical_weather
success = asyncio.run(load_historical_weather('/repo/backend/data/processed/clima_historico_medellin.csv'))
print(f'SUCCESS={\"true\" if success else \"false\"}')
" > /tmp/weather_result.txt 2>&1 &
    WEATHER_PID=$!

    while kill -0 "$WEATHER_PID" 2>/dev/null; do
      for frame in '▌' '▀' '▐' '▄'; do
        printf "\r  ${CYAN}%s${RESET} ${DIM}Loading weather time-series...${RESET}" "$frame"
        sleep .15
        kill -0 "$WEATHER_PID" 2>/dev/null || break
      done
    done

    wait "$WEATHER_PID" 2>/dev/null || true
    printf "\r  ${GREEN}\u2714${RESET} ${DIM}Weather ingestion complete${RESET}                       \n"

    if grep -q 'SUCCESS=true' /tmp/weather_result.txt 2>/dev/null; then
      log_ok "157,800 weather records loaded"
    else
      log_warn "Weather ingestion returned errors — check logs"
    fi
    rm -f /tmp/weather_result.txt
  fi
else
  log_ok "Weather data already present [${WEATHER_COUNT} records]"
fi

# ── Phase 4: Launch ───────────────────────────────────────────────────────────

echo ""
print_box " SYSTEM READY " \
  "" \
  "  All systems nominal. Firing up production API." \
  "  Listening on:  http://0.0.0.0:8000" \
  "  API Docs:      http://localhost:8000/docs" \
  "  Health:        http://localhost:8000/health"
echo ""

log_info "Phase 4/4: Pre-warming heatmap cache (background)..."
(
  sleep 15
  python -c "
import urllib.request, json
try:
    resp = urllib.request.urlopen('http://localhost:8000/api/v1/public/accident-risk/heatmap', timeout=120)
    pts = len(json.loads(resp.read()).get('points', []))
    print(f'  [CACHE] Heatmap pre-warmed: {pts} points')
except Exception as e:
    print(f'  [CACHE] Heatmap pre-warm skipped: {e}')
" 2>&1 || true
) &

log_info "Starting uvicorn server..."
echo ""
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
