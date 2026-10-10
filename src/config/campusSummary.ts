export interface CampusSummary {
  studentsOnline: number;
  popular: { name: string; count: number }[];
}
export function summarizeCampus(
  players: Iterable<{ id: string; position: number[]; currentLectureId?: string }>,
  zone: (x: number, z: number, lecture?: string) => string,
): CampusSummary {
  const students = new Map(Array.from(players, (p) => [p.id, p]));
  const counts = new Map<string, number>();
  students.forEach((p) => {
    const name = zone(p.position[0], p.position[2], p.currentLectureId);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return {
    studentsOnline: students.size,
    popular: [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
  };
}
