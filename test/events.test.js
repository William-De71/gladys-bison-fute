// Scene triggers: one event per transition, a baseline at the first reading,
// flat payloads within the limits of the core; scene action outputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  detectRoadEvents,
  detectForecastAlerts,
  roadOutputs,
  forecastOutputs,
  pick,
  TRIGGERS,
  ROAD_OUTPUTS,
  FORECAST_OUTPUTS,
  MAX_EVENTS_PER_PLACE,
} from '../src/events.js';
import { parseSituations } from '../src/datex.js';
import { parseForecasts } from '../src/forecast.js';
import { eventsOfPlace } from '../src/zone.js';
import { LANGUAGES } from '../src/i18n.js';
import { SNAPSHOT, FORECASTS, NOW, TZ, withoutSituations } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const PLACE = {
  insee: '94028',
  name: 'Créteil',
  deviceId: 'ext:test-integration:place:94028',
  department: '94',
  departmentName: 'Val-de-Marne',
  forecastKey: '94',
  forecast: true,
  latitude: 48.7904,
  longitude: 2.4556,
  radius: 25,
  roads: [],
};
const zoneOf = (xml, now = NOW) => ({
  [PLACE.insee]: eventsOfPlace(parseSituations(xml).events, PLACE, now),
});
const FORECAST = parseForecasts(FORECASTS, { departments: ['94'], from: '2026-10-16' });

/**
 * @description Assert a payload respects the limits of the core and the manifest.
 * @param {object} event - `{ key, data }`.
 */
function assertPayload({ key, data }) {
  const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
  assert.ok(trigger, key);
  assert.ok(Object.keys(data).length <= 30, key);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(
      value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.length <= 1000),
      `${key}.${name}`,
    );
  }
  const exposed = new Set([...trigger.variables, ...(trigger.fields ?? [])].map((v) => v.key));
  for (const variable of trigger.variables) {
    assert.ok(variable.key in data, `${key} gives ${variable.key}`);
  }
  for (const field of trigger.fields ?? []) {
    assert.ok(field.key in data, `${key} can be filtered on ${field.key}`);
  }
  assert.ok(exposed.size > 0);
}

test('road events: the first reading is a baseline, then one event per transition', () => {
  const run = (xml, seen, now = NOW) =>
    detectRoadEvents({
      places: [PLACE],
      zones: zoneOf(xml, now),
      seen,
      now,
      language: 'fr',
      timeZone: TZ,
    });
  const first = run(SNAPSHOT, {});
  assert.deepEqual(first.events, []);
  // Same snapshot: nothing.
  assert.deepEqual(run(SNAPSHOT, first.seen).events, []);
  // The accident is cleared.
  const cleared = run(withoutSituations(['261017-001830']), first.seen);
  assert.deepEqual(
    cleared.events.map((event) => [event.key, event.data.event_id]),
    [[TRIGGERS.EVENT_ENDED, '261017-001830']],
  );
  const ended = cleared.events[0].data;
  assert.equal(ended.category, 'accident');
  assert.equal(ended.road, 'N406');
  assert.equal(ended.duration_minutes, 79);
  assert.equal(ended.summary, 'Terminé : Accident sur la N406 vers Bonneuil-sur-Marne (4,1 km)');
  // It comes back: started.
  const back = run(SNAPSHOT, cleared.seen);
  assert.deepEqual(
    back.events.map((event) => [event.key, event.data.event_id]),
    [[TRIGGERS.EVENT_STARTED, '261017-001830']],
  );
  const started = back.events[0].data;
  assert.equal(started.place, PLACE.deviceId);
  assert.equal(started.distance_km, 4.1);
  assert.match(
    started.summary,
    /^Accident sur la N406 vers Bonneuil-sur-Marne \(4,1 km\)\. De Créteil/,
  );
  for (const event of [...cleared.events, ...back.events]) {
    assertPayload(event);
  }
});

test('road events: a planned one is announced once, then starts', () => {
  const run = (xml, seen, now) =>
    detectRoadEvents({ places: [PLACE], zones: zoneOf(xml, now), seen, now, language: 'en' });
  const id = '261006-001573';
  const first = run(withoutSituations([id]), {}, NOW);
  const announced = run(SNAPSHOT, first.seen, NOW);
  const planned = announced.events.filter((event) => event.key === TRIGGERS.EVENT_PLANNED);
  assert.deepEqual(
    planned.map((event) => event.data.event_id),
    [id],
  );
  assert.equal(planned[0].data.category, 'closure');
  assertPayload(planned[0]);
  const event = parseSituations(SNAPSHOT).events.find((e) => e.id === id);
  const later = run(SNAPSHOT, announced.seen, event.start + 60000);
  assert.ok(later.events.some((e) => e.key === TRIGGERS.EVENT_STARTED && e.data.event_id === id));
  assert.ok(!later.events.some((e) => e.key === TRIGGERS.EVENT_PLANNED && e.data.event_id === id));
});

