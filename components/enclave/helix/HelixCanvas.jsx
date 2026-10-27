"use client";

/**
 * The spiral itself: one mesh per photo on a helix, only the ones near focus shown and textured.
 * HelixGallery owns the page side (scroll, pointer, lightbox) and talks to this through `live`,
 * a plain mutable object, so scrolling never re-renders React.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clamp, damp, smoothstep } from "../hero/math";
import { addGlow, blankTexture, coverScale, createCardMaterial, createGlowMaterial, EMBER } from "./cardMaterial";
import { buildHelix, CARD_H, sampleHelix, viewFor } from "./layout";
import { createTextureStore } from "./textures";

const WINDOW = 12; // cards either side of focus that are drawn; presence fades them sooner
const INTRO_S = 1.7;
const SETTLE_MS = 260;
// presence: full near focus, dissolved by ~FADE_OUT cards away (smoothstep high→low)
const FADE_IN = 1.35;
const FADE_OUT = 6.5;

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const glowPos = new THREE.Vector3();
const glowQuat = new THREE.Quaternion();
const glowScale = new THREE.Vector3();
const glowNormal = new THREE.Vector3();

function Motes({ radius, materialRef }) {
  const { geometry, material } = useMemo(() => {
    const count = 150;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.35 + Math.random() * 1.5);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = addGlow(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uScroll: { value: 0 }, uSpin: { value: 0 }, uColor: { value: EMBER }, uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uScroll;
        uniform float uSpin;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float a = uSpin * (0.25 + aSeed * 0.35);
          p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
          p.y = mod(p.y + uScroll * (0.35 + aSeed * 0.5) + 7.0, 14.0) - 7.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vAlpha = (0.25 + 0.75 * aSeed) * smoothstep(7.0, 4.0, abs(p.y));
          gl_PointSize = clamp((1.0 + aSeed * 2.2) * uScale / -mv.z, 1.0, 9.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r = dot(p, p);
          if (r > 1.0) discard;
          float a = exp(-r * 5.0) * vAlpha * 0.8;
          gl_FragColor = vec4(linearToOutputTexel(vec4(uColor, 1.0)).rgb * a, a);
        }
      `,
    }));
    return { geometry: g, material: m };
  }, [radius]);
  useEffect(() => {
    materialRef.current = material;
    return () => {
      materialRef.current = null;
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material, materialRef]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

function Helix({ photos, live, onFocus, onHover, onReady }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef();
  const glow = useRef();
  const motes = useRef();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const helix = useMemo(() => buildHelix(photos), [photos]);
  const phone = size.width < 700;

  // meshes are built once; only the window around focus is ever visible
  const cards = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1, 18, 1);
    const list = photos.map((photo, i) => {
      const width = helix.widths[i];
      const material = createCardMaterial({ width, radius: helix.radius });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(width, CARD_H, 1);
      mesh.visible = false;
      mesh.userData = { index: i, theta: helix.theta[i], y: helix.y[i], focus: 0, hover: 0, presence: 0, has: 0, tex: null };
      return mesh;
    });
    return { geometry, list };
  }, [photos, helix]);

  // a finished decode asks for a frame, so it gets uploaded even when nothing else moves
  const store = useMemo(() => createTextureStore({ photos, phone, onLoad: invalidate }), [photos, phone, invalidate]);

  const glowMat = useMemo(() => createGlowMaterial(), []);
  const glowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const st = useRef({
    shown: live.target,
    vel: 0,
    camX: 0,
    camY: 0,
    intro: -1,
    range: [0, -1],
    frame: 0,
    stillMs: 0,
    focus: -1,
    hover: -1,
    raycastDirty: false,
  });

  useEffect(() => {
    store.setAnisotropy(Math.min(8, gl.capabilities.getMaxAnisotropy()));
  }, [gl, store]);

  useEffect(() => {
    const g = group.current;
    cards.list.forEach((mesh) => g.add(mesh));
    return () => {
      cards.list.forEach((mesh) => {
        g.remove(mesh);
        mesh.material.dispose();
      });
      cards.geometry.dispose();
    };
  }, [cards]);

  useEffect(() => () => store.dispose(), [store]);
  useEffect(() => () => {
    glowMat.dispose();
    glowGeo.dispose();
  }, [glowMat, glowGeo]);

  // camera framing for the viewport
  useEffect(() => {
    const view = viewFor(size.width, size.height, helix.radius);
    camera.fov = view.fov;
    camera.near = 0.1;
    camera.far = view.distance + helix.radius * 3 + 10;
    camera.position.set(0, 0, view.distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    live.distance = view.distance;
    invalidate();
  }, [camera, size, helix, live, invalidate]);

  // the page asks: which card is under the pointer?
  useEffect(() => {
    live.invalidate = invalidate;
    live.pick = () => {
      if (!live.pointer.inside) return -1;
      ndc.set(live.pointer.x, live.pointer.y);
      raycaster.setFromCamera(ndc, camera);
      const visible = cards.list.filter((m) => m.visible);
      const hit = raycaster.intersectObjects(visible, false)[0];
      return hit ? hit.object.userData.index : -1;
    };
    live.pointerMoved = () => {
      st.current.raycastDirty = true;
      invalidate();
    };
    invalidate();
    return () => {
      live.invalidate = null;
      live.pick = null;
      live.pointerMoved = null;
    };
  }, [live, invalidate, raycaster, ndc, camera, cards]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = st.current;
    const n = photos.length;
    if (!n) return;
    let busy = false;
    s.frame += 1;

    // scroll → shown focus, with inertia; phones track tighter so finger scroll doesn't lag
    const prev = s.shown;
    s.shown = damp(s.shown, live.target, phone ? 16 : 7.5, dt);
    if (Math.abs(s.shown - live.target) < 0.0004) s.shown = live.target;
    else busy = true;
    const rawVel = (s.shown - prev) / Math.max(dt, 1e-3);
    s.vel = damp(s.vel, rawVel, phone ? 16 : 10, dt);
    if (Math.abs(s.vel) < 0.002) s.vel = 0;
    else busy = true;
    live.shown = s.shown;
    live.vel = s.vel;

    // intro: the spiral unrolls once the first photos are on the GPU
    // (frames keep coming until then, so the fallback timer can fire on a slow connection)
    if (s.intro < 0) {
      busy = true;
      if (store.loadedCount() >= Math.min(6, n) || state.clock.elapsedTime > 3) {
        s.intro = 0;
        onReady?.();
      }
    }
    if (s.intro >= 0 && s.intro < INTRO_S + WINDOW * 0.05) {
      s.intro += dt;
      busy = true;
    }
    const intro = s.intro < 0 ? 0 : s.intro;

    const at = sampleHelix(helix, s.shown);
    // the spiral screws in: a turn and a rise into place
    const unroll = 1 - easeOutQuart(clamp(intro / INTRO_S, 0, 1));
    const g = group.current;
    g.rotation.y = -at.theta - unroll * 1.9;
    g.position.y = -at.y - unroll * 1.1;

    // the window of drawn cards
    const centre = Math.round(s.shown);
    const lo = Math.max(0, centre - WINDOW);
    const hi = Math.min(n - 1, centre + WINDOW);
    const [plo, phi] = s.range;
    for (let i = plo; i <= phi; i++) {
      if (i < lo || i > hi) {
        const gone = cards.list[i];
        gone.visible = false;
        gone.userData.presence = 0;
        gone.material.uniforms.uPresence.value = 0;
      }
    }
    s.range = [lo, hi];

    // hover (raycast only when the pointer moved or the spiral did)
    if (s.raycastDirty || (busy && live.pointer.inside && s.frame % 3 === 0)) {
      s.raycastDirty = false;
      const picked = live.pointer.inside && !live.pointer.dragging && live.pick ? live.pick() : -1;
      if (picked !== s.hover) {
        s.hover = picked;
        onHover?.(picked);
      }
    }

    const speed = clamp(Math.abs(s.vel) / 10, 0, 1);
    const velU = clamp(s.vel / 14, -1, 1);
    const rgb = Math.min(Math.abs(s.vel) * 0.0007, 0.006);

    if (store.upload(gl)) busy = true;

    for (let i = lo; i <= hi; i++) {
      const mesh = cards.list[i];
      const u = mesh.userData;
      const m = mesh.material.uniforms;
      mesh.visible = true;

      // stagger the unroll outward from the focused card
      const k = easeOutQuart(clamp((intro - Math.abs(i - s.shown) * 0.05) / (INTRO_S * 0.75), 0, 1));
      const r = helix.radius * (0.55 + 0.45 * k);
      mesh.position.set(Math.sin(u.theta) * r, u.y, Math.cos(u.theta) * r);
      mesh.rotation.y = u.theta;
      m.uReveal.value = k;
      if (k < 1) busy = true;

      const focus = clamp(1 - Math.abs(i - s.shown), 0, 1);
      u.focus = damp(u.focus, focus, 14, dt);
      u.hover = damp(u.hover, i === s.hover ? 1 : 0, 12, dt);
      if (Math.abs(u.hover - (i === s.hover ? 1 : 0)) > 0.002) busy = true;
      // fade cards in/out by distance so the B&W spiral doesn't linger and steal focus
      const wantPresence = k * smoothstep(FADE_OUT, FADE_IN, Math.abs(i - s.shown));
      u.presence = damp(u.presence, wantPresence, 7.5, dt);
      if (Math.abs(u.presence - wantPresence) > 0.004) busy = true;
      if (u.presence < 0.012 && wantPresence < 0.012) {
        mesh.visible = false;
        continue;
      }
      const lift = Math.max(u.hover, u.focus * (1 - speed));
      const bump = phone ? 0.04 : 0.09;
      mesh.scale.set(helix.widths[i] * (1 + lift * bump), CARD_H * (1 + lift * bump), 1);
      m.uFocus.value = u.focus;
      m.uHover.value = u.hover;
      m.uPresence.value = u.presence;
      m.uLift.value = u.hover;
      m.uVel.value = velU;
      m.uRgb.value = rgb;

      const tex = store.get(i);
      if (tex && tex !== u.tex) {
        u.tex = tex;
        m.uMap.value = tex;
        coverScale(m.uCover.value, tex.image.naturalWidth / tex.image.naturalHeight, helix.widths[i] / CARD_H);
      } else if (!tex && u.tex) {
        u.tex = null;
        u.has = 0;
        m.uMap.value = blankTexture;
      }
      u.has = damp(u.has, u.tex ? 1 : 0, 9, dt);
      if (u.tex && u.has < 0.995) busy = true;
      m.uHasMap.value = u.has;
    }

    // textures: nearest first, nothing new while flying, sharpen once settled (keep a few
    // frames coming until then, or the demand loop would stop before it happens)
    const order = [];
    for (let d = 0; d <= WINDOW; d++) {
      if (centre + d <= hi) order.push(centre + d);
      if (d && centre - d >= lo) order.push(centre - d);
    }
    const settledBefore = s.stillMs > SETTLE_MS;
    s.stillMs = Math.abs(s.vel) < 0.15 ? s.stillMs + dt * 1000 : 0;
    if (!settledBefore) busy = true;
    store.want(order, centre, { fast: Math.abs(s.vel) > 9, settled: s.stillMs > SETTLE_MS });

    // ember glow behind the focused card, faded out while scrolling. It rides on the card itself:
    // the glow is a ring with an empty middle the card covers, so left at a fixed spot it showed
    // its hollow centre as a dark, haloed box whenever the spiral sat between two cards
    const gm = glow.current;
    if (gm) {
      const fi = clamp(Math.round(s.shown), 0, n - 1);
      const card = cards.list[fi];
      card.updateWorldMatrix(true, false);
      card.matrixWorld.decompose(glowPos, glowQuat, glowScale);
      gm.quaternion.copy(glowQuat);
      gm.position.copy(glowPos).addScaledVector(glowNormal.set(0, 0, 1).applyQuaternion(glowQuat), -0.02);
      const w = glowScale.x;
      const h = glowScale.y;
      gm.scale.set(w + 0.9, h + 0.9, 1);
      glowMat.uniforms.uSize.value.set(w + 0.9, h + 0.9);
      glowMat.uniforms.uCard.value.set(w, h);
      const settled = 1 - smoothstep(0.08, 0.3, Math.abs(s.shown - fi));
      glowMat.uniforms.uStrength.value = damp(glowMat.uniforms.uStrength.value, (1 - speed) * settled * 0.38 * smoothstep(0.55, 1, intro / INTRO_S), 8, dt);
    }

    // embers drift with the scroll, slower than the cards
    if (motes.current) {
      motes.current.uniforms.uScroll.value = at.y * 0.6;
      motes.current.uniforms.uSpin.value = -at.theta;
      motes.current.uniforms.uScale.value = 11 * (size.height / 800) * gl.getPixelRatio();
    }

    // a little parallax from the pointer
    const tx = live.pointer.inside ? live.pointer.x * 0.22 : 0;
    const ty = live.pointer.inside ? live.pointer.y * 0.14 : 0;
    s.camX = damp(s.camX, tx, 3.5, dt);
    s.camY = damp(s.camY, ty, 3.5, dt);
    if (Math.abs(s.camX - tx) + Math.abs(s.camY - ty) > 0.0005) busy = true;
    camera.position.x = s.camX;
    camera.position.y = s.camY;
    camera.lookAt(0, 0, 0);
    camera.rotation.z += -s.vel * 0.0016;

    if (centre !== s.focus) {
      s.focus = centre;
      onFocus?.(centre);
    }

    if (busy) invalidate();
  });

  return (
    <>
      <group ref={group} name="helix" />
      <mesh ref={glow} geometry={glowGeo} material={glowMat} renderOrder={-1} name="focus-glow" />
      <Motes radius={helix.radius} materialRef={motes} />
    </>
  );
}

export default function HelixCanvas({ photos, live, onFocus, onHover, onReady, onFail }) {
  return (
    <Canvas
      className="hx-canvas"
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 48, near: 0.1, far: 40, position: [0, 0, 6] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);        gl.domElement.addEventListener("webglcontextlost", () => onFail?.(), { once: true });
      }}
    >
      <Helix photos={photos} live={live} onFocus={onFocus} onHover={onHover} onReady={onReady} />
    </Canvas>
  );
}
