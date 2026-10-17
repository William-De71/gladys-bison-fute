import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseForecasts,
  departmentKey,
  readPair,
  isoDate,
  colouredDays,
  worst,
} from '../src/forecast.js';
import { FORECASTS } from './helpers/fixtures.js';

test('the forecasts of the wanted departments, from a date on', () => {
  const parsed = parseForecasts(FORECASTS, { departments: ['94', '01', '2A'], from: '2026-10-17' });
  assert.deepEqual(Object.keys(parsed.byDepartment).sort(), ['1', '94']);
  assert.deepEqual(parsed.byDepartment['94']['2026-10-17'], { departure: 1, return: 0 });
  assert.deepEqual(parsed.byDepartment['94']['2026-10-23'], { departure: 1, return: 1 });
  assert.deepEqual(parsed.national['2026-10-17'], { departure: 0, return: 0 });
  assert.equal(parsed.byDepartment['94']['2026-10-16'], undefined);
  assert.equal(parsed.byDepartment['94']['2027-01-31'] !== undefined, true);
});

test('codes, pairs and dates', () => {
  assert.equal(departmentKey('01'), '1');
  assert.equal(departmentKey('2a'), '2A');
  assert.equal(departmentKey('974'), '974');
  assert.deepEqual(readPair('N,R'), { departure: 3, return: 2 });
  assert.equal(readPair('X,V'), null);
  assert.equal(readPair('V'), null);
  assert.equal(isoDate('01/08/2026'), '2026-08-01');
  assert.equal(isoDate('2026-08-01'), null);
  assert.equal(worst({ departure: 1, return: 2 }), 2);
  assert.equal(worst(null), null);
});

test('the coloured days of the next weeks, in order', () => {
  const { byDepartment } = parseForecasts(FORECASTS, { departments: ['94'], from: '2026-10-17' });
  const days = colouredDays(byDepartment['94'], '2026-10-18', 14);
  assert.deepEqual(
    days.map((day) => day.date),
    ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-30', '2026-10-31'],
  );
});

test('an unexpected file is refused', () => {
  assert.throws(() => parseForecasts({}, { departments: [] }), /Unexpected shape/);
  assert.throws(
    () => parseForecasts({ ...FORECASTS, values: [] }, { departments: [] }),
    /Unexpected shape/,
  );
});
