"""Ikony Gapy z jednego źródła (wytyczne: projekt/logo/WYTYCZNE_IKONY.md).

Źródłem jest projekt/logo/gapa.svg (tło 1024 × 1024 od krawędzi do krawędzi, promień 225 px).
Skrypt renderuje: build/icon-win.png i renderer/icon-win.png (Windows: tło 0–1023),
build/icon.png i renderer/icon.png (macOS: tło 824 px od 100 do 923, promień 185 px),
renderer/icon-win.ico (16, 20, 24, 32, 40, 48, 64, 256 px z wersji Windows).
Wymaga: Python z Pillow i Playwright z Chrome. Uruchomienie: python3 scripts/ikony.py
"""
import re, sys, pathlib
from PIL import Image
from playwright.sync_api import sync_playwright

R = pathlib.Path(__file__).resolve().parent.parent
SRC = (R / 'projekt/logo/gapa.svg').read_text()
ICO = [(s, s) for s in (16, 20, 24, 32, 40, 48, 64, 256)]

def inner(svg):  # zawartość <svg> bez znacznika i tytułu
    body = re.sub(r'^.*?<svg[^>]*>', '', svg, flags=re.S)
    return re.sub(r'</svg>\s*$', '', re.sub(r'<title>.*?</title>', '', body, flags=re.S))

def page(svg_body, mac):
    g = f'<g transform="translate(100,100) scale({824/1024})">' if mac else '<g>'
    body = svg_body
    if mac:  # na Macu promień 185 px przy boku 824 px; w skali 824/1024 to 230 jednostek źródła
        body = body.replace('rx="225"', 'rx="%.2f"' % (185 * 1024 / 824))
    return ('<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
            + g + body + '</g></svg></body></html>')

def render(html, out):
    pg.set_content(html); pg.screenshot(path=str(out), omit_background=True, clip={'x': 0, 'y': 0, 'width': 1024, 'height': 1024})

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=sys.argv[1] if len(sys.argv) > 1 else '/usr/bin/google-chrome')
    pg = b.new_page(viewport={'width': 1024, 'height': 1024})
    body = inner(SRC)
    for out in ('build/icon-win.png', 'renderer/icon-win.png'): render(page(body, False), R / out)
    for out in ('build/icon.png', 'renderer/icon.png'): render(page(body, True), R / out)
    b.close()
Image.open(R / 'renderer/icon-win.png').save(R / 'renderer/icon-win.ico', sizes=ICO)
print('gotowe')
