import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { AvatarBody } from '../player/AvatarBody';
import { npcAppearance } from '../../config/npcAppearance';
import { FOOD_VENDORS, VENDOR_PLAZA, type FoodVendor, type VendorStatus } from '../../config/foodVendors';
import { useFoodVendorStore, useVendorStatus } from '../../stores/foodVendorStore';
import { campusMaterials, type V3 } from './campusVisualGeometry';

// Procedural stand-ins. Each piece is a named group matching FOOD_VENDORS[..].models so
// /models/vendors/*.glb can replace visuals later without touching schedule or purchase logic.
const cube = new THREE.BoxGeometry(1, 1, 1);
const plane = new THREE.PlaneGeometry(1, 1);
const m = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const mats = {
  wood: m('#8a5a32'), woodDark: m('#5c3a1e'), metal: m('#3f3f46', { roughness: 0.5, metalness: 0.4 }), steel: m('#a1a1aa', { roughness: 0.35, metalness: 0.6 }),
  charcoal: m('#1c1917'), meat: m('#7c2d12'), meatDark: m('#4a1d0a'), skewer: m('#d6c29a'), white: m('#f5f5f4'), egg: m('#f3e2c7'),
  red: m('#b91c1c'), yellow: m('#facc15'), green: m('#15803d'), orange: m('#c2410c'), spice: m('#a16207'), noodle: m('#fde68a'),
  plastic: m('#2563eb'), plasticRed: m('#dc2626'), bin: m('#166534'), cap: m('#111111'), scarf: m('#9f1239'), apron: m('#f5f0e6'),
  embers: new THREE.MeshStandardMaterial({ color: '#7c2d12', emissive: '#f97316', emissiveIntensity: 1.4, roughness: 1 }),
  flame: new THREE.MeshBasicMaterial({ color: '#60a5fa' }),
  bulb: new THREE.MeshBasicMaterial({ color: '#fff7d6' }),
  puff: new THREE.MeshBasicMaterial({ color: '#e7e5e4', transparent: true, opacity: 0.26, depthWrite: false }),
};
const Box = ({ p, s, mat, r }: { p: V3; s: V3; mat: THREE.Material; r?: V3 }) =>
  <mesh geometry={cube} material={mat} position={p} scale={s} rotation={r} castShadow receiveShadow />;
const Cyl = ({ p, r, h, mat, seg = 10 }: { p: V3; r: number; h: number; mat: THREE.Material; seg?: number }) =>
  <mesh position={p} material={mat} castShadow><cylinderGeometry args={[r, r, h, seg]} /></mesh>;

/** Canvas sign (system fonts only, so nothing waits on a font download). Redraws when its text changes. */
function useSignMaterial(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, key: string) {
  const material = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 160;
    draw(canvas.getContext('2d')!, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }, [key]);
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  return material;
}
const font = (weight: number, size: number) => `${weight} ${size}px "Arial Black", Arial, sans-serif`;

function MenuBoard({ vendor, status }: { vendor: FoodVendor; status: VendorStatus }) {
  const suya = vendor.id === 'mai_suya';
  const material = useSignMaterial((c, w, h) => {
    c.fillStyle = suya ? '#1c1917' : '#fde68a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = suya ? '#a8a29e' : '#c2410c'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.textBaseline = 'middle';
    c.textAlign = 'left'; c.font = font(900, 40);
    c.fillStyle = suya ? '#fafaf9' : '#b91c1c'; c.fillText(suya ? 'MAI' : 'INDOMIE', 24, 40);
    const first = c.measureText(suya ? 'MAI ' : 'INDOMIE ').width;
    c.fillStyle = suya ? '#facc15' : '#1c1917'; c.fillText(suya ? 'SUYA' : '& EGG', 24 + first, 40);
    if (status.isOpen) {
      c.font = font(700, 25);
      vendor.items.forEach((item, i) => {
        const y = 92 + i * 36;
        c.textAlign = 'left'; c.fillStyle = suya ? '#e7e5e4' : '#1c1917'; c.fillText(item.name.toUpperCase(), 26, y);
        c.textAlign = 'right'; c.fillStyle = suya ? '#facc15' : '#b91c1c'; c.fillText(`₦${item.price}`, w - 26, y);
      });
    } else {
      c.textAlign = 'center'; c.font = font(900, 34); c.fillStyle = suya ? '#facc15' : '#b91c1c';
      c.fillText('CLOSED', w / 2, 96);
      c.font = font(700, 24); c.fillStyle = suya ? '#e7e5e4' : '#1c1917'; c.fillText(status.label, w / 2, 134);
    }
  }, `${vendor.id}:${status.isOpen}:${status.label}`);
  return <mesh geometry={plane} material={material} position={[0, 0.58, 0.57]} scale={[2.5, 0.78, 1]} />;
}

