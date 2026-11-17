import { useEffect, useRef } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { vert, frag } from "./shader";

const W = 6; // journey length in viewport widths
const POINTS = [
  { x: 1.4, title: "Madérothérapie", final: false },
  { x: 3.4, title: "Kobido", final: false },
  { x: 5.5, title: "Enaoël Perriollat", sub: "Masseuse fascialiste, diplômée en madérothérapie et Kobido", final: true },
];

function rand(seed: number) {
  const x = Math.sin(seed * 9301.17) * 43758.5453;
  return x - Math.floor(x);
}

const FISH = Array.from({ length: 12 }, (_, i) => ({
  x: rand(i + 1) * W,
  y: 0.32 + rand(i + 50) * 0.42,
  speed: (rand(i + 9) > 0.35 ? 1 : -1) * (0.02 + rand(i + 3) * 0.03),
  size: 22 + rand(i + 7) * 26,
  phase: rand(i + 11) * 6.28,
}));
const LEAVES = Array.from({ length: 10 }, (_, i) => ({
  x: rand(i + 101) * W, y: 0.3 + rand(i + 131) * 0.45, rot: rand(i + 77) * 360,
}));

function Fish({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 60 24" width={size} height={size * 0.4} className="fish-svg">
      <path d="M4 12 C14 2 34 2 46 12 C34 22 14 22 4 12 Z" fill="currentColor" />
      <path className="fish-tail" d="M44 12 L58 3 L55 12 L58 21 Z" fill="currentColor" />
    </svg>
  );
}

function Hills() {
  const segs = 14;
  let d = "M0 100 ";
  for (let i = 0; i <= segs; i++) d += `L${(i / segs) * 1000} ${40 + rand(i + 300) * 35} `;
  let d2 = "M0 100 ";
  for (let i = 0; i <= segs * 2; i++) d2 += `L${(i / (segs * 2)) * 1000} ${60 + rand(i + 500) * 25} `;
  return (
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="h-full w-full">
      <path d={d + "L1000 100 Z"} className="fill-hill-far" />
      <path d={d2 + "L1000 100 Z"} className="fill-hill-near" />
      {Array.from({ length: 70 }, (_, i) => {
        const x = rand(i + 900) * 1000, h = 10 + rand(i + 950) * 14;
        return <ellipse key={i} cx={x} cy={88 - h / 2} rx={2.2 + rand(i) * 1.5} ry={h / 2} className="fill-tree" />;
      })}
    </svg>
  );
}

function Foreground() {
  return (
    <>
      {Array.from({ length: 40 }, (_, i) => {
        const left = rand(i + 700) * 100;
        const kind = rand(i + 710);
        if (kind < 0.45)
          return (
            <svg key={i} className="reed absolute bottom-0" style={{ left: `${left}%`, height: `${18 + rand(i) * 14}vh`, animationDelay: `${-rand(i + 3) * 4}s` }} viewBox="0 0 40 200" preserveAspectRatio="xMidYMax meet">
              {[0, 1, 2, 3].map((k) => (
                <path key={k} d={`M${20 + k * 3 - 4} 200 Q${14 + k * 6} 100 ${8 + k * 9} ${10 + k * 12}`} className="stroke-reed" strokeWidth="2.5" fill="none" />
              ))}
              <ellipse cx="11" cy="40" rx="3" ry="14" className="fill-cattail" />
            </svg>
          );
        return (
          <div key={i} className="stone absolute" style={{ left: `${left}%`, bottom: `${rand(i + 40) * 6}vh`, width: `${4 + rand(i + 20) * 6}vw`, height: `${2.5 + rand(i + 30) * 3}vw` }} />
        );
      })}
    </>
  );
}

