# BF Deals – iPhone-widget

De widget van BF Deals (voorheen Prijswaker): per thema de deals en de beste prijzen. Hij werkt
voor twee mensen, Jasper en Rebecca. Elk product is **gedeeld** (jullie zien het allebei) of is
van één van jullie (alleen die persoon ziet het). `widget.json` wordt elke ochtend bijgewerkt
door de dagelijkse prijsronde.

Je hebt geen Claude of ChatGPT nodig: alleen de gratis app Scriptable.

## Installeren (eenmalig, ongeveer 3 minuten)

1. Installeer **Scriptable** uit de App Store (gratis).
2. Open deze link in Safari:
   https://raw.githubusercontent.com/jcgate26/prijswaker-widget/main/Prijswaker.js
   Houd je vinger op de tekst, kies **Selecteer alles** en dan **Kopieer**.
3. Open Scriptable en tik rechtsboven op **+**. Plak de tekst. Tik bovenaan op de naam en noem het
   script **BF Deals**.
4. Tik onderaan op het schuifjes-icoon (Script Settings) en zet bij **Share Sheet Inputs**
   een vinkje bij **URLs**. Dan kun je straks vanuit Safari producten toevoegen. Tik op **Gereed**.
5. Tik op het script om het te starten. Kies **Wie ben je?** › Jasper of Rebecca.
6. Ga naar je beginscherm. Houd je vinger op een lege plek › **Wijzig** › **Voeg widget toe** ›
   **Scriptable**. Kies klein, middel of groot en zet hem neer.
7. Houd de widget ingedrukt › **Wijzig widget** › bij **Script** kies **BF Deals**.

## Thema's kiezen

Tik op de widget › **Thema's kiezen**. Tik op een thema om het aan of uit te zetten
(bijvoorbeeld Pannen uit, Speakers aan). Tik op **Klaar**. Je ziet alleen thema's waarin
producten staan die voor jou zichtbaar zijn.

Wil je een aparte widget voor één thema: houd de widget ingedrukt › **Wijzig widget** › typ bij
**Parameter** de naam van het thema, bijvoorbeeld `Speakers`.

## Een product toevoegen

Eerst één keer de **sleutel** instellen. Jasper maakt hem en stuurt hem je (zie hieronder).
De eerste keer dat je iets toevoegt, vraagt de widget erom; plakken en klaar.

Daarna kan het op twee manieren:

- **Vanuit Safari (makkelijkst):** open het product in een webwinkel (Coolblue, bol, MediaMarkt,
  wat je wilt) › deelknop › **Scriptable** › **BF Deals**.
- **In de app:** kopieer de link, tik op de widget › **＋ Product toevoegen**. De link staat er
  al in. Je mag ook gewoon de naam typen, bijvoorbeeld `Dyson V15 Detect Absolute`.

Kies dan **Alleen voor mij** of **Gedeeld met …**. Vul eventueel een notitie in, bijvoorbeeld
een kleur. De link vertelt alleen welk product je bedoelt: BF Deals zoekt het daarna in alle
Nederlandse en Europese winkels die naar Amsterdam bezorgen. Na ongeveer 20 minuten staat het
in je widget.

## De sleutel maken (Jasper, eenmalig per persoon)

1. Ga op github.com naar **Settings › Developer settings › Personal access tokens ›
   Fine-grained tokens › Generate new token**.
2. Naam: `BF Deals – Rebecca` (of `– Jasper`). Kies een looptijd, bijvoorbeeld 1 jaar.
3. **Repository access:** Only select repositories › `jcgate26/prijswaker`.
4. **Permissions › Repository permissions › Issues:** Read and write. Verder niets.
5. **Generate token**, kopieer hem en stuur hem naar Rebecca (of plak hem zelf in je widget).

Met deze sleutel kun je alleen productverzoeken (issues) indienen en bekijken. Hij kan geen code
of prijsgegevens lezen of wijzigen. Kwijt of verlopen: maak een nieuwe en trek de oude in.

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
