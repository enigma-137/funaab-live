import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useInputStore } from '../stores/inputStore';
import { campusLocations } from '../config/campusLocations';
import { roadEdges, roadNodes } from '../config/kekeRoutes';

const SIZE = 116; // CSS px
const RANGE = 62; // metres from the student to the edge of the map

/**
 * A small round map that stays on screen while you follow a route: roads, buildings, you in the
 * middle (the top is where the camera looks) and the destination, pinned to the edge when it's
 * further than the map reaches. Tap it for the full campus map.
 */
export function MiniMap({ onOpen }: { onOpen: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = SIZE * dpr;
    el.height = SIZE * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const half = SIZE / 2, scale = half / RANGE;
    const draw = () => {
      const { myPosition, navigationDestination } = useGameStore.getState();
      const yaw = useInputStore.getState().cameraYaw;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      // World offset from the student → map pixels, with the camera's forward direction at the top.
      const to = (x: number, z: number): [number, number] => {
        const dx = x - myPosition[0], dz = z - myPosition[2];
        return [half + (dx * cos - dz * sin) * scale, half + (dx * sin + dz * cos) * scale];
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath(); ctx.arc(half, half, half - 1, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#10281d'; ctx.fillRect(0, 0, SIZE, SIZE);
      // Roads
      ctx.strokeStyle = '#6b7a72'; ctx.lineWidth = Math.max(3, 7 * scale); ctx.lineCap = 'butt';
      for (const [a, b] of roadEdges) {
        const p = roadNodes[a], q = roadNodes[b];
        const [x1, y1] = to(p[0], p[2]), [x2, y2] = to(q[0], q[2]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      // Buildings (footprints are already in world axes, so rotate each corner with the map)
      ctx.fillStyle = '#4f8f6a';
      for (const l of campusLocations) {
        const [w, d] = l.footprint;
        if (!w || Math.hypot(l.position[0] - myPosition[0], l.position[2] - myPosition[2]) > RANGE + 30) continue;
        const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([cx, cz]) => to(l.position[0] + cx, l.position[2] + cz));
        ctx.beginPath(); corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
      }
      // Destination: a pin, or an arrow on the rim when it's off the map.
      if (navigationDestination) {
        const [tx, ty] = to(navigationDestination.position[0], navigationDestination.position[2]);
        const dx = tx - half, dy = ty - half, dist = Math.hypot(dx, dy), edge = half - 9;
        const inside = dist <= edge;
        const px = inside ? tx : half + (dx / dist) * edge, py = inside ? ty : half + (dy / dist) * edge;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(half, half); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, inside ? 5.5 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      // You: always at the centre, facing up.
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0f766e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(half, half - 7); ctx.lineTo(half + 5, half + 5); ctx.lineTo(half, half + 2); ctx.lineTo(half - 5, half + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      // North marker rotates with the map.
      const nx = half + Math.sin(yaw) * (half - 8), ny = half - Math.cos(yaw) * (half - 8);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('N', nx, ny);
    };
    draw();
    const timer = window.setInterval(draw, 200);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Mini map. Tap for the full campus map."
      className="pointer-events-auto fixed right-3 z-30 rounded-full border-2 border-emerald-400/70 bg-[#091f18]/80 shadow-xl backdrop-blur-sm active:scale-95 transition"
      style={{ width: SIZE, height: SIZE, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 150px)' }}
    >
      <canvas ref={canvas} style={{ width: SIZE, height: SIZE, display: 'block', borderRadius: '9999px' }} />
    </button>
  );
}
