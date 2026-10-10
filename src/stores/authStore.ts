import { create } from 'zustand';
import { PlayerProfile, AvatarConfig } from '../types/game';
import { supabase, isSupabaseConfigured, localDB } from '../lib/supabase';
import { normalizeAvatar } from '../config/avatar';
import worldData from '../worlds/funaab/world.json';

interface AuthState {
  user: PlayerProfile | null;
  isAuthenticated: boolean;
  isInitializingAuth: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (username: string, college: string, email: string, password?: string) => Promise<boolean>;
  guestLogin: (username: string, college: string, avatar?: Partial<AvatarConfig>) => boolean;
  updateAvatar: (avatar: Partial<AvatarConfig>) => Promise<boolean>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const DEFAULT_AVATAR: AvatarConfig = {
  shirtColor: '#15803d', // FUNAAB Green
  skinColor: '#8d5524',
  hairColor: '#1e1b18',
  hairStyle: 'short',
  gender: 'male',
};

let initializing = false;
let authSubscription: { unsubscribe: () => void } | undefined;
let authEventGeneration = 0;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializingAuth: true,
  isLoading: false,
  error: null,

  initialize: async () => {
    if (initializing) return;
    initializing = true;
    if (!isSupabaseConfigured) {
      // If Supabase not configured in local dev, check if guest mode is permitted
      const isGuestAllowed = import.meta.env.VITE_ENABLE_GUEST_MODE === 'true';
      if (isGuestAllowed) {
        const lastGuestId = localStorage.getItem('funaab_last_guest_id');
        if (lastGuestId) {
          const profile = localDB.getProfile(lastGuestId);
          if (profile) {
            set({ user: profile, isAuthenticated: true, isInitializingAuth: false });
            return;
          }
        }
      }
      set({ isInitializingAuth: false });
      return;
    }

    try {
      // 1. Check existing Supabase session from localStorage
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (session?.user) {
        const userId = session.user.id;
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) throw profileError;
        if (profile) {
          const userProfile: PlayerProfile = {
            id: profile.id,
            username: profile.username,
            college: profile.college,
            avatarConfig: normalizeAvatar(profile.avatar_config || DEFAULT_AVATAR),
            onboardingCompleted: profile.onboarding_completed === true,
            courseId: profile.course_id,
            gameMatricNumber: profile.game_matric_number,
            lastWorld: profile.last_world || 'funaab',
          };
          set({ user: userProfile, isAuthenticated: true, isInitializingAuth: false });
        } else {
          // Profile record missing, recover safely from user metadata
          const metaUsername =
            session.user.user_metadata?.username || `Student_${session.user.id.substring(0, 5)}`;
          const metaCollege = session.user.user_metadata?.college || 'COLENG';
          const newProfile = {
            id: userId,
            username: metaUsername,
            college: metaCollege,
            avatar_config: DEFAULT_AVATAR,
            last_world: 'funaab',
          };

          const { error: saveError } = await supabase
            .from('profiles')
            .upsert([newProfile], { onConflict: 'id', ignoreDuplicates: true });
          if (saveError) throw saveError;
          // Wallet bootstrap is owned by the idempotent ensure_player_wallet RPC in walletStore.

          const userProfile: PlayerProfile = {
            id: userId,
            username: metaUsername,
            college: metaCollege,
            avatarConfig: DEFAULT_AVATAR,
            lastWorld: 'funaab',
          };
          set({ user: userProfile, isAuthenticated: true, isInitializingAuth: false });
        }
      } else {
        set({ user: null, isAuthenticated: false, isInitializingAuth: false });
      }

      // 2. Subscribe to auth lifecycle events (sign-in, token refresh, sign-out)
      authSubscription?.unsubscribe();
      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        const generation = ++authEventGeneration;
        if (event === 'SIGNED_OUT') {
          set({ user: null, isAuthenticated: false, isInitializingAuth: false });
          return;
        }
        window.setTimeout(async () => {
          try {
            if (event === 'TOKEN_REFRESHED' && session?.user.id === get().user?.id) return;
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              if (session?.user) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .maybeSingle();

                if (generation !== authEventGeneration) return;
                if (profile) {
                  const userProfile: PlayerProfile = {
                    id: profile.id,
                    username: profile.username,
                    college: profile.college,
                    avatarConfig: normalizeAvatar(profile.avatar_config || DEFAULT_AVATAR),
                    onboardingCompleted: profile.onboarding_completed === true,
                    courseId: profile.course_id,
                    gameMatricNumber: profile.game_matric_number,
                    lastWorld: profile.last_world || 'funaab',
                  };
                  set({ user: userProfile, isAuthenticated: true, isInitializingAuth: false });
                }
              }
            }
          } catch (error) {
            console.warn('Session profile refresh failed', error);
          }
        }, 0);
      }).data.subscription;
    } catch (err: any) {
      initializing = false;
      console.warn('Auth initialization error:', err);
      set({ user: null, isAuthenticated: false, isInitializingAuth: false });
    }
  },

  login: async (email: string, password?: string) => {
    set({ isLoading: true, error: null });

    const cleanEmail = String(email || '')
      .trim()
      .toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      set({ error: 'Please enter a valid student email address.', isLoading: false });
      return false;
    }

    if (!password || password.length < 6) {
      set({ error: 'Password must be at least 6 characters.', isLoading: false });
      return false;
    }

    if (!isSupabaseConfigured) {
      // Local dev fallback only if guest mode is enabled
      if (import.meta.env.VITE_ENABLE_GUEST_MODE === 'true') {
        const username = cleanEmail.split('@')[0] || 'Student';
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
      }
      set({ error: 'Supabase authentication is not configured.', isLoading: false });
      return false;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Incorrect email or password. Please try again.');
        }
        throw error;
      }

      if (data.user) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile) {
          const userProfile: PlayerProfile = {
            id: profile.id,
            username: profile.username,
            college: profile.college,
            avatarConfig: normalizeAvatar(profile.avatar_config || DEFAULT_AVATAR),
            onboardingCompleted: profile.onboarding_completed === true,
            courseId: profile.course_id,
            gameMatricNumber: profile.game_matric_number,
            lastWorld: profile.last_world || 'funaab',
          };
          set({ user: userProfile, isAuthenticated: true, isLoading: false });
          return true;
        }
      }

      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({
        error: err.message || 'Login failed. Please check your credentials.',
        isLoading: false,
      });
      return false;
    }
  },

  signup: async (username: string, college: string, email: string, password?: string) => {
    set({ isLoading: true, error: null });

    const cleanUsername = String(username || '').trim();
    const cleanEmail = String(email || '')
      .trim()
      .toLowerCase();

    // 1. Validation
    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 20) {
      set({ error: 'Username must be between 3 and 20 characters.', isLoading: false });
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      set({
        error: 'Username can only contain letters, numbers, and underscores.',
        isLoading: false,
      });
      return false;
    }

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      set({ error: 'Please enter a valid student email address.', isLoading: false });
      return false;
    }

    if (!password || password.length < 6) {
      set({ error: 'Password must contain at least 6 characters.', isLoading: false });
      return false;
    }

    if (!college) {
      set({ error: 'Please select your FUNAAB College.', isLoading: false });
      return false;
    }

    const collegeObj = worldData.colleges.find((c) => c.code === college);
    const shirtColor = collegeObj ? collegeObj.color : '#15803d';

    const avatarConfig: AvatarConfig = {
      ...DEFAULT_AVATAR,
      shirtColor,
    };

    if (!isSupabaseConfigured) {
      if (import.meta.env.VITE_ENABLE_GUEST_MODE === 'true') {
        const userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
        const profile: PlayerProfile = {
          id: userId,
          username: cleanUsername,
          college: college || 'COLENG',
          avatarConfig,
          lastWorld: 'funaab',
        };
        localDB.saveProfile(profile);
        set({ user: profile, isAuthenticated: true, isLoading: false });
        return true;
      }
      set({ error: 'Supabase authentication is not configured.', isLoading: false });
      return false;
    }

    try {
      // 2. Check username availability in profiles table
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        set({
          error: `The username @${cleanUsername} is already taken. Please choose another.`,
          isLoading: false,
        });
        return false;
      }

      // 3. Supabase Auth Signup (Auto-confirmed in dashboard)
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            college,
          },
        },
      });

      if (error) {
        if (
          error.message.includes('already registered') ||
          error.message.includes('unique constraint')
        ) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw error;
      }

      if (!data.session) {
        set({ isLoading: false, error: 'Check your email to confirm your account, then sign in.' });
        return false;
      }
      if (data.user) {
        const newProfile = {
          id: data.user.id,
          username: cleanUsername,
          college,
          avatar_config: avatarConfig,
          last_world: 'funaab',
        };

        // Insert only when missing; never reset an existing beta profile.
        const { error: saveError } = await supabase
          .from('profiles')
          .upsert([newProfile], { onConflict: 'id', ignoreDuplicates: true });
        if (saveError) throw saveError;
        // walletStore loads/bootstraps the existing wallet without overwriting it.

        const userProfile: PlayerProfile = {
          id: data.user.id,
          username: cleanUsername,
          college,
          avatarConfig,
          lastWorld: 'funaab',
        };

        set({ user: userProfile, isAuthenticated: true, isLoading: false });
        return true;
      }

      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Signup failed. Please try again.', isLoading: false });
      return false;
    }
  },

  guestLogin: (username: string, college: string, avatar?: Partial<AvatarConfig>) => {
    // Check if guest mode is permitted
    const isGuestAllowed = import.meta.env.VITE_ENABLE_GUEST_MODE === 'true';
    if (!isGuestAllowed) {
      set({
        error: 'Guest entry is disabled for public beta. Please create an account or sign in.',
      });
      return false;
    }

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
    localStorage.setItem('funaab_last_guest_id', userId);
    set({ user: profile, isAuthenticated: true, isLoading: false, error: null });
    return true;
  },

  updateAvatar: async (avatarUpdates: Partial<AvatarConfig>) => {
    const current = get().user;
    if (!current) return false;
    const updated: PlayerProfile = {
      ...current,
      avatarConfig: normalizeAvatar({ ...current.avatarConfig, ...avatarUpdates }),
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_config: updated.avatarConfig })
        .eq('id', current.id);
      if (error) {
        set({ error: error.message });
        return false;
      }
    }
    localDB.saveProfile(updated);
    set({ user: updated });
    return true;
  },

  logout: async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Signout error:', e);
      }
    }
    localStorage.removeItem('funaab_last_guest_id');
    set({ user: null, isAuthenticated: false, error: null });
  },

  getAccessToken: async () => {
    if (!isSupabaseConfigured) return null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  },
}));
