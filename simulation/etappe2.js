// Etappe 2 – Verteilung: fix vs. dynamisch, Sonderfall Top 10.
// Aufruf:  node simulation/etappe2.js     →  simulation/ausgabe/etappe2_verteilung.md
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('./kern.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const lade = j => JSON.parse(fs.readFileSync(path.join(ROOT, 'simulation', 'daten', `jahr_${j}.json`), 'utf8'));
const T = K.TOPS;

// Zahlen im österreichischen Format (1.234,5); Tausenderpunkt wie auf den Rechnungen
const de = (x, nk = 0) => {
  const r = Math.round(x * 10 ** nk) / 10 ** nk;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk });
};
const vz = (x, nk = 0) => (Math.round(x * 10 ** nk) > 0 ? '+' : '') + de(x, nk);   // mit Vorzeichen
const pct = (a, b) => b ? `${de(a / b * 100)} %` : '–';

function szenario(name, aenderung) {
  const s = K.ausKonfiguration(CFG);
  aenderung(s);
  return { name, s };
}

const SZENARIEN = [
  szenario('S0 · fix, wie heute (Schlüssel HALLAG, Top 10 mit 17 %)', () => {}),
  szenario('S1 · fix, Schlüssel nach 1.107 Anteilen', s => { s.verteilung.schluessel = K.schluesselAusAnteilen(CFG.haus.anteile_1107); }),
  szenario('S2 · **dynamisch**', s => { s.verteilung.modell = 'dynamisch'; }),
  szenario('S3a · fix, Top 10 mit 50 %', s => { s.verteilung.teilnahme['10'] = 50; }),
  szenario('S3b · fix, Top 10 mit 100 %', s => { s.verteilung.teilnahme['10'] = 100; }),
  szenario('S3c · dynamisch, Top 10 mit 50 %', s => { s.verteilung.modell = 'dynamisch'; s.verteilung.teilnahme['10'] = 50; }),
  szenario('S3d · dynamisch, Top 10 mit 100 %', s => { s.verteilung.modell = 'dynamisch'; s.verteilung.teilnahme['10'] = 100; }),
];

