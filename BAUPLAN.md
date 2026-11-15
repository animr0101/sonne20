# Bauplan: Simulation PV · Verteilung · Speicher · E-Autos

**Haus:** Gaislöd 5, Absam · 10 Tops · Gemeinschaftliche Erzeugungsanlage (GEA, EC-ID GC102578)
**Netzbetreiber / Lieferant:** HALLAG Kommunal GmbH
**Stand:** Entwurf zur Durchsicht – noch kein Code geschrieben

---

## 1. Ziel

Eine nachvollziehbare Simulation, die für die Hausgemeinschaft beantwortet:

1. **Wie läuft unsere Anlage heute?** (Ist-Zustand, mit echten Zahlen)
2. **Was bringt die dynamische Verteilung** gegenüber dem fixen Schlüssel?
3. **Lohnt sich ein Batteriespeicher** – und wenn ja, welche Größe?
4. **Was ändert sich mit E-Autos** an den Stellplätzen?
5. **Was bringen günstige Maßnahmen ohne Investition** (Heizpatrone, Wärmepumpe, Top 10)?
6. **Wer gewinnt wie viel?** – pro Top und für die Hauskasse, bei frei wählbarem internem PV-Preis

Ergebnis ist eine **Präsentation zum Durchklicken** mit Schiebereglern, die man in der Versammlung live bedienen kann.

## 2. Grundsätze

| Grundsatz | Bedeutung |
|---|---|
| **Messwerte vor Annahmen** | Alles, was gemessen wurde, wird verwendet. Annahmen nur, wo es keine Messung gibt – und dann sichtbar gekennzeichnet. |
| **Erst nachrechnen, dann simulieren** | Bevor ein Szenario gerechnet wird, muss das Modell den Ist-Zustand exakt treffen (Zähler, EDA-Abrechnung, Rechnungen). |
| **Automatische Kontrollen** | Jede Rechnung prüft sich selbst (Abschnitt 5). Schlägt eine Kontrolle fehl, wird **kein** Ergebnis angezeigt. |
| **Brutto** | Alle Preise inkl. 20 % USt. Umschaltbar auf netto, falls die WEG vorsteuerabzugsberechtigt ist. |
| **Bandbreiten statt Scheingenauigkeit** | Wo Annahmen das Ergebnis stark beeinflussen, wird eine Spanne gezeigt. |
| **Einfach vor kompliziert** | Zuerst einfache, prüfbare Modelle. Verfeinern nur, wenn das einfache Modell zeigt, dass es darauf ankommt. |

## 3. Datenquellen

| Quelle | Ordner | Liefert | Auflösung |
|---|---|---|---|
| Allgemeinzähler (HALLAG) | `Allgemein/` | Netzbezug Allgemein, Einspeisung, Restüberschuss | 15 min |
| EDA-Portal | `EDA/` | Verbrauch je Top, Teilnahmefaktor, zugeteilter Anteil, Eigendeckung, Restüberschuss | 15 min |
| Smartfox | `Smartfox_Automatisch/1_Tages_Rohdaten/` | PV-Erzeugung, Heizpatrone, Temperatur, Relais | 30 s → auf 15 min gemittelt |
| Rechnungen (PDF) | – | Preise, Kontrollsummen | Jahr / Monat |

Nicht mehr benötigt (inhaltsgleiche Kopien): `EDA_CSV_Fertig/`, `EDA_Excel_Dateien/`, `HallAG_Allgemein_CSV/`, `Smartfox/`, `Smartfox_Automatisch/2_Monats_Zusammenfassung/`. Werden nicht gelöscht – Entscheidung liegt bei dir.

**Referenzjahr:** Kalenderjahr **2025** (vollständig, Top 10 ganzjährig dabei, Rechnungen zur Kontrolle vorhanden). Umschaltbar auf 2024 oder die letzten 12 Monate (Sep 2025 – Aug 2026).

## 4. Datenmodell (Ist-Zustand) – pro Viertelstunde

