import { campusLocations, collegeCatalogue, locationById, CAMPUS_BOUNDS, type Point } from './campusLocations';
import { roadNodes, roadEdges } from './kekeRoutes';
import { pedestrianPaths } from './campusWorld';

export type CampusCategory =
  | 'college'
  | 'academic'
  | 'hostel'
  | 'library'
  | 'transport'
  | 'food'
  | 'sports'
  | 'health'
  | 'admin'
  | 'service'
  | 'landmark';

export interface CampusRegistryLocation {
  id: string;
  name: string;
  shortName: string;
  category: CampusCategory;
  categoryLabel: string;
  position: Point;
  entrance: Point;
  kekeStop: Point;
  footprint: [number, number]; // [width (X), depth (Z)] in meters
  description: string;
  icon: string;
  color: string;
  accessible: boolean;
  interactiveModal?: string;
  code?: string;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Extracted from verified world bounds
export const CAMPUS_MAP_BOUNDS: MapBounds = {
  minX: -140,
  maxX: 140,
  minZ: -135,
  maxZ: 105,
};

// Rich mapping metadata for all verified campus buildings
const locationMetadata: Record<
  string,
  {
    category: CampusCategory;
    categoryLabel: string;
    icon: string;
    color: string;
    description: string;
    interactiveModal?: string;
  }
> = {
  'main-gate': {
    category: 'landmark',
    categoryLabel: 'Gate & Landmark',
    icon: '⛩️',
    color: '#15803d',
    description: 'Ceremonial main campus gate featuring twin security wings, national and university flagpoles, and the university monument.',
  },
  'w-landmark': {
    category: 'landmark',
    categoryLabel: 'Gate & Landmark',
    icon: '⭐',
    color: '#475569',
    description: 'The iconic Twin-Triangle "W" ceremonial monument and student gathering quadrangle.',
  },
  'car-park': {
    category: 'transport',
    categoryLabel: 'Transport',
    icon: '🛺',
    color: '#eab308',
    description: 'Central transport park and Keke terminal for inter-campus shuttle rides across all faculties.',
    interactiveModal: 'keke_destination',
  },
  'sports-centre': {
    category: 'sports',
    categoryLabel: 'Sports & Recreation',
    icon: '⚽',
    color: '#10b981',
    description: 'Football pitch (penalty challenge) with the basketball and volleyball courts beside it, and Acad next door.',
  },
  'food-court': {
    category: 'food',
    categoryLabel: 'Food & Dining',
    icon: '🍲',
    color: '#f97316',
    description: 'Campus buka, cold drink stalls, and quick snacks adjacent to the sports fields.',
    interactiveModal: 'food',
  },
  'floral-world': {
    category: 'food',
    categoryLabel: 'Food & Dining',
    icon: '🍚',
    color: '#f59e0b',
    description: 'Floral World Bukka & Student Canteen: popular campus eatery for hot jollof, amala, pastries, and drinks.',
    interactiveModal: 'floral_world',
  },
  'health-centre': {
    category: 'health',
    categoryLabel: 'Health & Wellness',
    icon: '🏥',
    color: '#ef4444',
    description: 'University Health Services Clinic, outpatient pharmacy, emergency bay, and nursing station.',
  },
  'bank-atm': {
    category: 'service',
    categoryLabel: 'Campus Services',
    icon: '🏧',
    color: '#059669',
    description: 'FUNAAB Microfinance Bank & 24/7 ATM Gallery for cash withdrawal, deposits, and banking.',
    interactiveModal: 'bank',
  },
  'senate-library': {
    category: 'admin',
    categoryLabel: 'Administration',
    icon: '🏢',
    color: '#6366f1',
    description: 'Senate Building, Vice Chancellor\'s office, and Central University Administrative Registry.',
  },
  library: {
    category: 'library',
    categoryLabel: 'Library',
    icon: '📚',
    color: '#0284c7',
    description: '\'Nimbe Adedipe Central University Library: student study halls, reference archives, and covered lobby.',
    interactiveModal: 'library',
  },
  colfhec: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#16a34a',
    description: 'College of Food Science and Human Ecology: Departmental laboratories, lecture rooms, and courtyard.',
    interactiveModal: 'lecture_hall',
  },
  coleng: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#2563eb',
    description: 'College of Engineering: Mechanical, Civil, Electrical workshops, and lecture theatres. Lecture hall entrance at the college forecourt.',
    interactiveModal: 'lecture_hall',
  },
  colerm: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#0d9488',
    description: 'College of Environmental Resources Management: Forestry, Wildlife, and Water Resources sciences. Lecture hall entrance at the college forecourt.',
    interactiveModal: 'lecture_hall',
  },
  colplant: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#65a30d',
    description: 'College of Plant Science and Crop Production: Agronomy, Horticulture, and Crop Protection research blocks. Lecture hall entrance at the college forecourt.',
    interactiveModal: 'lecture_hall',
  },
  colanim: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#ea580c',
    description: 'College of Animal Science and Livestock Production: Animal Nutrition, Breeding, and Pasture studies. Lecture hall entrance at the college forecourt.',
    interactiveModal: 'lecture_hall',
  },
  colvet: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#dc2626',
    description: 'College of Veterinary Medicine: Veterinary teaching complex, pathology labs, and clinics. Lecture hall entrance at the college forecourt.',
    interactiveModal: 'lecture_hall',
  },
  colcoms: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#4f46e5',
    description: 'College of Computing Sciences: Computer Science, Cyber Security, Software Engineering labs, and IT halls. Lecture hall entrance at the college forecourt.',
    interactiveModal: 'lecture_hall',
  },
  colamrud: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#15803d',
    description: 'College of Agricultural Management and Rural Development: Agricultural Administration, Agricultural Economics and Farm Management, and Agricultural Extension and Rural Development. Beside Acad.',
    interactiveModal: 'lecture_hall',
  },
  collend: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#b45309',
    description: 'College of Entrepreneurial and Development Studies: Accounting, Entrepreneurial Studies, and Library and Information Studies.',
  },
  colphys: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#7c3aed',
    description: 'College of Physical Sciences: Physics, Chemistry, Mathematics and Statistics teaching blocks with the COLPHYS Lecture Hall at its forecourt.',
    interactiveModal: 'lecture_hall',
  },
  colbios: {
    category: 'college',
    categoryLabel: 'College / Faculty',
    icon: '🏛️',
    color: '#059669',
    description: 'College of Biological Sciences: Biochemistry, Microbiology, and Zoology lecture auditoriums.',
  },
  'hostel-social': {
    category: 'hostel',
    categoryLabel: 'Hostel & Residence',
    icon: '🏠',
    color: '#ec4899',
    description: 'Iyalode Tinubu Female Hostel block and central student social relaxation plaza.',
    interactiveModal: 'hostel',
  },
  'ps-room': {
    category: 'service',
    categoryLabel: 'Entertainment',
    icon: '🎮',
    color: '#8b5cf6',
    description: 'Campus Game Den: competitive PlayStation 5 gaming lounge and penalty shootout matches.',
    interactiveModal: 'ps_match',
  },
  agromet: {
    category: 'academic',
    categoryLabel: 'Research',
    icon: '⛅',
    color: '#06b6d4',
    description: 'FUNAAB Meteorological Observatory: weather recording instruments, sunshine recorder, and agromet masts.',
  },
  'colfhec-lecture-hall': {
    category: 'academic',
    categoryLabel: 'Lecture Hall',
    icon: '🎓',
    color: '#16a34a',
    description: 'COLFHEC Dedicated Lecture Hall: 250-capacity tiered lecture theatre with podium and projector.',
    interactiveModal: 'lecture_hall',
  },
  'party-hall': {
    category: 'landmark',
    categoryLabel: 'Night Party & Arcade',
    icon: '🪩',
    color: '#7c3aed',
    description: 'The Arena: dance floor with party lights, the Arena Bar, tic-tac-toe and pool. Open every night 7 PM–5 AM; ₦5,000 gate fee covers the whole night.',
  },
  'fpy-farm': {
    category: 'landmark',
    categoryLabel: 'Teaching Farm',
    icon: '🌱',
    color: '#3f7d2c',
    description: 'FPY Teaching & Research Farm: Farm Practical Year students in green jumpsuits plant, water and harvest. Take a farm shift (Hustles) to earn.',
  },
  acad: {
    category: 'academic',
    categoryLabel: 'Academic Building',
    icon: '🏫',
    color: '#db2777',
    description: 'Acad: the three-storey Academic Building with pink and brick bays, right beside the Sports Centre and its courts.',
  },
  'sports-courts': {
    category: 'sports',
    categoryLabel: 'Sports & Recreation',
    icon: '🏀',
    color: '#ea580c',
    description: 'Basketball court (free-throw challenge, 1v1 shootouts) and volleyball court (serve challenge, 1v1 serve-offs), beside the Sports Centre.',
    interactiveModal: 'basketball',
  },
  'central-lecture-hall': {
    category: 'academic',
    categoryLabel: 'Lecture Hall',
    icon: '🎓',
    color: '#3b82f6',
    description: 'Central University Lecture Theatre: general university courses (GNS) and symposium hall.',
    interactiveModal: 'lecture_hall',
  },
  'colbios-lecture-hall': {
    category: 'academic',
    categoryLabel: 'Lecture Hall',
    icon: '🎓',
    color: '#059669',
    description: 'COLBIOS Amphitheatre: biological science large lectures and matriculation orientation.',
    interactiveModal: 'lecture_hall',
  },
};

