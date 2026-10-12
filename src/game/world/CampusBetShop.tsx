import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { CAMPUS_BET_SHOP } from '../../config/campusBet';
import { OUTSIDE_GATE } from '../../config/campusWorld';
import { useCampusBetStore } from '../../stores/campusBetStore';
import { campusMaterials, type V3 } from './campusVisualGeometry';

// Procedural stand-in for the `campus_bet_shop` asset. Built facing +z, then turned to face campus.
const RED = '#a3121c', RED_DARK = '#7a0d15', CREAM = '#f7f1e3', CHARCOAL = '#262626';
const cube = new THREE.BoxGeometry(1, 1, 1);
const plane = new THREE.PlaneGeometry(1, 1);
const mats = {
  red: new THREE.MeshStandardMaterial({ color: RED, roughness: 0.65 }),
  redDark: new THREE.MeshStandardMaterial({ color: RED_DARK, roughness: 0.7 }),
  cream: new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.8 }),
  charcoal: new THREE.MeshStandardMaterial({ color: CHARCOAL, roughness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ color: '#5a4a44', roughness: 0.9 }),
  glow: new THREE.MeshBasicMaterial({ color: '#ffe9e9' }),
  ball: new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.5, flatShading: true }),
  skin: new THREE.MeshStandardMaterial({ color: '#7a4a2c' }),
};
// Inner face of the back wall (local z), where the board and posters hang.
const hdInner = CAMPUS_BET_SHOP.footprint[1] / 2 - 0.26;
const Block = ({ p, s, m }: { p: V3; s: V3; m: THREE.Material }) => <mesh geometry={cube} material={m} position={p} scale={s} castShadow receiveShadow />;

/** Canvas lettering: local system fonts only, so nothing can suspend the world on a font fetch. */
function useCanvasMaterial(width: number, height: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, key: string) {
  const material = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d')!, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }, [key]);
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  return material;
}
const font = (weight: number, size: number) => `${weight} ${size}px "Arial Black", Arial, sans-serif`;
function drawBall(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.fillStyle = '#fafafa'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1f1f1f';
  const pent = (cx: number, cy: number, pr: number, rot: number) => {
    c.beginPath();
    for (let i = 0; i < 5; i++) { const a = rot + (i * 2 * Math.PI) / 5; c.lineTo(cx + pr * Math.cos(a), cy + pr * Math.sin(a)); }
    c.closePath(); c.fill();
  };
  pent(x, y, r * 0.32, -Math.PI / 2);
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; pent(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, r * 0.22, a + Math.PI); }
  c.strokeStyle = '#1f1f1f'; c.lineWidth = r * 0.06; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
}

function MainSign() {
  const material = useCanvasMaterial(1024, 256, (c, w, h) => {
    c.fillStyle = RED; c.fillRect(0, 0, w, h);
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = font(900, 118); c.fillStyle = CREAM; c.fillText('CAMPUS', 70, 104);
    const campusWidth = c.measureText('CAMPUS ').width;
    c.fillStyle = '#ffd5d5'; c.fillText('BET', 70 + campusWidth, 104);
    c.font = font(700, 38); c.fillStyle = CREAM; c.fillText('PREDICT  ·  PLAY  ·  WIN', 78, 200);
    drawBall(c, 900, 128, 82);
  }, 'main-sign');
  return <mesh geometry={plane} material={material} position={[0, 4.15, 3.06]} scale={[8.4, 2.1, 1]} />;
}

function Poster({ position, lines, rotation = 0 }: { position: V3; lines: [string, number][]; rotation?: number }) {
  const material = useCanvasMaterial(256, 512, (c, w, h) => {
    c.fillStyle = RED_DARK; c.fillRect(0, 0, w, h);
    c.strokeStyle = CREAM; c.lineWidth = 8; c.strokeRect(12, 12, w - 24, h - 24);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = CREAM;
    let y = 90;
    for (const [text, size] of lines) { c.font = font(900, size); c.fillText(text, w / 2, y); y += size * 1.15; }
    drawBall(c, w / 2, h - 100, 52);
  }, lines.map((l) => l[0]).join('|'));
  return <mesh geometry={plane} material={material} position={position} rotation={[0, rotation, 0]} scale={[1.25, 2.5, 1]} />;
}

