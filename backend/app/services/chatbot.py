import json
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.redis import get_redis

GROQ_API_KEY = settings.GROQ_API_KEY
GROQ_MODEL = "llama-3.1-8b-instant"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
CACHE_TTL = 600


async def _cache_set(key: str, value: str, ttl: int = CACHE_TTL):
    try:
        r = get_redis()
        await r.setex(key, ttl, value)
    except Exception:
        pass

SYSTEM_PROMPT = """Eres un asistente de datos de movilidad de Medellín. Respondé solo con este JSON:
{"intent": "...", "params": {...}, "answer": "texto amigable en español"}

INTENTS (el sistema agrega datos reales después, NO inventes números):
- query_weather_current: clima actual. params: {"zona": null}. Si el usuario menciona una zona específica (Medellín, Bello, Envigado, Itagüí, Sabaneta, o una comuna), pasala. Si dice "en general" o "en todo medellin", dejá zona null.
- query_air_quality: calidad del aire. params: {"comuna": null}. Si menciona una comuna/estación específica, pasala. Si no, dejá null para traer todo.
- query_accidents: accidentes oficiales. params: {"year": null, "comuna": null, "severities": [], "clase": null}
- query_flood_zones: inundaciones. params: {}
- query_rain_risk: riesgo de lluvia 2h. params: {}
- query_precipitation: precipitación histórica. params: {"year": null, "comuna": null}
- query_alerts: alertas activas. params: {}
- query_reports: reportes ciudadanos. params: {"report_type": null, "limit": 5}
- query_accident_zones: zonas calientes. params: {"limit": 5}
- query_accident_risk: riesgo en un lugar. params: {"ubicacion": ""}
- suggest_route: ruta segura. params: {"origen": "", "destino": ""}
- query_comuna: info de comuna. params: {"comuna": ""}
- query_weather_forecast: pronóstico. params: {}
- clarify: consulta VAGA sin detalles — PREGUNTÁ qué específicamente le interesa. params: {}
- greeting: saludo amigable. params: {}
- unknown: no aplica. params: {}

REGLAS:
1. Si el usuario menciona una zona/especificación concreta, usá el intent correspondiente CON los params llenos. Ej: "clima en medellin" → query_weather_current con zona="Medellín". "accidentes en robledo 2024" → query_accidents con comuna="Robledo", year=2024.
2. Si la consulta es vaga SIN especificar (solo "clima", "como esta el aire", "accidentes"), usá clarify.
3. Si dice "en general" o "en todo medellin" pero el tema está claro (ej: "como esta el clima en todo medellin"), usá el intent con params vacíos — NO es clarify.
4. Tu answer es solo INTRO conversacional, no incluyas datos inventados.
5. No asumas "La Candelaria" ni ningún default si el usuario no especificó.
6. "reportes de X" = query_reports. "accidentes/estadísticas" = query_accidents.
7. Si el usuario solo dice una comuna (ej: "Robledo"), usá query_comuna.
8. Clases accidente: Choque, Atropello, Caida de ocupante, Volcamiento, Incendio, Otro. Severidades: MUERTO, HERIDO, SOLO DAÑOS.
9. Comunas: Popular, Santa Cruz, Manrique, Aranjuez, Castilla, Doce de Octubre, Robledo, Villa Hermosa, Buenos Aires, La Candelaria, Laureles, La America, San Javier, Poblado, Guayabal, Belen
10. Estaciones calidad del aire: Altavista, Belén, Aranjuez, Sabaneta, Caldas, San Cristobal, La Estrella, El Poblado, Villahermosa, Envigado, Bello, Copacabana, Santa Elena, Politecnico Colombiano"""


COMUNAS = ["popular", "santa cruz", "manrique", "aranjuez", "castilla", "doce de octubre",
            "robledo", "villa hermosa", "villahermosa", "buenos aires", "la candelaria",
            "laureles", "la america", "san javier", "poblado", "el poblado", "guayabal", "belen", "belén"]
WEATHER_ZONES = ["medellín", "medellin", "bello", "envigado", "itagüí", "itagui", "sabaneta"]
SALUDOS = {"hola", "buenas", "buen dia", "buen día", "buenas tardes", "buenas noches",
           "que tal", "qué tal", "como estas", "cómo estás", "como vas", "saludos"}

def _normalize(s: str) -> str:
    return s.lower().replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n").replace("ü", "u")

def _find_comuna(msg: str) -> str | None:
    lower = _normalize(msg)
    for c in COMUNAS:
        if _normalize(c) in lower:
            return c.title()
    return None

def _find_year(msg: str) -> int | None:
    import re
    for y in range(2008, 2026):
        if str(y) in msg:
            return y
    return None

def _find_zona(msg: str) -> str | None:
    lower = _normalize(msg)
    for z in WEATHER_ZONES:
        if _normalize(z) in lower:
            # Siempre devolver "Medellín" con acento para que matchee la BD
            if _normalize(z) == "medellin":
                return "Medellín"
            return z.title()
    comuna = _find_comuna(msg)
    if comuna:
        if _normalize(comuna) in {"laureles", "belen", "el poblado", "poblado", "la america",
                                   "san javier", "guayabal", "la candelaria", "buenos aires",
                                   "castilla", "aranjuez", "robledo"}:
            return "Medellín"
    return comuna


