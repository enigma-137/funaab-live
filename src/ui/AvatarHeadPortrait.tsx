import React, { memo, useLayoutEffect, useState, Component, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { AvatarBody } from '../game/player/AvatarBody';
import type { AvatarConfig } from '../types/game';

interface PortraitSceneProps {
  config: AvatarConfig;
}

function PortraitScene({ config }: PortraitSceneProps) {
  const { camera, invalidate } = useThree();

  useLayoutEffect(() => {
    // Frames the character's head and upper chest in a subtle three-quarter studio portrait angle
    camera.position.set(0.07, 1.79, 0.68);
    camera.lookAt(0, 1.76, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, config]);

  return (
    <>
      <ambientLight intensity={2.0} />
      <directionalLight position={[2, 3.5, 3]} intensity={2.4} />
      <directionalLight position={[-2.5, 1.5, 1.5]} intensity={1.1} color="#6ee7b7" />
      <AvatarBody config={config} />
    </>
  );
}

class PortraitErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export interface AvatarHeadPortraitProps {
  config?: AvatarConfig;
  username?: string;
  className?: string;
}

export const AvatarHeadPortrait = memo(({ config, username = 'U', className = '' }: AvatarHeadPortraitProps) => {
  const [canRender3D, setCanRender3D] = useState(true);

  const fallback = (
    <div
      className="w-full h-full flex items-center justify-center font-black text-white text-sm uppercase bg-emerald-700 select-none"
      style={{ backgroundColor: config?.shirtColor || '#15803d' }}
    >
      {username[0] || 'U'}
    </div>
  );

  if (!canRender3D || !config) {
    return (
      <div className={`overflow-hidden rounded-full ${className}`}>
        {fallback}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-full ${className}`}
      style={{
        background: 'radial-gradient(circle at 50% 36%, #28423b 0%, #111d1a 100%)',
      }}
    >
      <PortraitErrorBoundary fallback={fallback}>
        <Canvas
          camera={{ position: [0.07, 1.79, 0.68], fov: 32 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          frameloop="demand"
          onCreated={() => {}}
          onError={() => setCanRender3D(false)}
          className="w-full h-full pointer-events-none"
        >
          <PortraitScene config={config} />
        </Canvas>
      </PortraitErrorBoundary>
    </div>
  );
});

AvatarHeadPortrait.displayName = 'AvatarHeadPortrait';