/** Back-wall board: shows the live matchday once anyone nearby has loaded it; generic otherwise. */
function FixturesBoard() {
  const state = useCampusBetStore((s) => s.state);
  const round = state?.current;
  const rows = round?.fixtures.map((f) => [state!.teams[f.home]?.shortName ?? f.home, state!.teams[f.away]?.shortName ?? f.away]) ?? [];
  const key = round ? `${round.id}:${rows.flat().join(',')}` : 'generic';
  const material = useCanvasMaterial(512, 320, (c, w, h) => {
    c.fillStyle = '#141414'; c.fillRect(0, 0, w, h);
    c.textBaseline = 'middle'; c.textAlign = 'center';
    c.font = font(900, 34); c.fillStyle = '#ff4d4d';
    c.fillText(round ? `MATCHDAY ${round.round_number}` : 'MATCHDAY', w / 2, 38);
    c.font = font(700, 26);
    if (rows.length) {
      rows.forEach(([home, away], i) => {
        const y = 90 + i * 48;
        c.fillStyle = CREAM; c.textAlign = 'right'; c.fillText(home, w / 2 - 34, y);
        c.fillStyle = '#ff4d4d'; c.textAlign = 'center'; c.fillText('vs', w / 2, y);
        c.fillStyle = CREAM; c.textAlign = 'left'; c.fillText(away, w / 2 + 34, y);
      });
    } else {
      c.fillStyle = CREAM; c.fillText('5 fixtures · pick all 5', w / 2, 150);
      c.fillStyle = '#bdbdbd'; c.font = font(600, 22); c.fillText('Game Naira only', w / 2, 200);
    }
  }, key);
  return <group position={[0, 2.25, -hdInner]}>
    <Block p={[0, 0, -0.04]} s={[3.5, 2.3, 0.08]} m={mats.charcoal} />
    <mesh geometry={plane} material={material} position={[0, 0, 0.01]} scale={[3.3, 2.06, 1]} />
  </group>;
}

function Attendant() {
  return <group position={[1.6, 0, 1.6]}>
    <Block p={[0, 0.45, 0]} s={[0.4, 0.9, 0.3]} m={mats.charcoal} />
    <Block p={[0, 1.2, 0]} s={[0.55, 0.65, 0.32]} m={mats.red} />
    <mesh position={[0, 1.75, 0]} material={mats.skin} castShadow><sphereGeometry args={[0.21, 10, 8]} /></mesh>
    <Block p={[0, 1.95, 0]} s={[0.44, 0.1, 0.44]} m={mats.red} />
    <Block p={[0, 1.92, 0.24]} s={[0.36, 0.04, 0.16]} m={mats.red} />
  </group>;
}

