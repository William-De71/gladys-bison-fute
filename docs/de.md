# Bison Futé

## Überblick

Diese Integration bringt **Bison Futé**, den französischen Verkehrsinformationsdienst, für einen bis drei Orte in Gladys: die **Verkehrsmeldungen** rund um jeden Ort (Sperrungen, Unfälle, Hindernisse, Staus, Baustellen) und die **Verkehrsprognose** seines Departements, grün, orange, rot oder schwarz, für Hin- und Rückfahrt. Jeder Ort wird zu einem Gerät, das Sie auf einem Dashboard anzeigen und in Szenen verwenden können.

Die Meldungen stammen aus den offenen Daten der staatlichen Straßenbehörden (DIR), die Bison Futé im Format DATEX II veröffentlicht und den ganzen Tag aktualisiert. Die Integration liest sie standardmäßig alle 5 Minuten mit einer bedingten Anfrage: etwa 150 KB, wenn sich etwas geändert hat, sonst fast nichts. Die Prognosen stammen aus dem Kalender der Website bison-fute.gouv.fr und werden alle sechs Stunden gelesen.

Es ist eine **Cloud**-Integration ohne Konto und ohne Schlüssel: Sie kontaktiert `tipi.bison-fute.gouv.fr` und `www.bison-fute.gouv.fr` (öffentliche Dateien) sowie `geo.api.gouv.fr` (den offenen Gemeindedienst des französischen Staates), um die Gemeinde Ihres Hauses zu finden.

**Abdeckung**: die Nationalstraßen und die mautfreien Autobahnen, Île-de-France eingeschlossen. Mautautobahnen (Vinci, APRR, Sanef…) und Departementstraßen sind nicht in diesem offenen Feed. Die Prognosen decken das französische Festland ohne Korsika ab.

## Voraussetzungen

- Gladys Assistant 5.2.0 oder neuer.
- Der Standort Ihres Hauses in Gladys (Einstellungen > Häuser) oder der Name der zu verfolgenden Gemeinde.
- Sonst nichts: kein Konto, kein Schlüssel.

## Konfiguration

| Feld                   | Was eingeben                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Haus                   | Ein Haus von Gladys: sein Standort ist der Mittelpunkt der Zone.                                    |
| Oder eine Gemeinde     | „Mâcon“, „71000“, „Saint-Denis 93200“ oder der INSEE-Code. Ausgefüllt hat sie Vorrang vor dem Haus. |
| Radius (km)            | Die Meldungen innerhalb dieser Entfernung, 1 bis 200 km (standardmäßig 20).                         |
| Nur diese Straßen      | „N79, A6“ für Ihre übliche Strecke. Leer: alle Straßen der Zone.                                    |
| Ort 2, Ort 3           | Weitere Orte (Zweitwohnung, Büro, häufige Strecke). Optional.                                       |
| Meldungen gelesen alle | 2, 5, 10, 15 oder 30 Minuten.                                                                       |
| Sprache der Texte      | Gerätenamen, nächste Meldung und Szenen-Zusammenfassungen.                                          |

Speichern: Der Status oben auf der Seite zeigt die Anzahl der Meldungen jedes Ortes. **Jetzt lesen** liest sofort neu (höchstens einmal pro Minute).

## Verwendung

### Geräte

Erstellen Sie im Tab **Entdecken** das Gerät „Verkehr …“ jedes Ortes. Es enthält:

- die aktiven Meldungen der Zone: alle, Sperrungen, Unfälle und Hindernisse, Staus, Baustellen (Zähler);
- die nächste als Text: „N79 · Unfall · 3,2 km“;
- wo Bison Futé Prognosen veröffentlicht: die Prognose für Hin- und Rückfahrt, heute und morgen, 0 grün, 1 orange, 2 rot, 3 schwarz (von Gladys als kein, geringes, mittleres oder hohes Risiko angezeigt).

