// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';

import { buildDevice, buildStates, inseeOf, idsOf, nearestText } from '../src/device.js';
import { parseSituations } from '../src/datex.js';
import { eventsOfPlace } from '../src/zone.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, SNAPSHOT, NOW } from './helpers/fixtures.js';

const CRETEIL = {
  insee: '94028',
  name: 'Créteil',
  department: '94',
  latitude: 48.7904,
  longitude: 2.4556,
  radius: 25,
  roads: [],
  forecast: true,
};
const AJACCIO = {
  insee: '2A004',
  name: 'Ajaccio',
  department: '2A',
  latitude: 41.9228,
  longitude: 8.7058,
  radius: 20,
  roads: ['T20'],
  forecast: false,
};

const devices = (language) => [
  buildDevice(fakeGladys, CRETEIL, { language }),
  buildDevice(fakeGladys, AJACCIO, { language }),
];
const { events } = parseSituations(SNAPSHOT);

// Pairs with an icon in the Gladys front (front/src/utils/consts.js).
const PAIRS = [
  [DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, DEVICE_FEATURE_TYPES.SENSOR.INTEGER],
  [DEVICE_FEATURE_CATEGORIES.RISK, DEVICE_FEATURE_TYPES.RISK.INTEGER],
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name.length > 0 && feature.name.length <= 255);
      }
    }
  }
});

test('category / type pairs known to the Gladys front, from the SDK constants', () => {
  for (const feature of devices('en').flatMap((device) => device.features)) {
    assert.ok(
      PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
      `${feature.external_id}: ${feature.category}/${feature.type}`,
    );
  }
});

test('ids from the INSEE code (lower case), read back; no forecast outside its coverage', () => {
  const [creteil, ajaccio] = devices('fr');
  assert.equal(creteil.external_id, 'ext:test-integration:place:94028');
  assert.equal(ajaccio.external_id, 'ext:test-integration:place:2a004');
  assert.equal(inseeOf('ext:test-integration:place:2a004:events'), '2A004');
  assert.equal(inseeOf('ext:test-integration:place:94028'), '94028');
  assert.equal(inseeOf('something else'), null);
  assert.equal(creteil.name, 'Trafic Créteil');
  assert.equal(creteil.features.length, 10);
  assert.equal(ajaccio.features.length, 6);
  assert.deepEqual(
    ajaccio.params.map((param) => [param.name, param.value]),
    [
      ['INSEE', '2A004'],
      ['DEPARTMENT', '2A'],
      ['RADIUS_KM', '20'],
      ['ROADS', 'T20'],
    ],
  );
  for (const device of devices('de')) {
    const names = new Set(device.features.map((feature) => feature.name));
    assert.equal(names.size, device.features.length, 'every feature has its own name');
  }
});

test('states: the counts of the zone, the closest event, the forecast levels', () => {
  const { active } = eventsOfPlace(events, CRETEIL, NOW);
  const states = buildStates(
    fakeGladys,
    CRETEIL,
    { active, today: { departure: 1, return: 0 }, tomorrow: null },
    { language: 'fr' },
  );
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  assert.deepEqual(byKey, {
    events: 6,
    closures: 1,
    accidents: 2,
    congestion: 0,
    roadworks: 1,
    nearest: 'A86 · Restriction · 1,2 km',
    departure_today: 1,
    return_today: 0,
  });
  // Before the first reading: nothing to publish but the known forecast.
  assert.deepEqual(
    buildStates(fakeGladys, CRETEIL, { active: null, today: null, tomorrow: null }, {}),
    [],
  );
  assert.equal(nearestText([], 'es'), 'Ninguna');
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices(devices(language));
  }
  const device = gladys.fake.discoveredDevices[0];
  await gladys.fake.deviceCreated(device);
  const { active } = eventsOfPlace(events, CRETEIL, NOW);
  await gladys.publishStates(
    buildStates(gladys, CRETEIL, { active, today: { departure: 3, return: 2 }, tomorrow: null }),
  );
  assert.equal(idsOf(gladys, '94028').device, device.external_id);
  assert.equal(gladys.fake.lastState(`${device.external_id}:departure_today`), 3);
});