### 4.1 Gemessen

| Größe | Quelle |
|---|---|
| `bezug_allg` – Netzbezug Allgemeinzähler | Allgemein |
| `einspeisung` – Überschuss am Allgemeinzähler (= Erzeugung der GEA) | Allgemein / EDA |
| `pv` – PV-Erzeugung | Smartfox |
| `heizpatrone` – Leistung der Heizpatrone (nur PV) | Smartfox |
| `verbrauch_top[1..10]` – Verbrauch je Top | EDA |
| `teilnahme_top[1..10]` – Verbrauch lt. Teilnahmefaktor | EDA |
| `anteil_top`, `eigendeckung_top`, `rest` – tatsächliche Verteilung | EDA |

### 4.2 Abgeleitet

```
verbrauch_allg  = pv − einspeisung + bezug_allg − heizpatrone     (Wärmepumpe + Grundlast)
wp              = Anteil von verbrauch_allg über der Grundlast, wenn Wärmepumpe läuft
                  (Erkennung über Leistungssprung, Schwelle ~3 kW)
grundlast_allg  = verbrauch_allg − wp
```

### 4.3 Lücken

- Smartfox fehlt an 3 ganzen und ~4 Teiltagen. Dort wird `pv` aus den Zählerwerten geschätzt
  (`einspeisung − bezug_allg + typischer Allgemeinverbrauch derselben Uhrzeit`) und **als geschätzt markiert**.
- Fehlende letzte Viertelstunde je Monat im Allgemein-Export: Einspeisung aus EDA, Bezug aus Tageszählerstand.
- Zeitumstellung: März-Stunde fehlt (korrekt), Oktober-Doppelstunde ist bei Zähler/EDA zusammengefasst – Smartfox wird gleich behandelt.

## 5. Kontrollen (laufen bei jeder Berechnung automatisch)

| Nr. | Kontrolle | Toleranz |
|---|---|---|
| K1 | Jahressumme Netzbezug / Einspeisung = Rechnung HALLAG (2024, 2025) | ±0,1 % |
| K2 | Summe 15-min-Werte = Differenz der Tageszählerstände (über den Zeitraum) | ±0,1 % |
| K3 | EDA-Erzeugung = Einspeisung Allgemeinzähler, je Viertelstunde | ±1 Wh |
| K4 | EDA: Erzeugung = Σ Eigendeckung + Restüberschuss, je Viertelstunde | ±5 Wh (Rundung der HALLAG-Daten) |
| K5 | **Nachgerechnete statische Verteilung = tatsächliche EDA-Eigendeckung**, je Viertelstunde und Top | ±2 Wh ✅ *(bereits geprüft: 0 Abweichungen)* |
| K6 | `verbrauch_allg` nie negativ, nie über Hausanschluss (25 kW) | – |
| K7 | Smartfox-Netzbezug vs. Zähler je Monat | ±5 % (Info) |
| K8 | Energiebilanz jedes Szenarios geht auf (Erzeugung = Verbrauch + Speicher­änderung + Verluste + Einspeisung) | ±1 Wh |
| K9 | Szenario „nichts ändern“ liefert exakt den Ist-Zustand | ±1 Wh |
| K10 | E-Auto-Modell bildet das echte Ladeverhalten von Top 4 plausibel nach (Menge, Uhrzeiten) | ±15 % |

Ergebnis: ein **Prüfbericht**, dessen Kurzfassung als „Prüfstempel“ in der Präsentation erscheint.

## 6. Simulationskern

### 6.1 Reihenfolge der Energieflüsse (je Viertelstunde, einstellbar)

