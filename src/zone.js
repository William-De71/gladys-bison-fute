// -----------------------------------------------------------------------------
// The road events of a place: those within its radius and, when the user
// listed roads, on one of them.
//
// The distance is the shortest one from the place to the event: to its points
// and to its segments (an event "from A to B" covers the road between). The
// segments are short (a few km), so a flat projection around the place is
// precise enough; the distance itself is the great-circle one.
// -----------------------------------------------------------------------------

import { CATEGORIES, statusAt, normalizeRoad } from './datex.js';

const EARTH_KM = 6371.0088;
const RADIANS = Math.PI / 180;
// How far ahead a planned event is shown and announced.
const PLANNED_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

/**
 * @description Great-circle distance.
 * @param {number[]} a - `[latitude, longitude]`.
 * @param {number[]} b - `[latitude, longitude]`.
 * @returns {number} Kilometres.
 */
function haversine([lat1, lon1], [lat2, lon2]) {
  const dLat = (lat2 - lat1) * RADIANS;
  const dLon = (lon2 - lon1) * RADIANS;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RADIANS) * Math.cos(lat2 * RADIANS) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * @description Distance from a point to a segment.
 * @param {number[]} point - `[latitude, longitude]`.
 * @param {number[]} a - Start of the segment.
 * @param {number[]} b - End of the segment.
 * @returns {number} Kilometres.
 */
function segmentDistance(point, a, b) {
  const scale = Math.cos(point[0] * RADIANS);
  const project = ([lat, lon]) => [(lon - point[1]) * scale, lat - point[0]];
  const [ax, ay] = project(a);
  const [bx, by] = project(b);
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const ratio = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length));
  const closest = [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
  return haversine(point, closest);
}

/**
 * @description Distance from a place to an event.
 * @param {number[]} point - The place, `[latitude, longitude]`.
 * @param {object} event - The event (`points`, `segments`).
 * @returns {number} Kilometres, Infinity without a geometry.
 */
function distanceTo(point, event) {
  let best = Infinity;
  for (const other of event.points ?? []) {
    best = Math.min(best, haversine(point, other));
  }
  for (const [a, b] of event.segments ?? []) {
    best = Math.min(best, segmentDistance(point, a, b));
  }
  return best;
}

/**
 * @description Read the list of roads the user typed.
 * @param {unknown} value - "N7, A75; rn 79".
 * @returns {string[]} Normalized roads ("N7", "A75", "N79").
 */
function parseRoads(value) {
  return [
    ...new Set(
      String(value ?? '')
        .split(/[,;/\n]+/)
        .map((road) => normalizeRoad(road))
        .filter(Boolean),
    ),
  ];
}

const SEVERITY_RANK = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };

/**
 * @description Order of the events of a place: the most serious category
 * first, then the closest.
 * @param {object} a - An event with its distance.
 * @param {object} b - Another one.
 * @returns {number} The comparison.
 */
function byImportance(a, b) {
  return (
    CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
    (SEVERITY_RANK[a.severity] ?? 5) - (SEVERITY_RANK[b.severity] ?? 5) ||
    a.distance - b.distance ||
    a.id.localeCompare(b.id)
  );
}

/**
 * @description The events of a place.
 * @param {object[]} events - Every event of the feed.
 * @param {object} place - `{ latitude, longitude, radius, roads }`.
 * @param {number} now - Now, in ms.
 * @returns {{ active: object[], planned: object[] }} Copies of the events
 * with their `distance` (km, one decimal) and `status`; active ones by
 * importance, planned ones (next PLANNED_DAYS days) by start.
 */
function eventsOfPlace(events, place, now) {
  const origin = [place.latitude, place.longitude];
  const roads = place.roads?.length ? new Set(place.roads) : null;
  const active = [];
  const planned = [];
  for (const event of events) {
    if (roads && !roads.has(event.road)) {
      continue;
    }
    const distance = distanceTo(origin, event);
    if (!(distance <= place.radius)) {
      continue;
    }
    const status = statusAt(event, now);
    const entry = { ...event, distance: Math.round(distance * 10) / 10, status };
    if (status === 'active') {
      active.push(entry);
    } else if (status === 'planned' && event.start - now <= PLANNED_DAYS * DAY_MS) {
      planned.push(entry);
    }
  }
  active.sort(byImportance);
  planned.sort((a, b) => a.start - b.start || byImportance(a, b));
  return { active, planned };
}

/**
 * @description Count the active events of a place per category.
 * @param {object[]} active - The active events.
 * @returns {object} `{ total, closure, accident, … }`.
 */
function countByCategory(active) {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const event of active) {
    counts[event.category] += 1;
  }
  return { total: active.length, ...counts };
}

export {
  PLANNED_DAYS,
  haversine,
  segmentDistance,
  distanceTo,
  parseRoads,
  byImportance,
  eventsOfPlace,
  countByCategory,
};
