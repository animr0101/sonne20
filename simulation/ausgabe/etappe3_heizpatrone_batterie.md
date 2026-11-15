# Etappe 3 – Heizpatrone, Wärmepumpe und Batteriespeicher

Referenzjahr **2025** · Preise brutto · Ergebnisse als **arbeitsabhängige Stromkosten des ganzen Hauses**
(Allgemeinstrom + Netzbezug aller Tops − Einspeisevergütung für den Restüberschuss; Grund- und Messpreise bleiben gleich).

Heute (S0): **7.359 €/Jahr** = Allgemeinstrom 3.916 € + Tops 4.337 € − Einspeisung 894 €.

**Annahmen Wärme:** COP der Wärmepumpe 3,5 · Ersatzfaktor der Heizpatrone (Anteil ihrer Wärme, den sonst die
Wärmepumpe liefern müsste) Okt–Apr 0,6 / Mai–Sep 0,2 – aus den Daten geschätzt, aber unsicher; daher immer auch mit 0 und 1 gerechnet.
Fehlende Heizpatronen-Wärme heizt die Wärmepumpe bei ihren nächsten Läufen nach – aus PV, wenn gerade Überschuss da ist, sonst aus dem Netz.

## 1. Heizpatrone hinter die Tops (Smartfox-Einstellung, keine Investition)

Heute bekommt die Heizpatrone den Überschuss **vor** den Tops. Umgestellt bekommt sie nur, was die Tops gerade nicht brauchen.

| Verteilung | Ersatzfaktor | Heizpatrone | Tops nutzen | Wärmepumpe heizt nach | davon aus Netz* | **Ersparnis Haus/Jahr** |
|---|---|---:|---:|---:|---:|---:|
| fix | 0 (Wärme wäre nicht gebraucht worden) | 5.503 kWh (-1.392) | 4.637 kWh (+1.639) | 0 kWh | 0 kWh | **+341 €** |
| fix | Standard (0,6 / 0,2) | 5.441 kWh (-1.453) | 4.594 kWh (+1.597) | 166 kWh | +49 kWh | **+318 €** |
| fix | 1 (jede kWh ersetzt Wärmepumpe) | 5.351 kWh (-1.544) | 4.539 kWh (+1.541) | 441 kWh | +154 kWh | **+277 €** |
| dynamisch | 0 (Wärme wäre nicht gebraucht worden) | 4.610 kWh (-2.284) | 6.142 kWh (+2.284) | 0 kWh | 0 kWh | **+501 €** |
| dynamisch | Standard (0,6 / 0,2) | 4.537 kWh (-2.358) | 6.050 kWh (+2.193) | 270 kWh | +84 kWh | **+457 €** |
| dynamisch | 1 (jede kWh ersetzt Wärmepumpe) | 4.438 kWh (-2.456) | 5.934 kWh (+2.077) | 702 kWh | +262 kWh | **+383 €** |

\* Mehr Netzbezug am Allgemeinzähler durch das Nachheizen (Rest kommt aus PV-Überschuss).
Ersparnis jeweils gegenüber derselben Verteilung mit Heizpatrone vor den Tops.

## 2. Batteriespeicher – welche Größe?

Batterie am Allgemeinzähler (AC-gekoppelt, Wirkungsgrad 90 %, Eigenverbrauch 20 W), lädt **nur aus dem Restüberschuss**
(nach Heizpatrone und Tops), entlädt für den **Allgemeinstrom** (v. a. Wärmepumpe). Verteilung **dynamisch** angenommen.

**Wirtschaftlichkeit:** Barwert über 15 Jahre (Zins 3 %, Strompreis +2 %/Jahr, Alterung −2 %/Jahr) = Ersparnis × 11,9. „Lohnt bis“ = höchster Preis pro kWh Speicher (brutto, inkl. Batteriewechselrichter und Montage), bei dem sich die Batterie über die Lebensdauer gerade bezahlt macht.