```
PV-Erzeugung
  └─▶ 1. Allgemeinverbrauch (Grundlast + Wärmepumpe)         ← hinter dem Allgemeinzähler
  └─▶ 2. Heizpatrone                (Position 2 oder 4 wählbar)
  └─▶ 3. Batterie laden             (falls vorhanden; Position wählbar)
  └─▶ 4. Verteilung an die Tops     (statisch oder dynamisch)
          inkl. E-Autos, sofern Wallbox am Wohnungszähler
  └─▶ 5. Restüberschuss ins Netz

Bedarf ohne PV
  └─▶ Batterie entladen  → Allgemein (und ggf. Tops, siehe 6.3)
  └─▶ sonst Netzbezug
```

### 6.2 Verteilung an die Tops

| Modell | Regel |
|---|---|
| **Statisch** | Top *i* bekommt `Schlüssel_i × Überschuss`, genutzt wird `min(Anteil, Verbrauch × Teilnahmefaktor)`. Rest ins Netz. |
| **Dynamisch** | Überschuss wird nach aktuellem Verbrauch aufgeteilt: `genutzt_i = Verbrauch_i × Teilnahmefaktor_i × min(1, Überschuss / Σ Verbrauch)` |

Einstellbar: Schlüssel (aktuell lt. HALLAG / lt. 1.107 Anteilen / frei), Teilnahmefaktor Top 10 (aktuell 17 %).
⚠️ Die exakte Regel der HALLAG für „dynamisch“ wird vor der Präsentation geprüft.

### 6.3 Batteriespeicher

| Parameter | Standard | Hinweis |
|---|---|---|
| Kapazität (nutzbar) | 10 kWh | Regler, z. B. 5–40 kWh |
| Lade- / Entladeleistung | 10 kW | **getrennt einstellbar** – wichtig wegen Wärmepumpe (bis 11 kW) |
| Wirkungsgrad (Ladung + Entladung) | 90 % | |
| Mindest-Ladestand / Notstrom-Reserve | 0 % | |
| Alterung | 2 % Kapazität pro Jahr | |
| **Wen versorgt die Batterie?** | nur Allgemein | Option „auch Tops über die Verteilung“ – ⚠️ **rechtlich zu prüfen** |
| Anschluss | AC-gekoppelt | SolarEdge SE25K ist kein Hybrid-Wechselrichter → eigener Batteriewechselrichter nötig |

Kennzahlen: Vollzyklen, Stunden leer/voll, eingesparter Netzbezug, entgangene Einspeisung.

### 6.4 Heizpatrone & Wärmepumpe (einfaches Wärmemodell)

- Die Heizpatrone bekommt nur PV-Strom (bestätigt).
- Wird ihr PV-Strom weggenommen (durch Batterie oder Verschiebung hinter die Tops), fehlt dem Puffer Wärme.
  Diese Wärme liefert stattdessen die Wärmepumpe: **zusätzlicher Strom = fehlende Wärme ÷ COP**,
  verteilt auf die nächsten Wärmepumpen-Läufe (innerhalb von 24 h).
- Wärmepumpe: **Hoval Thermalia dual H (35)**, Sole/Wasser (Erdwärme), 2 Verdichter, Bj. 2017.
  Typenschild: 34,98 kW Wärme bei 8,17 kW Strom (B0/W35) → COP 4,3 bei 35 °C Vorlauf.
  Im Betrieb (Puffer 40–60 °C) ist der COP niedriger → **Standard 3,5**, Regler 2,5–4,5.
- Puffer: **Hoval CombiSol R (1400), 1.350 Liter**, Warmwasser über Durchlauf-Wärmetauscher,
  Wärmeverlust 107 W. Speichervermögen ≈ 1,57 kWh pro Grad (45→60 °C ≈ 24 kWh Wärme).
- **Ersatzfaktor** (Standard 80 %, Regler 50–100 %): Nicht jede kWh Heizpatronen-Wärme ersetzt Wärmepumpen-Wärme
  (im Sommer teils nur höhere Speichertemperatur + Verluste). Wird in Etappe 3 aus den Temperaturdaten geschätzt:
  Läuft die Wärmepumpe nach Tagen mit viel Heizpatronen-Wärme kürzer?
