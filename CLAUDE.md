# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Bison Futé: a Node.js service
(Node 22+, ESM, no build step) that runs in its own sandboxed Docker container
and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
Its only other runtime dependency is `fast-xml-parser` (the DATEX II feed).
It reads, without account nor key, the DATEX II snapshot of the national road
network (`tipi.bison-fute.gouv.fr/.../grt/RRN/content.xml`, open data of the
DIR) every few minutes, the forecast calendar of the website
(`www.bison-fute.gouv.fr/previsions/previsions.json`) every six hours, and
finds the communes on `geo.api.gouv.fr`. Transport: cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timer
src/bison-api.js        HTTP client of the two Bison Futé files (If-Modified-Since)
src/datex.js            DATEX II snapshot -> events (category, road, dates, geometry)
src/forecast.js         forecast calendar -> levels per department and date
src/zone.js             distance to a place, events of a zone, counts
src/geo.js              communes from geo.api.gouv.fr (coordinates, name, postal code, INSEE)
src/time.js             calendar dates (TZ), midnight
src/store.js            /data/bison-fute.json: communes, forecasts, `seen`
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           one device per place, its states
src/widgets.js          traffic and forecast dashboard widgets
src/config.js           configuration (three places, radius, roads, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real Bison Futé files, reduced (never reformatted)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`place:<INSEE code in lower case>`: never a name),
  feature `category` / `type` / `unit` / `min` / `max` / `step`, the keys of
  `config_schema`, `actions`, the widgets and their settings, scene triggers
  (fields, options, variables) and scene actions (fields, outputs).
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** The counts of events are `counter-sensor` /
  `integer` (0-999), the closest event `text` / `text`, the forecast levels
  `risk` / `integer` (0 green, 1 orange, 2 red, 3 black). The forecast
  features exist only for the departments Bison Futé covers (mainland, no
  Corsica, `forecastCovered`): never make them depend on a reading.
- **`should_poll` stays false**: the integration reads on its own timer
  (`interval`, 2 to 30 min, 5 by default). The snapshot is read with
  If-Modified-Since (the server's gzip ETag never matches: do not use it);
  the forecasts every six hours. A snapshot that shrinks below half of the
  previous one (from 40 situations) is refused once, then accepted.
- **Events once.** `seen` (in /data) remembers per place the active and
  planned events (with the signature of the zone: a new radius or new roads
  start a new baseline) and the forecast alerts per date. The first reading of
  a place is a baseline. At most 25 events per place and reading. A scene
  action or a widget never fires an event.
- **Data licence.** The road events are Licence Ouverte 2.0: keep the source
  (the DIR) and the update time visible in the widgets.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. A field older cores do not know needs a higher `gladys_version`
  minimum (see `src/constants.js` of the integration-store): a
  `source: "houses"` select needs 5.2.0. `location: true` is needed for the
  coordinates of the houses. Transport: `["cloud"]`. `number` fields hold
  integers only (radius).
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (a local server on 127.0.0.1 at
  most).