export function CampusBetShop() {
  const [w, d] = CAMPUS_BET_SHOP.footprint;
  const hw = w / 2, hd = d / 2;
  return (
    <group position={CAMPUS_BET_SHOP.position} rotation={[0, Math.PI, 0]} name={CAMPUS_BET_SHOP.assetKey}>
      <RigidBody type="fixed" colliders={false}>
        {/* Floor slab, back + side walls, roof */}
        <Block p={[0, 0.06, 0]} s={[w, 0.12, d]} m={mats.floor} />
        <Block p={[0, 1.75, -hd + 0.1]} s={[w, 3.5, 0.2]} m={mats.red} />
        {[-1, 1].map((side) => <Block key={side} p={[side * (hw - 0.1), 1.75, 0]} s={[0.2, 3.5, d]} m={mats.red} />)}
        <Block p={[0, 3.6, 0]} s={[w + 0.3, 0.25, d + 0.3]} m={mats.charcoal} />
        {/* Fascia behind the main sign, with a cream trim line */}
        <Block p={[0, 4.15, 2.95]} s={[w, 2.2, 0.2]} m={mats.red} />
        <Block p={[0, 3.0, 3.05]} s={[w, 0.08, 0.05]} m={mats.cream} />
        {/* Awning over the stools */}
        <Block p={[0, 3.1, 4.0]} s={[w, 0.14, 2.0]} m={mats.redDark} />
        <mesh geometry={plane} material={mats.glow} position={[0, 3.02, 4.0]} rotation={[Math.PI / 2, 0, 0]} scale={[w - 1, 0.08, 1]} />
        {[-hw + 0.15, hw - 0.15].map((x) => <Block key={x} p={[x, 1.55, 4.85]} s={[0.16, 3.1, 0.16]} m={mats.charcoal} />)}
        {/* Counter across the open front, with a till screen */}
        <Block p={[0, 0.55, 2.7]} s={[w - 0.6, 1.1, 0.6]} m={mats.red} />
        <Block p={[0, 1.13, 2.75]} s={[w - 0.4, 0.07, 0.8]} m={mats.charcoal} />
        <Block p={[1.6, 1.38, 2.55]} s={[0.7, 0.45, 0.06]} m={mats.charcoal} />
        {/* Ceiling strip lights */}
        {[-2.2, 0, 2.2].map((x) => <mesh key={x} geometry={plane} material={mats.glow} position={[x, 3.46, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.6, 0.14, 1]} />)}
        {/* Stools outside the counter */}
        {[-2.8, -1, 0.8].map((x) => <group key={x} position={[x, 0, 3.75]}>
          <mesh position={[0, 0.38, 0]} material={mats.charcoal}><cylinderGeometry args={[0.05, 0.08, 0.76, 6]} /></mesh>
          <mesh position={[0, 0.78, 0]} material={mats.red} castShadow><cylinderGeometry args={[0.28, 0.28, 0.09, 12]} /></mesh>
        </group>)}
        {/* Football on the roof corner */}
        <mesh position={[hw - 0.6, 5.55, 2.7]} material={mats.ball} castShadow><icosahedronGeometry args={[0.55, 1]} /></mesh>
        {/* Body collider keeps students on the customer side; posts are solid too. */}
        <CuboidCollider args={[hw, 1.75, (d + 0.6) / 2]} position={[0, 1.75, 0.3]} />
        {[-hw + 0.15, hw - 0.15].map((x) => <CuboidCollider key={x} args={[0.12, 1.55, 0.12]} position={[x, 1.55, 4.85]} />)}
      </RigidBody>
      <MainSign />
      <FixturesBoard />
      <Poster position={[-3.2, 1.9, -hdInner - 0.03]} lines={[['GAME', 54], ['ON', 54], ['CAMPUS', 40]]} />
      <Poster position={[3.2, 1.9, -hdInner - 0.03]} lines={[['5', 96], ['MATCHES', 34], ['PICK', 34], ['ALL 5', 34]]} />
      {/* Street-side poster on the outer left wall, readable from the gate road */}
      <Poster position={[-hw - 0.12, 2, 0.6]} rotation={-Math.PI / 2} lines={[['CAMPUS', 40], ['BET', 64], ['PREDICT', 30], ['PLAY', 30], ['WIN', 30]]} />
      <Attendant />
    </group>
  );
}

/** Paving + the public road just outside the main gate, so walking out to Campus Bet is legal. */
export function OutsideGateRoad() {
  const rect = (b: { minX: number; maxX: number; minZ: number; maxZ: number }, material: THREE.Material, y: number, key: string) =>
    <mesh key={key} rotation={[-Math.PI / 2, 0, 0]} position={[(b.minX + b.maxX) / 2, y, (b.minZ + b.maxZ) / 2]} material={material} receiveShadow>
      <planeGeometry args={[b.maxX - b.minX, b.maxZ - b.minZ]} />
    </mesh>;
  const r = OUTSIDE_GATE.road;
  return <group>
    {rect(OUTSIDE_GATE.gateWalk, campusMaterials.paving, 0.014, 'walk')}
    {rect(OUTSIDE_GATE.betFrontage, campusMaterials.paving, 0.016, 'frontage')}
    {rect(r, campusMaterials.road, 0.024, 'road')}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, (r.minZ + r.maxZ) / 2]}><planeGeometry args={[r.maxX - r.minX, 0.12]} /><meshBasicMaterial color="#e4d28a" /></mesh>
    {[r.minZ, r.maxZ].map((z) => <mesh key={z} position={[0, 0.06, z]} material={campusMaterials.curb}><boxGeometry args={[r.maxX - r.minX, 0.12, 0.25]} /></mesh>)}
  </group>;
}