| Kapazität | Leistung | entladen | Vollzyklen | Tage voll geladen | Tage leer gelaufen | Netzbezug Allg. | **Ersparnis/Jahr** | lohnt bis | Amortisation bei 700 €/kWh |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 kWh | 5 kW | 1.336 kWh | 267 | 265 | 365 | -1.231 kWh | **200 €** | 475 €/kWh | 17,5 Jahre |
| 10 kWh | 5 kW | 2.429 kWh | 243 | 224 | 329 | -2.325 kWh | **395 €** | 470 €/kWh | 17,7 Jahre |
| 10 kWh | 10 kW | 2.495 kWh | 250 | 238 | 339 | -2.391 kWh | **406 €** | 484 €/kWh | 17,2 Jahre |
| 15 kWh | 5 kW | 3.174 kWh | 212 | 191 | 290 | -3.070 kWh | **527 €** | 419 €/kWh | 19,9 Jahre |
| 15 kWh | 10 kW | 3.364 kWh | 224 | 218 | 302 | -3.260 kWh | **560 €** | 445 €/kWh | 18,7 Jahre |
| 20 kWh | 5 kW | 3.600 kWh | 180 | 163 | 258 | -3.496 kWh | **604 €** | 360 €/kWh | 23,2 Jahre |
| 20 kWh | 10 kW | 3.992 kWh | 200 | 201 | 266 | -3.888 kWh | **671 €** | 399 €/kWh | 20,9 Jahre |
| 30 kWh | 5 kW | 4.026 kWh | 134 | 116 | 228 | -3.922 kWh | **684 €** | 271 €/kWh | 30,7 Jahre |
| 30 kWh | 10 kW | 4.774 kWh | 159 | 172 | 233 | -4.669 kWh | **809 €** | 321 €/kWh | 26,0 Jahre |
| 40 kWh | 5 kW | 4.161 kWh | 104 | 97 | 212 | -4.057 kWh | **709 €** | 211 €/kWh | 39,5 Jahre |
| 40 kWh | 10 kW | 5.208 kWh | 130 | 149 | 208 | -5.104 kWh | **889 €** | 265 €/kWh | 31,5 Jahre |

### Wann arbeitet die Batterie? (10 kWh / 5 kW, dynamisch)

| Monat | Netzbezug Allg. ohne | mit Batterie | eingespart |
|---|---:|---:|---:|
| 01 | 2.420 kWh | 2.317 kWh | 103 kWh |
| 02 | 1.789 kWh | 1.588 kWh | 201 kWh |
| 03 | 1.567 kWh | 1.333 kWh | 234 kWh |
| 04 | 882 kWh | 610 kWh | 272 kWh |
| 05 | 665 kWh | 405 kWh | 260 kWh |
| 06 | 315 kWh | 70 kWh | 245 kWh |
| 07 | 417 kWh | 160 kWh | 257 kWh |
| 08 | 387 kWh | 153 kWh | 234 kWh |
| 09 | 573 kWh | 367 kWh | 206 kWh |
| 10 | 1.373 kWh | 1.182 kWh | 191 kWh |
| 11 | 2.233 kWh | 2.108 kWh | 125 kWh |
| 12 | 2.573 kWh | 2.576 kWh | -3 kWh |

## 3. Wovon soll die Batterie laden? (10 kWh / 5 kW, dynamisch)

Wichtig für eine faire Bewertung: Ändert sich mit der Batterie auch die Reihenfolge von Heizpatrone und Tops, so ist ein Teil der Ersparnis **nicht der Batterie zu verdanken**, sondern der Umstellung – und die gibt es auch ohne Batterie. Die Spalte „durch die Batterie“ vergleicht daher immer mit derselben Reihenfolge **ohne** Batterie.

| Reihenfolge | Heizpatrone | Tops nutzen | entladen | WP heizt nach | Ersparnis gesamt | davon Umstellung (ohne Batterie) | **davon durch die Batterie** | Batterie, Ersatzfaktor 1 | lohnt bis |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| nur Restüberschuss (nach Heizpatrone und Tops) | 6.890 kWh | 3.822 kWh | 2.429 kWh | 1 kWh | +395 € | 0 € | **+395 €** | +394 € | 470 €/kWh |
| vor den Tops (nach Heizpatrone) | 6.890 kWh | 3.108 kWh | 2.686 kWh | 1 kWh | +337 € | 0 € | **+337 €** | +337 € | 401 €/kWh |
| vor Heizpatrone und Tops | 4.150 kWh | 3.329 kWh | 3.465 kWh | 329 kWh | +667 € | 0 € | **+667 €** | +617 € | 794 €/kWh |
| **Tops → Batterie → Heizpatrone** | 2.839 kWh | 5.993 kWh | 2.977 kWh | 466 kWh | +1.043 € | +457 € | **+586 €** | +548 € | 697 €/kWh |

