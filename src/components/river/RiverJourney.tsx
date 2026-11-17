import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { SiteHeader } from "./SiteHeader";
import type { RiverScene } from "./scene/RiverScene";
import { CAM_X0, CAM_X1 } from "./scene/world";

const SCROLL_VH = 900; // longueur du voyage en hauteur d'écran
const LOOK_AHEAD = 9; // la caméra vise un peu en avant

const POINTS = [
  {
    id: "maderotherapie",
    title: "Madérothérapie",
    text: "Le bois sculpte, draine et libère les tissus.",
  },
  { id: "kobido", title: "Kobido", text: "L'art japonais du massage du visage." },
  {
    id: "a-propos",
    title: "Enaloël Perriollat",
    text: "Masseuse fascialiste, diplômée en madérothérapie et Kobido",
    final: true,
  },
] as const;

export function RiverJourney() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const pointRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lenisRef = useRef<Lenis | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const low = window.innerWidth < 820 || (navigator.hardwareConcurrency ?? 8) <= 4;
    let scene: RiverScene | null = null;
    let raf = 0;
    let alive = true;

    const lenis = new Lenis({
      lerp: reduced ? 1 : 0.07,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.5,
      syncTouch: true,
      syncTouchLerp: 0.07,
    });
    lenisRef.current = lenis;

    // mode test : ?still → rendu image par image piloté par window.__still(p)
    const still = new URLSearchParams(location.search).has("still");
    let smoothP = 0;
    let lastActive: string | null = null;
    let last = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      lenis.raf(now);
      const el = scrollRef.current!;
      const max = el.offsetHeight - window.innerHeight;
      const target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      smoothP += (target - smoothP) * (reduced ? 1 : Math.min(1, dt * 7)); // amorti supplémentaire caméra
      barRef.current!.style.transform = `scaleX(${smoothP})`;
      hintRef.current!.classList.toggle("is-hidden", smoothP > 0.003);
      if (!scene || still) return;
      scene.setProgress(smoothP);
      scene.frame(reduced ? 0 : dt);

      const w = window.innerWidth,
        h = window.innerHeight;
      let current: string | null = null;
      scene.anchors.forEach((a) => {
        const node = pointRefs.current.get(a.id);
        if (!node) return;
        const s = scene!.project(a, w, h);
        const on = !!s && s.x > w * 0.1 && s.x < w * 0.9;
        node.classList.toggle("is-visible", on);
        if (s && a.id !== "contact")
          node.style.transform = `translate3d(${s.x}px, ${Math.max(s.y, (node.firstElementChild as HTMLElement).offsetHeight + 120)}px, 0)`;
        if (on && s && Math.abs(s.x - w / 2) < w * 0.3) current = a.id;
      });
      if (current !== lastActive) {
        lastActive = current;
        setActive(current);
      }
    };
    raf = requestAnimationFrame(loop);

    import("./scene/RiverScene")
      .then(async ({ RiverScene }) => {
        if (!alive) return;
        scene = new RiverScene(canvasRef.current!, { low });
        await scene.load((p) => alive && setLoading(p));
        if (alive) setReady(true);
        if (still) {
          (window as unknown as { __still: (p: number, t?: number) => void }).__still = (
            p,
            t = 4,
          ) => {
            scene!.setProgress(p);
            scene!.frame(t);
            const w = window.innerWidth,
              h = window.innerHeight;
            scene!.anchors.forEach((a) => {
              const node = pointRefs.current.get(a.id);
              const s = scene!.project(a, w, h);
              const on = !!s && s.x > w * 0.1 && s.x < w * 0.9;
              node?.classList.toggle("is-visible", on);
              if (node && s && a.id !== "contact")
                node.style.transform = `translate3d(${s.x}px, ${Math.max(s.y, (node.firstElementChild as HTMLElement).offsetHeight + 120)}px, 0)`;
            });
          };
        }
      })
      .catch((e) => {
        console.error(e);
        if (alive) setFailed(true);
      });

    const onResize = () => scene?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      lenis.destroy();
      scene?.dispose();
    };
  }, []);

  const goTo = (id: string) => {
    const lenis = lenisRef.current;
    const el = scrollRef.current;
    if (!lenis || !el) return;
    const max = el.offsetHeight - window.innerHeight;
    const xs: Record<string, number> = {
      maderotherapie: 238,
      kobido: 488,
      "a-propos": 792,
      contact: 905,
    };
    const p =
      id === "top"
        ? 0
        : Math.min(1, Math.max(0, ((xs[id] ?? 0) - LOOK_AHEAD - CAM_X0) / (CAM_X1 - CAM_X0)));
    lenis.scrollTo(p * max, { duration: 2.6, easing: (x) => 1 - Math.pow(1 - x, 4) });
  };

  const setPoint = (id: string) => (el: HTMLDivElement | null) => {
    if (el) pointRefs.current.set(id, el);
    else pointRefs.current.delete(id);
  };

  return (
    <div ref={scrollRef} style={{ position: "relative", height: `${SCROLL_VH}vh` }}>
      <div className="rj-stage">
        <canvas ref={canvasRef} className="rj-canvas" aria-hidden />
        <div className="rj-vignette" aria-hidden />

        {POINTS.map((p) => (
          <div
            key={p.id}
            ref={setPoint(p.id)}
            className={`rj-point ${"final" in p ? "is-final" : ""}`}
          >
            <div className="rj-bubble">
              {"final" in p ? (
                <>
                  <h2 className="rj-final-title">{p.title}</h2>
                  <p className="rj-final-text">{p.text}</p>
                </>
              ) : (
                <>
                  <h2 className="rj-bubble-title">{p.title}</h2>
                  <p className="rj-bubble-text">{p.text}</p>
                </>
              )}
            </div>
            <span className="rj-dot" />
          </div>
        ))}

        <div ref={setPoint("contact")} className="rj-contact" id="contact">
          <p className="rj-eyebrow">Prendre rendez-vous</p>
          <h2 className="rj-contact-title">Offrez une pause à votre corps</h2>
          <ul className="rj-contact-list">
            <li>
              <span>Téléphone</span>à compléter
            </li>
            <li>
              <span>E-mail</span>à compléter
            </li>
            <li>
              <span>Cabinet</span>à compléter
            </li>
            <li>
              <span>Tarifs</span>sur demande
            </li>
          </ul>
        </div>

        <SiteHeader active={active} onNavigate={goTo} />

        <div ref={hintRef} className="rj-hint">
          <span>Scrollez pour descendre la rivière</span>
          <span className="rj-hint-line" />
        </div>
        <div className="rj-progress">
          <div ref={barRef} className="rj-progress-bar" />
        </div>

        <div className={`rj-loader ${ready ? "is-done" : ""}`} aria-hidden={ready}>
          <p className="rj-loader-name">Enaloël Perriollat</p>
          <div className="rj-loader-bar">
            <div style={{ transform: `scaleX(${loading})` }} />
          </div>
          <p className="rj-loader-text">
            {failed
              ? "Votre navigateur ne peut pas afficher la rivière en 3D."
              : "La rivière se dessine…"}
          </p>
        </div>
      </div>
    </div>
  );
}