def fallback_classify(message: str) -> dict | None:
    msg_lower = message.lower().strip()
    words = set(msg_lower.split())

    if not message:
        return None

    if any(s in msg_lower for s in SALUDOS):
        return {"intent": "greeting", "params": {}, "answer": "¡Hola! ¿En qué puedo ayudarte hoy en Medellín?"}

    if "gracias" in words:
        return {"intent": "greeting", "params": {}, "answer": "¡Con gusto! Si necesitas algo más, aquí estoy."}

    is_vague = len(words) <= 3 and not any(c in msg_lower for c in COMUNAS + WEATHER_ZONES)

    # Ruta segura
    if any(w in msg_lower for w in ["ruta", "camino", "viaje", "trayecto"]) and \
       any(w in msg_lower for w in ["segur", "riesgo", "recomend"]):
        parts = [p.strip() for p in msg_lower.replace(" hasta ", " a ").replace(" hacia ", " a ").split(" a ")]
        origen = parts[1] if len(parts) >= 3 else ""
        destino = parts[-1] if len(parts) >= 2 else ""
        if not origen and "desde" in msg_lower:
            idx = msg_lower.find("desde")
            resto = msg_lower[idx + 5:].strip()
            if " a " in resto:
                origen, destino = [x.strip() for x in resto.split(" a ", 1)]
            elif " hasta " in resto:
                origen, destino = [x.strip() for x in resto.split(" hasta ", 1)]
        if not origen:
            idx = msg_lower.find("de ")
            if idx >= 0:
                resto = msg_lower[idx + 3:].strip()
                if " a " in resto:
                    origen, destino = [x.strip() for x in resto.split(" a ", 1)]
                elif " hasta " in resto:
                    origen, destino = [x.strip() for x in resto.split(" hasta ", 1)]
        if origen and destino:
            return {"intent": "suggest_route", "params": {"origen": origen.title(), "destino": destino.title()},
                    "answer": f"Claro, calculando la ruta más segura de {origen.title()} a {destino.title()}:"}

    # Reportes ciudadanos (antes que inundaciones, porque "reportes de inundaciones" debe ir a query_reports)
    if any(w in msg_lower for w in ["reporte", "reportes", "denuncia", "queja", "ciudadano"]):
        rtype = None
        if "accident" in msg_lower:
            rtype = "accident"
        elif "inund" in msg_lower or "flood" in msg_lower:
            rtype = "flood"
        elif "clima" in msg_lower or "weather" in msg_lower:
            rtype = "weather"
        return {"intent": "query_reports", "params": {"report_type": rtype, "limit": 5},
                "answer": "Últimos reportes ciudadanos:"}

    # Inundaciones
    if any(w in msg_lower for w in ["inund", "deprimido", "nivel del agua", "rio", "quebrada", "crecida"]):
        return {"intent": "query_flood_zones", "params": {},
                "answer": "Acá está el estado actual de las zonas de inundación:"}

    # Alertas
    if any(w in msg_lower for w in ["alerta", "emergencia", "peligro"]):
        is_vague_alert = len(words) <= 2
        if is_vague_alert:
            return {"intent": "clarify", "params": {},
                    "answer": "¿Te interesan alertas meteorológicas, de accidentes o de inundación?"}
        return {"intent": "query_alerts", "params": {}, "answer": "Alertas activas del sistema:"}

    # Riesgo de accidente en ubicación
    if any(w in msg_lower for w in ["riesgo", "peligroso", "seguridad"]) and \
       any(w in msg_lower for w in ["lugar", "zona", "ubicacion", "donde", "ahí", "allí", "alli"]):
        return {"intent": "query_accident_risk", "params": {"ubicacion": message},
                "answer": "Analizando el riesgo en esa ubicación:"}

    # Riesgo de lluvia
    if any(w in msg_lower for w in ["lluvia", "va a llover", "va a mojar"]):
        return {"intent": "query_rain_risk", "params": {},
                "answer": "Puntos con riesgo de lluvia en las próximas 2 horas:"}

    # Calidad del aire
    if any(w in msg_lower for w in ["calidad del aire", "aqi", "pm25", "pm10", "aire"]):
        comuna = _find_comuna(msg_lower)
        if is_vague and not comuna:
            return {"intent": "clarify", "params": {},
                    "answer": "¿Te interesa la calidad del aire de alguna comuna o estación específica? Puedo consultar Altavista, Belén, Aranjuez, El Poblado y más."}
        return {"intent": "query_air_quality", "params": {"comuna": comuna},
                "answer": "Datos de calidad del aire:"}

    # Clima / Weather
    if any(w in msg_lower for w in ["clima", "temperatura", "tiempo", "humedad", "clima", "pronostico", "pronóstico"]):
        zona = _find_zona(msg_lower)
        if "pronostico" in msg_lower or "pronóstico" in msg_lower:
            return {"intent": "query_weather_forecast", "params": {},
                    "answer": "Consultando el pronóstico del clima:"}
        if "general" in words or "todo" in words:
            return {"intent": "query_weather_current", "params": {"zona": None},
                    "answer": "Datos del clima actual en Medellín:"}
        return {"intent": "query_weather_current", "params": {"zona": zona},
                "answer": f"Datos del clima actual{' en ' + zona if zona else ' en Medellín'}:"}

    # Precipitación histórica
    if any(w in msg_lower for w in ["precipitacion", "precipitación", "histórico", "historico"]):
        year = _find_year(message)
        comuna = _find_comuna(msg_lower)
        return {"intent": "query_precipitation", "params": {"year": year, "comuna": comuna},
                "answer": "Datos de precipitación:"}

    # Zonas calientes
    if any(w in msg_lower for w in ["zonas calientes", "punto caliente", "dbscan", "hot spot", "concentracion", "concentración"]):
        return {"intent": "query_accident_zones", "params": {"limit": 5},
                "answer": "Zonas calientes de accidentes:"}

    # Accidentes (antes que comuna para darle prioridad cuando se menciona "accidentes")
    if any(w in msg_lower for w in ["accidente", "accidentes", "choque", "atropello", "volcamiento", "muerto", "herido"]):
        if is_vague and not _find_comuna(msg_lower) and not _find_year(message):
            return {"intent": "clarify", "params": {},
                    "answer": "¿Te interesan accidentes de alguna comuna o año en específico?"}
        year = _find_year(message)
        comuna = _find_comuna(msg_lower)
        severities = []
        if "muerto" in msg_lower: severities.append("MUERTO")
        if "herido" in msg_lower: severities.append("HERIDO")
        if "daño" in msg_lower or "danos" in msg_lower: severities.append("SOLO DAÑOS")

        clase = None
        if "choque" in msg_lower: clase = "Choque"
        elif "atropello" in msg_lower: clase = "Atropello"
        elif "volcamiento" in msg_lower: clase = "Volcamiento"
        elif "incendio" in msg_lower: clase = "Incendio"

        return {"intent": "query_accidents", "params": {"year": year, "comuna": comuna,
                "severities": severities, "clase": clase},
                "answer": "Consultando datos de accidentes:"}

    # Comuna específica (solo el nombre, sin palabras de accidentes/clima)
    comuna = _find_comuna(msg_lower)
    if comuna and len(words) <= 5:
        return {"intent": "query_comuna", "params": {"comuna": comuna},
                "answer": f"Datos de la comuna {comuna}:"}

    # Riesgo de accidente genérico (sin ubicación específica)
    if any(w in msg_lower for w in ["riesgo", "seguridad", "peligro"]):
        return {"intent": "query_accident_risk", "params": {"ubicacion": "Medellín"},
                "answer": "Analizando el riesgo en Medellín:"}

    return None