Ersparnis gesamt gegenüber „dynamisch, ohne Batterie, Heizpatrone vor den Tops“. Wenn die Batterie vor der Heizpatrone lädt, bekommt sie auch im Winter Strom – sonst bleibt nach der Heizpatrone kaum Restüberschuss.

### Größen mit Reihenfolge Tops → Batterie → Heizpatrone (dynamisch)

Ersparnis **durch die Batterie** = gegenüber dynamisch mit Heizpatrone hinter den Tops, ohne Batterie (diese Umstellung allein bringt schon 457 €/Jahr).

| Kapazität | Leistung | entladen | Vollzyklen | Heizpatrone | WP heizt nach | **Ersparnis durch Batterie/Jahr** | mit Ersatzfaktor 1 | lohnt bis | Amortisation bei 700 €/kWh |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 kWh | 5 kW | 1.682 kWh | 336 | 3.125 kWh | 435 kWh | **341 €** | 314 € | 812 €/kWh | 10,3 Jahre |
| 10 kWh | 5 kW | 2.977 kWh | 298 | 2.839 kWh | 466 kWh | **586 €** | 548 € | 697 €/kWh | 12,0 Jahre |
| 10 kWh | 10 kW | 3.015 kWh | 302 | 2.624 kWh | 489 kWh | **606 €** | 564 € | 721 €/kWh | 11,6 Jahre |
| 15 kWh | 10 kW | 4.002 kWh | 267 | 2.472 kWh | 505 kWh | **788 €** | 745 € | 626 €/kWh | 13,3 Jahre |
| 20 kWh | 10 kW | 4.741 kWh | 237 | 2.343 kWh | 520 kWh | **925 €** | 882 € | 551 €/kWh | 15,1 Jahre |
| 30 kWh | 10 kW | 5.669 kWh | 189 | 2.142 kWh | 549 kWh | **1.097 €** | 1.054 € | 435 €/kWh | 19,1 Jahre |

## 4. Darf die Batterie auch die Tops versorgen? (⚠️ rechtlich zu prüfen)

| Batterie | versorgt | entladen | davon an Tops | Vollzyklen | **Ersparnis/Jahr** |
|---|---|---:|---:|---:|---:|
| 10 kWh / 10 kW | nur Allgemeinstrom | 2.495 kWh | 0 kWh | 250 | **406 €** |
| 10 kWh / 10 kW | Allgemeinstrom + Tops | 2.630 kWh | 2.094 kWh | 263 | **353 €** |
| 20 kWh / 10 kW | nur Allgemeinstrom | 3.992 kWh | 0 kWh | 200 | **671 €** |
| 20 kWh / 10 kW | Allgemeinstrom + Tops | 4.667 kWh | 3.304 kWh | 233 | **676 €** |

## 5. Alles zusammen – was bringt welcher Schritt?

Jede Zeile gegenüber heute. Die Batterie-Zeilen enthalten die Schritte darüber (dynamisch, Heizpatrone hinter den Tops).

| Schritt | Kosten Haus/Jahr | Ersparnis gegenüber heute | Investition |
|---|---:|---:|---|
| Heute (fix, Heizpatrone vor Tops) | 7.359 € | 0 € | – |
| + dynamische Verteilung | 7.235 € | +124 € | keine |
| + Heizpatrone hinter die Tops | 6.778 € | +581 € | keine (Smartfox) |
| + Batterie 10 kWh / 5 kW, lädt nur aus Restüberschuss | 6.381 € | +978 € | ca. 7.000 € (Platzhalter) |
| + statt dessen 20 kWh / 10 kW, nur aus Restüberschuss | 6.103 € | +1.255 € | ca. 14.000 € (Platzhalter) |
| + Batterie 10 kWh / 5 kW, lädt **vor** der Heizpatrone (Tops → Batterie → Heizpatrone) | 6.192 € | +1.167 € | ca. 7.000 € (Platzhalter) |
| + statt dessen 20 kWh / 10 kW, lädt vor der Heizpatrone | 5.852 € | +1.506 € | ca. 14.000 € (Platzhalter) |

Hinweis: Mit der Heizpatrone hinter den Tops bekommt eine Batterie, die aus dem Restüberschuss lädt, die Energie, die vorher in die Heizpatrone ging – die Batterie konkurriert dann wieder mit der Heizpatrone.

