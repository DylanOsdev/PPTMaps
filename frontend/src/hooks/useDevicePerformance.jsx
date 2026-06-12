import { useEffect, useState, useRef, useMemo, createContext, useContext } from 'react';

export const PERFORMANCE_TIERS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const TIER_CONFIG = {
  [PERFORMANCE_TIERS.HIGH]: {
    globeParticles: 60,
    globeRings: 3,
    globeCities: 15,
    globeArcs: 10,
    enableRadar: true,
    enableScanLine: true,
    enableParallax: true,
    enableGlitch: true,
    typewriterSpeed: 0.04,
    counterDuration: 2,
    bubbleCount: 30,
    biolumCount: 30,
    fishCount: 6,
    rainDropCount: 40,
    digitalRainCount: 30,
    dustCount: 30,
    particleCount: 20,
    collidingDots: true,
    sonarPing: true,
    causticFloor: true,
    surfaceWave: true,
    lightRays: true,
    fpsThrottleMs: 0,
    preferWebGPU: false,
    useCanvas2D: false,
    maxPixelRatio: 2,
  },
  [PERFORMANCE_TIERS.MEDIUM]: {
    globeParticles: 30,
    globeRings: 2,
    globeCities: 15,
    globeArcs: 8,
    enableRadar: true,
    enableScanLine: false,
    enableParallax: true,
    enableGlitch: true,
    typewriterSpeed: 0.05,
    counterDuration: 1.5,
    bubbleCount: 15,
    biolumCount: 15,
    fishCount: 3,
    rainDropCount: 20,
    digitalRainCount: 15,
    dustCount: 15,
    particleCount: 12,
    collidingDots: true,
    sonarPing: true,
    causticFloor: true,
    surfaceWave: false,
    lightRays: false,
    fpsThrottleMs: 16,
    preferWebGPU: false,
    useCanvas2D: false,
    maxPixelRatio: 1.5,
  },
  [PERFORMANCE_TIERS.LOW]: {
    globeParticles: 15,
    globeRings: 1,
    globeCities: 8,
    globeArcs: 4,
    enableRadar: false,
    enableScanLine: false,
    enableParallax: false,
    enableGlitch: false,
    typewriterSpeed: 0.06,
    counterDuration: 1,
    bubbleCount: 0,
    biolumCount: 0,
    fishCount: 0,
    rainDropCount: 10,
    digitalRainCount: 8,
    dustCount: 0,
    particleCount: 6,
    collidingDots: false,
    sonarPing: false,
    causticFloor: false,
    surfaceWave: false,
    lightRays: false,
    fpsThrottleMs: 32,
    preferWebGPU: false,
    useCanvas2D: true,
    maxPixelRatio: 1,
  },
};

// ── GPU Detection ──────────────────────────────────────────────────────
function detectGPU() {
  const info = {
    renderer: '',
    vendor: '',
    isDedicated: false,
    isIntegrated: false,
    isApple: false,
    vram: 0,
    maxTextureSize: 0,
    hasWebGPU: false,
    hasWebGL2: false,
    unmaskedRenderer: '',
    unmaskedVendor: '',
  };

  if (typeof window === 'undefined') return info;

  // Check WebGPU support
  if (navigator.gpu) {
    info.hasWebGPU = true;
  }

  // WebGL 2 detection
  const canvas2 = document.createElement('canvas');
  const gl2 = canvas2.getContext('webgl2');
  if (gl2) {
    info.hasWebGL2 = true;
    info.maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE);
    gl2.getExtension('WEBGL_lose_context')?.loseContext();
  }

  // WebGL 1 fallback
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return info;

  // Get unmasked renderer/vendor (most reliable)
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    info.unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    info.unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    info.renderer = info.unmaskedRenderer;
    info.vendor = info.unmaskedVendor;
  } else {
    info.renderer = gl.getParameter(gl.RENDERER) || '';
    info.vendor = gl.getParameter(gl.VENDOR) || '';
  }

  // Estimate VRAM from MAX_TEXTURE_SIZE (rough heuristic)
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (maxTex >= 16384) info.vram = 8;
  else if (maxTex >= 8192) info.vram = 4;
  else if (maxTex >= 4096) info.vram = 2;
  else info.vram = 1;

  if (info.maxTextureSize === 0) info.maxTextureSize = maxTex;

  // Classify GPU
  const r = info.renderer.toLowerCase();
  const v = info.vendor.toLowerCase();

  // Apple Silicon / Apple GPU
  if (r.includes('apple') || r.includes('m1') || r.includes('m2') || r.includes('m3') || r.includes('m4')) {
    info.isApple = true;
    info.isDedicated = true;
  }
  // NVIDIA dedicated
  else if (r.includes('nvidia') || r.includes('geforce') || r.includes('rtx') || r.includes('gtx') || r.includes('quadro') || r.includes('tesla')) {
    info.isDedicated = true;
  }
  // AMD dedicated
  else if (r.includes('radeon') || r.includes('amd') || r.includes('rx ') || r.includes('vega') || r.includes('navi')) {
    info.isDedicated = true;
  }
  // Intel integrated
  else if (r.includes('intel') || v.includes('intel')) {
    if (r.includes('iris') || r.includes('xe') || r.includes('arc')) {
      info.isDedicated = true; // Intel Arc / Iris Xe is decent
    } else {
      info.isIntegrated = true;
    }
  }
  // Qualcomm Adreno (mobile)
  else if (r.includes('adreno') || r.includes('qualcomm')) {
    info.isDedicated = true; // mobile GPU but capable
  }
  // Mali (mobile)
  else if (r.includes('mali')) {
    info.isIntegrated = true;
  }
  // PowerVR (mobile)
  else if (r.includes('powervr') || r.includes('rogue')) {
    info.isIntegrated = true;
  }

  // Clean up
  const loseCtx = gl.getExtension('WEBGL_lose_context');
  if (loseCtx) loseCtx.loseContext();
  gl2?.getExtension('WEBGL_lose_context')?.loseContext();
  canvas.remove();
  canvas2.remove();

  return info;
}

