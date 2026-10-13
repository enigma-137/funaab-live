import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
export type V3 = [number, number, number];

// Small, repeatable surface maps; reference photos are never uploaded as textures.
function surface(
  kind: "grass" | "paving" | "brick" | "stone" | "road",
  repeat: number,
) {
  const size = 64,
    data = new Uint8Array(size * size * 4);
  let seed = 1977;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      let value = 218 + (seed % 30);
      if (
        kind === "brick" &&
        (y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0)
      )
        value = 155;
      if (
        kind === "paving" &&
        (y % 16 === 0 || (x + (Math.floor(y / 16) % 2) * 8) % 16 === 0)
      )
        value = 175;
      if (kind === "stone")
        value = 175 + ((Math.floor(x / 6) * 17 + Math.floor(y / 5) * 31) % 65);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const mat = (color: string, roughness = 0.9, map?: THREE.Texture) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...(map ? { map } : {}) });
export const campusMaterials = {
  cream: mat("#e8dab0"),
  ochre: mat("#e0bb64"),
  terracotta: mat("#ba8151"),
  brick: mat("#af5741", 0.95, surface("brick", 3)),
  stone: mat("#706d59", 1, surface("stone", 2)),
  ivory: mat("#f2ead9"),
  roof: mat("#89946b"),
  roofDark: mat("#686f61"),
  glass: mat("#294743", 0.42),
  shadow: mat("#20332d"),
  metal: mat("#53615c", 0.6),
  green: mat("#155642"),
  gold: mat("#d4b66b"),
  wood: mat("#887052"),
  bark: mat("#796749"),
  foliage: mat("#4f7844"),
  leafLight: mat("#6d914e"),
  leafDark: mat("#385f3e"),
  grass: mat("#788c51", 1, surface("grass", 90)),
  paving: mat("#b4b0a0", 1, surface("paving", 8)),
  road: mat("#545955", 1, surface("road", 7)),
  curb: mat("#e5e3d3"),
  curbDark: mat("#48504b"),
  flower: mat("#c37d58"),
  gravel: mat("#998b6c"),
  concrete: mat("#cfcbc0"),
  engBlue: mat("#3a5f86", 0.7),
  // Health Centre: pale-yellow render with maroon trim, after the real clinic.
  clinicWall: mat("#f2df8e"),
  clinicSkirt: mat("#b49c55"),
  clinicTrim: mat("#8e2633", 0.7),
  clinicRoof: mat("#8d8577", 0.8),
  clinicTile: mat("#dfe3dc", 0.6),
  clinicTileB: mat("#c9d1ca", 0.6),
  clinicSheet: mat("#f5f7f8", 0.85),
  clinicCurtain: mat("#8fc1d4", 0.9),
  clinicMint: mat("#7cb9a4", 0.8),
  clinicRed: mat("#c62828", 0.6),
  clinicSteel: mat("#c5ccd0", 0.35),
};
// Fronds must remain visible when the ground-level camera looks up through a crown.
campusMaterials.foliage.side = THREE.DoubleSide;
campusMaterials.leafLight.side = THREE.DoubleSide;
export type MaterialKey = keyof typeof campusMaterials;
export type Batch = { material: MaterialKey; geometry: THREE.BufferGeometry };

// Bake repeated windows, rails, roof panels and foliage into material batches.
// Only static geometry is merged; physics stays in the existing world components.
export class VisualBuilder {
  private parts = new Map<MaterialKey, THREE.BufferGeometry[]>();
  add(
    g: THREE.BufferGeometry,
    m: MaterialKey,
    p: V3 = [0, 0, 0],
    s: V3 = [1, 1, 1],
    r: V3 = [0, 0, 0],
  ) {
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...p),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
        new THREE.Vector3(...s),
      ),
    );
    // Standardize indexing/attributes so custom roofs merge with primitive pieces.
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    flat.deleteAttribute("uv1");
    if (!flat.getAttribute("uv"))
      flat.setAttribute(
        "uv",
        new THREE.BufferAttribute(
          new Float32Array(flat.getAttribute("position").count * 2),
          2,
        ),
      );
    const list = this.parts.get(m) || [];
    list.push(flat);
    this.parts.set(m, list);
  }
  box(p: V3, s: V3, m: MaterialKey, r: V3 = [0, 0, 0]) {
    this.add(new THREE.BoxGeometry(1, 1, 1), m, p, s, r);
  }
  orb(p: V3, s: V3, m: MaterialKey) {
    this.add(new THREE.IcosahedronGeometry(1, 1), m, p, s);
  }
  pole(
    p: V3,
    radius: number,
    height: number,
    m: MaterialKey,
    r: V3 = [0, 0, 0],
  ) {
    this.add(
      new THREE.CylinderGeometry(radius * 0.78, radius, height, 7),
      m,
      p,
      [1, 1, 1],
      r,
    );
  }
  roof(
    w: number,
    d: number,
    y: number,
    rise: number,
    m: MaterialKey,
    p: V3 = [0, 0, 0],
    hip = true,
  ) {
    const x = w / 2,
      z = d / 2,
      ridge = hip ? Math.max(0, x - z * 0.6) : x;
    const v = [
      [-x, y, -z],
      [x, y, -z],
      [x, y, z],
      [-x, y, z],
      [-ridge, y + rise, 0],
      [ridge, y + rise, 0],
    ];
    const faces = [
      [0, 1, 5],
      [0, 5, 4],
      [3, 4, 5],
      [3, 5, 2],
      [0, 4, 3],
      [1, 2, 5],
    ];
    const g = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        faces.flatMap((f) => [...f].reverse().flatMap((i) => v[i])),
        3,
      ),
    );
    g.computeVertexNormals();
    this.add(g, m, p);
  }
  window(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    frame: MaterialKey = "ivory",
  ) {
    this.box([x, y, z], [w + 0.13, h + 0.13, 0.13], frame);
    this.box([x, y, z + 0.08], [w, h, 0.045], "glass");
    this.box([x, y, z + 0.115], [0.045, h, 0.04], frame);
    for (let i = 1; i < Math.ceil(h / 0.65); i++)
      this.box(
        [x, y - h / 2 + (i * h) / Math.ceil(h / 0.65), z + 0.115],
        [w, 0.035, 0.04],
        frame,
      );
  }
  finish(): Batch[] {
    return [...this.parts].map(([material, pieces]) => {
      const geometry = mergeGeometries(pieces);
      pieces.forEach((g) => g.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return { material, geometry };
    });
  }
}
