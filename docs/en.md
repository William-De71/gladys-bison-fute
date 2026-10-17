# Bison Futé

## Overview

This integration brings **Bison Futé**, the French road information service, into Gladys, for one to three places: the **road events** around each place (closures, accidents, obstacles, traffic jams, roadworks) and the **traffic forecast** of its department, green, orange, red or black, for departures and returns. Each place becomes a device you can show on a dashboard and use in scenes.

The road events come from the open data of the State road agencies (DIR), published by Bison Futé in the DATEX II format and updated all day long. The integration reads them every 5 minutes by default, with a conditional request: about 150 KB when something changed, almost nothing otherwise. The forecasts come from the calendar of the bison-fute.gouv.fr website and are read every six hours.

It is a **cloud** integration, without account nor key: it contacts `tipi.bison-fute.gouv.fr` and `www.bison-fute.gouv.fr` (public files), and `geo.api.gouv.fr` (the open commune service of the French government) to find the commune of your house.

**Coverage**: the national roads and the motorways without toll, Île-de-France included. The toll motorways (Vinci, APRR, Sanef…) and the departmental roads are not in this open feed. The forecasts cover mainland France, without Corsica.

## Prerequisites

- Gladys Assistant 5.2.0 or later.
- The location of your house in Gladys (Settings > Houses), or the name of the commune to follow.
- Nothing else: no account, no key.

## Configuration

| Field                  | What to enter                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| House                  | A house of Gladys: its location is the centre of the zone.                                    |
| Or a commune           | "Mâcon", "71000", "Saint-Denis 93200" or the INSEE code. When filled, it wins over the house. |
| Radius (km)            | The events within this distance, 1 to 200 km (20 by default).                                 |
| Only these roads       | "N79, A6" for your usual route. Empty: every road of the zone.                                |
| Place 2, Place 3       | Other places (a second home, the office, a route you often drive). Optional.                  |
| Road events read every | 2, 5, 10, 15 or 30 minutes.                                                                   |
| Language of the texts  | Device names, the closest event and the scene summaries.                                      |

Save: the status at the top of the page shows the number of events of each place. **Read now** reads again at once (at most once a minute).

## Usage

### Devices

In the **Discover** tab, create the "Traffic …" device of each place. It holds:

- the active road events of the zone: all of them, closures, accidents and obstacles, traffic jams, roadworks (counters);
- the closest one as text: "N79 · Accident · 3.2 km";
- where Bison Futé publishes forecasts: the forecast of departures and returns, today and tomorrow, 0 green, 1 orange, 2 red, 3 black (shown by Gladys as no, low, medium or high risk).

An event is active between its start and its end. A planned event (roadworks next week) counts once it starts; a suspended one does not. The descriptions are written by the road operators, in French.

### Dashboard widgets

![The Road traffic widget around Créteil (counters, active and planned events) and the Bison Futé forecast widget of Val-de-Marne (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-bison-fute/main/docs/assets/widgets.en.png)

- **Road traffic**: the counters, then the active events (closures and accidents first, then the closest) and the ones planned in the next days; tap a card for the direction, the description and the dates.
- **Bison Futé forecast**: departures and returns today and tomorrow, the next orange, red or black days, and France as a whole.

Choose the place in the settings of the widget (empty: the first one).

### Scenes

Triggers, fired once per change (the first reading of a place is only a reference):

- **Bison Futé: road event started**: an event becomes active in the zone. Filters: place, types, road.
- **Bison Futé: road event over**: an active event is over.
- **Bison Futé: road event planned**: a new event is announced for the next seven days.
- **Bison Futé: orange, red or black forecast**: for today from 6 am, for tomorrow from 6 pm the day before, again if it worsens. Filters: place, day, direction, levels.

Each one gives a ready-made sentence, `{{triggerEvent.data.summary}}`, and its values (road, town, distance, type…). The actions **Bison Futé: read the road events** and **Bison Futé: read the forecast** return the same kind of values, to put in a message or test in a condition.

Examples:

- When a closure or an accident starts on the N118 → send the summary to your phone.
- When the forecast for tomorrow is red for departures → remind the family to leave early.
- Every weekday at 7:30 → read the road events of the office and send the list if there is one.

### Transport

Cloud only: the data come from the internet. Only the coordinates of the chosen house (to find its commune) and the communes you typed leave your network.

## Troubleshooting

- **"the house has no location"**: set it in Settings > Houses, or type the commune.
- **"matches no French commune"**: type "name postal code", or the INSEE code.
- **No event while there is a jam**: it may be on a toll motorway or a departmental road, which this open feed does not cover; or outside the radius, or on a road you did not list.
- **No forecast feature**: Bison Futé publishes no forecast for Corsica nor overseas.
- **"Bison Futé cannot be reached"**: the integration tries again after 2 minutes, then at each reading; the last data stay on the widgets.
- **To report a problem**: press **Diagnostic**, then copy the lines starting with "Bison Futé diagnostic" from the Logs tab into an issue on GitHub or a reply on the forum, with the versions of Gladys and of the integration.
