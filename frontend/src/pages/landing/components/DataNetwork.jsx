import { useRef, useEffect, useCallback } from 'react';

const HUB = { x: 0.5, y: 0.55 };

function createNodes(width, height) {
  const nodes = [];
  const seed = [0.42, 0.73, 0.91, 0.15, 0.62, 0.38, 0.87, 0.24, 0.56, 0.79, 0.11, 0.48, 0.95, 0.33, 0.67, 0.04, 0.52, 0.88, 0.29, 0.71, 0.44, 0.17, 0.83, 0.36, 0.61, 0.08, 0.76, 0.21, 0.54, 0.93, 0.41, 0.13, 0.69, 0.27, 0.59, 0.96, 0.31, 0.64, 0.02, 0.81, 0.46, 0.19, 0.74, 0.38, 0.89, 0.06, 0.51, 0.23, 0.77, 0.34, 0.97, 0.43, 0.12, 0.66, 0.28, 0.54, 0.84, 0.09, 0.71, 0.49, 0.16, 0.62, 0.37, 0.92, 0.25, 0.58, 0.03, 0.78, 0.41, 0.14, 0.69, 0.32, 0.88, 0.47, 0.11, 0.73, 0.22, 0.56, 0.95, 0.39, 0.05, 0.64, 0.18, 0.83, 0.51, 0.28, 0.76, 0.07, 0.61, 0.44, 0.91, 0.34, 0.67, 0.01, 0.81, 0.48, 0.26, 0.72, 0.16, 0.55];

  for (let i = 0; i < 100; i++) {
    const s = seed[i % seed.length];
    const s2 = seed[(i * 7 + 3) % seed.length];
    const s3 = seed[(i * 13 + 11) % seed.length];
    const layer = Math.floor(s * 3);
    const margin = 0.05 + layer * 0.03;

    if (i === 0) {
      nodes.push({ x: HUB.x, y: HUB.y, vx: 0, vy: 0, r: 3, layer: 0, phase: 0, speed: 0, isHub: true, connections: [] });
      continue;
    }

    let x, y, attempts = 0;
    do {
      x = margin + s * (1 - margin * 2);
      y = margin + s2 * (1 - margin * 2);
      attempts++;
    } while (attempts < 20 && nodes.some(n => Math.hypot(n.x - x, n.y - y) < 0.06));

    nodes.push({
      x, y,
      vx: 0, vy: 0,
      r: 2 + s3 * 1.5,
      layer,
      phase: s3 * Math.PI * 2,
      speed: 0.3 + s * 0.5,
      isHub: false,
      connections: [],
    });
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.hypot(dx, dy);
      if (d < 0.2 && (nodes[i].layer === nodes[j].layer || Math.abs(nodes[i].layer - nodes[j].layer) === 1)) {
        nodes[i].connections.push(j);
        nodes[j].connections.push(i);
      }
    }
  }

  return nodes;
}

function createPackets(nodes) {
  const packets = [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].connections.length === 0) continue;
    const targetIdx = nodes[i].connections[Math.floor(Math.random() * nodes[i].connections.length)];
    packets.push({
      from: i,
      to: targetIdx,
      progress: Math.random(),
      speed: 0.15 + Math.random() * 0.35,
      delay: Math.random() * 5,
    });
    if (Math.random() > 0.5 && nodes[targetIdx].connections.length > 0) {
      const next = nodes[targetIdx].connections[Math.floor(Math.random() * nodes[targetIdx].connections.length)];
      if (next !== i) {
        packets.push({
          from: targetIdx,
          to: next,
          progress: Math.random(),
          speed: 0.15 + Math.random() * 0.3,
          delay: Math.random() * 3,
        });
      }
    }
  }
  return packets;
}

export default function DataNetwork() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    sizeRef.current = { w, h };

    const nodes = createNodes(w, h);
    const packets = createPackets(nodes);
    stateRef.current = { nodes, packets, time: 0 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      sizeRef.current = { w, h };
      init();
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [init]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    function draw(t) {
      if (!running) return;
      const state = stateRef.current;
      if (!state) { rafRef.current = requestAnimationFrame(draw); return; }

      const { w, h } = sizeRef.current;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }

      const dt = state.time === 0 ? 0 : Math.min((t - state.time) / 1000, 0.05);
      state.time = t;

      ctx.clearRect(0, 0, w, h);

      const { nodes, packets } = state;

      for (const node of nodes) {
        const nx = node.x * w;
        const ny = node.y * h;
        ctx.beginPath();
        ctx.arc(nx, ny, node.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34,211,238,0.06)';
        ctx.fill();
      }

      const lineOpacity = 0.06 + 0.04 * Math.sin(t * 0.0003);
      ctx.strokeStyle = `rgba(34,211,238,${lineOpacity})`;
      ctx.lineWidth = 0.5;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (const j of a.connections) {
          if (j <= i) continue;
          const b = nodes[j];
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
        }
      }

      for (const pkt of packets) {
        pkt.progress += pkt.speed * dt * 0.3;
        if (pkt.progress > 1) {
          pkt.progress = 0;
          pkt.from = pkt.to;
          const nextNode = nodes[pkt.to];
          if (nextNode.connections.length > 0) {
            const next = nextNode.connections[Math.floor(Math.random() * nextNode.connections.length)];
            pkt.to = next;
          }
        }

        const from = nodes[pkt.from];
        const to = nodes[pkt.to];
        if (!from || !to) continue;

        const prog = pkt.progress;
        const px = from.x + (to.x - from.x) * prog;
        const py = from.y + (to.y - from.y) * prog;

        const alpha = Math.sin(prog * Math.PI) * 0.8;
        const size = 1.5 + Math.sin(prog * Math.PI) * 1;

        ctx.beginPath();
        ctx.arc(px * w, py * h, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(103,232,249,${alpha})`;
        ctx.fill();
      }

      for (const node of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.001 * node.speed + node.phase);
        const nx = node.x * w;
        const ny = node.y * h;
        const r = node.r * pulse;

        if (node.isHub) {
          const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 6);
          grd.addColorStop(0, 'rgba(34,211,238,0.15)');
          grd.addColorStop(0.3, 'rgba(34,211,238,0.06)');
          grd.addColorStop(1, 'rgba(34,211,238,0)');
          ctx.beginPath();
          ctx.arc(nx, ny, r * 6, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();

          const hr = 3 + 2 * Math.sin(t * 0.002);
          ctx.beginPath();
          ctx.arc(nx, ny, hr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34,211,238,${0.08 + 0.04 * Math.sin(t * 0.002)})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(nx, ny, r * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(nx, ny, r * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34,211,238,${0.3 + 0.2 * pulse})`;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(nx, ny, r * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34,211,238,${0.08 + 0.06 * pulse})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(nx, ny, r * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34,211,238,${0.2 + 0.15 * pulse})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { running = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}
