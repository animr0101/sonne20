# Prüfbericht Datenaufbereitung

Zeitraum: 01.01.2024 – 31.08.2026 23:45 · 93.492 Viertelstunden

✅ bestanden · ⚠️ Hinweis · ❌ nicht bestanden

**Alle harten Kontrollen bestanden.**

### ✅ K1 – Jahressummen = Rechnungen HALLAG (±0,1 %)

| Jahr | Größe | Rechnung | Daten | Abweichung |
|---|---|---:|---:|---:|
| 2024 | Netzbezug Allgemein | 15.131,14 kWh | 15.132,37 kWh | +0,008 % |
| 2024 | Einspeisung | 15.323,50 kWh | 15.323,51 kWh | +0,000 % |
| 2025 | Netzbezug Allgemein | 15.193,86 kWh | 15.193,92 kWh | +0,000 % |
| 2025 | Einspeisung | 16.327,25 kWh | 16.327,24 kWh | -0,000 % |

### ✅ K2 – Viertelstunden = Tages-Zählerstände (±0,1 %)

- Netzbezug: Zählerstände 02.01.2024 → 31.08.2026: 40.331,35 kWh · Summe Viertelstunden: 40.333,44 kWh · +0,005 %
- Einspeisung: Zählerstände 02.01.2024 → 31.08.2026: 45.292,33 kWh · Summe Viertelstunden: 45.292,33 kWh · -0,000 %

### ✅ K3 – EDA-Erzeugung = Einspeisung Zähler, je Viertelstunde (±1 Wh)

93.492 Viertelstunden verglichen, Abweichungen > 1 Wh: 0, größte: 0,0 Wh

### ✅ K4 – EDA: Erzeugung = Σ Eigendeckung + Restüberschuss (±5 Wh)

Abweichungen > 5 Wh: 0, größte: 2,2 Wh (die Erzeugung wird von der HALLAG auf 0,01 kWh gerundet geliefert, daher ±5 Wh Toleranz)

### ✅ K5 – Statische Verteilung nachgerechnet = EDA-Eigendeckung (±2 Wh)

900.268 Werte (Viertelstunde × Top) verglichen, Abweichungen: 0

### ✅ K5b – Fixer Schlüssel der HALLAG ist konstant und entspricht den Einstellungen

Ab 28.12.2024 (Top 10 dabei), Viertelstunden mit > 0,5 kWh Erzeugung.

| Top | Schlüssel lt. Einstellungen | gemessen (Median) | Streuung |
|---|---:|---:|---:|
| 1 | +9,6883 % | +9,6883 % | +0,011 %-Pkt |
| 2 | +6,2736 % | +6,2736 % | +0,012 %-Pkt |
| 3 | +9,0530 % | +9,0530 % | +0,011 %-Pkt |
| 4 | 13,0038 % | 13,0035 % | +0,007 %-Pkt |
| 5 | +7,8916 % | +7,8916 % | +0,011 %-Pkt |
| 6 | +6,1842 % | +6,1842 % | +0,012 %-Pkt |
| 7 | +7,8916 % | +7,8916 % | +0,011 %-Pkt |
| 8 | 10,9391 % | 10,9390 % | +0,012 %-Pkt |
| 9 | 12,1997 % | 12,2000 % | +0,012 %-Pkt |
| 10 | 16,8751 % | 16,8753 % | +0,012 %-Pkt |

### ✅ K6 – Allgemeinverbrauch nie negativ und nie über Netzbereitstellung (25 kW)

negativ: 0, über 6,25 kWh/Viertelstunde: 0, Maximum 3,92 kWh (= 15,7 kW).

Wo Smartfox-PV und Zähler nicht zusammenpassten, wurde die PV minimal angehoben: 149 Viertelstunden, zusammen 57,3 kWh (+0,073 % der PV-Erzeugung).

### ✅ K6b – Heizpatrone läuft nur mit PV-Strom

Viertelstunden mit Heizpatrone > PV: 4 von 93.026 (0,9 kWh).

### ✅ K7 – Smartfox-Netzmessung passt zum Zähler (±5 % je Monat, nur Info)

Für Netzbezug und Einspeisung werden immer die Zählerwerte verwendet; der Smartfox liefert nur PV und Heizpatrone. Diese Tabelle zeigt, wie genau der Smartfox misst.

Monate mit > 5 % Abweichung (Einspeisung nur ab 100 kWh/Monat): 0