- **Temperaturdaten** (ein Fühler) dienen zum Verstehen (WP startet bei ~37–40 °C, Heizpatrone stoppt bei ~60 °C),
  zum Eichen des Ersatzfaktors und als Plausibilitätsprüfung – nicht für ein Schichtungsmodell.
- **Variante:** PV-Anhebung der Wärmepumpe *vor* der Heizpatrone (1 kWh PV → ~3 kWh Wärme statt 1 kWh).
- **Warmwasser-Vorgabe:** WP heizt meist bis 55 °C (Kalk), zeitweise 60 °C (Legionellen) – genaue Vorgabe wird erfragt.
  Szenarien dürfen diese Vorgaben nicht verletzen.
- Ein detailliertes Temperaturmodell kommt nur, wenn dieses einfache Modell zeigt, dass der Effekt relevant ist.

### 6.5 E-Autos

**Pro Auto einstellbar:**

| Parameter | Standard |
|---|---|
| Akkugröße | 60 kWh |
| Verbrauch | 18 kWh/100 km (Winter +25 %) |
| Fahrleistung | 12.000 km/Jahr |
| Fahrprofil | Pendler / Homeoffice / Wenigfahrer / Wochenende |
| Ankunft / Abfahrt | je Profil, mit etwas Zufall |
| Ziel-Ladestand / Mindest-Ladestand | 80 % / 30 % |
| Max. Ladeleistung | **11 kW** (frei einstellbar) |
| Min. Ladeleistung | 4,1 kW (dreiphasig); 1,4 kW wenn Phasenumschaltung |
| Ladeverluste | 10 % |
| Ladestrategie | Sofort / nur PV-Überschuss / PV + Mindestladung / im SNAP-Fenster |
| Anteil auswärts geladen | 0 % |
| Wallbox an | Wohnungszähler (Standard) / Allgemeinzähler |

**Haus:** Anzahl Autos, Lastmanagement (max. Summenleistung), Warnung bei Überschreiten der Netzbereitstellung (Wohnung 6 kW, Allgemein 25 kW).
**Eichung:** Top 4 (echtes E-Auto, ~1.650 kWh/Jahr, ~79 Ladungen) muss realistisch nachgebildet werden.
**Zufall:** fester Startwert (gleiche Eingabe → gleiches Ergebnis) + mehrere Läufe für eine Bandbreite.

## 7. Szenarien

| Nr. | Szenario | Investition |
|---|---|---|
| S0 | **Ist-Zustand nachgerechnet** (muss K9 erfüllen) | – |
| S1 | Fixer Schlüssel korrigiert (1.107 Anteile) | – |
| S2 | **Dynamische Verteilung** | – |
| S3 | Teilnahmefaktor Top 10 höher (z. B. 50 % / 100 %) | – |
| S4 | Heizpatrone hinter den Tops | – (Smartfox-Einstellung) |
| S5 | Wärmepumpe in Sonnenstunden verschieben | – (Steuerung) – *Phase 2, falls sinnvoll* |
| S6 | **Batteriespeicher** in mehreren Größen | ja |
| S7 | **E-Autos** (Anzahl, Profile, Strategien) | Wallboxen |
| S8 | Kombinationen (z. B. S2 + S4 + S6 + S7) | |

## 8. Wirtschaftlichkeit

### 8.1 Preise (brutto, Stand Rechnungen 2025/2026)

| Preis | Wert | Quelle |
|---|---|---|
| Netzbezug Allgemein | 25,77 ct/kWh | Jahresrechnung 2025 (21,48 netto) |
| Netzbezug Tops | 22,15 ct/kWh · SNAP (Apr–Sep, 10–16 h): 20,52 ct | Monatsrechnung Top 3, 09/2026 |
| Einspeisevergütung | Monatswerte 2025, Ø 6,75 ct (keine USt) | Jahresrechnung Einspeisung 2025 |
| Interner PV-Preis | **Regler**, sinnvoll ~7–22 ct | – |
| Fixkosten (Grundpreise, Messpreise) | bleiben unverändert | Rechnungen |

