// -----------------------------------------------------------------------------
// One Gladys device per place: "Traffic Mâcon".
//
// External ids: `ext:<selector>:place:<INSEE code>` and
// `…:place:<INSEE code>:<feature key>` (lower case: Corsica is 2a…). The
// INSEE code of the commune is the official, stable identifier of the place;
// the radius and the roads can change without changing the device.
//
// Features (category / type, chosen from the SDK constants):
//   - the active road events of the zone, all of them and per family:
//     closures, accidents and obstacles, traffic jams, roadworks:
//     `counter-sensor` / `integer` (0 to 999);
//   - the closest active event, as text ("N79 · Accident · 3.2 km"), in the
//     configured language;
//   - when Bison Futé covers the department (mainland France without
//     Corsica): the forecast of today and tomorrow, departures and returns:
//     `risk` / `integer`, 0 green, 1 orange, 2 red, 3 black (Gladys shows no /
//     low / medium / high risk).
//
// `should_poll` stays false: the integration reads the feeds on its own timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';

import { t, categoryLabel, formatDistance } from './i18n.js';
import { countByCategory } from './zone.js';

const DEVICE_TYPE = 'place';
const MODEL = 'Bison Futé';
const MAX_COUNT = 999;

const counter = {
  category: CATEGORIES.COUNTER_SENSOR,
  type: TYPES.SENSOR.INTEGER,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: MAX_COUNT,
};
const risk = {
  category: CATEGORIES.RISK,
  type: TYPES.RISK.INTEGER,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 3,
};
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
};

const capped = (value) => Math.min(MAX_COUNT, value);

// The features of the road events: key (eternal), name (TEXTS key), shape, and
// the state from `{ counts, active }` (null: nothing to publish).
const EVENT_FEATURES = [
  {
    key: 'events',
    name: 'feature_events',
    shape: counter,
    state: ({ counts }) => capped(counts.total),
  },
  {
    key: 'closures',
    name: 'feature_closures',
    shape: counter,
    state: ({ counts }) => capped(counts.closure),
  },
  {
    key: 'accidents',
    name: 'feature_accidents',
    shape: counter,
    state: ({ counts }) => capped(counts.accident + counts.obstruction),
  },
  {
    key: 'congestion',
    name: 'feature_congestion',
    shape: counter,
    state: ({ counts }) => capped(counts.congestion),
  },
  {
    key: 'roadworks',
    name: 'feature_roadworks',
    shape: counter,
    state: ({ counts }) => capped(counts.roadworks),
  },
  {
    key: 'nearest',
    name: 'feature_nearest',
    shape: text,
    state: ({ active }, language) => ({ text: nearestText(active, language) }),
  },
];

// The features of the forecast: the state from `{ today, tomorrow }`, each a
// `{ departure, return }` pair or null.
const FORECAST_FEATURES = [
  ['today', 'departure'],
  ['today', 'return'],
  ['tomorrow', 'departure'],
  ['tomorrow', 'return'],
].map(([day, direction]) => ({
  key: `${direction}_${day}`,
  name: `feature_${direction}_${day}`,
  shape: risk,
  state: (forecast) => forecast[day]?.[direction] ?? null,
}));

/**
 * @description The closest active event, in a few words.
 * @param {object[]} active - The active events of the place.
 * @param {string} language - The language.
 * @returns {string} "N79 · Accident · 3.2 km", or "None".
 */
function nearestText(active, language) {
  if (!active.length) {
    return t('noEvent', language);
  }
  const closest = active.reduce((best, event) => (event.distance < best.distance ? event : best));
  return [
    closest.road,
    categoryLabel(closest.category, language),
    formatDistance(closest.distance, language),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * @description The ids of a place device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} insee - The INSEE code.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, insee) => gladys.externalIds(DEVICE_TYPE, String(insee).toLowerCase());

/**
 * @description The INSEE code a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The code.
 * @example
 * inseeOf('ext:bison:place:71270:events'); // -> '71270'
 */
function inseeOf(externalId) {
  const match = /:place:([0-9][0-9ab][0-9]{3})(?::[a-z0-9_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1].toUpperCase() : null;
}

/**
 * @description The feature specs of a place.
 * @param {boolean} forecast - Whether Bison Futé forecasts its department.
 * @returns {object[]} The specs.
 */
const specsOf = (forecast) =>
  forecast ? [...EVENT_FEATURES, ...FORECAST_FEATURES] : EVENT_FEATURES;

/**
 * @description The device of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - `{ insee, name, department, radius, roads, forecast }`.
 * @param {object} options - `{ language }`.
 * @returns {object} The discovered device.
 */
function buildDevice(gladys, place, { language = 'en' } = {}) {
  const ids = idsOf(gladys, place.insee);
  return {
    name: t('deviceName', language, { place: place.name }),
    external_id: ids.device,
    model: MODEL,
    should_poll: false,
    params: [
      { name: 'INSEE', value: place.insee },
      ...(place.department ? [{ name: 'DEPARTMENT', value: place.department }] : []),
      { name: 'RADIUS_KM', value: String(place.radius) },
      ...(place.roads?.length ? [{ name: 'ROADS', value: place.roads.join(', ') }] : []),
    ],
    features: specsOf(place.forecast).map((spec) => ({
      name: t(spec.name, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a place device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - `{ insee, forecast }`.
 * @param {object} data - `{ active }` (null before the first reading) and
 * `{ today, tomorrow }` (forecast pairs or null).
 * @param {object} options - `{ language }`.
 * @returns {object[]} The states.
 */
function buildStates(gladys, place, { active, today, tomorrow }, { language = 'en' } = {}) {
  const ids = idsOf(gladys, place.insee);
  const states = [];
  if (Array.isArray(active)) {
    const input = { active, counts: countByCategory(active) };
    for (const spec of EVENT_FEATURES) {
      states.push(stateOf(ids.feature(spec.key), spec.state(input, language)));
    }
  }
  if (place.forecast) {
    for (const spec of FORECAST_FEATURES) {
      const value = spec.state({ today, tomorrow });
      if (value !== null && value !== undefined) {
        states.push(stateOf(ids.feature(spec.key), value));
      }
    }
  }
  return states;
}

/**
 * @description One state.
 * @param {string} id - The feature external id.
 * @param {number|object} value - A number, or `{ text }`.
 * @returns {object} The state.
 */
const stateOf = (id, value) =>
  typeof value === 'object'
    ? { device_feature_external_id: id, text: value.text }
    : { device_feature_external_id: id, state: value };

export {
  DEVICE_TYPE,
  MAX_COUNT,
  EVENT_FEATURES,
  FORECAST_FEATURES,
  specsOf,
  idsOf,
  inseeOf,
  nearestText,
  buildDevice,
  buildStates,
};
