"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { live } from "./heroStore";

const COUNT = 320;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 48.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = dot(p, p);
    if (r > 1.0) discard;
    float core = exp(-r * 9.0);
    float glow = exp(-r * 3.0);
    vec3 col = uColor * glow * 2.2 + vec3(1.0, 0.85, 0.7) * core * 1.4;
    gl_FragColor = vec4(col * vAlpha, vAlpha * glow);
  }
`;

/**
 * Additive ember sparks around the figure's head. Driven through `live.embers`:
 * `pending` = sparks to burst out (success, charged release, easter egg),
 * `gather` = 0..1 sparks drawn in toward the head (press-and-hold charge).
 * `origin` is the head position in world space, written by Bust every frame.
 */
export default function Embers() {
  const points = useRef();
  const sim = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const life = new Float32Array(COUNT);
    const maxLife = new Float32Array(COUNT).fill(1);
    const size = new Float32Array(COUNT);
    const alpha = new Float32Array(COUNT);
    const mode = new Uint8Array(COUNT); // 0 dead, 1 burst, 2 gather
    for (let i = 0; i < COUNT; i++) pos[i * 3 + 1] = -100;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uScale: { value: 300 }, uColor: { value: new THREE.Color("#ff4a22") } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { pos, vel, life, maxLife, size, alpha, mode, geo, mat, cursor: 0, gatherAcc: 0 };
  }, []);

  const spawn = (kind) => {
    const s = sim;
    const i = s.cursor;
    s.cursor = (s.cursor + 1) % COUNT;
    const o = live.embers.origin;
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const dx = r * Math.cos(th);
    const dy = u;
    const dz = r * Math.sin(th);
    if (kind === 1) {
      const sp = 0.25 + Math.random() * 0.55;
      s.pos.set([o.x + dx * 0.05, o.y + dy * 0.06, o.z + dz * 0.05], i * 3);
      s.vel.set([dx * sp, dy * sp * 0.8 + 0.18, dz * sp], i * 3);
      s.maxLife[i] = 1.1 + Math.random() * 1.4;
    } else {
      const rad = 0.28 + Math.random() * 0.18;
      s.pos.set([o.x + dx * rad, o.y + dy * rad * 0.9, o.z + dz * rad], i * 3);
      s.vel.set([0, 0, 0], i * 3);
      s.maxLife[i] = 0.7 + Math.random() * 0.4;
    }
    s.life[i] = 0;
    s.size[i] = 0.0016 + Math.random() * 0.0034; // spark diameter in metres (glow included)
    s.mode[i] = kind;
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const s = sim;
    const e = live.embers;
    const t = state.clock.elapsedTime;
    // pixels per metre at 1 m from the camera: world-sized sparks at any resolution
    const fov = (state.camera.fov * Math.PI) / 180;
    s.mat.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(fov / 2));

    let n = Math.min(e.pending, 60); // spread big bursts over a few frames
    e.pending -= n;
    while (n-- > 0) spawn(1);
    s.gatherAcc += e.gather * dt * 140;
    while (s.gatherAcc >= 1) {
      s.gatherAcc -= 1;
      spawn(2);
    }

    const o = e.origin;
    for (let i = 0; i < COUNT; i++) {
      if (!s.mode[i]) continue;
      s.life[i] += dt;
      const k = s.life[i] / s.maxLife[i];
      const j = i * 3;
      if (k >= 1) {
        s.mode[i] = 0;
        s.alpha[i] = 0;
        s.pos[j + 1] = -100;
        continue;
      }
      if (s.mode[i] === 1) {
        // drag, buoyancy and a cheap curl-ish flutter
        const drag = Math.exp(-1.6 * dt);
        s.vel[j] = s.vel[j] * drag + Math.sin(t * 3.1 + i) * 0.04 * dt;
        s.vel[j + 1] = s.vel[j + 1] * drag + 0.22 * dt;
        s.vel[j + 2] = s.vel[j + 2] * drag + Math.cos(t * 2.7 + i * 1.3) * 0.04 * dt;
        s.alpha[i] = Math.min(1, k * 12) * (1 - k) * (1 - k);
      } else {
        // pulled in toward the head, spiralling
        const ax = o.x - s.pos[j];
        const ay = o.y - s.pos[j + 1];
        const az = o.z - s.pos[j + 2];
        s.vel[j] = (ax * 3.2 - az * 1.2) * (0.6 + k);
        s.vel[j + 1] = ay * 3.2 * (0.6 + k);
        s.vel[j + 2] = (az * 3.2 + ax * 1.2) * (0.6 + k);
        s.alpha[i] = Math.sin(Math.PI * k) * 0.9;
      }
      s.pos[j] += s.vel[j] * dt;
      s.pos[j + 1] += s.vel[j + 1] * dt;
      s.pos[j + 2] += s.vel[j + 2] * dt;
    }
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.aAlpha.needsUpdate = true;
    s.geo.attributes.aSize.needsUpdate = true;
  });

  return <points ref={points} geometry={sim.geo} material={sim.mat} frustumCulled={false} renderOrder={10} />;
}
