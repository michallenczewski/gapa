# Gapa

*(wcześniej: Podgląd)*

Prosta przeglądarka obrazów dla architektów i wizualizatorów — zamiennik Adobe Bridge.
Działa na Windows i macOS.

**Formaty:** JPG, PNG, PSD/PSB, TIFF, TGA, EXR, HDR, pliki RAW z aparatów (podgląd JPEG zapisany w pliku), WebP, AVIF, GIF, BMP, ICO, SVG.

**Pliki projektowe:** PDF (cały dokument w podglądzie: powiększanie z ostrym przerysowaniem stron, klik w stronę przybliża, przybliżoną stronę przesuwa się myszą, z lewej pasek miniatur stron włączany przyciskiem na dole; w siatce ruch myszy w poziomie po kafelku PDF przewija jego strony), DWG, SKP, MAX, 3DM, Archicad (PLN/PLA/TPL). Program bierze miniatury systemowe (te same co Eksplorator/Finder — działają dla formatów, których program jest zainstalowany), a gdy ich nie ma, wyciąga podgląd zapisany w pliku.

Jak program jest zbudowany i kiedy warto zmienić platformę (Tauri, moduły w Ruście): [ARCHITEKTURA.md](ARCHITEKTURA.md).

**Program do edycji (E):** Gapa sama znajduje Photoshopa, a jeśli go nie ma — Affinity (na Windows także wersję ze Sklepu / MSIX). Inny program wybierasz w ustawieniach → „Otwieraj w: …” albo w menu pod prawym przyciskiem → „Zmień program do edycji…”.

**Przyciski okna (Windows):** w ustawieniach → Windows → „Przyciski okna” można wybrać systemowe (Windows) albo własne Gapy — cienkie ikony jak reszta paska. Zmiana działa po ponownym uruchomieniu. Przy własnych przyciskach nie ma menu układów okien po najechaniu na maksymalizację (zostaje Win+Z).

**Ikona programu na Windows:** zmiana ikony podmienia ją też w skrótach Gapy (menu Start, pulpit, przypięta na pasku zadań). Przypięta ikona czasem odświeża się dopiero po ponownym zalogowaniu.

**Aktualizacje:** Gapa sama sprawdza, czy na GitHubie jest nowsza wersja (po starcie i co 6 godzin). Wtedy na przycisku ustawień (dwa suwaki w prawym górnym rogu) pojawia się kropka, a w jego menu „Zainstaluj wersję …”; klik pobiera ją i instaluje (Windows: po cichu, z ponownym uruchomieniem; Mac: obraz .dmg w Pobranych — Gapę przeciąga się do Aplikacji). Ręcznie: menu ustawień → „Sprawdź aktualizacje”.

**Miniatury całej biblioteki:** w ustawieniach (menu pod przyciskiem z suwakami → „Wszystkie ustawienia…”) → „Przygotuj miniatury biblioteki…”. Gapa robi brakujące miniatury wszystkich plików z ulubionych folderów w osobnym, niewidocznym oknie: gdy pracujesz, po jednym pliku, gdy komputer stoi bezczynnie — pełną mocą; komputer nie zasypia do końca. Postęp jest w stopce (klik: wstrzymaj, zatrzymaj). Opcja „Przygotowuj co noc” robi to samo między 2:00 a 6:00, jeśli Gapa działa (na Windows zostaje wtedy w tle z ikoną w zasobniku). Większe wersje miniatur dla dużych kafelków też trafiają na dysk, a przeniesienie lub zmiana nazwy pliku w Gapie zabiera jego miniaturę ze sobą.

## Pobieranie

Gotowe instalatory są w zakładce **Releases** tego repozytorium:

- Windows: `Gapa-…-win-x64.exe`
- Mac z procesorem Apple (M1–M4): `Gapa-…-mac-arm64.dmg`
- Mac z procesorem Intel: `Gapa-…-mac-x64.dmg`

### Pierwsze uruchomienie

Program nie jest podpisany płatnym certyfikatem, więc system za pierwszym razem ostrzega.

