// Smoke and sparks for the drift: soft puffs kicked up in proportion to slip and wheelspin (at most
// 60 alive), a burst on launch, and a spray of ember spark streaks when it stops. Simulated in the
// drift's fixed steps (createDust().step), drawn as points and line segments.
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FOV } from "./drift";

const MAX = 60;
const SPARKS = 12;

export function createDust(seed = 11) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const P = { pos: new Float32Array(MAX * 3), vel: new Float32Array(MAX * 3), age: new Float32Array(MAX).fill(9), life: new Float32Array(MAX).fill(1), size: new Float32Array(MAX), heat: new Float32Array(MAX) };
  const K = { pos: new Float32Array(SPARKS * 3), vel: new Float32Array(SPARKS * 3), age: new Float32Array(SPARKS).fill(9), life: new Float32Array(SPARKS).fill(1) };
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute("aHeat", new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute("aSeed", new THREE.BufferAttribute(Float32Array.from({ length: MAX }, (_, i) => (i * 0.618) % 1), 1));
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARKS * 6), 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SPARKS * 8), 4).setUsage(THREE.DynamicDrawUsage));

  let next = 0;
  let carry = 0;
  const dir = [-1, 0]; // last direction of travel, for the sparks
  const emit = (S, x, z, vx, vy, vz, heat) => {
    const i = next;
    next = (next + 1) % MAX;
    P.pos.set([x, 0.03, z], i * 3);
    P.vel.set([vx, vy, vz], i * 3);
    P.age[i] = 0;
    P.life[i] = 0.7 + rnd() * 0.35;
    P.size[i] = 0.26 + rnd() * 0.14;
    P.heat[i] = heat;
  };
  // a point on a track's footprint, in world space
  const contact = (S, side, along) => {
    const lx = side * 0.218;
    const c = Math.cos(S.yaw);
    const s = Math.sin(S.yaw);
    return [S.x + lx * c + along * s, S.z - lx * s + along * c];
  };

  return {
    smokeGeo,
    sparkGeo,
    dark: 0,
    reset() {
      P.age.fill(9);
      K.age.fill(9);
      carry = 0;
    },
    alive() {
      for (let i = 0; i < MAX; i++) if (P.age[i] < P.life[i]) return true;
      for (let i = 0; i < SPARKS; i++) if (K.age[i] < K.life[i]) return true;
      return false;
    },
    step(S, h) {
      if (S.speed > 0.8) {
        dir[0] = S.vx / S.speed;
        dir[1] = S.vz / S.speed;
      }
      const rate = (S.slip > 0.12 && S.speed > 0.4 ? 80 * Math.min(1, S.slip / 0.8) * Math.min(1, S.speed / 2.5) : 0) + 30 * Math.min(1, S.spin / 2);
      carry = Math.min(carry + rate * h, 4);
      while (carry >= 1) {
        carry -= 1;
        const side = rnd() < 0.5 ? -1 : 1;
        const [x, z] = contact(S, side, (rnd() - 0.3) * 0.45);
        emit(S, x, z, 0.3 * S.vx + (rnd() - 0.5) * 0.5, 0.15 + rnd() * 0.2, 0.3 * S.vz + (rnd() - 0.5) * 0.5, S.slip > 0.5 ? 0.55 : 0.15);
      }
      for (const e of S.events) {
        if (e === "burst") {
          // launch: smoke thrown back off both tracks
          const bx = Math.sin(S.yaw);
          const bz = Math.cos(S.yaw);
          for (let k = 0; k < 16; k++) {
            const side = k % 2 ? -1 : 1;
            const [x, z] = contact(S, side, 0.18 + rnd() * 0.1);
            emit(S, x, z, bx * (0.8 + rnd() * 1.2) + (rnd() - 0.5) * 0.6, 0.12 + rnd() * 0.3, bz * (0.8 + rnd() * 1.2) + (rnd() - 0.5) * 0.6, 0.35);
          }
        }
        if (e === "sparks") {
          // off the leading track, thrown on in the direction it was sliding
          const [x, z] = [S.x + dir[0] * 0.24, S.z + dir[1] * 0.24];
          for (let k = 0; k < SPARKS; k++) {
            K.pos.set([x + (rnd() - 0.5) * 0.2, 0.02, z + (rnd() - 0.5) * 0.1], k * 3);
            const sp = 1.2 + rnd() * 1.8;
            K.vel.set([dir[0] * sp + (rnd() - 0.5) * 1.4, 0.5 + rnd() * 1.6, dir[1] * sp + (rnd() - 0.5) * 0.8], k * 3);
            K.age[k] = 0;
            K.life[k] = 0.22 + rnd() * 0.25;
          }
        }
      }
      const drag = Math.exp(-2.4 * h);
      for (let i = 0; i < MAX; i++) {
        if (P.age[i] >= P.life[i]) continue;
        P.age[i] += h;
        const j = i * 3;
        P.vel[j] *= drag;
        P.vel[j + 1] = P.vel[j + 1] * drag + 0.06 * h;
        P.vel[j + 2] *= drag;
        P.pos[j] += P.vel[j] * h;
        P.pos[j + 1] += P.vel[j + 1] * h;
        P.pos[j + 2] += P.vel[j + 2] * h;
      }
      for (let i = 0; i < SPARKS; i++) {
        if (K.age[i] >= K.life[i]) continue;
        K.age[i] += h;
        const j = i * 3;
        K.vel[j + 1] -= 9.8 * h;
        for (let c = 0; c < 3; c++) K.pos[j + c] += K.vel[j + c] * h;
        if (K.pos[j + 1] < 0) {
          K.pos[j + 1] = 0;
          K.vel[j + 1] *= -0.35;
        }
      }
    },
    upload() {
      const pos = smokeGeo.attributes.position.array;
      const size = smokeGeo.attributes.aSize.array;
      const alpha = smokeGeo.attributes.aAlpha.array;
      const heat = smokeGeo.attributes.aHeat.array;
      for (let i = 0; i < MAX; i++) {
        const k = P.age[i] / P.life[i];
        if (k >= 1) {
          alpha[i] = 0;
          size[i] = 0;
          continue;
        }
        pos[i * 3] = P.pos[i * 3];
        pos[i * 3 + 1] = P.pos[i * 3 + 1];
        pos[i * 3 + 2] = P.pos[i * 3 + 2];
        size[i] = 0.06 + P.size[i] * (1 - (1 - k) * (1 - k));
        alpha[i] = 0.26 * Math.pow(1 - k, 1.5) * Math.min(1, k * 10);
        heat[i] = P.heat[i] * Math.max(0, 1 - k * 3);
      }
      for (const n of ["position", "aSize", "aAlpha", "aHeat"]) smokeGeo.attributes[n].needsUpdate = true;
      const sp = sparkGeo.attributes.position.array;
      const col = sparkGeo.attributes.color.array;
      for (let i = 0; i < SPARKS; i++) {
        const k = K.age[i] / K.life[i];
        const j = i * 3;
        const on = k < 1 ? 1 - k : 0;
        sp.set([K.pos[j], K.pos[j + 1], K.pos[j + 2], K.pos[j] - K.vel[j] * 0.035, K.pos[j + 1] - K.vel[j + 1] * 0.035, K.pos[j + 2] - K.vel[j + 2] * 0.035], i * 6);
        col.set([1, 0.62, 0.38, on, 0.98, 0.3, 0.16, 0], i * 8);
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
    },
  };
}

