import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useJobStore } from '../stores/jobStore';
import { X, Briefcase, MapPin, CheckCircle2, Navigation, AlertCircle } from 'lucide-react';

export const CampusJobsModal: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveModal, myPosition } = useGameStore();
  const { availableJobs, activeJob, error, busy, load, acceptJob, cancelJob, pickupDeliveryPackage, completeActiveJob, checkJobProximity } =
    useJobStore();

  const [notification, setNotification] = useState<string | null>(null);

  const proximity = checkJobProximity(myPosition);

  const handleAccept = async (jobId: string) => {
    const success = await acceptJob(jobId);
    if (success) {
      setNotification('Job Accepted! Go to Step 1 (Pickup Point) marked on campus to collect the order.');
      setTimeout(() => {
        setActiveModal(null);
      }, 1500);
    }
  };

  const handlePickupNow = async () => {
    const success = await pickupDeliveryPackage();
    if (success) {
      setNotification('📦 Order collected! Now proceed to Step 2 (Destination) to deliver.');
    }
  };

  const handleDeliverNow = async () => {
    if (!user) return;
    const res = await completeActiveJob(user.id);
    if (res.success) {
      setNotification(`🎉 Job Complete! Received +₦${res.reward.toLocaleString()}${res.bonus ? ` + ₦${res.bonus.toLocaleString()} first job of the day bonus` : ''}!`);
      setTimeout(() => {
        setActiveModal(null);
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border-2 border-emerald-500/40 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans'] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-b border-emerald-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-xl shadow-lg">
              💼
            </div>
            <div>
              <h2 className="text-base font-black text-white font-['Outfit'] tracking-wide uppercase flex items-center gap-2">
                CAMPUS JOB BOARD
                <span className="text-[7px] font-bold px-1 py-0.5 rounded-sm bg-emerald-500 text-black uppercase">
                  Earn Cash
                </span>
              </h2>
              <p className="text-xs text-emerald-200/80">
                Complete student errands, food deliveries, and tasks to earn game currency.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && <p role="alert" className="text-amber-200">{error} <button onClick={load}>Reload saved job</button></p>}
          {busy && <p role="status">Saving job progress…</p>}
          {notification && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-bold animate-bounce">
              <span>{notification}</span>
            </div>
          )}

          {activeJob && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border-2 border-emerald-400 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-black">
                  ACTIVE JOB IN PROGRESS
                </span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  +₦{activeJob.reward} Reward
                </span>
              </div>

              <div>
                <h3 className="font-black text-white text-sm font-['Outfit']">{activeJob.title}</h3>
                <p className="text-xs text-slate-300 mt-0.5">{activeJob.description}</p>
              </div>

              {/* 2-Step Progress Indicator */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                    activeJob.status === 'picked_up'
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-indigo-950/50 border-indigo-500/50 text-indigo-200'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      activeJob.status === 'picked_up' ? 'bg-emerald-500 text-black' : 'bg-indigo-500 text-white'
                    }`}
                  >
                    {activeJob.status === 'picked_up' ? '✓' : '1'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-semibold uppercase text-slate-400">
                      {activeJob.status === 'picked_up' ? 'Collected' : 'Step 1: Pick Up'}
                    </div>
                    <div className="truncate font-bold text-white text-[11px]">{activeJob.source}</div>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                    activeJob.status === 'picked_up'
                      ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      activeJob.status === 'picked_up' ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    2
                  </span>
                  <div className="min-w-0">
                    <div className="text-[9px] font-semibold uppercase text-slate-400">Step 2: Deliver</div>
                    <div className="truncate font-bold text-white text-[11px]">{activeJob.destination}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Current Target:{' '}
                    <strong className="text-white">
                      {activeJob.status === 'accepted'
                        ? `Pick up at ${activeJob.source}`
                        : `Deliver to ${activeJob.destination}`}
                    </strong>
                  </span>
                </div>
                <span className="text-emerald-400 font-bold font-mono text-[11px] shrink-0">
                  {proximity.distance < 999 ? `${proximity.distance}m away` : 'Track on Map'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {proximity.canPickup && (
                  <button
                    onClick={handlePickupNow}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition flex items-center gap-1.5 animate-pulse"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Pick Up Order
                  </button>
                )}
                {proximity.canDeliver && (
                  <button
                    onClick={handleDeliverNow}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition flex items-center gap-1.5 animate-pulse"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Complete & Deliver (+₦{activeJob.reward})
                  </button>
                )}
                <button
                  onClick={cancelJob}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 text-xs font-semibold transition"
                >
                  Cancel Job
                </button>
              </div>
            </div>
          )}

          {/* Job List */}
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Available Campus Opportunities:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableJobs.map((job) => {
              const isThisJobActive = activeJob?.id === job.id;

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between ${isThisJobActive
                    ? 'bg-emerald-950/30 border-emerald-400 shadow-md ring-1 ring-emerald-400/50'
                    : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/60'
                    }`}
                >
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-white text-xs font-['Outfit']">{job.title}</h4>
                      <span className="font-black font-mono text-xs px-2 py-0.5 rounded-md bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 shrink-0">
                        +₦{job.reward}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 line-clamp-2">{job.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px]">
                    <div className="text-slate-400">
                      <span>{job.source}</span> → <span className="text-slate-300">{job.destination}</span>
                    </div>

                    {!activeJob && (
                      <button
                        onClick={() => handleAccept(job.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition transform active:scale-95 shadow-md flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Accept</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
