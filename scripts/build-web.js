// Składa wersję przeglądarkową w jeden plik: web/podglad.html
// Uruchom: node scripts/build-web.js
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let html = R('renderer/index.html');
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '');
const inline = js => '<script>\n' + js.replace(/<\/script>/g, '<\\/script>') + '\n</script>';
html = html.replace('<script src="decoders.js"></script>', inline(R('web/web-api.js')) + '\n' + inline(R('renderer/decoders.js')));
html = html.replace('<script src="app.js"></script>', inline(R('renderer/app.js')));
html = html.replace('<title>Gapa</title>', '<title>Gapa (wersja w przeglądarce)</title>');
fs.writeFileSync(path.join(__dirname, '..', 'web', 'podglad.html'), html);
console.log('web/podglad.html', (html.length / 1024).toFixed(0) + ' KB');
