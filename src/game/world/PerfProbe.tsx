import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** `?perf=1` only: exposes what the renderer is doing so slow spots can be measured, not guessed. */
export function PerfProbe() {
  const { gl, scene } = useThree();
  const frames = { n: 0, t: 0, worst: 0 };
  useFrame((_, dt) => {
    frames.n++; frames.t += dt; frames.worst = Math.max(frames.worst, dt);
    if (frames.t < 1) return;
    let lights = 0, shadowLights = 0, meshes = 0, shadowCasters = 0, transparent = 0;
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight) { lights++; if ((o as THREE.Light).castShadow) shadowLights++; }
      if ((o as THREE.Mesh).isMesh && o.visible) {
        meshes++;
        if (o.castShadow) shadowCasters++;
        const m = (o as THREE.Mesh).material as THREE.Material;
        if (m && m.transparent) transparent++;
      }
    });
    (window as any).__perf = {
      fps: Math.round(frames.n / frames.t), worstMs: Math.round(frames.worst * 1000),
      calls: gl.info.render.calls, triangles: gl.info.render.triangles, points: gl.info.render.points,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, programs: gl.info.programs?.length ?? 0,
      lights, shadowLights, meshes, shadowCasters, transparent,
      pixelRatio: gl.getPixelRatio(), shadowMap: gl.shadowMap.enabled,
    };
    frames.n = 0; frames.t = 0; frames.worst = 0;
  });
  return null;
}
