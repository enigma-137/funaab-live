import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';

export const CampusEnvironment: React.FC = () => {
  // Memoized palm and neem trees placed along campus avenues and green belts
  const trees = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number; type: 'neem' | 'palm' }[] = [];
    const seedPoints: [number, number][] = [
      // Perimeter foliage
      [-55, -55], [-55, -30], [-55, 0], [-55, 30], [-55, 55],
      [55, -55], [55, -30], [55, 0], [55, 30], [55, 55],
      [-30, -55], [0, -55], [30, -55],
      [-30, 55], [30, 55],
      // Ceremonial Road Avenue green belts
      [-6, 38], [6, 38], [-6, 30], [6, 30], [-6, 24], [6, 24],
      // W-Plaza & Car Park surrounds
      [-12, 14], [12, 14], [-32, 18], [-12, 28],
      // Sports Centre perimeter
      [-50, -10], [-50, 10], [-26, -2],
      // Academic Core & Library gardens
      [-10, -22], [10, -22], [-14, -36], [14, -36], [0, -44],
      // Hostel & Bank groves
      [36, 24], [36, 14], [36, -2], [36, -22], [16, -18]
    ];

    seedPoints.forEach(([x, z], i) => {
      list.push({
        pos: [x, 0, z],
        scale: 0.85 + (i % 5) * 0.08,
        type: i % 2 === 0 ? 'palm' : 'neem',
      });
    });
    return list;
  }, []);

  return (
    <group>
      {/* ══════════════════════════════════════════════════════════════════════
          1. TERRAIN & WORLD PERIMETER BOUNDARIES (Spacious 200m x 200m footprint)
      ══════════════════════════════════════════════════════════════════════ */}
      <RigidBody type="fixed" colliders={false}>
        {/* FUNAAB Campus Grass Lawn */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[220, 220]} />
          <meshStandardMaterial color="#2d5526" roughness={0.9} />
        </mesh>

        {/* Physical Ground Plane Collider */}
        <CuboidCollider args={[110, 0.5, 110]} position={[0, -0.5, 0]} />

        {/* 4 Invisible World Perimeter Walls (Bounds: ±95m) */}
        <CuboidCollider args={[100, 4, 1]} position={[0, 4, -95.5]} />
        <CuboidCollider args={[100, 4, 1]} position={[0, 4, 95.5]} />
        <CuboidCollider args={[1, 4, 100]} position={[-95.5, 4, 0]} />
        <CuboidCollider args={[1, 4, 100]} position={[95.5, 4, 0]} />
      </RigidBody>

      {/* ══════════════════════════════════════════════════════════════════════
          2. CAMPUS ROAD NETWORK (Asphalt, Kerbs & Crossings)
      ══════════════════════════════════════════════════════════════════════ */}
      <group>
        {/* A. Ceremonial Road (North-South Main Boulevard: from Main Gate Z:58 to Z:28) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 43]} receiveShadow>
          <planeGeometry args={[10, 32]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        {/* Yellow Central Dividing Strip */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 43]}>
          <planeGeometry args={[0.35, 30]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>

        {/* B. Central Plaza Ring Road (East-West Boulevard at Z: 28) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 28]} receiveShadow>
          <planeGeometry args={[120, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 28]}>
          <planeGeometry args={[118, 0.35]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>

        {/* C. Western Avenue (Past Sports Centre & Health Centre: X = -28 from Z: 28 to Z: -36) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-28, 0.01, -4]} receiveShadow>
          <planeGeometry args={[8, 64]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-28, 0.02, -4]}>
          <planeGeometry args={[0.35, 62]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>

        {/* D. Eastern Avenue (Past Bank & Hostels: X = 32 from Z: 28 to Z: -36) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[32, 0.01, -4]} receiveShadow>
          <planeGeometry args={[8, 64]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[32, 0.02, -4]}>
          <planeGeometry args={[0.35, 62]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>

        {/* E. Northern Academic Ring Road (East-West at Z: -36 connecting Faculties & Senate) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -36]} receiveShadow>
          <planeGeometry args={[80, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -36]}>
          <planeGeometry args={[78, 0.35]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>

        {/* Pedestrian Zebra Crossings */}
        {[-28, 0, 32].map((x, i) => (
          <group key={i} position={[x, 0.025, 28]}>
            {[-2.8, -1.4, 0, 1.4, 2.8].map((offset, j) => (
              <mesh key={j} rotation={[-Math.PI / 2, 0, 0]} position={[offset, 0, 0]}>
                <planeGeometry args={[0.8, 4.0]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.5} />
              </mesh>
            ))}
          </group>
        ))}

        {/* ─── DESIGNATED LEGAL PAVED WALKWAYS & FOOTPATHS ─── */}
        {/* 1. Central Promenade: W-Plaza to Senate Quad */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -6]} receiveShadow>
          <planeGeometry args={[4.5, 52]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>

        {/* 2. Western Sidewalk: Car Park -> Food Court -> Health Centre -> COLFHEC */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-23, 0.015, -4]} receiveShadow>
          <planeGeometry args={[3.0, 62]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>

        {/* 3. Eastern Sidewalk: Bank -> Hostels -> Agromet */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[27, 0.015, -4]} receiveShadow>
          <planeGeometry args={[3.0, 62]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>

        {/* 4. Northern Academic Walkway connecting COLFHEC, Senate & Hostels */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -31]} receiveShadow>
          <planeGeometry args={[78, 3.2]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>

        {/* 5. Food Court to Sports Centre Pitch Footpath */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-36, 0.015, 6]} receiveShadow>
          <planeGeometry args={[14, 3.6]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>

        {/* ─── 3D "KEEP OFF THE LAWN" CAMPUS SIGNPOSTS ─── */}
        {[
          { pos: [-8, 0, 20], rot: 0 },
          { pos: [8, 0, 20], rot: 0 },
          { pos: [-8, 0, -26], rot: Math.PI },
          { pos: [8, 0, -26], rot: Math.PI },
          { pos: [-22, 0, 14], rot: Math.PI / 2 },
          { pos: [26, 0, 14], rot: -Math.PI / 2 },
        ].map((sign, idx) => (
          <group key={idx} position={[sign.pos[0], 0, sign.pos[2]]} rotation={[0, sign.rot, 0]}>
            {/* Wooden/Metal Post */}
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 1.2, 8]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Signboard Panel */}
            <mesh position={[0, 1.1, 0]}>
              <boxGeometry args={[1.2, 0.6, 0.06]} />
              <meshStandardMaterial color="#166534" />
            </mesh>
            <mesh position={[0, 1.1, 0.035]}>
              <boxGeometry args={[1.1, 0.5, 0.01]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <Html position={[0, 1.1, 0.05]} center distanceFactor={14} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className="text-[7px] font-black tracking-tight text-emerald-950 font-['Outfit'] text-center uppercase leading-tight select-none">
                <div>🌿 FUNAAB LAWN</div>
                <div className="text-red-600 font-extrabold">KEEP OFF GRASS</div>
                <div className="text-[6px] text-slate-700">₦500 FINE</div>
              </div>
            </Html>
          </group>
        ))}
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          3. CEREMONIAL MAIN GATE (Hero Monument Inspired by Image B)
          Position: [0, 0, 58]
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[0, 0, 58]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Central Pyramid Monument (White/Grey Textured Granite) */}
          <group position={[0, 0, 0]}>
            <mesh position={[0, 3.5, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[3.2, 7.0, 4]} />
              <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
            </mesh>

            {/* Inset "FUNAAB" Front Sign Panel */}
            <mesh position={[0, 2.8, 1.8]} rotation={[-0.32, 0, 0]}>
              <boxGeometry args={[2.8, 1.2, 0.1]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <Html position={[0, 2.8, 1.9]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
              <div className="font-['Outfit'] font-black tracking-widest text-emerald-400 text-sm drop-shadow-md">
                FUNAAB
              </div>
            </Html>

            {/* University Crest Disc at Apex */}
            <mesh position={[0, 5.2, 0.8]} rotation={[-0.2 + Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.65, 0.65, 0.1, 16]} />
              <meshStandardMaterial color="#15803d" />
            </mesh>

            {/* Central Pyramid Collider */}
            <CuboidCollider args={[2.0, 3.5, 2.0]} position={[0, 3.5, 0]} />
          </group>

          {/* Sweeping Arched Side Wings (Timber/Bronze Arches spanning left & right) */}
          {/* Left Wing Arch */}
          <mesh position={[-6.2, 3.6, 0]} rotation={[0, 0, 0.22]} castShadow>
            <boxGeometry args={[8.5, 0.6, 0.8]} />
            <meshStandardMaterial color="#543310" roughness={0.5} />
          </mesh>
          {/* Right Wing Arch */}
          <mesh position={[6.2, 3.6, 0]} rotation={[0, 0, -0.22]} castShadow>
            <boxGeometry args={[8.5, 0.6, 0.8]} />
            <meshStandardMaterial color="#543310" roughness={0.5} />
          </mesh>

          {/* Side Security Guard Gatehouses */}
          {[-10.5, 10.5].map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              {/* White Gatehouse Booth */}
              <mesh position={[0, 1.6, 0]} castShadow>
                <boxGeometry args={[2.6, 3.2, 2.6]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.4} />
              </mesh>
              {/* Green Roof Trim */}
              <mesh position={[0, 3.3, 0]} castShadow>
                <boxGeometry args={[2.9, 0.3, 2.9]} />
                <meshStandardMaterial color="#166534" />
              </mesh>
              {/* Security Boom Barrier Gate Pole */}
              <mesh position={[i === 0 ? 2.5 : -2.5, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.06, 0.06, 3.2, 8]} />
                <meshStandardMaterial color="#facc15" />
              </mesh>

              {/* Gatehouse Collider */}
              <CuboidCollider args={[1.3, 1.6, 1.3]} position={[0, 1.6, 0]} />
            </group>
          ))}

          {/* Flagpoles: Left = Nigeria, Right = FUNAAB */}
          {/* Left Flagpole & Nigerian Flag (Green-White-Green) */}
          <group position={[-3.8, 0, 2.5]}>
            <mesh position={[0, 4.0, 0]}>
              <cylinderGeometry args={[0.05, 0.07, 8.0, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
            {/* Nigerian Flag */}
            <mesh position={[0.7, 7.2, 0]}>
              <boxGeometry args={[1.4, 0.8, 0.02]} />
              <meshStandardMaterial color="#16a34a" />
            </mesh>
            <mesh position={[0.7, 7.2, 0.01]}>
              <boxGeometry args={[0.48, 0.8, 0.022]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </group>

          {/* Right Flagpole & FUNAAB University Flag (Emerald) */}
          <group position={[3.8, 0, 2.5]}>
            <mesh position={[0, 4.0, 0]}>
              <cylinderGeometry args={[0.05, 0.07, 8.0, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
            {/* FUNAAB Flag */}
            <mesh position={[0.7, 7.2, 0]}>
              <boxGeometry args={[1.4, 0.8, 0.02]} />
              <meshStandardMaterial color="#15803d" />
            </mesh>
            {/* Gold Crest Accent */}
            <mesh position={[0.7, 7.2, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.02, 12]} />
              <meshStandardMaterial color="#facc15" />
            </mesh>
          </group>

          {/* Front Perimeter Curved Railing */}
          {[-7.5, 7.5].map((x, i) => (
            <mesh key={i} position={[x, 0.5, 2.2]}>
              <boxGeometry args={[3.2, 1.0, 0.1]} />
              <meshStandardMaterial color="#ffffff" metalness={0.3} />
            </mesh>
          ))}
        </RigidBody>

        {/* 3D Wayfinding Sign */}
        <Html position={[0, 7.2, 0]} center distanceFactor={28} style={{ pointerEvents: 'none' }}>
          <div className="px-4 py-1.5 rounded-xl bg-emerald-950/95 border-2 border-emerald-400 text-center shadow-2xl backdrop-blur-md whitespace-nowrap">
            <div className="text-[11px] font-black tracking-widest text-emerald-300 font-['Outfit'] uppercase">
              FEDERAL UNIVERSITY OF AGRICULTURE, ABEOKUTA
            </div>
            <div className="text-[9px] font-extrabold text-white tracking-widest uppercase">
              ★ CEREMONIAL MAIN RESUMPTION GATE ★
            </div>
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          4. THE ICONIC W-LANDMARK / RESUMPTION PLAZA (Inspired by Image C)
          Position: [0, 0, 24]
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[0, 0, 24]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Paved Elevated Stone Plaza */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
            <planeGeometry args={[22, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
          </mesh>

          {/* ─── TWIN TRIANGULAR 'W' ARCH STRUCTURE ─── */}
          {/* Left Triangle Peak (Base X: -7 to 0, Peak at X = -3.5, Y = 6.0) */}
          <mesh position={[-5.3, 3.0, 0]} rotation={[0, 0, -0.58]} castShadow>
            <boxGeometry args={[0.55, 6.8, 0.55]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[-1.7, 3.0, 0]} rotation={[0, 0, 0.58]} castShadow>
            <boxGeometry args={[0.55, 6.8, 0.55]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.2} />
          </mesh>

          {/* Right Triangle Peak (Base X: 0 to 7, Peak at X = 3.5, Y = 6.0) */}
          <mesh position={[1.7, 3.0, 0]} rotation={[0, 0, -0.58]} castShadow>
            <boxGeometry args={[0.55, 6.8, 0.55]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[5.3, 3.0, 0]} rotation={[0, 0, 0.58]} castShadow>
            <boxGeometry args={[0.55, 6.8, 0.55]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.2} />
          </mesh>

          {/* Central V-Notch Medallion Pedestal */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[1.2, 1.6, 0.8]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* FUNAAB Crest Medallion at V-Center */}
          <mesh position={[0, 1.8, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.08, 16]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>

          {/* Left & Right Garden Planter Boxes with Lush Yellow-Green Duranta Hedges */}
          {[-7.5, 7.5].map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              {/* Stone Box */}
              <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[3.2, 0.7, 4.5]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.8} />
              </mesh>
              {/* Golden Duranta Foliage */}
              <mesh position={[0, 0.85, 0]} castShadow>
                <boxGeometry args={[2.8, 0.6, 4.0]} />
                <meshStandardMaterial color="#eab308" roughness={0.8} />
              </mesh>
              {/* Planter Physical Collider */}
              <CuboidCollider args={[1.6, 0.6, 2.25]} position={[0, 0.6, 0]} />
            </group>
          ))}

          {/* Physical Collider for Center Pedestal */}
          <CuboidCollider args={[0.6, 0.8, 0.4]} position={[0, 0.8, 0]} />
        </RigidBody>

        {/* 3D Wayfinding Sign */}
        <Html position={[0, 6.8, 0]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded-xl bg-slate-900/90 border border-emerald-400 text-center shadow-xl backdrop-blur-md whitespace-nowrap">
            <div className="text-[10px] font-extrabold text-emerald-300 font-['Outfit']">
              🏛️ FUNAAB W-Landmark Plaza
            </div>
            <div className="text-[8px] font-semibold text-slate-300">
              Ceremonial Quadrangle & Gathering Point
            </div>
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          5. MAIN CAR PARK & KEKE TERMINAL (Position: [-30, 0, 26])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[-30, 0, 26]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Paved Parking Lot */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
            <planeGeometry args={[18, 14]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>

          {/* Marked Yellow Keke Parking Bays */}
          {[-5, 0, 5].map((x, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, 1]}>
              <planeGeometry args={[3.2, 5.0]} />
              <meshStandardMaterial color="#eab308" opacity={0.3} transparent />
            </mesh>
          ))}

          {/* Transport Shelter (Green Roof & Metal Posts) */}
          <mesh position={[0, 2.0, -5.2]} castShadow>
            <boxGeometry args={[12, 0.12, 3.8]} />
            <meshStandardMaterial color="#15803d" />
          </mesh>
          {[-5.2, 0, 5.2].map((x, i) => (
            <mesh key={i} position={[x, 1.0, -5.2]}>
              <cylinderGeometry args={[0.08, 0.08, 2.0, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
          ))}

          {/* Passenger Waiting Benches */}
          <mesh position={[0, 0.35, -5.2]} castShadow>
            <boxGeometry args={[10, 0.35, 0.8]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>

          {/* Terminal Back Wall / Bench Collider */}
          <CuboidCollider args={[6.0, 1.0, 0.5]} position={[0, 1.0, -5.2]} />
        </RigidBody>

        <Html position={[0, 3.4, -5.2]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-3.5 py-1 rounded-xl bg-amber-950/95 border border-amber-400 text-amber-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap flex items-center gap-1.5">
            <span>🛺</span>
            <span>Campus Keke Terminal • Main Park</span>
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          6. FUNAAB SPORTS CENTRE & FOOTBALL PITCH (Position: [-50, 0, 0])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[-50, 0, 0]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Football Field Turf */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
            <planeGeometry args={[26, 36]} />
            <meshStandardMaterial color="#166534" roughness={0.85} />
          </mesh>

          {/* White Field Markings */}
          {/* Perimeter Boundary Touchlines */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <planeGeometry args={[22, 32]} />
            <meshStandardMaterial color="#ffffff" wireframe />
          </mesh>
          {/* Halfway Line */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, 0]}>
            <planeGeometry args={[22, 0.15]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Center Circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.027, 0]}>
            <ringGeometry args={[3.2, 3.35, 24]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>

          {/* North Goalpost (at Z = -16) */}
          <group position={[0, 0, -16]}>
            <mesh position={[-2.4, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[2.4, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 2.4, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.06, 0.06, 4.8, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Goal Net */}
            <mesh position={[0, 1.2, -0.6]} rotation={[0.4, 0, 0]}>
              <boxGeometry args={[4.8, 2.4, 0.02]} />
              <meshStandardMaterial color="#e2e8f0" wireframe opacity={0.5} transparent />
            </mesh>
            <CuboidCollider args={[2.5, 1.2, 0.4]} position={[0, 1.2, -0.4]} />
          </group>

          {/* South Goalpost (at Z = 16) */}
          <group position={[0, 0, 16]}>
            <mesh position={[-2.4, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[2.4, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 2.4, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.06, 0.06, 4.8, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Goal Net */}
            <mesh position={[0, 1.2, 0.6]} rotation={[-0.4, 0, 0]}>
              <boxGeometry args={[4.8, 2.4, 0.02]} />
              <meshStandardMaterial color="#e2e8f0" wireframe opacity={0.5} transparent />
            </mesh>
            <CuboidCollider args={[2.5, 1.2, 0.4]} position={[0, 1.2, 0.4]} />
          </group>

          {/* Floodlight Towers at corners */}
          {[[-12, -17], [12, -17], [-12, 17], [12, 17]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 4.5, 0]}>
                <cylinderGeometry args={[0.1, 0.16, 9.0, 8]} />
                <meshStandardMaterial color="#475569" metalness={0.7} />
              </mesh>
              <mesh position={[0, 9.0, 0]}>
                <boxGeometry args={[1.2, 0.6, 0.3]} />
                <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1.0} />
              </mesh>
              <CylinderCollider args={[4.5, 0.2]} position={[0, 4.5, 0]} />
            </group>
          ))}
        </RigidBody>

        <Html position={[0, 4.2, 0]} center distanceFactor={24} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded-xl bg-emerald-950/95 border border-emerald-400 text-emerald-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            ⚽ FUNAAB Sports Centre & Athletic Field
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          7. TANTALIZERS & CAMPUS BUKA (Position: [-28, 0, 6])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[-28, 0, 6]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Food Stall Kiosk */}
          <mesh position={[0, 1.8, 0]} castShadow>
            <boxGeometry args={[6, 3.6, 4]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
          {/* Striped Sun Canopy */}
          <mesh position={[0, 3.3, 0.8]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[6.4, 0.15, 3]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          {/* Food Kiosk Collider */}
          <CuboidCollider args={[3.0, 1.8, 2.0]} position={[0, 1.8, 0]} />

          {/* Picnic Tables */}
          {[-4.5, 4.5].map((x, i) => (
            <group key={i} position={[x, 0, 3]}>
              <mesh position={[0, 0.4, 0]} castShadow>
                <boxGeometry args={[2.4, 0.8, 1.6]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0, 2.2, 0]}>
                <coneGeometry args={[1.6, 0.6, 8]} />
                <meshStandardMaterial color="#f59e0b" />
              </mesh>
              <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 2.2, 8]} />
                <meshStandardMaterial color="#475569" />
              </mesh>
              <CuboidCollider args={[1.2, 0.4, 0.8]} position={[0, 0.4, 0]} />
            </group>
          ))}

          {/* Suya Barbecue Grill */}
          <mesh position={[-2.5, 0.6, 2.5]} castShadow>
            <boxGeometry args={[1.2, 1.2, 0.8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[-2.5, 1.22, 2.5]}>
            <planeGeometry args={[1.0, 0.6]} />
            <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={1.2} />
          </mesh>
          <CuboidCollider args={[0.6, 0.6, 0.4]} position={[-2.5, 0.6, 2.5]} />
        </RigidBody>

        <Html position={[0, 4.2, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-orange-950/90 border border-orange-400 text-orange-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🍗 Tantalizers & Campus Buka (Food Hub)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          8. FUNAAB HEALTH CENTRE (Position: [-28, 0, -16])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[-28, 0, -16]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Main Clinic Hall (Width 12, Height 5, Depth 8) */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <boxGeometry args={[12, 5, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
          {/* Emerald Roof Trim */}
          <mesh position={[0, 5.1, 0]} castShadow>
            <boxGeometry args={[12.4, 0.4, 8.4]} />
            <meshStandardMaterial color="#166534" />
          </mesh>

          {/* Red Cross Emblem */}
          <group position={[0, 3.2, 4.05]}>
            <mesh>
              <boxGeometry args={[1.2, 0.35, 0.05]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
            <mesh>
              <boxGeometry args={[0.35, 1.2, 0.05]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
          </group>

          {/* Entrance Doorway Canopy */}
          <mesh position={[0, 2.4, 4.6]} castShadow>
            <boxGeometry args={[4.2, 0.15, 1.6]} />
            <meshStandardMaterial color="#15803d" />
          </mesh>

          {/* Physical Building Collider */}
          <CuboidCollider args={[6.0, 2.5, 4.0]} position={[0, 2.5, 0]} />
        </RigidBody>

        <Html position={[0, 4.4, 4.2]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-emerald-950/95 border border-emerald-400 text-emerald-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🏥 FUNAAB Health Centre (Clinic & Pharmacy)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          9. SENATE BUILDING & 'NIMBE ADEDIPE LIBRARY (Position: [0, 0, -44])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[0, 0, -44]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Main 3-tier Central Complex */}
          <mesh position={[0, 3.5, 0]} castShadow>
            <boxGeometry args={[18, 7, 10]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
          </mesh>
          {/* Clock Tower Spire */}
          <mesh position={[0, 8.5, 0]} castShadow>
            <boxGeometry args={[5.0, 4.0, 5.0]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Gold Clock Disc */}
          <mesh position={[0, 8.8, 2.55]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.9, 0.9, 0.05, 16]} />
            <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={0.5} />
          </mesh>

          {/* Colonnade Concrete Louvers */}
          {[-7, -3.5, 3.5, 7].map((x, i) => (
            <mesh key={i} position={[x, 3.5, 5.2]}>
              <boxGeometry args={[0.3, 7.0, 0.4]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          ))}

          {/* Physical Collider */}
          <CuboidCollider args={[9.0, 3.5, 5.0]} position={[0, 3.5, 0]} />
        </RigidBody>

        <Html position={[0, 7.2, 5.3]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/95 border-2 border-emerald-400 text-center shadow-2xl backdrop-blur-md whitespace-nowrap">
            <div className="text-[11px] font-black text-emerald-300 font-['Outfit'] uppercase">
              🏛️ Senate & 'Nimbe Adedipe Library
            </div>
            <div className="text-[9px] font-bold text-white uppercase">
              Central University Administrative & Academic Core
            </div>
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          10. COLFHEC ACADEMIC BUILDING (Position: [-38, 0, -44])
          ENTERABLE: Wall colliders surround the perimeter with open doorway
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[-38, 0, -44]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Main 2-story Hall (Width 20, Depth 14, Height 8) */}
          <mesh position={[0, 4, 0]} castShadow>
            <boxGeometry args={[20, 8, 14]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
          {/* Emerald Roof Trim */}
          <mesh position={[0, 8.2, 0]} castShadow>
            <boxGeometry args={[21, 0.5, 15]} />
            <meshStandardMaterial color="#166534" />
          </mesh>

          {/* Pillars & Entrance Portico */}
          {[-7, -2.5, 2.5, 7].map((x, i) => (
            <mesh key={i} position={[x, 3.5, 7.3]} castShadow>
              <cylinderGeometry args={[0.3, 0.35, 7, 12]} />
              <meshStandardMaterial color="#e2e8f0" />
            </mesh>
          ))}

          {/* Windows Array */}
          {[-6, 0, 6].map((x, i) => (
            <mesh key={i} position={[x, 5.5, 7.05]}>
              <boxGeometry args={[3, 2, 0.1]} />
              <meshStandardMaterial color="#0284c7" opacity={0.7} transparent metalness={0.8} />
            </mesh>
          ))}

          {/* ─── PHYSICAL WALL COLLIDERS FOR COLFHEC ─── */}
          {/* Back Wall */}
          <CuboidCollider args={[10.0, 4.0, 0.4]} position={[0, 4.0, -6.6]} />
          {/* Left Wall */}
          <CuboidCollider args={[0.4, 4.0, 7.0]} position={[-9.6, 4.0, 0]} />
          {/* Right Wall */}
          <CuboidCollider args={[0.4, 4.0, 7.0]} position={[9.6, 4.0, 0]} />
          {/* Front Left Wall */}
          <CuboidCollider args={[3.75, 4.0, 0.4]} position={[-6.25, 4.0, 6.6]} />
          {/* Front Right Wall */}
          <CuboidCollider args={[3.75, 4.0, 0.4]} position={[6.25, 4.0, 6.6]} />
          {/* Doorway between X = -2.5 and +2.5 is completely open! */}
          <CylinderCollider args={[3.5, 0.3]} position={[-7, 3.5, 7.3]} />
          <CylinderCollider args={[3.5, 0.3]} position={[7, 3.5, 7.3]} />
        </RigidBody>

        <Html position={[0, 7.5, 7.2]} center distanceFactor={24} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-emerald-950/90 border border-emerald-400 text-emerald-300 text-xs font-extrabold font-['Outfit'] shadow-xl whitespace-nowrap">
            🎓 COLFHEC (Food Science & Human Ecology)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          11. COLENG & COLERM/COLPLANT FACULTY ZONES
      ══════════════════════════════════════════════════════════════════════ */}
      {/* COLENG Engineering Complex (Position: [-18, 0, -60]) */}
      <group position={[-18, 0, -60]}>
        <RigidBody type="fixed" colliders={false}>
          <mesh position={[0, 3.0, 0]} castShadow>
            <boxGeometry args={[14, 6, 8]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
          </mesh>
          <mesh position={[0, 6.2, 0]} castShadow>
            <boxGeometry args={[14.4, 0.4, 8.4]} />
            <meshStandardMaterial color="#2563eb" />
          </mesh>
          <CuboidCollider args={[7.0, 3.0, 4.0]} position={[0, 3.0, 0]} />
        </RigidBody>
        <Html position={[0, 5.0, 4.2]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-2.5 py-1 rounded bg-blue-950/90 border border-blue-400 text-blue-300 text-xs font-bold font-['Outfit'] shadow-lg whitespace-nowrap">
            ⚙️ COLENG (College of Engineering)
          </div>
        </Html>
      </group>

      {/* COLERM & COLPLANT Plaza (Position: [26, 0, -44]) */}
      <group position={[26, 0, -44]}>
        <RigidBody type="fixed" colliders={false}>
          <mesh position={[0, 3.5, 0]} castShadow>
            <boxGeometry args={[14, 7, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
          <mesh position={[0, 7.2, 0]} castShadow>
            <boxGeometry args={[14.4, 0.4, 10.4]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
          <CuboidCollider args={[7.0, 3.5, 5.0]} position={[0, 3.5, 0]} />
        </RigidBody>
        <Html position={[0, 5.5, 5.2]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-2.5 py-1 rounded bg-amber-950/90 border border-amber-400 text-amber-300 text-xs font-bold font-['Outfit'] shadow-lg whitespace-nowrap">
            🌾 COLERM & COLPLANT (Agric & Env Sciences)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          12. BANK & ATM GALLERY (Position: [32, 0, 24])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[32, 0, 24]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Main Bank Hall */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <boxGeometry args={[12, 5, 8]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
          </mesh>
          <mesh position={[0, 4.8, 0]} castShadow>
            <boxGeometry args={[12.4, 0.6, 8.4]} />
            <meshStandardMaterial color="#1e40af" />
          </mesh>
          <CuboidCollider args={[6.0, 2.5, 4.0]} position={[0, 2.5, 0]} />

          {/* ATM Kiosks */}
          {[-2, 2].map((x, i) => (
            <group key={i} position={[x, 0, 4.2]}>
              <mesh position={[0, 1.2, 0]} castShadow>
                <boxGeometry args={[1.2, 2.4, 0.8]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
              <mesh position={[0, 1.6, 0.42]}>
                <planeGeometry args={[0.6, 0.4]} />
                <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
              </mesh>
              <CuboidCollider args={[0.6, 1.2, 0.4]} position={[0, 1.2, 0]} />
            </group>
          ))}
        </RigidBody>

        <Html position={[0, 4.2, 4.3]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-blue-950/90 border border-blue-400 text-blue-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🏦 FUNAAB Microfinance Bank & ATM
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          13. AGROMET METEOROLOGICAL STATION (Position: [48, 0, 6])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[48, 0, 6]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Station Enclosure Ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <planeGeometry args={[12, 12]} />
            <meshStandardMaterial color="#3f3f46" roughness={0.9} />
          </mesh>
          {/* Solar Panel Array */}
          <mesh position={[-3, 1.2, 0]} rotation={[0.4, 0, 0]} castShadow>
            <boxGeometry args={[3.5, 0.1, 2.0]} />
            <meshStandardMaterial color="#1e3a8a" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Weather Mast & Anemometer */}
          <mesh position={[3, 3.5, 0]}>
            <cylinderGeometry args={[0.06, 0.1, 7.0, 8]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
          </mesh>
          <mesh position={[3, 7.0, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          {/* Rain Gauge Cylinder */}
          <mesh position={[0, 0.8, -2]}>
            <cylinderGeometry args={[0.25, 0.25, 1.6, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} />
          </mesh>
          <CuboidCollider args={[6.0, 1.5, 6.0]} position={[0, 1.5, 0]} />
        </RigidBody>

        <Html position={[0, 4.2, 0]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-2.5 py-1 rounded bg-teal-950/90 border border-teal-400 text-teal-300 text-xs font-bold font-['Outfit'] shadow-lg whitespace-nowrap">
            🌤️ Agromet Meteorological Research Station
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          14. IYALODE HOSTEL & PLAYSTATION GAME DEN (Position: [34, 0, -16])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[34, 0, -16]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Hostel Dormitory Block (Background) */}
          <mesh position={[0, 5, -8]} castShadow>
            <boxGeometry args={[22, 10, 8]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
          </mesh>
          <mesh position={[0, 10.3, -8]} castShadow>
            <boxGeometry args={[23, 0.6, 9]} />
            <meshStandardMaterial color="#7c2d12" />
          </mesh>
          <CuboidCollider args={[11.0, 5.0, 4.0]} position={[0, 5.0, -8]} />

          {/* Social Pergola Gazebo & Benches */}
          <mesh position={[-4, 2.6, 2]} castShadow>
            <boxGeometry args={[6, 0.2, 6]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[-4, 0.35, 2]} castShadow>
            <boxGeometry args={[3.5, 0.3, 1.2]} />
            <meshStandardMaterial color="#0284c7" />
          </mesh>
          <CuboidCollider args={[2.0, 0.5, 1.0]} position={[-4, 0.5, 2]} />

          {/* FUNAAB Game Den (PlayStation 5 Room at [38, 0, -6] relative to group: [+4, 0, +10]) */}
          <group position={[4, 0, 10]}>
            <mesh position={[0, 2.5, 0]} castShadow>
              <boxGeometry args={[8, 5, 6]} />
              <meshStandardMaterial color="#0f172a" roughness={0.3} />
            </mesh>
            <mesh position={[0, 4.8, 0]} castShadow>
              <boxGeometry args={[8.4, 0.4, 6.4]} />
              <meshStandardMaterial color="#3b82f6" emissive="#2563eb" emissiveIntensity={0.6} />
            </mesh>
            {/* TV Displays */}
            <mesh position={[0, 1.6, 3.1]}>
              <boxGeometry args={[1.8, 1.1, 0.1]} />
              <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.9} />
            </mesh>
            <CuboidCollider args={[4.0, 2.5, 3.0]} position={[0, 2.5, 0]} />
          </group>
        </RigidBody>

        <Html position={[-4, 3.8, 2]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-purple-950/90 border border-purple-400 text-purple-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🌴 Iyalode Hostel & Social Square
          </div>
        </Html>

        <Html position={[4, 4.4, 13.2]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-indigo-950/90 border border-indigo-400 text-indigo-300 text-xs font-extrabold font-['Outfit'] shadow-xl whitespace-nowrap">
            🎮 FUNAAB Game Den (PS5 Room)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          15. CAMPUS VEGETATION (Neem & Palm Trees with Physics Colliders)
      ══════════════════════════════════════════════════════════════════════ */}
      {trees.map((tree, idx) => (
        <group key={idx} position={tree.pos} scale={[tree.scale, tree.scale, tree.scale]}>
          <RigidBody type="fixed" colliders={false}>
            {tree.type === 'palm' ? (
              <>
                {/* Palm Trunk */}
                <mesh position={[0, 2.5, 0]} castShadow>
                  <cylinderGeometry args={[0.18, 0.28, 5, 8]} />
                  <meshStandardMaterial color="#78350f" roughness={0.9} />
                </mesh>
                {/* Palm Fronds */}
                {[0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3].map((angle, k) => (
                  <mesh
                    key={k}
                    position={[0, 4.8, 0]}
                    rotation={[0.4, angle, 0]}
                    castShadow
                  >
                    <boxGeometry args={[0.4, 0.1, 2.4]} />
                    <meshStandardMaterial color="#15803d" />
                  </mesh>
                ))}
                <CylinderCollider args={[2.5, 0.25]} position={[0, 2.5, 0]} />
              </>
            ) : (
              <>
                {/* Neem Trunk */}
                <mesh position={[0, 1.5, 0]} castShadow>
                  <cylinderGeometry args={[0.25, 0.35, 3, 8]} />
                  <meshStandardMaterial color="#543310" roughness={0.8} />
                </mesh>
                {/* Canopy */}
                <mesh position={[0, 3.6, 0]} castShadow>
                  <sphereGeometry args={[1.8, 12, 12]} />
                  <meshStandardMaterial color="#166534" roughness={0.8} />
                </mesh>
                <CylinderCollider args={[1.5, 0.3]} position={[0, 1.5, 0]} />
              </>
            )}
          </RigidBody>
        </group>
      ))}

      {/* ══════════════════════════════════════════════════════════════════════
          16. CAMPUS SOLAR STREETLIGHTS (Glowing Lighting)
      ══════════════════════════════════════════════════════════════════════ */}
      {[
        [-5.5, 0, 48], [5.5, 0, 48], [-5.5, 0, 34], [5.5, 0, 34],
        [-14, 0, 26], [14, 0, 26], [-28, 0, 16], [-28, 0, -6],
        [32, 0, 16], [32, 0, -6], [0, 0, -34], [-24, 0, -34]
      ].map((pos, idx) => (
        <group key={idx} position={[pos[0], pos[1], pos[2]]}>
          {/* Pole */}
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 4.4, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          {/* Solar Panel on top */}
          <mesh position={[0, 4.5, 0]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.6, 0.04, 0.4]} />
            <meshStandardMaterial color="#1e3a8a" metalness={0.8} />
          </mesh>
          {/* Lamp */}
          <mesh position={[0.3, 4.3, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={2.0} />
          </mesh>
          <pointLight position={[0.3, 4.2, 0]} color="#fde047" intensity={0.45} distance={14} />
        </group>
      ))}

      {/* ══════════════════════════════════════════════════════════════════════
          17. CAMPUS JOB BOARDS (Physical Notice Boards across Campus)
      ══════════════════════════════════════════════════════════════════════ */}
      {[
        { pos: [-30, 0, 22], rot: 0, title: 'Car Park Job Board' },
        { pos: [-26, 0, 10], rot: -Math.PI / 4, title: "Mama's Delivery Board" },
        { pos: [-36, 0, 2], rot: Math.PI / 3, title: 'Sports Assistant Board' },
      ].map((board, idx) => (
        <group key={idx} position={[board.pos[0], 0, board.pos[2]]} rotation={[0, board.rot, 0]}>
          <RigidBody type="fixed" colliders={false}>
            {/* Wooden Posts */}
            <mesh position={[-0.8, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
              <meshStandardMaterial color="#451a03" roughness={0.8} />
            </mesh>
            <mesh position={[0.8, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
              <meshStandardMaterial color="#451a03" roughness={0.8} />
            </mesh>
            {/* Corkboard / Board Panel */}
            <mesh position={[0, 1.6, 0]} castShadow>
              <boxGeometry args={[2.0, 1.3, 0.12]} />
              <meshStandardMaterial color="#78350f" roughness={0.9} />
            </mesh>
            {/* Dark Green Header Bar */}
            <mesh position={[0, 2.2, 0.02]}>
              <boxGeometry args={[2.0, 0.25, 0.14]} />
              <meshStandardMaterial color="#14532d" />
            </mesh>
            {/* White/Yellow Job Notices pinned */}
            <mesh position={[-0.45, 1.6, 0.07]}>
              <boxGeometry args={[0.7, 0.7, 0.01]} />
              <meshStandardMaterial color="#fef08a" />
            </mesh>
            <mesh position={[0.45, 1.6, 0.07]}>
              <boxGeometry args={[0.7, 0.7, 0.01]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Collider */}
            <CuboidCollider args={[1.0, 1.2, 0.2]} position={[0, 1.2, 0]} />
          </RigidBody>

          {/* 3D Floating Tag */}
          <Html position={[0, 2.6, 0]} center distanceFactor={16} style={{ pointerEvents: 'none' }}>
            <div className="px-2.5 py-1 rounded-xl bg-indigo-950/95 border border-indigo-400 text-indigo-200 text-[10px] font-bold font-['Outfit'] shadow-xl whitespace-nowrap flex items-center gap-1">
              <span>💼</span>
              <span>{board.title}</span>
            </div>
          </Html>
        </group>
      ))}
      {/* ══════════════════════════════════════════════════════════════════════
          18. FLORAL WORLD RESTAURANT AT COLFHEC (Position: [-32, 0, -28])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={[-32, 0, -28]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Stone Paved Dining Terrace */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
            <planeGeometry args={[12, 10]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
          </mesh>

          {/* Kitchen / Serving Counter Pavilion */}
          <mesh position={[0, 2.0, -3.2]} castShadow>
            <boxGeometry args={[8, 4, 3.2]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.6} />
          </mesh>
          {/* Terracotta Overhanging Roof */}
          <mesh position={[0, 4.2, -3.2]} castShadow>
            <boxGeometry args={[9, 0.5, 4.2]} />
            <meshStandardMaterial color="#ea580c" roughness={0.5} />
          </mesh>

          {/* Serving Counter Shelf */}
          <mesh position={[0, 1.1, -1.4]} castShadow>
            <boxGeometry args={[6.5, 0.2, 0.8]} />
            <meshStandardMaterial color="#78350f" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.5, -1.4]} castShadow>
            <boxGeometry args={[6.2, 1.0, 0.6]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>

          {/* Flower Planter Boxes (Pink & Red Flowers) */}
          {[-4.5, 4.5].map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[1.2, 0.7, 7.0]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              {/* Pink Floral Top */}
              <mesh position={[0, 0.8, 0]}>
                <boxGeometry args={[1.0, 0.4, 6.6]} />
                <meshStandardMaterial color="#ec4899" roughness={0.9} />
              </mesh>
              <CuboidCollider args={[0.6, 0.5, 3.5]} position={[0, 0.5, 0]} />
            </group>
          ))}

          {/* Dining Tables & Parasols */}
          {[-2.2, 2.2].map((x, i) => (
            <group key={i} position={[x, 0, 1.8]}>
              {/* Table Top */}
              <mesh position={[0, 0.85, 0]} castShadow>
                <cylinderGeometry args={[0.9, 0.9, 0.08, 16]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.3} />
              </mesh>
              {/* Table Leg */}
              <mesh position={[0, 0.42, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.12, 0.85, 8]} />
                <meshStandardMaterial color="#334155" metalness={0.8} />
              </mesh>
              {/* Parasol Umbrella Pole */}
              <mesh position={[0, 1.8, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
              </mesh>
              {/* Parasol Canopy */}
              <mesh position={[0, 2.7, 0]} castShadow>
                <coneGeometry args={[1.6, 0.6, 12]} />
                <meshStandardMaterial color={i === 0 ? '#10b981' : '#f59e0b'} />
              </mesh>
              {/* Chairs around table */}
              {[-0.8, 0.8].map((cz, ci) => (
                <mesh key={ci} position={[0, 0.45, cz]} castShadow>
                  <cylinderGeometry args={[0.3, 0.3, 0.06, 12]} />
                  <meshStandardMaterial color="#334155" />
                </mesh>
              ))}
              <CylinderCollider args={[0.85, 0.9]} position={[0, 0.85, 0]} />
            </group>
          ))}

          {/* Building Physical Colliders */}
          <CuboidCollider args={[4.0, 2.0, 1.6]} position={[0, 2.0, -3.2]} />
          <CuboidCollider args={[3.2, 0.6, 0.4]} position={[0, 0.6, -1.4]} />
        </RigidBody>

        {/* 3D Restaurant Sign */}
        <Html position={[0, 4.8, -1.2]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="px-3.5 py-1.5 rounded-xl bg-amber-950/95 border-2 border-amber-400 text-center shadow-2xl backdrop-blur-md whitespace-nowrap">
            <div className="text-[11px] font-black tracking-wider text-amber-300 font-['Outfit'] uppercase flex items-center justify-center gap-1">
              <span>🌺</span> FLORAL WORLD RESTAURANT <span>🌺</span>
            </div>
            <div className="text-[8.5px] font-bold text-slate-200">
              COLFHEC Student Cafeteria & Lounge • [E] Order Food
            </div>
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          19. LECTURE HALL 3D ENTRANCES & TIMETABLE NOTICE BOARDS
      ══════════════════════════════════════════════════════════════════════ */}
      {[
        { pos: [-38, 0, -28], rot: 0, title: 'COLFHEC Lecture Hall', course: 'FST 201 • Food Chemistry' },
        { pos: [-8, 0, -44], rot: 0, title: 'Central Lecture Theatre (CLT)', course: 'MEE 203 • Thermodynamics' },
        { pos: [28, 0, -28], rot: 0, title: 'COLBIOS Lecture Hall', course: 'BIO 205 • Principles of Genetics' },
      ].map((hall, idx) => (
        <group key={idx} position={[hall.pos[0], 0, hall.pos[2]]} rotation={[0, hall.rot, 0]}>
          <RigidBody type="fixed" colliders={false}>
            {/* Entrance Arch Pillars */}
            <mesh position={[-1.6, 2.0, 0]} castShadow>
              <cylinderGeometry args={[0.22, 0.25, 4.0, 12]} />
              <meshStandardMaterial color="#047857" roughness={0.4} />
            </mesh>
            <mesh position={[1.6, 2.0, 0]} castShadow>
              <cylinderGeometry args={[0.22, 0.25, 4.0, 12]} />
              <meshStandardMaterial color="#047857" roughness={0.4} />
            </mesh>
            {/* Overhead Lintel */}
            <mesh position={[0, 4.1, 0]} castShadow>
              <boxGeometry args={[3.8, 0.4, 0.6]} />
              <meshStandardMaterial color="#065f46" />
            </mesh>
            {/* Double Glass Doors */}
            <mesh position={[-0.75, 1.8, 0]}>
              <boxGeometry args={[1.3, 3.4, 0.08]} />
              <meshStandardMaterial color="#38bdf8" opacity={0.65} transparent metalness={0.9} />
            </mesh>
            <mesh position={[0.75, 1.8, 0]}>
              <boxGeometry args={[1.3, 3.4, 0.08]} />
              <meshStandardMaterial color="#38bdf8" opacity={0.65} transparent metalness={0.9} />
            </mesh>

            {/* Physical Colliders for the Doorframe Sides */}
            <CylinderCollider args={[2.0, 0.25]} position={[-1.6, 2.0, 0]} />
            <CylinderCollider args={[2.0, 0.25]} position={[1.6, 2.0, 0]} />
          </RigidBody>

          {/* 3D Entrance Wayfinding Sign */}
          <Html position={[0, 4.7, 0]} center distanceFactor={18} style={{ pointerEvents: 'none' }}>
            <div className="px-3 py-1 rounded-xl bg-emerald-950/95 border-2 border-emerald-400 text-center shadow-xl backdrop-blur-md whitespace-nowrap">
              <div className="text-[10.5px] font-black text-emerald-300 font-['Outfit'] uppercase flex items-center justify-center gap-1">
                <span>🎓</span> {hall.title}
              </div>
              <div className="text-[8.5px] font-bold text-amber-300">
                {hall.course} • [E] Enter Hall
              </div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};
