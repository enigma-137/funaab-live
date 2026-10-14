import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { normalizeAvatar } from '../config/avatar';
import type { AvatarConfig } from '../types/game';
import type { JourneyDraft } from '../config/studentJourney';

export interface StudentJourney {
  beta_player: boolean;
  draft: Partial<JourneyDraft>;
  admission_story_completed: boolean;
  orientation_steps: string[];
  orientation_completed: boolean;
  orientation_badge_claimed_at: string | null;
}
interface StudentState {
  owner: string | null;
  journey: StudentJourney | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  load: (id: string) => Promise<void>;
  saveDraft: (draft: JourneyDraft) => Promise<boolean>;
  complete: (courseId: string, avatar: AvatarConfig, story: boolean) => Promise<boolean>;
  accept: (courseId: string) => Promise<boolean>;
  markSteps: (steps: string[]) => Promise<void>;
  claimBadge: () => Promise<void>;
  changeDepartment: (courseId: string) => Promise<boolean>;
  changeUsername: (username: string) => Promise<boolean>;
}
const row = <T>(data: T | T[]): T => (Array.isArray(data) ? data[0] : data);
const message = (e: unknown) =>
  (e as { message?: string })?.message || 'Could not save. Please try again.';
let loadGeneration = 0;
export const useStudentStore = create<StudentState>((set, get) => ({
  owner: null,
  journey: null,
  loading: false,
  saving: false,
  error: null,
  load: async (id) => {
    const generation = ++loadGeneration;
    set({ owner: id, journey: null, loading: true, saving: false, error: null });
    const { data, error } = await supabase.rpc('ensure_student_journey');
    if (
      generation !== loadGeneration ||
      get().owner !== id ||
      useAuthStore.getState().user?.id !== id
    )
      return;
    set({
      journey: row(data),
      loading: false,
      error: error
        ? 'Student setup is unavailable. Please retry; your existing account is safe.'
        : null,
    });
  },
  saveDraft: async (draft) => {
    const id = get().owner;
    if (!id || get().saving) return false;
    set({ saving: true, error: null });
    const { error } = await supabase.from('student_journeys').update({ draft }).eq('user_id', id);
    if (get().owner !== id) return false;
    set({
      saving: false,
      error: error ? message(error) : null,
      journey: error ? get().journey : { ...get().journey!, draft },
    });
    return !error;
  },
  complete: async (courseId, avatar, story) => {
    const id = get().owner;
    if (!id || get().saving) return false;
    set({ saving: true, error: null });
    const { data, error } = await supabase.rpc('complete_student_profile', {
      p_course_id: courseId,
      p_avatar: normalizeAvatar(avatar),
      p_story_completed: story,
    });
    if (get().owner !== id || useAuthStore.getState().user?.id !== id) return false;
    if (error || !row(data)) {
      set({ saving: false, error: message(error) });
      return false;
    }
    const profile = row(data);
    useAuthStore.setState((s) => ({
      user: s.user
        ? {
            ...s.user,
            college: profile.college,
            avatarConfig: normalizeAvatar(profile.avatar_config),
            courseId: profile.course_id,
            gameMatricNumber: profile.game_matric_number,
            onboardingCompleted: profile.onboarding_completed,
          }
        : null,
    }));
    set({
      saving: false,
      journey: {
        ...get().journey!,
        draft: {},
        admission_story_completed: story || !!get().journey?.admission_story_completed,
      },
    });
    return true;
  },
  accept: async (courseId) => {
    const owner = get().owner;
    if (!owner || get().saving) return false;
    set({ saving: true, error: null });
    const { data, error } = await supabase.rpc('accept_game_admission', { p_course_id: courseId });
    if (get().owner !== owner || useAuthStore.getState().user?.id !== owner) return false;
    if (error || !row(data)) {
      set({ saving: false, error: message(error) });
      return false;
    }
    const profile = row(data);
    useAuthStore.setState((s) => ({
      user: s.user
        ? {
            ...s.user,
            college: profile.college,
            courseId: profile.course_id,
            gameMatricNumber: profile.game_matric_number,
          }
        : null,
    }));
    set({ saving: false });
    return true;
  },
  markSteps: async (steps) => {
    const { owner, journey } = get();
    if (!owner || !journey || journey.orientation_completed) return;
    const merged = [...new Set([...journey.orientation_steps, ...steps])];
    if (merged.length === journey.orientation_steps.length) return;
    const { error } = await supabase
      .from('student_journeys')
      .update({ orientation_steps: merged })
      .eq('user_id', owner);
    if (get().owner === owner && !error)
      set({ journey: { ...get().journey!, orientation_steps: merged } });
  },
  /** Switch department (and its college) after admission; the database allows once a day. */
  changeDepartment: async (courseId) => {
    const id = get().owner;
    if (!id || get().saving) return false;
    set({ saving: true, error: null });
    const { data, error } = await supabase.rpc('change_game_department', { p_course_id: courseId });
    if (get().owner !== id || useAuthStore.getState().user?.id !== id) return false;
    if (error || !row(data)) {
      set({ saving: false, error: message(error) });
      return false;
    }
    const profile = row(data);
    useAuthStore.setState((s) => ({
      user: s.user ? { ...s.user, college: profile.college, courseId: profile.course_id, gameMatricNumber: profile.game_matric_number } : null,
    }));
    set({ saving: false });
    return true;
  },
  changeUsername: async (username) => {
    const id = get().owner;
    if (!id || get().saving) return false;
    set({ saving: true, error: null });
    const { data, error } = await supabase.rpc('change_username', { p_username: username.trim() });
    if (get().owner !== id || useAuthStore.getState().user?.id !== id) return false;
    if (error || !row(data)) {
      set({ saving: false, error: message(error) });
      return false;
    }
    const profile = row(data);
    useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, username: profile.username } : null }));
    // Keep the sign-in metadata in step (only used as a fallback before the profile loads).
    void supabase.auth.updateUser({ data: { username: profile.username } }).catch(() => {});
    set({ saving: false });
    return true;
  },
  claimBadge: async () => {
    if (get().saving) return;
    const owner = get().owner;
    set({ saving: true, error: null });
    const { data, error } = await supabase.rpc('claim_orientation_badge');
    if (get().owner === owner)
      set({
        saving: false,
        error: error ? message(error) : null,
        journey: error ? get().journey : row(data),
      });
  },
}));
