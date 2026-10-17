// -----------------------------------------------------------------------------
// The traffic forecasts of Bison Futé: green, orange, red or black, for each
// day and each mainland department, in the direction of departures (leaving
// the big cities) and of returns.
//
// They come from the file the bison-fute.gouv.fr website draws its map and
// its calendar with (`previsions/previsions.json`, CORS open):
//   - `days`       "DD/MM/YYYY", the current year and the start of the next;
//   - `national`   per day, "departure,return" for France as a whole;
//   - `values`     per day, the same pair for each department of `deptsLine`;
//   - `deptsLine`  the departments, numbers without leading zero ("1", "75"):
//                  mainland France without Corsica.
// A level is V (vert, green), O (orange), R (rouge, red) or N (noir, black).
// The forecasts are published a year ahead and revised before the busy
// weekends: they are read a few times a day, never more.
// -----------------------------------------------------------------------------

const LEVELS = ['green', 'orange', 'red', 'black'];
const CODES = { V: 0, O: 1, R: 2, N: 3 };
const DIRECTIONS = ['departure', 'return'];

/**
 * @description A department code as the forecasts write it.
 * @param {unknown} code - "01", "1", "2A", "971".
 * @returns {string} "1", "2A", "971".
 * @example
 * departmentKey('01'); // -> '1'
 */
function departmentKey(code) {
  const value = String(code ?? '')
    .trim()
    .toUpperCase();
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}

/**
 * @description Read a "departure,return" pair.
 * @param {unknown} value - "O,V".
 * @returns {{ departure: number, return: number }|null} The levels (0-3).
 */
function readPair(value) {
  const parts = String(value ?? '')
    .split(',')
    .map((part) => part.trim().toUpperCase());
  if (parts.length < 2 || !(parts[0] in CODES) || !(parts[1] in CODES)) {
    return null;
  }
  return { departure: CODES[parts[0]], return: CODES[parts[1]] };
}

/**
 * @description "17/10/2026" -> "2026-10-17".
 * @param {unknown} value - The day.
 * @returns {string|null} The ISO date.
 */
function isoDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? '').trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/**
 * @description Parse the forecast file, keeping only what the integration needs.
 * @param {object} raw - The JSON of previsions.json.
 * @param {object} options - Options.
 * @param {string[]} options.departments - The departments to keep (any form).
 * @param {string} options.from - First date kept, `YYYY-MM-DD`.
 * @param {number} [options.days] - Days kept from `from`.
 * @returns {{ departments: string[], national: object, byDepartment: object }}
 * `national[date]` and `byDepartment[dept][date]` are `{ departure, return }`.
 * @throws {Error} When the file has not the expected shape.
 */
function parseForecasts(raw, { departments = [], from, days = 400 }) {
  if (
    !raw ||
    !Array.isArray(raw.days) ||
    !Array.isArray(raw.values) ||
    !Array.isArray(raw.deptsLine) ||
    raw.values.length !== raw.days.length
  ) {
    throw new Error('Unexpected shape of the forecast file');
  }
  const columns = new Map(raw.deptsLine.map((code, index) => [departmentKey(code), index]));
  const wanted = [...new Set(departments.map(departmentKey))].filter((code) => columns.has(code));
  const last = from ? addIsoDays(from, days) : null;
  const national = {};
  const byDepartment = Object.fromEntries(wanted.map((code) => [code, {}]));
  raw.days.forEach((day, index) => {
    const date = isoDate(day);
    if (!date || (from && (date < from || date > last))) {
      return;
    }
    const pair = readPair(raw.national?.[index]);
    if (pair) {
      national[date] = pair;
    }
    for (const code of wanted) {
      const value = readPair(raw.values[index]?.[columns.get(code)]);
      if (value) {
        byDepartment[code][date] = value;
      }
    }
  });
  return { departments: [...columns.keys()], national, byDepartment };
}

/**
 * @description Shift an ISO date.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {number} days - Days.
 * @returns {string} `YYYY-MM-DD`.
 */
function addIsoDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

/**
 * @description The worse of the two directions.
 * @param {{ departure: number, return: number }|null} pair - The levels.
 * @returns {number|null} 0 to 3.
 */
const worst = (pair) => (pair ? Math.max(pair.departure, pair.return) : null);

/**
 * @description The coloured days (orange or worse) from a date on.
 * @param {object} dates - `{ [date]: { departure, return } }`.
 * @param {string} from - First date, `YYYY-MM-DD`.
 * @param {number} limit - Days looked at.
 * @returns {Array<{ date: string, departure: number, return: number }>} Sorted.
 */
function colouredDays(dates, from, limit) {
  const last = addIsoDays(from, limit - 1);
  return Object.entries(dates ?? {})
    .filter(([date, pair]) => date >= from && date <= last && worst(pair) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pair]) => ({ date, ...pair }));
}

export {
  LEVELS,
  CODES,
  DIRECTIONS,
  departmentKey,
  readPair,
  isoDate,
  parseForecasts,
  worst,
  colouredDays,
  addIsoDays,
};
