// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and fake
// Bison Futé and geo.api.gouv.fr services serving real (reduced) files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS, forecastCovered } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import {
  fakeApis,
  storePath,
  silent,
  withoutSituations,
  NOW,
  TZ,
  HOUSES,
  SNAPSHOT,
} from './helpers/fixtures.js';

const CONFIG = {
  house_1: 'home',
  radius_1: 25,
  commune_2: 'Toulouse',
  radius_2: 10,
  commune_3: 'Ajaccio',
};
const PREFIX = 'ext:test-integration:place';
const CRETEIL = `${PREFIX}:94028`;
const TOULOUSE = `${PREFIX}:31555`;
const AJACCIO = `${PREFIX}:2a004`;
const MINUTE = 60 * 1000;
const TIPI = 'tipi.bison-fute.gouv.fr';
const SITE = 'www.bison-fute.gouv.fr';

/**
 * @description The integration, connected to a fake Gladys and fake services.
 * @param {object} [options] - `{ config, apis, path, now }`.
 * @returns {Promise<object>} `{ gladys, app, apis, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  apis = fakeApis(),
  path = storePath(),
  now = NOW,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config, houses: HOUSES });
  const app = createApp(gladys, {
    fetch: apis,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, apis, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('a house and two communes become three devices, read with one request per source', async (t) => {
  const { gladys, apis } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [
      device.external_id,
      device.name,
      device.features.length,
    ]),
    [
      [CRETEIL, 'Trafic Créteil', 10],
      [TOULOUSE, 'Trafic Toulouse', 10],
      [AJACCIO, 'Trafic Ajaccio', 6],
    ],
  );
  assert.equal(apis.callsTo(TIPI).length, 1);
  assert.equal(apis.callsTo(SITE).length, 1);
  assert.match(apis.callsTo(TIPI)[0].headers['user-agent'], /^gladys-bison-fute\/0\.1\.0/);
  assert.equal(apis.callsTo(TIPI)[0].headers['accept-encoding'], 'gzip');
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(
    status.message.fr,
    'Connecté à Bison Futé : Créteil 6 évènement(s), Toulouse 2 évènement(s), Ajaccio 0 évènement(s). Évènements lus toutes les 5 min.',
  );
  // The first reading is a baseline: no scene event.
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('states once a device is created; a 304 keeps them, a new snapshot fires the transitions', async (t) => {
  const { gladys, app, apis, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const device = await created(gladys, CRETEIL);
  assert.equal(gladys.fake.lastState(`${device.external_id}:events`), 6);
  assert.equal(gladys.fake.lastState(`${device.external_id}:accidents`), 2);
  assert.equal(gladys.fake.lastState(`${device.external_id}:departure_today`), 1);
  assert.equal(gladys.fake.lastState(`${device.external_id}:return_tomorrow`), 0);
  assert.equal(gladys.fake.lastState(`${TOULOUSE}:events`), undefined, 'not created');

  clock.now += 5 * MINUTE;
  await app.tick();
  const conditional = apis.callsTo(TIPI).at(-1);
  assert.equal(conditional.headers['if-modified-since'], 'Sat, 17 Oct 2026 18:57:44 GMT');
  assert.equal(apis.callsTo(SITE).length, 1, 'the forecasts are read every six hours');
  assert.deepEqual(gladys.fake.sceneEvents, []);

  apis.state.snapshot = withoutSituations(['261017-001830']);
  apis.state.lastModified = 'Sat, 17 Oct 2026 19:03:00 GMT';
  clock.now += 5 * MINUTE;
  await app.tick();
  const ended = eventsOf(gladys, TRIGGERS.EVENT_ENDED);
  assert.equal(ended.length, 1);
  assert.equal(ended[0].data.place, CRETEIL);
  assert.equal(ended[0].data.road, 'N406');
  assert.equal(gladys.fake.lastState(`${device.external_id}:events`), 5);
  assert.ok(gladys.fake.widgetRefreshes.includes(WIDGETS.TRAFFIC));
});

test('a snapshot that shrank is refused once, then accepted if it stays so', async (t) => {
  // 60 situations: the real ones and two copies.
  const copies = [1, 2]
    .map((n) =>
      SNAPSHOT.match(/<ns2:situation [\s\S]*<\/ns2:situation>/)[0].replace(
        /situation id="([^"]+)"/g,
        `situation id="$1-c${n}"`,
      ),
    )
    .join('');
  const big = SNAPSHOT.replace('</ns2:payloadPublication>', `${copies}</ns2:payloadPublication>`);
  const apis = fakeApis();
  apis.state.snapshot = big;
  const { gladys, app, clock } = await startApp({ apis });
  t.after(() => gladys.fake.shutdown());
  assert.equal(app.getFeed().events.length, 60);
  apis.state.snapshot = SNAPSHOT;
  apis.state.lastModified = 'Sat, 17 Oct 2026 19:03:00 GMT';
  clock.now += 5 * MINUTE;
  assert.equal(await app.read(), false);
  assert.equal(app.getFeed().events.length, 60, 'kept');
  assert.deepEqual(gladys.fake.sceneEvents, []);
  assert.equal(gladys.fake.connectionStatus.connected, true, 'not shown');
  clock.now += 2 * MINUTE;
  assert.equal(await app.read(), true);
  assert.equal(app.getFeed().events.length, 20);
  assert.ok(eventsOf(gladys, TRIGGERS.EVENT_ENDED).length > 0);
});

test('a source down: a clear status, the last data kept for the widgets', async (t) => {
  const { gladys, app, apis, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  apis.state.fail[TIPI] = { status: 503 };
  clock.now += 5 * MINUTE;
  assert.equal(await app.read(), false);
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.equal(status.message.en, 'Bison Futé cannot be reached (HTTP 503). New try in 2 min.');
  const widget = await gladys.fake.widgetGet(WIDGETS.TRAFFIC, { language: 'en' });
  assert.equal(widget.data.content.components[1].value, 6);
  apis.state.fail[TIPI] = 'network';
  assert.equal(await app.read(), false);
  assert.match(gladys.fake.connectionStatus.message.fr, /ECONNREFUSED/);
  delete apis.state.fail[TIPI];
  assert.equal(await app.read(), true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('widgets: traffic and forecast of each place, valid in every language', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of Object.values(WIDGETS)) {
      for (const place of [undefined, CRETEIL, TOULOUSE, AJACCIO]) {
        const answer = await gladys.fake.widgetGet(key, {
          settings: place ? { place } : {},
          language,
        });
        assert.equal(answer.success, true, `${key} ${place} ${language}`);
        assert.deepEqual(validateWidgetContent(answer.data.content), [], `${key} ${place}`);
      }
    }
  }
  const corsica = await gladys.fake.widgetGet(WIDGETS.FORECAST, {
    settings: { place: AJACCIO },
    language: 'fr',
  });
  assert.match(
    corsica.data.content.components[0].text,
    /^Bison Futé ne publie pas de prévision pour Corse-du-Sud/,
  );
  const toulouse = await gladys.fake.widgetGet(WIDGETS.TRAFFIC, {
    settings: { place: TOULOUSE },
    language: 'fr',
  });
  assert.equal(toulouse.data.content.components[0].text, 'Toulouse · 10 km');
});

test('scene actions: road events and forecast of a place, errors for the unknown', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const roads = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_ROAD_EVENTS, {
    place: CRETEIL,
    categories: ['accident', 'obstruction', 'nonsense'],
  });
  assert.equal(roads.success, true);
  assert.equal(roads.data.outputs.count, 2);
  assert.match(
    roads.data.outputs.summary,
    /^2 évènement\(s\) routier\(s\) :\n- Accident sur la N406/,
  );
  const first = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_ROAD_EVENTS, {});
  assert.equal(first.data.outputs.count, 6, 'empty: the first place');
  const forecast = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_FORECAST, {
    place: CRETEIL,
    day: 'tomorrow',
  });
  assert.equal(forecast.data.outputs.date, '2026-10-18');
  assert.equal(forecast.data.outputs.departure_label, 'Vert');
  assert.equal(forecast.data.outputs.next_coloured_date, '2026-10-23');
  const corsica = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_FORECAST, { place: AJACCIO });
  assert.equal(corsica.success, false);
  const unknown = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_ROAD_EVENTS, {
    place: `${PREFIX}:69123`,
  });
  assert.equal(unknown.success, false);
  assert.deepEqual(gladys.fake.sceneEvents, [], 'an action never fires an event');
});

test('Read now waits a minute between two readings; Diagnostic writes the logs', async (t) => {
  const lines = [];
  const logger = { ...silent, info: (line) => lines.push(line) };
  const gladys = createFakeGladys({ config: CONFIG, houses: HOUSES });
  const clock = { now: NOW };
  const apis = fakeApis();
  createApp(gladys, {
    fetch: apis,
    storePath: storePath(),
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
  });
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const tooSoon = await gladys.fake.action(ACTIONS.REFRESH);
  assert.match(tooSoon.data.message.en, /^The road events were read 0 s ago/);
  clock.now += 2 * MINUTE;
  const done = await gladys.fake.action(ACTIONS.REFRESH);
  assert.equal(
    done.data.message.de,
    'Bison Futé gelesen: Créteil 6 Meldung(en), Toulouse 2 Meldung(en), Ajaccio 0 Meldung(en).',
  );
  assert.equal(apis.callsTo(SITE).length, 2, 'Read now reads the forecasts too');
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.fr, /Diagnostic écrit/);
  const report = lines.filter((line) => line.startsWith('Bison Futé diagnostic'));
  assert.ok(report.length >= 1);
  assert.match(report.join(''), /"insee":"94028"/);
});

test('a new radius starts a new baseline: no burst of events', async (t) => {
  const { gladys, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.configUpdated({ ...CONFIG, radius_1: 200 });
  assert.equal(app.getConfig().places[0].radius, 200);
  assert.ok(app.getZones()['94028'].active.length > 6);
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('places that cannot be used are reported; a restart fires nothing again', async (t) => {
  const path = storePath();
  const config = { house_1: 'nowhere', house_2: 'abroad', commune_3: 'Zzz' };
  const bad = await startApp({ config, path });
  const status = bad.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.en, /house “Nowhere”: the house has no location/);
  assert.match(status.message.en, /house “Abroad”: the house is outside France/);
  assert.match(status.message.en, /place 3: “Zzz” matches no French commune/);
  assert.deepEqual(bad.gladys.fake.discoveredDevices, []);
  await bad.gladys.fake.shutdown();

  const first = await startApp({ path });
  await first.gladys.fake.shutdown();
  const geoCalls = first.apis.callsTo('geo.api.gouv.fr').length;
  const again = await startApp({ path, now: NOW + 3 * MINUTE });
  t.after(() => again.gladys.fake.shutdown());
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
  assert.equal(again.apis.callsTo('geo.api.gouv.fr').length, 0, 'communes kept in /data');
  assert.equal(again.apis.callsTo(SITE).length, 0, 'forecasts kept in /data');
  assert.ok(geoCalls > 0);
});

test('the same commune twice is kept once; the forecast coverage', async (t) => {
  const { gladys } = await startApp({ config: { house_1: 'home', commune_2: '94028' } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.match(gladys.fake.connectionStatus.message.en, /place 2: the same commune as place 1/);
  assert.equal(forecastCovered('01'), true);
  assert.equal(forecastCovered('95'), true);
  assert.equal(forecastCovered('2A'), false);
  assert.equal(forecastCovered('974'), false);
  assert.equal(forecastCovered(null), false);
});
