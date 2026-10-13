import React, { useEffect } from 'react';
import { CampusSign } from './CampusSign';
import { useLeagueStore } from '../../stores/leagueStore';

/** Last week's College League champions, on a banner just inside the main gate. */
export function LeagueBanner() {
  const champion = useLeagueStore((s) => s.champion);
  const loadChampion = useLeagueStore((s) => s.loadChampion);
  useEffect(() => { void loadChampion(); const t = setInterval(() => void loadChampion(), 3600000); return () => clearInterval(t); }, []);
  if (!champion) return null;
  return (
    <group name="college_league_banner" position={[11, 0, 72]}>
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]}><cylinderGeometry args={[0.07, 0.08, 3.4, 6]} /><meshStandardMaterial color="#a16207" /></mesh>
      ))}
      {/* key: the sign's canvas texture is built once per title */}
      <CampusSign key={champion} position={[0, 2.8, 0]} width={3.6} height={0.95} title={`${champion} · CHAMPIONS`} subtitle="COLLEGE LEAGUE  •  LAST WEEK" tone="green" />
    </group>
  );
}
