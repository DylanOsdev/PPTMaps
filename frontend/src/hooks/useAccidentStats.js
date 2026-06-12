import { useState, useEffect } from 'react';

/** Trae los agregados de accidentalidad (datos oficiales Medellín) desde el backend. */
export function useAccidentStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let alive = true;
    fetch('/api/v1/public/accidents/stats', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => alive && (setStats(d), setLoading(false)))
      .catch((e) => alive && (setError(e.message), setLoading(false)))
      .finally(() => clearTimeout(timeout));
    return () => { alive = false; };
  }, []);

  return { stats, loading, error };
}
