import React, { useEffect } from 'react';
import { useGameStore, type NavigationDestination } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { ECONOMY_CONFIG, formatNaira } from '../config/economy';
import { CAMPUS_JOBS } from '../config/campusJobs';
import { CAMPUS_BET_SHOP, CAMPUS_BET_STAKE } from '../config/campusBet';
import { getCampusLocationById } from '../config/campusRegistry';
import { ModalCloseButton } from './ModalCloseButton';
import { DAILY_GOALS, DAILY_PLAN } from '../config/dailyPlan';
import { HUSTLE_RULES } from '../config/hustles';
import { useDailyPlanStore } from '../stores/dailyPlanStore';
import { INVITES } from '../config/invites';

type Way = {
  id: string;
  icon: string;
  title: string;
  pays: string;
  how: string;
  note?: string;
  action: string;
  go: () => void;
  /** Needs the main campus (walking somewhere). */
  place?: boolean;
};

/** Phone → Earn: every way to make naira, each with a "take me there" button. */
export function EarnPanel() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const navigate = useGameStore((s) => s.setNavigationDestination);
  const offCampus = useHostelStore((s) => s.roomId !== 'world:funaab:main');
  const close = () => setModal(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const walkTo = (dest: NavigationDestination) => { navigate(dest); close(); };
  const E = ECONOMY_CONFIG;
  const G = E.GAME_DEN;
  const jobPay = CAMPUS_JOBS.map((j) => j.reward);
  const den = getCampusLocationById('ps-room');

  const ways: Way[] = [
    {
      id: 'daily', icon: '🎁', title: 'Daily allowance',
      pays: `${formatNaira(E.DAILY_RESUMPTION_ALLOWANCE)} every day`,
      how: 'Free money once a day. Just come back tomorrow for more.',
      action: 'Claim it', go: () => setModal('daily_reward'),
    },
    {
      id: 'invite', icon: '🤝', title: 'Invite friends',
      pays: `${formatNaira(INVITES.JOIN_REWARD)} per friend + ${formatNaira(INVITES.LEVEL_REWARD)} at Level ${INVITES.UNLOCK_LEVEL}`,
      how: `Share your invite link. You get paid as soon as a friend signs up with it, and again when they reach Level ${INVITES.UNLOCK_LEVEL}.`,
      action: 'Get my link', go: () => setModal('invite'),
    },
    {
      id: 'tasks', icon: '🔥', title: "Today's Plan",
      pays: `${formatNaira(DAILY_PLAN.GOALS_PER_DAY * DAILY_GOALS[0].reward)} a day + ${formatNaira(DAILY_PLAN.ALL_DONE_BONUS)} when all are done`,
      how: 'Three small goals every day. Finish them all to keep your streak going.',
      action: "See today's plan", go: () => { close(); useDailyPlanStore.getState().setOpen(true); },
    },
    {
      id: 'hustles', icon: '🛒', title: 'Hustles',
      pays: `Up to ${formatNaira(HUSTLE_RULES.DAILY_CAP)} a day`,
      how: 'Room shop, POS kiosk shifts, Library tutoring, photo shoots and errands for other students.',
      action: 'Open Hustles', go: () => setModal('hustles'),
    },
    {
      id: 'jobs', icon: '💼', title: 'Campus jobs',
      pays: `${formatNaira(Math.min(...jobPay))} to ${formatNaira(Math.max(...jobPay))} a job`,
      how: 'Deliveries and errands: pick something up, carry it across campus, get paid.',
      action: 'Open Jobs', go: () => setModal('campus_jobs'),
    },
    {
      id: 'lectures', icon: '🎓', title: 'Attend lectures',
      pays: `${formatNaira(E.ATTENDANCE_ALLOWANCE)} a class, up to ${E.ATTENDANCE_DAILY_LIMIT} a day`,
      how: 'Walk into a live class at a lecture hall and sit through it.',
      action: 'See timetable', go: () => setModal('lecture_hall'),
    },
    {
      id: 'game-den', icon: '🎮', title: 'Game Den penalties',
      pays: `${formatNaira(G.WINNER)} win · ${formatNaira(G.DRAW)} draw · ${formatNaira(G.LOSER)} loss`,
      how: `Challenge another student to a penalty shootout. Paid for your first ${G.DAILY_REWARDED_MATCHES} matches each day.`,
      action: 'Take me there', place: true,
      go: () => den && walkTo({ id: den.id, name: den.name, shortName: den.shortName, position: den.entrance || den.position, category: den.category, icon: '🎮' }),
    },
    {
      id: 'bet', icon: '⚽', title: 'Campus Bet',
      pays: `Stake ${formatNaira(CAMPUS_BET_STAKE.min)} to ${formatNaira(CAMPUS_BET_STAKE.max)}, win up to 4×`,
      how: 'Predict 5 football results. Just outside the main gate.',
      note: 'Risky: you can lose your stake.',
      action: 'Take me there', place: true,
      go: () => walkTo({ id: CAMPUS_BET_SHOP.id, name: 'Campus Bet shop', shortName: 'Campus Bet', position: CAMPUS_BET_SHOP.counter, category: 'service', icon: '⚽' }),
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="earn-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900 font-['Plus_Jakarta_Sans'] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-3.5">
          <div>
            <h2 id="earn-title" className="font-['Outfit'] text-base font-bold">Earn money</h2>
            <p className="text-[11px] text-slate-400">Every way to make naira on campus.</p>
          </div>
          <ModalCloseButton onClose={close} />
        </div>
        <ul className="space-y-2.5 overflow-y-auto p-4">
          {ways.map((w) => {
            const blocked = w.place && offCampus;
            return (
              <li key={w.id} className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-xl" aria-hidden="true">{w.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-['Outfit'] text-sm font-bold">{w.title}</div>
                    <div className="text-xs font-bold text-emerald-300">{w.pays}</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">{w.how}</p>
                    {w.note && <p className="mt-1 text-[11px] font-semibold text-amber-300">{w.note}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={w.go}
                  className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold transition hover:bg-emerald-500 active:scale-[.98] disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {blocked ? 'Go back to campus first' : w.action}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
