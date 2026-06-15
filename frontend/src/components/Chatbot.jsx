import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { CONFIG } from '../static/js/config/constants.js';
import { AppState } from '../static/js/core/state.js';

const SUGGESTIONS = {
  query_weather_current: ["Clima en una comuna", "Riesgo de lluvia", "Calidad del aire"],
  query_air_quality: ["Clima actual", "Donde hay mejor aire", "Estaciones de monitoreo"],
  query_rain_risk: ["Clima actual", "Inundaciones", "Alertas activas"],
  query_flood_zones: ["Riesgo de lluvia", "Alertas activas", "Clima actual"],
  query_alerts: ["Inundaciones", "Clima actual", "Riesgo de lluvia"],
  query_accidents: ["Accidentes por ano", "Zonas calientes", "Comuna con mas accidentes"],
  query_accident_zones: ["Ruta segura", "Riesgo en una zona", "Accidentes recientes"],
  query_reports: ["Reportes de accidentes", "Reportes de inundaciones", "Datos oficiales"],
  suggest_route: ["Riesgo en un lugar", "Accidentes recientes", "Clima actual"],
  query_comuna: ["Accidentes en la comuna", "Clima actual", "Ruta desde la comuna"],
  query_accident_risk: ["Ruta desde aqui", "Zonas calientes", "Accidentes por comuna"],
  clarify: ["Clima actual", "Accidentes en Robledo", "Inundaciones"],
  greeting: ["Clima actual", "Accidentes en Robledo", "Ruta segura"],
  default: ["Clima actual", "Accidentes en Robledo", "Inundaciones"],
};

function renderMarkdown(text) {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withBreaks = withBold.replace(/\n/g, "<br>");
  return withBreaks;
}

function applyLayerUpdates(updates) {
  if (!updates?.length) return;
  updates.forEach(u => {
    if (u.action !== "enable") return;

    if (u.layer === "route-risk" && u.params?.route) {
      _clearRouteLayers();
      const route = u.params.route;
      const coords = route.coordinates.map(c => [c[1], c[0]]);
      const segments = route.segments || [];
      const map = AppState.map;
      if (!map) return;

      if (segments.length && coords.length > 1) {
        const step = Math.max(1, Math.floor((coords.length - 1) / (segments.length - 1)));
        for (let i = 0; i < segments.length - 1; i++) {
          const idx = Math.min(i * step, coords.length - 2);
          const nextIdx = Math.min((i + 1) * step, coords.length - 1);
          const segmentCoords = coords.slice(idx, nextIdx + 1);
          if (segmentCoords.length < 2) continue;
          const line = L.polyline(segmentCoords, {
            color: segments[i].color || "#22c55e",
            weight: 5,
            opacity: 0.85,
          });
          line.addTo(map);
          _routePolylines.push(line);
        }
      } else {
        const line = L.polyline(coords, { color: "#22c55e", weight: 5, opacity: 0.85 });
        line.addTo(map);
        _routePolylines.push(line);
      }

      map.fitBounds(
        _routePolylines.length
          ? _routePolylines[0].getBounds()
          : L.latLngBounds(coords),
        { padding: [40, 40], maxZoom: 15 }
      );

      _checkToggle("route-risk");
      return;
    }

    if (u.layer === "historical-accidents") {
      const yearEl = document.getElementById("historicalYear");
      const comunaEl = document.getElementById("historicalComuna");
      if (u.params.year && yearEl) { yearEl.value = u.params.year; yearEl.dispatchEvent(new Event("change")); }
      if (u.params.comuna && comunaEl) { comunaEl.value = u.params.comuna; comunaEl.dispatchEvent(new Event("change")); }
      if (u.params.severities?.length) {
        document.querySelectorAll(".historical-severity").forEach(cb => {
          cb.checked = u.params.severities.includes(cb.value);
          cb.dispatchEvent(new Event("change"));
        });
      }
    }

    _checkToggle(u.layer);
  });
}

function _checkToggle(layerKey) {
  const toggle = document.querySelector(`.toggle[data-layer="${layerKey}"]`);
  if (toggle && !toggle.checked) {
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
  }
}

const _routePolylines = [];
function _clearRouteLayers() {
  const map = AppState.map;
  _routePolylines.forEach(pl => { if (map) map.removeLayer(pl); });
  _routePolylines.length = 0;
}

