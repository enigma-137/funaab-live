import React, { useMemo } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useAuthStore } from "../../stores/authStore";
import { useInputStore } from "../../stores/inputStore";
import {
  candidate,
  placementError,
  position,
  extent,
} from "../../config/roomPlacement";
import { HostelItemModel } from "./HostelItemModel";
import { HomeMeal } from "./HomeMeal";
import { useHostelStore } from "../../stores/hostelStore";
import { hostelItem } from "../../config/hostelShop";
import { HostelCompound } from "./HostelCompound";
import { hostelRoomFor } from "../../config/hostelCompound";
import { ROOM_SIZES, floorById, paintById, roomSizeOf, type FloorStyle } from "../../config/roomMakeover";
import { useDayNight } from "./dayNight";

/** Floor finish: a canvas texture per design (no image downloads), repeated across the floor. */
function useFloorMaterial(style: FloorStyle, width: number, depth: number) {
  const material = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = style.base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = style.accent;
    g.strokeStyle = style.accent;
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (style.pattern === "speckle") for (let i = 0; i < 260; i++) g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 1 + rnd() * 3);
    if (style.pattern === "planks") {
      g.lineWidth = 2;
      for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
      for (let row = 0; row < 4; row++) { const x = (row % 2) * 64 + 20; g.beginPath(); g.moveTo(x, row * 32); g.lineTo(x, row * 32 + 32); g.stroke(); }
      g.globalAlpha = 0.15;
      for (let i = 0; i < 40; i++) g.fillRect(0, rnd() * 128, 128, 1);
      g.globalAlpha = 1;
    }
    if (style.pattern === "checker") { g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); }
    if (style.pattern === "carpet") { g.globalAlpha = 0.35; for (let i = 0; i < 900; i++) g.fillRect(rnd() * 128, rnd() * 128, 1, 2); g.globalAlpha = 1; }
    if (style.pattern === "plain") { g.globalAlpha = 0.25; for (let i = 0; i < 120; i++) g.fillRect(rnd() * 128, rnd() * 128, 2, 2); g.globalAlpha = 1; }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // ~1 m per tile (checker tiles 0.5 m; planks run 2 m).
    const metres = style.pattern === "checker" ? 1.2 : style.pattern === "planks" ? 2 : 1;
    t.repeat.set(width / metres, depth / metres);
    return new THREE.MeshStandardMaterial({ map: t, roughness: style.pattern === "checker" ? 0.4 : 0.9 });
  }, [style.id, width, depth]);
  React.useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  return material;
}
function Box({
  pos,
  size,
  color,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
/** Off-campus lodge finishes: tiled floor lines, barred window, ceiling fan, own bathroom door.
 *  Wall-mounted only, so the furniture area and placement rules are exactly the hostel's. */
function LodgeDecor({ halfX }: { halfX: number }) {
  return (
    <group name="lodge-decor">
      {[-3, -1.5, 0, 1.5, 3].map((v) => (
        <Box key={`z${v}`} pos={[0, 0.006, v]} size={[halfX * 2, 0.006, 0.025]} color="#c4ad84" />
      ))}
      {[-4.5, -3, -1.5, 0, 1.5, 3, 4.5].filter((v) => Math.abs(v) < halfX).map((v) => (
        <Box key={`x${v}`} pos={[v, 0.006, 0]} size={[0.025, 0.006, 8]} color="#c4ad84" />
      ))}
      {[-2.4, -2.1, -1.9, -1.6].map((x) => <Box key={x} pos={[x, 1.9, -3.86]} size={[0.035, 1, 0.03]} color="#475569" />)}
      <Box pos={[halfX - 0.08, 1.05, -1.6]} size={[0.06, 2.1, 0.95]} color="#7c4a1e" />
      <Box pos={[halfX - 0.12, 1.05, -1.25]} size={[0.04, 0.05, 0.05]} color="#facc15" />
      <Box pos={[0, 2.9, 1]} size={[0.05, 0.2, 0.05]} color="#e5e7eb" />
      <Box pos={[0, 2.78, 1]} size={[1.4, 0.03, 0.14]} color="#f8fafc" />
      <Box pos={[0, 2.78, 1]} size={[0.14, 0.03, 1.4]} color="#f8fafc" />
    </group>
  );
}

/** Royal Gardens Estate finishes: marble tiles, crown moulding, framed art and pendant lights.
 *  Wall-mounted only, so placement rules stay those of a large room. */
function EstateDecor({ halfX, marble }: { halfX: number; marble: boolean }) {
  return (
    <group name="estate-decor">
      {marble && [-3, -1, 1, 3].map((v) => <Box key={`z${v}`} pos={[0, 0.005, v]} size={[halfX * 2, 0.005, 0.02]} color="#cfc7b8" />)}
      {marble && Array.from({ length: Math.floor(halfX) * 2 + 1 }, (_, i) => i - Math.floor(halfX)).map((v) => (
        <Box key={`x${v}`} pos={[v * 1, 0.005, 0]} size={[0.02, 0.005, 8]} color="#cfc7b8" />
      ))}
      <Box pos={[0, 2.92, -3.9]} size={[halfX * 2, 0.12, 0.1]} color="#d6c8a8" />
      {[-1, 1].map((s) => <Box key={s} pos={[s * (halfX - 0.08), 2.92, 0]} size={[0.1, 0.12, 8]} color="#d6c8a8" />)}
      <Box pos={[2.6, 1.8, -3.9]} size={[1.6, 1.0, 0.04]} color="#8a6a3b" />
      <Box pos={[2.6, 1.8, -3.87]} size={[1.4, 0.82, 0.02]} color="#2f6f8f" />
      <Box pos={[2.6, 1.62, -3.86]} size={[1.4, 0.3, 0.02]} color="#d39b4a" />
      {[-halfX / 2, halfX / 2].map((x) => (
        <group key={x} position={[x, 0, 0.5]}>
          <Box pos={[0, 2.75, 0]} size={[0.02, 0.5, 0.02]} color="#111827" />
          <mesh position={[0, 2.45, 0]}><sphereGeometry args={[0.16, 12, 8]} /><meshBasicMaterial color="#fde9b3" toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

function FloorFinish({ style, width }: { style: FloorStyle; width: number }) {
  const material = useFloorMaterial(style, width, 8);
  return (
    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material} receiveShadow>
      <planeGeometry args={[width, 8]} />
    </mesh>
  );
}

/** Back-wall window: sky by day, dark blue with a moon glint at night. */
function RoomWindow() {
  const night = useDayNight((s) => s.night);
  const glass = "#" + new THREE.Color("#8dbfc1").lerp(new THREE.Color("#0f1a33"), night).getHexString();
  return (
    <>
      <mesh position={[-2, 1.9, -3.9]}>
        <boxGeometry args={[1.5, 1, 0.1]} />
        <meshBasicMaterial color={glass} toneMapped={false} />
      </mesh>
      {night > 0.5 && (
        <mesh position={[-1.6, 2.15, -3.84]}>
          <circleGeometry args={[0.07, 12]} />
          <meshBasicMaterial color="#f5f1d6" toneMapped={false} />
        </mesh>
      )}
      <Box pos={[-2, 1.9, -3.82]} size={[0.045, 1, 0.035]} color="#eef2e4" />
    </>
  );
}

/** Ceiling bulb: always visible; at night it's the room's light (dim daylight ambient is set in WorldScene). */
function RoomLights({ halfX }: { halfX: number }) {
  const night = useDayNight((s) => s.night);
  return (
    <>
      <mesh position={[0, 2.8, -1]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#fff4be" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 2.6, -0.5]} color="#ffd9a0" intensity={night * 7} distance={halfX * 2.6} decay={1.8} />
      {halfX > 4 && <pointLight position={[0, 2.6, 2]} color="#ffe3a8" intensity={night * 4} distance={halfX * 2} decay={1.6} />}
    </>
  );
}

export function HostelEnvironment() {
  const { owner, snapshot, preview, travel, selected, pose } = useHostelStore();
  const cooking = useHostelStore((s) => !!s.cooking);
  const user = useAuthStore((s) => s.user);
  const select = (id: string) => {
    if (preview || pose) return;
    useInputStore.getState().clearTargetDestination();
    useHostelStore.setState({ selected: id });
  };
  if (!owner) return <HostelCompound myRoom={user ? hostelRoomFor(user.id).room : null} />;
  const lodge = snapshot?.room.style === "lodge";
  const estate = snapshot?.room.style === "estate";
  const size = roomSizeOf(snapshot?.room.room_size, snapshot?.room.style);
  const { halfX } = ROOM_SIZES[size];
  const width = halfX * 2;
  const paint = paintById(snapshot?.room.wall_paint);
  const floorStyle = floorById(snapshot?.room.floor_style);
  const valid = preview
    ? !placementError(preview, snapshot?.placements || [], size)
    : true;
  const point = (x: number, z: number) => {
    if (preview)
      useHostelStore.setState({
        preview: candidate(preview.item, x, z, preview.rotation, snapshot?.placements || [], size),
      });
  };
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" key={size}>
        <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
          <boxGeometry args={[width, 0.3, 8]} />
          <meshStandardMaterial color={estate && floorStyle.id === "default" ? "#ece7dc" : lodge && floorStyle.id === "default" ? "#d8c39c" : "#a9a99a"} />
        </mesh>
        {/* Paint: lodge keeps its warm finish until you repaint. */}
        <Box pos={[0, 1.5, -4]} size={[width, 3, 0.15]} color={paint.id !== "default" ? paint.back : estate ? "#f4eee4" : lodge ? "#f3dfb8" : paint.back} />
        <Box pos={[-halfX, 1.5, 0]} size={[0.15, 3, 8]} color={paint.id !== "default" ? paint.side : estate ? "#ebe3d6" : lodge ? "#e8cfa1" : paint.side} />
        <Box pos={[halfX, 1.5, 0]} size={[0.15, 3, 8]} color={paint.id !== "default" ? paint.side : estate ? "#ebe3d6" : lodge ? "#e8cfa1" : paint.side} />
        <Box pos={[-(1 + (halfX - 1) / 2), 0.4, 4]} size={[halfX - 1, 0.8, 0.15]} color="#b8c4b4" />
        <Box pos={[1 + (halfX - 1) / 2, 0.4, 4]} size={[halfX - 1, 0.8, 0.15]} color="#b8c4b4" />
      </RigidBody>
      {((!lodge && !estate) || floorStyle.id !== "default") && <FloorFinish style={floorStyle} width={width} />}
      <RoomWindow />
      <RoomLights halfX={halfX} />
      <Box pos={[1, 0.95, 3.92]} size={[0.08, 1.9, 0.12]} color="#7e8b79" />
      <Box pos={[0, 1.9, 3.92]} size={[2.1, 0.08, 0.12]} color="#7e8b79" />
      <Box pos={[halfX - 0.1, 0.35, -1]} size={[0.02, 0.12, 0.18]} color="#f7f7ee" />
      <group
        position={[-2.6, 0, -2.8]}
        onClick={(e) => {
          e.stopPropagation();
          select("hostel_mattress");
        }}
      >
        <HostelItemModel id="hostel_mattress" />
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.625, 0.15, 1]} position={[0, 0.15, 0]} />
        </RigidBody>
      </group>
      <HomeMeal />
      {lodge && <LodgeDecor halfX={halfX} />}
      {estate && <EstateDecor halfX={halfX} marble={floorStyle.id === "default"} />}
      {snapshot?.placements
        .filter((p) => p.item_id !== preview?.item)
        .map((p) => {
          const i = hostelItem(p.item_id),
            [w, d] = extent(p.item_id, 0);
          const floor =
            i &&
            !["wall", "bed"].includes(i.placementType) &&
            p.item_id !== "hostel_rug";
          return (
            <group
              key={p.item_id}
              position={position(p)}
              rotation={[0, (p.rotation * Math.PI) / 180, 0]}
              onClick={(e) => {
                e.stopPropagation();
                select(p.item_id);
              }}
            >
              <HostelItemModel
                id={p.item_id}
                active={
                  p.item_id === "hostel_tv_basic"
                    ? snapshot.room.tv_on
                    : p.active || (p.item_id === "hostel_cooker" && cooking)
                }
              />
              {floor && (
                <RigidBody type="fixed" colliders={false}>
                  <CuboidCollider args={[w, 0.35, d]} position={[0, 0.35, 0]} />
                </RigidBody>
              )}
              {selected === p.item_id && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
                  <ringGeometry args={[0.45, 0.49, 24]} />
                  <meshBasicMaterial color="#2c9860" />
                </mesh>
              )}
            </group>
          );
        })}
      {preview && owner === user?.id && (
        <>
          <gridHelper
            args={[width, width * 4, "#578b72", "#b2c7b8"]}
            position={[0, 0.018, 0]}
            scale={[1, 1, 8 / width]}
          />
          <mesh
            position={[0, 0.025, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              point(e.point.x, e.point.z);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) {
                e.stopPropagation();
                point(e.point.x, e.point.z);
              }
            }}
          >
            <planeGeometry args={[width, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <group
            position={[preview.x, preview.y, preview.z]}
            rotation={[0, (preview.rotation * Math.PI) / 180, 0]}
          >
            <HostelItemModel id={preview.item} ghost valid={valid} />
          </group>
        </>
      )}
    </group>
  );
}