Eine Meldung ist zwischen Beginn und Ende aktiv. Eine geplante Meldung (eine Baustelle nächste Woche) zählt ab ihrem Beginn; eine ausgesetzte zählt nicht. Die Beschreibungen schreiben die Straßenbetreiber, auf Französisch.

### Dashboard-Widgets

![Das Widget Straßenverkehr rund um Créteil (Zähler, aktive und geplante Meldungen) und das Widget Bison-Futé-Prognose für Val-de-Marne (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-bison-fute/main/docs/assets/widgets.de.png)

- **Straßenverkehr**: die Zähler, dann die aktiven Meldungen (zuerst Sperrungen und Unfälle, dann die nächsten) und die in den nächsten Tagen geplanten; tippen Sie auf eine Karte für Richtung, Beschreibung und Zeitraum.
- **Bison-Futé-Prognose**: Hin- und Rückfahrt heute und morgen, die nächsten orangen, roten oder schwarzen Tage und ganz Frankreich.

Wählen Sie den Ort in den Einstellungen des Widgets (leer: der erste).

### Szenen

Auslöser, einmal pro Änderung (die erste Abfrage eines Ortes dient nur als Referenz):

- **Bison Futé: Verkehrsmeldung begonnen**: eine Meldung wird in der Zone aktiv. Filter: Ort, Arten, Straße.
- **Bison Futé: Verkehrsmeldung beendet**: eine aktive Meldung ist beendet.
- **Bison Futé: Verkehrsmeldung geplant**: eine neue Meldung wird für die nächsten sieben Tage angekündigt.
- **Bison Futé: orange, rote oder schwarze Prognose**: für heute ab 6 Uhr, für morgen ab 18 Uhr am Vortag, erneut bei Verschlechterung. Filter: Ort, Tag, Richtung, Stufen.

Jeder liefert einen fertigen Satz, `{{triggerEvent.data.summary}}`, und seine Werte (Straße, Ort, Entfernung, Art…). Die Aktionen **Bison Futé: Verkehrsmeldungen lesen** und **Bison Futé: Prognose lesen** liefern dieselbe Art von Werten für eine Nachricht oder eine Bedingung.

Beispiele:

- Wenn auf der N118 eine Sperrung oder ein Unfall beginnt → die Zusammenfassung aufs Handy senden.
- Wenn die Prognose für morgen für die Hinfahrt rot ist → die Familie an eine frühe Abfahrt erinnern.
- Jeden Werktag um 7:30 Uhr → die Meldungen des Büros lesen und die Liste senden, falls es welche gibt.

### Transport

Nur Cloud: Die Daten kommen aus dem Internet. Nur die Koordinaten des gewählten Hauses (um seine Gemeinde zu finden) und die eingegebenen Gemeinden verlassen Ihr Netzwerk.

## Fehlerbehebung

- **„das Haus hat in Gladys keinen Standort“**: Legen Sie ihn unter Einstellungen > Häuser fest oder geben Sie die Gemeinde ein.
- **„entspricht keiner französischen Gemeinde“**: Geben Sie „Name Postleitzahl“ oder den INSEE-Code ein.
- **Keine Meldung trotz Stau**: Er liegt vielleicht auf einer Mautautobahn oder einer Departementstraße, die dieser offene Feed nicht abdeckt; oder außerhalb des Radius oder auf einer nicht aufgeführten Straße.
- **Keine Prognose-Funktion**: Bison Futé veröffentlicht keine Prognose für Korsika und Übersee.
- **„Bison Futé ist nicht erreichbar“**: Die Integration versucht es nach 2 Minuten erneut, dann bei jeder Abfrage; die letzten Daten bleiben in den Widgets.
- **Ein Problem melden**: Drücken Sie **Diagnose** und kopieren Sie die Zeilen, die mit „Bison Futé diagnostic“ beginnen, aus dem Tab Protokolle in ein Issue auf GitHub oder eine Antwort im Forum, mit den Versionen von Gladys und der Integration.