- **Windows:** w oknie „System Windows ochronił ten komputer” kliknij *Więcej informacji* → *Uruchom mimo to*.
- **macOS:** przeciągnij Gapę do *Programów* i spróbuj go otworzyć. Gdy pojawi się komunikat, wejdź w *Ustawienia systemowe → Prywatność i ochrona*, przewiń w dół i kliknij *Otwórz mimo to*. Jeśli macOS twierdzi, że program jest „uszkodzony”, wpisz w Terminalu:
  `sudo xattr -cr /Applications/Gapa.app`

## Pliki: przenoszenie, kopiowanie, zmiana nazwy

Przeciągnięcie plików na folder (kafelek, folder w drzewie albo w Ulubionych) albo na siatkę innego okna przenosi je, jeśli są na tym samym dysku, a kopiuje, jeśli na innym; z Alt (⌥ na Macu) zawsze kopiuje. Pod kursorem widać, co się stanie. Nic nie jest nadpisywane — powtórzona nazwa dostaje dopisek „(2)”. ⌘Z / Ctrl+Z cofa ostatnią operację (cofnięta kopia trafia do Kosza). To samo działa przez ⌘C / ⌘X i ⌘V.

## Windows: podgląd spacją w Eksploratorze

Ustawienia → „Podgląd spacją w Eksploratorze”. Potem wystarczy zaznaczyć plik w Eksploratorze i nacisnąć spację: otwiera się okno podglądu Gapy, a Eksplorator zostaje aktywny, więc strzałkami przechodzisz do kolejnych plików i podgląd za nimi podąża. Przy kilku zaznaczonych plikach spacja pokazuje je wszystkie naraz na arkuszu; strzałki i Enter działają wtedy w podglądzie, a zaznaczenie w Eksploratorze zostaje nietknięte. Spacja działa też na pulpicie. Spacja albo Esc zamyka podgląd. Kliknięcie w okno podglądu daje pełną obsługę jak w Gapie (przybliżanie, A / D, Z).

Gapa zostaje wtedy w tle z ikoną w zasobniku obok zegara (menu: otwórz, włącz / wyłącz, uruchamianie z Windows, zakończ). Działa w oknach Eksploratora (także w kartach Windows 11) i na pulpicie. Spacja w polu nazwy, adresu albo wyszukiwania działa normalnie, tak samo z Ctrl, Shift albo Alt; foldery i nieobsługiwane pliki dostają zwykłą spację. Za nasłuchiwanie odpowiada mały pomocnik `GapaSpacja.exe` (źródło: `helper/GapaSpacja.cs`).

## Koszyk i wyszukiwanie w bibliotece

**Koszyk** zbiera pliki z różnych folderów podczas przeglądania: zaznacz i naciśnij B, wybierz „Dodaj do koszyka” z menu albo przeciągnij miniatury na „Koszyk” w panelu bocznym. Pliki zostają na swoich miejscach. W koszyku przycisk „Przeciągnij wszystkie” przenosi całość naraz do Photoshopa, 3ds Maxa albo Findera, a „Kopiuj do folderu…” kopiuje pliki do folderu projektu (bez nadpisywania). Delete / ⌘⌫ w koszyku tylko wyjmuje plik z koszyka. Przeciągnięcie z koszyka do folderu (także w drugim oknie Gapy) zawsze kopiuje, nigdy nie przenosi. Filtr typów działa też w koszyku. Koszyk pamięta się między uruchomieniami.

**Gwiazdki** oceniają pliki w skali od jednej do trzech: zaznacz plik (albo kilka) i naciśnij 1, 2 lub 3 (z klawiatury numerycznej też); ta sama ocena naciśnięta drugi raz ją zdejmuje. Działa to także w podglądzie i z menu pod prawym przyciskiem. Gwiazdki widać tylko na ocenionych plikach. Filtr pozwala pokazać pliki z co najmniej jedną, dwiema albo trzema gwiazdkami, sortowanie „Ocena” stawia najlepsze na początku, a „Oznaczone gwiazdkami” w panelu bocznym zbiera ocenione pliki ze wszystkich folderów. Gapa trzyma oceny u siebie (w pliku oceny-i-koszyk.json w danych programu, także te nadane w podglądzie spacją) i nie zapisuje niczego w Twoich plikach; ocena idzie za plikiem — i za całym folderem — gdy przenosisz go, kopiujesz albo zmieniasz mu nazwę w Gapie. Oceny z Adobe Bridge zapisane w pliku .xmp obok obrazu Gapa wczytuje sama (1–2 → ★, 3 → ★★, 4–5 → ★★★).

