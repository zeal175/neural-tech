"use client";

import { PerformanceMonitor, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useRef } from "react";
import Bust from "./Bust";
import Embers from "./Embers";
import { live, useHero } from "./heroStore";
import Lighting from "./Lighting";
import SilhouetteMask from "./SilhouetteMask";
import { damp, DEG, easeInOutCubic, smoothstep } from "./math";

// The post-processing chain is a chunk of its own, so its start-up runs in a separate task from
// the rest of the 3D code (one long task blocks input on a phone). Requested as soon as this
// module runs; it downloads alongside the model, which takes longer, so nothing waits for it.
const effectsChunk = import("./Effects");
const Effects = lazy(() => effectsChunk);

const FOV = 22;
const ORBIT_END = -105 * DEG; // scroll orbit: front-right three-quarter -> behind-right (poster)

/** Frames the bust for any aspect ratio, adds cursor parallax and the scroll orbit. */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const st = useRef({ px: 0, py: 0, scroll: 0, panel: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = st.current;
    const aspect = size.width / size.height;
    const portrait = aspect < 0.9;
    const tan = Math.tan((FOV * DEG) / 2);
    // visible height needed so the bust (≈0.43 m) fills the frame like the poster
    const needH = portrait ? 0.66 : 0.52;
    const needW = portrait ? 0.4 : 0.6;
    const dist = Math.max(needH / (2 * tan), needW / (2 * tan * aspect));
    // portrait: lift the bust so the head overlaps the bottom of the title (poster layering)
    const lookY = portrait ? -0.01 : 0.034;

    const active = live.pointer.inside;
    s.px = damp(s.px, active ? live.pointer.x : 0, 1.8, dt);
    s.py = damp(s.py, active ? live.pointer.y : 0, 1.8, dt);
    s.scroll = damp(s.scroll, live.scroll, 5, dt);
    const sc = easeInOutCubic(smoothstep(0.0, 0.9, s.scroll));

    // registration panel open: slide the figure into the free space beside the panel
    // (left of a desktop side panel, above a phone bottom sheet)
    s.panel = damp(s.panel, live.form.open ? 1 : 0, 3.2, dt);
    const shiftX = portrait ? 0 : 0.14 * s.panel;
    const shiftY = portrait ? -0.17 * s.panel : 0;

    const orbit = ORBIT_END * sc - s.px * 2.2 * DEG;
    live.orbit = ORBIT_END * sc;
    const d = dist * (1 - 0.1 * sc) * (1 + (portrait ? 0.18 : 0.06) * s.panel);
    camera.position.set(
      Math.sin(orbit) * d + shiftX,
      lookY + shiftY + 0.012 + s.py * 0.018 + sc * 0.03,
      Math.cos(orbit) * d
    );
    camera.lookAt(shiftX, lookY + shiftY + sc * 0.035, 0);
    if (camera.fov !== FOV) {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    }
    live.flash = damp(live.flash, 0, 3.2, dt);
  });
  return null;
}

/** Mirrors drei's loading progress into the store so the DOM loader stays out of this chunk. */
function ProgressBridge() {
  const progress = useProgress((s) => s.progress);
  useEffect(() => useHero.getState().set({ progress }), [progress]);
  return null;
}

const DPR = { high: [1, 2], mid: [1, 1.4], low: [0.8, 1] };
const NEXT = { high: "mid", mid: "low", low: "low" };

export default function HeroCanvas({ active = true }) {
  const tier = useHero((s) => s.tier);
  const set = useHero((s) => s.set);
  return (
    <>
      <ProgressBridge />
      <Canvas
        dpr={DPR[tier]}
        frameloop={active ? "always" : "never"}
        shadows={false}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: FOV, near: 0.05, far: 20, position: [0, 0.02, 1.4] }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        aria-hidden="true"
      >
        <PerformanceMonitor
          flipflops={2}
          onDecline={() => {
            // unfocused / background pages get throttled frames: not a reason to drop quality
            if (!document.hasFocus() || useHero.getState().tierLocked) return;
            set({ tier: NEXT[useHero.getState().tier] });
          }}
          onFallback={() => !useHero.getState().tierLocked && document.hasFocus() && set({ tier: "low" })}
        />
        <CameraRig />
        <Suspense fallback={null}>
          <Lighting />
          <Bust />
          {/* after Bust: renders the posed silhouette the rim is computed from */}
          <SilhouetteMask />
          <Embers />
          <Effects />
        </Suspense>
      </Canvas>
    </>
  );
}
