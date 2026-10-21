// Who shows on the campus map: other students on campus, friends flagged (by id or username),
// yourself, blocked students and anyone in a lecture hall left out, friends drawn last.
// Run: npm run test:map-people
import assert from 'node:assert/strict';
import { mapPeople } from '../src/config/mapPeople';

const player = (id: string, username: string, x: number, z: number, extra: object = {}) =>
  ({ id, connectionId: `c-${id}`, username, college: 'COLENG', position: [x, 0, z], rotation: 0, animation: 'idle', avatarConfig: {}, lastUpdated: 0, ...extra }) as any;

const players = {
  'c-me': player('me', 'Denarius', 0, 0),
  'c-ada': player('ada', 'Ada', 10, 5),
  'c-bola': player('bola', 'Bola', -20, 40),
  'c-chi': player('chi', 'Chi', 3, 3, { currentLectureId: 'fst-101' }),
  'c-dan': player('dan', 'Dan', 7, 7),
  'c-eve': player('eve', 'Eve', Number.NaN, 0),
  'c-fola': player('fola', 'Fola', 1, 2),
};
const people = mapPeople(players, { id: 'me', username: 'Denarius' }, [{ id: 'bola', username: 'Bola' }, { id: 'old-id', username: 'FOLA' }], ['dan']);
const names = people.map((p) => p.username);

assert(!names.includes('Denarius'), 'not yourself');
assert(!names.includes('Chi'), 'not students inside a lecture hall');
assert(!names.includes('Dan'), 'not blocked students');
assert(!names.includes('Eve'), 'not a broken position');
assert.deepEqual(names, ['Ada', 'Bola', 'Fola'], 'friends drawn last, on top');
assert.equal(people.find((p) => p.username === 'Bola')!.friend, true, 'friend by id');
assert.equal(people.find((p) => p.username === 'Fola')!.friend, true, 'friend by username (any case)');
assert.equal(people.find((p) => p.username === 'Ada')!.friend, false);
assert.deepEqual([people[0].x, people[0].z], [10, 5], 'map position is x/z');
assert.deepEqual(mapPeople({}, null, [], []), [], 'nobody online');
console.log('MAP PEOPLE PASSED: other students shown, friends flagged by id or name, self/blocked/in-lecture/broken left out, friends on top.');
