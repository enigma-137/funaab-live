import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { usePartyStore } from '../stores/partyStore';
import { ARCADE_TABLES } from '../config/partyHall';
import { tttMarkOf, type TttState } from '../config/ticTacToe';
import { POOL, POCKETS, simulateShot, isPoolPlayer, type Ball, type PoolState } from '../config/pool';

const secondsLeft = (deadline: number | null, now: number) => (deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null);
const BALL_COLOR: Record<Ball['kind'], string> = { cue: '#f8fafc', red: '#dc2626', yellow: '#facc15', black: '#111827' };

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function Lobby({ host, guest, me, status, onCreate, onJoin, onLeave, busy, what }: {
  host: { userId: string; name: string } | null; guest: { userId: string; name: string } | null; me: string | undefined;
  status: string; onCreate: () => void; onJoin: () => void; onLeave: () => void; busy: boolean; what: string;
}) {
  if (status === 'LOBBY') return <button className="academic-primary academic-wide" disabled={busy} onClick={onCreate}>Open the table and wait for a challenger</button>;
  if (status === 'WAITING' && host?.userId === me)
    return <><p className="academic-note">Waiting for someone to join your {what}…</p><button className="hustle-btn hustle-wide" disabled={busy} onClick={onLeave}>Close the table</button></>;
  if (status === 'WAITING') return <button className="academic-primary academic-wide" disabled={busy} onClick={onJoin}>Play @{host?.name}</button>;
  void guest;
  return null;
}

function TicTacToe({ s, me }: { s: TttState; me: string | undefined }) {
  const { act, busy } = usePartyStore();
  const now = useNow();
  const mark = me ? tttMarkOf(s, me) : null;
  const myTurn = s.status === 'ACTIVE' && mark === s.turn;
  const turnName = s.turn === 'X' ? s.x?.name : s.o?.name;
  const left = secondsLeft(s.turnDeadline, now);
  const result = s.status === 'RESULT'
    ? s.endReason === 'draw' ? "It's a draw!" : `${s.winner === 'X' ? s.x?.name : s.o?.name} wins${s.endReason === 'forfeit' ? ' (opponent timed out or left)' : '!'}`
    : null;
  return (
    <div className="academic-body">
      <p className="academic-note">
        <b>❌ {s.x?.name ?? '—'}</b> vs <b>⭕ {s.o?.name ?? '—'}</b>
        {s.status === 'ACTIVE' && <> · {myTurn ? <b>Your turn</b> : `@${turnName}'s turn`}{left != null && ` · ${left}s`}</>}
        {result && <> · <b>{result}</b></>}
      </p>
      <div className="arcade-ttt" role="grid" aria-label="Tic-tac-toe board">
        {s.board.map((c, i) => (
          <button key={i} role="gridcell" aria-label={c ? `${c} at square ${i + 1}` : `Empty square ${i + 1}`}
            className={`arcade-cell${s.line?.includes(i) ? ' is-win' : ''}`}
            disabled={!myTurn || !!c || busy} onClick={() => void act('move', { cell: i })}>
            {c === 'X' ? '❌' : c === 'O' ? '⭕' : ''}
          </button>
        ))}
      </div>
      <Lobby host={s.x} guest={s.o} me={me} status={s.status} busy={busy} what="game"
        onCreate={() => void act('create')} onJoin={() => void act('join', { id: s.id })} onLeave={() => void act('leave')} />
      {s.status === 'RESULT' && mark && (
        <div className="hustle-row">
          <button className="academic-primary" disabled={busy || (!!me && s.rematchVotes.includes(me))} onClick={() => void act('rematch')}>
            {me && s.rematchVotes.includes(me) ? 'Waiting for them…' : 'Play again'}
          </button>
          <button className="hustle-btn" disabled={busy} onClick={() => void act('leave')}>Leave table</button>
        </div>
      )}
    </div>
  );
}

