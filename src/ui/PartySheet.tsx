import React from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { usePartyStore } from '../stores/partyStore';
import { useWalletStore } from '../stores/walletStore';
import { PARTY_HALL, partyHoursLabel, partyOpen } from '../config/partyHall';

/** The Arena door: buy tonight's ticket (₦500, good until 5 AM) or come back when it opens. */
export function PartySheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { busy, error, enter, hasTicket } = usePartyStore();
  usePartyStore((s) => s.ticketNight);
  const balance = useWalletStore((s) => s.balance);
  const now = Date.now();
  const open = partyOpen(now);
  const ticket = hasTicket();
  return (
    <Sheet title="The Arena" subtitle={`Night party & arcade · ${partyHoursLabel(now)}`} icon="🪩" accent="#7c3aed" onClose={() => setModal(null)}>
      <div className="academic-body">
        <section className="academic-card">
          <h3>Tonight at The Arena</h3>
          <ul className="academic-checks">
            <li>🪩 Dance floor with party lights and the DJ</li>
            <li>🍹 Arena Bar: zobo, Chapman, malt and more</li>
            <li>⭕ Tic-tac-toe tables and 🎱 a pool table</li>
          </ul>
        </section>
        {!open ? (
          <p className="academic-note">The Arena opens every night at <b>7 PM</b> and closes at <b>5 AM</b>. Come back tonight!</p>
        ) : ticket ? (
          <>
            <p className="academic-note">✅ You have tonight&apos;s ticket. Walk in and enjoy!</p>
            <button className="academic-primary academic-wide" onClick={() => setModal(null)}>Go in</button>
          </>
        ) : (
          <>
            <p className="academic-note">Gate fee <b>₦{PARTY_HALL.gateFee.toLocaleString()}</b> covers the whole night — leave and come back free until 5 AM.</p>
            <button className="academic-primary academic-wide" disabled={busy || balance < PARTY_HALL.gateFee} onClick={() => void enter()}>
              {balance < PARTY_HALL.gateFee ? 'Not enough money in your wallet' : busy ? 'Checking…' : `Pay ₦${PARTY_HALL.gateFee} & enter`}
            </button>
          </>
        )}
        {error && <p className="academic-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
