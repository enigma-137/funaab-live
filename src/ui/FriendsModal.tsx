import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useGameStore } from '../stores/gameStore';
import { X, Users, UserMinus, MessageSquare } from 'lucide-react';

export const FriendsModal: React.FC = () => {
  const { user } = useAuthStore();
  const { friends, removeFriend } = useSocialStore();
  const { setActiveModal } = useGameStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans']">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Outfit']">Campus Friends</h2>
              <p className="text-[11px] text-slate-400">{friends.length} Students Connected</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Friends List */}
        <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
          {friends.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 space-y-2">
              <div className="text-3xl">👋</div>
              <div>No friends added yet.</div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Walk up to any student on campus, click them or press [E] to add them as a friend!
              </p>
            </div>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 border border-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300 text-xs">
                    {friend.username[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">@{friend.username}</div>
                    <div className="text-[10px] font-bold text-emerald-400">{friend.college}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (user) removeFriend(user.id, friend.id);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-400 text-xs transition"
                    title="Remove Friend"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
