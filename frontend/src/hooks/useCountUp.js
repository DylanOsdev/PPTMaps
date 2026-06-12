import { useState, useEffect, useRef } from 'react';

export function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to = target;
    if (from === to) return;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * eased);
      setValue(current);
      if (t < 1) raf = requestAnimationFrame(step);
      else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
