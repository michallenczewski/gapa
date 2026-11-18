# Architektura Gapy i kiedy zmienić platformę

Stan na listopad 2026, wersja 0.7.0.

## Jak Gapa jest zbudowana

Gapa to aplikacja Electron, czyli przeglądarka Chromium zamknięta w oknie programu, plus Node.js do obsługi dysku. Działa na macOS i na Windows z jednego kodu.

- **Proces główny (`main.js`)** obsługuje:
  - dysk: listowanie, przenoszenie i kopiowanie, zmianę nazwy, Kosz;
  - pamięć miniatur;
  - indeks biblioteki;
  - okna i przeciąganie plików na zewnątrz.
- **`preload.js`** to wąski most: interfejs dostaje tylko te funkcje, które są tam wystawione.
- **Interfejs (`renderer/`)** to HTML, CSS i JavaScript, bez frameworka. Formaty spoza przeglądarki (PSD/PSB, TIFF, TGA, EXR, HDR, RAW, podglądy w DWG, SKP, MAX, 3DM i PLN) dekoduje własny kod w Web Workerach (`renderer/decoders.js`). PDF rysuje pdf.js.
- **Wersja w przeglądarce (`web/`)** służy tylko do testowania interfejsu. Most `web/web-api.js` zastępuje tam Electron.
- **Wydania** buduje GitHub Actions, kiedy w `package.json` zmieni się numer wersji.

## Pamięć

Stały koszt Electrona to około 150–300 MB RAM, zanim cokolwiek się otworzy. Przy dużych plikach więcej zajmują zdekodowane piksele: obraz 8192 × 8192 to 256 MB. Od wersji 0.7.1 podgląd PSD, PSB, TIFF, EXR, HDR i TGA jest najpierw dekodowany w rozdzielczości ekranu, a pełna rozdzielczość wczytuje się dopiero po przybliżeniu i jest trzymana tylko dla bieżącego pliku. Rzeczywiste zużycie pokazuje „Pokaż zużycie pamięci” w ustawieniach.

Wąskie gardło, które zostaje: dekodery w JavaScripcie wczytują cały plik do pamięci przed dekodowaniem. Jeśli przy wielogigabajtowych PSB albo dużych 16-bitowych TIFF-ach będzie to za wolne albo za ciężkie, to sygnał 3 poniżej.

## Decyzja: na razie zostajemy przy Electronie

Obecny zakres (przeglądanie, podgląd, koszyk, wyszukiwanie w bibliotece, otwieranie, kopiowanie, przenoszenie, usuwanie i zmiana nazwy plików) Electron obsługuje w całości. Przepisanie programu na inną platformę kosztowałoby dużo pracy i niczego dziś nie poprawia.

## Sygnały, że trzeba wrócić do tematu

Przy każdej większej zmianie warto sprawdzić, czy nie zachodzi któryś z tych warunków:

1. **Pamięć.** Gapa działa obok 3ds Maxa i Photoshopa. Sam Electron zajmuje kilkaset MB, zanim cokolwiek się otworzy. Jeśli w codziennej pracy realnie zabiera pamięć potrzebną innym programom, to mocny argument.
2. **Integracja z systemem, której Electron nie zapewnia.** Na przykład:
   - systemowe okna kopiowania z paskiem postępu i pytaniem o konflikty nazw;
   - miniatury systemowe dla każdego typu pliku;
   - pełne menu kontekstowe Eksploratora;
   - Gapa jako domyślne okno folderów w Windows.

   Uwaga: wklejanie plików skopiowanych w Gapie do Eksploratora albo Findera (dziś działa tylko wewnątrz Gapy) najpewniej da się dorobić w Electronie przez schowek w formatach systemowych albo mały moduł natywny. Samo w sobie nie jest powodem do zmiany platformy.
3. **Wydajność dekodowania.** Wielogigabajtowe PSB albo duże EXR są wyraźnie za wolne w JavaScripcie.
4. **Wspólny kod z Asset Browserem Staszka** (Rust, egui/wgpu, SQLite). Na przykład wspólne dekodery albo wspólny katalog biblioteki.

## Kolejność możliwych kroków

1. **Electron z modułem natywnym w Ruście (napi-rs).** Interfejs zostaje, a tylko ciężkie albo systemowe części powstają jako moduł w Ruście: dekodowanie dużych plików, schowek zgodny z systemem, operacje na plikach z postępem. Rozwiązuje punkty 2–4, można sięgać po kod Staszka. To pierwszy krok, gdy pojawi się któryś sygnał.
2. **Tauri** (logika w Ruście, interfejs w HTML/CSS na systemowym WebView). Daje mniejszy instalator i mniejsze zużycie pamięci (punkt 1), a interfejs przechodzi prawie bez zmian. Proces główny trzeba przepisać na Rust. Ryzyko: na macOS interfejs działa w silniku Safari (WKWebView), a nie Chromium. Część rzeczy, na których Gapa polega, działa tam inaczej: kodeki wideo, niektóre funkcje obrazów, style pasków przewijania, `field-sizing`. Każdą zmianę trzeba testować na obu systemach.
3. **W pełni natywnie** (np. Rust + egui jak u Staszka). Najlżejsze, ale interfejs powstaje od nowa i trudniej o obecny, dopracowany wygląd.
4. **Wails, Flutter, Qt.** Technicznie możliwe, ale każde oznacza przepisanie interfejsu bez wyraźnej korzyści względem kroków 1 i 2.
