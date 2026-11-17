// Géographie de la rivière : tracé, profil des berges, relief.
// Unités : 1 unité ≈ 25 cm (un adulte mesure ~7 unités, un arbre moyen ~55).

export const WATER_Y = -0.35;
export const WORLD_X0 = -160;
export const WORLD_X1 = 1160;
export const CAM_X0 = 0;
export const CAM_X1 = 900;
export const CAM_Z = 40;

// --- bruit déterministe -------------------------------------------------
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy),
    b = hash2(ix + 1, iy),
    c = hash2(ix, iy + 1),
    d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x: number, y: number, oct = 4) {
  let v = 0,
    amp = 0.5,
    f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return v;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// --- tracé de la rivière -------------------------------------------------
/** axe de la rivière (z) */
export function riverZ(x: number) {
  return 5.5 * Math.sin(x / 68) + 2.6 * Math.sin(x / 23 + 1.3) + 1.2 * Math.sin(x / 9.5);
}
/** demi-largeur (≈ 2,5 à 3,3 m de chaque côté) */
export function riverHalfWidth(x: number) {
  return 10.5 + 2.2 * Math.sin(x / 47 + 0.7) + 1.1 * Math.sin(x / 13);
}

/** hauteur du terrain */
export function terrainHeight(x: number, z: number) {
  const c = riverZ(x);
  const w = riverHalfWidth(x);
  const d = Math.abs(z - c) - w; // < 0 dans le lit
  const n = fbm(x * 0.05, z * 0.05);

  if (d < 0) {
    const t = Math.min(1, -d / w);
    const bed = -0.9 - 2.9 * Math.sin((t * Math.PI) / 2);
    return bed + (fbm(x * 0.3, z * 0.3) - 0.5) * 0.5;
  }

  // berge : remonte vite puis s'adoucit, avec un peu de relief
  let h =
    -0.9 + 2.4 * smooth(0, 6, d) + 1.3 * smooth(4, 26, d) + (n - 0.5) * 2.2 * smooth(2, 14, d);

  // collines boisées au fond (côté opposé à la caméra)
  const back = c - z; // > 0 côté berge lointaine
  if (back > 0) h += 7 * smooth(60, 260, back) * (0.6 + 0.8 * fbm(x * 0.008, z * 0.008));
  // légère pente vers la caméra
  else h += 2.5 * smooth(35, 90, -back);
  return h;
}

/** distance signée au bord de l'eau (> 0 sur la terre) */
export function bankDistance(x: number, z: number) {
  return Math.abs(z - riverZ(x)) - riverHalfWidth(x);
}