const chipStyle = {
  display: 'inline-block',
  padding: '4px 10px',
  margin: '3px 4px 3px 0',
  background: 'rgba(56,189,248,0.1)',
  border: '1px solid rgba(56,189,248,0.2)',
  borderRadius: 12,
  color: '#67e8f9',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hola! Preguntame sobre accidentes, clima o estadisticas de Medellin." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [streamText, setStreamText] = useState("");
  const [streamFull, setStreamFull] = useState("");
  const bottomRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) clearInterval(streamRef.current);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  function startStream(fullText, done) {
    setStreamFull(fullText);
    setStreamText("");
    let pos = 0;
    clearInterval(streamRef.current);
    streamRef.current = setInterval(() => {
      pos += 2;
      if (pos >= fullText.length) {
        pos = fullText.length;
        clearInterval(streamRef.current);
        streamRef.current = null;
        setStreamFull("");
        setStreamText("");
        done();
      } else {
        setStreamText(fullText.slice(0, pos));
      }
    }, 12);
  }

  function stopStream() {
    if (streamRef.current) {
      clearInterval(streamRef.current);
      streamRef.current = null;
    }
    setStreamFull("");
    setStreamText("");
  }

  function showRouteOnMap() {
    if (!pendingRoute) return;
    applyLayerUpdates([
      { layer: "route-risk", action: "enable", params: { route: pendingRoute } },
    ]);
    setPendingRoute(null);
  }

  function handleChipClick(chip) {
    setInput(chip);
    setSuggestions(null);
  }

  function getSuggestions(intent) {
    const chips = SUGGESTIONS[intent] || SUGGESTIONS.default;
    return { chips, intent };
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    stopStream();
    setSuggestions(null);
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.role === "bot" ? "assistant" : "user",
        text: m.text,
      }));
      const res = await fetch(`${CONFIG.apiBase}/chatbot/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();

      let routeData = null;
      const otherUpdates = (data.layer_updates || []).filter(u => {
        if (u.layer === "route-risk" && u.params?.route) {
          routeData = u.params.route;
          return false;
        }
        return true;
      });

      const fullAnswer = data.answer || "";
      const intent = data.intent || "default";
      const suggestionData = getSuggestions(intent);

      startStream(fullAnswer, () => {
        setMessages(prev => [...prev, { role: "bot", text: fullAnswer }]);
        setSuggestions(suggestionData);
        if (otherUpdates.length) applyLayerUpdates(otherUpdates);
        if (routeData) setPendingRoute(routeData);
        setLoading(false);
      });
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Error al conectar con el asistente." }]);
      setLoading(false);
    } finally {
      if (!streamRef.current) setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter") handleSend();
  }

  if (!open) {
    return (
      <button style={styles.fab} onClick={() => setOpen(true)} title="Asistente">
        💬
      </button>
    );
  }

  return (
    <>
    <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span>ASISTENTE</span>
        <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', opacity: 0.6 }}>X</span>
      </div>
      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i}>
            <div
              style={{ ...styles.bubble, ...(m.role === "user" ? styles.user : styles.bot) }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
            />
            {m.role === "bot" && pendingRoute && i === messages.length - 1 && !streamFull && (
              <div onClick={showRouteOnMap} style={styles.mapCta}>
                Mostrar en mapa
              </div>
            )}
          </div>
        ))}

        {streamFull && (
          <div
            style={{ ...styles.bubble, ...styles.bot }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) + '<span style="display:inline-block;width:2px;height:14px;background:#67e8f9;animation:blink 0.8s infinite;vertical-align:middle;margin-left:2px"></span>' }}
          />
        )}

        {loading && !streamFull && (
          <div style={{ ...styles.bubble, ...styles.bot, opacity: 0.5 }}>
            <span style={{ display: 'inline-block', animation: 'blink 1s infinite' }}>...</span>
          </div>
        )}

        {suggestions && !streamFull && (
          <div style={{ marginTop: 4, paddingLeft: 2 }}>
            {suggestions.chips.map((chip, i) => (
              <span
                key={i}
                style={chipStyle}
                onClick={() => handleChipClick(chip)}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribi tu consulta..."
        />
        <button style={styles.send} onClick={handleSend} disabled={loading}>ENVIAR</button>
      </div>
    </div>
    </>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    bottom: 80,
    right: 16,
    width: 340,
    maxHeight: 460,
    background: '#0f172a',
    border: '1px solid rgba(56,189,248,0.25)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10000,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    overflow: 'hidden',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 11,
  },
  header: {
    padding: '10px 14px',
    background: 'rgba(56,189,248,0.08)',
    borderBottom: '1px solid rgba(56,189,248,0.15)',
    color: '#67e8f9',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '0.1em',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 200,
    maxHeight: 340,
  },
  bubble: {
    padding: '8px 12px',
    borderRadius: 8,
    maxWidth: '85%',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  user: {
    background: 'rgba(56,189,248,0.15)',
    color: '#e2e8f0',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  bot: {
    background: '#1e293b',
    color: '#cbd5e1',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
    border: '1px solid rgba(56,189,248,0.08)',
  },
  inputRow: {
    display: 'flex',
    borderTop: '1px solid rgba(56,189,248,0.1)',
    padding: 8,
    gap: 6,
  },
  input: {
    flex: 1,
    background: '#0a0f16',
    border: '1px solid rgba(56,189,248,0.2)',
    borderRadius: 6,
    padding: '7px 10px',
    color: '#e2e8f0',
    fontSize: 11,
    outline: 'none',
    fontFamily: '"JetBrains Mono", monospace',
  },
  send: {
    background: 'rgba(56,189,248,0.2)',
    border: '1px solid rgba(56,189,248,0.3)',
    borderRadius: 6,
    color: '#67e8f9',
    padding: '6px 14px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '0.05em',
  },
  mapCta: {
    marginTop: 4,
    marginLeft: 10,
    padding: '4px 12px',
    background: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 6,
    color: '#4ade80',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 700,
    display: 'inline-block',
  },
  fab: {
    position: 'fixed',
    bottom: 80,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(56,189,248,0.2)',
    border: '2px solid #0ea5e9',
    color: '#67e8f9',
    fontSize: 18,
    cursor: 'pointer',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 16px rgba(56,189,248,0.3)',
  },
};
