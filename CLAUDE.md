# Gapa — wskazówki dla asystenta

- Rozmawiamy po polsku. Właściciel (Michał) woli pełne zdania niż skróty i oszczędny, nieozdobny wygląd interfejsu.
- Zmiany commituj i wypychaj sam. Nowe instalatory powstają tylko po podbiciu wersji w `package.json`.
- Przed większą zmianą przeczytaj `ARCHITEKTURA.md`. Jeśli prośba zbliża się do któregoś z „sygnałów, że trzeba wrócić do tematu” (pamięć, integracja z systemem, wydajność dekodowania, wspólny kod z Asset Browserem), powiedz o tym Michałowi wprost, zanim zaczniesz.
- Interfejs testuj na wersji przeglądarkowej (`node scripts/build-web.js`, potem `web/podglad.html`). Opisy skrótów i podpowiedzi muszą się zgadzać dla Maca (⌘, ⌥, Finder) i Windows (Ctrl, Alt, Eksplorator).