async def ask_groq(message: str, history: list | None = None) -> dict[str, Any]:
    if not GROQ_API_KEY:
        return {
            "intent": "unknown",
            "params": {},
            "answer": "El asistente no está configurado. El administrador debe definir GROQ_API_KEY.",
        }
    try:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            for h in history[-6:]:
                role = "user" if h.get("role") == "user" else "assistant"
                content = h.get("text") or h.get("content", "")
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                },
            )
            data = resp.json()

            if resp.status_code != 200:
                error_msg = data.get("error", {}).get("message", f"HTTP {resp.status_code}")
                print(f"[GROQ ERROR] {resp.status_code}: {error_msg}")
                return {
                    "intent": "unknown",
                    "params": {},
                    "answer": f"Lo siento, el servicio de IA no está disponible: {error_msg}",
                }

            if "choices" not in data or not data["choices"]:
                print(f"[GROQ ERROR] Respuesta sin choices: {json.dumps(data)[:300]}")
                return {
                    "intent": "unknown",
                    "params": {},
                    "answer": "Lo siento, no pude generar una respuesta coherente. ¿Podrías reformular tu consulta?",
                }

            raw_content = data["choices"][0]["message"]["content"]
            parsed = json.loads(raw_content)

            if "intent" not in parsed:
                print(f"[GROQ ERROR] Respuesta sin intent: {raw_content[:300]}")
                return {
                    "intent": "unknown",
                    "params": {},
                    "answer": parsed.get("answer", "No entendí tu consulta. Podés preguntar sobre accidentes, clima, calidad del aire, o pedir una ruta segura."),
                }

            return parsed

    except httpx.TimeoutException:
        print("[GROQ ERROR] Timeout")
        return {
            "intent": "unknown",
            "params": {},
            "answer": "Lo siento, el asistente tardó demasiado en responder. Por favor intentá de nuevo.",
        }
    except json.JSONDecodeError as e:
        print(f"[GROQ ERROR] JSON decode: {e}")
        return {
            "intent": "unknown",
            "params": {},
            "answer": "Lo siento, hubo un error de comunicación con el asistente. Por favor intentá de nuevo.",
        }
    except Exception as e:
        print(f"[GROQ ERROR] {type(e).__name__}: {e}")
        return {
            "intent": "unknown",
            "params": {},
            "answer": f"Lo siento, ocurrió un error al procesar tu consulta: {str(e)}",
        }


async def query_accidents(params: dict, db: AsyncSession) -> str:
    conditions = []
    bind = {}
    if params.get("year"):
        conditions.append("year = :year")
        bind["year"] = params["year"]
    if params.get("comuna"):
        conditions.append("comuna = :comuna")
        bind["comuna"] = params["comuna"]
    if params.get("clase"):
        conditions.append("incident_class = :clase")
        bind["clase"] = params["clase"]
    if params.get("severities"):
        pl = [f":sev_{i}" for i in range(len(params["severities"]))]
        conditions.append(f"severity IN ({','.join(pl)})")
        for i, s in enumerate(params["severities"]):
            bind[f"sev_{i}"] = s

    where = " AND ".join(conditions) if conditions else "TRUE"
    total = await db.execute(text(f"SELECT COUNT(*) FROM accident_incidents WHERE {where}"), bind)
    count = total.scalar() or 0
    by_severity = await db.execute(text(f"""
        SELECT severity, COUNT(*) as cnt FROM accident_incidents
        WHERE {where} GROUP BY severity ORDER BY cnt DESC
    """), bind)
    sev_rows = by_severity.fetchall()
    parts = [f"Total: {count}"]
    for r in sev_rows:
        parts.append(f"{r.severity}: {r.cnt}")
    return " | ".join(parts)