// Compile centralized registry containing all real locations
export const campusRegistry: CampusRegistryLocation[] = campusLocations
  .filter((loc) => loc.mapVisible && loc.id !== 'ceremonial-road')
  .map((loc) => {
    const meta = locationMetadata[loc.id] || {
      category: (loc.type as CampusCategory) || 'academic',
      categoryLabel: loc.type ? loc.type.charAt(0).toUpperCase() + loc.type.slice(1) : 'Location',
      icon: '📍',
      color: '#10b981',
      description: loc.description || 'Campus facility.',
    };

    const college = collegeCatalogue.find((c) => c.code === loc.shortName);

    return {
      id: loc.id,
      name: loc.name,
      shortName: loc.shortName,
      category: meta.category,
      categoryLabel: meta.categoryLabel,
      position: loc.position,
      entrance: loc.entrance,
      kekeStop: loc.kekeStop,
      footprint: loc.footprint,
      description: meta.description,
      icon: meta.icon,
      color: college ? college.color : meta.color,
      accessible: true,
      interactiveModal: meta.interactiveModal,
      code: college ? college.code : undefined,
    };
  });

/**
 * Get all registered locations in the game world
 */
export function getAllCampusLocations(): CampusRegistryLocation[] {
  return campusRegistry;
}

/**
 * Find location by its unique ID
 */
