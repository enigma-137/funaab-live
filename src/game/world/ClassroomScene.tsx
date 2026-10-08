import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useLectureStore } from '../../stores/lectureStore';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { AvatarModel } from '../player/AvatarModel';

export const ClassroomScene: React.FC = () => {
  const { currentLecture, mySeatNumber, isHandRaised, classroomState } = useLectureStore();
  const { user } = useAuthStore();
  const { players } = useGameStore();

  const lecturerMeshRef = useRef<THREE.Group>(null);
  const orbitRef = useRef<any>(null);

  // Generate 30 predefined seat positions (5 rows x 6 columns)
  // Columns: X = -3.75, -2.25, -0.75, 0.75, 2.25, 3.75
  // Rows: Z = -4.0, -2.2, -0.4, 1.4, 3.2
  const seatPositions = useMemo(() => {
    const list: { seatNumber: number; pos: [number, number, number] }[] = [];
    const colX = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
    const rowZ = [-4.0, -2.2, -0.4, 1.4, 3.2];

    let count = 1;
    for (const z of rowZ) {
      for (const x of colX) {
        list.push({ seatNumber: count, pos: [x, 0, z] });
        count++;
      }
    }
    return list;
  }, []);

  const mySeat = seatPositions.find((s) => s.seatNumber === (mySeatNumber || 1)) || seatPositions[0];

  // Lecturer gentle idle & pacing animation
  useFrame((state) => {
    if (!lecturerMeshRef.current) return;
    const t = state.clock.getElapsedTime();
    lecturerMeshRef.current.position.x = Math.sin(t * 0.3) * 1.4;
    lecturerMeshRef.current.rotation.y = Math.PI + Math.sin(t * 0.4) * 0.15;
  });

  const activeStudentsMap = classroomState?.activeStudents || {};

  // Script timeline advancement
  useEffect(() => {
    if (!currentLecture) return;

    const timeline = currentLecture.timeline;
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (elapsed >= timeline[i].atSeconds) {
          useLectureStore.getState().updateLecturerSpeech(timeline[i].text, timeline[i].boardTopic);
          break;
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentLecture]);

  const currentSpeech = classroomState?.currentLecturerSpeech || currentLecture?.timeline[0]?.text || 'Welcome to class.';
  const currentBoard = classroomState?.currentBoardText || currentLecture?.timeline[0]?.boardTopic || `${currentLecture?.courseCode}: ${currentLecture?.title}`;

  return (
    <group>
      {/* ─── 1. RESTRICTED SEATED CLASSROOM CAMERA ─── */}
      <OrbitControls
        ref={orbitRef}
        target={[0, 1.4, -6.5]} // Look towards lecturer & blackboard
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 2.05}
        minAzimuthAngle={-Math.PI / 2.4}
        maxAzimuthAngle={Math.PI / 2.4}
      />

      {/* ─── 2. CLASSROOM ARCHITECTURE & ROOM ENCLOSURE ─── */}
      {/* Room Floor (Polished Parquet / Tiles) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>

      {/* Front Wall (Facing Class) */}
      <mesh position={[0, 3.5, -7.9]}>
        <boxGeometry args={[14, 7, 0.2]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      {/* Back Wall */}
      <mesh position={[0, 3.5, 7.9]}>
        <boxGeometry args={[14, 7, 0.2]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {/* Left Wall with Windows */}
      <mesh position={[-6.9, 3.5, 0]}>
        <boxGeometry args={[0.2, 7, 16]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      {/* Right Wall with Entrance Door */}
      <mesh position={[6.9, 3.5, 0]}>
        <boxGeometry args={[0.2, 7, 16]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6.0, 0]}>
        <planeGeometry args={[14, 16]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {/* Classroom Ambient Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 2]} intensity={0.9} castShadow />
      <pointLight position={[0, 5, -5]} intensity={0.8} color="#ffffff" distance={12} />
      <pointLight position={[0, 5, 1]} intensity={0.6} color="#ffffff" distance={12} />

      {/* ─── 3. FRONT STAGE & BLACKBOARD ─── */}
      {/* Raised Lecturer Stage */}
      <mesh position={[0, 0.2, -6.5]} receiveShadow>
        <boxGeometry args={[12, 0.4, 2.5]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Lecturer Podium */}
      <mesh position={[0, 0.8, -6.2]} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.7]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>

      {/* Large Blackboard */}
      <group position={[0, 2.8, -7.78]}>
        {/* Board Frame */}
        <mesh>
          <boxGeometry args={[9.5, 3.2, 0.08]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
        {/* Dark Green Chalkboard Face */}
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[9.1, 2.8, 0.02]} />
          <meshStandardMaterial color="#064e3b" roughness={0.9} />
        </mesh>

        {/* Dynamic Blackboard Content Display */}
        <Html position={[0, 0, 0.08]} center distanceFactor={12} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="w-[480px] p-4 bg-emerald-950/80 rounded-xl border border-emerald-500/40 text-emerald-100 font-mono text-[11px] leading-relaxed shadow-inner">
            <div className="text-amber-300 font-bold border-b border-emerald-500/40 pb-1 mb-2 font-['Outfit'] text-xs flex justify-between">
              <span>{currentLecture?.courseCode} — {currentLecture?.title}</span>
              <span className="text-emerald-400">FUNAAB</span>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs text-white leading-normal">
              {currentBoard}
            </pre>
          </div>
        </Html>
      </group>

      {/* ─── 4. SCRIPTED LECTURER NPC ─── */}
      <group ref={lecturerMeshRef} position={[0, 0.4, -6.5]}>
        <AvatarModel
          username={currentLecture?.lecturerName || 'Dr. Adeyemi'}
          college={currentLecture?.college || 'COLFHEC'}
          avatarConfig={{
            shirtColor: currentLecture?.lecturerAvatar.shirtColor || '#166534',
            skinColor: currentLecture?.lecturerAvatar.skinColor || '#8d5524',
          }}
          animation="idle"
        />

        {/* 3D Floating Speech Bubble for Subtitles */}
        <Html position={[0, 2.5, 0]} center distanceFactor={14} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950/95 border-2 border-emerald-400 text-white font-['Plus_Jakarta_Sans'] text-xs max-w-xs shadow-2xl backdrop-blur-md text-center">
            <div className="text-[10px] font-bold text-emerald-400 uppercase font-['Outfit'] mb-0.5">
              🎓 {currentLecture?.lecturerName} ({currentLecture?.lecturerTitle})
            </div>
            <div className="font-semibold text-slate-100 italic">
              "{currentSpeech}"
            </div>
          </div>
        </Html>
      </group>

      {/* ─── 5. 30 DESKS & CHAIRS (NO FAKE NPCS) ─── */}
      {seatPositions.map((seat) => {
        // Find if this seat is occupied by a real connected student
        const isMySeat = seat.seatNumber === mySeatNumber;
        const studentInSeat = isMySeat
          ? { username: user?.username || 'You', college: user?.college || 'COLENG', handRaised: isHandRaised }
          : Object.values(activeStudentsMap).find((s) => s.seatNumber === seat.seatNumber);

        // Or if another player in gameStore has this seatNumber
        const otherPlayer = !isMySeat && !studentInSeat
          ? Object.values(players).find((p) => p.currentLectureId === currentLecture?.id && p.seatNumber === seat.seatNumber)
          : null;

        const effectiveStudent = studentInSeat || otherPlayer;
        const studentHandRaised = isMySeat ? isHandRaised : (effectiveStudent?.handRaised || (otherPlayer as any)?.handRaised);

        return (
          <group key={seat.seatNumber} position={seat.pos}>
            {/* Wooden Student Desk */}
            <mesh position={[0, 0.7, 0]} castShadow>
              <boxGeometry args={[1.1, 0.08, 0.6]} />
              <meshStandardMaterial color="#92400e" roughness={0.7} />
            </mesh>
            {/* Metal Desk Legs */}
            {[-0.45, 0.45].map((dx, i) => (
              <mesh key={i} position={[dx, 0.35, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
                <meshStandardMaterial color="#1e293b" metalness={0.8} />
              </mesh>
            ))}

            {/* Wooden Chair */}
            <mesh position={[0, 0.4, 0.35]} castShadow>
              <boxGeometry args={[0.5, 0.06, 0.45]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>
            <mesh position={[0, 0.75, 0.55]} castShadow>
              <boxGeometry args={[0.5, 0.4, 0.05]} />
              <meshStandardMaterial color="#78350f" />
            </mesh>

            {/* Seat Number Badge on Desk */}
            <Html position={[0, 0.75, 0.2]} center distanceFactor={16} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className="px-1.5 py-0.2 rounded bg-slate-900/80 text-[8px] font-mono text-slate-400 border border-slate-700 select-none">
                #{seat.seatNumber}
              </div>
            </Html>

            {/* If a real connected student is in this seat, render seated avatar */}
            {effectiveStudent && (
              <group position={[0, 0, 0.35]}>
                <AvatarModel
                  username={effectiveStudent.username}
                  college={effectiveStudent.college || 'COLENG'}
                  avatarConfig={isMySeat ? (user?.avatarConfig as any) : ((effectiveStudent as any).avatarConfig || { shirtColor: '#15803d', skinColor: '#8d5524' })}
                  animation="sit"
                  isLocal={isMySeat}
                />

                {/* Raised Hand Visual Pill */}
                {studentHandRaised && (
                  <Html position={[0, 2.3, 0]} center distanceFactor={14} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] font-mono shadow-xl animate-bounce flex items-center gap-1">
                      <span>✋</span>
                      <span>Hand Raised</span>
                    </div>
                  </Html>
                )}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
};

export const ClassroomView: React.FC = () => {
  const { mySeatNumber } = useLectureStore();

  // Position camera at eye-level from player's assigned seat
  const seatPositions = useMemo(() => {
    const list: { seatNumber: number; pos: [number, number, number] }[] = [];
    const colX = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
    const rowZ = [-4.0, -2.2, -0.4, 1.4, 3.2];
    let count = 1;
    for (const z of rowZ) {
      for (const x of colX) {
        list.push({ seatNumber: count, pos: [x, 0, z] });
        count++;
      }
    }
    return list;
  }, []);

  const mySeat = seatPositions.find((s) => s.seatNumber === (mySeatNumber || 1)) || seatPositions[0];

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{
          position: [mySeat.pos[0], 1.4, mySeat.pos[2] + 0.3],
          fov: 60,
          near: 0.1,
          far: 50
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.7} color="#f8fafc" />
        <directionalLight
          position={[0, 8, 0]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          color="#fef08a"
        />
        <ClassroomScene />
      </Canvas>
    </div>
  );
};
