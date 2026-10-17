// -----------------------------------------------------------------------------
// The road events of Bison Futé, from the open DATEX II feed of the national
// road network (réseau routier national non concédé, published by the DIR,
// the state road agencies, on tipi.bison-fute.gouv.fr).
//
// The feed is a SOAP envelope holding one DATEX II 2.x SituationPublication:
// a snapshot of every known situation. A situation is one event on the road
// ("accident on the N406 at Bonneuil-sur-Marne"); it is made of records, each
// a facet of it (an accident, the lane it closes, the speed limit it sets).
// The namespace prefix changes between files (`ns2:` in the snapshot, none in
// the unit files), so it is dropped, from the tags and from `xsi:type`.
//
// An event of the integration is one situation, summed up as:
//   - its category (CATEGORIES), the most serious one of its records: a
//     roadworks situation that closes the road is a closure;
//   - its road ("N7", "A75"), direction ("De Lyon vers Paris"), town, the
//     descriptions written by the operators (French only: the feed has no
//     other language), its source (the DIR) and its severity;
//   - its validity: start, end (or none: until further notice), suspended or
//     ended (an end mark of the operator), and the period name ("Uniquement
//     de nuit") of recurring roadworks;
//   - its geometry: the points and segments it covers, for the distance to a
//     place.
// -----------------------------------------------------------------------------

import { XMLParser } from 'fast-xml-parser';

// The categories, most serious first: an event takes the first one any of its
// records has. Eternal keys (scene filters, feature keys, translations).
const CATEGORIES = [
  'closure',
  'accident',
  'obstruction',
  'congestion',
  'conditions',
  'roadworks',
  'restriction',
  'other',
];

// DATEX II record types (xsi:type, without prefix) -> category.
const RECORD_CATEGORIES = {
  Accident: 'accident',
  VehicleObstruction: 'obstruction',
  GeneralObstruction: 'obstruction',
  AnimalPresenceObstruction: 'obstruction',
  EnvironmentalObstruction: 'obstruction',
  InfrastructureDamageObstruction: 'obstruction',
  DisturbanceActivity: 'obstruction',
  AbnormalTraffic: 'congestion',
  WeatherRelatedRoadConditions: 'conditions',
  NonWeatherRelatedRoadConditions: 'conditions',
  PoorEnvironmentConditions: 'conditions',
  MaintenanceWorks: 'roadworks',
  ConstructionWorks: 'roadworks',
  RoadOrCarriagewayOrLaneManagement: 'restriction',
  SpeedManagement: 'restriction',
  ReroutingManagement: 'restriction',
  GeneralInstructionOrMessageToRoadUsers: 'restriction',
  GeneralNetworkManagement: 'restriction',
  WinterDrivingManagement: 'restriction',
  RoadsideServiceDisruption: 'restriction',
  OperatorAction: 'restriction',
};

// Management types that close the road (RoadOrCarriagewayOrLaneManagement).
const CLOSING_TYPES = new Set([
  'roadClosed',
  'closedPermanentlyForTheWinter',
  'carriagewayClosures',
]);

// The element of each record type that carries its sub-type.
const SUBTYPE_KEYS = [
  'accidentType',
  'vehicleObstructionType',
  'obstructionType',
  'animalPresenceType',
  'environmentalObstructionType',
  'infrastructureDamageType',
  'disturbanceActivityType',
  'abnormalTrafficType',
  'weatherRelatedRoadConditionType',
  'nonWeatherRelatedRoadConditionType',
  'poorEnvironmentType',
  'roadMaintenanceType',
  'constructionWorkType',
  'roadOrCarriagewayOrLaneManagementType',
  'speedManagementType',
  'reroutingManagementType',
  'generalInstructionToRoadUsersType',
  'generalNetworkManagementType',
  'winterEquipmentManagementType',
  'roadsideServiceDisruptionType',
];

const SEVERITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const DESCRIPTION_MAX = 400;
// Sentences the operators add to nearly every record: they tell nothing.
const BOILERPLATE = [/^la mesure est obligatoire\.?$/i, /^sur \d+ m\.?$/i];

// Elements that may repeat: always arrays, even with one occurrence.
const REPEATED = new Set([
  'situation',
  'situationRecord',
  'generalPublicComment',
  'name',
  'value',
  'validPeriod',
  'exceptionPeriod',
  'lane',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '@',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => REPEATED.has(name),
});

