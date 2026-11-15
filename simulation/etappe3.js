// Etappe 3 – Heizpatrone, Wärmepumpe, Batteriespeicher.
// Aufruf:  node simulation/etappe3.js     →  simulation/ausgabe/etappe3_heizpatrone_batterie.md
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('./kern.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const lade = j => JSON.parse(fs.readFileSync(path.join(ROOT, 'simulation', 'daten', `jahr_${j}.json`), 'utf8'));
const D = lade(2025);

const de = (x, nk = 0) => {
  const r = Math.round(x * 10 ** nk) / 10 ** nk;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk });
};
const vz = (x, nk = 0) => (Math.round(x * 10 ** nk) > 0 ? '+' : '') + de(x, nk);

// ---------------------------------------------------------------- Szenario-Bausteine
const basis = (modell = 'statisch') => { const s = K.ausKonfiguration(CFG); s.verteilung.modell = modell; return s; };
const ersatz = (s, x) => { if (x !== null) for (const m in s.waerme.ersatz_monat) s.waerme.ersatz_monat[m] = x; return s; };
const mitBatt = (s, kwh, kw, extra = {}) => {
  s.batterie = K.batterie({ kapazitaet_kwh: kwh, leistung_kw: kw, wirkungsgrad_prozent: CFG.batterie.wirkungsgrad_prozent,
    standby_w: CFG.batterie.standby_w, ...extra });
  return s;
};
const lauf = s => K.simuliere(D, s);

// Wirtschaftlichkeit: Barwertfaktor über die Lebensdauer (Preissteigerung, Alterung, Zins)
const W = CFG.wirtschaftlichkeit;
const faktor = (() => {
  let f = 0;
  const g = CFG.preise.preissteigerung_prozent_jahr / 100, a = CFG.batterie.alterung_prozent_jahr / 100, z = W.zinssatz_prozent / 100;
  for (let j = 1; j <= W.lebensdauer_jahre; j++) f += ((1 + g) * (1 - a)) ** (j - 1) / (1 + z) ** j;
  return f;
})();

