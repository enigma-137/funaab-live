import { LectureDefinition } from '../types/game';
import { getLagosTime } from '../utils/lagosTime';

export const BETA_SCHEDULE_CONFIG = {
  LECTURE_DURATION_MINUTES: 12,
  BREAK_DURATION_MINUTES: 3,
  CYCLE_DURATION_MINUTES: 15, // 12 mins lecture + 3 mins break = 15 min cycles
  ACADEMIC_HOUR_START: 9,     // 9:00 AM WAT
  ACADEMIC_HOUR_END: 17,      // 5:00 PM (17:00) WAT
  HALL_OFFSETS_MINUTES: {
    'colfhec-lecture-hall': 0,  // :00-:12 lecture, :12-:15 break
    'central-lecture-hall': 5,  // :05-:17 lecture, :17-:20 break
    'colbios-lecture-hall': 10, // :10-:22 lecture, :22-:25 break
  } as Record<string, number>,
};

export const LECTURE_SCHEDULE: LectureDefinition[] = [
  {
    id: 'funaab-fst-201',
    courseCode: 'FST 201',
    title: 'Food Chemistry & Biochemistry',
    college: 'COLFHEC',
    locationId: 'colfhec-lecture-hall',
    locationName: 'COLFHEC Lecture Hall 1',
    lecturerName: 'Dr. Adeyemi',
    lecturerTitle: 'Associate Professor, Food Science',
    lecturerAvatar: { shirtColor: '#166534', skinColor: '#8d5524' },
    durationMinutes: 12,
    maxCapacity: 30,
    attendanceAllowance: 100,
    description: 'Structure of polysaccharides, starch retrogradation, and enzymatic browning in Nigerian root tubers.',
    timeline: [
      {
        atSeconds: 0,
        action: 'speak',
        text: 'Good afternoon, students. Welcome to FST 201 — Food Chemistry. Settle down into your seats.',
        boardTopic: 'FST 201: Food Chemistry & Biochemistry\nTopic: Starch Retrogradation in Cassava & Yam',
      },
      {
        atSeconds: 15,
        action: 'board',
        text: 'Today we will examine the molecular structure of Amylose and Amylopectin in cassava tubers.',
        boardTopic: 'Amylose (α-1,4-glycosidic bonds) vs. Amylopectin (α-1,6 branches)\nGelatinization Temp: ~62°C - 70°C',
      },
      {
        atSeconds: 35,
        action: 'speak',
        text: 'When we heat garri with boiling water to make eba, starch granules swell and gelatinize.',
      },
      {
        atSeconds: 55,
        action: 'gesture',
        text: 'Who can tell the class what happens when eba cools down and retrogrades? Raise your hand.',
        boardTopic: 'Retrogradation: Recrystallization of amylose linear chains\nCauses staling & firmer gel texture',
      },
      {
        atSeconds: 85,
        action: 'speak',
        text: 'Excellent observation. The linear amylose chains align through hydrogen bonding, giving it a firmer texture.',
      },
      {
        atSeconds: 120,
        action: 'speak',
        text: 'Next, let us look at enzymatic browning caused by polyphenol oxidase in cut yam slices.',
        boardTopic: 'Polyphenol Oxidase (PPO) + O₂ + Phenolics → Quinones → Brown Melanin\nPrevention: Blanching, Vitamin C (Ascorbic Acid), Citric Acid',
      },
      {
        atSeconds: 160,
        action: 'speak',
        text: 'Make sure to copy these mechanisms into your practical notebooks for next week laboratory.',
      },
      {
        atSeconds: 200,
        action: 'speak',
        text: 'That will be all for today session. Please review chapter 4 in the library before our next class. Class dismissed!',
        boardTopic: 'Class Dismissed!\nAssignment: Read Chapter 4 on Lipid Oxidation.',
      },
    ],
  },
  {
    id: 'funaab-eng-203',
    courseCode: 'MEE 203',
    title: 'Applied Engineering Thermodynamics',
    college: 'COLENG',
    locationId: 'central-lecture-hall',
    locationName: 'Central Lecture Theatre (CLT)',
    lecturerName: 'Prof. Babatunde',
    lecturerTitle: 'Professor of Mechanical Engineering',
    lecturerAvatar: { shirtColor: '#1e40af', skinColor: '#5c381e' },
    durationMinutes: 12,
    maxCapacity: 30,
    attendanceAllowance: 100,
    description: 'First and Second Laws of Thermodynamics, Carnot heat engines, and steam power cycles in agricultural machinery.',
    timeline: [
      {
        atSeconds: 0,
        action: 'speak',
        text: 'Quiet down everyone. Welcome to MEE 203 — Applied Thermodynamics at the Central Lecture Theatre.',
        boardTopic: 'MEE 203: Applied Engineering Thermodynamics\nTopic: Carnot Cycle & Second Law Analysis',
      },
      {
        atSeconds: 15,
        action: 'board',
        text: 'Recall the First Law: energy cannot be created or destroyed, only transformed: dU = dQ - dW.',
        boardTopic: 'First Law: ΔU = Q - W\nEnthalpy: H = U + PV\nIsentropic Efficiency: η = W_actual / W_ideal',
      },
      {
        atSeconds: 40,
        action: 'speak',
        text: 'In Nigerian farm tractors and grain processing mills, heat dissipation directly affects brake thermal efficiency.',
      },
      {
        atSeconds: 70,
        action: 'gesture',
        text: 'Who remembers the Carnot efficiency formula? Raise your hand if you can state it.',
        boardTopic: 'Carnot Thermal Efficiency: η = 1 - (T_cold / T_hot)\nTemperatures MUST be in Kelvin (K = °C + 273.15)',
      },
      {
        atSeconds: 110,
        action: 'speak',
        text: 'Correct. Always express temperature in Kelvin when calculating maximum theoretical efficiency.',
      },
      {
        atSeconds: 150,
        action: 'speak',
        text: 'Next lecture we will cover Rankine steam cycles for bio-energy power plants. See you on Wednesday.',
        boardTopic: 'Class Concluded.\nNext: Rankine Cycle & Superheated Steam.',
      },
    ],
  },
  {
    id: 'funaab-bio-205',
    courseCode: 'BIO 205',
    title: 'Principles of Genetics & Inheritance',
    college: 'COLBIOS',
    locationId: 'colbios-lecture-hall',
    locationName: 'COLBIOS Lecture Hall A',
    lecturerName: 'Dr. (Mrs.) Folorunso',
    lecturerTitle: 'Senior Lecturer, Biological Sciences',
    lecturerAvatar: { shirtColor: '#831843', skinColor: '#a16207' },
    durationMinutes: 12,
    maxCapacity: 30,
    attendanceAllowance: 100,
    description: 'Mendelian genetics, monohybrid and dihybrid crosses, DNA transcription and translation in tropical crops.',
    timeline: [
      {
        atSeconds: 0,
        action: 'speak',
        text: 'Good day class. Welcome to BIO 205. Today we explore Mendelian inheritance and modern crop genetics.',
        boardTopic: 'BIO 205: Principles of Genetics\nTopic: Mendelian Ratios in Tropical Crop Breeding',
      },
      {
        atSeconds: 20,
        action: 'board',
        text: 'Gregor Mendel formulated the Law of Segregation and the Law of Independent Assortment.',
        boardTopic: 'Law of Segregation (3:1 Phenotypic Ratio in F2 Monohybrid Cross)\nLaw of Independent Assortment (9:3:3:1 Dihybrid Ratio)',
      },
      {
        atSeconds: 60,
        action: 'speak',
        text: 'In FUNAAB crop breeding programmes, we select pest-resistant cowpea and cassava using these exact principles.',
      },
      {
        atSeconds: 100,
        action: 'gesture',
        text: 'Who can describe the role of mRNA in protein synthesis? Raise your hand if you know.',
      },
      {
        atSeconds: 140,
        action: 'speak',
        text: 'mRNA transcribes the genetic code from the nucleus to the ribosomes for translation into amino acids.',
      },
      {
        atSeconds: 180,
        action: 'speak',
        text: 'Thank you for your attention. See you all in the practical laboratory on Thursday!',
        boardTopic: 'Lecture Finished.\nPrepare for Lab Session on Thursday.',
      },
    ],
  },
];

