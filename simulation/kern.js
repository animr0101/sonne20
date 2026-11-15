/*
 * Rechenkern der Simulation – läuft im Browser (Präsentation) und in Node (Tests, Auswertungen).
 *
 * Grundprinzip „Messwert + Änderung“:
 *   Ausgangspunkt jeder Viertelstunde sind die GEMESSENEN Flüsse (Einspeisung, Netzbezug, Heizpatrone,
 *   Wärmepumpe, Verbrauch der Tops). Ein Szenario rechnet nur die Änderungen gegenüber der Messung.
 *   Dadurch bleibt erhalten, dass innerhalb einer Viertelstunde gleichzeitig eingespeist und bezogen werden
 *   kann – und das Szenario „nichts ändern“ liefert exakt den Ist-Zustand (Kontrolle K9).
 *
 * Ablauf je Viertelstunde:
 *   1. Zusätzlicher Allgemeinverbrauch: Wärmepumpe heizt fehlende Heizpatronen-Wärme nach („Wärmeschuld“),
 *      Eigenverbrauch der Batterie. Gedeckt zuerst aus PV-Überschuss, sonst aus dem Netz.
 *   2. PV-Überschuss (nach dem Allgemeinverbrauch) geht in der eingestellten Reihenfolge an
 *      Heizpatrone / Tops (Verteilung statisch oder dynamisch) / Batterie. Was übrig bleibt: Restüberschuss.
 *   3. Batterie entlädt für den Netzbezug des Allgemeinstroms (optional auch für die Tops).
 *   E-Autos: eigener Fahrplan je Auto (anwesend / Fahrten), laden „sofort“ oder mit PV-Überschuss.
 *   Wallbox am Wohnungszähler → Verbrauch des Tops (zählt in der Verteilung), am Allgemeinzähler → Allgemeinverbrauch.
 *
 * Energie in Wh je Viertelstunde (Daten: aufbereitung/export_json.py), Ergebnisse in kWh und € brutto.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SonneKern = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TOPS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const REIHENFOLGEN = {
    nach_tops: ['heizpatrone', 'tops', 'batterie'],       // Batterie lädt nur aus dem Restüberschuss
    vor_tops: ['heizpatrone', 'batterie', 'tops'],
    vor_heizpatrone: ['batterie', 'heizpatrone', 'tops'],
    tops_batterie_heizpatrone: ['tops', 'batterie', 'heizpatrone'],   // nach Wert je kWh: Tops > Batterie > Heizpatrone
  };

  // ------------------------------------------------------------------ Einstellungen
  /** Wandelt einstellungen.json in die Einstellungen des Rechenkerns um (ohne Batterie). */
  function ausKonfiguration(cfg) {
    const p = cfg.preise, ust = 1 + p.ust_prozent / 100;
    const summeAnteile = TOPS.reduce((s, t) => s + cfg.haus.anteile_1107[t], 0);
    return {
      verteilung: {
        modell: 'statisch',                                       // 'statisch' | 'dynamisch'
        schluessel: { ...cfg.haus.schluessel_hallag_prozent },    // Prozent je Top (nur statisch)
        teilnahme: Object.fromEntries(TOPS.map(t => [t, 'ist'])), // 'ist' = Messwert aus EDA, sonst Prozent
      },
      reihenfolge: ['heizpatrone', 'tops'],                       // heute: Heizpatrone vor den Tops
      waerme: {
        cop: cfg.waerme.cop_betrieb,
        ersatz_monat: Object.fromEntries(Object.entries(cfg.waerme.ersatzfaktor_heizpatrone_monat).map(([m, x]) => [m, x])),
        wp_max_wh: cfg.waerme.wp_max_kwh_viertelstunde * 1000,
        modell: cfg.waerme.modell || 'ersatzfaktor',               // 'puffer' (Viertelstunden-Modell) | 'ersatzfaktor'
        pv_anhebung: cfg.waerme.pv_anhebung || null,
      },
      batterie: null,
      preise: {
        ust: ust,
        bezug_top: p.bezug_top_ct_netto * ust / 100,              // €/kWh brutto
        bezug_top_snap: p.bezug_top_snap_ct_netto * ust / 100,
        bezug_allg: p.bezug_allgemein_ct_netto * ust / 100,
        snap_monate: p.snap_monate, snap_stunden: p.snap_stunden,
        einspeisung_monat: Object.fromEntries(Object.entries(p.einspeisung_ct_monat_2025).map(([m, c]) => [m, c / 100])),
        intern: p.interner_pv_preis_ct / 100,
      },
      anteile: Object.fromEntries(TOPS.map(t => [t, cfg.haus.anteile_1107[t] / summeAnteile])),
    };
  }

  /** Batterie-Einstellungen (Werte in kWh / kW / %), Rückgabe für s.batterie. */
  function batterie(o) {
    const eta = Math.sqrt((o.wirkungsgrad_prozent ?? 90) / 100);   // je Richtung
    const kap = o.kapazitaet_kwh * 1000;
    return {
      kapazitaet_wh: kap,
      lade_wh: (o.ladeleistung_kw ?? o.leistung_kw) * 250,          // kW → Wh je Viertelstunde
      entlade_wh: (o.entladeleistung_kw ?? o.leistung_kw) * 250,
      eta_lade: eta, eta_entlade: eta,
      reserve_wh: kap * (o.reserve_prozent ?? 0) / 100,
      standby_wh: (o.standby_w ?? 20) / 4,
      versorgt: o.versorgt ?? 'allgemein',                          // 'allgemein' | 'allgemein_und_tops'
    };
  }

  function schluesselAusAnteilen(anteile) {
    const s = TOPS.reduce((x, t) => x + anteile[t], 0);
    return Object.fromEntries(TOPS.map(t => [t, anteile[t] / s * 100]));
  }

  function kopie(o) { return JSON.parse(JSON.stringify(o)); }

  // ------------------------------------------------------------------ Daten
  function zeitfelder(zeit) {
    const n = zeit.length, monat = new Uint8Array(n), stunde = new Uint8Array(n), tag = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      monat[i] = Math.floor(zeit[i] / 1e6) % 100;
      stunde[i] = Math.floor(zeit[i] / 100) % 100;
      tag[i] = Math.floor(zeit[i] / 1e4);
    }
    return { monat, stunde, tag };
  }

  /** Fügt mehrere Jahresdateien zusammen und schneidet auf [von, bis) zu (Zeit als JJJJMMTTHHMM). */
  function zeitraum(jahre, von, bis) {
    const out = { zeit: [], v: {}, vt: {}, e: {}, eauto_ist: { '4': [] } };
    const einfach = ['geschaetzt', 'temp', 'einspeisung', 'rest', 'bezug_allg', 'pv', 'heizpatrone',
      'verbrauch_allg', 'wp', 'grundlast_allg'];
    einfach.forEach(k => { out[k] = []; });
    ['v', 'vt', 'e'].forEach(k => TOPS.forEach(t => { out[k][t] = []; }));
    for (const d of jahre) {
      for (let i = 0; i < d.zeit.length; i++) {
        if (d.zeit[i] < von || d.zeit[i] >= bis) continue;
        out.zeit.push(d.zeit[i]);
        einfach.forEach(k => out[k].push(d[k][i]));
        ['v', 'vt', 'e'].forEach(k => TOPS.forEach(t => out[k][t].push(d[k][t][i])));
        out.eauto_ist['4'].push(d.eauto_ist ? d.eauto_ist['4'][i] : 0);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ Bausteine
  /**
   * Verteilt den Überschuss G (Wh) einer Viertelstunde an die Tops.
   *   statisch:  e_t = min(Schlüssel_t × G, bedarf_t)
   *   dynamisch: e_t = bedarf_t × min(1, G / Σ bedarf)
   */
  function verteile(modell, G, bedarf, schluesselAnteil, e) {
    let summe = 0;
    if (modell === 'dynamisch') {
      let D = 0;
      for (const t of TOPS) D += bedarf[t];
      const f = D > 0 ? Math.min(1, G / D) : 0;
      for (const t of TOPS) { e[t] = bedarf[t] * f; summe += e[t]; }
    } else {
      for (const t of TOPS) { e[t] = Math.min(schluesselAnteil[t] * G, bedarf[t]); summe += e[t]; }
    }
    return summe;
  }

  function istSnap(monat, stunde, p) {
    return p.snap_monate.includes(monat) && stunde >= p.snap_stunden[0] && stunde < p.snap_stunden[1];
  }


  // ------------------------------------------------------------------ E-Autos
  /** Reproduzierbarer Zufallsgenerator (gleicher Startwert → gleiche Fahrten). */
  function zufall(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(rnd, mu, sd) {
    const u = Math.max(rnd(), 1e-12), v = rnd();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Fahrprofile: Wahrscheinlichkeit einer Fahrt, Abfahrt [Mittel, Streuung] und Dauer [Mittel, Streuung] in Stunden. */
  const PROFILE = {
    pendler: { name: 'Pendler', werktag: { p: 0.95, start: [7, 0.6], dauer: [10, 1] },
      samstag: { p: 0.6, start: [10, 1.5], dauer: [4, 1.5] }, sonntag: { p: 0.4, start: [11, 1.5], dauer: [4, 1.5] } },
    homeoffice: { name: 'Homeoffice', werktag: { p: 0.4, start: [9.5, 2], dauer: [4, 2] },
      samstag: { p: 0.6, start: [10, 1.5], dauer: [4, 1.5] }, sonntag: { p: 0.4, start: [11, 1.5], dauer: [4, 1.5] } },
    wenigfahrer: { name: 'Wenigfahrer', werktag: { p: 0.3, start: [10, 2], dauer: [3, 1.5] },
      samstag: { p: 0.35, start: [10, 2], dauer: [3, 1.5] }, sonntag: { p: 0.3, start: [11, 2], dauer: [3, 1.5] } },
    top4: { name: 'wie Top 4 (nachgebildet)', werktag: { p: 0.85, start: [7.5, 1.5], dauer: [7, 3] },
      samstag: { p: 0.5, start: [10, 1.5], dauer: [5, 2] }, sonntag: { p: 0.4, start: [11, 1.5], dauer: [5, 2] } },
  };

  const AUTO_STANDARD = {
    ort: 'top', top: '1', profil: 'pendler', km_jahr: 12000, akku_kwh: 60, verbrauch_kwh_100km: 18,
    winterzuschlag_prozent: 25, ziel_soc_prozent: 80, min_soc_prozent: 30, max_ladeleistung_kw: 11,
    min_ladeleistung_kw: 4.1, phasenumschaltung: false, ladeverluste_prozent: 10, strategie: 'sofort',
    anstecken_unter_prozent: null,   // null = immer angesteckt, sonst nur bei Ankunft unter diesem Ladestand
    ersetzt_ist: false,              // true = ersetzt das gemessene E-Auto dieses Tops (nur Top 4)
    seed: 1,
  };

  function eauto(o) { return { ...AUTO_STANDARD, ...o }; }

  /** Fahrplan je Viertelstunde: anwesend (0/1) und Energie der Fahrt (Wh, bei Ankunft abgezogen). */
  function fahrplan(zeit, auto) {
    const n = zeit.length, rnd = zufall(auto.seed * 7919 + 13);
    const prof = PROFILE[auto.profil];
    const anwesend = new Uint8Array(n).fill(1), ankunft = new Float64Array(n);
    const fahrten = [];
    let i = 0;
    while (i < n) {
      const tag = Math.floor(zeit[i] / 1e4);
      let j = i;
      while (j < n && Math.floor(zeit[j] / 1e4) === tag) j++;
      const y = Math.floor(tag / 1e4), mo = Math.floor(tag / 100) % 100, d = tag % 100;
      const wt = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();   // 0 = Sonntag
      const regel = wt === 0 ? prof.sonntag : wt === 6 ? prof.samstag : prof.werktag;
      if (rnd() < regel.p) {
        const start = Math.min(20, Math.max(5, normal(rnd, regel.start[0], regel.start[1])));
        const ende = Math.min(23.75, start + Math.min(14, Math.max(0.5, normal(rnd, regel.dauer[0], regel.dauer[1]))));
        let erst = -1;
        for (let k = i; k < j; k++) {
          const h = (Math.floor(zeit[k] / 100) % 100) + (zeit[k] % 100) / 60;
          if (h >= start && h < ende) { anwesend[k] = 0; if (erst < 0) erst = k; }
        }
        if (erst >= 0) {
          let zur = erst; while (zur < n && anwesend[zur] === 0) zur++;
          if (zur < n) fahrten.push({ ankunft: zur, monat: mo, gewicht: 0.5 + rnd() });
        }
      }
      i = j;
    }
    // Kilometer auf die Fahrten verteilen, sodass die Jahresfahrleistung stimmt
    const tage = new Set(zeit.map(z => Math.floor(z / 1e4))).size;
    const kmGes = auto.km_jahr * tage / 365, gSum = fahrten.reduce((a, f) => a + f.gewicht, 0) || 1;
    const w = auto.winterzuschlag_prozent / 100;
    for (const f of fahrten) {
      const winter = [12, 1, 2].includes(f.monat) ? 1 + w : [11, 3].includes(f.monat) ? 1 + w / 2 : 1;
      ankunft[f.ankunft] += kmGes * f.gewicht / gSum * auto.verbrauch_kwh_100km / 100 * winter * 1000;
    }
    return { anwesend, ankunft, fahrten: fahrten.length, km: kmGes };
  }

  // ------------------------------------------------------------------ Puffermodell
  /**
   * Wärmepumpe als Thermostat am Mittelfühler des Puffers (gelernt in aufbereitung/waermemodell.py):
   * startet unter t_ein, stoppt über t_aus (je Außentemperatur), Strom im Lauf wp_lauf.
   * Fühler: T += k_wp·WP + k_hp·Heizpatrone − Entnahme (Entnahme je Viertelstunde aus den Messungen rekonstruiert).
   */
  function puffer(daten, monat, stunde, anhebung) {
    const M = daten.waermemodell, R = M.regelung, nacht = new Set(R.nacht);
    const klasse = (zs, a) => { const K = R.klassen[zs]; for (const k of K) if (a <= k.bis) return k; return K[K.length - 1]; };
    let T = daten.temp_start, an = false, lauf = 0, pause = 99, starts = 0, hpVorher = 0, tNormal = Infinity;
    const copMinus = anhebung ? (anhebung.cop_minus_prozent_je_k ?? 2.5) / 100 : 0;
    return {
      get T() { return T; },
      get starts() { return starts; },
      wp(i, ueberschussWh = 0) {   // Wh Wärmepumpenstrom; ueberschussWh = PV minus übriger Allgemeinverbrauch
        const zs = hpVorher > R.hp_laeuft_kwh * 1000 ? 'hp' : (nacht.has(stunde[i]) ? 'nacht' : 'tag');
        const k = klasse(zs, daten.aussen[i] / 10), h = stunde[i];
        let oe = zs === 'hp' ? 0 : R.stunde_ein[h], oa = zs === 'hp' ? 0 : R.stunde_aus[h];   // Zeitprogramm
        // PV-Anhebung (SG-Ready o. ä.): bei Überschuss Schaltpunkte anheben, Stopp höchstens bis max_c am Fühler
        tNormal = k.t_aus + oa;
        if (anhebung && ueberschussWh >= anhebung.ab_kw * 250) {
          oe = Math.max(oe, anhebung.plus_k); oa = Math.min(oa + anhebung.plus_k, (anhebung.max_c ?? 58) - k.t_aus);
        }
        if (an) { if (T >= k.t_aus + oa && lauf >= R.min_lauf) { an = false; pause = 0; } }
        else if (T <= k.t_ein + oe && pause >= R.min_pause) { an = true; lauf = 0; starts++; }
        if (an) { lauf++; return k.wp_lauf * 1000; }
        pause++; return 0;
      },
      waerme(i, wpWh, hpWh) {
        const b = M.bilanz[M.jahreszeit[String(monat[i])]];
        // über dem normalen Stopp (nur bei PV-Anhebung): höhere Vorlauftemperatur → schlechtere Arbeitszahl
        const cop = T > tNormal ? Math.max(0.5, 1 - copMinus * (T - tNormal)) : 1;
        T += (b.wp * cop * wpWh + b.hp * hpWh - daten.entnahme[i]) / 1000;
        hpVorher = hpWh;
      },
    };
  }

  // ------------------------------------------------------------------ Simulation
  function simuliere(daten, s, optionen = {}) {
    const n = daten.zeit.length, { monat, stunde, tag } = zeitfelder(daten.zeit);
    const P = s.preise, V = s.verteilung, W = s.waerme, B = s.batterie, H = s.heizpatrone || {};
    const schl = Object.fromEntries(TOPS.map(t => [t, (V.schluessel[t] || 0) / 100]));
    const tf = Object.fromEntries(TOPS.map(t => [t, V.teilnahme[t] === 'ist' ? null : V.teilnahme[t] / 100]));
    const reihenfolge = s.reihenfolge.filter(x => x !== 'batterie' || B);
    if (B && !reihenfolge.includes('batterie')) reihenfolge.push('batterie');

    // E-Autos vorbereiten
    const autos = (s.eautos || []).map((o, k) => {
      const a = eauto(o), plan = fahrplan(daten.zeit, a), kap = a.akku_kwh * 1000;
      return { a, plan, kap, soc: 0.7 * kap, angesteckt: true, eta: 1 - a.ladeverluste_prozent / 100,
        cap: a.max_ladeleistung_kw * 250, pmin: (a.phasenumschaltung ? 1.4 : a.min_ladeleistung_kw) * 250,
        st: { name: o.name || `Auto ${k + 1}`, geladen: 0, aus_pv: 0, auswaerts: 0, sitzungen: 0, km: plan.km,
              fahrten: plan.fahrten, kosten: 0, start_stunden: new Array(24).fill(0), ueber_netzleistung: 0 },
        ladeVorher: false, p: 0 };
    });
    const ersetzt = {};   // Top → gemessene E-Auto-Ladung wird abgezogen
    for (const x of autos) if (x.a.ersetzt_ist && daten.eauto_ist && daten.eauto_ist[x.a.top]) ersetzt[x.a.top] = daten.eauto_ist[x.a.top];
    const lmCap = s.lastmanagement_kw ? s.lastmanagement_kw * 250 : Infinity;
    const netzWohnung = (s.netzbereitstellung_wohnung_kw || 6) * 250;
    const vT = {};
    let evSpitze = 0;

    const bedarf = {}, e = {};
    const top = Object.fromEntries(TOPS.map(t => [t, { verbrauch: 0, bedarf: 0, genutzt: 0, ersparnis: 0, kosten: 0,
      verbrauch_snap: 0, genutzt_snap: 0 }]));
    const monate = {};
    const sum = { ueberschuss: 0, genutzt: 0, rest: 0, bezug_allg: 0, heizpatrone: 0, heizpatrone_ist: 0,
      waerme_fehlt: 0, wp_nachheizen: 0, standby: 0, ladung: 0, entladung: 0, entladung_tops: 0 };
    const eur = { allg: 0, einspeisung: 0, tops_bezug: 0 };
    let schuld = 0, soc = 0, maxBilanz = 0;
    // Puffermodell: die gemessene Wärmepumpe wird durch die modellierte ersetzt (in jedem Szenario, auch „heute“).
    // Varianten deshalb immer mit dem Modelllauf „heute“ vergleichen, nicht mit der Messung.
    const pm = W.modell === 'puffer' && daten.waermemodell ? puffer(daten, monat, stunde, W.pv_anhebung) : null;
    let wpModell = 0;
    const tageVoll = new Set(), tageLeer = new Set(), alleTage = new Set();
    const det = optionen.details
      ? { genutzt: new Float64Array(n), rest: new Float64Array(n), bezug_allg: new Float64Array(n), soc: new Float64Array(n) }
      : null;

    for (let i = 0; i < n; i++) {
      const m = monat[i];
      const G0 = daten.einspeisung[i], B0 = daten.bezug_allg[i], hp0 = daten.heizpatrone[i];
      for (const t of TOPS) {
        const weg = ersetzt[t] ? ersetzt[t][i] : 0;
        vT[t] = daten.v[t][i] - weg;
        bedarf[t] = tf[t] === null ? daten.vt[t][i] - weg : vT[t] * tf[t];
      }

      // E-Autos: Ankunft, Anstecken, fester Ladeanteil (sofort bzw. bis Mindest-Ladestand)
      let lmRest = lmCap;
      for (const x of autos) {
        const a = x.a;
        if (x.plan.ankunft[i] > 0) {
          x.soc -= x.plan.ankunft[i];
          if (x.soc < 0) { x.st.auswaerts += -x.soc; x.soc = 0; }
          x.angesteckt = a.anstecken_unter_prozent === null || x.soc < a.anstecken_unter_prozent / 100 * x.kap;
        }
        x.p = 0;
        if (!x.plan.anwesend[i] || !x.angesteckt) continue;
        const bisZiel = Math.max(0, (a.ziel_soc_prozent / 100 * x.kap - x.soc) / x.eta);
        const bisMin = Math.max(0, (a.min_soc_prozent / 100 * x.kap - x.soc) / x.eta);
        x.bisZiel = bisZiel;
        x.p = Math.min(a.strategie === 'sofort' ? bisZiel : bisMin, x.cap, lmRest);
        if (x.p < 1) x.p = 0;
        lmRest -= x.p;
      }

      // 1. zusätzlicher Allgemeinverbrauch
      let extra = 0, minder = 0, wpNeu = 0;
      if (pm) {
        wpNeu = pm.wp(i, G0 + hp0 - B0 + daten.wp[i]);
        const d = wpNeu - daten.wp[i];
        if (d > 0) extra += d; else minder = -d;
        sum.wp_nachheizen += d; wpModell += wpNeu;
      } else if (schuld > 0 && daten.wp[i] > 0) {
        const x = Math.min(schuld, Math.max(0, W.wp_max_wh - daten.wp[i]));
        extra += x; schuld -= x; sum.wp_nachheizen += x;
      }
      if (B) { extra += B.standby_wh; sum.standby += B.standby_wh; }
      let pool = G0 + hp0;                       // PV-Überschuss nach Allgemeinverbrauch, vor Heizpatrone
      // E-Autos am Allgemeinzähler: fester Anteil ist Allgemeinverbrauch, PV-Anteil nur aus Überschuss
      let evAllgPV = 0;
      for (const x of autos) {
        if (x.a.ort !== 'allgemein' || !x.plan.anwesend[i] || !x.angesteckt) continue;
        if (x.a.strategie === 'pv') {
          const frei = Math.max(0, pool - extra);
          let p = Math.min(frei, x.cap - x.p, (x.bisZiel || 0) - x.p, lmRest);
          if (p < x.pmin) p = 0;
          x.p += p; lmRest -= p;
        }
        extra += x.p;
      }
      const ausPool = Math.min(pool, extra);
      pool -= ausPool;
      let bezug = B0 + (extra - ausPool);
      if (minder) { const r = Math.min(bezug, minder); bezug -= r; pool += minder - r; }   // WP läuft weniger als heute
      for (const x of autos) {   // PV-Anteil der Autos am Allgemeinzähler (anteilig an der zusätzlichen Last)
        if (x.a.ort === 'allgemein' && x.p > 0 && extra > 0) { const pv = x.p * ausPool / extra; x.st.aus_pv += pv; evAllgPV += pv; }
      }

      // 2. Überschuss in Reihenfolge
      let hp = 0, eSum = 0, ladung = 0, G = 0;
      for (const schritt of reihenfolge) {
        if (schritt === 'heizpatrone') {
          // Smartfox-Einstellungen: Reserve (Überschuss bis X kW bleibt für die Verteilung), Monate ohne Heizpatrone
          let frei = pool;
          if (H.reserve_kw) frei = Math.max(0, pool - H.reserve_kw * 250);
          if (H.schwelle_kw && pool < H.schwelle_kw * 250) frei = 0;   // Einschaltschwelle: erst ab X kW, dann alles
          if (H.aus_monate && H.aus_monate.includes(m)) frei = 0;
          if (H.aus_stunden && H.aus_stunden.includes(stunde[i])) frei = 0;   // Zeitsperre (Uhrzeit)
          hp = Math.min(hp0, frei); pool -= hp;
          const fehlt = hp0 - hp;
          sum.waerme_fehlt += fehlt;
          if (!pm) schuld += fehlt * W.ersatz_monat[String(m)] / W.cop;
        } else if (schritt === 'tops') {
          G = pool;
          // Autos am Wohnungszähler: fester Anteil + PV-Überschuss, den die Wohnungen gerade nicht brauchen
          let frei = pool;
          for (const t of TOPS) frei -= bedarf[t];
          for (const x of autos) if (x.a.ort === 'top') frei -= x.p * (tf[x.a.top] === null ? 1 : tf[x.a.top]);
          frei = Math.max(0, frei);
          for (const x of autos) {
            if (x.a.ort !== 'top' || !x.plan.anwesend[i] || !x.angesteckt) continue;
            if (x.a.strategie === 'pv') {
              let p = Math.min(frei, x.cap - x.p, (x.bisZiel || 0) - x.p, lmRest);
              if (p < x.pmin) p = 0;
              x.p += p; lmRest -= p; frei -= p;
            }
            const t = x.a.top;
            vT[t] += x.p;
            bedarf[t] += x.p * (tf[t] === null ? 1 : tf[t]);
          }
          eSum = verteile(V.modell, pool, bedarf, schl, e); pool -= eSum;
          for (const x of autos) {   // PV-Anteil des Autos = Anteil am Bedarf des Tops
            if (x.a.ort === 'top' && x.p > 0 && bedarf[x.a.top] > 0) {
              const t = x.a.top, anteil = x.p * (tf[t] === null ? 1 : tf[t]) / bedarf[t];
              x.st.aus_pv += e[t] * anteil;
            }
          }
        } else if (schritt === 'batterie') {
          ladung = Math.min(pool, B.lade_wh, (B.kapazitaet_wh - soc) / B.eta_lade);
          soc += ladung * B.eta_lade; pool -= ladung;
        }
      }
      const rest = pool;
      if (pm) pm.waerme(i, wpNeu, hp);

      // 3. Batterie entladen
      let entl = 0, entlTops = 0;
      if (B) {
        entl = Math.min(bezug, B.entlade_wh, Math.max(0, soc - B.reserve_wh) * B.eta_entlade);
        soc -= entl / B.eta_entlade; bezug -= entl;
        if (B.versorgt === 'allgemein_und_tops') {
          let R = 0; const r = {};
          for (const t of TOPS) { r[t] = Math.max(0, bedarf[t] - e[t]); R += r[t]; }
          entlTops = Math.min(R, B.entlade_wh - entl, Math.max(0, soc - B.reserve_wh) * B.eta_entlade);
          if (entlTops > 0) {
            for (const t of TOPS) e[t] += r[t] * entlTops / R;
            soc -= entlTops / B.eta_entlade;
          }
        }
        const d = tag[i]; alleTage.add(d);
        if (soc >= B.kapazitaet_wh * 0.99) tageVoll.add(d);
        if (soc <= B.reserve_wh + B.kapazitaet_wh * 0.01) tageLeer.add(d);
      }

      // E-Autos: Ladestand, Statistik
      let evSumme = 0;
      for (const x of autos) evSumme += x.p;
      evSpitze = Math.max(evSpitze, evSumme);
      for (const x of autos) {
        if (x.p > 0) {
          x.soc += x.p * x.eta; x.st.geladen += x.p;
          if (!x.ladeVorher) { x.st.sitzungen++; x.st.start_stunden[stunde[i]]++; }
        }
        x.ladeVorher = x.p > 0;
        if (x.a.ort === 'top' && vT[x.a.top] > netzWohnung) x.st.ueber_netzleistung++;
      }

      // Kontrolle: PV − Allgemeinverbrauch(gemessen) = (G0 + hp0) − B0  ⇒ Bilanz muss aufgehen
      const bilanz = (G0 + hp0 - B0) + bezug + entl - extra + minder - hp - eSum - ladung - rest;
      maxBilanz = Math.max(maxBilanz, Math.abs(bilanz));

      // Summen und Geld
      const snap = istSnap(m, stunde[i], P);
      const pTop = snap ? P.bezug_top_snap : P.bezug_top;
      const pEinsp = P.einspeisung_monat[String(m)];
      for (const t of TOPS) {
        const x = top[t];
        x.verbrauch += vT[t]; x.bedarf += bedarf[t]; x.genutzt += e[t];
        if (snap) { x.verbrauch_snap += vT[t]; x.genutzt_snap += e[t]; }
        x.ersparnis += e[t] / 1000 * pTop;
        x.kosten += (vT[t] - e[t]) / 1000 * pTop;
      }
      for (const x of autos) {
        if (x.p <= 0) continue;
        const preisNetz = x.a.ort === 'allgemein' ? P.bezug_allg : pTop;
        const pvJetzt = x.a.ort === 'allgemein' ? x.p * (extra > 0 ? ausPool / extra : 0)
          : (bedarf[x.a.top] > 0 ? e[x.a.top] * x.p * (tf[x.a.top] === null ? 1 : tf[x.a.top]) / bedarf[x.a.top] : 0);
        x.st.kosten += (x.p - pvJetzt) / 1000 * preisNetz + pvJetzt / 1000 * P.intern;
      }
      const eGes = eSum + entlTops;
      sum.ueberschuss += G; sum.genutzt += eGes; sum.rest += rest; sum.bezug_allg += bezug;
      sum.heizpatrone += hp; sum.heizpatrone_ist += hp0; sum.ladung += ladung; sum.entladung += entl;
      sum.entladung_tops += entlTops;
      eur.allg += bezug / 1000 * P.bezug_allg;
      eur.einspeisung += rest / 1000 * pEinsp;

      if (!monate[m]) monate[m] = { ueberschuss: 0, genutzt: 0, rest: 0, bezug_allg: 0, heizpatrone: 0 };
      const mo = monate[m];
      mo.ueberschuss += G; mo.genutzt += eGes; mo.rest += rest; mo.bezug_allg += bezug; mo.heizpatrone += hp;
      if (det) { det.genutzt[i] = eGes; det.rest[i] = rest; det.bezug_allg[i] = bezug; det.soc[i] = soc; }
    }

    // Umrechnen in kWh und Geldflüsse
    const kwh = x => x / 1000;
    for (const k in sum) sum[k] = kwh(sum[k]);
    for (const m in monate) for (const k in monate[m]) monate[m][k] = kwh(monate[m][k]);
    const einnahmenIntern = sum.genutzt * P.intern;
    const hauskasse = { intern: einnahmenIntern, einspeisung: eur.einspeisung, allgemeinstrom: eur.allg,
      summe: einnahmenIntern + eur.einspeisung - eur.allg };
    const tops = {};
    let topsKosten = 0, topsErsparnis = 0;
    for (const t of TOPS) {
      const x = top[t], zahlung = kwh(x.genutzt) * P.intern;
      topsKosten += x.kosten; topsErsparnis += x.ersparnis;
      tops[t] = {
        verbrauch: kwh(x.verbrauch), bedarf: kwh(x.bedarf), genutzt: kwh(x.genutzt),
        verbrauch_snap: kwh(x.verbrauch_snap), genutzt_snap: kwh(x.genutzt_snap),
        netzbezug: kwh(x.verbrauch - x.genutzt),
        ersparnis: x.ersparnis, netzkosten: x.kosten, zahlung_intern: zahlung,
        anteil_hauskasse: s.anteile[t] * hauskasse.summe,
        netto: x.ersparnis - zahlung + s.anteile[t] * hauskasse.summe,
      };
    }
    sum.ersparnis_tops = topsErsparnis;
    const kosten = {   // arbeitsabhängige Stromkosten des ganzen Hauses (€ brutto, ohne Grund-/Messpreise)
      allgemeinstrom: eur.allg, tops: topsKosten, einspeisung: eur.einspeisung,
      haus: eur.allg + topsKosten - eur.einspeisung,
    };
    let bat = null;
    if (B) {
      const kapK = B.kapazitaet_wh / 1000;
      bat = { ladung: sum.ladung, entladung: sum.entladung + sum.entladung_tops,
        verluste: sum.ladung - (sum.entladung + sum.entladung_tops) - soc / 1000,
        vollzyklen: (sum.entladung + sum.entladung_tops) / kapK,
        tage_voll: tageVoll.size, tage_leer: tageLeer.size, tage: alleTage.size, standby: sum.standby };
    }
    const eautos = autos.map(x => {
      const st = x.st, kwhGel = st.geladen / 1000;
      return { name: st.name, profil: x.a.profil, ort: x.a.ort, top: x.a.top, strategie: x.a.strategie,
        km: st.km, fahrten: st.fahrten, geladen: kwhGel, aus_pv: st.aus_pv / 1000,
        pv_anteil: kwhGel > 0 ? st.aus_pv / st.geladen : 0, auswaerts: st.auswaerts / 1000,
        sitzungen: st.sitzungen, start_stunden: st.start_stunden, kosten: st.kosten,
        kosten_100km: st.km > 0 ? st.kosten / st.km * 100 : 0,
        viertelstunden_ueber_netzleistung: st.ueber_netzleistung };
    });
    return {
      summe: sum, tops, monate, hauskasse, kosten, batterie: bat, eautos, eauto_spitze_kw: evSpitze * 4 / 1000,
      waerme: { heizpatrone: sum.heizpatrone, heizpatrone_ist: sum.heizpatrone_ist, fehlt: sum.waerme_fehlt,
        wp_nachheizen: sum.wp_nachheizen, offen: kwh(schuld), modell: pm ? 'puffer' : 'ersatzfaktor',
        ...(pm ? { wp_modell: kwh(wpModell), starts: pm.starts, temp_ende: pm.T } : {}) },
      kontrollen: { bilanz_max_wh: maxBilanz },
      details: det,
    };
  }

  return { TOPS, REIHENFOLGEN, PROFILE, ausKonfiguration, batterie, eauto, fahrplan, schluesselAusAnteilen, kopie,
    zeitraum, zeitfelder, verteile, istSnap, puffer, simuliere };
});
