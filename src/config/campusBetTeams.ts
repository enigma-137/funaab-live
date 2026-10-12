// Campus Bet: ten fictional clubs. Server-only — never import this from client UI,
// or the hidden strengths ship in the browser bundle. The client receives names
// from the Worker's state payload instead.
export interface CampusBetTeam {
  id: string;
  name: string;
  shortName: string;
  /** 60–85. Hidden: drives match probabilities, never sent to players. */
  hiddenBaseStrength: number;
}

export const CAMPUS_BET_TEAMS: readonly CampusBetTeam[] = [
  { id: 'falcons', name: 'Falcons FC', shortName: 'Falcons', hiddenBaseStrength: 82 },
  { id: 'green-lions', name: 'Green Lions', shortName: 'Lions', hiddenBaseStrength: 78 },
  { id: 'campus-united', name: 'Campus United', shortName: 'United', hiddenBaseStrength: 75 },
  { id: 'abeokuta-city', name: 'Abeokuta City', shortName: 'City', hiddenBaseStrength: 73 },
  { id: 'royal-stars', name: 'Royal Stars', shortName: 'Stars', hiddenBaseStrength: 71 },
  { id: 'titans', name: 'Titans FC', shortName: 'Titans', hiddenBaseStrength: 70 },
  { id: 'warriors', name: 'Warriors FC', shortName: 'Warriors', hiddenBaseStrength: 68 },
  { id: 'rovers-athletic', name: 'Rovers Athletic', shortName: 'Rovers', hiddenBaseStrength: 66 },
  { id: 'scholars', name: 'Scholars FC', shortName: 'Scholars', hiddenBaseStrength: 64 },
  { id: 'unity', name: 'Unity FC', shortName: 'Unity', hiddenBaseStrength: 61 },
];

export const campusBetTeamById = (id: string) => CAMPUS_BET_TEAMS.find((t) => t.id === id);

/** Public view of a team: everything except the hidden strength. */
export const publicCampusBetTeams = () =>
  Object.fromEntries(CAMPUS_BET_TEAMS.map((t) => [t.id, { name: t.name, shortName: t.shortName }]));
