import React, { useEffect } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useCarStore } from '../stores/carStore';
import { useEstateStore } from '../stores/estateStore';
import { useWalletStore } from '../stores/walletStore';
import { toast } from '../stores/toastStore';
import { CAR_MODELS, FUEL, FUEL_STATION, fuelPrice } from '../config/cars';
import { ESTATE } from '../config/estate';

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

function FuelBar({ litres }: { litres: number }) {
  const pct = Math.max(0, Math.min(100, (litres / FUEL.tankLitres) * 100));
  return (
    <div className="car-fuel" aria-label={`Fuel ${litres.toFixed(1)} of ${FUEL.tankLitres} litres`}>
      <span style={{ width: `${pct}%`, background: pct < 15 ? '#ef4444' : pct < 40 ? '#f59e0b' : '#22c55e' }} />
      <b>⛽ {litres.toFixed(1)} L</b>
    </div>
  );
}

/** Phone → Garage: your cars, their fuel, and where your car is waiting. */
export function GarageSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { fuel, parked, driving, loaded, load, takeOut } = useCarStore();
  const renting = useEstateStore((s) => !!s.state?.renting);
  useEffect(() => { void load(); void useEstateStore.getState().load(); }, []);
  const owned = Object.keys(fuel).filter((id) => CAR_MODELS[id]);
  const go = (to: [number, number, number], name: string) => {
    setModal(null);
    useGameStore.getState().setNavigationDestination({ id: 'my-car', name, shortName: name, position: to, icon: '🚗' });
  };
  return (
    <Sheet title="Garage" subtitle="Your cars · fuel · where they're parked" icon="🚗" accent="#2563eb" onClose={() => setModal(null)}>
      <div className="academic-body">
        {!loaded ? <p className="academic-note">Opening the garage…</p> : !owned.length ? (
          <section className="hustle-card">
            <h3>No car yet</h3>
            <p className="academic-note">Buy one in the Iya Ibeji shop (Hostel → Shop → Cars), then come back here to take it out.</p>
          </section>
        ) : owned.map((id) => {
          const m = CAR_MODELS[id], out = parked?.car === id, inUse = driving === id;
          return (
            <section key={id} className="hustle-card">
              <h3>{m.name} <small>{inUse ? 'driving now' : out ? 'parked' : 'in the garage'}</small></h3>
              <FuelBar litres={fuel[id] ?? 0} />
              {inUse ? <p className="academic-note">Tap Park & get out when you stop.</p> : out ? (
                <div className="hustle-row">
                  <button className="hustle-btn" onClick={() => go(parked!.position, m.name)}>Show me my car</button>
                  <button className="hustle-btn is-quiet" onClick={() => { takeOut(id, renting); toast({ icon: '🚗', text: `${m.name} is back at ${renting ? ESTATE.shortName : 'the campus car park'}.`, tone: 'info' }); }}>Bring it home</button>
                </div>
              ) : (
                <button className="academic-primary academic-wide" disabled={!!driving} onClick={() => {
                  takeOut(id, renting);
                  const p = useCarStore.getState().parked!;
                  go(p.position, m.name);
                  toast({ icon: '🚗', text: `${m.name} is waiting at ${renting ? 'the Royal Gardens car park' : 'the campus car park'}. Follow the arrow, then tap Drive.`, tone: 'info', ms: 6000 });
                }}>Take it out</button>
              )}
            </section>
          );
        })}
        <p className="academic-note">⛽ {FUEL_STATION.name} is on the gate road, east of the lodge: {naira(FUEL.pricePerLitre)} a litre, {FUEL.tankLitres} L tank. One litre takes you about {FUEL.metresPerLitre} m.</p>
      </div>
    </Sheet>
  );
}

/** At the pump: fill any of your cars. */
export function FuelSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { fuel, driving, busy, error, load, buyFuel } = useCarStore();
  const balance = useWalletStore((s) => s.balance);
  useEffect(() => { void load(); }, []);
  const ids = Object.keys(fuel).filter((id) => CAR_MODELS[id]).sort((a, b) => (a === driving ? -1 : b === driving ? 1 : 0));
  return (
    <Sheet title={FUEL_STATION.name} subtitle={`${naira(FUEL.pricePerLitre)} per litre · tank ${FUEL.tankLitres} L`} icon="⛽" accent="#dc2626" onClose={() => setModal(null)}>
      <div className="academic-body">
        {!ids.length && <p className="academic-note">You don't own a car yet. Cars are in the Iya Ibeji shop.</p>}
        {ids.map((id) => {
          const have = fuel[id] ?? 0, space = Math.floor(FUEL.tankLitres - have);
          return (
            <section key={id} className="hustle-card">
              <h3>{CAR_MODELS[id].name} {id === driving && <small>this car</small>}</h3>
              <FuelBar litres={have} />
              {space < 1 ? <p className="academic-note">Tank full.</p> : (
                <div className="hustle-row">
                  {[10, 20].filter((l) => l < space).map((l) => (
                    <button key={l} className="hustle-btn" disabled={busy || balance < fuelPrice(l)} onClick={() => void buyFuel(id, l)}>{l} L · {naira(fuelPrice(l))}</button>
                  ))}
                  <button className="hustle-btn" disabled={busy || balance < fuelPrice(space)} onClick={() => void buyFuel(id, space)}>Fill up ({space} L) · {naira(fuelPrice(space))}</button>
                </div>
              )}
            </section>
          );
        })}
        {error && <p className="academic-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

/** Loads your garage once you're in (fuel, which cars you own). */
export function CarWatcher() {
  const load = useCarStore((s) => s.load);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 600000); return () => clearInterval(t); }, []);
  return null;
}
