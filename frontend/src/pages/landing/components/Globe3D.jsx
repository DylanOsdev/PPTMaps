import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const RADIUS = 2;

const ALL_CITIES = [
  { name: 'Medellín', lat: 6.2442, lng: -75.5812, size: 1.0, isHub: true },
  { name: 'Bogotá', lat: 4.7110, lng: -74.0721, size: 0.7 },
  { name: 'Cali', lat: 3.4516, lng: -76.5320, size: 0.6 },
  { name: 'Barranquilla', lat: 10.9685, lng: -74.7813, size: 0.5 },
  { name: 'Cartagena', lat: 10.3910, lng: -75.5144, size: 0.45 },
  { name: 'New York', lat: 40.7128, lng: -74.0060, size: 0.7 },
  { name: 'London', lat: 51.5074, lng: -0.1278, size: 0.6 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, size: 0.6 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, size: 0.5 },
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333, size: 0.5 },
  { name: 'Moscow', lat: 55.7558, lng: 37.6173, size: 0.5 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, size: 0.5 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777, size: 0.5 },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074, size: 0.55 },
  { name: 'Lagos', lat: 6.5244, lng: 3.3792, size: 0.4 },
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

function toNormalized(lat, lng) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (180 + lng) * Math.PI / 180;
  return new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

const atmosphereVert = `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const atmosphereFrag = `
  uniform vec3 color;
  uniform float intensity;
  uniform float power;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
    float a = pow(rim, power) * intensity;
    gl_FragColor = vec4(color, a);
  }
