import React, { useRef, useState } from 'react';
import { useInputStore } from '../stores/inputStore';
import { useGameStore } from '../stores/gameStore';

const RADIUS = 46;

/** Floating thumb stick, bottom-left. Only shown when "Joystick" is chosen in Controls. */
export function Joystick() {
  const mode = useInputStore((s) => s.controlMode);
  const touch = useInputStore((s) => s.isTouchDevice);
  const modal = useGameStore((s) => s.activeModal);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const base = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  if (mode !== 'joystick' || !touch || modal) return null;

  const move = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
    setKnob([dx, dy]);
    useInputStore.getState().setJoystick(dx / RADIUS, dy / RADIUS);
  };
  const end = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    setKnob([0, 0]);
    useInputStore.getState().setJoystick(0, 0);
  };
  return (
    <div
      ref={base}
      className="campus-joystick"
      role="application"
      aria-label="Movement stick. Drag to walk; push to the edge to jog."
      onPointerDown={(e) => { pid.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <i style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  );
}
