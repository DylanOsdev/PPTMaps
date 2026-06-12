import React from 'react';
import { Link } from 'react-router-dom';
import '../static/css/tppmaps.css';
import {
  Chart as ChartJS,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { useAccidentStats } from '../hooks/useAccidentStats.js';
import { useWeatherStats } from '../hooks/useWeatherStats.js';

ChartJS.register(ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const CYAN = '#22d3ee';
const PALETTE = ['#22d3ee', '#67e8f9', '#fbbf24', '#f87171', '#a78bfa', '#4ade80'];
const GRID = 'rgba(56,189,248,0.10)';
const TICK = '#94a3b8';

const fmt = (n) => new Intl.NumberFormat('es-CO').format(n);
const labels = (arr) => arr.map((d) => d.key);
const counts = (arr) => arr.map((d) => d.count);

const baseOpts = (legend = false) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: legend, labels: { color: TICK, font: { size: 10 } } } },
  scales: {
    x: { ticks: { color: TICK, font: { size: 9 } }, grid: { color: GRID } },
    y: { ticks: { color: TICK, font: { size: 9 } }, grid: { color: GRID } },
  },
});

function Panel({ title, children }) {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)',
      borderRadius: 10, padding: 16,
    }}>
      <h3 style={{
        fontSize: 11, letterSpacing: '0.12em', color: CYAN,
        margin: '0 0 12px', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace',
      }}>{title}</h3>
      <div style={{ height: 240 }}>{children}</div>
    </div>
  );
}

