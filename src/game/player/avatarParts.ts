import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StudentAvatar } from "../../config/avatar";
import { ellipsoids, silhouette, type Part } from "./avatarGeometry";

// Every rigid body part of a student, built from merged ellipsoids and lathe silhouettes.
// Kept free of React so scripts/test-character-model.ts can build every style combination.

/** Head group placement: smaller than the old cartoon head so proportions read as human. */
export const HEAD_Y = 1.75;
export const HEAD_SCALE = 0.88;

const LONG_SLEEVES = ["shirt", "hoodie", "jacket", "kaftan", "jumpsuit"];
const PUFF_SLEEVES = ["blouse", "gown"];
const OPEN_NECK = ["tank-top", "gown", "blouse"];

/** Which material each body part wears, derived from the outfit. */
export function avatarLook(a: StudentAvatar) {
  const gown = a.topStyle === "gown";
  /** One-piece outfits own the legs too, so the bottom is ignored. */
  const jumpsuit = a.topStyle === "jumpsuit";
  const onePiece = gown || jumpsuit;
  const bareLegs =
    gown || (!jumpsuit && ["skirt", "long-skirt", "shorts"].includes(a.bottomStyle));
  return {
    feminine: a.bodyType === "feminine",
    longSleeves: LONG_SLEEVES.includes(a.topStyle),
    sleeveless: a.topStyle === "tank-top",
    bareLegs,
    shorts: !onePiece && a.bottomStyle === "shorts",
    /** Garment hanging from the waist owned by the bottom (skirts). */
    skirt: !onePiece && ["skirt", "long-skirt"].includes(a.bottomStyle),
    longSkirt: !onePiece && a.bottomStyle === "long-skirt",
    jumpsuit,
    legMaterial: bareLegs ? ("skin" as const) : jumpsuit ? ("top" as const) : ("bottom" as const),
    /** Garment hanging from the waist owned by the top (gown, kaftan tunic). */
    tunic: gown || a.topStyle === "kaftan",
    hipsMaterial: onePiece ? ("top" as const) : ("bottom" as const),
    hair: a.hairstyle !== "bald",
    hairMaterial: a.hairstyle === "headwrap" ? ("top" as const) : ("hair" as const),
    sole: a.shoeStyle === "sneakers",
    foot: a.shoeStyle === "sandals",
    earrings: a.bodyType === "feminine" && a.hairstyle !== "long-weave",
  };
}
export type AvatarLook = ReturnType<typeof avatarLook>;

/** Lips are tinted skin, never the near-black used for brows. */
export function lipColor(a: StudentAvatar) {
  const fem = a.bodyType === "feminine";
  return new THREE.Color(a.skinTone).lerp(
    new THREE.Color(fem ? "#9e3b4e" : "#5a2a2a"),
    fem ? 0.5 : 0.32,
  );
}

/** Front-most z of a set of unrotated ellipsoids at (x, y), so features sit on the face. */
function frontZ(parts: Part[], x: number, y: number) {
  let z = 0;
  for (const [cx, cy, cz, sx, sy, sz] of parts) {
    const k = 1 - ((x - cx) / sx) ** 2 - ((y - cy) / sy) ** 2;
    if (k > 0) z = Math.max(z, cz + sz * Math.sqrt(k));
  }
  return z;
}

export function avatarWidth(a: StudentAvatar, seed: number) {
  const base = a.bodyType === "feminine" ? 0.235 : 0.28;
  const bulk = ["jacket", "hoodie"].includes(a.topStyle) ? 1.03 : 1;
  return base * bulk * (0.96 + (seed % 7) * 0.013);
}