export function getCampusLocationById(id: string): CampusRegistryLocation | undefined {
  return campusRegistry.find((l) => l.id === id);
}

/**
 * Find locations belonging to a specific category
 */
export function getCampusLocationsByCategory(category: CampusCategory): CampusRegistryLocation[] {
  return campusRegistry.filter((l) => l.category === category);
}

/**
 * Find nearest campus location to a given 3D world coordinate
 */
export function getNearestCampusLocation(pos: Point): { location: CampusRegistryLocation; distance: number } {
  const sorted = [...campusRegistry]
    .map((l) => ({
      location: l,
      distance: Math.hypot(pos[0] - l.position[0], pos[2] - l.position[2]),
    }))
    .sort((a, b) => a.distance - b.distance);

  return sorted[0];
}

/**
 * Get road network nodes and edges from existing world data
 */
export function getCampusRoadNetwork() {
  return {
    nodes: roadNodes,
    edges: roadEdges,
    pedestrianPaths,
  };
}

/**
 * Coordinate converter: 3D world [X, Z] to normalized percentage [0-100%]
 * North (-Z) is Top (0%), South (+Z) is Bottom (100%)
 * West (-X) is Left (0%), East (+X) is Right (100%)
 */
export function worldToMapPercent(x: number, z: number, bounds = CAMPUS_MAP_BOUNDS) {
  const xPercent = ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100;
  const yPercent = ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * 100;

  return {
    xPercent: Math.max(0, Math.min(100, xPercent)),
    yPercent: Math.max(0, Math.min(100, yPercent)),
  };
}

/**
 * Coordinate converter: 3D world [X, Z] to SVG pixels
 */
export function worldToSvgCoords(
  x: number,
  z: number,
  svgWidth = 1000,
  svgHeight = 880,
  margin = 40,
  bounds = CAMPUS_MAP_BOUNDS
) {
  const innerW = svgWidth - margin * 2;
  const innerH = svgHeight - margin * 2;

  const svgX = margin + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * innerW;
  const svgY = margin + ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * innerH;

  return { svgX, svgY };
}
