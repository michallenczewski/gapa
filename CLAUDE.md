# Gapa — wskazówki dla asystenta

- Rozmawiamy po polsku. Właściciel (Michał) woli pełne zdania niż skróty i oszczędny, nieozdobny wygląd interfejsu.
- Zmiany commituj i wypychaj sam, ale **nie wydawaj nowej wersji po każdej poprawce**. Repozytorium jest publiczne, więc budowanie w GitHub Actions nic nie kosztuje, ale instalatory budują się tylko po ręcznym uruchomieniu workflow. Zbieraj zmiany i wydawaj wersję tylko wtedy, gdy Michał o to poprosi; wtedy podbij wersję i uruchom workflow (`gh api repos/michallenczewski/podglad/actions/workflows/build.yml/dispatches -f ref=main -f 'inputs[os]=oba'`; `win` albo `mac`, jeśli Michał potrzebuje tylko jednego systemu).
- Przed większą zmianą przeczytaj `ARCHITEKTURA.md`. Jeśli prośba zbliża się do któregoś z „sygnałów, że trzeba wrócić do tematu” (pamięć, integracja z systemem, wydajność dekodowania, wspólny kod z Asset Browserem), powiedz o tym Michałowi wprost, zanim zaczniesz.
- Interfejs testuj na wersji przeglądarkowej (`node scripts/build-web.js`, potem `web/podglad.html`). Opisy skrótów i podpowiedzi muszą się zgadzać dla Maca (⌘, ⌥, Finder) i Windows (Ctrl, Alt, Eksplorator).
- Najważniejsze są szybkość i płynność. Podgląd PSD/PSB nie musi być większy niż 4K (także po przybliżeniu).
- Na Macu nie dublujemy rozwiązań systemowych: szybki podgląd spacją z Findera, pełny ekran i podgląd kilku plików naraz robi macOS. Te funkcje Gapy są tylko dla Windows.
