import { useState, useEffect } from 'react';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

export const useAirQuality = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAirQuality = async () => {
    try {
      const response = await fetch('/api/v1/public/air-quality/current');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const readings = await response.json();
      setData(readings);
      setError(null);
    } catch (err) {
      console.error('Error fetching air quality:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAirQuality();
    
    const interval = setInterval(fetchAirQuality, REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
};
