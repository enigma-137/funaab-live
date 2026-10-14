import { LectureDefinition, LectureScriptAction } from '../types/game';
import { ECONOMY_CONFIG } from './economy';
import { getLagosTime } from '../utils/lagosTime';
import { DEFAULT_LECTURE_HALL_ID, LECTURE_HALLS, getLectureHall } from './lectureHalls';

export const BETA_SCHEDULE_CONFIG = {
  LECTURE_DURATION_MINUTES: 12,
  BREAK_DURATION_MINUTES: 3,
  CYCLE_DURATION_MINUTES: 15, // 12 mins lecture + 3 mins break = 15 min cycles
  ACADEMIC_HOUR_START: 9,     // 9:00 AM WAT
  ACADEMIC_HOUR_END: 17,      // 5:00 PM (17:00) WAT
  // Staggered starts per hall (COLFHEC :00, CLT :05, COLBIOS :10, ...) come from the hall config.
  HALL_OFFSETS_MINUTES: Object.fromEntries(LECTURE_HALLS.map((h) => [h.id, h.scheduleOffsetMinutes])) as Record<string, number>,
};


// Compact definition for college lectures: five beats over ~3.5 minutes of the 12-minute slot.
function collegeLecture(
  collegeLocationId: string,
  id: string,
  courseCode: string,
  title: string,
  lecturerName: string,
  lecturerTitle: string,
  shirtColor: string,
  skinColor: string,
  description: string,
  beats: Array<[string, string]>
): LectureDefinition {
  const hall = LECTURE_HALLS.find((h) => h.collegeLocationId === collegeLocationId && h.id === `${collegeLocationId}-lecture-hall`)!;
  const times = [0, 20, 60, 110, 200];
  const actions: LectureScriptAction['action'][] = ['speak', 'board', 'speak', 'gesture', 'speak'];
  return {
    id,
    courseCode,
    title,
    college: hall.collegeCode,
    locationId: hall.id,
    locationName: hall.hallName,
    lecturerName,
    lecturerTitle,
    lecturerAvatar: { shirtColor, skinColor },
    durationMinutes: 12,
    maxCapacity: 30,
    attendanceAllowance: ECONOMY_CONFIG.ATTENDANCE_ALLOWANCE,
    description,
    timeline: beats.map(([text, boardTopic], i) => ({ atSeconds: times[i] ?? i * 40, action: actions[i] ?? 'speak', text, boardTopic })),
  };
}

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
    attendanceAllowance: ECONOMY_CONFIG.ATTENDANCE_ALLOWANCE,
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
    attendanceAllowance: ECONOMY_CONFIG.ATTENDANCE_ALLOWANCE,
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
    attendanceAllowance: ECONOMY_CONFIG.ATTENDANCE_ALLOWANCE,
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
  ...[
    collegeLecture('coleng', 'funaab-cve-201', 'CVE 201', 'Strength of Materials', 'Engr. Dr. Okonkwo', 'Senior Lecturer, Civil Engineering', '#1e3a8a', '#6b4423',
      'Stress, strain and the elastic behaviour of steel and timber members used in farm structures.', [
        ['Good morning, engineers. CVE 201 — Strength of Materials. Notebooks out, please.', 'CVE 201: Strength of Materials\nTopic: Stress, Strain & Hooke\'s Law'],
        ['Stress is force per unit area. Strain is the change in length over the original length.', 'σ = F / A   (N/m² = Pa)\nε = ΔL / L₀   (dimensionless)'],
        ['Within the elastic limit, stress is proportional to strain. That constant is Young\'s modulus.', 'Hooke\'s Law: σ = E·ε\nE(steel) ≈ 200 GPa   E(timber) ≈ 10 GPa'],
        ['Why do we prefer steel over timber for a long-span grain store roof? Raise your hand.', 'Design check: σ_working ≤ σ_yield / Factor of Safety'],
        ['Good. Next week we load a mild steel bar in the structures laboratory. Class dismissed!', 'Class Dismissed!\nLab: Tensile test of mild steel'],
      ]),
    collegeLecture('colvet', 'funaab-vet-201', 'VET 201', 'Veterinary Anatomy I', 'Dr. Salami', 'Lecturer, Veterinary Anatomy', '#7f1d1d', '#8d5524',
      'Topographic anatomy of the bovine forelimb and the principles of comparative osteology.', [
        ['Welcome to VET 201. Today we start the forelimb of the ox.', 'VET 201: Veterinary Anatomy I\nTopic: Bovine Forelimb Osteology'],
        ['The scapula, humerus, radius and ulna form the proximal forelimb skeleton.', 'Scapula → Humerus → Radius & Ulna → Carpus → Metacarpus'],
        ['Notice that in ruminants the radius and ulna are partially fused. Compare this with the dog.', 'Comparative: Ox (fused radius-ulna) vs Dog (separate)'],
        ['Who can name the joint between the humerus and the radius? Raise your hand.', 'Joints: Shoulder • Elbow • Carpal'],
        ['Correct. Revise the bone specimens in the museum before Thursday\'s practical. Dismissed!', 'Class Dismissed!\nPractical: Bone identification'],
      ]),
    collegeLecture('colanim', 'funaab-anp-201', 'ANP 201', 'Introduction to Animal Production', 'Prof. Adebayo', 'Professor of Animal Production', '#9a3412', '#5c381e',
      'Livestock systems in Nigeria, feed conversion and the economics of poultry and small ruminant farms.', [
        ['Good afternoon. ANP 201 — Introduction to Animal Production.', 'ANP 201: Introduction to Animal Production\nTopic: Livestock Systems in Nigeria'],
        ['We keep poultry, goats, sheep, pigs and cattle under extensive, semi-intensive and intensive systems.', 'Systems: Extensive • Semi-intensive • Intensive'],
        ['Feed is about seventy percent of production cost, so feed conversion ratio matters.', 'FCR = Feed consumed (kg) / Weight gain (kg)\nBroilers ≈ 1.7 – 2.0'],
        ['If a broiler eats 4kg of feed and gains 2kg, what is the FCR? Raise your hand.', 'Worked example: 4 kg ÷ 2 kg = ?'],
        ['Exactly, two. Visit the university poultry unit this week to see it in practice. Dismissed!', 'Class Dismissed!\nVisit: FUNAAB Poultry Unit'],
      ]),
    collegeLecture('colplant', 'funaab-hrt-201', 'HRT 201', 'Principles of Horticulture', 'Dr. Mrs. Ogunleye', 'Senior Lecturer, Horticulture', '#3f6212', '#8d5524',
      'Propagation of fruit and vegetable crops: seeds, cuttings, budding and grafting.', [
        ['Welcome to HRT 201 — Principles of Horticulture.', 'HRT 201: Principles of Horticulture\nTopic: Plant Propagation'],
        ['Plants are propagated sexually by seed or asexually by cuttings, layering, budding and grafting.', 'Sexual: Seed\nAsexual: Cuttings • Layering • Budding • Grafting'],
        ['Grafting joins a scion to a rootstock. Mango and citrus orchards depend on it.', 'Graft union: Scion + Rootstock\nKeys: Cambium contact, clean cut, tight tie'],
        ['Why would a farmer graft instead of planting seeds? Raise your hand.', 'Advantages: True-to-type • Early fruiting • Disease-tolerant rootstock'],
        ['Well done. We graft citrus seedlings at the nursery next week. Dismissed!', 'Class Dismissed!\nPractical: Citrus budding'],
      ]),
    collegeLecture('colerm', 'funaab-emt-201', 'EMT 201', 'Principles of Environmental Management', 'Dr. Ibrahim', 'Lecturer, Environmental Management & Toxicology', '#115e59', '#5c381e',
      'Environmental impact assessment, water quality indicators and sustainable resource use.', [
        ['Good morning. EMT 201 — Principles of Environmental Management.', 'EMT 201: Environmental Management\nTopic: Environmental Impact Assessment'],
        ['An EIA predicts the effects of a project on air, water, soil and people before it begins.', 'EIA stages: Screening → Scoping → Assessment → Mitigation → Monitoring'],
        ['For rivers we track dissolved oxygen, BOD, turbidity and pH.', 'Water quality: DO • BOD • Turbidity • pH'],
        ['What happens to dissolved oxygen when untreated waste enters the Ogun River? Raise your hand.', 'Organic load ↑ → BOD ↑ → DO ↓'],
        ['Correct. Read the EIA case study on the course page before our next class. Dismissed!', 'Class Dismissed!\nReading: EIA case study'],
      ]),
    collegeLecture('colcoms', 'funaab-cyb-201', 'CYB 201', 'Foundations of Cyber Security', 'Dr. Eze', 'Lecturer, Cyber Security', '#312e81', '#8d5524',
      'The CIA triad, common attacks and the basics of protecting accounts and networks.', [
        ['Welcome to CYB 201 — Foundations of Cyber Security.', 'CYB 201: Foundations of Cyber Security\nTopic: The CIA Triad'],
        ['Security protects Confidentiality, Integrity and Availability of information.', 'C — Confidentiality\nI — Integrity\nA — Availability'],
        ['Phishing attacks confidentiality. Ransomware attacks availability.', 'Threats: Phishing • Malware • Ransomware • DDoS'],
        ['Which part of the triad does a strong password protect? Raise your hand.', 'Defences: MFA • Strong passwords • Updates • Backups'],
        ['Right. Turn on two-factor authentication on your student email today. Dismissed!', 'Class Dismissed!\nTask: Enable MFA'],
      ]),
    collegeLecture('collend', 'funaab-ets-201', 'ETS 201', 'Introduction to Entrepreneurship', 'Dr. Olabisi', 'Senior Lecturer, Accounting', '#78350f', '#663c28',
      'Spotting opportunities, testing an idea cheaply and keeping clean books from day one.', [
        ['Good day, everyone. ETS 201 — Introduction to Entrepreneurship.', 'ETS 201: Introduction to Entrepreneurship\nTopic: From Idea to Business'],
        ['Every business starts with a problem people will pay to solve.', 'Problem → Solution → Customer → Price'],
        ['Test small first: sell ten before you build a hundred.', 'Validate: Ask • Pre-sell • Pilot • Learn'],
        ['Why should you separate your business money from your pocket money? Raise your hand.', 'Bookkeeping: Income − Expenses = Profit'],
        ['Exactly — or you will never know if you made profit. Write your idea in one sentence before next class. Dismissed!', 'Class Dismissed!\nTask: One-line business idea'],
      ]),
    collegeLecture('colphys', 'funaab-phy-201', 'PHY 201', 'Mechanics & Properties of Matter', 'Dr. Akinola', 'Senior Lecturer, Physics', '#4c1d95', '#6b4423',
      'Newton\'s laws, momentum and the elastic properties of solids and fluids.', [
        ['Good afternoon, physicists. PHY 201 — Mechanics and Properties of Matter.', 'PHY 201: Mechanics & Properties of Matter\nTopic: Newton\'s Laws & Momentum'],
        ['Newton\'s second law: force equals the rate of change of momentum.', 'F = dp/dt = m·a\np = m·v   (kg·m/s)'],
        ['In a collision with no external force, total momentum is conserved.', 'm₁u₁ + m₂u₂ = m₁v₁ + m₂v₂'],
        ['A 2kg ball moving at 3m/s hits a resting 1kg ball and stops. How fast does the second ball move? Raise your hand.', '2·3 + 1·0 = 2·0 + 1·v   →   v = ?'],
        ['Six metres per second. Attempt problem set two before the tutorial. Class dismissed!', 'Class Dismissed!\nProblem Set 2'],
      ]),
  ],
];

