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
const torus = new T.TorusGeometry(1, 0.12, 6, 16);
function watch(g: T.Group, band: string, face: string) {
  part(g, [0.13, 0.13, 0.13], [0, 0.13, 0], band, new T.TorusGeometry(1, 0.28, 6, 18));
  part(g, [0.09, 0.03, 0.09], [0, 0.26, 0], face, cylinder).rotation.x = 0;
}
function car(g: T.Group, paint: string, scale: number, suv = false, boxy = false) {
  const k = scale, h = suv ? 1.25 : 1;
  part(g, [1.8 * k, 0.45 * h, 4.2 * k], [0, 0.5 * h, 0], paint);
  part(g, [1.6 * k, (boxy ? 0.7 : 0.5) * h, (boxy ? 2.6 : 2.2) * k], [0, (boxy ? 1.05 : 0.95) * h, boxy ? -0.1 : -0.2], paint);
  part(g, [1.62 * k, (boxy ? 0.5 : 0.36) * h, (boxy ? 2.5 : 2.0) * k], [0, (boxy ? 1.07 : 0.97) * h, boxy ? -0.1 : -0.2], "#1e293b");
  for (const x of [-0.85 * k, 0.85 * k]) for (const z of [-1.35 * k, 1.35 * k])
    part(g, [0.36 * h, 0.22, 0.36 * h], [x, 0.36 * h, z], "#111111", cylinder).rotation.z = Math.PI / 2;
  for (const x of [-0.6 * k, 0.6 * k]) part(g, [0.3, 0.12, 0.03], [x, 0.6 * h, 2.1 * k], "#fef3c7");
}
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
    part(g, [0.17, 0.1, 0.17], [0, 0.42, 0], "#fff0ae", sphere).name = "lampBulb";
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
  // ── Migration 024: room makeover ──
  hostel_tv_stand: (g) => {
    // Long low entertainment unit: top 0.55 m, open shelf, two cupboard doors, short legs.
    box(g, [2.5, 0.05, 0.5], [0, 0.525, 0], "#6b4a2f");
    box(g, [2.46, 0.4, 0.46], [0, 0.3, 0], "#7d5838");
    box(g, [1.2, 0.18, 0.02], [0, 0.32, 0.235], "#2a2119");
    for (const x of [-0.92, 0.92]) {
      box(g, [0.56, 0.32, 0.02], [x, 0.3, 0.235], "#8e6743");
      box(g, [0.04, 0.12, 0.02], [x + (x < 0 ? 0.22 : -0.22), 0.3, 0.25], "#d9c08a");
    }
    for (const x of [-1.15, 1.15]) for (const z of [-0.18, 0.18]) box(g, [0.05, 0.1, 0.05], [x, 0.05, z], dark);
  },
  hostel_wardrobe: (g) => {
    box(g, [1.2, 2, 0.6], [0, 1, 0], "#8b6440");
    box(g, [0.02, 1.9, 0.02], [0, 1, 0.305], "#5a3f27");
    for (const x of [-0.08, 0.08]) box(g, [0.03, 0.22, 0.03], [x, 1.05, 0.32], "#d9c08a");
    box(g, [1.24, 0.06, 0.64], [0, 2.02, 0], "#6b4a2f");
  },
  hostel_bookshelf: (g) => {
    const w = 0.9, d = 0.35;
    for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) box(g, [0.04, 1.6, d], [x, 0.8, 0], wood);
    box(g, [w, 1.6, 0.02], [0, 0.8, -d / 2 + 0.01], "#8a6640");
    const colors = ["#c0392b", "#2e86c1", "#f4d03f", "#27ae60", "#8e44ad", "#e67e22"];
    [0.05, 0.45, 0.85, 1.25, 1.58].forEach((y, row) => {
      box(g, [w, 0.035, d], [0, y, 0], wood);
      if (row < 4) for (let k = 0; k < 7; k++) box(g, [0.075, 0.26 - (k % 3) * 0.03, 0.22], [-0.33 + k * 0.105, y + 0.15, 0.02], colors[(k + row) % colors.length]);
    });
  },
  hostel_bean_bag: (g) => {
    part(g, [0.42, 0.28, 0.42], [0, 0.26, 0], "#e0663d", sphere);
    part(g, [0.36, 0.26, 0.2], [0, 0.42, -0.2], "#d45a32", sphere);
  },
  hostel_mirror: (g) => {
    box(g, [0.6, 0.95, 0.04], [0, 0, 0], "#c9a25d");
    const glass = box(g, [0.52, 0.87, 0.012], [0, 0, 0.026], "#cfe3ea");
    (glass.material as T.MeshStandardMaterial) = new T.MeshStandardMaterial({ color: "#d6e8ef", roughness: 0.05, metalness: 0.85 });
  },
  hostel_wall_clock: (g) => {
    const face = disc(g, 0.22, 0.04, [0, 0, 0], "#f8f5ea");
    face.rotation.x = Math.PI / 2;
    const rim = disc(g, 0.235, 0.03, [0, 0, -0.008], dark);
    rim.rotation.x = Math.PI / 2;
    const hour = box(g, [0.025, 0.11, 0.01], [0.03, 0.04, 0.028], dark);
    hour.rotation.z = -0.8;
    const minute = box(g, [0.018, 0.17, 0.01], [-0.05, 0.06, 0.03], dark);
    minute.rotation.z = 0.6;
  },
  hostel_led_strip: (g) => {
    box(g, [2, 0.03, 0.03], [0, 0.95, 0], "#2a2a2a");
    const strip = box(g, [1.96, 0.02, 0.02], [0, 0.95, 0.02], "#5b5b78");
    strip.material = new T.MeshStandardMaterial({ color: "#5b5b78", emissive: "#000000" });
    strip.name = "ledStrip";
  },
  hostel_plant_pot: (g) => {
    disc(g, 0.18, 0.3, [0, 0.15, 0], "#b4643d");
    disc(g, 0.2, 0.04, [0, 0.3, 0], "#9c5432");
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const leaf = part(g, [0.08, 0.26, 0.04], [Math.cos(a) * 0.1, 0.55, Math.sin(a) * 0.1], k % 2 ? "#3f8f4a" : "#57a85f", sphere);
      leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    }
  },
  hostel_palm: (g) => {
    disc(g, 0.24, 0.4, [0, 0.2, 0], "#e8e2d4");
    box(g, [0.06, 1.1, 0.06], [0, 0.95, 0], "#7a5a36");
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const frond = box(g, [0.1, 0.03, 0.62], [Math.cos(a) * 0.28, 1.45, Math.sin(a) * 0.28], k % 2 ? "#2f7d3c" : "#3e9a4c");
      frond.rotation.set(0, -a + Math.PI / 2, 0);
      frond.rotateX(0.45);
    }
  },
  hostel_flower_vase: (g) => {
    disc(g, 0.08, 0.22, [0, 0.11, 0], "#4f7fbf");
    const flowers = ["#e84a5f", "#f7c548", "#ffffff", "#ff8fb1", "#b56ee8"];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2, r = 0.05;
      box(g, [0.01, 0.2, 0.01], [Math.cos(a) * r, 0.31, Math.sin(a) * r], "#3f8f4a");
      part(g, [0.045, 0.035, 0.045], [Math.cos(a) * r * 1.6, 0.42, Math.sin(a) * r * 1.6], flowers[k], sphere);
    }
  },
  hostel_hanging_plant: (g) => {
    box(g, [0.04, 0.3, 0.04], [0, 0.1, 0], dark);
    disc(g, 0.13, 0.15, [0, -0.1, 0.06], "#b4643d");
    for (let k = 0; k < 6; k++) part(g, [0.05, 0.22 + (k % 3) * 0.08, 0.04], [-0.12 + k * 0.05, -0.33 - (k % 3) * 0.05, 0.08], k % 2 ? "#3f8f4a" : "#57a85f", sphere);
  },
  hostel_washing_machine: (g) => {
    box(g, [0.7, 0.85, 0.65], [0, 0.425, 0], "#f2f2ee");
    box(g, [0.66, 0.1, 0.02], [0, 0.78, 0.33], "#d8d8d2");
    const door = disc(g, 0.21, 0.04, [0, 0.4, 0.33], "#9aa3a8");
    door.rotation.x = Math.PI / 2;
    const drum = new T.Group();
    drum.name = "drum";
    drum.position.set(0, 0.4, 0.34);
    g.add(drum);
    const glass = disc(drum, 0.16, 0.02, [0, 0, 0.012], "#33505a");
    glass.rotation.x = Math.PI / 2;
    box(drum, [0.24, 0.04, 0.01], [0, 0, 0.026], "#6d8f9a");
    part(g, [0.03, 0.03, 0.02], [0.24, 0.78, 0.345], "#2e86c1", sphere);
  },
  hostel_cooker: (g) => {
    box(g, [0.75, 0.82, 0.6], [0, 0.41, 0], "#e7e7e2");
    box(g, [0.75, 0.04, 0.6], [0, 0.84, 0], dark);
    box(g, [0.55, 0.35, 0.02], [0, 0.4, 0.305], "#2a2a2a");
    for (const x of [-0.18, 0.18]) {
      disc(g, 0.11, 0.025, [x, 0.87, 0], "#3a3a3a");
      const flame = part(g, [0.09, 0.05, 0.09], [x, 0.9, 0], "#4aa3ff", cylinder);
      flame.material = new T.MeshStandardMaterial({ color: "#4aa3ff", emissive: "#2f7bff", emissiveIntensity: 1.2, transparent: true, opacity: 0.85 });
      flame.name = "flame";
      flame.visible = false;
      part(g, [0.03, 0.03, 0.03], [x, 0.7, 0.315], dark, sphere);
    }
  },
  hostel_fridge: (g) => {
    box(g, [0.6, 0.9, 0.6], [0, 0.45, 0], "#f4f4f0");
    box(g, [0.02, 0.85, 0.02], [0, 0.46, 0.305], "#d0d0ca");
    box(g, [0.04, 0.25, 0.04], [0.24, 0.55, 0.32], "#9aa3a8");
    const light = part(g, [0.025, 0.025, 0.015], [-0.22, 0.82, 0.31], "#3a3a3a", sphere);
    light.material = new T.MeshStandardMaterial({ color: "#3a3a3a" });
    light.name = "fridgeLight";
  },
  hostel_microwave: (g) => {
    box(g, [0.5, 0.3, 0.38], [0, 0.15, 0], "#e9e9e4");
    box(g, [0.32, 0.22, 0.015], [-0.06, 0.15, 0.19], "#2a3438");
    box(g, [0.1, 0.24, 0.015], [0.19, 0.15, 0.19], "#c8c8c2");
  },
  // Migration 041. Bed frames are placed at the mattress top (y 0.32), so they reach down to the floor.
  hostel_bed_double: (g) => {
    box(g, [1.45, 0.22, 2.15], [0, -0.21, 0], "#7a5232");
    box(g, [1.38, 0.13, 2.06], [0, -0.055, 0], "#e7e2d6");
    box(g, [1.45, 0.75, 0.08], [0, 0.05, -1.08], "#6b4528");
    box(g, [1.45, 0.3, 0.06], [0, -0.17, 1.08], "#6b4528");
    for (const x of [-0.66, 0.66]) for (const z of [-1.02, 1.02]) box(g, [0.07, 0.12, 0.07], [x, -0.29, z], "#4a2f1b");
  },
  hostel_bed_king: (g) => {
    box(g, [1.6, 0.24, 2.25], [0, -0.2, 0], "#3a2f3f");
    box(g, [1.52, 0.15, 2.16], [0, -0.045, 0], "#f3efe6");
    box(g, [1.52, 0.03, 0.9], [0, 0.04, 0.55], "#7c3f58");
    box(g, [1.7, 1.05, 0.14], [0, 0.18, -1.15], "#4b3a52");
    for (const x of [-0.56, 0, 0.56]) box(g, [0.44, 0.78, 0.05], [x, 0.24, -1.07], "#5d4966");
    box(g, [1.6, 0.26, 0.08], [0, -0.17, 1.13], "#3a2f3f");
  },
  hostel_ac: (g) => {
    box(g, [0.9, 0.28, 0.22], [0, 0, 0.11], "#f4f6f6");
    box(g, [0.82, 0.04, 0.02], [0, -0.1, 0.225], "#c9d0d0");
    box(g, [0.86, 0.02, 0.18], [0, -0.135, 0.12], "#dde3e3");
    const light = part(g, [0.02, 0.02, 0.01], [0.36, 0.06, 0.225], "#3a3a3a", sphere);
    light.material = new T.MeshStandardMaterial({ color: "#3a3a3a" });
    light.name = "fridgeLight";
  },
  hostel_fridge_big: (g) => {
    box(g, [0.85, 1.75, 0.7], [0, 0.875, 0], "#cfd5d8");
    box(g, [0.012, 1.68, 0.02], [0, 0.88, 0.355], "#9aa3a8");
    for (const x of [-0.07, 0.07]) box(g, [0.035, 0.5, 0.04], [x, 1.05, 0.38], "#7b858a");
    const light = part(g, [0.025, 0.025, 0.015], [-0.3, 1.6, 0.36], "#3a3a3a", sphere);
    light.material = new T.MeshStandardMaterial({ color: "#3a3a3a" });
    light.name = "fridgeLight";
  },
  hostel_laptop: (g) => {
    box(g, [0.36, 0.02, 0.25], [0, 0.01, 0.01], "#9ca3af");
    box(g, [0.3, 0.004, 0.12], [0, 0.022, -0.02], "#374151");
    const lid = new T.Group();
    lid.position.set(0, 0.02, -0.115);
    lid.rotation.x = -0.32;
    g.add(lid);
    box(lid, [0.36, 0.23, 0.012], [0, 0.115, 0], "#9ca3af");
    const screen = part(lid, [0.32, 0.19, 0.004], [0, 0.118, 0.008], "#12201d");
    screen.material = new T.MeshStandardMaterial({ color: "#12201d" });
    screen.name = "tvScreen";
  },
  // Fashion and cars only appear as shop thumbnails.
  fashion_watch_casio: (g) => watch(g, "#1f2937", "#9ca3af"),
  fashion_watch_smart: (g) => watch(g, "#0f172a", "#38bdf8"),
  fashion_watch_gold: (g) => watch(g, "#b8860b", "#fde68a"),
  fashion_bag_backpack: (g) => {
    box(g, [0.34, 0.44, 0.18], [0, 0.22, 0], "#1d4ed8");
    box(g, [0.26, 0.18, 0.06], [0, 0.14, 0.11], "#1e3a8a");
    box(g, [0.04, 0.4, 0.03], [-0.1, 0.24, -0.1], "#111827");
    box(g, [0.04, 0.4, 0.03], [0.1, 0.24, -0.1], "#111827");
  },
  fashion_bag_handbag: (g) => {
    box(g, [0.36, 0.26, 0.13], [0, 0.13, 0], "#8b4513");
    box(g, [0.37, 0.04, 0.14], [0, 0.22, 0], "#6b3410");
    part(g, [0.13, 0.13, 0.02], [0, 0.36, 0], "#6b3410", torus);
  },
  fashion_bag_designer: (g) => {
    box(g, [0.34, 0.24, 0.14], [0, 0.12, 0], "#f5f0e6");
    box(g, [0.34, 0.08, 0.15], [0, 0.2, 0.01], "#c9a227");
    part(g, [0.1, 0.1, 0.02], [0, 0.33, 0], "#c9a227", torus);
    box(g, [0.06, 0.04, 0.01], [0, 0.17, 0.08], "#b8860b");
  },
  car_corolla: (g) => car(g, "#c0c4c8", 1),
  car_camry: (g) => car(g, "#1f2937", 1.05),
  car_lexus: (g) => car(g, "#7f1d1d", 1.12, true),
  car_gwagon: (g) => car(g, "#111111", 1.15, true, true),
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
