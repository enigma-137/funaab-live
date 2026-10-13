import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useWalletStore } from '../stores/walletStore';
import { useFoodVendorStore, useVendorStatus } from '../stores/foodVendorStore';
import { FOOD_VENDORS, type FoodVendorId } from '../config/foodVendors';
import './foodVendor.css';

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

function Sheet({ vendorId }: { vendorId: FoodVendorId }) {
  const vendor = FOOD_VENDORS[vendorId];
  const status = useVendorStatus(vendorId);
  const balance = useWalletStore((s) => s.balance);
  const { buying, error, buy } = useFoodVendorStore();
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => setActiveModal(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, []);

  return (
    <div className="fv-wrap" onClick={close}>
      <section className={`fv-sheet fv-${vendorId}`} role="dialog" aria-modal="true" aria-labelledby="fv-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="fv-icon" aria-hidden>{vendor.icon}</span>
          <div>
            <h2 id="fv-title">{vendor.name}</h2>
            <small className={status.isOpen ? 'fv-open' : 'fv-closed'}>{status.isOpen ? status.label : `Closed · ${status.label}`}</small>
          </div>
          <button ref={closeRef} className="fv-close" aria-label={`Close ${vendor.name}`} onClick={close}><X size={18} /></button>
        </header>
        {!status.isOpen && <p className="fv-banner" role="status">{vendor.closedMessage} {status.label}.</p>}
        <ul>
          {vendor.items.map((item) => (
            <li key={item.id}>
              <span><b>{item.name}</b><em>{naira(item.price)}</em></span>
              <button disabled={!status.isOpen || !!buying || balance < item.price} onClick={() => void buy(vendorId, item.id)}>
                {buying === item.id ? 'Buying…' : 'Buy'}
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="fv-error" role="alert">{error}</p>}
        <footer>Wallet <b>{naira(balance)}</b><span>Game Naira only</span></footer>
      </section>
    </div>
  );
}

export function FoodVendorSheet() {
  const vendorId = useFoodVendorStore((s) => s.activeVendor);
  return vendorId ? <Sheet vendorId={vendorId} /> : null;
}

