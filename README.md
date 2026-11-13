# Prijswaker-widget

Gegevens voor de iPhone-widget van de Prijswaker: per product de status en de beste prijs.
`widget.json` wordt elke ochtend bijgewerkt door de dagelijkse prijsronde.

## Instellen (eenmalig)

1. Installeer **Scriptable** uit de App Store (gratis).
2. Open op je iPhone in Safari:
   https://raw.githubusercontent.com/jcgate26/prijswaker-widget/main/Prijswaker.js
   Houd je vinger op de tekst, kies **Selecteer alles** en dan **Kopieer**.
3. Open Scriptable, tik op **+**, plak de tekst en tik linksboven op de naam om het script
   **Prijswaker** te noemen. Tik op **Gereed**.
4. Houd je vinger op een lege plek van je beginscherm, tik op **Wijzig** › **Voeg widget toe**,
   kies **Scriptable** en een maat (klein, middel of groot). Zet hem neer.
5. Houd de widget ingedrukt › **Wijzig widget** › bij **Script** kies **Prijswaker**.

Tik op de widget om het volledige dashboard te openen.

## Per thema en doorklikken

- Zonder parameter is de widget per thema ingedeeld (nu **Speakers** en **Pannen**). Elk thema heeft
  een kopregel met het aantal deals (groen), daaronder de producten van dat thema, deals eerst.
  Past niet alles, dan staat er `+2 meer` in de kopregel.
- Een widget voor één thema: houd de widget ingedrukt › **Wijzig widget** › bij **Parameter** typ je
  het thema, bijvoorbeeld `Pannen` of `Speakers` (`Soundbars` werkt ook nog). Zet meerdere widgets
  op elkaar voor een stapel waar je doorheen veegt.
- Tik op de widget voor het detailscherm in Scriptable: alle producten van het thema met winkel,
  gemiddelde en dealgrens. Tik op een product om de winkel te openen. Bij middel en groot formaat
  opent elke tegel zijn eigen thema.

## Ontwerp aanpassen

`Prijswaker.js` is alleen een lader: hij haalt elke keer het ontwerp `core.js` van GitHub en
bewaart een kopie voor als je offline bent. Een nieuw ontwerp komt dus vanzelf binnen; opnieuw
plakken is niet nodig. Tegels: groen = deal, lichtgroen = scherp, grijs = normaal, rood = duur.
Het percentage is de afwijking van het gemiddelde van 2026.
