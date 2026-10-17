// -----------------------------------------------------------------------------
// Dashboard widgets of the Bison Futé integration.
//
//   - `traffic`   the road events around a place: the counts as tiles, the
//                 active events (most serious first, then the closest) and
//                 the ones planned in the next days as cards, the update time
//                 as a status list;
//   - `forecast`  the Bison Futé forecast of the department of a place:
//                 departures and returns today and tomorrow as tiles, the
//                 next orange, red or black days as cards, France as a whole
//                 in the status list.
//
// The contents come from the last reading kept by the integration: a widget
// never costs a request. Colors are semantic (green success, orange warning,
// red and black danger), never hexadecimal. Every text exists in the four
// languages (the content is cached per language), except the descriptions
// written by the road operators, in French only. Content budget of a card:
// 8 components, 1 main one, 6 tiles, 2 texts, 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import {
  t,
  categoryLabel,
  levelLabel,
  formatDistance,
  shortDateTime,
  shortDate,
  weekday,
} from './i18n.js';
import { colouredDays, worst } from './forecast.js';
import { countByCategory } from './zone.js';
import { displayInstant } from './time.js';

const WIDGETS = { TRAFFIC: 'traffic', FORECAST: 'forecast' };
const TTL = { traffic: 300, forecast: 3600, message: 300 };
const MAX_CARDS = 8;
// Planned events shown after the active ones, at most.
const MAX_PLANNED_CARDS = 3;
// Days of the forecast calendar looked at.
const FORECAST_DAYS = 60;

const CATEGORY_COLORS = {
  closure: 'danger',
  accident: 'danger',
  obstruction: 'warning',
  congestion: 'warning',
  conditions: 'warning',
  roadworks: 'info',
  restriction: 'info',
  other: 'neutral',
};
const LEVEL_COLORS = ['success', 'warning', 'danger', 'danger'];

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The color of a forecast level.
 * @param {number|null} level - 0 to 3.
 * @returns {string} A semantic color.
 */
const levelColor = (level) => LEVEL_COLORS[level] ?? 'neutral';

/**
 * @description The card of a road event.
 * @param {object} event - The event of a place.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {object} A card-list item.
 */
function eventCard(event, language, timeZone) {
  const title = [event.road, categoryLabel(event.category, language)].filter(Boolean).join(' · ');
  const lines = [];
  if (event.direction) {
    lines.push(event.direction);
  }
  if (event.description) {
    lines.push(event.description);
  }
  if (event.period) {
    lines.push(event.period);
  }
  if (event.queueLength) {
    lines.push(
      t('widgetQueue', language, { length: formatDistance(event.queueLength / 1000, language) }),
    );
  }
  if (event.status === 'planned' && event.start) {
    lines.push(t('widgetFrom', language, { date: shortDateTime(event.start, language, timeZone) }));
  }
  if (event.end) {
    lines.push(t('widgetUntil', language, { date: shortDateTime(event.end, language, timeZone) }));
  }
  if (event.source) {
    lines.push(event.source);
  }
  const subtitle = [event.town, formatDistance(event.distance, language)]
    .filter(Boolean)
    .join(' · ');
  return {
    title: clip(title, 60),
    subtitle: clip(subtitle, 60),
    badge:
      event.status === 'planned'
        ? {
            text: clip(
              t('widgetPlannedBadge', language, {
                date: shortDate(event.start, language, timeZone),
              }),
              16,
            ),
            color: 'neutral',
          }
        : {
            text: clip(categoryLabel(event.category, language), 16),
            color: CATEGORY_COLORS[event.category],
          },
    ...(lines.length ? { description: clip(lines.join('\n'), 2000) } : {}),
  };
}