`;

const surfaceVert = `
  varying vec3 vPos;
  varying vec3 vNorm;
  varying vec3 vView;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = normalize(position);
    vNorm = normalize(normalMatrix * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const surfaceFrag = `
  uniform vec3 baseColor;
  uniform vec3 gridColor;
  uniform vec3 rimColor;
  uniform vec3 scanColor;
  uniform float time;
  varying vec3 vPos;
  varying vec3 vNorm;
  varying vec3 vView;

  #define PI 3.14159265359

  void main() {
    vec3 p = normalize(vPos);
    float lat = acos(p.y);
    float lng = atan(p.z, p.x);

    float latStep = PI / 12.0;
    float lngStep = PI / 12.0;

    float lw = 0.035;
    float lg = mod(lat, latStep) / latStep;
    float ng = mod(lng + PI, lngStep) / lngStep;
    float latLine = 1.0 - smoothstep(0.0, lw, min(lg, 1.0 - lg));
    float lngLine = 1.0 - smoothstep(0.0, lw, min(ng, 1.0 - ng));
    float grid = max(latLine, lngLine) * 0.3;

    float eq = 1.0 - smoothstep(0.0, 0.012, abs(lat - PI * 0.5));
    float pm = 1.0 - smoothstep(0.0, 0.012, abs(lng));
    float special = max(eq, pm) * 0.5;

    float fresnel = pow(1.0 - max(0.0, dot(vView, vNorm)), 3.0);

    float scan = exp(-pow(abs(lng - mod(time * 0.12 + PI, 2.0 * PI) - PI), 2.0) * 300.0);
    scan *= 0.3 + 0.2 * (0.5 + 0.5 * sin(lat * 4.0 + time));

    float pulse = 0.5 + 0.5 * sin(time * 0.4);

    vec3 c = baseColor;
    c += gridColor * grid * 1.5;
    c += gridColor * special;
    c += scanColor * scan * 2.0;
    c += rimColor * fresnel * 0.5;
    c += gridColor * fresnel * pulse * 0.15;
    c += gridColor * 0.05 * (0.5 + 0.5 * sin(lat * 20.0 + lng * 20.0 + time * 0.5));
    c += gridColor * 0.06;

    gl_FragColor = vec4(c, 0.88);
  }
`;

function makeGlowTexture(stops) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => g.addColorStop(offset, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const glowTex = makeGlowTexture([
  [0.0, 'rgba(255,255,255,1)'],
  [0.05, 'rgba(34,211,238,0.9)'],
  [0.2, 'rgba(34,211,238,0.5)'],
  [0.5, 'rgba(34,211,238,0.15)'],
  [1.0, 'rgba(34,211,238,0)'],
]);

const haloTex = makeGlowTexture([
  [0.0, 'rgba(34,211,238,0)'],
  [0.3, 'rgba(34,211,238,0.05)'],
  [0.55, 'rgba(34,211,238,0.25)'],
  [0.7, 'rgba(34,211,238,0.5)'],
  [0.85, 'rgba(34,211,238,0.3)'],
  [1.0, 'rgba(34,211,238,0)'],
]);

const starTex = makeGlowTexture([
  [0.0, 'rgba(255,255,255,1)'],
  [0.1, 'rgba(255,255,255,0.5)'],
  [0.4, 'rgba(255,255,255,0.05)'],
  [1.0, 'rgba(255,255,255,0)'],
]);

function Atmosphere({ inner, scale, color, intensity, power }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.material.uniforms.intensity.value = intensity + 0.05 * Math.sin(t * 0.3 + inner * 1.5);
    ref.current.scale.setScalar(1.0 + 0.006 * Math.sin(t * 0.25 + inner));
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[RADIUS * scale, 48, 48]} />
      <shaderMaterial
        vertexShader={atmosphereVert}
        fragmentShader={atmosphereFrag}
        uniforms={{
          color: { value: new THREE.Color(color) },
          intensity: { value: intensity },
          power: { value: power },
        }}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function GlobeSurface() {
  return (
    <mesh>
      <shaderMaterial
        vertexShader={surfaceVert}
        fragmentShader={surfaceFrag}
        uniforms={{
          baseColor: { value: new THREE.Color('#0F1F3D') },
          gridColor: { value: new THREE.Color('#22D3EE') },
          rimColor: { value: new THREE.Color('#06B6D4') },
          scanColor: { value: new THREE.Color('#67E8F9') },
          time: { value: 0 },
        }}
        transparent
        depthWrite={true}
      />
      <sphereGeometry args={[RADIUS, 64, 64]} />
    </mesh>
  );
}

function CityPoints({ cities, visible }) {
  const dotRef = useRef();
  const glowRef = useRef();
  const outerRef = useRef();
  const haloRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const positions = useMemo(() => cities.map(c => latLngToVec3(c.lat, c.lng, RADIUS)), [cities]);
  const sizes = useMemo(() => cities.map(c => c.size), [cities]);
  const hubs = useMemo(() => cities.map(c => !!c.isHub), [cities]);

  useFrame(({ clock }) => {
    if (!visible) return;
    if (!dotRef.current || !glowRef.current || !outerRef.current || !haloRef.current) return;
    const t = clock.getElapsedTime();
    const n = positions.length;

    for (let i = 0; i < n; i++) {
      const pos = positions[i];
      const s = sizes[i];
      const hub = hubs[i];
      const pulse = 0.85 + 0.15 * Math.sin(t * (hub ? 1.8 : 1.0) + i * 2.3);
      const gp = 0.5 + 0.5 * Math.sin(t * (hub ? 2.5 : 1.3) + i * 3.0);

      dummy.position.copy(pos);
      dummy.scale.setScalar(s * 0.03 * pulse);
      dummy.updateMatrix();
      dotRef.current.setMatrixAt(i, dummy.matrix);

      dummy.scale.setScalar(s * 0.1 * (0.7 + 0.3 * gp));
      dummy.updateMatrix();
      glowRef.current.setMatrixAt(i, dummy.matrix);

      dummy.scale.setScalar(s * 0.2 * (0.6 + 0.4 * gp));
      dummy.updateMatrix();
      outerRef.current.setMatrixAt(i, dummy.matrix);

      dummy.scale.setScalar(s * 0.04 + 0.05 * ((t * 0.25 + i * 0.9) % 1.0));
      dummy.lookAt(0, 0, 0);
      dummy.updateMatrix();
      haloRef.current.setMatrixAt(i, dummy.matrix);
    }

    dotRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
    outerRef.current.instanceMatrix.needsUpdate = true;
    haloRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={haloRef} args={[undefined, undefined, positions.length]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={haloTex} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={outerRef} args={[undefined, undefined, positions.length]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTex} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, positions.length]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTex} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={dotRef} args={[undefined, undefined, positions.length]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
      </instancedMesh>
    </group>
  );
}

function ConnectionArcs({ arcs, cityMap, visible }) {
  const lineRef = useRef();
  const glowRef = useRef();

  const arcData = useMemo(() => arcs.map(([from, to], i) => {
    const f = cityMap[from];
    const t = cityMap[to];
    if (!f || !t) return null;
    const start = latLngToVec3(f.lat, f.lng);
    const end = latLngToVec3(t.lat, t.lng);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    mid.normalize().multiplyScalar(RADIUS + dist * 0.35);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(50);
    const seed = Math.abs(Math.sin(i * 127.1 + 311.7));
    return { points, curve, op: 0.06 + (seed % 0.5) * 0.14 };
  }).filter(Boolean), [arcs, cityMap]);

  const lineMeshes = useMemo(() => arcData.map((d, i) => {
    const pts = d.points;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const colors = new Float32Array(pts.length * 3);
    for (let j = 0; j < pts.length; j++) {
      const t = j / (pts.length - 1);
      const c = new THREE.Color('#22D3EE').lerp(new THREE.Color('#06B6D4'), t);
      colors[j * 3] = c.r; colors[j * 3 + 1] = c.g; colors[j * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: d.op });
    return new THREE.Line(geo, mat);
  }), [arcData]);

  const glowPoints = useMemo(() => arcData.map((d, i) => {
    const pts = d.points;
    const count = pts.length * 3;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    for (let j = 0; j < count; j++) {
      const t = j / (count - 1);
      const p = d.curve.getPoint(t);
      positions[j * 3] = p.x; positions[j * 3 + 1] = p.y; positions[j * 3 + 2] = p.z;
      const s = 0.01 + 0.04 * Math.sin(t * Math.PI);
      sizes[j] = s;
      const c = new THREE.Color('#22D3EE').lerp(new THREE.Color('#67E8F9'), t);
      colors[j * 3] = c.r; colors[j * 3 + 1] = c.g; colors[j * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.04, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true, vertexColors: true,
    });
    return new THREE.Points(geo, mat);
  }), [arcData]);

  const flowParticles = useMemo(() => arcData.map((d, i) => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(20 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: '#67E8F9', size: 0.04, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
  }), [arcData]);

  useEffect(() => () => {
    [...lineMeshes, ...glowPoints, ...flowParticles].forEach(m => {
      m.geometry.dispose(); m.material.dispose();
    });
  }, [lineMeshes, glowPoints, flowParticles]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const time = clock.getElapsedTime();

    lineMeshes.forEach((line, i) => {
      line.material.opacity = arcData[i].op * (0.5 + 0.5 * (0.5 + 0.5 * Math.sin(time * 0.3 + i * 1.4)));
    });

    glowPoints.forEach((gp, i) => {
      gp.material.opacity = 0.15 + 0.2 * (0.5 + 0.5 * Math.sin(time * 0.4 + i * 1.7));
    });

    flowParticles.forEach((flow, i) => {
      const d = arcData[i];
      const pos = flow.geometry.attributes.position.array;
      const num = 20;
      const prog = (time * 0.2 + i * 0.6) % 1.0;
      for (let j = 0; j < num; j++) {
        const p = (prog + j / num) % 1.0;
        const pt = d.curve.getPoint(p);
        pos[j * 3] = pt.x; pos[j * 3 + 1] = pt.y; pos[j * 3 + 2] = pt.z;
      }
      flow.geometry.attributes.position.needsUpdate = true;
      flow.material.opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 0.5 + i * 2.0));
    });
  });

  return (
    <group>
      {lineMeshes.map((m, i) => <primitive key={`al-${i}`} object={m} />)}
      {glowPoints.map((m, i) => <primitive key={`ag-${i}`} object={m} />)}
      {flowParticles.map((m, i) => <primitive key={`af-${i}`} object={m} />)}
    </group>
  );
}

