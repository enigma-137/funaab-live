import React, { useEffect } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useLodgeStore } from '../stores/lodgeStore';
import { toast } from '../stores/toastStore';
import { LODGE } from '../config/lodge';

const naira = (n: number) => `₦${n.toLocaleString()}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '—');

/** Off-campus lodge agent: rent, pay, move out, or go home. */
export function LodgeSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { state, busy, error, load, act } = useLodgeStore();
  useEffect(() => { void load(); }, []);
  const close = () => setModal(null);
  const goHome = () => { setModal(null); void useHostelStore.getState().travel('room'); };
  const s = state;
  return (
    <Sheet title={LODGE.name} subtitle="Off-campus self-contain · outside the main gate" icon="🏘️" accent="#b45309" onClose={close}>
      <div className="academic-body">
        {!s ? <p className="academic-note">Checking with the agent…</p> : s.renting ? (
          <>
            <section className="hustle-card">
              <h3>Your lodge <small>{s.overdue ? 'rent overdue' : 'rent paid'}</small></h3>
              <ul className="academic-checks">
                <li className={s.overdue ? '' : 'is-done'}>🗓️ Paid until <b>{day(s.paid_until)}</b></li>
                {s.overdue && <li>⚠️ Pay by <b>{day(s.grace_until)}</b> or you move back to the hostel</li>}
                <li>👥 Up to <b>{s.capacity - 1} guests</b> at once</li>
              </ul>
              <button className="academic-primary academic-wide" onClick={goHome}>Go to my room</button>
              <div className="hustle-row">
                <button className="hustle-btn" disabled={busy || !s.can_prepay} onClick={async () => { if (await act('pay_lodge_rent')) toast({ icon: '🏠', text: 'Rent paid for another week', amount: -LODGE.weeklyRent, tone: 'good' }); }}>
                  {s.can_prepay ? `Pay a week (${naira(s.rent)})` : 'Paid 2 weeks ahead'}
                </button>
                <button className="hustle-btn is-quiet" disabled={busy} onClick={async () => { if (window.confirm('Move back to your free hostel room? Rent already paid is not refunded.') && (await act('leave_lodge'))) toast({ icon: '🧳', text: 'You moved back to the hostel. Your things came with you.', tone: 'info' }); }}>Move out</button>
              </div>
            </section>
          </>
        ) : (
          <section className="hustle-card">
            <h3>Rent a self-contain <small>{naira(LODGE.weeklyRent)} a week</small></h3>
            <ul className="academic-checks">
              <li>🏘️ Your own room off campus, with a new look</li>
              <li>👥 Host up to <b>{LODGE.capacity - 1} friends</b> (hostel: {LODGE.hostelCapacity - 1})</li>
              <li>🧳 All your furniture comes with you</li>
              <li>🛺 It’s outside the gate: keke or walk to class</li>
              <li>⏳ Miss rent and after {LODGE.graceDays} days you move back to the hostel</li>
            </ul>
            <button className="academic-primary academic-wide" disabled={busy} onClick={async () => { if (await act('rent_lodge')) toast({ icon: '🏘️', text: 'Welcome to your lodge!', amount: -LODGE.weeklyRent, tone: 'good' }); }}>
              Rent for {naira(LODGE.weeklyRent)} (first week)
            </button>
          </section>
        )}
        {error && <p className="academic-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

/** Loads lodge status for reminders; mounted once. */
export function LodgeWatcher() {
  const load = useLodgeStore((s) => s.load);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 900000); return () => clearInterval(t); }, []);
  return null;
}
