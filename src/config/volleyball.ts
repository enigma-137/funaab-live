// Sports Centre volleyball court: serve challenge. Serve from behind the end line over the net;
// an NPC receiver guesses a side and tries to dig it. Pure so the Worker and client agree; the
// client only sends aim + power and the Worker rolls randomness.
import { defineShootout, isShootoutError, type ShootoutState, type Shot, type ShotInput } from './shootout';

export type Vec3 = [number, number, number];

// Long axis along Z, net across the middle. Serving half is the south (+Z) side.
const CENTRE: Vec3 = [-87.5, 0, 31];
const LENGTH = 16;
const WIDTH = 8;
const END_LINE_Z = CENTRE[2] + LENGTH / 2; // 39

export const VOLLEYBALL_COURT = {
  centre: CENTRE,
  length: LENGTH,
  width: WIDTH,
  netZ: CENTRE[2],
  netHeight: 2.43,
  /** Where the server stands: just behind the end line, slightly right so the camera sees the net. */
  serveSpot: [CENTRE[0] + 0.6, 0, END_LINE_Z + 0.8] as Vec3,
  /** Server faces the net (due -Z). */
  facing: Math.PI,
  /** Orbit camera yaw that sits behind the server looking over the net. */
  cameraYaw: 0,
  /** Receiver's home: middle of the far half. */
  receiverHome: [CENTRE[0], 0, CENTRE[2] - 4.5] as Vec3,
  interactionRadius: 3.2,
  serverRadius: 7,
};

export const VOLLEYBALL_RULES = {
  SHOTS_PER_PLAYER: 5,
  TURN_SECONDS: 30,
  PRACTICE_COOLDOWN_MS: 2200,
  RESULT_HOLD_MS: 20000,
  /** Meter band where the serve clears the net and lands in. */
  IN_POWER: [0.3, 0.76] as [number, number],
};

/** ACE = lands in and the receiver can't dig it (1 point). DUG = in, but returned. */
export type ServeOutcome = 'ACE' | 'DUG' | 'NET' | 'OUT';
export type ReceiverDive = -1 | 0 | 1;

export interface ServeResult {
  outcome: ServeOutcome;
  /** Where the ball comes down in the far half: [right of centre line, metres past the net]. */
  landing: [number, number];
  receiverDive: ReceiverDive;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const RECEIVER_DEPTH = 4.5;
const DIVE_REACH = 2.2;

/**
 * Deterministic for a given rng: four draws, always in the same order (side noise, depth noise,
 * receiver dive, dig roll).
 *
 * Feel: too soft finds the net, too hard sails long, aiming at a sideline risks going wide.
 * The receiver guesses left / middle / right; serves far from where they went are aces.
 */
export function resolveServe(input: ShotInput, rng: () => number): ServeResult {
  const aim = clamp(input.aim, -1, 1);
  const power = clamp(input.power, 0, 1);
  const side = aim * 4.4 + (rng() * 2 - 1) * 0.45;
  const depth = (power - 0.22) * 13 + (rng() * 2 - 1) * 0.7;
  const diveRoll = rng();
  const receiverDive: ReceiverDive = diveRoll < 0.4 ? -1 : diveRoll < 0.6 ? 0 : 1;
  const digRoll = rng();
  const landing: [number, number] = [Number(side.toFixed(3)), Number(depth.toFixed(3))];
  let outcome: ServeOutcome;
  if (depth < 0.3) outcome = 'NET';
  else if (depth > LENGTH / 2 || Math.abs(side) > WIDTH / 2) outcome = 'OUT';
  else {
    const reach = Math.hypot(side - receiverDive * DIVE_REACH, (depth - RECEIVER_DEPTH) * 0.8);
    const digChance = reach < 1.8 ? 0.85 - reach * 0.35 : 0;
    outcome = digRoll < digChance ? 'DUG' : 'ACE';
  }
  return { outcome, landing, receiverDive };
}

/** Where the receiver ends up after committing (world space). */
export const receiverSpot = (dive: ReceiverDive): Vec3 =>
  [VOLLEYBALL_COURT.receiverHome[0] + dive * DIVE_REACH, 0, VOLLEYBALL_COURT.receiverHome[2]];

/** Client flight path: [toss/contact, apex, first touch down (or net), rest]. */
export function serveFlightPath(shot: Pick<ServeResult, 'outcome' | 'landing' | 'receiverDive'> & { reason?: 'timeout' }) {
  const { serveSpot, netZ, netHeight, centre } = VOLLEYBALL_COURT;
  const contact: Vec3 = [serveSpot[0] - 0.2, 2.7, serveSpot[2] - 0.4];
  if (shot.reason === 'timeout') return { contact, apex: contact, land: contact, rest: [contact[0], 0.11, contact[2]] as Vec3 };
  // Server faces -Z: "right" is +X, "past the net" is -Z.
  const land: Vec3 = [centre[0] + shot.landing[0], 0.11, netZ - shot.landing[1]];
  if (shot.outcome === 'NET') {
    const atNet: Vec3 = [centre[0] + shot.landing[0] * 0.6, netHeight - 0.35, netZ + 0.1];
    return { contact, apex: [(contact[0] + atNet[0]) / 2, 3.1, (contact[2] + atNet[2]) / 2] as Vec3, land: atNet, rest: [atNet[0], 0.11, netZ + 0.9] as Vec3 };
  }
  const apex: Vec3 = [(contact[0] + land[0]) / 2, netHeight + 1.6, netZ + 0.5];
  let rest: Vec3;
  if (shot.outcome === 'DUG') {
    // Bumped back up toward the net by the receiver.
    const r = receiverSpot(shot.receiverDive);
    rest = [r[0], 0.11, netZ - 1.4];
  } else if (shot.outcome === 'OUT') {
    rest = [land[0] + Math.sign(shot.landing[0] || 1) * 0.8, 0.11, land[2] - 1.5];
  } else {
    rest = [land[0], 0.11, land[2] - 2.2];
  }
  return { contact, apex, land, rest };
}

export const VOLLEYBALL = defineShootout<ServeOutcome, ServeResult>({
  rules: VOLLEYBALL_RULES,
  resolve: resolveServe,
  points: (o) => (o === 'ACE' ? 1 : 0),
  timeoutResult: { outcome: 'NET', landing: [0, -1], receiverDive: 0 },
  match: 'serve-off',
  place: 'court',
  practise: 'Practise serving',
});

export type VolleyballMatchState = ShootoutState<ServeOutcome, ServeResult>;
export type VolleyballShot = Shot<ServeResult>;
export const isVolleyballError = isShootoutError;
