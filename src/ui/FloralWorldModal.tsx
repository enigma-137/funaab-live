import React, { useState } from 'react';
import { ECONOMY_CONFIG } from '../config/economy';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { Sheet } from './Sheet';
import { logTraceIQ } from '../lib/traceiq';

interface FloralWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FloralWorldModal: React.FC<FloralWorldModalProps> = ({ isOpen, onClose }) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(ECONOMY_CONFIG.FLORAL_WORLD_MENU[0].id);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);

  const { balance, purchaseFood } = useWalletStore();
  const { user } = useAuthStore();
  const { addMessage } = useSocialStore();

  if (!isOpen) return null;

  const selectedItem = ECONOMY_CONFIG.FLORAL_WORLD_MENU.find((item) => item.id === selectedItemId);

  const handleOrder = async (action: 'takeaway' | 'sit_and_eat') => {
    if (!selectedItem || !user || isPurchasing) return;
    setErrorMsg(null);

    if (balance < selectedItem.price) {
      setErrorMsg(`Insufficient funds for ${selectedItem.name}! You need ₦${selectedItem.price.toLocaleString()} (Current Balance: ₦${balance.toLocaleString()}).`);
      return;
    }

    setIsPurchasing(true);

    try {
      const res = await purchaseFood(user.id, selectedItem);

      if (res.success) {
        addMessage({
          id: `msg-fw-${Date.now()}`,
          senderId: 'system',
          senderName: 'Floral World',
          college: 'COLFHEC',
          text: action === 'sit_and_eat'
            ? `🍽️ @${user.username} is enjoying ${selectedItem.name} at Floral World Terrace.`
            : `🥡 @${user.username} bought ${selectedItem.name} for Take Away.`,
          timestamp: Date.now(),
          isSystem: true
        });

        setPurchaseSuccess(`Ordered ${selectedItem.name} (${action === 'takeaway' ? 'Take Away' : 'Dine In'})!`);
        setTimeout(() => {
          setPurchaseSuccess(null);
          setIsPurchasing(false);
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.error || 'Purchase failed. Please try again.');
        setIsPurchasing(false);
      }
    } catch (err: any) {
      console.error('Floral World order error:', err);
      logTraceIQ('error', 'Floral World order failed', { service: 'shop', error: err });
      setErrorMsg(err?.message || 'Order failed to process.');
      setIsPurchasing(false);
    }
  };

  const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
  const short = !!selectedItem && balance < selectedItem.price;

  return (
    <Sheet
      title="Floral World Restaurant"
      subtitle={<>COLFHEC campus dining · Wallet <b className="fw-wallet">{naira(balance)}</b></>}
      icon="🌺"
      accent="#f59e0b"
      onClose={onClose}
      footer={purchaseSuccess ? undefined : selectedItem && (
        <div className="fw-actions">
          <div className="fw-picked"><span>{selectedItem.icon} {selectedItem.name}</span><b>{naira(selectedItem.price)}</b></div>
          {short && <p className="fw-short">You need {naira(selectedItem.price - balance)} more.</p>}
          <div className="fw-buttons">
            <button className="fw-btn is-away" disabled={isPurchasing || short} onClick={() => handleOrder('takeaway')}>
              {isPurchasing ? 'Ordering…' : '🥡 Take away'}
            </button>
            <button className="fw-btn is-sit" disabled={isPurchasing || short} onClick={() => handleOrder('sit_and_eat')}>
              {isPurchasing ? 'Ordering…' : '🍽️ Sit & eat'}
            </button>
          </div>
        </div>
      )}
    >
      {purchaseSuccess ? (
        <div className="fw-done">
          <div>✅</div>
          <b>{purchaseSuccess}</b>
          <small>Bon appétit, FUNAABite!</small>
        </div>
      ) : (
        <>
          {errorMsg && <p className="fw-error" role="alert">{errorMsg}</p>}
          <ul className="fw-menu" role="listbox" aria-label="Menu">
            {ECONOMY_CONFIG.FLORAL_WORLD_MENU.map((item) => {
              const on = item.id === selectedItemId;
              return (
                <li key={item.id}>
                  <button role="option" aria-selected={on} className={on ? 'is-on' : ''} disabled={isPurchasing} onClick={() => setSelectedItemId(item.id)}>
                    <span className="fw-ico" aria-hidden>{item.icon}</span>
                    <span className="fw-name">{item.name}<small>{item.type === 'drink' ? 'Drink' : 'Meal'}</small></span>
                    <b>{naira(item.price)}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
};
