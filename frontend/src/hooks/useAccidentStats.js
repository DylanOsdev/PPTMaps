import { useState, useEffect } from 'react';

/** Trae los agregados de accidentalidad (datos oficiales Medellín) desde el backend. */
export function useAccidentStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/v1/public/accidents/stats')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => alive && (setStats(d), setLoading(false)))
      .catch((e) => alive && (setError(e.message), setLoading(false)));
    return () => { alive = false; };
  }, []);

  return { stats, loading, error };
}
