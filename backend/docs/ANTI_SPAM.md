# Sistema Anti-Spam para Reportes Ciudadanos

## Problema Resuelto

PPTMaps es una plataforma **100% pública y anónima** — cualquiera puede enviar reportes sin registrarse. Esto abre la puerta a:
- **Spam masivo**: scripts automatizados enviando miles de reportes falsos
- **Saturación del mapa**: información basura contaminando la visualización
- **Sobrecarga del backend**: peticiones excesivas afectando el rendimiento

## Solución Implementada

### Rate Limiting por IP

**Configuración**: `RATE_LIMIT_REPORTS=5/hour` (5 reportes por hora por IP)

**Cómo funciona**:
- Cada IP puede enviar máximo 5 reportes por hora
- Después del límite, recibe un error `429 Too Many Requests` con mensaje en español
- El contador se resetea cada hora automáticamente

**Tecnología**: `slowapi` (port de Flask-Limiter para FastAPI)

**Ventajas**:
- ✅ Protección inmediata sin configuración extra
- ✅ No afecta a usuarios legítimos (5 reportes/hora es razonable)
- ✅ Bajo overhead de rendimiento
- ✅ Mensaje claro en español: "Has alcanzado el límite de 5 reportes por hora. Por favor, intenta de nuevo más tarde."

**Limitaciones**:
- ❌ Atacantes con múltiples IPs pueden evadir
- ❌ Usuarios detrás de NAT/proxy comparten límite

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO ENVÍA REPORTE                     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Frontend (React)      │
                    │  - Formulario público   │
                    └────────────┬────────────┘
                                 │ POST /api/v1/reports/
                    ┌────────────▼────────────┐
                    │   Rate Limiter          │
                    │  ¿5 reportes/hora?      │
                    │  ❌ → 429 Too Many      │
                    │  ✅ → Continuar         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   CRUD Report           │
                    │  - Guardar en PostGIS   │
                    │  - Broadcast WebSocket  │
                    │  → 201 Created          │
                    └─────────────────────────┘
```

## Configuración

### Backend

1. Instalar dependencias:
   ```bash
   cd backend
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Configurar `.env`:
   ```env
   # Rate Limiting
   RATE_LIMIT_REPORTS=5/hour
   ```

3. Reiniciar el servidor:
   ```bash
   uvicorn app.main:app --reload
   ```

El sistema está **activo por defecto** — no requiere configuración adicional.

## Testing

```bash
cd backend
pytest tests/test_rate_limiting.py -v
```

**Tests incluidos**:
- ✅ Rate limiting bloquea después de 5 reportes
- ✅ Mensaje de error en español

## Monitoreo

### Ver IPs bloqueadas por rate limit

```bash
# Logs del servidor
tail -f backend/logs/uvicorn.log | grep "429"
```

### Probar manualmente

```bash
# Enviar 6 reportes para probar el límite
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/v1/reports/ \
    -H "Content-Type: application/json" \
    -d '{
      "report_type": "accident",
      "description": "Test '"$i"'",
      "latitude": 6.2476,
      "longitude": -75.5658
    }'
  echo "\n--- Reporte $i enviado ---\n"
  sleep 1
done
```

**Resultado esperado**:
- Reportes 1-5: `201 Created` ✅
- Reporte 6: `429 Too Many Requests` ❌ con mensaje "Has alcanzado el límite de 5 reportes por hora..."

## Respuesta a Incidentes

### Escenario 1: Ataque de spam coordinado

**Síntomas**: Muchos reportes con textos similares desde diferentes IPs

**Respuesta**:
1. Reducir rate limit temporalmente:
   ```bash
   # En backend/.env
   RATE_LIMIT_REPORTS=2/hour
   ```
2. Limpiar reportes spam de la BD:
   ```sql
   DELETE FROM reports WHERE description LIKE '%spam_pattern%';
   ```
3. Considerar activar CAPTCHA (si ya tenés dominio real)

### Escenario 2: Rate limit muy restrictivo

**Síntomas**: Usuarios legítimos bloqueados en eventos de emergencia

**Respuesta**:
1. Aumentar límite temporalmente:
   ```bash
   RATE_LIMIT_REPORTS=10/hour
   ```
2. Considerar límites dinámicos por tipo de reporte:
   - Accidentes: 3/hora (menos frecuentes)
   - Baches: 5/hora (más comunes)
   - Inundaciones: 2/hora (críticas, validar más)

## Próximos Pasos (Mejoras Futuras)

### 1. CAPTCHA (Requiere Dominio Real)

**Cloudflare Turnstile** — CAPTCHA invisible, gratis hasta 1M requests/mes.

**Limitación actual**: Cloudflare Turnstile requiere un **dominio real** (no acepta `localhost`).

**Para activar en producción**:
1. Obtener dominio real (puede ser gratuito: Freenom, GitHub Pages)
2. Configurar Turnstile: https://dash.cloudflare.com/turnstile
3. Agregar keys en backend `.env`:
   ```env
   TURNSTILE_SECRET_KEY=0x4AAAAAAxxxx
   TURNSTILE_ENABLED=true
   ```
4. Integrar widget en frontend (ver `frontend/CAPTCHA_INTEGRATION.md`)

**Ventajas**:
- ✅ Detecta bots automáticamente
- ✅ UX excelente (invisible para usuarios legítimos)
- ✅ Más efectivo que rate limiting solo

### 2. Alternativas Sin Dominio

1. **Honeypot Fields**: Campos ocultos que solo los bots llenan — 0 configuración
2. **Simple math CAPTCHA**: "¿Cuánto es 2+3?" — no requiere API externa
3. **Temporal token**: El backend genera un token que expira en 30s — sin servicios externos

### 3. Mejoras a futuro

1. **Análisis de comportamiento**: Detectar patrones sospechosos (tiempo de envío, ubicaciones repetidas)
2. **Moderación comunitaria**: Permitir que usuarios marquen reportes como spam
3. **ML anti-spam**: Modelo que detecta reportes falsos por el contenido textual
4. **Rate limiting por tipo de reporte**: Límites diferentes según la criticidad
5. **Whitelist de IPs**: IPs de instituciones (policía, bomberos) sin límite

## Referencias

- [SlowAPI Documentation](https://slowapi.readthedocs.io/)
- [FastAPI Rate Limiting](https://fastapi.tiangolo.com/advanced/websockets/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
