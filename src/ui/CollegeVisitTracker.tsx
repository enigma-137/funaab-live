import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useGameStore } from '../stores/gameStore';
import { locationById } from '../config/campusLocations';
import { VISIT_COLLEGES, VISIT_RADIUS } from '../config/goals';

// Records the first time a student walks up to each college building, for the
// "Visited every college" badge. Badges pay nothing, so this is the one goal reported by the client.
const sent = new Set<string>();
const points = VISIT_COLLEGES.map((id) => ({ id, at: locationById(id).entrance }));

export function CollegeVisitTracker() {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    sent.clear(); // a new campus session (or another student) starts fresh; the server ignores repeats
    const timer = window.setInterval(() => {
      const [x, , z] = useGameStore.getState().myPosition;
      for (const p of points) {
        if (sent.has(p.id) || Math.hypot(x - p.at[0], z - p.at[2]) > VISIT_RADIUS) continue;
        sent.add(p.id);
        void supabase.rpc('record_college_visit', { p_place: p.id }).then(({ error }) => {
          // Allow a retry later unless the server doesn't have goals yet.
          if (error && !/could not find|does not exist/i.test(error.message)) sent.delete(p.id);
        });
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}
