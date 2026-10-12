"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { MeshoptDecoder } from "meshoptimizer/decoder";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { MODEL_URL, TEXTURES, TEXTURES_HI } from "@/lib/enclave/assets";
import { createBustMaterial, createEyeMaterial, PULSES } from "./bustMaterial";
import { live, useHero, warmDone } from "./heroStore";
import { clamp, damp, DEG, lerp, smoothstep, spring, wobble } from "./math";
import { MASK_LAYER, MASK_MATERIAL } from "./SilhouetteMask";
import { warmProgramInfo } from "./warmPrograms";

export const BUST_CENTER_Y = 1.43; // rest-space height of the bust centre (metres)
export const BODY_YAW = 35 * DEG; // whole bust turned so we see its right shoulder
const REST = { yaw: 28 * DEG, pitch: 17 * DEG }; // poster mood: looking up and away
const POSTER = { yaw: -40 * DEG, pitch: 25 * DEG }; // end of the scroll: the poster framing
const LIMIT = { yaw: 64 * DEG, up: 34 * DEG, down: -22 * DEG };
// share of the gaze each bone takes [yaw, pitch]; the chain multiplies back to the full turn
const CHAIN = [
  ["chest", 0.12, 0.04],
  ["neck_01", 0.2, 0.22],
  ["neck_02", 0.25, 0.3],
  ["head", 0.43, 0.44],
];

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");
const _tri = new THREE.Triangle();
const _bary = new THREE.Vector3();
const _plane = new THREE.Plane();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const Z = new THREE.Vector3(0, 0, 1);
const lastHit = { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) };
const _camUp = new THREE.Vector3();
const HOVER_WARM = new THREE.Color("#ffb592"); // soft warm light while hovering
const HOVER_HOT = new THREE.Color("#ff3b1f"); // turns ember-red as a hold charges

function configure(tex, { repeat = false, aniso = 8 } = {}) {
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = aniso;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// The model is loaded with the GLTFLoader drei's useGLTF wraps, but its compressed geometry is
// decoded in a worker: meshoptimizer's own decoder, whose output is byte-for-byte the same as the
// copy drei bundles (which decodes on the main thread, and ships with a Draco loader this model
// does not need).
if (typeof Worker !== "undefined") MeshoptDecoder.useWorkers(1);
const withMeshopt = (loader) => loader.setMeshoptDecoder(MeshoptDecoder);

// The first-load maps are decoded off the main thread (ImageBitmap). An <img> texture is decoded
// synchronously when it is uploaded, which blocks a phone for ~100 ms. The maps have no alpha
// and no colour profile, and are stored as-is (flipY false): the pixels are the same either way.
class BitmapTextureLoader extends THREE.ImageBitmapLoader {
  constructor(manager) {
    super(manager);
    this.setOptions({ premultiplyAlpha: "none", colorSpaceConversion: "none" });
  }
  load(url, onLoad, onProgress, onError) {
    return super.load(url, (bitmap) => onLoad(new THREE.Texture(bitmap)), onProgress, onError);
  }
}
const MapLoader = typeof createImageBitmap === "function" ? BitmapTextureLoader : THREE.TextureLoader;
const MAP_KEYS = Object.keys(TEXTURES);
const MAP_URLS = Object.values(TEXTURES);

const _sv = new THREE.Vector3();
const _b4 = new THREE.Vector4();
const _t4 = new THREE.Vector4();
const _si = new THREE.Vector4();
const _sw = new THREE.Vector4();

/**
 * mesh.getVertexPosition(i) for every vertex, passed to fn(i, position). Same arithmetic as
 * three's SkinnedMesh.applyBoneTransform, but the bone matrices are multiplied once instead of
 * once per vertex and weight: the bust has 77k vertices and the loop blocked the page ~100 ms.
 */
function forEachVertexPosition(mesh, fn) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!mesh.isSkinnedMesh || geo.morphAttributes.position) {
    for (let i = 0; i < pos.count; i++) fn(i, mesh.getVertexPosition(i, _sv));
    return;
  }
  const { bones, boneInverses } = mesh.skeleton;
  const mats = bones.map((b, k) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, boneInverses[k]));
  const { skinIndex, skinWeight } = geo.attributes;
  for (let i = 0; i < pos.count; i++) {
    _sv.fromBufferAttribute(pos, i);
    _si.fromBufferAttribute(skinIndex, i);
    _sw.fromBufferAttribute(skinWeight, i);
    _b4.set(_sv.x, _sv.y, _sv.z, 1).applyMatrix4(mesh.bindMatrix);
    _sv.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = _sw.getComponent(k);
      if (w !== 0) _sv.addScaledVector(_t4.copy(_b4).applyMatrix4(mats[_si.getComponent(k)]), w);
    }
    fn(i, _sv.applyMatrix4(mesh.bindMatrixInverse));
  }
}

