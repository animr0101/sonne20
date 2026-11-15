# Heizpatrone, Wärmepumpe und Batterie – mit dem Puffermodell

Erstellt 2026-11-15 · Referenzjahr 2025 · Preise wie in einstellungen.json, interner PV-Preis 12 ct · Modell: simulation/ausgabe/waermemodell.md

Das Puffermodell ersetzt die gemessene Wärmepumpe durch die nachgebildete Regelung (Fühler in der Mitte, Start/Stopp je Außentemperatur, Tageszeit und Heizpatrone). Damit reagiert die Wärmepumpe in jeder Viertelstunde auf das, was die Heizpatrone (nicht) liefert. Vergleiche deshalb immer mit dem Modelllauf „heute“, nicht mit der Messung.

## Modell „heute“ gegen Messung 2025

| | Messung | Modell | Abweichung |
|---|---:|---:|---:|
| Netzbezug Allgemein | 15 194 kWh | 15 603 kWh | +2,7 % |
| Einspeisung | 13 330 kWh | 13 977 kWh | +4,9 % |
| Wärmepumpenstrom | 15 596 kWh | 15 842 kWh | +1,6 % |
| Heizpatrone | 6 895 kWh | 6 076 kWh | −11,9 % |

Das Modell lässt die Wärmepumpe etwas seltener in der Sonnenzeit laufen als in Wirklichkeit (25 % statt 27 % des WP-Stroms zwischen 9 und 17 Uhr) – daher etwas mehr Netzbezug und Einspeisung. Für Vergleiche von Varianten spielt dieser gleichbleibende Versatz kaum eine Rolle.

## Varianten Heizpatrone und Verteilung (pro Jahr, gegenüber heute)

| Variante | Heizpatrone | WP-Strom | Starts/Tag | Netzbezug Allg. | Einspeisung | Wohnungen nutzen | **Vorteil Haus** | einfache Rechnung (bisher) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| fix, Heizpatrone wie heute | 6 076 kWh | ±0 kWh | 7,8 | ±0 kWh | ±0 kWh | ±0 kWh | **±0 €** | ±0 € |
| fix, Heizpatrone aus (nur Notheizung) | 0 kWh | +2 039 kWh | 8,3 | +590 kWh | +3 592 kWh | +1 035 kWh | **+322 €** | +452 € |
| dynamisch, Heizpatrone wie heute | 6 076 kWh | ±0 kWh | 7,8 | ±0 kWh | −1 042 kWh | +1 042 kWh | **+150 €** | +124 € |
| dynamisch, Heizpatrone 11–15 Uhr gesperrt | 3 447 kWh | +924 kWh | 8,1 | +142 kWh | +463 kWh | +1 383 kWh | **+296 €** | +312 € |
| dynamisch, Heizpatrone erst ab 3 kW (Schwelle) | 5 164 kWh | +313 kWh | 7,8 | +116 kWh | −1 002 kWh | +1 716 kWh | **+270 €** | +319 € |
| dynamisch, 3 kW Reserve für die Wohnungen | 3 847 kWh | +774 kWh | 7,9 | +233 kWh | −653 kWh | +2 341 kWh | **+401 €** | +502 € |
| dynamisch, Heizpatrone aus | 0 kWh | +2 039 kWh | 8,3 | +590 kWh | +2 184 kWh | +2 442 kWh | **+525 €** | +658 € |
| dynamisch, Heizpatrone aus + PV-Anhebung WP | 0 kWh | +2 349 kWh | 8,5 | +156 kWh | +1 636 kWh | +2 246 kWh | **+554 €** | – |
| dynamisch, 3 kW Reserve + PV-Anhebung WP | 3 602 kWh | +1 147 kWh | 8,1 | −249 kWh | −1 080 kWh | +2 157 kWh | **+455 €** | – |

„Vorteil Haus“ = geringere arbeitsabhängige Stromkosten aller Wohnungen und Allgemein zusammen, abzüglich entgangener Einspeisevergütung (brutto). „PV-Anhebung WP“: bei mehr als 3 kW Überschuss schaltet die Wärmepumpe 8 K höher (Stopp höchstens 58 °C am Fühler), Arbeitszahl −2,5 % je Kelvin darüber – nur wirksam, wenn die Wärmepumpe das Signal auch befolgt (heute nicht der Fall).

