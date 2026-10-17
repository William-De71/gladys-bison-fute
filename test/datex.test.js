// The DATEX II parser against real files of the Bison Futé feed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSituations, statusAt, normalizeRoad, clean } from '../src/datex.js';
import { SNAPSHOT, UNIT_CONGESTION, NOW } from './helpers/fixtures.js';

const { events, publishedAt } = parseSituations(SNAPSHOT);
const byId = (id) => events.find((event) => event.id === id);

test('reads every situation of the snapshot, with its publication time', () => {
  assert.equal(events.length, 20);
  assert.equal(new Date(publishedAt).toISOString(), '2026-10-17T18:57:44.154Z');
  for (const event of events) {
    assert.ok(event.points.length + event.segments.length > 0, `${event.id} has a geometry`);
    assert.ok(event.road, `${event.id} has a road`);
  }
});

test('an accident: category, road, town, direction, source, open end', () => {
  const accident = byId('261017-001830');
  assert.equal(accident.category, 'accident');
  assert.equal(accident.subtype, 'accident');
  assert.equal(accident.road, 'N406');
  assert.equal(accident.town, 'Bonneuil-sur-Marne');
  assert.equal(accident.direction, 'De Créteil vers Boissy-Saint-Léger (N19)');
  assert.equal(accident.source, 'DIR Île-de-France');
  assert.equal(accident.severity, 'medium');
  assert.equal(accident.end, null);
  assert.deepEqual(accident.points, [[48.760376, 2.4885082]]);
  assert.equal(statusAt(accident, NOW), 'active');
});

test('a situation takes its most serious category: a closure beats its roadworks', () => {
  const closure = byId('260911-015903');
  assert.equal(closure.category, 'closure');
  assert.equal(closure.subtype, 'roadClosed');
});

test('planned, ended, suspended', () => {
  assert.equal(statusAt(byId('261006-001573'), NOW), 'planned');
  assert.equal(statusAt(byId('251023-001144'), NOW), 'ended');
  assert.equal(statusAt(byId('261008-003065'), NOW), 'suspended');
  // An end mark of the operator ends it whatever the dates.
  assert.equal(statusAt({ ...byId('261017-001830'), ended: true }, NOW), 'ended');
});

test('the boilerplate of the operators is dropped from the descriptions', () => {
  for (const event of events) {
    assert.doesNotMatch(event.description, /La mesure est obligatoire|^Sur 0 m$/, event.id);
  }
  assert.equal(byId('230814-001797').description, 'Arrêté A-154(Ter)-2022');
});

test('a unit file without namespace prefix, with a traffic jam and its queue', () => {
  const [jam] = parseSituations(UNIT_CONGESTION).events;
  assert.equal(jam.category, 'congestion');
  assert.equal(jam.subtype, 'queuingTraffic');
  assert.equal(jam.road, 'A620');
  assert.equal(jam.queueLength, 1351);
  assert.equal(jam.segments.length, 1);
});

test('road numbers the usual way, texts cleaned, a non-DATEX document refused', () => {
  assert.equal(normalizeRoad('N0020'), 'N20');
  assert.equal(normalizeRoad('RN 7'), 'N7');
  assert.equal(normalizeRoad('a75'), 'A75');
  assert.equal(normalizeRoad('N124A'), 'N124A');
  assert.equal(normalizeRoad(''), null);
  assert.equal(clean('Travaux\n  Arrêté  A-1'), 'Travaux. Arrêté A-1');
  assert.throws(() => parseSituations('<html><body>Maintenance</body></html>'), /DATEX II/);
  assert.throws(() => parseSituations(''), /DATEX II/);
});