function getHardwareScore() {
  let score = 0;

  if (typeof navigator !== 'undefined') {
    const hwConcurrency = navigator.hardwareConcurrency || 4;
    score += Math.min(hwConcurrency * 10, 80);

    if (navigator.deviceMemory) {
      score += Math.min(navigator.deviceMemory * 15, 60);
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === '4g') score += 20;
      else if (effectiveType === '3g') score += 10;
      else if (effectiveType === '2g') score -= 10;
      else if (effectiveType === 'slow-2g') score -= 20;
    }

    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) score -= 15;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) score -= 30;
  }

  // GPU scoring
  const gpu = detectGPU();

  // Dedicated GPU bonus
  if (gpu.isDedicated) score += 25;
  // Integrated GPU penalty
  else if (gpu.isIntegrated) score -= 10;

  // Apple Silicon bonus
  if (gpu.isApple) score += 20;

  // WebGPU bonus
  if (gpu.hasWebGPU) score += 10;

  // WebGL2 bonus
  if (gpu.hasWebGL2) score += 5;

  // VRAM scoring
  if (gpu.vram >= 8) score += 15;
  else if (gpu.vram >= 4) score += 10;
  else if (gpu.vram >= 2) score += 5;

  return Math.max(0, Math.min(100, score));
}

function determineTier(score) {
  if (score >= 70) return PERFORMANCE_TIERS.HIGH;
  if (score >= 40) return PERFORMANCE_TIERS.MEDIUM;
  return PERFORMANCE_TIERS.LOW;
}

function runBenchmark() {
  return new Promise((resolve) => {
    const start = performance.now();
    let iterations = 0;

    function benchmark() {
      const now = performance.now();
      iterations++;
      if (now - start < 100) {
        requestAnimationFrame(benchmark);
      } else {
        const fps = iterations / ((now - start) / 1000);
        const score = Math.min(100, Math.max(0, (fps / 60) * 100));
        resolve(score);
      }
    }
    requestAnimationFrame(benchmark);
  });
}

