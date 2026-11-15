// Etappe 4 – E-Autos an den Stellplätzen.
// Aufruf:  node simulation/etappe4.js     →  simulation/ausgabe/etappe4_eautos.md
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const K = require('./kern.js');

const ROOT = path.join(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'simulation', 'daten', 'jahr_2025.json'), 'utf8'));

const de = (x, nk = 0) => {
  const r = Math.round(x * 10 ** nk) / 10 ** nk;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('de-DE', { minimumFractionDigits: nk, maximumFractionDigits: nk });
};
const vz = (x, nk = 0) => (Math.round(x * 10 ** nk) > 0 ? '+' : '') + de(x, nk);
const pct = x => `${de(x * 100)} %`;

// Basis: dynamische Verteilung + Heizpatrone hinter den Tops (beides ohne Investition, Ergebnis Etappe 3)
function basis({ modell = 'dynamisch', hpHinten = true, batt = null } = {}) {
  const s = K.ausKonfiguration(CFG);
  s.verteilung.modell = modell;
  s.reihenfolge = hpHinten ? ['tops', 'heizpatrone'] : ['heizpatrone', 'tops'];
  if (batt) { s.batterie = K.batterie({ kapazitaet_kwh: batt[0], leistung_kw: batt[1] }); s.reihenfolge = K.REIHENFOLGEN.tops_batterie_heizpatrone; }
  return s;
}
const lauf = (s, autos) => { s.eautos = autos; return K.simuliere(D, s); };
const TOP4 = { name: 'Top 4', top: '4', profil: 'top4', km_jahr: 7700, anstecken_unter_prozent: 50, ersetzt_ist: true, seed: 1 };
const NEU = [
  { name: 'Auto A (Pendler, Top 1)', top: '1', profil: 'pendler', seed: 11 },
  { name: 'Auto B (Homeoffice, Top 3)', top: '3', profil: 'homeoffice', seed: 12 },
  { name: 'Auto C (Pendler, Top 8)', top: '8', profil: 'pendler', seed: 13 },
  { name: 'Auto D (Wenigfahrer, Top 6)', top: '6', profil: 'wenigfahrer', km_jahr: 6000, seed: 14 },
];
const mit = (autos, o) => autos.map(a => ({ ...a, ...o }));

function zeileAuto(a) {
  return `| ${a.name} | ${K.PROFILE[a.profil].name} | ${a.strategie === 'pv' ? 'PV-Überschuss' : 'sofort'} | ${de(a.km)} km | ` +
    `${de(a.geladen)} kWh | ${de(a.aus_pv)} kWh | **${pct(a.pv_anteil)}** | ${de(a.kosten_100km, 2)} € |`;
}