test('road events: never more than the cap per place and reading', () => {
  const wide = { ...PLACE, radius: 200 };
  const zones = {
    [PLACE.insee]: eventsOfPlace(parseSituations(SNAPSHOT).events, wide, NOW),
  };
  const many = {
    ...zones[PLACE.insee],
    active: Array.from({ length: 60 }, (_, i) => ({
      ...zones[PLACE.insee].active[0],
      id: `x-${i}`,
    })),
  };
  const result = detectRoadEvents({
    places: [PLACE],
    zones: { [PLACE.insee]: many },
    seen: { [PLACE.insee]: { active: {}, planned: {} } },
    now: NOW,
    language: 'en',
  });
  assert.equal(result.events.length, MAX_EVENTS_PER_PLACE);
  assert.equal(Object.keys(result.seen[PLACE.insee].active).length, 60);
});

test('forecast alerts: today from 6 am, tomorrow from 6 pm the day before, again when worse', () => {
  const run = (date, minutes, seen, forecasts = FORECAST) =>
    detectForecastAlerts({
      places: [PLACE],
      forecasts,
      seen,
      clock: { date, minutes },
      tomorrow: new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10),
      language: 'fr',
    });
  // First reading: a baseline, even with an orange day.
  const base = run('2026-10-17', 600, {});
  assert.deepEqual(base.events, []);
  // Thursday 22 at 17:00: nothing yet for Friday 23 (orange both ways).
  assert.deepEqual(run('2026-10-22', 17 * 60, base.seen).events, []);
  const evening = run('2026-10-22', 18 * 60, base.seen);
  assert.deepEqual(
    evening.events.map((e) => [e.data.day, e.data.date, e.data.direction, e.data.level]),
    [
      ['tomorrow', '2026-10-23', 'departure', 'orange'],
      ['tomorrow', '2026-10-23', 'return', 'orange'],
    ],
  );
  assert.equal(
    evening.events[0].data.summary,
    'Prévision Bison Futé demain en Val-de-Marne : départs orange, retours orange. France : départs orange, retours orange.',
  );
  evening.events.forEach(assertPayload);
  // The next morning: already announced.
  assert.deepEqual(run('2026-10-23', 7 * 60, evening.seen).events, []);
  // Revised to red for departures: announced again, departures only.
  const worse = structuredClone(FORECAST);
  worse.byDepartment['94']['2026-10-23'] = { departure: 2, return: 1 };
  const revised = run('2026-10-23', 7 * 60, evening.seen, worse);
  assert.deepEqual(
    revised.events.map((e) => [e.data.day, e.data.direction, e.data.level, e.data.level_label]),
    [['today', 'departure', 'red', 'Rouge']],
  );
  // A place without forecast never fires.
  const corsica = { ...PLACE, insee: '2A004', forecast: false };
  const none = detectForecastAlerts({
    places: [corsica],
    forecasts: FORECAST,
    seen: { '2A004': {} },
    clock: { date: '2026-10-22', minutes: 20 * 60 },
    tomorrow: '2026-10-23',
    language: 'en',
  });
  assert.deepEqual(none.events, []);
});

test('scene action outputs: only the declared ones, in every language', () => {
  const zone = zoneOf(SNAPSHOT)[PLACE.insee];
  const declared = (key) =>
    manifest.scene_actions.find((action) => action.key === key).outputs.map((o) => o.key);
  assert.deepEqual(ROAD_OUTPUTS, declared('get_road_events'));
  assert.deepEqual(FORECAST_OUTPUTS, declared('get_forecast'));
  for (const language of LANGUAGES) {
    const road = pick(roadOutputs({ zone, categories: [] }, language, TZ), ROAD_OUTPUTS);
    assert.deepEqual(Object.keys(road), ROAD_OUTPUTS);
    assert.equal(road.count, 6);
    assert.equal(road.closures, 1);
    assert.equal(road.accidents, 2);
    assert.ok(road.summary.length <= 10000);
    assert.equal(road.summary.split('\n').length, 7);
    const forecast = pick(
      forecastOutputs(
        { place: PLACE, forecasts: FORECAST, day: 'today', date: '2026-10-17' },
        language,
      ),
      FORECAST_OUTPUTS,
    );
    assert.deepEqual(Object.keys(forecast), FORECAST_OUTPUTS);
    assert.equal(forecast.departure_level, 1);
    assert.equal(forecast.return_level, 0);
    assert.equal(forecast.next_coloured_date, '2026-10-17');
  }
  const accidents = roadOutputs({ zone, categories: ['accident'] }, 'en', TZ);
  assert.equal(accidents.count, 1);
  assert.match(accidents.nearest, /^Accident on the N406 near Bonneuil-sur-Marne \(4\.1 km\)/);
  const empty = roadOutputs({ zone: { active: [], planned: [] }, categories: [] }, 'de', TZ);
  assert.equal(empty.summary, 'Keine Verkehrsmeldung in der Umgebung.');
  assert.equal(empty.nearest, '');
});