Alle Preise als Regler; zusätzlich jährliche Preisentwicklung (Standard +2 %/Jahr).
Einspeisevergütung wird **nur für den Restüberschuss** gerechnet (reguläre Abrechnung – siehe offene Punkte).

### 8.2 Geldflüsse

```
Top i:      Ersparnis = genutzte PV-kWh × Bezugspreis Top − genutzte PV-kWh × interner Preis
Hauskasse:  Einnahmen = Σ genutzte PV-kWh × interner Preis + Restüberschuss × Einspeisevergütung
            Ausgaben  = Allgemeinstrom + Investition / Wartung
Top i netto = Ersparnis + Anteil an Hauskassen-Ergebnis (nach 1.107 Anteilen)
```

→ Darstellung **pro Top**: Wer gewinnt, wer verliert – bei welchem internen Preis?

### 8.3 Investitionsrechnung (Batterie, Wallboxen)

| Parameter | Standard (Platzhalter bis Angebot) |
|---|---|
| Investition Batterie | Regler, €/kWh brutto inkl. Montage |
| Förderung | 0 € (Regler) |
| Lebensdauer | 15 Jahre |
| Zinssatz | 3 % |
| Wartung | 0 €/Jahr (Regler) |

Kennzahlen: Ersparnis/Jahr, **Amortisationszeit**, Gesamtergebnis über die Lebensdauer, **Break-even-Preis**
(„bis zu diesem Preis pro kWh Speicher rechnet es sich“), Empfindlichkeit gegenüber Strompreis.

## 9. Präsentation

### 9.1 Aufbau

1. **Unsere Anlage** – wie der Sonnenstrom fließt (Grafik), Rückblick 2021–2025 inkl. Erweiterung 2023
2. **Ist-Zustand 2025** – Erzeugung, Verbrauch, Verteilung, Restüberschuss; Beispieltage Sommer / Übergang / Winter
3. **Die Verteilung** – fix vs. dynamisch, Sonderfall Top 10
4. **Heizpatrone & Wärmepumpe** – wofür der Strom verwendet wird, was eine Umstellung bringt
5. **Batteriespeicher** – Größen im Vergleich, Wirtschaftlichkeit, Break-even
6. **E-Autos** – was mehr E-Autos für die PV-Nutzung bedeuten
7. **Wer gewinnt wie viel?** – pro Top, Hauskasse, interner Preis
8. **Empfehlung**
9. **Anhang** – Annahmen, Quellen, Prüfstempel

### 9.2 Bedienung

- Schieberegler: Strompreise, interner PV-Preis, Batteriegröße / -leistung / -preis, Anzahl E-Autos, Ladestrategie, Verteilungsmodell
- Alles auf Deutsch, verständlich ohne Vorwissen; jede Zahl mit Quelle oder als Annahme markiert
- Druck- / PDF-Version zum Verteilen

## 10. Technischer Aufbau

```
sonne/
├── BAUPLAN.md                  ← dieses Dokument
├── einstellungen.json          ← alle Standardwerte & Annahmen an einer Stelle (mit Quelle)
├── aufbereitung/               ← Python: Daten einlesen, Lücken füllen, Kontrollen K1–K7
│   ├── einlesen.py
│   ├── pruefen.py
│   └── ausgabe/                ← aufbereitete Viertelstunden-Daten + Prüfbericht
├── simulation/                 ← Rechenkern in JavaScript (läuft im Browser UND in den Tests)
│   ├── kern.js
│   └── tests/                  ← K5, K8, K9, K10 u. a.
├── praesentation/
│   └── index.html              ← interaktive Präsentation
└── alt/                        ← bisheriger AI-Studio-Code, nur zum Nachschlagen
```

