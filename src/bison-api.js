// -----------------------------------------------------------------------------
// HTTP client of the two Bison Futé sources (no key, no account):
//
//   events     https://tipi.bison-fute.gouv.fr/bison-fute-ouvert/
//              publicationsDIR/Evenementiel-DIR/grt/RRN/content.xml
//              the DATEX II snapshot of the national road network not under
//              concession (about 3 MB, 150 KB compressed), open data
//              (Licence Ouverte, transport.data.gouv.fr);
//   forecasts  https://www.bison-fute.gouv.fr/previsions/previsions.json
//              the forecast calendar the website draws its map with
//              (about 240 KB).
//
// Both are static files of an Apache server: a conditional request with
// If-Modified-Since costs a 304 and no body when nothing changed. The ETag is
// not used: the server appends "-gzip" to it on a compressed answer and then
// never matches it again.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const EVENTS_URL =
  'https://tipi.bison-fute.gouv.fr/bison-fute-ouvert/publicationsDIR/Evenementiel-DIR/grt/RRN/content.xml';
const FORECASTS_URL = 'https://www.bison-fute.gouv.fr/previsions/previsions.json';
const TIMEOUT_MS = 60000;
// The snapshot stays far below; a bigger answer is not the feed.
const MAX_BYTES = 40 * 1024 * 1024;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const USER_AGENT = `gladys-bison-fute/${version} (+https://github.com/William-De71/gladys-bison-fute)`;

class BisonError extends Error {
  /**
   * @param {string} kind - `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status }`.
   */
  constructor(kind, message, { status = null } = {}) {
    super(message);
    this.name = 'BisonError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description A client of the Bison Futé files.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @returns {object} `{ events, forecasts, requests }`.
 */
function createBisonClient({ fetch: fetchFn = globalThis.fetch, now = () => Date.now() } = {}) {
  // Requests made and bytes read, for the diagnostic.
  const requests = { total: 0, notModified: 0, bytes: 0, last: null };

  /**
   * @description GET a file, conditionally.
   * @param {string} url - The URL.
   * @param {string} accept - The Accept header.
   * @param {string|null} lastModified - The Last-Modified of the copy kept.
   * @returns {Promise<{ notModified: boolean, body?: string, lastModified?: string|null }>}
   * The answer.
   */
  async function get(url, accept, lastModified) {
    requests.total += 1;
    requests.last = now();
    let response;
    try {
      response = await fetchFn(url, {
        headers: {
          accept,
          'accept-encoding': 'gzip',
          'user-agent': USER_AGENT,
          ...(lastModified ? { 'if-modified-since': lastModified } : {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new BisonError('unreachable', err.cause?.code ?? err.message);
    }
    if (response.status === 304) {
      requests.notModified += 1;
      return { notModified: true };
    }
    if (!response.ok) {
      throw new BisonError('unreachable', `HTTP ${response.status}`, { status: response.status });
    }
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_BYTES) {
      throw new BisonError('invalid', `answer too big (${length} bytes)`);
    }
    let body;
    try {
      body = await response.text();
    } catch (err) {
      throw new BisonError('unreachable', err.cause?.code ?? err.message);
    }
    requests.bytes += body.length;
    return { notModified: false, body, lastModified: response.headers.get('last-modified') };
  }

  return {
    requests,
    /**
     * @description The DATEX II snapshot of the road events.
     * @param {string|null} [lastModified] - Last-Modified of the copy kept.
     * @returns {Promise<object>} `{ notModified }` or `{ body, lastModified }`.
     */
    events: (lastModified = null) => get(EVENTS_URL, 'application/xml, text/xml', lastModified),
    /**
     * @description The forecast calendar.
     * @param {string|null} [lastModified] - Last-Modified of the copy kept.
     * @returns {Promise<object>} `{ notModified }` or `{ json, lastModified }`.
     */
    async forecasts(lastModified = null) {
      const answer = await get(FORECASTS_URL, 'application/json', lastModified);
      if (answer.notModified) {
        return answer;
      }
      try {
        return {
          notModified: false,
          json: JSON.parse(answer.body),
          lastModified: answer.lastModified,
        };
      } catch (err) {
        throw new BisonError('invalid', `forecasts: ${err.message}`);
      }
    },
  };
}

export { EVENTS_URL, FORECASTS_URL, USER_AGENT, BisonError, createBisonClient };
