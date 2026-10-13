import React, { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useAuthStore } from '../stores/authStore';
import { useGoalsStore, claimableCount, type BoardRow } from '../stores/goalsStore';
import { BADGES, DAILY_TASKS, taskBonusFor, type AchievementCounts, type GoalAction } from '../config/goals';
import { getCampusLocationById } from '../config/campusRegistry';
import { formatNaira } from '../config/economy';
import { ModalCloseButton } from './ModalCloseButton';

type Tab = 'today' | 'badges' | 'ranks';

/** Point the map arrow at a campus place and close whatever is open. */
export function walkToPlace(id: string, icon?: string) {
  const loc = getCampusLocationById(id);
  if (!loc) return;
  const game = useGameStore.getState();
  game.setNavigationDestination({ id: loc.id, name: loc.name, shortName: loc.shortName, position: loc.entrance || loc.position, category: loc.category, icon: icon ?? loc.icon });
  game.setActiveModal(null);
}

function runAction(action: GoalAction) {
  const setModal = useGameStore.getState().setActiveModal;
  if (action === 'game_den') return walkToPlace('ps-room', '🎮');
  if (action === 'food_court') return walkToPlace('food-court', '🍲');
  setModal(action);
}

/** Phone → Goals: today's tasks and streak, badges, and this week's leaderboards. */
export function GoalsPanel() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const [tab, setTab] = useState<Tab>('today');
  const unavailable = useGoalsStore((s) => s.unavailable);
  const close = () => setModal(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const tabs: Array<[Tab, string]> = [['today', 'Today'], ['badges', 'Badges'], ['ranks', 'Ranks']];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goals-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900 font-['Plus_Jakarta_Sans'] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-3.5">
          <div>
            <h2 id="goals-title" className="font-['Outfit'] text-base font-bold">Goals</h2>
            <p className="text-[11px] text-slate-400">Daily tasks, badges and this week's top students.</p>
          </div>
          <ModalCloseButton onClose={close} />
        </div>
        <div className="flex gap-1.5 border-b border-slate-700/70 px-4 py-2.5" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${tab === id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto p-4">
          {unavailable ? (
            <div className="px-2 py-10 text-center">
              <div className="text-3xl" aria-hidden="true">🛠️</div>
              <div className="mt-2 font-['Outfit'] text-sm font-bold">Coming soon</div>
              <p className="mt-1 text-xs text-slate-400">Goals are being switched on. Check back shortly.</p>
            </div>
          ) : tab === 'today' ? <TodayTab /> : tab === 'badges' ? <BadgesTab /> : <RanksTab />}
        </div>
      </div>
    </div>
  );
}

function TodayTab() {
  const { tasks, claiming, error, loadTasks, claim } = useGoalsStore();
  const offCampus = useHostelStore((s) => s.roomId !== 'world:funaab:main');
  useEffect(() => { void loadTasks(); }, []);
  if (!tasks) return <Loading />;

  const allClaimed = tasks.tasks.every((t) => t.claimed);
  const nextStreak = tasks.bonus.claimed ? tasks.streak : tasks.streak + 1;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
        <span className="text-2xl" aria-hidden="true">🔥</span>
        <div className="flex-1">
          <div className="font-['Outfit'] text-sm font-bold">{tasks.streak > 0 ? `${tasks.streak}-day streak` : 'Start a streak today'}</div>
          <div className="text-[11px] text-amber-200/80">
            Finish all three every day. The bonus grows: {formatNaira(taskBonusFor(1))} on day 1, up to {formatNaira(taskBonusFor(7))} from day 7.
          </div>
        </div>
      </div>

      {tasks.tasks.map((t) => {
        const meta = DAILY_TASKS[t.id];
        const done = t.progress >= t.target;
        const place = meta?.action === 'game_den' || meta?.action === 'food_court';
        return (
          <div key={t.id} className={`rounded-xl border p-3 ${t.claimed ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-700/70 bg-slate-800/60'}`}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-lg" aria-hidden="true">{meta?.icon ?? '⭐'}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{t.title}</div>
                <div className="text-[11px] text-slate-400">{t.claimed ? 'Done and paid' : meta?.hint}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-300">+{formatNaira(t.reward)}</div>
                <div className="text-[11px] text-slate-400">{t.progress}/{t.target}</div>
              </div>
            </div>
            {!t.claimed && (
              done ? (
                <button type="button" disabled={!!claiming} onClick={() => claim(t.id)} className="mt-2.5 w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold hover:bg-emerald-500 disabled:opacity-60">
                  {claiming === t.id ? 'Claiming…' : `Claim ${formatNaira(t.reward)}`}
                </button>
              ) : meta && (
                <button type="button" disabled={place && offCampus} onClick={() => runAction(meta.action)} className="mt-2.5 w-full rounded-lg bg-slate-700 py-2 text-xs font-bold hover:bg-slate-600 disabled:text-slate-400">
                  {place && offCampus ? 'Go back to campus first' : place ? 'Take me there' : 'Go'}
                </button>
              )
            )}
          </div>
        );
      })}

      <div className={`rounded-xl border p-3 ${tasks.bonus.claimed ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-400/30 bg-slate-800/60'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🏆</span>
          <div className="flex-1">
            <div className="text-sm font-bold">All three done</div>
            <div className="text-[11px] text-slate-400">{tasks.bonus.claimed ? `Day ${tasks.streak} bonus paid` : `Day ${nextStreak} bonus`}</div>
          </div>
          <div className="text-xs font-bold text-amber-300">+{formatNaira(tasks.bonus.reward)}</div>
        </div>
        {!tasks.bonus.claimed && (
          <button type="button" disabled={!allClaimed || !!claiming} onClick={() => claim('bonus')} className="mt-2.5 w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-slate-900 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400">
            {claiming === 'bonus' ? 'Claiming…' : allClaimed ? `Claim bonus ${formatNaira(tasks.bonus.reward)}` : 'Claim all three tasks first'}
          </button>
        )}
      </div>
      {error && <p className="text-center text-xs text-rose-300">{error}</p>}
      <p className="text-center text-[11px] text-slate-500">New tasks every day at midnight (Lagos time).</p>
    </div>
  );
}

function BadgesTab() {
  const user = useAuthStore((s) => s.user)!;
  return <BadgeShelf userId={user.id} detailed />;
}

/** A student's badges. Used in Goals and on profiles. */
export function BadgeShelf({ userId, detailed = false }: { userId: string; detailed?: boolean }) {
  const counts = useGoalsStore((s) => s.badges[userId]);
  const unavailable = useGoalsStore((s) => s.unavailable);
  const [loaded, setLoaded] = useState(!!counts);
  useEffect(() => { void useGoalsStore.getState().loadBadges(userId).finally(() => setLoaded(true)); }, [userId]);
  if (unavailable) return null;
  if (!counts) return loaded ? null : <Loading />;

  const earned = BADGES.filter((b) => (counts[b.metric] ?? 0) >= b.target);
  if (!detailed) {
    return (
      <div className="badge-shelf">
        <div className="badge-shelf-title">Badges · {earned.length}/{BADGES.length}</div>
        {earned.length ? (
          <div className="badge-shelf-row">
            {earned.map((b) => <span key={b.id} className="badge-shelf-chip" title={`${b.title}: ${b.description}`}>{b.icon} {b.title}</span>)}
          </div>
        ) : <p className="badge-shelf-empty">No badges yet.</p>}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {BADGES.map((b) => <BadgeCard key={b.id} badge={b} counts={counts} />)}
    </div>
  );
}

function BadgeCard({ badge, counts }: { badge: (typeof BADGES)[number]; counts: AchievementCounts }) {
  const have = Math.min(counts[badge.metric] ?? 0, badge.target);
  const earned = have >= badge.target;
  return (
    <div className={`rounded-xl border p-3 text-center ${earned ? 'border-amber-400/50 bg-amber-500/10' : 'border-slate-700/70 bg-slate-800/50'}`}>
      <div className={`text-3xl ${earned ? '' : 'opacity-35 grayscale'}`} aria-hidden="true">{badge.icon}</div>
      <div className="mt-1 text-xs font-bold leading-tight">{badge.title}</div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-slate-400">{badge.description}</div>
      {earned ? (
        <div className="mt-1.5 text-[11px] font-bold text-amber-300">Earned</div>
      ) : (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(have / badge.target) * 100}%` }} />
          </div>
          <div className="mt-1 text-[10.5px] text-slate-400">{have}/{badge.target}</div>
        </div>
      )}
    </div>
  );
}

