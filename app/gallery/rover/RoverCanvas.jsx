"use client";

// The ENC-01 rover's canvas on the Enclave bar: a transparent canvas over the whole row, drawn only
// while something moves (frameloop "demand"). The camera is fitted so the whole drift stays inside the
// bar; the drift itself is drift.js, stepped at a fixed rate. Loaded lazily by RoverDrift.
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import Dust, { createDust } from "./Dust";
import { DEFAULT_BOX, FOV, MARGIN, STEP, cameraPose, createSim, parkNow, solveBar, step } from "./drift";
import { MODEL_URL, Rover } from "./Rover";
import Skids, { createSkids } from "./Skids";

const DEV = process.env.NODE_ENV !== "production";

useGLTF.preload(MODEL_URL);

function gradient(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  return new THREE.CanvasTexture(c);
}

/** where the rover parks: the gap between the title / meta and the "View →" arrow, or the right end */
function measureSpot(row) {
  const r = row.getBoundingClientRect();
  const go = row.querySelector(".ar-go")?.getBoundingClientRect();
  if (!go || go.width === 0) return { right: true };
  let text = 0;
  for (const el of row.querySelectorAll(".ar-title, .ar-meta")) {
    const range = document.createRange();
    range.selectNodeContents(el);
    text = Math.max(text, range.getBoundingClientRect().right - r.left);
  }
  return { lo: text, hi: go.left - r.left };
}