async def query_air_quality(comuna: str | None = None, db: AsyncSession | None = None) -> str:
    cache_key = f"air:quality:{comuna or 'all'}"
    try:
        r = get_redis()
        cached = await r.get(cache_key)
        if cached:
            return cached
    except Exception:
        pass

    if comuna:
        result = await db.execute(text("""
            SELECT station_name, aqi, pm25, pm10, no2, o3, temp, humidity, timestamp::text
            FROM air_quality_readings
            WHERE (station_id, timestamp) IN (
                SELECT station_id, MAX(timestamp) FROM air_quality_readings GROUP BY station_id
            )
            AND LOWER(station_name) LIKE LOWER(:comuna)
            ORDER BY aqi DESC
        """), {"comuna": f"%{comuna}%"})
    else:
        result = await db.execute(text("""
            SELECT station_name, aqi, pm25, pm10, no2, o3, temp, humidity, timestamp::text
            FROM air_quality_readings
            WHERE (station_id, timestamp) IN (
                SELECT station_id, MAX(timestamp) FROM air_quality_readings GROUP BY station_id
            )
            ORDER BY aqi DESC
        """))
    rows = result.fetchall()
    if not rows:
        if comuna:
            out = f"No hay datos de calidad del aire para '{comuna}'."
        else:
            out = "No hay datos de calidad del aire disponibles."
        await _cache_set(cache_key, out)
        return out
    lines = ["Calidad del aire actual:"]
    for r in rows:
        cat = "Buena" if r.aqi <= 50 else "Moderada" if r.aqi <= 100 else "Dañina"
        lines.append(f"  {r.station_name}: AQI {r.aqi} ({cat}), PM2.5={r.pm25}µg, PM10={r.pm10}µg, {r.temp}°C")
    out = "\n".join(lines)
    await _cache_set(cache_key, out)
    return out


NEARBY_MAP = {
    "popular": "Medellín", "santa cruz": "Medellín", "manrique": "Medellín",
    "aranjuez": "Medellín", "castilla": "Medellín", "doce de octubre": "Medellín",
    "robledo": "Medellín", "villa hermosa": "Medellín", "villahermosa": "Medellín",
    "buenos aires": "Medellín", "la candelaria": "Medellín", "laureles": "Medellín",
    "la america": "Medellín", "san javier": "Medellín", "poblado": "Medellín",
    "el poblado": "Medellín", "guayabal": "Medellín", "belen": "Medellín",
    "belén": "Medellín",
    "la estrella": "Itagüí", "caldas": "Itagüí",
    "barbosa": "Bello", "copacabana": "Bello", "girardota": "Bello",
    "santa elena": "Medellín", "san cristobal": "Medellín",
}


async def query_weather_current(zona: str | None = None, db: AsyncSession | None = None) -> str:
    cache_key = f"weather:current:{zona or 'all'}"
    try:
        r = get_redis()
        cached = await r.get(cache_key)
        if cached:
            return cached
    except Exception:
        pass

    wmo = {0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
           45: "Niebla", 51: "Llovizna", 61: "Lluvia", 63: "Lluvia moderada", 65: "Lluvia intensa",
           80: "Chubascos", 95: "Tormenta", 96: "Tormenta con granizo"}

    if zona:
        result = await db.execute(text("""
            SELECT location_name, temperature_c, humidity, rain_mm, precipitation_prob_2h, weather_code, recorded_at::text
            FROM weather_snapshots
            WHERE LOWER(location_name) LIKE LOWER(:zona)
            ORDER BY location_name
        """), {"zona": f"%{zona}%"})
        rows = result.fetchall()
        if not rows:
            zona_key = zona.strip().lower()
            nearby = NEARBY_MAP.get(zona_key)
            if nearby:
                result = await db.execute(text("""
                    SELECT location_name, temperature_c, humidity, rain_mm, precipitation_prob_2h, weather_code, recorded_at::text
                    FROM weather_snapshots WHERE LOWER(location_name) = LOWER(:nearby)
                """), {"nearby": nearby})
                rows = result.fetchall()
                if rows:
                    lines = [f"No tengo datos exactos de '{zona.title()}', pero {nearby} es la estación más cercana:"]
                    for r in rows:
                        desc = wmo.get(r.weather_code, f"Código {r.weather_code}")
                        lluvia = f"🌧 {r.precipitation_prob_2h}%" if r.precipitation_prob_2h else "Sin datos"
                        lines.append(f"  {r.location_name}: {r.temperature_c}°C, {desc}, Humedad {r.humidity}%, Prob lluvia 2h: {lluvia}")
                    lines.append(f"\n💡 También tengo datos de: Bello, Envigado, Itagüí, Sabaneta. ¿Querés alguno?")
                    out = "\n".join(lines)
                    await _cache_set(cache_key, out)
                    return out
            out = f"No tengo datos climáticos para '{zona.title()}'. Las estaciones disponibles son: Medellín, Bello, Envigado, Itagüí, Sabaneta. ¿Cuál te interesa?"
            await _cache_set(cache_key, out)
            return out

        lines = [f"Clima en {zona.title()}:"]
        for r in rows:
            desc = wmo.get(r.weather_code, f"Código {r.weather_code}")
            lluvia = f"🌧 {r.precipitation_prob_2h}%" if r.precipitation_prob_2h else "Sin datos"
            lines.append(f"  {r.location_name}: {r.temperature_c}°C, {desc}, Humedad {r.humidity}%, Prob lluvia 2h: {lluvia}")
    else:
        result = await db.execute(text("""
            SELECT location_name, temperature_c, humidity, rain_mm, precipitation_prob_2h, weather_code, recorded_at::text
            FROM weather_snapshots ORDER BY location_name
        """))
        rows = result.fetchall()
        if not rows:
            return "No hay datos climáticos actuales."
        lines = ["Clima actual en Medellín (promedio de 5 estaciones):"]
        temps = [r.temperature_c for r in rows if r.temperature_c]
        avg_temp = round(sum(temps) / len(temps), 1) if temps else "N/A"
        humidities = [r.humidity for r in rows if r.humidity]
        avg_hum = round(sum(humidities) / len(humidities), 1) if humidities else "N/A"
        max_rain_prob = max((r.precipitation_prob_2h or 0) for r in rows)
        codes = [wmo.get(r.weather_code, "") for r in rows if r.weather_code]
        desc_summary = codes[0] if codes else "N/A"
        lines.append(f"  🌡 {avg_temp}°C promedio | 💧 {avg_hum}% humedad | 🌧 {max_rain_prob}% prob lluvia")
        lines.append(f"  Estado general: {desc_summary}")
        lines.append("")
        partes = []
        for r in rows:
            desc = wmo.get(r.weather_code, f"Código {r.weather_code}")
            lluvia = f"🌧{r.precipitation_prob_2h}%" if r.precipitation_prob_2h else "-"
            partes.append(f"{r.location_name}: {r.temperature_c}°C, {desc}, {lluvia}")
        lines.append("  | ".join(partes))
        lines.append(f"\n💡 ¿Querés el clima de alguna zona en específico?")
    out = "\n".join(lines)
    await _cache_set(cache_key, out)
    return out


