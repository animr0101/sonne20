"""Wärmeseite aus Tageswerten: Heizkurve der Wärmepumpe und Ersatzfaktor der Heizpatrone.

Regression je Jahreszeit: WP-Strom(Tag) = a + b·Heizgrade(Tag) + c·Heizgrade(Vortag) + d·Einstrahlung + e·Heizpatrone(Tag)
-e = eingesparter WP-Strom je kWh Heizpatrone; × COP = Ersatzfaktor.
Wetter: GeoSphere Austria (Innsbruck Flughafen / Universität).  Aufruf: python3 aufbereitung/waerme_analyse.py
"""
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
AUS = ROOT / "aufbereitung" / "ausgabe"
de = lambda x, nk=2: f"{x:.{nk}f}".replace(".", ",")

df = pd.concat([pd.read_csv(f, sep=";", decimal=",", index_col=0, parse_dates=True,
                            usecols=["zeit", "wp", "heizpatrone", "aussen", "strahlung", "sf_status"])
                for f in sorted(AUS.glob("viertelstunden_*.csv"))])
d = df.resample("D").agg({"wp": "sum", "heizpatrone": "sum", "aussen": "mean", "strahlung": "mean"})
d["geschaetzt"] = df["sf_status"].eq("geschaetzt").resample("D").sum()
d = d[(d["geschaetzt"] < 8) & d["aussen"].notna()].copy()
d["aussen_vortag"] = d["aussen"].shift(1)

L = ["# Wärmeseite: Heizkurve und Ersatzfaktor der Heizpatrone", "",
     f"Tageswerte {d.index.min():%d.%m.%Y} – {d.index.max():%d.%m.%Y} ({len(d)} Tage mit Smartfox-Daten), Wetter GeoSphere Austria.", "",
     "## Wärmepumpenstrom je Tag nach Außentemperatur", "", "| Tagesmittel außen | Tage | WP-Strom/Tag |", "|---|---:|---:|"]
for iv, g in d.groupby(pd.cut(d["aussen"], [-15, -5, 0, 5, 10, 15, 20, 30]), observed=True)["wp"]:
    L.append(f"| {iv.left:.0f} bis {iv.right:.0f} °C | {len(g)} | {de(g.mean(), 1)} kWh |")
L += ["", "## Wie viel Wärmepumpenstrom spart 1 kWh Heizpatrone?", "",
      "| Jahreszeit | gesparter WP-Strom je kWh Heizpatrone | Ersatzfaktor bei COP 3,5 | R² |", "|---|---:|---:|---:|"]
for name, mon in (("Winter (Nov–Feb)", [11, 12, 1, 2]), ("Übergang (Mär–Apr, Sep–Okt)", [3, 4, 9, 10]), ("Sommer (Mai–Aug)", [5, 6, 7, 8])):
    s = d[d.index.month.isin(mon)]
    X = pd.DataFrame({"hgt": np.maximum(0, 15 - s["aussen"]), "hgt_v": np.maximum(0, 15 - s["aussen_vortag"]),
                      "sonne": s["strahlung"], "hp": s["heizpatrone"], "k": 1.0}).dropna()
    y = s["wp"].reindex(X.index).to_numpy()
    b, *_ = np.linalg.lstsq(X.to_numpy(), y, rcond=None)
    r = y - X.to_numpy() @ b
    cov = (r @ r) / (len(y) - X.shape[1]) * np.linalg.inv(X.to_numpy().T @ X.to_numpy())
    i = list(X.columns).index("hp")
    r2 = 1 - (r @ r) / ((y - y.mean()) @ (y - y.mean()))
    L.append(f"| {name} | {de(-b[i])} ± {de(1.96 * np.sqrt(cov[i, i]))} kWh | {de(-b[i] * 3.5, 1)} | {de(r2)} |")
L += ["", "Physikalisch möglich sind höchstens 1/COP ≈ 0,29 kWh. Der Winterwert liegt darüber, weil sonnige Wintertage",
      "(Heizpatrone läuft) auch über die Fenster heizen – die Tagesstatistik trennt das nicht sauber. Verwendet wird daher:",
      "Ersatzfaktor 1,0 (Sep–Apr) und 0,9 (Mai–Aug), siehe einstellungen.json."]
ziel = ROOT / "simulation" / "ausgabe" / "waerme_ersatzfaktor.md"
ziel.write_text("\n".join(L) + "\n", encoding="utf-8")
print("→", ziel.relative_to(ROOT))