/**
 * Normalizes any hall ID or alias (e.g. 'lecture-hall-colfhec', 'funaab-fst-201', 'colfhec')
 * to standard canonical locationId: 'colfhec-lecture-hall' | 'central-lecture-hall' | 'colbios-lecture-hall'
 */
export function normalizeHallLocationId(input?: string | null): string {
  if (!input) return DEFAULT_LECTURE_HALL_ID;
  const s = input.toLowerCase();
  // Exact hall ids, world interactable ids and college location ids (e.g. 'coleng').
  const hall = LECTURE_HALLS.find((h) => h.id === s || h.interactableId === s || h.collegeLocationId === s);
  if (hall) return hall.id;
  const lecture = LECTURE_SCHEDULE.find((l) => l.id === s);
  if (lecture) return lecture.locationId;
  // Legacy aliases kept for old links and `?forceLecture=` values.
  if (s.includes('central') || s.includes('clt') || s.includes('203')) {
    return 'central-lecture-hall';
  }
  if (s.includes('colbios') || s.includes('bio') || s.includes('205')) {
    return 'colbios-lecture-hall';
  }
  return DEFAULT_LECTURE_HALL_ID;
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
  const halls = LECTURE_HALLS.map((h) => h.id);
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
  return Object.fromEntries(LECTURE_HALLS.map((h) => [h.id, getHallScheduleState(h.id, currentTimeMs)]));
}

export const hallDisplayName = (hallId?: string | null) => getLectureHall(normalizeHallLocationId(hallId)).hallName;