export function RiverJourney() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const fishRefs = useRef<(HTMLDivElement | null)[]>([]);
  const leafRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pointRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || window.innerWidth < 768;

    // ---- WebGL water
    const canvas = canvasRef.current!;
    const gl = canvas.getContext("webgl", { antialias: false, powerPreference: "high-performance" });
    let uRes: WebGLUniformLocation | null = null, uTime: WebGLUniformLocation | null = null, uOff: WebGLUniformLocation | null = null;
    const quality = lowPower ? 0.5 : 1;
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2) * quality;
    if (gl) {
      const sh = (t: number, s: string) => { const o = gl.createShader(t)!; gl.shaderSource(o, s); gl.compileShader(o); return o; };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uRes = gl.getUniformLocation(prog, "uRes"); uTime = gl.getUniformLocation(prog, "uTime"); uOff = gl.getUniformLocation(prog, "uOffset");
    }
    const resize = () => {
      const r = dpr();
      canvas.width = Math.round(canvas.clientWidth * r);
      canvas.height = Math.round(canvas.clientHeight * r);
      gl?.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- Smooth scroll
    const lenis = reduced ? null : new Lenis({ lerp: 0.08, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.08 });
    lenis?.on("scroll", ScrollTrigger.update);
    let progress = 0;
    const st = ScrollTrigger.create({
      trigger: scrollRef.current!, start: "top top", end: "bottom bottom",
      onUpdate: (s) => { progress = s.progress; },
    });

    let last = performance.now(), time = 0;
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!reduced) time += dt;
      lenis?.raf(now);
      const vw = window.innerWidth, vh = window.innerHeight;
      const cam = progress * (W - 1) * vw;
      farRef.current!.style.transform = `translate3d(${-cam * 0.25}px,0,0)`;
      worldRef.current!.style.transform = `translate3d(${-cam}px,0,0)`;
      fgRef.current!.style.transform = `translate3d(${-cam * 1.35}px,0,0)`;
      barRef.current!.style.transform = `scaleX(${progress})`;
      hintRef.current!.classList.toggle("is-hidden", progress > 0.005);

      FISH.forEach((f, i) => {
        const el = fishRefs.current[i]; if (!el) return;
        if (!reduced) { f.x += f.speed * dt; if (f.x > W) f.x -= W; if (f.x < 0) f.x += W; }
        const wob = Math.sin(time * 1.6 + f.phase);
        const y = (f.y + wob * 0.012) * vh;
        el.style.transform = `translate3d(${f.x * vw}px,${y}px,0) scaleX(${f.speed > 0 ? -1 : 1}) rotate(${wob * 4}deg)`;
      });
      LEAVES.forEach((l, i) => {
        const el = leafRefs.current[i]; if (!el) return;
        if (!reduced) { l.x += 0.018 * dt; l.rot += 6 * dt; if (l.x > W) l.x -= W; }
        el.style.transform = `translate3d(${l.x * vw}px,${(l.y + Math.sin(time + i) * 0.006) * vh}px,0) rotate(${l.rot}deg)`;
      });
      POINTS.forEach((pt, i) => {
        const el = pointRefs.current[i]; if (!el) return;
        const sx = (pt.x * vw - cam) / vw;
        el.classList.toggle("is-visible", sx > 0.12 && sx < 0.88);
      });

      if (gl) {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, reduced ? 3 : time);
        gl.uniform1f(uOff, cam / vh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    canvasRef.current!.parentElement!.dataset.sceneReady = "true";

    return () => {
      gsap.ticker.remove(tick); st.kill(); lenis?.destroy();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div ref={scrollRef} style={{ height: `${W * 100}vh` }} className="relative">
      <div className="stage fixed inset-0 overflow-hidden">
        {/* water band */}
        <canvas ref={canvasRef} className="absolute inset-x-0 top-[24%] h-[62%] w-full" aria-hidden />
        {/* sky + hills */}
        <div className="sky absolute inset-x-0 top-0 h-[26%]" />
        <div ref={farRef} className="layer absolute left-0 top-0 h-[26%]" style={{ width: `${(W * 0.25 + 1) * 100}vw` }}>
          <Hills />
        </div>
        {/* world layer: banks, fish, leaves, points */}
        <div ref={worldRef} className="layer absolute inset-y-0 left-0" style={{ width: `${W * 100}vw` }}>
          {FISH.map((f, i) => (
            <div key={i} ref={(el) => { fishRefs.current[i] = el; }} className="fish absolute left-0 top-0"><Fish size={f.size} /></div>
          ))}
          <div className="bank-far absolute inset-x-0 top-[21%] h-[6%]" />
          <div className="bank-near absolute inset-x-0 bottom-0 h-[16%]" />
          {LEAVES.map((_, i) => (
            <div key={i} ref={(el) => { leafRefs.current[i] = el; }} className="leaf absolute left-0 top-0" />
          ))}
          {POINTS.map((pt, i) => (
            <div key={i} ref={(el) => { pointRefs.current[i] = el; }} className={`point absolute ${pt.final ? "point-final" : ""}`} style={{ left: `${pt.x * 100}vw`, top: pt.final ? "52%" : i % 2 ? "62%" : "48%" }}>
              <div className="bubble">
                {pt.final ? (
                  <>
                    <h2 className="font-display text-4xl md:text-6xl">{pt.title}</h2>
                    <p className="mt-3 font-sans text-sm tracking-wide md:text-base">{pt.sub}</p>
                  </>
                ) : (
                  <h2 className="font-display text-3xl md:text-4xl">{pt.title}</h2>
                )}
              </div>
              <span className="dot" />
            </div>
          ))}
        </div>
        <div ref={fgRef} className="layer pointer-events-none absolute bottom-0 left-0 h-[30%]" style={{ width: `${(W * 1.35 + 1) * 100}vw` }}>
          <Foreground />
        </div>

        {/* UI overlay */}
        <div className="ui-name fixed left-6 top-5 font-display text-lg md:left-10 md:top-7 md:text-xl">Enaoël Perriollat</div>
        <div ref={hintRef} className="hint fixed bottom-14 left-1/2 -translate-x-1/2 text-center font-sans text-xs uppercase tracking-[0.25em]">
          Scroll pour descendre la rivière
          <div className="hint-arrow mx-auto mt-3">→</div>
        </div>
        <div className="progress-track fixed bottom-6 left-1/2 h-px w-[60vw] -translate-x-1/2 md:w-[40vw]">
          <div ref={barRef} className="progress-bar h-full w-full origin-left" />
        </div>
      </div>
    </div>
  );
}
