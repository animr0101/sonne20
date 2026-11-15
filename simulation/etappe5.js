// Etappe 5 – Wirtschaftlichkeit und Geldflüsse je Top.
// Aufruf:  node simulation/etappe5.js     →  simulation/ausgabe/etappe5_wirtschaftlichkeit.md
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('./kern.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const lade = j => JSON.parse(fs.readFileSync(path.join(ROOT, 'simulation', 'daten', `jahr_${j}.json`), 'utf8'));
const D = lade(2025);
const T = K.TOPS;
const W = CFG.wirtschaftlichkeit;

const de = (x, nk = 0) => {
  const r = Math.round(x * 10 ** nk) / 10 ** nk;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk });
};
const vz = (x, nk = 0) => (Math.round(x * 10 ** nk) > 0 ? '+' : '') + de(x, nk);

// ---------------------------------------------------------------- Pakete
function paket(name, { modell = 'statisch', hpHinten = false, batt = null, tf10 = null } = {}) {
  const s = K.ausKonfiguration(CFG);
  s.verteilung.modell = modell;
  s.reihenfolge = hpHinten ? ['tops', 'heizpatrone'] : ['heizpatrone', 'tops'];
  if (batt) { s.batterie = K.batterie({ kapazitaet_kwh: batt, leistung_kw: 5 }); s.reihenfolge = K.REIHENFOLGEN.tops_batterie_heizpatrone; }
  if (tf10 !== null) s.verteilung.teilnahme['10'] = tf10;
  return { name, s, batt };
}
const PAKETE = [
  paket('Heute: fix, Heizpatrone vor den Tops'),
  paket('A · dynamische Verteilung', { modell: 'dynamisch' }),
  paket('B · A + Heizpatrone hinter den Tops', { modell: 'dynamisch', hpHinten: true }),
  paket('C · B + Batterie 10 kWh', { modell: 'dynamisch', hpHinten: true, batt: 10 }),
];

// Annuität: jährliche Rate einer Investition über die Lebensdauer
const annuitaet = (inv, jahre = W.lebensdauer_jahre, z = W.zinssatz_prozent / 100) => inv * z / (1 - (1 + z) ** -jahre);

/**
 * Jahresergebnis je Top bei internem PV-Preis p (€/kWh). Linear in p, daher aus einem Lauf berechenbar:
 *   netto_t = Ersparnis_t − genutzt_t·p + Anteil_t·(p·Σgenutzt + Einspeisung − Allgemeinstrom − Batterie-Rate)
 * Ersparnis = vermiedener Netzbezug der Tops (bewertet zum Wohnungstarif).
 */
function nettoFunktion(r, s, investJahr = 0) {
  const sumE = T.reduce((a, t) => a + r.tops[t].genutzt, 0);
  return p => {
    const hk = p * sumE + r.hauskasse.einspeisung - r.hauskasse.allgemeinstrom - investJahr;
    const out = { hauskasse: hk };
    for (const t of T) out[t] = r.tops[t].ersparnis - r.tops[t].genutzt * p + s.anteile[t] * hk;
    return out;
  };
}

function rechne(daten = D, preisFaktor = 1, einspFaktor = 1, invest = 700) {
  return PAKETE.map(pk => {
    const s = K.kopie(pk.s);
    if (pk.s.batterie) s.batterie = pk.s.batterie;
    for (const k of ['bezug_top', 'bezug_top_snap', 'bezug_allg']) s.preise[k] *= preisFaktor;
    for (const m in s.preise.einspeisung_monat) s.preise.einspeisung_monat[m] *= einspFaktor;
    const r = K.simuliere(daten, s);
    const investJahr = pk.batt ? annuitaet(pk.batt * invest) : 0;
    return { ...pk, r, s, investJahr, netto: nettoFunktion(r, s, investJahr) };
  });
}

