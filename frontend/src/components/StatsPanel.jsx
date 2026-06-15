import React, { useState, useMemo } from 'react';
import { useAccidentStats } from '../hooks/useAccidentStats';
import { useWeatherStats } from '../hooks/useWeatherStats';
import { FaChartBar, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';

const COLORS = ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316'];
const SEVERITY_COLORS = { MUERTO: '#ef4444', HERIDO: '#f59e0b', DANOS: '#10b981' };

export default function StatsPanel({ onClose, onFlyToComuna, embed }) {
  const { stats, loading } = useAccidentStats();
  const { stats: weatherStats, loading: weatherLoading } = useWeatherStats();
  const [activeTab, setActiveTab] = useState('accidents');

  const topComunas = useMemo(() => {
    if (!stats?.by_comuna) return [];
    return [...stats.by_comuna].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [stats]);

  const severityData = useMemo(() => {
    if (!stats?.by_severity) return [];
    return stats.by_severity;
  }, [stats]);

  const maxComunaCount = useMemo(() => {
    if (topComunas.length === 0) return 1;
    return topComunas[0].count;
  }, [topComunas]);

  if (loading && !embed) {
    return (
      <div style={{ color: '#38bdf8', fontSize: 11, letterSpacing: '0.15em', textAlign: 'center', padding: 24 }}>
        CARGANDO ESTADÍSTICAS...
      </div>
    );
  }

  const containerStyle = embed ? {
    fontFamily: '"JetBrains Mono", monospace',
    color: '#e2e8f0'
  } : {
    position: 'absolute', top: 60, right: 16, zIndex: 1001,
    width: 340, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
    background: 'rgba(15,23,42,0.95)', borderRadius: 8,
    border: '1px solid rgba(56,189,248,0.2)',
    backdropFilter: 'blur(12px)', fontFamily: '"JetBrains Mono", monospace',
    boxShadow: '0 0 30px rgba(0,0,0,0.5)'
  };

  return (
    <div style={containerStyle}>
      {!embed && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid rgba(56,189,248,0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaChartBar size={14} color="#38bdf8" />
            <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em' }}>
              ESTADÍSTICAS
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
            padding: 4, display: 'flex', alignItems: 'center'
          }}>
            <FaTimes size={14} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(56,189,248,0.1)' }}>
        <button onClick={() => setActiveTab('accidents')} style={{
          flex: 1, padding: '8px 0', background: 'none', border: 'none',
          color: activeTab === 'accidents' ? '#38bdf8' : '#64748b',
          fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer',
          borderBottom: activeTab === 'accidents' ? '2px solid #38bdf8' : '2px solid transparent',
          transition: 'all 0.2s'
        }}>ACCIDENTES</button>
        <button onClick={() => setActiveTab('weather')} style={{
          flex: 1, padding: '8px 0', background: 'none', border: 'none',
          color: activeTab === 'weather' ? '#38bdf8' : '#64748b',
          fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer',
          borderBottom: activeTab === 'weather' ? '2px solid #38bdf8' : '2px solid transparent',
          transition: 'all 0.2s'
        }}>CLIMA</button>
      </div>

      {activeTab === 'accidents' && stats && (
        <div style={{ padding: 12 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16
          }}>
            <KpiCard label="TOTAL" value={stats.total?.toLocaleString() || '—'} color="#38bdf8" />
            <KpiCard label="VÍCTIMAS" value={stats.by_severity?.find(s => s.key === 'MUERTO')?.count?.toLocaleString() || '—'} color="#ef4444" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#94a3b8', fontSize: 9, letterSpacing: '0.1em', marginBottom: 8 }}>
              POR GRAVEDAD  <span style={{ color: '#64748b' }}>— click para filtrar</span>
            </div>
            {severityData.map(s => {
              const total = severityData.reduce((sum, x) => sum + x.count, 0);
              const pct = total > 0 ? (s.count / total * 100).toFixed(1) : 0;
              return (
                <div key={s.key} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: SEVERITY_COLORS[s.key] || '#94a3b8', fontWeight: 600 }}>{s.key}</span>
                    <span style={{ color: '#e2e8f0' }}>{s.count.toLocaleString()} <span style={{ color: '#64748b' }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: SEVERITY_COLORS[s.key] || '#38bdf8',
                      borderRadius: 2, transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div style={{ color: '#94a3b8', fontSize: 9, letterSpacing: '0.1em', marginBottom: 8 }}>
              TOP COMUNAS  <span style={{ color: '#64748b' }}>— click para ir al mapa</span>
            </div>
            {topComunas.map((c, i) => (
              <button key={c.key} onClick={() => onFlyToComuna(c.key)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 8px', marginBottom: 2, background: 'none', border: 'none',
                borderRadius: 4, cursor: 'pointer', color: '#e2e8f0', fontSize: 10,
                transition: 'all 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span style={{ color: COLORS[i % COLORS.length], fontWeight: 700, width: 16 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>{c.key}</span>
                    <span style={{ color: '#64748b' }}>{c.count.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${(c.count / maxComunaCount) * 100}%`, height: '100%',
                      background: COLORS[i % COLORS.length], borderRadius: 2,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                <FaMapMarkerAlt size={10} color="#64748b" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'weather' && weatherStats && (
        <div style={{ padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <KpiCard label="LLUVIA TOTAL" value={weatherStats.total_mm_18years ? `${weatherStats.total_mm_18years.toLocaleString()}mm` : '—'} color="#06b6d4" />
            <KpiCard label="PROMEDIO" value={weatherStats.avg_hourly_mm || '—'} color="#0ea5e9" />
            <KpiCard label="REGISTROS" value={weatherStats.total_hours?.toLocaleString() || '—'} color="#3b82f6" />
          </div>

          {weatherStats.by_month && (
            <div>
              <div style={{ color: '#94a3b8', fontSize: 9, letterSpacing: '0.1em', marginBottom: 8 }}>
                LLUVIA PROMEDIO POR MES (mm)
              </div>
              {weatherStats.by_month.slice(0, 12).map(m => {
                const maxMonth = Math.max(...weatherStats.by_month.slice(0, 12).map(x => x.avg_mm));
                const pct = maxMonth > 0 ? (m.avg_mm / maxMonth) * 100 : 0;
                return (
                  <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ color: '#64748b', fontSize: 9, width: 28, flexShrink: 0 }}>{m.month}</span>
                    <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: '#06b6d4', borderRadius: 2
                      }} />
                    </div>
                    <span style={{ color: '#64748b', fontSize: 9, width: 40, textAlign: 'right' }}>{m.avg_mm}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 6,
      border: `1px solid ${color}20`,
      background: `linear-gradient(135deg, ${color}08, transparent)`,
      textAlign: 'center'
    }}>
      <div style={{ color: '#64748b', fontSize: 8, letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 16, fontWeight: 700, fontFamily: '"Orbitron", sans-serif' }}>{value}</div>
    </div>
  );
}
