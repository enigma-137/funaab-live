import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useInputStore } from '../stores/inputStore';
import { doorFor, hostelRoomFor, isAtDoor } from '../config/hostelCompound';

/**
 * Shared courtyard HUD: your cosmetic room ("Block A · Room 6"), how many students are around,
 * and an Enter Room prompt only while standing at your own door. Entering always opens
 * world:funaab:hostel-room:<your user id>; the number is never used for access.
 */
export function HostelCompoundHud() {
  const user = useAuthStore((s) => s.user);
  const inCourtyard = useHostelStore((s) => s.roomId === 'world:funaab:hostel' && !s.owner);
  const busy = useHostelStore((s) => !!s.transition);
  const modal = useGameStore((s) => s.activeModal);
  const others = useGameStore((s) => Object.keys(s.players).filter((id) => id !== s.myConnectionId).length);
  const isTouch = useInputStore((s) => s.isTouchDevice);
  const room = user ? hostelRoomFor(user.id) : null;
  const door = room ? doorFor(room.room) : null;
  const atDoor = useGameStore((s) => !!door && isAtDoor(door, s.myPosition));
  const [entering, setEntering] = useState(false);
  const enter = () => {
    if (entering || busy) return;
    setEntering(true);
    useInputStore.getState().clearTargetDestination();
    void useHostelStore.getState().travel('room').finally(() => setEntering(false));
  };
  useEffect(() => {
    if (!inCourtyard || !atDoor || modal) return;
    const key = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key.toLowerCase() === 'e' || e.key === 'Enter') enter();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [inCourtyard, atDoor, modal, entering, busy]);
  if (!user || !room || !inCourtyard) return null;
  const around = others + 1;
  return <>
    <div className="hostel-compound-chip" role="status">
      <span>🏠 <b>{room.label}</b></span>
      <span className="hostel-compound-count">{around} student{around === 1 ? '' : 's'} around</span>
    </div>
    {atDoor && !modal && (
      <button className={`hostel-enter-room ${isTouch ? 'is-touch' : ''}`} onClick={enter} disabled={entering || busy}>
        {!isTouch && <kbd>E</kbd>}<span>🏠 {entering ? 'Opening…' : 'Enter Room'}</span><small>Room {room.room}</small>
      </button>
    )}
  </>;
}
