import React from 'react';
import { Sheet } from './Sheet';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useGameStore } from '../stores/gameStore';
import { X, Users, UserMinus, Send, MessageSquare } from 'lucide-react';

export const FriendsModal: React.FC = () => {
  const { user } = useAuthStore();
  const { friends, removeFriend } = useSocialStore();
  const { players, setActiveModal, setSendMoneyRecipient } = useGameStore();

  return (
    <Sheet title={'Campus Friends'} subtitle={`${friends.length} students connected`} icon={<Users className="w-4 h-4" />} accent="#059669" onClose={() => setActiveModal(null)}>

        {/* Friends List */}
        <div className="p-6 space-y-2.5">
          {friends.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 space-y-2">
              <div className="text-3xl">👋</div>
              <div>No friends added yet.</div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Walk up to any student on campus, click them or press [E] to add them as a friend!
              </p>
            </div>
          ) : (
            friends.map((friend) => {
              const onlinePlayer = Object.values(players).find(
                (p) => p.username.toLowerCase() === friend.username.toLowerCase()
              );
              const isOnline = !!onlinePlayer;
              const currentZone = onlinePlayer?.currentZone || 'Campus Grounds';

              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300 text-sm font-['Outfit']">
                        {friend.username[0]?.toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                          isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        @{friend.username}
                      </div>
                      <div className="text-[11px] flex items-center gap-1.5 mt-0.5">
                        {isOnline ? (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            Online — <span className="text-slate-300">{currentZone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                            Offline
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        useSocialStore.getState().openDm({
                          id: friend.id,
                          username: friend.username,
                          college: friend.college || 'CAMPUS',
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold border border-indigo-500/30 flex items-center gap-1 transition"
                      title="Direct Message"
                    >
                      <MessageSquare className="w-3 h-3" />
                      DM
                    </button>
                    <button
                      onClick={() => {
                        setSendMoneyRecipient(friend.username);
                        setActiveModal('send_money');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5 transition"
                      title="Send Money"
                    >
                      <Send className="w-3 h-3" />
                      Send ₦
                    </button>
                    <button
                      onClick={() => {
                        if (user) removeFriend(user.id, friend.id);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-400 text-xs transition"
                      title="Remove Friend"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
    </Sheet>
  );
};
