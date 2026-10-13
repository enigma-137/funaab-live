import {openHostel} from './HostelLife';
import { Sheet } from './Sheet';
import {hostelItem} from '../config/hostelItems';
import React from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useGameStore } from '../stores/gameStore';
import { X, Backpack } from 'lucide-react';

export const InventoryModal: React.FC = () => {
  const { inventory } = useWalletStore();
  const { setActiveModal } = useGameStore();

  return (
    <Sheet title={'Student Backpack'} subtitle={'Inventory & consumables'} icon={<Backpack className="w-4 h-4" />} accent="#d97706" onClose={() => setActiveModal(null)}>

        {/* Inventory Items Grid */}
        <div className="p-6">
          {inventory.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 space-y-2">
              <div className="text-3xl">🎒</div>
              <div>Your backpack is empty.</div>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Visit Mama Cass Buka or other campus vendors to buy refreshments and snacks!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">
                      {item.itemType === 'wearable' ? '🪪' : item.itemType === 'drink' ? '🥤' : '🍱'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 font-mono">
                      x{item.quantity}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">{item.itemName}</h4>{hostelItem(item.itemId)&&<button className="mt-2 min-h-11 rounded-lg bg-emerald-700 px-3 text-xs text-white" onClick={()=>openHostel('decorate')}>Room items</button>}
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {item.itemType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </Sheet>
  );
};
