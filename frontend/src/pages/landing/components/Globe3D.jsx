import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RADIUS = 2;

const ALL_CITIES = [
  { name: 'Medellín', lat: 6.2442, lng: -75.5812, size: 0.08, isHub: true },
  { name: 'Bogotá', lat: 4.7110, lng: -74.0721, size: 0.05 },
  { name: 'Cali', lat: 3.4516, lng: -76.5320, size: 0.04 },
  { name: 'Barranquilla', lat: 10.9685, lng: -74.7813, size: 0.04 },
  { name: 'Cartagena', lat: 10.3910, lng: -75.5144, size: 0.035 },
  { name: 'New York', lat: 40.7128, lng: -74.0060, size: 0.05 },
  { name: 'London', lat: 51.5074, lng: -0.1278, size: 0.04 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, size: 0.04 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, size: 0.035 },
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333, size: 0.04 },
  { name: 'Moscow', lat: 55.7558, lng: 37.6173, size: 0.035 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, size: 0.035 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777, size: 0.035 },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074, size: 0.04 },
  { name: 'Lagos', lat: 6.5244, lng: 3.3792, size: 0.03 },
];

const ALL_ARCS = [
  ['Medellín', 'Bogotá'],
  ['Medellín', 'Cali'],
  ['Medellín', 'New York'],
  ['Medellín', 'London'],
  ['Medellín', 'Tokyo'],
  ['Medellín', 'São Paulo'],
  ['New York', 'London'],
  ['Tokyo', 'Sydney'],
  ['Dubai', 'Mumbai'],
  ['Moscow', 'Beijing'],
];

function generateEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#0a1628');
  gradient.addColorStop(0.3, '#0d1f3c');
  gradient.addColorStop(0.5, '#0f2847');
  gradient.addColorStop(0.7, '#0d1f3c');
  gradient.addColorStop(1, '#0a1628');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);

  const majorGrids = 12;
  const minorGrids = 24;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i < majorGrids; i++) {
    const x = (i / majorGrids) * 1024;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let i = 0; i < majorGrids / 2; i++) {
    const y = (i / (majorGrids / 2)) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < minorGrids; i++) {
    const x = (i / minorGrids) * 1024;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let i = 0; i < minorGrids / 2; i++) {
    const y = (i / (minorGrids / 2)) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  const landmasses = [
    { lat: 40, lng: -100, w: 80, h: 40 },
    { lat: 20, lng: -80, w: 40, h: 60 },
    { lat: -15, lng: -60, w: 30, h: 50 },
    { lat: 50, lng: 10, w: 40, h: 30 },
    { lat: 30, lng: 30, w: 20, h: 25 },
    { lat: 20, lng: 75, w: 30, h: 40 },
    { lat: -25, lng: 135, w: 25, h: 20 },
    { lat: 60, lng: 100, w: 50, h: 20 },
  ];
  landmasses.forEach(lm => {
    const x = ((lm.lng + 180) / 360) * 1024;
    const y = ((90 - lm.lat) / 180) * 512;
    ctx.fillStyle = 'rgba(34, 211, 238, 0.04)';
    ctx.beginPath();
    ctx.ellipse(x, y, lm.w * 1.2, lm.h * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.025)';
    ctx.beginPath();
    ctx.ellipse(x, y, lm.w * 2.5, lm.h * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const size = 0.5 + Math.random() * 1.5;
    ctx.fillStyle = `rgba(34, 211, 238, ${0.01 + Math.random() * 0.03})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

let _cachedTexture = null;
function getEarthTexture() {
  if (!_cachedTexture) _cachedTexture = generateEarthTexture();
  return _cachedTexture;
}

function latLngToVec3(lat, lng, radius = RADIUS) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (180 + lng) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function Starfield({ count }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 15 + Math.random() * 35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.02 + Math.random() * 0.06;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.003;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        color="#22D3EE"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function EarthSurface({ visible }) {
  const meshRef = useRef();
  const texture = useMemo(() => getEarthTexture(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.material.opacity = 0.7 + 0.05 * Math.sin(t * 0.3);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[RADIUS, 80, 80]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.75}
        depthWrite={true}
      />
    </mesh>
  );
}

function AtmosphereLayers({ visible }) {
  const layer1Ref = useRef();
  const layer2Ref = useRef();
  const layer3Ref = useRef();

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.getElapsedTime();
    if (layer1Ref.current) {
      layer1Ref.current.material.opacity = 0.12 + 0.04 * Math.sin(t * 0.4);
      layer1Ref.current.scale.setScalar(1.03 + 0.008 * Math.sin(t * 0.25));
    }
    if (layer2Ref.current) {
      layer2Ref.current.material.opacity = 0.06 + 0.02 * Math.sin(t * 0.35 + 1);
      layer2Ref.current.scale.setScalar(1.05 + 0.006 * Math.sin(t * 0.2 + 0.5));
    }
    if (layer3Ref.current) {
      layer3Ref.current.material.opacity = 0.03 + 0.015 * Math.sin(t * 0.3 + 2);
      layer3Ref.current.scale.setScalar(1.08 + 0.005 * Math.sin(t * 0.15 + 1));
    }
  });

  return (
    <group>
      <mesh ref={layer1Ref}>
        <sphereGeometry args={[RADIUS * 1.12, 48, 48]} />
        <meshBasicMaterial
          color="#22D3EE"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={layer2Ref}>
        <sphereGeometry args={[RADIUS * 1.18, 48, 48]} />
        <meshBasicMaterial
          color="#3B82F6"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={layer3Ref}>
        <sphereGeometry args={[RADIUS * 1.25, 48, 48]} />
        <meshBasicMaterial
          color="#818CF8"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function GridOverlay({ visible }) {
  const wireRef = useRef();
  const detailRef = useRef();

  useFrame(({ clock }) => {
    if (!wireRef.current || !detailRef.current) return;
    const t = clock.getElapsedTime();
    wireRef.current.material.opacity = 0.06 + 0.03 * Math.sin(t * 0.2);
    detailRef.current.material.opacity = 0.03 + 0.02 * Math.sin(t * 0.15);
  });

  return (
    <group>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[RADIUS + 0.015, 3]} />
        <meshBasicMaterial color="#22D3EE" wireframe transparent opacity={0.06} />
      </mesh>
      <mesh ref={detailRef}>
        <sphereGeometry args={[RADIUS + 0.01, 32, 32]} />
        <meshBasicMaterial color="#22D3EE" wireframe transparent opacity={0.03} />
      </mesh>
    </group>
  );
}

function CityPoints({ cities, visible }) {
  const dotsRef = useRef();
  const glowRef = useRef();
  const ringRef = useRef();
  const coreRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const cityPositions = useMemo(() =>
    cities.map(c => latLngToVec3(c.lat, c.lng, RADIUS))
  , [cities]);

  const citySizes = useMemo(() =>
    cities.map(c => c.size || 0.04)
  , [cities]);

  const isHub = useMemo(() =>
    cities.map(c => c.isHub || false)
  , [cities]);

  const count = cityPositions.length;

  useFrame(({ clock }) => {
    if (!dotsRef.current || !glowRef.current || !ringRef.current || !coreRef.current || !visible) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const pos = cityPositions[i];
      const baseSize = citySizes[i];
      const hub = isHub[i];

      const pulse = 0.85 + 0.15 * Math.sin(t * (hub ? 1.2 : 0.8) + i * 1.5);
      const glowPulse = 0.6 + 0.4 * Math.sin(t * (hub ? 1.5 : 1.0) + i * 2.0);
      const ringPulse = (t * 0.3 + i * 0.5) % 1.0;

      dummy.position.copy(pos);
      dummy.scale.setScalar(pulse * baseSize * (hub ? 1.5 : 1.0));
      dummy.updateMatrix();
      dotsRef.current.setMatrixAt(i, dummy.matrix);

      dummy.scale.setScalar(glowPulse * baseSize * 3.5 * (hub ? 2.5 : 1.8));
      dummy.updateMatrix();
      glowRef.current.setMatrixAt(i, dummy.matrix);

      const ringScale = baseSize * 0.3 + ringPulse * baseSize * 4.0;
      dummy.scale.setScalar(ringScale);
      dummy.rotation.set(0, t * 0.2, 0);
      dummy.updateMatrix();
      ringRef.current.setMatrixAt(i, dummy.matrix);

      dummy.scale.setScalar(glowPulse * baseSize * 1.8 * (hub ? 2.0 : 1.5));
      dummy.updateMatrix();
      coreRef.current.setMatrixAt(i, dummy.matrix);
    }
    dotsRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
    ringRef.current.instanceMatrix.needsUpdate = true;
    coreRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={ringRef} args={[undefined, undefined, count]}>
        <ringGeometry args={[0.015, 0.06, 32]} />
        <meshBasicMaterial
          color="#67E8F9"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial
          color="#22D3EE"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={coreRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial
          color="#67E8F9"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={dotsRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.9}
        />
      </instancedMesh>
    </group>
  );
}

function ConnectionArcs({ arcs, cityMap, visible }) {
  const flowRef = useRef();

  const arcData = useMemo(() => {
    return arcs.map(([from, to], i) => {
      const f = cityMap[from];
      const t = cityMap[to];
      if (!f || !t) return null;
      const start = latLngToVec3(f.lat, f.lng);
      const end = latLngToVec3(t.lat, t.lng);
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const dist = start.distanceTo(end);
      mid.normalize().multiplyScalar(RADIUS + dist * 0.4);
      const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      const baseOpacity = 0.12 + (seed - Math.floor(seed)) * 0.08;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(60);
      return { start, mid, end, from, to, baseOpacity, curve, points };
    }).filter(Boolean);
  }, [arcs, cityMap]);

  const flowMeshes = useMemo(() => arcData.map((d) => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(20 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#67E8F9',
      size: 0.03,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }), [arcData]);

  useEffect(() => {
    return () => {
      flowMeshes.forEach(f => { f.geometry.dispose(); f.material.dispose(); });
    };
  }, [flowMeshes]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const time = clock.getElapsedTime();

    const lineMat = (window.__globeLineMat);
    if (lineMat) {
      lineMat.forEach((mat, i) => {
        if (i >= arcData.length) return;
        const d = arcData[i];
        if (!d) return;
        mat.opacity = (d.baseOpacity || 0.1) * (0.5 + 0.5 * Math.sin(time * 0.4 + i * 1.5));
        mat.color.setHSL(0.52, 0.8, 0.5 + 0.2 * Math.sin(time * 0.3 + i));
      });
    }

    flowMeshes.forEach((flow, i) => {
      const d = arcData[i];
      if (!d) return;
      const positions = flow.geometry.attributes.position.array;
      const numParticles = 20;
      const progress = (time * 0.25 + i * 0.7) % 1.0;

      for (let j = 0; j < numParticles; j++) {
        const pp = (progress + j / numParticles) % 1.0;
        const point = d.curve.getPoint(pp);
        positions[j * 3] = point.x;
        positions[j * 3 + 1] = point.y;
        positions[j * 3 + 2] = point.z;
      }
      flow.geometry.attributes.position.needsUpdate = true;
      flow.material.opacity = 0.5 + 0.4 * Math.sin(time * 0.6 + i * 2.0);
    });
  });

  const lines = useMemo(() => {
    const mats = [];
    const objs = arcData.map((d) => {
      const mat = new THREE.LineBasicMaterial({
        color: '#22D3EE',
        transparent: true,
        opacity: d.baseOpacity || 0.1,
      });
      mats.push(mat);
      const geo = new THREE.BufferGeometry().setFromPoints(d.points);
      return new THREE.Line(geo, mat);
    });
    window.__globeLineMat = mats;
    return objs;
  }, [arcData]);

  useEffect(() => {
    return () => {
      lines.forEach(l => { l.geometry.dispose(); l.material.dispose(); });
      delete window.__globeLineMat;
    };
  }, [lines]);

  return (
    <group ref={flowRef}>
      {lines.map((line, i) => <primitive key={`line-${i}`} object={line} />)}
      {flowMeshes.map((flow, i) => <primitive key={`flow-${i}`} object={flow} />)}
    </group>
  );
}

function DataFlowParticles({ count, visible }) {
  const ref = useRef();
  const offsets = useRef([]);
  const speeds = useRef([]);
  const phases = useRef([]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const off = new Float32Array(count);
    const spd = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.max(-1, Math.min(1, 2 * Math.random() - 1)));
      const r = RADIUS + 0.15 + Math.random() * 1.2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      off[i] = Math.random() * Math.PI * 2;
      spd[i] = 0.08 + Math.random() * 0.2;
      phase[i] = Math.random() * Math.PI * 2;
      sizes[i] = 0.02 + Math.random() * 0.04;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    offsets.current = off;
    speeds.current = spd;
    phases.current = phase;
    return geo;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current || !visible) return;
    const time = clock.getElapsedTime();
    const posAttr = ref.current.geometry.attributes.position;
    const arr = posAttr.array;
    const off = offsets.current;
    const spd = speeds.current;
    const phase = phases.current;
    for (let i = 0; i < count; i++) {
      const angle = time * spd[i] + off[i];
      const radius = RADIUS + 0.15 + 0.6 * (0.5 + 0.5 * Math.sin(angle * 0.5 + phase[i]));
      const theta = angle * 0.6;
      const phi = Math.acos(Math.max(-1, Math.min(1, 0.8 * Math.sin(angle * 0.4 + phase[i]))));
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.cos(phi);
      arr[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    posAttr.needsUpdate = true;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.025}
        color="#22D3EE"
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function ExpandingRings({ ringCount, visible }) {
  const innerRef = useRef();
  const outerRef = useRef();
  const medPos = useMemo(() => latLngToVec3(6.2442, -75.5812, RADIUS), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const innerMeshCount = ringCount;
  const outerMeshCount = ringCount;

  useFrame(({ clock }) => {
    if (!innerRef.current || !outerRef.current || !visible) return;
    const time = clock.getElapsedTime();
    for (let i = 0; i < innerMeshCount; i++) {
      const delay = i * 1.5;
      const t = (time + delay) % 4 / 4;
      const scale = 0.3 + t * 6;
      dummy.position.copy(medPos);
      dummy.scale.setScalar(scale);
      dummy.lookAt(0, 0, 0);
      dummy.rotation.z = time * 0.1;
      dummy.updateMatrix();
      innerRef.current.setMatrixAt(i, dummy.matrix);
    }
    innerRef.current.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < outerMeshCount; i++) {
      const delay = i * 1.5 + 1;
      const t = (time + delay) % 4 / 4;
      const scale = 0.5 + t * 5;
      dummy.position.copy(medPos);
      dummy.scale.setScalar(scale);
      dummy.lookAt(0, 0, 0);
      dummy.rotation.z = -time * 0.08;
      dummy.updateMatrix();
      outerRef.current.setMatrixAt(i, dummy.matrix);
    }
    outerRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={innerRef} args={[undefined, undefined, innerMeshCount]}>
        <ringGeometry args={[0.015, 0.05, 48]} />
        <meshBasicMaterial
          color="#22D3EE"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={outerRef} args={[undefined, undefined, outerMeshCount]}>
        <ringGeometry args={[0.03, 0.07, 32]} />
        <meshBasicMaterial
          color="#67E8F9"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}

function GlobeInner({ config, visible }) {
  const groupRef = useRef();

  const cities = useMemo(() => ALL_CITIES.slice(0, config.globeCities), [config.globeCities]);
  const arcs = useMemo(() => ALL_ARCS.slice(0, config.globeArcs), [config.globeArcs]);
  const cityMap = useMemo(() => {
    const map = {};
    ALL_CITIES.forEach(c => { map[c.name] = c; });
    return map;
  }, []);

  useFrame(({ clock, mouse }) => {
    if (!groupRef.current || !visible) return;
    groupRef.current.rotation.y += 0.002;
    groupRef.current.rotation.x += (mouse.y * 0.3 - groupRef.current.rotation.x - 0.08) * 0.02;
    groupRef.current.rotation.z += (mouse.x * 0.2 - groupRef.current.rotation.z) * 0.02;
  });

  return (
    <group ref={groupRef}>
      <Starfield count={config.globeParticles * 3} />
      <EarthSurface visible={visible} />
      <GridOverlay visible={visible} />
      <AtmosphereLayers visible={visible} />
      <CityPoints cities={cities} visible={visible} />
      <ConnectionArcs arcs={arcs} cityMap={cityMap} visible={visible} />
      <DataFlowParticles count={config.globeParticles} visible={visible} />
      <ExpandingRings ringCount={config.globeRings} visible={visible} />
    </group>
  );
}

export default function Globe3D({ config }) {
  const containerRef = useRef();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" style={{ transform: 'scale(1.15)' }}>
      <Canvas
        camera={{ position: [0, 1.8, 5.5], fov: 45, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
        frameloop={visible ? 'always' : 'never'}
      >
        <GlobeInner config={config} visible={visible} />
      </Canvas>
    </div>
  );
}
