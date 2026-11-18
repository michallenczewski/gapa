# Gapa

*(wcześniej: Podgląd)*

Prosta przeglądarka obrazów dla architektów i wizualizatorów — zamiennik Adobe Bridge.
Działa na Windows i macOS.

**Formaty:** JPG, PNG, PSD/PSB, TIFF, TGA, EXR, HDR, pliki RAW z aparatów (podgląd JPEG zapisany w pliku), WebP, AVIF, GIF, BMP, ICO, SVG.

**Pliki projektowe:** PDF (cały dokument w podglądzie), DWG, SKP, MAX, 3DM, Archicad (PLN/PLA/TPL). Program bierze miniatury systemowe (te same co Eksplorator/Finder — działają dla formatów, których program jest zainstalowany), a gdy ich nie ma, wyciąga podgląd zapisany w pliku.

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

## Jak działa pamięć miniatur

Miniatury (480 px, WebP) zapisują się w folderze programu na dysku:

- Windows: `%APPDATA%\Podgląd\miniatury`
- macOS: `~/Library/Application Support/Podglad/miniatury`

Folder i limit (domyślnie 2 GB) zmienisz w lewej kolumnie. Gdy limit się zapełni, najdawniej oglądane miniatury są usuwane. Plik rozpoznawany jest po ścieżce, rozmiarze i dacie zmiany, więc nadpisany render dostaje nową miniaturę.

Po wejściu do folderu najpierw liczą się widoczne miniatury, potem w tle reszta folderu i okładki podfolderów. Program obserwuje otwarty folder — nowy render pojawia się sam.

## Skróty

| Klawisz | Działanie |
|---|---|
| Enter / spacja | otwórz podgląd lub folder; spacja w podglądzie wraca do siatki |
| kółko / gładzik w podglądzie | następny / poprzedni obraz |
| R, E, Z, C, P w podglądzie | pokaż w Finderze, Photoshop, 100%, kopiuj obraz, kopiuj ścieżkę |
| Tab | ukryj / pokaż interfejs |
| I | panel informacji o zaznaczonym pliku |
| \\ | panel boczny |
| W / ⇧Enter na folderze | wszystko w środku: obrazy z podfolderów z nagłówkami folderów |
| ← → ↑ ↓ | poruszanie się po siatce |
| Backspace / ⌘↑ | folder wyżej |
| ⌘/Ctrl + E | otwórz w Photoshopie |
| ⌘/Ctrl + A | zaznacz wszystkie |
| + / − | wielkość miniatur |
| L | ikony / lista |
| N | pokaż / ukryj nazwy plików |
| Shift+N | pokaż / ukryj nazwy folderów |
| K, M | film: odtwórz / pauza, wycisz |
| S | dźwięki interfejsu: włącz / wycisz |
| G | siatka linii między miniaturami |
| ⌘L / Ctrl+L (też ⌘⇧G) | wpisz lub wklej ścieżkę; Enter przechodzi, ścieżka do pliku otwiera jego folder i zaznacza plik |
| ⌥⌘C / Ctrl+Alt+C | kopiuj ścieżkę zaznaczonych plików, a bez zaznaczenia — bieżącego folderu |
| ⌘V / Ctrl+V | wklejona ścieżka przenosi od razu do folderu |
| [ | panel folderów (też \\ albo ⌘⌥S / Ctrl+Alt+S) |
| ] | panel informacji (też I albo ⌘⌥I / Ctrl+Alt+I) |
| Tab (w podglądzie) | tryb minimalny — bez paska z nazwą i strzałek |
| klik / Z (w podglądzie) | dopasuj ↔ powiększ; potem przeciągaj, przewijaj kółkiem lub gładzikiem |
| Ctrl/⌘ + kółko, szczypnięcie | przybliżanie wokół kursora; + i − co 25%, 0 dopasowuje |
| ↑ ↓ (PDF) | poprzednia / następna strona |
| T | jasny / ciemny |
| R | odśwież |
| / albo ⌘/Ctrl + F | szukaj |

Pliki można przeciągać z Podglądu prosto do Photoshopa, 3ds Maxa czy Findera/Eksploratora.

## Wersja w przeglądarce (do testowania interfejsu)

`web/podglad.html` to ten sam interfejs w jednym pliku HTML. Otwórz go w Chrome albo Edge (dwuklik na pobranym pliku) i wskaż folder. Miniatury zapisują się w pamięci przeglądarki; funkcje systemowe (Finder/Eksplorator, Photoshop, przeciąganie plików) działają tylko w programie.

Plik powstaje z kodu programu: `node scripts/build-web.js`.

## Nowa wersja programu

Instalatory budują się tylko przy nowej wersji: wystarczy podbić `version` w `package.json` i wypchnąć zmiany. GitHub Actions zbuduje wtedy instalatory na oba systemy (ok. 10 minut) i opublikuje wydanie `v<wersja>`. Push bez zmiany wersji nic nie buduje. Budowanie można też uruchomić ręcznie: *Actions → Buduj instalatory → Run workflow*.

Uruchomienie z kodu: `npm install`, potem `npm start`. Miniatury PDF rysuje pdf.js (zależność `pdfjs-dist`, dołączana przy budowaniu).
