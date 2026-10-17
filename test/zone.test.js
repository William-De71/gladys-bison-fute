import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  haversine,
  segmentDistance,
  distanceTo,
  parseRoads,
  eventsOfPlace,
  countByCategory,
} from '../src/zone.js';
import { parseSituations } from '../src/datex.js';
import { SNAPSHOT, NOW } from './helpers/fixtures.js';

const { events } = parseSituations(SNAPSHOT);
const CRETEIL = { latitude: 48.7904, longitude: 2.4556, radius: 25, roads: [] };

test('distances: great circle, to a segment, to an event', () => {
  // Paris (Notre-Dame) to Lyon (Bellecour): 392 km.
  assert.equal(Math.round(haversine([48.853, 2.3499], [45.7578, 4.832])), 392);
  // A point beside the middle of a north-south segment.
  const beside = segmentDistance([45.5, 5.01], [45, 5], [46, 5]);
  assert.ok(beside > 0.7 && beside < 0.85, String(beside));
  // Beyond its end: the distance to the end.
  assert.equal(
    Math.round(segmentDistance([47, 5], [45, 5], [46, 5])),
    Math.round(haversine([47, 5], [46, 5])),
  );
  assert.equal(distanceTo([45, 5], { points: [], segments: [] }), Infinity);
});

test('the events of a zone: active ones by importance, planned ones by start', () => {
  const { active, planned } = eventsOfPlace(events, CRETEIL, NOW);
  assert.deepEqual(
    active.map((event) => [event.category, event.road]),
    [
      ['closure', 'A15'],
      ['accident', 'N406'],
      ['obstruction', 'A3'],
      ['roadworks', 'A15'],
      ['restriction', 'A86'],
      ['restriction', 'N118'],
    ],
  );
  assert.equal(active[1].distance, 4.1);
  assert.ok(planned.length > 0);
  assert.ok(planned.every((event, i) => i === 0 || planned[i - 1].start <= event.start));
  assert.ok(planned.every((event) => event.status === 'planned'));
  assert.deepEqual(countByCategory(active), {
    total: 6,
    closure: 1,
    accident: 1,
    obstruction: 1,
    congestion: 0,
    conditions: 0,
    roadworks: 1,
    restriction: 2,
    other: 0,
  });
});

test('a smaller radius and a list of roads narrow the zone', () => {
  assert.equal(eventsOfPlace(events, { ...CRETEIL, radius: 5 }, NOW).active.length, 2);
  const roads = eventsOfPlace(events, { ...CRETEIL, roads: ['N406', 'A86'] }, NOW);
  assert.deepEqual(
    roads.active.map((event) => event.road),
    ['N406', 'A86'],
  );
  assert.deepEqual(parseRoads('rn 406, A86; a86\nN0118'), ['N406', 'A86', 'N118']);
  assert.deepEqual(parseRoads(''), []);
});