const asArray = (value) => {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

/**
 * @description The text of a node: a string, or the `#text` of an element
 * with attributes.
 * @param {unknown} node - The node.
 * @returns {string} The text, '' when absent.
 */
function textOf(node) {
  if (node === undefined || node === null) {
    return '';
  }
  if (typeof node === 'object') {
    return textOf(node['#text']);
  }
  return String(node).trim();
}

/**
 * @description The text of a multilingual DATEX II string (`values/value`),
 * French first (the only language of the feed).
 * @param {object} node - A node holding `values`.
 * @returns {string} The text.
 */
function multilingual(node) {
  const values = asArray(node?.values?.value);
  const french = values.find((value) => String(value?.['@lang'] ?? '').toLowerCase() === 'fr');
  return textOf(french ?? values[0]);
}

/**
 * @description The type of a node, without its namespace prefix.
 * @param {object} node - The node.
 * @returns {string} "Accident", '' without a type.
 */
const typeOf = (node) =>
  String(node?.['@type'] ?? '')
    .split(':')
    .pop();

/**
 * @description A road number written the usual way.
 * @param {unknown} value - "N0020", "RN 7", "a75", "N406"…
 * @returns {string|null} "N20", "N7", "A75", "N406", null for nothing.
 * @example
 * normalizeRoad('N0020'); // -> 'N20'
 */
function normalizeRoad(value) {
  const raw = String(value ?? '')
    .toUpperCase()
    .replace(/[\s.]+/g, '');
  if (!raw) {
    return null;
  }
  const match = /^R?([ANDM])0*(\d+[A-Z]?)$/.exec(raw);
  return match ? `${match[1]}${match[2]}` : raw;
}

/**
 * @description Parse a date of the feed.
 * @param {unknown} value - ISO 8601 with an offset.
 * @returns {number|null} The instant, in ms.
 */
function parseTime(value) {
  const instant = Date.parse(textOf(value));
  return Number.isFinite(instant) ? instant : null;
}

/**
 * @description Read a coordinate pair.
 * @param {object} node - A node holding `pointCoordinates`.
 * @returns {number[]|null} `[latitude, longitude]`.
 */
function coordinatesOf(node) {
  const latitude = Number(textOf(node?.pointCoordinates?.latitude));
  const longitude = Number(textOf(node?.pointCoordinates?.longitude));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
    return null;
  }
  return [latitude, longitude];
}

/**
 * @description The names of a TPEG point: `{ townName, linkName }`.
 * @param {object} point - The point.
 * @returns {object} The names found.
 */
function namesOf(point) {
  const names = {};
  for (const name of asArray(point?.name)) {
    const kind = textOf(name?.tpegOtherPointDescriptorType);
    const value = multilingual(name?.descriptor);
    if (kind && value && !names[kind]) {
      names[kind] = value;
    }
  }
  return names;
}

/**
 * @description The geometry and names of a record's location.
 * @param {object} location - `groupOfLocations`.
 * @returns {object} `{ points, segments, town, road }`.
 */
function locationOf(location) {
  const points = [];
  const segments = [];
  let town = null;
  let road = null;
  const take = (point) => {
    const names = namesOf(point);
    town = town ?? names.townName ?? null;
    road = road ?? (names.linkName ? normalizeRoad(names.linkName) : null);
    return coordinatesOf(point);
  };
  const simple = location?.tpegPointLocation?.point;
  if (simple) {
    const point = take(simple);
    if (point) {
      points.push(point);
    }
  }
  const linear = location?.tpegLinearLocation;
  if (linear) {
    const from = linear.from ? take(linear.from) : null;
    const to = linear.to ? take(linear.to) : null;
    if (from && to) {
      segments.push([from, to]);
    } else if (from || to) {
      points.push(from ?? to);
    }
  }
  const element =
    location?.pointAlongLinearElement?.linearElement ??
    location?.linearWithinLinearElement?.linearElement;
  if (!road && element) {
    road = normalizeRoad(textOf(element.roadNumber) || multilingual(element.roadName));
  }
  return { points, segments, town, road };
}

/**
 * @description The category of one record.
 * @param {string} type - The record type.
 * @param {string|null} subtype - Its sub-type.
 * @returns {string} A CATEGORIES key.
 */
function recordCategory(type, subtype) {
  if (type === 'RoadOrCarriagewayOrLaneManagement' && CLOSING_TYPES.has(subtype)) {
    return 'closure';
  }
  return RECORD_CATEGORIES[type] ?? 'other';
}

/**
 * @description Whether a record says the event is over (cancelled, ended).
 * @param {object} record - The record.
 * @returns {boolean} True when ended.
 */
function endedByOperator(record) {
  const cycle = record?.management?.lifeCycleManagement;
  return textOf(cycle?.end) === 'true' || textOf(cycle?.cancel) === 'true';
}

/**
 * @description Clean a text of the feed: collapsed spaces, no line breaks.
 * @param {string} value - The text.
 * @returns {string} The text.
 */
