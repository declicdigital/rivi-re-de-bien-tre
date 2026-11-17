import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water2.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { Tree } from "@dgreenheck/ez-tree";
import { MODELS, dataUrlToBuffer } from "./models";
import {
  buildFish,
  buildFlowers,
  buildGrass,
  buildClouds,
  buildMotes,
  buildSky,
  buildReeds,
  buildRocks,
  buildTerrain,
  updateFish,
  type FishState,
} from "./builders";
import { buildBridge, buildFisher, placeFisher, updateFisher, type Fisher } from "./people";
import {
  CAM_X0,
  CAM_X1,
  CAM_Z,
  WATER_Y,
  WORLD_X0,
  WORLD_X1,
  bankDistance,
  mulberry,
  riverHalfWidth,
  riverZ,
  terrainHeight,
} from "./world";

export type Anchor = { id: string; pos: THREE.Vector3 };

const ASSET = "scene/";

export class RiverScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  time = { value: 0 };
  progress = 0;
  low: boolean;
  anchors: Anchor[] = [];

  private sun = new THREE.DirectionalLight(0xfff3e2, 3.6);
  private sky!: THREE.Mesh;
  private fish?: { mesh: THREE.InstancedMesh; fish: FishState[] };
  private fishers: Fisher[] = [];
  private trees: Tree[] = [];
  private mist?: THREE.Group;
  private clouds?: THREE.Mesh;
  private motes?: THREE.Points;
  private sunDir = new THREE.Vector3();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, opts: { low: boolean }) {
    this.low = opts.low;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !opts.low,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.low ? 1 : 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = !opts.low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1600);
    this.resize();

    // ciel physique + lumière
    const elevation = 44,
      azimuth = 32; // grand soleil, derrière l'épaule de la caméra
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sky = buildSky(this.sunDir);
    this.scene.add(this.sky);

    // éclairage d'ambiance issu du ciel
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const skyScene = new THREE.Scene();
    skyScene.add(buildSky(this.sunDir));
    this.scene.environment = pmrem.fromScene(skyScene, 0.04).texture;
    this.scene.environmentIntensity = 1.0;
    pmrem.dispose();

    this.scene.fog = new THREE.FogExp2(0xbcd9f2, 0.0014);

    this.sun.castShadow = !opts.low;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -80;
    sc.right = 80;
    sc.top = 80;
    sc.bottom = -80;
    sc.near = 1;
    sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(0xbcd8f5, 0x55683a, 0.85));

    this.anchors = [
      { id: "maderotherapie", pos: new THREE.Vector3(238, 3.2, riverZ(238) - 2) },
      { id: "kobido", pos: new THREE.Vector3(488, 6.2, riverZ(488)) },
      { id: "a-propos", pos: new THREE.Vector3(792, 2.6, riverZ(792) - 2) },
      { id: "contact", pos: new THREE.Vector3(905, 3, riverZ(905) - 2) },
    ];
  }

  async load(onProgress: (p: number) => void) {
    const tl = new THREE.TextureLoader();
    const loadTex = async (f: string, srgb = true) => {
      const t = await tl.loadAsync(ASSET + f);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    const gltf = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("draco/");
    gltf.setDRACOLoader(draco);
    const glb = async (k: keyof typeof MODELS) =>
      (await gltf.parseAsync(dataUrlToBuffer(MODELS[k]), "")).scene;

    const [grass, dirt, dirtN, n0, n1] = await Promise.all([
      loadTex("grass.jpg"),
      loadTex("dirt_color.jpg"),
      loadTex("dirt_normal.jpg", false),
      loadTex("Water_1_M_Normal.jpg", false),
      loadTex("Water_2_M_Normal.jpg", false),
    ]);
    onProgress(0.1);

    this.scene.add(buildTerrain({ grass, dirt, dirtN }, this.low ? 0.55 : 1));

    // eau : reflets + réfraction (on voit le fond et les poissons), courant de gauche à droite
    const waterGeo = new THREE.PlaneGeometry(WORLD_X1 - WORLD_X0, 80, 1, 1);
    const water = new Water(waterGeo, {
      color: 0xcfe4ea,
      scale: 5,
      flowDirection: new THREE.Vector2(1, 0.08),
      flowSpeed: 0.045,
      reflectivity: 0.42,
      textureWidth: this.low ? 512 : 1024,
      textureHeight: this.low ? 512 : 1024,
      normalMap0: n0,
      normalMap1: n1,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set((WORLD_X0 + WORLD_X1) / 2, WATER_Y, 0);
    this.scene.add(water);
    onProgress(0.2);

    const [grassModel, rock1, rock2, rock3, fw, fb, fy] = await Promise.all([
      glb("grass"),
      glb("rock1"),
      glb("rock2"),
      glb("rock3"),
      glb("flowerWhite"),
      glb("flowerBlue"),
      glb("flowerYellow"),
    ]);
    const firstMesh = (o: THREE.Object3D) => {
      let m: THREE.Mesh | undefined;
      o.traverse((c) => {
        if (!m && (c as THREE.Mesh).isMesh) m = c as THREE.Mesh;
      });
      return m!;
    };
    this.scene.add(buildGrass(firstMesh(grassModel), this.time, this.low ? 40000 : 130000));
    this.scene.add(buildReeds(this.time, this.low ? 900 : 2600));
    this.scene.add(
      buildRocks([firstMesh(rock1), firstMesh(rock2), firstMesh(rock3)], this.low ? 70 : 140),
    );
    this.scene.add(
      buildFlowers(
        [fw.children[0] ?? fw, fb.children[0] ?? fb, fy.children[0] ?? fy],
        this.time,
        this.low ? 25 : 45,
      ),
    );
    onProgress(0.3);

    // poissons
    this.fish = buildFish(this.low ? 18 : 34, this.time);
    this.scene.add(this.fish.mesh);

    // pêcheurs
    const pal = [
      { jacket: 0x4f5a3a, pants: 0x6b6450, hat: 0xb8a77f, skin: 0xc99a7c, boots: 0x3c4a3a },
      { jacket: 0x3a4a52, pants: 0x55503f, hat: 0x6d6250, skin: 0xb88a6a, boots: 0x45503c },
      { jacket: 0x7a3f2e, pants: 0x4a4a42, hat: 0x3d4635, skin: 0xd2a487, boots: 0x3c4a3a },
    ];
    const f1 = buildFisher(pal[0]!, "stand", 1);
    placeFisher(f1, 128, -1, 1.5);
    const f2 = buildFisher(pal[1]!, "wade", 2);
    placeFisher(f2, 596, -1, -4.2);
    const f3 = buildFisher(pal[2]!, "sit", 3);
    placeFisher(f3, 708, 1, 2.2);
    const f4 = buildFisher(pal[1]!, "stand", 4);
    placeFisher(f4, 352, -1, 2.5);
    this.fishers = [f1, f2, f3, f4];
    this.fishers.forEach((f) => this.scene.add(f.group, f.line));

    this.scene.add(buildBridge(488));

    this.motes = buildMotes(this.low ? 150 : 400);
    this.scene.add(this.motes);
    this.clouds = buildClouds(this.time);
    this.scene.add(this.clouds);
    onProgress(0.35);

    // arbres : quelques modèles générés, puis réutilisés (géométrie partagée)
    const presets = this.low
      ? ["Ash Medium", "Oak Medium", "Aspen Medium", "Ash Small", "Pine Medium"]
      : [
          "Ash Large",
          "Ash Medium",
          "Oak Large",
          "Oak Medium",
          "Aspen Large",
          "Aspen Medium",
          "Pine Medium",
          "Pine Large",
          "Ash Small",
          "Oak Small",
          "Aspen Small",
        ];
    const models: THREE.Group[] = [];
    for (let i = 0; i < presets.length; i++) {
      const t = new Tree();
      t.loadPreset(presets[i]!);
      t.options.seed = 1000 + i * 77;
      t.generate();
      this.trees.push(t);
      const g = new THREE.Group();
      g.userData["kind"] = presets[i];
      t.children.forEach((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh || !m.geometry.attributes["position"]) return;
        const cm = new THREE.Mesh(m.geometry, m.material);
        cm.castShadow = !this.low;
        cm.receiveShadow = true;
        g.add(cm);
      });
      models.push(g);
      onProgress(0.35 + (0.55 * (i + 1)) / presets.length);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (this.disposed) return;
    }
    const big = models.filter((m) => !String(m.userData["kind"]).includes("Small"));
    const bushes = models.filter((m) => String(m.userData["kind"]).includes("Small"));
    const r = mulberry(2024);
    const forest = new THREE.Group();
    const put = (src: THREE.Group | undefined, x: number, z: number, s: number) => {
      if (!src) return;
      const o = src.clone();
      o.position.set(x, terrainHeight(x, z) - 0.4, z);
      o.rotation.y = r() * Math.PI * 2;
      o.scale.setScalar(s);
      forest.add(o);
    };
    // berge lointaine : quelques arbres isolés au bord, une prairie, puis la lisière de la forêt
    for (let x = WORLD_X0 + 40; x < 1080; x += 9 + r() * 14) {
      const c = riverZ(x),
        w = riverHalfWidth(x);
      if (Math.abs(x - 488) < 8) continue; // dégage la passerelle
      const u = r();
      if (u < 0.28)
        put(big[Math.floor(r() * big.length)], x, c - w - 6 - r() * 14, 0.5 + r() * 0.3);
      else if (u < 0.55)
        put(
          bushes[Math.floor(r() * bushes.length)],
          x + r() * 5,
          c - w - 3 - r() * 8,
          0.5 + r() * 0.4,
        );
    }
    // lisière de forêt plus loin
    for (let x = WORLD_X0 + 20; x < 1140; x += 6 + r() * 8) {
      put(big[Math.floor(r() * big.length)], x, riverZ(x) - 150 - r() * 45, 0.5 + r() * 0.35);
    }
    for (let i = 0; i < (this.low ? 160 : 380); i++) {
      const x = WORLD_X0 + 20 + r() * (WORLD_X1 - WORLD_X0 - 40);
      const z = riverZ(x) - 200 - Math.pow(r(), 0.8) * 260;
      put(big[Math.floor(r() * big.length)], x, z, 0.55 + r() * 0.4);
    }
    // berge proche : quelques arbres et buissons qui cadrent l'image
    for (let x = WORLD_X0 + 60; x < WORLD_X0; x += 36 + r() * 60) {
      // désactivé : dégage la vue
      const c = riverZ(x),
        w = riverHalfWidth(x);
      if (Math.abs(x - 708) < 14 || Math.abs(x - 488) < 10) continue;
      if ([238, 488, 596, 708, 792].some((a) => Math.abs(x - a) < 30)) continue;
      const z = c + w + 4 + r() * 8;
      if (bankDistance(x, z) > 3)
        put(bushes[Math.floor(r() * bushes.length)], x, z, 0.35 + r() * 0.3);
    }
    this.scene.add(forest);
    onProgress(1);
  }

  setProgress(p: number) {
    this.progress = p;
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // sur écran étroit, on recule un peu
    this.camera.fov = w / h < 1 ? 55 : 38;
    this.camera.updateProjectionMatrix();
  }

  private look = new THREE.Vector3();
  frame(dt: number) {
    this.time.value += dt;
    const t = this.time.value;
    const x = THREE.MathUtils.lerp(CAM_X0, CAM_X1, this.progress);
    const cz = CAM_Z + riverZ(x) * 0.5 + Math.sin(x / 140) * 2;
    const cy = 10.5 + Math.sin(x / 95) * 0.8 + Math.sin(t * 0.35) * 0.08;
    this.camera.position.set(x + Math.sin(t * 0.21) * 0.15, cy, cz);
    const lx = x + 9;
    this.look.set(lx, 6.5, riverZ(lx) - 3);
    this.camera.lookAt(this.look);

    this.sky.position.copy(this.camera.position);
    if (this.clouds) this.clouds.position.x = this.camera.position.x;
    this.sun.position.copy(this.look).addScaledVector(this.sunDir, 200);
    this.sun.target.position.copy(this.look);

    if (this.fish) updateFish(this.fish.mesh, this.fish.fish, t, dt);
    this.fishers.forEach((f) => updateFisher(f, t));
    this.trees.forEach((tr) => tr.update(t));
    if (this.mist) {
      this.mist.children.forEach((s) => {
        s.position.x += (s.userData["speed"] as number) * dt;
        if (s.position.x > WORLD_X1) s.position.x = WORLD_X0;
      });
    }
    if (this.motes) {
      this.motes.position.x = Math.sin(t * 0.2) * 1.5;
      this.motes.position.y = Math.sin(t * 0.33) * 0.6;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private v = new THREE.Vector3();
  /** position écran (px) d'un repère, ou null s'il est derrière la caméra */
  project(a: Anchor, w: number, h: number) {
    this.v.copy(a.pos).project(this.camera);
    if (this.v.z > 1) return null;
    return { x: (this.v.x * 0.5 + 0.5) * w, y: (-this.v.y * 0.5 + 0.5) * h };
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
  }
}
