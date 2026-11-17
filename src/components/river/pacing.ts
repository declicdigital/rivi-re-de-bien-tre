// Rythme du voyage : la caméra ralentit autour de chaque étape (bulle),
// puis repart. Le scroll « coûte » plus cher près des étapes.

import { CAM_X0, CAM_X1 } from "./scene/world";

/** abscisses caméra des étapes (repère - visée en avant de la caméra) */
export const LOOK_AHEAD = 9;
export const STOPS: Record<string, number> = {
  maderotherapie: 238 - LOOK_AHEAD,
  kobido: 488 - LOOK_AHEAD,
  "a-propos": 792 - LOOK_AHEAD,
  contact: 905 - LOOK_AHEAD,
};

const SLOW = 7; // près d'une étape, la caméra avance ~8 fois moins vite
const WIDTH = 26; // largeur de la zone de ralentissement (unités monde)
const N = 1024;

// table cumulée : scroll (0→1) en fonction de la position caméra (0→1)
const table = (() => {
  const xs = Object.values(STOPS);
  const cum = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const x = CAM_X0 + ((i - 0.5) / N) * (CAM_X1 - CAM_X0);
    let d = 1;
    for (const s of xs) d += SLOW * Math.exp(-(((x - s) / WIDTH) ** 2));
    cum[i] = (cum[i - 1] ?? 0) + d;
  }
  const total = cum[N] ?? 1;
  for (let i = 0; i <= N; i++) cum[i] = (cum[i] ?? 0) / total;
  return cum;
})();

/** position caméra (0→1) → position de scroll (0→1) */
export function camToScroll(c: number) {
  const f = Math.min(1, Math.max(0, c)) * N;
  const i = Math.floor(f);
  const a = table[i] ?? 1,
    b = table[Math.min(N, i + 1)] ?? 1;
  return a + (b - a) * (f - i);
}

/** position de scroll (0→1) → position caméra (0→1) */
export function scrollToCam(s: number) {
  s = Math.min(1, Math.max(0, s));
  let lo = 0,
    hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((table[mid] ?? 1) < s) lo = mid;
    else hi = mid;
  }
  const a = table[lo] ?? 0,
    b = table[hi] ?? 1;
  const t = b > a ? (s - a) / (b - a) : 0;
  return (lo + t) / N;
}

/** position de scroll (0→1) pour amener la caméra sur une étape */
export function scrollForStop(id: string) {
  if (id === "top") return 0;
  const x = STOPS[id];
  if (x === undefined) return 0;
  return camToScroll((x - CAM_X0) / (CAM_X1 - CAM_X0));
}