/** A handful of reused puffs rising and fading: cheap enough for low-end phones. */
function Puffs({ origin, spread = 0.18, speed = 0.45, color }: { origin: V3; spread?: number; speed?: number; color?: string }) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(() => { const p = mats.puff.clone(); if (color) p.color.set(color); return p; }, [color]);
  useEffect(() => () => material.dispose(), [material]);
  const seeds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ phase: i / 6, x: Math.sin(i * 2.4) * spread, z: Math.cos(i * 1.7) * spread })), [spread]);
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return;
    g.children.forEach((child, i) => {
      const t = (clock.elapsedTime * speed + seeds[i].phase) % 1;
      child.position.set(seeds[i].x * (1 + t), t * 1.1, seeds[i].z * (1 + t));
      child.scale.setScalar(0.05 + t * 0.14);
    });
  });
  return <group ref={group} position={origin}>{seeds.map((_, i) => <mesh key={i} material={material}><icosahedronGeometry args={[1, 0]} /></mesh>)}</group>;
}

function Table() {
  return <group>
    <Box p={[0, 0.92, 0]} s={[2.7, 0.08, 1.1]} mat={mats.wood} />
    <Box p={[0, 0.58, 0.53]} s={[2.6, 0.6, 0.04]} mat={mats.woodDark} />
    {[[-1.25, -0.45], [1.25, -0.45], [-1.25, 0.45], [1.25, 0.45]].map(([x, z]) => <Box key={`${x}${z}`} p={[x, 0.45, z]} s={[0.09, 0.9, 0.09]} mat={mats.woodDark} />)}
  </group>;
}

