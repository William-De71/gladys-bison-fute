import { test } from 'node:test';
import assert from 'node:assert/strict';

import { localClock, addDays, zonedInstant, nextMidnight, displayInstant } from '../src/time.js';

test('the local day and time, across a DST change', () => {
  assert.deepEqual(localClock(Date.parse('2026-10-17T19:00:00Z'), 'Europe/Paris'), {
    date: '2026-10-17',
    minutes: 21 * 60,
  });
  assert.deepEqual(localClock(Date.parse('2026-10-25T12:00:00Z'), 'Europe/Paris'), {
    date: '2026-10-25',
    minutes: 13 * 60,
  });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(
    new Date(zonedInstant('2026-10-25', 6 * 60, 'Europe/Paris')).toISOString(),
    '2026-10-25T05:00:00.000Z',
  );
  assert.equal(
    new Date(nextMidnight(Date.parse('2026-10-17T19:00:00Z'), 'Europe/Paris')).toISOString(),
    '2026-10-17T22:01:00.000Z',
  );
  assert.equal(displayInstant('2026-10-23'), '2026-10-23T00:00:00.000Z');
});