| Monat | Bezug Zähler | Bezug Smartfox | Abw. | Einsp. Zähler | Einsp. Smartfox | Abw. |
|---|---:|---:|---:|---:|---:|---:|
| 2024-01 | 2.899 | 2.988 | 3,1 % | 3 | 1 | 0,0 % |
| 2024-02 | 1.936 | 1.995 | 3,1 % | 15 | 11 | 0,0 % |
| 2024-03 | 1.464 | 1.507 | 2,9 % | 877 | 890 | 1,5 % |
| 2024-04 | 938 | 965 | 2,8 % | 1.935 | 1.971 | 1,9 % |
| 2024-05 | 622 | 644 | 3,4 % | 2.129 | 2.184 | 2,6 % |
| 2024-06 | 426 | 437 | 2,8 % | 2.088 | 2.141 | 2,5 % |
| 2024-07 | 315 | 321 | 1,9 % | 2.660 | 2.730 | 2,7 % |
| 2024-08 | 310 | 315 | 1,8 % | 2.497 | 2.562 | 2,6 % |
| 2024-09 | 701 | 724 | 3,3 % | 1.503 | 1.541 | 2,5 % |
| 2024-10 | 915 | 946 | 3,4 % | 891 | 909 | 2,0 % |
| 2024-11 | 1.773 | 1.842 | 3,9 % | 650 | 663 | 1,9 % |
| 2024-12 | 2.824 | 2.938 | 4,1 % | 55 | 54 | 0,0 % |
| 2025-01 | 2.420 | 2.523 | 4,3 % | 289 | 290 | 0,4 % |
| 2025-02 | 1.713 | 1.785 | 4,2 % | 847 | 861 | 1,7 % |
| 2025-03 | 1.566 | 1.631 | 4,2 % | 1.491 | 1.524 | 2,2 % |
| 2025-04 | 882 | 915 | 3,8 % | 2.343 | 2.401 | 2,5 % |
| 2025-05 | 665 | 689 | 3,6 % | 1.958 | 2.003 | 2,3 % |
| 2025-06 | 315 | 321 | 2,0 % | 2.674 | 2.745 | 2,6 % |
| 2025-07 | 407 | 419 | 2,8 % | 1.855 | 1.899 | 2,4 % |
| 2025-08 | 385 | 394 | 2,3 % | 2.021 | 2.069 | 2,4 % |
| 2025-09 | 573 | 588 | 2,7 % | 1.405 | 1.438 | 2,4 % |
| 2025-10 | 1.373 | 1.422 | 3,6 % | 857 | 875 | 2,1 % |
| 2025-11 | 2.233 | 2.324 | 4,1 % | 434 | 441 | 1,7 % |
| 2025-12 | 2.461 | 2.564 | 4,2 % | 39 | 34 | 0,0 % |
| 2026-01 | 3.080 | 3.212 | 4,3 % | 158 | 158 | -0,1 % |
| 2026-02 | 2.240 | 2.336 | 4,3 % | 543 | 551 | 1,4 % |
| 2026-03 | 1.915 | 2.000 | 4,4 % | 1.218 | 1.244 | 2,1 % |
| 2026-04 | 1.062 | 1.105 | 4,0 % | 2.141 | 2.194 | 2,5 % |
| 2026-05 | 637 | 659 | 3,4 % | 2.527 | 2.592 | 2,6 % |
| 2026-06 | 412 | 424 | 2,8 % | 2.311 | 2.374 | 2,7 % |
| 2026-07 | 339 | 347 | 2,2 % | 2.575 | 2.642 | 2,6 % |
| 2026-08 | 357 | 364 | 2,0 % | 2.178 | 2.234 | 2,6 % |

### ✅ D1 – Datenlage Smartfox

Gemessen: 93.026 Viertelstunden, geschätzt: 466 (0,50 %).

Tage mit ≥ 2 h Lücke (PV aus Zählerwerten + typischem Allgemeinverbrauch geschätzt): 14.03.2024 (2,2 h), 07.10.2024 (9,2 h), 18.02.2025 (24,0 h), 03.07.2025 (18,8 h), 19.08.2025 (9,2 h), 20.08.2025 (2,5 h), 24.12.2025 (24,0 h), 03.04.2026 (24,0 h)

### ✅ D2 – Datenlage Allgemeinzähler

Im Export fehlt jeweils die letzte Viertelstunde des Monats (32 Werte). Einspeisung/Restüberschuss aus EDA übernommen, Netzbezug aus den Nachbarwerten interpoliert (zusammen 11,9 kWh).
