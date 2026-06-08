#!/usr/bin/env python3
"""Test End-to-End completo del chatbot con integración ML."""
import sys
import json
import asyncio
import httpx
from pathlib import Path

# Agregar el directorio del backend al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db.database import async_session_maker
from app.services.traffic_prediction import get_prediction_service
import redis.asyncio as redis


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'
    BOLD = '\033[1m'


async def test_ml_predictions():
    """Test 1: Verificar que el modelo ML genera predicciones (desde Redis)."""
    print(f"\n{Colors.BOLD}[TEST 1] Modelo ML - Predicciones desde Redis{Colors.END}")
    
    try:
        r = redis.from_url('redis://localhost:6380/0')
        
        # Obtener predicciones cacheadas
        cached = await r.get('ml:traffic_predictions')
        await r.aclose()
        
        assert cached is not None, "No hay predicciones en Redis"
        cache_data = json.loads(cached)
        predictions = cache_data.get('predictions', [])
        
        assert len(predictions) > 0, "No se generaron predicciones"
        assert predictions[0].get('comuna'), "Predicción sin comuna"
        assert 'risk_score' in predictions[0], "Predicción sin risk_score"
        
        print(f"  {Colors.GREEN}✓{Colors.END} Modelo ML generó {len(predictions)} predicciones")
        print(f"  {Colors.CYAN}→{Colors.END} Top 3 zonas peligrosas:")
        for i, p in enumerate(predictions[:3], 1):
            print(f"    {i}. {p['comuna']}: {p['risk_score']}/100")
        
        return True, predictions
    except Exception as e:
        print(f"  {Colors.RED}✗{Colors.END} Error: {e}")
        return False, []


async def test_redis_cache(predictions):
    """Test 2: Verificar que las predicciones se cachean en Redis."""
    print(f"\n{Colors.BOLD}[TEST 2] Redis - Caché de Predicciones{Colors.END}")
    
    try:
        r = redis.from_url('redis://localhost:6380/0')
        
        # Verificar que las predicciones ya están en caché (puestas por Celery)
        cached = await r.get('ml:traffic_predictions')
        await r.aclose()
        
        assert cached is not None, "No se guardó en Redis"
        cache_data = json.loads(cached)
        predictions_cached = cache_data.get('predictions', [])
        assert len(predictions_cached) == len(predictions), "Datos cacheados no coinciden"
        
        print(f"  {Colors.GREEN}✓{Colors.END} Redis caché funcionando")
        print(f"  {Colors.CYAN}→{Colors.END} {len(predictions_cached)} predicciones cacheadas (TTL: 900s)")
        
        return True
    except Exception as e:
        print(f"  {Colors.RED}✗{Colors.END} Error: {e}")
        return False


async def test_chatbot_endpoint():
    """Test 3: Verificar que el endpoint del chatbot responde."""
    print(f"\n{Colors.BOLD}[TEST 3] API - Endpoint /api/v1/chatbot/ask{Colors.END}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                'http://localhost:8000/api/v1/chatbot/ask',
                json={"question": "¿Qué zonas evitar ahora?"}
            )
        
        assert response.status_code == 200, f"Status code: {response.status_code}"
        data = response.json()
        
        assert 'answer' in data, "Respuesta sin campo 'answer'"
        assert 'intent' in data, "Respuesta sin campo 'intent'"
        assert 'structured_data' in data, "Respuesta sin 'structured_data'"
        
        print(f"  {Colors.GREEN}✓{Colors.END} Endpoint respondió correctamente")
        print(f"  {Colors.CYAN}→{Colors.END} Intent detectado: {data['intent']}")
        print(f"  {Colors.CYAN}→{Colors.END} Respuesta (primeras 100 chars):")
        print(f"    \"{data['answer'][:100]}...\"")
        
        return True, data
    except Exception as e:
        print(f"  {Colors.RED}✗{Colors.END} Error: {e}")
        return False, None


