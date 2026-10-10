import React, { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { courseById } from '../config/academics';
import { useGameStore } from '../stores/gameStore';
import type { PlayerState } from '../types/game';
import './student.css';
const AvatarPreview = lazy(() =>
  import('./AvatarEditor').then((m) => ({ default: m.AvatarPreview })),
);

export function PublicStudentIdentity({ player }: { player: PlayerState }) {
  const presence = useGameStore((s) => s.players[player.connectionId]);
  const [identity, setIdentity] = useState<{
    course_id: string;
    game_matric_number: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    setIdentity(null);
    supabase
      .from('profiles')
      .select('course_id, game_matric_number')
      .eq('id', player.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIdentity(data);
      });
    return () => {
      alive = false;
    };
  }, [player.id]);
  return (
    <div className="mt-3 text-xs text-slate-300 space-y-2">
      <Suspense fallback={<p>Loading student…</p>}>
        <div style={{ height: 150, overflow: 'hidden', borderRadius: 12 }}>
          <div style={{ transform: 'scale(.65)', transformOrigin: 'top center', height: 230 }}>
            <AvatarPreview config={presence?.avatarConfig || player.avatarConfig} />
          </div>
        </div>
      </Suspense>
      {identity?.course_id && <p>{courseById(identity.course_id)?.name}</p>}
      {identity?.game_matric_number && <p>Game matric: {identity.game_matric_number}</p>}
      <p>{presence ? `${presence.currentZone || 'On campus'} · Online` : 'Offline'}</p>
    </div>
  );
}
