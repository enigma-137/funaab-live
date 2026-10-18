import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import {
  BILLBOARDS, BILLBOARD_SIZE, GATE_PLAZA, PLAZA_DIRECTORY_ID, PLAZA_SHOPS, PLAZA_STAIRS, gatePlazaColliders, plazaColumnX,
  type AdListing, type Billboard, type PlazaShop,
} from '../../config/adSpaces';
import { useAdStore } from '../../stores/adStore';
import { campusMaterials, type V3 } from './campusVisualGeometry';

// Procedural stand-ins for the `gate_plaza` and billboard assets. Every flyer and billboard face is
// tappable: it opens that spot's sheet (the business, or "coming soon" while renting isn't open).
const cube = new THREE.BoxGeometry(1, 1, 1);
const plane = new THREE.PlaneGeometry(1, 1);
const mats = {
  wall: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.85 }),
  trim: new THREE.MeshStandardMaterial({ color: '#155642', roughness: 0.7 }),
  slab: new THREE.MeshStandardMaterial({ color: '#c9c2ad', roughness: 0.9 }),
  shutter: new THREE.MeshStandardMaterial({ color: '#8b9290', roughness: 0.55, metalness: 0.35 }),
  rib: new THREE.MeshStandardMaterial({ color: '#6c7371', roughness: 0.55, metalness: 0.35 }),
  lit: new THREE.MeshBasicMaterial({ color: '#fff3d6' }),
  steel: new THREE.MeshStandardMaterial({ color: '#3f4744', roughness: 0.5, metalness: 0.6 }),
  frame: new THREE.MeshStandardMaterial({ color: '#1f2523', roughness: 0.6 }),
};
const Block = ({ p, s, m }: { p: V3; s: V3; m: THREE.Material }) => <mesh geometry={cube} material={m} position={p} scale={s} castShadow receiveShadow />;
const font = (weight: number, size: number) => `${weight} ${size}px "Arial Black", Arial, sans-serif`;

/** Canvas lettering (local system fonts only); with `imageUrl`, the business's own flyer replaces it once it loads. */
function useFlyerMaterial(width: number, height: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, key: string, imageUrl?: string | null) {
  const canvasMat = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d')!, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  }, [key]);
  const [imageMat, setImageMat] = useState<THREE.MeshBasicMaterial | null>(null);
  useEffect(() => {
    setImageMat(null);
    if (!imageUrl) return;
    let alive = true, made: THREE.MeshBasicMaterial | null = null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    // A flyer that can't load (CORS, 404) just leaves the lettered board up.
    loader.load(imageUrl, (texture) => {
      if (!alive) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      made = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
      setImageMat(made);
    }, undefined, () => {});
    return () => { alive = false; made?.map?.dispose(); made?.dispose(); };
  }, [imageUrl]);
  useEffect(() => () => { canvasMat.map?.dispose(); canvasMat.dispose(); }, [canvasMat]);
  return imageMat ?? canvasMat;
}

const tap = (id: string) => ({
  onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useAdStore.getState().open(id); },
  onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; },
  onPointerOut: () => { document.body.style.cursor = 'auto'; },
});

function wrapLines(c: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}
function fitText(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, start: number, weight = 900) {
  let size = start;
  c.font = font(weight, size);
  while (c.measureText(text).width > maxWidth && size > 12) c.font = font(weight, --size);
  c.fillText(text, x, y);
}

/** The flyer pasted on a shopfront: the business's, or a "to let" notice while the shop is closed. */
function ShopFlyer({ shop, listing, position }: { shop: PlazaShop; listing?: AdListing; position: V3 }) {
  const key = listing ? `${listing.business_name}|${listing.tagline ?? ''}` : `closed-${shop.number}`;
  const material = useFlyerMaterial(256, 360, (c, w, h) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (listing) {
      c.fillStyle = '#fdf7e7'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#155642'; c.fillRect(0, 0, w, 70);
      c.fillStyle = '#faf4de'; fitText(c, `SHOP ${shop.number}`, w / 2, 36, w - 30, 30);
      c.fillStyle = '#1b2b25'; c.font = font(900, 34);
      wrapLines(c, listing.business_name.toUpperCase(), w - 30).forEach((l, i) => fitText(c, l, w / 2, 130 + i * 42, w - 30, 34));
      if (listing.tagline) { c.fillStyle = '#4a5a52'; c.font = font(600, 20); wrapLines(c, listing.tagline, w - 36).forEach((l, i) => c.fillText(l, w / 2, 250 + i * 26)); }
      c.fillStyle = '#c6b06d'; c.fillRect(30, h - 34, w - 60, 4);
      c.fillStyle = '#155642'; c.font = font(700, 18); c.fillText('TAP TO VISIT', w / 2, h - 16);
    } else {
      c.fillStyle = '#f5d33d'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1b1b1b'; c.lineWidth = 8; c.strokeRect(12, 12, w - 24, h - 24);
      c.fillStyle = '#1b1b1b';
      fitText(c, `SHOP ${shop.number}`, w / 2, 62, w - 50, 34);
      fitText(c, 'TO LET', w / 2, 150, w - 40, 64);
      c.font = font(700, 24); c.fillText('Closed', w / 2, 220);
      c.font = font(600, 20); c.fillText('Renting opens soon', w / 2, 262);
      c.font = font(700, 18); c.fillText('TAP FOR DETAILS', w / 2, h - 46);
    }
  }, key, listing?.flyer_url);
  return <mesh geometry={plane} material={material} position={position} scale={[1.5, 2.1, 1]} {...tap(shop.id)} />;
}

