// -----------------------------------------------------------------------------
// Configuration of the Bison Futé integration (no account, no key).
//
// Fields of the config_schema, per place (`<n>` from 1 to 3):
//   - `house_<n>`     a house of Gladys (`source: "houses"`): its coordinates
//                     are the centre of the zone, its commune gives the
//                     department of the forecasts;
//   - `commune_<n>`   or a commune typed by hand: its name, its postal code,
//                     "name (postal code)" or its INSEE code; its centre is the
//                     centre of the zone. It wins over the house;
//   - `radius_<n>`    radius of the zone, in km (1 to 200, 20 by default);
//   - `roads_<n>`     only these roads ("N7, A75"), empty for all of them.
// And:
//   - `interval`      minutes between two readings of the road events;
//   - `language`      language of the texts Gladys does not ask for in a
//                     language (feature names, scene summaries): `auto`
//                     follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language` language of the last widget request, kept for the
//                     texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { parseRoads } from './zone.js';

const MAX_PLACES = 3;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
const RADIUS = { min: 1, max: 200, default: 20 };
const INTERVALS = [2, 5, 10, 15, 30];
const DEFAULT_INTERVAL = 5;

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read a radius (the form can send a string, or nothing).
 * @param {unknown} raw - The raw value.
 * @returns {number} Kilometres, within RADIUS.
 * @example
 * readRadius('15'); // -> 15
 */
function readRadius(raw) {
  const value = typeof raw === 'string' && raw.trim() === '' ? NaN : Number(raw);
  if (raw === null || raw === undefined || !Number.isFinite(value)) {
    return RADIUS.default;
  }
  return Math.min(RADIUS.max, Math.max(RADIUS.min, value));
}

/**
 * @description Read the reading interval.
 * @param {unknown} raw - The raw value ("5", 5).
 * @returns {number} Minutes, one of INTERVALS.
 */
function readInterval(raw) {
  const value = Number(raw);
  return INTERVALS.includes(value) ? value : DEFAULT_INTERVAL;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ places: [{ slot, house, commune, radius, roads }],
 * interval, language }`; a slot without a house nor a commune is left out.
 * @example
 * normalizeConfig({ commune_1: 'Mâcon', radius_1: 30, roads_1: 'N79, A6' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const places = [];
  for (let slot = 1; slot <= MAX_PLACES; slot += 1) {
    const house = readString(config[`house_${slot}`]) || null;
    const commune = readString(config[`commune_${slot}`]) || null;
    if (house || commune) {
      places.push({
        slot,
        house,
        commune,
        radius: readRadius(config[`radius_${slot}`]),
        roads: parseRoads(config[`roads_${slot}`]),
      });
    }
  }
  return {
    places,
    interval: readInterval(config.interval),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_PLACES,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  RADIUS,
  INTERVALS,
  DEFAULT_INTERVAL,
  normalizeConfig,
  readLanguage,
  readRadius,
  readInterval,
};
