import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { VisualBuilder, V3 } from "./campusVisualGeometry";
import { StaticBatches } from "./CampusArchitecture";
import { CampusSign } from "./CampusSign";
import { useLibraryStore } from "../../stores/libraryStore";

// Static books and furniture share material batches, rather than one draw call per book.
const b = new VisualBuilder();
const obstacles: { p: V3; s: V3 }[] = [];
function solid(p: V3, s: V3, material: Parameters<VisualBuilder["box"]>[2]) {
  b.box(p, s, material);
  obstacles.push({ p, s });
}
solid([0, -0.2, 0], [24, 0.4, 24], "ivory");
solid([0, 2, -12], [24, 4, 0.3], "cream");
solid([-12, 1, 0], [0.3, 2, 24], "cream");
solid([12, 1, 0], [0.3, 2, 24], "cream");
// Low foreground walls and an open roof keep the third-person camera readable.
solid([-7, 0.5, 12], [10, 1, 0.3], "cream");
solid([7, 0.5, 12], [10, 1, 0.3], "cream");
b.box([0, 0.015, 4], [5, 0.025, 14], "green");
for (const x of [-8, 8])
  for (const z of [-8, -3, 2]) {
    solid([x, 1.4, z], [3.5, 2.8, 0.65], "wood");
    for (let shelf = 0; shelf < 4; shelf++) {
      b.box([x, 0.25 + shelf * 0.65, z + 0.38], [3.6, 0.08, 0.85], "gold");
      for (let i = 0; i < 13; i++) {
        const h = 0.34 + ((i + shelf) % 3) * 0.06;
        b.box(
          [x - 1.5 + i * 0.245, 0.3 + shelf * 0.65 + h / 2, z + 0.39],
          [0.18, h, 0.32],
          (["green", "terracotta", "ivory", "ochre"] as const)[(i + shelf) % 4],
        );
      }
    }
  }
for (const x of [-3.5, 3.5])
  for (const z of [-6, 1]) {
    solid([x, 0.9, z], [3.2, 0.16, 2], "wood");
    for (const dx of [-1.3, 1.3])
      for (const dz of [-0.7, 0.7])
        b.box([x + dx, 0.43, z + dz], [0.12, 0.86, 0.12], "metal");
    b.box([x, 0.995, z], [0.5, 0.05, 0.65], "green");
    for (const dz of [-1.6, 1.6])
      for (const dx of [-0.8, 0.8]) {
        solid([x + dx, 0.48, z + dz], [0.72, 0.12, 0.72], "green");
        b.box(
          [x + dx, 0.85, z + dz + Math.sign(dz) * 0.3],
          [0.72, 0.65, 0.1],
          "wood",
        );
        for (const lx of [-0.26, 0.26])
          b.box([x + dx + lx, 0.22, z + dz], [0.08, 0.44, 0.6], "metal");
      }
  }
solid([-7, 1, 8], [4, 2, 1.5], "wood");
for (const x of [-8, -4, 4, 8]) b.window(x, 2.45, -11.8, 2.5, 1.8);
const batches = b.finish();
export function LibraryEnvironment() {
  return (
    <group>
      <StaticBatches batches={batches} />
      <RigidBody type="fixed" colliders={false}>
        {obstacles.map(({ p, s }, i) => (
          <CuboidCollider
            key={i}
            position={p}
            args={[s[0] / 2, s[1] / 2, s[2] / 2]}
          />
        ))}
      </RigidBody>
      <CampusSign
        position={[0, 3, -11.7]}
        width={6}
        height={0.9}
        title="THE READING ROOM"
        subtitle="'Nimbe Adedipe Library • FUNAAB"
      />
      <CampusSign
        position={[-7, 1.7, 8.8]}
        width={3}
        height={0.6}
        title="LIBRARY DESK"
        subtitle="Mon–Fri · 8am–5pm"
      />
      <group
        rotation={[0, Math.PI, 0]}
        position={[0, 1.4, 11.9]}
        onClick={(e) => {
          e.stopPropagation();
          useLibraryStore.getState().leave();
        }}
      >
        <CampusSign
          position={[0, 0, 0]}
          width={3}
          height={0.7}
          title="EXIT TO CAMPUS"
          subtitle="See you next study day"
        />
      </group>
    </group>
  );
}
