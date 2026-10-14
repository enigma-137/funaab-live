// Shared 1v1 shootout state machine for the Sports Centre courts (basketball free throws,
// volleyball serves). Pure and dependency-free so the Worker (authority) and the client agree.
// Each game supplies its own shot resolver and scoring; turns, timers, forfeits and rematches
// are identical. (The football penalty challenge predates this and keeps its own copy.)

export interface ShotInput {
  /** -1 (left, from the shooter's view) .. 1 (right). */
  aim: number;
  /** 0 .. 1. */
  power: number;
}

export interface ShootoutRules {
  SHOTS_PER_PLAYER: number;
  TURN_SECONDS: number;
  PRACTICE_COOLDOWN_MS: number;
  /** A finished scoreboard can be cleared by someone else after this long. */
  RESULT_HOLD_MS: number;
}

export type ShootoutStatus = 'LOBBY' | 'WAITING' | 'ACTIVE' | 'RESULT';
export interface ShootoutPlayer { userId: string; connectionId: string; name: string }

export type Shot<R> = R & {
  /** Increments for every shot (practice included) so clients animate each one exactly once. */
  seq: number;
  shooterUserId: string;
  shooterConnectionId: string;
  shooterName: string;
  practice: boolean;
  aim: number;
  power: number;
  /** 'timeout' when the turn clock ran out; the shot counts as a miss. */
  reason?: 'timeout';
  at: number;
};

export interface ShootoutState<O extends string, R extends { outcome: O }> {
  id: string;
  status: ShootoutStatus;
  player1: ShootoutPlayer | null;
  player2: ShootoutPlayer | null;
  turnUserId: string | null;
  turnDeadline: number | null;
  shotsRemaining: Record<string, number>;
  score: Record<string, number>;
  history: Record<string, O[]>;
  winnerUserId: string | null;
  endReason: 'complete' | 'forfeit' | null;
  rematchVotes: string[];
  leftUserIds: string[];
  lastShot: Shot<R> | null;
  shotSeq: number;
  updatedAt: number;
  finishedAt: number | null;
}

export type ShootoutError = { error: string };
const fail = (error: string): ShootoutError => ({ error });
export const isShootoutError = (v: unknown): v is ShootoutError => !!v && typeof (v as ShootoutError).error === 'string';

export function isValidShotInput(input: unknown): input is ShotInput {
  const s = input as ShotInput;
  return !!s && typeof s.aim === 'number' && typeof s.power === 'number'
    && Number.isFinite(s.aim) && Number.isFinite(s.power)
    && s.aim >= -1 && s.aim <= 1 && s.power >= 0 && s.power <= 1;
}

export interface ShootoutDef<O extends string, R extends { outcome: O }> {
  rules: ShootoutRules;
  resolve: (input: ShotInput, rng: () => number) => R;
  /** Points an outcome scores in a match. */
  points: (outcome: O) => number;
  /** What a lost turn records (nothing is thrown or served). */
  timeoutResult: R;
  /** Player-facing words: the match ('shootout', 'serve-off') and the place ('court'). */
  match: string;
  place: string;
  /** Practice verb for the busy message ('Practise', 'Practise serving'). */
  practise: string;
}

