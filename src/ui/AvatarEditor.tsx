import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { AvatarBody } from '../game/player/AvatarBody';
import { avatarOptions, normalizeAvatar, skinTones, stylePresets } from '../config/avatar';
import type { AvatarConfig } from '../types/game';

export function AvatarPreview({ config }: { config: AvatarConfig }) {
  return (
    <div
      className="student-preview"
      aria-label="3D student preview. Drag to rotate; pinch or scroll to zoom."
    >
      <Canvas
        camera={{ position: [0, 1.35, 4.2], fov: 36 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#edf1e8']} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 4]} intensity={2.4} />
        <AvatarBody config={config} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[0.65, 32]} />
          <meshStandardMaterial color="#d5dfce" />
        </mesh>
        <OrbitControls
          target={[0, 1.1, 0]}
          enablePan={false}
          minDistance={3}
          maxDistance={5.5}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
      <span>Drag to see front / back · pinch to zoom</span>
    </div>
  );
}
export default function AvatarEditor({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (a: AvatarConfig) => void;
}) {
  const a = normalizeAvatar(value);
  const change = (patch: Partial<AvatarConfig>) => onChange(normalizeAvatar({ ...a, ...patch }));
  return (
    <div className="student-avatar-layout">
      <AvatarPreview config={a} />
      <div>
        <div className="student-presets">
          {Object.entries(stylePresets).map(([name, preset]) => (
            <button type="button" key={name} onClick={() => change(preset)}>
              {name}
            </button>
          ))}
        </div>
        <fieldset>
          <legend>Skin tone</legend>
          <div className="student-swatches">
            {skinTones.map((tone, i) => (
              <button
                type="button"
                key={tone}
                aria-label={
                  ['Light brown', 'Caramel', 'Medium brown', 'Deep brown', 'Dark brown'][i]
                }
                aria-pressed={a.skinTone === tone}
                style={{ background: tone }}
                onClick={() => change({ skinTone: tone })}
              />
            ))}
          </div>
        </fieldset>
        <div className="student-fields">
          {Object.entries(avatarOptions).map(([key, options]) => (
            <label key={key}>
              {
                (
                  {
                    bodyType: 'Body presentation',
                    hairstyle: 'Hair',
                    topStyle: 'Top',
                    bottomStyle: 'Bottom',
                    shoeStyle: 'Shoes',
                  } as Record<string, string>
                )[key]
              }
              <select
                value={String(a[key as keyof AvatarConfig])}
                onChange={(e) => change({ [key]: e.target.value })}
              >
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o.replaceAll('-', ' ')}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="student-colors">
          {(['hairColor', 'topColor', 'bottomColor', 'shoeColor'] as const).map((key) => (
            <label key={key}>
              {key.replace('Color', '')}
              <input
                type="color"
                value={a[key]}
                onChange={(e) => change({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