/**
 * @description The traffic widget of a place.
 * @param {object} input - Input.
 * @param {object} input.place - `{ name, radius, roads }`.
 * @param {object} input.zone - `{ active, planned }` (eventsOfPlace).
 * @param {number|null} input.readAt - When the feed was read.
 * @param {number|null} input.publishedAt - When the feed was published.
 * @param {string} input.language - The language.
 * @param {string} [input.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildTrafficWidget({ place, zone, readAt, publishedAt, language, timeZone }) {
  const counts = countByCategory(zone.active);
  const scope = place.roads?.length
    ? t('widgetScopeRoads', language, { radius: place.radius, roads: place.roads.join(', ') })
    : t('widgetScope', language, { radius: place.radius });
  const components = [
    { type: 'text', variant: 'heading', text: clip(`${place.name} · ${scope}`, 40) },
    tile(t('widgetEvents', language), counts.total, counts.total ? 'primary' : 'success'),
    tile(t('widgetClosures', language), counts.closure, counts.closure ? 'danger' : 'neutral'),
    tile(
      t('widgetAccidents', language),
      counts.accident + counts.obstruction,
      counts.accident + counts.obstruction ? 'danger' : 'neutral',
    ),
    tile(
      t('widgetCongestion', language),
      counts.congestion,
      counts.congestion ? 'warning' : 'neutral',
    ),
    tile(t('widgetRoadworks', language), counts.roadworks, counts.roadworks ? 'info' : 'neutral'),
  ];
  const planned = zone.planned.slice(0, MAX_PLANNED_CARDS);
  const active = zone.active.slice(0, MAX_CARDS - Math.min(planned.length, 2));
  const items = [...active, ...planned]
    .slice(0, MAX_CARDS)
    .map((event) => eventCard(event, language, timeZone));
  if (items.length) {
    components.push({ type: 'card-list', display: 'list', items });
  } else {
    components.push({
      type: 'text',
      variant: 'body',
      text: clip(t('widgetNoEvent', language, { radius: place.radius }), 300),
    });
  }
  const status = [];
  if (zone.active.length > active.length) {
    status.push({
      label: t('widgetMore', language),
      value: String(zone.active.length - active.length),
      color: 'neutral',
    });
  }
  status.push({
    label: t('widgetPlanned', language),
    value: String(zone.planned.length),
    color: zone.planned.length ? 'info' : 'neutral',
  });
  if (publishedAt || readAt) {
    status.push({
      label: t('widgetUpdated', language),
      value: shortDateTime(publishedAt ?? readAt, language, timeZone),
      color: 'neutral',
    });
  }
  components.push({ type: 'status', items: status });
  return { ttl_seconds: TTL.traffic, components };
}

/**
 * @description A value tile.
 * @param {string} label - The label.
 * @param {number|string} value - The value.
 * @param {string} color - A semantic color.
 * @returns {object} The tile.
 */
const tile = (label, value, color) => ({ type: 'value', label: clip(label, 24), value, color });

/**
 * @description The forecast widget of a place.
 * @param {object} input - Input.
 * @param {object} input.place - `{ name, department, departmentName }`.
 * @param {object} input.dates - `{ [date]: { departure, return } }` of its department.
 * @param {object} input.national - The same for France.
 * @param {string} input.today - `YYYY-MM-DD`.
 * @param {string} input.tomorrow - `YYYY-MM-DD`.
 * @param {number|null} input.readAt - When the forecasts were read.
 * @param {string} input.language - The language.
 * @param {string} [input.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildForecastWidget({
  place,
  dates,
  national,
  today,
  tomorrow,
  readAt,
  language,
  timeZone,
}) {
  const where = place.departmentName
    ? `${place.departmentName} (${place.department})`
    : String(place.department ?? place.name);
  const components = [{ type: 'text', variant: 'heading', text: clip(where, 40) }];
  for (const [day, date] of [
    ['today', today],
    ['tomorrow', tomorrow],
  ]) {
    for (const direction of ['departure', 'return']) {
      const level = dates?.[date]?.[direction] ?? null;
      components.push(
        tile(
          t(`widget_${direction}_${day}`, language),
          level === null ? '-' : clip(levelLabel(level, language), 12),
          levelColor(level),
        ),
      );
    }
  }
  const coloured = colouredDays(dates, today, FORECAST_DAYS);
  if (coloured.length) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: coloured.slice(0, MAX_CARDS).map((day) => ({
        title: clip(
          t('widgetDayTitle', language, {
            departure: levelLabel(day.departure, language).toLowerCase(),
            return: levelLabel(day.return, language).toLowerCase(),
          }),
          60,
        ),
        date: displayInstant(day.date),
        badge: {
          text: clip(weekday(day.date, language), 16),
          color: levelColor(worst(day)),
        },
      })),
    });
  } else {
    components.push({
      type: 'text',
      variant: 'body',
      text: t('widgetNoColouredDay', language, { days: FORECAST_DAYS }),
    });
  }
  const items = [];
  for (const [day, date] of [
    ['today', today],
    ['tomorrow', tomorrow],
  ]) {
    const pair = national?.[date];
    if (pair) {
      items.push({
        label: t(`widgetFrance_${day}`, language),
        value: clip(
          `${levelLabel(pair.departure, language)} / ${levelLabel(pair.return, language)}`,
          40,
        ),
        color: levelColor(worst(pair)),
      });
    }
  }
  if (readAt) {
    items.push({
      label: t('widgetUpdated', language),
      value: shortDateTime(readAt, language, timeZone),
      color: 'neutral',
    });
  }
  if (items.length) {
    components.push({ type: 'status', items });
  }
  return { ttl_seconds: TTL.forecast, components };
}

/**
 * @description Read the settings of a widget.
 * @param {object} [settings] - The settings.
 * @returns {{ place: string|null }} The device external id chosen, or null.
 */
const readWidgetSettings = (settings = {}) => ({
  place: typeof settings?.place === 'string' && settings.place ? settings.place : null,
});

export {
  WIDGETS,
  TTL,
  CATEGORY_COLORS,
  clip,
  messageContent,
  levelColor,
  eventCard,
  buildTrafficWidget,
  buildForecastWidget,
  readWidgetSettings,
};
