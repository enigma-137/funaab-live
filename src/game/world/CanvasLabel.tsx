import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Camera-facing label drawn on a canvas with the device's own fonts. Unlike drei <Text>, it
// never downloads fonts (troika fetches fallback fonts from a CDN for emoji and non-Latin
// characters), so a slow or blocked network can never suspend and blank the 3D world.
export type LabelLine = { text: string; size: number; color: string };

const PX = 128; // canvas pixels per world metre

export function CanvasLabel({ lines, position, outline = '#064e3b' }: { lines: LabelLine[]; position: [number, number, number]; outline?: string }) {
  const key = JSON.stringify(lines) + outline;
  const { material, scale } = useMemo(() => {
    const font = (l: LabelLine) => `800 ${Math.round(l.size * PX)}px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;
    const probe = document.createElement('canvas').getContext('2d')!;
    const pad = 0.12 * PX;
    const width = Math.ceil(Math.max(...lines.map((l) => { probe.font = font(l); return probe.measureText(l.text).width; })) + pad * 2);
    const heights = lines.map((l) => l.size * PX * 1.3);
    const height = Math.ceil(heights.reduce((a, b) => a + b, 0) + pad);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, width);
    canvas.height = Math.max(2, height);
    const c = canvas.getContext('2d')!;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    let y = pad / 2;
    lines.forEach((l, i) => {
      c.font = font(l);
      const cy = y + heights[i] / 2;
      c.strokeStyle = outline;
      c.lineWidth = l.size * PX * 0.18;
      c.strokeText(l.text, width / 2, cy);
      c.fillStyle = l.color;
      c.fillText(l.text, width / 2, cy);
      y += heights[i];
    });
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
    return { material, scale: [canvas.width / PX, canvas.height / PX, 1] as [number, number, number] };
  }, [key]);
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  return <sprite material={material} position={position} scale={scale} renderOrder={3} />;
}