const clean = (value) =>
  String(value ?? '')
    .replace(/\s*\n\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();

/**
 * @description One event from a situation.
 * @param {object} situation - The situation element.
 * @returns {object|null} The event, null when it has no record.
 */
function eventOf(situation) {
  const id = textOf(situation?.['@id']);
  const records = asArray(situation?.situationRecord);
  if (!id || records.length === 0) {
    return null;
  }
  let category = 'other';
  let subtype = null;
  let road = null;
  let town = null;
  let direction = null;
  let source = null;
  let start = null;
  let end = null;
  let openEnded = false;
  let period = null;
  let queueLength = null;
  let probability = null;
  let suspended = true;
  let ended = true;
  const descriptions = [];
  const points = [];
  const segments = [];
  for (const record of records) {
    const type = typeOf(record);
    const recordSubtype = SUBTYPE_KEYS.map((key) => textOf(record[key])).find(Boolean) ?? null;
    const recordCat = recordCategory(type, recordSubtype);
    const rank = CATEGORIES.indexOf(recordCat);
    if (rank < CATEGORIES.indexOf(category)) {
      category = recordCat;
      subtype = recordSubtype;
    } else if (rank === CATEGORIES.indexOf(category) && subtype === null) {
      subtype = recordSubtype;
    }
    const validity = record.validity ?? {};
    const spec = validity.validityTimeSpecification ?? {};
    const recordStart = parseTime(spec.overallStartTime);
    const recordEnd = parseTime(spec.overallEndTime);
    if (recordStart !== null && (start === null || recordStart < start)) {
      start = recordStart;
    }
    if (recordEnd === null) {
      openEnded = true;
    } else if (end === null || recordEnd > end) {
      end = recordEnd;
    }
    if (textOf(validity.validityStatus) !== 'suspended') {
      suspended = false;
    }
    if (!endedByOperator(record)) {
      ended = false;
    }
    period = period ?? (multilingual(asArray(spec.validPeriod)[0]?.periodName) || null);
    probability = probability ?? (textOf(record.probabilityOfOccurrence) || null);
    const length = Number(textOf(record.queueLength));
    if (Number.isFinite(length) && length > 0) {
      queueLength = Math.max(queueLength ?? 0, length);
    }
    const sourceId = textOf(record.source?.sourceIdentification);
    if (sourceId && !source) {
      source = sourceId.includes('/') ? sourceId.split('/').pop() : sourceId;
    }
    for (const comment of asArray(record.generalPublicComment)) {
      const kind = textOf(comment?.commentType);
      const value = clean(multilingual(comment?.comment));
      if (!value) {
        continue;
      }
      if (kind === 'description') {
        for (const sentence of value.split(/\.\s+/)) {
          const text = sentence.replace(/\.$/, '').trim();
          if (
            text &&
            !BOILERPLATE.some((pattern) => pattern.test(text)) &&
            !descriptions.includes(text)
          ) {
            descriptions.push(text);
          }
        }
      } else if (!direction && /^De .+ vers .+/.test(value)) {
        direction = value;
      }
    }
    const location = locationOf(record.groupOfLocations);
    road = road ?? location.road;
    town = town ?? location.town;
    points.push(...location.points);
    segments.push(...location.segments);
  }
  const severity = textOf(situation.overallSeverity);
  return {
    id,
    category,
    subtype,
    severity: SEVERITIES.includes(severity) ? severity : null,
    road,
    town,
    direction,
    description: clip(descriptions.join('. '), DESCRIPTION_MAX),
    source,
    start,
    end: openEnded ? null : end,
    period,
    probability,
    queueLength,
    suspended,
    ended,
    points: dedupe(points),
    segments,
  };
}

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
 * @description Drop repeated points.
 * @param {number[][]} points - The points.
 * @returns {number[][]} Unique points.
 */
function dedupe(points) {
  const seen = new Set();
  return points.filter(([lat, lon]) => {
    const key = `${lat},${lon}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * @description Parse a DATEX II situation publication.
 * @param {string} xml - The document.
 * @returns {{ publishedAt: number|null, events: object[] }} The events.
 * @throws {Error} When the document is not a situation publication.
 */
function parseSituations(xml) {
  const document = parser.parse(String(xml ?? ''));
  const model = document?.Envelope?.Body?.d2LogicalModel ?? document?.d2LogicalModel;
  const publication = model?.payloadPublication;
  if (!publication || typeOf(publication) !== 'SituationPublication') {
    throw new Error('Not a DATEX II situation publication');
  }
  const events = asArray(publication.situation).map(eventOf).filter(Boolean);
  return { publishedAt: parseTime(publication.publicationTime), events };
}

/**
 * @description The state of an event at an instant.
 * @param {object} event - The event.
 * @param {number} now - The instant, in ms.
 * @returns {string} `active`, `planned` (starts later), `suspended` or `ended`.
 */
function statusAt(event, now) {
  if (event.ended || (event.end !== null && event.end <= now)) {
    return 'ended';
  }
  if (event.start !== null && event.start > now) {
    return 'planned';
  }
  return event.suspended ? 'suspended' : 'active';
}

export {
  CATEGORIES,
  RECORD_CATEGORIES,
  CLOSING_TYPES,
  SEVERITIES,
  parseSituations,
  statusAt,
  normalizeRoad,
  recordCategory,
  clean,
};
