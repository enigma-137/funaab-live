import { create } from 'zustand';
import { WalletTransaction, InventoryItem, FoodItem } from '../types/game';
import { supabase, isSupabaseConfigured, localDB } from '../lib/supabase';

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  inventory: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  loadWallet: (userId: string) => Promise<void>;
  deductFare: (userId: string, amount: number, destination: string) => Promise<boolean>;
  purchaseFood: (userId: string, item: FoodItem) => Promise<boolean>;
  transferMoney: (senderId: string, recipientUsername: string, amount: number) => Promise<{ success: boolean; error?: string }>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 5000,
  transactions: [],
  inventory: [],
  isLoading: false,
  error: null,

  loadWallet: async (userId: string) => {
    set({ isLoading: true, error: null });

    if (isSupabaseConfigured) {
      try {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .single();

        const { data: txs } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        const { data: inv } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', userId);

        if (wallet) {
          set({
            balance: Number(wallet.balance),
            transactions: (txs || []).map((t: any) => ({
              id: t.id,
              userId: t.user_id,
              type: t.type,
              amount: Number(t.amount),
              balanceAfter: Number(t.balance_after),
              description: t.description,
              createdAt: t.created_at,
            })),
            inventory: (inv || []).map((i: any) => ({
              id: i.id,
              itemId: i.item_id,
              itemName: i.item_name,
              itemType: i.item_type,
              quantity: i.quantity,
            })),
            isLoading: false,
          });
          return;
        }
      } catch (e) {
        console.warn('Supabase wallet fetch failed, fallback to local:', e);
      }
    }

    // Local DB fallback
    const local = localDB.getWallet(userId);
    set({
      balance: local.balance,
      transactions: local.transactions || [],
      inventory: local.inventory || [],
      isLoading: false,
    });
  },

  deductFare: async (userId: string, amount: number, destination: string) => {
    const currentBalance = get().balance;
    if (currentBalance < amount) return false;

    const newBalance = currentBalance - amount;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      userId,
      type: 'keke_fare',
      amount: -amount,
      balanceAfter: newBalance,
      description: `Keke Napep Fare to ${destination}`,
      createdAt: new Date().toISOString(),
    };

    const newTransactions = [tx, ...get().transactions];
    set({ balance: newBalance, transactions: newTransactions });

    // Save locally
    const local = localDB.getWallet(userId);
    local.balance = newBalance;
    local.transactions = newTransactions;
    localDB.saveWallet(userId, local);

    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('process_wallet_purchase', {
          p_user_id: userId,
          p_type: 'keke_fare',
          p_amount: amount,
          p_description: tx.description,
        });
      } catch (e) {
        console.error('Supabase fare sync error:', e);
      }
    }

    return true;
  },

  purchaseFood: async (userId: string, item: FoodItem) => {
    const currentBalance = get().balance;
    if (currentBalance < item.price) return false;

    const newBalance = currentBalance - item.price;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      userId,
      type: 'food_purchase',
      amount: -item.price,
      balanceAfter: newBalance,
      description: `Bought ${item.name}`,
      createdAt: new Date().toISOString(),
    };

    const currentInventory = [...get().inventory];
    const existingItem = currentInventory.find((i) => i.itemId === item.id);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      currentInventory.push({
        id: `inv-${Date.now()}`,
        itemId: item.id,
        itemName: item.name,
        itemType: item.type,
        quantity: 1,
      });
    }

    const newTransactions = [tx, ...get().transactions];
    set({
      balance: newBalance,
      transactions: newTransactions,
      inventory: currentInventory,
    });

    const local = localDB.getWallet(userId);
    local.balance = newBalance;
    local.transactions = newTransactions;
    local.inventory = currentInventory;
    localDB.saveWallet(userId, local);

    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('process_wallet_purchase', {
          p_user_id: userId,
          p_type: 'food_purchase',
          p_amount: item.price,
          p_description: tx.description,
          p_item_id: item.id,
          p_item_name: item.name,
        });
      } catch (e) {
        console.error('Supabase food purchase sync error:', e);
      }
    }

    return true;
  },

  transferMoney: async (senderId: string, recipientUsername: string, amount: number) => {
    if (amount <= 0) return { success: false, error: 'Invalid transfer amount' };
    const currentBalance = get().balance;
    if (currentBalance < amount) return { success: false, error: 'Insufficient funds' };

    const newBalance = currentBalance - amount;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      userId: senderId,
      type: 'p2p_transfer_out',
      amount: -amount,
      balanceAfter: newBalance,
      description: `Transfer to @${recipientUsername}`,
      createdAt: new Date().toISOString(),
    };

    const newTransactions = [tx, ...get().transactions];
    set({ balance: newBalance, transactions: newTransactions });

    const local = localDB.getWallet(senderId);
    local.balance = newBalance;
    local.transactions = newTransactions;
    localDB.saveWallet(senderId, local);

    return { success: true };
  },
}));
