import * as THREE from "three";
import { WATER_Y, mulberry, riverHalfWidth, riverZ, terrainHeight } from "./world";

// Pêcheurs construits en volumes simples, vus à distance (~10-15 m)

const std = (color: number, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

type Palette = { jacket: number; pants: number; hat: number; skin: number; boots: number };

function limb(r: number, len: number, mat: THREE.Material) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(0, -len / 2 - r, 0); // pivot en haut
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

export type Fisher = {
  group: THREE.Group;
  rod: THREE.Group;
  tip: THREE.Object3D;
  line: THREE.Line;
  lineTarget: THREE.Vector3;
  phase: number;
  mode: "stand" | "sit" | "wade";
};

export function buildFisher(p: Palette, mode: Fisher["mode"], seed: number): Fisher {
  const r = mulberry(seed);
  const group = new THREE.Group();
  const jacket = std(p.jacket),
    pants = std(p.pants),
    skin = std(p.skin, 0.6),
    hat = std(p.hat),
    boots = std(p.boots, 0.5);

  const hips = new THREE.Group();
  hips.position.y = mode === "sit" ? 2.0 : 3.5;
  group.add(hips);

  // jambes
  const legL = limb(0.36, 2.6, mode === "wade" ? boots : pants);
  const legR = limb(0.36, 2.6, mode === "wade" ? boots : pants);
  legL.position.set(0, 0, 0.35);
  legR.position.set(0, 0, -0.35);
  if (mode === "sit") {
    legL.rotation.z = Math.PI / 2.3;
    legR.rotation.z = Math.PI / 2.1;
    // tibias
    const shinL = limb(0.32, 1.6, pants),
      shinR = limb(0.32, 1.6, pants);
    shinL.position.set(2.9, 0.35, 0.35);
    shinR.position.set(3.0, 0.3, -0.35);
    shinL.rotation.z = -0.15;
    shinR.rotation.z = 0.05;
    group.add(shinL, shinR);
    shinL.position.add(hips.position);
    shinR.position.add(hips.position);
  } else {
    legL.rotation.z = 0.08;
    legR.rotation.z = -0.1;
  }
  hips.add(legL, legR);

  // buste (veste)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.5, 4, 12), jacket);
  torso.scale.set(1, 1, 1.25);
  torso.position.y = 1.55;
  torso.rotation.z = mode === "sit" ? -0.12 : -0.05;
  torso.castShadow = true;
  hips.add(torso);

  // tête + chapeau
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), skin);
  head.position.set(0.05, 3.3, 0);
  head.castShadow = true;
  hips.add(head);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 20), hat);
  brim.position.set(0.05, 3.62, 0);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.5, 16), hat);
  crown.position.set(0.05, 3.85, 0);
  brim.castShadow = crown.castShadow = true;
  hips.add(brim, crown);

  // bras tendus vers la canne
  const shoulder = new THREE.Group();
  shoulder.position.set(0.1, 2.55, 0);
  hips.add(shoulder);
  const armL = limb(0.2, 1.7, jacket),
    armR = limb(0.2, 1.7, jacket);
  armL.position.z = 0.75;
  armR.position.z = -0.75;
  armL.rotation.set(0.35, 0, 1.15);
  armR.rotation.set(-0.35, 0, 1.0);
  shoulder.add(armL, armR);

  // canne à pêche (pivot dans les mains)
  const rod = new THREE.Group();
  rod.position.set(1.7, 2.0, 0);
  hips.add(rod);
  const rodLen = 13;
  const rodGeo = new THREE.CylinderGeometry(0.025, 0.09, rodLen, 6);
  rodGeo.translate(0, rodLen / 2, 0);
  const rodMesh = new THREE.Mesh(rodGeo, std(0x2b2520, 0.4));
  rodMesh.castShadow = true;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 1.4, 8).translate(0, 0.2, 0),
    std(0x6b4f35, 0.7),
  );
  rod.add(rodMesh, handle);
  rod.rotation.z = -0.95; // incliné vers l'eau (axe +x local)
  const tip = new THREE.Object3D();
  tip.position.y = rodLen;
  rod.add(tip);

  const lineGeo = new THREE.BufferGeometry().setFromPoints(
    new Array(16).fill(0).map(() => new THREE.Vector3()),
  );
  const line = new THREE.Line(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0xe8e4d8, transparent: true, opacity: 0.55 }),
  );
  line.frustumCulled = false;

  if (mode === "sit") {
    // tabouret pliant
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.4), std(0x2f3a2c));
    seat.position.set(-0.1, 1.95, 0);
    const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3), std(0x777777, 0.4));
    const legB = legA.clone();
    legA.position.set(-0.1, 0.95, 0.5);
    legA.rotation.x = 0.5;
    legB.position.set(-0.1, 0.95, -0.5);
    legB.rotation.x = -0.5;
    seat.castShadow = true;
    group.add(seat, legA, legB);
    // seau
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 1.0, 14, 1, true),
      std(0x5d6b6e, 0.5),
    );
    bucket.position.set(-1.6, 0.5, 1.2);
    bucket.castShadow = true;
    group.add(bucket);
  }

  return { group, rod, tip, line, lineTarget: new THREE.Vector3(), phase: r() * 6.28, mode };
}

