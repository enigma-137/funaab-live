import { CAMPUS_SPAWN } from './campusLocations';
import { courseById, courses } from './academics';

export type JourneyStage =
  | 'welcome'
  | 'profile'
  | 'application'
  | 'utme'
  | 'screening'
  | 'admission'
  | 'identity'
  | 'avatar'
  | 'entry';
export interface AdmissionResult {
  subjects: { name: string; score: number }[];
  utme: number;
  screening?: number;
  aggregate?: number;
}
export interface JourneyDraft {
  stage: JourneyStage;
  courseId: string;
  result?: AdmissionResult;
  answers?: number[];
}
export const screeningQuestions = [
  {
    question: 'The shortcut crosses a restricted lawn. What do you do?',
    choices: ['Use the footpath', 'Race campus security', 'Drive a Keke across it'],
    answer: 0,
  },
  {
    question: 'A student you just met asks for your password.',
    choices: ['Send it in a DM', 'Keep it private', 'Post it in campus chat'],
    answer: 1,
  },
  {
    question: 'You are heading to a distant college. What can help?',
    choices: ['An official admission letter', 'A lawn fine', 'A Keke ride'],
    answer: 2,
  },
];
export function simulateUtme(courseId: string, random = Math.random): AdmissionResult {
  const course = courseById(courseId);
  const subjects = [
    'Use of English',
    'Mathematics',
    'Chemistry',
    course?.college === 'COLENG' || course?.college === 'COLPHYS' ? 'Physics' : 'Biology',
  ].map((name) => ({
    name,
    score: 42 + Math.floor(Math.max(0, Math.min(0.999999, random())) * 40),
  }));
  return { subjects, utme: subjects.reduce((sum, s) => sum + s.score, 0) };
}
export function screenResult(result: AdmissionResult, answers: number[]): AdmissionResult {
  const screening = Math.round(
    (answers.reduce((n, answer, i) => n + (answer === screeningQuestions[i]?.answer ? 1 : 0), 0) /
      3) *
      100,
  );
  return {
    ...result,
    screening,
    aggregate: Math.round(((result.utme / 400) * 60 + screening * 0.4) * 10) / 10,
  };
}
export const eligibleCourses = (aggregate: number) =>
  courses.filter((c) => aggregate >= c.gameCutoffRange[0]);
export const playerEntry = (completed?: boolean, beta?: boolean) =>
  completed ? 'returning' : beta ? 'beta' : 'new';
export const CAMPUS_ENTRY_POSITION: [number, number, number] = CAMPUS_SPAWN;
export const orientationTasks = [
  ['car-park', 'Visit Car Park'],
  ['keke', 'Take a Keke'],
  ['college', 'Visit your College'],
  ['food', 'Buy campus food'],
  ['student', 'Meet another student'],
] as const;
