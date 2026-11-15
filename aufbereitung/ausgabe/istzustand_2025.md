# Ist-Zustand 2025

Quelle: aufbereitete Messdaten (Zähler HALLAG, EDA, Smartfox). Erstellt von `aufbereitung/pruefen.py`.
Preise brutto, Stand Rechnungen 2025/2026 (für alle Jahre gleich angesetzt).

## Wohin geht der Sonnenstrom?

| | kWh | Anteil an PV |
|---|---:|---:|
| **PV-Erzeugung** | **29.467** | 100 % |
| → direkt im Allgemeinstrom (Wärmepumpe, Grundlast) | 6.245 | 21 % |
| → Heizpatrone | 6.895 | 23 % |
| → Überschuss an die Gemeinschaft (Einspeisung Allgemeinzähler) | 16.327 | 55 % |
| &nbsp;&nbsp;&nbsp;→ davon von den Tops genutzt | 2.998 | 10 % |
| &nbsp;&nbsp;&nbsp;→ davon Restüberschuss ins Netz | 13.330 | 45 % |

## Woher kommt der Strom?

| | Verbrauch kWh | aus PV | aus dem Netz | PV-Anteil |
|---|---:|---:|---:|---:|
| Allgemeinstrom (ohne Heizpatrone) | 21.439 | 6.245 | 15.194 | 29 % |
| &nbsp;&nbsp;&nbsp;davon Wärmepumpe | 15.596 | | | |
| &nbsp;&nbsp;&nbsp;davon Grundlast (Lift, Licht, Lüftung, Pumpen …) | 5.843 | | | |
| Heizpatrone | 6.895 | 6.895 | 0 | 100 % |
| Tops 1–10 | 22.682 | 2.998 | 19.684 | 13 % |
| **Haus gesamt** | **51.016** | **16.137** | **34.878** | **32 %** |

Top 10 nimmt mit Teilnahmefaktor teil: von 22.682 kWh Verbrauch der Tops zählen 18.232 kWh für die Verteilung.

## Monate

| Monat | PV | Heizpatrone | Wärmepumpe | Grundlast | Netzbezug Allg. | Überschuss | von Tops genutzt | Restüberschuss | Ø Temp. Puffer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 01 | 985 | 225 | 2.253 | 638 | 2.420 | 289 | 89 | 199 | 45,3 °C |
| 02 | 1.833 | 399 | 1.793 | 559 | 1.789 | 871 | 203 | 667 | 46,8 °C |
| 03 | 2.716 | 568 | 1.660 | 565 | 1.567 | 1.491 | 273 | 1.218 | 47,3 °C |
| 04 | 3.697 | 738 | 1.084 | 414 | 882 | 2.343 | 391 | 1.953 | 49,2 °C |
| 05 | 3.346 | 794 | 921 | 338 | 665 | 1.958 | 361 | 1.597 | 49,3 °C |
| 06 | 4.067 | 825 | 462 | 420 | 315 | 2.674 | 399 | 2.275 | 53,8 °C |
| 07 | 3.220 | 748 | 555 | 422 | 417 | 1.912 | 353 | 1.559 | 51,9 °C |
| 08 | 3.323 | 754 | 457 | 444 | 387 | 2.055 | 342 | 1.713 | 51,8 °C |
| 09 | 2.505 | 676 | 605 | 392 | 573 | 1.405 | 277 | 1.128 | 49,1 °C |
| 10 | 1.871 | 520 | 1.437 | 429 | 1.373 | 857 | 183 | 675 | 45,6 °C |
| 11 | 1.107 | 299 | 2.036 | 571 | 2.233 | 434 | 105 | 329 | 45,1 °C |
| 12 | 797 | 347 | 2.333 | 651 | 2.573 | 39 | 22 | 17 | 44,4 °C |

## Tops

| Top | Verbrauch | zählt für Verteilung | zugeteilt | genutzt | Nutzung des Anteils | PV-Anteil am Verbrauch | Ersparnis (brutto) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2.003 | 2.003 | 1.582 | 353 | 22 % | 18 % | 75 € |
| 2 | 994 | 994 | 1.024 | 164 | 16 % | 17 % | 35 € |
| 3 | 2.183 | 2.183 | 1.478 | 396 | 27 % | 18 % | 84 € |
| 4 | 3.660 | 3.660 | 2.123 | 470 | 22 % | 13 % | 100 € |
| 5 | 896 | 896 | 1.289 | 134 | 10 % | 15 % | 29 € |
| 6 | 1.895 | 1.895 | 1.010 | 208 | 21 % | 11 % | 44 € |
| 7 | 1.636 | 1.636 | 1.289 | 273 | 21 % | 17 % | 58 € |
| 8 | 2.146 | 2.146 | 1.786 | 453 | 25 % | 21 % | 97 € |
| 9 | 1.917 | 1.917 | 1.992 | 312 | 16 % | 16 % | 67 € |
| 10 | 5.351 | 901 | 2.755 | 234 | 9 % | 4 % | 50 € |
| **Σ** | **22.682** | **18.232** | **16.327** | **2.998** | **18 %** | **13 %** | **639 €** |

## Geld (arbeitsabhängige Anteile, ohne Grund- und Messpreise)

| | € brutto |
|---|---:|
| Netzbezug Allgemeinstrom (15.194 kWh × 25,78 ct) | 3.916 € |
| Ersparnis der Tops durch PV-Zuteilung | 639 € |
| Einspeisevergütung, wie die HALLAG derzeit abrechnet (gesamte Einspeisung) | 1.102 € |
| Einspeisevergütung, regulär (nur Restüberschuss) | 894 € |

Hinweis: Die HALLAG vergütet derzeit die **gesamte** Einspeisung, obwohl ein Teil davon den Tops zugeteilt wird. Für die Simulation wird die reguläre Variante (nur Restüberschuss) verwendet – bitte mit der HALLAG klären.