**Warum der Rechenkern in JavaScript?** Damit die Regler in der Präsentation **live** neu rechnen
(ein Jahr = ~35.000 Viertelstunden, das dauert im Browser Millisekunden) und es trotzdem nur
**eine** Rechenlogik gibt, die automatisch getestet wird. Python übernimmt nur Einlesen und Prüfen.

Neue Monatsdaten: Dateien in die bestehenden Ordner legen → Aufbereitung neu starten → Kontrollen laufen mit.

## 11. Vorgehen in Etappen

Nach jeder Etappe gibt es einen kurzen Zwischenstand zur Durchsicht, bevor es weitergeht.

| Etappe | Inhalt | Ergebnis |
|---|---|---|
| 1 ✅ | Datenaufbereitung + Kontrollen K1–K7 | Prüfbericht, Ist-Zustand 2025 in Zahlen |
| 2 ✅ | Verteilung: statisch nachrechnen (K5, K9), dynamisch, Top 10 | Erste Antwort „fix vs. dynamisch“ |
| 3 ✅ | Heizpatrone, Wärmepumpe, Batterie | Antwort „lohnt sich ein Speicher?“ |
| 4 ✅ | E-Autos inkl. Eichung an Top 4 | E-Auto-Szenarien |
| 5 ✅ | Wirtschaftlichkeit, Geldflüsse pro Top | €-Ergebnisse |
| 6 ✅ | Präsentation | fertige interaktive Präsentation |

## 12. Offene Punkte

### Daten / Technik (von dir)

| Punkt | Wofür | Bis dahin |
|---|---|---|
| Wo sitzt der Temperaturfühler des Smartfox (oben/mitte/unten im Puffer)? | Wärmemodell (nur falls verfeinert) | – |
| Warmwasser: Mindest- und Legionellen-Temperatur (55 °C / zeitweise 60 °C?), wie oft? | Grenzen für Szenarien | 55 °C |
| PV: kWp und Ausrichtung | Präsentation | – |
| Batterie: Angebot (Preis, Größe, Leistung) | Wirtschaftlichkeit | Regler |

### Rechtlich / organisatorisch (vor der Präsentation zu klären)

| Punkt | Wer |
|---|---|
| Darf Strom aus einem Speicher in der GEA an die Tops verteilt werden? Was ändert das ElWG 2025? | ich recherchiere |
| Wie genau verteilt die HALLAG „dynamisch“, wie wird umgestellt, ab wann? | HALLAG |
| Einspeisevergütung wird auf die **gesamte** Einspeisung gezahlt (2025: 16.327 statt ~13.330 kWh Restüberschuss) – korrekt? | HALLAG |
| Fixer Schlüssel bei HALLAG weicht von den 1.107 Anteilen ab (Top 10: 16,88 % statt 16,26 %) | HALLAG |
| USt auf internen PV-Preis? Vorsteuerabzug der WEG? | Hausverwaltung / Steuerberatung |
| Ladeleistung pro Stellplatz vs. Netzbereitstellung 6 kW je Wohnung | HALLAG / Elektriker |
| Hausanschluss gesamt (Absicherung) – reicht er für mehrere Wallboxen gleichzeitig, braucht es Lastmanagement? | Elektriker |

### Bereits geklärt

- Alle Tops haben denselben Lieferanten (HALLAG) → einheitliche Preise
- Brutto-Rechnung mit 20 % USt
- Heizpatrone läuft nur mit PV-Strom
- Wallbox-Standard 11 kW, einstellbar
- PV-Anlage 2023 erweitert → Daten ab 2024 sind maßgeblich
- Interner PV-Preis fließt in die Hauskasse
- Wärmepumpe: Hoval Thermalia dual H (35), 2 Verdichter (Stufen ~4,7 / ~10 kW gemessen), kein Heizstab
- Puffer: Hoval CombiSol R, 1.350 l – **einziger Speicher** für Heizung und Warmwasser
- Wechselrichter: SolarEdge SE25K (25 kVA), **kein Hybrid-Wechselrichter** → Batterie nur AC-gekoppelt mit eigenem Batteriewechselrichter
