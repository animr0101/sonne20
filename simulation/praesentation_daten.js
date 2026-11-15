// Erzeugt die Daten für die Präsentation: alle Kombinationen der Schieberegler vorab gerechnet,
// nur zusammengefasste Werte (keine Viertelstunden-Profile einzelner Wohnungen).
// Energiemengen hängen nicht von den Preisen ab – die Präsentation rechnet Preise daher selbst darauf.
//
// Aufruf:  node simulation/praesentation_daten.js     →  praesentation/daten.json
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('./kern.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'simulation', 'daten', 'jahr_2025.json'), 'utf8'));
const T = K.TOPS;
const r1 = x => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- Szenario-Raster
const BATT = [0, 5, 10, 15, 20, 30];
const leistung = kwh => (kwh <= 10 ? 5 : 10);
const TOP4 = { name: 'Top 4', top: '4', profil: 'top4', km_jahr: 7700, anstecken_unter_prozent: 50, ersetzt_ist: true, seed: 1 };
const NEU = [
  { name: 'Auto A', top: '1', profil: 'pendler', seed: 11 },
  { name: 'Auto B', top: '3', profil: 'homeoffice', seed: 12 },
  { name: 'Auto C', top: '8', profil: 'pendler', seed: 13 },
  { name: 'Auto D', top: '6', profil: 'wenigfahrer', km_jahr: 6000, seed: 14 },
];

function einstellung({ vt, hp, batt, autos, strat, top4, tf10 = null }) {
  const s = K.ausKonfiguration(CFG);
  s.verteilung.modell = vt;
  if (tf10 !== null) s.verteilung.teilnahme['10'] = tf10;
  s.reihenfolge = hp === 'hinter' ? ['tops', 'heizpatrone'] : ['heizpatrone', 'tops'];
  if (batt > 0) {
    s.batterie = K.batterie({ kapazitaet_kwh: batt, leistung_kw: leistung(batt) });
    s.reihenfolge = hp === 'hinter' ? K.REIHENFOLGEN.tops_batterie_heizpatrone : K.REIHENFOLGEN.nach_tops;
  }
  s.eautos = [];
  if (top4 === 'pv') s.eautos.push({ ...TOP4, strategie: 'pv', anstecken_unter_prozent: null });
  else if (autos > 0) s.eautos.push({ ...TOP4 });            // gleiche Zufallsbasis wie Top 4 gemessen
  NEU.slice(0, autos).forEach(a => s.eautos.push({ ...a, strategie: strat }));
  return s;
}

/** Preisunabhängige Kennzahlen eines Laufs. */
function kennzahlen(r) {
  return {
    b: r1(r.summe.bezug_allg),
    rest: Array.from({ length: 12 }, (_, m) => r1(r.monate[m + 1].rest)),
    v: T.map(t => r1(r.tops[t].verbrauch)), vs: T.map(t => r1(r.tops[t].verbrauch_snap)),
    e: T.map(t => r1(r.tops[t].genutzt)), es: T.map(t => r1(r.tops[t].genutzt_snap)),
    hp: r1(r.waerme.heizpatrone), wpn: r1(r.waerme.wp_nachheizen),
    bat: r.batterie ? { ent: r1(r.batterie.entladung), zyk: Math.round(r.batterie.vollzyklen) } : null,
    ev: r.eautos.map(a => ({ n: a.name, top: a.top, p: a.profil, gel: r1(a.geladen), pv: r1(a.aus_pv), km: Math.round(a.km) })),
    spitze: r1(r.eauto_spitze_kw),
    gen: r1(r.summe.genutzt), rs: r1(r.summe.rest),
  };
}

function raster() {
  const out = {};
  let n = 0;
  for (const vt of ['statisch', 'dynamisch']) for (const hp of ['vor', 'hinter']) for (const batt of BATT)
    for (const top4 of ['sofort', 'pv']) for (let autos = 0; autos <= NEU.length; autos++)
      for (const strat of autos === 0 ? ['sofort'] : ['sofort', 'pv']) {
        const key = [vt, hp, batt, top4, autos, strat].join('|');
        out[key] = kennzahlen(K.simuliere(D, einstellung({ vt, hp, batt, autos, strat, top4 })));
        if (++n % 50 === 0) process.stderr.write(`  ${n} Szenarien …\n`);
      }
  return out;
}

// ---------------------------------------------------------------- Ist-Zustand, Monate, Beispieltage
function summe(a) { return a.reduce((x, y) => x + y, 0) / 1000; }

function monate() {
  const z = K.zeitfelder(D.zeit), m = Array.from({ length: 12 }, () => ({ pv: 0, hp: 0, wp: 0, gl: 0, bez: 0, ein: 0, tops: 0, gen: 0, rest: 0 }));
  for (let i = 0; i < D.zeit.length; i++) {
    const x = m[z.monat[i] - 1];
    x.pv += D.pv[i]; x.hp += D.heizpatrone[i]; x.wp += D.wp[i]; x.gl += D.grundlast_allg[i];
    x.bez += D.bezug_allg[i]; x.ein += D.einspeisung[i]; x.rest += D.rest[i];
    for (const t of T) { x.tops += D.v[t][i]; x.gen += D.e[t][i]; }
  }
  return m.map(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, Math.round(v / 1000)])));
}