/**
 * Affine map (per axis) from quantised attribute space to metric rest space, measured at rest.
 * `sphere`, if given, is grown around the rest-pose vertices on the way.
 */
function measureDequant(mesh, sphere) {
  const pos = mesh.geometry.attributes.position;
  const raw = new THREE.Box3();
  const rest = new THREE.Box3();
  forEachVertexPosition(mesh, (i, p) => {
    rest.expandByPoint(p);
    sphere?.expandByPoint(p);
    raw.expandByPoint(_v.fromBufferAttribute(pos, i));
  });
  const scale = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (const k of ["x", "y", "z"]) {
    scale[k] = (rest.max[k] - rest.min[k]) / Math.max(raw.max[k] - raw.min[k], 1e-9);
    offset[k] = rest.min[k] - raw.min[k] * scale[k];
  }
  return { scale, offset };
}

function findNode(root, name) {
  return root.getObjectByName(name) || root.getObjectByName(name.replace(/[.\s]/g, ""));
}

/** Bind-pose measurements, done once per loaded model while the bones are still at rest. */
function measureRest(rig, rootObj) {
  const { bust, proxy, eyes, bones, material, eyeMats } = rig;
  rootObj.updateMatrixWorld(true);
  const rootQInv = rootObj.getWorldQuaternion(new THREE.Quaternion()).invert();
  const restOf = (bone) => {
    const restWorld = rootQInv.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    return { bone, restLocal: bone.quaternion.clone(), restWorld, restWorldInv: restWorld.clone().invert() };
  };
  const chain = CHAIN.map(([name, sy, sp]) => ({ ...restOf(bones[name]), sy, sp }));
  const shoulders = [bones.shoulderL, bones.shoulderR].filter(Boolean).map(restOf);

  // The renderer depth-sorts the (transparent) bust by its bounding sphere and would otherwise
  // compute it on the first draw, skinning all 77k vertices on the CPU. The bust is the only
  // transparent object in its render order, so the sphere decides nothing on screen.
  bust.boundingSphere = new THREE.Sphere();
  const dqBust = measureDequant(bust, bust.boundingSphere);
  material.userData.uniforms.uDQScale.value.copy(dqBust.scale);
  material.userData.uniforms.uDQOffset.value.copy(dqBust.offset);
  const dqProxy = measureDequant(proxy);
  proxy.geometry.computeBoundingSphere();
  proxy.boundingSphere = proxy.geometry.boundingSphere.clone();
  proxy.boundingSphere.radius *= 4.0;

  const head = bones.head;
  const eyeRigs = eyes.map((eye, i) => {
    const centerWorld = eye.localToWorld(eyeMats[i].userData.uniforms.uEyeCenter.value.clone());
    const pivot = new THREE.Object3D();
    pivot.name = `${eye.name}_pivot`;
    head.add(pivot);
    pivot.position.copy(head.worldToLocal(centerWorld));
    pivot.updateMatrixWorld(true);
    pivot.attach(eye);
    const fwd = Z.clone().applyQuaternion(eye.quaternion).normalize(); // eye axis in pivot space
    return { pivot, fwd, q: new THREE.Quaternion() };
  });

  // head pivot in rest/root space (for gaze direction)
  const headRest = rootObj.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  return { chain, shoulders, eyeRigs, dqProxy, headRest };
}

