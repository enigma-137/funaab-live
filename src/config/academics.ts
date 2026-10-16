import { collegeCatalogue } from './campusLocations';

// The campus catalogue is themed for play, not official admissions guidance.
export const courses = [
  // COLENG: the five departments on funaab.edu.ng (mirrored in SQL, latest in 014).
  ['AGE', 'Agricultural and Bio-Resources Engineering', 'COLENG', 60],
  ['CVE', 'Civil Engineering', 'COLENG', 65],
  ['EEE', 'Electrical and Electronics Engineering', 'COLENG', 65],
  ['MEE', 'Mechanical Engineering', 'COLENG', 65],
  ['MCE', 'Mechatronics Engineering', 'COLENG', 63],
  ['FST', 'Food Science and Technology', 'COLFHEC', 60],
  ['NTD', 'Nutrition and Dietetics', 'COLFHEC', 58],
  ['HSM', 'Home Science and Management', 'COLFHEC', 0],
  ['HTM', 'Hospitality and Tourism Management', 'COLFHEC', 55],
  ['CTX', 'Clothing and Textiles', 'COLFHEC', 50], // migration 035
  // COLERM (migration 025).
  ['AQFM', 'Aquaculture and Fisheries Management', 'COLERM', 50],
  ['EMT', 'Environmental Management and Toxicology', 'COLERM', 55],
  ['FWM', 'Forestry and Wildlife Management', 'COLERM', 48],
  ['WMA', 'Water Resources Management and Agrometeorology', 'COLERM', 50],
  ['GLY', 'Geology', 'COLERM', 52], // migration 026
  ['AEC', 'Agricultural Economics and Farm Management', 'COLAMRUD', 50], // renamed in migration 037
  ['ARD', 'Agricultural Extension and Rural Development', 'COLAMRUD', 0],
  ['AAD', 'Agricultural Administration', 'COLAMRUD', 48], // migration 036
  ['CPT', 'Crop Protection', 'COLPLANT', 0],
  ['HRT', 'Horticulture', 'COLPLANT', 48],
  ['ANP', 'Animal Production and Health', 'COLANIM', 50],
  ['ANN', 'Animal Nutrition', 'COLANIM', 0],
  ['VET', 'Veterinary Medicine', 'COLVET', 68],
  ['BCH', 'Biochemistry', 'COLBIOS', 60],
  ['MCB', 'Microbiology', 'COLBIOS', 58],
  ['BIO', 'Biological Sciences', 'COLBIOS', 0],
  ['ZOO', 'Zoology', 'COLBIOS', 55], // migration 042 (a student asked)
  // COLCOMS (migration 028). Computer Science moved here from COLPHYS.
  ['CSC', 'Computer Science', 'COLCOMS', 65],
  ['ICT', 'Information Technology and Information Communication Technology', 'COLCOMS', 58],
  ['SEI', 'Software Engineering and Information Systems', 'COLCOMS', 63],
  ['CDS', 'Cyber Security and Data Science', 'COLCOMS', 62],
  // COLLEND (migration 030).
  ['ACC', 'Accounting', 'COLLEND', 58],
  ['ETS', 'Entrepreneurial Studies', 'COLLEND', 50],
  ['LIS', 'Library and Information Studies', 'COLLEND', 48],
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
