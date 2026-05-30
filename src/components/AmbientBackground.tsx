import { useEffect, useRef } from "react";

/**
 * The atmosphere behind the wall: a warm, candlelit paper field rendered on a
 * fullscreen WebGL quad. Slow drifting light pools (a sunbeam crossing a
 * gallery), faint dust motes catching the light, warm film grain, and a gentle
 * vignette. It parallaxes against the canvas pan and brightens toward the
 * cursor, and blooms warm when a note is signed.
 *
 * Strictly ambience: it sits *behind* the prints (the Pixi stage renders with a
 * transparent background) so the guests' words stay the brightest thing on
 * screen. Degrades to a static warm gradient with no WebGL, and freezes (one
 * still, beautiful frame) under prefers-reduced-motion.
 */
export function AmbientBackground({
  getCamera,
  flashSignal = 0,
  className = "",
}: {
  getCamera?: () => { x: number; y: number; scale: number } | undefined;
  flashSignal?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef(0); // wall-clock ms of the last flash, in raf time
  const flashSeen = useRef(flashSignal);

  // Bump the flash impulse when the signal changes (a note was signed).
  useEffect(() => {
    if (flashSignal !== flashSeen.current) {
      flashSeen.current = flashSignal;
      flashRef.current = -1; // sentinel: arm on next frame
    }
  }, [flashSignal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl", { antialias: false, alpha: false }) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    // No WebGL: leave the CSS fallback gradient (set on the element) in place.
    if (!gl) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const vsrc = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }`;

    const fsrc = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec2 u_pan;
      uniform vec2 u_pointer;
      uniform float u_flash;
      uniform float u_motion;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

      void main(){
        vec2 uv = v_uv;
        float asp = u_res.x / max(u_res.y, 1.0);
        vec2 p = vec2(uv.x * asp, uv.y);
        vec2 pan = u_pan / max(u_res.x, 1.0);
        float t = u_time;

        vec3 col = vec3(0.957, 0.937, 0.922); // warm paper
        vec3 warm = vec3(0.99, 0.86, 0.62);   // flash-gold light

        // Two large drifting light pools.
        vec2 l1 = vec2(0.32 * asp + 0.10 * sin(t * 0.05), 0.26 + 0.06 * cos(t * 0.04)) - pan * 0.04;
        vec2 l2 = vec2(0.74 * asp + 0.08 * cos(t * 0.037), 0.72 + 0.05 * sin(t * 0.045)) - pan * 0.06;
        col += smoothstep(0.95, 0.0, distance(p, l1)) * 0.055 * warm;
        col += smoothstep(1.10, 0.0, distance(p, l2)) * 0.045 * warm;

        // Dust motes drifting upward, catching the light.
        float dust = 0.0;
        for (int i = 0; i < 14; i++) {
          float fi = float(i);
          float spd = 0.010 + 0.020 * hash(vec2(fi, 3.0));
          float dx = hash(vec2(fi, 1.0)) * asp;
          float dy = fract(hash(vec2(fi, 2.0)) + t * spd);
          vec2 dp = vec2(dx, dy) - pan * (0.05 + 0.05 * hash(vec2(fi, 4.0)));
          dp.x = mod(dp.x, asp);
          dust += smoothstep(0.011, 0.0, distance(p, dp));
        }
        col += dust * warm * 0.45;

        // Pointer warms the paper where you reach.
        if (u_pointer.x >= 0.0) {
          vec2 pp = vec2(u_pointer.x * asp, u_pointer.y);
          col += smoothstep(0.42, 0.0, distance(p, pp)) * 0.028 * warm;
        }

        // Warm vignette.
        float vig = smoothstep(1.15, 0.35, distance(uv, vec2(0.5)));
        col *= mix(0.9, 1.0, vig);

        // Filmic grain (quantized so it reads as grain, not static).
        float gt = u_motion > 0.5 ? floor(t * 12.0) : 7.0;
        col += (hash(uv * u_res * 0.5 + gt) - 0.5) * 0.02;

        // The bulb fires: the whole room blooms warm.
        col = mix(col, vec3(1.0, 0.96, 0.86), u_flash * 0.55);

        gl_FragColor = vec4(col, 1.0);
      }`;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return; // keep fallback

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // One big triangle covering the screen.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uPan = gl.getUniformLocation(prog, "u_pan");
    const uPointer = gl.getUniformLocation(prog, "u_pointer");
    const uFlash = gl.getUniformLocation(prog, "u_flash");
    const uMotion = gl.getUniformLocation(prog, "u_motion");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pointer follow (in 0..1, y flipped to match gl uv).
    const pointer = { x: -1, y: -1 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / r.width;
      pointer.y = 1 - (e.clientY - r.top) / r.height;
    };
    const onLeave = () => {
      pointer.x = -1;
      pointer.y = -1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    let raf = 0;
    let start = 0;
    const FLASH_MS = 600;

    const draw = (now: number) => {
      if (!start) start = now;
      const t = (now - start) / 1000;

      if (flashRef.current === -1) flashRef.current = now; // arm
      let flash = 0;
      if (flashRef.current > 0) {
        const e = (now - flashRef.current) / FLASH_MS;
        flash = e >= 1 ? 0 : Math.pow(1 - e, 2); // ease-out decay
        if (e >= 1) flashRef.current = 0;
      }

      const cam = getCamera?.();
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, reduced ? 7.3 : t);
      gl.uniform2f(uPan, cam?.x ?? 0, cam?.y ?? 0);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.uniform1f(uFlash, flash);
      gl.uniform1f(uMotion, reduced ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Reduced motion: render one still frame, then idle until a flash fires.
      if (reduced && flash <= 0 && flashRef.current === 0) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    const startLoop = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    startLoop();

    // Pause when the tab is hidden; resume (and re-arm flashes) when visible.
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        start = 0;
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // Keep redrawing reduced-motion frames when a flash is armed.
    const flashPoke = setInterval(() => {
      if (reduced && flashRef.current === -1) startLoop();
    }, 200);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(flashPoke);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [getCamera]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={"absolute inset-0 h-full w-full " + className}
      // CSS fallback if WebGL is unavailable or fails to compile.
      style={{
        background:
          "radial-gradient(120% 80% at 30% 20%, #fbf3e6 0%, #f4efeb 55%, #efe7df 100%)",
      }}
    />
  );
}
