// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/bison-fute.json (the
// only writable place of the container):
//   - `communes`    the communes found for each place (no geo request at each
//                   start), keyed by what the place was made of;
//   - `forecasts`   the forecasts of the departments of the places, and when
//                   and with which Last-Modified they were read;
//   - `seen`        what the scene triggers already know, per place: the
//                   active and planned road events, the forecast alerts
//                   announced. A restart never fires the same event twice.
// The road events themselves are not kept: they are read again at start.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/bison-fute.json';
const EMPTY = () => ({
  communes: {},
  forecasts: null,
  seen: { roads: {}, forecasts: {} },
});

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ path = DEFAULT_PATH, logger } = {}) {
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file; an absent or broken file is an empty store.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        const base = EMPTY();
        const value = raw && typeof raw === 'object' ? raw : {};
        store.data = {
          ...base,
          ...value,
          seen: {
            ...base.seen,
            ...(value.seen && typeof value.seen === 'object' ? value.seen : {}),
          },
        };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger?.warn(`Unable to read ${path}: ${err.message}`);
        }
        store.data = EMPTY();
      }
    },
    /**
     * @description Write the file (atomically: a temporary file, then a rename).
     * @returns {Promise<void>}
     */
    async save() {
      try {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(store.data));
        await rename(temporary, path);
      } catch (err) {
        logger?.warn(`Unable to write ${path}: ${err.message}`);
      }
    },
  };
  return store;
}

export { DEFAULT_PATH, createStore };