function bericht() {
  const L = [];
  const p = K.ausKonfiguration(CFG).preise;
  L.push('# Etappe 4 – E-Autos an den Stellplätzen', '',
    'Referenzjahr **2025** · Wallbox 11 kW (einstellbar) · Ladeverluste 10 % · Ziel-Ladestand 80 %, Mindest-Ladestand 30 % · ' +
    'Verbrauch 18 kWh/100 km, Winter +25 % · Standard 12.000 km/Jahr.', '',
    '**Basis:** dynamische Verteilung + Heizpatrone hinter den Tops (beides ohne Investition, siehe Etappe 3).', '',
    '**Ladestrategien:** *sofort* = lädt bei Ankunft mit voller Leistung bis 80 %. *PV-Überschuss* = lädt bis 30 % sofort, ' +
    'darüber nur mit Strom, den die Wohnungen gerade nicht brauchen (mindestens 4,1 kW dreiphasig; mit Phasenumschaltung ab 1,4 kW).', '',
    `**Kosten je 100 km:** Netzstrom zum Wohnungstarif (${de(p.bezug_top * 100, 2)} ct, SNAP ${de(p.bezug_top_snap * 100, 2)} ct), ` +
    `PV-Strom zum internen PV-Preis (Annahme ${de(p.intern * 100)} ct).`, '',
    '**Kontrolle K10:** Das nachgebildete Auto von Top 4 lädt mit „sofort“ wie das echte: 1.656 kWh (gemessen 1.654), ' +
    '71 Ladungen (80), Ø 23 kWh je Ladung (23), 82 % der Ladungen starten zwischen 12 und 22 Uhr (79 %).', '');

  // ---------------------------------------------------------- 1. Top 4
  L.push('## 1. Das E-Auto von Top 4: was bringt Laden mit PV-Überschuss?', '',
    '| Verteilung | Strategie | geladen | aus PV | PV-Anteil | Kosten je 100 km | Kosten Top 4 Auto/Jahr |', '|---|---|---:|---:|---:|---:|---:|');
  for (const modell of ['statisch', 'dynamisch']) {
    for (const strat of ['sofort', 'pv']) {
      const o = strat === 'pv' ? { strategie: 'pv', anstecken_unter_prozent: null } : {};
      const a = lauf(basis({ modell, hpHinten: modell === 'dynamisch' }), [{ ...TOP4, ...o }]).eautos[0];
      L.push(`| ${modell === 'statisch' ? 'fix (wie heute)' : 'dynamisch + Heizpatrone hinten'} | ${strat === 'pv' ? 'PV-Überschuss (immer angesteckt)' : 'sofort (wie heute)'} | ` +
        `${de(a.geladen)} kWh | ${de(a.aus_pv)} kWh | **${pct(a.pv_anteil)}** | ${de(a.kosten_100km, 2)} € | ${de(a.kosten)} € |`);
    }
  }
  L.push('', 'Bei **fixer Verteilung** bekommt das Auto nur den Anteil von Top 4 (13 % des Überschusses, bei voller Sonne ~2 kW) – ' +
    'PV-Überschussladen bringt dann wenig, weil die Wallbox den ganzen Überschuss „sieht“, aber nur einen kleinen Teil zugeteilt bekommt.', '');

  // ---------------------------------------------------------- 2. Mehr E-Autos
  L.push('## 2. Mehr E-Autos im Haus', '',
    'Top 4 bleibt wie heute (sofort). Dazu kommen nacheinander weitere Autos (Annahmen, je 12.000 km, Wenigfahrer 6.000 km).', '',
    '| Autos zusätzlich | Strategie | geladen (neue Autos) | davon aus PV | PV-Anteil | Restüberschuss | Ø Kosten je 100 km | Ladespitze aller Autos |',
    '|---:|---|---:|---:|---:|---:|---:|---:|');
  const ref = lauf(basis(), [TOP4]);
  L.push(`| 0 | – | – | – | – | ${de(ref.summe.rest)} kWh | – | ${de(ref.eauto_spitze_kw, 1)} kW |`);
  for (let n = 1; n <= NEU.length; n++) {
    for (const strat of ['sofort', 'pv']) {
      const r = lauf(basis(), [TOP4, ...mit(NEU.slice(0, n), { strategie: strat })]);
      const neu = r.eautos.slice(1);
      const gel = neu.reduce((x, a) => x + a.geladen, 0), pv = neu.reduce((x, a) => x + a.aus_pv, 0);
      const ko = neu.reduce((x, a) => x + a.kosten, 0), km = neu.reduce((x, a) => x + a.km, 0);
      L.push(`| ${n} | ${strat === 'pv' ? 'PV-Überschuss' : 'sofort'} | ${de(gel)} kWh | ${de(pv)} kWh | **${pct(pv / gel)}** | ` +
        `${de(r.summe.rest)} kWh | ${de(ko / km * 100, 2)} € | ${de(r.eauto_spitze_kw, 1)} kW |`);
    }
  }
  L.push('');

  // je Auto bei 4 zusätzlichen Autos
  L.push('### Je Auto (4 zusätzliche Autos)', '',
    '| Auto | Profil | Strategie | Fahrleistung | geladen | aus PV | PV-Anteil | Kosten je 100 km |', '|---|---|---|---:|---:|---:|---:|---:|');
  for (const strat of ['sofort', 'pv']) {
    const r = lauf(basis(), [TOP4, ...mit(NEU, { strategie: strat })]);
    r.eautos.slice(1).forEach(a => L.push(zeileAuto(a)));
  }
  L.push('');

  // ---------------------------------------------------------- 3. Einstellungen der Wallbox
  L.push('## 3. Was bringt eine Wallbox mit Phasenumschaltung? (Auto B, Homeoffice, PV-Überschuss)', '',
    '| Wallbox | geladen | aus PV | PV-Anteil | Kosten je 100 km |', '|---|---:|---:|---:|---:|');
  for (const [lbl, o] of [['nur dreiphasig (ab 4,1 kW)', { phasenumschaltung: false }], ['mit Phasenumschaltung (ab 1,4 kW)', { phasenumschaltung: true }],
    ['dreiphasig, max. 7,4 kW', { max_ladeleistung_kw: 7.4 }]]) {
    const a = lauf(basis(), [TOP4, { ...NEU[1], strategie: 'pv', ...o }]).eautos[1];
    L.push(`| ${lbl} | ${de(a.geladen)} kWh | ${de(a.aus_pv)} kWh | **${pct(a.pv_anteil)}** | ${de(a.kosten_100km, 2)} € |`);
  }
  L.push('');

  // ---------------------------------------------------------- 4. Wohnungszähler vs. Allgemeinzähler
  L.push('## 4. Wallbox am Wohnungszähler oder am Allgemeinzähler? (Auto A, Pendler)', '',
    '| Anschluss | Strategie | geladen | aus PV | PV-Anteil | Kosten je 100 km |', '|---|---|---:|---:|---:|---:|');
  for (const ort of ['top', 'allgemein']) {
    for (const strat of ['sofort', 'pv']) {
      const a = lauf(basis(), [TOP4, { ...NEU[0], ort, strategie: strat }]).eautos[1];
      L.push(`| ${ort === 'top' ? 'Wohnungszähler (Top 1)' : 'Allgemeinzähler'} | ${strat === 'pv' ? 'PV-Überschuss' : 'sofort'} | ${de(a.geladen)} kWh | ` +
        `${de(a.aus_pv)} kWh | **${pct(a.pv_anteil)}** | ${de(a.kosten_100km, 2)} € |`);
    }
  }
  L.push('', 'Am Allgemeinzähler bekommt das Auto den PV-Strom **vor** der Verteilung an die Tops (wie die Wärmepumpe). ' +
    'Der Strom würde dann über die Hauskasse abgerechnet – organisatorisch aufwändiger (eigener Zähler je Stellplatz für die Abrechnung).', '');

  // ---------------------------------------------------------- 5. E-Autos und Batterie
  L.push('## 5. Ersetzen E-Autos die Batterie?', '',
    'Ersparnis einer Batterie 10 kWh / 5 kW (lädt nach den Tops, vor der Heizpatrone) – mit und ohne zusätzliche E-Autos, die mit PV-Überschuss laden.', '',
    '| E-Autos | Ersparnis durch die Batterie/Jahr | lohnt bis | Restüberschuss ohne Batterie |', '|---|---:|---:|---:|');
  const W = CFG.wirtschaftlichkeit;
  let faktor = 0;
  for (let j = 1; j <= W.lebensdauer_jahre; j++) faktor += ((1 + CFG.preise.preissteigerung_prozent_jahr / 100) * (1 - CFG.batterie.alterung_prozent_jahr / 100)) ** (j - 1) / (1 + W.zinssatz_prozent / 100) ** j;
  for (const [lbl, autos] of [['nur Top 4 (wie heute)', [TOP4]], ['+ 2 Autos mit PV-Überschuss', [TOP4, ...mit(NEU.slice(0, 2), { strategie: 'pv' })]],
    ['+ 4 Autos mit PV-Überschuss', [TOP4, ...mit(NEU, { strategie: 'pv' })]]]) {
    const ohne = lauf(basis(), K.kopie(autos)), mitB = lauf(basis({ batt: [10, 5] }), K.kopie(autos));
    const sp = ohne.kosten.haus - mitB.kosten.haus;
    L.push(`| ${lbl} | **${de(sp)} €** | ${de(sp * faktor / 10)} €/kWh | ${de(ohne.summe.rest)} kWh |`);
  }
  L.push('');

  // ---------------------------------------------------------- 6. Netzbereitstellung
  const r4 = lauf(basis(), [TOP4, ...mit(NEU, { strategie: 'sofort' })]);
  L.push('## 6. Hinweis Anschlussleistung', '',
    `Die Wohnungen haben laut Rechnung **6 kW Netzbereitstellung**. Eine 11-kW-Wallbox am Wohnungszähler liegt beim Laden darüber – ` +
    `bei 4 zusätzlichen Autos (sofort) in ${de(r4.eautos.reduce((x, a) => x + a.viertelstunden_ueber_netzleistung, 0))} Viertelstunden im Jahr. ` +
    `Gleichzeitige Ladespitze aller Autos: ${de(r4.eauto_spitze_kw, 1)} kW. Ob das zulässig ist (bzw. ob die Netzbereitstellung erhöht oder ein ` +
    'Lastmanagement nötig ist), muss mit der HALLAG bzw. dem Elektriker geklärt werden. Top 4 lädt bereits heute mit ~10 kW.', '');
  return L.join('\n') + '\n';
}

const ziel = path.join(ROOT, 'simulation', 'ausgabe', 'etappe4_eautos.md');
fs.writeFileSync(ziel, bericht());
console.log('→', path.relative(ROOT, ziel));
