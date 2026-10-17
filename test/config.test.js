import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  readLanguage,
  readRadius,
  readInterval,
  MAX_PLACES,
  RADIUS,
} from '../src/config.js';

test('the places keep their slot, radius and roads; an empty slot is left out', () => {
  const config = normalizeConfig({
    house_1: 'home',
    radius_1: '15',
    commune_2: '',
    commune_3: ' Toulouse 31000 ',
    roads_3: 'a620, RN 124;N0124',
  });
  assert.deepEqual(config.places, [
    { slot: 1, house: 'home', commune: null, radius: 15, roads: [] },
    { slot: 3, house: null, commune: 'Toulouse 31000', radius: 20, roads: ['A620', 'N124'] },
  ]);
  assert.equal(MAX_PLACES, 3);
});

test('defaults and bounds: radius 1 to 200 km, interval among the choices, automatic language', () => {
  const config = normalizeConfig();
  assert.deepEqual(config.places, []);
  assert.equal(config.interval, 5);
  assert.equal(config.language, 'auto');
  assert.equal(readRadius(undefined), RADIUS.default);
  assert.equal(readRadius(''), RADIUS.default);
  assert.equal(readRadius('abc'), RADIUS.default);
  assert.equal(readRadius(0), 1);
  assert.equal(readRadius(500), 200);
  assert.equal(readRadius(12.5), 12.5);
  assert.equal(readInterval('10'), 10);
  assert.equal(readInterval(7), 5);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'auto');
  assert.equal(normalizeConfig({ language: 'de' }).language, 'de');
});

test('the language of the last widget request is read back', () => {
  assert.equal(readLanguage({ last_language: 'es' }, 'fr'), 'es');
  assert.equal(readLanguage({ last_language: 'nope!' }, 'fr'), 'fr');
});
