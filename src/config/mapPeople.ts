// Who shows on the campus map: every other student walking about campus. Friends get a named pin;
// everyone else is a plain dot. Blocked students and anyone inside a lecture hall are left out.
import type { PlayerState } from '../types/game';

export interface MapPerson { id: string; username: string; college: string; x: number; z: number; friend: boolean }

export function mapPeople(
  players: Record<string, PlayerState>,
  me: { id?: string | null; username?: string | null } | null,
  friends: Array<{ id: string; username: string }>,
  blockedIds: string[],
): MapPerson[] {
  const friendIds = new Set(friends.map((f) => f.id));
  const friendNames = new Set(friends.map((f) => f.username.toLowerCase()));
  const blocked = new Set(blockedIds);
  const myName = me?.username?.toLowerCase();
  const seen = new Set<string>();
  const out: MapPerson[] = [];
  for (const p of Object.values(players)) {
    if (!p || !Array.isArray(p.position) || !Number.isFinite(p.position[0]) || !Number.isFinite(p.position[2])) continue;
    if (p.id === me?.id || (myName && p.username?.toLowerCase() === myName)) continue;
    if (blocked.has(p.id) || p.currentLectureId || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({
      id: p.id, username: p.username, college: p.college, x: p.position[0], z: p.position[2],
      friend: friendIds.has(p.id) || friendNames.has(p.username?.toLowerCase()),
    });
  }
  // Friends drawn last so their pins sit on top of the dots.
  return out.sort((a, b) => Number(a.friend) - Number(b.friend));
}
