import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

export const CampusEnvironment: React.FC = () => {
  // Memoize random tree and prop positions for performance
  const trees = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number; type: 'neem' | 'palm' }[] = [];
    const seedPoints: [number, number][] = [
      // Boundary foliage
      [-55, -55], [-55, -30], [-55, 0], [-55, 30], [-55, 55],
      [55, -55], [55, -30], [55, 0], [55, 30], [55, 55],
      [-30, -55], [0, -55], [30, -55],
      [-30, 55], [30, 55],
      // Parks & Greenery patches
      [-5, -15], [5, -15], [0, -25], [10, 5], [-8, 25], [12, 28],
      [-35, -40], [-45, -25], [-42, 20], [35, -25], [38, 5], [42, 25]
    ];

    seedPoints.forEach(([x, z], i) => {
      list.push({
        pos: [x, 0, z],
        scale: 0.85 + (i % 5) * 0.1,
        type: i % 3 === 0 ? 'palm' : 'neem',
      });
    });
    return list;
  }, []);

  return (
    <group>
      {/* 1. TERRAIN (FUNAAB Campus Grass Lawn) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#2d5526" roughness={0.9} />
      </mesh>

      {/* 2. CAMPUS ROADS (Asphalt Network) */}
      {/* Main East-West Boulevard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 10]} receiveShadow>
        <planeGeometry args={[90, 7]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      {/* Road Yellow Center Strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 10]}>
        <planeGeometry args={[88, 0.35]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>

      {/* Gate Entrance Avenue (North-South) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 28]} receiveShadow>
        <planeGeometry args={[7, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 28]}>
        <planeGeometry args={[0.35, 30]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>

      {/* COLFHEC & Hostel Connecting Avenue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, 0.01, -12]} receiveShadow>
        <planeGeometry args={[6, 40]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -30]} receiveShadow>
        <planeGeometry args={[50, 6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>

      {/* 3. CEREMONIAL MAIN GATE (Position: 0, 0, 35) */}
      <group position={[0, 0, 35]}>
        {/* Left & Right Gate Pillars (Green & White) */}
        {[-4.5, 4.5].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 2.5, 0]} castShadow>
              <boxGeometry args={[1.2, 5, 1.2]} />
              <meshStandardMaterial color="#15803d" />
            </mesh>
            <mesh position={[0, 5.2, 0]} castShadow>
              <boxGeometry args={[1.5, 0.4, 1.5]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          </group>
        ))}

        {/* Arch Beam */}
        <mesh position={[0, 4.8, 0]} castShadow>
          <boxGeometry args={[10.2, 0.8, 1.2]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>

        {/* Security Guard Booth */}
        <mesh position={[6.5, 1.5, 0]} castShadow>
          <boxGeometry args={[2.2, 3, 2.2]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        <mesh position={[6.5, 3.1, 0]} castShadow>
          <boxGeometry args={[2.5, 0.2, 2.5]} />
          <meshStandardMaterial color="#166534" />
        </mesh>

        {/* Gate Signboard */}
        <Html position={[0, 5.8, 0]} center distanceFactor={25} style={{ pointerEvents: 'none' }}>
          <div className="px-4 py-1.5 rounded-lg bg-emerald-950/90 border-2 border-emerald-400 text-center shadow-2xl backdrop-blur-md whitespace-nowrap">
            <div className="text-[11px] font-extrabold tracking-widest text-emerald-300 font-['Outfit'] uppercase">
              Federal University of Agriculture, Abeokuta
            </div>
            <div className="text-[9px] font-bold text-white tracking-widest uppercase">
              ★ Ceremonial Resumption Gate ★
            </div>
          </div>
        </Html>
      </group>

      {/* 4. CAR PARK & KEKE TERMINAL (Position: -18, 0, 18) */}
      <group position={[-18, 0, 18]}>
        {/* Paved Parking Lot */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[16, 12]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>

        {/* Transport Shelter */}
        <mesh position={[0, 1.8, -4.5]} castShadow>
          <boxGeometry args={[10, 0.1, 3.5]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>
        {[-4.2, 4.2].map((x, i) => (
          <mesh key={i} position={[x, 0.9, -4.5]}>
            <cylinderGeometry args={[0.08, 0.08, 1.8, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} />
          </mesh>
        ))}

        {/* Benches */}
        <mesh position={[0, 0.35, -4.5]} castShadow>
          <boxGeometry args={[8, 0.3, 0.6]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>

        <Html position={[0, 3.2, -4.5]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-amber-950/90 border border-amber-400 text-amber-300 text-xs font-bold font-['Outfit'] shadow-lg whitespace-nowrap">
            🛺 Campus Keke Park & Terminal
          </div>
        </Html>
      </group>

      {/* 5. COLFHEC ACADEMIC BUILDING (Position: -30, 0, -20) */}
      <group position={[-30, 0, -20]}>
        {/* Main 2-story Hall */}
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

        {/* Building Sign */}
        <Html position={[0, 7.5, 7.2]} center distanceFactor={24} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-emerald-950/90 border border-emerald-400 text-emerald-300 text-xs font-extrabold font-['Outfit'] shadow-xl whitespace-nowrap">
            🎓 COLFHEC (Food Science & Human Ecology)
          </div>
        </Html>
      </group>

      {/* 6. BANK & ATM GALLERY (Position: 22, 0, 18) */}
      <group position={[22, 0, 18]}>
        {/* Bank Building */}
        <mesh position={[0, 2.5, 0]} castShadow>
          <boxGeometry args={[12, 5, 8]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
        </mesh>
        {/* Bank Blue Header */}
        <mesh position={[0, 4.8, 0]} castShadow>
          <boxGeometry args={[12.4, 0.6, 8.4]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>

        {/* ATM Machines (Glowing screens) */}
        {[-2, 2].map((x, i) => (
          <group key={i} position={[x, 0, 4.2]}>
            <mesh position={[0, 1.2, 0]} castShadow>
              <boxGeometry args={[1.2, 2.4, 0.8]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            {/* Glowing Screen */}
            <mesh position={[0, 1.6, 0.42]}>
              <planeGeometry args={[0.6, 0.4]} />
              <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
            </mesh>
          </group>
        ))}

        <Html position={[0, 4.2, 4.3]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-blue-950/90 border border-blue-400 text-blue-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🏦 FUNAAB Microfinance Bank & ATM
          </div>
        </Html>
      </group>

      {/* 7. MAMA CASS BUKA / FOOD SPOT (Position: 25, 0, -8) */}
      <group position={[25, 0, -8]}>
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

        {/* Outdoor Picnic Tables */}
        {[-4.5, 4.5].map((x, i) => (
          <group key={i} position={[x, 0, 3]}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[2.4, 0.8, 1.6]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
            {/* Table Umbrella */}
            <mesh position={[0, 2.2, 0]}>
              <coneGeometry args={[1.6, 0.6, 8]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 2.2, 8]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
          </group>
        ))}

        {/* Suya Barbecue Grill */}
        <mesh position={[-2.5, 0.6, 2.5]} castShadow>
          <boxGeometry args={[1.2, 1.2, 0.8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Glowing Charcoal */}
        <mesh position={[-2.5, 1.22, 2.5]}>
          <planeGeometry args={[1.0, 0.6]} />
          <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={1.2} />
        </mesh>

        <Html position={[0, 4.2, 0]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-orange-950/90 border border-orange-400 text-orange-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🍗 Mama Cass Campus Buka (Food & Drinks)
          </div>
        </Html>
      </group>

      {/* 8. IYALODE HOSTEL & SOCIAL SQUARE (Position: 15, 0, -35) */}
      <group position={[15, 0, -35]}>
        {/* Hostel Dormitory Block in Background */}
        <mesh position={[0, 5, -8]} castShadow>
          <boxGeometry args={[22, 10, 8]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 10.3, -8]} castShadow>
          <boxGeometry args={[23, 0.6, 9]} />
          <meshStandardMaterial color="#7c2d12" />
        </mesh>

        {/* Social Square Gazebo Pergola */}
        <mesh position={[0, 2.6, 0]} castShadow>
          <boxGeometry args={[6, 0.2, 6]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        {[-2.8, 2.8].map((x, i) =>
          [-2.8, 2.8].map((z, j) => (
            <mesh key={`${i}-${j}`} position={[x, 1.3, z]}>
              <cylinderGeometry args={[0.08, 0.08, 2.6, 8]} />
              <meshStandardMaterial color="#451a03" />
            </mesh>
          ))
        )}

        {/* Chill Sofas / Benches */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[3.5, 0.3, 1.2]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>

        <Html position={[0, 3.8, 0]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-purple-950/90 border border-purple-400 text-purple-300 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
            🌴 Iyalode Hostel & Social Square
          </div>
        </Html>
      </group>

      {/* 9. PLAYSTATION ROOM / GAME DEN (Position: -20, 0, -38) */}
      <group position={[-20, 0, -38]}>
        {/* Gaming Lounge Pavilion */}
        <mesh position={[0, 2.5, 0]} castShadow>
          <boxGeometry args={[10, 5, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} />
        </mesh>
        {/* Neon Roof Rim */}
        <mesh position={[0, 4.8, 0]} castShadow>
          <boxGeometry args={[10.4, 0.4, 8.4]} />
          <meshStandardMaterial color="#3b82f6" emissive="#2563eb" emissiveIntensity={0.6} />
        </mesh>

        {/* Gaming TV Displays facing entrance */}
        {[-2.2, 2.2].map((x, i) => (
          <group key={i} position={[x, 1.6, 4.1]}>
            {/* TV Screen */}
            <mesh position={[0, 0.6, 0]}>
              <boxGeometry args={[1.8, 1.1, 0.1]} />
              <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.9} />
            </mesh>
            {/* TV Stand & PS5 Console */}
            <mesh position={[0, -0.4, 0]}>
              <boxGeometry args={[1.6, 0.8, 0.6]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0.4, 0.1, 0]}>
              <boxGeometry args={[0.2, 0.4, 0.3]} />
              <meshStandardMaterial color="#f8fafc" emissive="#60a5fa" emissiveIntensity={0.4} />
            </mesh>
          </group>
        ))}

        <Html position={[0, 4.4, 4.2]} center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-1 rounded bg-indigo-950/90 border border-indigo-400 text-indigo-300 text-xs font-extrabold font-['Outfit'] shadow-xl whitespace-nowrap">
            🎮 FUNAAB Game Den (PlayStation 5 Room)
          </div>
        </Html>
      </group>

      {/* 10. CAMPUS SPORTS PITCH (Position: -40, 0, 5) */}
      <group position={[-40, 0, 5]}>
        {/* Pitch Turf */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <planeGeometry args={[22, 16]} />
          <meshStandardMaterial color="#15803d" roughness={0.9} />
        </mesh>
        {/* Goalposts */}
        {[-10, 10].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 1.2, -1.8]}>
              <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 1.2, 1.8]}>
              <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 2.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 3.6, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}

        {/* Football */}
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.25, 12, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* 11. VEGETATION: NEEM & PALM TREES */}
      {trees.map((tree, idx) => (
        <group key={idx} position={tree.pos} scale={[tree.scale, tree.scale, tree.scale]}>
          {tree.type === 'palm' ? (
            // Tropical Palm Tree
            <>
              {/* Curved Trunk */}
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
            </>
          ) : (
            // Full Canopy Neem Tree
            <>
              <mesh position={[0, 1.5, 0]} castShadow>
                <cylinderGeometry args={[0.25, 0.35, 3, 8]} />
                <meshStandardMaterial color="#543310" roughness={0.8} />
              </mesh>
              <mesh position={[0, 3.6, 0]} castShadow>
                <sphereGeometry args={[1.8, 12, 12]} />
                <meshStandardMaterial color="#166534" roughness={0.8} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {/* 12. CAMPUS STREETLIGHTS (Glowing Point Lights) */}
      {[
        [-10, 0, 14], [10, 0, 14], [-24, 0, 0], [20, 0, 0],
        [-10, 0, -26], [10, 0, -26], [0, 0, 24]
      ].map((pos, idx) => (
        <group key={idx} position={[pos[0], pos[1], pos[2]]}>
          {/* Pole */}
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 4.4, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          {/* Arm & Lamp */}
          <mesh position={[0.3, 4.3, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={2.0} />
          </mesh>
          <pointLight position={[0.3, 4.2, 0]} color="#fde047" intensity={0.45} distance={14} />
        </group>
      ))}
    </group>
  );
};
