import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SIMPLEX, addWind, type TimeUniform } from "./shaders";
import {
  WATER_Y,
  WORLD_X0,
  WORLD_X1,
  bankDistance,
  fbm,
  mulberry,
  riverHalfWidth,
  riverZ,
  terrainHeight,
} from "./world";

// ---------------------------------------------------------------- terrain
export function buildTerrain(
  tex: { grass: THREE.Texture; dirt: THREE.Texture; dirtN: THREE.Texture },
  quality: number,
) {
  const w = WORLD_X1 - WORLD_X0;
  const zMin = -720,
    zMax = 140;
  const segX = Math.round(660 * quality),
    segZ = Math.round(330 * quality);
  const geo = new THREE.PlaneGeometry(w, zMax - zMin, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (WORLD_X0 + WORLD_X1) / 2;
    const z = pos.getZ(i) + (zMin + zMax) / 2;
    pos.setXYZ(i, x, terrainHeight(x, z), z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.97,
    metalness: 0,
    normalMap: tex.dirtN,
    normalScale: new THREE.Vector2(0.25, 0.25),
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms["uGrass"] = { value: tex.grass };
    shader.uniforms["uDirt"] = { value: tex.dirt };
    shader.uniforms["uWaterY"] = { value: WATER_Y };
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vWPos;\nvarying vec3 vWNormal;\nvoid main() {")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `varying vec3 vWPos;\nvarying vec3 vWNormal;\nuniform sampler2D uGrass;\nuniform sampler2D uDirt;\nuniform float uWaterY;\n${SIMPLEX}\nvoid main() {`,
      )
      .replace(
        "#include <map_fragment>",
        `
        vec2 uvw = vWPos.xz;
        vec3 g = texture2D(uGrass, uvw / 26.0).rgb;
        vec3 g2 = texture2D(uGrass, uvw / 71.0 + 0.37).rgb;
        g = mix(g, g2, 0.45);
        vec3 dcol = texture2D(uDirt, uvw / 18.0).rgb;
        float n = 0.5 + 0.5 * simplex2d(uvw / 60.0);
        float n2 = 0.5 + 0.5 * simplex2d(uvw / 9.0);
        float h = vWPos.y - uWaterY;
        // herbe plus sombre et variée
        g *= mix(vec3(0.8, 1.05, 0.55), vec3(1.15, 1.2, 0.75), n);
        // berge humide et boueuse près de l'eau
        float wet = 1.0 - smoothstep(0.0, 1.6 + n2 * 0.8, h);
        vec3 mud = dcol * vec3(0.5, 0.45, 0.36);
        g = g * vec3(0.78, 0.98, 0.44);
        vec3 col = mix(g, mud, clamp(wet + smoothstep(0.62, 0.8, n2 * n) * 0.6, 0.0, 1.0));
        // pentes raides = terre
        float slope = 1.0 - clamp(vWNormal.y, 0.0, 1.0);
        col = mix(col, dcol * 0.75, smoothstep(0.35, 0.6, slope));
        // lit de la rivière : galets sombres, teinte verdâtre
        float under = 1.0 - smoothstep(-0.25, 0.05, h);
        col = mix(col, dcol * vec3(0.42, 0.48, 0.4) * (0.75 + 0.5 * n2), under);
        diffuseColor.rgb *= col;
        `,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `
        vec3 mapN = texture2D(normalMap, vWPos.xz / 18.0).xyz * 2.0 - 1.0;
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);
        `,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `float roughnessFactor = mix(roughness, 0.45, 1.0 - smoothstep(0.0, 0.9, vWPos.y - uWaterY));`,
      );
  };
  // tangentes requises par le normal map
  geo.computeTangents?.();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- scattering
type Sampler = (rand: () => number) => { x: number; z: number } | null;

function scatter(count: number, seed: number, sample: Sampler) {
  const r = mulberry(seed);
  const out: { x: number; z: number; r: () => number }[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const p = sample(r);
    if (p) out.push({ ...p, r });
  }
  return out;
}

/** zone visible : bande le long du parcours caméra */
const X_A = -60,
  X_B = 1000;

export function buildGrass(mesh: THREE.Mesh, time: TimeUniform, count: number) {
  const src = mesh.material as THREE.MeshStandardMaterial;
  const mat = new THREE.MeshLambertMaterial({
    map: src.map,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  mat.color.setRGB(0.42, 0.52, 0.26);
  addWind(mat, time, { strength: 0.18, heightScale: 2 });
  const im = new THREE.InstancedMesh(mesh.geometry, mat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const pts = scatter(count, 11, (r) => {
    const x = X_A + r() * (X_B - X_A);
    const near = r() < 0.5;
    const z =
      riverZ(x) +
      (near ? 1 : -1) * (riverHalfWidth(x) + 0.6 + Math.pow(r(), 1.2) * (near ? 26 : 75));
    const d = bankDistance(x, z);
    const patch = fbm(x * 0.03, z * 0.03);
    if (d < 0.5 || patch < 0.22 + r() * 0.1) return null;
    return { x, z };
  });
  pts.forEach((p, i) => {
    dummy.position.set(p.x, terrainHeight(p.x, p.z) - 0.1, p.z);
    dummy.rotation.set(0, p.r() * Math.PI * 2, 0);
    const s = 1.0 + p.r() * 0.7;
    dummy.scale.set(s, 0.55 + p.r() * 0.9, s);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    color.setRGB(0.55 + p.r() * 0.25, 0.62 + p.r() * 0.3, 0.32 + p.r() * 0.12);
    im.setColorAt(i, color);
  });
  im.count = pts.length;
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}

/** roseaux : lames effilées le long de l'eau */
export function buildReeds(time: TimeUniform, count: number) {
  const blades: THREE.BufferGeometry[] = [];
  const r0 = mulberry(5);
  for (let i = 0; i < 14; i++) {
    const h = 1;
    const g = new THREE.PlaneGeometry(0.035, h, 1, 6);
    const p = g.attributes["position"] as THREE.BufferAttribute;
    const bend = (r0() < 0.5 ? -1 : 1) * (0.1 + r0() * 0.22);
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + h / 2;
      const t = y / h;
      p.setX(k, p.getX(k) * (1 - t * 0.9));
      p.setZ(k, t * t * bend);
      p.setY(k, y);
    }
    g.rotateY(r0() * Math.PI);
    g.translate((r0() - 0.5) * 0.25, 0, (r0() - 0.5) * 0.25);
    g.scale(1, 0.7 + r0() * 0.5, 1);
    blades.push(g);
  }
  const geo = mergeGeometries(blades)!;
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0x6f7f3c, side: THREE.DoubleSide });
  addWind(mat, time, { strength: 0.35, heightScale: 1 });
  const im = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const pts = scatter(count, 23, (r) => {
    const x = X_A + r() * (X_B - X_A);
    const side = r() < 0.5 ? 1 : -1;
    const z = riverZ(x) + side * (riverHalfWidth(x) - 1.2 + r() * 3.2);
    if (fbm(x * 0.04, 3.1) < 0.45) return null; // en touffes
    return { x, z };
  });
  pts.forEach((p, i) => {
    dummy.position.set(p.x, Math.max(terrainHeight(p.x, p.z), WATER_Y - 0.6), p.z);
    dummy.rotation.set(0, p.r() * Math.PI * 2, 0);
    const s = 3.6 + p.r() * 3.6;
    dummy.scale.set(s * 0.5, s, s * 0.5);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.16 + p.r() * 0.05, 0.25 + p.r() * 0.15, 0.24 + p.r() * 0.12);
    im.setColorAt(i, color);
  });
  im.count = pts.length;
  im.castShadow = true;
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}

export function buildRocks(meshes: THREE.Mesh[], count: number) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  meshes.forEach((m, mi) => {
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.roughness = 0.9;
    const im = new THREE.InstancedMesh(m.geometry, mat, count);
    const pts = scatter(count, 40 + mi, (r) => {
      const x = X_A + r() * (X_B - X_A);
      const u = r();
      // surtout au bord de l'eau, quelques-uns dans le lit et dans l'herbe
      const off =
        u < 0.55
          ? riverHalfWidth(x) - 2 + r() * 4.5
          : u < 0.75
            ? r() * riverHalfWidth(x)
            : riverHalfWidth(x) + r() * 40;
      const z = riverZ(x) + (r() < 0.5 ? 1 : -1) * off;
      if (z > 44) return null;
      return { x, z };
    });
    pts.forEach((p, i) => {
      const inBed = bankDistance(p.x, p.z) < 0;
      const s = (inBed ? 0.35 : 0.25) + p.r() * (inBed ? 0.9 : 0.7);
      dummy.position.set(p.x, terrainHeight(p.x, p.z) - s * 0.25, p.z);
      dummy.rotation.set(p.r() * 0.4, p.r() * Math.PI * 2, p.r() * 0.4);
      dummy.scale.set(s * (0.8 + p.r() * 0.6), s * (0.5 + p.r() * 0.5), s * (0.8 + p.r() * 0.6));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.count = pts.length;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    group.add(im);
  });
  return group;
}

export function buildFlowers(models: THREE.Object3D[], time: TimeUniform, count: number) {
  // chaque fleur = plusieurs sous-maillages : on instancie chacun
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  models.forEach((model, mi) => {
    const pts = scatter(count, 70 + mi, (r) => {
      const x = X_A + r() * (X_B - X_A);
      const z = riverZ(x) + (r() < 0.6 ? 1 : -1) * (riverHalfWidth(x) + 2 + r() * 30);
      if (z > 44 || fbm(x * 0.05, z * 0.05) < 0.5) return null;
      return { x, z };
    });
    const matrices = pts.map((p) => {
      dummy.position.set(p.x, terrainHeight(p.x, p.z) - 0.05, p.z);
      dummy.rotation.set(0, p.r() * Math.PI * 2, 0);
      const s = 0.5 + p.r() * 0.45;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const src = m.material as THREE.MeshStandardMaterial;
      const mat = new THREE.MeshLambertMaterial({
        map: src.map ?? null,
        color: src.color ?? 0xffffff,
        side: THREE.DoubleSide,
        alphaTest: 0.5,
      });
      mat.color.multiplyScalar(0.75);
      addWind(mat, time, { strength: 0.25, heightScale: 1.7, instanced: true });
      const im = new THREE.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((mx, i) => im.setMatrixAt(i, mx));
      im.frustumCulled = false;
      group.add(im);
    });
  });
  return group;
}

// ---------------------------------------------------------------- poissons
export type FishState = {
  x: number;
  z: number;
  y: number;
  speed: number;
  dir: number;
  phase: number;
  size: number;
  zoff: number;
};

export function buildFish(count: number, time: TimeUniform) {
  // corps fuselé + nageoire caudale
  const body = new THREE.SphereGeometry(1, 16, 10);
  body.scale(1.6, 0.42, 0.3);
  const tail = new THREE.BufferGeometry();
  tail.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-1.4, 0, 0, -2.3, 0.45, 0, -2.3, -0.45, 0, -1.4, 0, 0, -2.3, -0.45, 0, -2.3, 0.45, 0],
      3,
    ),
  );
  const fin = new THREE.BufferGeometry();
  fin.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-0.2, 0.35, 0, 0.5, 0.35, 0, -0.5, 0.75, 0, 0.5, 0.35, 0, -0.2, 0.35, 0, -0.5, 0.75, 0],
      3,
    ),
  );
  const bodyN = body.toNonIndexed();
  bodyN.deleteAttribute("uv");
  bodyN.deleteAttribute("normal");
  const geo = mergeGeometries([bodyN, tail, fin])!;
  geo.deleteAttribute("normal");
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: 0x5b5a3e, roughness: 0.45, metalness: 0.15 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms["uTime"] = time;
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        "uniform float uTime;\nattribute float aPhase;\nvarying float vBelly;\nvoid main() {",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float bend = smoothstep(0.6, -2.3, position.x);
        transformed.z += sin(uTime * 7.0 + aPhase + position.x * 2.2) * 0.32 * bend;
        vBelly = smoothstep(-0.05, -0.35, position.y);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "varying float vBelly;\nvoid main() {")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.74, 0.6), vBelly);",
      );
  };
  const im = new THREE.InstancedMesh(geo, mat, count);
  const phases = new Float32Array(count);
  const r = mulberry(99);
  const fish: FishState[] = [];
  for (let i = 0; i < count; i++) {
    phases[i] = r() * 6.28;
    const x = X_A + r() * (X_B - X_A);
    fish.push({
      x,
      z: 0,
      y: WATER_Y - 1.1 - r() * 1.4,
      speed: 2 + r() * 3.5,
      dir: r() < 0.65 ? -1 : 1,
      phase: phases[i]!,
      size: 0.5 + r() * 0.45,
      zoff: (r() - 0.5) * 1.2,
    });
  }
  geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  im.frustumCulled = false;
  return { mesh: im, fish };
}

