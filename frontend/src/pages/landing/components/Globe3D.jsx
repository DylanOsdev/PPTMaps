import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RADIUS = 2;
const CITY_COLOR = '#22D3EE';
const CITY_GLOW_COLOR = '#06B6D4';
const ARC_COLOR = '#22D3EE';
const ARC_FLOW_COLOR = '#67E8F9';

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

function latLngToVec3(lat, lng, radius = RADIUS) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (180 + lng) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function CityPoints({ cities, visible }) {
  const dotsRef = useRef();
  const glowRef = useRef();
  const ringRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const cityPositions = useMemo(() => {
    return cities.map(c => latLngToVec3(c.lat, c.lng, RADIUS));
  }, [cities]);

  const citySizes = useMemo(() => {
    return cities.map(c => c.size || 0.04);
  }, [cities]);

  const isHub = useMemo(() => {
    return cities.map(c => c.isHub || false);
  }, [cities]);

  const count = cityPositions.length;

  useFrame(({ clock }) => {
    if (!dotsRef.current || !glowRef.current || !ringRef.current || !visible) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const pos = cityPositions[i];
      const baseSize = citySizes[i];
      const hub = isHub[i];
      
      const pulse = 0.85 + 0.15 * Math.sin(t * (hub ? 1.2 : 0.8) + i * 1.5);
      const glowPulse = 0.7 + 0.3 * Math.sin(t * (hub ? 1.5 : 1.0) + i * 2.0);
      const ringPulse = (t * 0.3 + i * 0.5) % 1.0;
      
      dummy.position.copy(pos);
      dummy.scale.setScalar(pulse * baseSize * (hub ? 1.5 : 1.0));
      dummy.updateMatrix();
      dotsRef.current.setMatrixAt(i, dummy.matrix);
      
      dummy.scale.setScalar(glowPulse * baseSize * 2.5 * (hub ? 2.0 : 1.5));
      dummy.updateMatrix();
      glowRef.current.setMatrixAt(i, dummy.matrix);
      
      dummy.scale.setScalar(baseSize * 0.5 + ringPulse * baseSize * 3.0);
      dummy.rotation.set(0, t * 0.2, 0);
      dummy.updateMatrix();
      ringRef.current.setMatrixAt(i, dummy.matrix);
    }
    dotsRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
    ringRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={ringRef} args={[undefined, undefined, count]}>
        <ringGeometry args={[0.02, 0.08, 32]} />
        <meshBasicMaterial
          color={CITY_GLOW_COLOR}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial
          color={CITY_GLOW_COLOR}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={dotsRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial
          color={CITY_COLOR}
          transparent
          opacity={1}
        />
      </instancedMesh>
    </group>
  );
}

function ConnectionArcs({ arcs, cityMap, visible }) {
  const arcsRef = useRef();
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
      const opacity = 0.12 + (seed - Math.floor(seed)) * 0.08;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(60);
      return { start, mid, end, from, to, opacity, curve, points };
    }).filter(Boolean);
  }, [arcs, cityMap]);

  const lineMeshes = useMemo(() => arcData.map((d, i) => {
    const geo = new THREE.BufferGeometry().setFromPoints(d.points);
    const mat = new THREE.LineBasicMaterial({
      color: ARC_COLOR,
      transparent: true,
      opacity: d.opacity,
      linewidth: 1,
    });
    return new THREE.Line(geo, mat);
  }), [arcData]);

  const flowMeshes = useMemo(() => arcData.map((d, i) => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(20 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: ARC_FLOW_COLOR,
      size: 0.025,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }), [arcData]);

  useEffect(() => {
    return () => {
      lineMeshes.forEach(line => {
        line.geometry.dispose();
        line.material.dispose();
      });
      flowMeshes.forEach(flow => {
        flow.geometry.dispose();
        flow.material.dispose();
      });
    };
  }, [lineMeshes, flowMeshes]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const time = clock.getElapsedTime();
    
    lineMeshes.forEach((line, i) => {
      const opacity = 0.06 + 0.1 * (0.5 + 0.5 * Math.sin(time * 0.5 + i * 1.5));
      line.material.opacity = opacity;
    });
    
    flowMeshes.forEach((flow, i) => {
      const d = arcData[i];
      const positions = flow.geometry.attributes.position.array;
      const numParticles = 20;
      const progress = (time * 0.3 + i * 0.7) % 1.0;
      
      for (let j = 0; j < numParticles; j++) {
        const particleProgress = (progress + j / numParticles) % 1.0;
        const point = d.curve.getPoint(particleProgress);
        positions[j * 3] = point.x;
        positions[j * 3 + 1] = point.y;
        positions[j * 3 + 2] = point.z;
      }
      flow.geometry.attributes.position.needsUpdate = true;
      
      const flowOpacity = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(time * 0.8 + i * 2.0));
      flow.material.opacity = flowOpacity;
    });
  });

  return (
    <group ref={arcsRef}>
      {lineMeshes.map((line, i) => <primitive key={`line-${i}`} object={line} />)}
      {flowMeshes.map((flow, i) => <primitive key={`flow-${i}`} object={flow} />)}
    </group>
  );
}

