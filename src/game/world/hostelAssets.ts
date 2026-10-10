import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { hostelItem } from "../../config/hostelItems";
const cube = new T.BoxGeometry(1, 1, 1),
  cylinder = new T.CylinderGeometry(1, 1, 1, 12),
  sphere = new T.SphereGeometry(1, 10, 8);
const materials = new Map<string, T.MeshStandardMaterial>();
function mat(color: string) {
  if (!materials.has(color))
    materials.set(color, new T.MeshStandardMaterial({ color, roughness: 0.8 }));
  return materials.get(color)!;
}
const green = "#4d7967",
  dark = "#293a35",
  cream = "#e9e8d5",
  wood = "#a57b50";
function part(
  g: T.Group,
  size: number[],
  pos: number[],
  color: string,
  geo: T.BufferGeometry = cube,
) {
  const m = new T.Mesh(geo, mat(color));
  m.scale.set(...(size as [number, number, number]));
  m.position.set(...(pos as [number, number, number]));
  g.add(m);
  return m;
}
type Builder = (g: T.Group) => void;
const box = (g: T.Group, s: number[], p: number[], c = green) =>
  part(g, s, p, c);
const disc = (g: T.Group, r: number, h: number, p: number[], c = dark) =>
  part(g, [r, h, r], p, c, cylinder);
export const HOSTEL_ASSET_REGISTRY: Record<string, Builder> = {
  hostel_mattress: (g) => {
    box(g, [1.25, 0.3, 2], [0, 0.15, 0], "#809b89");
    box(g, [1.2, 0.025, 1.95], [0, 0.31, 0], "#adbdac");
  },
  hostel_chair: (g) => {
    box(g, [0.7, 0.09, 0.7], [0, 0.5, 0], "#d88451");
    box(g, [0.7, 0.6, 0.08], [0, 0.83, -0.31], "#d88451");
    for (const x of [-0.27, 0.27])
      for (const z of [-0.27, 0.27])
        box(g, [0.07, 0.48, 0.07], [x, 0.24, z], "#d88451");
  },
  hostel_table: (g) => {
    box(g, [1.2, 0.08, 0.8], [0, 0.73, 0], wood);
    for (const x of [-0.5, 0.5])
      for (const z of [-0.3, 0.3])
        box(g, [0.09, 0.7, 0.09], [x, 0.35, z], wood);
  },
  hostel_pillow: (g) => {
    part(g, [0.4, 0.1, 0.22], [0, 0.1, 0], cream, sphere);
  },
  hostel_bedsheet: (g) => {
    box(g, [1.2, 0.025, 1.9], [0, 0.02, 0], "#b1cbcc");
    for (let z = -0.8; z < 1; z += 0.3)
      box(g, [1.2, 0.028, 0.04], [0, 0.022, z], cream);
  },
  hostel_fan_basic: (g) => {
    disc(g, 0.29, 0.07, [0, 0.035, 0]);
    box(g, [0.07, 0.95, 0.07], [0, 0.5, 0]);
    const cage = disc(g, 0.3, 0.1, [0, 1.16, 0], cream);
    cage.rotation.x = Math.PI / 2;
    const blades = new T.Group();
    blades.name = "fanBlades";
    blades.position.set(0, 1.16, 0.07);
    g.add(blades);
    for (let n = 0; n < 3; n++) {
      const blade = box(blades, [0.09, 0.45, 0.025], [0, 0, 0], green);
      blade.rotation.z = (n * Math.PI * 2) / 3;
    }
    part(g, [0.065, 0.065, 0.05], [0, 1.16, 0.1], dark, sphere);
  },
  hostel_poster: (g) => {
    box(g, [1.1, 0.9, 0.06], [0, 0, 0], wood);
    box(g, [1, 0.8, 0.015], [0, 0, 0.04], cream);
    box(g, [0.65, 0.08, 0.02], [0, 0.12, 0.06], green);
    box(g, [0.35, 0.3, 0.02], [0, -0.13, 0.06], green);
  },
  hostel_curtain: (g) => {
    box(g, [1.5, 0.05, 0.08], [0, 0.65, 0], wood);
    for (let x = -0.65; x < 0.75; x += 0.13)
      box(g, [0.12, 1.25, 0.08], [x, 0, Math.sin(x * 25) * 0.02], "#719c96");
  },
  hostel_rug: (g) => {
    box(g, [1.5, 0.025, 1.3], [0, 0.015, 0], "#ad7050");
    box(g, [1.3, 0.029, 1.1], [0, 0.018, 0], "#d4b288");
  },
  hostel_tv_basic: (g) => {
    box(g, [1.45, 0.9, 0.12], [0, 0.7, 0], dark);
    const s = box(g, [1.3, 0.74, 0.015], [0, 0.7, 0.07], "#12201d");
    s.name = "tvScreen";
    box(g, [0.12, 0.25, 0.12], [0, 0.18, 0]);
    box(g, [0.6, 0.04, 0.4], [0, 0.02, 0], dark);
  },
  hostel_speaker: (g) => {
    box(g, [0.32, 0.46, 0.3], [0, 0.23, 0], dark);
    for (const y of [0.13, 0.33]) {
      const d = disc(g, 0.09, 0.02, [0, y, 0.16], "#8a9692");
      d.rotation.x = Math.PI / 2;
    }
  },
  hostel_ps_console: (g) => {
    box(g, [0.4, 0.12, 0.35], [0, 0.06, 0], dark);
    box(g, [0.42, 0.03, 0.35], [0, 0.13, 0], cream);
    box(g, [0.2, 0.01, 0.015], [0, 0.09, 0.18], "#73bcbb");
  },
  hostel_game_pad: (g) => {
    part(g, [0.22, 0.065, 0.13], [0, 0.07, 0], dark, sphere);
    box(g, [0.035, 0.02, 0.1], [-0.11, 0.13, 0], cream);
    box(g, [0.1, 0.02, 0.035], [-0.11, 0.13, 0], cream);
    part(g, [0.024, 0.016, 0.024], [0.12, 0.13, 0], "#d5755b", sphere);
  },
  hostel_lamp: (g) => {
    disc(g, 0.14, 0.05, [0, 0.025, 0]);
    box(g, [0.035, 0.36, 0.035], [0, 0.2, 0]);
    part(g, [0.17, 0.1, 0.17], [0, 0.42, 0], "#fff0ae", sphere);
  },
  hostel_generator_small: (g) => {
    box(g, [0.8, 0.5, 0.55], [0, 0.28, 0], "#c56d51");
    box(g, [0.65, 0.1, 0.5], [0, 0.59, 0], dark);
    for (const x of [-0.36, 0.36])
      for (const z of [-0.23, 0.23])
        box(g, [0.035, 0.65, 0.035], [x, 0.33, z], dark);
    const l = box(g, [0.08, 0.08, 0.015], [0.25, 0.4, 0.283], "#7f2828");
    l.name = "indicator";
  },
  hostel_gas_small_cylinder: (g) => {
    disc(g, 0.24, 0.46, [0, 0.25, 0], "#b05748");
    part(g, [0.24, 0.13, 0.24], [0, 0.48, 0], "#b05748", sphere);
    box(g, [0.08, 0.1, 0.08], [0, 0.6, 0], dark);
  },
  hostel_pot: (g) => {
    disc(g, 0.22, 0.23, [0, 0.13, 0], "#9aa3a1");
    disc(g, 0.24, 0.025, [0, 0.26, 0], cream);
    box(g, [0.07, 0.05, 0.07], [0, 0.3, 0], dark);
    for (const x of [-0.27, 0.27])
      box(g, [0.12, 0.04, 0.09], [x, 0.2, 0], dark);
  },
  hostel_plate: (g) => {
    disc(g, 0.2, 0.025, [0, 0.02, 0], cream);
  },
};
// Non-furniture catalogue previews are still generated from geometry, never external photography.
for (const id of [
  "hostel_fuel_can",
  "hostel_gas_refill",
  "hostel_food_garri",
  "hostel_food_indomie",
  "hostel_food_bread",
  "hostel_food_eggs",
  "hostel_food_rice",
  "hostel_food_spaghetti",
  "hostel_food_water",
])
  HOSTEL_ASSET_REGISTRY[id] = (g) => {
    box(
      g,
      [0.3, 0.42, 0.2],
      [0, 0.21, 0],
      id.includes("water") ? "#83b5be" : "#cfb270",
    );
    box(g, [0.24, 0.13, 0.01], [0, 0.23, 0.106], cream);
  };
