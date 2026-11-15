// Erzeugt die Daten für die Präsentation: alle Kombinationen der Schieberegler vorab gerechnet,
// nur zusammengefasste Werte (keine Viertelstunden-Profile einzelner Wohnungen).
// Energiemengen hängen nicht von den Preisen ab – die Präsentation rechnet Preise daher selbst darauf.
//
// Wärmepumpe: Puffermodell (einstellungen.json → waerme.modell). Vergleiche immer mit dem Modelllauf „heute“.
// Voraussetzung: python3 aufbereitung/waermemodell.py
//
// Aufruf:  node simulation/praesentation_daten.js     →  praesentation/daten.json
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('./kern.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const ladeJahr = j => JSON.parse(fs.readFileSync(path.join(ROOT, 'simulation', 'daten', `jahr_${j}.json`), 'utf8'));
const D = ladeJahr(2025);
if (!D.waermemodell) throw new Error('Wärmemodell fehlt – zuerst python3 aufbereitung/waermemodell.py');
const ALLE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// Heizpatronen-Einstellungen am Smartfox (alle umsetzbar)
const HP = { heute: null, fenster: { aus_stunden: [11, 12, 13, 14] }, schwelle: { schwelle_kw: 3 }, reserve: { reserve_kw: 3 }, aus: { aus_monate: ALLE } };
const ANH = { ab_kw: 3, plus_k: 8, max_c: 58, cop_minus_prozent_je_k: 2.5 };
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

function einstellung({ vt, hp, batt = 0, autos = 0, strat = 'sofort', top4 = 'sofort', tf10 = null, bv = 'allgemein', anh = null }) {
  const s = K.ausKonfiguration(CFG);
  s.verteilung.modell = vt;
  if (tf10 !== null) s.verteilung.teilnahme['10'] = tf10;
  if (HP[hp]) s.heizpatrone = HP[hp];
  s.waerme.pv_anhebung = anh;
  if (batt > 0) {   // AC-Batterie lädt nur, was nach Heizpatrone und Wohnungen übrig bleibt (so ist sie umsetzbar)
    s.batterie = K.batterie({ kapazitaet_kwh: batt, leistung_kw: leistung(batt), versorgt: bv });
    s.reihenfolge = K.REIHENFOLGEN.nach_tops;
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
    rest: Array.from({ length: 12 }, (_, m) => r1(r.monate[m + 1] ? r.monate[m + 1].rest : 0)),
    v: T.map(t => r1(r.tops[t].verbrauch)), vs: T.map(t => r1(r.tops[t].verbrauch_snap)),
    e: T.map(t => r1(r.tops[t].genutzt)), es: T.map(t => r1(r.tops[t].genutzt_snap)),
    hp: r1(r.waerme.heizpatrone), wp: r1(r.waerme.wp_modell ?? 0), starts: r.waerme.starts ?? null,
    bat: r.batterie ? { ent: r1(r.batterie.entladung), zyk: Math.round(r.batterie.vollzyklen), tops: r1(r.summe.entladung_tops) } : null,
    ev: r.eautos.map(a => ({ n: a.name, top: a.top, p: a.profil, gel: r1(a.geladen), pv: r1(a.aus_pv), km: Math.round(a.km) })),
    spitze: r1(r.eauto_spitze_kw),
    gen: r1(r.summe.genutzt), rs: r1(r.summe.rest),
  };
}

function raster() {
  const out = {};
  let n = 0;
  for (const vt of ['statisch', 'dynamisch']) for (const hp of ['heute', 'reserve', 'aus']) for (const batt of BATT)
    for (const top4 of ['sofort', 'pv']) for (let autos = 0; autos <= NEU.length; autos++)
      for (const strat of autos === 0 ? ['sofort'] : ['sofort', 'pv'])
        for (const bv of batt === 0 ? ['allgemein'] : ['allgemein', 'allgemein_und_tops']) {
          // Schlüssel: Verteilung | Heizpatrone | Batterie kWh | Top 4 | weitere Autos | Ladestrategie | Batterie versorgt
          const key = [vt, hp, batt, top4, autos, strat, bv].join('|');
          out[key] = kennzahlen(K.simuliere(D, einstellung({ vt, hp, batt, autos, strat, top4, bv })));
          if (++n % 100 === 0) process.stderr.write(`  ${n} Szenarien …\n`);
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
  const tf = [17, 50, 100].map(x => kennzahlen(K.simuliere(D, einstellung({ vt: 'dynamisch', hp: 'aus', tf10: x === 17 ? null : x }))));
  // Heizpatronen-Varianten (ohne Batterie/Autos) für jedes Jahr – 2026 nur Jänner bis August
  const VAR = { fix: { vt: 'statisch', hp: 'heute' }, fix_aus: { vt: 'statisch', hp: 'aus' }, dyn: { vt: 'dynamisch', hp: 'heute' },
    fenster: { vt: 'dynamisch', hp: 'fenster' }, schwelle: { vt: 'dynamisch', hp: 'schwelle' }, reserve: { vt: 'dynamisch', hp: 'reserve' },
    aus: { vt: 'dynamisch', hp: 'aus' }, aus_anh: { vt: 'dynamisch', hp: 'aus', anh: ANH }, reserve_anh: { vt: 'dynamisch', hp: 'reserve', anh: ANH },
    aus_b10: { vt: 'dynamisch', hp: 'aus', batt: 10 } };
  const jahre = {};
  for (const j of [2024, 2025, 2026]) {
    const DJ = j === 2025 ? D : ladeJahr(j);
    const mess = k => Math.round(summe(DJ[k]));
    jahre[j] = {
      monate: new Set(K.zeitfelder(DJ.zeit).monat).size,
      mess: { pv: mess('pv'), bezug: mess('bezug_allg'), rest: mess('rest'), hp: mess('heizpatrone'), wp: mess('wp'),
        tops_genutzt: Math.round(summe(T.flatMap(t => DJ.e[t]))) },
      var: Object.fromEntries(Object.entries(VAR).map(([n, o]) => [n, kennzahlen(K.simuliere(DJ, einstellung(o)))])),
    };
  }
  // Wärmemodell: Prüfung gegen die Messung 2025 (Bericht simulation/ausgabe/waermemodell.md)
  const tq = (a, q) => { const x = a.filter(v => v > 0).map(v => v / 10).sort((p, r) => p - r); return r1(x[Math.floor(q * (x.length - 1))]); };
  const mH = K.simuliere(D, einstellung({ vt: 'statisch', hp: 'heute' }), { details: true });
  const waerme = {
    regelung: D.waermemodell.regelung, bilanz: D.waermemodell.bilanz,
    mess_temp: [tq(D.temp, 0.05), tq(D.temp, 0.5), tq(D.temp, 0.95)],
    modell_temp: [0.05, 0.5, 0.95].map(q => { const x = [...mH.details.temp].sort((p, r) => p - r); return r1(x[Math.floor(q * (x.length - 1))]); }),
    modell_wp: r1(mH.waerme.wp_modell), mess_wp: r1(summe(D.wp)), modell_starts: mH.waerme.starts,
  };
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
    jahre, waerme,
    raster: raster(),
  };
  const ziel = path.join(ROOT, 'praesentation', 'daten.json');
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, JSON.stringify(daten));
  console.log('→', path.relative(ROOT, ziel), `${(fs.statSync(ziel).size / 1e3).toFixed(0)} kB,`, Object.keys(daten.raster).length, 'Szenarien');
}
main();
