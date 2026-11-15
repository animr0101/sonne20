// Baut die Präsentation: setzt praesentation/daten.json in praesentation/vorlage.html ein.
//   praesentation/unser_sonnenstrom.html   – zum Veröffentlichen (ohne <html>-Gerüst)
//   praesentation/unser_sonnenstrom_datei.html – zum Öffnen im Browser / Drucken (mit Gerüst)
// Aufruf:  node simulation/praesentation_bauen.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const vorlage = fs.readFileSync(path.join(ROOT, 'praesentation', 'vorlage.html'), 'utf8');
const daten = fs.readFileSync(path.join(ROOT, 'praesentation', 'daten.json'), 'utf8').replace(/</g, '\\u003c');
const seite = vorlage.replace('__DATEN__', () => daten);
fs.writeFileSync(path.join(ROOT, 'praesentation', 'unser_sonnenstrom.html'), seite);
const datei = `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
  `<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n${seite}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(ROOT, 'praesentation', 'unser_sonnenstrom_datei.html'), datei);
console.log('→ praesentation/unser_sonnenstrom.html,', (seite.length / 1e3).toFixed(0), 'kB');