export default function Bust() {
  const gltf = useLoader(GLTFLoader, MODEL_URL, withMeshopt);
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const maps = useLoader(MapLoader, MAP_URLS);
  const textures = useMemo(() => Object.fromEntries(MAP_KEYS.map((k, i) => [k, maps[i]])), [maps]);
  const { camera, gl, scene: threeScene } = useThree();
  const root = useRef();
  const hoverLight = useRef();

  // The GLTF is cached by useLoader, so set it up exactly once and keep the result on the scene.
  // (useMemo may run twice in StrictMode; a non-idempotent setup would leave the mesh with a
  // material whose uniforms nobody updates.)
  const rig = useMemo(() => {
    const scene = gltf.scene;
    if (scene.userData.enclaveRig) return scene.userData.enclaveRig;
    const bust = findNode(scene, "BUST_low");
    const proxy = findNode(scene, "BUST_proxy");
    const eyes = [findNode(scene, "EYE_L"), findNode(scene, "EYE_R")];
    configure(textures.normal, { aniso: maxAniso });
    configure(textures.orm, { aniso: maxAniso });
    configure(textures.data, { aniso: 4 });
    configure(textures.detail, { repeat: true, aniso: maxAniso });

    const material = createBustMaterial({
      normalMap: textures.normal,
      ormMap: textures.orm,
      dataMap: textures.data,
      detailMap: textures.detail,
    });
    bust.material = material;
    bust.frustumCulled = false;
    bust.layers.enable(MASK_LAYER); // part of the silhouette that drives the rim
    proxy.material = new THREE.MeshBasicMaterial({ visible: false });
    proxy.frustumCulled = false;

    const eyeMats = eyes.map((eye) => {
      const m = createEyeMaterial();
      eye.material = m;
      eye.geometry.computeBoundingBox();
      const b = eye.geometry.boundingBox;
      const r = (b.max.x - b.min.x) / 2;
      m.userData.uniforms.uEyeCenter.value.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z + r);
      eye.frustumCulled = false;
      eye.layers.enable(MASK_LAYER);
      return m;
    });

    const bones = {};
    for (const [name] of CHAIN) bones[name] = findNode(scene, name);
    bones.shoulderL = findNode(scene, "shoulder.L");
    bones.shoulderR = findNode(scene, "shoulder.R");
    scene.userData.enclaveRig = { scene, bust, proxy, eyes, eyeMats, bones, material, rest: null };
    return scene.userData.enclaveRig;
  }, [gltf, textures, maxAniso]);

  // Upload the maps to the GPU while the loader is up, one per task: uploading all of them in one
  // go (as drei's useTexture does) is a single long main-thread task on a phone.
  useEffect(() => {
    let timer = 0;
    const list = Object.values(textures);
    const next = (i) => {
      if (i >= list.length) return;
      gl.initTexture(list[i]);
      timer = setTimeout(() => next(i + 1));
    };
    timer = setTimeout(() => next(0));
    return () => clearTimeout(timer);
  }, [gl, textures]);

  // Rest-pose data + eye pivots: measured once (bones still in bind pose), reused on remounts.
  // Measured in a task of its own: it walks every vertex of the bust, and the commit that mounts
  // the scene (environment bake, renderer set-up) is a long task already. Until it is done the
  // frame loop leaves the bones alone and the figure is not compiled or shown.
  const state = useRef(null);
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      if (!rig.rest) rig.rest = measureRest(rig, root.current);
      const { chain, shoulders, eyeRigs, dqProxy, headRest } = rig.rest;

      if (process.env.NODE_ENV !== "production") {
        window.__enclave = { rig, root: root.current, gl, camera, live, hero: useHero, getState: () => state.current };
      }

      state.current = {
        chain,
        shoulders,
        eyeRigs,
        dqProxy,
        headRest,
        yaw: REST.yaw,
        pitch: REST.pitch,
        yawVel: 0,
        roll: 0,
        engage: 0,
        heat: 0,
        ignite: 0,
        eyeFlash: 0,
        recoilYaw: { x: 0, v: 0 },
        recoilPitch: { x: 0, v: 0 },
        pulseIdx: 0,
        frame: 0,
        lastHover: false,
        scroll: 0,
        // reactions
        shakeT: -10, // head shake (error) start time
        errorFlash: 0, // rim flicker after an error
        nods: [], // scheduled nod impulses (clock times)
        igniteUntil: -1, // eyes held lit until (success / easter egg)
        sweep: 0, // registration "processing" scan line intensity
        sweeping: false,
        charge: 0, // press-and-hold 0..1
        lightFlash: 0, // click / release flare of the hover light
        chargeStart: -1,
        chargeValid: false,
        chargeHit: new THREE.Vector3(),
        keyTick: 0,
        formRim: 0,
        rimDir: new THREE.Vector2(0, 1),
        rimBias: 0,
      };
    });
    return () => clearTimeout(timer);
  }, [rig]);

  // Compile the figure's shaders in parallel (KHR_parallel_shader_compile) while the loader is
  // up, and keep the figure out of the render until they are linked: a shader first used in a
  // frame compiles synchronously and blocks the page for hundreds of ms. The variants must be
  // the ones the frames will use, so this waits for the environment map and compiles against a
  // render target (the composer renders the scene into one: no tone mapping, linear output);
  // the low tier has no composer and draws to the screen. The silhouette pass draws the bust
  // and eyes with a flat override material, so that variant is compiled too.
  const compile = useRef({ started: false, done: false });
  useLayoutEffect(() => {
    const c = { started: false, done: false };
    compile.current = c;
    root.current.visible = false;
    let fallback = 0;
    const finish = (force = false) => {
      if (c.done || c.cancelled) return;
      c.done = true;
      clearTimeout(fallback);
      c.rt?.dispose();
      if (root.current) root.current.visible = true;
      warmDone("bust", force === true);
    };
    c.finish = finish;
    // Never hold the loader hostage: some drivers report parallel compilation very late.
    fallback = setTimeout(() => finish(true), 6000);
    return () => {
      c.cancelled = true;
      clearTimeout(fallback);
      c.rt?.dispose();
    };
  }, [rig]);

  useFrame(() => {
    const c = compile.current;
    if (c.started || !threeScene.environment || !state.current) return;
    c.started = true;
    if (!gl.compileAsync) return c.finish();
    const prevTarget = gl.getRenderTarget();
    c.rt = useHero.getState().tier === "low" ? null : new THREE.WebGLRenderTarget(1, 1);
    gl.setRenderTarget(c.rt);
    const jobs = [gl.compileAsync(threeScene, camera)];
    const masked = [rig.bust, ...rig.eyes];
    const own = masked.map((m) => m.material);
    // (drawn with the camera on the mask layer, where no lights are visible: light counts are
    // part of the shader cache key, so compile with the same layers)
    const layers = camera.layers.mask;
    camera.layers.set(MASK_LAYER);
    masked.forEach((m) => (m.material = MASK_MATERIAL));
    jobs.push(gl.compileAsync(rig.scene, camera, threeScene));
    masked.forEach((m, i) => (m.material = own[i]));
    camera.layers.mask = layers;
    gl.setRenderTarget(prevTarget);
    // (then each program's uniform tables, a task per program, instead of all in the first frame)
    const done = () => c.finish();
    Promise.all(jobs).then(() => warmProgramInfo(gl)).then(done, done);
  });

  // Progressive upgrade: 4K normal + 2K ORM on capable desktops once the intro has played.
  const introDone = useHero((s) => s.introDone);
  const tier = useHero((s) => s.tier);
  // The images are decoded off the main thread (ImageBitmap) and uploaded to the GPU in idle time
  // before the swap, so the switch never stalls a frame.
  useEffect(() => {
    if (!introDone || tier !== "high") return;
    let cancelled = false;
    const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 500 }) : setTimeout(r, 16)));
    const load =
      typeof createImageBitmap === "function"
        ? (url) =>
            new THREE.ImageBitmapLoader()
              // keep the data exactly as stored (these are normal / roughness maps, not colour)
              .setOptions({ premultiplyAlpha: "none", colorSpaceConversion: "none" })
              .loadAsync(url)
              .then((bitmap) => new THREE.Texture(bitmap))
        : (url) => new THREE.TextureLoader().loadAsync(url);
    const timer = setTimeout(async () => {
      try {
        const [n, o] = await Promise.all([load(TEXTURES_HI.normal), load(TEXTURES_HI.orm)]);
        if (cancelled) return;
        configure(n, { aniso: maxAniso });
        configure(o, { aniso: maxAniso });
        await idle();
        if (cancelled) return;
        gl.initTexture(n);
        await idle();
        if (cancelled) return;
        gl.initTexture(o);
        const m = rig.material;
        m.normalMap = m.clearcoatNormalMap = n;
        m.roughnessMap = m.aoMap = o;
      } catch {
        /* keep the 2K set */
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [introDone, tier, rig, maxAniso, gl]);

  /** Rest-space hit point on the proxy for a stage NDC, or null. */
  const hitRest = (x, y, out) => {
    _ndc.set(x, y);
    _ray.setFromCamera(_ndc, camera);
    const hits = _ray.intersectObject(rig.proxy, false);
    if (!hits.length) return null;
    const { face, point } = hits[0];
    const p = rig.proxy;
    const pa = p.getVertexPosition(face.a, new THREE.Vector3());
    const pb = p.getVertexPosition(face.b, new THREE.Vector3());
    const pc = p.getVertexPosition(face.c, new THREE.Vector3());
    _tri.set(pa, pb, pc).getBarycoord(p.worldToLocal(point.clone()), _bary);
    // world-space hit + surface normal (facing the camera): the hover light floats just above it
    lastHit.point.copy(point);
    _tri.getNormal(lastHit.normal).transformDirection(p.matrixWorld);
    if (lastHit.normal.dot(_v.copy(camera.position).sub(point)) < 0) lastHit.normal.negate();
    const pos = p.geometry.attributes.position;
    const { scale, offset } = state.current.dqProxy;
    out.set(0, 0, 0);
    for (const [idx, w] of [
      [face.a, _bary.x],
      [face.b, _bary.y],
      [face.c, _bary.z],
    ]) {
      _v.fromBufferAttribute(pos, idx).multiply(scale).add(offset);
      out.addScaledVector(_v, w);
    }
    return out;
  };

  /** Gaze target in world space: ray through the stage NDC hitting a plane in front of the face. */
  const gazePoint = (x, y, out) => {
    const head = rig.bones.head.getWorldPosition(_v2);
    const toCam = _v.copy(camera.position).sub(head).normalize();
    _plane.setFromNormalAndCoplanarPoint(toCam, head.clone().addScaledVector(toCam, 0.85));
    _ndc.set(x, y);
    _ray.setFromCamera(_ndc, camera);
    return _ray.ray.intersectPlane(_plane, out) || out.copy(camera.position);
  };

  const target = useMemo(() => new THREE.Vector3(), []);
  const hoverRest = useMemo(() => new THREE.Vector3(), []);
  const clickRest = useMemo(() => new THREE.Vector3(), []);
  const headNdc = useMemo(() => new THREE.Vector3(), []);

  /** What the figure looks at this frame, highest priority first (null = its own idle pose). */
  const lookTarget = (hero, now, portrait) => {
    const f = live.form;
    if (f.open) {
      // phone number: look politely away (up and away from the panel)
      if (f.privacy) return portrait ? { x: -1.4, y: 1.5, l: 3.2 } : { x: -2.2, y: 1.1, l: 3.2 };
      // typing: follow the text caret, quick like reading eyes
      if (f.caret) return { x: f.caret.x, y: f.caret.y, l: 6.5 };
      return portrait ? { x: 0, y: -0.45, l: 3.6 } : { x: 0.62, y: 0.05, l: 3.6 };
    }
    if (hero.ctaHover) return { x: live.cta.x, y: live.cta.y, l: 4.2 };
    if (live.gaze.active) return { x: live.gaze.x, y: live.gaze.y, l: 4.2 };
    if (now < live.glance.until) return { x: live.glance.x, y: live.glance.y, l: 5.5 };
    if (live.tilt.active && !live.pointer.fine) return { x: live.tilt.x, y: live.tilt.y, l: 3 };
    if (hero.introDone && live.pointer.inside && now - live.pointer.lastMove < 3800) {
      return { x: live.pointer.x, y: live.pointer.y, l: 3.1 };
    }
    return null;
  };

  /** Shockwave on the surface at a rest-space point. scale 1 = click, ~2.4 = charged release. */
  const pulseAt = (u, s, t, p, scale) => {
    const i = s.pulseIdx++ % PULSES;
    u.uPulsePos.value[i].copy(p);
    u.uPulseTime.value[i] = t;
    u.uPulseScale.value[i] = scale;
  };

  useFrame((frameState, rawDt) => {
    const s = state.current;
    if (!s) return;
    const dt = Math.min(rawDt, 1 / 20);
    const t = frameState.clock.elapsedTime;
    const now = performance.now();
    const hero = useHero.getState();
    const u = rig.material.userData.uniforms;
    const calm = hero.reducedMotion;
    const portrait = frameState.size.width / frameState.size.height < 0.9;
    s.frame++;

    // ---- one-shot gestures from the page (registration, easter egg, ...)
    while (live.events.length) {
      const ev = live.events.shift();
      if (ev.type === "shake") {
        s.shakeT = t;
        s.errorFlash = 1;
      } else if (ev.type === "nod") {
        s.nods.push(t, t + 0.42);
      } else if (ev.type === "burst") {
        if (!calm) live.embers.pending += ev.count || 160;
      } else if (ev.type === "ignite") {
        s.igniteUntil = t + (ev.hold || 2.6);
        s.eyeFlash = 1.2;
      } else if (ev.type === "scanloop") {
        s.sweeping = true;
      } else if (ev.type === "scanstop") {
        s.sweeping = false;
      }
    }

    // ---- scroll easing
    s.scroll = damp(s.scroll, live.scroll, 6, dt);
    const sc = smoothstep(0.02, 0.85, s.scroll);

    // ---- press and hold on the figure: charge, release = big shockwave
    const ch = live.charge;
    if (ch.active) {
      if (s.chargeStart < 0) {
        s.chargeStart = t;
        s.chargeValid = hero.introDone && !live.form.open && !!hitRest(ch.x, ch.y, s.chargeHit);
      }
      const goal = s.chargeValid && !calm ? clamp((t - s.chargeStart - 0.22) / 1.1, 0, 1) : 0;
      s.charge = Math.max(s.charge, goal);
    }
    if (ch.release) {
      ch.release = false;
      if (s.charge > 0.55) {
        pulseAt(u, s, t, s.chargeHit, 2.4);
        s.lightFlash = 1.1;
        live.embers.pending += 150;
        live.flash = 1.6;
        s.recoilPitch.v += 2.6; // head snaps up
        s.eyeFlash = 1.3;
        navigator.vibrate?.(45);
      } else if (!ch.cancel) {
        live.clicks.push({ x: ch.x, y: ch.y });
      }
      ch.cancel = false;
      s.chargeStart = -1;
      s.chargeValid = false;
    }
    if (!ch.active) s.charge = damp(s.charge, 0, 9, dt);

    // ---- where to look
    const look = lookTarget(hero, now, portrait);
    let engageTarget = look ? 1 : 0;
    if (!live.form.open) engageTarget *= 1 - smoothstep(0.04, 0.3, s.scroll);
    if (calm && !live.form.open) engageTarget *= 0.5;
    s.engage = damp(s.engage, engageTarget, engageTarget > s.engage ? 2.6 : 0.9, dt);

    if (look) gazePoint(look.x, look.y, target);
    const local = root.current.worldToLocal(_v.copy(target)).sub(s.headRest);
    const gYaw = clamp(Math.atan2(local.x, local.z), -LIMIT.yaw, LIMIT.yaw);
    const gPitch = clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), LIMIT.down, LIMIT.up);

    const idle = calm ? 0 : 1;
    const restYaw = lerp(REST.yaw, POSTER.yaw, sc) + wobble(t, 1.3) * 3 * DEG * idle;
    const restPitch = lerp(REST.pitch, POSTER.pitch, sc) + wobble(t * 0.8, 4.1) * 2 * DEG * idle;
    const yawGoal = lerp(restYaw, gYaw, s.engage);
    const pitchGoal = lerp(restPitch, gPitch, s.engage) - s.charge * 8 * DEG; // charging: head lowers

    const lambda = look ? look.l : 3.1;
    const prevYaw = s.yaw;
    s.yaw = damp(s.yaw, yawGoal, lambda, dt);
    s.pitch = damp(s.pitch, pitchGoal, lambda, dt);
    s.yawVel = damp(s.yawVel, (s.yaw - prevYaw) / Math.max(dt, 1e-4), 10, dt);
    const rollGoal = clamp(-s.yawVel * 0.09, -0.14, 0.14) + wobble(t * 0.6, 7.7) * 1.5 * DEG * idle;
    s.roll = damp(s.roll, rollGoal, 5, dt);

    // gestures layered on top: nods (spring impulses), error head-shake, typing tick, charge shiver
    while (s.nods.length && s.nods[0] <= t) {
      s.nods.shift();
      if (!calm) s.recoilPitch.v -= 2.3;
    }
    s.keyTick = Math.max(damp(s.keyTick, 0, 9, dt), live.form.keyTick);
    live.form.keyTick = 0;
    const st = t - s.shakeT;
    const shake = !calm && st < 1.1 ? Math.sin(st * 30) * 0.15 * Math.exp(-st * 4.2) : 0;
    const shiver = Math.sin(t * 47) * 0.006 * s.charge;
    const ry = spring(s.recoilYaw, 0, 70, 8.5, dt);
    const rp = spring(s.recoilPitch, 0, 70, 8.5, dt);

    // ---- pose the chain (rotations are composed in root space, see CHAIN shares)
    const yaw = s.yaw + ry + shake + shiver;
    const pitch = s.pitch + rp - s.keyTick * 0.6 * DEG;
    for (const b of s.chain) {
      _e.set(-pitch * b.sp, yaw * b.sy, s.roll * b.sp, "YXZ");
      _q.setFromEuler(_e);
      _q2.copy(b.restWorldInv).multiply(_q).multiply(b.restWorld);
      b.bone.quaternion.copy(b.restLocal).multiply(_q2);
    }
    // breathing: shoulders lift a touch
    const breath = idle * (0.5 + 0.5 * Math.sin(t * ((2 * Math.PI) / 4.6)));
    s.shoulders.forEach((b, i) => {
      _q.setFromAxisAngle(Z, (i === 0 ? 1 : -1) * breath * 1.1 * DEG);
      _q2.copy(b.restWorldInv).multiply(_q).multiply(b.restWorld);
      b.bone.quaternion.copy(b.restLocal).multiply(_q2);
    });
    root.current.updateMatrixWorld(true);

    // ---- eyes lead the head: aim each eyeball straight at the target
    const eyesOnTarget = s.engage > 0.05 && !!look;
    for (const e of s.eyeRigs) {
      // direction in the pivot's parent (head bone) space; at rest the eye keeps its own axis
      const dir = _v2.copy(e.fwd);
      if (eyesOnTarget) {
        e.pivot.getWorldPosition(_v);
        e.pivot.parent.getWorldQuaternion(_q2).invert();
        dir.copy(target).sub(_v).applyQuaternion(_q2).normalize();
        const ang = e.fwd.angleTo(dir);
        const maxA = 26 * DEG;
        if (ang > maxA) dir.lerpVectors(e.fwd, dir, maxA / ang).normalize();
      }
      e.q.setFromUnitVectors(e.fwd, dir);
      e.pivot.quaternion.slerp(e.q, 1 - Math.exp(-(eyesOnTarget ? 16 : 6) * dt));
    }

    // ---- interaction: hover scanner + click pulses
    const canHover =
      hero.introDone && live.pointer.inside && live.pointer.fine && s.scroll < 0.3 && !live.form.open && !ch.active;
    let hovering = false;
    if (canHover && s.frame % 2 === 0) {
      hovering = !!hitRest(live.pointer.x, live.pointer.y, hoverRest);
      if (hovering) u.uHoverPos.value.lerp(hoverRest, s.lastHover ? 0.55 : 1);
      if (hovering !== s.lastHover) {
        s.lastHover = hovering;
        hero.set({ bustHover: hovering });
      }
    } else if (!canHover && s.lastHover && !ch.active) {
      s.lastHover = false;
      hero.set({ bustHover: false });
    }
    s.heat = damp(s.heat, s.lastHover || s.charge > 0 ? 1 : 0, s.lastHover ? 5 : 2.5, dt);

    // hover light: a small warm light floating ~6 cm above the surface under the cursor, so the
    // cursor *lights* the sculpture (real shading of nose, lips, ears) instead of painting on it
    if (s.lastHover || ch.active) {
      _v.copy(lastHit.point).addScaledVector(lastHit.normal, 0.065);
      if (s.heat < 0.02 && s.lightFlash < 0.05) hoverLight.current.position.copy(_v);
      else hoverLight.current.position.lerp(_v, 1 - Math.exp(-12 * dt));
    }
    s.lightFlash = damp(s.lightFlash, 0, 4, dt);
    hoverLight.current.intensity = (s.heat * 0.055 * (1 + s.charge * 2.4) + s.lightFlash * 0.16) * live.intro.rim;
    hoverLight.current.color.copy(HOVER_WARM).lerp(HOVER_HOT, s.charge);
    live.chargeLevel = s.charge;

    while (live.clicks.length) {
      const c = live.clicks.shift();
      if (hero.introDone && !live.form.open && hitRest(c.x, c.y, clickRest)) {
        pulseAt(u, s, t, clickRest, 1);
        // a click briefly flares the light at the touched spot: the face is *lit*, not stamped
        s.lightFlash = 1;
        hoverLight.current.position.copy(lastHit.point).addScaledVector(lastHit.normal, 0.065);
        const dx = clickRest.x - s.headRest.x;
        const dy = clickRest.y - (BUST_CENTER_Y + 0.08);
        s.recoilYaw.v += -Math.sign(dx) * Math.min(Math.abs(dx) * 40, 1.6);
        s.recoilPitch.v += clamp(dy * 18, -1.2, 1.2);
        s.eyeFlash = 1;
        live.flash = 1;
      } else if (!live.form.open) {
        live.glance = { x: c.x, y: c.y, until: now + 1100 };
      }
    }

    // ---- head position for embers + screen-space rim direction (the cursor acts as a backlight)
    rig.bones.head.getWorldPosition(_v);
    _v.y += 0.05;
    Object.assign(live.embers.origin, { x: _v.x, y: _v.y, z: _v.z });
    live.embers.gather = s.charge;
    headNdc.copy(_v).project(camera);
    // idle: a backlight above and behind (rim strongest over the skull and nape, like the
    // reference); with a cursor it leans toward the cursor
    let rimBiasGoal = 0.3;
    let following = false;
    if (look) {
      const aspect = frameState.size.width / frameState.size.height;
      const dx = (look.x - headNdc.x) * aspect;
      const dy = look.y - headNdc.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.04) {
        s.rimDir.lerp(_ndc.set(dx / len, dy / len), 1 - Math.exp(-5 * dt)).normalize();
        rimBiasGoal = 0.75;
        following = true;
      }
    }
    if (!following) s.rimDir.lerp(_ndc.set(0, 1), 1 - Math.exp(-1.5 * dt)).normalize();
    s.rimBias = damp(s.rimBias, rimBiasGoal, 2.5, dt);
    u.uRimDir2D.value.copy(s.rimDir);
    u.uRimBias.value = s.rimBias;

    // ---- uniforms
    s.eyeFlash = damp(s.eyeFlash, 0, 2.4, dt);
    s.errorFlash = damp(s.errorFlash, 0, 2.2, dt);
    s.formRim = damp(s.formRim, live.form.open ? 0.15 + 0.6 * live.form.progress : 0, 3, dt);
    s.sweep = damp(s.sweep, s.sweeping ? 1 : 0, s.sweeping ? 6 : 3, dt);
    const privacy = live.form.open && live.form.privacy;
    let igniteGoal = Math.max(
      live.intro.ignite,
      hero.ctaHover ? 1 : 0,
      live.gaze.active && live.gaze.ignite ? 0.85 : 0,
      t < s.igniteUntil ? 1 : 0,
      s.eyeFlash,
      s.charge * 0.8
    );
    if (privacy) igniteGoal = 0;
    s.ignite = damp(s.ignite, igniteGoal, igniteGoal > s.ignite ? 6 : 2.2, dt);
    u.uTime.value = t;
    u.uScan.value = live.intro.scan;
    u.uSweep.value.set((t * 0.75) % 1, s.sweep);
    u.uHeat.value = s.heat;
    u.uIgnite.value = s.ignite * 0.75;
    const rim = live.intro.rim;
    // (no strobes or periodic pulses: anything that blinks the rim reads as flicker. An error
    // is one smooth swell of the rim, decaying with errorFlash, alongside the head shake.)
    const boost =
      1.0 + s.ignite * 0.6 + sc * 0.4 + s.formRim + s.keyTick * 0.12 + s.charge * 1.3 + live.flash * 0.4 + s.errorFlash * 0.6;
    u.uRimStrength.value = rim * boost * (privacy ? 0.75 : 1);
    // silhouette mask for the rim (SilhouetteMask.jsx); radii are in drawing-buffer pixels
    if (live.silhouette.texture) {
      u.uMask.value = live.silhouette.texture;
      u.uMaskReady.value = 1;
    }
    gl.getDrawingBufferSize(_ndc);
    u.uScreenInv.value.set(1 / _ndc.x, 1 / _ndc.y);
    // rim widths are physical (millimetres on the figure), so the line looks the same on a
    // phone, a laptop or a 4K screen: measure how many pixels 10 cm at the head covers
    rig.bones.head.getWorldPosition(_v);
    _v2.copy(_v).project(camera);
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    _v.addScaledVector(_camUp, 0.1).project(camera);
    const pxPerM = (Math.abs(_v.y - _v2.y) * 0.5 * _ndc.y) / 0.1;
    u.uRimPx.value.set(0.0012 * pxPerM, 0.0028 * pxPerM, 0.006 * pxPerM);
    u.uFeather.value = hero.tier === "low" ? 1 : 0; // only the tier without MSAA
    for (const m of rig.eyeMats) {
      m.userData.uniforms.uIgnite.value = s.ignite;
      m.userData.uniforms.uTime.value = t;
    }
    // eyes appear when the intro scan band passes them (eye height is about 73% of the scan range)
    // (also drawn in the last warm-up frames behind the loader: the GPU driver finishes some
    // shader work on an object's first draw, which would otherwise stall the intro mid-scan)
    const eyesShown = live.intro.scan > 0.735 || (compile.current.done && !hero.ready);
    if (rig.eyes[0].visible !== eyesShown) rig.eyes.forEach((e) => (e.visible = eyesShown));
  });

  return (
    <>
      <group ref={root} position={[0, -BUST_CENTER_Y, 0]} rotation={[0, BODY_YAW, 0]}>
        <primitive object={rig.scene} />
      </group>
      {/* hover light (world space, outside the rotated bust group) */}
      <pointLight ref={hoverLight} intensity={0} distance={0.4} decay={2} color={HOVER_WARM} />
    </>
  );
}

live.assetsRequested = true;
useLoader.preload(GLTFLoader, MODEL_URL, withMeshopt);
