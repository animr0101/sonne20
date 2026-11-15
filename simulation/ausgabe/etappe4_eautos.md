# Etappe 4 – E-Autos an den Stellplätzen

Referenzjahr **2025** · Wallbox 11 kW (einstellbar) · Ladeverluste 10 % · Ziel-Ladestand 80 %, Mindest-Ladestand 30 % · Verbrauch 18 kWh/100 km, Winter +25 % · Standard 12.000 km/Jahr.

**Basis:** dynamische Verteilung + Heizpatrone hinter den Tops (beides ohne Investition, siehe Etappe 3).

**Ladestrategien:** *sofort* = lädt bei Ankunft mit voller Leistung bis 80 %. *PV-Überschuss* = lädt bis 30 % sofort, darüber nur mit Strom, den die Wohnungen gerade nicht brauchen (mindestens 4,1 kW dreiphasig; mit Phasenumschaltung ab 1,4 kW).

**Kosten je 100 km:** Netzstrom zum Wohnungstarif (22,15 ct, SNAP 20,52 ct), PV-Strom zum internen PV-Preis (Annahme 12 ct).

**Kontrolle K10:** Das nachgebildete Auto von Top 4 lädt mit „sofort“ wie das echte: 1.656 kWh (gemessen 1.654), 71 Ladungen (80), Ø 23 kWh je Ladung (23), 82 % der Ladungen starten zwischen 12 und 22 Uhr (79 %).

## 1. Das E-Auto von Top 4: was bringt Laden mit PV-Überschuss?

| Verteilung | Strategie | geladen | aus PV | PV-Anteil | Kosten je 100 km | Kosten Top 4 Auto/Jahr |
|---|---|---:|---:|---:|---:|---:|
| fix (wie heute) | sofort (wie heute) | 1.656 kWh | 67 kWh | **4 %** | 4,60 € | 354 € |
| fix (wie heute) | PV-Überschuss (immer angesteckt) | 1.640 kWh | 233 kWh | **14 %** | 4,29 € | 331 € |
| dynamisch + Heizpatrone hinten | sofort (wie heute) | 1.656 kWh | 517 kWh | **31 %** | 4,06 € | 312 € |
| dynamisch + Heizpatrone hinten | PV-Überschuss (immer angesteckt) | 1.641 kWh | 1.416 kWh | **86 %** | 2,85 € | 220 € |

Bei **fixer Verteilung** bekommt das Auto nur den Anteil von Top 4 (13 % des Überschusses, bei voller Sonne ~2 kW) – PV-Überschussladen bringt dann wenig, weil die Wallbox den ganzen Überschuss „sieht“, aber nur einen kleinen Teil zugeteilt bekommt.

## 2. Mehr E-Autos im Haus

Top 4 bleibt wie heute (sofort). Dazu kommen nacheinander weitere Autos (Annahmen, je 12.000 km, Wenigfahrer 6.000 km).

| Autos zusätzlich | Strategie | geladen (neue Autos) | davon aus PV | PV-Anteil | Restüberschuss | Ø Kosten je 100 km | Ladespitze aller Autos |
|---:|---|---:|---:|---:|---:|---:|---:|
| 0 | – | – | – | – | 12.405 kWh | – | 11,0 kW |
| 1 | sofort | 2.619 kWh | 654 kWh | **25 %** | 12.010 kWh | 4,27 € | 22,0 kW |
| 1 | PV-Überschuss | 2.590 kWh | 1.606 kWh | **62 %** | 11.209 kWh | 3,42 € | 22,0 kW |
| 2 | sofort | 5.222 kWh | 1.764 kWh | **34 %** | 11.207 kWh | 4,06 € | 33,0 kW |
| 2 | PV-Überschuss | 5.096 kWh | 3.658 kWh | **72 %** | 9.551 kWh | 3,16 € | 22,0 kW |
| 3 | sofort | 7.825 kWh | 2.303 kWh | **29 %** | 10.886 kWh | 4,15 € | 44,0 kW |
| 3 | PV-Überschuss | 7.665 kWh | 4.952 kWh | **65 %** | 8.554 kWh | 3,32 € | 22,0 kW |
| 4 | sofort | 9.131 kWh | 2.808 kWh | **31 %** | 10.521 kWh | 4,12 € | 55,0 kW |
| 4 | PV-Überschuss | 8.936 kWh | 5.990 kWh | **67 %** | 7.687 kWh | 3,26 € | 33,0 kW |

### Je Auto (4 zusätzliche Autos)

