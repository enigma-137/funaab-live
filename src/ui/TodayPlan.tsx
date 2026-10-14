import React, { useEffect } from 'react';
import { useDailyPlanStore } from '../stores/dailyPlanStore';
import { useWalletStore } from '../stores/walletStore';
import { useGameStore } from '../stores/gameStore';
import { useStudentStore } from '../stores/studentStore';
import { useHostelStore } from '../stores/hostelStore';
import { DAILY_PLAN, goalTarget } from '../config/dailyPlan';
import { lectureHallForCollege, LECTURE_HALLS } from '../config/lectureHalls';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

const BADGE_LABEL: Record<string, string> = { streak_3: '3-day', streak_7: '7-day', streak_30: '30-day' };

/** Today's Plan: three goals a day + a streak. Shown once orientation is done; tap to expand. */
export function TodayPlan() {
  const { plan, claiming, error, load, claim, open, setOpen } = useDailyPlanStore();
  const orientationDone = useStudentStore((s) => !!s.journey?.orientation_completed);
  const modal = useGameStore((s) => s.activeModal);
  const riding = useGameStore((s) => s.isRidingKeke);
  const onCampus = useHostelStore((s) => s.roomId === 'world:funaab:main');
  const balance = useWalletStore((s) => s.balance);
  const college = useAuthStore((s) => s.user?.college);

  /** Point the route arrow at the goal's place (or open the sheet that does it), and close the panel. */
  const go = (goalId: string) => {
    const t = goalTarget(goalId); if (!t) return;
    const g = useGameStore.getState();
    setOpen(false);
    if (t.kind === 'sheet') { g.setActiveModal(t.modal); toast({ icon: '📅', text: t.hint, tone: 'info', ms: 4500 }); return; }
    if (t.kind === 'lecture') {
      const hall = (college && lectureHallForCollege(college)) || LECTURE_HALLS[0];
      g.setNavigationDestination({ id: `plan-${hall.id}`, name: hall.hallName, shortName: hall.collegeCode, position: hall.entrance, icon: '🎓' });
      toast({ icon: '🎓', text: `Follow the arrow to ${hall.hallName}. Classes run 9 AM–5 PM.`, tone: 'info', ms: 4500 });
      return;
    }
    g.setNavigationDestination({ id: `plan-${t.id}`, name: t.name, shortName: t.name, position: t.at, icon: t.icon });
    toast({ icon: t.icon, text: `Follow the arrow to the ${t.name}.`, tone: 'info', ms: 4000 });
  };

  useEffect(() => { void load(); const t = setInterval(() => void load(), 60000); return () => clearInterval(t); }, []);
  // Lectures, food and keke are proven by the ledger, so a wallet change is a good moment to recheck.
  useEffect(() => { const t = setTimeout(() => void load(), 800); return () => clearTimeout(t); }, [balance]);
  useEffect(() => { if (open) void load(); }, [open]);

  if (!plan || !plan.goals.length || !orientationDone || modal || riding || !onCampus) return null;
  const done = plan.goals.filter((g) => g.claimed).length;
  const ready = plan.goals.some((g) => !g.claimed && g.progress >= g.target);
  const streak = plan.streak.current;

  return (
    <aside className="campus-plan" aria-label="Today's Plan">
      <button className="campus-plan-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span aria-hidden>📅</span>
        <b>Today's Plan</b>
        <span className="campus-plan-count">{done}/{plan.goals.length}</span>
        {streak > 0 && <span className="campus-plan-streak" title={`${streak}-day streak`}>🔥{streak}</span>}
        {ready && !open && <span className="campus-plan-ready" aria-label="A goal is ready to claim" />}
        <span className="campus-plan-chevron" aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="campus-plan-body">
          <ul>
            {plan.goals.map((g) => {
              const complete = g.progress >= g.target;
              return (
                <li key={g.id} className={g.claimed ? 'is-claimed' : complete ? 'is-ready' : ''}>
                  <span className="campus-plan-icon" aria-hidden>{g.icon}</span>
                  <span className="campus-plan-title">
                    {g.title}
                    {g.target > 1 && !g.claimed && <small> · {g.progress}/{g.target}</small>}
                  </span>
                  {g.claimed ? (
                    <span className="campus-plan-done" aria-label="Claimed">✓</span>
                  ) : complete ? (
                    <button disabled={claiming === g.id} onClick={() => claim(g.id)}>+₦{g.reward}</button>
                  ) : (
                    <>
                      <span className="campus-plan-reward">₦{g.reward}</span>
                      {goalTarget(g.id) && <button className="campus-plan-go" onClick={() => go(g.id)} aria-label={`Go: ${g.title}`}>Go</button>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="campus-plan-note">
            {done === plan.goals.length
              ? plan.streak.done_today ? `All done for today 🎉 Come back tomorrow to keep your 🔥${streak} streak.` : 'All done!'
              : `Finish all ${plan.goals.length} for +₦${plan.all_done_bonus} and ${streak ? `day ${streak + 1} of your streak` : 'start a streak'}.`}
          </p>
          {plan.streak.badges.length > 0 && (
            <p className="campus-plan-badges">{plan.streak.badges.map((b) => <span key={b}>🏅 {BADGE_LABEL[b] ?? b}</span>)}</p>
          )}
          {streak === 0 && plan.streak.best > 0 && <p className="campus-plan-note">Best streak: {plan.streak.best} days</p>}
          {error && <p className="campus-plan-error" role="alert">{error}</p>}
          <p className="campus-plan-hint">Campus Night: 8–9pm at the Love Garden. Badges at {DAILY_PLAN.STREAK_BADGES.join(', ')} days.</p>
        </div>
      )}
    </aside>
  );
}
