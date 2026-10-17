// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets for Créteil on a real Saturday evening: the DATEX II
// snapshot of 2026-10-17 20:57 and the forecast calendar kept in
// test/fixtures go through the real parsers (src/datex.js, src/forecast.js),
// the zone filter (src/zone.js) and the real widget builders (src/widgets.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildTrafficWidget, buildForecastWidget } = await load('src/widgets.js');
const { parseSituations } = await load('src/datex.js');
const { parseForecasts } = await load('src/forecast.js');
const { eventsOfPlace } = await load('src/zone.js');
const { LANGUAGES } = await load('src/i18n.js');
const fixture = (name) => readFileSync(`${repo}/test/fixtures/${name}`, 'utf8');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Saturday 17 October 2026, 21:00 in Paris.
const NOW = Date.parse('2026-10-17T19:00:00Z');
const TODAY = '2026-10-17';
const TOMORROW = '2026-10-18';
const TZ = 'Europe/Paris';
const place = {
  name: 'Créteil',
  department: '94',
  departmentName: 'Val-de-Marne',
  latitude: 48.7904,
  longitude: 2.4556,
  radius: 25,
  roads: [],
};

const { events, publishedAt } = parseSituations(fixture('content.xml'));
const zone = eventsOfPlace(events, place, NOW);
const forecasts = parseForecasts(JSON.parse(fixture('previsions.json')), {
  departments: ['94'],
  from: TODAY,
});

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    traffic: buildTrafficWidget({ place, zone, readAt: NOW, publishedAt, language, timeZone: TZ }),
    forecast: buildForecastWidget({
      place,
      dates: forecasts.byDepartment['94'],
      national: forecasts.national,
      today: TODAY,
      tomorrow: TOMORROW,
      readAt: NOW - 20 * 60 * 1000,
      language,
      timeZone: TZ,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
