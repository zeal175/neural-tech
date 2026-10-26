// ENC-01, the original ember rover from NTC event 2 (blender/scripts/rover_build.py), driven by the
// drift simulation. Material setup and the part animation are ported from event 2's
// src/scene/Robot.jsx; its screen, emotes, carry, startle and power code is left out.
// Parts animated by name: chassis (pitch / lean / bob), head (yaw, pitch, tilt), eye + pupil (blink,
// dilate, flare), antenna (whip), antenna_tip, lidar (spin), led0..3 (chase), tailL / tailR (brake),
// sensor_led (rec blink), treadL / treadR (wheel* spin, belt* scroll).
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { BODY_ROLL, CHASSIS_ROLL } from "./drift";
import { treadNormalTexture, treadTexture } from "./treadTexture";

export const MODEL_URL = "/enclave/models/enc-rover.glb?v=2"; // served immutable: bump when the file changes

const ACCENT = new THREE.Color("#f9725a");
const EDGE = 0.26;
const TILES_PER_M = 14 / 1.155; // the belt's UV runs 14 links round a 1.155 m loop
const WHEEL_R = [0.064, 0.064, 0.046, 0.046, 0.046, 0.02, 0.02];
const near = (i, pos, n) => Math.max(0, 1 - Math.min(Math.abs(i - pos), n - Math.abs(i - pos)));

