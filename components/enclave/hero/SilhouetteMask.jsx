"use client";

import { useFBO } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { live } from "./heroStore";

/** Objects on this layer (the bust and its eyes) make up the silhouette. */
export const MASK_LAYER = 2;

const _clear = new THREE.Color();

/** Flat white override the silhouette is drawn with (shared so Bust can precompile it). */
export const MASK_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffffff });

/** Mask resolution relative to the screen. Measured on the target iGPU: at 0.75 with 4x MSAA
 * the rim is as smooth and stable as at full resolution, for ~6 fps less cost (the shader samples
 * it in normalised coordinates, so any resolution lines up). */
const MASK_SCALE = 0.75;

/**
 * Renders the posed bust as flat white into a multisampled target every frame.
 * The bust shader samples this mask around each pixel to find the *outer* silhouette, which is
 * where the reference's red rim lives. Unlike a fresnel term it never lights inner folds (ears,
 * nostrils, eyelids), and the multisampled mask keeps the line smooth instead of stair-stepped.
 *
 * Mount after <Bust/> so this runs after the bones are posed and before the frame is drawn.
 */
export default function SilhouetteMask() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const w = Math.max(2, Math.floor(size.width * dpr * MASK_SCALE));
  const h = Math.max(2, Math.floor(size.height * dpr * MASK_SCALE));
  const maxSamples = gl.capabilities.isWebGL2 ? gl.capabilities.maxSamples || 4 : 0;
  const fbo = useFBO(w, h, {
    // smooth edge coverage keeps the thin rim from crawling (without it: visibly more shimmer)
    samples: Math.min(4, maxSamples),
    depthBuffer: true,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
    generateMipmaps: false,
  });

  useEffect(() => {
    live.silhouette.texture = fbo.texture;
    return () => {
      live.silhouette.texture = null;
    };
  }, [fbo]);

  useFrame(({ scene, camera }) => {
    const layers = camera.layers.mask;
    const override = scene.overrideMaterial;
    const target = gl.getRenderTarget();
    gl.getClearColor(_clear);
    const clearAlpha = gl.getClearAlpha();

    camera.layers.set(MASK_LAYER);
    scene.overrideMaterial = MASK_MATERIAL;
    gl.setRenderTarget(fbo);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    gl.render(scene, camera);

    gl.setRenderTarget(target);
    gl.setClearColor(_clear, clearAlpha);
    scene.overrideMaterial = override;
    camera.layers.mask = layers;
  });

  return null;
}