function bericht() {
  const L = [];
  const r0 = lauf(basis('statisch')), rd = lauf(basis('dynamisch'));
  const spar = (r, ref = r0) => ref.kosten.haus - r.kosten.haus;   // € pro Jahr, positiv = günstiger

  L.push('# Etappe 3 – Heizpatrone, Wärmepumpe und Batteriespeicher', '',
    'Referenzjahr **2025** · Preise brutto · Ergebnisse als **arbeitsabhängige Stromkosten des ganzen Hauses**',
    '(Allgemeinstrom + Netzbezug aller Tops − Einspeisevergütung für den Restüberschuss; Grund- und Messpreise bleiben gleich).', '',
    `Heute (S0): **${de(r0.kosten.haus)} €/Jahr** = Allgemeinstrom ${de(r0.kosten.allgemeinstrom)} € + Tops ${de(r0.kosten.tops)} € − ` +
    `Einspeisung ${de(r0.kosten.einspeisung)} €.`, '',
    '**Annahmen Wärme:** COP der Wärmepumpe 3,5 · Ersatzfaktor der Heizpatrone (Anteil ihrer Wärme, den sonst die',
    'Wärmepumpe liefern müsste) Okt–Apr 0,6 / Mai–Sep 0,2 – aus den Daten geschätzt, aber unsicher; daher immer auch mit 0 und 1 gerechnet.',
    'Fehlende Heizpatronen-Wärme heizt die Wärmepumpe bei ihren nächsten Läufen nach – aus PV, wenn gerade Überschuss da ist, sonst aus dem Netz.', '');

  // ---------------------------------------------------------- 1. Heizpatrone
  L.push('## 1. Heizpatrone hinter die Tops (Smartfox-Einstellung, keine Investition)', '',
    'Heute bekommt die Heizpatrone den Überschuss **vor** den Tops. Umgestellt bekommt sie nur, was die Tops gerade nicht brauchen.', '',
    '| Verteilung | Ersatzfaktor | Heizpatrone | Tops nutzen | Wärmepumpe heizt nach | davon aus Netz* | **Ersparnis Haus/Jahr** |',
    '|---|---|---:|---:|---:|---:|---:|');
  for (const modell of ['statisch', 'dynamisch']) {
    const ref = modell === 'statisch' ? r0 : rd;
    for (const [lbl, x] of [['0 (Wärme wäre nicht gebraucht worden)', 0], ['Standard (0,6 / 0,2)', null], ['1 (jede kWh ersetzt Wärmepumpe)', 1]]) {
      const s = ersatz(basis(modell), x); s.reihenfolge = ['tops', 'heizpatrone'];
      const r = lauf(s);
      const netzMehr = r.summe.bezug_allg - ref.summe.bezug_allg;
      L.push(`| ${modell === 'statisch' ? 'fix' : 'dynamisch'} | ${lbl} | ${de(r.waerme.heizpatrone)} kWh (${vz(r.waerme.heizpatrone - ref.waerme.heizpatrone)}) | ` +
        `${de(r.summe.genutzt)} kWh (${vz(r.summe.genutzt - ref.summe.genutzt)}) | ${de(r.waerme.wp_nachheizen)} kWh | ${vz(netzMehr)} kWh | **${vz(spar(r, ref))} €** |`);
    }
  }
  L.push('', '\\* Mehr Netzbezug am Allgemeinzähler durch das Nachheizen (Rest kommt aus PV-Überschuss).',
    'Ersparnis jeweils gegenüber derselben Verteilung mit Heizpatrone vor den Tops.', '');

  // ---------------------------------------------------------- 2. Batterie Größen
  L.push('## 2. Batteriespeicher – welche Größe?', '',
    'Batterie am Allgemeinzähler (AC-gekoppelt, Wirkungsgrad 90 %, Eigenverbrauch 20 W), lädt **nur aus dem Restüberschuss**',
    '(nach Heizpatrone und Tops), entlädt für den **Allgemeinstrom** (v. a. Wärmepumpe). Verteilung **dynamisch** angenommen.', '',
    `**Wirtschaftlichkeit:** Barwert über ${W.lebensdauer_jahre} Jahre (Zins ${W.zinssatz_prozent} %, Strompreis +${CFG.preise.preissteigerung_prozent_jahr} %/Jahr, ` +
    `Alterung −${CFG.batterie.alterung_prozent_jahr} %/Jahr) = Ersparnis × ${de(faktor, 1)}. ` +
    '„Lohnt bis“ = höchster Preis pro kWh Speicher (brutto, inkl. Batteriewechselrichter und Montage), bei dem sich die Batterie über die Lebensdauer gerade bezahlt macht.', '',
    '| Kapazität | Leistung | entladen | Vollzyklen | Tage voll geladen | Tage leer gelaufen | Netzbezug Allg. | **Ersparnis/Jahr** | lohnt bis | Amortisation bei 700 €/kWh |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const kurve = [];
  for (const kwh of [5, 10, 15, 20, 30, 40]) {
    for (const kw of [5, 10]) {
      if (kw > kwh * 1.01 && kwh < 10) continue;
      const r = lauf(mitBatt(basis('dynamisch'), kwh, kw));
      const sp = spar(r, rd), b = r.batterie;
      const lohnt = sp * faktor / kwh;
      const amort = sp > 0 ? (700 * kwh) / sp : Infinity;
      kurve.push({ kwh, kw, sp });
      L.push(`| ${kwh} kWh | ${kw} kW | ${de(b.entladung)} kWh | ${de(b.vollzyklen)} | ${de(b.tage_voll)} | ${de(b.tage_leer)} | ` +
        `${vz(r.summe.bezug_allg - rd.summe.bezug_allg)} kWh | **${de(sp)} €** | ${de(lohnt)} €/kWh | ${amort > 40 ? '> 40 Jahre' : de(amort, 1) + ' Jahre'} |`);
    }
  }
  L.push('');

  // Monatsverlauf 10 kWh
  const r10 = lauf(mitBatt(basis('dynamisch'), 10, 5));
  L.push('### Wann arbeitet die Batterie? (10 kWh / 5 kW, dynamisch)', '',
    '| Monat | Netzbezug Allg. ohne | mit Batterie | eingespart |', '|---|---:|---:|---:|');
  for (let m = 1; m <= 12; m++) {
    const a = rd.monate[m].bezug_allg, b = r10.monate[m].bezug_allg;
    L.push(`| ${String(m).padStart(2, '0')} | ${de(a)} kWh | ${de(b)} kWh | ${de(a - b)} kWh |`);
  }
  L.push('');

  // ---------------------------------------------------------- 3. Wovon lädt die Batterie?
  L.push('## 3. Wovon soll die Batterie laden? (10 kWh / 5 kW, dynamisch)', '',
    'Wichtig für eine faire Bewertung: Ändert sich mit der Batterie auch die Reihenfolge von Heizpatrone und Tops, ' +
    'so ist ein Teil der Ersparnis **nicht der Batterie zu verdanken**, sondern der Umstellung – und die gibt es auch ohne Batterie. ' +
    'Die Spalte „durch die Batterie“ vergleicht daher immer mit derselben Reihenfolge **ohne** Batterie.', '',
    '| Reihenfolge | Heizpatrone | Tops nutzen | entladen | WP heizt nach | Ersparnis gesamt | davon Umstellung (ohne Batterie) | **davon durch die Batterie** | Batterie, Ersatzfaktor 1 | lohnt bis |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const namen = { nach_tops: 'nur Restüberschuss (nach Heizpatrone und Tops)', vor_tops: 'vor den Tops (nach Heizpatrone)',
    vor_heizpatrone: 'vor Heizpatrone und Tops', tops_batterie_heizpatrone: '**Tops → Batterie → Heizpatrone**' };
  const ohneBatt = (reihe, x = null) => { const s = ersatz(basis('dynamisch'), x); s.reihenfolge = reihe.filter(z => z !== 'batterie'); return lauf(s); };
  for (const [k, reihe] of Object.entries(K.REIHENFOLGEN)) {
    const s = mitBatt(basis('dynamisch'), 10, 5); s.reihenfolge = reihe;
    const s1 = ersatz(mitBatt(basis('dynamisch'), 10, 5), 1); s1.reihenfolge = reihe;
    const r = lauf(s), r1 = lauf(s1), ref = ohneBatt(reihe), ref1 = ohneBatt(reihe, 1);
    const batt = spar(r, ref);
    L.push(`| ${namen[k]} | ${de(r.waerme.heizpatrone)} kWh | ${de(r.summe.genutzt)} kWh | ${de(r.batterie.entladung)} kWh | ` +
      `${de(r.waerme.wp_nachheizen)} kWh | ${vz(spar(r, rd))} € | ${vz(spar(ref, rd))} € | **${vz(batt)} €** | ${vz(spar(r1, ref1))} € | ${de(batt * faktor / 10)} €/kWh |`);
  }
  L.push('', 'Ersparnis gesamt gegenüber „dynamisch, ohne Batterie, Heizpatrone vor den Tops“. Wenn die Batterie vor der Heizpatrone lädt, ' +
    'bekommt sie auch im Winter Strom – sonst bleibt nach der Heizpatrone kaum Restüberschuss.', '');

  // Größen mit der besten Reihenfolge
  const refHP = ohneBatt(K.REIHENFOLGEN.tops_batterie_heizpatrone), refHP1 = ohneBatt(K.REIHENFOLGEN.tops_batterie_heizpatrone, 1);
  L.push('### Größen mit Reihenfolge Tops → Batterie → Heizpatrone (dynamisch)', '',
    `Ersparnis **durch die Batterie** = gegenüber dynamisch mit Heizpatrone hinter den Tops, ohne Batterie ` +
    `(diese Umstellung allein bringt schon ${de(spar(refHP, rd))} €/Jahr).`, '',
    '| Kapazität | Leistung | entladen | Vollzyklen | Heizpatrone | WP heizt nach | **Ersparnis durch Batterie/Jahr** | mit Ersatzfaktor 1 | lohnt bis | Amortisation bei 700 €/kWh |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [kwh, kw] of [[5, 5], [10, 5], [10, 10], [15, 10], [20, 10], [30, 10]]) {
    const s = mitBatt(basis('dynamisch'), kwh, kw); s.reihenfolge = K.REIHENFOLGEN.tops_batterie_heizpatrone;
    const s1 = ersatz(mitBatt(basis('dynamisch'), kwh, kw), 1); s1.reihenfolge = K.REIHENFOLGEN.tops_batterie_heizpatrone;
    const r = lauf(s), r1 = lauf(s1), sp = spar(r, refHP), amort = 700 * kwh / sp;
    L.push(`| ${kwh} kWh | ${kw} kW | ${de(r.batterie.entladung)} kWh | ${de(r.batterie.vollzyklen)} | ${de(r.waerme.heizpatrone)} kWh | ` +
      `${de(r.waerme.wp_nachheizen)} kWh | **${de(sp)} €** | ${de(spar(r1, refHP1))} € | ${de(sp * faktor / kwh)} €/kWh | ${amort > 40 ? '> 40 Jahre' : de(amort, 1) + ' Jahre'} |`);
  }
  L.push('');

  // ---------------------------------------------------------- 4. Auch die Tops versorgen?
  L.push('## 4. Darf die Batterie auch die Tops versorgen? (⚠️ rechtlich zu prüfen)', '',
    '| Batterie | versorgt | entladen | davon an Tops | Vollzyklen | **Ersparnis/Jahr** |', '|---|---|---:|---:|---:|---:|');
  for (const kwh of [10, 20]) {
    for (const v of ['allgemein', 'allgemein_und_tops']) {
      const r = lauf(mitBatt(basis('dynamisch'), kwh, kwh >= 10 ? 10 : 5, { versorgt: v }));
      L.push(`| ${kwh} kWh / ${kwh >= 10 ? 10 : 5} kW | ${v === 'allgemein' ? 'nur Allgemeinstrom' : 'Allgemeinstrom + Tops'} | ${de(r.batterie.entladung)} kWh | ` +
        `${de(r.summe.entladung_tops)} kWh | ${de(r.batterie.vollzyklen)} | **${de(spar(r, rd))} €** |`);
    }
  }
  L.push('');

  // ---------------------------------------------------------- 5. Kombinationen
  L.push('## 5. Alles zusammen – was bringt welcher Schritt?', '',
    'Jede Zeile gegenüber heute. Die Batterie-Zeilen enthalten die Schritte darüber (dynamisch, Heizpatrone hinter den Tops).', '',
    '| Schritt | Kosten Haus/Jahr | Ersparnis gegenüber heute | Investition |', '|---|---:|---:|---|');
  const kombi = [
    ['Heute (fix, Heizpatrone vor Tops)', basis('statisch'), '–'],
    ['+ dynamische Verteilung', basis('dynamisch'), 'keine'],
    ['+ Heizpatrone hinter die Tops', (() => { const s = basis('dynamisch'); s.reihenfolge = ['tops', 'heizpatrone']; return s; })(), 'keine (Smartfox)'],
    ['+ Batterie 10 kWh / 5 kW, lädt nur aus Restüberschuss', (() => { const s = mitBatt(basis('dynamisch'), 10, 5); s.reihenfolge = ['tops', 'heizpatrone', 'batterie']; return s; })(), 'ca. 7.000 € (Platzhalter)'],
    ['+ statt dessen 20 kWh / 10 kW, nur aus Restüberschuss', (() => { const s = mitBatt(basis('dynamisch'), 20, 10); s.reihenfolge = ['tops', 'heizpatrone', 'batterie']; return s; })(), 'ca. 14.000 € (Platzhalter)'],
    ['+ Batterie 10 kWh / 5 kW, lädt **vor** der Heizpatrone (Tops → Batterie → Heizpatrone)', (() => { const s = mitBatt(basis('dynamisch'), 10, 5); s.reihenfolge = K.REIHENFOLGEN.tops_batterie_heizpatrone; return s; })(), 'ca. 7.000 € (Platzhalter)'],
    ['+ statt dessen 20 kWh / 10 kW, lädt vor der Heizpatrone', (() => { const s = mitBatt(basis('dynamisch'), 20, 10); s.reihenfolge = K.REIHENFOLGEN.tops_batterie_heizpatrone; return s; })(), 'ca. 14.000 € (Platzhalter)'],
  ];
  for (const [name, s, inv] of kombi) {
    const r = lauf(s);
    L.push(`| ${name} | ${de(r.kosten.haus)} € | ${vz(spar(r))} € | ${inv} |`);
  }
  L.push('', 'Hinweis: Mit der Heizpatrone hinter den Tops bekommt eine Batterie, die aus dem Restüberschuss lädt, ' +
    'die Energie, die vorher in die Heizpatrone ging – die Batterie konkurriert dann wieder mit der Heizpatrone.', '');
  return L.join('\n') + '\n';
}

const ziel = path.join(ROOT, 'simulation', 'ausgabe', 'etappe3_heizpatrone_batterie.md');
fs.writeFileSync(ziel, bericht());
console.log('→', path.relative(ROOT, ziel));
