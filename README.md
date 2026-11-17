# Podgląd

Prosta przeglądarka obrazów dla architektów i wizualizatorów — zamiennik Adobe Bridge.
Działa na Windows i macOS.

**Formaty:** JPG, PNG, PSD/PSB, TIFF, TGA, EXR, HDR, pliki RAW z aparatów (podgląd JPEG zapisany w pliku), WebP, AVIF, GIF, BMP, ICO, SVG.

## Pobieranie

Gotowe instalatory są w zakładce **Releases** tego repozytorium:

- Windows: `Podglad-…-win-x64.exe`
- Mac z procesorem Apple (M1–M4): `Podglad-…-mac-arm64.dmg`
- Mac z procesorem Intel: `Podglad-…-mac-x64.dmg`

### Pierwsze uruchomienie

Program nie jest podpisany płatnym certyfikatem, więc system za pierwszym razem ostrzega.

- **Windows:** w oknie „System Windows ochronił ten komputer” kliknij *Więcej informacji* → *Uruchom mimo to*.
- **macOS:** przeciągnij Podgląd do *Programów* i spróbuj go otworzyć. Gdy pojawi się komunikat, wejdź w *Ustawienia systemowe → Prywatność i ochrona*, przewiń w dół i kliknij *Otwórz mimo to*. Jeśli macOS twierdzi, że program jest „uszkodzony”, wpisz w Terminalu:
  `xattr -cr /Applications/Podgląd.app`

## Jak działa pamięć miniatur

Miniatury (480 px, WebP) zapisują się w folderze programu na dysku:

- Windows: `%APPDATA%\Podgląd\miniatury`
- macOS: `~/Library/Application Support/Podgląd/miniatury`

Folder i limit (domyślnie 2 GB) zmienisz w lewej kolumnie. Gdy limit się zapełni, najdawniej oglądane miniatury są usuwane. Plik rozpoznawany jest po ścieżce, rozmiarze i dacie zmiany, więc nadpisany render dostaje nową miniaturę.

Po wejściu do folderu najpierw liczą się widoczne miniatury, potem w tle reszta folderu i okładki podfolderów. Program obserwuje otwarty folder — nowy render pojawia się sam.

## Skróty

| Klawisz | Działanie |
|---|---|
| Enter / spacja | otwórz podgląd lub folder; spacja w podglądzie wraca do siatki |
| kółko / gładzik w podglądzie | następny / poprzedni obraz |
| R, E, Z, C, P w podglądzie | pokaż w Finderze, Photoshop, 100%, kopiuj obraz, kopiuj ścieżkę |
| Tab | ukryj / pokaż interfejs |
| ← → ↑ ↓ | poruszanie się po siatce |
| Backspace / ⌘↑ | folder wyżej |
| ⌘/Ctrl + E | otwórz w Photoshopie |
| ⌘/Ctrl + A | zaznacz wszystkie |
| + / − | wielkość miniatur |
| L | ikony / lista |
| N | pokaż / ukryj nazwy |
| T | jasny / ciemny |
| R | odśwież |
| / albo ⌘/Ctrl + F | szukaj |

Pliki można przeciągać z Podglądu prosto do Photoshopa, 3ds Maxa czy Findera/Eksploratora.

## Nowa wersja

Każdy push do gałęzi `main` buduje instalatory na oba systemy (zakładka *Actions*, ok. 10 minut) i publikuje je jako wydanie `v<wersja>` z `package.json`. Przy nowej wersji wystarczy podbić `version`; bez tego istniejące wydanie dostaje nowe pliki.

Uruchomienie z kodu: `npm install`, potem `npm start`.