async def query_rain_risk(db: AsyncSession) -> str:
    result = await db.execute(text("""
        SELECT location_name, precipitation_prob_2h, rain_mm, temperature_c
        FROM weather_snapshots
        WHERE precipitation_prob_2h >= 50
        ORDER BY precipitation_prob_2h DESC
    """))
    rows = result.fetchall()
    if not rows:
        return "No se espera lluvia en las próximas 2 horas en Medellín."
    lines = ["⚠ Puntos con riesgo de lluvia próx. 2h:"]
    for r in rows:
        lines.append(f"  {r.location_name}: {r.precipitation_prob_2h}% probabilidad, {r.temperature_c}°C")
    return "\n".join(lines)


async def query_precipitation(params: dict, db: AsyncSession) -> str:
    year = params.get("year")
    comuna = params.get("comuna")
    if year:
        grid = "historical_weather_grid"
        result = await db.execute(text(f"""
            SELECT ROUND(SUM(precipitation_mm)::numeric, 1) as total_mm,
                   ROUND(AVG(precipitation_mm)::numeric, 2) as avg_mm
            FROM {grid}
            WHERE timestamp >= :start AND timestamp < :end
        """), {"start": f"{year}-01-01", "end": f"{year + 1}-01-01"})
        row = result.fetchone()
        if row and row.total_mm:
            base = f"Año {year}: {row.total_mm}mm total, {row.avg_mm}mm/h promedio"
            if comuna:
                return f"Precipitación en {comuna}: {base}"
            return base
    result = await db.execute(text("""
        SELECT EXTRACT(YEAR FROM timestamp)::int as year,
               ROUND(SUM(precipitation_mm)::numeric, 1) as total_mm
        FROM historical_weather_grid GROUP BY year ORDER BY year
    """))
    rows = result.fetchall()
    if not rows:
        return "No hay datos de precipitación."
    max_r = max(rows, key=lambda r: r.total_mm)
    min_r = min(rows, key=lambda r: r.total_mm)
    return f"Precipitación {len(rows)} años. Máx: {max_r.year} ({max_r.total_mm}mm). Mín: {min_r.year} ({min_r.total_mm}mm)."


async def query_flood_zones(db: AsyncSession) -> str:
    result = await db.execute(text("""
        SELECT name, status, water_level_m FROM flood_hazards ORDER BY status DESC, water_level_m DESC
    """))
    rows = result.fetchall()
    if not rows:
        return "No hay zonas de inundación registradas."
    icons = {"dry": "✅", "watch": "⚠", "flooded": "🔴"}
    lines = ["Zonas de inundación:"]
    for r in rows:
        icon = icons.get(r.status, "❓")
        nivel = f"{r.water_level_m}m" if r.water_level_m else "N/A"
        lines.append(f"  {icon} {r.name}: {r.status.upper()}, nivel {nivel}")
    return "\n".join(lines)


async def query_alerts_fn(db: AsyncSession) -> str:
    result = await db.execute(text("""
        SELECT type, severity, message, created_at::text FROM alerts
        WHERE is_resolved = false ORDER BY created_at DESC LIMIT 10
    """))
    rows = result.fetchall()
    if not rows:
        return "No hay alertas activas."
    icons = {"INFO": "ℹ", "WARNING": "⚠", "CRITICAL": "🔴"}
    lines = ["Alertas activas:"]
    for r in rows:
        icon = icons.get(r.severity, "❓")
        lines.append(f"  {icon} [{r.severity}] {r.message}")
    return "\n".join(lines)


async def query_reports(params: dict, db: AsyncSession) -> str:
    rtype = params.get("report_type")
    limit = params.get("limit") or 5
    if rtype:
        count_result = await db.execute(text("""
            SELECT COUNT(*) FROM reports WHERE report_type = :rtype
        """), {"rtype": rtype})
        total = count_result.scalar() or 0
        result = await db.execute(text("""
            SELECT report_type, description, created_at::text FROM reports
            WHERE report_type = :rtype ORDER BY created_at DESC LIMIT :lim
        """), {"rtype": rtype, "lim": limit})
    else:
        count_result = await db.execute(text("SELECT COUNT(*) FROM reports"))
        total = count_result.scalar() or 0
        result = await db.execute(text("""
            SELECT report_type, description, created_at::text FROM reports
            ORDER BY created_at DESC LIMIT :lim
        """), {"lim": limit})
    rows = result.fetchall()
    if not rows:
        if rtype:
            return f"No hay reportes ciudadanos de tipo '{rtype}'."
        return "No hay reportes ciudadanos registrados."
    lines = [f"Total reportes: {total}. Últimos {len(rows)}:"]
    for r in rows:
        desc = (r.description[:60] + "...") if r.description and len(r.description) > 60 else r.description or "Sin descripción"
        lines.append(f"  [{r.report_type}] {desc}")
    return "\n".join(lines)


