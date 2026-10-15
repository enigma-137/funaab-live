import React, { useEffect } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useEstateStore } from '../stores/estateStore';
import { toast } from '../stores/toastStore';
import { ESTATE } from '../config/estate';
import { useCarStore } from '../stores/carStore';
import { CAR_HOME } from '../config/cars';

const naira = (n: number) => `₦${n.toLocaleString()}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

/** Royal Gardens Estate office: rent, renew, go to your room, move out, or get directions. */
export function EstateSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { state: s, busy, error, load, act } = useEstateStore();
  useEffect(() => { void load(); }, []);
  const close = () => setModal(null);
  const goHome = () => { setModal(null); void useHostelStore.getState().travel('room'); };
  const directions = () => {
    setModal(null);
    useGameStore.getState().setNavigationDestination({ id: 'estate', name: ESTATE.name, shortName: ESTATE.shortName, position: ESTATE.officeDoor, icon: '🏡' });
    toast({ icon: '🏡', text: 'Out through the main gate, across the road and up the estate road.', tone: 'info', ms: 5000 });
  };
  return (
    <Sheet title={ESTATE.name} subtitle="Off-campus estate · north of the gate road" icon="🏡" accent="#6d28d9" onClose={close}>
      <div className="academic-body">
        {!s ? <p className="academic-note">Checking with the estate office…</p> : s.renting ? (
          <section className="hustle-card">
            <h3>Your estate room <small>rent paid</small></h3>
            <ul className="academic-checks">
              <li className="is-done">🗓️ Paid until <b>{when(s.paid_until)}</b></li>
              <li>📐 Big room (double the hostel width), estate finish</li>
              <li>👥 Up to <b>{s.capacity - 1} guests</b> at once</li>
              <li>⏳ When the time runs out you move back to the hostel. Renew to stay.</li>
            </ul>
            <button className="academic-primary academic-wide" onClick={goHome}>Go to my room</button>
            <div className="hustle-row">
              <button className="hustle-btn" disabled={busy || !s.can_prepay} onClick={async () => { if (await act('pay_estate_rent')) toast({ icon: '🏡', text: 'Another week at Royal Gardens', amount: -ESTATE.weeklyRent, tone: 'good' }); }}>
                {s.can_prepay ? `Renew a week (${naira(s.rent)})` : 'Paid 2 weeks ahead'}
              </button>
              <button className="hustle-btn is-quiet" disabled={busy} onClick={async () => { if (window.confirm('Move back to your free hostel room now? Rent already paid is not refunded.') && (await act('leave_estate'))) toast({ icon: '🧳', text: 'You moved back to the hostel. Your things came with you.', tone: 'info' }); }}>Move out</button>
            </div>
          </section>
        ) : (
          <section className="hustle-card">
            <h3>Rent a room <small>{naira(ESTATE.weeklyRent)} a week</small></h3>
            <ul className="academic-checks">
              <li>🏡 Gated estate with houses, a car park and trees</li>
              <li>📐 Your room becomes a big estate room while you rent</li>
              <li>👥 Host up to <b>{ESTATE.capacity - 1} friends</b> (hostel: 4)</li>
              <li>🧳 All your furniture comes with you</li>
              <li>⏳ Pay a week at a time (up to 2 weeks ahead). When it runs out, you move back to the hostel.</li>
            </ul>
            {s.lodge && <p className="academic-note">You rent the lodge now. Move out there first (Phone → Lodge).</p>}
            <button className="academic-primary academic-wide" disabled={busy || s.lodge} onClick={async () => {
              if (!(await act('rent_estate'))) return;
              toast({ icon: '🏡', text: 'Welcome to Royal Gardens Estate!', amount: -ESTATE.weeklyRent, tone: 'good' });
              // A car waiting at the campus car park moves to the estate car park.
              const c = useCarStore.getState(), p = c.parked;
              if (p && !c.driving && p.position[0] === CAR_HOME.campus[0] && p.position[2] === CAR_HOME.campus[2]) c.takeOut(p.car, true);
            }}>
              Rent for {naira(ESTATE.weeklyRent)} (first week)
            </button>
            <button className="hustle-btn is-quiet academic-wide" onClick={directions}>Show me the way</button>
          </section>
        )}
        {error && <p className="academic-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

/** Loads estate status for reminders; mounted once. */
export function EstateWatcher() {
  const load = useEstateStore((s) => s.load);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 600000); return () => clearInterval(t); }, []);
  return null;
}