function OrbitalParticles({ count, visible }) {
  const ref = useRef();

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const data = { speeds: new Float32Array(count), offsets: new Float32Array(count), radii: new Float32Array(count) };

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = RADIUS + 0.2 + Math.random() * 0.8;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.01 + Math.random() * 0.03;
      data.speeds[i] = 0.08 + Math.random() * 0.25;
      data.offsets[i] = Math.random() * Math.PI * 2;
      data.radii[i] = r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.userData = data;
    return g;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current || !visible) return;
    const t = clock.getElapsedTime();
    const pos = ref.current.geometry.attributes.position.array;
    const { speeds, offsets, radii } = ref.current.geometry.userData;

    for (let i = 0; i < count; i++) {
      const angle = t * speeds[i] + offsets[i];
      const r = radii[i] + 0.15 * Math.sin(angle * 0.4 + offsets[i]);
      const theta = angle * 0.5;
      const phi = Math.acos(Math.max(-0.9, Math.min(0.9, Math.sin(angle * 0.25 + offsets[i] * 0.3))));
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        size={0.025} color="#22D3EE" transparent opacity={0.6}
        blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation
      />
    </points>
  );
}

function ExpandingRings({ count, visible }) {
  const ref = useRef();
  const data = useMemo(() => {
    const p = latLngToVec3(6.2442, -75.5812, RADIUS);
    return Array.from({ length: count }, (_, i) => ({ pos: p.clone(), delay: i * 1.5 }));
  }, [count]);

  const meshes = useMemo(() => data.map((d, i) => {
    const geo = new THREE.RingGeometry(0.005, 0.03, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: '#22D3EE', transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(d.pos);
    return mesh;
  }), [data]);

  useEffect(() => () => meshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); }), [meshes]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.getElapsedTime();
    meshes.forEach((mesh, i) => {
      const p = ((t + data[i].delay) % 5) / 5;
      const s = 0.1 + p * 7;
      mesh.scale.setScalar(s);
      mesh.material.opacity = 0.5 * (1 - p) * (0.6 + 0.4 * Math.sin(t * 2 + i));
      mesh.lookAt(0, 0, 0);
    });
  });

  return <group ref={ref}>{meshes.map((m, i) => <primitive key={`r-${i}`} object={m} />)}</group>;
}

