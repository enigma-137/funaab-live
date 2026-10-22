import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useHostelStore } from "../../stores/hostelStore";
import { position } from "../../config/roomPlacement";
import { SURFACES } from "../../config/roomMakeover";
import { HEAT_SOURCES, SERVING_TABLE, dishFor, type DishLook } from "../../config/homeKitchen";

// Home kitchen (migration 054): what's served stands on the Small Table, plated like a restaurant,
// and a pot steams on the cooker while you cook. Shared materials keep it cheap to draw.
const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const M = {
  plate: mat("#fafafa", { roughness: 0.3 }),
  rim: mat("#2f8f5b", { roughness: 0.4 }),
  bowl: mat("#ffffff", { roughness: 0.35 }),
  jollof: mat("#d9541e", { roughness: 0.85 }),
  chicken: mat("#a8571f", { roughness: 0.7 }),
  plantain: mat("#f0a830", { roughness: 0.7 }),
  noodles: mat("#f2c75c", { roughness: 0.8 }),
  pasta: mat("#f3d58a", { roughness: 0.8 }),
  sauce: mat("#b8321c", { roughness: 0.7 }),
  white: mat("#fffdf5"),
  yolk: mat("#ffb81c", { roughness: 0.4 }),
  garri: mat("#f1e6c4", { roughness: 0.95 }),
  nut: mat("#b07a45"),
  bread: mat("#d79a4e", { roughness: 0.9 }),
  crumb: mat("#f6e2b8", { roughness: 0.95 }),
  mug: mat("#e94b3c", { roughness: 0.4 }),
  tea: mat("#6b3a1e", { roughness: 0.2 }),
  water: mat("#9fd8ff", { transparent: true, opacity: 0.8, roughness: 0.1 }),
  cap: mat("#1d6fd6"),
  glass: mat("#dff3ff", { transparent: true, opacity: 0.45, roughness: 0.05 }),
  metal: mat("#c9ced1", { metalness: 0.6, roughness: 0.3 }),
  pot: mat("#9aa3a1", { metalness: 0.4, roughness: 0.4 }),
  steam: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, depthWrite: false }),
};
const G = {
  plate: new THREE.CylinderGeometry(0.15, 0.12, 0.02, 24),
  plateRim: new THREE.TorusGeometry(0.145, 0.006, 6, 28),
  bowl: new THREE.CylinderGeometry(0.11, 0.065, 0.08, 20),
  fill: new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20),
  mound: new THREE.SphereGeometry(0.09, 14, 8),
  ball: new THREE.SphereGeometry(0.04, 10, 6),
  small: new THREE.SphereGeometry(0.012, 6, 4),
  slice: new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10),
  eggWhite: new THREE.CylinderGeometry(0.06, 0.06, 0.008, 16),
  yolk: new THREE.SphereGeometry(0.022, 10, 6),
  loaf: new THREE.BoxGeometry(0.22, 0.09, 0.1),
  sliceBread: new THREE.BoxGeometry(0.012, 0.085, 0.095),
  mug: new THREE.CylinderGeometry(0.04, 0.036, 0.09, 14),
  handle: new THREE.TorusGeometry(0.022, 0.006, 6, 12),
  bottle: new THREE.CylinderGeometry(0.032, 0.032, 0.19, 12),
  neck: new THREE.CylinderGeometry(0.013, 0.03, 0.05, 12),
  cap: new THREE.CylinderGeometry(0.015, 0.015, 0.02, 10),
  cup: new THREE.CylinderGeometry(0.035, 0.028, 0.1, 12, 1, true),
  fork: new THREE.BoxGeometry(0.012, 0.004, 0.17),
  pot: new THREE.CylinderGeometry(0.17, 0.15, 0.17, 20),
  lid: new THREE.CylinderGeometry(0.175, 0.175, 0.015, 20),
  puff: new THREE.SphereGeometry(0.05, 8, 6),
};