/** Top-down pool table: drag from anywhere to aim (the line points where the white goes). */
function Pool({ s, me }: { s: PoolState; me: string | undefined }) {
  const { act, busy, shotAt } = usePartyStore();
  const now = useNow(33);
  const [aim, setAim] = useState<[number, number] | null>(null);
  const [power, setPower] = useState(0.6);
  const svg = useRef<SVGSVGElement>(null);
  const myTurn = s.status === 'ACTIVE' && s.turnUserId === me;
  // Replay the last shot from its start positions (deterministic), then show the final table.
  const replay = useMemo(() => (s.lastShot ? simulateShot(s.lastShot.start, s.lastShot.dx, s.lastShot.dz, s.lastShot.power).frames : null), [s.lastShot]);
  const frameIdx = replay ? Math.floor(((now - shotAt) / 1000) * 30) : 0;
  const playing = !!replay && frameIdx < replay.length - 1;
  const potted = s.lastShot?.potted ?? [];
  // A potted ball sits frozen in its pocket from the moment it drops: hide it from then on.
  const balls: Ball[] = playing && s.lastShot
    ? s.lastShot.start.map((b, i) => {
        const f = replay![frameIdx], last = replay![replay!.length - 1];
        const x = f[i * 2], z = f[i * 2 + 1];
        return { ...b, x, z, potted: b.potted || (potted.includes(b.id) && x === last[i * 2] && z === last[i * 2 + 1]) };
      })
    : s.balls;
  const cue = s.balls.find((b) => b.kind === 'cue')!;
  const W = (POOL.HALF_X + 0.08) * 2, H = (POOL.HALF_Z + 0.08) * 2;
  const toTable = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W - W / 2, ((e.clientY - r.top) / r.height) * H - H / 2] as [number, number];
  };
  const pointAt = (e: React.PointerEvent) => {
    if (!myTurn || playing) return;
    const [x, z] = toTable(e);
    if (Math.hypot(x - cue.x, z - cue.z) > 0.02) setAim([x - cue.x, z - cue.z]);
  };
  const name = (u: string | null) => (u === s.p1?.userId ? s.p1?.name : s.p2?.name) ?? '';
  const groupOf = (u?: string) => (u && s.groups[u] ? (s.groups[u] === 'red' ? '🔴' : '🟡') : '');
  const left = secondsLeft(s.turnDeadline, now);
  return (
    <div className="academic-body">
      <p className="academic-note">
        <b>{groupOf(s.p1?.userId)} {s.p1?.name ?? '—'}</b> vs <b>{groupOf(s.p2?.userId)} {s.p2?.name ?? '—'}</b>
        {s.status === 'ACTIVE' && <> · {myTurn ? <b>Your shot</b> : `@${name(s.turnUserId)} to shoot`}{left != null && ` · ${left}s`}</>}
      </p>
      {s.message && <p className="academic-note">{s.message}</p>}
      <svg ref={svg} className="arcade-pool" viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} role="img" aria-label="Pool table, drag to aim"
        onPointerDown={pointAt} onPointerMove={(e) => e.buttons && pointAt(e)}>
        <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={0.06} fill="#5b3a1e" />
        <rect x={-POOL.HALF_X} y={-POOL.HALF_Z} width={POOL.HALF_X * 2} height={POOL.HALF_Z * 2} fill="#15803d" />
        {POCKETS.map(([x, z], i) => <circle key={i} cx={x} cy={z} r={POOL.POCKET_R} fill="#0b0b0b" />)}
        {myTurn && !playing && aim && (() => {
          const l = Math.hypot(aim[0], aim[1]);
          return <line x1={cue.x} y1={cue.z} x2={cue.x + (aim[0] / l) * 0.9} y2={cue.z + (aim[1] / l) * 0.9} stroke="#fff" strokeWidth={0.008} strokeDasharray="0.03 0.02" />;
        })()}
        {balls.filter((b) => !b.potted).map((b) => (
          <circle key={b.id} cx={b.x} cy={b.z} r={POOL.R} fill={BALL_COLOR[b.kind]} stroke="#00000055" strokeWidth={0.004} />
        ))}
      </svg>
      {myTurn && (
        <div className="arcade-shot">
          <label>Power <input type="range" min={10} max={100} value={Math.round(power * 100)} onChange={(e) => setPower(Number(e.target.value) / 100)} /></label>
          <button className="academic-primary" disabled={busy || playing || !aim} onClick={() => { void act('shoot', { dx: aim![0], dz: aim![1], power }); setAim(null); }}>
            {aim ? 'Shoot' : 'Drag on the table to aim'}
          </button>
        </div>
      )}
      <Lobby host={s.p1} guest={s.p2} me={me} status={s.status} busy={busy} what="game of pool"
        onCreate={() => void act('create')} onJoin={() => void act('join', { id: s.id })} onLeave={() => void act('leave')} />
      {s.status === 'ACTIVE' && me && isPoolPlayer(s, me) && !myTurn && <button className="hustle-btn hustle-wide" disabled={busy} onClick={() => void act('leave')}>Concede</button>}
      {s.status === 'RESULT' && me && isPoolPlayer(s, me) && (
        <div className="hustle-row">
          <button className="academic-primary" disabled={busy || s.rematchVotes.includes(me)} onClick={() => void act('rematch')}>{s.rematchVotes.includes(me) ? 'Waiting for them…' : 'Play again'}</button>
          <button className="hustle-btn" disabled={busy} onClick={() => void act('leave')}>Leave table</button>
        </div>
      )}
      <details className="academic-how">
        <summary>How to play</summary>
        <p>Break, then the first colour you pot is yours (🔴 or 🟡). Pot one of yours to keep shooting. Clear your colour, then pot the black to win. Potting the black early loses; potting the white or hitting the wrong ball first is a foul and passes the turn.</p>
      </details>
    </div>
  );
}

export function ArcadeSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const me = useAuthStore((s) => s.user?.id);
  const { table, ttt, pool, error } = usePartyStore();
  const info = ARCADE_TABLES.find((t) => t.id === table);
  if (!info) return null;
  return (
    <Sheet title={info.game === 'pool' ? 'Pool' : 'Tic-tac-toe'} subtitle={`The Arena · ${info.label}`} icon={info.game === 'pool' ? '🎱' : '⭕'} accent="#7c3aed"
      onClose={() => setModal(null)} closeOnBackdrop={false}>
      {info.game === 'pool' ? <Pool s={pool} me={me} /> : <TicTacToe s={ttt[info.id]} me={me} />}
      {error && <p className="academic-error" role="alert" style={{ margin: '0 16px 12px' }}>{error}</p>}
    </Sheet>
  );
}
