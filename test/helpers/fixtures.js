// Fake Bison Futé files and a fake geo.api.gouv.fr for the tests, served
// through the `fetch` option of the integration. The files are real ones,
// reduced: 20 situations of the DATEX II snapshot of 2026-10-17 20:57 (Paris)
// around Créteil and Toulouse, a unit file holding a traffic jam, and the
// forecast calendar of six departments. Tests never touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-10-17 21:00 in Paris: the time of the snapshot.
const NOW = Date.parse('2026-10-17T19:00:00Z');
const TODAY = '2026-10-17';
const TOMORROW = '2026-10-18';
const TZ = 'Europe/Paris';
const LAST_MODIFIED = 'Sat, 17 Oct 2026 18:57:44 GMT';
const FORECAST_LAST_MODIFIED = 'Sat, 17 Oct 2026 18:49:20 GMT';

const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
const SNAPSHOT = fixture('content.xml');
const UNIT_CONGESTION = fixture('unit-congestion.xml');
const FORECASTS = JSON.parse(fixture('previsions.json'));

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'bison-')), 'bison-fute.json');

// Answers of geo.api.gouv.fr (fields nom, code, codesPostaux, codeDepartement,
// departement, centre, population), as read on 2026-10-17.
const CRETEIL = {
  nom: 'Créteil',
  code: '94028',
  codesPostaux: ['94000'],
  codeDepartement: '94',
  departement: { code: '94', nom: 'Val-de-Marne' },
  centre: { type: 'Point', coordinates: [2.4523, 48.7845] },
  population: 93397,
};
const TOULOUSE = {
  nom: 'Toulouse',
  code: '31555',
  codesPostaux: ['31000', '31100', '31200', '31300', '31400', '31500'],
  codeDepartement: '31',
  departement: { code: '31', nom: 'Haute-Garonne' },
  centre: { type: 'Point', coordinates: [1.4328, 43.6007] },
  population: 514819,
};
const AJACCIO = {
  nom: 'Ajaccio',
  code: '2A004',
  codesPostaux: ['20000', '20090', '20167'],
  codeDepartement: '2A',
  departement: { code: '2A', nom: 'Corse-du-Sud' },
  centre: { type: 'Point', coordinates: [8.7058, 41.9228] },
  population: 76320,
};
const COMMUNES = [CRETEIL, TOULOUSE, AJACCIO];

const HOUSES = [
  { id: 'h1', name: 'Home', selector: 'home', latitude: 48.7904, longitude: 2.4556 },
  { id: 'h2', name: 'Nowhere', selector: 'nowhere', latitude: null, longitude: null },
  { id: 'h3', name: 'Abroad', selector: 'abroad', latitude: 51.5072, longitude: -0.1276 },
];

/**
 * @description The fake services.
 * @returns {Function} A fetch function, with `.calls` and `.state`.
 */
function fakeApis() {
  const state = {
    snapshot: SNAPSHOT,
    lastModified: LAST_MODIFIED,
    forecasts: FORECASTS,
    forecastLastModified: FORECAST_LAST_MODIFIED,
    // { status } for every request to a host, or a thrown error ('network').
    fail: {},
    geoDown: false,
  };
  const calls = [];
  const answer = (body, status = 200, headers = {}) => new Response(body, { status, headers });
  const json = (body, status = 200) =>
    answer(JSON.stringify(body), status, { 'content-type': 'application/json' });

  const fetchFn = async (url, init = {}) => {
    const target = new URL(url);
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    calls.push({ url: String(url), host: target.hostname, headers });
    const failure = state.fail[target.hostname];
    if (failure === 'network') {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (failure) {
      return answer('<html>error</html>', failure.status, { 'content-type': 'text/html' });
    }
    if (target.hostname === 'geo.api.gouv.fr') {
      if (state.geoDown) {
        return json({ message: 'down' }, 503);
      }
      const p = target.searchParams;
      if (target.pathname.startsWith('/communes/')) {
        const found = COMMUNES.find((c) => c.code === target.pathname.split('/')[2]);
        return found ? json(found) : json({ code: 404, message: 'Not found' }, 404);
      }
      if (p.has('lat')) {
        const lat = Number(p.get('lat'));
        return json(lat > 48.7 && lat < 48.9 ? [CRETEIL] : []);
      }
      if (p.has('codePostal')) {
        return json(COMMUNES.filter((c) => c.codesPostaux.includes(p.get('codePostal'))));
      }
      if (p.has('nom')) {
        const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const wanted = plain(p.get('nom'));
        return json(COMMUNES.filter((c) => plain(c.nom).includes(wanted)));
      }
      return json([]);
    }
    if (target.hostname === 'tipi.bison-fute.gouv.fr') {
      if (headers['if-modified-since'] && headers['if-modified-since'] === state.lastModified) {
        return answer(null, 304);
      }
      return answer(state.snapshot, 200, {
        'content-type': 'application/xml',
        'last-modified': state.lastModified,
      });
    }
    if (target.hostname === 'www.bison-fute.gouv.fr') {
      if (
        headers['if-modified-since'] &&
        headers['if-modified-since'] === state.forecastLastModified
      ) {
        return answer(null, 304);
      }
      return answer(JSON.stringify(state.forecasts), 200, {
        'content-type': 'application/json',
        'last-modified': state.forecastLastModified,
      });
    }
    throw new Error(`unexpected host ${target.hostname}`);
  };
  fetchFn.calls = calls;
  fetchFn.state = state;
  fetchFn.callsTo = (host) => calls.filter((call) => call.host === host);
  return fetchFn;
}

/**
 * @description The snapshot without some situations (to make events end).
 * @param {string[]} ids - Situation ids to drop.
 * @param {string} [xml] - The snapshot.
 * @returns {string} The new snapshot.
 */
function withoutSituations(ids, xml = SNAPSHOT) {
  let result = xml;
  for (const id of ids) {
    result = result.replace(new RegExp(`<ns2:situation id="${id}"[\\s\\S]*?</ns2:situation>`), '');
  }
  return result;
}

// What externalIds builds, without a Gladys client.
const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:test-integration:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

export {
  NOW,
  TODAY,
  TOMORROW,
  TZ,
  LAST_MODIFIED,
  SNAPSHOT,
  UNIT_CONGESTION,
  FORECASTS,
  CRETEIL,
  TOULOUSE,
  AJACCIO,
  HOUSES,
  silent,
  storePath,
  fakeApis,
  withoutSituations,
  fakeGladys,
};