function Plate({ children }: { children?: React.ReactNode }) {
  return (
    <group>
      <mesh geometry={G.plate} material={M.plate} position={[0, 0.01, 0]} castShadow />
      <mesh geometry={G.plateRim} material={M.rim} position={[0, 0.021, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={G.fork} material={M.metal} position={[0.19, 0.004, 0]} />
      {children}
    </group>
  );
}

/** One dish, origin on the table top. */
export function Dish({ look }: { look: DishLook }) {
  switch (look) {
    case "jollof":
      return (
        <Plate>
          <mesh geometry={G.mound} material={M.jollof} position={[-0.025, 0.03, 0]} scale={[1.1, 0.45, 1]} />
          <mesh geometry={G.ball} material={M.chicken} position={[0.07, 0.045, 0.03]} scale={[1.5, 0.8, 1]} />
          {[-0.02, 0.02, 0.06].map((x, i) => (
            <mesh key={i} geometry={G.slice} material={M.plantain} position={[x, 0.03, -0.08]} rotation={[0.2, 0, 0]} />
          ))}
        </Plate>
      );
    case "spaghetti":
      return (
        <Plate>
          <mesh geometry={G.mound} material={M.pasta} position={[0, 0.03, 0]} scale={[1.1, 0.4, 1]} />
          <mesh geometry={G.mound} material={M.sauce} position={[0, 0.055, 0]} scale={[0.55, 0.2, 0.55]} />
          {[[-0.03, 0.02], [0.04, -0.03], [0.01, 0.05]].map(([x, z], i) => (
            <mesh key={i} geometry={G.ball} material={M.chicken} position={[x, 0.06, z]} scale={0.45} />
          ))}
        </Plate>
      );
    case "eggs":
      return (
        <Plate>
          {[-0.045, 0.05].map((x, i) => (
            <group key={i} position={[x, 0.024, i ? 0.03 : -0.02]}>
              <mesh geometry={G.eggWhite} material={M.white} scale={[1, 1, 0.85]} />
              <mesh geometry={G.yolk} material={M.yolk} position={[0.008, 0.006, 0]} scale={[1, 0.5, 1]} />
            </group>
          ))}
        </Plate>
      );
    case "noodles":
    case "garri":
      return (
        <group position={[0, 0.04, 0]}>
          <mesh geometry={G.bowl} material={M.bowl} castShadow />
          <mesh geometry={G.fill} material={look === "noodles" ? M.noodles : M.garri} position={[0, 0.032, 0]} />
          {look === "noodles" ? (
            <group position={[0.03, 0.04, 0.01]}>
              <mesh geometry={G.eggWhite} material={M.white} scale={0.6} />
              <mesh geometry={G.yolk} material={M.yolk} scale={[0.7, 0.4, 0.7]} />
            </group>
          ) : (
            [[0.03, 0.02], [-0.02, 0.04], [0.0, -0.04], [-0.05, -0.01], [0.05, -0.03]].map(([x, z], i) => (
              <mesh key={i} geometry={G.small} material={M.nut} position={[x, 0.04, z]} />
            ))
          )}
        </group>
      );
    case "bread":
      return (
        <Plate>
          <mesh geometry={G.loaf} material={M.bread} position={[-0.02, 0.065, 0]} castShadow />
          {[0.1, 0.115].map((x, i) => (
            <mesh key={i} geometry={G.sliceBread} material={M.crumb} position={[x, 0.062, 0]} rotation={[0, 0, -0.25 - i * 0.15]} />
          ))}
          <group position={[0.02, 0, 0.17]}>
            <mesh geometry={G.mug} material={M.mug} position={[0, 0.045, 0]} castShadow />
            <mesh geometry={G.fill} material={M.tea} position={[0, 0.085, 0]} scale={0.37} />
            <mesh geometry={G.handle} material={M.mug} position={[0.045, 0.045, 0]} />
          </group>
        </Plate>
      );
    case "water":
      return (
        <group>
          <mesh geometry={G.bottle} material={M.water} position={[0, 0.095, 0]} castShadow />
          <mesh geometry={G.neck} material={M.water} position={[0, 0.215, 0]} />
          <mesh geometry={G.cap} material={M.cap} position={[0, 0.25, 0]} />
          <group position={[0.09, 0, 0.04]}>
            <mesh geometry={G.cup} material={M.glass} position={[0, 0.05, 0]} />
            <mesh geometry={G.fill} material={M.water} position={[0, 0.04, 0]} scale={0.32} />
          </group>
        </group>
      );
  }
}

/** A lidded pot with steam rising, while something cooks. */
function SteamingPot() {
  const puffs = useRef<THREE.Group>(null);
  const phases = useMemo(() => [0, 0.33, 0.66], []);
  useFrame(({ clock }) => {
    puffs.current?.children.forEach((m, i) => {
      const t = (clock.elapsedTime * 0.7 + phases[i]) % 1;
      m.position.set(Math.sin(t * 6 + i) * 0.04, 0.2 + t * 0.5, Math.cos(t * 5 + i) * 0.03);
      m.scale.setScalar(0.6 + t * 1.4);
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - t);
    });
  });
  return (
    <group>
      <mesh geometry={G.pot} material={M.pot} position={[0, 0.085, 0]} castShadow />
      <mesh geometry={G.lid} material={M.pot} position={[0, 0.18, 0]} />
      <group ref={puffs}>
        {phases.map((_, i) => (
          <mesh key={i} geometry={G.puff} material={M.steam.clone()} />
        ))}
      </group>
    </group>
  );
}

/** The table's meal and the cooking pot, placed in the room's coordinates. */
export function HomeMeal() {
  const snapshot = useHostelStore((s) => s.snapshot);
  const cooking = useHostelStore((s) => s.cooking);
  const placements = snapshot?.placements || [];
  const table = placements.find((p) => p.item_id === SERVING_TABLE);
  const heat = placements.find((p) => HEAT_SOURCES.includes(p.item_id));
  const food = dishFor(snapshot?.room.served_food);
  const drink = dishFor(snapshot?.room.served_drink);
  const top = SURFACES[SERVING_TABLE];
  return (
    <>
      {table && (food || drink) && (
        <group position={position(table)} rotation={[0, (table.rotation * Math.PI) / 180, 0]}>
          {/* Scaled up a little so a plate reads from the room camera, as at Floral World. */}
          {food && (
            <group position={[-0.18, top, 0.08]} scale={1.4}>
              <Dish look={food.look} />
            </group>
          )}
          {drink && (
            <group position={[0.36, top, -0.12]} scale={1.4}>
              <Dish look={drink.look} />
            </group>
          )}
        </group>
      )}
      {heat && cooking && (
        <group position={position(heat)} rotation={[0, (heat.rotation * Math.PI) / 180, 0]}>
          <group position={[heat.item_id === "hostel_cooker" ? -0.18 : 0, heat.item_id === "hostel_cooker" ? 0.86 : 0.66, 0]}>
            <SteamingPot />
          </group>
        </group>
      )}
    </>
  );
}