function bericht() {
  const d2025 = lade(2025);
  const erg = SZENARIEN.map(x => ({ ...x, r: K.simuliere(d2025, x.s, { details: true }) }));
  const r0 = erg[0].r, r2 = erg[2].r;
  const L = [];
  L.push('# Etappe 2 – Verteilung: fix oder dynamisch?', '',
    'Referenzjahr **2025** · Rechenkern `simulation/kern.js` · Preise brutto (Tops 22,15 ct, im SNAP-Fenster 20,52 ct;',
    'Einspeisung Monatswerte 2025, Ø 6,75 ct) · Kontrolle K9 bestanden: Szenario S0 trifft die tatsächliche Verteilung',
    'der HALLAG in jeder Viertelstunde und für jedes Top auf ±2 Wh.', '',
    'In dieser Etappe ändert sich **nur die Verteilung** – Wärmepumpe, Heizpatrone und Überschuss bleiben wie gemessen',
    `(${de(r0.summe.ueberschuss)} kWh Überschuss 2025).`, '');

  // ---- Übersicht
  L.push('## Überblick', '',
    '| Szenario | von Tops genutzt | Änderung | Restüberschuss | Ersparnis Tops | Einspeisevergütung | **Haus gesamt** | Änderung |',
    '|---|---:|---:|---:|---:|---:|---:|---:|');
  const haus = r => r.summe.ersparnis_tops + r.hauskasse.einspeisung;
  for (const x of erg) {
    const r = x.r;
    L.push(`| ${x.name} | ${de(r.summe.genutzt)} kWh | ${vz(r.summe.genutzt - r0.summe.genutzt)} kWh | ${de(r.summe.rest)} kWh | ` +
      `${de(r.summe.ersparnis_tops)} € | ${de(r.hauskasse.einspeisung)} € | **${de(haus(r))} €** | ${vz(haus(r) - haus(r0))} € |`);
  }
  L.push('', '*Haus gesamt* = was die Tops beim Netzbezug sparen + was die Hauskasse für den Restüberschuss bekommt. ' +
    'Der interne PV-Preis ändert diese Summe nicht – er verschiebt nur Geld zwischen Tops und Hauskasse.', '');

  // ---- Grenze: was wäre maximal möglich?
  let viertel = 0, alleVoll = 0;
  for (let i = 0; i < d2025.zeit.length; i++) {
    if (d2025.einspeisung[i] <= 0) continue;
    viertel++;
    if (r2.details.rest[i] > 0.5) alleVoll++;
  }
  const verbrauchTops = T.reduce((a, t) => a + r0.tops[t].bedarf, 0);
  L.push('## Warum nicht mehr?', '',
    `Dynamisch ist das **Maximum**, das ohne Batterie und ohne Verbrauchsverschiebung möglich ist: in jeder Viertelstunde ` +
    `bekommen die Tops so viel, wie sie gerade verbrauchen – solange Überschuss da ist.`, '',
    `- In ${de(alleVoll)} von ${de(viertel)} Viertelstunden mit Überschuss (${pct(alleVoll, viertel)}) ` +
    `ist der Bedarf **aller** Tops gedeckt und es bleibt trotzdem Überschuss übrig.`,
    `- Selbst dynamisch gehen ${de(r2.summe.rest)} kWh (${pct(r2.summe.rest, r2.summe.ueberschuss)} des Überschusses) ins Netz – ` +
    `der Überschuss fällt vor allem mittags an, wenn in den Wohnungen wenig verbraucht wird.`,
    `- Von ${de(verbrauchTops)} kWh Verbrauch der Tops (der für die Verteilung zählt) können dynamisch ` +
    `${pct(r2.summe.genutzt, verbrauchTops)} aus der PV gedeckt werden (fix: ${pct(r0.summe.genutzt, verbrauchTops)}).`, '');

  // ---- je Top
  L.push('## Je Top: fix (S0) vs. dynamisch (S2)', '',
    '| Top | Verbrauch | genutzt fix | genutzt dynamisch | Änderung | PV-Anteil am Verbrauch fix → dyn. | Ersparnis fix | Ersparnis dyn. | Änderung |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const t of T) {
    const a = r0.tops[t], b = r2.tops[t];
    L.push(`| ${t} | ${de(a.verbrauch)} | ${de(a.genutzt)} | ${de(b.genutzt)} | ${vz(b.genutzt - a.genutzt)} kWh | ` +
      `${pct(a.genutzt, a.verbrauch)} → ${pct(b.genutzt, b.verbrauch)} | ${de(a.ersparnis)} € | ${de(b.ersparnis)} € | ${vz(b.ersparnis - a.ersparnis)} € |`);
  }
  L.push(`| **Σ** | | **${de(r0.summe.genutzt)}** | **${de(r2.summe.genutzt)}** | **${vz(r2.summe.genutzt - r0.summe.genutzt)} kWh** | | ` +
    `**${de(r0.summe.ersparnis_tops)} €** | **${de(r2.summe.ersparnis_tops)} €** | **${vz(r2.summe.ersparnis_tops - r0.summe.ersparnis_tops)} €** |`, '');

  // ---- Netto je Top bei internem PV-Preis
  L.push('## Wer gewinnt? Netto-Änderung je Top beim Wechsel fix → dynamisch', '',
    'Netto = Ersparnis beim Netzbezug − Zahlung an die Hauskasse (interner PV-Preis × genutzte kWh) + Anteil am',
    'Ergebnis der Hauskasse (interne Einnahmen + Einspeisevergütung, verteilt nach den 1.107 Anteilen).', '',
    'Spalte „0 ct“ entspricht dem heutigen Stand (die Tops zahlen nichts für den PV-Strom).', '');
  const preise = [0, 7, 12, 17, 22];
  L.push('| Top | ' + preise.map(p => `${p} ct`).join(' | ') + ' |', '|---|' + preise.map(() => '---:').join('|') + '|');
  const netto = {};
  for (const p of preise) {
    const a = K.kopie(SZENARIEN[0].s), b = K.kopie(SZENARIEN[2].s);
    a.preise.intern = b.preise.intern = p / 100;
    const ra = K.simuliere(d2025, a), rb = K.simuliere(d2025, b);
    netto[p] = Object.fromEntries(T.map(t => [t, rb.tops[t].netto - ra.tops[t].netto]));
    netto[p].hk = rb.hauskasse.summe - ra.hauskasse.summe;
  }
  for (const t of T) L.push(`| ${t} | ` + preise.map(p => `${vz(netto[p][t])} €`).join(' | ') + ' |');
  L.push('| *Änderung der Hauskasse (oben bereits anteilig enthalten)* | ' + preise.map(p => `${vz(netto[p].hk)} €`).join(' | ') + ' |',
    '| **Σ** | ' + preise.map(p => `**${vz(T.reduce((a, t) => a + netto[p][t], 0))} €**`).join(' | ') + ' |', '');

  // ---- Monate
  L.push('## Monate: von den Tops genutzt', '', '| Monat | Überschuss | fix | dynamisch | Änderung |', '|---|---:|---:|---:|---:|');
  for (let m = 1; m <= 12; m++) {
    const a = r0.monate[m], b = r2.monate[m];
    L.push(`| ${String(m).padStart(2, '0')} | ${de(a.ueberschuss)} | ${de(a.genutzt)} | ${de(b.genutzt)} | ${vz(b.genutzt - a.genutzt)} |`);
  }
  L.push('');

  // ---- Stabilität: letzte 12 Monate
  const d12 = K.zeitraum([d2025, lade(2026)], 202509010000, 202609010000);
  const x0 = K.simuliere(d12, SZENARIEN[0].s), x2 = K.simuliere(d12, SZENARIEN[2].s);
  L.push('## Gegenprobe: letzte 12 Monate (Sep 2025 – Aug 2026)', '',
    '| | fix | dynamisch | Änderung |', '|---|---:|---:|---:|',
    `| von Tops genutzt | ${de(x0.summe.genutzt)} kWh | ${de(x2.summe.genutzt)} kWh | ${vz(x2.summe.genutzt - x0.summe.genutzt)} kWh |`,
    `| Haus gesamt | ${de(haus(x0))} € | ${de(haus(x2))} € | ${vz(haus(x2) - haus(x0))} € |`, '');
  return L.join('\n') + '\n';
}

const ziel = path.join(ROOT, 'simulation', 'ausgabe', 'etappe2_verteilung.md');
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, bericht());
console.log('→', path.relative(ROOT, ziel));