function beispieltag(datum) {
  const out = { datum, zeit: [], pv: [], allg: [], hp: [], tops: [], einsp: [], bezug: [] };
  for (let i = 0; i < D.zeit.length; i++) {
    if (Math.floor(D.zeit[i] / 1e4) !== datum) continue;
    const kw = x => Math.round(x * 4) / 1000;   // Wh je Viertelstunde → kW
    out.zeit.push(D.zeit[i] % 10000);
    out.pv.push(kw(D.pv[i])); out.allg.push(kw(D.verbrauch_allg[i])); out.hp.push(kw(D.heizpatrone[i]));
    out.tops.push(kw(T.reduce((a, t) => a + D.v[t][i], 0))); out.einsp.push(kw(D.einspeisung[i])); out.bezug.push(kw(D.bezug_allg[i]));
  }
  return out;
}

function pruefstempel() {
  const k1 = Object.entries(CFG.kontrollwerte_rechnungen).filter(([j]) => j === '2025').map(([j, soll]) => ({
    jahr: j, bezug_rechnung: soll.bezug_allgemein_kwh, bezug_daten: r1(summe(D.bezug_allg)),
    einsp_rechnung: soll.einspeisung_kwh, einsp_daten: r1(summe(D.einspeisung)),
  }))[0];
  // K9: statische Verteilung je Viertelstunde und Top nachgerechnet
  const s = K.ausKonfiguration(CFG), schl = Object.fromEntries(T.map(t => [t, s.verteilung.schluessel[t] / 100]));
  let max = 0, n = 0; const e = {}, bedarf = {};
  for (let i = 0; i < D.zeit.length; i++) {
    T.forEach(t => { bedarf[t] = D.vt[t][i]; });
    K.verteile('statisch', D.einspeisung[i], bedarf, schl, e);
    for (const t of T) { max = Math.max(max, Math.abs(e[t] - D.e[t][i])); n++; }
  }
  const geschaetzt = D.geschaetzt.reduce((a, b) => a + b, 0) / D.zeit.length;
  return { k1, k9_werte: n, k9_max_wh: r1(max), anteil_geschaetzt: geschaetzt };
}

function main() {
  const heute = K.simuliere(D, K.ausKonfiguration(CFG));
  const pv = summe(D.pv), hp = summe(D.heizpatrone), allgPV = summe(D.verbrauch_allg) - summe(D.bezug_allg);
  const tf = [17, 50, 100].map(x => kennzahlen(K.simuliere(D, einstellung({ vt: 'dynamisch', hp: 'hinter', batt: 0, autos: 0, strat: 'sofort', top4: 'sofort', tf10: x === 17 ? null : x }))));
  const cfgK = K.ausKonfiguration(CFG);
  const daten = {
    erstellt: new Date().toISOString().slice(0, 10),
    referenzjahr: 2025,
    preise: {
      allgemein_ct: r1(cfgK.preise.bezug_allg * 1000) / 10, top_ct: r1(cfgK.preise.bezug_top * 1000) / 10,
      top_snap_ct: r1(cfgK.preise.bezug_top_snap * 1000) / 10,
      einspeisung_ct: Object.values(CFG.preise.einspeisung_ct_monat_2025),
      intern_ct: CFG.preise.interner_pv_preis_ct,
    },
    wirtschaft: { lebensdauer: CFG.wirtschaftlichkeit.lebensdauer_jahre, zins: CFG.wirtschaftlichkeit.zinssatz_prozent,
      batterie_preis: CFG.wirtschaftlichkeit.batterie_preis_eur_pro_kwh },
    anteile: T.map(t => CFG.haus.anteile_1107[t]),
    anlage: { wechselrichter: 'SolarEdge SE25K (25 kVA)', waermepumpe: 'Hoval Thermalia dual H (35), Erdwärme, 2 Verdichter',
      puffer: 'Hoval CombiSol R, 1.350 l', heizpatrone: 'bis 6 kW, nur PV-Strom' },
    ist: {
      pv: Math.round(pv), allg_direkt: Math.round(allgPV), heizpatrone: Math.round(hp),
      einspeisung: Math.round(summe(D.einspeisung)), tops_genutzt: Math.round(summe(T.flatMap(t => D.e[t]))),
      rest: Math.round(summe(D.rest)), allg_verbrauch: Math.round(summe(D.verbrauch_allg)), wp: Math.round(summe(D.wp)),
      grundlast: Math.round(summe(D.grundlast_allg)), bezug_allg: Math.round(summe(D.bezug_allg)),
      tops_verbrauch: Math.round(summe(T.flatMap(t => D.v[t]))),
      tops_e: T.map(t => r1(heute.tops[t].genutzt)), tops_ersparnis: T.map(t => Math.round(heute.tops[t].ersparnis)),
    },
    geschichte: [   // aus den Jahresrechnungen HALLAG
      { jahr: 2021, bezug: 21185, einsp: null, hinweis: 'PV seit April 2021' },
      { jahr: 2022, bezug: 16528, einsp: null },
      { jahr: 2023, bezug: 16836, einsp: 3031, hinweis: 'Erweiterung Ende 2023' },
      { jahr: 2024, bezug: 15131, einsp: 15324 },
      { jahr: 2025, bezug: 15194, einsp: 16327 },
    ],
    monate: monate(),
    tage: { sommer: beispieltag(20250615), uebergang: beispieltag(20250320), winter: beispieltag(20250115) },
    pruef: pruefstempel(),
    top10: tf,
    raster: raster(),
  };
  const ziel = path.join(ROOT, 'praesentation', 'daten.json');
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, JSON.stringify(daten));
  console.log('→', path.relative(ROOT, ziel), `${(fs.statSync(ziel).size / 1e3).toFixed(0)} kB,`, Object.keys(daten.raster).length, 'Szenarien');
}
main();
