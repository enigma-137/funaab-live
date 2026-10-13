import { useHostelStore } from '../stores/hostelStore';
import { Sheet } from './Sheet';
import { openHostel } from './HostelLife';
import React, { useState } from 'react';
import { PublicStudentIdentity } from './PublicStudentIdentity';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useSocialStore } from '../stores/socialStore';
import { BadgeShelf } from './GoalsPanel';
import { X, UserPlus, VolumeX, ShieldAlert, Flag, MessageSquare, Check } from 'lucide-react';

export const PlayerInteractionModal: React.FC = () => {
  const { user } = useAuthStore();
  const { selectedPlayer, setSelectedPlayer, setActiveModal } = useGameStore();
  const {
    friends,
    mutedUserIds,
    blockedUserIds,
    addFriend,
    muteUser,
    unmuteUser,
    blockUser,
    unblockUser,
    reportUser,
  } = useSocialStore();

  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('Spam / Harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [friendSent, setFriendSent] = useState(false);

  if (!selectedPlayer || !user) return null;

  const isAlreadyFriend = friends.some((f) => f.id === selectedPlayer.id);
  const isMuted = mutedUserIds.includes(selectedPlayer.id);
  const isBlocked = blockedUserIds.includes(selectedPlayer.id);

  const handleAddFriend = () => {
    addFriend(user.id, {
      id: selectedPlayer.id,
      username: selectedPlayer.username,
      college: selectedPlayer.college,
    });
    setFriendSent(true);
    setTimeout(() => setFriendSent(false), 3000);
  };

  const handleToggleMute = () => {
    if (isMuted) unmuteUser(user.id, selectedPlayer.id);
    else muteUser(user.id, selectedPlayer.id);
  };

  const handleToggleBlock = () => {
    if (isBlocked) unblockUser(user.id, selectedPlayer.id);
    else {
      blockUser(user.id, selectedPlayer.id);
      setActiveModal(null);
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reportUser(user.id, selectedPlayer.id, reportReason, reportDetails);
    setReportSent(true);
    setTimeout(() => {
      setIsReporting(false);
      setReportSent(false);
      setActiveModal(null);
    }, 2000);
  };

  return (
    <Sheet title={'Student Profile'} icon={'🎓'} accent="#059669" onClose={() => { setSelectedPlayer(null); setActiveModal(null); }}>

        {/* Profile Details */}
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/30 border-2 border-emerald-500 mx-auto flex items-center justify-center text-2xl shadow-xl mb-3">
            🎓
          </div>
          <h3 className="text-xl font-bold text-white font-['Outfit']">@{selectedPlayer.username}</h3>
          <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-xs font-semibold border border-slate-700">
            {selectedPlayer.college}
          </div>

          {!isReporting && <PublicStudentIdentity player={selectedPlayer} />}
          {!isReporting && <div className="mt-3 text-left"><BadgeShelf userId={selectedPlayer.id} /></div>}
          {!isReporting ? (
            /* Action Buttons */
            <div className="mt-6 space-y-2.5">
              <button
                id="btn-dm-student"
                onClick={() => {
                  useSocialStore.getState().openDm({
                    id: selectedPlayer.id,
                    username: selectedPlayer.username,
                    college: selectedPlayer.college,
                  });
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition"
              >
                <MessageSquare className="w-4 h-4" /> 💬 Message Privately (DM)
              </button>

              <button
                onClick={() => {
                  useGameStore.getState().setSendMoneyRecipient(selectedPlayer.username);
                  useGameStore.getState().setActiveModal('send_money');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition"
              >
                <span>💸</span> Send Money
              </button>

              <button
                onClick={handleAddFriend}
                disabled={isAlreadyFriend}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                  isAlreadyFriend
                    ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-default'
                    : 'bg-slate-800 hover:bg-slate-750 text-white border border-slate-700'
                }`}
              >
                {isAlreadyFriend ? <Check className="w-4 h-4 text-emerald-400" /> : <UserPlus className="w-4 h-4" />}
                {isAlreadyFriend ? 'Already Friends' : friendSent ? 'Friend Added!' : 'Add Friend'}
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleToggleMute}
                  className={`py-2 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition ${
                    isMuted
                      ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>

                <button
                  onClick={handleToggleBlock}
                  className={`py-2 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition ${
                    isBlocked
                      ? 'bg-red-950/60 border-red-500 text-red-300'
                      : 'bg-slate-800 border-slate-700 text-red-300 hover:bg-slate-750'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {isBlocked ? 'Unblock' : 'Block'}
                </button>
              </div>

              {isAlreadyFriend && <button className="w-full py-3 text-emerald-300" onClick={async () => { openHostel('invites'); await useHostelStore.getState().command('invite',{guest:selectedPlayer.id}); }}>Invite to Hostel</button>}
              <button
                onClick={() => setIsReporting(true)}
                className="w-full py-2 text-center text-xs text-slate-500 hover:text-red-400 font-semibold transition flex items-center justify-center gap-1 mt-1"
              >
                <Flag className="w-3.5 h-3.5" /> Report User
              </button>
            </div>
          ) : (
            /* Report Form */
            <form onSubmit={handleReportSubmit} className="mt-4 text-left space-y-3">
              <div className="text-xs font-bold text-slate-300">Report @{selectedPlayer.username}</div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                >
                  <option value="Spam / Harassment">Spam / Harassment</option>
                  <option value="Inappropriate Username">Inappropriate Username</option>
                  <option value="Disruptive Behaviour">Disruptive Behaviour</option>
                  <option value="Cheating / Glitching">Cheating / Glitching</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Details (Optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Explain what happened..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              {reportSent && (
                <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs text-center">
                  Report submitted to Campus Security!
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsReporting(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  Submit
                </button>
              </div>
            </form>
          )}
        </div>
    </Sheet>
  );
};