// A warm rim along the silhouette (Fresnel: surfaces turning away from the camera catch it), so the
// dark hull and treads separate from the ink bar. Shared by every lit part of the rover.
export const RIM = {
  uRimColor: { value: new THREE.Color("#ffd6c2") },
  uRimPower: { value: 4.5 }, // high: the true silhouette, not every face seen at a slant
  uRimStrength: { value: 0.6 },
};
/** `k`: this part's share of the rim (the treads take the most) */
function addRim(m, k) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, RIM);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRimColor;\nuniform float uRimPower;\nuniform float uRimStrength;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uRimColor * (uRimStrength * ${k.toFixed(2)}) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), uRimPower);`
      );
  };
  m.customProgramCacheKey = () => `enc-rover-rim-${k}`;
}

function radial(size, stops) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, col] of stops) r.addColorStop(at, col);
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  return c;
}

/** a four-point star for the "ka-chow" glint */
function starTexture() {
  const s = 128;
  const c = radial(s, [
    [0, "rgba(255,255,255,1)"],
    [0.12, "rgba(255,236,220,0.7)"],
    [0.35, "rgba(255,150,120,0.08)"],
    [1, "rgba(255,120,90,0)"],
  ]);
  const g = c.getContext("2d");
  g.globalCompositeOperation = "lighter";
  for (const [w, h] of [
    [s, s * 0.05],
    [s * 0.05, s],
  ]) {
    const lin = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    lin.addColorStop(0, "rgba(255,245,235,1)");
    lin.addColorStop(1, "rgba(255,140,110,0)");
    g.fillStyle = lin;
    g.beginPath();
    g.ellipse(s / 2, s / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** a light streak: bright at u = 0, gone by u = 1 */
function streakTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const g = c.getContext("2d");
  const lin = g.createLinearGradient(0, 0, 128, 0);
  lin.addColorStop(0, "rgba(255,255,255,1)");
  lin.addColorStop(0.25, "rgba(255,255,255,0.45)");
  lin.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = lin;
  g.fillRect(0, 0, 128, 16);
  const v = g.createLinearGradient(0, 0, 0, 16);
  v.addColorStop(0, "rgba(0,0,0,1)");
  v.addColorStop(0.5, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = v;
  g.fillRect(0, 0, 128, 16);
  return new THREE.CanvasTexture(c);
}

export const Rover = forwardRef(function Rover(_, ref) {
  const { scene } = useGLTF(MODEL_URL);
  const aniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const root = useRef();
  const tilt = useRef();
  const glint = useRef();
  const trails = useRef([]);

  const rig = useMemo(() => {
    const model = scene.clone(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      const m = o.material;
      const name = m.name.toLowerCase();
      // the baked steel mirrors the studio softbox as a glowing panel: keep reflections lowish
      if (name.startsWith("body") || name.startsWith("accent")) {
        m.envMapIntensity = 0.7;
        // the atlas seen small and at grazing angles (the deck, the skirts): full anisotropic filtering,
        // and the plate relief toned down so it doesn't sparkle as the rover moves
        for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) if (t) t.anisotropy = aniso;
        m.normalScale?.multiplyScalar(0.7);
      }
      if (name.startsWith("accent")) m.color.copy(ACCENT);
      if (name.startsWith("glow")) {
        m.emissive.copy(ACCENT);
        m.emissiveIntensity = 1.5;
        m.toneMapped = false;
      }
      if (name.startsWith("lamp")) m.toneMapped = false;
      if (name.startsWith("tail") || name.startsWith("rec")) {
        m.color = new THREE.Color("#2a0603");
        m.emissive = new THREE.Color(name.startsWith("tail") ? "#ff2a14" : "#ff3020");
        m.emissiveIntensity = 0.8;
        m.toneMapped = false;
      }
      if (name.startsWith("tread")) {
        // each belt scrolls its own copy of the track (colour and relief together); a little
        // glossier than event 2's, so the lugs catch the key light on the dark bar
        m.map = treadTexture().clone();
        m.map.needsUpdate = true;
        m.normalMap = treadNormalTexture().clone();
        m.normalMap.needsUpdate = true;
        m.normalScale = new THREE.Vector2(0.9, 0.9);
        m.color = new THREE.Color("#ffffff");
        m.roughness = 0.62;
        m.metalness = 0;
      }
      if (/^(body|accent|tread)/.test(name)) addRim(m, name.startsWith("tread") ? 1.6 : 0.8);
    });
    // the named parts; the web export keeps each small part's quantization in its own scale, so
    // scales animate relative to s0
    const p = {};
    model.traverse((o) => {
      if (o.name) p[o.name] = o;
      o.userData.s0 = o.scale.clone();
    });
    p.leds = [0, 1, 2, 3].map((i) => p[`led${i}`]).filter(Boolean);
    p.wheels = [];
    p.belts = [];
    for (const side of ["L", "R"]) {
      p[`tread${side}`]?.children.forEach((c) => {
        const m = /^wheel[LR](\d)$/.exec(c.name);
        if (m) p.wheels.push({ o: c, side, r: WHEEL_R[+m[1]] || 0.05 });
        // only the belt scrolls: the frame beside it shares the body's atlas texture, and scrolling
        // that would slide the whole rover's paint around
        else if (c.material?.name?.toLowerCase().startsWith("tread")) p.belts.push({ m: c.material, side });
      });
    }
    if (p.head) p.head.rotation.order = "YXZ";
    model.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(model);
    const r3 = (v) => Math.round(v * 1000) / 1000;
    // padded for the head turning and the antenna's whip
    const box = { min: [r3(b.min.x - 0.02), 0, r3(b.min.z - 0.02)], max: [r3(b.max.x + 0.02), r3(b.max.y + 0.01), r3(b.max.z + 0.02)] };
    return { model, p, box, c0: p.chassis?.position.y ?? 0.17 };
  }, [scene, aniso]);

  const glintMat = useMemo(
    () => new THREE.SpriteMaterial({ map: starTexture(), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false, transparent: true }),
    []
  );
  const trailMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: streakTexture(), color: "#ff3a1c", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, side: THREE.DoubleSide }),
    []
  );
  const eyePos = useMemo(() => new THREE.Vector3(), []);

  useImperativeHandle(
    ref,
    () => ({
      box: rig.box,
      body: () => tilt.current,
      materials: () => {
        const out = new Set([glintMat, trailMat]);
        rig.model.traverse((o) => o.isMesh && out.add(o.material));
        return [...out];
      },
      /** pose the rover from the simulation (see drift.js); `still`: no idle life (reduced motion) */
      apply(S, still) {
        const g = root.current;
        if (!g) return;
        g.visible = S.mode !== "off";
        g.position.set(S.x, 0, S.z);
        g.rotation.set(0, S.yaw, 0);
        // the whole body tips up about the outer edge of the low track
        const r = S.roll.x * BODY_ROLL;
        const px = -Math.sign(r) * EDGE;
        tilt.current.rotation.set(0, 0, r);
        tilt.current.position.set(px - px * Math.cos(r), -px * Math.sin(r), 0);

        const { chassis, head, antenna, eye, pupil, lidar, leds, tailL, tailR, sensor_led: rec, antenna_tip: tip, wheels, belts } = rig.p;
        const t = S.t;
        if (chassis) {
          chassis.position.y = rig.c0 + S.bob - 0.018 * S.squat;
          chassis.rotation.set(S.pitch.x, 0, S.roll.x * CHASSIS_ROLL);
        }
        if (head) head.rotation.set(S.headP.x, S.headYaw, S.headZ.x);
        if (antenna) antenna.rotation.set(S.antX.x, 0, S.antZ.x);

        // tracks: wheels spin, belts scroll (blurred when fast)
        for (const w of wheels) w.o.rotation.x = -(w.side === "L" ? S.rollL : S.rollR) / w.r;
        for (const b of belts) {
          const off = -((b.side === "L" ? S.rollL : S.rollR) * TILES_PER_M);
          b.m.map.offset.y = off;
          b.m.normalMap.offset.y = off;
          b.m.normalScale.setScalar(0.9 * (1 - 0.75 * S.blur));
        }

        // eye: blink, pupil, flare
        const lid = S.lid;
        if (eye?.userData.s0) eye.scale.y = eye.userData.s0.y * (1 - 0.88 * lid);
        if (pupil?.userData.s0) {
          const s0 = pupil.userData.s0;
          pupil.scale.set(s0.x * S.pupil, s0.y * S.pupil * (1 - 0.9 * lid), s0.z);
        }
        // glows sit near 1 so they stay ember (no bloom here: pushed past 1 they clip to a pale peach);
        // only the ka-chow flare runs them white-hot
        if (eye?.material) eye.material.emissiveIntensity = (1 + (still ? 0 : Math.sin(t * 3) * 0.1) + S.look * 0.2 + S.flare * 4) * (1 - 0.6 * lid);
        if (tip?.material) tip.material.emissiveIntensity = 0.9 + (still ? 0 : Math.sin(t * 2.4) * 0.25) + S.flare * 1.5;
        if (lidar) lidar.rotation.y = S.lidar;
        // status LEDs: a slow chase in ember
        const pos = (t * 1.6) % 4;
        leds.forEach((led, i) => {
          led.material.emissive.copy(ACCENT);
          led.material.emissiveIntensity = still ? 0.9 : 0.25 + 1.1 * near(i, pos, leds.length);
        });
        for (const tl of [tailL, tailR]) if (tl?.material) tl.material.emissiveIntensity = 0.7 + S.brake * 4;
        if (rec?.material) rec.material.emissiveIntensity = still ? 1.5 : t % 1.2 < 0.15 ? 6 : 0.35;

        // tail-light streaks while it's going fast
        const k = THREE.MathUtils.clamp((S.vf - 1.5) / 6, 0, 1);
        for (const m of trails.current) {
          if (!m) continue;
          m.visible = k > 0.01;
          m.scale.set(0.1 + 0.75 * k, 0.014, 1);
          m.position.z = 0.236 + m.scale.x / 2;
        }
        trailMat.opacity = 0.85 * k;

        // the glint: a star on the lens
        const sp = glint.current;
        if (sp) {
          sp.visible = S.glint >= 0 && g.visible;
          if (sp.visible && eye) {
            eye.getWorldPosition(eyePos);
            sp.position.copy(eyePos);
            const a = Math.pow(Math.sin(S.glint * Math.PI), 1.4);
            sp.scale.setScalar(0.03 + 0.2 * a);
            glintMat.rotation = S.glint * 1.4;
            glintMat.opacity = a;
          }
        }
      },
    }),
    [rig, glintMat, trailMat, eyePos]
  );

  return (
    <>
      <group ref={root}>
        <group ref={tilt}>
          <primitive object={rig.model} />
          {[-1, 1].map((sx, i) => (
            <mesh key={sx} ref={(m) => (trails.current[i] = m)} position={[sx * 0.226, 0.205, 0.3]} rotation={[0, -Math.PI / 2, 0]} material={trailMat} visible={false}>
              <planeGeometry args={[1, 1]} />
            </mesh>
          ))}
        </group>
      </group>
      <sprite ref={glint} material={glintMat} renderOrder={10} visible={false} />
    </>
  );
});
