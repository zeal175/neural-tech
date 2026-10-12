import * as THREE from "three";

export const EMBER = new THREE.Color("#ff6a45");
export const PULSES = 3;

/**
 * Satin-matte black with a navy undertone (the poster's reference figure), built on
 * MeshPhysicalMaterial. The look comes from soft broad highlights plus a thin, hot red rim that
 * traces the silhouette (shader term, steerable toward the cursor) - not from reflections.
 *
 * Effects are evaluated in rest (bind-pose) space, in metres, so they stay glued to the
 * surface while the head turns. `position` arrives quantised (meshopt), so the vertex stage
 * dequantises it with uDQScale / uDQOffset (measured on load).
 */
export function createBustMaterial({ normalMap, ormMap, dataMap, detailMap }) {
  const uniforms = {
    uTime: { value: 0 },
    uDQScale: { value: new THREE.Vector3(1, 1, 1) },
    uDQOffset: { value: new THREE.Vector3() },
    uDataMap: { value: dataMap },
    uDetailMap: { value: detailMap },
    uDetailScale: { value: 9.0 },
    uDetailStrength: { value: 0.12 },
    uRimColor: { value: new THREE.Color("#ff3b1f") },
    uRimStrength: { value: 0 },
    uRimDir2D: { value: new THREE.Vector2(0, 1) }, // screen-space side the rim leans toward
    uRimBias: { value: 0 }, // 0 = even rim all round (reference), 1 = concentrated toward uRimDir2D
    // silhouette rim (SilhouetteMask.jsx): mask texture, 1/drawing-buffer size, sample radii (px)
    uMask: { value: null },
    uMaskReady: { value: 0 },
    uFeather: { value: 0 }, // 1 on tiers without MSAA: antialias the outer edge with the mask
    uScreenInv: { value: new THREE.Vector2(1, 1) },
    uRimPx: { value: new THREE.Vector3(2.2, 6.5, 16) },
    uEmber: { value: EMBER.clone() },
    uIgnite: { value: 0 },
    uScan: { value: 0 },
    uScanRange: { value: new THREE.Vector2(1.2, 1.69) }, // cut -> top of the (stretched) skull
    uSweep: { value: new THREE.Vector2(0, 0) }, // x = band position 0..1, y = intensity (no reveal)
    // torso cut is tilted (front higher than back, 01_bust.py CUT_FRONT/CUT_BACK):
    // cut height = x + (z - y) * z  in rest space; fade from uFade.x to uFade.y above it
    uCut: { value: new THREE.Vector3(1.285, 0.12, 0.318) },
    uFade: { value: new THREE.Vector2(0.006, 0.1) },
    // arm cut (see blender/scripts/01_bust.py ARM_TOP/ARM_LOW): fade out the last few cm
    uArmA: { value: new THREE.Vector2(0.2, 1.375) },
    uArmN: { value: new THREE.Vector2(-0.9418, 0.3349) },
    uHoverPos: { value: new THREE.Vector3(0, 10, 0) },
    uHeat: { value: 0 },
    uPulsePos: { value: Array.from({ length: PULSES }, () => new THREE.Vector3(0, 10, 0)) },
    uPulseTime: { value: new Array(PULSES).fill(-100) },
    uPulseScale: { value: new Array(PULSES).fill(1) }, // 1 = click, ~2.4 = charged release
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#0b0e15"),
    roughness: 0.85, // x satin roughness map (~0.38-0.6): soft, but the studio highlights still read
    metalness: 0,
    roughnessMap: ormMap,
    aoMap: ormMap,
    aoMapIntensity: 1,
    normalMap,
    normalScale: new THREE.Vector2(1, 1),
    sheen: 0.2,
    sheenColor: new THREE.Color("#27324c"),
    sheenRoughness: 0.55,
    ior: 1.45,
    specularIntensity: 0.8,
    envMapIntensity: 1.0,
    dithering: true, // smooth dark gradients without banding
    transparent: true, // alpha drives the scan reveal + bottom fade
  });
  mat.userData.uniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uDQScale;
        uniform vec3 uDQOffset;
        varying vec3 vRest;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vRest = position * uDQScale + uDQOffset;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vRest;
        uniform float uTime;
        uniform sampler2D uDataMap;
        uniform sampler2D uDetailMap;
        uniform float uDetailScale;
        uniform float uDetailStrength;
        uniform vec3 uRimColor;
        uniform float uRimStrength;
        uniform vec2 uRimDir2D;
        uniform float uRimBias;
        uniform sampler2D uMask;
        uniform float uMaskReady;
        uniform float uFeather;
        uniform vec2 uScreenInv;
        uniform vec3 uRimPx;
        uniform vec3 uEmber;
        uniform float uIgnite;
        uniform float uScan;
        uniform vec2 uScanRange;
        uniform vec2 uSweep;
        uniform vec2 uFade;
        uniform vec3 uCut;
        uniform vec2 uArmA;
        uniform vec2 uArmN;
        uniform vec3 uHoverPos;
        uniform float uHeat;
        uniform vec3 uPulsePos[${PULSES}];
        uniform float uPulseTime[${PULSES}];
        uniform float uPulseScale[${PULSES}];
        // pow(x, 2.0) is undefined for x < 0 (NaN on D3D/ANGLE): always square explicitly
        float sq( float x ) { return x * x; }`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#ifdef USE_NORMALMAP_TANGENTSPACE
          vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          vec3 detN = texture2D( uDetailMap, vNormalMapUv * uDetailScale ).xyz * 2.0 - 1.0;
          mapN = normalize( vec3( mapN.xy + detN.xy * uDetailStrength, mapN.z ) );
          normal = normalize( tbn * mapN );
        #else
          #include <normal_fragment_maps>
        #endif`
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          vec4 dataS = texture2D( uDataMap, vNormalMapUv ); // r curvature, g thickness, b cavity

          // grazing factor from the smooth geometric normal only (never the normal map)
          float edge = 1.0 - saturate( dot( nonPerturbedNormal, geometryViewDir ) );

          // Where is the OUTER outline? Sample the silhouette mask around this pixel: the share
          // of samples that land outside the figure. Inner folds (ears, nostrils, eyelids) are
          // inside the mask, so they never count as outline; the multisampled mask is smooth.
          vec2 suv = gl_FragCoord.xy * uScreenInv;
          float core = 0.0; // within ~1.2 mm of the contour
          float near = 0.0; // within ~6 mm: the zone where wrap-around light may appear
          float wsum = 0.0;
          // 16 directions, the core measured at two radii (rotated half a step apart): as the
          // head drifts by sub-pixel amounts the result changes gradually, not in steps, so the
          // thin line doesn't crawl or shimmer
          // cheap early-out: pixels well inside the figure (most of the face) skip the loop
          vec2 rq = uScreenInv * uRimPx.z * 1.05;
          float probe = texture2D( uMask, suv + vec2( rq.x, 0.0 ) ).a * texture2D( uMask, suv - vec2( rq.x, 0.0 ) ).a
                      * texture2D( uMask, suv + vec2( 0.0, rq.y ) ).a * texture2D( uMask, suv - vec2( 0.0, rq.y ) ).a
                      * texture2D( uMask, suv + rq * 0.7071 ).a * texture2D( uMask, suv - rq * 0.7071 ).a
                      * texture2D( uMask, suv + vec2( rq.x, -rq.y ) * 0.7071 ).a * texture2D( uMask, suv + vec2( -rq.x, rq.y ) * 0.7071 ).a;
          bool nearEdge = probe < 0.999;
          for ( int i = 0; i < 16; i++ ) {
            if ( !nearEdge ) break;
            float a = float( i ) * 0.3926991; // 2*pi / 16
            vec2 d = vec2( cos( a ), sin( a ) );
            vec2 d2 = vec2( cos( a + 0.19635 ), sin( a + 0.19635 ) );
            // the cursor acts as a backlight: edges facing it glow more (never fully off)
            float w = mix( 1.0, 0.25 + 1.5 * max( dot( d, uRimDir2D ), 0.0 ), uRimBias );
            core += ( 2.0 - texture2D( uMask, suv + d * uScreenInv * uRimPx.x ).a
                          - texture2D( uMask, suv + d2 * uScreenInv * uRimPx.x * 0.55 ).a ) * 0.5 * w;
            near += ( 1.0 - texture2D( uMask, suv + d * uScreenInv * uRimPx.z ).a ) * w;
            wsum += w;
          }
          // at an edge half the samples are outside: map 0..0.5 to 0..1
          wsum = max( wsum, 1e-4 );
          float c = saturate( core / wsum * 2.0 );
          float g = saturate( near / wsum * 2.0 );
          // Two parts, like real backlight on a curved form:
          // 1) a crisp thin line exactly at the contour;
          // 2) light wrapping round the curve, from the smooth geometric normal - wide where the
          //    form turns away slowly (top of the skull, nape), thin where it turns sharply -
          //    allowed only near the OUTER outline (g), so ear folds / nostrils never catch it.
          vec2 side2 = nonPerturbedNormal.xy / max( length( nonPerturbedNormal.xy ), 1e-4 );
          float lean = mix( 1.0, 0.25 + 1.5 * max( dot( side2, uRimDir2D ), 0.0 ), uRimBias );
          // high power: only truly grazing surface catches it, so it tapers off quickly inward;
          // the outline gate fades in smoothly (g) instead of cutting, so there is no band edge
          float wrap = pow( edge, 9.0 ) * g * g * lean;
          // kept below the tone mapper's white-out point: stays a saturated red-orange, not pink
          float rimLine = c * c * ( 3.0 - 2.0 * c ) * 1.2 + wrap * 1.1; // smooth, not steep
          // the mask's own (multisampled) coverage here: only on tiers without MSAA it feathers
          // the outer edge pixel (uFeather = 1); elsewhere the edge stays fully opaque and crisp
          float maskHere = mix( 1.0, texture2D( uMask, suv ).a, uMaskReady * uFeather );
          vec3 fx = uRimColor * rimLine * uRimStrength * uMaskReady;

          // ignite: ember light pooling in the crevices
          float crevice = pow( saturate( 1.0 - dataS.b ), 1.6 );
          fx += uEmber * crevice * uIgnite * 1.6;

          // hover: the real point light (Bust.jsx) does the shading; this only adds a faint warmth
          // right under it, as if the surface were heating up
          float dh = length( vRest - uHoverPos );
          fx += uRimColor * uHeat * exp( -dh * dh / 0.00018 ) * 0.06;

          // click pulses: shockwave rings travelling through the surface
          float pulse = 0.0;
          for ( int i = 0; i < ${PULSES}; i++ ) {
            float t = uTime - uPulseTime[ i ];
            if ( t < 0.0 || t > 2.6 ) continue;
            float k = uPulseScale[ i ];
            float d = length( vRest - uPulsePos[ i ] );
            float r = t * 0.3 * k;
            float w = ( 0.0018 + t * 0.004 ) * k; // a thin line of light, not a band
            // fades in over 60 ms and dies out smoothly: no hard pop
            float env = smoothstep( 0.0, 0.06, t ) * exp( -t * 2.2 / k );
            pulse += exp( -sq( ( d - r ) / w ) ) * env * 1.2;
          }
          // the wave mostly travels along the silhouette (where the rim lives); on surfaces facing
          // the viewer it is only a whisper, so it never stamps a circle across the face
          fx += uRimColor * pulse * mix( 0.12, 1.0, smoothstep( 0.25, 0.75, edge ) );

          // intro scan: reveal from the cut upward, glowing band + holographic ghost lines
          float ys = mix( uScanRange.x, uScanRange.y, uScan );
          float scanning = step( 0.0005, uScan ) * ( 1.0 - smoothstep( 0.97, 1.0, uScan ) );
          float revealed = 1.0 - smoothstep( ys - 0.0025, ys + 0.0025, vRest.y );
          float band = exp( -sq( ( vRest.y - ys ) / 0.0035 ) ) * scanning;
          float ghost = step( 0.86, fract( vRest.y * 240.0 ) ) * ( 1.0 - revealed ) * scanning
                      * ( 1.0 - smoothstep( ys, ys + 0.12, vRest.y ) ) * 0.35;

          // sweep: a scan line over the fully revealed bust (registration "processing")
          float yw = mix( uScanRange.x, uScanRange.y, uSweep.x );
          float sweep = exp( -sq( ( vRest.y - yw ) / 0.004 ) );
          float trail = step( 0.86, fract( vRest.y * 240.0 ) ) * smoothstep( yw - 0.06, yw, vRest.y )
                      * step( vRest.y, yw ) * 0.3;
          fx += uEmber * ( sweep * 3.0 + trail ) * uSweep.y;

          float cutY = uCut.x + ( vRest.z - uCut.y ) * uCut.z;
          float fade = smoothstep( uFade.x, uFade.y, vRest.y - cutY );
          float armDist = dot( vec2( abs( vRest.x ), vRest.y ) - uArmA, uArmN );
          fade *= smoothstep( 0.0, 0.04, armDist );
          outgoingLight = ( outgoingLight + fx ) * revealed + uEmber * ( band * 4.0 + ghost );
          diffuseColor.a = max( revealed, max( band, ghost ) ) * fade * smoothstep( 0.0, 0.5, maskHere );
        }
        #include <opaque_fragment>`
      );
  };
  mat.customProgramCacheKey = () => "enclave-bust-v6";
  return mat;
}

