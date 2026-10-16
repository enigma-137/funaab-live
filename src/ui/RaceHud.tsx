import React, { useEffect, useState } from 'react';
import { useRaceStore, ordinal } from '../stores/raceStore';
import { RACE, RACE_GATES, RIVALS, formatRaceTime } from '../config/carRace';

/** Countdown lights, race clock and your place; the result when you cross the line. */
export function RaceHud() {
  const { status, goAt, place, gate, finishMs, best } = useRaceStore();
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (status !== 'countdown' && status !== 'racing') return;
    const t = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(t);
  }, [status]);
  // The result card closes itself after a while.
  useEffect(() => {
    if (status !== 'finished') return;
    const t = setTimeout(() => useRaceStore.getState().dismiss(), 10000);
    return () => clearTimeout(t);
  }, [status]);
  if (status === 'idle') return null;
  const cars = RIVALS.length + 1;
  const card = 'pointer-events-auto mx-auto w-fit rounded-2xl border border-amber-300/70 bg-slate-950/90 px-4 py-2 text-center text-white shadow-xl';
  if (status === 'countdown') {
    const left = Math.ceil((goAt - now) / 1000);
    return (
      <div className={card} role="status" aria-live="assertive">
        <div className="text-xs font-bold uppercase tracking-wide text-amber-300">{RACE.name}</div>
        <div className="text-4xl font-black">{left > 0 ? left : 'GO!'}</div>
        <div className="text-xs text-slate-300">Hold on… you go when the lights turn green.</div>
      </div>
    );
  }
  if (status === 'racing') {
    return (
      <div className={card} role="status">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black">{ordinal(place)}<small className="text-sm text-slate-300"> / {cars}</small></span>
          <span className="font-mono text-xl font-bold tabular-nums">{formatRaceTime(Math.max(0, now - goAt))}</span>
          <button className="rounded-xl bg-slate-700 px-2 py-1 text-xs font-bold" onClick={() => useRaceStore.getState().quit('You quit the race.')}>Quit</button>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-700" aria-label={`Checkpoint ${gate} of ${RACE_GATES.length}`}>
          <span className="block h-full bg-amber-400" style={{ width: `${(gate / RACE_GATES.length) * 100}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className={card} role="status">
      <div className="text-xs font-bold uppercase tracking-wide text-amber-300">{RACE.name}</div>
      <div className="text-2xl font-black">{place === 1 ? '🏆 ' : '🏁 '}{ordinal(place)} of {cars}</div>
      <div className="font-mono text-lg">{finishMs !== null && formatRaceTime(finishMs)}</div>
      {best !== null && <div className="text-xs text-slate-300">Best on this phone: {formatRaceTime(best)}</div>}
      <button className="mt-1 rounded-xl bg-amber-500 px-3 py-1 text-sm font-extrabold text-slate-950" onClick={() => useRaceStore.getState().dismiss()}>Done</button>
    </div>
  );
}
