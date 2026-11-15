# Wärmemodell: Pufferspeicher und Wärmepumpe (Viertelstunden)

Fühler in der Mitte des CombiSol (1.350 l). Daten 2024–2026, Wetter GeoSphere Austria.

## 1. Energiebilanz am Fühler

| Jahreszeit | 1 kWh WP-Strom hebt den Fühler um | 1 kWh Heizpatrone hebt um | **ersetzt WP-Strom** | R² |
|---|---:|---:|---:|---:|
| Winter | 3,70 K | 1,82 K | **0,49 kWh** | 0,49 |
| Übergang | 3,56 K | 1,04 K | **0,29 kWh** | 0,44 |
| Sommer | 2,64 K | 0,83 K | **0,32 kWh** | 0,40 |

„ersetzt WP-Strom“ = so viel Wärmepumpenstrom spart 1 kWh Heizpatrone (am Fühler gemessen).

## 2. Gelernte Regelung der Wärmepumpe

Start-/Stopptemperatur am Mittelfühler (Median) und Strom im Lauf, je Zustand:

| Außentemperatur bis | Tag: Start / Stopp | Nacht (22–5 Uhr): Start / Stopp | Heizpatrone läuft: Start / Stopp | Strom im Lauf (Tag) |
|---|---:|---:|---:|---:|
| 0 °C | 43,3 / 50,3 °C | 42,4 / 43,3 °C | 43,8 / 52,0 °C | 6,1 kW |
| 5 °C | 41,0 / 50,4 °C | 39,5 / 41,3 °C | 43,0 / 52,4 °C | 5,9 kW |
| 10 °C | 39,0 / 50,6 °C | 36,2 / 39,8 °C | 43,6 / 53,2 °C | 5,7 kW |
| 15 °C | 39,0 / 51,9 °C | 34,4 / 38,4 °C | 46,2 / 54,7 °C | 5,4 kW |
| 20 °C | 45,3 / 53,1 °C | 33,0 / 39,2 °C | 52,3 / 55,5 °C | 5,4 kW |
| 45 °C | 51,1 / 53,1 °C | 33,0 / 39,2 °C | 54,3 / 56,5 °C | 5,4 kW |

Zeitprogramm (Abweichung der Schaltpunkte je Uhrzeit, ohne Heizpatrone):

| Uhr | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Start | -0,1 | -0,2 | -0,2 | 0,2 | 0,3 | 0,1 | 2,4 | -0,9 | -1,1 | -0,1 | -0,9 | -0,1 | -0,7 | -0,6 | 1,0 | -0,6 | 1,5 | 0,7 | 0,2 | -0,2 | 0,4 | -0,3 | 0,1 | -0,0 |
| Stopp | -0,1 | -0,7 | -0,4 | -0,1 | -0,3 | -9,5 | 2,6 | -1,6 | -1,1 | -0,7 | -0,2 | 0,5 | 0,0 | 0,1 | 6,2 | 2,0 | -3,0 | -1,1 | -0,6 | -1,0 | -0,2 | -0,0 | 1,8 | -0,6 |

Mindestlaufzeit 2 Viertelstunden, Mindestpause 1 Viertelstunde.

## 3. Prüfung: Modell steuert 2025 selbst (Heizpatrone wie gemessen)

| | Messung | Modell | Abweichung |
|---|---:|---:|---:|
| Wärmepumpenstrom | 15.596 kWh | 15.537 kWh | -0,4 % |
| Starts pro Tag | 8,5 | 7,8 | |
| Anteil WP-Strom 9–17 Uhr | 27 % | 25 % | |
| Fühler Median / 5 % / 95 % | 47,3 / 35,9 / 60,0 °C | 47,3 / 35,7 / 60,4 °C | |

| Monat | Messung | Modell | Abw. |
|---|---:|---:|---:|
| 01 | 2.253 kWh | 2.253 kWh | -0,0 % |
| 02 | 1.793 kWh | 1.775 kWh | -1,0 % |
| 03 | 1.660 kWh | 1.661 kWh | 0,1 % |
| 04 | 1.084 kWh | 1.081 kWh | -0,2 % |
| 05 | 921 kWh | 922 kWh | 0,1 % |
| 06 | 462 kWh | 463 kWh | 0,3 % |
| 07 | 555 kWh | 561 kWh | 1,0 % |
| 08 | 457 kWh | 457 kWh | -0,1 % |
| 09 | 605 kWh | 609 kWh | 0,7 % |
| 10 | 1.437 kWh | 1.435 kWh | -0,1 % |
| 11 | 2.036 kWh | 2.037 kWh | 0,1 % |
| 12 | 2.333 kWh | 2.283 kWh | -2,1 % |

## 4. Variante: Heizpatrone nur Notheizung (aus)

| | Modell, Heizpatrone wie gemessen | Modell, Heizpatrone aus | Unterschied |
|---|---:|---:|---:|
| Wärmepumpenstrom | 15.537 kWh | 17.881 kWh | **2.343 kWh** |
| je kWh Heizpatrone (gemessen 6.895 kWh) | | | 0,34 kWh |
| Starts pro Tag | 7,8 | 8,3 | |
| Betriebsstunden | 2.698 h | 3.152 h | 454 h |
| Anteil WP-Strom 9–17 Uhr | 25 % | 32 % | |
| Fühler Median / 95 % | 47,3 / 60,4 °C | 45,6 / 56,1 °C | |

## 5. Robustheit

Mehrverbrauch der Wärmepumpe bei „Heizpatrone aus“, wenn die gelernte Regelung verändert wird:

| Mindestlauf | Schaltabstand enger um | Starts/Tag (Messung 8,5) | Mehrverbrauch |
|---:|---:|---:|---:|
| 1 | 0 K | 8,5 | 2.344 kWh |
| 1 | 2 K | 10,3 | 2.343 kWh |
| 2 | 0 K | 7,8 | 2.343 kWh |
| 3 | 0 K | 6,6 | 2.342 kWh |
| 3 | 2 K | 7,2 | 2.341 kWh |

Hinweis: Der Jahresstrom der Wärmepumpe stimmt im Prüflauf fast genau, weil die Wärmeentnahme aus denselben Messungen rekonstruiert ist – das ist eine Bilanzprobe, keine unabhängige Prüfung. Unabhängig geprüft werden Zeitpunkte (Anteil 9–17 Uhr), Starts und Temperaturverlauf.