export function defineShootout<O extends string, R extends { outcome: O }>(def: ShootoutDef<O, R>) {
  type S = ShootoutState<O, R>;
  const { rules } = def;
  const create = (now: number, shotSeq = 0): S => ({
    id: '', status: 'LOBBY', player1: null, player2: null, turnUserId: null, turnDeadline: null,
    shotsRemaining: {}, score: {}, history: {}, winnerUserId: null, endReason: null, rematchVotes: [],
    leftUserIds: [], lastShot: null, shotSeq, updatedAt: now, finishedAt: null,
  });
  const isPlayer = (s: S, userId: string) => s.player1?.userId === userId || s.player2?.userId === userId;
  const opponentOf = (s: S, userId: string) => (s.player1?.userId === userId ? s.player2 : s.player1);
  const busy = (s: S) => s.status === 'ACTIVE';
  const reset = (s: S, now: number): S => ({ ...create(now, s.shotSeq), lastShot: s.lastShot });

  function start(s: S, p1: ShootoutPlayer, p2: ShootoutPlayer, now: number, id: string): S {
    const per = rules.SHOTS_PER_PLAYER;
    return {
      ...s, id, status: 'ACTIVE', player1: p1, player2: p2, turnUserId: p1.userId,
      turnDeadline: now + rules.TURN_SECONDS * 1000,
      shotsRemaining: { [p1.userId]: per, [p2.userId]: per },
      score: { [p1.userId]: 0, [p2.userId]: 0 },
      history: { [p1.userId]: [], [p2.userId]: [] },
      winnerUserId: null, endReason: null, rematchVotes: [], leftUserIds: [], updatedAt: now, finishedAt: null,
    };
  }
  function finish(s: S, now: number, endReason: 'complete' | 'forfeit', winnerUserId: string | null): S {
    return { ...s, status: 'RESULT', turnUserId: null, turnDeadline: null, winnerUserId, endReason, rematchVotes: [], finishedAt: now, updatedAt: now };
  }
  const shotOf = (s: S, shooter: ShootoutPlayer, input: ShotInput, result: R, now: number, practice: boolean, reason?: 'timeout'): Shot<R> => ({
    ...result, seq: s.shotSeq + 1, shooterUserId: shooter.userId, shooterConnectionId: shooter.connectionId,
    shooterName: shooter.name, practice, aim: input.aim, power: input.power, ...(reason ? { reason } : {}), at: now,
  });
  function record(s: S, shooter: ShootoutPlayer, input: ShotInput, result: R, now: number, reason?: 'timeout'): S {
    const shot = shotOf(s, shooter, input, result, now, false, reason);
    const uid = shooter.userId;
    const score = { ...s.score, [uid]: (s.score[uid] ?? 0) + def.points(result.outcome) };
    const shotsRemaining = { ...s.shotsRemaining, [uid]: Math.max(0, (s.shotsRemaining[uid] ?? 0) - 1) };
    const history = { ...s.history, [uid]: [...(s.history[uid] ?? []), result.outcome] };
    const next: S = { ...s, score, shotsRemaining, history, lastShot: shot, shotSeq: shot.seq, updatedAt: now };
    const opponent = opponentOf(s, uid)!;
    // Alternate A, B, A, B…; if the opponent is out of shots the shooter keeps going.
    const nextShooter = (shotsRemaining[opponent.userId] ?? 0) > 0 ? opponent : (shotsRemaining[uid] ?? 0) > 0 ? shooter : null;
    if (!nextShooter) {
      const a = score[s.player1!.userId] ?? 0, b = score[s.player2!.userId] ?? 0;
      return finish(next, now, 'complete', a === b ? null : a > b ? s.player1!.userId : s.player2!.userId);
    }
    return { ...next, turnUserId: nextShooter.userId, turnDeadline: now + rules.TURN_SECONDS * 1000 };
  }

  return {
    rules,
    create,
    isPlayer,
    busy,
    createChallenge(s: S, host: ShootoutPlayer, id: string, now: number): S | ShootoutError {
      if (s.status === 'WAITING') return fail(s.player1?.userId === host.userId ? 'Your challenge is already open.' : `@${s.player1?.name} is already waiting for a challenger. Join them!`);
      if (s.status === 'ACTIVE') return fail(`A ${def.match} is on. Wait for it to finish.`);
      if (s.status === 'RESULT' && !isPlayer(s, host.userId) && now - (s.finishedAt ?? 0) < rules.RESULT_HOLD_MS)
        return fail(`The last ${def.match} just ended. Try again in a few seconds.`);
      return { ...reset(s, now), id, status: 'WAITING', player1: host };
    },
    join(s: S, guest: ShootoutPlayer, matchId: string, now: number): S | ShootoutError {
      if (s.status !== 'WAITING' || !s.player1 || s.id !== matchId) return fail('That challenge is no longer open.');
      if (s.player1.userId === guest.userId) return fail('You cannot join your own challenge.');
      return start(s, s.player1, guest, now, s.id);
    },
    cancel(s: S, userId: string, now: number): S | ShootoutError {
      if (s.status !== 'WAITING' || s.player1?.userId !== userId) return fail('No open challenge to cancel.');
      return reset(s, now);
    },
    take(s: S, userId: string, input: ShotInput, rng: () => number, now: number): S | ShootoutError {
      if (s.status !== 'ACTIVE') return fail(`No ${def.match} in progress.`);
      if (!isPlayer(s, userId)) return fail(`You are not in this ${def.match}.`);
      if (s.turnUserId !== userId) return fail('Wait for your turn.');
      if (!isValidShotInput(input)) return fail('Invalid shot.');
      const shooter = s.player1!.userId === userId ? s.player1! : s.player2!;
      return record(s, shooter, input, def.resolve(input, rng), now);
    },
    /** Turn clock ran out: the shot is lost (counted as a miss). */
    expire(s: S, now: number): S | null {
      if (s.status !== 'ACTIVE' || !s.turnDeadline || now < s.turnDeadline || !s.turnUserId) return null;
      const shooter = s.player1!.userId === s.turnUserId ? s.player1! : s.player2!;
      return record(s, shooter, { aim: 0, power: 0 }, def.timeoutResult, now, 'timeout');
    },
    /** Practice: anyone, any time the court is not mid-match. Never touches the score. */
    practice(s: S, shooter: ShootoutPlayer, input: ShotInput, rng: () => number, now: number): S | ShootoutError {
      if (busy(s)) return fail(`A ${def.match} is on. ${def.practise} after it finishes.`);
      if (!isValidShotInput(input)) return fail('Invalid shot.');
      const shot = shotOf(s, shooter, input, def.resolve(input, rng), now, true);
      return { ...s, lastShot: shot, shotSeq: shot.seq, updatedAt: now };
    },
    /** Disconnect / walk-away. Mid-match the opponent wins by forfeit; otherwise the slot is freed. */
    leave(s: S, userId: string, now: number): S | null {
      if (!isPlayer(s, userId)) return null;
      if (s.status === 'WAITING') return reset(s, now);
      if (s.status === 'ACTIVE') return { ...finish(s, now, 'forfeit', opponentOf(s, userId)!.userId), leftUserIds: [userId] };
      if (s.status === 'RESULT') {
        const stay = opponentOf(s, userId);
        if (!stay || s.leftUserIds.includes(stay.userId)) return reset(s, now);
        return { ...s, leftUserIds: [...new Set([...s.leftUserIds, userId])], rematchVotes: s.rematchVotes.filter((v) => v !== userId), updatedAt: now };
      }
      return null;
    },
    /** Both players press Play Again → fresh match, the other player goes first. */
    rematch(s: S, userId: string, now: number, newId: string): S | ShootoutError {
      if (s.status !== 'RESULT' || !isPlayer(s, userId)) return fail(`No finished ${def.match} to replay.`);
      if (s.leftUserIds.length) return fail(`Your opponent has left the ${def.place}.`);
      const votes = s.rematchVotes.includes(userId) ? s.rematchVotes : [...s.rematchVotes, userId];
      if (votes.length < 2) return { ...s, rematchVotes: votes, updatedAt: now };
      return start(s, s.player2!, s.player1!, now, newId);
    },
  };
}

export type Shootout<O extends string, R extends { outcome: O }> = ReturnType<typeof defineShootout<O, R>>;
