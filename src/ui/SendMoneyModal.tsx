import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import { useGameStore } from '../stores/gameStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { X, Send, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface SendMoneyModalProps {
  recipientUsername?: string;
  recipientCollege?: string;
  onClose?: () => void;
}

export const SendMoneyModal: React.FC<SendMoneyModalProps> = ({
  recipientUsername: propRecipient,
  recipientCollege: propCollege,
  onClose: propClose,
}) => {
  const { user } = useAuthStore();
  const { balance, transferMoney } = useWalletStore();
  const { sendMoneyRecipient, setActiveModal } = useGameStore();

  const recipientUsername =
    propRecipient ||
    (typeof sendMoneyRecipient === 'string'
      ? sendMoneyRecipient
      : sendMoneyRecipient?.username) ||
    'Student';

  const recipientCollege =
    propCollege ||
    (typeof sendMoneyRecipient === 'object' && sendMoneyRecipient?.college) ||
    'FUNAAB';

  const onClose = propClose || (() => setActiveModal(null));

  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const presets = [100, 200, 500, 1000];
  const finalAmount = customAmount ? Math.max(0, parseInt(customAmount, 10) || 0) : selectedAmount;

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setErrorMessage(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setSelectedAmount(0);
    setErrorMessage(null);
  };

  const handleProceedToConfirm = () => {
    if (finalAmount <= 0) {
      setErrorMessage('Please specify an amount to send.');
      return;
    }
    if (finalAmount > balance) {
      setErrorMessage(`Insufficient funds. Your current balance is ₦${balance.toLocaleString()}.`);
      return;
    }
    if (user && recipientUsername.toLowerCase() === user.username.toLowerCase()) {
      setErrorMessage('You cannot send money to yourself.');
      return;
    }
    setErrorMessage(null);
    setIsConfirming(true);
  };

  const handleExecuteTransfer = async () => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMessage(null);

    const res = await transferMoney(user.id, user.username, recipientUsername, finalAmount);
    if (!res.success) {
      setErrorMessage(res.error || 'Transfer failed.');
      setIsProcessing(false);
      setIsConfirming(false);
      return;
    }

    // Send authoritative server transfer event
    networkManager.sendP2PTransfer(user.id, user.username, recipientUsername, finalAmount);

    setIsProcessing(false);
    setSuccessMessage(`You sent @${recipientUsername} ₦${finalAmount.toLocaleString()}!`);

    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-emerald-500/40 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans']">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-emerald-400 font-black text-sm">
              ₦
            </div>
            <div>
              <h2 className="text-sm font-black text-white font-['Outfit'] tracking-wide uppercase">
                Send Game Currency
              </h2>
              <p className="text-[10px] text-slate-400">Student-to-Student Transfer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Recipient Card */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300 text-sm">
                🎓
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold">Recipient:</div>
                <div className="text-sm font-bold text-white font-['Outfit']">@{recipientUsername}</div>
              </div>
            </div>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
              {recipientCollege}
            </span>
          </div>

          {/* Current Balance */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400">Your Current Balance:</span>
            <span className="font-extrabold text-emerald-400 font-mono">
              ₦{balance.toLocaleString()}
            </span>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-950/90 border border-red-500 text-red-200 text-xs font-semibold animate-shake shadow-lg">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 break-words leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-bold animate-pulse text-center justify-center shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="break-words">{successMessage}</span>
            </div>
          )}

          {!successMessage && !isConfirming && (
            <>
              {/* Preset Amounts */}
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Select Amount:
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {presets.map((amt) => {
                    const isSelected = !customAmount && selectedAmount === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handlePresetClick(amt)}
                        className={`py-2 px-1 rounded-xl text-xs font-black font-mono transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-lg border border-emerald-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
                        }`}
                      >
                        ₦{amt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Or Enter Custom Amount:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    ₦
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 750"
                    value={customAmount}
                    onChange={handleCustomChange}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleProceedToConfirm}
                disabled={finalAmount <= 0 || finalAmount > balance}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs font-['Outfit'] tracking-wide shadow-xl transition flex items-center justify-center gap-2"
              >
                <span>Continue (₦{finalAmount.toLocaleString()})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {!successMessage && isConfirming && (
            <div className="space-y-4 text-center py-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400">Transfer Confirmation</div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  ₦{finalAmount.toLocaleString()}
                </div>
                <div className="text-xs text-slate-300">
                  to <strong className="text-white">@{recipientUsername}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  disabled={isProcessing}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTransfer}
                  disabled={isProcessing}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Sending...' : 'Confirm'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
