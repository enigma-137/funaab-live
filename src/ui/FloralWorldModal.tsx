import React, { useState } from 'react';
import { ECONOMY_CONFIG } from '../config/economy';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';

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
      setErrorMsg(err?.message || 'Order failed to process.');
      setIsPurchasing(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🌺</span>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#f6ad55', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                COLFHEC Campus Dining
              </div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>
                Floral World Restaurant
              </h2>
            </div>
          </div>
          <div style={walletChipStyle}>
            Wallet: <strong style={{ color: '#48bb78', marginLeft: '4px' }}>₦{balance.toLocaleString()}</strong>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', marginBottom: '14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '12px', fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {purchaseSuccess ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#48bb78' }}>
                {purchaseSuccess}
              </h3>
              <p style={{ margin: 0, color: '#a0aec0', fontSize: '13px' }}>
                Bon appétit, FUNAABite!
              </p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '13px', color: '#cbd5e0', marginBottom: '14px', fontWeight: 600 }}>
                Select an item from our daily student special menu:
              </div>

              {/* Menu Grid */}
              <div style={menuGridStyle}>
                {ECONOMY_CONFIG.FLORAL_WORLD_MENU.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  return (
                    <div
                      key={item.id}
                      id={`menu-item-${item.id}`}
                      onClick={() => !isPurchasing && setSelectedItemId(item.id)}
                      style={{
                        ...menuItemCardStyle,
                        borderColor: isSelected ? '#ecc94b' : '#334155',
                        backgroundColor: isSelected ? '#1e293b' : '#0f172a',
                        cursor: isPurchasing ? 'not-allowed' : 'pointer',
                        opacity: isPurchasing ? 0.7 : 1,
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{item.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#ecc94b', fontWeight: 700, marginTop: '2px' }}>
                          ₦{item.price.toLocaleString()}
                        </div>
                      </div>
                      {isSelected && <span style={{ color: '#ecc94b', fontWeight: 900 }}>✓</span>}
                    </div>
                  );
                })}
              </div>

              {/* Selected Action Buttons */}
              {selectedItem && (
                <div style={{ marginTop: '20px', backgroundColor: '#0f172a', padding: '14px', borderRadius: '10px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#cbd5e1' }}>
                      Selected: <strong>{selectedItem.name}</strong>
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#48bb78' }}>
                      ₦{selectedItem.price.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      id="btn-take-away"
                      onClick={() => handleOrder('takeaway')}
                      disabled={isPurchasing}
                      style={{
                        ...btnTakeAwayStyle,
                        opacity: isPurchasing ? 0.6 : 1,
                        cursor: isPurchasing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isPurchasing ? 'Ordering...' : '🥡 [ Take Away ]'}
                    </button>
                    <button
                      id="btn-sit-and-eat"
                      onClick={() => handleOrder('sit_and_eat')}
                      disabled={isPurchasing}
                      style={{
                        ...btnSitEatStyle,
                        opacity: isPurchasing ? 0.6 : 1,
                        cursor: isPurchasing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isPurchasing ? 'Ordering...' : '🍽️ [ Sit & Eat ]'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '14px', textAlign: 'right' }}>
                <button onClick={onClose} disabled={isPurchasing} style={btnCloseStyle}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  backdropFilter: 'blur(6px)',
  animation: 'fadeIn 0.2s ease-out'
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#1a202c',
  border: '2px solid #3b4252',
  borderRadius: '16px',
  width: '90%',
  maxWidth: '520px',
  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
  overflow: 'hidden',
  color: '#e2e8f0',
  fontFamily: 'Inter, system-ui, sans-serif'
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  padding: '16px 20px',
  borderBottom: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
};

const walletChipStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  padding: '6px 12px',
  borderRadius: '20px',
  fontSize: '13px',
  color: '#cbd5e1',
  border: '1px solid #334155'
};

const menuGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
  maxHeight: '260px',
  overflowY: 'auto'
};

const menuItemCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #334155',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background-color 0.15s'
};

const btnTakeAwayStyle: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '14px',
  padding: '12px 14px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'transform 0.1s',
  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
};

const btnSitEatStyle: React.CSSProperties = {
  backgroundColor: '#10b981',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '14px',
  padding: '12px 14px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'transform 0.1s',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
};

const btnCloseStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#334155',
  color: '#cbd5e1',
  fontWeight: 700,
  fontSize: '13px',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer'
};