function SuyaGrill({ active }: { active: boolean }) {
  const embers = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (active && embers.current) (embers.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(clock.elapsedTime * 7) * 0.25 + Math.sin(clock.elapsedTime * 2.3) * 0.2;
  });
  const emberMat = useMemo(() => mats.embers.clone(), []);
  useEffect(() => () => emberMat.dispose(), [emberMat]);
  return <group name={FOOD_VENDORS.mai_suya.models.equipment} position={[-0.6, 0.96, -0.05]}>
    <Box p={[0, 0.12, 0]} s={[1.1, 0.24, 0.6]} mat={mats.metal} />
    {active
      ? <mesh ref={embers} geometry={cube} material={emberMat} position={[0, 0.25, 0]} scale={[1.0, 0.04, 0.5]} />
      : <Box p={[0, 0.25, 0]} s={[1.0, 0.04, 0.5]} mat={mats.charcoal} />}
    {[-0.2, 0, 0.2].map((z) => <Box key={z} p={[0, 0.3, z]} s={[1.05, 0.015, 0.015]} mat={mats.steel} />)}
    {active && <>
      {[-0.36, -0.12, 0.12, 0.36].map((x) => <group key={x} position={[x, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Cyl p={[0, 0, 0]} r={0.008} h={0.62} mat={mats.skewer} seg={4} />
        {[-0.15, 0, 0.15].map((z) => <Box key={z} p={[0, z, 0]} s={[0.08, 0.1, 0.06]} mat={mats.meat} />)}
      </group>)}
      <Puffs origin={[0, 0.4, 0]} />
    </>}
  </group>;
}

function SuyaProps() {
  return <group position={[0.55, 0.96, -0.05]}>
    <Box p={[0, 0.02, 0]} s={[0.7, 0.03, 0.45]} mat={mats.steel} />
    {[-0.2, 0, 0.2].map((x, i) => <group key={x} position={[x, 0.07, 0]} rotation={[0, 0.2 * i, 0]}>
      {[-0.12, 0.02, 0.14].map((z) => <Box key={z} p={[0, 0, z]} s={[0.09, 0.07, 0.07]} mat={mats.meatDark} />)}
    </group>)}
    <Cyl p={[0.48, 0.1, -0.1]} r={0.05} h={0.2} mat={mats.orange} />
    <Cyl p={[0.6, 0.1, -0.1]} r={0.05} h={0.2} mat={mats.spice} />
    <Cyl p={[0.55, 0.1, 0.12]} r={0.07} h={0.2} mat={mats.spice} />
  </group>;
}

function IndomieCooker({ active }: { active: boolean }) {
  return <group name={FOOD_VENDORS.indomie_egg.models.equipment} position={[-0.7, 0.96, -0.05]}>
    <Box p={[0, 0.05, 0]} s={[0.55, 0.1, 0.45]} mat={mats.metal} />
    {active ? <mesh position={[0, 0.115, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.flame}><ringGeometry args={[0.07, 0.12, 12]} /></mesh>
      : <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.charcoal}><ringGeometry args={[0.07, 0.12, 12]} /></mesh>}
    {active && <>
      <Cyl p={[0, 0.28, 0]} r={0.22} h={0.3} mat={mats.steel} seg={14} />
      <Cyl p={[0, 0.42, 0]} r={0.2} h={0.02} mat={mats.noodle} seg={14} />
      <Puffs origin={[0, 0.48, 0]} spread={0.1} speed={0.35} color="#f5f5f4" />
    </>}
  </group>;
}

function IndomieProps() {
  return <group position={[0.35, 0.96, -0.05]}>
    {[0, 0.08, 0.16].map((y) => <Cyl key={y} p={[-0.3, 0.04 + y, 0.05]} r={0.13} h={0.07} mat={mats.white} seg={12} />)}
    <Box p={[0.1, 0.03, 0.12]} s={[0.36, 0.05, 0.26]} mat={mats.egg} />
    {[-0.12, 0, 0.12].flatMap((x) => [0.05, 0.19].map((z) => <mesh key={`${x}${z}`} position={[0.1 + x, 0.09, z]} material={mats.white}><sphereGeometry args={[0.045, 6, 5]} /></mesh>))}
    {/* Generic noodle packets: plain colours, no product branding. */}
    {[0, 1, 2].map((i) => <Box key={i} p={[0.42, 0.04 + i * 0.05, -0.05]} s={[0.26, 0.045, 0.18]} mat={i % 2 ? mats.orange : mats.yellow} r={[0, 0.12 * i, 0]} />)}
    <Cyl p={[0.7, 0.11, 0.15]} r={0.04} h={0.22} mat={mats.red} />
    <Cyl p={[0.8, 0.11, 0.15]} r={0.04} h={0.22} mat={mats.yellow} />
    <Box p={[0.75, 0.05, -0.12]} s={[0.18, 0.1, 0.14]} mat={mats.green} />
  </group>;
}

function VendorNpc({ vendor }: { vendor: FoodVendor }) {
  const suya = vendor.id === 'mai_suya';
  const config = useMemo(() => npcAppearance(vendor.models.npc, suya
    ? { bodyType: 'masculine', topStyle: 't-shirt', topColor: '#1c1917', bottomStyle: 'trousers', bottomColor: '#1c1917', hairstyle: 'low-cut' }
    : { bodyType: 'feminine', topStyle: 'blouse', topColor: '#9f1239', bottomStyle: 'trousers', bottomColor: '#3f3f46', hairstyle: 'braids' }), [vendor.id]);
  return <group name={vendor.models.npc} position={[0, 0, -0.85]}>
    <AvatarBody identity={vendor.models.npc} config={config} />
    {suya
      ? <Cyl p={[0, 1.98, 0]} r={0.17} h={0.13} mat={mats.cap} seg={12} />
      : <>
        <mesh position={[0, 1.93, -0.01]} material={mats.scarf} scale={[1, 0.8, 1.05]}><sphereGeometry args={[0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        <Box p={[0, 1.0, 0.17]} s={[0.42, 0.62, 0.02]} mat={mats.apron} />
      </>}
  </group>;
}

function Stall({ vendor }: { vendor: FoodVendor }) {
  const status = useVendorStatus(vendor.id);
  const suya = vendor.id === 'mai_suya';
  return <group position={vendor.position} rotation={[0, vendor.rotation, 0]} name={vendor.models.stall}>
    <RigidBody type="fixed" colliders={false}>
      <Table />
      <CuboidCollider args={[1.35, 0.5, 0.55]} position={[0, 0.5, 0]} />
    </RigidBody>
    <MenuBoard vendor={vendor} status={status} />
    {suya ? <SuyaGrill active={status.isOpen} /> : <IndomieCooker active={status.isOpen} />}
    {status.isOpen && <>
      {suya ? <SuyaProps /> : <IndomieProps />}
      <VendorNpc vendor={vendor} />
      {/* Table lamp: an emissive bulb, no dynamic light. */}
      <Cyl p={[1.25, 1.55, -0.45]} r={0.02} h={1.25} mat={mats.metal} seg={5} />
      <mesh position={[1.25, 2.18, -0.45]} material={mats.bulb}><sphereGeometry args={[0.07, 8, 6]} /></mesh>
    </>}
    {/* Plastic stools on the customer side. */}
    {[-0.9, 0, 0.9].map((x, i) => <group key={x} position={[x, 0, 1.45 + (i % 2) * 0.2]}>
      <Cyl p={[0, 0.2, 0]} r={0.16} h={0.4} mat={suya ? mats.plasticRed : mats.plastic} seg={8} />
      <Cyl p={[0, 0.42, 0]} r={0.2} h={0.04} mat={suya ? mats.plasticRed : mats.plastic} seg={10} />
    </group>)}
  </group>;
}

/** Small roadside food spot north of the Food Court walkway: two stalls, a bin, a lamp and paving. */
export function FoodVendorStalls() {
  const syncClock = useFoodVendorStore((s) => s.syncClock);
  useEffect(() => {
    void syncClock();
    const timer = setInterval(() => void syncClock(), 5 * 60000);
    return () => clearInterval(timer);
  }, [syncClock]);
  const p = VENDOR_PLAZA;
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(p.minX + p.maxX) / 2, 0.018, (p.minZ + p.maxZ) / 2]} material={campusMaterials.paving} receiveShadow>
      <planeGeometry args={[p.maxX - p.minX, p.maxZ - p.minZ]} />
    </mesh>
    <Stall vendor={FOOD_VENDORS.mai_suya} />
    <Stall vendor={FOOD_VENDORS.indomie_egg} />
    <group position={[-65, 0, 38.6]}>
      <Cyl p={[0, 0.35, 0]} r={0.22} h={0.7} mat={mats.bin} seg={8} />
      <Cyl p={[1.2, 1.6, 0]} r={0.05} h={3.2} mat={mats.metal} seg={6} />
      <mesh position={[1.2, 3.25, 0]} material={mats.bulb}><sphereGeometry args={[0.14, 8, 6]} /></mesh>
    </group>
  </group>;
}
