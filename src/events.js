// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs.
//
// Triggers (one event per transition, never a periodic snapshot):
//   - `event_started`   a road event becomes active in the zone of a place
//                       (a new accident, a closure that starts);
//   - `event_ended`     an active event of the zone is over (gone from the
//                       feed, ended by the operator, past its end);
//   - `event_planned`   a new event is announced in the zone for the next
//                       seven days (a night closure for roadworks);
//   - `forecast_alert`  the Bison Futé forecast of the department is orange,
//                       red or black: for today from 06:00, for tomorrow from
//                       18:00 the day before, again if it worsens.
//
// What was seen is kept per place in /data (`seen`): a restart never fires
// the same event twice, and the first reading of a place is a baseline (no
// event replays what was already there). A scene action or a widget never
// fires an event.
// -----------------------------------------------------------------------------

import { t, categoryLabel, levelLabel, formatDistance, shortDateTime } from './i18n.js';
import { LEVELS, DIRECTIONS, colouredDays } from './forecast.js';
import { countByCategory } from './zone.js';

const TRIGGERS = {
  EVENT_STARTED: 'event_started',
  EVENT_ENDED: 'event_ended',
  EVENT_PLANNED: 'event_planned',
  FORECAST_ALERT: 'forecast_alert',
};
// Local hours from which the forecast of a day is announced.
const ANNOUNCE = { today: 6 * 60, tomorrow: 18 * 60 };
// A reading never fires more events than this per place: a wide zone or a
// feed hiccup must not flood the scenes (300 events a minute at most).
const MAX_EVENTS_PER_PLACE = 25;
const SUMMARY_MAX = 1000;
const LIST_MAX = 10000;
// Outputs of the scene actions (manifest order).
const ROAD_OUTPUTS = [
  'count',
  'closures',
  'accidents',
  'congestion',
  'roadworks',
  'planned',
  'nearest',
  'summary',
];
const FORECAST_OUTPUTS = [
  'date',
  'department',
  'departure_level',
  'departure_label',
  'return_level',
  'return_label',
  'national_departure_label',
  'national_return_label',
  'next_coloured_date',
  'summary',
];

/**
 * @description Truncate a text, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description What is kept of an active or planned event, to describe it
 * once it is gone.
 * @param {object} event - The event of a place.
 * @returns {object} A small copy.
 */
const memoryOf = (event) => ({
  category: event.category,
  road: event.road,
  town: event.town,
  distance: event.distance,
  start: event.start,
});

/**
 * @description The first words of an event: "Closure on the N79 near Mâcon (3.2 km)".
 * @param {object} event - The event (or its memory).
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function headOf(event, language) {
  const values = {
    category: categoryLabel(event.category, language),
    road: event.road ?? '',
    town: event.town ?? '?',
    distance: formatDistance(event.distance, language),
  };
  return t(event.road ? 'summaryHead' : 'summaryHeadNoRoad', language, values);
}

/**
 * @description The sentence of an event.
 * @param {object} event - The event of a place.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone of the dates.
 * @returns {string} The summary.
 */
function eventSummary(event, language, timeZone) {
  const parts = [headOf(event, language)];
  if (event.direction) {
    parts.push(event.direction);
  }
  if (event.description) {
    parts.push(event.description);
  }
  if (event.status === 'planned' && event.start) {
    parts.push(
      t('summaryFrom', language, { date: shortDateTime(event.start, language, timeZone) }),
    );
  }
  if (event.end) {
    parts.push(t('summaryUntil', language, { date: shortDateTime(event.end, language, timeZone) }));
  }
  return clip(parts.join('. ').replace(/\.\./g, '.'), SUMMARY_MAX);
}

/**
 * @description The data of a road event trigger.
 * @param {object} place - The place (`deviceId`, `name`).
 * @param {object} event - The event of the place.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {object} Flat scalars.
 */
function roadEventData(place, event, language, timeZone) {
  return {
    place: place.deviceId,
    place_name: place.name,
    event_id: event.id,
    category: event.category,
    category_label: categoryLabel(event.category, language),
    road: event.road ?? '',
    town: event.town ?? '',
    direction: event.direction ?? '',
    description: clip(event.description ?? '', SUMMARY_MAX),
    distance_km: event.distance,
    severity: event.severity ?? '',
    start: event.start ? new Date(event.start).toISOString() : '',
    end: event.end ? new Date(event.end).toISOString() : '',
    summary: eventSummary(event, language, timeZone),
  };
}