/** One shop bay, in plaza-local metres: a roller shutter when closed, a lit window when rented. */
function ShopBay({ shop, listing, frontZ }: { shop: PlazaShop; listing?: AdListing; frontZ: number }) {
  const x = plazaColumnX(shop.column), y0 = shop.floor * GATE_PLAZA.floorHeight + 0.15;
  const width = GATE_PLAZA.shopWidth - 0.9, height = 2.75;
  return (
    <group position={[x, y0, frontZ]}>
      {listing
        ? <mesh geometry={plane} material={mats.lit} position={[0, height / 2, 0.02]} scale={[width, height, 1]} />
        : <>
          <Block p={[0, height / 2, 0.03]} s={[width, height, 0.06]} m={mats.shutter} />
          {Array.from({ length: 9 }, (_, i) => <Block key={i} p={[0, 0.2 + i * 0.3, 0.07]} s={[width, 0.04, 0.03]} m={mats.rib} />)}
        </>}
      {/* Shop number above the bay */}
      <Block p={[0, height + 0.3, 0.05]} s={[width + 0.4, 0.42, 0.1]} m={mats.trim} />
      <ShopFlyer shop={shop} listing={listing} position={[0, 1.45, 0.11]} />
    </group>
  );
}

function PlazaSign({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  const material = useFlyerMaterial(1024, 192, (c, w, h) => {
    c.fillStyle = '#155642'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c6b06d'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#faf4de';
    c.font = font(900, 92); c.fillText('GATE PLAZA', w / 2, 82);
    c.font = font(700, 30); c.fillStyle = '#e8d9a0'; c.fillText('8 SHOPS  ·  FLYER SPACES TO LET', w / 2, 152);
  }, 'plaza-sign');
  return <mesh geometry={plane} material={material} position={position} rotation={[0, rotation, 0]} scale={[12, 2.25, 1]} {...tap(PLAZA_DIRECTORY_ID)} />;
}

function DirectoryBoard() {
  const listings = useAdStore((s) => s.listings);
  const rented = PLAZA_SHOPS.filter((s) => listings[s.id]).length;
  const material = useFlyerMaterial(320, 400, (c, w, h) => {
    c.fillStyle = '#16231f'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#faf4de'; fitText(c, 'GATE PLAZA', w / 2, 40, w - 30, 38);
    c.fillStyle = '#c6b06d'; c.font = font(700, 18); c.fillText('DIRECTORY', w / 2, 76);
    c.font = font(700, 20); c.textAlign = 'left';
    PLAZA_SHOPS.forEach((s, i) => {
      const l = listings[s.id], y = 112 + i * 34;
      c.fillStyle = '#faf4de'; c.fillText(`${s.number}`, 26, y);
      c.fillStyle = l ? '#9fe0b8' : '#8a948f';
      fitText(c, l ? l.business_name : 'To let · closed', 58, y, w - 80, 20, 700);
    });
    c.textAlign = 'center'; c.fillStyle = '#f5d33d'; c.font = font(700, 16); c.fillText(rented ? 'TAP A SHOP TO VISIT' : 'RENTING OPENS SOON', w / 2, h - 20);
  }, PLAZA_SHOPS.map((s) => listings[s.id]?.business_name ?? '').join('|'));
  const [x, , z] = GATE_PLAZA.directory;
  // Stands just behind the action spot, facing the forecourt (world -z, like the shops).
  return (
    <group position={[x, 0, z + 1]} rotation={[0, GATE_PLAZA.facing, 0]}>
      {[-0.75, 0.75].map((px) => <Block key={px} p={[px, 0.9, 0]} s={[0.1, 1.8, 0.1]} m={mats.steel} />)}
      <Block p={[0, 1.75, -0.04]} s={[1.75, 2.15, 0.06]} m={mats.frame} />
      <mesh geometry={plane} material={material} position={[0, 1.75, 0.01]} scale={[1.6, 2, 1]} {...tap(PLAZA_DIRECTORY_ID)} />
      <CuboidCollider args={[0.9, 1, 0.1]} position={[0, 1, 0]} />
    </group>
  );
}

export function GatePlaza() {
  const listings = useAdStore((s) => s.listings);
  const [w, d] = GATE_PLAZA.footprint, hw = w / 2, hd = d / 2;
  const fh = GATE_PLAZA.floorHeight, top = fh * 2 + 0.3, front = hd, bal = GATE_PLAZA.balcony;
  const f = GATE_PLAZA.forecourt, walk = GATE_PLAZA.walkway, st = PLAZA_STAIRS;
  const colliders = useMemo(gatePlazaColliders, []);
  return (
    <group name="gate_plaza_grounds">
      {/* Paved forecourt and the walkway out to the Ceremonial Road (world coordinates). */}
      {[f, walk].map((b, i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[(b.minX + b.maxX) / 2, 0.03, (b.minZ + b.maxZ) / 2]} receiveShadow>
        <planeGeometry args={[b.maxX - b.minX, b.maxZ - b.minZ]} /><primitive object={campusMaterials.paving} attach="material" />
      </mesh>)}
      <DirectoryBoard />
      <group position={GATE_PLAZA.position} rotation={[0, GATE_PLAZA.facing, 0]} name={GATE_PLAZA.assetKey}>
        <RigidBody type="fixed" colliders={false}>
          {/* Two-storey block: back wall to the gate, shop bays across the front. */}
          <Block p={[0, top / 2, -0.25]} s={[w, top, d - 0.5]} m={mats.wall} />
          <Block p={[0, 0.07, 0]} s={[w + 0.6, 0.14, d + 0.4]} m={mats.slab} />
          {/* Pilasters between bays */}
          {Array.from({ length: GATE_PLAZA.shopsPerFloor + 1 }, (_, i) => {
            const x = (i - GATE_PLAZA.shopsPerFloor / 2) * GATE_PLAZA.shopWidth;
            return <Block key={i} p={[x, top / 2, front - 0.15]} s={[0.45, top, 0.3]} m={mats.trim} />;
          })}
          {/* Upstairs walkway + stair landing, with its railing, on posts */}
          <Block p={[(st.maxX - hw) / 2, fh - 0.1, front + bal / 2]} s={[st.maxX + hw, 0.2, bal]} m={mats.slab} />
          <Block p={[(st.minX - hw) / 2, fh + 1.05, front + bal - 0.05]} s={[st.minX + hw, 0.08, 0.08]} m={mats.steel} />
          {Array.from({ length: 25 }, (_, i) => <Block key={i} p={[-hw + 0.1 + i, fh + 0.55, front + bal - 0.05]} s={[0.05, 1, 0.05]} m={mats.steel} />)}
          {[-hw + 0.05, st.maxX - 0.05].map((x) => <Block key={x} p={[x, fh + 1.05, front + bal / 2]} s={[0.08, 0.08, bal]} m={mats.steel} />)}
          {Array.from({ length: GATE_PLAZA.shopsPerFloor + 1 }, (_, i) => {
            const x = (i - GATE_PLAZA.shopsPerFloor / 2) * GATE_PLAZA.shopWidth;
            return <Block key={i} p={[x, fh / 2, front + bal - 0.15]} s={[0.22, fh, 0.22]} m={mats.trim} />;
          })}
          {/* Stair up from the forecourt to the walkway: solid steps and a handrail each side */}
          {Array.from({ length: st.steps }, (_, i) => {
            const h = (i + 0.5) * st.stepRise; // half-step down so feet sit evenly on the ramp line
            return <Block key={i} p={[st.cx, h / 2, st.bottomZ - (i + 0.5) * st.stepRun]} s={[st.width, h, st.stepRun + 0.01]} m={mats.slab} />;
          })}
          {[st.minX, st.maxX].map((x) => <group key={x}>
            <mesh geometry={cube} material={mats.steel} position={[x, st.rise / 2 + 1.0, (st.bottomZ + st.topZ) / 2]} rotation={[st.angle, 0, 0]} scale={[0.06, 0.06, st.hyp]} />
            {Array.from({ length: 7 }, (_, i) => {
              const t = (i + 0.5) / 7;
              return <Block key={i} p={[x, st.rise * t + 0.5, st.bottomZ - st.run * t]} s={[0.04, 1, 0.04]} m={mats.steel} />;
            })}
          </group>)}
          {/* Roof parapet */}
          <Block p={[0, top + 0.25, 0]} s={[w + 0.4, 0.5, d + 0.2]} m={mats.trim} />
          <Block p={[0, fh * 2 + 1.3, front + 0.05]} s={[12.4, 2.45, 0.2]} m={mats.trim} />
          {/* Same collider list the physics test walks a capsule through. */}
          {colliders.map((c) => <CuboidCollider key={c.id} args={c.half} position={c.pos} rotation={c.rot} />)}
        </RigidBody>
        {PLAZA_SHOPS.map((s) => <ShopBay key={s.id} shop={s} listing={listings[s.id]} frontZ={front} />)}
        <PlazaSign position={[0, fh * 2 + 1.3, front + 0.16]} />
        {/* The same name on the back wall, for students coming in through the gate. */}
        <PlazaSign position={[0, fh * 1.4, -hd - 0.02]} rotation={Math.PI} />
      </group>
    </group>
  );
}

function BillboardFace({ board, listing }: { board: Billboard; listing?: AdListing }) {
  const { width, height } = BILLBOARD_SIZE;
  const key = listing ? `${listing.business_name}|${listing.tagline ?? ''}` : `soon-${board.id}`;
  const material = useFlyerMaterial(1024, 450, (c, w, h) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (listing) {
      c.fillStyle = '#fdf7e7'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1b2b25'; fitText(c, listing.business_name.toUpperCase(), w / 2, 170, w - 80, 120);
      if (listing.tagline) { c.fillStyle = '#155642'; fitText(c, listing.tagline, w / 2, 300, w - 100, 52, 700); }
      if (listing.contact) { c.fillStyle = '#4a5a52'; fitText(c, listing.contact, w / 2, 385, w - 120, 36, 700); }
    } else {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#155642'); g.addColorStop(1, '#0d3a2c');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c6b06d'; c.lineWidth = 10; c.strokeRect(18, 18, w - 36, h - 36);
      c.fillStyle = '#f5d33d'; c.font = font(900, 46); c.fillText('ADVERTISE HERE', w / 2, 92);
      c.fillStyle = '#faf4de'; fitText(c, 'ADVERTISEMENT', w / 2, 200, w - 120, 110);
      fitText(c, 'COMING SOON', w / 2, 310, w - 120, 96);
      c.fillStyle = '#c6b06d'; c.font = font(700, 30); c.fillText(`FUNAAB LIFE  ·  ${board.name.toUpperCase()}`, w / 2, 395);
    }
  }, key, listing?.flyer_url);
  const y = BILLBOARD_SIZE.clearance + height / 2;
  return <>
    <mesh geometry={plane} material={material} position={[0, y, 0.16]} scale={[width, height, 1]} {...tap(board.id)} />
    <mesh geometry={plane} material={material} position={[0, y, -0.16]} rotation={[0, Math.PI, 0]} scale={[width, height, 1]} {...tap(board.id)} />
  </>;
}

