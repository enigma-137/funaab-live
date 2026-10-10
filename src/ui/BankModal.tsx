import { openHostel } from './HostelLife';
import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import { useGameStore } from '../stores/gameStore';
import { X, Send, Landmark, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export const BankModal: React.FC = () => {
  const { user } = useAuthStore();
  const { balance, transactions, transferMoney } = useWalletStore();
  const { setActiveModal } = useGameStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'transfer' | 'history'>('overview');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [transferStatus, setTransferStatus] = useState<string | null>(null);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setTransferStatus('Please enter a valid amount');
      return;
    }

    if (!user) return;
    const res = await transferMoney(user.id, user.username, recipient.trim(), numAmount);
    if (res.success) {
      setTransferStatus(`Successfully sent ₦${numAmount.toLocaleString()} to @${recipient}`);
      setRecipient('');
      setAmount('');
    } else {
      setTransferStatus(res.error || 'Transfer failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-blue-500/40 rounded-3xl shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans']">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 border-b border-blue-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <button onClick={() => openHostel('debts')}>Iya Ibeji Debts</button><h2 className="text-base font-bold text-white font-['Outfit']">FUNAAB Microfinance ATM</h2>
              <p className="text-[11px] text-blue-300">Virtual Campus Banking & Cash Ledger</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 pt-3 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            My Account
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'transfer'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Send Money
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'history'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Ledger ({transactions.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Virtual ATM Card Display */}
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 border border-blue-400/30 text-white shadow-xl">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] tracking-widest text-blue-300 uppercase font-mono">
                      FUNAAB STUDENT DEBIT
                    </span>
                    <h3 className="font-['Outfit'] font-black text-2xl tracking-tight text-white mt-1">
                      ₦{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-amber-400/80 border border-amber-300/60 flex items-center justify-center font-bold text-slate-900 text-xs shadow-md">
                    ₦
                  </div>
                </div>

                <div className="flex justify-between items-end text-xs font-mono text-slate-300">
                  <div>
                    <div className="text-[9px] uppercase text-slate-400">Cardholder</div>
                    <div className="font-bold text-white uppercase">@{user?.username}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase text-slate-400">College</div>
                    <div className="font-bold text-emerald-300">{user?.college}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('transfer')}
                  className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Send className="w-4 h-4" /> Transfer Cash
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
                >
                  <History className="w-4 h-4" /> View Ledger
                </button>
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Student Username
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. Tobi, Blessing"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Amount (₦ Naira)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 500"
                  min="1"
                  max={balance}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              {transferStatus && (
                <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-200 text-xs text-center font-medium">
                  {transferStatus}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition transform active:scale-95"
              >
                Send Money
              </button>
            </form>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {transactions.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No transactions recorded yet.</div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          tx.amount >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {tx.amount >= 0 ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{tx.description}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono font-bold ${
                          tx.amount >= 0 ? 'text-emerald-400' : 'text-slate-200'
                        }`}
                      >
                        {tx.amount >= 0 ? `+₦${tx.amount.toLocaleString()}` : `-₦${Math.abs(tx.amount).toLocaleString()}`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Bal: ₦{tx.balanceAfter.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