function EquatorialRing() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[RADIUS + 0.005, RADIUS + 0.03, 64]} />
      <meshBasicMaterial color="#22D3EE" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function Starfield({ count }) {
  const ref = useRef();

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 7 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.5 + Math.random() * 1.0;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [count]);

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        map={starTex} size={0.08} transparent opacity={0.7}
        blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation
      />
    </points>
  );
}

function GlobeInner({ config, visible }) {
  const groupRef = useRef();

  const cities = useMemo(() => ALL_CITIES.slice(0, config.globeCities), [config.globeCities]);
  const arcs = useMemo(() => ALL_ARCS.slice(0, config.globeArcs), [config.globeArcs]);
  const cityMap = useMemo(() => {
    const m = {};
    ALL_CITIES.forEach(c => { m[c.name] = c; });
    return m;
  }, []);

  useFrame(({ clock, mouse }) => {
    if (!groupRef.current || !visible) return;
    const t = clock.getElapsedTime();

    groupRef.current.rotation.y += 0.0018;

    const targetX = mouse.y * 0.15;
    const targetZ = mouse.x * 0.12;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.015;
    groupRef.current.rotation.z += (targetZ - groupRef.current.rotation.z) * 0.015;

    groupRef.current.children.forEach(child => {
      if (child.material && child.material.uniforms && child.material.uniforms.time) {
        child.material.uniforms.time.value = t;
      }
    });
  });

  return (
    <group ref={groupRef}>
      <Atmosphere inner={0} scale={1.12} color="#22D3EE" intensity={0.35} power={2.5} />
      <Atmosphere inner={1} scale={1.06} color="#06B6D4" intensity={0.5} power={3.5} />
      <GlobeSurface />
      <EquatorialRing />
      <CityPoints cities={cities} visible={visible} />
      <ConnectionArcs arcs={arcs} cityMap={cityMap} visible={visible} />
      <OrbitalParticles count={config.globeParticles} visible={visible} />
      <ExpandingRings count={config.globeRings} visible={visible} />
      <Starfield count={250} />
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
        camera={{ position: [0, 1.0, 4.8], fov: 42, near: 0.1, far: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
        frameloop={visible ? 'always' : 'never'}
      >
        <GlobeInner config={config} visible={visible} />
      </Canvas>
    </div>
  );
}
