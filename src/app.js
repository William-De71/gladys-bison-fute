// -----------------------------------------------------------------------------
// The Bison Futé integration: every handler, registered on a Gladys client.
//
// Brings the French road information of Bison Futé into Gladys:
//   - devices (device.js): one per place, a house of Gladys or a commune
//     (geo.js): the road events of the zone (all, closures, accidents and
//     obstacles, traffic jams, roadworks, the closest one) and the forecast
//     of the department (departures and returns, today and tomorrow);
//   - scene triggers (events.js): road event started, ended, planned;
//     orange, red or black forecast;
//   - scene actions: read the road events of a place, read the forecast;
//   - dashboard widgets (widgets.js): traffic, forecast.
//
// The road events come from the DATEX II snapshot of the national road
// network (datex.js), read every few minutes with a conditional request; the
// forecasts from the calendar of the website (forecast.js), read every six
// hours. Both on the integration's own timer, never on a Gladys poll.
// Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createBisonClient } from './bison-api.js';
import { createGeoClient } from './geo.js';
import { createStore, DEFAULT_PATH } from './store.js';
import { parseSituations, CATEGORIES } from './datex.js';
import { parseForecasts, departmentKey } from './forecast.js';
import { eventsOfPlace } from './zone.js';
import { buildDevice, buildStates, idsOf, inseeOf } from './device.js';
import {
  detectRoadEvents,
  detectForecastAlerts,
  roadOutputs,
  forecastOutputs,
  pick,
  ROAD_OUTPUTS,
  FORECAST_OUTPUTS,
} from './events.js';
import {
  WIDGETS,
  messageContent,
  buildTrafficWidget,
  buildForecastWidget,
  readWidgetSettings,
} from './widgets.js';
import { defaultTimeZone, localClock, addDays, MINUTE_MS } from './time.js';
import { t, all, LANGUAGES } from './i18n.js';

