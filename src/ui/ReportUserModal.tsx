import React, { useState } from 'react';
import { useSocialStore } from '../stores/socialStore';
import { useAuthStore } from '../stores/authStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { ShieldAlert, X, CheckCircle2 } from 'lucide-react';

const REPORT_REASONS = [
  'Harassment or Cyberbullying',
  'Spam or Unsolicited Commercial Messaging',
  'Financial Fraud / Scam Attempt',
  'Inappropriate or Offensive Behavior',
  'Impersonation or False Identity',
  'Lawn Rule / Security Griefing',
];

export const ReportUserModal: React.FC = () => {
  const { user } = useAuthStore();
  const { activeReportUser, closeReportModal, reportUser, blockUser } = useSocialStore();

  const [selectedReason, setSelectedReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  if (!activeReportUser || !user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Record local and remote safety report
    reportUser(user.id, activeReportUser.id, selectedReason, details);
    networkManager.sendUserReport(
      activeReportUser.id,
      activeReportUser.username,
      selectedReason,
      details
    );

    // 2. Optionally block the user immediately
    if (alsoBlock) {
      blockUser(user.id, activeReportUser.id);
    }

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      closeReportModal();
    }, 1800);
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert style={{ width: '20px', height: '20px', color: '#f87171' }} />
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#f87171', letterSpacing: '1px', textTransform: 'uppercase' }}>
                Campus Safety & Moderation
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                Report @{activeReportUser.username}
              </h2>
            </div>
          </div>
          <button onClick={closeReportModal} style={btnCloseCircleStyle}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <CheckCircle2 style={{ width: '48px', height: '48px', color: '#34d399', margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#34d399' }}>
                Report Submitted Successfully
              </h3>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                Thank you for keeping FUNAAB Life safe. Our moderation system has logged this incident.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '10px', fontWeight: 600 }}>
                Please select the reason for reporting this student:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <label
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      style={{
                        ...reasonCardStyle,
                        borderColor: isSelected ? '#f87171' : '#334155',
                        backgroundColor: isSelected ? '#450a0a' : '#0f172a',
                      }}
                    >
                      <input
                        type="radio"
                        name="report_reason"
                        checked={isSelected}
                        onChange={() => setSelectedReason(reason)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '13px', color: isSelected ? '#ffffff' : '#cbd5e1', fontWeight: isSelected ? 700 : 500 }}>
                        {reason}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                  Additional Details (Optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide brief context if applicable..."
                  maxLength={300}
                  rows={3}
                  style={textareaStyle}
                />
              </div>

              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={alsoBlock}
                  onChange={(e) => setAlsoBlock(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '12.5px', color: '#fca5a5', fontWeight: 600 }}>
                  Also block @{activeReportUser.username} immediately (mutes private DMs & requests)
                </span>
              </label>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" style={btnSubmitReportStyle}>
                  Submit Report
                </button>
                <button type="button" onClick={closeReportModal} style={btnCancelReportStyle}>
                  Cancel
                </button>
              </div>
            </form>
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
  zIndex: 10000,
  backdropFilter: 'blur(6px)',
  animation: 'fadeIn 0.2s ease-out',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  border: '1.5px solid #475569',
  borderRadius: '16px',
  width: '92%',
  maxWidth: '480px',
  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
  overflow: 'hidden',
  color: '#e2e8f0',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  padding: '14px 18px',
  borderBottom: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const btnCloseCircleStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '4px',
};

const reasonCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #334155',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#ffffff',
  padding: '8px 10px',
  fontSize: '12px',
  outline: 'none',
  resize: 'none',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
};

const btnSubmitReportStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#dc2626',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '13.5px',
  padding: '10px 16px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

const btnCancelReportStyle: React.CSSProperties = {
  padding: '10px 16px',
  backgroundColor: '#334155',
  color: '#cbd5e1',
  fontWeight: 700,
  fontSize: '13.5px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};
