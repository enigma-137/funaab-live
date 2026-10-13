import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useGameStore } from './gameStore';
import { toast } from './toastStore';

// Mirror of academic_state(); quizzes and exams are fetched without answers and graded in SQL.
export interface SemesterResult { semester: number; level: number; lectures: number; coursework: number; exam: number | null; score: number | null; grade: string | null; grade_point: number | null; status: 'passed' | 'failed' | 'incomplete' }
export interface AcademicState {
  level: number; semesters_passed: number; cgpa: number | null; graduated: boolean; class_of_degree: string | null;
  semester: { number: number; ends_at: string; exam_open: boolean; exam_opens_at: string; lectures: number; lectures_needed: number; coursework: number; quizzes: number;
    exam: null | { started_at: string; submitted: boolean; score: number | null; total: number } };
  results: SemesterResult[];
}
export interface Question { id: string; question: string; options: string[] }
export interface Quiz { attendance_id: string; lecture_id: string; questions: Question[] }
export interface Exam { started_at: string; ends_at: string; questions: Question[] }

type View = 'record' | 'quiz' | 'exam';
interface AcademicStore {
  state: AcademicState | null;
  view: View;
  quiz: Quiz | null;
  exam: Exam | null;
  answers: Record<string, number>;
  revealed: Record<string, number> | null;
  result: { score: number; total: number } | null;
  busy: boolean;
  error: string | null;
  load: () => Promise<void>;
  open: () => void;
  offerQuiz: (lectureId: string) => Promise<void>;
  startExam: () => Promise<void>;
  pick: (questionId: string, option: number) => void;
  submit: () => Promise<void>;
  back: () => void;
}

const rpc = async <T,>(name: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
};

export const levelLabel = (s: Pick<AcademicState, 'level' | 'graduated'>) => (s.graduated ? 'Alumni' : `${s.level}L`);

export const useAcademicStore = create<AcademicStore>((set, get) => ({
  state: null, view: 'record', quiz: null, exam: null, answers: {}, revealed: null, result: null, busy: false, error: null,
  load: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const before = get().state;
      const state = await rpc<AcademicState>('academic_state');
      if (!state || typeof state.level !== 'number' || !state.semester || !Array.isArray(state.results)) return;
      set({ state });
      // Celebrate promotions/graduation found when a past semester closes.
      if (before && state.level > before.level) toast({ icon: '🎓', text: `Promoted to ${state.level}L!`, tone: 'good', ms: 5000 });
      if (before && !before.graduated && state.graduated) toast({ icon: '🎓', text: `You graduated with ${state.class_of_degree}!`, tone: 'good', ms: 7000 });
    } catch { /* Older databases without migration 017 just hide academics. */ }
  },
  open: () => { set({ view: 'record', error: null, result: null, revealed: null }); void get().load(); useGameStore.getState().setActiveModal('academics'); },
  offerQuiz: async (lectureId) => {
    if (!isSupabaseConfigured) return;
    try {
      const quiz = await rpc<Quiz>('lecture_quiz', { p_lecture: lectureId });
      set({ quiz, view: 'quiz', answers: {}, revealed: null, result: null, error: null });
      useGameStore.getState().setActiveModal('academics');
    } catch { /* No quiz (already taken, no bank, older database): nothing to offer. */ }
  },
  startExam: async () => {
    set({ busy: true, error: null });
    try {
      const exam = await rpc<Exam>('start_semester_exam');
      set({ exam, view: 'exam', answers: {}, revealed: null, result: null });
    } catch (e) { set({ error: (e as Error).message }); } finally { set({ busy: false }); }
  },
  pick: (questionId, option) => { if (!get().result) set({ answers: { ...get().answers, [questionId]: option } }); },
  submit: async () => {
    const { view, quiz, answers } = get();
    set({ busy: true, error: null });
    try {
      if (view === 'quiz' && quiz) {
        const r = await rpc<{ score: number; total: number; answers: Record<string, number> }>('submit_lecture_quiz', { p_attendance: quiz.attendance_id, p_answers: answers });
        set({ result: { score: r.score, total: r.total }, revealed: r.answers });
      } else if (view === 'exam') {
        const r = await rpc<{ score: number; total: number }>('submit_semester_exam', { p_answers: answers });
        set({ result: r });
        toast({ icon: '📝', text: `Exam submitted: ${r.score}/${r.total}. Results come out when the semester ends.`, tone: 'info', ms: 5000 });
      }
      void get().load();
    } catch (e) { set({ error: (e as Error).message }); } finally { set({ busy: false }); }
  },
  back: () => set({ view: 'record', quiz: null, exam: null, answers: {}, revealed: null, result: null, error: null }),
}));
