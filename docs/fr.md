# Bison Futé

## Présentation

Cette intégration apporte **Bison Futé**, le service d’information routière de l’État, dans Gladys, pour un à trois lieux : les **évènements routiers** autour de chaque lieu (fermetures, accidents, obstacles, bouchons, chantiers) et la **prévision de trafic** de son département, verte, orange, rouge ou noire, pour les départs et les retours. Chaque lieu devient un appareil à afficher sur un tableau de bord et à utiliser dans des scènes.

Les évènements viennent des données ouvertes des directions interdépartementales des routes (DIR), publiées par Bison Futé au format DATEX II et mises à jour toute la journée. L’intégration les lit toutes les 5 minutes par défaut, avec une requête conditionnelle : environ 150 Ko quand quelque chose a changé, presque rien sinon. Les prévisions viennent du calendrier du site bison-fute.gouv.fr et sont lues toutes les six heures.

C’est une intégration **cloud**, sans compte ni clé : elle contacte `tipi.bison-fute.gouv.fr` et `www.bison-fute.gouv.fr` (fichiers publics), et `geo.api.gouv.fr` (le service ouvert des communes de l’État) pour trouver la commune de votre maison.

**Couverture** : les routes nationales et les autoroutes non concédées, Île-de-France comprise. Les autoroutes à péage (Vinci, APRR, Sanef…) et les routes départementales ne sont pas dans ce flux ouvert. Les prévisions couvrent la France métropolitaine, hors Corse.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- La position de votre maison dans Gladys (Paramètres > Maisons), ou le nom de la commune à suivre.
- Rien d’autre : ni compte, ni clé.

## Configuration

| Champ                     | Que saisir                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Maison                    | Une maison de Gladys : sa position est le centre de la zone.                                        |
| Ou une commune            | « Mâcon », « 71000 », « Saint-Denis 93200 » ou le code INSEE. Renseignée, elle prime sur la maison. |
| Rayon (km)                | Les évènements à moins de cette distance, de 1 à 200 km (20 par défaut).                            |
| Seulement ces routes      | « N79, A6 » pour votre trajet habituel. Vide : toutes les routes de la zone.                        |
| Lieu 2, Lieu 3            | D’autres lieux (résidence secondaire, travail, trajet fréquent). Facultatif.                        |
| Évènements lus toutes les | 2, 5, 10, 15 ou 30 minutes.                                                                         |
| Langue des textes         | Noms des appareils, évènement le plus proche et résumés des scènes.                                 |

Enregistrez : l’état en haut de la page indique le nombre d’évènements de chaque lieu. **Lire maintenant** relit tout de suite (au plus une fois par minute).

## Utilisation

### Appareils

Dans l’onglet **Découverte**, créez l’appareil « Trafic … » de chaque lieu. Il contient :

- les évènements en cours dans la zone : tous, fermetures, accidents et obstacles, bouchons, chantiers (compteurs) ;
- le plus proche en texte : « N79 · Accident · 3,2 km » ;
- là où Bison Futé publie des prévisions : la prévision des départs et des retours, aujourd’hui et demain, 0 vert, 1 orange, 2 rouge, 3 noir (affichée par Gladys en risque nul, faible, moyen ou élevé).

Un évènement est en cours entre son début et sa fin. Un évènement prévu (un chantier la semaine prochaine) compte dès qu’il commence ; un évènement suspendu ne compte pas. Les descriptions sont rédigées par les exploitants.

### Widgets du tableau de bord

![Le widget Trafic routier autour de Créteil (compteurs, évènements en cours et prévus) et le widget Prévisions Bison Futé du Val-de-Marne (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-bison-fute/main/docs/assets/widgets.fr.png)

- **Trafic routier** : les compteurs, puis les évènements en cours (fermetures et accidents d’abord, puis les plus proches) et ceux prévus dans les prochains jours ; touchez une carte pour le sens, la description et les dates.
- **Prévisions Bison Futé** : départs et retours aujourd’hui et demain, les prochains jours orange, rouges ou noirs, et la France entière.

Choisissez le lieu dans les réglages du widget (vide : le premier).

### Scènes

Déclencheurs, une fois par changement (la première lecture d’un lieu sert seulement de référence) :

- **Bison Futé : évènement routier en cours** : un évènement devient actif dans la zone. Filtres : lieu, types, route.
- **Bison Futé : évènement routier terminé** : un évènement en cours est terminé.
- **Bison Futé : évènement routier prévu** : un nouvel évènement est annoncé pour les sept prochains jours.
- **Bison Futé : prévision orange, rouge ou noire** : pour aujourd’hui dès 6 h, pour demain dès 18 h la veille, à nouveau si elle s’aggrave. Filtres : lieu, jour, sens, niveaux.

Chacun fournit une phrase toute prête, `{{triggerEvent.data.summary}}`, et ses valeurs (route, commune, distance, type…). Les actions **Bison Futé : lire les évènements routiers** et **Bison Futé : lire la prévision** renvoient le même genre de valeurs, à mettre dans un message ou à tester dans une condition.

Exemples :

- Quand une fermeture ou un accident commence sur la N118 → envoyer le résumé sur votre téléphone.
- Quand la prévision de demain est rouge dans le sens des départs → rappeler à la famille de partir tôt.
- Chaque jour ouvré à 7 h 30 → lire les évènements du lieu de travail et envoyer la liste s’il y en a.

### Transport

Cloud uniquement : les données viennent d’Internet. Seules les coordonnées de la maison choisie (pour trouver sa commune) et les communes saisies quittent votre réseau.

## Dépannage

- **« la maison n’a pas de position »** : renseignez-la dans Paramètres > Maisons, ou saisissez la commune.
- **« ne correspond à aucune commune française »** : saisissez « nom code postal », ou le code INSEE.
- **Aucun évènement alors qu’il y a un bouchon** : il est peut-être sur une autoroute à péage ou une route départementale, que ce flux ouvert ne couvre pas ; ou hors du rayon, ou sur une route que vous n’avez pas listée.
- **Pas de fonctionnalité de prévision** : Bison Futé ne publie pas de prévision pour la Corse ni l’outre-mer.
- **« Bison Futé est injoignable »** : l’intégration réessaie au bout de 2 minutes, puis à chaque lecture ; les dernières données restent sur les widgets.
- **Pour signaler un problème** : appuyez sur **Diagnostic**, puis copiez les lignes commençant par « Bison Futé diagnostic » de l’onglet Journaux dans une issue GitHub ou une réponse sur le forum, avec les versions de Gladys et de l’intégration.