function RanksTab() {
  const { boards, loadBoards } = useGoalsStore();
  useEffect(() => { void loadBoards(); }, []);
  if (!boards) return <Loading />;
  return (
    <div className="space-y-4">
      <p className="text-center text-[11px] text-slate-400">This week, from Monday. Resets every Monday at midnight (Lagos time).</p>
      <Board
        title="💰 Top earners"
        note="Jobs, lectures, allowance, Game Den and tasks. Transfers and bets don't count."
        rows={boards.earners}
        format={formatNaira}
        footer={boards.me.rank ? `You: #${boards.me.rank} with ${formatNaira(boards.me.earned)}` : 'Earn something this week to get on the board.'}
      />
      <Board title="🎮 Most Game Den wins" rows={boards.den_wins} format={(n) => `${n} win${n === 1 ? '' : 's'}`} />
      <Board
        title="🎓 Best-attended college"
        rows={boards.colleges}
        format={(n) => `${n} class${n === 1 ? '' : 'es'}`}
        label={(r) => r.college}
        sub={(r) => `${r.students} student${r.students === 1 ? '' : 's'}`}
      />
    </div>
  );
}

function Board({ title, note, rows, format, footer, label, sub }: {
  title: string; note?: string; rows: BoardRow[]; format: (n: number) => string; footer?: string;
  label?: (r: BoardRow) => string; sub?: (r: BoardRow) => string;
}) {
  return (
    <section>
      <h3 className="font-['Outfit'] text-sm font-bold">{title}</h3>
      {note && <p className="text-[11px] text-slate-400">{note}</p>}
      <ol className="mt-2 overflow-hidden rounded-xl border border-slate-700/70">
        {rows.length === 0 && <li className="bg-slate-800/50 px-3 py-3 text-center text-xs text-slate-400">Nobody yet this week. Be the first!</li>}
        {rows.map((r, i) => (
          <li key={(r.username ?? r.college) + i} className={`flex items-center gap-2.5 px-3 py-2 text-xs ${r.me ? 'bg-emerald-600/25' : i % 2 ? 'bg-slate-800/30' : 'bg-slate-800/60'}`}>
            <span className={`w-5 text-center font-bold ${i < 3 ? 'text-amber-300' : 'text-slate-400'}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-bold">{label ? label(r) : `@${r.username}`}</span>
              <span className="ml-1.5 text-slate-400">{sub ? sub(r) : r.college}</span>
            </span>
            <span className="font-bold text-emerald-300">{format(r.value)}</span>
          </li>
        ))}
      </ol>
      {footer && <p className="mt-1.5 text-[11px] text-slate-300">{footer}</p>}
    </section>
  );
}

function Loading() {
  return <div className="py-10 text-center text-xs text-slate-400">Loading…</div>;
}

/** Number for the phone's Goals tile. */
export function useGoalsBadge() {
  return useGoalsStore((s) => claimableCount(s.tasks));
}