function KPI({ value, label, color }) {
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)',
      borderRadius: 10, padding: '16px 20px', textAlign: 'center', minWidth: 140,
    }}>
      <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, letterSpacing: '0.1em', color: TICK, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { stats, loading, error } = useAccidentStats();
  const { stats: weatherStats, loading: weatherLoading } = useWeatherStats();

  const wrap = {
    minHeight: '100vh', background: '#0f172a', color: '#e2e8f0',
    fontFamily: '"JetBrains Mono", monospace', padding: '20px 24px 48px',
  };

  if (loading) return <div style={{ ...wrap, textAlign: 'center', paddingTop: 80, color: CYAN }}>CARGANDO ANALÍTICA…</div>;
  if (error || !stats) return (
    <div style={{ ...wrap, textAlign: 'center', paddingTop: 80, color: '#f87171' }}>
      ⚠ SIN DATOS ANALÍTICOS<div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>{error}</div>
      <div style={{ marginTop: 20 }}><Link to="/" style={{ color: CYAN }}>← Inicio</Link></div>
    </div>
  );

  const muertos = stats.by_severity.find((s) => s.key === 'MUERTO')?.count ?? 0;
  const years = [...stats.by_year].sort((a, b) => Number(a.key) - Number(b.key));

  return (
    <div style={wrap}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 22, margin: 0, color: CYAN }}>
            DASHBOARD ANALÍTICO
          </h1>
          <p style={{ fontSize: 10, color: TICK, margin: '4px 0 0' }}>
            Accidentalidad vial de Medellín · {stats.by_year.length} años de datos oficiales
          </p>
        </div>
        <nav style={{ display: 'flex', gap: 14, fontSize: 11 }}>
          <Link to="/" style={{ color: CYAN }}>← Inicio</Link>
          <Link to="/map" style={{ color: CYAN }}>🗺 Mapa</Link>
        </nav>
      </header>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI value={fmt(stats.total)} label="INCIDENTES TOTALES" color={CYAN} />
        <KPI value={fmt(muertos)} label="VÍCTIMAS FATALES" color="#f87171" />
        <KPI value={stats.by_comuna.length ? stats.by_comuna[0].key : '—'} label="COMUNA MÁS CRÍTICA" color="#fbbf24" />
        <KPI value={stats.by_class.length ? stats.by_class[0].key : '—'} label="CLASE MÁS FRECUENTE" color={CYAN} />
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Panel title="POR GRAVEDAD">
          <Doughnut
            data={{
              labels: labels(stats.by_severity),
              datasets: [{ data: counts(stats.by_severity), backgroundColor: PALETTE, borderWidth: 0 }],
            }}
            options={baseOpts(true)}
          />
        </Panel>

        <Panel title="POR CLASE DE ACCIDENTE">
          <Bar
            data={{
              labels: labels(stats.by_class),
              datasets: [{ label: 'Accidentes', data: counts(stats.by_class), backgroundColor: CYAN }],
            }}
            options={baseOpts()}
          />
        </Panel>

        <Panel title="TOP 10 COMUNAS">
          <Bar
            data={{
              labels: labels(stats.by_comuna),
              datasets: [{ label: 'Accidentes', data: counts(stats.by_comuna), backgroundColor: '#67e8f9' }],
            }}
            options={{ ...baseOpts(), indexAxis: 'y' }}
          />
        </Panel>

        <Panel title="EVOLUCIÓN ANUAL">
          <Line
            data={{
              labels: labels(years),
              datasets: [{
                label: 'Accidentes por año', data: counts(years),
                borderColor: CYAN, backgroundColor: 'rgba(34,211,238,0.12)',
                fill: true, tension: 0.3, pointRadius: 2,
              }],
            }}
            options={baseOpts()}
          />
        </Panel>
      </div>

      {/* Sección Lluvia */}
      {!weatherLoading && weatherStats && (
        <>
          <h2 style={{ 
            fontFamily: '"Orbitron", sans-serif', 
            fontSize: 18, 
            color: '#67e8f9', 
            marginTop: 40, 
            marginBottom: 16,
            letterSpacing: '0.1em'
          }}>
            🌧 PRECIPITACIÓN HISTÓRICA
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <Panel title="LLUVIA ANUAL (2008-2025)">
              <Bar
                data={{
                  labels: weatherStats.by_year.map(d => d.year),
                  datasets: [{
                    label: 'Precipitación (mm)',
                    data: weatherStats.by_year.map(d => d.total_mm),
                    backgroundColor: '#3b82f6'
                  }],
                }}
                options={baseOpts()}
              />
            </Panel>

            <Panel title="LLUVIA PROMEDIO POR MES">
              <Line
                data={{
                  labels: weatherStats.by_month.map(d => d.month),
                  datasets: [{
                    label: 'Precipitación promedio (mm)',
                    data: weatherStats.by_month.map(d => d.avg_mm),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.12)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3
                  }],
                }}
                options={baseOpts()}
              />
            </Panel>

            <Panel title="ESTADÍSTICAS CLIMA">
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                height: '100%',
                gap: 16 
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#3b82f6', fontFamily: '"Orbitron", sans-serif' }}>
                    {fmt(weatherStats.total_mm_18years)} mm
                  </div>
                  <div style={{ fontSize: 10, color: TICK, marginTop: 4 }}>LLUVIA TOTAL (18 AÑOS)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#67e8f9', fontFamily: '"Orbitron", sans-serif' }}>
                    {weatherStats.avg_hourly_mm} mm/h
                  </div>
                  <div style={{ fontSize: 10, color: TICK, marginTop: 4 }}>PROMEDIO HORARIO</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 500, color: '#a78bfa', fontFamily: '"Orbitron", sans-serif' }}>
                    {fmt(weatherStats.total_hours)} hrs
                  </div>
                  <div style={{ fontSize: 10, color: TICK, marginTop: 4 }}>REGISTROS HISTÓRICOS</div>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}

      <footer style={{ fontSize: 9, color: TICK, marginTop: 24, opacity: 0.6 }}>
        Fuente: Secretaría de Movilidad de Medellín · Dataset abierto (Mendeley r6g5dfnpgh, CC BY 4.0) • Clima: Open-Meteo Historical Weather API
      </footer>
    </div>
  );
}