/**
 * @description The scene events of the road events of a reading, and the new memory.
 * @param {object} input - Input.
 * @param {object[]} input.places - The places (`insee`, `deviceId`, `name`).
 * @param {object} input.zones - `{ [insee]: { active, planned } }` (eventsOfPlace).
 * @param {object} input.seen - What was already seen (not modified).
 * @param {number} input.now - Now, in ms.
 * @param {string} input.language - Language of the summaries.
 * @param {string} [input.timeZone] - IANA timezone.
 * @returns {{ events: Array<{ key: string, data: object }>, seen: object }} The
 * events and the new memory (`{ [insee]: { active, planned } }`).
 */
function detectRoadEvents({ places, zones, seen = {}, now, language, timeZone }) {
  const events = [];
  const next = {};
  for (const place of places) {
    const zone = zones[place.insee];
    if (!zone) {
      continue;
    }
    const before = seen[place.insee];
    const memory = {
      active: Object.fromEntries(zone.active.map((event) => [event.id, memoryOf(event)])),
      planned: Object.fromEntries(zone.planned.map((event) => [event.id, memoryOf(event)])),
    };
    next[place.insee] = memory;
    if (!before) {
      // A place never met: its first reading is the reference.
      continue;
    }
    const own = [];
    for (const event of zone.active) {
      if (!before.active?.[event.id]) {
        own.push({
          key: TRIGGERS.EVENT_STARTED,
          data: roadEventData(place, event, language, timeZone),
        });
      }
    }
    for (const [id, old] of Object.entries(before.active ?? {})) {
      if (!memory.active[id]) {
        const data = roadEventData(place, { id, ...old }, language, timeZone);
        own.push({
          key: TRIGGERS.EVENT_ENDED,
          data: {
            place: data.place,
            place_name: data.place_name,
            event_id: id,
            category: data.category,
            category_label: data.category_label,
            road: data.road,
            town: data.town,
            duration_minutes: old.start ? Math.max(0, Math.round((now - old.start) / 60000)) : 0,
            summary: t('summaryEnded', language, { head: headOf(old, language) }),
          },
        });
      }
    }
    for (const event of zone.planned) {
      if (!before.planned?.[event.id] && !before.active?.[event.id]) {
        own.push({
          key: TRIGGERS.EVENT_PLANNED,
          data: roadEventData(place, event, language, timeZone),
        });
      }
    }
    events.push(...own.slice(0, MAX_EVENTS_PER_PLACE));
  }
  return { events, seen: next };
}

/**
 * @description The forecast alerts due now, and the new memory.
 * @param {object} input - Input.
 * @param {object[]} input.places - The places (`insee`, `deviceId`, `name`,
 * `department`, `departmentName`, `forecast`).
 * @param {object} input.forecasts - `{ national, byDepartment }` (parseForecasts).
 * @param {object} input.seen - `{ [insee]: { [date]: { departure, return } } }`.
 * @param {object} input.clock - `{ date, minutes }`: local now.
 * @param {string} input.tomorrow - `YYYY-MM-DD`.
 * @param {string} input.language - Language of the summaries.
 * @returns {{ events: Array<{ key: string, data: object }>, seen: object }} The
 * events and the new memory.
 */
function detectForecastAlerts({ places, forecasts, seen = {}, clock, tomorrow, language }) {
  const events = [];
  const next = {};
  for (const place of places) {
    // A place never met: its first reading is the reference.
    const baseline = !seen[place.insee];
    const memory = Object.fromEntries(
      Object.entries(seen[place.insee] ?? {}).filter(([date]) => date >= clock.date),
    );
    next[place.insee] = memory;
    if (!place.forecast) {
      continue;
    }
    const dates = forecasts?.byDepartment?.[departmentOf(place)] ?? {};
    for (const [day, date] of [
      ['today', clock.date],
      ['tomorrow', tomorrow],
    ]) {
      if (clock.minutes < ANNOUNCE[day] || !dates[date]) {
        continue;
      }
      const known = memory[date] ?? { departure: 0, return: 0 };
      for (const direction of DIRECTIONS) {
        const level = dates[date][direction];
        if (level >= 1 && level > known[direction] && !baseline) {
          events.push({
            key: TRIGGERS.FORECAST_ALERT,
            data: forecastAlertData({ place, forecasts, day, date, direction, level }, language),
          });
        }
      }
      memory[date] = {
        departure: Math.max(known.departure, dates[date].departure),
        return: Math.max(known.return, dates[date].return),
      };
    }
  }
  return { events, seen: next };
}

/**
 * @description The department key of a place in the forecasts.
 * @param {object} place - The place.
 * @returns {string} "71", "1".
 */
const departmentOf = (place) => String(place.forecastKey ?? place.department ?? '');