/** blob shadow (stretches with speed) and the headlight streak that runs ahead of the entry */
function Floor({ api }) {
  const shadow = useRef();
  const streak = useRef();
  const shadowMat = useMemo(() => {
    const map = gradient(128, 128, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, "rgba(0,0,0,0.75)");
      r.addColorStop(0.55, "rgba(0,0,0,0.35)");
      r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, w, w);
    });
    return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  }, []);
  const streakMat = useMemo(() => {
    const map = gradient(256, 64, (g, w, h) => {
      const lin = g.createLinearGradient(0, 0, w, 0);
      lin.addColorStop(0, "rgba(255,236,214,0)");
      lin.addColorStop(0.18, "rgba(255,236,214,1)");
      lin.addColorStop(1, "rgba(255,200,170,0)");
      g.fillStyle = lin;
      g.fillRect(0, 0, w, h);
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, "rgba(0,0,0,1)");
      v.addColorStop(0.5, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,1)");
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
    });
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  }, []);
  api.current = (S, G) => {
    const sh = shadow.current;
    sh.visible = S.mode !== "off";
    sh.position.set(S.x, 0.001, S.z);
    sh.rotation.set(-Math.PI / 2, 0, S.yaw);
    sh.scale.set(0.66, 0.68 + Math.min(0.5, S.speed * 0.05), 1);
    shadowMat.opacity = 0.7;
    const st = streak.current;
    st.visible = S.streak >= 0;
    if (st.visible) {
      const k = S.streak;
      const e = 1 - (1 - k) * (1 - k);
      st.position.set(G.xEdgeR + 0.9 - e * 2.6, 0.002, G.zPark - 0.18);
      streakMat.opacity = Math.sin(k * Math.PI) * 0.85;
    }
  };
  return (
    <>
      <mesh ref={shadow} material={shadowMat} renderOrder={0} visible={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={streak} material={streakMat} rotation={[-Math.PI / 2, 0, 0]} scale={[2.2, 0.5, 1]} renderOrder={1} visible={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  );
}

function Stage({ director }) {
  const rover = useRef();
  const floor = useRef();
  const { gl, scene, camera, size, invalidate } = useThree();
  const sim = useMemo(() => createSim(), []);
  const fx = useMemo(() => ({ dust: createDust(), skids: createSkids() }), []);
  const st = useRef({ rig: null, G: null, memo: {}, last: 0, acc: 0, warned: "", ready: false });
  const input = useMemo(() => ({ want: "out", pointer: null, still: false }), []);
  const corner = useMemo(() => new THREE.Vector3(), []);

  const apply = () => {
    const s = st.current;
    rover.current?.apply(sim, director.reduced);
    floor.current?.(sim, s.G);
    fx.dust.upload();
    fx.skids.upload();
    const dark = director.row?.matches(":hover, :focus-visible, [data-rover='on']") ? 0 : 1;
    if (fx.dust.material) fx.dust.material.uniforms.uDark.value = dark;
    if (fx.skids.material) {
      fx.skids.material.uniforms.uDark.value = dark;
      fx.skids.material.uniforms.uNow.value = sim.t;
    }
  };

  /** replays the entry from the start up to `at` seconds (the ?rover=t: freeze frame) */
  const freeze = (at) => {
    Object.assign(sim, createSim());
    fx.dust.reset();
    fx.skids.reset();
    const i = { want: "in", pointer: null, still: false };
    for (let k = 0; k < Math.round(at / STEP); k++) {
      step(sim, st.current.G, i, STEP);
      fx.dust.step(sim, STEP);
      fx.skids.step(sim, STEP);
    }
    apply();
    if (DEV) checkBounds();
  };

  // fit the camera to the bar and measure where to park
  const refit = () => {
    const s = st.current;
    if (!size.width || !size.height || !director.row) return;
    const box = rover.current?.box || DEFAULT_BOX;
    const { rig, G } = solveBar(size.width, size.height, box, measureSpot(director.row), s.memo);
    s.rig = rig;
    s.G = G;
    const pose = cameraPose(rig);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.fov = FOV;
    camera.near = 0.1;
    camera.far = 40;
    camera.updateProjectionMatrix();
  };
  // ...and again whenever the row resizes (it grows a little on hover)
  useLayoutEffect(() => {
    refit();
    if (st.current.ready && director.freeze != null) freeze(director.freeze);
    invalidate();
  }, [size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // shaders compiled and textures uploaded before the first hover, with the canvas still hidden
  useEffect(() => {
    let gone = false;
    director.wake = () => invalidate();
    if (DEV) window.__rover = { sim, scene, gl, camera, st: st.current }; // for poking at from the console
    (async () => {
      const s = st.current;
      parkNow(sim, s.G);
      apply();
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        // older drivers: the first render compiles instead
      }
      if (gone) return;
      for (const m of rover.current?.materials() || [])
        for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"]) if (m[k]) gl.initTexture(m[k]);
      gl.render(scene, camera);
      sim.mode = "off";
      apply();
      s.ready = true;
      s.last = performance.now() / 1000;
      if (director.freeze != null) freeze(director.freeze);
      director.onReady?.();
      invalidate();
    })();
    return () => {
      gone = true;
      director.wake = () => {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const s = st.current;
    if (!s.ready || !s.G || director.freeze != null) return;
    const now = performance.now() / 1000;
    let dt = now - s.last;
    s.last = now;
    if (!(dt > 0) || dt > 0.1) dt = 1 / 60;

    if (director.reduced) {
      // no drift: it is simply parked, and the canvas fades in and out (archive.css)
      if (sim.mode !== "idle") parkNow(sim, s.G);
      input.want = "in";
      input.still = true;
      step(sim, s.G, input, STEP);
      apply();
      return;
    }
    input.still = false;
    if (DEV && director.loop) {
      if (sim.mode === "idle" && sim.modeT > 1.4) director.want = "out";
      else if (sim.mode === "off" && sim.modeT > 0.6) director.want = "in";
    }
    input.want = director.want;
    if (input.want === "in" && sim.mode === "off") refit(); // the title's hover face may have changed the gap
    input.pointer = director.pointerX == null ? null : ((director.pointerX / s.rig.W) * 2 - 1) * s.G.k;
    s.acc += dt;
    for (let n = 0; s.acc >= STEP && n < 24; n++) {
      step(sim, s.G, input, STEP);
      fx.dust.step(sim, STEP);
      fx.skids.step(sim, STEP);
      s.acc -= STEP;
    }
    s.acc = Math.min(s.acc, STEP);
    apply();

    if (DEV && sim.mode !== "off") checkBounds();

    // keep drawing while anything moves; a parked rover on a touch screen settles after a few seconds
    const parkedLong = sim.mode === "idle" && director.touch && sim.modeT > 4;
    const busy = (sim.mode !== "off" && !parkedLong) || fx.dust.alive() || fx.skids.alive(sim.t) || (DEV && director.loop);
    if (busy && director.visible) invalidate();
  });

  // dev: warn if the rover's box leaves the bar (vertically always, sideways once it's parked)
  const checkBounds = () => {
    const s = st.current;
    const body = rover.current?.body();
    if (!body) return;
    body.updateWorldMatrix(true, false);
    const { min, max } = rover.current.box;
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]).applyMatrix4(body.matrixWorld).project(camera);
      const x = ((corner.x + 1) / 2) * size.width;
      const y = ((1 - corner.y) / 2) * size.height;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    const m = MARGIN - 0.75;
    const out = top < m || bottom > size.height - m || (sim.mode === "idle" && (left < m || right > size.width - m));
    const key = `${sim.mode}:${Math.round(sim.t * 2)}`;
    if (out && s.warned !== key) {
      s.warned = key;
      console.warn("[rover] box leaves the bar", { mode: sim.mode, t: +sim.pt.toFixed(2), top: +top.toFixed(1), bottom: +bottom.toFixed(1), left: +left.toFixed(1), right: +right.toFixed(1), W: size.width, H: size.height });
    }
  };

  return (
    <>
      <Rover ref={rover} />
      <Floor api={floor} />
      <Skids fx={fx.skids} />
      <Dust fx={fx.dust} />
    </>
  );
}

export default function RoverCanvas({ director }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "default" }}
      camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 1, 4] }}
      style={{ pointerEvents: "none" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.3;
        gl.setClearColor(0x000000, 0);
      }}
    >
      {/* studio: warm key, cool fill, an ember rim from behind (brighter than event 2's showroom:
          the rover is small here, on an ink bar) */}
      <hemisphereLight args={["#d8e0f5", "#2a1c14", 1.1]} />
      <directionalLight position={[-2.2, 4.2, 3.6]} intensity={3.6} color="#fff3e6" />
      <directionalLight position={[2.8, 1.4, 2.4]} intensity={1.1} color="#c9d6f2" />
      <directionalLight position={[1.6, 2.2, -3.4]} intensity={3.2} color="#f9725a" />
      <directionalLight position={[-2.5, 1.6, -2.8]} intensity={0.9} color="#9fb2dd" />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[-3, 4, 2]} scale={[5, 2, 1]} color="#fff2e6" />
        <Lightformer intensity={0.9} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} color="#f4ece4" />
        <Lightformer intensity={1.1} position={[3, 2, -3]} scale={[2, 5, 1]} color="#f9725a" />
        <Lightformer intensity={0.5} position={[0, 0.8, 4]} scale={[6, 0.5, 1]} color="#ffe2d2" />
      </Environment>
      <Suspense fallback={null}>
        <Stage director={director} />
      </Suspense>
    </Canvas>
  );
}
