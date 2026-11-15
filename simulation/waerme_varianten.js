// Heizpatronen-Varianten, PV-Anhebung der Wärmepumpe und Batterie – gerechnet mit dem Puffermodell
// (Viertelstunden-Modell von Speicher und Wärmepumpen-Regelung) und zum Vergleich mit der einfachen Ersatzfaktor-Rechnung.
//
// Voraussetzung: python3 aufbereitung/waermemodell.py (schreibt das Modell in simulation/daten/jahr_*.json)
// Aufruf:  node simulation/waerme_varianten.js   →  simulation/ausgabe/waerme_varianten.md
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('./kern.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'simulation', 'daten', 'jahr_2025.json'), 'utf8'));
if (!D.waermemodell) throw new Error('Wärmemodell fehlt – zuerst python3 aufbereitung/waermemodell.py');
const ALLE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const de = (x, nk = 0) => x.toLocaleString('de-AT', { minimumFractionDigits: nk, maximumFractionDigits: nk });
const vz = (x, nk = 0) => (x > 0 ? '+' : x < 0 ? '−' : '±') + de(Math.abs(x), nk);

const W = CFG.wirtschaftlichkeit;
const faktor = (() => {
  let f = 0;
  const g = CFG.preise.preissteigerung_prozent_jahr / 100, a = CFG.batterie.alterung_prozent_jahr / 100, z = W.zinssatz_prozent / 100;
  for (let j = 1; j <= W.lebensdauer_jahre; j++) f += ((1 + g) * (1 - a)) ** (j - 1) / (1 + z) ** j;
  return f;
})();

const HP = {
  heute: null,
  aus: { aus_monate: ALLE },
  fenster: { aus_stunden: [11, 12, 13, 14] },
  reserve: { reserve_kw: 3 },
  schwelle: { schwelle_kw: 3 },
};
const ANH = { ab_kw: 3, plus_k: 8, max_c: 58, cop_minus_prozent_je_k: 2.5 };

function lauf({ modell = 'puffer', vt = 'dynamisch', hp = 'heute', anh = null, batt = 0, bv = 'allgemein' } = {}) {
  const s = K.ausKonfiguration(CFG);
  s.waerme.modell = modell; s.verteilung.modell = vt;
  if (HP[hp]) s.heizpatrone = HP[hp];
  s.waerme.pv_anhebung = anh;
  if (batt) {
    s.batterie = K.batterie({ kapazitaet_kwh: batt, leistung_kw: batt <= 10 ? 5 : 10, versorgt: bv });
    s.reihenfolge = K.REIHENFOLGEN.nach_tops;
  }
  return K.simuliere(D, s);
}

function bericht() {
  const L = ['# Heizpatrone, Wärmepumpe und Batterie – mit dem Puffermodell', '',
    `Erstellt ${new Date().toISOString().slice(0, 10)} · Referenzjahr 2025 · Preise wie in einstellungen.json, interner PV-Preis ${CFG.preise.interner_pv_preis_ct} ct · ` +
    'Modell: simulation/ausgabe/waermemodell.md', '',
    'Das Puffermodell ersetzt die gemessene Wärmepumpe durch die nachgebildete Regelung (Fühler in der Mitte, Start/Stopp je Außentemperatur, ' +
    'Tageszeit und Heizpatrone). Damit reagiert die Wärmepumpe in jeder Viertelstunde auf das, was die Heizpatrone (nicht) liefert. ' +
    'Vergleiche deshalb immer mit dem Modelllauf „heute“, nicht mit der Messung.', ''];

  // Modellgüte
  const mh = lauf({ vt: 'statisch' });
  const mess = k => D[k].reduce((a, b) => a + b, 0) / 1000;
  L.push('## Modell „heute“ gegen Messung 2025', '', '| | Messung | Modell | Abweichung |', '|---|---:|---:|---:|');
  for (const [n, m, x] of [['Netzbezug Allgemein', mess('bezug_allg'), mh.summe.bezug_allg], ['Einspeisung', mess('rest'), mh.summe.rest],
    ['Wärmepumpenstrom', mess('wp'), mh.waerme.wp_modell], ['Heizpatrone', mess('heizpatrone'), mh.waerme.heizpatrone]]) {
    L.push(`| ${n} | ${de(m)} kWh | ${de(x)} kWh | ${vz((x / m - 1) * 100, 1)} % |`);
  }
  L.push('', 'Das Modell lässt die Wärmepumpe etwas seltener in der Sonnenzeit laufen als in Wirklichkeit (25 % statt 27 % des WP-Stroms ' +
    'zwischen 9 und 17 Uhr) – daher etwas mehr Netzbezug und Einspeisung. Für Vergleiche von Varianten spielt dieser gleichbleibende Versatz kaum eine Rolle.', '');

  // Heizpatronen-Varianten
  const V = [
    ['fix, Heizpatrone wie heute', { vt: 'statisch' }],
    ['fix, Heizpatrone aus (nur Notheizung)', { vt: 'statisch', hp: 'aus' }],
    ['dynamisch, Heizpatrone wie heute', {}],
    ['dynamisch, Heizpatrone 11–15 Uhr gesperrt', { hp: 'fenster' }],
    ['dynamisch, Heizpatrone erst ab 3 kW (Schwelle)', { hp: 'schwelle' }],
    ['dynamisch, 3 kW Reserve für die Wohnungen', { hp: 'reserve' }],
    ['dynamisch, Heizpatrone aus', { hp: 'aus' }],
    ['dynamisch, Heizpatrone aus + PV-Anhebung WP', { hp: 'aus', anh: ANH }],
    ['dynamisch, 3 kW Reserve + PV-Anhebung WP', { hp: 'reserve', anh: ANH }],
  ];
  const basis = { puffer: mh, ersatzfaktor: lauf({ modell: 'ersatzfaktor', vt: 'statisch' }) };
  L.push('## Varianten Heizpatrone und Verteilung (pro Jahr, gegenüber heute)', '',
    '| Variante | Heizpatrone | WP-Strom | Starts/Tag | Netzbezug Allg. | Einspeisung | Wohnungen nutzen | **Vorteil Haus** | einfache Rechnung (bisher) |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [n, o] of V) {
    const r = lauf(o), e = lauf({ ...o, modell: 'ersatzfaktor', anh: null });
    const v = basis.puffer.kosten.haus - r.kosten.haus, ve = basis.ersatzfaktor.kosten.haus - e.kosten.haus;
    L.push(`| ${n} | ${de(r.waerme.heizpatrone)} kWh | ${vz(r.waerme.wp_modell - mh.waerme.wp_modell)} kWh | ${de(r.waerme.starts / 365, 1)} | ` +
      `${vz(r.summe.bezug_allg - mh.summe.bezug_allg)} kWh | ${vz(r.summe.rest - mh.summe.rest)} kWh | ${vz(r.summe.genutzt - mh.summe.genutzt)} kWh | ` +
      `**${vz(v)} €** | ${o.anh ? '–' : vz(ve) + ' €'} |`);
  }
  L.push('', '„Vorteil Haus“ = geringere arbeitsabhängige Stromkosten aller Wohnungen und Allgemein zusammen, abzüglich entgangener Einspeisevergütung (brutto). ' +
    '„PV-Anhebung WP“: bei mehr als 3 kW Überschuss schaltet die Wärmepumpe 8 K höher (Stopp höchstens 58 °C am Fühler), Arbeitszahl −2,5 % je Kelvin darüber – ' +
    'nur wirksam, wenn die Wärmepumpe das Signal auch befolgt (heute nicht der Fall).', '');

  // Batterie
  L.push('## Batterie (AC, Laden nur aus dem Rest nach den Wohnungen)', '',
    `Barwertfaktor ${de(faktor, 1)} (${W.lebensdauer_jahre} Jahre, ${W.zinssatz_prozent} % Zins, Strom +${CFG.preise.preissteigerung_prozent_jahr} %/Jahr, Alterung −${CFG.batterie.alterung_prozent_jahr} %/Jahr). ` +
    '„lohnt bis“ = höchster Preis je kWh Speicher (inkl. Einbau), bei dem sie sich über die Lebensdauer gerade bezahlt macht.', '',
    '| Heizpatrone | Batterie | versorgt | entladen | Vollzyklen | **Ersparnis/Jahr** | **lohnt bis** | einfache Rechnung (bisher) |',
    '|---|---:|---|---:|---:|---:|---:|---:|');
  for (const [hn, ho] of [['wie heute', {}], ['3 kW Reserve', { hp: 'reserve' }], ['aus', { hp: 'aus' }], ['aus + PV-Anhebung', { hp: 'aus', anh: ANH }]]) {
    const o0 = lauf(ho), e0 = lauf({ ...ho, modell: 'ersatzfaktor', anh: null });
    for (const batt of [5, 10, 15, 20]) for (const bv of ['allgemein', 'allgemein_und_tops']) {
      if (batt !== 10 && bv !== 'allgemein') continue;
      const r = lauf({ ...ho, batt, bv }), e = lauf({ ...ho, modell: 'ersatzfaktor', anh: null, batt, bv });
      const sp = o0.kosten.haus - r.kosten.haus, spe = e0.kosten.haus - e.kosten.haus;
      L.push(`| ${hn} | ${batt} kWh | ${bv === 'allgemein' ? 'Allgemein' : 'Allgemein + Wohnungen'} | ${de(r.batterie.entladung)} kWh | ` +
        `${de(r.batterie.vollzyklen)} | **${de(sp)} €** | **${de(sp * faktor / batt)} €/kWh** | ${ho.anh ? '–' : de(spe * faktor / batt) + ' €/kWh'} |`);
    }
  }
  L.push('', 'Ergebnis: Mit dem genaueren Wärmemodell ändert sich der Wert einer Batterie kaum (±10 %). ' +
    'Die Heizpatrone auszuschalten bleibt die beste Einzelmaßnahme, der Vorteil ist aber etwas kleiner als in der einfachen Rechnung.', '');
  return L.join('\n') + '\n';
}

const ziel = path.join(ROOT, 'simulation', 'ausgabe', 'waerme_varianten.md');
fs.writeFileSync(ziel, bericht());
console.log(fs.readFileSync(ziel, 'utf8'));