**Sortowanie „Rodzaj”** układa pliki w grupy według formatu, w tej samej kolejności co w filtrze: najpierw JPG, potem PNG, PSD, TIFF i dalej; każda grupa ma nagłówek z liczbą plików, a w środku pliki idą alfabetycznie. Drugie kliknięcie odwraca kolejność grup.

**Biblioteka** to wszystkie foldery z Ulubionych razem z podfolderami. Gapa zapamiętuje nazwy plików w nich (indeks w pliku `biblioteka.json` obok ustawień) i odświeża go w tle po zmianie ulubionych, przy powrocie do okna, jeśli minęło 10 minut, albo na żądanie („Odśwież indeks”). Zakres wyszukiwania wybiera się przyciskiem w polu szukania: tu, podfoldery albo biblioteka. Słowa w zapytaniu muszą wystąpić wszystkie — w nazwie pliku albo folderu, więc „cegły czerwone” znajdzie pliki z folderu „Cegły/czerwone”.

## Jak działa pamięć miniatur

Miniatury (480 px, WebP) zapisują się w folderze programu na dysku:

- Windows: `%APPDATA%\Podgląd\miniatury`
- macOS: `~/Library/Application Support/Podglad/miniatury`

Folder i limit (domyślnie 2 GB) zmienisz w lewej kolumnie. Gdy limit się zapełni, najdawniej oglądane miniatury są usuwane. Plik rozpoznawany jest po ścieżce, rozmiarze i dacie zmiany, więc nadpisany render dostaje nową miniaturę.

Po wejściu do folderu najpierw liczą się widoczne miniatury, potem w tle reszta folderu i okładki podfolderów. Program obserwuje otwarty folder — nowy render pojawia się sam.

## Skróty

Najczęstsze skróty leżą pod lewą ręką, żeby prawa mogła zostać na myszce. Te same klawisze działają w siatce i w podglądzie. Klawisz ? pokazuje w programie ściągę z mapą klawiatury (przy pierwszym uruchomieniu pojawia się sama), a krótkie podpowiedzi pokazują się po razie, kiedy coś staje się przydatne; w ustawieniach można je włączyć od nowa.

| Klawisz | Działanie |
|---|---|
| spacja | otwórz podgląd / wróć do siatki |
| A / D | poprzedni / następny plik (także ← →) |
| Q | folder wyżej (także Backspace); w podglądzie wraca do siatki |
| W | tylko ten folder ↔ wszystko w środku z podfolderami |
| E | otwórz w Photoshopie (także ⌘/Ctrl+E) |
| R / ⇧R | pokaż w Finderze lub Eksploratorze / odśwież folder |
| T | jasny / ciemny |
| F / ⇧F | szukaj tutaj / szukaj w całej bibliotece (także ⌘/Ctrl+F, ⌘⇧F) |
| G | siatka linii między miniaturami |
| S | dźwięki interfejsu |
| Z | w podglądzie: dopasuj ↔ 100% |
| X / ⇧X | panel folderów / panel informacji (także [ ] \\ I) |
| C / ⇧C | kopiuj obraz / kopiuj ścieżki (także P, ⌥⌘C) |
| V | ikony ↔ lista (także L) |
| B / ⇧B | dodaj do koszyka lub wyjmij / otwórz koszyk |
| 1 2 3 | gwiazdki; ta sama drugi raz zdejmuje ocenę |
| ⌘, (Mac) / Ctrl+, (Windows) | otwórz lub zamknij wszystkie ustawienia (krótkie menu ustawień jest pod przyciskiem z suwakami w prawym górnym rogu) |
| − / + | mniejsze / większe miniatury; w podglądzie oddal / przybliż (także ⌘/Ctrl + − +, ⌘/Ctrl+0 przywraca) |
| Tab | ukryj / pokaż interfejs |
| Ctrl+spacja (Windows) | pełny ekran 100%: bez paska zadań, paska okna i interfejsu; wyjście tym samym skrótem albo Esc. Na Macu Gapa korzysta z systemowego pełnego ekranu (zielony przycisk, ⌃⌘F) |

