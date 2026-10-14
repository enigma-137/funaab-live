import React, { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useHustleStore } from '../stores/hustleStore';
import { useBackgroundStore } from '../stores/backgroundStore';
import { ERRAND_KINDS, ERRAND_RULES, HUSTLE_RULES, PHOTO_RULES, PHOTO_SPOTS, POS_KIOSK, SHOP_RULES, TUTORING, type ErrandKind } from '../config/hustles';
import { LIBRARY_ROOM } from '../config/library';
import { FARM_SHIFT, FARM_STEPS, FPY_FARM, inFarm } from '../config/fpyFarm';

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const near = (a: readonly number[], b: readonly number[], r: number) => Math.hypot(a[0] - b[0], a[2] - b[2]) <= r;
const errandTitle = (k: string) => ERRAND_KINDS.find((e) => e.id === k);

function go(name: string, position: [number, number, number], icon: string) {
  const g = useGameStore.getState();
  g.setNavigationDestination({ id: name, name, shortName: name, position, icon });
  g.setActiveModal(null);
}

/** All the hustles in one place. The server decides pay; this only shows where/when you can earn. */
export function HustlesSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const myPosition = useGameStore((s) => s.myPosition);
  const room = useHostelStore((s) => s.roomId);
  const bonus = useBackgroundStore((s) => s.state?.hustle_bonus_percent ?? 0);
  const h = useHustleStore();
  const [now, setNow] = useState(Date.now());
  const [kind, setKind] = useState<ErrandKind>('buy_food');
  const [reward, setReward] = useState(200);
  useEffect(() => { void h.loadShop(); void h.loadErrands(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const onCampus = room === 'world:funaab:main';
  const atKiosk = onCampus && near(myPosition, POS_KIOSK.serviceSpot, POS_KIOSK.radius);
  const atSpot = onCampus ? PHOTO_SPOTS.find((s) => near(myPosition, s.position, s.radius)) : undefined;
  const atFarm = onCampus && inFarm(myPosition);
  const posLeft = h.posEndsAt ? Math.max(0, Math.ceil((h.posEndsAt - now) / 1000)) : null;
  const shop = h.shop;
  const ready = shop?.items.reduce((n, i) => n + i.ready, 0) ?? 0;
  const busy = (k: string) => h.busy === k;

  // Tutoring is a short quiz view inside the same sheet.
  if (h.tutor) {
    const t = h.tutor, r = h.tutorResult;
    const all = t.questions.every((q) => h.tutorAnswers[q.id] !== undefined);
    return (
      <Sheet title="Library tutoring" subtitle={`${naira(TUTORING.payPerCorrect)} per correct answer`} icon="📚" accent="#0891b2" onClose={() => { useHustleStore.setState({ tutor: null, tutorResult: null }); setModal(null); }} closeOnBackdrop={false}
        footer={r
          ? <div className="academic-footer"><b>{r.score}/{r.total} · +{naira(r.paid)}</b><button className="academic-primary" onClick={() => useHustleStore.setState({ tutor: null, tutorResult: null })}>Done</button></div>
          : <div className="academic-footer"><span>A student needs help with these:</span><button className="academic-primary" disabled={!all || busy('tutor')} onClick={h.submitTutor}>Submit</button></div>}>
        <div className="academic-body">
          <ol className="academic-questions">
            {t.questions.map((q, i) => (
              <li key={q.id}>
                <p><b>{i + 1}.</b> {q.question}</p>
                <div role="radiogroup" aria-label={`Question ${i + 1}`}>
                  {q.options.map((o, k) => {
                    const chosen = h.tutorAnswers[q.id] === k, correct = r?.answers[q.id] === k;
                    return <button key={k} role="radio" aria-checked={chosen} disabled={!!r} className={`${chosen ? 'is-chosen' : ''} ${r ? (correct ? 'is-correct' : chosen ? 'is-wrong' : '') : ''}`} onClick={() => h.pickTutor(q.id, k)}>{o}</button>;
                  })}
                </div>
              </li>
            ))}
          </ol>
          {h.error && <p className="academic-error" role="alert">{h.error}</p>}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Hustles" subtitle={shop ? `Today ${naira(shop.hustle_today)} of ${naira(HUSTLE_RULES.DAILY_CAP)}${bonus ? ` · +${bonus}% hustle bonus` : ''}` : 'Ways to earn beyond campus jobs'} icon="💼" accent="#16a34a" onClose={() => setModal(null)}>
      <div className="academic-body">
        {h.error && <p className="academic-error" role="alert">{h.error}</p>}

        <section className="hustle-card" aria-label="Room shop">
          <h3>🛒 Room shop <small>sells while you’re away</small></h3>
          <p className="academic-note">Buy stock from Iya Ibeji. One item sells every {SHOP_RULES.MINUTES_PER_SALE} minutes, up to {SHOP_RULES.MAX_SALES_PER_DAY} sales a day.</p>
          <ul className="hustle-shop">
            {shop?.items.map((i) => (
              <li key={i.item}>
                <span>{i.item === 'snacks' ? '🍪' : '📶'} <b>{i.title}</b><small>{i.units} on shelf · sells {naira(i.unit_price)} each</small></span>
                <button className="hustle-btn" disabled={!!h.busy || i.units + i.units_per_restock > SHOP_RULES.MAX_UNITS_IN_SHOP} onClick={() => h.restock(i.item)}>Restock {naira(i.cost)}</button>
              </li>
            ))}
          </ul>
          <button className="academic-primary academic-wide" disabled={!!h.busy || ready === 0} onClick={h.collect}>
            {ready > 0 ? `Collect ${ready} sale${ready === 1 ? '' : 's'}` : 'No sales to collect yet'}
          </button>
        </section>

        <section className="hustle-card" aria-label="FPY farm shift">
          <h3>🌱 FPY farm shift <small>{naira(FARM_SHIFT.pay)} · 3 jobs</small></h3>
          {h.farm ? (
            <ul className="academic-checks">
              {FARM_STEPS.map((s, i) => (
                <li key={s.id} className={i < h.farm!.step ? 'is-done' : ''}>
                  {s.icon} {s.label} {i === h.farm!.step && <b>{h.farm!.working ? '· working…' : '· next'}</b>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="academic-note">Plant, water and harvest at the farm's three plots, like the FPY students. Each job takes a few seconds at its plot.</p>
          )}
          {h.farm ? (
            <button className="hustle-btn hustle-wide" onClick={() => { const s = FARM_STEPS[h.farm!.step]; go(s.label, s.spot, s.icon); }}>Show me the next plot</button>
          ) : atFarm ? (
            <button className="academic-primary academic-wide" disabled={busy('farm')} onClick={h.startFarm}>Start farm shift</button>
          ) : (
            <button className="hustle-btn hustle-wide" onClick={() => go(FPY_FARM.name, FPY_FARM.entrance, '🌱')}>Show me the FPY farm</button>
          )}
        </section>

        <section className="hustle-card" aria-label="POS kiosk">
          <h3>🏧 POS kiosk shift <small>{naira(POS_KIOSK.pay)} · {POS_KIOSK.shiftSeconds}s</small></h3>
          {posLeft != null ? (
            <>
              <p className="academic-note">Serving customers… stay at the kiosk.</p>
              <div className="academic-bar"><i style={{ width: `${100 - (posLeft / POS_KIOSK.shiftSeconds) * 100}%` }} /></div>
              <button className="academic-primary academic-wide" disabled={posLeft > 0 || busy('pos')} onClick={h.finishPos}>{posLeft > 0 ? `${posLeft}s left` : 'Close shift & get paid'}</button>
            </>
          ) : atKiosk ? (
            <button className="academic-primary academic-wide" disabled={busy('pos')} onClick={h.startPos}>Start shift</button>
          ) : (
            <button className="hustle-btn hustle-wide" onClick={() => go('POS kiosk', POS_KIOSK.serviceSpot, '🏧')}>Show me the kiosk (Microfinance Bank)</button>
          )}
        </section>

        <section className="hustle-card" aria-label="Photo shoot">
          <h3>📸 Campus photographer <small>{naira(PHOTO_RULES.base)} + {naira(PHOTO_RULES.perClient)} per student nearby</small></h3>
          {atSpot ? (
            <button className="academic-primary academic-wide" disabled={busy('photo')} onClick={() => h.photo(atSpot.id)}>Take photos here</button>
          ) : (
            <div className="hustle-row">
              {PHOTO_SPOTS.map((s) => <button key={s.id} className="hustle-btn" onClick={() => go(s.title, s.position, '📸')}>{s.title.replace(' photo spot', '')}</button>)}
            </div>
          )}
        </section>

        <section className="hustle-card" aria-label="Library tutoring">
          <h3>📚 Library tutoring <small>{naira(TUTORING.payPerCorrect)} per right answer</small></h3>
          {room === LIBRARY_ROOM
            ? <button className="academic-primary academic-wide" disabled={busy('tutor')} onClick={h.startTutor}>Help a student</button>
            : <p className="academic-note">Go into the Library (weekdays 8am–5pm) and open Hustles there.</p>}
        </section>

        <section className="hustle-card" aria-label="Errands">
          <h3>📌 Errands <small>students pay students</small></h3>
          {h.errands?.mine.map((e) => (
            <div key={e.id} className="hustle-errand is-mine">
              <span>{errandTitle(e.kind)?.icon} <b>{errandTitle(e.kind)?.title}</b> · {naira(e.reward)}
                <small>{e.role === 'runner' ? `for @${e.other} · walk up to them to hand over` : e.status === 'accepted' ? `@${e.other} is on it` : 'waiting for a runner'}</small></span>
              {e.role === 'runner'
                ? <span className="hustle-row"><button className="hustle-btn" disabled={!!h.busy} onClick={() => h.handOver(e.id)}>Hand over</button><button className="hustle-btn is-quiet" disabled={!!h.busy} onClick={() => h.cancelErrand(e.id)}>Drop</button></span>
                : e.status === 'open' && <button className="hustle-btn is-quiet" disabled={!!h.busy} onClick={() => h.cancelErrand(e.id)}>Cancel</button>}
            </div>
          ))}
          {h.errands?.open.filter((e) => !e.mine).map((e) => (
            <div key={e.id} className="hustle-errand">
              <span>{errandTitle(e.kind)?.icon} <b>{errandTitle(e.kind)?.title}</b> · {naira(e.reward)}<small>posted by @{e.poster}</small></span>
              <button className="hustle-btn" disabled={!!h.busy} onClick={() => h.acceptErrand(e.id)}>I’ll do it</button>
            </div>
          ))}
          {h.errands && !h.errands.open.some((e) => !e.mine) && !h.errands.mine.length && <p className="academic-note">No errands right now. Post one, or check back later.</p>}
          <div className="hustle-post">
            <select aria-label="Errand" value={kind} onChange={(e) => setKind(e.target.value as ErrandKind)}>
              {ERRAND_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.title}</option>)}
            </select>
            <input aria-label="Reward in Naira" type="number" inputMode="numeric" min={ERRAND_RULES.minReward} max={ERRAND_RULES.maxReward} step={10} value={reward}
              onChange={(e) => setReward(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
            <button className="hustle-btn" disabled={!!h.busy || reward < ERRAND_RULES.minReward || reward > ERRAND_RULES.maxReward} onClick={() => h.postErrand(kind, reward)}>Post</button>
          </div>
          <p className="academic-note">The reward is held until the errand is done, refunded if you cancel or after {ERRAND_RULES.expiresMinutes / 60} hours.</p>
        </section>
      </div>
    </Sheet>
  );
}