function CampusBillboard({ board, listing }: { board: Billboard; listing?: AdListing }) {
  const { width, height, clearance } = BILLBOARD_SIZE, top = clearance + height, legTop = clearance - 0.2;
  return (
    <group position={board.position} rotation={[0, board.facing, 0]} name={`billboard_${board.id}`}>
      <RigidBody type="fixed" colliders={false}>
        {/* Two steel legs on concrete pads, a framed double-sided board, a catwalk with lamps */}
        {[-width / 4, width / 4].map((x) => <group key={x}>
          <Block p={[x, 0.2, 0]} s={[1, 0.4, 1]} m={campusMaterials.stone} />
          {/* Legs stop under the frame so they never show through the board's faces. */}
          <Block p={[x, legTop / 2, 0]} s={[0.4, legTop, 0.4]} m={mats.steel} />
          <CuboidCollider args={[0.5, legTop / 2, 0.5]} position={[x, legTop / 2, 0]} />
        </group>)}
        <Block p={[0, clearance + height / 2, 0]} s={[width + 0.4, height + 0.4, 0.28]} m={mats.frame} />
        {[-1, 1].map((side) => <Block key={side} p={[0, clearance - 0.25, 0.75 * side]} s={[width, 0.08, 1.1]} m={mats.steel} />)}
        {[-3.3, 0, 3.3].map((x) => [-1, 1].map((side) => (
          <Block key={`${x}${side}`} p={[x, top + 0.35, 0.55 * side]} s={[0.5, 0.12, 0.6]} m={mats.steel} />
        )))}
      </RigidBody>
      <BillboardFace board={board} listing={listing} />
    </group>
  );
}

export function CampusBillboards() {
  const listings = useAdStore((s) => s.listings);
  return <group name="campus_billboards">{BILLBOARDS.map((b) => <CampusBillboard key={b.id} board={b} listing={listings[b.id]} />)}</group>;
}

/** Gate Plaza and the billboards; loads who has rented what (nothing yet, until renting opens). */
export function AdSpaces() {
  const load = useAdStore((s) => s.load);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 15 * 60000); return () => clearInterval(t); }, []);
  return <><GatePlaza /><CampusBillboards /></>;
}