const glbs = new Map<string, Promise<T.Group>>();
export async function createHostelAsset(id: string): Promise<T.Group> {
  const asset = hostelItem(id)?.asset;
  let g: T.Group;
  if (asset?.type === "glb") {
    if (!glbs.has(asset.src))
      glbs.set(
        asset.src,
        new GLTFLoader()
          .loadAsync(asset.src)
          .then((x) => x.scene)
          .catch((e) => {
            glbs.delete(asset.src);
            throw e;
          }),
      );
    g = (await glbs.get(asset.src)!).clone(true);
  } else {
    g = new T.Group();
    const build = HOSTEL_ASSET_REGISTRY[asset?.modelKey || id];
    if (!build) throw new Error("No hostel model: " + id);
    build(g);
  }
  return g;
}
// One offscreen context; sequential snapshots, no per-card canvases or render loops.
let renderer: T.WebGLRenderer | undefined;
let queue = Promise.resolve();
const thumbs = new Map<string, Promise<string>>();
export function hostelThumbnail(id: string): Promise<string> {
  if (thumbs.has(id)) return thumbs.get(id)!;
  const task = queue.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0)); // Yield between snapshots; never monopolise touch input.
    renderer ??= new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(240, 180);
    renderer.setPixelRatio(1);
    const scene = new T.Scene(),
      g = await createHostelAsset(id);
    scene.add(g, new T.HemisphereLight(0xffffff, 0x667766, 3));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 4);
    scene.add(light);
    const b = new T.Box3().setFromObject(g),
      size = b.getSize(new T.Vector3()),
      center = b.getCenter(new T.Vector3());
    g.position.sub(center);
    const r = Math.max(size.x, size.y, size.z, 0.4) * 0.78;
    const camera = new T.OrthographicCamera(
      (-r * 4) / 3,
      (r * 4) / 3,
      r,
      -r,
      0.01,
      30,
    );
    camera.position.set(3, 2.2, 4);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  });
  thumbs.set(id, task);
  queue = task.then(
    () => {},
    () => {},
  );
  return task;
}