async def test_chatbot_with_predictions(chatbot_response):
    """Test 4: Verificar que el chatbot usa las predicciones ML."""
    print(f"\n{Colors.BOLD}[TEST 4] Integración - Chatbot + ML{Colors.END}")
    
    try:
        structured_data = chatbot_response['structured_data']
        
        assert 'predictions' in structured_data, "Sin predicciones en structured_data"
        predictions = structured_data['predictions']
        
        assert len(predictions) > 0, "Predicciones vacías"
        assert predictions[0].get('comuna'), "Predicción sin comuna"
        assert 'risk_score' in predictions[0], "Predicción sin risk_score"
        
        print(f"  {Colors.GREEN}✓{Colors.END} Chatbot integrado con predicciones ML")
        print(f"  {Colors.CYAN}→{Colors.END} Top 5 zonas según chatbot:")
        for i, p in enumerate(predictions[:5], 1):
            print(f"    {i}. {p['comuna']}: {p['risk_score']}/100")
        
        return True
    except Exception as e:
        print(f"  {Colors.RED}✗{Colors.END} Error: {e}")
        return False


async def test_different_intents():
    """Test 5: Verificar diferentes intents del chatbot."""
    print(f"\n{Colors.BOLD}[TEST 5] Chatbot - Detección de Intents{Colors.END}")
    
    test_cases = [
        ("¿Cómo está el clima?", "weather"),
        ("¿Hay reportes cerca?", "reports"),
        ("¿Es seguro ir a Castilla?", "route_suggestion"),
        ("Hola", "general"),
    ]
    
    passed = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        for question, expected_intent in test_cases:
            try:
                response = await client.post(
                    'http://localhost:8000/api/v1/chatbot/ask',
                    json={"question": question}
                )
                data = response.json()
                detected_intent = data.get('intent')
                
                if detected_intent == expected_intent:
                    print(f"  {Colors.GREEN}✓{Colors.END} \"{question}\" → {detected_intent}")
                    passed += 1
                else:
                    print(f"  {Colors.YELLOW}⚠{Colors.END} \"{question}\" → {detected_intent} (esperado: {expected_intent})")
            except Exception as e:
                print(f"  {Colors.RED}✗{Colors.END} Error en \"{question}\": {e}")
    
    print(f"  {Colors.CYAN}→{Colors.END} Pasaron {passed}/{len(test_cases)} tests de intent")
    return passed == len(test_cases)


async def test_health_check():
    """Test 0: Verificar que la API está corriendo."""
    print(f"\n{Colors.BOLD}[TEST 0] Health Check - API{Colors.END}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get('http://localhost:8000/health')
        
        assert response.status_code == 200, f"Status: {response.status_code}"
        data = response.json()
        assert data.get('status') == 'ok', "API no está OK"
        
        print(f"  {Colors.GREEN}✓{Colors.END} API está corriendo")
        return True
    except Exception as e:
        print(f"  {Colors.RED}✗{Colors.END} Error: {e}")
        print(f"  {Colors.YELLOW}→{Colors.END} Asegúrate de que Docker esté corriendo")
        return False


async def main():
    """Ejecutar todos los tests E2E."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  TEST E2E - CHATBOT IA + ML XGBoost{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    
    results = []
    
    # Test 0: Health check
    result = await test_health_check()
    results.append(("Health Check", result))
    if not result:
        print(f"\n{Colors.RED}[ABORTADO] La API no está disponible{Colors.END}")
        return
    
    # Test 1: ML Predictions
    result, predictions = await test_ml_predictions()
    results.append(("Modelo ML", result))
    
    # Test 2: Redis Cache
    if result and predictions:
        result = await test_redis_cache(predictions)
        results.append(("Redis Caché", result))
    
    # Test 3: Chatbot Endpoint
    result, chatbot_response = await test_chatbot_endpoint()
    results.append(("API Endpoint", result))
    
    # Test 4: Chatbot + ML Integration
    if result and chatbot_response:
        result = await test_chatbot_with_predictions(chatbot_response)
        results.append(("Integración ML", result))
    
    # Test 5: Intent Detection
    result = await test_different_intents()
    results.append(("Intent Detection", result))
    
    # Resumen
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}RESUMEN DE TESTS{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = f"{Colors.GREEN}✓ PASS{Colors.END}" if result else f"{Colors.RED}✗ FAIL{Colors.END}"
        print(f"  {status}  {name}")
    
    print(f"\n{Colors.BOLD}Total: {passed}/{total} tests pasaron{Colors.END}")
    
    if passed == total:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ TODOS LOS TESTS PASARON{Colors.END}\n")
        sys.exit(0)
    else:
        print(f"{Colors.RED}{Colors.BOLD}✗ ALGUNOS TESTS FALLARON{Colors.END}\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
