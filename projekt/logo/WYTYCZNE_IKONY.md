# Wytyczne ikony programu

Dotyczy wszystkich programów z rodziny (Gapa, Blat, Modo, Ryś i kolejnych).
Cel: na pasku zadań Windows i w Docku macOS kolorowe tła ikon mają **dokładnie ten sam rozmiar**.
Wzorem jest Gapa (repozytorium michallenczewski/gapa, pliki `build/icon-win.png` i `build/icon.png`).

## Dlaczego

Windows i macOS pokazują plik ikony w całości, razem z przezroczystym marginesem.
Jeśli jeden program ma w pliku pusty margines wokół tła, a drugi nie, to na pasku zadań
tła wychodzą różnej wielkości (zmierzone: od 21 do 25 px przy tej samej ikonie systemowej).

## Zasady

1. **Jedno źródło.** Ikona to jeden plik SVG (np. `projekt/logo/<nazwa>.svg`):
   tło = zaokrąglony kwadrat w kolorze programu, na nim symbol.
   Wszystkie pliki PNG i ICO renderujemy z tego SVG, niczego nie rysujemy osobno.

2. **Windows: tło od krawędzi do krawędzi.**
   - Plik `build/icon-win.png`: 1024 × 1024 px.
   - Kolorowe tło wypełnia całe płótno, **bez przezroczystego marginesu**:
     nieprzezroczyste piksele zaczynają się w pikselu 0 i kończą w 1023, w poziomie i w pionie.
   - Promień narożnika: 225 px (22% boku).

3. **macOS: siatka Apple.**
   - Plik `build/icon.png`: 1024 × 1024 px.
   - Tło to kwadrat 824 × 824 px odsunięty o 100 px od każdej krawędzi, promień narożnika 185 px.
   - **Nigdy nie używaj pliku z Maca jako ikony Windows** (i odwrotnie). To najczęstsza przyczyna
     zbyt małej ikony na pasku zadań Windows.

4. **Bez dodatków wokół tła.** Żadnego cienia pod tłem, obwódki ani poświaty
   poza kwadratem tła. Cień czy grubość mogą być tylko w samym symbolu, na tle.

5. **Symbol.** Mieści się w środkowym kwadracie około 60–66% boku tła, z cieniem i grubością włącznie,
   jest wyśrodkowany i czytelny w 24 i 32 px. Jeśli symbol już jest i wygląda dobrze, nie ruszaj go;
   ta poprawka dotyczy przede wszystkim tła.

6. **Konfiguracja.**
   - Electron (electron-builder): w `package.json` `mac.icon` → `build/icon.png`,
     `win.icon` → `build/icon-win.png`. electron-builder sam zrobi z nich .icns i .ico.
   - Program, który nie jest w Electronie: plik `.ico` z rozmiarami 16, 20, 24, 32, 40, 48, 64 i 256 px,
     każdy renderowany z SVG w wersji Windows (punkt 2), oraz `.icns` z wersji macOS (punkt 3).

7. **Sprawdzenie przed commitem** (wykonaj i pokaż wynik):
   - zmierz w `build/icon-win.png` zasięg nieprzezroczystych pikseli w środkowym wierszu i kolumnie:
     musi być 0–1023;
   - zmierz w `build/icon.png`: tło 100–923;
   - wyrenderuj obie ikony w 24, 32 i 128 px obok ikony Gapy i porównaj wielkość tła.

8. **Po instalacji nowej wersji na Windows** odepnij program od paska zadań i przypnij go ponownie
   (Windows trzyma starą ikonę w pamięci). Jeśli to nie pomoże: `ie4uinit.exe -show` w terminalu.

Po zmianie ikony zbuduj i wydaj nową wersję zgodnie z zasadami danego repozytorium.
