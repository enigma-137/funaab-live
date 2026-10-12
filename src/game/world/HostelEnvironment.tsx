import React from "react";
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
import { useHostelStore } from "../../stores/hostelStore";
import { hostelItem } from "../../config/hostelShop";
import { HostelCompound } from "./HostelCompound";
import { hostelRoomFor } from "../../config/hostelCompound";
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
export function HostelEnvironment() {
  const { owner, snapshot, preview, travel, selected, pose } = useHostelStore();
  const user = useAuthStore((s) => s.user);
  const select = (id: string) => {
    if (preview || pose) return;
    useInputStore.getState().clearTargetDestination();
    useHostelStore.setState({ selected: id });
  };
  if (!owner) return <HostelCompound myRoom={user ? hostelRoomFor(user.id).room : null} />;
  const valid = preview
    ? !placementError(preview, snapshot?.placements || [])
    : true;
  const point = (x: number, z: number) => {
    if (preview)
      useHostelStore.setState({
        preview: candidate(preview.item, x, z, preview.rotation),
      });
  };
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <Box pos={[0, -0.15, 0]} size={[8, 0.3, 8]} color="#c7c7b8" />
        <Box pos={[0, 1.5, -4]} size={[8, 3, 0.15]} color="#e9eddd" />
        <Box pos={[-4, 1.5, 0]} size={[0.15, 3, 8]} color="#d9e1d3" />
        <Box pos={[4, 1.5, 0]} size={[0.15, 3, 8]} color="#d9e1d3" />
        <Box pos={[-2.5, 0.4, 4]} size={[3, 0.8, 0.15]} color="#b8c4b4" />
        <Box pos={[2.5, 0.4, 4]} size={[3, 0.8, 0.15]} color="#b8c4b4" />
      </RigidBody>
      <Box pos={[-2, 1.9, -3.9]} size={[1.5, 1, 0.1]} color="#8dbfc1" />
      <Box pos={[-2, 1.9, -3.82]} size={[0.045, 1, 0.035]} color="#eef2e4" />
      <Box pos={[1, 0.95, 3.92]} size={[0.08, 1.9, 0.12]} color="#7e8b79" />
      <Box pos={[0, 1.9, 3.92]} size={[2.1, 0.08, 0.12]} color="#7e8b79" />
      <Box pos={[3.9, 0.35, -1]} size={[0.02, 0.12, 0.18]} color="#f7f7ee" />
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
      <mesh position={[0, 2.8, -1]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color="#fff4be" />
      </mesh>
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
                    : p.active
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
            args={[8, 32, "#578b72", "#b2c7b8"]}
            position={[0, 0.018, 0]}
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
            <planeGeometry args={[8, 8]} />
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
