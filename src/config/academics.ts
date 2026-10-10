import { collegeCatalogue } from './campusLocations';

// The campus catalogue is themed for play, not official admissions guidance.
export const courses = [
  ['AGE', 'Agricultural Engineering', 'COLENG', 60],
  ['CVE', 'Civil Engineering', 'COLENG', 65],
  ['MEE', 'Mechanical Engineering', 'COLENG', 65],
  ['FST', 'Food Science and Technology', 'COLFHEC', 60],
  ['NTD', 'Nutrition and Dietetics', 'COLFHEC', 58],
  ['HSM', 'Home Science and Management', 'COLFHEC', 0],
  ['AEC', 'Agricultural Economics', 'COLAMRUD', 50],
  ['ARD', 'Agricultural Extension and Rural Development', 'COLAMRUD', 0],
  ['CPT', 'Crop Protection', 'COLPLANT', 0],
  ['HRT', 'Horticulture', 'COLPLANT', 48],
  ['ANP', 'Animal Production and Health', 'COLANIM', 50],
  ['ANN', 'Animal Nutrition', 'COLANIM', 0],
  ['VET', 'Veterinary Medicine', 'COLVET', 68],
  ['BCH', 'Biochemistry', 'COLBIOS', 60],
  ['MCB', 'Microbiology', 'COLBIOS', 58],
  ['BIO', 'Biological Sciences', 'COLBIOS', 0],
  ['CSC', 'Computer Science', 'COLPHYS', 65],
  ['MTH', 'Mathematics', 'COLPHYS', 0],
  ['PHY', 'Physics', 'COLPHYS', 48],
].map(([id, name, college, cutoff]) => ({
  id: String(id),
  name: String(name),
  college: String(college),
  gameCutoffRange: [Number(cutoff), Number(cutoff) + 5] as [number, number],
}));
export const courseById = (id?: string | null) => courses.find((c) => c.id === id);
// Keep the existing admission choices until courses for new physical colleges are added.
export const colleges = collegeCatalogue.filter(c=>courses.some(course=>course.college===c.code));
