# Etappe 2 – Verteilung: fix oder dynamisch?

Referenzjahr **2025** · Rechenkern `simulation/kern.js` · Preise brutto (Tops 22,15 ct, im SNAP-Fenster 20,52 ct;
Einspeisung Monatswerte 2025, Ø 6,75 ct) · Kontrolle K9 bestanden: Szenario S0 trifft die tatsächliche Verteilung
der HALLAG in jeder Viertelstunde und für jedes Top auf ±2 Wh.

In dieser Etappe ändert sich **nur die Verteilung** – Wärmepumpe, Heizpatrone und Überschuss bleiben wie gemessen
(16.327 kWh Überschuss 2025).

## Überblick

| Szenario | von Tops genutzt | Änderung | Restüberschuss | Ersparnis Tops | Einspeisevergütung | **Haus gesamt** | Änderung |
|---|---:|---:|---:|---:|---:|---:|---:|
| S0 · fix, wie heute (Schlüssel HALLAG, Top 10 mit 17 %) | 2.998 kWh | 0 kWh | 13.330 kWh | 639 € | 894 € | **1.533 €** | 0 € |
| S1 · fix, Schlüssel nach 1.107 Anteilen | 3.003 kWh | +6 kWh | 13.324 kWh | 640 € | 894 € | **1.534 €** | +1 € |
| S2 · **dynamisch** | 3.858 kWh | +860 kWh | 12.470 kWh | 823 € | 834 € | **1.657 €** | +124 € |
| S3a · fix, Top 10 mit 50 % | 3.354 kWh | +357 kWh | 12.973 kWh | 715 € | 870 € | **1.584 €** | +51 € |
| S3b · fix, Top 10 mit 100 % | 3.769 kWh | +771 kWh | 12.558 kWh | 803 € | 841 € | **1.644 €** | +111 € |
| S3c · dynamisch, Top 10 mit 50 % | 4.207 kWh | +1.210 kWh | 12.120 kWh | 898 € | 810 € | **1.707 €** | +174 € |
| S3d · dynamisch, Top 10 mit 100 % | 4.710 kWh | +1.712 kWh | 11.617 kWh | 1.005 € | 775 € | **1.779 €** | +246 € |

*Haus gesamt* = was die Tops beim Netzbezug sparen + was die Hauskasse für den Restüberschuss bekommt. Der interne PV-Preis ändert diese Summe nicht – er verschiebt nur Geld zwischen Tops und Hauskasse.

## Warum nicht mehr?

Dynamisch ist das **Maximum**, das ohne Batterie und ohne Verbrauchsverschiebung möglich ist: in jeder Viertelstunde bekommen die Tops so viel, wie sie gerade verbrauchen – solange Überschuss da ist.

- In 6.190 von 13.310 Viertelstunden mit Überschuss (47 %) ist der Bedarf **aller** Tops gedeckt und es bleibt trotzdem Überschuss übrig.
- Selbst dynamisch gehen 12.470 kWh (76 % des Überschusses) ins Netz – der Überschuss fällt vor allem mittags an, wenn in den Wohnungen wenig verbraucht wird.
- Von 18.232 kWh Verbrauch der Tops (der für die Verteilung zählt) können dynamisch 21 % aus der PV gedeckt werden (fix: 16 %).

## Je Top: fix (S0) vs. dynamisch (S2)

