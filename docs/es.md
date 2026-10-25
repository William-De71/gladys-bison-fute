# Bison Futé

## Presentación

Esta integración lleva **Bison Futé**, el servicio francés de información vial, a Gladys, para uno a tres lugares: las **incidencias viales** alrededor de cada lugar (cortes, accidentes, obstáculos, atascos, obras) y la **previsión de tráfico** de su departamento, verde, naranja, roja o negra, para salidas y regresos. Cada lugar se convierte en un dispositivo que puede mostrar en un panel y usar en escenas.

Las incidencias proceden de los datos abiertos de las direcciones de carreteras del Estado (DIR), publicados por Bison Futé en formato DATEX II y actualizados todo el día. La integración los lee cada 5 minutos por defecto, con una petición condicional: unos 150 KB cuando algo ha cambiado, casi nada en caso contrario. Las previsiones proceden del calendario del sitio bison-fute.gouv.fr y se leen cada seis horas.

Es una integración **en la nube**, sin cuenta ni clave: contacta con `tipi.bison-fute.gouv.fr` y `www.bison-fute.gouv.fr` (archivos públicos), y con `geo.api.gouv.fr` (el servicio abierto de municipios del Estado francés) para encontrar el municipio de su casa.

**Cobertura**: las carreteras nacionales y las autopistas sin peaje, Île-de-France incluida. Las autopistas de peaje (Vinci, APRR, Sanef…) y las carreteras departamentales no están en este flujo abierto. Las previsiones cubren la Francia metropolitana, sin Córcega.

## Requisitos

- Gladys Assistant 5.3.0 o posterior.
- La ubicación de su casa en Gladys (Ajustes > Casas), o el nombre del municipio que seguir.
- Nada más: ni cuenta ni clave.

## Configuración

| Campo                   | Qué introducir                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Casa                    | Una casa de Gladys: su ubicación es el centro de la zona.                                        |
| O un municipio          | «Mâcon», «71000», «Saint-Denis 93200» o el código INSEE. Si se rellena, prevalece sobre la casa. |
| Radio (km)              | Las incidencias a menos de esta distancia, de 1 a 200 km (20 por defecto).                       |
| Solo estas carreteras   | «N79, A6» para su trayecto habitual. Vacío: todas las carreteras de la zona.                     |
| Lugar 2, Lugar 3        | Otros lugares (segunda residencia, oficina, trayecto frecuente). Opcional.                       |
| Incidencias leídas cada | 2, 5, 10, 15 o 30 minutos.                                                                       |
| Idioma de los textos    | Nombres de los dispositivos, incidencia más cercana y resúmenes de escenas.                      |

Guarde: el estado en la parte superior de la página indica el número de incidencias de cada lugar. **Leer ahora** vuelve a leer al instante (como mucho una vez por minuto).

## Uso

### Dispositivos

En la pestaña **Descubrir**, cree el dispositivo «Tráfico …» de cada lugar. Contiene:

- las incidencias activas de la zona: todas, cortes, accidentes y obstáculos, atascos, obras (contadores);
- la más cercana en texto: «N79 · Accidente · 3,2 km»;
- donde Bison Futé publica previsiones: la previsión de salidas y regresos, hoy y mañana, 0 verde, 1 naranja, 2 rojo, 3 negro (Gladys la muestra como riesgo nulo, bajo, medio o alto).

Una incidencia está activa entre su inicio y su fin. Una incidencia prevista (obras la semana que viene) cuenta desde que empieza; una suspendida no cuenta. Las descripciones las escriben los gestores viales, en francés.

### Widgets del panel

![El widget Tráfico vial alrededor de Créteil (contadores, incidencias activas y previstas) y el widget Previsión Bison Futé del Val-de-Marne (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-bison-fute/main/docs/assets/widgets.es.png)

- **Tráfico vial**: los contadores, luego las incidencias activas (primero cortes y accidentes, después las más cercanas) y las previstas en los próximos días; toque una tarjeta para ver el sentido, la descripción y las fechas.
- **Previsión Bison Futé**: salidas y regresos hoy y mañana, los próximos días naranjas, rojos o negros, y Francia en su conjunto.

Elija el lugar en los ajustes del widget (vacío: el primero).

### Escenas

Desencadenantes, una vez por cambio (la primera lectura de un lugar solo sirve de referencia):

- **Bison Futé: incidencia vial iniciada**: una incidencia se activa en la zona. Filtros: lugar, tipos, carretera.
- **Bison Futé: incidencia vial terminada**: una incidencia activa ha terminado.
- **Bison Futé: incidencia vial prevista**: se anuncia una nueva incidencia para los próximos siete días.
- **Bison Futé: previsión naranja, roja o negra**: para hoy desde las 6 h, para mañana desde las 18 h del día anterior, de nuevo si empeora. Filtros: lugar, día, sentido, niveles.

Cada uno da una frase lista, `{{triggerEvent.data.summary}}`, y sus valores (carretera, localidad, distancia, tipo…). Las acciones **Bison Futé: leer las incidencias viales** y **Bison Futé: leer la previsión** devuelven el mismo tipo de valores, para ponerlos en un mensaje o comprobarlos en una condición.

Ejemplos:

- Cuando empieza un corte o un accidente en la N118 → enviar el resumen a su teléfono.
- Cuando la previsión de mañana es roja en el sentido de las salidas → recordar a la familia que salga temprano.
- Cada día laborable a las 7:30 → leer las incidencias de la oficina y enviar la lista si hay alguna.

### Transporte

Solo nube: los datos proceden de Internet. Solo las coordenadas de la casa elegida (para encontrar su municipio) y los municipios escritos salen de su red.

## Solución de problemas

- **«la casa no tiene ubicación en Gladys»**: indíquela en Ajustes > Casas o escriba el municipio.
- **«no corresponde a ningún municipio francés»**: escriba «nombre código postal» o el código INSEE.
- **Ninguna incidencia aunque hay un atasco**: quizá esté en una autopista de peaje o una carretera departamental, que este flujo abierto no cubre; o fuera del radio, o en una carretera que no indicó.
- **Sin función de previsión**: Bison Futé no publica previsiones para Córcega ni ultramar.
- **«No se puede acceder a Bison Futé»**: la integración lo reintenta a los 2 minutos y luego en cada lectura; los últimos datos se quedan en los widgets.
- **Para informar de un problema**: pulse **Diagnóstico** y copie las líneas que empiezan por «Bison Futé diagnostic» de la pestaña Registros en una issue de GitHub o una respuesta en el foro, con las versiones de Gladys y de la integración.
