// Tic-tac-toe at the party hall's arcade tables. Pure rules: the Worker owns the state and only
// accepts a cell index from the player whose turn it is.

export interface TttPlayer { userId: string; connectionId: string; name: string }
export type TttMark = 'X' | 'O';
export interface TttState {
  id: string;
  table: string;
  status: 'LOBBY' | 'WAITING' | 'ACTIVE' | 'RESULT';
  /** X always moves first; the challenger is X. */
  x: TttPlayer | null;
  o: TttPlayer | null;
  board: Array<TttMark | null>;
  turn: TttMark;
  turnDeadline: number | null;
  winner: TttMark | null;
  line: number[] | null;
  endReason: 'complete' | 'draw' | 'forfeit' | null;
  rematchVotes: string[];
  updatedAt: number;
}
export const TTT_RULES = { TURN_MS: 20000, RESULT_HOLD_MS: 30000 };
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export type TttResult = TttState | { error: string };
export const isTttError = (r: TttResult): r is { error: string } => 'error' in r;
const fail = (error: string) => ({ error });

export const createTtt = (table: string, now: number): TttState => ({
  id: '', table, status: 'LOBBY', x: null, o: null, board: Array(9).fill(null), turn: 'X', turnDeadline: null,
  winner: null, line: null, endReason: null, rematchVotes: [], updatedAt: now,
});
export const tttPlayers = (s: TttState) => [s.x, s.o].filter(Boolean) as TttPlayer[];
export const tttMarkOf = (s: TttState, userId: string): TttMark | null => (s.x?.userId === userId ? 'X' : s.o?.userId === userId ? 'O' : null);

export function winningLine(board: Array<TttMark | null>) {
  for (const l of LINES) if (board[l[0]] && board[l[0]] === board[l[1]] && board[l[0]] === board[l[2]]) return l;
  return null;
}

function finish(s: TttState, now: number, endReason: TttState['endReason'], winner: TttMark | null, line: number[] | null = null): TttState {
  return { ...s, status: 'RESULT', winner, line, endReason, turnDeadline: null, rematchVotes: [], updatedAt: now };
}

export function tttCreate(s: TttState, host: TttPlayer, id: string, now: number): TttResult {
  if (s.status === 'WAITING') return fail(s.x?.userId === host.userId ? 'Your table is already open.' : `@${s.x?.name} is waiting for a challenger. Join them!`);
  if (s.status === 'ACTIVE') return fail('A game is on at this table.');
  if (s.status === 'RESULT' && !tttMarkOf(s, host.userId) && now - s.updatedAt < TTT_RULES.RESULT_HOLD_MS) return fail('This table is just finishing a game.');
  return { ...createTtt(s.table, now), id, status: 'WAITING', x: host };
}

export function tttJoin(s: TttState, guest: TttPlayer, id: string, now: number): TttResult {
  if (s.status !== 'WAITING' || !s.x || s.id !== id) return fail('That table is no longer open.');
  if (s.x.userId === guest.userId) return fail('You cannot play yourself.');
  return { ...s, status: 'ACTIVE', o: guest, turn: 'X', turnDeadline: now + TTT_RULES.TURN_MS, updatedAt: now };
}

export function tttMove(s: TttState, userId: string, cell: number, now: number): TttResult {
  if (s.status !== 'ACTIVE') return fail('No game in progress.');
  const mark = tttMarkOf(s, userId);
  if (!mark) return fail('You are not playing at this table.');
  if (mark !== s.turn) return fail("It's not your turn.");
  if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell]) return fail('Pick an empty square.');
  const board = s.board.slice();
  board[cell] = mark;
  const line = winningLine(board);
  const next = { ...s, board, updatedAt: now };
  if (line) return finish(next, now, 'complete', mark, line);
  if (board.every(Boolean)) return finish(next, now, 'draw', null);
  return { ...next, turn: mark === 'X' ? 'O' : 'X', turnDeadline: now + TTT_RULES.TURN_MS };
}

/** Too slow on your turn loses the game. */
export function tttExpire(s: TttState, now: number): TttState | null {
  if (s.status !== 'ACTIVE' || !s.turnDeadline || now < s.turnDeadline) return null;
  return finish(s, now, 'forfeit', s.turn === 'X' ? 'O' : 'X');
}

export function tttLeave(s: TttState, userId: string, now: number): TttState | null {
  const mark = tttMarkOf(s, userId);
  if (!mark) return null;
  if (s.status === 'WAITING') return createTtt(s.table, now);
  if (s.status === 'ACTIVE') return finish(s, now, 'forfeit', mark === 'X' ? 'O' : 'X');
  if (s.status === 'RESULT') return createTtt(s.table, now);
  return null;
}

/** Both players tap Play Again → fresh board, the loser (or O after a draw) goes first as X. */
export function tttRematch(s: TttState, userId: string, now: number): TttResult {
  if (s.status !== 'RESULT' || !tttMarkOf(s, userId) || !s.x || !s.o) return fail('No finished game to replay.');
  const votes = s.rematchVotes.includes(userId) ? s.rematchVotes : [...s.rematchVotes, userId];
  if (votes.length < 2) return { ...s, rematchVotes: votes, updatedAt: now };
  const swap = s.winner !== 'O';
  const [x, o] = swap ? [s.o, s.x] : [s.x, s.o];
  return { ...createTtt(s.table, now), id: `${s.id}-r`, status: 'ACTIVE', x, o, turnDeadline: now + TTT_RULES.TURN_MS };
}