function bericht() {
  const L = [];
  const erg = rechne();
  const heute = erg[0];
  const heute0 = heute.netto(0);
  const p = K.ausKonfiguration(CFG).preise;

  L.push('# Etappe 5 – Wirtschaftlichkeit: wer gewinnt wie viel?', '',
    'Referenzjahr **2025** · alle Beträge **brutto pro Jahr** · nur arbeitsabhängige Stromkosten (Grund- und Messpreise ändern sich nicht).', '',
    '**So wird gerechnet:**', '',
    `- Jedes Top spart für jede kWh PV-Strom den Wohnungstarif (${de(p.bezug_top * 100, 2)} ct, im SNAP-Fenster ${de(p.bezug_top_snap * 100, 2)} ct)`,
    '  und zahlt dafür den **internen PV-Preis** an die Hauskasse (heute: 0 ct).',
    `- Die **Hauskasse** bekommt den internen PV-Preis und die Einspeisevergütung für den Restüberschuss und zahlt den Allgemeinstrom (${de(p.bezug_allg * 100, 2)} ct)`,
    '  – bei Paket C auch die Batterie (als jährliche Rate).',
    '- Das Ergebnis der Hauskasse fließt nach den **1.107 Anteilen** an die Eigentümer zurück (bzw. senkt deren Betriebskosten).',
    `- Batterie: 10 kWh, **Preis-Platzhalter 700 €/kWh** = 7.000 €, als Rate über ${W.lebensdauer_jahre} Jahre bei ${W.zinssatz_prozent} % Zins = ` +
    `${de(annuitaet(7000))} €/Jahr.`, '');

  // ---------------------------------------------------------- 1. Haus gesamt
  L.push('## 1. Das ganze Haus', '', '| Paket | PV von Tops genutzt | Allgemeinstrom (Netz) | Restüberschuss | Stromkosten Haus | **Vorteil/Jahr** |',
    '|---|---:|---:|---:|---:|---:|');
  for (const x of erg) {
    const r = x.r, kost = r.kosten.haus + x.investJahr;
    L.push(`| ${x.name} | ${de(r.summe.genutzt)} kWh | ${de(r.summe.bezug_allg)} kWh | ${de(r.summe.rest)} kWh | ${de(kost)} € | **${vz(heute.r.kosten.haus - kost)} €** |`);
  }
  L.push('', 'Stromkosten Haus = Allgemeinstrom + Netzbezug aller Tops − Einspeisevergütung (+ Batterie-Rate). ' +
    'Der interne PV-Preis ändert diese Summe nicht.', '');

  // ---------------------------------------------------------- 2. Je Top: Vorschlag vs. heute
  for (const idx of [2, 3]) {
    const x = erg[idx];
    L.push(`## ${idx === 2 ? '2' : '3'}. Was ändert sich für jedes Top? – ${x.name}`, '',
      'Änderung pro Jahr gegenüber **heute** (fix, Heizpatrone vor den Tops, Tops zahlen nichts für PV-Strom). ' +
      'Positiv = das Top steht besser da (eigene Stromrechnung + Anteil an der Hauskasse).', '');
    const preise = [0, 5, 7, 10, 12, 15];
    L.push('| Top | Anteile | ' + preise.map(c => `interner Preis ${c} ct`).join(' | ') + ' |', '|---|---:|' + preise.map(() => '---:').join('|') + '|');
    const werte = preise.map(c => x.netto(c / 100));
    for (const t of T) {
      L.push(`| ${t} | ${CFG.haus.anteile_1107[t]} | ` + werte.map(w => `${vz(w[t] - heute0[t])} €`).join(' | ') + ' |');
    }
    L.push('| **Σ alle Tops** | 1.107 | ' + werte.map(w => `**${vz(T.reduce((a, t) => a + w[t] - heute0[t], 0))} €**`).join(' | ') + ' |',
      '| *davon über die Hauskasse* | | ' + werte.map(w => `${vz(w.hauskasse - heute0.hauskasse)} €`).join(' | ') + ' |', '');

    // Faire Preisspanne: alle Tops ≥ 0
    let von = null, bis = null;
    for (let c = 0; c <= 30.001; c += 0.25) {
      const w = x.netto(c / 100);
      const ok = T.every(t => w[t] - heute0[t] >= -0.5);
      if (ok && von === null) von = c;
      if (ok) bis = c;
    }
    L.push(von === null
      ? '**Es gibt keinen internen Preis, bei dem kein Top schlechter dasteht als heute.**'
      : (von === 0 && bis >= 30
        ? '**Bei jedem untersuchten internen PV-Preis (0–30 ct) steht kein Top schlechter da als heute.**'
        : `**Bei einem internen PV-Preis zwischen ${de(von, 2)} und ${de(bis, 2)} ct steht kein Top schlechter da als heute.**`));
    // Preis, bei dem der Vorteil am gleichmäßigsten nach Anteilen verteilt ist (kleinste Streuung von € je Anteil)
    let best = null;
    for (let c = 0; c <= 22.001; c += 0.25) {
      const w = x.netto(c / 100);
      const q = T.map(t => (w[t] - heute0[t]) / CFG.haus.anteile_1107[t]);
      const m = q.reduce((a, b) => a + b, 0) / q.length;
      const sd = Math.sqrt(q.reduce((a, b) => a + (b - m) ** 2, 0) / q.length);
      if (!best || sd < best.sd) best = { c, sd, m, min: Math.min(...q), max: Math.max(...q) };
    }
    L.push('', `Am **gleichmäßigsten nach Anteilen** verteilt sich der Vorteil bei **${de(best.c, 1)} ct**: ` +
      `jedes Top bekommt dann ${de(best.min, 2)}–${de(best.max, 2)} € je Anteil (Ø ${de(best.m, 2)} €, also z. B. Top 1 mit 108 Anteilen ` +
      `≈ ${de(best.m * 108)} €/Jahr).`, '');
  }
  L.push('Warum der Preis wichtig ist: Ohne internen Preis (0 ct) bekommen die Tops mit hohem Tagesverbrauch den Vorteil allein, ' +
    'während die Hauskasse Einspeisevergütung verliert – und die trifft alle nach Anteilen. Mit einem internen Preis fließt ein Teil ' +
    'des Vorteils über die Hauskasse an alle zurück.', '');

  // ---------------------------------------------------------- 4. Hauskasse
  L.push('## 4. Die Hauskasse bei 12 ct internem Preis', '',
    '| Paket | interne Einnahmen | Einspeisevergütung | Allgemeinstrom | Batterie-Rate | **Saldo** | Änderung zu heute (0 ct) |',
    '|---|---:|---:|---:|---:|---:|---:|');
  for (const x of erg) {
    const pInt = x === heute ? 0 : 0.12;
    const sumE = T.reduce((a, t) => a + x.r.tops[t].genutzt, 0);
    const saldo = x.netto(pInt).hauskasse;
    L.push(`| ${x.name}${x === heute ? ' (0 ct)' : ''} | ${de(sumE * pInt)} € | ${de(x.r.hauskasse.einspeisung)} € | −${de(x.r.hauskasse.allgemeinstrom)} € | ` +
      `${x.investJahr ? '−' + de(x.investJahr) + ' €' : '–'} | **${de(saldo)} €** | ${vz(saldo - heute0.hauskasse)} € |`);
  }
  L.push('');

  // ---------------------------------------------------------- 5. Batteriepreis
  L.push('## 5. Paket C: Wovon hängt die Batterie ab?', '',
    'Vorteil des ganzen Hauses pro Jahr (inkl. Batterie-Rate) – Paket B zum Vergleich: ' +
    `**${vz(heute.r.kosten.haus - erg[2].r.kosten.haus)} €**.`, '',
    '| Batteriepreis (brutto, inkl. Wechselrichter + Montage) | Investition | Rate/Jahr | Vorteil Paket C/Jahr | Batterie allein |',
    '|---:|---:|---:|---:|---:|');
  for (const inv of [400, 500, 600, 700, 800, 900, 1000]) {
    const rate = annuitaet(10 * inv), c = erg[3];
    const vorteil = heute.r.kosten.haus - c.r.kosten.haus - rate;
    const allein = erg[2].r.kosten.haus - c.r.kosten.haus - rate;
    L.push(`| ${inv} €/kWh | ${de(10 * inv)} € | ${de(rate)} € | ${vz(vorteil)} € | **${vz(allein)} €** |`);
  }
  L.push('', '„Batterie allein“ = was die Batterie zusätzlich zu Paket B bringt (Ersparnis minus Rate). Positiv = lohnt sich. ' +
    'Ohne Preissteigerung und Alterung gerechnet (die beiden heben sich bei 2 %/2 % ungefähr auf).', '');

  // ---------------------------------------------------------- 6. Empfindlichkeit
  L.push('## 6. Was, wenn sich die Strompreise ändern?', '',
    'Vorteil pro Jahr gegenüber heute (gleiche Preise in beiden Fällen).', '',
    '| Strompreis (Bezug) | Einspeisevergütung | Paket A | Paket B | Paket C (700 €/kWh) |', '|---|---|---:|---:|---:|');
  for (const [pf, ef, lbl1, lbl2] of [[0.7, 1, '−30 %', 'wie 2025'], [1, 1, 'wie 2025', 'wie 2025'], [1.3, 1, '+30 %', 'wie 2025'],
    [1, 0.5, 'wie 2025', '−50 %'], [1, 1.5, 'wie 2025', '+50 %'], [1.3, 0.5, '+30 %', '−50 %']]) {
    const e = rechne(D, pf, ef);
    const v = i => e[0].r.kosten.haus - e[i].r.kosten.haus - e[i].investJahr;
    L.push(`| ${lbl1} | ${lbl2} | ${vz(v(1))} € | ${vz(v(2))} € | ${vz(v(3))} € |`);
  }
  L.push('');

  // ---------------------------------------------------------- 7. Gegenprobe
  const d12 = K.zeitraum([D, lade(2026)], 202509010000, 202609010000);
  const e12 = rechne(d12);
  L.push('## 7. Gegenprobe mit den letzten 12 Monaten (Sep 2025 – Aug 2026)', '',
    '| Paket | Vorteil 2025 | Vorteil letzte 12 Monate |', '|---|---:|---:|');
  for (let i = 1; i < erg.length; i++) {
    L.push(`| ${erg[i].name} | ${vz(heute.r.kosten.haus - erg[i].r.kosten.haus - erg[i].investJahr)} € | ` +
      `${vz(e12[0].r.kosten.haus - e12[i].r.kosten.haus - e12[i].investJahr)} € |`);
  }
  L.push('');

  // ---------------------------------------------------------- 8. Top 10
  const tf = [null, 50, 100].map(x => {
    const pk = paket('', { modell: 'dynamisch', hpHinten: true, tf10: x });
    return K.simuliere(D, pk.s);
  });
  L.push('## 8. Zusatz: Teilnahmefaktor von Top 10 (Paket B)', '',
    '| Top 10 nimmt teil mit | PV von Tops genutzt | Vorteil Haus/Jahr gegenüber heute |', '|---|---:|---:|');
  [['17 % (heute)', tf[0]], ['50 %', tf[1]], ['100 %', tf[2]]].forEach(([l, r]) =>
    L.push(`| ${l} | ${de(r.summe.genutzt)} kWh | ${vz(heute.r.kosten.haus - r.kosten.haus)} € |`));
  L.push('', 'Liegt nicht in der Hand der Hausgemeinschaft (Top 10 ist zusätzlich in einer anderen Gemeinschaft).', '');
  return L.join('\n') + '\n';
}

const ziel = path.join(ROOT, 'simulation', 'ausgabe', 'etappe5_wirtschaftlichkeit.md');
fs.writeFileSync(ziel, bericht());
console.log('→', path.relative(ROOT, ziel));
