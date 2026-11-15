# Wärmeseite: Heizkurve und Ersatzfaktor der Heizpatrone

Tageswerte 01.01.2024 – 31.08.2026 (966 Tage mit Smartfox-Daten), Wetter GeoSphere Austria.

## Wärmepumpenstrom je Tag nach Außentemperatur

| Tagesmittel außen | Tage | WP-Strom/Tag |
|---|---:|---:|
| -15 bis -5 °C | 15 | 95,6 kWh |
| -5 bis 0 °C | 73 | 82,5 kWh |
| 0 bis 5 °C | 164 | 70,4 kWh |
| 5 bis 10 °C | 183 | 51,0 kWh |
| 10 bis 15 °C | 181 | 33,8 kWh |
| 15 bis 20 °C | 194 | 19,9 kWh |
| 20 bis 30 °C | 156 | 13,1 kWh |

## Wie viel Wärmepumpenstrom spart 1 kWh Heizpatrone?

| Jahreszeit | gesparter WP-Strom je kWh Heizpatrone | Ersatzfaktor bei COP 3,5 | R² |
|---|---:|---:|---:|
| Winter (Nov–Feb) | 0,61 ± 0,20 kWh | 2,1 | 0,70 |
| Übergang (Mär–Apr, Sep–Okt) | 0,38 ± 0,15 kWh | 1,3 | 0,76 |
| Sommer (Mai–Aug) | 0,25 ± 0,11 kWh | 0,9 | 0,53 |

Physikalisch möglich sind höchstens 1/COP ≈ 0,29 kWh. Der Winterwert liegt darüber, weil sonnige Wintertage
(Heizpatrone läuft) auch über die Fenster heizen – die Tagesstatistik trennt das nicht sauber. Verwendet wird daher:
Ersatzfaktor 1,0 (Sep–Apr) und 0,9 (Mai–Aug), siehe einstellungen.json.
