// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, categories and levels, widget contents,
// scene summaries, messages of the Configuration screen. Vocabulary of the
// Gladys interface (appareil / Gerät / dispositivo, scène / Szene / escena)
// and of Bison Futé (vert, orange, rouge, noir; départs, retours). The
// descriptions written by the road operators stay in French: the feed has no
// other language.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Traffic {place}',
    fr: 'Trafic {place}',
    de: 'Verkehr {place}',
    es: 'Tráfico {place}',
  },
  feature_events: {
    en: 'Road events',
    fr: 'Évènements routiers',
    de: 'Verkehrsmeldungen',
    es: 'Incidencias viales',
  },
  feature_closures: {
    en: 'Road closures',
    fr: 'Fermetures',
    de: 'Sperrungen',
    es: 'Cortes de carretera',
  },
  feature_accidents: {
    en: 'Accidents and obstacles',
    fr: 'Accidents et obstacles',
    de: 'Unfälle und Hindernisse',
    es: 'Accidentes y obstáculos',
  },
  feature_congestion: {
    en: 'Traffic jams',
    fr: 'Bouchons',
    de: 'Staus',
    es: 'Atascos',
  },
  feature_roadworks: {
    en: 'Roadworks',
    fr: 'Chantiers',
    de: 'Baustellen',
    es: 'Obras',
  },
  feature_nearest: {
    en: 'Closest road event',
    fr: 'Évènement le plus proche',
    de: 'Nächste Verkehrsmeldung',
    es: 'Incidencia más cercana',
  },
  feature_departure_today: {
    en: 'Forecast departures today',
    fr: 'Prévision départs aujourd’hui',
    de: 'Prognose Hinfahrt heute',
    es: 'Previsión salidas hoy',
  },
  feature_return_today: {
    en: 'Forecast returns today',
    fr: 'Prévision retours aujourd’hui',
    de: 'Prognose Rückfahrt heute',
    es: 'Previsión regresos hoy',
  },
  feature_departure_tomorrow: {
    en: 'Forecast departures tomorrow',
    fr: 'Prévision départs demain',
    de: 'Prognose Hinfahrt morgen',
    es: 'Previsión salidas mañana',
  },
  feature_return_tomorrow: {
    en: 'Forecast returns tomorrow',
    fr: 'Prévision retours demain',
    de: 'Prognose Rückfahrt morgen',
    es: 'Previsión regresos mañana',
  },
  noEvent: { en: 'None', fr: 'Aucun', de: 'Keine', es: 'Ninguna' },

  // event categories (≤ 16 characters: widget badges)
  category_closure: { en: 'Road closed', fr: 'Fermeture', de: 'Sperrung', es: 'Corte' },
  category_accident: { en: 'Accident', fr: 'Accident', de: 'Unfall', es: 'Accidente' },
  category_obstruction: { en: 'Obstacle', fr: 'Obstacle', de: 'Hindernis', es: 'Obstáculo' },
  category_congestion: { en: 'Traffic jam', fr: 'Bouchon', de: 'Stau', es: 'Atasco' },
  category_conditions: {
    en: 'Road conditions',
    fr: 'Conditions',
    de: 'Straßenzustand',
    es: 'Estado de vía',
  },
  category_roadworks: { en: 'Roadworks', fr: 'Chantier', de: 'Baustelle', es: 'Obras' },
  category_restriction: {
    en: 'Restriction',
    fr: 'Restriction',
    de: 'Einschränkung',
    es: 'Restricción',
  },
  category_other: { en: 'Information', fr: 'Information', de: 'Information', es: 'Información' },

  // forecast levels (≤ 12 characters: widget tiles)
  level_0: { en: 'Green', fr: 'Vert', de: 'Grün', es: 'Verde' },
  level_1: { en: 'Orange', fr: 'Orange', de: 'Orange', es: 'Naranja' },
  level_2: { en: 'Red', fr: 'Rouge', de: 'Rot', es: 'Rojo' },
  level_3: { en: 'Black', fr: 'Noir', de: 'Schwarz', es: 'Negro' },

  dayLower_today: { en: 'today', fr: 'aujourd’hui', de: 'heute', es: 'hoy' },
  dayLower_tomorrow: { en: 'tomorrow', fr: 'demain', de: 'morgen', es: 'mañana' },

  // scene summaries
  summaryHead: {
    en: '{category} on the {road} near {town} ({distance})',
    fr: '{category} sur la {road} vers {town} ({distance})',
    de: '{category} auf der {road} bei {town} ({distance})',
    es: '{category} en la {road} cerca de {town} ({distance})',
  },
  summaryHeadNoRoad: {
    en: '{category} near {town} ({distance})',
    fr: '{category} vers {town} ({distance})',
    de: '{category} bei {town} ({distance})',
    es: '{category} cerca de {town} ({distance})',
  },
  summaryFrom: {
    en: 'From {date}',
    fr: 'À partir du {date}',
    de: 'Ab {date}',
    es: 'A partir del {date}',
  },
  summaryUntil: {
    en: 'Until {date}',
    fr: 'Jusqu’au {date}',
    de: 'Bis {date}',
    es: 'Hasta el {date}',
  },
  summaryEnded: {
    en: 'Over: {head}',
    fr: 'Terminé : {head}',
    de: 'Beendet: {head}',
    es: 'Terminado: {head}',
  },
  summaryCount: {
    en: '{count} road event(s):',
    fr: '{count} évènement(s) routier(s) :',
    de: '{count} Verkehrsmeldung(en):',
    es: '{count} incidencia(s) vial(es):',
  },
  summaryNone: {
    en: 'No road event around.',
    fr: 'Aucun évènement routier dans le secteur.',
    de: 'Keine Verkehrsmeldung in der Umgebung.',
    es: 'Ninguna incidencia vial en la zona.',
  },
  summaryForecast: {
    en: 'Bison Futé forecast {day} in {where}: departures {departure}, returns {return}.{national}',
    fr: 'Prévision Bison Futé {day} en {where} : départs {departure}, retours {return}.{national}',
    de: 'Bison-Futé-Prognose {day} in {where}: Hinfahrt {departure}, Rückfahrt {return}.{national}',
    es: 'Previsión de Bison Futé {day} en {where}: salidas {departure}, regresos {return}.{national}',
  },
  summaryNational: {
    en: ' France: departures {departure}, returns {return}.',
    fr: ' France : départs {departure}, retours {return}.',
    de: ' Frankreich: Hinfahrt {departure}, Rückfahrt {return}.',
    es: ' Francia: salidas {departure}, regresos {return}.',
  },
  summaryForecastUnknown: {
    en: 'No Bison Futé forecast {day} for {where}.',
    fr: 'Pas de prévision Bison Futé {day} pour {where}.',
    de: 'Keine Bison-Futé-Prognose {day} für {where}.',
    es: 'No hay previsión de Bison Futé {day} para {where}.',
  },

  // widgets
  widgetScope: { en: '{radius} km', fr: '{radius} km', de: '{radius} km', es: '{radius} km' },
  widgetScopeRoads: {
    en: '{roads}, {radius} km',
    fr: '{roads}, {radius} km',
    de: '{roads}, {radius} km',
    es: '{roads}, {radius} km',
  },
  widgetEvents: { en: 'Events', fr: 'Évènements', de: 'Meldungen', es: 'Incidencias' },
  widgetClosures: { en: 'Closures', fr: 'Fermetures', de: 'Sperrungen', es: 'Cortes' },
  // Accidents and obstacles: a short word, the tile is narrow.
  widgetAccidents: { en: 'Incidents', fr: 'Incidents', de: 'Störungen', es: 'Incidentes' },
  widgetCongestion: { en: 'Traffic jams', fr: 'Bouchons', de: 'Staus', es: 'Atascos' },
  widgetRoadworks: { en: 'Roadworks', fr: 'Chantiers', de: 'Baustellen', es: 'Obras' },
  widgetNoEvent: {
    en: 'No road event within {radius} km on the national roads.',
    fr: 'Aucun évènement dans un rayon de {radius} km sur les routes nationales.',
    de: 'Keine Meldung im Umkreis von {radius} km auf den Nationalstraßen.',
    es: 'Ninguna incidencia en un radio de {radius} km en las carreteras nacionales.',
  },
  widgetMore: {
    en: 'Other active events',
    fr: 'Autres évènements en cours',
    de: 'Weitere aktuelle Meldungen',
    es: 'Otras incidencias activas',
  },
  widgetPlanned: {
    en: 'Planned within 7 days',
    fr: 'Prévus sous 7 jours',
    de: 'Geplant in 7 Tagen',
    es: 'Previstas en 7 días',
  },
  widgetUpdated: { en: 'Updated', fr: 'Mise à jour', de: 'Aktualisiert', es: 'Actualizado' },
  widgetQueue: {
    en: 'Queue: {length}',
    fr: 'Longueur : {length}',
    de: 'Staulänge: {length}',
    es: 'Longitud: {length}',
  },
  widgetFrom: {
    en: 'From {date}',
    fr: 'À partir du {date}',
    de: 'Ab {date}',
    es: 'Desde el {date}',
  },
  widgetSince: {
    en: 'Since {date}',
    fr: 'Depuis le {date}',
    de: 'Seit {date}',
    es: 'Desde el {date}',
  },
  widgetUntil: {
    en: 'Until {date}',
    fr: 'Jusqu’au {date}',
    de: 'Bis {date}',
    es: 'Hasta el {date}',
  },
  widgetNoEnd: {
    en: 'No end announced',
    fr: 'Fin non annoncée',
    de: 'Kein Ende angekündigt',
    es: 'Sin fin anunciado',
  },
  widgetPlannedOn: {
    en: 'Planned {date}',
    fr: 'Prévu le {date}',
    de: 'Geplant am {date}',
    es: 'Prevista el {date}',
  },
  widgetSource: {
    en: 'Source: {source}',
    fr: 'Source : {source}',
    de: 'Quelle: {source}',
    es: 'Fuente: {source}',
  },
  widget_departure_today: {
    en: 'Departures today',
    fr: 'Départs aujourd’hui',
    de: 'Hinfahrt heute',
    es: 'Salidas hoy',
  },
  widget_return_today: {
    en: 'Returns today',
    fr: 'Retours aujourd’hui',
    de: 'Rückfahrt heute',
    es: 'Regresos hoy',
  },
  widget_departure_tomorrow: {
    en: 'Departures tomorrow',
    fr: 'Départs demain',
    de: 'Hinfahrt morgen',
    es: 'Salidas mañana',
  },
  widget_return_tomorrow: {
    en: 'Returns tomorrow',
    fr: 'Retours demain',
    de: 'Rückfahrt morgen',
    es: 'Regresos mañana',
  },
  // Which directions reach the worst level of a day.
  widgetDay_departure: { en: 'Departures', fr: 'Départs', de: 'Hinfahrt', es: 'Salidas' },
  widgetDay_return: { en: 'Returns', fr: 'Retours', de: 'Rückfahrt', es: 'Regresos' },
  widgetDay_both: {
    en: 'Both directions',
    fr: 'Départs et retours',
    de: 'Hin- und Rückfahrt',
    es: 'Salidas y regresos',
  },
  widgetDayDetail: {
    en: '{day}\nDepartures: {departure}\nReturns: {return}',
    fr: '{day}\nDéparts : {departure}\nRetours : {return}',
    de: '{day}\nHinfahrt: {departure}\nRückfahrt: {return}',
    es: '{day}\nSalidas: {departure}\nRegresos: {return}',
  },
  widgetNoColouredDay: {
    en: 'No orange, red or black day forecast in the next {days} days.',
    fr: 'Aucun jour orange, rouge ou noir prévu dans les {days} prochains jours.',
    de: 'Kein oranger, roter oder schwarzer Tag in den nächsten {days} Tagen vorhergesagt.',
    es: 'Ningún día naranja, rojo o negro previsto en los próximos {days} días.',
  },
  widgetFrance_today: {
    en: 'France today',
    fr: 'France aujourd’hui',
    de: 'Frankreich heute',
    es: 'Francia hoy',
  },
  widgetFrance_tomorrow: {
    en: 'France tomorrow',
    fr: 'France demain',
    de: 'Frankreich morgen',
    es: 'Francia mañana',
  },
  widgetNoPlace: {
    en: 'No place is configured: add a house or a commune in the configuration of the integration.',
    fr: 'Aucun lieu n’est configuré : ajoutez une maison ou une commune dans la configuration de l’intégration.',
    de: 'Kein Ort konfiguriert: Fügen Sie in der Konfiguration der Integration ein Haus oder eine Gemeinde hinzu.',
    es: 'No hay ningún lugar configurado: añada una casa o un municipio en la configuración de la integración.',
  },
  widgetNotRead: {
    en: 'The data of Bison Futé have not been read yet: see the status of the integration.',
    fr: 'Les données de Bison Futé n’ont pas encore été lues : voir l’état de l’intégration.',
    de: 'Die Daten von Bison Futé wurden noch nicht gelesen: siehe Status der Integration.',
    es: 'Los datos de Bison Futé aún no se han leído: vea el estado de la integración.',
  },
  widgetNoForecast: {
    en: 'Bison Futé publishes no forecast for {where}: only mainland France, without Corsica.',
    fr: 'Bison Futé ne publie pas de prévision pour {where} : seulement la France métropolitaine, hors Corse.',
    de: 'Bison Futé veröffentlicht keine Prognose für {where}: nur das französische Festland, ohne Korsika.',
    es: 'Bison Futé no publica previsiones para {where}: solo la Francia metropolitana, sin Córcega.',
  },

  // places and connection status
  placeHouse: {
    en: 'house “{name}”',
    fr: 'la maison « {name} »',
    de: 'Haus „{name}“',
    es: 'la casa «{name}»',
  },
  placeSlot: { en: 'place {slot}', fr: 'le lieu {slot}', de: 'Ort {slot}', es: 'el lugar {slot}' },
  placeUnknownHouse: {
    en: 'this house no longer exists in Gladys.',
    fr: 'cette maison n’existe plus dans Gladys.',
    de: 'dieses Haus existiert in Gladys nicht mehr.',
    es: 'esta casa ya no existe en Gladys.',
  },
  placeNoLocation: {
    en: 'the house has no location in Gladys: set it in Settings > Houses, or type the commune.',
    fr: 'la maison n’a pas de position dans Gladys : renseignez-la dans Paramètres > Maisons, ou saisissez la commune.',
    de: 'das Haus hat in Gladys keinen Standort: Legen Sie ihn unter Einstellungen > Häuser fest oder geben Sie die Gemeinde ein.',
    es: 'la casa no tiene ubicación en Gladys: indíquela en Ajustes > Casas o escriba el municipio.',
  },
  placeNotFound: {
    en: '“{query}” matches no French commune.',
    fr: '« {query} » ne correspond à aucune commune française.',
    de: '„{query}“ entspricht keiner französischen Gemeinde.',
    es: '«{query}» no corresponde a ningún municipio francés.',
  },
  placeOutside: {
    en: 'the house is outside France: Bison Futé covers only French roads.',
    fr: 'la maison est hors de France : Bison Futé ne couvre que les routes françaises.',
    de: 'das Haus liegt außerhalb Frankreichs: Bison Futé deckt nur französische Straßen ab.',
    es: 'la casa está fuera de Francia: Bison Futé solo cubre carreteras francesas.',
  },
  placeGeoError: {
    en: 'the commune service of the French government did not answer ({detail}).',
    fr: 'le service des communes de l’État n’a pas répondu ({detail}).',
    de: 'der Gemeindedienst des französischen Staates hat nicht geantwortet ({detail}).',
    es: 'el servicio de municipios del Estado francés no respondió ({detail}).',
  },
  placeDuplicate: {
    en: 'the same commune as place {other}: only place {other} is kept.',
    fr: 'même commune que le lieu {other} : seul le lieu {other} est gardé.',
    de: 'dieselbe Gemeinde wie Ort {other}: nur Ort {other} wird behalten.',
    es: 'el mismo municipio que el lugar {other}: solo se conserva el lugar {other}.',
  },
  statusPlace: {
    en: 'Place ignored, {place}: {detail}',
    fr: 'Lieu ignoré, {place} : {detail}',
    de: 'Ort ignoriert, {place}: {detail}',
    es: 'Lugar ignorado, {place}: {detail}',
  },
  statusConnected: {
    en: 'Connected to Bison Futé: {places}. Road events read every {interval} min.',
    fr: 'Connecté à Bison Futé : {places}. Évènements lus toutes les {interval} min.',
    de: 'Mit Bison Futé verbunden: {places}. Meldungen alle {interval} Min. gelesen.',
    es: 'Conectado a Bison Futé: {places}. Incidencias leídas cada {interval} min.',
  },
  statusPlaceCount: {
    en: '{name} {count} event(s)',
    fr: '{name} {count} évènement(s)',
    de: '{name} {count} Meldung(en)',
    es: '{name} {count} incidencia(s)',
  },
  statusUnreachable: {
    en: 'Bison Futé cannot be reached ({detail}). New try in {minutes} min.',
    fr: 'Bison Futé est injoignable ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Bison Futé ist nicht erreichbar ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'No se puede acceder a Bison Futé ({detail}). Nuevo intento en {minutes} min.',
  },
  statusInvalid: {
    en: 'Bison Futé sent an unreadable file ({detail}). New try in {minutes} min.',
    fr: 'Bison Futé a envoyé un fichier illisible ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Bison Futé hat eine unlesbare Datei gesendet ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'Bison Futé envió un archivo ilegible ({detail}). Nuevo intento en {minutes} min.',
  },
  noPlaces: {
    en: 'Choose a house of Gladys or type a commune in the configuration.',
    fr: 'Choisissez une maison de Gladys ou saisissez une commune dans la configuration.',
    de: 'Wählen Sie in der Konfiguration ein Haus von Gladys oder geben Sie eine Gemeinde ein.',
    es: 'Elija una casa de Gladys o escriba un municipio en la configuración.',
  },

  // configuration screen actions
  refreshTooSoon: {
    en: 'The road events were read {seconds} s ago. Try again in a minute.',
    fr: 'Les évènements ont été lus il y a {seconds} s. Réessayez dans une minute.',
    de: 'Die Meldungen wurden vor {seconds} s gelesen. In einer Minute erneut versuchen.',
    es: 'Las incidencias se leyeron hace {seconds} s. Inténtelo de nuevo en un minuto.',
  },
  refreshDone: {
    en: 'Bison Futé read: {places}.',
    fr: 'Bison Futé lu : {places}.',
    de: 'Bison Futé gelesen: {places}.',
    es: 'Bison Futé leído: {places}.',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab of the integration ({count} line(s)). Copy the lines starting with “Bison Futé diagnostic” into your report.',
    fr: 'Diagnostic écrit dans l’onglet Journaux de l’intégration ({count} ligne(s)). Copiez les lignes commençant par « Bison Futé diagnostic » dans votre retour.',
    de: 'Diagnose in den Tab Protokolle der Integration geschrieben ({count} Zeile(n)). Kopieren Sie die Zeilen, die mit „Bison Futé diagnostic“ beginnen, in Ihre Meldung.',
    es: 'Diagnóstico escrito en la pestaña Registros de la integración ({count} línea(s)). Copie las líneas que empiezan por «Bison Futé diagnostic» en su informe.',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('deviceName', 'fr', { place: 'Mâcon' }); // -> 'Trafic Mâcon'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object|Function} [values] - The substitutions, or `(language) => values`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description Label of an event category.
 * @param {string} category - A CATEGORIES key.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
const categoryLabel = (category, language) =>
  t(TEXTS[`category_${category}`] ? `category_${category}` : 'category_other', language);

/**
 * @description Label of a forecast level.
 * @param {number|null} level - 0 (green) to 3 (black).
 * @param {string} language - The language.
 * @returns {string} The label, '-' when unknown.
 */
const levelLabel = (level, language) =>
  TEXTS[`level_${level}`] ? t(`level_${level}`, language) : '-';

const locale = (language) => (isLanguage(language) ? language : 'en');

/**
 * @description A distance the way a language writes it ("3.2 km", "3,2 km").
 * @param {number} km - Kilometres.
 * @param {string} language - The language.
 * @returns {string} The text, '' when not finite.
 */
function formatDistance(km, language) {
  if (!Number.isFinite(km)) {
    return '';
  }
  const value = new Intl.NumberFormat(locale(language), {
    maximumFractionDigits: km < 10 ? 1 : 0,
  }).format(km);
  return `${value} km`;
}

/**
 * @description An instant written the short way of a language ("16/10 13:12").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortDateTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description An instant written in full, with its year ("29 oct. 2026,
 * 14:05"): the detail of an event may start or end in another year.
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function longDateTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(locale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description A day and month ("16/10").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortDate(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description A calendar date the short way, with its day ("Sat. 17/10"):
 * the title of a day in a grid column.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {string} language - The language.
 * @returns {string} The text, capitalized.
 */
function shortDay(date, language) {
  const at = new Date(`${date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat(locale(language), {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(at);
  const text = `${day} ${shortDate(at.getTime(), language, 'UTC')}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @description A calendar date in full ("Saturday, October 17, 2026").
 * @param {string} date - `YYYY-MM-DD`.
 * @param {string} language - The language.
 * @returns {string} The text, capitalized.
 */
function fullDay(date, language) {
  const text = new Intl.DateTimeFormat(locale(language), {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export {
  LANGUAGES,
  TEXTS,
  isLanguage,
  t,
  all,
  categoryLabel,
  levelLabel,
  formatDistance,
  shortDateTime,
  longDateTime,
  shortDate,
  shortDay,
  fullDay,
};
