"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { live, useHero, warmDone } from "./heroStore";
import { warmProgramInfo } from "./warmPrograms";

/** Bloom, colour fringing on flashes, AgX tone mapping (the low tier tone-maps in the renderer). */
export default function Effects() {
  const tier = useHero((s) => s.tier);
  const gl = useThree((s) => s.gl);
  const bloom = useRef();
  const ca = useRef();
  const off = useRef(new THREE.Vector2());

  useEffect(() => {
    gl.toneMapping = tier === "low" ? THREE.AgXToneMapping : THREE.NoToneMapping;
  }, [gl, tier]);

  // Shader warm-up: the post chain's shaders are linked in parallel (KHR_parallel_shader_compile)
  // before their first use, instead of compiling synchronously and freezing the page for
  // several hundred ms. Until they are ready the effect passes are held back; nothing reaches
  // the screen then, and the loader covers the canvas anyway. Only the first composer is
  // warmed: later tier changes rebuild it while the figure is on screen.
  const composerRef = useRef();
  const warm = useRef({ started: false });
  useEffect(() => {
    if (tier === "low") warmDone("post");
    const fallback = setTimeout(() => warmDone("post", true), 6000);
    return () => clearTimeout(fallback);
  }, [tier]);
  useFrame(({ camera }) => {
    const c = warm.current;
    const composer = composerRef.current;
    if (c.started || !composer || composer.passes.length < 2 || !gl.compileAsync) return;
    c.started = true;
    const passes = composer.passes.filter((p) => p.fullscreenMaterial && p.enabled);
    const toTarget = new THREE.Scene();
    const toScreen = new THREE.Scene();
    // position + uv only, like postprocessing's fullscreen triangle (a normal attribute would
    // add HAS_NORMAL and compile a variant the passes never use)
    const geo = new THREE.PlaneGeometry(2, 2).deleteAttribute("normal");
    const add = (material, screen) => material && (screen ? toScreen : toTarget).add(new THREE.Mesh(geo, material));
    for (const p of passes) {
      add(p.fullscreenMaterial, p.renderToScreen);
      for (const effect of p.effects || []) {
        add(effect.luminancePass?.fullscreenMaterial, false);
        add(effect.mipmapBlurPass?.downsamplingMaterial, false);
        add(effect.mipmapBlurPass?.upsamplingMaterial, false);
      }
      p.enabled = false;
    }
    const rt = new THREE.WebGLRenderTarget(1, 1);
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(rt);
    const jobs = [gl.compileAsync(toTarget, camera)];
    gl.setRenderTarget(null);
    jobs.push(gl.compileAsync(toScreen, camera));
    gl.setRenderTarget(prev);
    const finish = () => {
      for (const p of passes) p.enabled = true;
      rt.dispose();
      geo.dispose();
      warmDone("post");
    };
    Promise.all(jobs).then(() => warmProgramInfo(gl)).then(finish, finish);
  });

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.6 + live.flash * 0.7;
    if (ca.current) {
      // colour fringing only during a click / charge flash: at rest it frays thin bright edges
      const k = live.flash * 0.004;
      off.current.set(k, k * 0.6);
      ca.current.offset = off.current;
    }
  });

  if (tier === "low") return null;
  return (
    <EffectComposer ref={composerRef} multisampling={tier === "high" ? 4 : 2} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      {/* tight: only the hot core of the rim blooms, into a short glow (not a wide pink haze) */}
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.25} intensity={0.6} radius={0.55} />
      <ChromaticAberration ref={ca} radialModulation modulationOffset={0.32} />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