| Top | Verbrauch | genutzt fix | genutzt dynamisch | Änderung | PV-Anteil am Verbrauch fix → dyn. | Ersparnis fix | Ersparnis dyn. | Änderung |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2.003 | 353 | 432 | +79 kWh | 18 % → 22 % | 75 € | 92 € | +17 € |
| 2 | 994 | 164 | 206 | +42 kWh | 17 % → 21 % | 35 € | 44 € | +9 € |
| 3 | 2.183 | 396 | 536 | +140 kWh | 18 % → 25 % | 84 € | 114 € | +30 € |
| 4 | 3.660 | 470 | 753 | +283 kWh | 13 % → 21 % | 100 € | 160 € | +60 € |
| 5 | 896 | 134 | 148 | +14 kWh | 15 % → 17 % | 29 € | 32 € | +3 € |
| 6 | 1.895 | 208 | 302 | +94 kWh | 11 % → 16 % | 44 € | 64 € | +20 € |
| 7 | 1.636 | 273 | 356 | +83 kWh | 17 % → 22 % | 58 € | 76 € | +18 € |
| 8 | 2.146 | 453 | 554 | +101 kWh | 21 % → 26 % | 97 € | 118 € | +22 € |
| 9 | 1.917 | 312 | 360 | +48 kWh | 16 % → 19 % | 67 € | 77 € | +10 € |
| 10 | 5.351 | 234 | 211 | -23 kWh | 4 % → 4 % | 50 € | 45 € | -5 € |
| **Σ** | | **2.998** | **3.858** | **+860 kWh** | | **639 €** | **823 €** | **+184 €** |

## Wer gewinnt? Netto-Änderung je Top beim Wechsel fix → dynamisch

Netto = Ersparnis beim Netzbezug − Zahlung an die Hauskasse (interner PV-Preis × genutzte kWh) + Anteil am
Ergebnis der Hauskasse (interne Einnahmen + Einspeisevergütung, verteilt nach den 1.107 Anteilen).

Spalte „0 ct“ entspricht dem heutigen Stand (die Tops zahlen nichts für den PV-Strom).

| Top | 0 ct | 7 ct | 12 ct | 17 ct | 22 ct |
|---|---:|---:|---:|---:|---:|
| 1 | +11 € | +11 € | +12 € | +12 € | +12 € |
| 2 | +5 € | +6 € | +7 € | +7 € | +8 € |
| 3 | +25 € | +20 € | +17 € | +14 € | +11 € |
| 4 | +52 € | +40 € | +32 € | +23 € | +15 € |
| 5 | -2 € | +2 € | +5 € | +7 € | +10 € |
| 6 | +16 € | +14 € | +12 € | +10 € | +8 € |
| 7 | +13 € | +12 € | +11 € | +11 € | +10 € |
| 8 | +15 € | +15 € | +14 € | +14 € | +14 € |
| 9 | +3 € | +7 € | +10 € | +13 € | +16 € |
| 10 | -15 € | -3 € | +5 € | +13 € | +21 € |
| *Änderung der Hauskasse (oben bereits anteilig enthalten)* | -60 € | 0 € | +43 € | +86 € | +129 € |
| **Σ** | **+124 €** | **+124 €** | **+124 €** | **+124 €** | **+124 €** |

## Monate: von den Tops genutzt

| Monat | Überschuss | fix | dynamisch | Änderung |
|---|---:|---:|---:|---:|
| 01 | 289 | 89 | 123 | +34 |
| 02 | 871 | 203 | 260 | +57 |
| 03 | 1.491 | 273 | 340 | +67 |
| 04 | 2.343 | 391 | 474 | +83 |
| 05 | 1.958 | 361 | 479 | +118 |
| 06 | 2.674 | 399 | 510 | +111 |
| 07 | 1.912 | 353 | 468 | +115 |
| 08 | 2.055 | 342 | 442 | +100 |
| 09 | 1.405 | 277 | 348 | +71 |
| 10 | 857 | 183 | 250 | +67 |
| 11 | 434 | 105 | 136 | +31 |
| 12 | 39 | 22 | 27 | +5 |

## Gegenprobe: letzte 12 Monate (Sep 2025 – Aug 2026)

| | fix | dynamisch | Änderung |
|---|---:|---:|---:|
| von Tops genutzt | 2.925 kWh | 3.769 kWh | +844 kWh |
| Haus gesamt | 1.515 € | 1.638 € | +123 € |

