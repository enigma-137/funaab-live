import {
  CylinderGeometry,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import React, { useMemo, useEffect } from "react";
import {
  VisualBuilder,
  campusMaterials,
  type Batch,
} from "./campusVisualGeometry";
import { CampusSign } from "./CampusSign";
export type LandmarkId = "colerm" | "colfhec" | "colvet" | "library";
export function StaticBatches({ batches }: { batches: Batch[] }) {
  return (
    <group dispose={null}>
      {batches.map((b) => (
        <mesh
          key={b.material}
          geometry={b.geometry}
          material={campusMaterials[b.material]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
export function buildLandmark(id: LandmarkId): Batch[] {
  const b = new VisualBuilder();
  if (id === "colerm") {
    b.box([0, 3.5, 0], [14, 7, 10], "ochre");
    b.roof(14.7, 10.7, 7, 1, "roofDark");
    for (const y of [0.35, 3.1, 5.65])
      b.box([0, y, 5.06], [14, 0.28, 0.22], "terracotta");
    for (const x of [-6.8, -3.8, 3.8, 6.8])
      b.box([x, 3.5, 5.11], [0.3, 7, 0.3], "terracotta");
    b.box([0, 5.2, 5.15], [4.5, 3.6, 0.35], "stone");
    // Front-facing triangular stone pediment, matching the photograph's centre gable.
    // Gable apex faces the arrival court (+Z).
    b.box([-1.275, 7.75, 4.85], [2.97, 0.16, 1.75], "roofDark", [0, 0, 0.532]);
    b.box([1.275, 7.75, 4.85], [2.97, 0.16, 1.75], "roofDark", [0, 0, -0.532]);
    const pediment = new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute(
        [-2.55, 7, 5.57, 2.55, 7, 5.57, 0, 8.5, 5.57],
        3,
      ),
    );
    pediment.computeVertexNormals();
    b.add(pediment, "stone");

    for (const side of [-1, 1])
      for (const y of [1.5, 5])
        b.window(side * 5.1, y, 5.22, 2.65, 0.66, "terracotta");
    b.window(0, 4.95, 5.38, 3.45, 1.45, "terracotta");
    b.box([0, 1.3, 5.035], [2.45, 2.6, 0.075], "shadow");
    for (const x of [-1.5, 1.5])
      b.box([x, 1.25, 5.3], [0.38, 2.5, 0.65], "terracotta");
    b.add(
      new CylinderGeometry(0.4, 0.4, 0.055, 24),
      "gold",
      [0, 7.45, 5.64],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
  }
  if (id === "colfhec") {
    // Preserve the existing open doorway and perimeter walls rather than filling its interior.
    b.box([0, 4, -6.6], [20, 8, 0.8], "cream");
    for (const x of [-9.6, 9.6]) b.box([x, 4, 0], [0.8, 8, 14], "cream");
    for (const x of [-6.25, 6.25]) b.box([x, 4, 6.6], [7.5, 8, 0.8], "cream");
    b.box([0, 5.5, 6.6], [5, 5, 0.8], "cream");
    b.roof(21, 15, 8, 1.35, "roof");
    b.box([0, 7.98, 0], [21, 0.18, 15], "roofDark");
    for (const x of [-8.5, -5.7, -3.4, 3.4, 5.7, 8.5])
      b.window(x, 4.25, 7.05, 1.12, 5.55);
    for (const x of [-7, 7]) b.pole([x, 3.5, 7.3], 0.3, 7, "ivory");
    for (const x of [-2.5, 2.5])
      b.box([x, 3.6, 7.9], [0.34, 7.2, 0.42], "ivory");
    b.pole([0, 7.3, 7.0], 3.1, 0.38, "ivory");
    b.window(0, 5.55, 7.06, 3.55, 1.65);
    b.box([0, 0.025, 0], [19.2, 0.05, 13.2], "paving");
    for (const x of [-7, -4.4, 4.4, 7]) {
      b.box([x, 5.5, 7.22], [0.65, 0.4, 0.28], "curb");
      b.box([x, 5.5, 7.38], [0.42, 0.24, 0.02], "metal");
    }
    for (const x of [-6.25, 6.25])
      b.box([x, 0.22, 7.015], [7.5, 0.3, 0.04], "terracotta");
  }
  if (id === "colvet") {
    for (const x of [-9.5, 9.5]) b.box([x, 2.5, 0], [3, 5, 16], "cream");
    b.box([0, 4.2, 1], [16, 8.4, 14], "brick");
    b.box([0, 8.5, 1], [17, 0.22, 14.8], "ivory");
    b.roof(17.5, 15, 8.62, 0.55, "roofDark", [0, 0, 1]);
    for (const x of [-9.5, 9.5]) b.roof(4, 16.5, 5, 0.65, "roof");
    b.box([0, 9.05, -1], [5.5, 0.9, 4], "glass");
    b.roof(6.7, 5.2, 9.5, 1, "ivory", [0, 0, -1]);
    for (const x of [-5.6, -3.25, 3.25, 5.6])
      b.window(x, 6.45, 8.07, 0.85, 2.35, "metal");
    for (const x of [-9.6, -7, -5.2, 5.2, 7, 9.6])
      b.window(x, 1.75, 8.08, 1.1, 1.5, "cream");
    b.box([0, 1.6, 8.035], [5.7, 3.2, 0.05], "shadow");
    for (const x of [-3.15, 3.15])
      b.box([x, 1.7, 8.3], [0.55, 3.4, 0.6], "cream");
    b.box([0, 3.45, 8.4], [6.8, 0.3, 1.2], "cream");
    b.box([0, 4.3, 8.6], [4.1, 0.15, 1.6], "roofDark");
    for (const x of [-1.5, 1.5])
      b.box([x, 3.95, 8.6], [0.085, 0.6, 0.085], "metal");
    b.add(
      new CylinderGeometry(0.68, 0.68, 0.055, 24),
      "green",
      [0, 6.7, 8.16],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
  }
  if (id === "library") {
    // Broad base and narrowing terrace bands follow the library's distinctive silhouette.
    b.box([0, 1.1, -2], [24, 2.2, 12], "terracotta");
    for (let i = 0; i < 5; i++) {
      const w = 24 - i * 2.05,
        d = 12 - i * 0.85,
        y = 2.2 + i * 1.5;
      b.box([0, y + 0.55, -2], [w - 0.2, 1.1, d - 0.1], "glass");
      b.box([0, y + 1.2, -2], [w + 0.4, 0.45, d + 0.4], "cream");
      for (let x = -w / 2 + 1; x < w / 2; x += 1.5)
        b.box([x, y + 0.55, -2 + d / 2], [0.075, 1.0, 0.1], "ivory");
      for (const side of [-1, 1])
        b.box(
          [side * (w / 2 - 0.4), y + 0.55, -2 + d / 2 + 0.3],
          [0.24, 1.75, 0.3],
          "terracotta",
          [0, 0, side * 0.15],
        );
    }
    b.roof(15.9, 9.1, 9.68, 0.32, "cream", [0, 0, -2]);
    b.roof(3.4, 3.4, 10, 1.6, "glass", [0, 0, -2]);
    for (const side of [-1, 1])
      b.box([side * 6.6, 6.15, 3.42], [0.35, 7.8, 0.35], "terracotta", [
        0,
        0,
        side * -0.12,
      ]);
    // Entry remains at the existing recessed front wall, leaving the lobby approach clear.
    b.window(0, 1.45, 4.07, 6.2, 2.8, "metal");
    for (const x of [-4.45, 4.45])
      b.box([x, 1.95, 5.5], [0.8, 3.9, 2.8], "ivory");
    b.box([0, 3.95, 5.5], [9.7, 0.65, 2.8], "ivory");
    b.box([0, 3.25, 6.9], [7.2, 0.55, 0.12], "terracotta");
    for (const x of [-11.6, 11.6]) b.box([x, 0.55, 6], [0.8, 1.1, 4], "ivory");
  }
  // Modest side-wall windows keep oblique approach views from reading as blank boxes.
  if (id !== "library") {
    const sideX = id === "colerm" ? 7 : id === "colfhec" ? 10 : 11;
    for (const side of [-1, 1])
      for (const z of [-4, 0, 3]) {
        const y = id === "colvet" ? 2.3 : 4.4,
          h = id === "colfhec" ? 3.7 : 1.5;
        b.box([side * (sideX + 0.045), y, z], [0.09, h + 0.14, 1.45], "ivory");
        b.box([side * (sideX + 0.1), y, z], [0.035, h, 1.3], "glass");
        b.box([side * (sideX + 0.125), y, z], [0.04, h, 0.055], "ivory");
        for (let k = 1; k < 4; k++)
          b.box(
            [side * (sideX + 0.125), y - h / 2 + (k * h) / 4, z],
            [0.04, 0.045, 1.3],
            "ivory",
          );
      }
  }
  return b.finish();
}
const signs: Record<
  LandmarkId,
  {
    p: [number, number, number];
    w: number;
    h: number;
    title: string;
    sub: string;
  }
> = {
  colerm: {
    p: [0, 2.85, 5.72],
    w: 5.3,
    h: 0.55,
    title: "COLERM",
    sub: "ENVIRONMENTAL RESOURCES MANAGEMENT",
  },
  colfhec: {
    p: [0, 7.35, 9.8],
    w: 5.3,
    h: 0.55,
    title: "COLFHEC",
    sub: "FOOD SCIENCE & HUMAN ECOLOGY",
  },
  colvet: {
    p: [0, 6.7, 8.23],
    w: 1.08,
    h: 0.42,
    title: "COLVET",
    sub: "VETERINARY MEDICINE",
  },
  library: {
    p: [0, 3.96, 6.99],
    w: 8.9,
    h: 0.6,
    title: "'NIMBE ADEDIPE LIBRARY",
    sub: "",
  },
};
export function CampusArchitecture({ id }: { id: LandmarkId }) {
  const batches = useMemo(() => buildLandmark(id), [id]);
  useEffect(
    () => () => batches.forEach((b) => b.geometry.dispose()),
    [batches],
  );
  const sign = signs[id];
  return (
    <group name={`reference-${id}`}>
      <StaticBatches batches={batches} />
      <CampusSign
        position={sign.p}
        width={sign.w}
        height={sign.h}
        title={sign.title}
        subtitle={sign.sub}
        tone={id === "library" ? "cream" : "green"}
      />
    </group>
  );
}
