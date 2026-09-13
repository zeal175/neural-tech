"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type EffectMode = "dark" | "light";

export type HalftoneFlowProps = {
  mode?: EffectMode;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

const VS = `
attribute vec4 aVertexPosition;
void main() {
  gl_Position = aVertexPosition;
}
`;

const FS = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_light;

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  vec2 flow_uv = p;
  float time = u_time * 0.4;

  for (int i = 1; i < 4; i++) {
    float fi = float(i);
    flow_uv *= rot(time * 0.1);
    flow_uv.x += sin(flow_uv.y * 2.0 * fi + time) * 0.5;
    flow_uv.y += cos(flow_uv.x * 1.5 * fi - time * 0.8) * 0.5;
  }

  float intensity = sin(flow_uv.x * 2.0 + flow_uv.y * 3.0) * 0.5 + 0.5;

  vec3 col_dark = mix(vec3(0.0), vec3(0.255, 0.200, 0.200), u_light);
  vec3 col_mid = mix(vec3(0.16, 0.12, 0.12), vec3(0.12, 0.09, 0.09), u_light);
  vec3 col_bright = mix(vec3(0.255, 0.200, 0.200), vec3(0.0), u_light);

  vec3 fluid_color = mix(col_dark, col_mid, smoothstep(0.2, 0.6, intensity));
  fluid_color = mix(fluid_color, col_bright, smoothstep(0.7, 1.0, intensity));

  float gridSize = 6.0;
  vec2 cell_uv = fract(gl_FragCoord.xy / gridSize) - 0.5;
  float dist = length(cell_uv);
  float radius = intensity * 0.45;
  float dot_mask = smoothstep(radius, radius - 0.1, dist);

  vec3 final_color = mix(col_dark, fluid_color, dot_mask);
  final_color += fluid_color * 0.15;

  gl_FragColor = vec4(final_color, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function HalftoneFlow({
  mode = "dark",
  hue = 0,
  saturation = 1,
  brightness = 1,
  className,
  style,
}: HalftoneFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const safeMode: EffectMode = mode === "light" ? "light" : "dark";
  const safeHue = clamp(hue, -180, 180);
  const safeSaturation = clamp(saturation, 0, 2);
  const safeBrightness = clamp(brightness, 0.35, 1.65);
  const filter =
    safeHue === 0 && safeSaturation === 1 && safeBrightness === 1
      ? undefined
      : `hue-rotate(${safeHue}deg) saturate(${safeSaturation}) brightness(${safeBrightness})`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return undefined;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VS);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FS);
    if (!vertexShader || !fragmentShader) return undefined;

    const program = gl.createProgram();
    if (!program) return undefined;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
    gl.useProgram(program);

    const positions = new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "aVertexPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const lightLocation = gl.getUniformLocation(program, "u_light");

    let frame = 0;
    let running = false;
    const start = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (!running) draw(performance.now());
    };

    const draw = (now: number) => {
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, (now - start) / 1000);
      gl.uniform1f(lightLocation, safeMode === "light" ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      frame = window.requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (running || reduce) return;
      running = true;
      frame = window.requestAnimationFrame(loop);
    };

    const stopLoop = () => {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
    };

    resize();
    draw(performance.now());
    startLoop();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) startLoop();
        else stopLoop();
      },
      { rootMargin: "80px" },
    );
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement || canvas);
    window.addEventListener("resize", resize);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      stopLoop();
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [safeMode]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-mode={safeMode}
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: 0,
        pointerEvents: "none",
        background: safeMode === "light" ? "#413333" : "#000000",
        filter,
        ...style,
      }}
    />
  );
}

export default HalftoneFlow;
export { HalftoneFlow };