| Esc | zamknij podgląd, wyczyść wyszukiwanie |
| ⌘/Ctrl + N | nowe okno w tym samym folderze (Koszyk i Ulubione są wspólne) |
| ⌘[ ⌘] (Mac) / Alt+← Alt+→ (Windows) | wstecz / dalej po odwiedzonych miejscach (też strzałki < > i boczne przyciski myszy) |
| ⌘/Ctrl + kółko, szczypnięcie | płynna zmiana wielkości miniatur; w podglądzie przybliżanie wokół kursora |
| ⌘⌫ (Mac) / Delete (Windows) | przenieś do Kosza (foldery po potwierdzeniu); w koszyku tylko wyjmuje z koszyka |
| ⌘C / ⌘X, potem ⌘V (Ctrl na Windows) | kopiuj albo wytnij zaznaczone pliki i foldery, wklej w bieżącym folderze, także w innym oknie Gapy. Skopiowane pliki wkleisz też w Eksploratorze i w Finderze (i z nich do Gapy); wycięcie przenosi tylko przy wklejeniu w Gapie — w Eksploratorze i Finderze wklei się kopia |
| F2 | zmień nazwę (Enter zapisuje, Esc anuluje) |
| ⌘Enter / Ctrl+Enter | otwórz w domyślnym programie |
| ⌘Z / Ctrl+Z | cofnij ostatnie przeniesienie, kopiowanie albo zmianę nazwy |
| ⌘/Ctrl + A | zaznacz wszystkie |
| ⌘L / Ctrl+L | wpisz lub wklej ścieżkę (wklejenie ścieżki gdziekolwiek też przenosi) |
| ⌘/Ctrl + D | dodaj folder do ulubionych |
| N / ⇧N | nazwy plików / nazwy folderów |
| K, M | film: odtwórz / pauza, wycisz |
| ↑ ↓ (PDF) | poprzednia / następna strona |
| + − albo Ctrl/⌘ + kółko (PDF) | powiększ / pomniejsz strony; 0 wraca do dopasowania |

Ścieżka u góry pokazuje domyślnie tylko bieżący folder i „…”; klik w „…” rozwija listę folderów nadrzędnych. W ustawieniach (menu pod przyciskiem z suwakami albo „Wszystkie ustawienia…”) można włączyć **Pełną ścieżkę** — wtedy Gapa pokazuje tyle folderów nadrzędnych, ile mieści się w pasku.


W podglądzie (także po powiększeniu) prawy przycisk myszy otwiera w miejscu kursora to samo menu co „…” w pasku, razem z gwiazdkami. W pasku podglądu obok „…” jest ikona pełnego ekranu. Gdy interfejs jest schowany albo okno jest na pełnym ekranie, po poruszeniu myszą w prawym górnym rogu pojawia się mała pastylka z dwoma przyciskami: pokaż interfejs oraz wejdź na pełny ekran albo z niego wyjdź. Po dwóch sekundach bez ruchu pastylka znika razem z kursorem.

Pliki można przeciągać z Gapy prosto do Photoshopa, 3ds Maxa czy Findera/Eksploratora.

## Wersja w przeglądarce (do testowania interfejsu)

`web/podglad.html` to ten sam interfejs w jednym pliku HTML. Otwórz go w Chrome albo Edge (dwuklik na pobranym pliku) i wskaż folder. Miniatury zapisują się w pamięci przeglądarki; funkcje systemowe (Finder/Eksplorator, Photoshop, przeciąganie plików) działają tylko w programie.

Plik powstaje z kodu programu: `node scripts/build-web.js`.

## Nowa wersja programu

Instalatory budują się tylko na wyraźne polecenie: podbij `version` w `package.json`, wypchnij zmiany i uruchom *Actions → Buduj instalatory → Run workflow* (system: oba, win albo mac). GitHub Actions zbuduje instalatory (ok. 10 minut) i opublikuje wydanie `v<wersja>`. Samo wypchnięcie niczego nie buduje. Zależności budują się w wersjach zapisanych w `package-lock.json`; po zmianie zależności w `package.json` uruchom *Actions → Odśwież package-lock.json*.

Uruchomienie z kodu: `npm install`, potem `npm start`. Miniatury PDF rysuje pdf.js (zależność `pdfjs-dist`, dołączana przy budowaniu).