/**
 * @description The data of a forecast alert.
 * @param {object} input - `{ place, forecasts, day, date, direction, level }`.
 * @param {string} language - The language.
 * @returns {object} Flat scalars.
 */
function forecastAlertData({ place, forecasts, day, date, direction, level }, language) {
  const national = forecasts?.national?.[date] ?? null;
  return {
    place: place.deviceId,
    place_name: place.name,
    department: place.departmentName ?? place.department ?? '',
    day,
    date,
    direction,
    level: LEVELS[level],
    level_label: levelLabel(level, language),
    national_level_label: national ? levelLabel(national[direction], language) : '',
    summary: forecastSummary(
      {
        place,
        pair: forecasts?.byDepartment?.[departmentOf(place)]?.[date] ?? null,
        national,
        day,
      },
      language,
    ),
  };
}

/**
 * @description The sentence of the forecast of a day.
 * @param {object} input - `{ place, pair, national, day }`.
 * @param {string} language - The language.
 * @returns {string} The summary.
 */
function forecastSummary({ place, pair, national, day }, language) {
  const where = place.departmentName ?? place.department ?? place.name;
  if (!pair) {
    return t('summaryForecastUnknown', language, { day: t(`dayLower_${day}`, language), where });
  }
  return t('summaryForecast', language, {
    day: t(`dayLower_${day}`, language),
    where,
    departure: levelLabel(pair.departure, language).toLowerCase(),
    return: levelLabel(pair.return, language).toLowerCase(),
    national: national
      ? t('summaryNational', language, {
          departure: levelLabel(national.departure, language).toLowerCase(),
          return: levelLabel(national.return, language).toLowerCase(),
        })
      : '',
  });
}

/**
 * @description The outputs of the `get_road_events` scene action.
 * @param {object} input - `{ place, zone, categories }`.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {object} Only the declared outputs.
 */
function roadOutputs({ zone, categories }, language, timeZone) {
  const keep = (event) => !categories?.length || categories.includes(event.category);
  const active = zone.active.filter(keep);
  const planned = zone.planned.filter(keep);
  const counts = countByCategory(active);
  const lines = active.map((event) => `- ${eventSummary(event, language, timeZone)}`);
  const summary = active.length
    ? `${t('summaryCount', language, { count: active.length })}\n${lines.join('\n')}`
    : t('summaryNone', language);
  return {
    count: counts.total,
    closures: counts.closure,
    accidents: counts.accident + counts.obstruction,
    congestion: counts.congestion,
    roadworks: counts.roadworks,
    planned: planned.length,
    nearest: active.length
      ? eventSummary(
          active.reduce((best, event) => (event.distance < best.distance ? event : best)),
          language,
          timeZone,
        )
      : '',
    summary: clip(summary, LIST_MAX),
  };
}

/**
 * @description The outputs of the `get_forecast` scene action.
 * @param {object} input - `{ place, forecasts, day, date }`.
 * @param {string} language - The language.
 * @returns {object} Only the declared outputs.
 */
function forecastOutputs({ place, forecasts, day, date }, language) {
  const dates = forecasts?.byDepartment?.[departmentOf(place)] ?? {};
  const pair = dates[date] ?? null;
  const national = forecasts?.national?.[date] ?? null;
  const next = colouredDays(dates, date, 60)[0] ?? null;
  return {
    date,
    department: place.departmentName ?? place.department ?? '',
    departure_level: pair ? pair.departure : null,
    departure_label: pair ? levelLabel(pair.departure, language) : '',
    return_level: pair ? pair.return : null,
    return_label: pair ? levelLabel(pair.return, language) : '',
    national_departure_label: national ? levelLabel(national.departure, language) : '',
    national_return_label: national ? levelLabel(national.return, language) : '',
    next_coloured_date: next ? next.date : '',
    summary: forecastSummary({ place, pair, national, day }, language),
  };
}

/**
 * @description Keep only the declared outputs.
 * @param {object} data - The values.
 * @param {string[]} keys - The declared outputs.
 * @returns {object} The outputs.
 */
const pick = (data, keys) => Object.fromEntries(keys.map((key) => [key, data[key] ?? null]));

export {
  TRIGGERS,
  ANNOUNCE,
  MAX_EVENTS_PER_PLACE,
  ROAD_OUTPUTS,
  FORECAST_OUTPUTS,
  detectRoadEvents,
  detectForecastAlerts,
  roadEventData,
  forecastAlertData,
  eventSummary,
  forecastSummary,
  roadOutputs,
  forecastOutputs,
  departmentOf,
  pick,
};
