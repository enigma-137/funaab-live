// Academic career rules (display + drift checks). The database (migration 017) decides everything:
// questions/answers, scores, promotion and graduation. scripts/test-academics-db.ts checks drift.

export const ACADEMICS = {
  /** Semester 0 starts Monday 5 January 2026, Lagos time; each semester is one week (Mon–Sun). */
  EPOCH_DAY: '2026-01-05',
  SEMESTER_DAYS: 7,
  /** Exams open on these ISO weekdays (6 = Saturday, 7 = Sunday). */
  EXAM_WEEKDAYS: [6, 7] as const,
  LECTURES_NEEDED: 3,
  QUIZ_QUESTIONS: 3,
  QUIZ_WINDOW_MINUTES: 30,
  EXAM_QUESTIONS: 10,
  EXAM_MINUTES: 10,
  COURSEWORK_WEIGHT: 0.4,
  EXAM_WEIGHT: 0.6,
  SEMESTERS_PER_LEVEL: 2,
  SEMESTERS_TO_GRADUATE: 10,
  PASS_MARK: 40,
};

/** Nigerian 5-point scale, highest band first. */
export const GRADE_BANDS = [
  { min: 70, grade: 'A', point: 5 },
  { min: 60, grade: 'B', point: 4 },
  { min: 50, grade: 'C', point: 3 },
  { min: 45, grade: 'D', point: 2 },
  { min: 40, grade: 'E', point: 1 },
  { min: 0, grade: 'F', point: 0 },
] as const;

export const DEGREE_CLASSES = [
  { min: 4.5, name: 'First Class' },
  { min: 3.5, name: 'Second Class Upper' },
  { min: 2.4, name: 'Second Class Lower' },
  { min: 1.5, name: 'Third Class' },
  { min: 0, name: 'Pass' },
] as const;

export const gradeFor = (score: number) => GRADE_BANDS.find((b) => score >= b.min)!;
export const degreeClass = (cgpa: number) => DEGREE_CLASSES.find((c) => cgpa >= c.min)!.name;
export const levelFor = (passed: number) => Math.min(500, 100 + Math.floor(passed / ACADEMICS.SEMESTERS_PER_LEVEL) * 100);
export const semesterScore = (coursework: number, exam: number) =>
  Math.round((ACADEMICS.COURSEWORK_WEIGHT * coursework + ACADEMICS.EXAM_WEIGHT * exam) * 100) / 100;