## Batterie (AC, Laden nur aus dem Rest nach den Wohnungen)

Barwertfaktor 11,9 (15 Jahre, 3 % Zins, Strom +2 %/Jahr, Alterung −2 %/Jahr). „lohnt bis“ = höchster Preis je kWh Speicher (inkl. Einbau), bei dem sie sich über die Lebensdauer gerade bezahlt macht.

| Heizpatrone | Batterie | versorgt | entladen | Vollzyklen | **Ersparnis/Jahr** | **lohnt bis** | einfache Rechnung (bisher) |
|---|---:|---|---:|---:|---:|---:|---:|
| wie heute | 5 kWh | Allgemein | 1 462 kWh | 292 | **220 €** | **523 €/kWh** | 475 €/kWh |
| wie heute | 10 kWh | Allgemein | 2 634 kWh | 263 | **428 €** | **510 €/kWh** | 470 €/kWh |
| wie heute | 10 kWh | Allgemein + Wohnungen | 2 901 kWh | 290 | **397 €** | **472 €/kWh** | 413 €/kWh |
| wie heute | 15 kWh | Allgemein | 3 610 kWh | 241 | **601 €** | **477 €/kWh** | 445 €/kWh |
| wie heute | 20 kWh | Allgemein | 4 296 kWh | 215 | **722 €** | **430 €/kWh** | 399 €/kWh |
| 3 kW Reserve | 5 kWh | Allgemein | 1 591 kWh | 318 | **239 €** | **569 €/kWh** | 584 €/kWh |
| 3 kW Reserve | 10 kWh | Allgemein | 2 803 kWh | 280 | **454 €** | **541 €/kWh** | 541 €/kWh |
| 3 kW Reserve | 10 kWh | Allgemein + Wohnungen | 2 973 kWh | 297 | **421 €** | **501 €/kWh** | 496 €/kWh |
| 3 kW Reserve | 15 kWh | Allgemein | 3 801 kWh | 253 | **632 €** | **501 €/kWh** | 498 €/kWh |
| 3 kW Reserve | 20 kWh | Allgemein | 4 515 kWh | 226 | **758 €** | **451 €/kWh** | 443 €/kWh |
| aus | 5 kWh | Allgemein | 1 655 kWh | 331 | **254 €** | **605 €/kWh** | 645 €/kWh |
| aus | 10 kWh | Allgemein | 2 970 kWh | 297 | **488 €** | **581 €/kWh** | 593 €/kWh |
| aus | 10 kWh | Allgemein + Wohnungen | 3 134 kWh | 313 | **457 €** | **544 €/kWh** | 558 €/kWh |
| aus | 15 kWh | Allgemein | 4 076 kWh | 272 | **684 €** | **543 €/kWh** | 544 €/kWh |
| aus | 20 kWh | Allgemein | 4 932 kWh | 247 | **835 €** | **497 €/kWh** | 489 €/kWh |
| aus + PV-Anhebung | 5 kWh | Allgemein | 1 622 kWh | 324 | **249 €** | **593 €/kWh** | – |
| aus + PV-Anhebung | 10 kWh | Allgemein | 2 860 kWh | 286 | **469 €** | **558 €/kWh** | – |
| aus + PV-Anhebung | 10 kWh | Allgemein + Wohnungen | 3 068 kWh | 307 | **436 €** | **519 €/kWh** | – |
| aus + PV-Anhebung | 15 kWh | Allgemein | 3 881 kWh | 259 | **649 €** | **515 €/kWh** | – |
| aus + PV-Anhebung | 20 kWh | Allgemein | 4 652 kWh | 233 | **785 €** | **467 €/kWh** | – |

Ergebnis: Mit dem genaueren Wärmemodell ändert sich der Wert einer Batterie kaum (±10 %). Die Heizpatrone auszuschalten bleibt die beste Einzelmaßnahme, der Vorteil ist aber etwas kleiner als in der einfachen Rechnung.

