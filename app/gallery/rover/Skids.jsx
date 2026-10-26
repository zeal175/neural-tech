// Skid marks: a ribbon under each track, laid while the rover slides (or spins its tracks on launch).
// Fresh rubber glows ember and cools to a faint grey over ~1.2 s, so the marks read on the ink bar;
// once the rover has gone they fade out. Stepped with the drift (createSkids().step), drawn as one mesh.
import { useMemo } from "react";
import * as THREE from "three";

const N = 120; // points per track
const GAP = 0.03; // metres between points

export function createSkids() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(2 * N * 2 * 3);
  const born = new Float32Array(2 * N * 2).fill(-99);
  const edge = new Float32Array(2 * N * 2);
  for (let i = 0; i < 2 * N; i++) {
    edge[i * 2] = -1;
    edge[i * 2 + 1] = 1;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aBorn", new THREE.BufferAttribute(born, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(2 * N * 6), 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);

  // per track: ring of points, each in a stroke (consecutive points of one stroke are joined)
  const tracks = [-1, 1].map((side) => ({ side, next: 0, stroke: new Int32Array(N).fill(-1), last: null, id: 0, on: false }));
  let strokeId = 1;
  let dirty = false;
  let lastBorn = -99;

  const lay = (T, S, x, z, half) => {
    const i = T.next;
    T.next = (T.next + 1) % N;
    const k = (T.side < 0 ? 0 : N) + i;
    // across the direction of travel
    const sp = Math.max(S.speed, 1e-3);
    const ax = -S.vz / sp;
    const az = S.vx / sp;
    const y = 0.0015 + (T.side < 0 ? 0 : 0.0004);
    pos.set([x - ax * half, y, z - az * half, x + ax * half, y, z + az * half], k * 6);
    born[k * 2] = born[k * 2 + 1] = S.t;
    T.stroke[i] = T.id;
    T.last = [x, z];
    lastBorn = S.t;
    dirty = true;
  };

  return {
    geo,
    alive(now) {
      return now - lastBorn < 7;
    },
    reset() {
      born.fill(-99);
      for (const T of tracks) {
        T.stroke.fill(-1);
        T.on = false;
        T.last = null;
      }
      lastBorn = -99;
      dirty = true;
    },
    step(S, h) {
      // the rover has gone: let the marks fade within ~2 s
      if (S.events.includes("gone")) {
        for (let i = 0; i < born.length; i++) born[i] = Math.min(born[i], S.t - 5);
        lastBorn = Math.min(lastBorn, S.t - 5);
        geo.attributes.aBorn.needsUpdate = true;
      }
      const sliding = S.slip > 0.3 && S.speed > 0.5;
      const burning = S.spin > 1.2 && S.speed > 0.15;
      const c = Math.cos(S.yaw);
      const s = Math.sin(S.yaw);
      for (const T of tracks) {
        const x = S.x + T.side * 0.218 * c;
        const z = S.z - T.side * 0.218 * s;
        if (!(sliding || burning) || S.mode === "off") {
          T.on = false;
          continue;
        }
        // a sideways track smears a wider band than a rolling one
        const half = 0.03 + 0.05 * Math.sin(Math.min(S.slip, Math.PI / 2));
        if (!T.on) {
          T.on = true;
          T.id = strokeId++;
          lay(T, S, x, z, half);
        } else if (Math.hypot(x - T.last[0], z - T.last[1]) > GAP) lay(T, S, x, z, half);
      }
    },
    upload() {
      if (!dirty) return;
      dirty = false;
      const idx = geo.index.array;
      let n = 0;
      for (const T of tracks) {
        const base = T.side < 0 ? 0 : N;
        for (let i = 0; i < N; i++) {
          const j = (i + 1) % N;
          if (j === T.next || T.stroke[i] < 0 || T.stroke[i] !== T.stroke[j]) continue;
          const a = (base + i) * 2;
          const b = (base + j) * 2;
          idx.set([a, a + 1, b, a + 1, b + 1, b], n);
          n += 6;
        }
      }
      geo.index.needsUpdate = true;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aBorn.needsUpdate = true;
      geo.setDrawRange(0, n);
    },
  };
}

const vert = /* glsl */ `
  attribute float aBorn;
  attribute float aEdge;
  varying float vBorn;
  varying float vEdge;
  void main() {
    vBorn = aBorn;
    vEdge = aEdge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uNow;
  uniform float uDark;
  varying float vBorn;
  varying float vEdge;
  void main() {
    float age = uNow - vBorn;
    float heat = 1.0 - smoothstep(0.0, 1.2, age);
    vec3 grey = mix(vec3(0.42, 0.4, 0.38), vec3(0.24, 0.2, 0.19), uDark);
    vec3 col = mix(grey, vec3(0.98, 0.4, 0.26), heat * heat);
    float a = (0.16 + 0.5 * heat) * (1.0 - smoothstep(5.0, 7.0, age)) * (1.0 - 0.8 * vEdge * vEdge);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(col, a);
  }
`;

export default function Skids({ fx }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uNow: { value: 0 }, uDark: { value: 0 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    []
  );
  fx.material = mat;
  return <mesh geometry={fx.geo} material={mat} frustumCulled={false} renderOrder={1} />;
}