async def query_accident_zones_fn(db: AsyncSession) -> str:
    result = await db.execute(text("""
        SELECT name, severity, incident_count FROM accident_zones
        ORDER BY incident_count DESC LIMIT 5
    """))
    rows = result.fetchall()
    if not rows:
        return "No hay zonas calientes de accidentes."
    lines = ["Zonas calientes de accidentes (DBSCAN):"]
    for r in rows:
        lines.append(f"  🔥 {r.name}: severidad {r.severity}, {r.incident_count} incidentes")
    return "\n".join(lines)


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


async def geocode_location(name: str) -> tuple[float, float, str] | None:
    queries = [f"{name}, Medellín, Colombia", f"{name}, Antioquia, Colombia"]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for q in queries:
                resp = await client.get(GEOCODING_URL, params={
                    "name": q, "count": 5, "language": "es", "format": "json",
                })
                data = resp.json()
                results = data.get("results", [])
                colombia_results = [r for r in results if r.get("country_code") == "CO"]
                if colombia_results:
                    r = colombia_results[0]
                    return r["latitude"], r["longitude"], r.get("name", name)

            for q in queries:
                resp2 = await client.get(NOMINATIM_URL, params={
                    "q": q, "format": "json", "limit": 3,
                }, headers={"User-Agent": "PPTMapsChatbot/1.0"})
                data2 = resp2.json()
                for r in data2:
                    if "Colombia" in r.get("display_name", ""):
                        return float(r["lat"]), float(r["lon"]), r.get("display_name", name).split(",")[0]
    except Exception:
        pass
    return None


async def get_comuna_center(name: str, db: AsyncSession) -> tuple[float, float] | None:
    result = await db.execute(text("""
        SELECT center_lat, center_lng FROM zones
        WHERE kind = 'comuna' AND LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE(:name, ' ', ''))
        LIMIT 1
    """), {"name": name})
    row = result.fetchone()
    if row and row.center_lat:
        return row.center_lat, row.center_lng
    return None


async def resolve_location(name: str, db: AsyncSession) -> tuple[float, float, str] | None:
    center = await get_comuna_center(name, db)
    if center:
        return *center, name
    geo = await geocode_location(name)
    if geo:
        return geo
    return None


async def get_risk_data(lat: float, lng: float, db: AsyncSession) -> dict:
    nearby = await db.execute(text("""
        SELECT COUNT(*) FROM accident_incidents
        WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 0.008)
    """), {"lat": lat, "lng": lng})
    accident_count = nearby.scalar() or 0

    weather = await db.execute(text("""
        SELECT temperature_c, precipitation_prob_2h, rain_mm, weather_code
        FROM weather_snapshots
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) LIMIT 1
    """), {"lat": lat, "lng": lng})
    w = weather.fetchone()

    flood = await db.execute(text("""
        SELECT COUNT(*) FROM flood_hazards
        WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 0.01)
        AND status IN ('watch', 'flooded')
    """), {"lat": lat, "lng": lng})
    flood_count = flood.scalar() or 0

    alerts = await db.execute(text("""
        SELECT COUNT(*) FROM alerts
        WHERE is_resolved = false AND severity IN ('WARNING', 'CRITICAL')
    """))
    active_alerts = alerts.scalar() or 0

    density_score = min(accident_count / 500, 1.0)
    rain_risk = 1 if w and w.precipitation_prob_2h and w.precipitation_prob_2h >= 50 else 0
    risk_score = round(density_score * 0.6 + rain_risk * 0.2 + min(flood_count, 1) * 0.2, 2)

    return {
        "risk_score": risk_score,
        "accident_count": accident_count,
        "flood_zones_nearby": flood_count,
        "active_alerts": active_alerts,
        "temp": round(w.temperature_c, 1) if w else None,
        "rain_prob": w.precipitation_prob_2h if w else None,
        "weather_code": w.weather_code if w else None,
    }


async def query_accident_risk(ubicacion: str, db: AsyncSession) -> str:
    resolved = await resolve_location(ubicacion, db)
    if not resolved:
        return f"No pude determinar la ubicación '{ubicacion}'."
    lat, lng, nombre = resolved
    data = await get_risk_data(lat, lng, db)
    nivel = "BAJO" if data["risk_score"] < 0.3 else "MEDIO" if data["risk_score"] < 0.6 else "ALTO"
    parts = [f"**{nombre}**: riesgo {nivel} ({data['risk_score']})"]
    parts.append(f"🚗 {data['accident_count']} accidentes en 1km")
    if data["flood_zones_nearby"]:
        parts.append(f"🌊 {data['flood_zones_nearby']} zona(s) de inundación cerca")
    if data["rain_prob"] is not None:
        parts.append(f"🌧 {data['rain_prob']}% prob lluvia")
    return " | ".join(parts)


async def query_comuna(params: dict, db: AsyncSession) -> str:
    comuna = params.get("comuna", "")
    if not comuna:
        return "No especificaste una comuna."
    result = await db.execute(text("""
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE severity = 'MUERTO') as muertos,
               COUNT(*) FILTER (WHERE severity = 'HERIDO') as heridos,
               COUNT(*) FILTER (WHERE severity = 'SOLO DAÑOS') as danos,
               MAX(year) as ultimo_anio
        FROM accident_incidents WHERE comuna ILIKE :comuna
    """), {"comuna": f"%{comuna}%"})
    r = result.fetchone()
    if not r or not r.total:
        return f"No hay datos de accidentes para {comuna}."

    by_class = await db.execute(text("""
        SELECT incident_class, COUNT(*) as cnt FROM accident_incidents
        WHERE comuna ILIKE :comuna GROUP BY incident_class ORDER BY cnt DESC LIMIT 3
    """), {"comuna": f"%{comuna}%"})
    clases = [f"{row.incident_class}: {row.cnt}" for row in by_class.fetchall()]

    lines = [
        f"**{comuna}**: {r.total} accidentes totales",
        f"  Muertes: {r.muertos} | Heridos: {r.heridos} | Daños: {r.danos}",
    ]
    if clases:
        lines.append(f"  Clases más frecuentes: {', '.join(clases)}")
    if r.ultimo_anio:
        lines.append(f"  Último año con datos: {r.ultimo_anio}")
    return "\n".join(lines)