const smokeVert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aHeat;
  attribute float aSeed;
  uniform float uScale;
  varying float vAlpha;
  varying float vHeat;
  varying float vSeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vAlpha = aAlpha;
    vHeat = aHeat;
    vSeed = aSeed;
  }
`;

const smokeFrag = /* glsl */ `
  uniform float uDark;
  varying float vAlpha;
  varying float vHeat;
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = dot(p, p);
    if (r > 1.0 || vAlpha <= 0.0) discard;
    float a = (1.0 - r);
    a *= a * a;
    a *= 0.8 + 0.2 * sin(p.x * 5.0 + vSeed * 6.3) * sin(p.y * 4.0 - vSeed * 3.1);
    // warm cream on the ink bar, soil on the cream one; a little ember while it's hot
    vec3 col = mix(vec3(0.96, 0.92, 0.86), vec3(0.3, 0.24, 0.23), uDark);
    col = mix(col, vec3(0.98, 0.47, 0.36), clamp(vHeat, 0.0, 1.0));
    gl_FragColor = vec4(col, a * vAlpha);
  }
`;

export default function Dust({ fx }) {
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);
  const smokeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: smokeVert,
        fragmentShader: smokeFrag,
        uniforms: { uScale: { value: 100 }, uDark: { value: 0 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );
  const sparkMat = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  // point size: px per metre at 1 m from the camera
  useEffect(() => {
    smokeMat.uniforms.uScale.value = (height * dpr) / (2 * Math.tan((FOV * Math.PI) / 360));
  }, [height, dpr, smokeMat]);
  fx.material = smokeMat;
  return (
    <>
      <points geometry={fx.smokeGeo} material={smokeMat} frustumCulled={false} renderOrder={2} />
      <lineSegments geometry={fx.sparkGeo} material={sparkMat} frustumCulled={false} renderOrder={3} />
    </>
  );
}