function DataFlowParticles({ count, visible }) {
  const particlesRef = useRef();
  const offsetsRef = useRef([]);
  const speedsRef = useRef([]);
  const phasesRef = useRef([]);
  const sizesRef = useRef([]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const off = new Float32Array(count);
    const spd = new Float32Array(count);
    const phase = new Float32Array(count);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.max(-1, Math.min(1, 2 * Math.random() - 1)));
      const r = RADIUS + 0.1 + Math.random() * 0.8;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      off[i] = Math.random() * Math.PI * 2;
      spd[i] = 0.15 + Math.random() * 0.35;
      phase[i] = Math.random() * Math.PI * 2;
      sz[i] = 0.02 + Math.random() * 0.03;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    offsetsRef.current = off;
    speedsRef.current = spd;
    phasesRef.current = phase;
    sizesRef.current = sz;
    return geo;
  }, [count]);

  useFrame(({ clock }) => {
    if (!particlesRef.current || !visible) return;
    const time = clock.getElapsedTime();
    const posAttr = particlesRef.current.geometry.attributes.position;
    const arr = posAttr.array;
    const off = offsetsRef.current;
    const spd = speedsRef.current;
    const phase = phasesRef.current;
    const sz = sizesRef.current;
    for (let i = 0; i < count; i++) {
      const angle = time * spd[i] + off[i];
      const radius = RADIUS + 0.1 + 0.4 * (0.5 + 0.5 * Math.sin(angle * 0.5 + phase[i]));
      const theta = angle * 0.7;
      const phi = Math.acos(Math.max(-1, Math.min(1, 2 * ((angle * 0.3 + off[i] * 0.1 + phase[i]) % 1) - 1)));
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.cos(phi);
      arr[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    posAttr.needsUpdate = true;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.03}
        color={CITY_COLOR}
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        vertexColors={false}
      />
    </points>
  );
}

function ExpandingRings({ ringCount, visible }) {
  const ringsRef = useRef();
  const ringData = useMemo(() => {
    const medPos = latLngToVec3(6.2442, -75.5812, RADIUS);
    return Array.from({ length: ringCount }, (_, i) => ({
      position: medPos.clone(),
      delay: i * 1.5,
      colorOffset: i * 0.3,
    }));
  }, [ringCount]);

  const ringMeshes = useMemo(() => ringData.map((d, i) => {
    const geo = new THREE.RingGeometry(0.015, 0.05, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: ARC_COLOR,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { colorOffset: d.colorOffset };
    return mesh;
  }), [ringData]);

  const outerRingMeshes = useMemo(() => ringData.map(() => {
    const geo = new THREE.RingGeometry(0.03, 0.08, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: CITY_GLOW_COLOR,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Mesh(geo, mat);
  }), [ringData]);

  useEffect(() => {
    return () => {
      ringMeshes.forEach(mesh => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      outerRingMeshes.forEach(mesh => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
    };
  }, [ringMeshes, outerRingMeshes]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const time = clock.getElapsedTime();
    ringMeshes.forEach((mesh, i) => {
      const t = (time + ringData[i].delay) % 4 / 4;
      const scale = 0.3 + t * 6;
      mesh.scale.setScalar(scale);
      mesh.material.opacity = 0.7 * (1 - t) * (0.5 + 0.5 * Math.sin(time * 2 + ringData[i].colorOffset));
      mesh.position.copy(ringData[i].position);
      mesh.lookAt(0, 0, 0);
      mesh.rotation.z = time * 0.1;
    });
    outerRingMeshes.forEach((mesh, i) => {
      const t = (time + ringData[i].delay + 1) % 4 / 4;
      const scale = 0.5 + t * 5;
      mesh.scale.setScalar(scale);
      mesh.material.opacity = 0.3 * (1 - t);
      mesh.position.copy(ringData[i].position);
      mesh.lookAt(0, 0, 0);
      mesh.rotation.z = -time * 0.08;
    });
  });

  return (
    <group ref={ringsRef}>
      {outerRingMeshes.map((mesh, i) => <primitive key={`outer-${i}`} object={mesh} />)}
      {ringMeshes.map((mesh, i) => <primitive key={`inner-${i}`} object={mesh} />)}
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
    groupRef.current.rotation.y += 0.0015;
    groupRef.current.rotation.x += (mouse.y * 0.3 - groupRef.current.rotation.x - 0.1) * 0.02;
    groupRef.current.rotation.z += (mouse.x * 0.2 - groupRef.current.rotation.z) * 0.02;
  });

  const atmosphereRef = useRef();
  
  useFrame(({ clock }) => {
    if (!atmosphereRef.current || !visible) return;
    const t = clock.getElapsedTime();
    atmosphereRef.current.material.opacity = 0.15 + 0.05 * Math.sin(t * 0.5);
    atmosphereRef.current.scale.setScalar(1.02 + 0.01 * Math.sin(t * 0.3));
  });

  return (
    <group ref={groupRef}>
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[RADIUS * 1.15, 32, 32]} />
        <meshBasicMaterial
          color={CITY_GLOW_COLOR}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshBasicMaterial
          color="#051020"
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[RADIUS, 3]} />
        <meshBasicMaterial color={CITY_COLOR} wireframe transparent opacity={0.08} />
      </mesh>
      <mesh>
        <sphereGeometry args={[RADIUS - 0.01, 48, 48]} />
        <meshBasicMaterial color="#0a1628" transparent opacity={0.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[RADIUS - 0.005, 24, 24]} />
        <meshBasicMaterial color={CITY_COLOR} wireframe transparent opacity={0.04} />
      </mesh>
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
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none" style={{ transform: 'scale(1.1)' }}>
      <Canvas
        camera={{ position: [0, 1.5, 5], fov: 50, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
        frameloop={visible ? 'always' : 'never'}
      >
        <GlobeInner config={config} visible={visible} />
      </Canvas>
    </div>
  );
}