const ACTIONS = { REFRESH: 'refresh', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { GET_ROAD_EVENTS: 'get_road_events', GET_FORECAST: 'get_forecast' };
// The forecasts are read again after this delay.
const FORECAST_MAX_AGE_MS = 6 * 3600 * 1000;
// After a failed reading of the events: a quicker try first.
const RETRY_MS = 2 * MINUTE_MS;
// A manual refresh never reads again within this delay.
const REFRESH_MIN_INTERVAL_MS = 60 * 1000;
// A snapshot holding less than this share of the previous one is a hiccup of
// the server (seen on open data feeds), not the end of half the events.
const SHRINK_GUARD = { ratio: 0.5, from: 40 };
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description Whether Bison Futé forecasts a department: mainland France,
 * without Corsica (the departments of the forecast file).
 * @param {string|null} department - "71", "01", "2A", "974".
 * @returns {boolean} True when covered.
 */
function forecastCovered(department) {
  const key = departmentKey(department);
  return /^\d+$/.test(key) && Number(key) >= 1 && Number(key) <= 95 && key !== '20';
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport of Bison Futé and geo.api.gouv.fr (tests).
 * @param {string} [options.storePath] - The file kept in /data.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of "today" (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`. French
  // until a widget is shown: the service covers France only.
  let language = 'fr';
  let createdDevices = new Set();
  // The configured places, resolved: `{ slot, insee, name, department,
  // departmentName, latitude, longitude, radius, roads, deviceId, forecast }`,
  // and the problems of the places that gave none.
  let places = [];
  let placeErrors = [];
  // The last snapshot of the road events (kept in memory only).
  let feed = { events: null, publishedAt: null, readAt: null, lastModified: null };
  let zones = {};
  let lastStatus = null;
  let lastDiscovery = null;
  let lastZonesSignature = null;
  let lastForecastSignature = null;
  let lastError = null;
  let failures = 0;
  // A snapshot that shrank is refused once, then accepted if it stays so.
  let shrinkRefused = false;
  let timer = null;
  let running = null;
  let stopped = false;

  const fetchOption = fetchFn ? { fetch: fetchFn } : {};
  const api = createBisonClient({ now, ...fetchOption });
  const geo = createGeoClient(fetchOption);
  const store = createStore({ path: storePath, logger });

  const clock = () => localClock(now(), timeZone);
  const today = () => clock().date;

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  // --- Places ------------------------------------------------------------------------

  /**
   * @description How a place is named in a message.
   * @param {object} place - `{ slot }`.
   * @param {object|null} house - The house, when found.
   * @returns {Function} `(language) => text`.
   */
  const placeName = (place, house) => (l) =>
    house ? t('placeHouse', l, { name: house.name }) : t('placeSlot', l, { slot: place.slot });

  /**
   * @description Resolve every configured place: its commune (cached in /data)
   * and the centre of its zone.
   * @returns {Promise<void>}
   */
  async function resolvePlaces() {
    const found = [];
    const errors = [];
    let houses = null;
    for (const place of config.places) {
      let house = null;
      try {
        let key;
        if (place.commune) {
          key = `commune:${place.commune.toLowerCase()}`;
        } else {
          if (houses === null) {
            houses = await gladys.getHouses().catch((err) => {
              logger.warn(`Unable to read the houses: ${err.message}`);
              return [];
            });
          }
          house = houses.find((candidate) => candidate.selector === place.house) ?? null;
          if (!house) {
            throw Object.assign(new Error('unknown house'), { message_key: 'placeUnknownHouse' });
          }
          if (typeof house.latitude !== 'number' || typeof house.longitude !== 'number') {
            throw Object.assign(new Error('no location'), { message_key: 'placeNoLocation' });
          }
          key = `house:${house.latitude.toFixed(4)},${house.longitude.toFixed(4)}`;
        }
        let commune = store.data.communes[key];
        if (!commune || commune.latitude === undefined) {
          commune = place.commune
            ? await geo.byQuery(place.commune)
            : await geo.byCoordinates(house.latitude, house.longitude);
          store.data.communes[key] = commune;
        }
        const duplicate = found.find((other) => other.insee === commune.insee);
        if (duplicate) {
          throw Object.assign(new Error(`same commune as place ${duplicate.slot}`), {
            message_key: 'placeDuplicate',
            values: { other: duplicate.slot },
          });
        }
        const latitude = house ? house.latitude : commune.latitude;
        const longitude = house ? house.longitude : commune.longitude;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          throw Object.assign(new Error('no centre'), { kind: 'not_found' });
        }
        found.push({
          slot: place.slot,
          insee: commune.insee,
          name: commune.name,
          department: commune.department,
          departmentName: commune.departmentName,
          latitude,
          longitude,
          radius: place.radius,
          roads: place.roads,
          deviceId: idsOf(gladys, commune.insee).device,
          forecast: forecastCovered(commune.department),
          forecastKey: departmentKey(commune.department),
        });
      } catch (err) {
        logger.warn(`Place ${place.slot}: ${err.message}`);
        let detail;
        if (err.message_key) {
          detail = (l) => t(err.message_key, l, err.values ?? {});
        } else if (err.kind === 'not_found') {
          detail = (l) => t('placeNotFound', l, { query: place.commune });
        } else if (err.kind === 'outside') {
          detail = (l) => t('placeOutside', l);
        } else {
          detail = (l) => t('placeGeoError', l, { detail: err.message });
        }
        errors.push({ slot: place.slot, place: placeName(place, house), detail });
      }
    }
    places = found;
    placeErrors = errors;
    await store.save();
  }

  /**
   * @description What makes the zone of a place: a change starts a new baseline.
   * @param {object} place - The place.
   * @returns {string} The signature.
   */
  const zoneSignature = (place) =>
    JSON.stringify([place.latitude, place.longitude, place.radius, place.roads]);

  // --- Devices and states ------------------------------------------------------------

  /**
   * @description The forecast pairs of a place for today and tomorrow.
   * @param {object} place - The place.
   * @returns {{ today: object|null, tomorrow: object|null }} The pairs.
   */
  function forecastOf(place) {
    const dates = store.data.forecasts?.byDepartment?.[place.forecastKey] ?? {};
    const date = today();
    return { today: dates[date] ?? null, tomorrow: dates[addDays(date, 1)] ?? null };
  }

  /**
   * @description Offer the place devices on the Discovery screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} The count.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = places.map((place) => buildDevice(gladys, place, { language: lang }));
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created devices (only the changed ones).
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const lang = textLanguage();
    const states = places
      .filter((place) => createdDevices.has(place.deviceId))
      .flatMap((place) =>
        buildStates(
          gladys,
          place,
          { active: zones[place.insee]?.active ?? null, ...forecastOf(place) },
          { language: lang },
        ),
      );
    for (let index = 0; index < states.length; index += 100) {
      await gladys.publishChangedStates(states.slice(index, index + 100));
    }
  }

  const publishQuietly = () =>
    publishStates().catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));

  /**
   * @description Ask the open widgets to pull their content again.
   * @param {string[]} keys - The widget keys.
   */
  function refreshWidgets(keys) {
    for (const key of keys) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description Read the forecasts when they are older than six hours (or
   * never read). A failure keeps the previous ones.
   * @param {boolean} [force] - Read even when fresh.
   * @returns {Promise<void>}
   */
  async function readForecasts(force = false) {
    const kept = store.data.forecasts;
    const wanted = [...new Set(places.filter((p) => p.forecast).map((p) => p.forecastKey))];
    const missing = wanted.some((key) => !kept?.byDepartment?.[key]);
    const fresh = kept?.readAt && now() - kept.readAt < FORECAST_MAX_AGE_MS && kept.from <= today();
    if (!force && fresh && !missing) {
      return;
    }
    try {
      const answer = await api.forecasts(missing ? null : (kept?.lastModified ?? null));
      if (answer.notModified) {
        store.data.forecasts = { ...kept, readAt: now() };
      } else {
        const from = addDays(today(), -1);
        const parsed = parseForecasts(answer.json, { departments: wanted, from, days: 400 });
        store.data.forecasts = {
          readAt: now(),
          lastModified: answer.lastModified ?? null,
          from,
          national: parsed.national,
          byDepartment: parsed.byDepartment,
        };
      }
      await store.save();
    } catch (err) {
      logger.warn(`Bison Futé forecasts not read (${err.kind ?? 'error'}): ${err.message}`);
      if (!kept) {
        throw err;
      }
    }
  }

  /**
   * @description Read the snapshot of the road events (conditionally).
   * @returns {Promise<void>}
   */
  async function readEvents() {
    const answer = await api.events(feed.events ? feed.lastModified : null);
    if (answer.notModified) {
      feed = { ...feed, readAt: now() };
      return;
    }
    let parsed;
    try {
      parsed = parseSituations(answer.body);
    } catch (err) {
      throw Object.assign(new Error(err.message), { kind: 'invalid' });
    }
    const previous = feed.events?.length ?? 0;
    if (
      !shrinkRefused &&
      previous >= SHRINK_GUARD.from &&
      parsed.events.length < previous * SHRINK_GUARD.ratio
    ) {
      // Refused once: the next reading tells whether it was a hiccup.
      shrinkRefused = true;
      feed = { ...feed, lastModified: null };
      throw Object.assign(
        new Error(`snapshot shrank from ${previous} to ${parsed.events.length} events`),
        { kind: 'invalid', shrink: true },
      );
    }
    shrinkRefused = false;
    feed = {
      events: parsed.events,
      publishedAt: parsed.publishedAt,
      readAt: now(),
      lastModified: answer.lastModified ?? null,
    };
  }

  /**
   * @description The status message of the integration.
   * @returns {object} The multi-language message.
   */
  function connectedMessage() {
    return Object.fromEntries(
      LANGUAGES.map((l) => {
        const summary = places
          .map((place) =>
            t('statusPlaceCount', l, {
              name: place.name,
              count: zones[place.insee]?.active.length ?? 0,
            }),
          )
          .join(', ');
        const text = [
          t('statusConnected', l, { places: summary || '-', interval: config.interval }),
          ...placeErrors.map((error) =>
            t('statusPlace', l, { place: error.place(l), detail: error.detail(l) }),
          ),
        ].join(' ');
        return [l, text];
      }),
    );
  }

  /**
   * @description The multi-language message of a failed reading.
   * @param {Error} err - The error.
   * @param {number} minutes - Minutes before the next try.
   * @returns {object} The message.
   */
  function errorMessage(err, minutes) {
    const detail = String(err.message).slice(0, 80);
    return err.kind === 'invalid'
      ? all('statusInvalid', { detail, minutes })
      : all('statusUnreachable', { detail, minutes });
  }

  /**
   * @description Report what keeps the integration from reading, if anything.
   * @returns {Promise<boolean>} True when a reading can be made.
   */
  async function readyToRead() {
    if (places.length > 0) {
      return true;
    }
    const message = placeErrors.length
      ? Object.fromEntries(
          LANGUAGES.map((l) => [
            l,
            placeErrors
              .map((error) =>
                t('statusPlace', l, { place: error.place(l), detail: error.detail(l) }),
              )
              .join(' '),
          ]),
        )
      : all('noPlaces');
    await reportStatus(false, message);
    return false;
  }

  /**
   * @description Compute the zones, fire the scene events, publish everything.
   * @returns {Promise<void>}
   */
  async function digest() {
    const current = now();
    const lang = textLanguage();
    if (feed.events) {
      zones = Object.fromEntries(
        places.map((place) => [place.insee, eventsOfPlace(feed.events, place, current)]),
      );
    }
    const events = [];
    if (feed.events) {
      const seenRoads = Object.fromEntries(
        places
          .map((place) => [place.insee, store.data.seen.roads?.[place.insee]])
          .filter(([insee, memory]) => {
            const place = places.find((candidate) => candidate.insee === insee);
            return memory && memory.signature === zoneSignature(place);
          }),
      );
      const road = detectRoadEvents({
        places,
        zones,
        seen: seenRoads,
        now: current,
        language: lang,
        timeZone,
      });
      events.push(...road.events);
      store.data.seen.roads = Object.fromEntries(
        Object.entries(road.seen).map(([insee, memory]) => [
          insee,
          { ...memory, signature: zoneSignature(places.find((place) => place.insee === insee)) },
        ]),
      );
    }
    if (store.data.forecasts) {
      const forecast = detectForecastAlerts({
        places,
        forecasts: store.data.forecasts,
        seen: store.data.seen.forecasts,
        clock: clock(),
        tomorrow: addDays(today(), 1),
        language: lang,
      });
      events.push(...forecast.events);
      store.data.seen.forecasts = forecast.seen;
    }
    await store.save();
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
      } catch (err) {
        logger.warn(`Unable to fire ${event.key}: ${err.message}`);
      }
    }
    if (events.length) {
      logger.info(`${events.length} scene event(s) fired`);
    }
    await publishQuietly();
    const zonesSignature = JSON.stringify([feed.publishedAt, zones]);
    const forecastSignature = JSON.stringify([today(), store.data.forecasts?.readAt]);
    const widgets = [];
    if (zonesSignature !== lastZonesSignature) {
      widgets.push(WIDGETS.TRAFFIC);
      lastZonesSignature = zonesSignature;
    }
    if (forecastSignature !== lastForecastSignature) {
      widgets.push(WIDGETS.FORECAST);
      lastForecastSignature = forecastSignature;
    }
    refreshWidgets(widgets);
  }

  /**
   * @description One reading round: forecasts when stale, road events, then
   * everything that follows.
   * @param {object} [options] - `{ forceForecasts }`.
   * @returns {Promise<boolean>} True when the road events were read.
   */
  async function round({ forceForecasts = false } = {}) {
    if (!(await readyToRead())) {
      return false;
    }
    let error = null;
    try {
      await readForecasts(forceForecasts);
    } catch (err) {
      error = err;
    }
    try {
      await readEvents();
    } catch (err) {
      error = err;
    }
    try {
      await digest();
    } catch (err) {
      logger.error('Processing', err);
    }
    if (error) {
      failures += 1;
      lastError = { at: now(), kind: error.kind ?? 'error', message: error.message };
      logger.warn(`Bison Futé reading failed (${error.kind ?? 'error'}): ${error.message}`);
      // A shrunk snapshot is not shown: the next reading decides.
      if (!error.shrink) {
        const minutes = Math.max(1, Math.round(nextDelay(true) / MINUTE_MS));
        await reportStatus(false, errorMessage(error, minutes));
      }
      return false;
    }
    failures = 0;
    lastError = null;
    logger.debug?.(
      `Bison Futé read: ${feed.events?.length ?? 0} event(s), ${places
        .map((place) => `${place.name} ${zones[place.insee]?.active.length ?? 0}`)
        .join(', ')}`,
    );
    await reportStatus(true, connectedMessage());
    return true;
  }

  /**
   * @description Run one reading at a time.
   * @param {object} [options] - round() options.
   * @returns {Promise<boolean>} The result of round().
   */
  function read(options) {
    if (!running) {
      running = round(options).finally(() => {
        running = null;
      });
    }
    return running;
  }

  // --- Timer -------------------------------------------------------------------------

  /**
   * @description The delay before the next reading.
   * @param {boolean} [failed] - After a failure.
   * @returns {number} Milliseconds.
   */
  function nextDelay(failed = lastError !== null) {
    const interval = config.interval * MINUTE_MS;
    return failed && failures <= 1 ? Math.min(interval, RETRY_MS) : interval;
  }

  /**
   * @description Arm the timer for the next reading.
   */
  function schedule() {
    if (!timers || stopped) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(tick, nextDelay());
    timer.unref?.();
  }

  /**
   * @description What the timer does when it fires.
   * @returns {Promise<void>}
   */
  async function tick() {
    try {
      await read();
    } catch (err) {
      logger.error('Timer', err);
    }
    schedule();
  }

  /**
   * @description Resolve the places, offer the devices, read.
   * @param {object} [options] - round() options.
   * @returns {Promise<void>}
   */
  async function refreshAll(options) {
    await resolvePlaces();
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await read(options);
    schedule();
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The place of a device external id (or the first place).
   * @param {unknown} externalId - The external id, or nothing.
   * @returns {object|null} The place.
   */
  function placeOf(externalId) {
    const insee = inseeOf(externalId);
    if (insee) {
      return places.find((place) => place.insee === insee) ?? null;
    }
    return places[0] ?? null;
  }

  gladys.onWidgetGet(WIDGETS.TRAFFIC, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const place = placeOf(readWidgetSettings(settings).place);
    if (!place) {
      return messageContent(t('widgetNoPlace', lang));
    }
    const zone = zones[place.insee];
    if (!zone) {
      return messageContent(t('widgetNotRead', lang), 60);
    }
    return buildTrafficWidget({
      place,
      zone,
      readAt: feed.readAt,
      publishedAt: feed.publishedAt,
      language: lang,
      timeZone,
    });
  });

  gladys.onWidgetGet(WIDGETS.FORECAST, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const place = placeOf(readWidgetSettings(settings).place);
    if (!place) {
      return messageContent(t('widgetNoPlace', lang));
    }
    if (!place.forecast) {
      return messageContent(
        t('widgetNoForecast', lang, { where: place.departmentName ?? place.name }),
        3600,
      );
    }
    const forecasts = store.data.forecasts;
    if (!forecasts?.byDepartment?.[place.forecastKey]) {
      return messageContent(t('widgetNotRead', lang), 60);
    }
    return buildForecastWidget({
      place,
      dates: forecasts.byDepartment[place.forecastKey],
      national: forecasts.national,
      today: today(),
      tomorrow: addDays(today(), 1),
      readAt: forecasts.readAt,
      language: lang,
      timeZone,
    });
  });

  // --- Scene actions -----------------------------------------------------------------

  /**
   * @description The place a scene action names.
   * @param {unknown} value - The device external id, or nothing.
   * @returns {object} The place.
   * @throws {Error} When unknown.
   */
  function actionPlace(value) {
    const place = placeOf(value);
    if (!place) {
      throw new Error(`Unknown place: ${value ?? '(none)'}`);
    }
    return place;
  }

  gladys.onSceneAction(SCENE_ACTIONS.GET_ROAD_EVENTS, async (fields = {}) => {
    const place = actionPlace(fields.place);
    const zone = zones[place.insee];
    if (!zone) {
      throw new Error('The road events of Bison Futé have not been read yet');
    }
    const categories = (Array.isArray(fields.categories) ? fields.categories : []).filter((c) =>
      CATEGORIES.includes(c),
    );
    return pick(roadOutputs({ zone, categories }, textLanguage(), timeZone), ROAD_OUTPUTS);
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_FORECAST, async (fields = {}) => {
    const place = actionPlace(fields.place);
    if (!place.forecast) {
      throw new Error(`Bison Futé publishes no forecast for the department ${place.department}`);
    }
    if (!store.data.forecasts?.byDepartment?.[place.forecastKey]) {
      throw new Error('The forecasts of Bison Futé have not been read yet');
    }
    const day = fields.day === 'tomorrow' ? 'tomorrow' : 'today';
    const date = day === 'tomorrow' ? addDays(today(), 1) : today();
    return pick(
      forecastOutputs({ place, forecasts: store.data.forecasts, day, date }, textLanguage()),
      FORECAST_OUTPUTS,
    );
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (feed.readAt && now() - feed.readAt < REFRESH_MIN_INTERVAL_MS && !lastError) {
      return all('refreshTooSoon', { seconds: Math.round((now() - feed.readAt) / 1000) });
    }
    await resolvePlaces();
    await publishDiscoveredDevices().catch(() => {});
    const ok = await read({ forceForecasts: true });
    schedule();
    if (!ok) {
      return lastStatus ? JSON.parse(lastStatus)[1] : all('noPlaces');
    }
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        t('refreshDone', l, {
          places: places
            .map((place) =>
              t('statusPlaceCount', l, {
                name: place.name,
                count: zones[place.insee]?.active.length ?? 0,
              }),
            )
            .join(', '),
        }),
      ]),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      today: today(),
      interval: config.interval,
      places: places.map(({ slot, insee, name, department, radius, roads, forecast }) => ({
        slot,
        insee,
        name,
        department,
        radius,
        roads,
        forecast,
        created: createdDevices.has(idsOf(gladys, insee).device),
        active: zones[insee]?.active.map((e) => `${e.id} ${e.category} ${e.road} ${e.distance}km`),
        planned: zones[insee]?.planned.length ?? null,
      })),
      placeErrors: placeErrors.map((error) => ({ slot: error.slot, detail: error.detail('en') })),
      feed: {
        events: feed.events?.length ?? null,
        publishedAt: feed.publishedAt ? new Date(feed.publishedAt).toISOString() : null,
        readAt: feed.readAt ? new Date(feed.readAt).toISOString() : null,
        lastModified: feed.lastModified,
      },
      forecasts: store.data.forecasts
        ? {
            readAt: new Date(store.data.forecasts.readAt).toISOString(),
            lastModified: store.data.forecasts.lastModified,
            departments: Object.keys(store.data.forecasts.byDepartment ?? {}),
          }
        : null,
      lastError,
      failures,
      requests: api.requests,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Bison Futé diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await resolvePlaces();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} place(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly();
    refreshWidgets(Object.values(WIDGETS));
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    await loadConfig(rawConfig);
    lastDiscovery = null;
    lastZonesSignature = null;
    lastForecastSignature = null;
    failures = 0;
    logger.info('Configuration updated');
    await refreshAll();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await refreshAll();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearTimeout(timer);
  });

  return {
    store,
    api,
    read,
    tick,
    refreshAll,
    getConfig: () => config,
    getPlaces: () => places,
    getZones: () => zones,
    getFeed: () => feed,
    whenReady: () => startup,
  };
}

export {
  createApp,
  forecastCovered,
  ACTIONS,
  SCENE_ACTIONS,
  FORECAST_MAX_AGE_MS,
  REFRESH_MIN_INTERVAL_MS,
  SHRINK_GUARD,
};