const _d = new THREE.Object3D();
export function updateFish(im: THREE.InstancedMesh, fish: FishState[], t: number, dt: number) {
  fish.forEach((f, i) => {
    f.x += f.dir * f.speed * dt * (0.7 + 0.3 * Math.sin(t * 0.7 + f.phase));
    if (f.x > X_B) f.x = X_A;
    if (f.x < X_A) f.x = X_B;
    const w = riverHalfWidth(f.x) * 0.6;
    const z = riverZ(f.x) + f.zoff * w + Math.sin(t * 0.3 + f.phase) * w * 0.35;
    const zAhead = riverZ(f.x + f.dir) + f.zoff * w + Math.sin(t * 0.3 + f.phase) * w * 0.35;
    _d.position.set(f.x, f.y + Math.sin(t * 0.8 + f.phase) * 0.15, z);
    _d.rotation.set(0, Math.atan2(-(zAhead - z), f.dir), 0);
    _d.scale.setScalar(f.size);
    _d.updateMatrix();
    im.setMatrixAt(i, _d.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- particules (pollen / insectes dans la lumière)
export function buildMotes(count: number) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const r = mulberry(7);
  for (let i = 0; i < count; i++) {
    const x = X_A + r() * (X_B - X_A);
    p[i * 3] = x;
    p[i * 3 + 1] = WATER_Y + 0.5 + r() * 9;
    p[i * 3 + 2] = riverZ(x) + (r() - 0.5) * 50;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,248,220,1)");
  gr.addColorStop(1, "rgba(255,248,220,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({
    size: 0.28,
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

// ---------------------------------------------------------------- brume au ras de l'eau
export function buildMist() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,0.55)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const group = new THREE.Group();
  const r = mulberry(17);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.16,
    color: 0xf3f1ea,
  });
  for (let i = 0; i < 70; i++) {
    const x = X_A + r() * (X_B - X_A);
    const s = new THREE.Sprite(mat);
    s.position.set(x, WATER_Y + 1 + r() * 2.5, riverZ(x) - 4 - r() * 30);
    s.scale.set(40 + r() * 40, 7 + r() * 6, 1);
    s.userData["speed"] = 0.6 + r() * 1.2;
    group.add(s);
  }
  return group;
}

// ---------------------------------------------------------------- nuages de beau temps (petits cumulus épars)
export function buildClouds(time: TimeUniform) {
  const geo = new THREE.PlaneGeometry(3000, 1400, 1, 1);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: time },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW;
      ${SIMPLEX}
      float fbm2(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*simplex2d(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec2 p = vW.xz / 420.0 + vec2(uTime * 0.004, 0.0);
        float n = fbm2(p) + 0.35 * fbm2(p * 3.1 + 7.3);
        float c = smoothstep(0.32, 0.72, n);
        float shade = smoothstep(0.3, 0.95, n);
        vec3 col = mix(vec3(1.0, 0.99, 0.97), vec3(0.78, 0.83, 0.9), shade * 0.55);
        // fondu vers l'horizon
        float d = length(vW.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(500.0, 1300.0, d);
        gl_FragColor = vec4(col, c * 0.92 * fade);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, 230, -250);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

// ---------------------------------------------------------------- ciel bleu de beau temps (dégradé + soleil)
export function buildSky(sunDir: THREE.Vector3) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSun: { value: sunDir.clone().normalize() } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 horizon = vec3(0.74, 0.85, 0.95);
        vec3 mid = vec3(0.42, 0.65, 0.92);
        vec3 zenith = vec3(0.16, 0.4, 0.82);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, zenith, smoothstep(0.18, 0.75, h));
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.95, 0.85) * (pow(s, 900.0) * 8.0 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
      }`,
  });
  mat.toneMapped = false;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  m.scale.setScalar(1300);
  m.frustumCulled = false;
  m.renderOrder = -2;
  return m;
}
