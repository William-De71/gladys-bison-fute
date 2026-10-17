// Every widget content through validateWidgetContent (the checks of the core,
// which only run in debug mode in production) and the content budget of a
// card, in the four languages and in the edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildTrafficWidget,
  buildForecastWidget,
  messageContent,
  readWidgetSettings,
  levelColor,
} from '../src/widgets.js';
import { parseSituations } from '../src/datex.js';
import { parseForecasts } from '../src/forecast.js';
import { eventsOfPlace } from '../src/zone.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  SNAPSHOT,
  UNIT_CONGESTION,
  FORECASTS,
  NOW,
  TZ,
  TODAY,
  TOMORROW,
} from './helpers/fixtures.js';

const types = (content) => content.components.map((component) => component.type);
const CRETEIL = {
  name: 'Créteil',
  department: '94',
  departmentName: 'Val-de-Marne',
  latitude: 48.7904,
  longitude: 2.4556,
  radius: 25,
  roads: [],
};
const TOULOUSE = { ...CRETEIL, name: 'Toulouse', latitude: 43.6007, longitude: 1.4328, radius: 10 };
const events = parseSituations(SNAPSHOT).events;
const FORECAST = parseForecasts(FORECASTS, { departments: ['94'], from: '2026-10-16' });

/**
 * @description Assert a content is valid and within the budget of a card.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (list) => types(content).filter((type) => list.includes(type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(count(['status']) <= 1, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
  for (const component of content.components) {
    if (component.type === 'value') {
      assert.ok(String(component.value).length <= 12, `${label}: ${component.value}`);
      assert.ok(component.label.length <= 24, `${label}: ${component.label}`);
    }
    if (component.type === 'text' && component.variant === 'heading') {
      assert.ok(component.text.length <= 40, `${label}: ${component.text}`);
    }
    for (const item of component.items ?? []) {
      if (component.type === 'status') {
        assert.ok(item.value, `${label}: a status row without value is dropped`);
        assert.ok(item.label.length <= 40 && String(item.value).length <= 40, label);
      } else {
        assert.ok(item.title.length <= 60, `${label}: ${item.title}`);
        assert.ok(!item.subtitle || item.subtitle.length <= 60, label);
        assert.ok(!(item.date && item.subtitle), `${label}: the date replaces the subtitle`);
      }
      if (item.badge) {
        assert.ok(item.badge.text.length <= 16, `${label}: ${item.badge.text}`);
      }
    }
  }
}

test('traffic widget: counts, active then planned events, update time, in every language', () => {
  const zone = eventsOfPlace(events, CRETEIL, NOW);
  for (const language of LANGUAGES) {
    const content = buildTrafficWidget({
      place: CRETEIL,
      zone,
      readAt: NOW,
      publishedAt: NOW - 60000,
      language,
      timeZone: TZ,
    });
    assertValid(content, `traffic ${language}`);
    assert.deepEqual(types(content), [
      'text',
      'value',
      'value',
      'value',
      'value',
      'value',
      'card-list',
      'status',
    ]);
    const cards = content.components[6].items;
    assert.equal(cards.length, 8);
    assert.equal(cards[0].badge.color, 'danger');
    assert.equal(cards.at(-1).badge.color, 'neutral', 'planned events come last');
  }
  const fr = buildTrafficWidget({
    place: CRETEIL,
    zone,
    readAt: NOW,
    language: 'fr',
    timeZone: TZ,
  });
  assert.equal(fr.components[0].text, 'Créteil · 25 km');
  assert.equal(fr.components[6].items[1].title, 'N406 · Accident');
  assert.equal(fr.components[6].items[1].subtitle, 'Bonneuil-sur-Marne · 4,1 km');
});

test('traffic widget: an empty zone, a traffic jam with its queue, a list of roads', () => {
  for (const language of LANGUAGES) {
    const empty = buildTrafficWidget({
      place: { ...CRETEIL, roads: ['N7'] },
      zone: { active: [], planned: [] },
      readAt: null,
      publishedAt: null,
      language,
      timeZone: TZ,
    });
    assertValid(empty, `empty ${language}`);
    assert.ok(types(empty).includes('text') && !types(empty).includes('card-list'));
  }
  const jam = parseSituations(UNIT_CONGESTION).events;
  const zone = eventsOfPlace(jam, TOULOUSE, Date.parse('2026-10-17T09:00:00Z'));
  const content = buildTrafficWidget({
    place: TOULOUSE,
    zone,
    readAt: NOW,
    language: 'en',
    timeZone: TZ,
  });
  assertValid(content, 'jam');
  assert.match(content.components[6].items[0].description, /Queue: 1\.4 km/);
});

test('forecast widget: today and tomorrow, the next coloured days, France', () => {
  for (const language of LANGUAGES) {
    const content = buildForecastWidget({
      place: CRETEIL,
      dates: FORECAST.byDepartment['94'],
      national: FORECAST.national,
      today: TODAY,
      tomorrow: TOMORROW,
      readAt: NOW,
      language,
      timeZone: TZ,
    });
    assertValid(content, `forecast ${language}`);
    assert.deepEqual(types(content), [
      'text',
      'value',
      'value',
      'value',
      'value',
      'card-list',
      'status',
    ]);
    assert.equal(content.components[1].color, 'warning');
    assert.equal(content.components[2].color, 'success');
  }
  const fr = buildForecastWidget({
    place: CRETEIL,
    dates: FORECAST.byDepartment['94'],
    national: FORECAST.national,
    today: TODAY,
    tomorrow: TOMORROW,
    readAt: NOW,
    language: 'fr',
    timeZone: TZ,
  });
  assert.equal(fr.components[0].text, 'Val-de-Marne (94)');
  assert.deepEqual(fr.components[5].items[1], {
    title: 'Départs orange · retours orange',
    date: '2026-10-23T00:00:00.000Z',
    badge: { text: 'Vendredi', color: 'warning' },
  });
  const quiet = buildForecastWidget({
    place: CRETEIL,
    dates: {},
    national: {},
    today: TODAY,
    tomorrow: TOMORROW,
    readAt: null,
    language: 'es',
  });
  assertValid(quiet, 'quiet');
  assert.ok(!types(quiet).includes('card-list'));
});

test('messages, settings and colors', () => {
  for (const language of LANGUAGES) {
    assertValid(messageContent('x'.repeat(400)), `message ${language}`);
  }
  assert.deepEqual(readWidgetSettings({ place: 'ext:a:place:94028' }), {
    place: 'ext:a:place:94028',
  });
  assert.deepEqual(readWidgetSettings({ place: '' }), { place: null });
  assert.deepEqual(readWidgetSettings(), { place: null });
  assert.deepEqual([0, 1, 2, 3, null].map(levelColor), [
    'success',
    'warning',
    'danger',
    'danger',
    'neutral',
  ]);
});