OSRM_URL = "https://router.project-osrm.org/route/v1/driving"


async def get_osrm_route(o_lng: float, o_lat: float, d_lng: float, d_lat: float) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{OSRM_URL}/{o_lng},{o_lat};{d_lng},{d_lat}",
                params={"geometries": "geojson", "overview": "full", "steps": "false", "alternatives": "true"},
            )
            data = resp.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                return None
            routes = []
            for route in data["routes"]:
                coords = route["geometry"]["coordinates"]
                routes.append({
                    "distance_m": route["distance"],
                    "duration_s": route["duration"],
                    "coordinates": [[c[1], c[0]] for c in coords],
                    "raw_coords": coords,
                })
            return routes
    except Exception:
        return None


def _sample_route_points(coords: list[list[float]], n: int = 12) -> list[list[float]]:
    if len(coords) <= n:
        return coords
    step = (len(coords) - 1) / (n - 1)
    return [coords[round(i * step)] for i in range(n)]


async def query_route_risk(coords: list[list[float]], db: AsyncSession) -> list[dict]:
    n = 10
    points = _sample_route_points(coords, n)
    segments = []
    for i, (lat, lng) in enumerate(points):
        data = await get_risk_data(lat, lng, db)
        segments.append({
            "index": i,
            "lat": lat, "lng": lng,
            "risk_score": data["risk_score"],
            "accident_count": data["accident_count"],
            "flood_zones_nearby": data["flood_zones_nearby"],
            "rain_prob": data["rain_prob"],
        })
    return segments


async def suggest_route(origen: str, destino: str, db: AsyncSession) -> tuple[str, list]:
    orig = await resolve_location(origen, db)
    dest = await resolve_location(destino, db)

    if not orig and not dest:
        return f"No pude determinar las ubicaciones '{origen}' ni '{destino}'.", []
    if not orig:
        return f"No pude determinar '{origen}', pero {await query_accident_risk(destino, db)}", []
    if not dest:
        return f"No pude determinar '{destino}', pero {await query_accident_risk(origen, db)}", []

    o_lat, o_lng, o_nombre = orig
    d_lat, d_lng, d_nombre = dest

    routes = await get_osrm_route(o_lng, o_lat, d_lng, d_lat)

    if not routes:
        o_data = await get_risk_data(o_lat, o_lng, db)
        d_data = await get_risk_data(d_lat, d_lng, db)
        return _fallback_route_text(o_nombre, d_nombre, o_data, d_data), []

    best = routes[0]
    dist_km = round(best["distance_m"] / 1000, 1)
    time_min = round(best["duration_s"] / 60)

    segments = await query_route_risk(best["coordinates"], db)
    risks = [s["risk_score"] for s in segments]
    avg_risk = round(sum(risks) / len(risks), 2) if risks else 0
    max_risk = round(max(risks), 2) if risks else 0
    max_idx = risks.index(max(risks)) if risks else 0

    max_seg = segments[max_idx] if segments else None
    nivel_avg = "bajo" if avg_risk < 0.3 else "medio" if avg_risk < 0.6 else "alto"
    peligro = ""
    if max_seg:
        nivel = "BAJO" if max_risk < 0.3 else "MEDIO" if max_risk < 0.6 else "ALTO"
        pct = round(max_idx / len(segments) * 100)
        donde = "al inicio" if pct < 25 else "en la primera mitad" if pct < 50 else "en la segunda mitad" if pct < 75 else "al final"
        peligro = f"\n⚠ El tramo más riesgoso está {donde} del recorrido (riesgo {nivel}), con {max_seg['accident_count']} accidentes cerca."

    mejor = ""
    if len(routes) > 1:
        alt = routes[1]
        alt_dist = round(alt["distance_m"] / 1000, 1)
        alt_time = round(alt["duration_s"] / 60)
        alt_seg = await query_route_risk(alt["coordinates"], db)
        alt_avg = round(sum(s["risk_score"] for s in alt_seg) / len(alt_seg), 2) if alt_seg else 0
        if alt_avg < avg_risk:
            diff_pct = round((avg_risk - alt_avg) / avg_risk * 100) if avg_risk else 0
            mejor = f"\n💡 Hay una ruta alternativa de {alt_dist}km ({alt_time}min) con {diff_pct}% menos riesgo."

    coord_samples = _sample_route_points(best["coordinates"], 20)

    route_data = {
        "type": "LineString",
        "coordinates": [[lng, lat] for lat, lng in coord_samples],
        "segments": [{
            "index": s["index"],
            "lat": s["lat"], "lng": s["lng"],
            "risk": s["risk_score"],
            "color": "#22c55e" if s["risk_score"] < 0.3 else "#eab308" if s["risk_score"] < 0.6 else "#ef4444",
        } for s in segments],
    }

    lines = [
        f"La ruta de **{o_nombre}** a **{d_nombre}** es de {dist_km}km y toma unos {time_min}min en auto.",
        f"El nivel de riesgo general es **{nivel_avg}** (puntaje {avg_risk}), con puntos críticos de hasta {max_risk}.{peligro}{mejor}",
        f"\n📍 ¿Querés que te muestre la ruta en el mapa?",
    ]
    return "\n".join(lines), route_data


