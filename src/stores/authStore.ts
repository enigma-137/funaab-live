import { create } from 'zustand';
import { PlayerProfile, AvatarConfig } from '../types/game';
import { supabase, isSupabaseConfigured, localDB } from '../lib/supabase';
import worldData from '../worlds/funaab/world.json';

interface AuthState {
  user: PlayerProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (username: string, college: string, email: string, password?: string) => Promise<boolean>;
  guestLogin: (username: string, college: string, avatar?: Partial<AvatarConfig>) => void;
  updateAvatar: (avatar: Partial<AvatarConfig>) => void;
  logout: () => void;
}

const DEFAULT_AVATAR: AvatarConfig = {
  shirtColor: '#15803d', // FUNAAB Green
  skinColor: '#8d5524',
  hairColor: '#1e1b18',
  hairStyle: 'short',
  gender: 'male',
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password?: string) => {
    set({ isLoading: true, error: null });

    // If Supabase is connected
    if (isSupabaseConfigured && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            const userProfile: PlayerProfile = {
              id: profile.id,
              username: profile.username,
              college: profile.college,
              avatarConfig: profile.avatar_config || DEFAULT_AVATAR,
              lastWorld: profile.last_world || 'funaab',
            };
            set({ user: userProfile, isAuthenticated: true, isLoading: false });
            return true;
          }
        }
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        return false;
      }
    }

    // Fallback/Local login by matching stored profile
    const username = email.split('@')[0] || email;
    let userId = localStorage.getItem(`funaab_user_id_${username}`);
    if (!userId) {
      userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(`funaab_user_id_${username}`, userId);
    }

    let existingProfile = localDB.getProfile(userId);
    if (!existingProfile) {
      existingProfile = {
        id: userId,
        username,
        college: 'COLENG',
        avatarConfig: DEFAULT_AVATAR,
        lastWorld: 'funaab',
      };
      localDB.saveProfile(existingProfile);
    }

    set({ user: existingProfile, isAuthenticated: true, isLoading: false });
    return true;
  },

  signup: async (username: string, college: string, email: string, password?: string) => {
    set({ isLoading: true, error: null });

    const collegeObj = worldData.colleges.find((c) => c.code === college);
    const shirtColor = collegeObj ? collegeObj.color : '#15803d';

    const avatarConfig: AvatarConfig = {
      ...DEFAULT_AVATAR,
      shirtColor,
    };

    if (isSupabaseConfigured && password) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data.user) {
          const newProfile = {
            id: data.user.id,
            username,
            college,
            avatar_config: avatarConfig,
            last_world: 'funaab',
          };
          await supabase.from('profiles').insert([newProfile]);
          await supabase.from('wallets').insert([{ user_id: data.user.id, balance: 5000 }]);

          const userProfile: PlayerProfile = {
            id: data.user.id,
            username,
            college,
            avatarConfig,
            lastWorld: 'funaab',
          };
          set({ user: userProfile, isAuthenticated: true, isLoading: false });
          return true;
        }
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        return false;
      }
    }

    // Local instant profile creation
    const userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const profile: PlayerProfile = {
      id: userId,
      username: username.trim() || `Student_${Math.floor(Math.random() * 900 + 100)}`,
      college: college || 'COLENG',
      avatarConfig,
      lastWorld: 'funaab',
    };
    localDB.saveProfile(profile);
    set({ user: profile, isAuthenticated: true, isLoading: false });
    return true;
  },

  guestLogin: (username: string, college: string, avatar?: Partial<AvatarConfig>) => {
    const collegeObj = worldData.colleges.find((c) => c.code === college);
    const shirtColor = collegeObj ? collegeObj.color : '#15803d';

    const cleanUsername = username.trim() || `Student_${Math.floor(Math.random() * 9000 + 1000)}`;
    const userId = `guest_${Math.random().toString(36).substring(2, 9)}`;

    const profile: PlayerProfile = {
      id: userId,
      username: cleanUsername,
      college: college || 'COLENG',
      avatarConfig: {
        ...DEFAULT_AVATAR,
        shirtColor,
        ...avatar,
      },
      lastWorld: 'funaab',
    };

    localDB.saveProfile(profile);
    set({ user: profile, isAuthenticated: true, isLoading: false });
  },

  updateAvatar: (avatarUpdates: Partial<AvatarConfig>) => {
    const current = get().user;
    if (!current) return;
    const updated: PlayerProfile = {
      ...current,
      avatarConfig: { ...current.avatarConfig, ...avatarUpdates },
    };
    localDB.saveProfile(updated);
    set({ user: updated });
  },

  logout: () => {
    if (isSupabaseConfigured) {
      supabase.auth.signOut();
    }
    set({ user: null, isAuthenticated: false });
  },
}));
