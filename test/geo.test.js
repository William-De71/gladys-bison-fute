import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGeoClient, splitQuery, fold, GeoError } from '../src/geo.js';
import { fakeApis } from './helpers/fixtures.js';

test('what the user types is split into a name and a code', () => {
  assert.deepEqual(splitQuery('Sancé (71000)'), { name: 'Sancé', code: '71000' });
  assert.deepEqual(splitQuery('Saint-Denis 93200'), { name: 'Saint-Denis', code: '93200' });
  assert.deepEqual(splitQuery('94028'), { name: '', code: '94028' });
  assert.deepEqual(splitQuery('2a004'), { name: '', code: '2A004' });
  assert.deepEqual(splitQuery('Créteil'), { name: 'Créteil', code: null });
  assert.equal(fold('Saint-Étienne'), 'saint etienne');
});

test('a commune by coordinates, postal code, name or INSEE code, with its centre and department', async () => {
  const geo = createGeoClient({ fetch: fakeApis() });
  assert.deepEqual(await geo.byCoordinates(48.7904, 2.4556), {
    insee: '94028',
    name: 'Créteil',
    department: '94',
    departmentName: 'Val-de-Marne',
    latitude: 48.7845,
    longitude: 2.4523,
    population: 93397,
  });
  assert.equal((await geo.byQuery('31000')).name, 'Toulouse');
  assert.equal((await geo.byQuery('toulouse')).insee, '31555');
  // Not a postal code: an INSEE code (Corsica has letters).
  assert.equal((await geo.byQuery('2A004')).name, 'Ajaccio');
});

test('nothing found, outside France, service down', async () => {
  const fake = fakeApis();
  const geo = createGeoClient({ fetch: fake });
  await assert.rejects(
    geo.byQuery('Zzz'),
    (err) => err instanceof GeoError && err.kind === 'not_found',
  );
  await assert.rejects(geo.byQuery('99999'), { kind: 'not_found' });
  await assert.rejects(geo.byCoordinates(51.5, -0.12), { kind: 'outside' });
  fake.state.geoDown = true;
  await assert.rejects(geo.byQuery('Toulouse'), { kind: 'unreachable' });
});