def _fallback_route_text(o_nombre, d_nombre, o_data, d_data):
    alertas = []
    if o_data["flood_zones_nearby"] or d_data["flood_zones_nearby"]:
        alertas.append("zonas de inundación cercanas")
    lluvia_origen = o_data["rain_prob"] or 0
    lluvia_destino = d_data["rain_prob"] or 0
    if lluvia_origen >= 50 or lluvia_destino >= 50:
        alertas.append(f"probabilidad de lluvia {max(lluvia_origen, lluvia_destino)}%")
    o_nivel = "bajo" if o_data["risk_score"] < 0.3 else "medio" if o_data["risk_score"] < 0.6 else "alto"
    d_nivel = "bajo" if d_data["risk_score"] < 0.3 else "medio" if d_data["risk_score"] < 0.6 else "alto"
    diff = abs(o_data["risk_score"] - d_data["risk_score"])
    if diff < 0.1:
        rec = f"Ambas zonas tienen riesgo similar ({o_nivel})."
    elif o_data["risk_score"] < d_data["risk_score"]:
        rec = f"Recomiendo {o_nombre} sobre {d_nombre}. Riesgo {o_nivel.upper()} vs {d_nivel.upper()}."
    else:
        rec = f"Recomiendo {d_nombre} sobre {o_nombre}. Riesgo {d_nivel.upper()} vs {o_nivel.upper()}."
    if alertas:
        rec += f" ⚠ {'; '.join(alertas)}."
    lines = [
        f"**{o_nombre}** → **{d_nombre}**",
        f"Origen: riesgo {o_nivel.upper()} ({o_data['risk_score']}), {o_data['accident_count']} accidentes, {o_data['rain_prob'] or 0}% lluvia",
        f"Destino: riesgo {d_nivel.upper()} ({d_data['risk_score']}), {d_data['accident_count']} accidentes, {d_data['rain_prob'] or 0}% lluvia",
        f"\n💡 {rec}",
    ]
    return "\n".join(lines)


async def process_intent(intent: str, params: dict, db: AsyncSession) -> tuple[str, list]:
    layer_updates = []

    if intent == "query_accidents":
        data = await query_accidents(params, db)
        answer = f"**Accidentes**: {data}"
        layer_updates.append({
            "layer": "historical-accidents", "action": "enable",
            "params": {k: v for k, v in params.items() if v},
        })

    elif intent == "query_air_quality":
        comuna = params.get("comuna")
        data = await query_air_quality(comuna, db)
        answer = f"{data}"
        layer_updates.append({"layer": "air-quality-stations", "action": "enable", "params": {}})

    elif intent == "query_weather_current":
        zona = params.get("zona")
        data = await query_weather_current(zona, db)
        answer = f"{data}"

    elif intent == "query_weather_forecast":
        answer = "El pronóstico detallado no está disponible en este momento. Probá preguntando por el clima actual."

    elif intent == "query_rain_risk":
        data = await query_rain_risk(db)
        answer = f"{data}"
        layer_updates.append({"layer": "rain-risk", "action": "enable", "params": {}})

    elif intent == "query_precipitation":
        data = await query_precipitation(params, db)
        answer = f"{data}"
        if params.get("comuna"):
            layer_updates.append({"layer": "precip-comunas", "action": "enable", "params": {}})
        elif params.get("year"):
            layer_updates.append({"layer": "historical-precipitation", "action": "enable", "params": {}})

    elif intent == "query_flood_zones":
        data = await query_flood_zones(db)
        answer = f"{data}"
        layer_updates.append({"layer": "flood-zones", "action": "enable", "params": {}})

    elif intent == "query_alerts":
        data = await query_alerts_fn(db)
        answer = f"{data}"
        layer_updates.append({"layer": "weather-alerts", "action": "enable", "params": {}})

    elif intent == "query_reports":
        data = await query_reports(params, db)
        answer = f"{data}"
        rtype = params.get("report_type")
        if rtype == "accident":
            layer_updates.append({"layer": "reports-collision", "action": "enable", "params": {}})
        elif rtype == "flood":
            layer_updates.append({"layer": "reports-flood", "action": "enable", "params": {}})

    elif intent == "query_accident_zones":
        data = await query_accident_zones_fn(db)
        answer = f"{data}"
        layer_updates.append({"layer": "accident-zones", "action": "enable", "params": {}})

    elif intent == "query_accident_risk":
        ubicacion = params.get("ubicacion", "")
        data = await query_accident_risk(ubicacion, db)
        answer = f"{data}"
        layer_updates.append({"layer": "accident-risk", "action": "enable", "params": {}})

    elif intent == "suggest_route":
        origen = params.get("origen", "")
        destino = params.get("destino", "")
        data, route_data = await suggest_route(origen, destino, db)
        answer = f"{data}"
        if route_data:
            layer_updates.append({
                "layer": "route-risk", "action": "enable",
                "params": {"route": route_data},
            })

    elif intent == "query_comuna":
        data = await query_comuna(params, db)
        answer = f"{data}"
        comuna = params.get("comuna", "")
        if comuna:
            layer_updates.append({
                "layer": "highlight-comuna", "action": "enable",
                "params": {"comuna": comuna},
            })

    elif intent == "greeting":
        answer = "¡Hola! Soy tu asistente de movilidad de Medellín. ¿Qué te gustaría saber? Puedo contarte sobre accidentes, calidad del aire, clima o darte recomendaciones de rutas seguras. ¿Por dónde quieres empezar?"

    else:
        answer = "No entendí tu consulta. Podés preguntar sobre accidentes, calidad del aire, clima actual, lluvia, inundaciones, alertas, zonas calientes, riesgo en un lugar, o pedir recomendaciones de rutas entre dos puntos."

    return answer, layer_updates
