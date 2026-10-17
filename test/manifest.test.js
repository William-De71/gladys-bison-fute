// The manifest against the code: the keys it declares are the ones the code
// handles, the store limits hold, the transport and permissions are right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { TRIGGERS } from '../src/events.js';
import { SCENE_ACTIONS, ACTIONS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { MAX_PLACES, AUTO_LANGUAGE, RADIUS, INTERVALS, DEFAULT_INTERVAL } from '../src/config.js';
import { CATEGORIES } from '../src/datex.js';
import { LEVELS, DIRECTIONS } from '../src/forecast.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Bison Futé');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-bison-fute:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-bison-fute/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-bison-fute');
});

test('declares the cloud transport only: the Bison Futé files and geo.api.gouv.fr', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  assert.match(source('../src/bison-api.js'), /https:\/\/tipi\.bison-fute\.gouv\.fr/);
  assert.match(source('../src/bison-api.js'), /https:\/\/www\.bison-fute\.gouv\.fr/);
});

test('requires the first Gladys accepting a houses select; location, nothing else', () => {
  assert.equal(manifest.gladys_version, '>=5.2.0');
  assert.deepEqual(manifest.categories, ['services']);
  assert.equal(manifest.location, true);
  assert.match(source('../src/app.js'), /getHouses\(\)/);
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  assert.doesNotMatch(source('../src/widgets.js'), /fields:/);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
});

test('the places of the code: house, commune, radius within the bounds, roads; no secret', () => {
  const config = byKey(manifest.config_schema);
  for (let slot = 1; slot <= MAX_PLACES; slot += 1) {
    assert.equal(config.get(`house_${slot}`).source, 'houses', `house_${slot}`);
    assert.equal(config.get(`commune_${slot}`).type, 'string', `commune_${slot}`);
    const radius = config.get(`radius_${slot}`);
    assert.equal(radius.type, 'number');
    assert.deepEqual(
      [radius.min, radius.max, radius.default],
      [RADIUS.min, RADIUS.max, RADIUS.default],
    );
    assert.equal(config.get(`roads_${slot}`).type, 'string', `roads_${slot}`);
  }
  assert.equal(config.get(`house_${MAX_PLACES + 1}`), undefined);
  const interval = config.get('interval');
  assert.deepEqual(values(interval), INTERVALS.map(String));
  assert.equal(interval.default, String(DEFAULT_INTERVAL));
  for (const field of manifest.config_schema) {
    assert.ok(!['text', 'password', 'secret'].includes(field.type), `${field.key}: ${field.type}`);
    assert.equal(field.display_if, undefined, field.key);
  }
});

test('the trigger filters are the values the events carry', () => {
  const triggers = byKey(manifest.scene_triggers);
  for (const key of ['event_started', 'event_ended', 'event_planned']) {
    const fields = byKey(triggers.get(key).fields);
    assert.deepEqual(values(fields.get('category')), CATEGORIES, key);
    assert.equal(fields.get('place').source, 'devices', key);
  }
  const alert = byKey(triggers.get('forecast_alert').fields);
  assert.deepEqual(values(alert.get('level')), LEVELS.slice(1));
  assert.deepEqual(values(alert.get('direction')), DIRECTIONS);
  assert.deepEqual(values(alert.get('day')), ['today', 'tomorrow']);
  const action = byKey(byKey(manifest.scene_actions).get('get_road_events').fields);
  assert.deepEqual(values(action.get('categories')), CATEGORIES);
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
    assert.ok(
      (action.fields ?? []).length <= 10 && (action.outputs ?? []).length <= 20,
      action.key,
    );
  }
  for (const widget of manifest.widgets) {
    assert.ok((widget.settings ?? []).length <= 10);
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});
