// Tests des Rechenkerns.  Aufruf:  node --test simulation/tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../kern.js');

const ROOT = path.join(__dirname, '..', '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'einstellungen.json'), 'utf8'));
const MODELL = CFG.waerme.modell;
CFG.waerme.modell = 'ersatzfaktor';   // Messwert-Tests (K9 …): Wärmepumpe wie gemessen; Puffermodell-Tests unten
const datei = j => path.join(ROOT, 'simulation', 'daten', `jahr_${j}.json`);
const lade = j => JSON.parse(fs.readFileSync(datei(j), 'utf8'));
const T = K.TOPS;
const leer = () => Object.fromEntries(T.map(t => [t, 0]));

// ------------------------------------------------------------------ Bausteine
test('statische Verteilung: Anteil nach Schlüssel, höchstens Bedarf', () => {
  const schl = leer(); schl['1'] = 0.6; schl['2'] = 0.4;
  const bedarf = leer(); bedarf['1'] = 100; bedarf['2'] = 1000;
  const e = {};
  const s = K.verteile('statisch', 1000, bedarf, schl, e);
  assert.equal(e['1'], 100);   // Anteil 600, braucht nur 100
  assert.equal(e['2'], 400);   // Anteil 400, braucht 1000
  assert.equal(s, 500);        // 500 Wh bleiben übrig, obwohl Top 2 mehr bräuchte
});

test('dynamische Verteilung: nach Verbrauch, nie mehr als Bedarf oder Überschuss', () => {
  const bedarf = leer(); bedarf['1'] = 100; bedarf['2'] = 1000;
  const e = {};
  assert.ok(Math.abs(K.verteile('dynamisch', 1000, bedarf, leer(), e) - 1000) < 1e-9);
  assert.ok(Math.abs(e['1'] - 100 * 1000 / 1100) < 1e-9);
  const e2 = {};
  assert.equal(K.verteile('dynamisch', 5000, bedarf, leer(), e2), 1100); // genug für alle
  assert.equal(e2['2'], 1000);
});

test('SNAP-Fenster: April–September, 10–16 Uhr', () => {
  const p = { snap_monate: [4, 5, 6, 7, 8, 9], snap_stunden: [10, 16] };
  assert.ok(K.istSnap(6, 10, p));
  assert.ok(K.istSnap(9, 15, p));
  assert.ok(!K.istSnap(6, 16, p));
  assert.ok(!K.istSnap(3, 12, p));
});

// ------------------------------------------------------------------ mit echten Daten
const hatDaten = fs.existsSync(datei(2025));

test('K9 – Szenario „wie heute“ trifft die EDA-Eigendeckung 2025 je Viertelstunde und Top (±2 Wh)',
  { skip: !hatDaten && 'Daten fehlen – erst aufbereitung/export_json.py ausführen' }, () => {
    const d = lade(2025);
    const s = K.ausKonfiguration(CFG);
    const r = K.simuliere(d, s, { details: true });
    // je Top und Viertelstunde nachrechnen
    const schl = Object.fromEntries(T.map(t => [t, s.verteilung.schluessel[t] / 100]));
    const e = {}, bedarf = {};
    let abw = 0, max = 0;
    for (let i = 0; i < d.zeit.length; i++) {
      T.forEach(t => { bedarf[t] = d.vt[t][i]; });
      K.verteile('statisch', d.einspeisung[i], bedarf, schl, e);
      for (const t of T) {
        const x = Math.abs(e[t] - d.e[t][i]);
        max = Math.max(max, x);
        if (x > 2) abw++;
      }
    }
    assert.equal(abw, 0, `Abweichungen > 2 Wh: ${abw}, größte ${max.toFixed(1)} Wh`);
    // Jahressummen (Toleranz 1,5 kWh: Exportdaten sind auf ganze Wh gerundet, das summiert sich übers Jahr)
    T.forEach(t => {
      const ist = d.e[t].reduce((a, b) => a + b, 0) / 1000;
      assert.ok(Math.abs(r.tops[t].genutzt - ist) < 1.5, `Top ${t}: ${r.tops[t].genutzt} vs ${ist}`);
    });
    const restIst = d.rest.reduce((a, b) => a + b, 0) / 1000;
    assert.ok(Math.abs(r.summe.rest - restIst) / restIst < 0.001, `Rest ${r.summe.rest} vs ${restIst}`);
  });

test('K8 – Energiebilanz: Überschuss = genutzt + Rest (alle Modelle)', { skip: !hatDaten }, () => {
  const d = lade(2025);
  for (const modell of ['statisch', 'dynamisch']) {
    const s = K.ausKonfiguration(CFG);
    s.verteilung.modell = modell;
    const r = K.simuliere(d, s);
    assert.ok(r.kontrollen.bilanz_max_wh < 1e-6);
    assert.ok(Math.abs(r.summe.ueberschuss - r.summe.genutzt - r.summe.rest) < 1e-6);
  }
});

test('Dynamisch nutzt in jeder Viertelstunde mindestens so viel wie statisch', { skip: !hatDaten }, () => {
  const d = lade(2025);
  const s1 = K.ausKonfiguration(CFG), s2 = K.ausKonfiguration(CFG);
  s2.verteilung.modell = 'dynamisch';
  const a = K.simuliere(d, s1, { details: true }), b = K.simuliere(d, s2, { details: true });
  for (let i = 0; i < d.zeit.length; i++) assert.ok(b.details.genutzt[i] >= a.details.genutzt[i] - 1e-9);
});

test('Teilnahmefaktor 100 % für Top 10 ändert nur Top 10s Bedarf', { skip: !hatDaten }, () => {
  const d = lade(2025);
  const s = K.ausKonfiguration(CFG);
  s.verteilung.teilnahme['10'] = 100;
  const r = K.simuliere(d, s);
  const v10 = d.v['10'].reduce((a, b) => a + b, 0) / 1000;
  assert.ok(Math.abs(r.tops['10'].bedarf - v10) < 1e-6);
  assert.ok(Math.abs(r.tops['1'].bedarf - r.tops['1'].verbrauch) < 1e-6);
});

// ------------------------------------------------------------------ Etappe 3: Heizpatrone, Batterie
test('K9b – ohne Änderungen: Netzbezug Allgemein und Restüberschuss exakt wie gemessen', { skip: !hatDaten }, () => {
  const d = lade(2025);
  const r = K.simuliere(d, K.ausKonfiguration(CFG));
  const sum = a => a.reduce((x, y) => x + y, 0) / 1000;
  assert.ok(Math.abs(r.summe.bezug_allg - sum(d.bezug_allg)) < 1e-6);
  assert.ok(Math.abs(r.summe.heizpatrone - sum(d.heizpatrone)) < 1e-6);
  assert.equal(r.waerme.wp_nachheizen, 0);
});

test('K8 – Energiebilanz mit Batterie, Heizpatrone hinter Tops und allen Reihenfolgen', { skip: !hatDaten }, () => {
  const d = lade(2025);
  for (const reihe of Object.values(K.REIHENFOLGEN)) {
    for (const versorgt of ['allgemein', 'allgemein_und_tops']) {
      const s = K.ausKonfiguration(CFG);
      s.verteilung.modell = 'dynamisch';
      s.batterie = K.batterie({ kapazitaet_kwh: 15, leistung_kw: 8, versorgt });
      s.reihenfolge = reihe;
      const r = K.simuliere(d, s);
      assert.ok(r.kontrollen.bilanz_max_wh < 1e-6, `${reihe} ${versorgt}: ${r.kontrollen.bilanz_max_wh}`);
      assert.ok(r.batterie.verluste >= 0);
    }
  }
});

test('Batterie mit 0 kWh ändert nur den Eigenverbrauch der Steuerung', { skip: !hatDaten }, () => {
  const d = lade(2025);
  const s0 = K.ausKonfiguration(CFG), s1 = K.ausKonfiguration(CFG);
  s1.batterie = K.batterie({ kapazitaet_kwh: 0, leistung_kw: 5, standby_w: 0 });
  const a = K.simuliere(d, s0), b = K.simuliere(d, s1);
  assert.ok(Math.abs(a.kosten.haus - b.kosten.haus) < 1e-6);
});

test('Heizpatrone hinter den Tops: Tops bekommen mehr, Wärmepumpe heizt nach', { skip: !hatDaten }, () => {
  const d = lade(2025);
  const a = K.ausKonfiguration(CFG), b = K.ausKonfiguration(CFG);
  b.reihenfolge = ['tops', 'heizpatrone'];
  const ra = K.simuliere(d, a), rb = K.simuliere(d, b);
  assert.ok(rb.summe.genutzt > ra.summe.genutzt);
  assert.ok(rb.waerme.fehlt > 0 && rb.waerme.wp_nachheizen > 0);
  // Nachheizen ≈ fehlende Wärme × Ersatzfaktor / COP (bis auf noch offene Schuld am Jahresende)
  assert.ok(rb.waerme.wp_nachheizen + rb.waerme.offen <= rb.waerme.fehlt + 1e-6);
});

// ------------------------------------------------------------------ Etappe 4: E-Autos
const TOP4 = { name: 'Top 4', top: '4', profil: 'top4', km_jahr: 7700, anstecken_unter_prozent: 50, ersetzt_ist: true, seed: 1 };

test('K10 – nachgebildetes E-Auto von Top 4 lädt wie das echte (Menge ±15 %, Ladungen ±25 %, Uhrzeit ±10 %-Pkt.)',
  { skip: !hatDaten }, () => {
    const d = lade(2025);
    const z = K.zeitfelder(d.zeit), ist = d.eauto_ist['4'];
    let kwh = 0, ses = 0, vorher = false, nachm = 0;
    for (let i = 0; i < ist.length; i++) {
      const an = ist[i] > 0;
      if (an && !vorher) { ses++; if (z.stunde[i] >= 12 && z.stunde[i] < 22) nachm++; }
      vorher = an; kwh += ist[i] / 1000;
    }
    const s = K.ausKonfiguration(CFG);
    s.eautos = [TOP4];
    const a = K.simuliere(d, s).eautos[0];
    const nachmSim = a.start_stunden.slice(12, 22).reduce((x, y) => x + y, 0) / a.sitzungen;
    assert.ok(Math.abs(a.geladen / kwh - 1) <= 0.15, `Menge ${a.geladen} vs ${kwh}`);
    assert.ok(Math.abs(a.sitzungen / ses - 1) <= 0.25, `Ladungen ${a.sitzungen} vs ${ses}`);
    assert.ok(Math.abs(nachmSim - nachm / ses) <= 0.10, `Anteil 12–22 Uhr ${nachmSim} vs ${nachm / ses}`);
  });

test('K8 – Energiebilanz mit E-Autos (Wohnung und Allgemein, sofort und PV, mit Batterie)', { skip: !hatDaten }, () => {
  const d = lade(2025);
  const s = K.ausKonfiguration(CFG);
  s.verteilung.modell = 'dynamisch';
  s.reihenfolge = K.REIHENFOLGEN.tops_batterie_heizpatrone;
  s.batterie = K.batterie({ kapazitaet_kwh: 10, leistung_kw: 5 });
  s.eautos = [{ ...TOP4, strategie: 'pv' }, { top: '1', profil: 'pendler', strategie: 'sofort', seed: 2 },
    { ort: 'allgemein', profil: 'homeoffice', strategie: 'pv', phasenumschaltung: true, seed: 3 },
    { top: '10', profil: 'wenigfahrer', strategie: 'pv', seed: 4 }];
  const r = K.simuliere(d, s);
  assert.ok(r.kontrollen.bilanz_max_wh < 1e-6, String(r.kontrollen.bilanz_max_wh));
  for (const a of r.eautos) {
    assert.ok(a.aus_pv <= a.geladen + 1e-6);
    assert.ok(a.geladen > 0);
  }
});

test('PV-Laden: Auto bekommt mehr PV-Strom als beim Sofortladen, Fahrleistung bleibt gleich', { skip: !hatDaten }, () => {
  const d = lade(2025);
  const mk = strategie => { const s = K.ausKonfiguration(CFG); s.verteilung.modell = 'dynamisch';
    s.eautos = [{ top: '3', profil: 'homeoffice', strategie, seed: 5 }]; return K.simuliere(d, s).eautos[0]; };
  const a = mk('sofort'), b = mk('pv');
  assert.ok(b.aus_pv > a.aus_pv * 1.5, `${b.aus_pv} vs ${a.aus_pv}`);
  assert.equal(a.km, b.km);
});

// ------------------------------------------------------------------ Wärmemodell (Puffer, Viertelstunden)
const hatModell = hatDaten && !!lade(2025).waermemodell;
const puffer = (f) => { const s = K.ausKonfiguration(CFG); s.waerme.modell = 'puffer'; if (f) f(s); return s; };
const ALLE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

test('W1 – Puffermodell „heute“: Netzbezug und Einspeisung Allgemein höchstens 5 % neben der Messung', { skip: !hatModell }, () => {
  const d = lade(2025), r = K.simuliere(d, puffer());
  const bez = d.bezug_allg.reduce((a, b) => a + b, 0) / 1000, ein = d.rest.reduce((a, b) => a + b, 0) / 1000;
  assert.ok(Math.abs(r.summe.bezug_allg / bez - 1) < 0.05, `Bezug ${r.summe.bezug_allg} vs ${bez}`);
  assert.ok(Math.abs(r.summe.rest / ein - 1) < 0.07, `Einspeisung ${r.summe.rest} vs ${ein}`);
  assert.ok(Math.abs(r.waerme.wp_modell / (d.wp.reduce((a, b) => a + b, 0) / 1000) - 1) < 0.03);
});

test('W2 – Heizpatrone aus: Wärmepumpe braucht 0,25–0,45 kWh je kWh Heizpatrone mehr', { skip: !hatModell }, () => {
  const d = lade(2025);
  const a = K.simuliere(d, puffer()), b = K.simuliere(d, puffer(s => { s.heizpatrone = { aus_monate: ALLE }; }));
  const je = (b.waerme.wp_modell - a.waerme.wp_modell) / a.waerme.heizpatrone_ist;
  assert.ok(je > 0.25 && je < 0.45, `je kWh ${je}`);
  assert.equal(b.waerme.heizpatrone, 0);
});

test('K8 – Energiebilanz mit Puffermodell (Reihenfolgen, Batterie, PV-Anhebung, Heizpatronen-Regeln)', { skip: !hatModell }, () => {
  const d = lade(2025);
  for (const [name, rf] of Object.entries(K.REIHENFOLGEN)) {
    const r = K.simuliere(d, puffer(s => {
      s.verteilung.modell = 'dynamisch'; s.reihenfolge = rf; s.heizpatrone = { reserve_kw: 2, aus_stunden: [12] };
      s.batterie = K.batterie({ kapazitaet_kwh: 10, leistung_kw: 5, versorgt: 'allgemein_und_tops' });
      s.waerme.pv_anhebung = { ab_kw: 3, plus_k: 8 };
    }));
    assert.ok(r.kontrollen.bilanz_max_wh < 1e-6, `${name}: ${r.kontrollen.bilanz_max_wh}`);
  }
});

test('Standard-Wärmemodell laut Einstellungen ist das Puffermodell', () => { assert.equal(MODELL, 'puffer'); });
