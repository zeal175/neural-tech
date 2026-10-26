import * as THREE from "three";

// One photo card on the spiral. A unit plane (scaled to the card in the mesh), bent toward the
// cylinder, cover-cropped, rounded, and graded by how squarely it faces the camera: the back of
// the spiral reads as dim, desaturated ink, the front as the photo itself, the focused card gets
// an ember rim. Scroll speed sheers and bends the cards and splits the colour channels a touch.

const vertexShader = /* glsl */ `
  uniform float uWidth;
  uniform float uRadius;
  uniform float uBend;
  uniform float uVel;
  uniform float uLift;
  varying vec2 vUv;
  varying float vFacing;

  void main() {
    vUv = uv;
    vec3 p = position;
    float x = p.x * uWidth;
    float bend = clamp(uBend + abs(uVel) * 0.35, 0.0, 1.0);
    float a = x / uRadius;
    p.x = mix(x, sin(a) * uRadius, bend) / uWidth;
    p.z = -(1.0 - cos(a)) * uRadius * bend + uLift * 0.14;
    // shear along the spin, as if the card were dragged through the air
    p.y += p.x * uVel * 0.06;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 normal = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    vec3 centre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vFacing = dot(normal, normalize(cameraPosition - centre));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec2 uCover;
  uniform float uWidth;
  uniform float uFocus;
  uniform float uHover;
  uniform float uRgb;
  uniform float uReveal;
  uniform vec3 uInk;
  uniform vec3 uEmber;
  varying vec2 vUv;
  varying float vFacing;

  float roundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 size = vec2(uWidth, 1.0);
    float d = roundBox((vUv - 0.5) * size, size * 0.5, 0.045);
    float aa = fwidth(d);
    // uReveal fades the card in through coverage (alpha to coverage), so it never shows as a black block
    float alpha = (1.0 - smoothstep(-aa, aa, d)) * uReveal;
    if (alpha <= 0.0) discard;

    // seen from behind (the back of the spiral): keep the photo the right way round
    vec2 uv = vUv;
    if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
    vec2 c = (uv - 0.5) * uCover + 0.5;

    vec3 photo;
    photo.r = texture2D(uMap, c + vec2(uRgb, 0.0)).r;
    photo.g = texture2D(uMap, c).g;
    photo.b = texture2D(uMap, c - vec2(uRgb, 0.0)).b;

    // not loaded yet: a dark plate with a faint diagonal weave
    float weave = step(0.5, fract((vUv.x * uWidth + vUv.y) * 18.0)) * 0.012;
    vec3 plate = uInk * 1.9 + weave;
    vec3 col = mix(plate, photo, uHasMap);

    // the back strand sinks into the ink; the front stays the photo
    float face = smoothstep(-0.35, 0.85, vFacing);
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma) * vec3(1.0, 0.93, 0.88), col, mix(0.25, 1.0, face));
    col = mix(uInk, col, mix(0.16, 1.0, face));
    // everything but the focused card steps back a little
    col *= mix(0.7, 1.0, max(uFocus, uHover * 0.85));

    // ember rim: a hairline on every front card, lit up on the focused one
    float rim = smoothstep(-aa * 3.0, -aa * 0.6, d);
    float rimOn = (0.18 + 0.82 * max(uFocus, uHover)) * face;
    col = mix(col, uEmber * (1.0 + uFocus * 0.6), rim * rimOn);

    gl_FragColor = vec4(col * mix(0.4, 1.0, uReveal), alpha);
    #include <colorspace_fragment>
  }
`;

const blank = new THREE.DataTexture(new Uint8Array([14, 12, 11, 255]), 1, 1);
blank.colorSpace = THREE.SRGBColorSpace;
blank.needsUpdate = true;

export const INK = new THREE.Color("#070605");
export const EMBER = new THREE.Color("#f9725a");

export function createCardMaterial({ width, radius }) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    toneMapped: false,
    alphaToCoverage: true,
    uniforms: {
      uMap: { value: blank },
      uHasMap: { value: 0 },
      uCover: { value: new THREE.Vector2(1, 1) },
      uWidth: { value: width },
      uRadius: { value: radius },
      uBend: { value: 0.22 },
      uVel: { value: 0 },
      uLift: { value: 0 },
      uFocus: { value: 0 },
      uHover: { value: 0 },
      uRgb: { value: 0 },
      uReveal: { value: 0 },
      uInk: { value: INK },
      uEmber: { value: EMBER },
    },
  });
}

/** uv scale that crops the image to the card like object-fit: cover. */
export function coverScale(out, imageAspect, cardAspect) {
  if (imageAspect > cardAspect) out.set(cardAspect / imageAspect, 1);
  else out.set(1, imageAspect / cardAspect);
  return out;
}

export const blankTexture = blank;

/** Additive light on a transparent canvas: colour and alpha both add, premultiplied. */
export function addGlow(material) {
  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneFactor;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneFactor;
  material.premultipliedAlpha = true;
  return material;
}

// Soft ember glow behind the focused card (additive, no post-processing needed).
const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec2 uSize;
  uniform vec2 uCard;
  uniform float uStrength;
  uniform vec3 uEmber;
  varying vec2 vUv;

  float roundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    float d = roundBox((vUv - 0.5) * uSize, uCard * 0.5, 0.05);
    // fades to nothing before the quad's edge: the sRGB curve would lift a long tail into a box
    float reach = min(uSize.x - uCard.x, uSize.y - uCard.y) * 0.5;
    float g = exp(-max(d, 0.0) * 11.0) * smoothstep(-0.01, 0.01, d) * (1.0 - smoothstep(reach * 0.45, reach * 0.95, d));
    // premultiplied, encoded first: alpha builds up only where there is glow
    float a = g * uStrength;
    gl_FragColor = vec4(linearToOutputTexel(vec4(uEmber, 1.0)).rgb * a, a);
  }
`;

export function createGlowMaterial() {
  return addGlow(new THREE.ShaderMaterial({
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uSize: { value: new THREE.Vector2(2, 1.6) },
      uCard: { value: new THREE.Vector2(1.4, 1) },
      uStrength: { value: 0 },
      uEmber: { value: EMBER },
    },
  }));
}
