# BF Deals – iPhone-widget

De widget van BF Deals (voorheen Prijswaker): per thema de deals en de beste prijzen. Hij werkt
voor twee mensen, Jasper en Rebecca. Elk product is **gedeeld** (jullie zien het allebei) of is
van één van jullie (alleen die persoon ziet het). `widget.json` wordt elke ochtend bijgewerkt
door de dagelijkse prijsronde.

Je hebt geen Claude of ChatGPT nodig: alleen de gratis app Scriptable.

## Installeren

De stap-voor-stap-uitleg (Nederlands en English) staat in [INSTALLEREN.md](INSTALLEREN.md).
Die is ook voor Rebecca: zij heeft alleen Scriptable nodig, geen account.

## Jasper: Rebecca uitnodigen (eenmalig)

Om producten te kunnen toevoegen, heeft de widget een **sleutel** nodig. Dat is een soort
wachtwoord waarmee de widget alleen een productverzoek in jouw GitHub-postvak kan leggen. Rebecca
krijgt daarmee géén toegang tot je GitHub en hoeft nergens in te loggen. Ze krijgt van jou één
bericht met een instelcode; de widget doet de rest.

1. Open op je computer https://github.com/settings/personal-access-tokens/new (ingelogd als jij).
2. **Token name:** `BF Deals Rebecca`. **Expiration:** kies Custom en een datum over een jaar.
3. **Repository access:** kies **Only select repositories** en dan `prijswaker`.
4. **Permissions:** tik op **Add permissions**, kies **Issues** en zet hem op **Read and write**.
   Verder niets.
5. Tik op **Generate token** en kopieer de sleutel (begint met `github_pat_`). Zet hem op je
   telefoon, bijvoorbeeld via Notities.
6. Op je iPhone: tik op je BF Deals-widget › **Rebecca uitnodigen** › plak de sleutel ›
   **Maak bericht** › kies WhatsApp of Berichten › Rebecca.

Voor jezelf maak je op dezelfde manier een sleutel `BF Deals Jasper`. Tik dan op de widget ›
**Ik ben Jasper · wisselen** › **Instelcode opnieuw plakken** en plak hem.

Een sleutel intrekken kan op dezelfde GitHub-pagina (Fine-grained tokens). De widget vraagt dan
om een nieuwe instelcode.

## Kleuren

Groen = deal, lichtgroen = scherp, grijs = normaal, rood = duur. Het percentage is de afwijking
van het gemiddelde van 2026. Per thema zie je maximaal 3 producten. Deals staan er altijd; bij
meer dan 3 producten vallen eerst de rode weg, daarna de grijze. Op het kleine formaat passen er
2 per thema.

## Ontwerp aanpassen

`Prijswaker.js` is alleen een lader: hij haalt elke keer het ontwerp `core.js` van GitHub en
bewaart een kopie voor als je offline bent. Een nieuw ontwerp komt dus vanzelf binnen; opnieuw
plakken is niet nodig. Instellingen (wie je bent, thema's) staan per telefoon in Scriptable; de
sleutel staat in de sleutelhanger van je iPhone.
