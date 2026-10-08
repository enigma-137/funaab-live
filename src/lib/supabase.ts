import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')
);

// Production browser client with session persistence & automatic refresh
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : (null as unknown as SupabaseClient);

// Local persistence storage helper for fallback/guest mode
export const localDB = {
  getProfile: (userId: string) => {
    const raw = localStorage.getItem(`funaab_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  },
  saveProfile: (profile: any) => {
    localStorage.setItem(`funaab_profile_${profile.id}`, JSON.stringify(profile));
  },
  getWallet: (userId: string) => {
    const raw = localStorage.getItem(`funaab_wallet_${userId}`);
    if (raw) return JSON.parse(raw);
    const initial = {
      balance: 5000,
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId,
          type: 'starter',
          amount: 5000,
          balanceAfter: 5000,
          description: 'FUNAAB Resumption Allowance (Welcome Bonus)',
          createdAt: new Date().toISOString(),
        },
      ],
      inventory: [
        {
          id: `inv-${Date.now()}`,
          itemId: 'student_id',
          itemName: 'FUNAAB Smart Student ID Card',
          itemType: 'wearable',
          quantity: 1,
        },
      ],
    };
    localStorage.setItem(`funaab_wallet_${userId}`, JSON.stringify(initial));
    return initial;
  },
  saveWallet: (userId: string, data: any) => {
    localStorage.setItem(`funaab_wallet_${userId}`, JSON.stringify(data));
  },
  getFriends: (userId: string) => {
    const raw = localStorage.getItem(`funaab_friends_${userId}`);
    return raw ? JSON.parse(raw) : [];
  },
  saveFriends: (userId: string, friends: any[]) => {
    localStorage.setItem(`funaab_friends_${userId}`, JSON.stringify(friends));
  },
  getBlocks: (userId: string) => {
    const raw = localStorage.getItem(`funaab_blocks_${userId}`);
    return raw ? JSON.parse(raw) : [];
  },
  saveBlocks: (userId: string, blocks: string[]) => {
    localStorage.setItem(`funaab_blocks_${userId}`, JSON.stringify(blocks));
  },
  getMutes: (userId: string) => {
    const raw = localStorage.getItem(`funaab_mutes_${userId}`);
    return raw ? JSON.parse(raw) : [];
  },
  saveMutes: (userId: string, mutes: string[]) => {
    localStorage.setItem(`funaab_mutes_${userId}`, JSON.stringify(mutes));
  },
  saveReport: (report: any) => {
    const reports = JSON.parse(localStorage.getItem('funaab_reports') || '[]');
    reports.push(report);
    localStorage.setItem('funaab_reports', JSON.stringify(reports));
  },
};
