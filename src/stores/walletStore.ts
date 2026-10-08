import { create } from 'zustand';
import { WalletTransaction, InventoryItem, FoodItem } from '../types/game';
import { supabase, isSupabaseConfigured, localDB } from '../lib/supabase';

interface WalletState {
  balance: number;
  transactions: WalletTransaction[];
  inventory: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  lastDailyRewardDate: string | null;
  loadWallet: (userId: string) => Promise<void>;
  deductFare: (userId: string, amount: number, destination: string) => Promise<boolean>;
  applyLawnFine: (userId: string, amount?: number) => Promise<{ success: boolean; deducted: number }>;
  purchaseFood: (userId: string, item: FoodItem) => Promise<{ success: boolean; balance?: number; error?: string }>;
  grantJobReward: (userId: string, amount: number, jobTitle: string) => Promise<boolean>;
  claimDailyReward: (userId: string) => Promise<{ success: boolean; amount: number; message: string }>;
  receiveTransfer: (senderUsername: string, amount: number) => void;
  transferMoney: (senderId: string, senderUsername: string, recipientUsername: string, amount: number) => Promise<{ success: boolean; error?: string }>;
}

export const useWalletStore = create<WalletState>()((set, get) => ({
  balance: 5000,
  transactions: [],
  inventory: [],
  isLoading: false,
  error: null,
  lastDailyRewardDate: typeof window !== 'undefined' ? localStorage.getItem('funaab_last_daily_reward') : null,

  loadWallet: async (userId: string) => {
    set({ isLoading: true, error: null });

    if (isSupabaseConfigured) {
      try {
        // Ensure wallet exists in Postgres via idempotent bootstrap RPC
        let currentBalance = 5000;
        const { data: bootstrapData } = await supabase.rpc('ensure_player_wallet', {
          p_user_id: userId,
        });

        if (bootstrapData && bootstrapData.success) {
          currentBalance = Number(bootstrapData.balance);
        } else {
          const { data: wallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();
          if (wallet) currentBalance = Number(wallet.balance);
        }

        const { data: txs } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        const { data: inv } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', userId);

        set({
          balance: currentBalance,
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
      description: `Keke → ${destination}`,
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

  applyLawnFine: async (userId: string, amount: number = 500) => {
    const currentBalance = get().balance;
    const deducted = Math.min(currentBalance, amount);
    const newBalance = Math.max(0, currentBalance - amount);

    const tx: WalletTransaction = {
      id: `tx-fine-${Date.now()}`,
      userId,
      type: 'lawn_fine',
      amount: -deducted,
      balanceAfter: newBalance,
      description: 'Lawn Fine (Security Enforcement)',
      createdAt: new Date().toISOString(),
    };

    const newTransactions = [tx, ...get().transactions];
    set({ balance: newBalance, transactions: newTransactions });

    // Persist locally
    const local = localDB.getWallet(userId);
    local.balance = newBalance;
    local.transactions = newTransactions;
    localDB.saveWallet(userId, local);

    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('process_wallet_purchase', {
          p_type: 'lawn_fine',
          p_amount: deducted,
          p_description: tx.description,
          p_user_id: userId,
        });
      } catch (e) {
        console.error('Supabase fine sync error:', e);
      }
    }

    return { success: true, deducted };
  },

  purchaseFood: async (userId: string, item: FoodItem) => {
    const currentBalance = get().balance;
    if (currentBalance < item.price) {
      const err = `Insufficient funds for ${item.name}! You need ₦${item.price.toLocaleString()}.`;
      set({ error: err });
      return { success: false, error: err };
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('process_wallet_purchase', {
          p_type: 'food_purchase',
          p_item_id: item.id,
          p_item_name: item.name,
          p_amount: item.price,
          p_description: `Food: ${item.name}`,
          p_user_id: userId,
        });

        if (error || (data && !data.success)) {
          const errMsg = error?.message || data?.error || 'Purchase failed';
          console.error('[PURCHASE] process_wallet_purchase error:', errMsg, { error, data });
          set({ error: errMsg });
          return { success: false, error: errMsg };
        }

        const newBalance = Number(data.balance);
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

        const tx: WalletTransaction = {
          id: `tx-${Date.now()}`,
          userId,
          type: 'food_purchase',
          amount: -item.price,
          balanceAfter: newBalance,
          description: `${item.name}`,
          createdAt: new Date().toISOString(),
        };

        set({
          balance: newBalance,
          transactions: [tx, ...get().transactions],
          inventory: currentInventory,
          error: null,
        });
        return { success: true, balance: newBalance };
      } catch (e: any) {
        console.error('Supabase food purchase sync error:', e);
        const errMsg = e?.message || 'Network error processing purchase';
        set({ error: errMsg });
        return { success: false, error: errMsg };
      }
    }

    const newBalance = currentBalance - item.price;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      userId,
      type: 'food_purchase',
      amount: -item.price,
      balanceAfter: newBalance,
      description: `${item.name}`,
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

    return { success: true, balance: newBalance };
  },

  grantJobReward: async (userId: string, amount: number, jobTitle: string) => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('claim_job_reward', {
          p_job_id: `job_${Date.now()}`,
          p_job_title: jobTitle,
          p_reward: amount,
          p_user_id: userId,
        });

        if (error || (data && !data.success)) {
          set({ error: error?.message || data?.error });
          return false;
        }

        const newBalance = Number(data.balance);
        const tx: WalletTransaction = {
          id: `tx-job-${Date.now()}`,
          userId,
          type: 'campus_job',
          amount: amount,
          balanceAfter: newBalance,
          description: `Campus Job: ${jobTitle}`,
          createdAt: new Date().toISOString(),
        };

        set({ balance: newBalance, transactions: [tx, ...get().transactions] });
        return true;
      } catch (e) {
        console.error('Supabase job reward error:', e);
        return false;
      }
    }

    const currentBalance = get().balance;
    const newBalance = currentBalance + amount;

    const tx: WalletTransaction = {
      id: `tx-job-${Date.now()}`,
      userId,
      type: 'campus_job',
      amount: amount,
      balanceAfter: newBalance,
      description: `Campus Job: ${jobTitle}`,
      createdAt: new Date().toISOString(),
    };

    const newTransactions = [tx, ...get().transactions];
    set({ balance: newBalance, transactions: newTransactions });

    const local = localDB.getWallet(userId);
    local.balance = newBalance;
    local.transactions = newTransactions;
    localDB.saveWallet(userId, local);

    return true;
  },

  claimDailyReward: async (userId: string) => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('claim_daily_reward', {
          p_user_id: userId,
        });

        if (error || (data && !data.success)) {
          const errMsg = error?.message || data?.error || 'Already claimed today!';
          return { success: false, amount: 0, message: errMsg };
        }

        const newBalance = Number(data.balance);
        const rewardAmount = Number(data.reward) || 1000;
        const tx: WalletTransaction = {
          id: `tx-daily-${Date.now()}`,
          userId,
          type: 'daily_reward',
          amount: rewardAmount,
          balanceAfter: newBalance,
          description: 'Daily Campus Student Stipend',
          createdAt: new Date().toISOString(),
        };

        const todayStr = new Date().toISOString().split('T')[0];
        set({
          balance: newBalance,
          transactions: [tx, ...get().transactions],
          lastDailyRewardDate: todayStr,
        });

        return {
          success: true,
          amount: rewardAmount,
          message: `Received ₦${rewardAmount.toLocaleString()} Daily Campus Stipend!`,
        };
      } catch (e: any) {
        return { success: false, amount: 0, message: e?.message || 'Daily claim failed' };
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const lastClaim = typeof window !== 'undefined' ? localStorage.getItem('funaab_last_daily_reward') : null;

    if (lastClaim === todayStr) {
      return { success: false, amount: 0, message: 'Already claimed today! Check back tomorrow.' };
    }

    const rewardAmount = 1000;
    const currentBalance = get().balance;
    const newBalance = currentBalance + rewardAmount;

    const tx: WalletTransaction = {
      id: `tx-daily-${Date.now()}`,
      userId,
      type: 'daily_reward',
      amount: rewardAmount,
      balanceAfter: newBalance,
      description: 'Daily Resumption Allowance',
      createdAt: new Date().toISOString(),
    };

    const newTransactions = [tx, ...get().transactions];
    set({ balance: newBalance, transactions: newTransactions, lastDailyRewardDate: todayStr });

    if (typeof window !== 'undefined') {
      localStorage.setItem('funaab_last_daily_reward', todayStr);
    }

    const local = localDB.getWallet(userId);
    local.balance = newBalance;
    local.transactions = newTransactions;
    localDB.saveWallet(userId, local);

    return { success: true, amount: rewardAmount, message: 'Received ₦1,000 Daily Campus Allowance!' };
  },

  receiveTransfer: (senderUsername: string, amount: number) => {
    const currentBalance = get().balance;
    const newBalance = currentBalance + amount;

    const tx: WalletTransaction = {
      id: `tx-recv-${Date.now()}`,
      userId: 'local',
      type: 'p2p_transfer_in',
      amount: amount,
      balanceAfter: newBalance,
      description: `Received from @${senderUsername}`,
      createdAt: new Date().toISOString(),
    };

    set({
      balance: newBalance,
      transactions: [tx, ...get().transactions],
    });
  },

  transferMoney: async (senderId: string, senderUsername: string, recipientUsername: string, amount: number) => {
    if (amount <= 0) return { success: false, error: 'Invalid transfer amount' };
    if (recipientUsername.toLowerCase() === senderUsername.toLowerCase()) {
      return { success: false, error: 'Cannot transfer to yourself' };
    }

    const currentBalance = get().balance;
    if (currentBalance < amount) return { success: false, error: 'Insufficient funds' };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('transfer_money_p2p', {
          p_recipient_username: recipientUsername,
          p_amount: amount,
          p_note: '',
          p_sender_id: senderId,
        });

        if (error || (data && !data.success)) {
          const errMsg = error?.message || data?.error || 'Transfer failed';
          return { success: false, error: errMsg };
        }

        const newBalance = Number(data.balance);
        const tx: WalletTransaction = {
          id: `tx-${Date.now()}`,
          userId: senderId,
          type: 'p2p_transfer_out',
          amount: -amount,
          balanceAfter: newBalance,
          description: `Sent to @${recipientUsername}`,
          createdAt: new Date().toISOString(),
        };

        set({
          balance: newBalance,
          transactions: [tx, ...get().transactions],
        });

        return { success: true };
      } catch (e: any) {
        return { success: false, error: e?.message || 'Transfer failed' };
      }
    }

    const newBalance = currentBalance - amount;
    const tx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      userId: senderId,
      type: 'p2p_transfer_out',
      amount: -amount,
      balanceAfter: newBalance,
      description: `Sent to @${recipientUsername}`,
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
