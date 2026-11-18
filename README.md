# Gapa

*(wcześniej: Podgląd)*

Prosta przeglądarka obrazów dla architektów i wizualizatorów — zamiennik Adobe Bridge.
Działa na Windows i macOS.

**Formaty:** JPG, PNG, PSD/PSB, TIFF, TGA, EXR, HDR, pliki RAW z aparatów (podgląd JPEG zapisany w pliku), WebP, AVIF, GIF, BMP, ICO, SVG.

**Pliki projektowe:** PDF (cały dokument w podglądzie), DWG, SKP, MAX, 3DM, Archicad (PLN/PLA/TPL). Program bierze miniatury systemowe (te same co Eksplorator/Finder — działają dla formatów, których program jest zainstalowany), a gdy ich nie ma, wyciąga podgląd zapisany w pliku.

Jak program jest zbudowany i kiedy warto zmienić platformę (Tauri, moduły w Ruście): [ARCHITEKTURA.md](ARCHITEKTURA.md).

## Pobieranie

Gotowe instalatory są w zakładce **Releases** tego repozytorium:

- Windows: `Podglad-…-win-x64.exe`
- Mac z procesorem Apple (M1–M4): `Podglad-…-mac-arm64.dmg`
- Mac z procesorem Intel: `Podglad-…-mac-x64.dmg`

### Pierwsze uruchomienie

Program nie jest podpisany płatnym certyfikatem, więc system za pierwszym razem ostrzega.

- **Windows:** w oknie „System Windows ochronił ten komputer” kliknij *Więcej informacji* → *Uruchom mimo to*.
- **macOS:** przeciągnij Gapę do *Programów* i spróbuj go otworzyć. Gdy pojawi się komunikat, wejdź w *Ustawienia systemowe → Prywatność i ochrona*, przewiń w dół i kliknij *Otwórz mimo to*. Jeśli macOS twierdzi, że program jest „uszkodzony”, wpisz w Terminalu:
  `sudo xattr -cr /Applications/Gapa.app`

## Pliki: przenoszenie, kopiowanie, zmiana nazwy

Przeciągnięcie plików na folder (kafelek, folder w drzewie albo w Ulubionych) albo na siatkę innego okna przenosi je, jeśli są na tym samym dysku, a kopiuje, jeśli na innym; z Alt (⌥ na Macu) zawsze kopiuje. Pod kursorem widać, co się stanie. Nic nie jest nadpisywane — powtórzona nazwa dostaje dopisek „(2)”. ⌘Z / Ctrl+Z cofa ostatnią operację (cofnięta kopia trafia do Kosza). To samo działa przez ⌘C / ⌘X i ⌘V.

## Koszyk i wyszukiwanie w bibliotece

**Koszyk** zbiera pliki z różnych folderów podczas przeglądania: zaznacz i naciśnij B, wybierz „Dodaj do koszyka” z menu albo przeciągnij miniatury na „Koszyk” w panelu bocznym. Pliki zostają na swoich miejscach. W koszyku przycisk „Przeciągnij wszystkie” przenosi całość naraz do Photoshopa, 3ds Maxa albo Findera, a „Kopiuj do folderu…” kopiuje pliki do folderu projektu (bez nadpisywania). Delete / ⌘⌫ w koszyku tylko wyjmuje plik z koszyka. Koszyk pamięta się między uruchomieniami.

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
| 1 / 2 | mniejsze / większe miniatury; w podglądzie oddal / przybliż (także − + oraz ⌘/Ctrl + − +, ⌘/Ctrl+0 przywraca) |
| Tab | ukryj / pokaż interfejs |
| Esc | zamknij podgląd, wyczyść wyszukiwanie |
| ⌘/Ctrl + N | nowe okno w tym samym folderze (Koszyk i Ulubione są wspólne) |
| ⌘[ ⌘] (Mac) / Alt+← Alt+→ (Windows) | wstecz / dalej po odwiedzonych miejscach (też strzałki < > i boczne przyciski myszy) |
| ⌘/Ctrl + kółko, szczypnięcie | płynna zmiana wielkości miniatur; w podglądzie przybliżanie wokół kursora |
| ⌘⌫ (Mac) / Delete (Windows) | przenieś do Kosza (foldery po potwierdzeniu); w koszyku tylko wyjmuje z koszyka |
| ⌘C / ⌘X, potem ⌘V (Ctrl na Windows) | kopiuj albo wytnij zaznaczone pliki i foldery, wklej w bieżącym folderze |
| F2 | zmień nazwę (Enter zapisuje, Esc anuluje) |
| ⌘Enter / Ctrl+Enter | otwórz w domyślnym programie |
| ⌘Z / Ctrl+Z | cofnij ostatnie przeniesienie, kopiowanie albo zmianę nazwy |
| ⌘/Ctrl + A | zaznacz wszystkie |
| ⌘L / Ctrl+L | wpisz lub wklej ścieżkę (wklejenie ścieżki gdziekolwiek też przenosi) |
| ⌘/Ctrl + D | dodaj folder do ulubionych |
| N / ⇧N | nazwy plików / nazwy folderów |
| K, M | film: odtwórz / pauza, wycisz |
| ↑ ↓ (PDF) | poprzednia / następna strona |

Pliki można przeciągać z Podglądu prosto do Photoshopa, 3ds Maxa czy Findera/Eksploratora.

## Wersja w przeglądarce (do testowania interfejsu)

`web/podglad.html` to ten sam interfejs w jednym pliku HTML. Otwórz go w Chrome albo Edge (dwuklik na pobranym pliku) i wskaż folder. Miniatury zapisują się w pamięci przeglądarki; funkcje systemowe (Finder/Eksplorator, Photoshop, przeciąganie plików) działają tylko w programie.

Plik powstaje z kodu programu: `node scripts/build-web.js`.

## Nowa wersja programu

Instalatory budują się tylko przy nowej wersji: wystarczy podbić `version` w `package.json` i wypchnąć zmiany. GitHub Actions zbuduje wtedy instalatory na oba systemy (ok. 10 minut) i opublikuje wydanie `v<wersja>`. Push bez zmiany wersji nic nie buduje. Budowanie można też uruchomić ręcznie: *Actions → Buduj instalatory → Run workflow*.

Uruchomienie z kodu: `npm install`, potem `npm start`. Miniatury PDF rysuje pdf.js (zależność `pdfjs-dist`, dołączana przy budowaniu).
