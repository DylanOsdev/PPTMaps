"""Puente entre Celery workers y WebSocket: publica/consume alertas vía Redis pub/sub.

Los workers Celery no pueden llamar directamente a ConnectionManager porque viven
en procesos distintos al servidor FastAPI. Este módulo usa Redis pub/sub como
canal de comunicación entre procesos.
"""
import json
import logging

from redis.asyncio import Redis

ALERTS_CHANNEL = "alerts:live"

logger = logging.getLogger(__name__)


async def publish_alert(redis: Redis, alert_data: dict) -> None:
    """Publica una alerta en el canal Redis para que el servidor FastAPI la
    retransmita a los clientes WebSocket conectados."""
    try:
        await redis.publish(ALERTS_CHANNEL, json.dumps(alert_data))
    except Exception as e:
        logger.warning("No se pudo publicar alerta en Redis: %s", e)


async def listen_and_broadcast_alerts(redis: Redis):
    """Bucle infinito resiliente: escucha alertas publicadas en Redis y las reenvía a
    todos los clientes WebSocket conectados vía ConnectionManager."""
    from app.websocket.connection_manager import manager

    while True:
        try:
            pubsub = redis.pubsub()
            await pubsub.subscribe(ALERTS_CHANNEL)
            logger.info("Escuchando alertas en canal Redis: %s", ALERTS_CHANNEL)
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    await manager.broadcast({"type": "alerts", "data": [data]})
                except Exception as e:
                    logger.warning("Error reenviando alerta desde Redis: %s", e)
        except asyncio.CancelledError:
            logger.info("Subscripción a alertas cancelada.")
            raise
        except Exception as e:
            logger.warning("Conexión perdida con el canal de alertas de Redis: %s. Reintentando en 5s...", e)
            await asyncio.sleep(5)
