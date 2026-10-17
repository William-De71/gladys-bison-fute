// -----------------------------------------------------------------------------
// Communes, from the open API of the French government (geo.api.gouv.fr, no
// key, no account).
//
// A place of the configuration becomes a commune (its department gives the
// forecasts, its centre the distance to the road events, unless a house gives
// its own coordinates) in one of these ways:
//   - the coordinates of a house of Gladys: GET /communes?lat=…&lon=…;
//   - a 5-digit text: a postal code first (what people know), then an INSEE
//     code ("2A004" for Corsica is an INSEE code only);
//   - "name (postal code)" or "name postal code": the name among the communes
//     of the postal code;
//   - a name: the most populated commune of that name ("Saint-Denis" is the
//     one of Réunion; type "Saint-Denis 93200" for the other one).
// -----------------------------------------------------------------------------

const GEO_URL = 'https://geo.api.gouv.fr';
const FIELDS = 'nom,code,codesPostaux,codeDepartement,departement,centre,population';
const TIMEOUT_MS = 15000;

class GeoError extends Error {
  /**
   * @param {string} kind - `not_found`, `outside` or `unreachable`.
   * @param {string} message - The detail.
   */
  constructor(kind, message) {
    super(message);
    this.name = 'GeoError';
    this.kind = kind;
  }
}

/**
 * @description Fold a name for comparisons: no accent, no case, hyphens and
 * apostrophes as spaces.
 * @param {string} value - The name.
 * @returns {string} The folded name.
 * @example
 * fold('Saint-Étienne'); // -> 'saint etienne'
 */
function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @description A commune of the API as the integration keeps it.
 * @param {object} raw - An entry of /communes.
 * @returns {object} `{ insee, name, department, departmentName, latitude,
 * longitude, population }`.
 */
function toCommune(raw) {
  const [longitude, latitude] = Array.isArray(raw.centre?.coordinates)
    ? raw.centre.coordinates.map(Number)
    : [NaN, NaN];
  return {
    insee: String(raw.code),
    name: String(raw.nom),
    department: raw.codeDepartement ? String(raw.codeDepartement) : null,
    departmentName: raw.departement?.nom ? String(raw.departement.nom) : null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    population: Number(raw.population) || 0,
  };
}

const byPopulation = (a, b) => b.population - a.population;

/**
 * @description Split what the user typed into a name and a postal code.
 * @param {string} text - The text.
 * @returns {{ name: string, code: string|null }} The parts.
 * @example
 * splitQuery('Sancé (71000)'); // -> { name: 'Sancé', code: '71000' }
 */
function splitQuery(text) {
  const value = String(text ?? '').trim();
  const match = /^(.*?)[\s,(]*\b(\d{5}|2[AB]\d{3})\)?\s*$/i.exec(value);
  if (match) {
    return { name: match[1].trim(), code: match[2].toUpperCase() };
  }
  return { name: value, code: null };
}

/**
 * @description A client of geo.api.gouv.fr.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @returns {object} `{ byCoordinates, byQuery }`.
 */
function createGeoClient({ fetch: fetchFn = globalThis.fetch } = {}) {
  /**
   * @description GET a path of the API.
   * @param {string} path - The path and query.
   * @returns {Promise<unknown>} The JSON, null on a 404.
   */
  async function get(path) {
    let response;
    try {
      response = await fetchFn(`${GEO_URL}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new GeoError('unreachable', err.message);
    }
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new GeoError('unreachable', `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * @description The commune at a point.
   * @param {number} latitude - Latitude.
   * @param {number} longitude - Longitude.
   * @returns {Promise<object>} The commune.
   */
  async function byCoordinates(latitude, longitude) {
    const list = await get(
      `/communes?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&fields=${FIELDS}&format=json`,
    );
    if (!Array.isArray(list) || list.length === 0) {
      throw new GeoError('outside', `${latitude}, ${longitude}`);
    }
    return toCommune(list[0]);
  }

  /**
   * @description The commune a text names.
   * @param {string} query - A name, a postal code, "name (postal code)" or an INSEE code.
   * @returns {Promise<object>} The commune.
   */
  async function byQuery(query) {
    const { name, code } = splitQuery(query);
    if (code) {
      const byPostcode = /^\d{5}$/.test(code)
        ? await get(`/communes?codePostal=${code}&fields=${FIELDS}&format=json`)
        : null;
      const list = (Array.isArray(byPostcode) ? byPostcode : []).map(toCommune);
      if (list.length > 0) {
        if (name) {
          const wanted = fold(name);
          const exact = list.find((commune) => fold(commune.name) === wanted);
          const partial = list.find((commune) => fold(commune.name).includes(wanted));
          if (exact || partial) {
            return exact || partial;
          }
        }
        return list.sort(byPopulation)[0];
      }
      const insee = await get(`/communes/${code}?fields=${FIELDS}&format=json`);
      if (insee && insee.code) {
        return toCommune(insee);
      }
      if (!name) {
        throw new GeoError('not_found', query);
      }
    }
    const list = await get(
      `/communes?nom=${encodeURIComponent(name)}&fields=${FIELDS}&boost=population&limit=20&format=json`,
    );
    const communes = (Array.isArray(list) ? list : []).map(toCommune);
    const wanted = fold(name);
    const exact = communes.filter((commune) => fold(commune.name) === wanted).sort(byPopulation);
    if (exact.length > 0) {
      return exact[0];
    }
    if (communes.length > 0) {
      return communes[0];
    }
    throw new GeoError('not_found', query);
  }

  return { byCoordinates, byQuery };
}

export { GEO_URL, GeoError, createGeoClient, splitQuery, fold, toCommune };