| Auto | Profil | Strategie | Fahrleistung | geladen | aus PV | PV-Anteil | Kosten je 100 km |
|---|---|---|---:|---:|---:|---:|---:|
| Auto A (Pendler, Top 1) | Pendler | sofort | 12.000 km | 2.619 kWh | 580 kWh | **22 %** | 4,33 € |
| Auto B (Homeoffice, Top 3) | Homeoffice | sofort | 12.000 km | 2.604 kWh | 1.108 kWh | **43 %** | 3,84 € |
| Auto C (Pendler, Top 8) | Pendler | sofort | 12.000 km | 2.602 kWh | 588 kWh | **23 %** | 4,30 € |
| Auto D (Wenigfahrer, Top 6) | Wenigfahrer | sofort | 6.000 km | 1.307 kWh | 533 kWh | **41 %** | 3,89 € |
| Auto A (Pendler, Top 1) | Pendler | PV-Überschuss | 12.000 km | 2.590 kWh | 1.573 kWh | **61 %** | 3,45 € |
| Auto B (Homeoffice, Top 3) | Homeoffice | PV-Überschuss | 12.000 km | 2.506 kWh | 2.058 kWh | **82 %** | 2,88 € |
| Auto C (Pendler, Top 8) | Pendler | PV-Überschuss | 12.000 km | 2.569 kWh | 1.313 kWh | **51 %** | 3,63 € |
| Auto D (Wenigfahrer, Top 6) | Wenigfahrer | PV-Überschuss | 6.000 km | 1.271 kWh | 1.047 kWh | **82 %** | 2,92 € |

## 3. Was bringt eine Wallbox mit Phasenumschaltung? (Auto B, Homeoffice, PV-Überschuss)

| Wallbox | geladen | aus PV | PV-Anteil | Kosten je 100 km |
|---|---:|---:|---:|---:|
| nur dreiphasig (ab 4,1 kW) | 2.519 kWh | 2.140 kWh | **85 %** | 2,84 € |
| mit Phasenumschaltung (ab 1,4 kW) | 2.552 kWh | 2.251 kWh | **88 %** | 2,81 € |
| dreiphasig, max. 7,4 kW | 2.515 kWh | 2.143 kWh | **85 %** | 2,83 € |

## 4. Wallbox am Wohnungszähler oder am Allgemeinzähler? (Auto A, Pendler)

| Anschluss | Strategie | geladen | aus PV | PV-Anteil | Kosten je 100 km |
|---|---|---:|---:|---:|---:|
| Wohnungszähler (Top 1) | sofort | 2.619 kWh | 654 kWh | **25 %** | 4,27 € |
| Wohnungszähler (Top 1) | PV-Überschuss | 2.590 kWh | 1.606 kWh | **62 %** | 3,42 € |
| Allgemeinzähler | sofort | 2.619 kWh | 746 kWh | **28 %** | 4,77 € |
| Allgemeinzähler | PV-Überschuss | 2.600 kWh | 1.845 kWh | **71 %** | 3,47 € |

Am Allgemeinzähler bekommt das Auto den PV-Strom **vor** der Verteilung an die Tops (wie die Wärmepumpe). Der Strom würde dann über die Hauskasse abgerechnet – organisatorisch aufwändiger (eigener Zähler je Stellplatz für die Abrechnung).

## 5. Ersetzen E-Autos die Batterie?

Ersparnis einer Batterie 10 kWh / 5 kW (lädt nach den Tops, vor der Heizpatrone) – mit und ohne zusätzliche E-Autos, die mit PV-Überschuss laden.

| E-Autos | Ersparnis durch die Batterie/Jahr | lohnt bis | Restüberschuss ohne Batterie |
|---|---:|---:|---:|
| nur Top 4 (wie heute) | **581 €** | 692 €/kWh | 12.405 kWh |
| + 2 Autos mit PV-Überschuss | **531 €** | 632 €/kWh | 9.551 kWh |
| + 4 Autos mit PV-Überschuss | **501 €** | 597 €/kWh | 7.687 kWh |

## 6. Hinweis Anschlussleistung

Die Wohnungen haben laut Rechnung **6 kW Netzbereitstellung**. Eine 11-kW-Wallbox am Wohnungszähler liegt beim Laden darüber – bei 4 zusätzlichen Autos (sofort) in 3.916 Viertelstunden im Jahr. Gleichzeitige Ladespitze aller Autos: 55,0 kW. Ob das zulässig ist (bzw. ob die Netzbereitstellung erhöht oder ein Lastmanagement nötig ist), muss mit der HALLAG bzw. dem Elektriker geklärt werden. Top 4 lädt bereits heute mit ~10 kW.

