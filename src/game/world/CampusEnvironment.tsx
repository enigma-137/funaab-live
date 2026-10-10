import { locationPosition, locationById } from '../../config/campusLocations';
import { CampusRoads, CampusExpansion, KekeRouteDebug } from './CampusExpansion';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';

export const CampusEnvironment: React.FC = () => {
  // Memoized palm and neem trees placed along campus avenues and green belts
  const trees = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number; type: 'neem' | 'palm' }[] = [];
    const seedPoints: [number, number][] = [[-130,-120],[-130,-60],[-130,0],[-130,85],[130,-120],[130,-60],[130,0],[130,85],[-20,10],[40,10],[-35,85],[40,95],[-15,-120],[65,-120]];
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
      <RigidBody type="fixed" colliders={false}>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,-17.5]} receiveShadow><planeGeometry args={[300,270]}/><meshStandardMaterial color="#587748"/></mesh>
        <CuboidCollider args={[150,.5,135]} position={[0,-.5,-17.5]}/>
        <CuboidCollider args={[146,4,1]} position={[0,4,-146]}/><CuboidCollider args={[146,4,1]} position={[0,4,111]}/>
        <CuboidCollider args={[1,4,130]} position={[-146,4,-17]}/><CuboidCollider args={[1,4,130]} position={[146,4,-17]}/>
      </RigidBody>
      <CampusRoads/><CampusExpansion/><KekeRouteDebug/>
      <group position={locationPosition('main-gate')}>
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
            <Html position={[0, 2.8, 1.9]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
        <Html position={[0, 7.2, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
      <group position={locationPosition('w-landmark')}>
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
        <Html position={[0, 6.8, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
      <group position={locationPosition('car-park')}>
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

        <Html position={[0, 3.4, -5.2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3.5 py-1 rounded-xl bg-amber-950/95 border border-amber-400 text-amber-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap flex items-center gap-1.5">
            <span>🛺</span>
            <span>Campus Keke Terminal • Main Park</span>
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          6. FUNAAB SPORTS CENTRE & FOOTBALL PITCH (Position: [-50, 0, 0])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={locationPosition('sports-centre')}>
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

        <Html position={[0, 4.2, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded-xl bg-emerald-950/95 border border-emerald-400 text-emerald-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            ⚽ FUNAAB Sports Centre & Athletic Field
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          7. TANTALIZERS & CAMPUS BUKA (Position: [-28, 0, 6])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={locationPosition('food-court')}>
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

        <Html position={[0, 4.2, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-orange-950/90 border border-orange-400 text-orange-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🍗 Tantalizers & Campus Buka (Food Hub)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          8. FUNAAB HEALTH CENTRE (Position: [-28, 0, -16])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={locationPosition('health-centre')}>
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

        <Html position={[0, 4.4, 4.2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-emerald-950/95 border border-emerald-400 text-emerald-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🏥 FUNAAB Health Centre (Clinic & Pharmacy)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          9. SENATE BUILDING & 'NIMBE ADEDIPE LIBRARY (Position: [0, 0, -44])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={locationPosition('senate-library')}>
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

        <Html position={[0, 7.2, 5.3]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/95 border-2 border-emerald-400 text-center shadow-2xl backdrop-blur-md whitespace-nowrap">
            <div className="text-[11px] font-black text-emerald-300 font-['Outfit'] uppercase">
              🏛️ Senate / Administration
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
      <group position={locationPosition('colfhec')}>
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

        <Html position={[0, 7.5, 7.2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-emerald-950/90 border border-emerald-400 text-emerald-300 text-xs font-extrabold font-['Outfit'] shadow-xl whitespace-nowrap">
            🎓 COLFHEC (Food Science & Human Ecology)
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          11. COLENG & COLERM/COLPLANT FACULTY ZONES
      ══════════════════════════════════════════════════════════════════════ */}
      {/* COLENG Engineering Complex (Position: [-18, 0, -60]) */}
      <group position={locationPosition('coleng')}>
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
        <Html position={[0, 5.0, 4.2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-2.5 py-1 rounded bg-blue-950/90 border border-blue-400 text-blue-300 text-xs font-bold font-['Outfit'] shadow-lg whitespace-nowrap">
            ⚙️ COLENG (College of Engineering)
          </div>
        </Html>
      </group>

      {/* COLERM & COLPLANT Plaza (Position: [26, 0, -44]) */}
      <group position={locationPosition('colerm-colplant')}>
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
        <Html position={[0, 5.5, 5.2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-2.5 py-1 rounded bg-amber-950/90 border border-amber-400 text-amber-300 text-xs font-bold font-['Outfit'] shadow-lg whitespace-nowrap">
            COLERM
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          12. BANK & ATM GALLERY (Position: [32, 0, 24])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={locationPosition('bank-atm')}>
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

        <Html position={[0, 4.2, 4.3]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-blue-950/90 border border-blue-400 text-blue-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🏦 FUNAAB Microfinance Bank & ATM
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          13. AGROMET METEOROLOGICAL STATION (Position: [48, 0, 6])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={locationPosition('agromet')}>
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

        <Html position={[0, 4.2, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-2.5 py-1 rounded bg-teal-950/90 border border-teal-400 text-teal-300 text-xs font-bold font-['Outfit'] shadow-lg whitespace-nowrap">
            🌤️ Agromet Meteorological Research Station
          </div>
        </Html>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          14. HOSTEL & PLAYSTATION GAME DEN (Position: [34, 0, -16])
      ══════════════════════════════════════════════════════════════════════ */}
      <group position={locationPosition('hostel-social')}>
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

        <Html position={[-4, 3.8, 2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-purple-950/90 border border-purple-400 text-purple-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🌴 Iyalode Hostel & Social Square
          </div>
        </Html>

        <Html position={[4, 4.4, 13.2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
        [-7,0,70],[7,0,55],[-62,0,40],[-62,0,-35],[62,0,40],[62,0,-35],[40,0,-92]
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
          
        </group>
      ))}

      {/* ══════════════════════════════════════════════════════════════════════
          17. CAMPUS JOB BOARDS (Physical Notice Boards across Campus)
      ══════════════════════════════════════════════════════════════════════ */}
      {[
        { pos: locationById('car-park').entrance, rot: 0, title: 'Car Park Job Board' },
        { pos: locationById('food-court').entrance, rot: -Math.PI / 4, title: "Mama's Delivery Board" },
        { pos: locationById('sports-centre').entrance, rot: Math.PI / 3, title: 'Sports Assistant Board' },
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
          <Html position={[0, 2.6, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
      <group position={locationPosition('floral-world')}>
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
        <Html position={[0, 4.8, -1.2]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
        { pos: locationPosition('colfhec-lecture-hall'), rot: 0, title: 'COLFHEC Lecture Hall', course: 'FST 201 • Food Chemistry' },
        { pos: locationPosition('central-lecture-hall'), rot: 0, title: 'Central Lecture Theatre (CLT)', course: 'MEE 203 • Thermodynamics' },
        { pos: locationPosition('colbios-lecture-hall'), rot: 0, title: 'COLBIOS Lecture Hall', course: 'BIO 205 • Principles of Genetics' },
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
          <Html position={[0, 4.7, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
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
