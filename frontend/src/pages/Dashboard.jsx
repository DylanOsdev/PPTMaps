import React from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { useAccidentStats } from '../hooks/useAccidentStats.js';

ChartJS.register(ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const GREEN = '#1a5c3a';
const PALETTE = ['#1a5c3a', '#3db84f', '#fbbf24', '#d32f2f', '#2d9e5e', '#8fbcbb'];
const GRID = 'rgba(0,0,0,0.08)';
const TICK = '#666666';

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
      background: '#ffffff', border: '1px solid #e0e0e0',
      borderRadius: 10, padding: 16,
    }}>
      <h3 style={{
        fontSize: 11, letterSpacing: '0.12em', color: GREEN,
        margin: '0 0 12px', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace',
      }}>{title}</h3>
      <div style={{ height: 240 }}>{children}</div>
    </div>
  );
}

function KPI({ value, label, color }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e0e0e0',
      borderRadius: 10, padding: '16px 20px', textAlign: 'center', minWidth: 140,
    }}>
      <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, letterSpacing: '0.1em', color: TICK, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { stats, loading, error } = useAccidentStats();

  const wrap = {
    minHeight: '100vh', background: '#f8f9f8', color: '#333333',
    fontFamily: '"JetBrains Mono", monospace', padding: '20px 24px 48px',
  };

  if (loading) return <div style={{ ...wrap, textAlign: 'center', paddingTop: 80, color: GREEN }}>CARGANDO ANALÍTICA…</div>;
  if (error || !stats) return (
    <div style={{ ...wrap, textAlign: 'center', paddingTop: 80, color: '#d32f2f' }}>
      ⚠ SIN DATOS ANALÍTICOS<div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>{error}</div>
      <div style={{ marginTop: 20 }}><Link to="/" style={{ color: GREEN }}>← Inicio</Link></div>
    </div>
  );

  const muertos = stats.by_severity.find((s) => s.key === 'MUERTO')?.count ?? 0;
  const years = [...stats.by_year].sort((a, b) => Number(a.key) - Number(b.key));

  return (
    <div style={wrap}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 22, margin: 0, color: GREEN }}>
            DASHBOARD ANALÍTICO
          </h1>
          <p style={{ fontSize: 10, color: TICK, margin: '4px 0 0' }}>
            Accidentalidad vial de Medellín · {stats.by_year.length} años de datos oficiales
          </p>
        </div>
        <nav style={{ display: 'flex', gap: 14, fontSize: 11 }}>
          <Link to="/" style={{ color: GREEN }}>← Inicio</Link>
          <Link to="/map" style={{ color: GREEN }}>🗺 Mapa</Link>
        </nav>
      </header>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPI value={fmt(stats.total)} label="INCIDENTES TOTALES" color={GREEN} />
        <KPI value={fmt(muertos)} label="VÍCTIMAS FATALES" color="#d32f2f" />
        <KPI value={stats.by_comuna.length ? stats.by_comuna[0].key : '—'} label="COMUNA MÁS CRÍTICA" color="#3db84f" />
        <KPI value={stats.by_class.length ? stats.by_class[0].key : '—'} label="CLASE MÁS FRECUENTE" color={GREEN} />
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
              datasets: [{ label: 'Accidentes', data: counts(stats.by_class), backgroundColor: GREEN }],
            }}
            options={baseOpts()}
          />
        </Panel>

        <Panel title="TOP 10 COMUNAS">
          <Bar
            data={{
              labels: labels(stats.by_comuna),
              datasets: [{ label: 'Accidentes', data: counts(stats.by_comuna), backgroundColor: '#3db84f' }],
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
                borderColor: GREEN, backgroundColor: 'rgba(26,92,58,0.12)',
                fill: true, tension: 0.3, pointRadius: 2,
              }],
            }}
            options={baseOpts()}
          />
        </Panel>
      </div>

      <footer style={{ fontSize: 9, color: TICK, marginTop: 24, opacity: 0.6 }}>
        Fuente: Secretaría de Movilidad de Medellín · Dataset abierto (Mendeley r6g5dfnpgh, CC BY 4.0)
      </footer>
    </div>
  );
}