const _tipW = new THREE.Vector3();
export function updateFisher(f: Fisher, t: number) {
  // léger mouvement de canne (lancer lent pour le pêcheur debout)
  if (f.mode === "stand") {
    const cycle = (t * 0.12 + f.phase) % 1;
    const cast = cycle < 0.12 ? Math.sin((cycle / 0.12) * Math.PI) : 0;
    f.rod.rotation.z = -0.95 + cast * 0.85 + Math.sin(t * 0.9 + f.phase) * 0.02;
  } else {
    f.rod.rotation.z = -0.95 + Math.sin(t * 0.7 + f.phase) * 0.025;
  }
  f.tip.getWorldPosition(_tipW);
  const pos = f.line.geometry.attributes["position"] as THREE.BufferAttribute;
  const n = pos.count;
  const bob = Math.sin(t * 1.8 + f.phase) * 0.08;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const x = THREE.MathUtils.lerp(_tipW.x, f.lineTarget.x, k);
    const z = THREE.MathUtils.lerp(_tipW.z, f.lineTarget.z, k);
    const y =
      THREE.MathUtils.lerp(_tipW.y, f.lineTarget.y + bob, k) -
      Math.sin(k * Math.PI) * 1.4 * (1 - k * 0.3);
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
}

/** place un pêcheur à l'abscisse x, sur la berge (side: -1 = berge lointaine, 1 = proche), tourné vers l'eau */
export function placeFisher(f: Fisher, x: number, side: -1 | 1, inset: number) {
  const c = riverZ(x),
    w = riverHalfWidth(x);
  const z = c + side * (w + inset);
  const y = f.mode === "wade" ? terrainHeight(x, z) : terrainHeight(x, z);
  f.group.position.set(x, y, z);
  // le modèle regarde vers +x local : on l'oriente vers l'eau
  f.group.rotation.y = side === -1 ? -Math.PI / 2 + 0.35 : Math.PI / 2 - 0.35;
  f.lineTarget.set(x + 5, WATER_Y + 0.02, c + side * (w * 0.1));
}

// ---------------------------------------------------------------- passerelle en bois
export function buildBridge(x: number) {
  const g = new THREE.Group();
  const c = riverZ(x),
    w = riverHalfWidth(x);
  const span = w * 2 + 12;
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a31, roughness: 0.9 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x40301f, roughness: 0.95 });
  const r = mulberry(3);
  const deckY = WATER_Y + 3.2;
  const planks = Math.round(span / 0.9);
  for (let i = 0; i < planks; i++) {
    const z = c - span / 2 + i * 0.9 + 0.45;
    const arch = Math.cos(((z - c) / (span / 2)) * (Math.PI / 2)) * 1.1;
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(5.2 + (r() - 0.5) * 0.3, 0.22, 0.82),
      r() < 0.3 ? woodDark : wood,
    );
    p.position.set(x + (r() - 0.5) * 0.12, deckY + arch, z);
    p.rotation.y = (r() - 0.5) * 0.03;
    p.castShadow = p.receiveShadow = true;
    g.add(p);
  }
  // poutres et rambardes
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 8; i++) {
      const z = c - span / 2 + (i / 8) * span;
      const arch = Math.cos(((z - c) / (span / 2)) * (Math.PI / 2)) * 1.1;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 0.25), woodDark);
      post.position.set(x + side * 2.4, deckY + arch + 1.6, z);
      post.castShadow = true;
      g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, span), wood);
    rail.position.set(x + side * 2.4, deckY + 3.6, c);
    rail.castShadow = true;
    g.add(rail);
  }
  // piliers dans l'eau
  for (const dz of [-w * 0.45, w * 0.45]) {
    for (const side of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 6, 10), woodDark);
      pil.position.set(x + side * 2.1, WATER_Y + 0.3, c + dz);
      pil.castShadow = true;
      g.add(pil);
    }
  }
  return g;
}
