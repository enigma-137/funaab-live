import React, { useState, useRef, useEffect } from 'react';
import { useSocialStore } from '../stores/socialStore';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { Send, DollarSign, ShieldAlert, Ban, X, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';

export const PrivateChatModal: React.FC = () => {
  const { user } = useAuthStore();
  const {
    activeDmPartner,
    closeDm,
    directMessages,
    blockedUserIds,
    blockUser,
    unblockUser,
    openReportModal,
  } = useSocialStore();
  const { balance, transferMoney } = useWalletStore();

  const [messageInput, setMessageInput] = useState('');
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [transferAmount, setTransferAmount] = useState('200');
  const [transferNote, setTransferNote] = useState('');
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!activeDmPartner || !user) return null;

  const partnerKey = activeDmPartner.username.toLowerCase();
  const conversation = directMessages[partnerKey] || [];
  const isBlocked = blockedUserIds.includes(activeDmPartner.id);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isBlocked) return;

    networkManager.sendPrivateChat(
      activeDmPartner.id,
      activeDmPartner.username,
      messageInput.trim()
    );
    setMessageInput('');
  };

  const handleSendMoneyInChat = async () => {
    const amount = Number(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferError('Enter a valid amount');
      return;
    }

    if (amount > balance) {
      setTransferError(`Insufficient funds. Your balance is ₦${balance.toLocaleString()}`);
      return;
    }

    setTransferError(null);
    setTransferStatus('Sending...');

    const res = await transferMoney(
      user.id,
      user.username,
      activeDmPartner.username,
      amount
    );

    if (res.success) {
      // Send interactive money transfer message into the DM thread
      networkManager.sendPrivateChat(
        activeDmPartner.id,
        activeDmPartner.username,
        `💸 Sent ₦${amount.toLocaleString('en-US')}${transferNote ? ` for "${transferNote}"` : ''}`,
        { amount, note: transferNote }
      );

      setTransferStatus(`Sent ₦${amount.toLocaleString()} to @${activeDmPartner.username}!`);
      setTimeout(() => {
        setTransferStatus(null);
        setShowTransferPanel(false);
        setTransferNote('');
      }, 1500);
    } else {
      setTransferError(res.error || 'Transfer failed');
      setTransferStatus(null);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              onClick={() => { useSocialStore.setState({ activeDmPartner: null }); useGameStore.getState().setActiveModal('inbox'); }}
              style={btnSafetyActionStyle}
              title="All messages"
              aria-label="Back to all messages"
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
            </button>
            <div style={avatarCircleStyle}>
              {activeDmPartner.username[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: '15px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{activeDmPartner.username}
                </span>
                <span style={collegeBadgeStyle}>
                  {activeDmPartner.college || 'CAMPUS'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#68d391', fontWeight: 600 }}>
                ● Private Direct Message
              </div>
            </div>
          </div>

          {/* Icon-only safety actions keep the close button on screen on narrow phones. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Safety Menu Actions */}
            {isBlocked ? (
              <button
                onClick={() => unblockUser(user.id, activeDmPartner.id)}
                style={btnUnblockStyle}
                title="Unblock this user"
              >
                Unblock
              </button>
            ) : (
              <button
                onClick={() => blockUser(user.id, activeDmPartner.id)}
                style={btnSafetyActionStyle}
                title="Block user"
                aria-label="Block user"
              >
                <Ban style={{ width: '15px', height: '15px' }} />
              </button>
            )}

            <button
              onClick={() => openReportModal(activeDmPartner)}
              style={btnSafetyActionStyle}
              title="Report user"
              aria-label="Report user"
            >
              <ShieldAlert style={{ width: '15px', height: '15px', color: '#f87171' }} />
            </button>

            <button onClick={closeDm} style={btnCloseCircleStyle} title="Close chat" aria-label="Close chat">
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>

        {/* In-Chat Money Transfer Sub-Panel */}
        {showTransferPanel && (
          <div style={transferPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#48bb78', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                💸 In-Chat P2P Money Transfer
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Balance: <strong style={{ color: '#ffffff' }}>₦{balance.toLocaleString()}</strong>
              </div>
            </div>

            {transferStatus ? (
              <div style={{ textAlign: 'center', padding: '10px 0', color: '#48bb78', fontWeight: 700, fontSize: '13px' }}>
                ✅ {transferStatus}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '8px', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '8px', top: '8px', color: '#48bb78', fontWeight: 800, fontSize: '13px' }}>₦</span>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="Amount"
                      min="50"
                      step="50"
                      style={transferInputStyle}
                    />
                  </div>
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Note e.g. Lunch / Keke"
                    maxLength={35}
                    style={transferNoteInputStyle}
                  />
                  <button
                    onClick={handleSendMoneyInChat}
                    style={btnSendTransferStyle}
                  >
                    Send ₦
                  </button>
                </div>
                {transferError && (
                  <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', fontWeight: 600 }}>
                    ⚠️ {transferError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Messages Body */}
        <div style={chatBodyStyle}>
          {conversation.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>🔒</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1' }}>
                Private Conversation with @{activeDmPartner.username}
              </div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>
                Messages & transfers in this channel are private between both of you.
              </div>
            </div>
          ) : (
            conversation.map((msg) => {
              const isMine = msg.senderName.toLowerCase() === user.username.toLowerCase();
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMine ? 'flex-end' : 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  {msg.transferData ? (
                    /* Interactive Transfer Receipt Card */
                    <div style={transferBubbleCardStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>💸</span>
                        <strong style={{ color: '#48bb78', fontSize: '13px' }}>
                          ₦{msg.transferData.amount.toLocaleString('en-US')}
                        </strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#f1f5f9', marginTop: '2px' }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    /* Standard Message Bubble */
                    <div
                      style={{
                        ...messageBubbleStyle,
                        backgroundColor: isMine ? '#059669' : '#1e293b',
                        borderBottomRightRadius: isMine ? '2px' : '14px',
                        borderBottomLeftRadius: isMine ? '14px' : '2px',
                      }}
                    >
                      <div style={{ fontSize: '13px', color: '#f8fafc', wordBreak: 'break-word' }}>
                        {msg.text}
                      </div>
                      <div
                        style={{
                          fontSize: '9px',
                          color: isMine ? '#a7f3d0' : '#94a3b8',
                          marginTop: '3px',
                          textAlign: 'right',
                        }}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Blocked User Warning */}
        {isBlocked ? (
          <div style={blockedNoticeStyle}>
            <Ban style={{ width: '16px', height: '16px', color: '#f87171' }} />
            <span>You have blocked @{activeDmPartner.username}. Messages are muted.</span>
            <button
              onClick={() => unblockUser(user.id, activeDmPartner.id)}
              style={btnUnblockInlineStyle}
            >
              Unblock
            </button>
          </div>
        ) : (
          /* Footer Input Form */
          <form onSubmit={handleSendMessage} style={footerFormStyle}>
            {/* Quick Send Money Toggle */}
            <button
              type="button"
              onClick={() => setShowTransferPanel(!showTransferPanel)}
              style={{
                ...btnMoneyToggleStyle,
                backgroundColor: showTransferPanel ? '#065f46' : '#1e293b',
                borderColor: showTransferPanel ? '#10b981' : '#334155',
              }}
              title="Send Money in Chat"
            >
              <DollarSign style={{ width: '15px', height: '15px', color: '#34d399' }} />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399' }}>₦</span>
            </button>

            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Message @${activeDmPartner.username}...`}
              maxLength={400}
              style={chatInputFieldStyle}
            />

            <button
              type="submit"
              disabled={!messageInput.trim()}
              style={{
                ...btnSendStyle,
                opacity: messageInput.trim() ? 1 : 0.5,
              }}
            >
              <Send style={{ width: '14px', height: '14px' }} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  backdropFilter: 'blur(5px)',
  animation: 'fadeIn 0.2s ease-out',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1.5px solid #334155',
  borderRadius: '16px',
  width: '92%',
  maxWidth: '460px',
  height: '540px',
  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  padding: '12px 16px',
  borderBottom: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
};

const avatarCircleStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  flexShrink: 0,
  borderRadius: '10px',
  backgroundColor: '#16a34a',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const collegeBadgeStyle: React.CSSProperties = {
  fontSize: '9.5px',
  fontWeight: 800,
  backgroundColor: '#0f172a',
  color: '#34d399',
  padding: '1px 6px',
  borderRadius: '4px',
  border: '1px solid #334155',
  flexShrink: 0,
};

const btnSafetyActionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  padding: 0,
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 700,
  color: '#cbd5e1',
  cursor: 'pointer',
};

const btnUnblockStyle: React.CSSProperties = {
  backgroundColor: '#065f46',
  border: '1px solid #10b981',
  color: '#6ee7b7',
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 8px',
  borderRadius: '6px',
  cursor: 'pointer',
};

const btnCloseCircleStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
};

const transferPanelStyle: React.CSSProperties = {
  backgroundColor: '#022c22',
  borderBottom: '1px solid #065f46',
  padding: '10px 14px',
};

const transferInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0f172a',
  border: '1px solid #065f46',
  borderRadius: '6px',
  color: '#ffffff',
  padding: '6px 8px 6px 22px',
  fontSize: '13px',
  fontWeight: 700,
  outline: 'none',
};

const transferNoteInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#ffffff',
  padding: '6px 10px',
  fontSize: '12px',
  outline: 'none',
};

const btnSendTransferStyle: React.CSSProperties = {
  backgroundColor: '#10b981',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '12px',
  padding: '7px 12px',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const chatBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: '14px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const messageBubbleStyle: React.CSSProperties = {
  maxWidth: '78%',
  padding: '8px 12px',
  borderRadius: '14px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
};

const transferBubbleCardStyle: React.CSSProperties = {
  maxWidth: '82%',
  padding: '10px 14px',
  borderRadius: '12px',
  backgroundColor: '#064e3b',
  border: '1.5px solid #10b981',
};

const footerFormStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  padding: '10px 12px',
  borderTop: '1px solid #334155',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const btnMoneyToggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: '1px solid #334155',
  cursor: 'pointer',
};

const chatInputFieldStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#ffffff',
  padding: '8px 12px',
  fontSize: '13px',
  outline: 'none',
};

const btnSendStyle: React.CSSProperties = {
  backgroundColor: '#10b981',
  color: '#ffffff',
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const blockedNoticeStyle: React.CSSProperties = {
  backgroundColor: '#450a0a',
  borderTop: '1px solid #991b1b',
  padding: '12px',
  color: '#fca5a5',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
};

const btnUnblockInlineStyle: React.CSSProperties = {
  backgroundColor: '#991b1b',
  border: 'none',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '11px',
  padding: '4px 10px',
  borderRadius: '4px',
  cursor: 'pointer',
};
