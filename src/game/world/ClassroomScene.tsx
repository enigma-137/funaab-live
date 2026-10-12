import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useLectureStore } from '../../stores/lectureStore';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { npcAppearance } from '../../config/npcAppearance';
import {
  CHAIR_BACK_Z,
  CHAIR_OFFSET_Z,
  FACE_BOARD,
  HALL_STANDING_VIEW,
  getLectureHall,
  hallNpcPopulation,
  hallSeatPositions,
  type HallSeat,
} from '../../config/lectureHalls';
import { AvatarModel } from '../player/AvatarModel';
import { AvatarBody } from '../player/AvatarBody';
import { CampusSign } from './CampusSign';

// Furniture is shared by every seat in every hall: one geometry/material set, not 30 copies.
// Layout per seat (z toward the back of the room): desk top at z ±0.3, chair centred at
// CHAIR_OFFSET_Z behind it, student faces the board (-Z) with knees under the desk.
const deskTopGeometry = new THREE.BoxGeometry(1.1, 0.05, 0.6);
const deskPanelGeometry = new THREE.BoxGeometry(1.1, 0.34, 0.03);
const deskLegGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8);
const chairSeatGeometry = new THREE.BoxGeometry(0.46, 0.05, 0.42);
const chairBackGeometry = new THREE.BoxGeometry(0.46, 0.42, 0.04);
const chairLegGeometry = new THREE.BoxGeometry(0.04, 0.45, 0.4);
const notebookGeometry = new THREE.BoxGeometry(0.34, 0.012, 0.24);
const bookGeometry = new THREE.BoxGeometry(0.19, 0.045, 0.26);
const seatMarkerGeometry = new THREE.RingGeometry(0.32, 0.42, 24);
const deskMaterial = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.7 });
const legMaterial = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8 });
const chairMaterial = new THREE.MeshStandardMaterial({ color: '#78350f' });
const notebookMaterial = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 });
const bookMaterials = ['#1d4ed8', '#b91c1c', '#15803d', '#a16207'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));

// Notebook in front of the student plus a closed textbook to one side, on the desk top (y 0.725).
const DeskStudyItems: React.FC<{ seatNumber: number }> = ({ seatNumber }) => (
  <group position={[0, 0.725, 0.04]}>
    <mesh position={[0.05, 0.006, 0.02]} rotation={[0, (seatNumber % 3 - 1) * 0.12, 0]} geometry={notebookGeometry} material={notebookMaterial} />
    <mesh position={[seatNumber % 2 ? -0.36 : 0.38, 0.023, -0.04]} rotation={[0, 0.25, 0]} geometry={bookGeometry} material={bookMaterials[seatNumber % bookMaterials.length]} />
  </group>
);
const BOARD_POINT = new THREE.Vector3(0, 2.4, -7.8);