// GPU render benchmark: draws 500 colored triangles to stress the GPU
function runGPUBenchmark() {
  return new Promise((resolve) => {
    let canvas, gl;
    try {
      canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) { resolve(50); return; }

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, 'attribute vec2 p; attribute vec3 c; varying vec3 vC; void main(){vC=c; gl_Position=vec4(p,0,1);}');
      gl.compileShader(vs);

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, 'precision mediump float; varying vec3 vC; void main(){gl_FragColor=vec4(vC,1);}');
      gl.compileShader(fs);

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);

      const pLoc = gl.getAttribLocation(prog, 'p');
      const cLoc = gl.getAttribLocation(prog, 'c');

      const positions = [];
      const colors = [];
      for (let i = 0; i < 500; i++) {
        const x = (Math.random() * 2 - 1) * 0.8;
        const y = (Math.random() * 2 - 1) * 0.8;
        const s = 0.02 + Math.random() * 0.04;
        positions.push(x, y, x + s, y, x, y + s);
        const r = Math.random(), g = Math.random(), b = Math.random();
        colors.push(r, g, b, r, g, b, r, g, b);
      }

      const pBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(pLoc);
      gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

      const cBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(cLoc);
      gl.vertexAttribPointer(cLoc, 3, gl.FLOAT, false, 0, 0);

      const start = performance.now();
      let frames = 0;

      const cleanup = () => {
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(prog);
        gl.deleteBuffer(pBuf);
        gl.deleteBuffer(cBuf);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas.remove();
      };

      function draw() {
        gl.viewport(0, 0, 256, 256);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 1500);
        frames++;
        if (performance.now() - start < 100) {
          requestAnimationFrame(draw);
        } else {
          const gpuFps = frames / ((performance.now() - start) / 1000);
          const score = Math.min(100, Math.max(0, (gpuFps / 60) * 100));
          cleanup();
          resolve(score);
        }
      }
      requestAnimationFrame(draw);
    } catch {
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      if (canvas) canvas.remove();
      resolve(50);
    }
  });
}

const PerformanceContext = createContext(null);

