// Game Den penalty shoot-out rules, shared by the Worker, the dev server and the client.
// Players alternate: odd rounds the host shoots, even rounds the guest. Both get the same
// number of kicks, the match ends early once one side can no longer catch up, and a level
// score after the last kick is a draw.
export type PSDirection = 'left' | 'center' | 'right';
export const PS_DIRECTIONS: readonly PSDirection[] = ['left', 'center', 'right'];
export const PS_KICKS_EACH = 3;
export const PS_TOTAL_ROUNDS = PS_KICKS_EACH * 2;

export interface PSLastRound {
  round: number;
  shooter: 'host' | 'guest';
  shot: PSDirection;
  dive: PSDirection;
  goal: boolean;
}

interface ResolvableMatch {
  status: string;
  currentRound: number;
  totalRounds: number;
  hostScore: number;
  guestScore: number;
  hostName: string;
  guestName?: string;
  hostChoice?: string;
  guestChoice?: string;
  roundResult?: string;
  winnerName?: string;
  isDraw?: boolean;
  lastRound?: PSLastRound;
}

/** Kicks each side still has after `round` in a match of `total` rounds. */
export function kicksLeft(round: number, total: number) {
  let host = 0, guest = 0;
  for (let r = round + 1; r <= total; r++) if (r % 2 === 1) host++; else guest++;
  return { host, guest };
}

/**
 * Resolve the round once both picks are in. Mutates the match: scores, result text,
 * lastRound for the client animation, and on the final whistle status/winner/isDraw.
 * Returns 'host' | 'guest' | 'draw' when the match just finished, otherwise null.
 */
export function resolvePSRound(match: ResolvableMatch): 'host' | 'guest' | 'draw' | null {
  const shooterIsHost = match.currentRound % 2 === 1;
  const shot = (shooterIsHost ? match.hostChoice : match.guestChoice) as PSDirection;
  const dive = (shooterIsHost ? match.guestChoice : match.hostChoice) as PSDirection;
  const shooterName = (shooterIsHost ? match.hostName : match.guestName) || 'Player';
  const keeperName = (shooterIsHost ? match.guestName : match.hostName) || 'Player';
  const goal = shot !== dive;
  if (goal) {
    if (shooterIsHost) match.hostScore++; else match.guestScore++;
    match.roundResult = `GOAL! ${shooterName} scored.`;
  } else {
    match.roundResult = `SAVED! ${keeperName} read it.`;
  }
  match.lastRound = { round: match.currentRound, shooter: shooterIsHost ? 'host' : 'guest', shot, dive, goal };

  const left = kicksLeft(match.currentRound, match.totalRounds);
  const decided = match.hostScore + left.host < match.guestScore || match.guestScore + left.guest < match.hostScore;
  if (decided || match.currentRound >= match.totalRounds) {
    match.status = 'finished';
    if (match.hostScore === match.guestScore) {
      match.isDraw = true;
      match.winnerName = undefined;
      return 'draw';
    }
    const hostWon = match.hostScore > match.guestScore;
    match.winnerName = hostWon ? match.hostName : match.guestName;
    return hostWon ? 'host' : 'guest';
  }
  match.currentRound++;
  match.hostChoice = undefined;
  match.guestChoice = undefined;
  return null;
}