/**
 * Normalizes any hall ID or alias (e.g. 'lecture-hall-colfhec', 'funaab-fst-201', 'colfhec')
 * to standard canonical locationId: 'colfhec-lecture-hall' | 'central-lecture-hall' | 'colbios-lecture-hall'
 */
export function normalizeHallLocationId(input?: string | null): string {
  if (!input) return 'colfhec-lecture-hall';
  const s = input.toLowerCase();
  if (s.includes('central') || s.includes('clt') || s.includes('eng') || s.includes('203')) {
    return 'central-lecture-hall';
  }
  if (s.includes('colbios') || s.includes('bio') || s.includes('205')) {
    return 'colbios-lecture-hall';
  }
  return 'colfhec-lecture-hall';
}

/**
 * Check if a development forceLecture override is active
 * Supported formats:
 * - ?forceLecture=true
 * - ?forceLecture=fst-201
 * - ?forceLecture=colfhec
 */
export function checkForceLectureParam(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const force = params.get('forceLecture') || params.get('force_lecture');
    if (force) return force.toLowerCase();
    if ((window as any).__FORCE_LECTURE__) return String((window as any).__FORCE_LECTURE__).toLowerCase();
  } catch (e) {}
  return null;
}

export interface HallScheduleState {
  status: 'active' | 'break' | 'off_hours' | 'weekend';
  lecture: LectureDefinition;
  nextLecture: LectureDefinition;
  timeRemainingSeconds: number;
  secondsUntilStart: number;
  startsAtMs: number;
  endsAtMs: number;
  isForced: boolean;
  isAcademicHours: boolean;
  lagosTimeString: string;
}

