import React, { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useInviteStore } from '../stores/inviteStore';
import { useSocialStore } from '../stores/socialStore';
import { INVITES, inviteLink } from '../config/invites';
import { formatNaira } from '../config/economy';

/** Phone → Invite: your personal link, and how the friends you brought are doing. */
export function InviteSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const user = useAuthStore((s) => s.user);
  const { state, load } = useInviteStore();
  const { friends, addFriend } = useSocialStore();
  const [copied, setCopied] = useState(false);
  useEffect(() => { void load(); }, [load]);

  const link = state ? inviteLink(state.code) : '';
  const reward = formatNaira(INVITES.REWARD);
  const message = `Come and join me on FUNAAB Life, our campus in 3D! Sign up with my link: ${link}`;
  const paidCount = state?.friends.filter((f) => f.paid).length ?? 0;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('Copy your invite link', link); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'FUNAAB Life', text: message }); return; } catch { return; } // cancelled
    }
    void copy();
  };

  return (
    <Sheet title="Invite friends" subtitle={`Get ${reward} for every friend you bring`} icon="🤝" accent="#16a34a" onClose={() => setModal(null)}>
      {!state ? <p className="p-6 text-xs text-slate-400">Loading your invite link…</p> : (
        <div className="space-y-4 p-5 text-white">
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4">
            <ol className="space-y-1.5 text-xs leading-relaxed text-slate-200">
              <li>1. Send your link to a friend who isn't on FUNAAB Life yet.</li>
              <li>2. They sign up with it — you become friends straight away.</li>
              <li>3. When they reach <b>Level {INVITES.UNLOCK_LEVEL}</b> by playing, you get <b className="text-emerald-300">{reward}</b>.</li>
            </ol>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-emerald-200">{link}</span>
              <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold hover:bg-slate-700">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-[#25D366] py-2 text-center text-xs font-bold text-[#06301a] hover:brightness-110"
              >
                Send on WhatsApp
              </a>
              <button type="button" onClick={share} className="rounded-lg bg-emerald-600 py-2 text-xs font-bold hover:bg-emerald-500">
                Share link
              </button>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-3">
              <div className="font-['Outfit'] text-lg font-bold">{state.friends.length}</div>
              <div className="text-[11px] text-slate-400">joined with your link</div>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-3">
              <div className="font-['Outfit'] text-lg font-bold text-emerald-300">{formatNaira(state.earned)}</div>
              <div className="text-[11px] text-slate-400">earned · {paidCount}/{INVITES.MAX_PAID} paid</div>
            </div>
          </section>

          {state.friends.length > 0 && (
            <ul className="space-y-2">
              {state.friends.map((f) => {
                const isFriend = friends.some((x) => x.id === f.id);
                return (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">@{f.username} <span className="text-[11px] font-normal text-slate-500">{f.college}</span></div>
                      <div className={`text-[11px] ${f.paid ? 'text-emerald-300' : 'text-slate-400'}`}>
                        {f.paid ? `Level ${f.level} · you got ${reward}` : `Level ${f.level} · ${reward} when they reach Level ${INVITES.UNLOCK_LEVEL}`}
                      </div>
                    </div>
                    {!isFriend && user && (
                      <button type="button" onClick={() => addFriend(user.id, f)} className="shrink-0 rounded-lg bg-emerald-600/20 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600 hover:text-white">
                        Add friend
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] leading-relaxed text-slate-500">
            Only new students can use an invite link, within {INVITES.REDEEM_DAYS} days of signing up. Up to {INVITES.MAX_PAID} paid invites each.
          </p>
        </div>
      )}
    </Sheet>
  );
}
