# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.4.0] - 2026-10-29

### Added

- show when road events started and end, and lay both widgets out as grids ([ab2c476](https://github.com/William-De71/gladys-bison-fute/commit/ab2c476724081def96940811aacbf77b9f986ac1))

## [0.3.0] - 2026-10-25

### Added

- require Gladys 5.3 and declare catalog keywords and countries ([449060c](https://github.com/William-De71/gladys-bison-fute/commit/449060ce01ccbcc99a56041ec1ce73c42aff83ff))

## [0.2.0] - 2026-10-25

### Added

- list the integration under the new Transport shelf of the catalog ([961d3dc](https://github.com/William-De71/gladys-bison-fute/commit/961d3dc53d9a6b9f4e71f81ec31694ae8c4e90af))

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([cb0a7e7](https://github.com/William-De71/gladys-bison-fute/commit/cb0a7e7ce5921ae3cf429c7427cc387ff0058671))

## [0.1.0] - 2026-10-17

### Added

- One device per place (a house of Gladys or a commune typed by hand, up to three), with a radius and an optional list of roads: the active road events of its zone on the French national road network (all of them, closures, accidents and obstacles, traffic jams, roadworks) and the closest one as text.
- The Bison Futé traffic forecast of the department of each place: departures and returns, today and tomorrow (green, orange, red, black), for mainland France.
- Scene triggers: road event started, road event over, road event planned within seven days (filtered by place, type and road), and orange, red or black forecast (today from 6 am, tomorrow from 6 pm the day before).
- Scene actions: read the road events of a place (counts and a ready-made list) and read the forecast of a day, with the next orange or worse day.
- Dashboard widgets: road traffic around a place, and the Bison Futé forecast calendar of its department.
- Configuration actions: read now, and a diagnostic written to the Logs tab.
- Cloud transport: the open DATEX II feed of the road agencies (DIR) is read every 2 to 30 minutes with conditional requests, the forecasts every six hours; no account and no key.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.4.0]: https://github.com/William-De71/gladys-bison-fute/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/William-De71/gladys-bison-fute/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/William-De71/gladys-bison-fute/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/William-De71/gladys-bison-fute/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-bison-fute/releases/tag/v0.1.0