/**
 * Calculate the live schedule state for a specific lecture hall
 */
export function getHallScheduleState(hallIdInput?: string | null, currentTimeMs = Date.now()): HallScheduleState {
  const canonicalHallId = normalizeHallLocationId(hallIdInput);
  const lagosTime = getLagosTime(currentTimeMs);

  const lecture = LECTURE_SCHEDULE.find((l) => l.locationId === canonicalHallId) || LECTURE_SCHEDULE[0];
  const nextLecture = lecture; // Same recurring course for that hall in beta cycle

  // 1. Check Developer Override
  const forceParam = checkForceLectureParam();
  if (forceParam) {
    const isMatchingParam =
      forceParam === 'true' ||
      forceParam === '1' ||
      canonicalHallId.includes(forceParam) ||
      lecture.id.includes(forceParam) ||
      lecture.courseCode.toLowerCase().includes(forceParam);

    if (isMatchingParam) {
      return {
        status: 'active',
        lecture,
        nextLecture,
        timeRemainingSeconds: 9999,
        secondsUntilStart: 0,
        startsAtMs: currentTimeMs - 120000,
        endsAtMs: currentTimeMs + 9999000,
        isForced: true,
        isAcademicHours: true,
        lagosTimeString: lagosTime.timeString,
      };
    }
  }

  // 2. Beta Continuous Timetable:
  // Calculate cycle offset for this hall to provide constant rolling classes across campus
  const offsetMinutes = BETA_SCHEDULE_CONFIG.HALL_OFFSETS_MINUTES[canonicalHallId] || 0;
  const cycleDurationMs = BETA_SCHEDULE_CONFIG.CYCLE_DURATION_MINUTES * 60 * 1000;
  const lectureDurationMs = BETA_SCHEDULE_CONFIG.LECTURE_DURATION_MINUTES * 60 * 1000;

  // Shift time by hall offset
  const offsetMs = offsetMinutes * 60 * 1000;
  const shiftedTimeMs = currentTimeMs - offsetMs;

  const currentCycleStart = Math.floor(shiftedTimeMs / cycleDurationMs) * cycleDurationMs + offsetMs;
  const elapsedInCycleMs = currentTimeMs - currentCycleStart;

  // Off-hours check (e.g. weekends or 5:00 PM to 9:00 AM WAT)
  // For the beta, if it's off-hours, we still show the schedule cleanly with off_hours state
  if (lagosTime.isWeekend) {
    return {
      status: 'weekend',
      lecture,
      nextLecture,
      timeRemainingSeconds: 0,
      secondsUntilStart: 0,
      startsAtMs: currentCycleStart,
      endsAtMs: currentCycleStart + lectureDurationMs,
      isForced: false,
      isAcademicHours: false,
      lagosTimeString: lagosTime.timeString,
    };
  }

  if (lagosTime.hour < BETA_SCHEDULE_CONFIG.ACADEMIC_HOUR_START || lagosTime.hour >= BETA_SCHEDULE_CONFIG.ACADEMIC_HOUR_END) {
    return {
      status: 'off_hours',
      lecture,
      nextLecture,
      timeRemainingSeconds: 0,
      secondsUntilStart: 0,
      startsAtMs: currentCycleStart,
      endsAtMs: currentCycleStart + lectureDurationMs,
      isForced: false,
      isAcademicHours: false,
      lagosTimeString: lagosTime.timeString,
    };
  }

  // Inside Academic Hours (09:00 - 17:00 WAT Monday–Friday)
  if (elapsedInCycleMs < lectureDurationMs) {
    // ACTIVE LECTURE
    const remainingSec = Math.max(1, Math.floor((lectureDurationMs - elapsedInCycleMs) / 1000));
    return {
      status: 'active',
      lecture,
      nextLecture,
      timeRemainingSeconds: remainingSec,
      secondsUntilStart: 0,
      startsAtMs: currentCycleStart,
      endsAtMs: currentCycleStart + lectureDurationMs,
      isForced: false,
      isAcademicHours: true,
      lagosTimeString: lagosTime.timeString,
    };
  } else {
    // 3-MINUTE BREAK BETWEEN LECTURES
    const breakRemainingSec = Math.max(1, Math.floor((cycleDurationMs - elapsedInCycleMs) / 1000));
    return {
      status: 'break',
      lecture,
      nextLecture,
      timeRemainingSeconds: breakRemainingSec,
      secondsUntilStart: breakRemainingSec,
      startsAtMs: currentCycleStart + cycleDurationMs,
      endsAtMs: currentCycleStart + cycleDurationMs + lectureDurationMs,
      isForced: false,
      isAcademicHours: true,
      lagosTimeString: lagosTime.timeString,
    };
  }
}

