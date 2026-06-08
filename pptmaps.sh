#!/bin/bash
# Script de utilidad PPTMaps - Comandos comunes con nueva estructura

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

show_help() {
    print_header "📋 PPTMaps - Comandos Disponibles"
    echo ""
    echo "Uso: ./pptmaps.sh <comando>"
    echo ""
    echo "🧪 TESTS:"
    echo "  test:e2e-chatbot     - Test E2E del chatbot IA + ML"
    echo "  test:docker          - Test del stack completo Docker"
    echo "  test:ml              - Test de predicciones ML"
    echo "  test:unit            - Tests unitarios (pytest)"
    echo ""
    echo "🤖 MACHINE LEARNING:"
    echo "  ml:download-weather  - Descargar clima histórico"
    echo "  ml:prepare-dataset   - Preparar dataset de entrenamiento"
    echo "  ml:train             - Entrenar modelo XGBoost"
    echo "  ml:full              - Ejecutar pipeline completo (download → prepare → train)"
    echo ""
    echo "🗄️  BASE DE DATOS:"
    echo "  db:setup             - Configurar PostgreSQL + PostGIS"
    echo "  db:seed              - Cargar datos de demostración"
    echo ""
    echo "🐳 DOCKER:"
    echo "  docker:up            - Levantar stack completo"
    echo "  docker:down          - Detener stack"
    echo "  docker:logs          - Ver logs en tiempo real"
    echo "  docker:rebuild       - Reconstruir imágenes"
    echo ""
    echo "📊 INFORMACIÓN:"
    echo "  info                 - Mostrar estructura del proyecto"
    echo "  help                 - Mostrar esta ayuda"
    echo ""
}

activate_venv() {
    if [ ! -d "$BACKEND_DIR/venv" ]; then
        echo -e "${YELLOW}⚠ Entorno virtual no encontrado. Creando...${NC}"
        cd "$BACKEND_DIR"
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
    else
        source "$BACKEND_DIR/venv/bin/activate"
    fi
}

# Tests
test_e2e_chatbot() {
    print_header "🧪 Test E2E - Chatbot IA + ML"
    cd "$BACKEND_DIR"
    activate_venv
    python tests/e2e/test_chatbot_e2e.py
}

test_docker() {
    print_header "🧪 Test Docker Stack"
    cd "$BACKEND_DIR"
    bash tests/integration/test_docker_stack.sh
}

test_ml() {
    print_header "🧪 Test ML Predictions"
    cd "$BACKEND_DIR"
    bash tests/integration/test_ml_predictions.sh
}

test_unit() {
    print_header "🧪 Tests Unitarios"
    cd "$BACKEND_DIR"
    activate_venv
    pytest tests/unit/ -v
}

# Machine Learning
ml_download_weather() {
    print_header "🌦️  Descargando Clima Histórico"
    cd "$BACKEND_DIR"
    activate_venv
    python scripts/ml/download_historical_weather.py
}

ml_prepare_dataset() {
    print_header "📊 Preparando Dataset ML"
    cd "$BACKEND_DIR"
    activate_venv
    python scripts/ml/prepare_ml_dataset.py
}

ml_train() {
    print_header "🤖 Entrenando Modelo XGBoost"
    cd "$BACKEND_DIR"
    activate_venv
    python scripts/ml/train_traffic_model.py
}

ml_full_pipeline() {
    print_header "🚀 Pipeline ML Completo"
    ml_download_weather
    ml_prepare_dataset
    ml_train
    echo -e "\n${GREEN}✓ Pipeline ML completado exitosamente${NC}"
}

# Base de datos
db_setup() {
    print_header "🗄️  Configurando Base de Datos"
    cd "$BACKEND_DIR"
    sudo bash scripts/setup/setup_db.sh
}

db_seed() {
    print_header "🌱 Cargando Datos de Demo"
    cd "$BACKEND_DIR"
    activate_venv
    python scripts/setup/seed_demo.py
}

# Docker
docker_up() {
    print_header "🐳 Levantando Stack Docker"
    cd "$BACKEND_DIR"
    docker-compose -f docker-compose.pptmaps.yml up -d
    echo -e "\n${GREEN}✓ Stack corriendo en:${NC}"
    echo "  - Frontend: http://localhost:8000"
    echo "  - API Docs: http://localhost:8000/docs"
}

docker_down() {
    print_header "🐳 Deteniendo Stack Docker"
    cd "$BACKEND_DIR"
    docker-compose -f docker-compose.pptmaps.yml down
}

docker_logs() {
    print_header "📋 Logs en Tiempo Real"
    cd "$BACKEND_DIR"
    docker-compose -f docker-compose.pptmaps.yml logs -f
}

docker_rebuild() {
    print_header "🔨 Reconstruyendo Imágenes"
    cd "$BACKEND_DIR"
    docker-compose -f docker-compose.pptmaps.yml up -d --build
}

# Info
show_info() {
    print_header "📊 Estructura del Proyecto"
    cat "$PROJECT_ROOT/STRUCTURE.md"
}

# Main
case "$1" in
    # Tests
    test:e2e-chatbot) test_e2e_chatbot ;;
    test:docker) test_docker ;;
    test:ml) test_ml ;;
    test:unit) test_unit ;;
    
    # ML
    ml:download-weather) ml_download_weather ;;
    ml:prepare-dataset) ml_prepare_dataset ;;
    ml:train) ml_train ;;
    ml:full) ml_full_pipeline ;;
    
    # DB
    db:setup) db_setup ;;
    db:seed) db_seed ;;
    
    # Docker
    docker:up) docker_up ;;
    docker:down) docker_down ;;
    docker:logs) docker_logs ;;
    docker:rebuild) docker_rebuild ;;
    
    # Info
    info) show_info ;;
    help|--help|-h|"") show_help ;;
    
    *) 
        echo -e "${RED}❌ Comando desconocido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