/** Matte eyeball (reads as sculpture at rest) with an iris that ignites (ring + radial fibres). */
export function createEyeMaterial() {
  const uniforms = {
    uEyeCenter: { value: new THREE.Vector3() },
    uEmber: { value: EMBER.clone() },
    uIgnite: { value: 0 },
    uTime: { value: 0 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#0c1018"),
    roughness: 0.3, // a touch glossier than the skin: catches light, never reads as a hole
    metalness: 0,
    sheen: 0.25,
    sheenColor: new THREE.Color("#27324c"),
    sheenRoughness: 0.5,
    specularIntensity: 0.85,
    envMapIntensity: 1.0,
    dithering: true,
  });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vEyeLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvEyeLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vEyeLocal;
        uniform vec3 uEyeCenter;
        uniform vec3 uEmber;
        uniform float uIgnite;
        uniform float uTime;
        float sq( float x ) { return x * x; }`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 p = normalize( vEyeLocal - uEyeCenter );
          float c = p.z;
          float iris = smoothstep( 0.80, 0.86, c ) * ( 1.0 - smoothstep( 0.965, 0.975, c ) );
          float fibres = 0.55 + 0.45 * sin( atan( p.y, p.x ) * 46.0 + sin( uTime * 0.7 ) );
          float limbus = exp( -sq( ( c - 0.83 ) / 0.012 ) );
          totalEmissiveRadiance += uEmber * uIgnite * ( iris * fibres * 2.2 + limbus * 3.0 );
        }`
      );
  };
  mat.customProgramCacheKey = () => "enclave-eye-v2";
  return mat;
}
