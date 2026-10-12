"use client";

import { Lightformer } from "@react-three/drei";
import { applyProps, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { live } from "./heroStore";
import { damp } from "./math";

/**
 * Bakes its children (the light shapes) into the scene environment once. This is what drei's
 * <Environment resolution frames={1}> does with children (same render target, cube camera and
 * scene settings), without importing its HDR / EXR / gain-map file loaders: this scene never
 * loads a file, and that code cost the page ~100 KB of script and its start-up time.
 */
function StudioEnvironment({ resolution = 256, children }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useRef(null);
  const [virtualScene] = useState(() => new THREE.Scene());
  const fbo = useMemo(() => {
    const target = new THREE.WebGLCubeRenderTarget(resolution);
    target.texture.type = THREE.HalfFloatType;
    return target;
  }, [resolution]);
  useEffect(() => () => fbo.dispose(), [fbo]);
  const baked = useRef(false);
  const pmrem = useRef(null);
  useEffect(() => () => pmrem.current?.dispose(), []);
  useLayoutEffect(() => {
    let cancelled = false;
    let restore = null;
    const bake = () => {
      if (cancelled) return;
      baked.current = true;
      const autoClear = gl.autoClear;
      gl.autoClear = true;
      camera.current.update(gl, virtualScene);
      gl.autoClear = autoClear;
      const old = {
        environment: scene.environment,
        backgroundBlurriness: scene.backgroundBlurriness,
        backgroundIntensity: scene.backgroundIntensity,
        backgroundRotation: scene.backgroundRotation.clone(),
        environmentIntensity: scene.environmentIntensity,
        environmentRotation: scene.environmentRotation.clone(),
      };
      scene.environment = fbo.texture;
      applyProps(scene, {
        backgroundBlurriness: 0,
        backgroundIntensity: 1,
        backgroundRotation: [0, 0, 0],
        environmentIntensity: 1,
        environmentRotation: [0, 0, 0],
      });
      restore = () => {
        scene.environment = old.environment;
        applyProps(scene, old);
      };
    };
    if (baked.current) {
      bake(); // a re-bake: its shaders are compiled already
    } else {
      // First bake: the shaders it needs are compiled in parallel first (a shader first used in a
      // render compiles synchronously and blocks the page). That is the light shapes' material,
      // and the shader three uses to convert this cube map for the physical materials (PMREM)
      // when the figure compiles: same source, so three's program cache hands it over then. The
      // cube camera renders into a render target, so both are compiled against one.
      const rt = new THREE.WebGLRenderTarget(1, 1);
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      const job = gl.compileAsync(virtualScene, camera.current.children[0]);
      pmrem.current ??= new THREE.PMREMGenerator(gl); // kept: disposing it releases the shader
      pmrem.current.compileCubemapShader();
      gl.setRenderTarget(prev);
      job.catch(() => {}).then(() => {
        rt.dispose();
        bake();
      });
    }
    return () => {
      cancelled = true;
      restore?.();
    };
  }, [children, virtualScene, fbo.texture, scene, gl]);
  return createPortal(
    <>
      {children}
      <cubeCamera ref={camera} args={[0.1, 1000, fbo]} />
    </>,
    virtualScene
  );
}

/**
 * "Sculpture studio" lighting for the black satin figure. On a dark material the form is
 * described by what the surface REFLECTS, so the look is built from large light shapes in a
 * baked environment, like a gallery shoot of a bronze:
 * - a big soft key high on the camera-left: broad modelling on brow, cheekbone, nose and lips;
 * - two tall strip lights behind left and right: long silver highlights tracing skull, jaw,
 *   neck and shoulders, so the figure reads even where it sits on the black background;
 * - a dim cool top light for the crown.
 * The red backlight is not a light here: it is the silhouette rim in bustMaterial.js, which
 * only ever traces the outer contour. The cursor's own warm light lives in Bust.jsx.
 * Panels sit on a 3 m sphere; sizes give their angular size (key ~60 x 50 deg, strips ~9 deg wide).
 */
export default function Lighting() {
  const rigRef = useRef();
  const fill = useRef();
  const key = useRef();
  const scene = useThree((s) => s.scene);
  const st = useRef({ envYaw: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = st.current;
    const rim = live.intro.rim;
    const px = live.pointer.inside ? live.pointer.x : 0;
    const on = Math.min(1, rim * 1.4);

    rigRef.current.rotation.y = live.orbit || 0;
    fill.current.intensity = 0.2 * on;
    key.current.intensity = 0.15 * on;

    // the highlights glide a little across the surface with the cursor
    s.envYaw = damp(s.envYaw, px * 0.3 + (live.orbit || 0), 2.0, dt);
    scene.environmentRotation.set(0, s.envYaw, 0);
    scene.environmentIntensity = 0.65 + rim * 0.55;
  });

  return (
    <>
      <StudioEnvironment resolution={256}>
        {/* big soft key, high camera-left */}
        <Lightformer form="rect" color="#e6ecff" intensity={0.7} position={[-1.67, 1.52, 1.97]} scale={[3.46, 2.8, 1]} target={[0, 0, 0]} />
        {/* tall strip light behind-right: the long highlight down the skull, jaw and neck */}
        <Lightformer form="rect" color="#ffffff" intensity={5.5} position={[2.82, 0.36, -0.95]} scale={[0.47, 6.5, 1]} target={[0, 0, 0]} />
        {/* thinner, cooler strip behind-left */}
        <Lightformer form="rect" color="#c9d6ff" intensity={3.2} position={[-2.75, 0.15, -1.19]} scale={[0.37, 5.5, 1]} target={[0, 0, 0]} />
        {/* dim cool top light */}
        <Lightformer form="rect" color="#9fb2e8" intensity={0.5} position={[0.3, 2.95, 0.44]} scale={[4.2, 1.6, 1]} target={[0, 0, 0]} />
      </StudioEnvironment>

      <group ref={rigRef}>
        <directionalLight ref={fill} color="#8da3d8" position={[-1.0, 2.2, 1.6]} intensity={0} />
        {/* soft direct key matching the environment key (gives the diffuse modelling) */}
        <directionalLight ref={key} color="#e6ecff" position={[-1.1, 1.2, 1.6]} intensity={0} />
      </group>
    </>
  );
}
