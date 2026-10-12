// Campus Bet: fictional football predictions paid in virtual game Naira only.
// Client-safe constants. Hidden team strengths live in campusBetTeams.ts (server-only).
import type { Point } from './campusLocations';

export type CampusBetPick = 'HOME' | 'DRAW' | 'AWAY';
export type CampusBetStatus = 'OPEN' | 'LOCKED' | 'SETTLED';
export const CAMPUS_BET_PICKS: readonly CampusBetPick[] = ['HOME', 'DRAW', 'AWAY'];

export const CAMPUS_BET_FIXTURES_PER_ROUND = 5;
/** Stakes are whole multiples of ₦10 so every payout (including half-stake) is a whole Naira. */
export const CAMPUS_BET_STAKE = { min: 50, max: 500, step: 10, default: 100, presets: [50, 100, 200, 300, 500] } as const;

/**
 * Payout multiplier of the stake, indexed by number of correct picks (0–5).
 * Mirrored in SQL (campus_bet_payout). Tuned by scripts/test-campus-bet.ts so that
 * no simple strategy, including always backing the favourite, is profitable long-run.
 */
export const CAMPUS_BET_MULTIPLIERS = [0, 0, 0.5, 1, 3, 5] as const;
export const campusBetPayout = (stake: number, correct: number) =>
  Math.floor(stake * (CAMPUS_BET_MULTIPLIERS[correct] ?? 0));

/** 20-minute matchday slots: betting open for 15, then results until the next slot. Mirrored in SQL. */
export const CAMPUS_BET_SLOT_SECONDS = 20 * 60;
export const CAMPUS_BET_OPEN_SECONDS = 15 * 60;

export const isValidCampusBetStake = (stake: unknown): stake is number =>
  typeof stake === 'number' && Number.isInteger(stake) && stake % CAMPUS_BET_STAKE.step === 0
  && stake >= CAMPUS_BET_STAKE.min && stake <= CAMPUS_BET_STAKE.max;

/** Just outside the main gate (z=90), across the gate road, facing back toward campus. */
export const CAMPUS_BET_SHOP = {
  id: 'campus-bet',
  assetKey: 'campus_bet_shop',
  position: [-22, 0, 103] as Point,
  footprint: [9, 6] as [number, number],
  /** Where students stand at the counter; also the server proximity anchor. */
  counter: [-22, 0, 98.6] as Point,
  interactionRadius: 4.5,
  /** Server allows placing a ticket within this distance of the counter. */
  serverRadius: 9,
};

// Shapes returned by the Worker. Hidden probabilities and strengths are never included.
export interface CampusBetFixtureView {
  slot: number;
  home: string;
  away: string;
  result: CampusBetPick | null;
  home_score: number | null;
  away_score: number | null;
}
export interface CampusBetTicketView {
  round_id: string;
  round_number: number;
  stake: number;
  picks: CampusBetPick[];
  correct_count: number | null;
  payout: number | null;
  settled_at: string | null;
  created_at: string;
  fixtures?: CampusBetFixtureView[];
}
export interface CampusBetRoundView {
  id: string;
  round_number: number;
  status: CampusBetStatus;
  opens_at: string;
  closes_at: string;
  settled_at: string | null;
  fixtures: CampusBetFixtureView[];
}
export interface CampusBetState {
  server_now: string;
  next_opens_at: string;
  current: CampusBetRoundView | null;
  my_ticket: CampusBetTicketView | null;
  last_settled: CampusBetRoundView | null;
  last_ticket: CampusBetTicketView | null;
  history: CampusBetTicketView[];
  form: Record<string, Array<'W' | 'D' | 'L'>>;
  teams: Record<string, { name: string; shortName: string }>;
  balance?: number;
}