export function PerformanceProvider({ children }) {
  const [tier, setTier] = useState(PERFORMANCE_TIERS.MEDIUM);
  const [config, setConfig] = useState(TIER_CONFIG[PERFORMANCE_TIERS.MEDIUM]);
  const [isReady, setIsReady] = useState(false);
  const [fps, setFps] = useState(60);
  const [gpuInfo, setGpuInfo] = useState({
    renderer: '', vendor: '', isDedicated: false, isIntegrated: false,
    isApple: false, vram: 0, hasWebGPU: false, hasWebGL2: false,
    maxTextureSize: 0, unmaskedRenderer: '', unmaskedVendor: '',
  });
  const fpsHistoryRef = useRef([]);
  const downgradeCountRef = useRef(0);
  const upgradeCountRef = useRef(0);
  const currentTierRef = useRef(PERFORMANCE_TIERS.MEDIUM);

  useEffect(() => {
    let mounted = true;
    let rafId;
    let lastTime = performance.now();
    let frameCount = 0;
    const FPS_SAMPLE_INTERVAL = 2000;
    const DOWNGRADE_THRESHOLD = 2;
    const UPGRADE_THRESHOLD = 5;

    async function initialize() {
      const detectedGpu = detectGPU();
      if (mounted) setGpuInfo(detectedGpu);

      const hardwareScore = getHardwareScore();
      let finalScore = hardwareScore;

      try {
        const [cpuScore, gpuScore] = await Promise.all([
          runBenchmark(),
          runGPUBenchmark(),
        ]);
        // Weight: CPU 40%, GPU 40%, hardware detection 20%
        finalScore = Math.round(cpuScore * 0.3 + gpuScore * 0.4 + hardwareScore * 0.3);
      } catch {
        try {
          const benchmarkScore = await runBenchmark();
          finalScore = Math.round((hardwareScore + benchmarkScore) / 2);
        } catch {
          finalScore = hardwareScore;
        }
      }

      const detectedTier = determineTier(finalScore);

      if (mounted) {
        currentTierRef.current = detectedTier;
        setTier(detectedTier);
        // Merge tier config with GPU-specific overrides
        const tierConf = { ...TIER_CONFIG[detectedTier] };
        if (detectedGpu.isDedicated) {
          tierConf.maxPixelRatio = Math.min(tierConf.maxPixelRatio + 0.5, 2);
        }
        if (detectedGpu.hasWebGPU && detectedGpu.isDedicated) {
          tierConf.preferWebGPU = true;
        }
        setConfig(tierConf);
        setIsReady(true);
      }
    }

    function monitorFps(now) {
      frameCount++;
      const elapsed = now - lastTime;

      if (elapsed >= FPS_SAMPLE_INTERVAL) {
        const currentFps = Math.round((frameCount / elapsed) * 1000);
        frameCount = 0;
        lastTime = now;

        if (mounted) setFps(currentFps);

        fpsHistoryRef.current.push(currentFps);
        if (fpsHistoryRef.current.length > 5) fpsHistoryRef.current.shift();

        const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
        const current = currentTierRef.current;

        if (avgFps < 25 && current !== PERFORMANCE_TIERS.LOW) {
          downgradeCountRef.current++;
          upgradeCountRef.current = 0;
          if (downgradeCountRef.current >= DOWNGRADE_THRESHOLD) {
            const newTier = current === PERFORMANCE_TIERS.HIGH ? PERFORMANCE_TIERS.MEDIUM : PERFORMANCE_TIERS.LOW;
            currentTierRef.current = newTier;
            setTier(newTier);
            setConfig(TIER_CONFIG[newTier]);
            downgradeCountRef.current = 0;
          }
        } else if (avgFps > 50 && current !== PERFORMANCE_TIERS.HIGH) {
          upgradeCountRef.current++;
          downgradeCountRef.current = 0;
          if (upgradeCountRef.current >= UPGRADE_THRESHOLD) {
            const newTier = current === PERFORMANCE_TIERS.LOW ? PERFORMANCE_TIERS.MEDIUM : PERFORMANCE_TIERS.HIGH;
            currentTierRef.current = newTier;
            setTier(newTier);
            setConfig(TIER_CONFIG[newTier]);
            upgradeCountRef.current = 0;
          }
        } else {
          downgradeCountRef.current = 0;
          upgradeCountRef.current = 0;
        }
      }

      rafId = requestAnimationFrame(monitorFps);
    }

    initialize();
    rafId = requestAnimationFrame(monitorFps);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => {
      if (mediaQuery.matches) {
        currentTierRef.current = PERFORMANCE_TIERS.LOW;
        setTier(PERFORMANCE_TIERS.LOW);
        setConfig(TIER_CONFIG[PERFORMANCE_TIERS.LOW]);
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const value = useMemo(() => ({
    tier, config, isReady, fps, gpuInfo,
    isLowEnd: tier === PERFORMANCE_TIERS.LOW,
    isHighEnd: tier === PERFORMANCE_TIERS.HIGH,
    hasDedicatedGPU: gpuInfo.isDedicated,
    hasWebGPU: gpuInfo.hasWebGPU,
  }), [tier, config, isReady, fps, gpuInfo]);

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function useDevicePerformance() {
  const ctx = useContext(PerformanceContext);
  if (ctx) return ctx;

  const [tier, setTier] = useState(PERFORMANCE_TIERS.MEDIUM);
  const [config, setConfig] = useState(TIER_CONFIG[PERFORMANCE_TIERS.MEDIUM]);
  const [isReady, setIsReady] = useState(false);
  const [gpuInfo, setGpuInfo] = useState({
    renderer: '', vendor: '', isDedicated: false, isIntegrated: false,
    isApple: false, vram: 0, hasWebGPU: false, hasWebGL2: false,
    maxTextureSize: 0, unmaskedRenderer: '', unmaskedVendor: '',
  });

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const detectedGpu = detectGPU();
      if (mounted) setGpuInfo(detectedGpu);

      const hardwareScore = getHardwareScore();
      let finalScore = hardwareScore;

      try {
        const [cpuScore, gpuScore] = await Promise.all([
          runBenchmark(),
          runGPUBenchmark(),
        ]);
        finalScore = Math.round(cpuScore * 0.3 + gpuScore * 0.4 + hardwareScore * 0.3);
      } catch {
        try {
          const benchmarkScore = await runBenchmark();
          finalScore = Math.round((hardwareScore + benchmarkScore) / 2);
        } catch {
          finalScore = hardwareScore;
        }
      }

      const detectedTier = determineTier(finalScore);

      if (mounted) {
        setTier(detectedTier);
        const tierConf = { ...TIER_CONFIG[detectedTier] };
        if (detectedGpu.isDedicated) {
          tierConf.maxPixelRatio = Math.min(tierConf.maxPixelRatio + 0.5, 2);
        }
        if (detectedGpu.hasWebGPU && detectedGpu.isDedicated) {
          tierConf.preferWebGPU = true;
        }
        setConfig(tierConf);
        setIsReady(true);
      }
    }

    initialize();

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => {
      if (mediaQuery.matches) {
        setTier(PERFORMANCE_TIERS.LOW);
        setConfig(TIER_CONFIG[PERFORMANCE_TIERS.LOW]);
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mounted = false;
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return {
    tier, config, isReady, gpuInfo,
    isLowEnd: tier === PERFORMANCE_TIERS.LOW,
    isHighEnd: tier === PERFORMANCE_TIERS.HIGH,
    hasDedicatedGPU: gpuInfo.isDedicated,
    hasWebGPU: gpuInfo.hasWebGPU,
  };
}

export function useViewportAnimation(enabled = true) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '100px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, isVisible: enabled ? isVisible : false };
}

export function getTierConfig(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG[PERFORMANCE_TIERS.MEDIUM];
}