export function buildAvatarGeometry(a: StudentAvatar, seed: number) {
  const look = avatarLook(a);
  const fem = look.feminine;
  const width = avatarWidth(a, seed);
  const g: Record<string, THREE.BufferGeometry> = {};
  const e = (name: string, parts: Part[], fine = false) => {
    if (parts.length) g[name] = ellipsoids(parts, fine);
  };
  const both = (f: (s: number) => Part[]) => [-1, 1].flatMap(f);

  // ---- Face -------------------------------------------------------------------------
  const fw = (fem ? 0.158 : 0.17) + (seed % 5) * 0.004;
  // One smooth lathe from chin to crown: overlapping ellipsoids left creases that read as a beard.
  const profile: [number, number][] = (
    fem
      ? [[0, -0.226], [0.045, -0.221], [0.08, -0.197], [0.106, -0.15], [0.128, -0.09], [0.146, -0.03], [fw, 0.04]]
      : [[0, -0.232], [0.055, -0.226], [0.094, -0.2], [0.122, -0.15], [0.142, -0.09], [0.158, -0.03], [fw, 0.04]]
  ).concat([[fw * 0.97, 0.12], [fw * 0.82, 0.19], [fw * 0.5, 0.228], [0, 0.24]]) as [number, number][];
  const depth = 1.06;
  const fz = (x: number, y: number) => {
    for (let i = 1; i < profile.length; i++) {
      const [r0, y0] = profile[i - 1],
        [r1, y1] = profile[i];
      if (y >= y0 && y <= y1) {
        const r = r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
        return depth * Math.sqrt(Math.max(0, r * r - x * x));
      }
    }
    return 0;
  };
  const noseScale = fem ? 0.86 : 1;
  const skull = silhouette(profile, depth, 32);
  const headParts = ellipsoids(
    [
      ...both((s) => [[s * fw * 0.98, -0.01, -0.01, 0.032, 0.058, 0.028] as Part]),
      // bridge, tip and nostril wings
      [0, -0.005, fz(0, -0.005) - 0.02, 0.017 * noseScale, 0.05, 0.026],
      [0, -0.046, fz(0, -0.046) - 0.004, 0.023 * noseScale, 0.021, 0.025],
      ...both(
        (s) =>
          [[s * 0.019 * noseScale, -0.054, fz(0.019, -0.054) - 0.01, 0.015 * noseScale, 0.013, 0.016]] as Part[],
      ),
    ],
    true,
  );
  g.head = mergeGeometries([skull, headParts])!;
  skull.dispose();
  headParts.dispose();
  const eyeX = 0.063,
    eyeY = 0.03;
  const eyeZ = fz(eyeX, eyeY);
  e(
    "white",
    both((s) => [[s * eyeX, eyeY, eyeZ - 0.006, 0.034, 0.018, 0.016]]),
  );
  const browZ = fz(0.068, 0.088) + 0.002;
  e("features", [
    // irises
    ...both((s) => [[s * eyeX, eyeY - 0.001, eyeZ + 0.005, 0.015, 0.016, 0.008] as Part]),
    // upper lid line; lashes with a little outer flick for feminine faces
    ...both((s) =>
      fem
        ? ([
            [s * eyeX, eyeY + 0.016, eyeZ + 0.002, 0.037, 0.0065, 0.011],
            [s * (eyeX + 0.035), eyeY + 0.021, eyeZ - 0.006, 0.011, 0.004, 0.008, 0, 0, s * 0.6],
          ] as Part[])
        : ([[s * eyeX, eyeY + 0.016, eyeZ + 0.001, 0.035, 0.004, 0.009]] as Part[]),
    ),
    // brows: straight and full, or thinner with an arch
    ...both((s) =>
      fem
        ? ([
            [s * 0.05, 0.085, browZ, 0.024, 0.0065, 0.01, 0, 0, s * 0.12],
            [s * 0.089, 0.088, browZ - 0.006, 0.025, 0.006, 0.01, 0, 0, s * -0.25],
          ] as Part[])
        : ([[s * 0.068, 0.085, browZ, 0.044, 0.012, 0.012, 0, 0, s * -0.05]] as Part[]),
    ),
  ]);
  const lip = fem ? 1.1 : 1;
  e("lips", [
    [0, -0.087, fz(0, -0.087) - 0.006, 0.032 * lip, 0.0095 * lip, 0.012],
    [0, -0.1, fz(0, -0.1) - 0.006, 0.028 * lip, 0.012 * lip, 0.013],
  ]);
  if (look.earrings)
    e("earrings", both((s) => [[s * (fw + 0.006), -0.074, 0, 0.012, 0.012, 0.012]]));

  // ---- Hair -------------------------------------------------------------------------
  const hair: Part[] = [];
  // Crown plus a lower piece that wraps the back and sides of the head down to the ears.
  const cap: Part = [0, 0.15, -0.01, fw + 0.01, 0.112, fw * 1.06 + 0.007];
  const capBack: Part = [0, 0.07, -0.03, fw + 0.008, 0.14, fw * 1.06 - 0.022];
  const style = a.hairstyle;
  const capped = !["bald", "headwrap", "big-afro"].includes(style);
  if (["short-afro", "short-natural", "natural-puff"].includes(style)) {
    for (let i = 0; i < 18; i++) {
      const t = i * 2.39996,
        y = 0.17 + (i % 3) * 0.045;
      hair.push([Math.cos(t) * 0.15, y, Math.sin(t) * 0.14 - 0.02, 0.091, 0.09, 0.085]);
    }
  }
  if (style === "fade") hair.push([0, 0.19, -0.016, 0.165, 0.075, 0.165]);
  if (["bun", "natural-puff"].includes(style))
    hair.push([0, 0.24, -0.12, style === "bun" ? 0.105 : 0.16, 0.14, 0.13]);
  if (["braids", "short-twists"].includes(style)) {
    const n = style === "braids" ? 18 : 12;
    for (let i = 0; i < n; i++) {
      const t = (i * Math.PI * 2) / n;
      const front = Math.sin(t) > 0.45;
      const long = style === "braids" && !front;
      hair.push([
        Math.cos(t) * 0.16,
        long ? -0.1 : 0.17,
        Math.sin(t) * 0.14 - 0.035,
        0.026,
        long ? 0.27 : 0.086,
        0.028,
      ]);
    }
  }
  if (style === "long-weave") {
    hair.push(
      ...both((s) => [[s * 0.158, -0.08, -0.03, 0.055, 0.25, 0.12] as Part]),
      [0, -0.1, -0.11, 0.17, 0.28, 0.08],
      [0.05, 0.175, 0.11, 0.12, 0.05, 0.06, 0, 0, -0.3],
    );
  }
  if (style === "ponytail") {
    hair.push(
      [0, 0.15, -0.17, 0.06, 0.06, 0.06],
      [0, 0.05, -0.215, 0.05, 0.11, 0.05, 0.35, 0, 0],
      [0, -0.1, -0.225, 0.045, 0.1, 0.045],
      [0, -0.21, -0.21, 0.034, 0.07, 0.034],
    );
  }
  if (style === "bob") {
    hair.push(
      ...both((s) => [[s * 0.162, -0.04, 0, 0.06, 0.15, 0.13] as Part]),
      [0, -0.02, -0.1, 0.185, 0.17, 0.1],
      [0, 0.155, 0.11, 0.15, 0.05, 0.055],
    );
  }
  if (style === "locs") {
    for (let i = 0; i < 16; i++) {
      const t = (i * Math.PI * 2) / 16;
      if (Math.sin(t) > 0.5) continue; // keep the face clear
      hair.push([Math.cos(t) * 0.165, -0.06, Math.sin(t) * 0.145 - 0.04, 0.033, 0.25, 0.033]);
    }
  }
  if (style === "big-afro") {
    hair.push([0, 0.2, -0.06, 0.265, 0.215, 0.235]);
    for (let i = 0; i < 10; i++) {
      const t = i * 2.39996;
      hair.push([Math.cos(t) * 0.19, 0.24 + (i % 2) * 0.06, Math.sin(t) * 0.16 - 0.07, 0.11, 0.1, 0.1]);
    }
  }
  if (style === "cornrows") {
    for (let i = -3; i <= 3; i++) {
      const x = i * 0.038;
      hair.push([x, 0.15 + 0.115 * Math.sqrt(1 - (x / (fw + 0.018)) ** 2) - 0.01, -0.02, 0.017, 0.022, fw * 1.06]);
    }
    if (fem) hair.push(...both((s) => [[s * 0.05, -0.08, -0.17, 0.028, 0.2, 0.028] as Part]));
  }
  if (style === "headwrap") {
    hair.push(
      [0, 0.15, -0.03, 0.196, 0.125, 0.188],
      [0, 0.24, -0.06, 0.2, 0.07, 0.17, -0.25, 0, 0],
      [0.11, 0.27, -0.07, 0.12, 0.08, 0.07, 0, 0, -0.55],
      [-0.1, 0.28, -0.04, 0.11, 0.07, 0.065, 0, 0, 0.55],
    );
  }
  // The cap hugs the scalp, so it needs the smooth sphere or the skin shows between facets.
  const hairPieces = [capped && ellipsoids([cap, capBack], true), hair.length && ellipsoids(hair)].filter(
    (p): p is THREE.BufferGeometry => !!p,
  );
  if (hairPieces.length) {
    g.hair = hairPieces.length > 1 ? mergeGeometries(hairPieces)! : hairPieces[0];
    if (hairPieces.length > 1) hairPieces.forEach((p) => p.dispose());
  }

  // ---- Torso ------------------------------------------------------------------------
  const w = width;
  const torsoRings: [number, number][] = fem
      ? [
          [0, 0.9],
          [w * 0.9, 0.9],
          [w * 0.93, 0.97],
          [w * 0.74, 1.13],
          [w * 0.86, 1.3],
          [w * 0.95, 1.4],
          [w * 0.86, 1.47],
          [0.104, 1.51],
          [0, 1.51],
        ]
      : [
          [0, 0.9],
          [w * 0.78, 0.9],
          [w * 0.84, 0.97],
          [w * 0.82, 1.1],
          [w * 0.97, 1.3],
          [w * 1.02, 1.4],
          [w * 0.92, 1.47],
          [0.12, 1.51],
          [0, 1.51],
        ];
  g.torso = silhouette(torsoRings, 0.66);
  /** Front of the torso at height y, so chest details sit on the cloth rather than inside it. */
  const chestZ = (y: number) => {
    for (let i = 1; i < torsoRings.length; i++) {
      const [r0, y0] = torsoRings[i - 1],
        [r1, y1] = torsoRings[i];
      if (y >= y0 && y <= y1 && y1 > y0) return (r0 + ((y - y0) / (y1 - y0)) * (r1 - r0)) * 0.66;
    }
    return 0.1;
  };
  if (fem)
    e("bust", both((s) => [[s * 0.058, 1.275, chestZ(1.275) - 0.056, 0.07, 0.062, 0.064]]), true);
  const neck: Part[] = [[0, 1.53, 0, fem ? 0.07 : 0.085, 0.12, fem ? 0.068 : 0.08]];
  e("neck", neck);
  e("hips", [[0, 0.89, 0, w * (fem ? 0.97 : 0.83), 0.14, fem ? 0.16 : 0.15]]);

  // Collars, plackets and other details in the darker top colour.
  const trim: Part[] = [];
  if (!OPEN_NECK.includes(a.topStyle)) trim.push([0, 1.489, 0.015, 0.115, 0.024, 0.085]);
  if (["shirt", "polo"].includes(a.topStyle))
    trim.push(...both((s) => [[s * 0.065, 1.45, 0.106, 0.05, 0.059, 0.017] as Part]));
  if (a.topStyle === "shirt") trim.push([0, 1.2, chestZ(1.2) + 0.002, 0.01, 0.24, 0.009]);
  if (a.topStyle === "hoodie")
    trim.push([0, 1.43, -0.128, 0.16, 0.12, 0.085], [0, 1.04, 0.15, 0.15, 0.068, 0.025]);
  if (a.topStyle === "jacket")
    trim.push(
      ...both((s) => [[s * 0.06, 1.37, chestZ(1.37) - 0.004, 0.032, 0.12, 0.016, 0, 0, s * 0.32] as Part]),
      [0, 0.94, 0, w * 0.88, 0.05, 0.16],
    );
  if (a.topStyle === "jersey")
    trim.push(
      ...both((s) => [[s * 0.035, 1.44, chestZ(1.44) - 0.004, 0.045, 0.012, 0.014, 0, 0, s * 0.8] as Part]),
      ...both((s) => [[s * w * 0.86, 1.2, 0, 0.016, 0.22, 0.05] as Part]),
    );
  // Coverall: zip down the front, chest pocket, a belt at the waist.
  if (a.topStyle === "jumpsuit")
    trim.push(
      [0, 1.18, chestZ(1.18) + 0.002, 0.009, 0.27, 0.008],
      [0.075, 1.33, chestZ(1.33) - 0.002, 0.045, 0.05, 0.01],
      [0, 0.95, 0, w * (fem ? 0.97 : 0.86), 0.035, fem ? 0.165 : 0.155],
    );
  if (a.topStyle === "tank-top") trim.push(...both((s) => [[s * 0.11, 1.48, 0, 0.03, 0.03, 0.1] as Part]));
  e("trim", trim);
  // White details: jacket inner shirt, jersey number.
  const white: Part[] = [];
  if (a.topStyle === "jacket") white.push([0, 1.36, chestZ(1.36) - 0.012, 0.04, 0.12, 0.016]);
  if (a.topStyle === "jersey") white.push(...both((s) => [[s * 0.03, 1.25, -chestZ(1.25) + 0.004, 0.012, 0.075, 0.01] as Part]));
  e("inner", white);
  if (a.topStyle === "kaftan")
    e("embroidery", [
      [0, 1.36, chestZ(1.36) - 0.004, 0.012, 0.1, 0.008],
      [0, 1.495, 0.02, 0.11, 0.018, 0.085],
    ]);
  // Short peplum for the blouse, longer hem for the jacket.
  if (a.topStyle === "blouse")
    g.flare = silhouette([[0, 0.92], [w * 1.04, 0.92], [w * 1.04, 0.94], [w * 0.8, 1.1], [0, 1.1]], 0.7);
  if (a.topStyle === "jacket")
    g.flare = silhouette([[0, 0.86], [w * 0.92, 0.86], [w * 0.92, 0.88], [w * 0.85, 1.05], [0, 1.05]], 0.68);

  // Hangs from the waist and folds forward when seated.
  if (a.topStyle === "gown")
    g.tunic = silhouette(
      [[0, 0.44], [0.37, 0.44], [0.37, 0.47], [w * 0.95, 0.94], [w * 0.8, 1.0], [0, 1.0]],
      0.74,
    );
  else if (a.topStyle === "kaftan")
    g.tunic = silhouette(
      [[0, 0.58], [0.33, 0.58], [0.33, 0.6], [w * 0.97, 0.95], [w * 0.85, 1.0], [0, 1.0]],
      0.7,
    );
  if (look.skirt)
    g.skirt = silhouette(
      [[0, 0.49], [0.32, 0.49], [0.32, 0.52], [0.24, 0.9], [0.2, 0.94], [0, 0.94]],
      0.72,
    );
  // A long skirt's lower half hangs from the knees so it follows the legs when seated.
  if (look.longSkirt)
    g.skirtLow = silhouette([[0, 0.1], [0.33, 0.1], [0.33, 0.13], [0.32, 0.52], [0, 0.52]], 0.72);

  // ---- Limbs ------------------------------------------------------------------------
  const limb = fem ? 0.88 : 1;
  g.upperLeg = silhouette(
    [
      [0, -0.435],
      [0.073 * limb, -0.435],
      [0.09 * limb, -0.31],
      [0.108 * (fem ? 0.97 : 1), -0.12],
      [0.098, 0.025],
      [0, 0.025],
    ],
    1,
  );
  g.lowerLeg = silhouette(
    [
      [0, -0.42],
      [0.058 * limb, -0.42],
      [0.063 * limb, -0.3],
      [0.08 * limb, -0.12],
      [0.072 * limb, 0.025],
      [0, 0.025],
    ],
    1,
  );
  if (look.shorts)
    g.shortLeg = silhouette([[0, -0.22], [0.112, -0.22], [0.114, -0.1], [0.108, 0.03], [0, 0.03]], 1);

  const shoe: Part[] = [];
  if (a.shoeStyle === "sneakers") {
    shoe.push([0, 0.067, 0.048, 0.095, 0.067, 0.17]);
    e("sole", [[0, 0.026, 0.048, 0.097, 0.026, 0.174]]);
  } else if (a.shoeStyle === "flats") shoe.push([0, 0.052, 0.05, 0.085 * limb, 0.052, 0.162]);
  else if (a.shoeStyle === "sandals") {
    shoe.push([0, 0.012, 0.05, 0.088, 0.012, 0.172], [0, 0.07, 0.085, 0.078, 0.022, 0.05]);
    e("foot", [[0, 0.048, 0.045, 0.072, 0.045, 0.155]]);
  } else if (a.shoeStyle === "heels")
    shoe.push([0, 0.075, 0.035, 0.074, 0.058, 0.148, 0.18, 0, 0], [0, 0.04, -0.075, 0.024, 0.045, 0.024]);
  else
    shoe.push([0, 0.072, 0.048, 0.095, 0.072, 0.17], [0, 0.19, 0, 0.088, 0.16, 0.088]);
  e("shoe", shoe);

  e("upperArm", [[0, -0.145, 0, 0.075 * limb, 0.19, 0.08 * limb]]);
  if (!look.sleeveless)
    e("sleeve", [
      PUFF_SLEEVES.includes(a.topStyle)
        ? [0, -0.07, 0, 0.09, 0.095, 0.09]
        : [0, -0.08, 0, ["hoodie", "jacket"].includes(a.topStyle) ? 0.098 : 0.089, 0.139, 0.09],
    ]);
  e("forearm", [[0, -0.12, 0, 0.059 * limb, 0.154, 0.065 * limb]]);
  e("hand", [
    [0, -0.275, 0.008, 0.056 * limb, 0.078, 0.033],
    [0.042 * limb, -0.25, 0.022, 0.019, 0.04, 0.023],
  ]);
  e("badge", [[-0.125, 1.31, 0.175, 0.037, 0.047, 0.014]]);
  e("beret", [[0, 0.205, -0.02, 0.215, 0.075, 0.19]]);

  // ---- Far LOD: a handful of draws per student -------------------------------------
  const head = (x: number, y: number, z: number, sx: number, sy: number, sz: number): Part => [
    x * HEAD_SCALE,
    HEAD_Y + y * HEAD_SCALE,
    z * HEAD_SCALE,
    sx * HEAD_SCALE,
    sy * HEAD_SCALE,
    sz * HEAD_SCALE,
  ];
  e("farSkin", [
    head(0, 0, 0, fw, 0.235, fw * 1.06),
    [-(w + 0.032), 1.13, 0, 0.065, 0.3, 0.065],
    [w + 0.032, 1.13, 0, 0.065, 0.3, 0.065],
  ]);
  const farHair: Part[] = [];
  if (style === "big-afro") farHair.push(head(0, 0.2, -0.06, 0.27, 0.22, 0.24));
  else if (style === "headwrap") farHair.push(head(0, 0.2, -0.03, 0.2, 0.16, 0.19));
  else if (look.hair) farHair.push(head(0, 0.12, -0.02, fw + 0.018, 0.13, fw * 1.06 + 0.012));
  if (["long-weave", "locs", "braids", "bob"].includes(style))
    farHair.push(head(0, -0.02, -0.13, 0.16, style === "bob" ? 0.13 : 0.2, 0.09));
  e("farHair", farHair);
  e("farLegs", [
    [-0.115, 0.48, 0, 0.1, 0.43, 0.1],
    [0.115, 0.48, 0, 0.1, 0.43, 0.1],
  ]);
  e("farHips", [[0, 0.87, 0, 0.22, 0.1, 0.14]]);
  e("farShoes", [
    [-0.115, 0.066, 0.048, 0.09, 0.066, 0.17],
    [0.115, 0.066, 0.048, 0.09, 0.066, 0.17],
  ]);
  return { g, look, width };
}