/**
 * Get the active lecture definition for a specific hall, or null if in break/closed
 */
export function getActiveLectureForHall(hallIdInput?: string | null, currentTimeMs = Date.now()): LectureDefinition | null {
  const state = getHallScheduleState(hallIdInput, currentTimeMs);
  return state.status === 'active' ? state.lecture : null;
}

/**
 * Get next scheduled lecture for a hall
 */
export function getNextLectureForHall(hallIdInput?: string | null, currentTimeMs = Date.now()): LectureDefinition {
  const state = getHallScheduleState(hallIdInput, currentTimeMs);
  return state.nextLecture;
}

/**
 * Campus-wide active lecture finder:
 * Returns the best active lecture across campus, or the one starting soonest
 */
export function getActiveLectureForTime(currentTimeMs = Date.now()): {
  activeLecture: LectureDefinition | null;
  status: 'active' | 'upcoming' | 'none';
  timeRemainingSeconds: number;
  nextLecture: LectureDefinition | null;
  nextStartTimeText: string;
} {
  const halls = ['colfhec-lecture-hall', 'central-lecture-hall', 'colbios-lecture-hall'];
  const states = halls.map((h) => getHallScheduleState(h, currentTimeMs));

  // 1. Check if any hall has an active class right now
  const activeState = states.find((s) => s.status === 'active');
  if (activeState) {
    return {
      activeLecture: activeState.lecture,
      status: 'active',
      timeRemainingSeconds: activeState.timeRemainingSeconds,
      nextLecture: activeState.nextLecture,
      nextStartTimeText: 'In session',
    };
  }

  // 2. Otherwise pick the class starting soonest
  const breakStates = states.filter((s) => s.status === 'break');
  if (breakStates.length > 0) {
    breakStates.sort((a, b) => a.secondsUntilStart - b.secondsUntilStart);
    const soonest = breakStates[0];
    const mins = Math.ceil(soonest.secondsUntilStart / 60);
    return {
      activeLecture: null,
      status: 'upcoming',
      timeRemainingSeconds: soonest.secondsUntilStart,
      nextLecture: soonest.nextLecture,
      nextStartTimeText: `In ${mins} min`,
    };
  }

  // 3. Off hours / weekend
  const defaultHall = states[0];
  return {
    activeLecture: null,
    status: 'none',
    timeRemainingSeconds: 0,
    nextLecture: defaultHall.lecture,
    nextStartTimeText: 'Classes resume 9:00 AM WAT',
  };
}

export function getNextLecture(currentTimeMs = Date.now()): LectureDefinition {
  const info = getActiveLectureForTime(currentTimeMs);
  return info.nextLecture || LECTURE_SCHEDULE[0];
}

export function getAllCampusLecturesStatus(currentTimeMs = Date.now()): Record<string, HallScheduleState> {
  return {
    'colfhec-lecture-hall': getHallScheduleState('colfhec-lecture-hall', currentTimeMs),
    'central-lecture-hall': getHallScheduleState('central-lecture-hall', currentTimeMs),
    'colbios-lecture-hall': getHallScheduleState('colbios-lecture-hall', currentTimeMs),
  };
}