export const ClassroomScene: React.FC = () => {
  const currentHallId = useLectureStore((s) => s.currentHallId);
  const currentLecture = useLectureStore((s) => s.currentLecture);
  const mySeatNumber = useLectureStore((s) => s.mySeatNumber);
  const isHandRaised = useLectureStore((s) => s.isHandRaised);
  const classroomState = useLectureStore((s) => s.classroomState);
  const attendanceStartedAt = useLectureStore((s) => s.attendanceStartedAt);
  const attendanceMode = useLectureStore((s) => s.attendanceMode);
  const sitDown = useLectureStore((s) => s.sitDown);
  const user = useAuthStore((s) => s.user);
  const players = useGameStore((s) => s.players);

  const hall = getLectureHall(currentHallId);
  const seats = useMemo(() => hallSeatPositions(hall), [hall]);
  // Deterministic per-hall crowd built from the shared NPC appearance system (config memoised so
  // AvatarBody doesn't rebuild its geometry on every render).
  const npcs = useMemo(() => hallNpcPopulation(hall).map((n) => ({ ...n, config: npcAppearance(n.id) })), [hall]);
  const npcBySeat = useMemo(() => new Map(npcs.filter((n) => n.seatNumber).map((n) => [n.seatNumber!, n])), [npcs]);
  const accentMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: hall.accent, roughness: 0.5 }), [hall.accent]);
  const markerMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: hall.accent, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    [hall.accent]
  );
  useEffect(() => () => { accentMaterial.dispose(); markerMaterial.dispose(); }, [accentMaterial, markerMaterial]);

  const lecturerMeshRef = useRef<THREE.Group>(null);

  // Lecturer gentle idle & pacing animation
  useFrame((state) => {
    if (!lecturerMeshRef.current) return;
    const t = state.clock.getElapsedTime();
    lecturerMeshRef.current.position.x = Math.sin(t * 0.3) * 1.4;
    // Avatars face +Z by default, which is toward the students here.
    lecturerMeshRef.current.rotation.y = Math.sin(t * 0.4) * 0.15;
  });

  const activeStudentsMap = classroomState?.activeStudents || {};

  // Script timeline advances only while the player is attending.
  useEffect(() => {
    if (!currentLecture || !attendanceStartedAt) return;
    const timeline = currentLecture.timeline;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - attendanceStartedAt) / 1000);
      for (let i = timeline.length - 1; i >= 0; i--) {
        if (elapsed >= timeline[i].atSeconds) {
          useLectureStore.getState().updateLecturerSpeech(timeline[i].text, timeline[i].boardTopic);
          break;
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentLecture, attendanceStartedAt]);

  const currentBoard = classroomState?.currentBoardText || currentLecture?.timeline[0]?.boardTopic || `${currentLecture?.courseCode}: ${currentLecture?.title}`;
  const mySeat = seats.find((s) => s.seatNumber === mySeatNumber) ?? null;
  const canPickSeat = !attendanceMode;

  return (
    <group>
      <HallCamera seat={mySeat} />

      {/* ─── ROOM ENCLOSURE (shared; wall tint and accents come from the hall config) ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.5, -7.9]}>
        <boxGeometry args={[14, 7, 0.2]} />
        <meshStandardMaterial color={hall.wall} />
      </mesh>
      <mesh position={[0, 3.5, 7.9]}>
        <boxGeometry args={[14, 7, 0.2]} />
        <meshStandardMaterial color={hall.wall} />
      </mesh>
      <mesh position={[-6.9, 3.5, 0]}>
        <boxGeometry args={[0.2, 7, 16]} />
        <meshStandardMaterial color={hall.wall} />
      </mesh>
      <mesh position={[6.9, 3.5, 0]}>
        <boxGeometry args={[0.2, 7, 16]} />
        <meshStandardMaterial color={hall.wall} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6.0, 0]}>
        <planeGeometry args={[14, 16]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      {/* Accent dado rail and left-wall windows */}
      <mesh position={[0, 1.1, 7.78]} material={accentMaterial}>
        <boxGeometry args={[14, 0.12, 0.04]} />
      </mesh>
      {[-4.5, 0, 4.5].map((z) => (
        <mesh key={z} position={[-6.78, 3.4, z]}>
          <boxGeometry args={[0.04, 2.2, 2.6]} />
          <meshStandardMaterial color="#9fd3e6" emissive="#9fd3e6" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {/* Back-right entrance door with exit sign */}
      <group position={[6.78, 0, 5.6]}>
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[0.08, 2.6, 1.6]} />
          <meshStandardMaterial color="#5b3a1e" />
        </mesh>
        <mesh position={[-0.02, 1.3, 0]} material={accentMaterial}>
          <boxGeometry args={[0.06, 2.8, 1.8]} />
        </mesh>
        <mesh position={[-0.06, 2.95, 0]}>
          <boxGeometry args={[0.04, 0.25, 0.7]} />
          <meshStandardMaterial color="#16a34a" emissive="#16a34a" emissiveIntensity={0.9} />
        </mesh>
      </group>

      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 8, 2]} intensity={0.9} castShadow />
      <pointLight position={[0, 5, -5]} intensity={0.8} color="#ffffff" distance={12} />
      <pointLight position={[0, 5, 1]} intensity={0.6} color="#ffffff" distance={12} />

      {/* ─── FRONT STAGE, PODIUM & BOARD ─── */}
      <mesh position={[0, 0.2, -6.5]} receiveShadow>
        <boxGeometry args={[12, 0.4, 2.5]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.41, -5.24]} material={accentMaterial}>
        <boxGeometry args={[12, 0.06, 0.06]} />
      </mesh>
      <mesh position={[0, 0.8, -6.2]} castShadow>
        <boxGeometry args={[1.2, 1.2, 0.7]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      <CampusSign position={[0, 4.95, -7.74]} width={6.4} height={0.62} title={hall.hallName.toUpperCase()} subtitle={hall.collegeName.toUpperCase()} />

      <group position={[0, 2.8, -7.78]}>
        <mesh material={accentMaterial}>
          <boxGeometry args={[9.5, 3.2, 0.08]} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[9.1, 2.8, 0.02]} />
          <meshStandardMaterial color="#064e3b" roughness={0.9} />
        </mesh>
        <Html position={[0, 0, 0.08]} center distanceFactor={12} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="w-[300px] max-h-[190px] overflow-hidden p-3 bg-emerald-950/80 rounded-xl border border-emerald-500/40 text-emerald-100 font-mono text-[11px] leading-relaxed shadow-inner">
            <div className="text-amber-300 font-bold border-b border-emerald-500/40 pb-1 mb-2 font-['Outfit'] text-xs flex justify-between">
              <span>{currentLecture?.courseCode} — {currentLecture?.title}</span>
              <span className="text-emerald-400">{hall.collegeCode}</span>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans text-xs text-white leading-normal line-clamp-4">
              {currentBoard}
            </pre>
          </div>
        </Html>
      </group>

      {/* ─── SCRIPTED LECTURER ─── */}
      <group ref={lecturerMeshRef} position={[0, 0.4, -6.5]}>
        <AvatarModel
          username={currentLecture?.lecturerName || 'Dr. Adeyemi'}
          college={currentLecture?.college || hall.collegeCode}
          avatarConfig={npcAppearance(currentLecture?.lecturerName || 'Dr. Adeyemi', {topStyle:'shirt', bottomStyle:'trousers', topColor:currentLecture?.lecturerAvatar.shirtColor || '#166534', skinTone:currentLecture?.lecturerAvatar.skinColor || '#8d5524'})}
          animation="idle"
        />
      </group>

      {/* ─── DESKS, CHAIRS & OCCUPANTS ─── */}
      {seats.map((seat) => {
        const isMySeat = seat.seatNumber === mySeatNumber;
        const realStudent = isMySeat
          ? null
          : Object.values(activeStudentsMap).find((s) => s.seatNumber === seat.seatNumber) ||
            Object.values(players).find((p) => p.currentLectureId === currentLecture?.id && p.seatNumber === seat.seatNumber);
        // NPCs give their seat up to any real student.
        const npc = !isMySeat && !realStudent ? npcBySeat.get(seat.seatNumber) : undefined;
        const isFree = !isMySeat && !realStudent && !npc;
        const studentHandRaised = isMySeat ? isHandRaised : Boolean((realStudent as { handRaised?: boolean } | null)?.handRaised);
        const selectable = isFree && canPickSeat;

        return (
          <group key={seat.seatNumber} position={seat.pos}>
            {/* Writing desk: top at 0.725m, front panel toward the board, open underneath for knees */}
            <mesh position={[0, 0.7, 0]} geometry={deskTopGeometry} material={deskMaterial} castShadow />
            <mesh position={[0, 0.5, -0.28]} geometry={deskPanelGeometry} material={deskMaterial} />
            <mesh position={[-0.5, 0.35, 0]} geometry={deskLegGeometry} material={legMaterial} />
            <mesh position={[0.5, 0.35, 0]} geometry={deskLegGeometry} material={legMaterial} />
            {!isFree && <DeskStudyItems seatNumber={seat.seatNumber} />}
            <group
              onClick={selectable ? (e) => { e.stopPropagation(); sitDown(seat.seatNumber); } : undefined}
            >
              {/* Chair behind the desk: seat top ~0.475m, back rest behind the student */}
              <mesh position={[0, 0.45, CHAIR_OFFSET_Z]} geometry={chairSeatGeometry} material={chairMaterial} castShadow />
              <mesh position={[-0.21, 0.225, CHAIR_OFFSET_Z]} geometry={chairLegGeometry} material={legMaterial} />
              <mesh position={[0.21, 0.225, CHAIR_OFFSET_Z]} geometry={chairLegGeometry} material={legMaterial} />
              <mesh position={[0, 0.72, CHAIR_BACK_Z]} geometry={chairBackGeometry} material={chairMaterial} castShadow />
              {selectable && (
                <mesh position={[0, 0.02, CHAIR_OFFSET_Z]} rotation={[-Math.PI / 2, 0, 0]} geometry={seatMarkerGeometry} material={markerMaterial} />
              )}
            </group>

            {selectable && (
              <Html position={[0, 0.75, 0.2]} center distanceFactor={16} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div className="px-1.5 py-0.2 rounded bg-slate-900/80 text-[8px] font-mono text-emerald-300 border border-emerald-600 select-none">
                  #{seat.seatNumber}
                </div>
              </Html>
            )}

            {npc && (
              <group position={[0, 0, CHAIR_OFFSET_Z]} rotation={[0, npc.rotY, 0]}>
                <AvatarBody config={npc.config} identity={npc.id} animation="sit" />
              </group>
            )}

            {(isMySeat || realStudent) && (
              <group position={[0, 0, CHAIR_OFFSET_Z]} rotation={[0, FACE_BOARD, 0]}>
                {isMySeat ? (
                  // Your own seated avatar has no floating name tag: the camera sits just behind it.
                  <AvatarBody config={user?.avatarConfig as any} identity={user?.id || 'local'} animation="sit" />
                ) : (
                  <AvatarModel
                    username={realStudent!.username}
                    college={realStudent!.college || hall.collegeCode}
                    avatarConfig={Object.values(players).find(p => p.username === realStudent!.username)?.avatarConfig || (realStudent as any).avatarConfig || { shirtColor: '#15803d', skinColor: '#8d5524' }}
                    animation="sit"
                  />
                )}
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

      {/* Standing NPC students in the aisles */}
      {npcs.filter((n) => !n.seatNumber).map((n) => (
        <group key={n.id} position={n.pos} rotation={[0, n.rotY, 0]}>
          <AvatarBody config={n.config} identity={n.id} animation="idle" />
        </group>
      ))}
    </group>
  );
};

// Standing: overview from the back door. Seated: over your own shoulder, looking at the board.
// Orbit target sits 1m ahead of the eye so dragging feels like turning your head.
const HallCamera: React.FC<{ seat: HallSeat | null }> = ({ seat }) => {
  const camera = useThree((s) => s.camera);
  const controls = useRef<any>(null);
  const eye = useMemo(
    // Seated: just behind and above your own head, so you see yourself at the desk and the board.
    () => (seat ? new THREE.Vector3(seat.pos[0] + 0.2, 2.05, seat.pos[2] + CHAIR_OFFSET_Z + 0.85) : new THREE.Vector3(...HALL_STANDING_VIEW)),
    [seat]
  );
  const target = useMemo(() => eye.clone().add(BOARD_POINT.clone().sub(eye).setY(seat ? -1.3 : -3.2).normalize()), [eye, seat]);
  const azimuth = Math.atan2(eye.x - target.x, eye.z - target.z);

  useEffect(() => {
    camera.position.copy(eye);
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [camera, eye, target]);

  return (
    <OrbitControls
      ref={controls}
      enableZoom={false}
      enablePan={false}
      rotateSpeed={0.5}
      minPolarAngle={Math.PI / 2 - 0.55}
      maxPolarAngle={Math.PI / 2 + 0.45}
      minAzimuthAngle={azimuth - 1.0}
      maxAzimuthAngle={azimuth + 1.0}
    />
  );
};

export const ClassroomView: React.FC = () => {
  const ClassroomCameraFraming: React.FC = () => {
    const { camera } = useThree();

    useEffect(() => {
      const updateFov = () => {
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = window.innerWidth < 640 ? 68 : 60;
          camera.updateProjectionMatrix();
        }
      };

      updateFov();
      window.addEventListener('resize', updateFov);
      return () => window.removeEventListener('resize', updateFov);
    }, [camera]);

    return null;
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{
          position: HALL_STANDING_VIEW,
          fov: 60,
          near: 0.1,
          far: 50
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      >
        <ClassroomCameraFraming />
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
